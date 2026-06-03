const crypto = require('crypto');

// Subscription plan Whop product IDs — set these as Railway env vars
const PLAN_IDS = {
  starter:      { monthly: process.env.PLAN_STARTER_M_WHOP_ID,  yearly: process.env.PLAN_STARTER_Y_WHOP_ID  },
  professional: { monthly: process.env.PLAN_PRO_M_WHOP_ID,      yearly: process.env.PLAN_PRO_Y_WHOP_ID      },
  premium:      { monthly: process.env.PLAN_PREMIUM_M_WHOP_ID,  yearly: process.env.PLAN_PREMIUM_Y_WHOP_ID  },
};

// Credit pack Whop product IDs — create one-time purchase products in Whop, then set here
const CREDIT_PACK_IDS = {
  credits_25:  process.env.CREDIT_25_WHOP_ID,
  credits_50:  process.env.CREDIT_50_WHOP_ID,
  credits_75:  process.env.CREDIT_75_WHOP_ID,
  credits_100: process.env.CREDIT_100_WHOP_ID,
  credits_125: process.env.CREDIT_125_WHOP_ID,
  credits_150: process.env.CREDIT_150_WHOP_ID,
  credits_175: process.env.CREDIT_175_WHOP_ID,
  credits_200: process.env.CREDIT_200_WHOP_ID,
  credits_225: process.env.CREDIT_225_WHOP_ID,
  credits_250: process.env.CREDIT_250_WHOP_ID,
};

const PLAN_CREDITS = {
  starter:      50,
  professional: 100,
  premium:      150,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWhopPlanId(tier, cycle = 'monthly') {
  return PLAN_IDS[tier]?.[cycle] || null;
}

function getCheckoutUrl(tier, cycle = 'monthly') {
  const planId = PLAN_IDS[tier]?.[cycle];
  if (!planId) throw new Error(`Whop plan ID not configured for ${tier}/${cycle}. Set the env var and redeploy.`);
  return `https://whop.com/checkout/${planId}`;
}

function getCreditPackCheckoutUrl(packId) {
  const planId = CREDIT_PACK_IDS[packId];
  if (!planId) return null;
  return `https://whop.com/checkout/${planId}`;
}

function getPlanTierFromWhopId(whopPlanId) {
  for (const [tier, cycles] of Object.entries(PLAN_IDS)) {
    if (Object.values(cycles).includes(whopPlanId)) return tier;
  }
  for (const [packId, id] of Object.entries(CREDIT_PACK_IDS)) {
    if (id === whopPlanId) return packId;
  }
  return null;
}

function getCreditsForTier(tier) {
  return PLAN_CREDITS[tier] || 0;
}

function getPlanCycleFromWhopId(whopPlanId) {
  for (const [, cycles] of Object.entries(PLAN_IDS)) {
    if (cycles.monthly === whopPlanId) return 'monthly';
    if (cycles.yearly  === whopPlanId) return 'yearly';
  }
  return 'monthly';
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[WhopService] WHOP_WEBHOOK_KEY is required in production');
    }
    console.warn('[WhopService] WHOP_WEBHOOK_KEY not set — skipping check (dev only)');
    return true;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader || '', 'utf8'),
    Buffer.from(expected, 'utf8')
  );
}

// ── Whop REST API wrappers ───────────────────────────────────────────────────

async function _whopPost(path, body = {}) {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY not configured');
  const res = await fetch(`https://api.whop.com/api/v1${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whop API ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

async function _whopPatch(path, body = {}) {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY not configured');
  const res = await fetch(`https://api.whop.com/api/v1${path}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whop API ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

/**
 * Cancel a membership.
 * immediately=false → cancels at end of current billing period (user keeps access until then).
 * immediately=true  → revokes access right away.
 */
async function cancelMembership(membershipId, immediately = false) {
  return _whopPost(`/memberships/${membershipId}/cancel`, {
    cancellation_mode: immediately ? 'immediate' : 'at_period_end',
  });
}

/**
 * Reverse a pending "cancel at period end" — customer stays on their current plan.
 */
async function uncancelMembership(membershipId) {
  return _whopPost(`/memberships/${membershipId}/uncancel`, {});
}

/**
 * Attempt to switch a membership's plan in-place via PATCH.
 * Whop may or may not support plan_id as a mutable field — if this throws,
 * the caller should fall back to the checkout-URL flow.
 */
async function updateMembership(membershipId, fields) {
  return _whopPatch(`/memberships/${membershipId}`, fields);
}

module.exports = {
  getCheckoutUrl,
  getWhopPlanId,
  getCreditPackCheckoutUrl,
  cancelMembership,
  uncancelMembership,
  updateMembership,
  verifyWebhookSignature,
  getPlanTierFromWhopId,
  getPlanCycleFromWhopId,
  getCreditsForTier,
};
