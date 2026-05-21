const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const SocialPublisher = require('../services/SocialPublisher');
const Anthropic = require('@anthropic-ai/sdk');

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
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}`;
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

    const fbScope = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'instagram_manage_insights', 'read_insights', 'pages_read_user_content', 'public_profile'].join(',');
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
        ? `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + '/api/social/callback/linkedin')}&scope=${encodeURIComponent('openid profile email w_member_social w_organization_social r_organization_social')}&state=${encodeURIComponent(state)}`
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
      'instagram_manage_insights',
      'read_insights',
      'pages_read_user_content',
      'public_profile',
    ].join(',');
    const authUrl =
      `https://www.facebook.com/v21.0/dialog/oauth` +
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

    if (oauthError) return res.redirect(`${frontendBase}/auth/callback?error=facebook_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/auth/callback?error=facebook_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/auth/callback?error=facebook_state_invalid`);
    }

    try {
      const redirectUri = `${getBaseUrl(req)}/api/social/callback/facebook`;

      // Exchange code for short-lived token
      const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
        params: {
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        },
      });

      // Exchange for long-lived token (60 days)
      const longTokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: tokenRes.data.access_token,
        },
      });

      const longAccessToken = longTokenRes.data.access_token;
      const expiresAt = new Date(Date.now() + (longTokenRes.data.expires_in || 5184000) * 1000);

      const profileRes = await axios.get('https://graph.facebook.com/v21.0/me', {
        params: { fields: 'id,name,picture', access_token: longAccessToken },
      });
      const { picture } = profileRes.data;
      const profileImageUrl = picture?.data?.url || null;

      // Step 1: Fetch pages with a SIMPLE request (no field expansion).
      // Requesting Instagram sub-fields in the same call causes Facebook to
      // filter which pages are returned — only 1 of 3 selected pages comes back.
      // Keep this call minimal so ALL selected pages are returned.
      const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
        params: {
          fields: 'id,name,access_token',
          access_token: longAccessToken,
          limit: 100,
        },
      });
      const pages = pagesRes.data?.data || [];

      console.log(`[Social/FB] customer=${customerId} pages_returned=${pages.length} names=${pages.map(p => p.name).join(', ')}`);

      // Reject if no pages — personal tokens cannot post to Pages
      if (pages.length === 0) {
        return res.redirect(`${frontendBase}/auth/callback?error=facebook_no_pages`);
      }

      // Step 2: Store all Facebook Pages first
      for (const page of pages) {
        await pool.query(
          `INSERT INTO social_accounts
             (customer_id, platform, access_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
           VALUES ($1, 'facebook', $2, $3, $4, $5, $6, true, true)
           ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             token_expires_at = EXCLUDED.token_expires_at,
             account_name = EXCLUDED.account_name,
             updated_at = NOW()`,
          [customerId, page.access_token, expiresAt, page.id, page.name, profileImageUrl]
        );
      }

      // Step 3: Check each page for a linked Instagram account (separate calls after pages are stored)
      let instagramConnected = false;
      const seenIgIds = new Set();
      for (const page of pages) {
        try {
          const igRes = await axios.get(`https://graph.facebook.com/v21.0/${page.id}`, {
            params: {
              fields: 'instagram_business_account{id,name,username},connected_instagram_account{id,name,username}',
              access_token: page.access_token,
            },
          });
          const igAccount = igRes.data?.instagram_business_account || igRes.data?.connected_instagram_account;
          console.log(`[Social/FB]   page="${page.name}" ig=${igAccount?.id || 'none (not linked to this page)'}`);

          if (igAccount?.id && !seenIgIds.has(igAccount.id)) {
            seenIgIds.add(igAccount.id);
            const igUsername = igAccount.username || igAccount.name || igAccount.id;
            await pool.query(
              `INSERT INTO social_accounts
                 (customer_id, platform, access_token, token_expires_at, account_id, account_username, account_name, enabled, auto_post)
               VALUES ($1, 'instagram', $2, $3, $4, $5, $6, true, true)
               ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
                 access_token = EXCLUDED.access_token,
                 token_expires_at = EXCLUDED.token_expires_at,
                 account_username = EXCLUDED.account_username,
                 account_name = EXCLUDED.account_name,
                 updated_at = NOW()`,
              [customerId, page.access_token, expiresAt, igAccount.id, igUsername, igAccount.name || igUsername]
            );
            instagramConnected = true;
            console.log(`[Social/FB]   stored instagram="${igUsername}" (${igAccount.id}) via page "${page.name}"`);
          }
        } catch (err) {
          console.error(`[Social/FB]   IG check failed for page "${page.name}":`, err.response?.data || err.message);
        }
      }

      // Remove stale Facebook rows from previous broken reconnects
      const pageIds = pages.map(p => p.id);
      const ph = pageIds.map((_, i) => `$${i + 2}`).join(',');
      await pool.query(
        `DELETE FROM social_accounts WHERE customer_id = $1 AND platform = 'facebook' AND account_id NOT IN (${ph})`,
        [customerId, ...pageIds]
      );

      const connectedParam = instagramConnected ? 'facebook_instagram' : 'facebook';
      res.redirect(`${frontendBase}/auth/callback?connected=${connectedParam}`);
    } catch (error) {
      console.error('[Social/FB] OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/auth/callback?error=facebook_failed`);
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

    if (oauthError) return res.redirect(`${frontendBase}/auth/callback?error=google_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/auth/callback?error=google_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/auth/callback?error=google_state_invalid`);
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

      // Fetch all Google Business Profile locations
      let storedCount = 0;
      try {
        const accountsRes = await axios.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const gmbAccounts = accountsRes.data?.accounts || [];

        for (const gmbAccount of gmbAccounts) {
          try {
            const locationsRes = await axios.get(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${gmbAccount.name}/locations`,
              {
                headers: { Authorization: `Bearer ${access_token}` },
                params: { readMask: 'name,title,storefrontAddress' },
              }
            );
            const locations = locationsRes.data?.locations || [];
            for (const loc of locations) {
              await pool.query(
                `INSERT INTO social_accounts
                   (customer_id, platform, access_token, refresh_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
                 VALUES ($1, 'google_business', $2, $3, $4, $5, $6, $7, true, true)
                 ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
                   access_token = EXCLUDED.access_token,
                   refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
                   token_expires_at = EXCLUDED.token_expires_at,
                   account_name = EXCLUDED.account_name,
                   updated_at = NOW()`,
                [customerId, access_token, refresh_token || null, expiresAt, loc.name, loc.title || name, picture || null]
              );
              storedCount++;
            }
          } catch { /* skip individual account if locations API fails */ }
        }
      } catch { /* GMB API unavailable — fall back to user profile row */ }

      // Fall back to storing user profile if no locations were found
      if (storedCount === 0) {
        await pool.query(
          `INSERT INTO social_accounts
             (customer_id, platform, access_token, refresh_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
           VALUES ($1, 'google_business', $2, $3, $4, $5, $6, $7, true, true)
           ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
             token_expires_at = EXCLUDED.token_expires_at,
             account_name = EXCLUDED.account_name,
             updated_at = NOW()`,
          [customerId, access_token, refresh_token || null, expiresAt, googleId, name, picture || null]
        );
      }

      res.redirect(`${frontendBase}/auth/callback?connected=google`);
    } catch (error) {
      console.error('Google OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/auth/callback?error=google_failed`);
    }
  });

  // ─── LinkedIn OAuth ────────────────────────────────────────────────────────

  router.get('/callback/linkedin', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/auth/callback?error=linkedin_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/auth/callback?error=linkedin_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/auth/callback?error=linkedin_state_invalid`);
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

      // Store personal profile
      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, token_expires_at, account_id, account_name, profile_image_url, enabled, auto_post)
         VALUES ($1, 'linkedin', $2, $3, $4, $5, $6, true, true)
         ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, access_token, expiresAt, authorUrn, name || 'LinkedIn Personal', picture || null]
      );

      // Fetch managed Company Pages
      try {
        const aclsRes = await axios.get(
          'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
          { headers: { Authorization: `Bearer ${access_token}` }, timeout: 10000 }
        );
        const acls = aclsRes.data?.elements || [];
        for (const acl of acls) {
          const orgId = acl.organization?.split(':').pop();
          if (!orgId) continue;
          try {
            const orgRes = await axios.get(
              `https://api.linkedin.com/v2/organizations/${orgId}?fields=id,localizedName`,
              { headers: { Authorization: `Bearer ${access_token}` }, timeout: 10000 }
            );
            const orgUrn = `urn:li:organization:${orgId}`;
            const orgName = orgRes.data?.localizedName || `LinkedIn Page ${orgId}`;
            await pool.query(
              `INSERT INTO social_accounts
                 (customer_id, platform, access_token, token_expires_at, account_id, account_name, enabled, auto_post)
               VALUES ($1, 'linkedin', $2, $3, $4, $5, true, true)
               ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
                 access_token = EXCLUDED.access_token,
                 token_expires_at = EXCLUDED.token_expires_at,
                 account_name = EXCLUDED.account_name,
                 updated_at = NOW()`,
              [customerId, access_token, expiresAt, orgUrn, orgName]
            );
          } catch { /* skip individual org if API fails */ }
        }
      } catch { /* organizationAcls API unavailable — personal profile already stored */ }

      res.redirect(`${frontendBase}/auth/callback?connected=linkedin`);
    } catch (error) {
      console.error('LinkedIn OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/auth/callback?error=linkedin_failed`);
    }
  });

  // ─── TikTok OAuth ──────────────────────────────────────────────────────────

  router.get('/callback/tiktok', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const frontendBase = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (oauthError) return res.redirect(`${frontendBase}/auth/callback?error=tiktok_denied`);
    if (!code || !state) return res.redirect(`${frontendBase}/auth/callback?error=tiktok_invalid`);

    let customerId;
    try {
      const decoded = verifyOAuthState(state);
      customerId = decoded.customerId;
    } catch {
      return res.redirect(`${frontendBase}/auth/callback?error=tiktok_state_invalid`);
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
         ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
           token_expires_at = EXCLUDED.token_expires_at,
           account_name = EXCLUDED.account_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
        [customerId, access_token, refresh_token || null, expiresAt, open_id, displayName, avatarUrl]
      );

      res.redirect(`${frontendBase}/auth/callback?connected=tiktok`);
    } catch (error) {
      console.error('TikTok OAuth error:', error.response?.data || error.message);
      res.redirect(`${frontendBase}/auth/callback?error=tiktok_failed`);
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

  // Disconnect a single account by its row ID (for multi-account platforms)
  router.delete('/accounts/by-id/:id', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM social_accounts WHERE id = $1 AND customer_id = $2 RETURNING platform`,
        [req.params.id, req.customerId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true, platform: result.rows[0].platform });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Disconnect all accounts for a platform (kept for backward compat)
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

  // ─── Profile Groups ────────────────────────────────────────────────────────

  router.get('/groups', authenticate, async (req, res) => {
    try {
      const groups = await pool.query(
        `SELECT g.id, g.name, g.created_at,
                COALESCE(array_agg(m.social_account_id) FILTER (WHERE m.social_account_id IS NOT NULL), '{}') AS account_ids
         FROM social_account_groups g
         LEFT JOIN social_account_group_members m ON m.group_id = g.id
         WHERE g.customer_id = $1
         GROUP BY g.id ORDER BY g.created_at DESC`,
        [req.customerId]
      );
      res.json(groups.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/groups', authenticate, async (req, res) => {
    try {
      const { name, accountIds = [] } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Group name required' });
      const g = await pool.query(
        `INSERT INTO social_account_groups (customer_id, name) VALUES ($1, $2) RETURNING *`,
        [req.customerId, name.trim()]
      );
      if (accountIds.length) {
        const vals = accountIds.map((id, i) => `($1, $${i + 2})`).join(',');
        await pool.query(
          `INSERT INTO social_account_group_members (group_id, social_account_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
          [g.rows[0].id, ...accountIds]
        );
      }
      res.json({ ...g.rows[0], account_ids: accountIds });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.patch('/groups/:id', authenticate, async (req, res) => {
    try {
      const { name, accountIds } = req.body;
      const { id } = req.params;
      if (name) {
        await pool.query(
          `UPDATE social_account_groups SET name = $1 WHERE id = $2 AND customer_id = $3`,
          [name.trim(), id, req.customerId]
        );
      }
      if (accountIds) {
        await pool.query(`DELETE FROM social_account_group_members WHERE group_id = $1`, [id]);
        if (accountIds.length) {
          const vals = accountIds.map((aid, i) => `($1, $${i + 2})`).join(',');
          await pool.query(
            `INSERT INTO social_account_group_members (group_id, social_account_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
            [id, ...accountIds]
          );
        }
      }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/groups/:id', authenticate, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM social_account_groups WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

      const resolvedAccountId = pageId?.trim() || `manual_${Date.now()}`;
      await pool.query(
        `INSERT INTO social_accounts
           (customer_id, platform, access_token, token_expires_at, account_id, account_name, enabled, auto_post)
         VALUES ($1, $2, $3, $4, $5, $6, true, true)
         ON CONFLICT (customer_id, platform, account_id) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_name = EXCLUDED.account_name,
           updated_at = NOW()`,
        [
          req.customerId,
          platform,
          accessToken.trim(),
          expiresAt,
          resolvedAccountId,
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
      const { postId, accountIds, platforms } = req.body;
      if (!postId) return res.status(400).json({ error: 'postId is required' });

      // Fetch the post and verify ownership
      const postResult = await pool.query(
        `SELECT * FROM posts WHERE id = $1 AND customer_id = $2`,
        [postId, req.customerId]
      );
      if (!postResult.rows[0]) return res.status(404).json({ error: 'Post not found' });
      const post = { ...postResult.rows[0], customer_id: req.customerId };

      // Pre-validate that all requested platforms are connected for this customer (legacy path)
      if (!accountIds?.length && platforms?.length > 0) {
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
      const { platformPostIds, errors } = accountIds?.length
        ? await publisher.publishToAccounts(post, accountIds)
        : platforms?.length
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

  // ── GET /api/social/reviews ──────────────────────────────────────────────
  // Fetch recent Google Business reviews for the connected GMB account.
  // Simple in-process 60-min cache to avoid rate limits.
  const reviewsCache = new Map(); // customerId → { reviews, fetchedAt }

  router.get('/reviews', authenticate, async (req, res) => {
    try {
      const cached = reviewsCache.get(req.customerId);
      if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
        return res.json({ reviews: cached.reviews, cached: true });
      }

      const accountRes = await pool.query(
        `SELECT access_token, refresh_token, account_id FROM social_accounts
          WHERE customer_id=$1 AND platform='google_business' AND enabled=true LIMIT 1`,
        [req.customerId]
      );
      if (!accountRes.rows[0]) {
        return res.json({ reviews: [], error: 'Connect Google Business to see reviews' });
      }
      const { access_token, account_id } = accountRes.rows[0];

      // account_id is a location name like "accounts/123/locations/456"
      let locationName = account_id;

      // Fetch reviews from GMB API v4
      const reviewsRes = await axios.get(
        `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
        {
          params: { pageSize: 10 },
          headers: { Authorization: `Bearer ${access_token}` },
          timeout: 10000,
        }
      );

      const reviews = (reviewsRes.data?.reviews || []).map(r => ({
        id: r.reviewId,
        reviewerName: r.reviewer?.displayName || 'A customer',
        starRating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating] || 5,
        text: r.comment || '',
        date: r.createTime,
      }));

      reviewsCache.set(req.customerId, { reviews, fetchedAt: Date.now() });
      res.json({ reviews });
    } catch (err) {
      console.error('[social/reviews]', err.message);
      res.json({ reviews: [], error: 'Could not fetch reviews' });
    }
  });

  // ── POST /api/social/reviews/generate-post ───────────────────────────────
  // Generate a social post caption from a Google review using Claude.
  router.post('/reviews/generate-post', authenticate, async (req, res) => {
    try {
      const { reviewText, reviewerName, starRating } = req.body;
      if (!reviewText) return res.status(400).json({ error: 'reviewText required' });

      const customerRes = await pool.query(
        'SELECT business_name, industry, city FROM customers WHERE id=$1',
        [req.customerId]
      );
      const customer = customerRes.rows[0] || {};
      const stars = '⭐'.repeat(Math.min(starRating || 5, 5));

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Turn this ${starRating || 5}-star Google review into a short, genuine social media post for ${customer.business_name || 'our business'} in ${customer.city || 'our area'}.
Review from ${reviewerName}: "${reviewText}"

Rules:
- Thank the customer by name naturally
- Highlight the specific service or outcome mentioned
- End with a soft engagement question
- Sound human, not corporate
- Max 150 words
- No hashtags (user will add those)
- No quotation marks around the review text

Reply with ONLY the caption text, nothing else.`,
        }],
      });

      const caption = msg.content[0]?.text?.trim() || '';
      const suggestedHashtags = ['5starreview', 'happycustomer', customer.industry || 'localservice', customer.city?.toLowerCase().replace(/\s+/g, '') || 'local'].filter(Boolean);

      res.json({ caption, suggestedHashtags, stars });
    } catch (err) {
      console.error('[social/reviews/generate-post]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/social/locations/search ─────────────────────────────────────
  // Location search for tagging posts (Facebook Places API)
  router.get('/locations/search', authenticate, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 2) return res.json({ locations: [] });

      // Get any connected Facebook account to use its token
      const accountRes = await pool.query(
        `SELECT access_token FROM social_accounts WHERE customer_id=$1 AND platform='facebook' AND enabled=true LIMIT 1`,
        [req.customerId]
      );
      if (!accountRes.rows[0]) return res.json({ locations: [], error: 'Connect Facebook to enable location search' });

      const token = accountRes.rows[0].access_token;
      const fbRes = await axios.get('https://graph.facebook.com/v18.0/search', {
        params: { type: 'place', q: q.trim(), fields: 'id,name,location', access_token: token, limit: 10 },
        timeout: 8000,
      });

      const locations = (fbRes.data?.data || []).map(p => ({
        id: p.id,
        name: p.name,
        city: p.location?.city || '',
        country: p.location?.country || '',
      }));

      res.json({ locations });
    } catch (err) {
      console.error('[social/locations]', err.message);
      res.json({ locations: [] });
    }
  });

  return router;
};