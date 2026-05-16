const crypto = require('crypto');

const PLAN_IDS = {
  starter:      { monthly: process.env.PLAN_STARTER_M_WHOP_ID,  yearly: process.env.PLAN_STARTER_Y_WHOP_ID  },
  professional: { monthly: process.env.PLAN_PRO_M_WHOP_ID,      yearly: process.env.PLAN_PRO_Y_WHOP_ID      },
  premium:      { monthly: process.env.PLAN_PREMIUM_M_WHOP_ID,  yearly: process.env.PLAN_PREMIUM_Y_WHOP_ID  },
};

const PLAN_CREDITS = {
  starter:      50,
  professional: 100,
  premium:      150,
};

function getCheckoutUrl(tier, cycle = 'monthly') {
  const planId = PLAN_IDS[tier]?.[cycle];
  if (!planId) throw new Error(`Unknown plan tier/cycle: ${tier}/${cycle}`);
  return `https://whop.com/checkout/${planId}`;
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[WhopService] WHOP_WEBHOOK_KEY is required in production — refusing to process webhook');
    }
    console.warn('[WhopService] WHOP_WEBHOOK_KEY not set — skipping signature check (dev only)');
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

function getPlanTierFromWhopId(whopPlanId) {
  for (const [tier, cycles] of Object.entries(PLAN_IDS)) {
    if (Object.values(cycles).includes(whopPlanId)) return tier;
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

async function cancelMembership(membershipId) {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY not configured');
  const res = await fetch(`https://api.whop.com/api/v5/memberships/${membershipId}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ immediately: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whop API ${res.status}: ${body}`);
  }
  return res.json();
}

module.exports = { getCheckoutUrl, verifyWebhookSignature, getPlanTierFromWhopId, getPlanCycleFromWhopId, getCreditsForTier, cancelMembership };
