const express = require('express');
const { authenticate } = require('../middleware/auth');

const PLANS = {
  trial: {
    id: 'trial', name: 'Free Trial', price: 0, credits: 10, duration: '7 days',
    features: ['10 free credits', 'All content types', '1 social account', 'Basic analytics'],
  },
  starter: {
    id: 'starter', name: 'Starter', price: 99, credits: 50, duration: 'per month',
    features: ['50 credits/month', '~3 posts per week', '1 platform (FB, IG, or GBP)', 'Manual uploads (unlimited)', 'Email support'],
  },
  professional: {
    id: 'professional', name: 'Professional', price: 199, credits: 150, duration: 'per month', popular: true,
    features: ['150 credits/month', 'Daily posting (~7/week)', 'All 3 platforms', 'Manual uploads (unlimited)', 'Website scraping', 'Priority support', 'Custom branding'],
  },
  premium: {
    id: 'premium', name: 'Premium', price: 349, credits: 500, duration: 'per month',
    features: ['500 credits/month', '2x daily posting (~14/week)', 'All platforms + Stories', 'Manual uploads (unlimited)', 'Website scraping', 'Dedicated account manager', 'Advanced analytics', 'API access'],
  },
};

module.exports = (pool) => {
  const router = express.Router();

  router.get('/plans', authenticate, async (req, res) => {
    res.json(Object.values(PLANS));
  });

  router.get('/history', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, transaction_type, amount, balance_after, description, created_at
         FROM credit_transactions WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.customerId]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/current', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT plan, status, credits_balance, credits_used_this_month,
                trial_ends_at, plan_changed_at, upgrade_requested_at
         FROM customers WHERE id = $1`,
        [req.customerId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const customer = result.rows[0];
      res.json({
        currentPlan: PLANS[customer.plan] || PLANS.trial,
        status: customer.status,
        creditsBalance: customer.credits_balance,
        creditsUsedThisMonth: customer.credits_used_this_month,
        trialEndsAt: customer.trial_ends_at,
        planChangedAt: customer.plan_changed_at,
        upgradeRequestedAt: customer.upgrade_requested_at,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/upgrade', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
      const { planId } = req.body;
      if (!PLANS[planId]) return res.status(400).json({ error: 'Invalid plan' });
      if (planId === 'trial') return res.status(400).json({ error: 'Cannot downgrade to trial' });

      const newPlan = PLANS[planId];
      await client.query('BEGIN');
      const current = await client.query('SELECT plan, credits_balance FROM customers WHERE id = $1', [req.customerId]);
      const currentPlan = current.rows[0].plan;
      const newBalance = current.rows[0].credits_balance + newPlan.credits;

      await client.query(
        `UPDATE customers SET plan=$1, status='active', credits_balance=$2, credits_used_this_month=0,
         plan_changed_at=NOW(), updated_at=NOW() WHERE id=$3`,
        [planId, newBalance, req.customerId]
      );
      await client.query(
        `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
         VALUES ($1,'bonus',$2,$3,$4)`,
        [req.customerId, newPlan.credits, newBalance, `Plan upgrade: ${currentPlan} → ${planId} (+${newPlan.credits} credits)`]
      );
      await client.query('COMMIT');
      res.json({ success: true, message: `Upgraded to ${newPlan.name}! +${newPlan.credits} credits added.`, plan: newPlan, newBalance });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Upgrade error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
};
