require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const postRoutes = require('./routes/posts');
const contentRoutes = require('./routes/content');
const socialRoutes = require('./routes/social');
const scraperRoutes = require('./routes/scraper');
const uploadRoutes = require('./routes/upload');
const billingRoutes = require('./routes/billing');
const mediaRoutes = require('./routes/media');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const suggestionsRoutes = require('./routes/suggestions');
const wizardRoutes = require('./routes/wizard');
const dmsRoutes = require('./routes/dms');
const contactsRoutes = require('./routes/contacts');
const intelligenceRoutes = require('./routes/intelligence');
const inboxRoutes = require('./routes/inbox');
const knowledgeRoutes = require('./routes/knowledge');
const AutoPostScheduler = require('./services/AutoPostScheduler');
const EmailWorker = require('./services/EmailWorker');
const SuggestionsEngine = require('./services/SuggestionsEngine');
const DMPollingService = require('./services/DMPollingService');
const cron = require('node-cron');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/socialmedia',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ Database connection error:', err.message);
  else console.log('✅ Database connected at', res.rows[0].now);
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests, please try again later.', standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts. Try again in 15 minutes.', skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });
const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: 'Too many password reset attempts. Try again in 1 hour.', standardHeaders: true, legacyHeaders: false });

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400 || duration > 1000) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), method: req.method, path: req.path, status: res.statusCode, durationMs: duration, ip: req.ip, userId: req.customerId || null }));
    }
  });
  next();
});

app.use('/api/auth', authRoutes(pool));
app.use('/api/customers', customerRoutes(pool));
app.use('/api/posts', postRoutes(pool));
app.use('/api/content', contentRoutes(pool));
app.use('/api/social', socialRoutes(pool));
app.use('/api/scraper', scraperRoutes(pool));
app.use('/api/upload', uploadRoutes(pool));
app.use('/api/billing', billingRoutes(pool));
app.use('/api/media', mediaRoutes(pool));
app.use('/api/admin', adminRoutes(pool));
app.use('/api/analytics', analyticsRoutes(pool));
app.use('/api/notifications', notificationRoutes(pool));
app.use('/api/suggestions', suggestionsRoutes(pool));
app.use('/api/wizard', wizardRoutes(pool));
app.use('/api/dms', dmsRoutes(pool));
app.use('/api/contacts', contactsRoutes(pool));
app.use('/api/intelligence', intelligenceRoutes(pool));
app.use('/api/inbox', inboxRoutes(pool));
app.use('/api/knowledge', knowledgeRoutes(pool));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '2.1.0',
      services: {
        imageOne: !!process.env.GOOGLE_AI_API_KEY,
        imageTwo: !!process.env.REPLICATE_API_TOKEN,
        video: !!process.env.HEYGEN_API_KEY,
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      },
    });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Its Posting API',
    version: '2.1.0',
    docs: '/health',
    endpoints: { auth: '/api/auth/*', customers: '/api/customers/*', posts: '/api/posts/*', content: '/api/content/*', admin: '/api/admin/*', analytics: '/api/analytics/*' },
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  const errorId = Math.random().toString(36).substring(7);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', errorId, message: err.message, stack: err.stack, method: req.method, path: req.path, userId: req.customerId || null }));
  res.status(err.status || 500).json({ error: err.message || 'Internal server error', errorId, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
});

async function runTrialExpiry() {
  try {
    const result = await pool.query(`
      UPDATE customers
      SET suspended = true, status = 'suspended', updated_at = NOW()
      WHERE plan = 'trial'
        AND suspended = false
        AND trial_ends_at IS NOT NULL
        AND trial_ends_at < NOW()
      RETURNING id, email, business_name
    `);
    if (result.rows.length > 0) {
      console.log(`[TrialExpiry] Suspended ${result.rows.length} expired trial account(s)`);
      for (const customer of result.rows) {
        try {
          await pool.query(
            `INSERT INTO email_queue (to_email, template_name, template_data, scheduled_at)
             VALUES ($1, $2, $3, NOW())`,
            [customer.email, 'account_suspended', JSON.stringify({ businessName: customer.business_name || 'there', reason: 'Your 7-day free trial has ended. Please upgrade to continue using Its Posting.' })]
          );
        } catch (emailErr) {
          console.error(`[TrialExpiry] Failed to queue email for ${customer.email}:`, emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[TrialExpiry] Error:', err.message);
  }
}

runTrialExpiry();
setInterval(runTrialExpiry, 60 * 60 * 1000);

const scheduler = new AutoPostScheduler(pool);
scheduler.start();

const emailWorker = new EmailWorker(pool);
emailWorker.start();

const suggestionsEngine = new SuggestionsEngine(pool);
cron.schedule('0 8 * * *', async () => {
  console.log('[SuggestionsEngine] 8am daily run starting...');
  await suggestionsEngine.generateForAllCustomers();
});
cron.schedule('5 0 * * *', async () => {
  await suggestionsEngine.cleanupExpired();
});
console.log('💡 SuggestionsEngine cron scheduled (8am daily + midnight cleanup)');

const PostCoreAdvisor = require('./services/PostCoreAdvisor');
const postCoreAdvisor = new PostCoreAdvisor(pool);
cron.schedule('0 7 * * 1', async () => {
  console.log('[cron] Generating PostCore weekly briefings...');
  try {
    const customers = await pool.query(
      `SELECT id FROM customers WHERE status IN ('active','trial') AND (suspended = false OR suspended IS NULL) LIMIT 200`
    );
    let done = 0, fail = 0;
    for (const c of customers.rows) {
      try { await postCoreAdvisor.generateWeeklyBriefing(c.id); done++; }
      catch (e) { fail++; console.error(`[cron] briefing failed for ${c.id}:`, e.message); }
    }
    console.log(`[cron] Briefings: ${done} done, ${fail} failed`);
  } catch (e) { console.error('[cron] Briefings cron error:', e.message); }
});
console.log('📋 PostCoreAdvisor cron scheduled (Monday 7am UTC)');

const dmPollingService = new DMPollingService(pool);
dmPollingService.start();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Its Posting API Server v2.1.0        ║
║                                           ║
║   📊 Port: ${PORT}                            ║
║   🌍 Env: ${(process.env.NODE_ENV || 'development').padEnd(11)}                    ║
║                                           ║
║   Routes: auth, customers, posts,         ║
║           content, social, scraper,       ║
║           upload, billing, media,         ║
║           admin, analytics,               ║
║           suggestions, dms, contacts      ║
║                                           ║
║   Services:                               ║
║   ${process.env.GOOGLE_AI_API_KEY ? '✅' : '⚠️ '} Image One                           ║
║   ${process.env.REPLICATE_API_TOKEN ? '✅' : '⚠️ '} Image Two                           ║
║   ${process.env.HEYGEN_API_KEY ? '✅' : '⚠️ '} Video                               ║
║   ${process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '⚠️ '} Cloudinary                         ║
║   ${process.env.RESEND_API_KEY ? '✅' : '⚠️ '} Email                               ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', async () => { console.log('SIGTERM received, shutting down...'); await pool.end(); process.exit(0); });
process.on('SIGINT', async () => { console.log('\nSIGINT received, shutting down...'); await pool.end(); process.exit(0); });

module.exports = { pool };
