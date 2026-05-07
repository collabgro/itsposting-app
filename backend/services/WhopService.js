const crypto = require('crypto');

const PLAN_IDS = {
  starter:      { monthly: process.env.PLAN_STARTER_M_WHOP_ID,  yearly: process.env.PLAN_STARTER_Y_WHOP_ID  },
  professional: { monthly: process.env.PLAN_PRO_M_WHOP_ID,      yearly: process.env.PLAN_PRO_Y_WHOP_ID      },
  premium:      { monthly: process.env.PLAN_PREMIUM_M_WHOP_ID,  yearly: process.env.PLAN_PREMIUM_Y_WHOP_ID  },
};

const PLAN_CREDITS = {
  starter:      50,
  professional: 150,
  premium:      500,
};

function getCheckoutUrl(tier, cycle = 'monthly') {
  const planId = PLAN_IDS[tier]?.[cycle];
  if (!planId) throw new Error(`Unknown plan tier/cycle: ${tier}/${cycle}`);
  return `https://whop.com/checkout/${planId}`;
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    console.warn('[WhopService] WHOP_WEBHOOK_KEY not set — skipping signature check');
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

module.exports = { getCheckoutUrl, verifyWebhookSignature, getPlanTierFromWhopId, getCreditsForTier };
