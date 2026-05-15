/**
 * ItsPosting — Cal.com Booking Service
 * backend/services/CalComService.js
 *
 * Uses Cal.com v1 API to fetch availability and create bookings.
 * Docs: https://cal.com/docs/api-reference/v1
 */

const axios = require('axios');

const CALCOM_BASE = 'https://api.cal.com/v1';

class CalComService {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
  }

  isConfigured() {
    return !!this.apiKey;
  }

  // Fetch available slots for the next `days` days for a username
  async getAvailability(username, days = 3) {
    if (!this.isConfigured()) throw new Error('Cal.com not configured');

    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + days);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = end.toISOString().split('T')[0];

    const response = await axios.get(`${CALCOM_BASE}/availability`, {
      params: {
        apiKey: this.apiKey,
        username,
        dateFrom,
        dateTo,
      },
      timeout: 10000,
    });

    return response.data;
  }

  // Format raw availability into human-readable slot list
  formatSlots(availability, maxSlots = 4) {
    const slots = [];
    const days = availability?.busy ? this._invertBusy(availability) : (availability?.slots || []);

    for (const slot of days.slice(0, maxSlots)) {
      const dt = new Date(slot.time || slot);
      const label = dt.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      slots.push({ label, value: dt.toISOString() });
    }
    return slots;
  }

  _invertBusy(availability) {
    // Simplified: just return date ranges from dateRanges if present
    const ranges = availability?.dateRanges || [];
    const slots = [];
    for (const range of ranges) {
      const start = new Date(range.start);
      // Generate hourly slots within each free range
      const end = new Date(range.end);
      const current = new Date(start);
      while (current < end && slots.length < 6) {
        slots.push({ time: current.toISOString() });
        current.setHours(current.getHours() + 1);
      }
    }
    return slots;
  }

  // Create a booking via Cal.com API
  async createBooking(username, details) {
    if (!this.isConfigured()) throw new Error('Cal.com not configured');
    const { name, email, phone, startTime, notes } = details;

    const response = await axios.post(`${CALCOM_BASE}/bookings`, {
      apiKey: this.apiKey,
      eventTypeId: details.eventTypeId,
      start: startTime,
      responses: {
        name,
        email,
        phone: phone || '',
        notes: notes || '',
      },
      timeZone: details.timeZone || 'UTC',
      language: 'en',
    }, { timeout: 15000 });

    return response.data;
  }

  // Get event types for a username (to find the right event type ID)
  async getEventTypes(username) {
    if (!this.isConfigured()) throw new Error('Cal.com not configured');
    const response = await axios.get(`${CALCOM_BASE}/event-types`, {
      params: { apiKey: this.apiKey, username },
      timeout: 10000,
    });
    return response.data?.event_types || [];
  }
}

module.exports = CalComService;
