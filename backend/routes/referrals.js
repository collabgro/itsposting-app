const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const EmailService = require('../services/EmailService');

const emailService = new EmailService();

module.exports = (pool) => {
  const router = express.Router();

  // Generate a referral code for a customer if they don't have one
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
   * Returns the current customer's referral code + stats
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

      // Count referrals
      const statsRes = await pool.query(
        `SELECT COUNT(*) AS total_referrals,
                COUNT(CASE WHEN plan != 'trial' THEN 1 END) AS upgraded_referrals
         FROM customers WHERE referred_by = $1`,
        [code]
      );

      res.json({
        code,
        link: `${frontendUrl}/signup?ref=${code}`,
        credits_earned: customer.referral_credits_earned || 0,
        total_referrals: parseInt(statsRes.rows[0].total_referrals) || 0,
        upgraded_referrals: parseInt(statsRes.rows[0].upgraded_referrals) || 0,
      });
    } catch (err) {
      console.error('[referrals] my-code error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/referrals/award
   * Called internally when a referred user upgrades to a paid plan.
   * Adds 20 credits to the referrer.
   * Protected by CRON_SECRET or ADMIN_SECRET (internal call).
   */
  router.post('/award', async (req, res) => {
    const secret = req.headers['x-internal-secret'];
    const validSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
    if (!validSecret || secret !== validSecret) return res.status(403).json({ error: 'Forbidden' });

    try {
      const { referralCode, newCustomerId } = req.body;
      if (!referralCode || !newCustomerId) return res.status(400).json({ error: 'Missing fields' });

      const referrerRes = await pool.query(
        'SELECT id, business_name, email, referral_credits_earned FROM customers WHERE referral_code = $1',
        [referralCode]
      );
      if (!referrerRes.rows.length) return res.status(404).json({ error: 'Referral code not found' });

      const referrer = referrerRes.rows[0];
      const REWARD_CREDITS = 20;

      await pool.query('BEGIN');
      await pool.query(
        `UPDATE customers SET credits_balance = credits_balance + $1, referral_credits_earned = COALESCE(referral_credits_earned, 0) + $1 WHERE id = $2`,
        [REWARD_CREDITS, referrer.id]
      );
      await pool.query(
        `INSERT INTO credit_transactions (customer_id, amount, type, description, created_at)
         VALUES ($1, $2, 'referral_reward', $3, NOW())`,
        [referrer.id, REWARD_CREDITS, `Referral reward — someone you referred upgraded`]
      );
      await pool.query('COMMIT');

      // Send email notification to referrer
      try {
        const newCustRes = await pool.query('SELECT business_name FROM customers WHERE id = $1', [newCustomerId]);
        const newBizName = newCustRes.rows[0]?.business_name || 'Someone you referred';
        await emailService.send({
          to: referrer.email,
          subject: `🎉 You earned 20 credits — ${newBizName} just upgraded!`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:540px;margin:40px auto;background:#16161D;border:1px solid #26262F;border-radius:12px;overflow:hidden">
              <div style="padding:28px 32px;background:linear-gradient(135deg,#7C5CFC 0%,#5B3FF0 100%)">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">ItsPosting</h1>
                <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Referral Reward</p>
              </div>
              <div style="padding:28px 32px">
                <p style="font-size:24px;font-weight:800;color:#fff;margin:0 0 8px">You earned 20 free credits!</p>
                <p style="font-size:14px;color:#A0A0B0;margin:0 0 20px">${newBizName} just upgraded their ItsPosting plan. As a thank-you for referring them, we've added <strong style="color:#7C5CFC">20 credits</strong> to your account.</p>
                <p style="font-size:13px;color:#666;margin:16px 0 0">Keep sharing your referral link to earn more credits every time someone upgrades.</p>
              </div>
            </div>`,
          text: `You earned 20 credits! ${newBizName} just upgraded ItsPosting. 20 credits have been added to your account.`,
        });
      } catch (emailErr) {
        console.warn('[referrals] award email failed:', emailErr.message);
      }

      res.json({ success: true, credits_awarded: REWARD_CREDITS });
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {});
      console.error('[referrals] award error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
