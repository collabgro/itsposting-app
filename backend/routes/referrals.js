const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();

  async function ensureReferralCode(customerId, businessName) {
    const existing = await pool.query('SELECT referral_code FROM customers WHERE id = $1', [customerId]);
    if (existing.rows[0]?.referral_code) return existing.rows[0].referral_code;

    const base = (businessName || 'USER').replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 6);
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${base}${suffix}`;

    await pool.query('UPDATE customers SET referral_code = $1 WHERE id = $2', [code, customerId]);
    return code;
  }

  /**
   * GET /api/referrals/my-code
   * Returns the current customer's referral code + stats including pending awards.
   */
  router.get('/my-code', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT referral_code, referral_credits_earned, business_name FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const customer = result.rows[0];
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const code = await ensureReferralCode(req.customerId, customer.business_name);
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.itsposting.com';

      // Count all referrals signed up under this code
      const statsRes = await pool.query(
        `SELECT COUNT(*) AS total_referrals,
                COUNT(CASE WHEN plan != 'trial' THEN 1 END) AS upgraded_referrals
         FROM customers WHERE referred_by = $1`,
        [code]
      );

      // Count pending vs released awards
      const awardsRes = await pool.query(
        `SELECT status, COUNT(*) AS count, SUM(credits) AS credits
         FROM referral_awards WHERE referrer_customer_id = $1
         GROUP BY status`,
        [req.customerId]
      );
      const awardsByStatus = {};
      for (const row of awardsRes.rows) {
        awardsByStatus[row.status] = { count: parseInt(row.count), credits: parseInt(row.credits) };
      }

      res.json({
        code,
        link: `${frontendUrl}/signup?refcode=${code}`,
        credits_earned: customer.referral_credits_earned || 0,
        credits_pending: awardsByStatus.pending?.credits || 0,
        pending_count: awardsByStatus.pending?.count || 0,
        total_referrals: parseInt(statsRes.rows[0].total_referrals) || 0,
        upgraded_referrals: parseInt(statsRes.rows[0].upgraded_referrals) || 0,
      });
    } catch (err) {
      console.error('[referrals] my-code error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/referrals/my-referrals
   * Returns the list of customers who signed up using this customer's referral code,
   * including their plan status and associated award status.
   */
  router.get('/my-referrals', authenticate, async (req, res) => {
    try {
      const codeRow = await pool.query(
        'SELECT referral_code FROM customers WHERE id = $1',
        [req.customerId]
      );
      const code = codeRow.rows[0]?.referral_code;
      if (!code) return res.json({ referrals: [] });

      const result = await pool.query(
        `SELECT
           c.id,
           c.business_name,
           c.industry,
           c.location,
           c.plan,
           c.created_at,
           ra.id            AS award_id,
           ra.status        AS award_status,
           ra.credits       AS award_credits,
           ra.released_at,
           ra.created_at    AS award_created_at
         FROM customers c
         LEFT JOIN referral_awards ra
           ON ra.referred_customer_id = c.id
           AND ra.referrer_customer_id = $1
         WHERE c.referred_by = $2
         ORDER BY c.created_at DESC
         LIMIT 50`,
        [req.customerId, code]
      );

      res.json({ referrals: result.rows });
    } catch (err) {
      console.error('[referrals] my-referrals error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
