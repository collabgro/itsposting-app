/**
 * Weather Alert routes
 * Mounts at: /api/weather
 *
 * GET  /my-alert          — returns today's weather alert for logged-in customer
 * POST /dismiss           — dismiss today's alert (don't show again today)
 * GET  /preview-signal    — preview what signal would fire for this customer (admin tool)
 * POST /generate-alerts   — cron endpoint (CRON_SECRET protected); generates alerts for all due customers
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const WeatherAlertService = require('../services/WeatherAlertService');

module.exports = function weatherRoutes(pool) {
  const router  = express.Router();
  const service = new WeatherAlertService(pool);

  // ── GET /my-alert ────────────────────────────────────────────────────────────
  // Returns today's alert if one exists and hasn't been dismissed.
  // Returns { alert: null } when no alert (not an error — just no weather event today).
  router.get('/my-alert', authenticate, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { rows } = await pool.query(
        `SELECT id, signal_type, signal_severity, weather_summary, post_options, city, created_at
         FROM weather_alerts
         WHERE customer_id = $1
           AND alert_date = $2
           AND dismissed_at IS NULL
         LIMIT 1`,
        [req.customerId, today]
      );

      if (!rows.length) return res.json({ alert: null });
      const alert = rows[0];
      res.json({
        alert: {
          id:             alert.id,
          signalType:     alert.signal_type,
          severity:       alert.signal_severity,
          headline:       alert.weather_summary,
          city:           alert.city,
          postOptions:    typeof alert.post_options === 'string'
                            ? JSON.parse(alert.post_options)
                            : alert.post_options,
          createdAt:      alert.created_at,
        },
      });
    } catch (err) {
      console.error('[WeatherRoutes] GET /my-alert error:', err.message);
      res.status(500).json({ error: 'Failed to load weather alert' });
    }
  });

  // ── POST /dismiss ────────────────────────────────────────────────────────────
  router.post('/dismiss', authenticate, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `UPDATE weather_alerts SET dismissed_at = NOW()
         WHERE customer_id = $1 AND alert_date = $2 AND dismissed_at IS NULL`,
        [req.customerId, today]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[WeatherRoutes] POST /dismiss error:', err.message);
      res.status(500).json({ error: 'Failed to dismiss alert' });
    }
  });

  // ── GET /preview-signal ──────────────────────────────────────────────────────
  // Shows what weather signal would fire for this customer, without generating posts.
  // Useful for debugging and the admin panel.
  router.get('/preview-signal', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT location, industry FROM customers WHERE id = $1`, [req.customerId]
      );
      const customer = rows[0];
      if (!customer?.location) return res.json({ signals: [] });

      const WeatherService = require('../services/WeatherService');
      const ws = new WeatherService();
      const forecast = await ws.getForecast(customer.location);
      const signals  = ws.detectSignals(forecast);
      const relevant = signals.filter(s => ws.isRelevantForIndustry(s.type, customer.industry));

      res.json({
        city:     customer.location,
        industry: customer.industry,
        signals:  relevant,
        allSignals: signals,
        forecast: {
          minTemp: forecast?.daily?.temperature_2m_min?.[0],
          maxTemp: forecast?.daily?.temperature_2m_max?.[0],
          precip:  forecast?.daily?.precipitation_sum?.[0],
          code:    forecast?.daily?.weathercode?.[0],
        },
      });
    } catch (err) {
      console.error('[WeatherRoutes] GET /preview-signal error:', err.message);
      res.status(500).json({ error: 'Failed to preview signal' });
    }
  });

  // ── POST /generate-alerts ────────────────────────────────────────────────────
  // Cron endpoint — called every hour by Railway cron.
  // Generates morning alerts for all customers where it's currently 5:30-7:00am local.
  router.post('/generate-alerts', async (req, res) => {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (process.env.NODE_ENV !== 'development' && secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Respond immediately to avoid cron timeout
    res.json({ status: 'running', message: 'Weather alert generation started in background' });
    service.generateForAllDue().catch(err =>
      console.error('[WeatherRoutes] Background generate error:', err.message)
    );
  });

  return router;
};
