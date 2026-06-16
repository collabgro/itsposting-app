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
  { id: 'credits_175', amount: 175, price: 70 },
  { id: 'credits_200', amount: 200, price: 80 },
  { id: 'credits_225', amount: 225, price: 90 },
  { id: 'credits_250', amount: 250, price: 100 },
];

// Ordered lowest → highest for upgrade/downgrade detection
const PLAN_ORDER = ['trial', 'starter', 'professional', 'premium'];

module.exports = (pool) => {
  const router = express.Router();
  const emailQueue = new EmailQueue(pool);

  // ── Whop webhook ────────────────────────────────────────────────────────────
  router.post('/whop/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      res.status(200).json({ received: true }); // always 200 first

      try {
        const signature = req.headers['webhook-signature'] || req.headers['x-whop-signature'] || '';
        const valid = whop.verifyWebhookSignature(req.body, signature, process.env.WHOP_WEBHOOK_KEY);
        if (!valid) { console.error('[Whop] Invalid webhook signature'); return; }

        const payload = JSON.parse(req.body.toString());
        const { action, data } = payload;
        console.log(`[Whop] Event: ${action}`, data?.id);

        pool.query(
          `INSERT INTO webhook_events (source, event_type, payload, status) VALUES ('whop', $1, $2::jsonb, 'processing')`,
          [action, JSON.stringify({ id: data?.id, plan: data?.plan_id })]
        ).catch(() => {});

        if (action === 'membership.activated' || action === 'payment.succeeded') {
          const whopPlanId = data?.plan_id || data?.product?.plan_id;

          // ── Credit pack purchase ──────────────────────────────────────────
          // getPlanTierFromWhopId returns the pack id (e.g. 'credits_100') when it matches a credit pack
          const packTier = whop.getPlanTierFromWhopId(whopPlanId);
          const creditPack = packTier?.startsWith('credits_')
            ? CREDIT_PACKS.find(p => p.id === packTier)
            : null;
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
              const packClient = await pool.connect();
              let newBalance;
              try {
                await packClient.query('BEGIN');
                const lockRow = await packClient.query('SELECT credits_balance FROM customers WHERE id=$1 FOR UPDATE', [customerId]);
                newBalance = (lockRow.rows[0].credits_balance || 0) + creditPack.amount;
                await packClient.query(`UPDATE customers SET credits_balance=$1, updated_at=NOW() WHERE id=$2`, [newBalance, customerId]);
                await packClient.query(
                  `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description) VALUES ($1,'purchase',$2,$3,$4)`,
                  [customerId, creditPack.amount, newBalance, `Credit pack: ${creditPack.amount} credits ($${creditPack.price})`]
                );
                await packClient.query('COMMIT');
              } catch (packErr) {
                await packClient.query('ROLLBACK');
                throw packErr;
              } finally {
                packClient.release();
              }
              console.log(`[Whop] Credit pack ${creditPack.id} granted to customer ${customerId}`);
              // In-app notification
              new NotificationService(pool).creditPackPurchased(customerId, creditPack.amount, newBalance);
              // Confirmation email
              try {
                const emailRow = await pool.query('SELECT email, business_name FROM customers WHERE id=$1', [customerId]);
                if (emailRow.rows[0]) {
                  await emailQueue.notifyCreditPackPurchased(emailRow.rows[0], { amount: creditPack.amount, newBalance });
                }
              } catch (emailErr) {
                console.error('[Whop] Credit pack email error:', emailErr.message);
              }
            }
            return;
          }

          // ── Subscription plan payment ─────────────────────────────────────
          const tier = whop.getPlanTierFromWhopId(whopPlanId);
          if (!tier) { console.warn('[Whop] Unknown plan ID:', whopPlanId); return; }

          const cycle = whop.getPlanCycleFromWhopId(whopPlanId);
          const expiresAt = new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 3600 * 1000);
          const nextBillingDate = new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 3600 * 1000);
          const planData = PLANS[tier];
          const whopMembershipId = data?.id || data?.membership_id;
          const whopCustomerId = data?.user_id || data?.customer_id;
          const email = data?.email || data?.user?.email;

          let customerResult = null;
          if (whopMembershipId) {
            customerResult = await pool.query('SELECT id, credits_balance, plan, pending_downgrade_plan, pending_downgrade_cycle FROM customers WHERE whop_membership_id = $1', [whopMembershipId]);
          }
          if (!customerResult?.rows?.length && email) {
            customerResult = await pool.query('SELECT id, credits_balance, plan, pending_downgrade_plan, pending_downgrade_cycle FROM customers WHERE email = $1', [email]);
          }
          if (!customerResult?.rows?.length) {
            console.warn('[Whop] No customer found for event', action, email);
            return;
          }

          const customer = customerResult.rows[0];
          const customerId = customer.id;

          const client = await pool.connect();
          let newBalance;
          try {
            await client.query('BEGIN');

            // Re-read + lock the balance inside the transaction — the outer
            // customerResult read above is unlocked and can be stale if Whop
            // fires overlapping webhooks (retries, activated+succeeded near-
            // simultaneously) for the same customer. Without this re-read,
            // two concurrent webhooks both compute newBalance off the same
            // stale currentBalance and the second UPDATE clobbers the first
            // credit grant instead of adding to it.
            const lockRow = await client.query('SELECT credits_balance FROM customers WHERE id=$1 FOR UPDATE', [customerId]);
            const currentBalance = lockRow.rows[0]?.credits_balance || 0;
            newBalance = currentBalance + planData.credits;

            // If this payment matches a pending downgrade, apply it and clear
            const isPendingDowngradeFulfilled = customer.pending_downgrade_plan === tier;

            await client.query(
              `UPDATE customers SET
                 plan=$1, status='active', credits_balance=$2,
                 credits_used_this_month=0, plan_changed_at=NOW(),
                 whop_membership_id=$3, whop_customer_id=$4,
                 billing_cycle=$5, plan_expires_at=$6, next_billing_date=$7,
                 pending_downgrade_plan=NULL, pending_downgrade_cycle=NULL,
                 updated_at=NOW()
               WHERE id=$8`,
              [tier, newBalance, whopMembershipId, whopCustomerId, cycle, expiresAt, nextBillingDate, customerId]
            );
            await client.query(
              `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
               VALUES ($1,'bonus',$2,$3,$4)`,
              [customerId, planData.credits, newBalance,
               isPendingDowngradeFulfilled
                 ? `Scheduled downgrade applied: ${tier} plan (+${planData.credits} credits)`
                 : `Whop payment: ${tier} plan (+${planData.credits} credits)`]
            );
            await client.query('COMMIT');
            console.log(`[Whop] Plan ${isPendingDowngradeFulfilled ? 'downgrade applied' : 'activated'}: ${tier} for customer ${customerId}`);
            // In-app notification
            if (isPendingDowngradeFulfilled) {
              new NotificationService(pool).downgradeApplied(customerId, planData.name, planData.credits);
            } else {
              new NotificationService(pool).planActivated(customerId, planData.name, planData.credits);
            }

            // Referral award for new paid subscribers
            if (tier !== 'trial' && !isPendingDowngradeFulfilled) {
              pool.query('SELECT referred_by FROM customers WHERE id = $1', [customerId]).then(async refRow => {
                const referralCode = refRow.rows[0]?.referred_by;
                if (!referralCode) return;
                const referrerRes = await pool.query('SELECT id FROM customers WHERE referral_code = $1', [referralCode]);
                if (!referrerRes.rows.length) return;
                const referrerId = referrerRes.rows[0].id;
                const dupeCheck = await pool.query(
                  `SELECT id FROM referral_awards WHERE referred_customer_id = $1 AND status IN ('pending','released')`,
                  [customerId]
                );
                if (dupeCheck.rows.length > 0) return;
                await pool.query(
                  `INSERT INTO referral_awards (referrer_customer_id, referred_customer_id, referral_code, credits, status) VALUES ($1,$2,$3,20,'pending')`,
                  [referrerId, customerId, referralCode]
                );
              }).catch(e => console.warn('[Referral] Could not queue award:', e.message));
            }

            // Confirmation email
            try {
              const customerRow = await pool.query('SELECT id, email, business_name FROM customers WHERE id=$1', [customerId]);
              if (customerRow.rows[0]) {
                await emailQueue.notifyPaymentConfirmed(customerRow.rows[0], planData.name, planData.credits);
              }
            } catch (emailErr) {
              console.error('[Whop] Email error:', emailErr.message);
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

          // Check for pending downgrade — if set, send customer the checkout link for new plan
          const customerRow = await pool.query(
            `SELECT id, email, business_name, plan, pending_downgrade_plan, pending_downgrade_cycle
             FROM customers WHERE whop_membership_id=$1`,
            [whopMembershipId]
          );
          const cust = customerRow.rows[0];

          if (cust?.pending_downgrade_plan && PLANS[cust.pending_downgrade_plan]) {
            // Membership expired — send checkout link for the lower plan so they can re-subscribe
            const newPlanData = PLANS[cust.pending_downgrade_plan];
            const newCycle = cust.pending_downgrade_cycle || 'monthly';
            try {
              const checkoutUrl = whop.getCheckoutUrl(cust.pending_downgrade_plan, newCycle);
              await emailQueue.notifyDowngradeCheckout(cust, {
                newPlan: newPlanData,
                cycle: newCycle,
                checkoutUrl,
                currentPlan: PLANS[cust.plan]?.name || cust.plan, // the plan they are leaving
              });
              console.log(`[Whop] Downgrade checkout email sent to customer ${cust.id}`);
            } catch (e) {
              console.error('[Whop] Could not send downgrade checkout email:', e.message);
            }
          }

          // In-app notification for plan expiry
          if (cust?.id) {
            new NotificationService(pool).planExpired(cust.id);
          }

          // Downgrade to trial in DB (plan expired — do NOT set suspended=true; that is for admin actions only)
          const deactivated = await pool.query(
            `UPDATE customers SET plan='trial', status='inactive', suspended=false, updated_at=NOW()
             WHERE whop_membership_id=$1 RETURNING id, credits_balance`,
            [whopMembershipId]
          );
          console.log(`[Whop] Deactivated membership ${whopMembershipId}`);

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

  // ── Checkout link / plan switch ───────────────────────────────────────────
  // Logic:
  //   New subscriber (no whop_membership_id) → Whop checkout URL
  //   Existing subscriber upgrading           → try PATCH plan_id; fallback to checkout URL
  //   Existing subscriber downgrading         → cancel at_period_end + store pending in DB
  router.get('/checkout-link', authenticate, async (req, res) => {
    try {
      const { plan, cycle = 'monthly' } = req.query;
      if (!plan || !PLANS[plan] || plan === 'trial') {
        return res.status(400).json({ error: 'Invalid plan' });
      }

      const customerResult = await pool.query(
        `SELECT whop_membership_id, plan AS current_plan, billing_cycle, plan_expires_at,
                credits_balance, pending_downgrade_plan
         FROM customers WHERE id=$1`,
        [req.customerId]
      );
      const cust = customerResult.rows[0];
      const membershipId = cust?.whop_membership_id;
      const currentPlanIdx = PLAN_ORDER.indexOf(cust?.current_plan || 'trial');
      const newPlanIdx = PLAN_ORDER.indexOf(plan);
      const isUpgrade = newPlanIdx > currentPlanIdx;

      // Guard: same plan AND same cycle — nothing to do
      if (cust?.current_plan === plan && cust?.billing_cycle === cycle && !cust?.pending_downgrade_plan) {
        return res.status(400).json({ error: 'You are already on this plan and billing cycle.' });
      }

      // ── UPGRADE ───────────────────────────────────────────────────────────
      if (membershipId && isUpgrade) {
        const newWhopPlanId = whop.getWhopPlanId(plan, cycle);
        const planData = PLANS[plan];
        const currentPlanData = PLANS[cust.current_plan] || PLANS.trial;

        if (newWhopPlanId) {
          // Try to switch plan in-place via PATCH (Whop may or may not support plan_id as mutable)
          try {
            await whop.updateMembership(membershipId, { plan_id: newWhopPlanId });

            // Grant credit delta immediately
            const creditDelta = Math.max(0, planData.credits - currentPlanData.credits);
            const expiresAt = new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 3600 * 1000);

            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              const freshRow = await client.query('SELECT credits_balance FROM customers WHERE id=$1 FOR UPDATE', [req.customerId]);
              await client.query(
                `UPDATE customers SET plan=$1, billing_cycle=$2, plan_expires_at=$3,
                   pending_downgrade_plan=NULL, pending_downgrade_cycle=NULL, updated_at=NOW()
                 WHERE id=$4`,
                [plan, cycle, expiresAt, req.customerId]
              );
              if (creditDelta > 0) {
                const newBal = (freshRow.rows[0].credits_balance || 0) + creditDelta;
                await client.query(`UPDATE customers SET credits_balance=$1 WHERE id=$2`, [newBal, req.customerId]);
                await client.query(
                  `INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, description)
                   VALUES ($1,'bonus',$2,$3,$4)`,
                  [req.customerId, creditDelta, newBal, `Upgrade to ${planData.name} (+${creditDelta} credits)`]
                );
              }
              await client.query('COMMIT');
            } catch (dbErr) {
              await client.query('ROLLBACK');
              throw dbErr;
            } finally {
              client.release();
            }

            console.log(`[Billing] Upgrade via PATCH: customer=${req.customerId} → ${plan}/${cycle}`);
            // In-app notification
            new NotificationService(pool).planUpgraded(req.customerId, planData.name, creditDelta);
            // Upgrade confirmation email
            try {
              const emailRow = await pool.query('SELECT email, business_name FROM customers WHERE id=$1', [req.customerId]);
              if (emailRow.rows[0]) {
                await emailQueue.notifyUpgradeApplied(emailRow.rows[0], {
                  newPlan: planData.name,
                  credits: planData.credits,
                  creditsDelta: creditDelta,
                  cycle,
                });
              }
            } catch (emailErr) {
              console.error('[Billing] Upgrade email error:', emailErr.message);
            }
            return res.json({ switched: true, immediate: true, newPlan: planData.name });
          } catch (patchErr) {
            // PATCH doesn't support plan_id — fall through to checkout redirect
            console.warn('[Billing] PATCH plan switch unsupported, falling back to checkout:', patchErr.message);
          }
        }

        // Fallback: redirect to Whop checkout (Whop handles upgrade for existing subscriber)
        try {
          const url = whop.getCheckoutUrl(plan, cycle);
          return res.json({ url });
        } catch (e) {
          return res.status(400).json({ error: `Whop plan ID not configured for ${plan}/${cycle}` });
        }
      }

      // ── DOWNGRADE (end-of-period) ─────────────────────────────────────────
      if (membershipId && !isUpgrade) {
        const newWhopPlanId = whop.getWhopPlanId(plan, cycle);
        if (!newWhopPlanId) {
          return res.status(400).json({ error: `Whop plan ID not configured for ${plan}/${cycle}. Set the env var and redeploy.` });
        }

        // If already pending a downgrade to the same plan, do nothing
        if (cust.pending_downgrade_plan === plan) {
          return res.json({
            switched: true,
            immediate: false,
            newPlan: PLANS[plan].name,
            effectiveDate: cust.plan_expires_at,
            alreadyPending: true,
          });
        }

        // Cancel current subscription at period end in Whop
        // This tells Whop: "stop charging the old price" — customer keeps access until plan_expires_at
        await whop.cancelMembership(membershipId, false); // false = at_period_end

        // Store pending downgrade in DB
        await pool.query(
          `UPDATE customers SET pending_downgrade_plan=$1, pending_downgrade_cycle=$2, updated_at=NOW() WHERE id=$3`,
          [plan, cycle, req.customerId]
        );

        console.log(`[Billing] Downgrade scheduled: customer=${req.customerId} → ${plan}/${cycle}, effective=${cust.plan_expires_at}`);
        // In-app notification
        new NotificationService(pool).planDowngradeScheduled(req.customerId, PLANS[plan].name, cust.plan_expires_at);
        // Downgrade scheduled confirmation email
        try {
          const emailRow = await pool.query('SELECT email, business_name FROM customers WHERE id=$1', [req.customerId]);
          if (emailRow.rows[0]) {
            await emailQueue.notifyDowngradeScheduled(emailRow.rows[0], {
              currentPlan: PLANS[cust.current_plan]?.name || cust.current_plan,
              newPlan: PLANS[plan].name,
              newPlanCredits: PLANS[plan].credits,
              effectiveDate: cust.plan_expires_at,
            });
          }
        } catch (emailErr) {
          console.error('[Billing] Downgrade scheduled email error:', emailErr.message);
        }
        return res.json({
          switched: true,
          immediate: false,
          newPlan: PLANS[plan].name,
          effectiveDate: cust.plan_expires_at,
        });
      }

      // ── NEW SUBSCRIBER ────────────────────────────────────────────────────
      try {
        const url = whop.getCheckoutUrl(plan, cycle);
        return res.json({ url });
      } catch (e) {
        return res.status(400).json({ error: `Whop plan ID not configured for ${plan}/${cycle}` });
      }
    } catch (err) {
      console.error('[Billing] checkout-link error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cancel a pending downgrade ────────────────────────────────────────────
  // Reverses the at_period_end cancellation in Whop so the current plan continues.
  router.post('/cancel-downgrade', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT whop_membership_id, pending_downgrade_plan, plan FROM customers WHERE id=$1`,
        [req.customerId]
      );
      const customer = result.rows[0];
      if (!customer?.pending_downgrade_plan) {
        return res.status(400).json({ error: 'No pending downgrade to cancel' });
      }

      if (customer.whop_membership_id) {
        await whop.uncancelMembership(customer.whop_membership_id);
      }

      await pool.query(
        `UPDATE customers SET pending_downgrade_plan=NULL, pending_downgrade_cycle=NULL, updated_at=NOW() WHERE id=$1`,
        [req.customerId]
      );

      console.log(`[Billing] Downgrade cancelled: customer=${req.customerId} staying on ${customer.plan}`);
      res.json({ success: true, plan: customer.plan });
    } catch (err) {
      console.error('[Billing] cancel-downgrade error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Buy credits ───────────────────────────────────────────────────────────
  router.get('/buy-credits', authenticate, async (req, res) => {
    try {
      const { pack } = req.query;

      if (pack === 'credits_custom') {
        return res.json({ useForm: true });
      }

      const creditPack = CREDIT_PACKS.find(p => p.id === pack);
      if (!creditPack) return res.status(400).json({ error: 'Invalid credit pack' });

      const url = whop.getCreditPackCheckoutUrl(pack);
      if (url) return res.json({ url });

      // No Whop product configured yet — use service-request form
      return res.json({ useForm: true, pack: creditPack });
    } catch (err) {
      console.error('[Billing] buy-credits error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Service requests (custom credit purchases / agency plan interest) ──────
  router.post('/service-request', authenticate, async (req, res) => {
    try {
      const { type, data = {} } = req.body;
      if (!['credit_purchase', 'agency_plan'].includes(type)) {
        return res.status(400).json({ error: 'Invalid request type' });
      }

      const safeData = {};
      if (type === 'credit_purchase') {
        const credits = parseInt(data.credits);
        if (!credits || credits < 10 || credits > 10000) {
          return res.status(400).json({ error: 'Credits must be between 10 and 10,000' });
        }
        safeData.credits = credits;
        safeData.price = Math.round(credits * 0.4 * 100) / 100;
        safeData.message = String(data.message || '').substring(0, 300);
      } else {
        safeData.businessName = String(data.businessName || '').substring(0, 100);
        safeData.clients = String(data.clients || '').substring(0, 20);
        safeData.useCase = String(data.useCase || '').substring(0, 300);
      }

      const existing = await pool.query(
        `SELECT id FROM service_requests WHERE customer_id=$1 AND type=$2 AND status='pending'`,
        [req.customerId, type]
      );
      if (existing.rows.length > 0) {
        return res.json({ id: existing.rows[0].id, type, status: 'pending', duplicate: true });
      }

      const { rows: [request] } = await pool.query(
        `INSERT INTO service_requests (customer_id, type, request_data)
         VALUES ($1,$2,$3::jsonb)
         RETURNING id, type, status, created_at`,
        [req.customerId, type, JSON.stringify(safeData)]
      );

      try {
        const customerRow = await pool.query('SELECT email, business_name FROM customers WHERE id=$1', [req.customerId]);
        if (customerRow.rows[0]) {
          const customer = customerRow.rows[0];
          await emailQueue.notifyServiceRequestReceived(customer, { type, request_data: safeData });
          await emailQueue.notifyAdminNewRequest({ type, request_data: safeData }, customer);
        }
      } catch (emailErr) {
        console.error('[Billing] service-request email error:', emailErr.message);
      }

      console.log(`[Billing] Service request created: type=${type} customer=${req.customerId}`);
      res.json({ id: request.id, type: request.type, status: request.status });
    } catch (err) {
      console.error('[Billing] service-request error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cancel subscription ───────────────────────────────────────────────────
  router.post('/cancel', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT plan, status, whop_membership_id, plan_expires_at FROM customers WHERE id=$1`,
        [req.customerId]
      );
      const customer = result.rows[0];
      if (!customer) return res.status(404).json({ error: 'Not found' });
      if (customer.plan === 'trial') return res.status(400).json({ error: 'No active subscription to cancel' });
      if (customer.status === 'cancelled') return res.status(400).json({ error: 'Subscription already cancelled' });

      if (customer.whop_membership_id) {
        try {
          // Cancel at period end — customer keeps access until billing period expires
          await whop.cancelMembership(customer.whop_membership_id, false);
        } catch (whopErr) {
          console.error('[Billing] Whop cancel API failed:', whopErr.message);
        }
      }

      await pool.query(`UPDATE customers SET status='cancelled', updated_at=NOW() WHERE id=$1`, [req.customerId]);
      console.log(`[Billing] Customer ${req.customerId} cancelled subscription`);
      // In-app notification
      new NotificationService(pool).planCancelled(req.customerId, PLANS[customer.plan]?.name || customer.plan, customer.plan_expires_at);
      // Cancellation confirmation email
      try {
        const emailRow = await pool.query('SELECT email, business_name FROM customers WHERE id=$1', [req.customerId]);
        if (emailRow.rows[0]) {
          await emailQueue.notifySubscriptionCancelled(emailRow.rows[0], {
            planName: PLANS[customer.plan]?.name || customer.plan,
            accessUntil: customer.plan_expires_at,
          });
        }
      } catch (emailErr) {
        console.error('[Billing] Cancel email error:', emailErr.message);
      }
      res.json({ success: true, accessUntil: customer.plan_expires_at });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Plans list ────────────────────────────────────────────────────────────
  router.get('/plans', authenticate, async (req, res) => {
    res.set('Cache-Control', 'private, max-age=3600');
    res.json(Object.values(PLANS));
  });

  // ── Credit transaction history ────────────────────────────────────────────
  router.get('/history', authenticate, async (req, res) => {
    try {
      const billingId = getBillingCustomerId(req);
      const result = await pool.query(
        `SELECT id, transaction_type, amount, balance_after, description, created_at
         FROM credit_transactions WHERE customer_id=$1
         ORDER BY created_at DESC LIMIT 50`,
        [billingId]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Current plan + billing status ─────────────────────────────────────────
  router.get('/current', authenticate, async (req, res) => {
    try {
      const billingId = getBillingCustomerId(req);
      const result = await pool.query(
        `SELECT plan, status, credits_balance, credits_used_this_month,
                trial_ends_at, plan_changed_at, whop_membership_id,
                billing_cycle, plan_expires_at, next_billing_date,
                pending_downgrade_plan, pending_downgrade_cycle
         FROM customers WHERE id=$1`,
        [billingId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const c = result.rows[0];
      res.json({
        currentPlan:             PLANS[c.plan] || PLANS.trial,
        status:                  c.status,
        creditsBalance:          c.credits_balance,
        creditsUsedThisMonth:    c.credits_used_this_month,
        trialEndsAt:             c.trial_ends_at,
        planChangedAt:           c.plan_changed_at,
        hasActiveMembership:     !!c.whop_membership_id,
        billingCycle:            c.billing_cycle || 'monthly',
        planExpiresAt:           c.plan_expires_at,
        nextBillingDate:         c.next_billing_date,
        pendingDowngradePlan:    c.pending_downgrade_plan ? PLANS[c.pending_downgrade_plan] : null,
        pendingDowngradeCycle:   c.pending_downgrade_cycle,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
