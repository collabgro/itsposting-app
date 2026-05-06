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
}

module.exports = NotificationService;
