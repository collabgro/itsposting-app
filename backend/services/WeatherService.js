/**
 * WeatherService — free, no-API-key weather data via Open-Meteo.
 * Caches geocoding (permanent) and forecasts (30-min) in memory.
 * Used by WeatherAlertService to detect actionable weather signals.
 */

const axios = require('axios');

const _geoCache     = new Map(); // city → { lat, lng, name, timezone }  (permanent)
const _weatherCache = new Map(); // city → { data, ts }                   (30-min TTL)
const WEATHER_TTL   = 30 * 60 * 1000;

// WMO weather codes that indicate storms (thunderstorms)
const STORM_CODES = new Set([95, 96, 99]);
// WMO weather codes that indicate snow/sleet
const SNOW_CODES  = new Set([71, 73, 75, 77]);

class WeatherService {
  constructor() {
    this.geoUrl      = 'https://geocoding-api.open-meteo.com/v1/search';
    this.forecastUrl = 'https://api.open-meteo.com/v1/forecast';
  }

  async getCoordinates(city) {
    if (!city) return null;
    const key = city.toLowerCase().trim().replace(/,.*$/, '').trim(); // strip state suffix
    if (_geoCache.has(key)) return _geoCache.get(key);

    try {
      const res = await axios.get(this.geoUrl, {
        params: { name: key, count: 1, language: 'en', format: 'json' },
        timeout: 8000,
      });
      const r = res.data?.results?.[0];
      if (!r) { _geoCache.set(key, null); return null; }
      const coords = { lat: r.latitude, lng: r.longitude, name: r.name, timezone: r.timezone || 'America/New_York' };
      _geoCache.set(key, coords);
      return coords;
    } catch (err) {
      console.warn('[WeatherService] Geocoding failed for', city, ':', err.message);
      return null;
    }
  }

  async getForecast(city) {
    if (!city) return null;
    const cacheKey = city.toLowerCase().trim().replace(/,.*$/, '').trim();
    const cached = _weatherCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < WEATHER_TTL) return cached.data;

    const coords = await this.getCoordinates(city);
    if (!coords) return null;

    try {
      const res = await axios.get(this.forecastUrl, {
        params: {
          latitude:          coords.lat,
          longitude:         coords.lng,
          hourly:            'temperature_2m,precipitation,windspeed_10m,weathercode',
          daily:             'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
          forecast_days:     1,
          temperature_unit:  'fahrenheit',
          windspeed_unit:    'mph',
          precipitation_unit:'inch',
          timezone:          coords.timezone,
        },
        timeout: 10000,
      });
      const data = { ...res.data, _cityName: coords.name, _timezone: coords.timezone };
      _weatherCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    } catch (err) {
      console.warn('[WeatherService] Forecast failed for', city, ':', err.message);
      return null;
    }
  }

  /**
   * Detect actionable weather signals from forecast data.
   * Returns array sorted by severity (critical → high → medium).
   * Empty array = no notable weather → no alert should fire.
   */
  detectSignals(forecast) {
    if (!forecast?.daily) return [];
    const d = forecast.daily;
    const minTemp    = d.temperature_2m_min?.[0];
    const maxTemp    = d.temperature_2m_max?.[0];
    const dailyCode  = d.weathercode?.[0] || 0;
    const totalPrecip = d.precipitation_sum?.[0] || 0;
    const maxWind    = Math.max(...(forecast.hourly?.windspeed_10m || [0]));

    const signals = [];

    // ── Temperature extremes ──────────────────────────────────────────────────
    if (minTemp !== undefined && minTemp < 32) {
      signals.push({
        type:     'freeze',
        icon:     '🧊',
        headline: `Freeze warning — dropping to ${Math.round(minTemp)}°F tonight`,
        detail:   `Low of ${Math.round(minTemp)}°F expected. Pipes, HVAC, and outdoor equipment at risk.`,
        severity: minTemp < 20 ? 'critical' : 'high',
        minTemp:  Math.round(minTemp),
      });
    } else if (minTemp !== undefined && minTemp < 42) {
      signals.push({
        type:     'cold_snap',
        icon:     '🥶',
        headline: `Cold snap — overnight lows near ${Math.round(minTemp)}°F`,
        detail:   `Low of ${Math.round(minTemp)}°F expected overnight.`,
        severity: 'medium',
        minTemp:  Math.round(minTemp),
      });
    }

    if (maxTemp !== undefined && maxTemp > 95) {
      signals.push({
        type:     'heat_wave',
        icon:     '🌡️',
        headline: `Heat wave — highs reaching ${Math.round(maxTemp)}°F`,
        detail:   `High of ${Math.round(maxTemp)}°F expected today. AC systems under strain.`,
        severity: 'high',
        maxTemp:  Math.round(maxTemp),
      });
    }

    // ── Storms & precipitation ────────────────────────────────────────────────
    if (STORM_CODES.has(dailyCode)) {
      signals.push({
        type:     'storm',
        icon:     '⛈️',
        headline: 'Severe thunderstorm warning in your area',
        detail:   'Lightning, strong winds, and heavy rain expected.',
        severity: 'critical',
      });
    } else if (totalPrecip > 0.5) {
      signals.push({
        type:       'heavy_rain',
        icon:       '🌧️',
        headline:   `Heavy rain — ${totalPrecip.toFixed(1)}" of rain today`,
        detail:     `${totalPrecip.toFixed(1)} inches of rain in the forecast. Flooding and drainage issues likely.`,
        severity:   'high',
        precipInch: parseFloat(totalPrecip.toFixed(1)),
      });
    }

    // ── Wind ──────────────────────────────────────────────────────────────────
    if (maxWind > 35) {
      signals.push({
        type:    'high_wind',
        icon:    '💨',
        headline: `High wind advisory — gusts up to ${Math.round(maxWind)} mph`,
        detail:   `Wind gusts up to ${Math.round(maxWind)} mph expected.`,
        severity: 'high',
        maxWind: Math.round(maxWind),
      });
    }

    // ── Snow ─────────────────────────────────────────────────────────────────
    if (SNOW_CODES.has(dailyCode)) {
      signals.push({
        type:     'snow',
        icon:     '❄️',
        headline: 'Snow in the forecast',
        detail:   'Snowfall expected today. Roads, roofs, and outdoor surfaces affected.',
        severity: 'high',
      });
    }

    const order = { critical: 0, high: 1, medium: 2 };
    return signals.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }

  /**
   * Check if a given weather signal type is relevant for a specific industry.
   * Returns false → skip alert for this customer.
   */
  isRelevantForIndustry(signalType, industry) {
    const map = {
      freeze:     ['plumbing', 'hvac', 'painting', 'concrete', 'landscaping', 'roofing', 'pest_control', 'general_contractor'],
      cold_snap:  ['plumbing', 'hvac', 'roofing', 'landscaping', 'painting', 'general_contractor'],
      heat_wave:  ['hvac', 'pest_control', 'landscaping', 'painting', 'roofing', 'concrete'],
      storm:      ['roofing', 'electrical', 'general_contractor', 'landscaping', 'gutter_cleaning', 'concrete'],
      heavy_rain: ['roofing', 'concrete', 'landscaping', 'general_contractor', 'gutter_cleaning', 'cleaning'],
      high_wind:  ['roofing', 'landscaping', 'general_contractor', 'electrical'],
      snow:       ['concrete', 'landscaping', 'roofing', 'plumbing', 'hvac', 'general_contractor'],
    };
    const relevantIndustries = map[signalType] || [];
    return relevantIndustries.includes(industry);
  }
}

module.exports = WeatherService;
