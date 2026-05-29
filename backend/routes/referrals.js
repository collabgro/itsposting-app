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

  return router;
};
