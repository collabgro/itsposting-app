const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const SocialPublisher = require('../services/SocialPublisher');

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getBaseUrl(req) {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.FRONTEND_URL;
  if (domain) {
    const host = domain.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  return `${req.protocol}://${req.get('host')}`;
}

module.exports = (pool) => {
  const router = express.Router();

  router.get('/accounts', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, platform, account_username, account_name, profile_image_url,
                enabled, auto_post, connected_at
         FROM social_accounts WHERE customer_id = $1
         ORDER BY connected_at DESC`,
        [req.customerId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/status', authenticate, (req, res) => {
    res.json({
      facebook:        { configured: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) },
      instagram:       { configured: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) },
      google_business: { configured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) },
      linkedin:        { configured: true, manualOnly: true },
      tiktok:          { configured: true, manualOnly: true },
      manual:          { configured: true },
    });
  });

  router.get('/connect/facebook', authenticate, (req, res) => {
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      return res.status(503).json({
        error: 'Facebook app credentials not configured',
        setup: 'Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to your secrets',
      });
    }
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/social/callback/facebook`;
    const state = Buffer.from(JSON.stringify({ customerId: req.customerId })).toString('base64');
    const scope = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'public_profile',
    ].join(',');
    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      `&response_type=code`;
    res.redirect(authUrl);
  });

  router.get('/callback/facebook', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/settings?error=facebook_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/settings?error=facebook_invalid`);

    let customerId;
    try {
      const decoded = JSON.parse(Buffer.from(decodeURIComponent(state), 'base64').toString());
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/settings?error=facebook_state_invalid`);
    }

    try {
      const redirectUri = `${getBaseUrl(req)}/api/social/callback/facebook`;

      const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        },
      });

      const longTokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: tokenRes.data.access_token,
        },
      });

      const longAccessToken = longTokenRes.data.access_token;
      const expiresAt = new Date(Date.now() + (longTokenRes.data.expires_in || 5184000) * 1000);

      const profileRes = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: { fields: 'id,name,picture', access_token: longAccessToken },
      });

      const { id: fbUserId, name: fbName, picture } = profileRes.data;

      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
         VALUES ($1, 'facebook', $2, $3, $4, $5, $6, true, true)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_id = EXCLUDED.account_id,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, longAccessToken, expiresAt, fbUserId, fbName, picture?.data?.url || null]
      );

      const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
        params: { access_token: longAccessToken },
      });

      const pages = pagesRes.data?.data || [];
      if (pages.length > 0) {
        const page = pages[0];
        await pool.query(
          `INSERT INTO social_accounts
             (customer_id, platform, access_token, token_expires_at, account_id, account_username, account_name, enabled, auto_post)
           VALUES ($1, 'instagram', $2, $3, $4, $5, $6, true, true)
           ON CONFLICT (customer_id, platform) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             token_expires_at = EXCLUDED.token_expires_at,
             account_id = EXCLUDED.account_id,
             account_username = EXCLUDED.account_username,
             account_name = EXCLUDED.account_name,
             updated_at = NOW()`,
          [customerId, page.access_token, new Date(Date.now() + 5184000 * 1000), page.id, page.name, page.name]
        );
      }

      res.redirect(`${frontendBase}/settings?connected=facebook`);
    } catch (error) {
      console.error('Facebook OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/settings?error=facebook_failed`);
    }
  });

  router.get('/connect/google', authenticate, (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'Google app credentials not configured',
        setup: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your secrets',
      });
    }
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/social/callback/google`;
    const state = Buffer.from(JSON.stringify({ customerId: req.customerId })).toString('base64');
    const scope = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&prompt=consent`;
    res.redirect(authUrl);
  });

  router.get('/callback/google', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/settings?error=google_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/settings?error=google_invalid`);

    let customerId;
    try {
      const decoded = JSON.parse(Buffer.from(decodeURIComponent(state), 'base64').toString());
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/settings?error=google_state_invalid`);
    }

    try {
      const redirectUri = `${getBaseUrl(req)}/api/social/callback/google`;

      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token, expires_in } = tokenRes.data;

      const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id: googleId, name, picture } = profileRes.data;
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, refresh_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
         VALUES ($1, 'google_business', $2, $3, $4, $5, $6, $7, true, true)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
           token_expires_at = EXCLUDED.token_expires_at,
           account_id = EXCLUDED.account_id,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, access_token, refresh_token || null, expiresAt, googleId, name, picture || null]
      );

      res.redirect(`${frontendBase}/settings?connected=google`);
    } catch (error) {
      console.error('Google OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/settings?error=google_failed`);
    }
  });

  router.patch('/accounts/:id', authenticate, async (req, res) => {
    try {
      const { enabled, autoPost } = req.body;
      const result = await pool.query(
        `UPDATE social_accounts SET
           enabled = COALESCE($1, enabled),
           auto_post = COALESCE($2, auto_post),
           updated_at = NOW()
         WHERE id = $3 AND customer_id = $4
         RETURNING id, platform, account_name, enabled, auto_post`,
        [enabled, autoPost, req.params.id, req.customerId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/accounts/:platform', authenticate, async (req, res) => {
    try {
      const { platform } = req.params;
      const result = await pool.query(
        `DELETE FROM social_accounts
         WHERE customer_id = $1 AND platform = $2
         RETURNING id, platform`,
        [req.customerId, platform]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true, disconnected: platform });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/social/connect/manual
   * Always available regardless of OAuth credentials
   */
  router.post('/connect/manual', authenticate, async (req, res) => {
    try {
      const { platform, accessToken, pageId, accountName } = req.body;

      if (!platform || !accessToken) {
        return res.status(400).json({ error: 'platform and accessToken are required' });
      }

      const validPlatforms = ['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok'];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({
          error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`,
        });
      }

      if (accessToken.trim().length < 10) {
        return res.status(400).json({
          error: 'Access token appears too short. Please check and try again.',
        });
      }

      // 7 days for all manual tokens
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, token_expires_at, account_id, account_name, enabled, auto_post)
         VALUES ($1, $2, $3, $4, $5, $6, true, true)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_id = EXCLUDED.account_id,
           account_name = EXCLUDED.account_name,
           updated_at = NOW()`,
        [
          req.customerId,
          platform,
          accessToken.trim(),
          expiresAt,
          pageId?.trim() || null,
          accountName?.trim() || platform,
        ]
      );

      res.json({ success: true, platform, message: `${platform} connected successfully` });
    } catch (error) {
      console.error('Manual connect error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/social/verify-token
   * Test that a token actually works before saving it.
   */
  router.post('/verify-token', authenticate, async (req, res) => {
    try {
      const { platform, accessToken, accountId } = req.body;
      if (!platform || !accessToken) {
        return res.status(400).json({ error: 'platform and accessToken are required' });
      }
      const publisher = new SocialPublisher(pool);
      const result = await publisher.verifyToken(platform, accessToken.trim(), accountId?.trim());
      res.json(result);
    } catch (error) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  /**
   * POST /api/social/publish
   * Immediately publish a saved post to selected platforms.
   * Body: { postId, platforms? }
   */
  router.post('/publish', authenticate, async (req, res) => {
    try {
      const { postId, platforms } = req.body;
      if (!postId) return res.status(400).json({ error: 'postId is required' });

      // Fetch the post and verify ownership
      const postResult = await pool.query(
        `SELECT * FROM posts WHERE id = $1 AND customer_id = $2`,
        [postId, req.customerId]
      );
      if (!postResult.rows[0]) return res.status(404).json({ error: 'Post not found' });
      const post = { ...postResult.rows[0], customer_id: req.customerId };

      // Mark as publishing
      await pool.query(`UPDATE posts SET status = 'posting', updated_at = NOW() WHERE id = $1`, [postId]);

      const publisher = new SocialPublisher(pool);
      const { platformPostIds, errors } = platforms?.length
        ? await publisher.publishToPlatforms(post, platforms)
        : await publisher.publishPost(post);

      const succeeded = Object.keys(platformPostIds);
      const allFailed = succeeded.length === 0 && errors.length > 0;

      if (allFailed) {
        await pool.query(
          `UPDATE posts SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [errors.map(e => `${e.platform}: ${e.message}`).join('; '), postId]
        );
        return res.status(502).json({ success: false, errors });
      }

      await pool.query(
        `UPDATE posts SET status = 'posted', posted_at = NOW(),
          platform_post_ids = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(platformPostIds), postId]
      );

      res.json({ success: true, posted: succeeded, errors, platformPostIds });
    } catch (error) {
      console.error('[social/publish]', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};