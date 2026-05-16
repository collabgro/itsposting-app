/**
 * EmailWorker — polls the email_queue table every 30 seconds and processes
 * pending emails. Failed sends are retried up to MAX_ATTEMPTS times with
 * exponential backoff. Dead-lettered emails (max attempts reached) are marked
 * as 'failed' so they can be reviewed in the admin queue viewer.
 */

const EmailService = require('./EmailService');

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;

class EmailWorker {
  constructor(pool) {
    this.pool = pool;
    this.emailService = new EmailService();
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log(`[EmailWorker] Started — polling every ${POLL_INTERVAL_MS / 1000}s (provider: ${process.env.EMAIL_PROVIDER || 'log'})`);
    this._poll();
    this.timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
    console.log('[EmailWorker] Stopped');
  }

  // ─── Core poll loop ────────────────────────────────────────────────────────

  async _poll() {
    const client = await this.pool.connect();
    try {
      // Claim a batch atomically — skip locked rows so concurrent workers are safe
      const result = await client.query(`
        SELECT id, to_email, subject, body_html, body_text, template_name, template_data, attempts
        FROM email_queue
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
          AND attempts < $1
        ORDER BY scheduled_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `, [MAX_ATTEMPTS, BATCH_SIZE]);

      if (result.rows.length === 0) return;

      console.log(`[EmailWorker] Processing ${result.rows.length} email(s)`);

      for (const row of result.rows) {
        await this._processOne(client, row);
      }
    } catch (err) {
      console.error('[EmailWorker] Poll error:', err.message);
    } finally {
      client.release();
    }
  }

  async _processOne(client, row) {
    const { id, to_email, subject: rawSubject, body_html, body_text, template_name, template_data, attempts } = row;

    try {
      let subject = rawSubject;
      let html = body_html;
      let text = body_text;

      // If stored as a template reference, render it now
      if (template_name && (!html || !subject)) {
        const data = template_data || {};
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const rendered = this.emailService.renderTemplate(template_name, parsed);
        subject = rendered.subject;
        html = rendered.html;
        text = rendered.text;
      }

      await this.emailService.send({ to: to_email, subject, html, text });

      // Mark sent
      await client.query(
        `UPDATE email_queue SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = $1`,
        [id]
      );
    } catch (err) {
      const newAttempts = attempts + 1;
      const isFatal = newAttempts >= MAX_ATTEMPTS;

      // Exponential backoff: reschedule after 5min, 15min, 45min
      const backoffMinutes = [5, 15, 45][attempts] || 60;

      await client.query(
        `UPDATE email_queue
         SET status = $1,
             attempts = $2,
             last_error = $3,
             scheduled_at = NOW() + make_interval(mins => $4)
         WHERE id = $5`,
        [isFatal ? 'failed' : 'pending', newAttempts, err.message, backoffMinutes, id]
      );

      console.error(`[EmailWorker] Failed to send email ${id} (attempt ${newAttempts}/${MAX_ATTEMPTS}): ${err.message}`);
      if (isFatal) console.error(`[EmailWorker] Email ${id} to ${to_email} dead-lettered after ${MAX_ATTEMPTS} attempts`);
    }
  }

  // ─── Manual trigger (for testing / admin UI) ──────────────────────────────

  async processNow() {
    await this._poll();
  }

  // ─── Stats for admin health endpoint ──────────────────────────────────────

  async getStats() {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')     AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')   AS failed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
      FROM email_queue
    `);
    return result.rows[0];
  }
}

module.exports = EmailWorker;
