/**
 * EmailQueue — helper for queueing notification emails from routes.
 * All methods are fire-and-forget (non-blocking) so they never slow down
 * API responses. Errors are caught and logged but not propagated.
 */

const APP_URL = process.env.FRONTEND_URL || 'https://app.itsposting.com';

class EmailQueue {
  constructor(pool) {
    this.pool = pool;
  }

  // ─── Low-level queue insert ────────────────────────────────────────────────

  async queue(toEmail, templateName, templateData, scheduledAt = null) {
    try {
      await this.pool.query(
        `INSERT INTO email_queue (to_email, template_name, template_data, scheduled_at)
         VALUES ($1, $2, $3, COALESCE($4, NOW()))`,
        [toEmail, templateName, JSON.stringify(templateData), scheduledAt]
      );
    } catch (err) {
      // Non-fatal — email failure should never block an API response
      console.error('[EmailQueue] Failed to queue email:', err.message);
    }
  }

  /**
   * Resolve the platform/agency name to use in emails for a given customer.
   * If the customer belongs to an agency owner (parent with white_label_config),
   * returns their agencyName. Falls back to 'ItsPosting'.
   */
  async _resolveAgencyName(customerId) {
    try {
      const res = await this.pool.query(
        `SELECT
           c.white_label_config,
           p.white_label_config AS parent_wl_config
         FROM customers c
         LEFT JOIN customers p ON p.id = c.parent_customer_id AND p.plan = 'agency'
         WHERE c.id = $1`,
        [customerId]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0];
      // Sub-account: use parent's agency name
      const wl = row.parent_wl_config || row.white_label_config || {};
      return wl.agencyName || null;
    } catch {
      return null;
    }
  }

  // ─── Notification helpers ──────────────────────────────────────────────────

  /** Called when an admin suspends an account */
  async notifySuspended(customer, reason) {
    await this.queue(customer.email, 'account_suspended', {
      businessName: customer.business_name || customer.email,
      reason: reason || '',
    });
  }

  /** Called when an admin reactivates a suspended account */
  async notifyReactivated(customer) {
    await this.queue(customer.email, 'account_reactivated', {
      businessName: customer.business_name || customer.email,
      loginUrl: `${APP_URL}/login`,
    });
  }

  /** Called when an admin adjusts credits */
  async notifyCreditsAdjusted(customer, amount, newBalance, reason) {
    await this.queue(customer.email, 'credits_adjusted', {
      businessName: customer.business_name || customer.email,
      amountLabel: amount > 0 ? `+${amount} credits` : `${amount} credits`,
      amountColor: amount > 0 ? '#22C55E' : '#EF4444',
      newBalance,
      reason: reason || '',
    });
  }

  /** Called when an admin force-resets a password */
  async notifyPasswordResetByAdmin(customer) {
    await this.queue(customer.email, 'password_reset_admin', {
      businessName: customer.business_name || customer.email,
      loginUrl: `${APP_URL}/login`,
    });
  }

  /** Called by the forgot-password flow */
  async notifyPasswordReset(toEmail, token) {
    await this.queue(toEmail, 'password_reset', {
      resetUrl: `${APP_URL}/reset-password?token=${token}`,
    });
  }

  /** Called after a successful Whop payment / plan activation */
  async notifyPaymentConfirmed(customer, planName, credits) {
    const platformName = await this._resolveAgencyName(customer.id);
    await this.queue(customer.email, 'payment_confirmed', {
      businessName: customer.business_name || customer.email,
      platformName: platformName || undefined,
      planName,
      credits,
      loginUrl: `${APP_URL}/login`,
    });
  }

  /** Called on new account registration */
  async notifyWelcome(customer) {
    const platformName = await this._resolveAgencyName(customer.id);
    await this.queue(customer.email, 'welcome', {
      businessName: customer.business_name || customer.email,
      platformName: platformName || undefined,
      credits: customer.credits_balance ?? 10,
      loginUrl: `${APP_URL}/login`,
    });
  }

  /** Called when AutoPostScheduler successfully publishes a post */
  async notifyPostPublished(customer, platform) {
    const platformName = await this._resolveAgencyName(customer.id);
    await this.queue(customer.email, 'post_published', {
      businessName: customer.business_name || customer.email,
      platformName: platformName || undefined,
      platform: platform ? platform.replace(/_/g, ' ') : 'social media',
      analyticsUrl: `${APP_URL}/analytics`,
    });
  }

  /** Called when a workspace invite is sent */
  async notifyWorkspaceInvite({ toEmail, inviterBusinessName, platformName = 'ItsPosting', roleLabel, acceptUrl }) {
    await this.queue(toEmail, 'workspace_invite', {
      inviterBusinessName,
      platformName,
      roleLabel,
      acceptUrl,
    });
  }

  /** Called by PostCoreAdvisor on Monday mornings */
  async notifyPostCoreBriefing(customer, briefingData) {
    const sections = briefingData?.sections || [];
    const working = sections.find(s => s.type === 'working');
    const opportunity = sections.find(s => s.type === 'opportunity');
    await this.queue(customer.email, 'postcore_briefing', {
      greeting: briefingData?.greeting || `Good morning, ${customer.business_name}.`,
      weekSummary: briefingData?.weekSummary || '',
      whatWorking: working ? `${working.observation} ${working.action}` : 'Keep posting consistently.',
      opportunity: opportunity ? `${opportunity.observation} ${opportunity.action}` : 'Create a seasonal post this week.',
      closingNote: briefingData?.closingNote || 'Every post puts your business in front of local customers.',
      dashboardUrl: `${APP_URL}/dashboard`,
    });
  }

  /** Called when admin releases a referral award */
  async notifyReferralReleased(customer, credits, newBalance) {
    await this.queue(customer.email, 'referral_released', {
      businessName: customer.business_name || customer.email,
      credits,
      newBalance,
      referralUrl: `${APP_URL}/billing?tab=referral`,
    });
  }

  /** Called when admin rejects a referral award */
  async notifyReferralRejected(customer, reason) {
    await this.queue(customer.email, 'referral_rejected', {
      businessName: customer.business_name || customer.email,
      reasonBlock: reason
        ? `<div class="box"><p style="margin:0;font-size:13px;color:#A0A0B0;">Reason provided:</p><p style="margin:8px 0 0;font-size:14px;color:#E2E2E8;">${reason}</p></div>`
        : '',
      reasonText: reason ? `Reason: ${reason}` : '',
      billingUrl: `${APP_URL}/billing?tab=referral`,
    });
  }

  // ─── Queue management (used by admin email queue page) ────────────────────

  async list({ status, limit = 50, offset = 0 } = {}) {
    let query = `SELECT id, to_email, template_name, status, attempts, last_error, scheduled_at, sent_at, created_at FROM email_queue WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    params.push(parseInt(limit), parseInt(offset));
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async retryFailed(id) {
    await this.pool.query(
      `UPDATE email_queue SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW() WHERE id = $1 AND status = 'failed'`,
      [id]
    );
  }

  async retryAllFailed() {
    const result = await this.pool.query(
      `UPDATE email_queue SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW() WHERE status = 'failed' RETURNING id`
    );
    return result.rowCount;
  }
}

module.exports = EmailQueue;
