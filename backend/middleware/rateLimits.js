const rateLimit = require('express-rate-limit');

// AI generation endpoints — 10 per minute (1 credit = 1 AI call, abuse prevention)
const AI_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — please wait a minute before trying again.' },
  keyGenerator: (req) => req.customerId || req.ip,
});

// File upload endpoints — 20 per minute
const UPLOAD_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads — please slow down.' },
  keyGenerator: (req) => req.customerId || req.ip,
});

// Auth endpoints — 5 per minute (brute-force protection)
const AUTH_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — wait a minute before trying again.' },
});

// Password reset — 3 per 15 minutes (prevent email flooding)
const RESET_LIMIT = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests — please wait 15 minutes.' },
});

// Social post — 30 per hour per account (platform TOS protection)
const POST_LIMIT = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly post limit reached — please try again later.' },
  keyGenerator: (req) => req.customerId || req.ip,
});

// GEO audit — 5 per hour (expensive operation)
const GEO_LIMIT = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI Visibility checks — wait an hour before running another.' },
  keyGenerator: (req) => req.customerId || req.ip,
});

// Admin broadcast — 3 per day (prevent spam)
const BROADCAST_LIMIT = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Broadcast limit reached for today.' },
});

// Email invite — 10 per hour
const INVITE_LIMIT = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many invites sent — wait an hour.' },
  keyGenerator: (req) => req.customerId || req.ip,
});

module.exports = {
  AI_LIMIT,
  UPLOAD_LIMIT,
  AUTH_LIMIT,
  RESET_LIMIT,
  POST_LIMIT,
  GEO_LIMIT,
  BROADCAST_LIMIT,
  INVITE_LIMIT,
};
