const express = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  /**
   * GET /api/customers/profile
   */
  router.get('/profile', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, business_name, industry, location, phone, website,
                logo_url, brand_colors, visual_style, tone, avatar_id, voice_id,
                preferred_image_provider, plan, status, credits_balance, 
                credits_used_this_month, trial_ends_at, auto_post_enabled,
                auto_post_frequency, posting_times, timezone
         FROM customers WHERE id = $1`,
        [req.customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/customers/profile
   */
  router.patch('/profile', authenticate, async (req, res) => {
    try {
      const {
        businessName,
        industry,
        location,
        phone,
        website,
        brandColors,
        visualStyle,
        tone,
        avatarId,
        voiceId,
        preferredImageProvider,
        autoPostEnabled,
        autoPostFrequency,
        postingTimes,
        timezone,
      } = req.body;

      const result = await pool.query(
        `UPDATE customers SET
          business_name = COALESCE($1, business_name),
          industry = COALESCE($2, industry),
          location = COALESCE($3, location),
          phone = COALESCE($4, phone),
          website = COALESCE($5, website),
          brand_colors = COALESCE($6, brand_colors),
          visual_style = COALESCE($7, visual_style),
          tone = COALESCE($8, tone),
          avatar_id = COALESCE($9, avatar_id),
          voice_id = COALESCE($10, voice_id),
          preferred_image_provider = COALESCE($11, preferred_image_provider),
          auto_post_enabled = COALESCE($12, auto_post_enabled),
          auto_post_frequency = COALESCE($13, auto_post_frequency),
          posting_times = COALESCE($14, posting_times),
          timezone = COALESCE($15, timezone),
          updated_at = NOW()
        WHERE id = $16
        RETURNING *`,
        [
          businessName, industry, location, phone, website,
          brandColors ? JSON.stringify(brandColors) : null,
          visualStyle, tone, avatarId, voiceId, preferredImageProvider,
          autoPostEnabled, autoPostFrequency,
          postingTimes ? JSON.stringify(postingTimes) : null,
          timezone, req.customerId
        ]
      );

      const customer = result.rows[0];
      delete customer.password_hash;
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/customers/social-accounts
   */
  router.get('/social-accounts', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, platform, account_username, account_name, profile_image_url,
                enabled, auto_post, connected_at
         FROM social_accounts WHERE customer_id = $1`,
        [req.customerId]
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
