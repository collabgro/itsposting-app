'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Plan-based crawl limits
const PLAN_MAX_PAGES = { trial: 5, starter: 5, professional: 50, premium: 9999 };
const PLAN_ALLOWED_MODES = { trial: ['exact'], starter: ['exact'], professional: ['exact', 'path', 'domain'], premium: ['exact', 'path', 'domain'] };

const URL_FILTERS = {
  exact:  (discovered, seed) => discovered === seed,
  path:   (discovered, seed) => {
    try {
      const s = new URL(seed);
      const d = new URL(discovered);
      return d.origin === s.origin && d.pathname.startsWith(s.pathname);
    } catch { return false; }
  },
  domain: (discovered, seed) => {
    try { return new URL(discovered).hostname === new URL(seed).hostname; }
    catch { return false; }
  },
};

// Selectors that should never be clicked (checkout, forms, login)
const SAFE_CLICK_BLACKLIST = [
  'form', 'button[type="submit"]', 'input[type="submit"]',
  '[class*="cart"]', '[class*="checkout"]', '[class*="login"]',
  '[class*="signup"]', '[id*="cart"]', '[id*="checkout"]',
  'a[href*="cart"]', 'a[href*="checkout"]', 'a[href*="login"]',
];

class CrawlerService {
  constructor(pool) {
    this.pool = pool;
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  // ── Public entry point ───────────────────────────────────────────
  async crawl(customerId, url, mode, plan = 'starter') {
    const allowedModes = PLAN_ALLOWED_MODES[plan] || PLAN_ALLOWED_MODES.starter;
    if (!allowedModes.includes(mode)) {
      throw new Error(`Crawl mode '${mode}' is not available on the ${plan} plan. Upgrade to Pro or Premium.`);
    }

    const normalizedUrl = this._normalizeUrl(url);
    const { rows: [job] } = await this.pool.query(
      `INSERT INTO crawl_jobs (customer_id, url, mode, status, started_at, created_at)
       VALUES ($1, $2, $3, 'running', NOW(), NOW()) RETURNING id`,
      [customerId, normalizedUrl, mode]
    );
    const jobId = job.id;

    // Run async — don't await
    this._runCrawl(jobId, customerId, normalizedUrl, mode, plan).catch(err => {
      console.error(`[CrawlerService] Job ${jobId} failed:`, err.message);
      this.pool.query(
        `UPDATE crawl_jobs SET status='failed', error=$1, completed_at=NOW() WHERE id=$2`,
        [err.message, jobId]
      ).catch(() => {});
    });

    return jobId;
  }

  // ── Get job status ───────────────────────────────────────────────
  async getJob(jobId, customerId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM crawl_jobs WHERE id=$1 AND customer_id=$2`,
      [jobId, customerId]
    );
    return rows[0] || null;
  }

  // ── Import selected pages into business_knowledge ────────────────
  async importPages(jobId, customerId, selectedUrls) {
    const { rows: [job] } = await this.pool.query(
      `SELECT result_summary FROM crawl_jobs WHERE id=$1 AND customer_id=$2 AND status='done'`,
      [jobId, customerId]
    );
    if (!job) throw new Error('Crawl job not found or not complete');

    const summary = job.result_summary || {};
    const pages = (summary.pages || []).filter(p => selectedUrls.includes(p.url) && p.extracted);

    if (!pages.length) throw new Error('No valid pages selected for import');

    // Merge all extracted content
    const allContent = {
      services: [],
      faqs: [],
      hours: null,
      pricing: [],
      contact: {},
      certifications: [],
      about: '',
      testimonials: [],
    };

    for (const page of pages) {
      const e = page.extracted || {};
      if (e.services) allContent.services.push(...e.services);
      if (e.faqs) allContent.faqs.push(...e.faqs);
      if (e.hours && !allContent.hours) allContent.hours = e.hours;
      if (e.pricing) allContent.pricing.push(...e.pricing);
      if (e.contact) Object.assign(allContent.contact, e.contact);
      if (e.certifications) allContent.certifications.push(...e.certifications);
      if (e.about) allContent.about += ' ' + e.about;
      if (e.testimonials) allContent.testimonials.push(...e.testimonials);
    }

    // Deduplicate services
    allContent.services = [...new Set(allContent.services.map(s => s?.trim()).filter(Boolean))];
    allContent.certifications = [...new Set(allContent.certifications.map(s => s?.trim()).filter(Boolean))];

    return allContent;
  }

  // ── Internal: run the full crawl ────────────────────────────────
  async _runCrawl(jobId, customerId, seedUrl, mode, plan) {
    const maxPages = PLAN_MAX_PAGES[plan] || 5;
    let browser;

    try {
      const { chromium } = require('playwright-chromium');
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

      // Step 1: discover URLs
      const urls = await this._discoverUrls(browser, seedUrl, mode, maxPages);
      await this.pool.query(
        `UPDATE crawl_jobs SET pages_found=$1 WHERE id=$2`,
        [urls.length, jobId]
      );

      // Step 2: crawl each page
      const pages = [];
      for (const url of urls) {
        try {
          const extracted = await this._extractPage(browser, url);
          pages.push({ url, title: extracted.title || url, status: 'ok', extracted });
        } catch (err) {
          pages.push({ url, title: url, status: 'failed', error: err.message });
        }
        await this.pool.query(
          `UPDATE crawl_jobs SET pages_crawled=$1 WHERE id=$2`,
          [pages.length, jobId]
        );
      }

      const done = pages.filter(p => p.status === 'ok').length;
      const failed = pages.filter(p => p.status !== 'ok').length;

      await this.pool.query(
        `UPDATE crawl_jobs SET status='done', pages_crawled=$1, pages_failed=$2,
         result_summary=$3, completed_at=NOW() WHERE id=$4`,
        [done, failed, JSON.stringify({ pages }), jobId]
      );
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // ── URL Discovery ────────────────────────────────────────────────
  async _discoverUrls(browser, seedUrl, mode, maxPages) {
    const discovered = new Set();
    const toVisit = [seedUrl];
    const visited = new Set();

    const filter = URL_FILTERS[mode] || URL_FILTERS.domain;

    // Also try sitemap.xml
    const sitemapUrls = await this._parseSitemap(seedUrl);
    for (const u of sitemapUrls) {
      if (filter(u, seedUrl)) toVisit.push(u);
    }

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': 'ItsPosting-Crawler/1.0 (itsposting.com)' });

    while (toVisit.length > 0 && discovered.size < maxPages) {
      const url = toVisit.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      if (!filter(url, seedUrl)) continue;
      discovered.add(url);

      // Extract links from page (only for path/domain modes, to find more pages)
      if (mode !== 'exact' && discovered.size < maxPages) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const links = await page.$$eval('a[href]', (anchors) =>
            anchors.map(a => a.href).filter(h => h.startsWith('http'))
          );
          for (const link of links) {
            const clean = link.split('#')[0].split('?')[0];
            if (!visited.has(clean) && !toVisit.includes(clean)) {
              toVisit.push(clean);
            }
          }
        } catch { /* ignore navigation errors */ }
      }
    }

    await page.close().catch(() => {});
    return [...discovered].slice(0, maxPages);
  }

  // ── Sitemap parser ───────────────────────────────────────────────
  async _parseSitemap(seedUrl) {
    const axios = require('axios');
    const urls = [];
    try {
      const base = new URL(seedUrl).origin;
      const resp = await axios.get(`${base}/sitemap.xml`, { timeout: 8000, headers: { 'User-Agent': 'ItsPosting-Crawler/1.0' } });
      const matches = resp.data.match(/<loc>([^<]+)<\/loc>/g) || [];
      for (const m of matches) {
        const url = m.replace(/<\/?loc>/g, '').trim();
        if (url.startsWith('http')) urls.push(url);
      }
    } catch { /* sitemap not found — fine */ }
    return urls;
  }

  // ── Page content extraction ──────────────────────────────────────
  async _extractPage(browser, url) {
    const page = await browser.newPage();
    try {
      await page.setExtraHTTPHeaders({ 'User-Agent': 'ItsPosting-Crawler/1.0 (itsposting.com)' });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

      // Safely expand accordions, tabs (avoid checkout/login/form clicks)
      await this._safeExpand(page);

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body?.innerText || '');

      // Run 8 extraction strategies in parallel
      const [services, pricing, hours, faqs, contact, testimonials, certifications, about] =
        await Promise.all([
          this._extractServices(page, bodyText),
          this._extractPricing(bodyText),
          this._extractHours(bodyText),
          this._extractFaqs(page, bodyText),
          this._extractContact(bodyText),
          this._extractTestimonials(page, bodyText),
          this._extractCertifications(bodyText),
          this._extractAbout(page, bodyText),
        ]);

      return { title, url, services, pricing, hours, faqs, contact, testimonials, certifications, about };
    } finally {
      await page.close().catch(() => {});
    }
  }

  // ── Safe expand (accordions + tabs) ─────────────────────────────
  async _safeExpand(page) {
    try {
      const blacklist = SAFE_CLICK_BLACKLIST.join(',');
      await page.evaluate((blacklist) => {
        const safe = (el) => !el.closest(blacklist);
        // Click closed accordions
        document.querySelectorAll('[class*="accordion"],[class*="collapse"],[aria-expanded="false"]')
          .forEach(el => { if (safe(el)) { try { el.click(); } catch {} } });
        // Click tabs (not in forms)
        document.querySelectorAll('[role="tab"],[class*="tab-"]')
          .forEach(el => { if (safe(el)) { try { el.click(); } catch {} } });
      }, blacklist);
      await page.waitForTimeout(500);
    } catch { /* non-fatal */ }
  }

  // ── Extraction strategies ────────────────────────────────────────
  async _extractServices(page, text) {
    const services = new Set();
    // DOM: look for services sections
    try {
      const domServices = await page.$$eval(
        '[class*="service"],[id*="service"],[class*="Service"],[id*="Service"]',
        els => els.slice(0, 20).map(el => el.innerText?.split('\n')[0]?.trim()).filter(s => s && s.length < 100)
      );
      domServices.forEach(s => services.add(s));
    } catch {}
    // Text regex for "we offer / services include" patterns
    const patterns = [
      /(?:services?|we offer|we provide|our work)[:\s]+([^\n.]+)/gi,
      /(?:✓|•|–|-)\s*([A-Z][^\n]{5,60})/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const s = m[1]?.trim();
        if (s && s.length > 5 && s.length < 80) services.add(s);
        if (services.size >= 20) break;
      }
    }
    return [...services].slice(0, 20);
  }

  _extractPricing(text) {
    const items = [];
    const re = /([A-Za-z ]{5,40})[:\s]+(\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*\/\s*\w+)?)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      items.push({ service: m[1].trim(), price: m[2].trim() });
      if (items.length >= 15) break;
    }
    return items;
  }

  _extractHours(text) {
    const re = /(?:hours?|open)[:\s]+([^\n]{10,80})/gi;
    const m = re.exec(text);
    return m ? m[1].trim() : null;
  }

  async _extractFaqs(page, text) {
    const faqs = [];
    try {
      const domFaqs = await page.$$eval(
        '[class*="faq"],[id*="faq"],[itemtype*="FAQPage"] [itemprop="name"],[itemtype*="FAQPage"] [itemprop="text"]',
        els => {
          const results = [];
          for (let i = 0; i < els.length - 1; i += 2) {
            const q = els[i]?.innerText?.trim();
            const a = els[i + 1]?.innerText?.trim();
            if (q && a) results.push({ q, a });
          }
          return results.slice(0, 10);
        }
      );
      faqs.push(...domFaqs);
    } catch {}
    if (!faqs.length) {
      const re = /(?:Q:|Question:)\s*([^\n?]+\?)\s*(?:A:|Answer:)\s*([^\n]{10,300})/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        faqs.push({ q: m[1].trim(), a: m[2].trim() });
        if (faqs.length >= 10) break;
      }
    }
    return faqs;
  }

  _extractContact(text) {
    const contact = {};
    const phone = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
    if (phone) contact.phone = phone[0].trim();
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (email) contact.email = email[0].trim();
    return contact;
  }

  async _extractTestimonials(page, text) {
    const testimonials = [];
    try {
      const domT = await page.$$eval(
        'blockquote,[class*="testimonial"],[class*="review"],[class*="quote"]',
        els => els.slice(0, 5).map(el => el.innerText?.trim()).filter(t => t && t.length > 20)
      );
      testimonials.push(...domT);
    } catch {}
    return testimonials.slice(0, 5);
  }

  _extractCertifications(text) {
    const certs = [];
    const re = /(?:certified|licensed|insured|member|accredited)[^\n.,]{0,60}/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      certs.push(m[0].trim());
      if (certs.length >= 8) break;
    }
    return [...new Set(certs)];
  }

  async _extractAbout(page, text) {
    try {
      const about = await page.$eval(
        '[class*="about"],[id*="about"],[class*="mission"],[class*="story"]',
        el => el.innerText?.trim().substring(0, 500)
      );
      if (about) return about;
    } catch {}
    const re = /(?:about us|who we are|our story)[:\s]+([^\n]{20,400})/i;
    const m = re.exec(text);
    return m ? m[1].trim() : text.substring(0, 300).trim();
  }

  _normalizeUrl(url) {
    if (!url.startsWith('http')) url = 'https://' + url;
    return url.split('#')[0].replace(/\/$/, '');
  }
}

module.exports = CrawlerService;
