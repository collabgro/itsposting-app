/**
 * ItsPosting — Outbound Job Scheduler + Worker
 * backend/services/OutboundQueue.js
 *
 * Schedules follow-up, review request, and no-show messages.
 * Falls back to direct DB insert + cron polling when Redis is unavailable.
 */

const { enqueueOutbound, getOutboundQueue, getConnection } = require('./QueueService');
const ReceptionistService = require('./ReceptionistService');

let Worker;
try { ({ Worker } = require('bullmq')); } catch (_) {}

const DEFAULT_AUTOMATIONS = [
  { type: 'follow_up',      enabled: true,  delay_hours: 48, channel: 'sms', message_template: "Hi {name}! Just checking in from {business_name}. Did you get a chance to sort out your inquiry? We have openings this week if you're still looking." },
  { type: 'review_request', enabled: true,  delay_hours: 4,  channel: 'sms', message_template: "Hi {name}! Glad we could help today. Would you mind leaving us a quick Google review? It really helps small businesses like ours. {booking_link}" },
  { type: 'noshow',         enabled: true,  delay_hours: 2,  channel: 'sms', message_template: "Hi {name}, we missed you today! Would you like to reschedule? Here's our booking link: {booking_link}" },
  { type: 'seasonal',       enabled: false, delay_hours: 0,  channel: 'sms', message_template: "Hi {name}, just a seasonal update from {business_name}. {booking_link}" },
];

class OutboundQueue {
  constructor(pool) {
    this.pool = pool;
    this.receptionistSvc = new ReceptionistService(pool);
  }

  // ── Resolve all rules for a trigger event (built-in + custom) ──────────────

  async _getRulesForTrigger(customerId, triggerEvent) {
    const BUILT_IN_TYPE = {
      lead_contacted:     'follow_up',
      job_completed:      'review_request',
      appointment_missed: 'noshow',
    };
    const builtInType = BUILT_IN_TYPE[triggerEvent];
    try {
      const { rows } = await this.pool.query(
        `SELECT automation_config FROM receptionist_config WHERE customer_id=$1`, [customerId]
      );
      const rules = rows[0]?.automation_config || DEFAULT_AUTOMATIONS;
      return rules.filter(r =>
        r.type === builtInType ||
        (r.type === 'custom' && r.trigger_event === triggerEvent)
      );
    } catch (_) {
      return DEFAULT_AUTOMATIONS.filter(r => r.type === builtInType);
    }
  }

  // ── Kept for seasonal (on-demand, not event-based) ───────────────────────

  async _getAutomationRule(customerId, type) {
    try {
      const { rows } = await this.pool.query(
        `SELECT automation_config FROM receptionist_config WHERE customer_id=$1`, [customerId]
      );
      const rules = rows[0]?.automation_config || DEFAULT_AUTOMATIONS;
      return rules.find(r => r.type === type) || DEFAULT_AUTOMATIONS.find(r => r.type === type) || null;
    } catch (_) {
      return DEFAULT_AUTOMATIONS.find(r => r.type === type) || null;
    }
  }

  // ── Schedule helpers ────────────────────────────────────────────────────────

  async scheduleFollowUp(contactId, customerId, platform) {
    const rules = await this._getRulesForTrigger(customerId, 'lead_contacted');
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const delayHours = rule.delay_hours ?? 48;
      const channel = rule.channel || platform || 'sms';
      const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000);
      await this._insertOutboundJob({
        customerId, contactId,
        jobType: rule.type === 'custom' ? 'custom' : 'follow_up',
        platform: channel,
        scheduledFor,
        payload: { contactId, customerId, platform: channel, message_template: rule.message_template || null, jobType: 'follow_up' },
      });
    }
  }

  async scheduleReviewRequest(contactId, customerId) {
    const rules = await this._getRulesForTrigger(customerId, 'job_completed');
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const delayHours = rule.delay_hours ?? 4;
      const channel = rule.channel || 'sms';
      const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000);
      await this._insertOutboundJob({
        customerId, contactId,
        jobType: rule.type === 'custom' ? 'custom' : 'review_request',
        platform: channel,
        scheduledFor,
        payload: { contactId, customerId, message_template: rule.message_template || null, jobType: 'review_request' },
      });
    }
  }

  async scheduleNoShowFollowUp(contactId, customerId, appointmentId) {
    const rules = await this._getRulesForTrigger(customerId, 'appointment_missed');
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const delayHours = rule.delay_hours ?? 2;
      const channel = rule.channel || 'sms';
      const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000);
      await this._insertOutboundJob({
        customerId, contactId,
        jobType: rule.type === 'custom' ? 'custom' : 'noshow',
        platform: channel,
        scheduledFor,
        payload: { contactId, customerId, appointmentId, message_template: rule.message_template || null, jobType: 'noshow' },
      });
    }
  }

  async scheduleSeasonalCampaign(customerId, message, platform = 'sms') {
    const scheduledFor = new Date(Date.now() + 5 * 60 * 1000); // near-immediate
    await this._insertOutboundJob({
      customerId, contactId: null,
      jobType: 'seasonal',
      platform,
      scheduledFor,
      payload: { customerId, message, platform },
    });
  }

  // ── Internal DB insert + optional BullMQ enqueue ───────────────────────────

  async _insertOutboundJob({ customerId, contactId, jobType, platform, scheduledFor, payload }) {
    const result = await this.pool.query(
      `INSERT INTO outbound_jobs (customer_id, contact_id, job_type, platform, scheduled_for, payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [customerId, contactId, jobType, platform, scheduledFor, JSON.stringify(payload)]
    );
    const jobId = result.rows[0]?.id;

    // If Redis available, also enqueue in BullMQ with delay
    const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
    await enqueueOutbound(jobType, { ...payload, outboundJobId: jobId }, { delay: delayMs });

    return jobId;
  }

  // ── Process a single outbound job (called by worker or cron) ──────────────

  async processJob(jobData) {
    const { outboundJobId, contactId, customerId, platform } = jobData;

    try {
      // Mark in-progress
      if (outboundJobId) {
        await this.pool.query(
          `UPDATE outbound_jobs SET status='running' WHERE id=$1`, [outboundJobId]
        );
      }

      // Fetch contact info + customer config in parallel
      const [contactRes, cfgRes, bizRes] = await Promise.all([
        this.pool.query(`SELECT * FROM contacts WHERE id=$1 AND customer_id=$2`, [contactId, customerId]),
        this.pool.query(`SELECT * FROM receptionist_config WHERE customer_id=$1`, [customerId]),
        this.pool.query(`SELECT business_name FROM customers WHERE id=$1`, [customerId]),
      ]);
      const contact = contactRes.rows[0];
      if (!contact) throw new Error(`Contact ${contactId} not found`);
      const cfg = cfgRes.rows[0] || {};
      const businessName = bizRes.rows[0]?.business_name || 'us';

      const { jobType } = jobData;

      // Resolve message: use custom template from payload, fall back to hardcoded defaults
      const FALLBACK_TEMPLATES = {
        follow_up: `Hi {name}! Just checking in from {business_name}. Did you get a chance to sort out your inquiry?`,
        review_request: `Hi {name}! We hope you're happy with our work. Would you mind leaving us a quick review? {booking_link}`,
        noshow: `Hi {name}, we missed you today! Would you like to reschedule? {booking_link}`,
        seasonal: jobData.message || `Hi {name}! Just a quick note from {business_name}. {booking_link}`,
        custom: `Hi {name}! Just a quick message from {business_name}.`,
      };
      const templateKey = jobType === 'custom' ? (jobData.jobType || 'follow_up') : jobType;
      const templateStr = jobData.message_template || FALLBACK_TEMPLATES[templateKey] || FALLBACK_TEMPLATES.follow_up;
      const messageText = templateStr
        .replace(/\{name\}/g, contact.name || 'there')
        .replace(/\{business_name\}/g, businessName)
        .replace(/\{booking_link\}/g, cfg.booking_link || '');

      // SMS/WhatsApp sending removed — jobs are logged only
      console.log(`[OutboundQueue] Job ${outboundJobId} (${jobType}) prepared for ${contact.name || contactId}: ${messageText.substring(0, 80)}`);

      // Mark done
      if (outboundJobId) {
        await this.pool.query(
          `UPDATE outbound_jobs SET status='sent', sent_at=NOW() WHERE id=$1`, [outboundJobId]
        );
      }

      return { success: true };
    } catch (err) {
      console.error(`[OutboundQueue] Job error (${outboundJobId}):`, err.message);
      if (outboundJobId) {
        await this.pool.query(
          `UPDATE outbound_jobs SET status='failed' WHERE id=$1`, [outboundJobId]
        );
      }
      throw err;
    }
  }

  // ── Start BullMQ worker (called once on server startup when Redis is live) ─

  startWorker() {
    if (!Worker || !process.env.REDIS_URL) {
      console.log('[OutboundQueue] BullMQ worker not started (REDIS_URL not set)');
      return null;
    }

    const worker = new Worker('outbound', async (job) => {
      return this.processJob(job.data);
    }, {
      connection: getConnection(),
      concurrency: 3,
    });

    worker.on('completed', (job) => console.log(`[OutboundQueue] Job ${job.id} (${job.name}) completed`));
    worker.on('failed', (job, err) => console.error(`[OutboundQueue] Job ${job?.id} failed:`, err.message));

    console.log('[OutboundQueue] BullMQ worker started');
    return worker;
  }

  // ── Cron fallback: process overdue jobs from DB (runs when Redis is absent) ─

  async processPendingJobs() {
    if (process.env.REDIS_URL) return; // BullMQ handles it when Redis is present

    const result = await this.pool.query(
      `SELECT * FROM outbound_jobs
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC LIMIT 20`
    );

    for (const job of result.rows) {
      try {
        await this.processJob({ ...job.payload, outboundJobId: job.id });
      } catch (_) {}
    }
  }
}

module.exports = OutboundQueue;
