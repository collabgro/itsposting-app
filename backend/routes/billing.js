const express = require('express');
const { authenticate, getBillingCustomerId } = require('../middleware/auth');
const whop = require('../services/WhopService');
const EmailQueue = require('../services/EmailQueue');
const NotificationService = require('../services/NotificationService');

const PLANS = {
  trial: {
    id: 'trial', name: 'Free Trial', price: 0, yearlyPrice: 0, credits: 10, duration: '7 days',
    features: ['10 free credits', 'All content types', '1 social account', 'Basic analytics'],
  },
  starter: {
    id: 'starter', name: 'Starter', price: 20, yearlyPrice: 18, credits: 50, duration: 'per month',
    features: ['50 credits/month', 'Instagram, TikTok, Facebook, LinkedIn & Google Business', 'Custom AI training on your brand', 'Email support', '7-day free trial'],
  },
  professional: {
    id: 'professional', name: 'Professional', price: 40, yearlyPrice: 36, credits: 100, duration: 'per month', popular: true,
    features: ['100 credits/month', 'Instagram, TikTok, Facebook, LinkedIn & Google Business', 'Custom AI training on your brand', 'Priority support', '7-day free trial'],
  },
  premium: {
    id: 'premium', name: 'Premium', price: 60, yearlyPrice: 54, credits: 150, duration: 'per month',
    features: ['150 credits/month', 'Instagram, TikTok, Facebook, LinkedIn & Google Business', 'Custom AI training on your brand', 'Priority support', 'Dedicated support manager', '7-day free trial'],
  },
  agency: {
    id: 'agency', name: 'Agency', price: 200, yearlyPrice: 200, credits: 200, duration: 'per month',
    features: ['200 credits/month', 'Unlimited sub-accounts', 'White-label branding (logo, name, colors)', 'Hide "Powered by ItsPosting"', 'Custom domain support', 'All Premium features included'],
  },
};

const CREDIT_PACKS = [
  { id: 'credits_25',  amount: 25,  price: 10 },
  { id: 'credits_50',  amount: 50,  price: 20 },
  { id: 'credits_75',  amount: 75,  price: 30 },
  { id: 'credits_100', amount: 100, price: 40 },
  { id: 'credits_125', amount: 125, price: 50 },
  { id: 'credits_150', amount: 150, price: 60 },
  { id: 'credits_200', amount: 200, price: 80 },
  { id: 'credits_250', amount: 250, price: 100 },
];

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

        // Log webhook event for audit trail
        pool.query(
          `INSERT INTO webhook_events (source, event_type, payload, status) VALUES ('whop', $1, $2::jsonb, 'processing')`,
          [action, JSON.stringify({ id: data?.id, plan: data?.plan_id })]
        ).catch(() => {});

        if (action === 'membership.activated' || action === 'payment.succeeded') {
          const whopPlanId = data?.plan_id || data?.product?.plan_id;

          // Check if this is a credit pack purchase
          const creditPack = CREDIT_PACKS.find(p => p.id === whopPlanId);
          if (creditPack) {
            const email = data?.email || data?.user?.email;
            const whopMembershipId = data?.id || data?.membership_id;
            let customerResult = null;
            if (whopMembershipId) {
              customerResult = await pool.query('SELECT id, credits_balance FROM customers WHERE whop_membership_id = $1', [whopMembershipId]);
            }
            if (!customerResult?.rows?.length && email) {
              customerResult = await pool.query('SELECT id, credits_balance FROM customers WHERE email = $1', [email]);
            }
            if (customerResult?.rows?.length) {
              const customerId = customerResult.rows[0].id;
              const newBalance = (customerResult.rows[0].credits_balance || 0) + creditPack.amount;
              await pool.query(`UPDATE customers SET credits_balance=$1, updated_at=NOW() WHERE id=$2`, [newBalance, customerId]);
              await pool.query(
                `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description) VALUES ($1,'credit',$2,$3,$4)`,
                [customerId, creditPack.amount, newBalance, `Credit pack purchase: ${creditPack.amount} credits ($${creditPack.price})`]
              );
              console.log(`[Whop] Credit pack ${creditPack.id} granted to customer ${customerId}`);
            }
            return;
          }

          const tier = whop.getPlanTierFromWhopId(whopPlanId);
          if (!tier) { console.warn('[Whop] Unknown plan ID:', whopPlanId); return; }

          const cycle = whop.getPlanCycleFromWhopId(whopPlanId);
          const expiresAt = new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 3600 * 1000);
          const nextBillingDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);

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
               whop_membership_id=$3, whop_customer_id=$4,
               billing_cycle=$5, plan_expires_at=$6, next_billing_date=$7,
               updated_at=NOW()
               WHERE id=$8`,
              [tier, newBalance, whopMembershipId, whopCustomerId, cycle, expiresAt, nextBillingDate, customerId]
            );
            await client.query(
              `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
               VALUES ($1,'bonus',$2,$3,$4)`,
              [customerId, planData.credits, newBalance, `Whop payment: ${tier} plan (+${planData.credits} credits)`]
            );
            await client.query('COMMIT');
            console.log(`[Whop] Activated ${tier} for customer ${customerId}`);

            // Queue a pending referral award if this customer was referred via a paid plan upgrade
            if (tier !== 'trial') {
              pool.query(
                'SELECT referred_by FROM customers WHERE id = $1',
                [customerId]
              ).then(async refRow => {
                const referralCode = refRow.rows[0]?.referred_by;
                if (!referralCode) return;

                // Look up referrer
                const referrerRes = await pool.query(
                  'SELECT id FROM customers WHERE referral_code = $1',
                  [referralCode]
                );
                if (!referrerRes.rows.length) return;
                const referrerId = referrerRes.rows[0].id;

                // Prevent duplicate pending/released awards for the same referred customer
                const dupeCheck = await pool.query(
                  `SELECT id FROM referral_awards
                   WHERE referred_customer_id = $1 AND status IN ('pending','released')`,
                  [customerId]
                );
                if (dupeCheck.rows.length > 0) return;

                await pool.query(
                  `INSERT INTO referral_awards
                     (referrer_customer_id, referred_customer_id, referral_code, credits, status)
                   VALUES ($1, $2, $3, 20, 'pending')`,
                  [referrerId, customerId, referralCode]
                );
                console.log(`[Referral] Pending award queued: referrer=${referrerId} referred=${customerId}`);
              }).catch(e => console.warn('[Referral] Could not queue award:', e.message));
            }

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
          const deactivated = await pool.query(
            `UPDATE customers SET plan='trial', status='inactive', suspended=true, updated_at=NOW()
             WHERE whop_membership_id=$1 RETURNING id, credits_balance`,
            [whopMembershipId]
          );
          console.log(`[Whop] Deactivated membership ${whopMembershipId}`);
          // Notify if credits are low so customer knows to renew
          if (deactivated.rows[0]) {
            const { id: customerId, credits_balance } = deactivated.rows[0];
            if ((credits_balance || 0) < 10) {
              const notifier = new NotificationService(pool);
              notifier.lowCredits(customerId, credits_balance || 0);
            }
          }
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

  // ── Credit packs list ────────────────────────────────────────────────────────
  router.get('/credit-packs', (req, res) => {
    res.json(CREDIT_PACKS);
  });

  // ── Buy credits (generates checkout link for a credit pack) ──────────────────
  router.get('/buy-credits', authenticate, async (req, res) => {
    try {
      const { pack, amount: rawAmount } = req.query;

      // Custom amount path
      if (pack === 'credits_custom') {
        const amount = parseInt(rawAmount);
        if (!amount || amount < 10 || amount > 10000) {
          return res.status(400).json({ error: 'Amount must be between 10 and 10,000 credits' });
        }
        const price = Math.ceil(amount * 0.4);
        return res.json({
          message: `To purchase ${amount} credits for $${price}, email support@itsposting.com with subject: "Credit purchase — ${amount} credits". We'll add them to your account within 24 hours.`,
        });
      }

      const creditPack = CREDIT_PACKS.find(p => p.id === pack);
      if (!creditPack) return res.status(400).json({ error: 'Invalid credit pack' });

      try {
        const url = whop.getCheckoutUrl(pack, 'monthly');
        if (url) return res.json({ url });
      } catch {}

      // Fallback: no Whop product configured for this pack yet
      res.json({
        message: `To purchase ${creditPack.amount} credits for $${creditPack.price}, email support@itsposting.com with subject: "Credit purchase — ${pack}". We'll add them to your account within 24 hours.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cancel subscription ──────────────────────────────────────────────────────
  router.post('/cancel', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT plan, status, whop_membership_id, plan_expires_at FROM customers WHERE id = $1`,
        [req.customerId]
      );
      const customer = result.rows[0];
      if (!customer) return res.status(404).json({ error: 'Not found' });
      if (customer.plan === 'trial') {
        return res.status(400).json({ error: 'No active subscription to cancel' });
      }
      if (customer.status === 'cancelled') {
        return res.status(400).json({ error: 'Subscription already cancelled' });
      }

      // Tell Whop to stop future charges (only if membership ID exists, non-fatal)
      if (customer.whop_membership_id) {
        try {
          await whop.cancelMembership(customer.whop_membership_id);
        } catch (whopErr) {
          console.error('[Billing] Whop cancel API failed:', whopErr.message);
        }
      }

      await pool.query(
        `UPDATE customers SET status='cancelled', updated_at=NOW() WHERE id=$1`,
        [req.customerId]
      );

      console.log(`[Billing] Customer ${req.customerId} cancelled subscription`);
      res.json({ success: true, accessUntil: customer.plan_expires_at });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Existing endpoints ───────────────────────────────────────────────────────
  router.get('/plans', authenticate, async (req, res) => {
    res.set('Cache-Control', 'private, max-age=3600');
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
      const billingId = getBillingCustomerId(req);
      const result = await pool.query(
        `SELECT plan, status, credits_balance, credits_used_this_month,
                trial_ends_at, plan_changed_at, whop_membership_id,
                billing_cycle, plan_expires_at, next_billing_date
         FROM customers WHERE id = $1`,
        [billingId]
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
        billingCycle: customer.billing_cycle || 'monthly',
        planExpiresAt: customer.plan_expires_at,
        nextBillingDate: customer.next_billing_date,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
