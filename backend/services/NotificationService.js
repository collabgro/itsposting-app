/**
 * NotificationService — creates in-app notifications for customers.
 * All methods are fire-and-forget (non-blocking).
 */

const TYPES = {
  CREDITS: 'credits',
  ACCOUNT: 'account',
  SECURITY: 'security',
  SYSTEM: 'system',
};

let webPush;
try { webPush = require('./WebPushService'); } catch { webPush = null; }

class NotificationService {
  constructor(pool) {
    this.pool = pool;
  }

  async create(customerId, type, title, message) {
    try {
      await this.pool.query(
        `INSERT INTO notifications (customer_id, type, title, message) VALUES ($1, $2, $3, $4)`,
        [customerId, type, title, message]
      );
      // Also send web push if configured
      if (webPush && webPush.configured()) {
        setImmediate(() => {
          webPush.sendToCustomer(this.pool, customerId, {
            title,
            body: message,
            url: '/dashboard',
          }).catch(() => {});
        });
      }
    } catch (err) {
      console.error('[NotificationService] Failed to create notification:', err.message);
    }
  }

  creditsAdjusted(customerId, amount, newBalance, reason) {
    const label = amount > 0 ? `+${amount}` : `${amount}`;
    this.create(
      customerId, TYPES.CREDITS,
      `Credits adjusted: ${label}`,
      `Your credit balance is now ${newBalance}${reason ? ` — ${reason}` : ''}.`
    );
  }

  accountSuspended(customerId, reason) {
    this.create(
      customerId, TYPES.ACCOUNT,
      'Account suspended',
      `Your account has been suspended${reason ? `: ${reason}` : '. Please contact support.'}`
    );
  }

  accountReactivated(customerId) {
    this.create(
      customerId, TYPES.ACCOUNT,
      'Account reactivated',
      'Your account has been reactivated. Welcome back!'
    );
  }

  passwordResetByAdmin(customerId) {
    this.create(
      customerId, TYPES.SECURITY,
      'Password changed',
      'An administrator has reset your account password.'
    );
  }

  postPublished(customerId, postId, platform) {
    const label = platform || 'your platform';
    this.create(
      customerId, TYPES.SYSTEM,
      'Post published',
      `Your post was successfully published to ${label}.`
    );
  }

  postFailed(customerId, postId, platform, reason) {
    const label = platform ? platform.replace('_', ' ') : 'platform';
    this.create(
      customerId, TYPES.SYSTEM,
      'Post failed to publish',
      `Could not publish to ${label}${reason ? `: ${reason}` : '. Please check your connected account and try again.'}`
    );
  }

  lowCredits(customerId, remaining) {
    this.create(
      customerId, TYPES.CREDITS,
      'Running low on credits',
      `You have ${remaining} credit${remaining !== 1 ? 's' : ''} left. Upgrade your plan to keep posting without interruption.`
    );
  }

  newSuggestion(customerId) {
    this.create(
      customerId, TYPES.SYSTEM,
      'ItsPosting AI has a suggestion for you',
      'A new content idea is ready. Check your dashboard to use it.'
    );
  }

  referralReleased(customerId, credits, newBalance) {
    this.create(
      customerId, TYPES.CREDITS,
      `Referral reward: +${credits} credits`,
      `Someone you referred just upgraded to a paid plan. Your new balance is ${newBalance} credits.`
    );
  }

  referralRejected(customerId) {
    this.create(
      customerId, TYPES.CREDITS,
      'Referral award not approved',
      'A referral credit award on your account was reviewed and not approved. Contact support if you think this is a mistake.'
    );
  }

  // ── Billing notifications ─────────────────────────────────────────────────

  planActivated(customerId, planName, credits) {
    this.create(
      customerId, TYPES.ACCOUNT,
      `${planName} plan is active`,
      `Welcome to ${planName}! ${credits} credits have been added to your account.`
    );
  }

  planUpgraded(customerId, planName, creditsDelta) {
    const deltaText = creditsDelta > 0 ? ` +${creditsDelta} credits added instantly.` : '';
    this.create(
      customerId, TYPES.ACCOUNT,
      `Upgraded to ${planName}`,
      `Your plan has been upgraded to ${planName}.${deltaText}`
    );
  }

  planDowngradeScheduled(customerId, newPlanName, effectiveDate) {
    const dateText = effectiveDate
      ? new Date(effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'your next billing date';
    this.create(
      customerId, TYPES.ACCOUNT,
      `Plan switch confirmed`,
      `Your account will switch to ${newPlanName} on ${dateText}. You have full access until then.`
    );
  }

  planCancelled(customerId, planName, accessUntil) {
    const dateText = accessUntil
      ? new Date(accessUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'the end of your billing period';
    this.create(
      customerId, TYPES.ACCOUNT,
      'Subscription cancelled',
      `Your ${planName} subscription has been cancelled. Full access continues until ${dateText}.`
    );
  }

  planExpired(customerId) {
    this.create(
      customerId, TYPES.ACCOUNT,
      'Plan access ended',
      'Your subscription has ended. Upgrade from the billing page to continue posting without interruption.'
    );
  }

  creditPackPurchased(customerId, amount, newBalance) {
    this.create(
      customerId, TYPES.CREDITS,
      `+${amount} credits added`,
      `Your credit purchase was successful. New balance: ${newBalance} credits.`
    );
  }

  downgradeApplied(customerId, newPlanName, credits) {
    this.create(
      customerId, TYPES.ACCOUNT,
      `Now on ${newPlanName} plan`,
      `Your plan has switched to ${newPlanName}. ${credits} credits have been added to your account.`
    );
  }
}

module.exports = NotificationService;
