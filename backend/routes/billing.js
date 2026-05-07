const express = require('express');
const { authenticate } = require('../middleware/auth');
const whop = require('../services/WhopService');
const EmailQueue = require('../services/EmailQueue');

const PLANS = {
  trial: {
    id: 'trial', name: 'Free Trial', price: 0, credits: 10, duration: '7 days',
    features: ['10 free credits', 'All content types', '1 social account', 'Basic analytics'],
  },
  starter: {
    id: 'starter', name: 'Starter', price: 99, yearlyPrice: 79, credits: 50, duration: 'per month',
    features: ['50 credits/month', '~3 posts per week', '1 platform (FB, IG, or GBP)', 'Manual uploads (unlimited)', 'Email support'],
  },
  professional: {
    id: 'professional', name: 'Professional', price: 199, yearlyPrice: 159, credits: 150, duration: 'per month', popular: true,
    features: ['150 credits/month', 'Daily posting (~7/week)', 'All 3 platforms', 'Manual uploads (unlimited)', 'Website scraping', 'Priority support', 'Custom branding'],
  },
  premium: {
    id: 'premium', name: 'Premium', price: 349, yearlyPrice: 279, credits: 500, duration: 'per month',
    features: ['500 credits/month', '2x daily posting (~14/week)', 'All platforms + Stories', 'Manual uploads (unlimited)', 'Website scraping', 'Dedicated account manager', 'Advanced analytics', 'API access'],
  },
};

module.exports = (pool) => {
  const router = express.Router();
  const emailQueue = new EmailQueue(pool);

  // ── Whop webhook (raw body required for signature verification) ─────────────
  router.post('/whop/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      res.status(200).json({ received: true }); // always 200 first

      try {
        const signature = req.headers['webhook-signature'] || req.headers['x-whop-signature'] || '';
        const valid = whop.verifyWebhookSignature(req.body, signature, process.env.WHOP_WEBHOOK_KEY);
        if (!valid) {
          console.error('[Whop] Invalid webhook signature');
          return;
        }

        const payload = JSON.parse(req.body.toString());
        const { action, data } = payload;
        console.log(`[Whop] Event: ${action}`, data?.id);

        if (action === 'membership.activated' || action === 'payment.succeeded') {
          const whopPlanId = data?.plan_id || data?.product?.plan_id;
          const tier = whop.getPlanTierFromWhopId(whopPlanId);
          if (!tier) { console.warn('[Whop] Unknown plan ID:', whopPlanId); return; }

          const planData = PLANS[tier];
          const whopMembershipId = data?.id || data?.membership_id;
          const whopCustomerId = data?.user_id || data?.customer_id;

          // Find customer by whop IDs or email
          const email = data?.email || data?.user?.email;
          let customerResult = null;
          if (whopMembershipId) {
            customerResult = await pool.query(
              'SELECT id, credits_balance FROM customers WHERE whop_membership_id = $1',
              [whopMembershipId]
            );
          }
          if (!customerResult?.rows?.length && email) {
            customerResult = await pool.query(
              'SELECT id, credits_balance FROM customers WHERE email = $1',
              [email]
            );
          }
          if (!customerResult?.rows?.length) {
            console.warn('[Whop] No customer found for event', action, email);
            return;
          }

          const customerId = customerResult.rows[0].id;
          const currentBalance = customerResult.rows[0].credits_balance || 0;
          const newBalance = currentBalance + planData.credits;

          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(
              `UPDATE customers SET plan=$1, status='active', credits_balance=$2,
               credits_used_this_month=0, plan_changed_at=NOW(),
               whop_membership_id=$3, whop_customer_id=$4, updated_at=NOW()
               WHERE id=$5`,
              [tier, newBalance, whopMembershipId, whopCustomerId, customerId]
            );
            await client.query(
              `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
               VALUES ($1,'bonus',$2,$3,$4)`,
              [customerId, planData.credits, newBalance, `Whop payment: ${tier} plan (+${planData.credits} credits)`]
            );
            await client.query('COMMIT');
            console.log(`[Whop] Activated ${tier} for customer ${customerId}`);

            // Send payment confirmation email (non-fatal)
            try {
              const customerRow = await pool.query(
                'SELECT email, business_name FROM customers WHERE id = $1',
                [customerId]
              );
              if (customerRow.rows.length > 0) {
                await emailQueue.notifyPaymentConfirmed(
                  customerRow.rows[0],
                  planData.name,
                  planData.credits
                );
              }
            } catch (emailErr) {
              console.error('[Whop] Failed to queue confirmation email:', emailErr.message);
            }
          } catch (e) {
            await client.query('ROLLBACK');
            console.error('[Whop] DB error on activation:', e.message);
          } finally {
            client.release();
          }
        }

        if (action === 'membership.deactivated') {
          const whopMembershipId = data?.id;
          if (!whopMembershipId) return;
          await pool.query(
            `UPDATE customers SET plan='trial', status='inactive', updated_at=NOW()
             WHERE whop_membership_id=$1`,
            [whopMembershipId]
          );
          console.log(`[Whop] Deactivated membership ${whopMembershipId}`);
        }
      } catch (err) {
        console.error('[Whop] Webhook processing error:', err.message);
      }
    }
  );

  // ── Checkout link (redirect to Whop) ────────────────────────────────────────
  router.get('/checkout-link', authenticate, async (req, res) => {
    try {
      const { plan, cycle = 'monthly' } = req.query;
      if (!plan || !PLANS[plan] || plan === 'trial') {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      const url = whop.getCheckoutUrl(plan, cycle);
      res.json({ url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Existing endpoints ───────────────────────────────────────────────────────
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
                trial_ends_at, plan_changed_at, whop_membership_id
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
        hasActiveMembership: !!customer.whop_membership_id,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
