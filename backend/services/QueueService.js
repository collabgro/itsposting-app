/**
 * ItsPosting — BullMQ Queue Service
 * backend/services/QueueService.js
 *
 * Requires Redis: set REDIS_URL env var (Railway Redis service).
 * Gracefully disabled when REDIS_URL is not set.
 */

let Queue, Worker;
try {
  ({ Queue, Worker } = require('bullmq'));
} catch (_) {
  // bullmq not installed yet — will be added when Redis is provisioned
}

const REDIS_URL = process.env.REDIS_URL;

function getConnection() {
  if (!REDIS_URL) return null;
  return { url: REDIS_URL };
}

// ── Queue singletons ──────────────────────────────────────────────────────────

let outboundQueue = null;
let crawlQueue = null;

function getOutboundQueue() {
  if (!Queue || !REDIS_URL) return null;
  if (!outboundQueue) {
    outboundQueue = new Queue('outbound', { connection: getConnection() });
  }
  return outboundQueue;
}

function getCrawlQueue() {
  if (!Queue || !REDIS_URL) return null;
  if (!crawlQueue) {
    crawlQueue = new Queue('crawl', { connection: getConnection() });
  }
  return crawlQueue;
}

// ── Enqueue helpers ───────────────────────────────────────────────────────────

async function enqueueOutbound(jobType, payload, opts = {}) {
  const queue = getOutboundQueue();
  if (!queue) {
    console.warn('[QueueService] Redis not configured — outbound job skipped:', jobType);
    return null;
  }
  const job = await queue.add(jobType, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: 500,
    removeOnFail: 200,
    ...opts,
  });
  return job.id;
}

async function enqueueCrawl(payload, opts = {}) {
  const queue = getCrawlQueue();
  if (!queue) {
    console.warn('[QueueService] Redis not configured — crawl job skipped');
    return null;
  }
  const job = await queue.add('crawl', payload, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    ...opts,
  });
  return job.id;
}

module.exports = { getOutboundQueue, getCrawlQueue, enqueueOutbound, enqueueCrawl, getConnection };
