/**
 * ItsPosting — Timezone Utilities
 * backend/utils/timezone.js
 *
 * CLAUDE.md specifies: "Timezone: Luxon (backend)"
 *
 * Rules from CLAUDE.md:
 *   - Store: UTC always in database
 *   - Convert local→UTC: DateTime.fromISO(date, { zone: tz }).toUTC()
 *   - Convert UTC→local: Intl.DateTimeFormat on frontend
 *   - Auto-detect: Intl.DateTimeFormat().resolvedOptions().timeZone
 *
 * All functions are pure — no side effects, no DB calls.
 * Import { DateTime } from 'luxon' — always use named import.
 */

'use strict';

const { DateTime } = require('luxon');

// ─── IANA timezone list for the UI picker ────────────────────────────────────
const COMMON_TIMEZONES = [
  // United States
  { value: 'America/New_York',    label: 'Eastern Time (ET)',   offset: 'UTC-5/4'  },
  { value: 'America/Chicago',     label: 'Central Time (CT)',   offset: 'UTC-6/5'  },
  { value: 'America/Denver',      label: 'Mountain Time (MT)',  offset: 'UTC-7/6'  },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)',   offset: 'UTC-8/7'  },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)',    offset: 'UTC-7'    },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)',   offset: 'UTC-9/8'  },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)',    offset: 'UTC-10'   },
  // Pakistan
  { value: 'Asia/Karachi',        label: 'Pakistan Standard',   offset: 'UTC+5'    },
  // Common international
  { value: 'Europe/London',       label: 'London (GMT/BST)',    offset: 'UTC+0/1'  },
  { value: 'Europe/Paris',        label: 'Central European',    offset: 'UTC+1/2'  },
  { value: 'Asia/Dubai',          label: 'Gulf Standard',       offset: 'UTC+4'    },
  { value: 'Asia/Kolkata',        label: 'India Standard',      offset: 'UTC+5:30' },
  { value: 'Asia/Singapore',      label: 'Singapore',           offset: 'UTC+8'    },
  { value: 'Australia/Sydney',    label: 'Australian Eastern',  offset: 'UTC+10/11'},
  { value: 'UTC',                 label: 'UTC',                 offset: 'UTC+0'    },
];

// ─── Core conversion functions ────────────────────────────────────────────────

function localToUTC(localDateStr, timezone = 'UTC') {
  if (!localDateStr) return null;
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const dt = DateTime.fromISO(localDateStr, { zone: tz });
  if (!dt.isValid) throw new Error(`[timezone] Invalid date string: "${localDateStr}" (${dt.invalidReason})`);
  return dt.toUTC().toJSDate();
}

function utcToLocal(utcDate, timezone = 'UTC') {
  if (!utcDate) return null;
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const dt = DateTime.fromJSDate(utcDate instanceof Date ? utcDate : new Date(utcDate), { zone: 'UTC' });
  return dt.setZone(tz);
}

function formatForDisplay(utcDate, timezone = 'UTC', fmt = "MMM d, yyyy 'at' h:mm a ZZZZ") {
  const local = utcToLocal(utcDate, timezone);
  if (!local) return '';
  return local.toFormat(fmt);
}

function nowInZone(timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  return DateTime.now().setZone(tz);
}

function currentHourInZone(timezone = 'UTC') {
  return nowInZone(timezone).hour;
}

function isMorningWindow(timezone = 'UTC') {
  const now = nowInZone(timezone);
  return now.hour === 8 && now.minute < 30;
}

function startOfTodayUTC(timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  return DateTime.now().setZone(tz).startOf('day').toUTC().toJSDate();
}

function endOfTodayUTC(timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  return DateTime.now().setZone(tz).endOf('day').toUTC().toJSDate();
}

function nextSlotUTC(hour, minute = 0, timezone = 'UTC') {
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';
  const now = DateTime.now().setZone(tz);
  let slot = now.set({ hour, minute, second: 0, millisecond: 0 });
  if (slot <= now) slot = slot.plus({ days: 1 });
  return slot.toUTC().toJSDate();
}

function friendlyScheduleDesc(utcDate, timezone = 'UTC') {
  if (!utcDate) return 'unknown time';
  const local = utcToLocal(utcDate, timezone);
  const now = nowInZone(timezone);
  const diffDays = local.startOf('day').diff(now.startOf('day'), 'days').days;
  const timeStr = local.toFormat('h:mm a');
  const hour = local.hour;
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  if (diffDays === 0) return `today ${period} at ${timeStr}`;
  if (diffDays === 1) return `tomorrow ${period} at ${timeStr}`;
  if (diffDays === -1) return `yesterday at ${timeStr}`;
  if (diffDays > 1 && diffDays < 7) return `${local.toFormat('EEEE')} at ${timeStr}`;
  return local.toFormat("MMM d 'at' h:mm a");
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    return DateTime.now().setZone(tz).isValid;
  } catch {
    return false;
  }
}

function safeTimezone(tz, fallback = 'UTC') {
  return isValidTimezone(tz) ? tz : fallback;
}

// ─── Best time to post ────────────────────────────────────────────────────────

function bestTimeToPostUTC(period, timezone = 'UTC') {
  const hours = { morning: 8, afternoon: 13, evening: 18 };
  const hour = hours[period] || 9;
  return nextSlotUTC(hour, 0, timezone);
}

// ─── Prompt 4.3 API aliases ───────────────────────────────────────────────────

function convertToUTC(localDateString, timezone = 'UTC') {
  const date = localToUTC(localDateString, timezone);
  return date ? date.toISOString() : null;
}

function convertFromUTC(utcDateString, timezone = 'UTC') {
  const local = utcToLocal(utcDateString, timezone);
  return local ? local.toISO() : null;
}

function getCurrentTimeInZone(timezone = 'UTC') {
  return nowInZone(timezone).toISO();
}

module.exports = {
  convertToUTC,
  convertFromUTC,
  getCurrentTimeInZone,
  isValidTimezone,
  localToUTC,
  utcToLocal,
  formatForDisplay,
  nowInZone,
  currentHourInZone,
  isMorningWindow,
  startOfTodayUTC,
  endOfTodayUTC,
  nextSlotUTC,
  bestTimeToPostUTC,
  friendlyScheduleDesc,
  safeTimezone,
  COMMON_TIMEZONES,
  DateTime,
};
