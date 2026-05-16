const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const SocialPublisher = require('../services/SocialPublisher');

// OAuth state — HMAC-signed so attackers can't forge customerId in the state parameter.
function createOAuthState(customerId) {
  const data = JSON.stringify({ customerId, ts: Date.now() });
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret').update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}

function verifyOAuthState(stateParam) {
  const outer = JSON.parse(Buffer.from(decodeURIComponent(stateParam), 'base64').toString());
  if (!outer.data || !outer.sig) throw new Error('Malformed state');
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret').update(outer.data).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(outer.sig, 'hex'))) {
    throw new Error('State signature invalid');
  }
  return JSON.parse(outer.data);
}

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const GOOGLE_CLIENT_ID       = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET;
const LINKEDIN_CLIENT_ID     = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const TIKTOK_CLIENT_KEY      = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET   = process.env.TIKTOK_CLIENT_SECRET;

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
      facebook:        { oauthAvailable: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) },
      instagram:       { oauthAvailable: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) },
      google_business: { oauthAvailable: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) },
      linkedin:        { oauthAvailable: !!(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) },
      tiktok:          { oauthAvailable: !!(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET) },
    });
  });

  // Returns the OAuth authorization URL as JSON so the frontend can initiate
  // OAuth via axios (with JWT header) then navigate with window.location.href.
  router.get('/connect-url/:platform', authenticate, (req, res) => {
    const { platform } = req.params;
    const baseUrl = getBaseUrl(req);
    const state = createOAuthState(req.customerId);

    const fbScope = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'public_profile'].join(',');
    const googleScope = ['https://www.googleapis.com/auth/business.manage', 'https://www.googleapis.com/auth/userinfo.profile'].join(' ');

    const urls = {
      facebook: FACEBOOK_APP_ID && FACEBOOK_APP_SECRET
        ? `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/facebook')}&scope=${encodeURIComponent(fbScope)}&state=${encodeURIComponent(state)}&response_type=code`
        : null,
      instagram: FACEBOOK_APP_ID && FACEBOOK_APP_SECRET
        ? `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/facebook')}&scope=${encodeURIComponent(fbScope)}&state=${encodeURIComponent(state)}&response_type=code`
        : null,
      google_business: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/google')}&scope=${encodeURIComponent(googleScope)}&state=${encodeURIComponent(state)}&response_type=code&access_type=offline&prompt=consent`
        : null,
      linkedin: LINKEDIN_CLIENT_ID
        ? `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/linkedin')}&scope=${encodeURIComponent('openid profile email w_member_social')}&state=${encodeURIComponent(state)}`
        : null,
      tiktok: TIKTOK_CLIENT_KEY
        ? `https://www.tiktok.com/v2/auth/authorize/?client_key=${TIKTOK_CLIENT_KEY}&response_type=code&scope=${encodeURIComponent('user.info.basic,video.publish,video.upload')}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/tiktok')}&state=${encodeURIComponent(state)}`
        : null,
    };

    const url = urls[platform];
    if (!url) return res.status(400).json({ error: 'OAuth not configured for this platform' });
    res.json({ url });
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
    const state = createOAuthState(req.customerId);
    const scope = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_messaging',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_messages',
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
      const decoded = verifyOAuthState(state);
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
    const state = createOAuthState(req.customerId);
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
      const decoded = verifyOAuthState(state);
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

  // ─── LinkedIn OAuth ────────────────────────────────────────────────────────

  router.get('/callback/linkedin', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/settings?error=linkedin_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/settings?error=linkedin_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/settings?error=linkedin_state_invalid`);
    }

    try {
      const redirectUri = `${getBaseUrl(req)}/api/social/callback/linkedin`;

      const params = new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      });

      const tokenRes = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      );

      const { access_token, expires_in } = tokenRes.data;
      const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000);

      const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });

      const { sub, name, picture } = profileRes.data;
      const authorUrn = `urn:li:person:${sub}`;

      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
         VALUES ($1, 'linkedin', $2, $3, $4, $5, $6, true, true)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_id = EXCLUDED.account_id,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, access_token, expiresAt, authorUrn, name || 'LinkedIn Account', picture || null]
      );

      res.redirect(`${frontendBase}/settings?connected=linkedin`);
    } catch (error) {
      console.error('LinkedIn OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/settings?error=linkedin_failed`);
    }
  });

  // ─── TikTok OAuth ──────────────────────────────────────────────────────────

  router.get('/callback/tiktok', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/settings?error=tiktok_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/settings?error=tiktok_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/settings?error=tiktok_state_invalid`);
    }

    try {
      const redirectUri = `${getBaseUrl(req)}/api/social/callback/tiktok`;

      const params = new URLSearchParams({
        client_key:    TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  redirectUri,
      });

      const tokenRes = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      );

      const { access_token, refresh_token, open_id, expires_in } = tokenRes.data?.data || {};
      if (!access_token) throw new Error(tokenRes.data?.error?.message || 'TikTok token exchange failed');

      const expiresAt = new Date(Date.now() + (expires_in || 86400) * 1000);

      const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        headers: { Authorization: `Bearer ${access_token}` },
        params:  { fields: 'open_id,display_name,avatar_url' },
        timeout: 10000,
      });

      const user = userRes.data?.data?.user || {};
      const displayName = user.display_name || 'TikTok Account';
      const avatarUrl   = user.avatar_url   || null;

      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, refresh_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
         VALUES ($1, 'tiktok', $2, $3, $4, $5, $6, $7, true, true)
         ON CONFLICT (customer_id, platform) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
           token_expires_at = EXCLUDED.token_expires_at,
           account_id = EXCLUDED.account_id,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, access_token, refresh_token || null, expiresAt, open_id, displayName, avatarUrl]
      );

      res.redirect(`${frontendBase}/settings?connected=tiktok`);
    } catch (error) {
      console.error('TikTok OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/settings?error=tiktok_failed`);
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

      // Pre-validate that all requested platforms are connected for this customer
      if (platforms?.length > 0) {
        const connectedResult = await pool.query(
          `SELECT platform FROM social_accounts WHERE customer_id = $1 AND platform = ANY($2::text[]) AND enabled = true`,
          [req.customerId, platforms]
        );
        const connected = connectedResult.rows.map(r => r.platform);
        const missing = platforms.filter(p => !connected.includes(p));
        if (missing.length > 0) {
          return res.status(422).json({ error: `Account not connected: ${missing.join(', ')}. Go to Settings → Social Accounts to connect them first.` });
        }
      }

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