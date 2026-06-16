'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const dns     = require('dns').promises;
const net     = require('net');

// ── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_MAX_PAGES = {
  trial:        10,
  starter:      15,
  professional: 100,
  premium:      500,
};
const PLAN_ALLOWED_MODES = {
  trial:        ['exact'],
  starter:      ['exact', 'path'],
  professional: ['exact', 'path', 'domain'],
  premium:      ['exact', 'path', 'domain'],
};

// ── URL filter functions ─────────────────────────────────────────────────────
const URL_FILTERS = {
  exact:  (d, s) => d === s,
  path:   (d, s) => {
    try {
      const S = new URL(s); const D = new URL(d);
      return D.origin === S.origin && D.pathname.startsWith(S.pathname);
    } catch { return false; }
  },
  domain: (d, s) => {
    try { return new URL(d).hostname === new URL(s).hostname; } catch { return false; }
  },
};

// Real Chrome user agents — rotated per request to avoid bot detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// Selectors that should never be clicked (checkout, forms, auth)
const SAFE_CLICK_BLACKLIST = [
  'form', 'button[type="submit"]', 'input[type="submit"]',
  '[class*="cart"]', '[class*="checkout"]', '[class*="login"]',
  '[class*="signup"]', '[id*="cart"]', '[id*="checkout"]',
  'a[href*="cart"]', 'a[href*="checkout"]', 'a[href*="login"]',
];

class CrawlerService {
  constructor(pool) {
    this.pool = pool;
  }

  // ── SSRF protection ──────────────────────────────────────────────────────
  // Validates the *resolved IP*, not the hostname string — a string-only
  // blocklist (the previous implementation here) is bypassed trivially by a
  // customer-controlled domain whose DNS record points straight at
  // 169.254.169.254 or an internal service. This matters even more here than
  // in ScraperService because crawl() drives a real headless Chromium browser
  // (Playwright) against the URL, which has its own network stack.
  _isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split('.').map(Number);
      return (
        a === 127 ||
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a === 0
      );
    }
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1') return true;
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
      if (/^fe[89ab]/.test(lower)) return true;
      const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this._isPrivateIp(mapped[1]);
      return false;
    }
    return true; // unparseable — fail closed
  }

  _isPrivateHostname(hostname) {
    const blockedNames = ['localhost', 'metadata.google.internal', 'instance-data.ec2.internal'];
    return blockedNames.includes(hostname.toLowerCase());
  }

  async _assertHostIsSafe(hostname) {
    if (this._isPrivateHostname(hostname)) {
      throw new Error('URL resolves to a private or reserved address');
    }
    let records;
    try {
      records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch (e) {
      throw new Error(`Could not resolve host: ${hostname}`);
    }
    if (!records.length || records.some(r => this._isPrivateIp(r.address))) {
      throw new Error('URL resolves to a private or reserved address');
    }
  }

  _normalizeUrl(url) {
    if (!url.startsWith('http')) url = 'https://' + url;
    return url.split('#')[0].replace(/\/$/, '');
  }

  _randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  // ── Public entry point ───────────────────────────────────────────────────
  async crawl(customerId, url, mode, plan = 'starter') {
    const allowedModes = PLAN_ALLOWED_MODES[plan] || PLAN_ALLOWED_MODES.starter;
    if (!allowedModes.includes(mode)) {
      throw new Error(`Crawl mode '${mode}' is not available on the ${plan} plan. Upgrade to Pro or Premium.`);
    }

    const normalizedUrl = this._normalizeUrl(url);
    try {
      const { hostname } = new URL(normalizedUrl);
      await this._assertHostIsSafe(hostname);
    } catch (e) {
      if (e.message.includes('private or reserved')) throw e;
      throw new Error('Invalid URL');
    }

    const { rows: [job] } = await this.pool.query(
      `INSERT INTO crawl_jobs (customer_id, url, mode, status, started_at, created_at)
       VALUES ($1, $2, $3, 'running', NOW(), NOW()) RETURNING id`,
      [customerId, normalizedUrl, mode]
    );
    const jobId = job.id;

    // Run async — don't await, update DB on completion/failure
    this._runCrawl(jobId, normalizedUrl, mode, plan).catch(err => {
      console.error(`[CrawlerService] Job ${jobId} fatal error:`, err.message);
      this.pool.query(
        `UPDATE crawl_jobs SET status='failed', error=$1, completed_at=NOW() WHERE id=$2`,
        [err.message, jobId]
      ).catch(() => {});
    });

    return jobId;
  }

  // ── Get job status ───────────────────────────────────────────────────────
  async getJob(jobId, customerId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM crawl_jobs WHERE id=$1 AND customer_id=$2`,
      [jobId, customerId]
    );
    return rows[0] || null;
  }

  // ── Re-crawl an existing job (for auto-refresh) ──────────────────────────
  async recrawl(jobId) {
    const { rows: [job] } = await this.pool.query(
      `SELECT * FROM crawl_jobs WHERE id=$1`, [jobId]
    );
    if (!job) throw new Error('Job not found');

    await this.pool.query(
      `UPDATE crawl_jobs SET status='running', started_at=NOW(), pages_found=0,
       pages_crawled=0, pages_failed=0, error=NULL WHERE id=$1`,
      [jobId]
    );

    this._runCrawl(jobId, job.url, job.mode, 'professional').catch(err => {
      console.error(`[CrawlerService] Recrawl ${jobId} failed:`, err.message);
      this.pool.query(
        `UPDATE crawl_jobs SET status='failed', error=$1, completed_at=NOW() WHERE id=$2`,
        [err.message, jobId]
      ).catch(() => {});
    });
  }

  // ── Import selected pages into business_knowledge ────────────────────────
  async importPages(jobId, customerId, selectedUrls) {
    const { rows: [job] } = await this.pool.query(
      `SELECT result_summary FROM crawl_jobs WHERE id=$1 AND customer_id=$2 AND status='done'`,
      [jobId, customerId]
    );
    if (!job) throw new Error('Crawl job not found or not complete');

    const summary = job.result_summary || {};
    const pages = (summary.pages || []).filter(p => selectedUrls.includes(p.url) && p.extracted);
    if (!pages.length) throw new Error('No valid pages selected for import');

    const all = {
      services: [], faqs: [], hours: null, pricing: [],
      contact: {}, certifications: [], about: '', testimonials: [],
    };

    for (const page of pages) {
      const e = page.extracted || {};
      if (e.services)       all.services.push(...e.services);
      if (e.faqs)           all.faqs.push(...e.faqs);
      if (e.hours && !all.hours) all.hours = e.hours;
      if (e.pricing)        all.pricing.push(...e.pricing);
      if (e.contact)        Object.assign(all.contact, e.contact);
      if (e.certifications) all.certifications.push(...e.certifications);
      if (e.about)          all.about += ' ' + e.about;
      if (e.testimonials)   all.testimonials.push(...e.testimonials);
    }

    all.services       = [...new Set(all.services.map(s => s?.trim()).filter(Boolean))];
    all.certifications = [...new Set(all.certifications.map(s => s?.trim()).filter(Boolean))];
    all.about          = all.about.trim().substring(0, 800);
    return all;
  }

  // ── Core crawl runner ────────────────────────────────────────────────────
  async _runCrawl(jobId, seedUrl, mode, plan) {
    const maxPages = PLAN_MAX_PAGES[plan] || 15;

    // Re-validate here too — recrawl() reaches this method directly without
    // going through crawl()'s check, and DNS can change between the original
    // crawl and a later recrawl (rebinding window).
    await this._assertHostIsSafe(new URL(seedUrl).hostname);

    // Try to launch ONE Playwright browser for the whole crawl
    // Falls back to null → Cheerio-only mode
    let browser = null;
    try {
      browser = await this._launchBrowser();
      console.log(`[CrawlerService] Job ${jobId}: using Playwright (Chromium)`);
    } catch (err) {
      console.warn(`[CrawlerService] Job ${jobId}: Playwright unavailable (${err.message}), using Cheerio fallback`);
    }

    try {
      // Step 1: discover URLs
      const urls = await this._discoverUrls(seedUrl, mode, maxPages, browser);
      await this.pool.query(`UPDATE crawl_jobs SET pages_found=$1 WHERE id=$2`, [urls.length, jobId]);

      // Step 2: extract each page
      const pages = [];
      for (const url of urls) {
        try {
          const extracted = await this._extractPage(url, browser);
          pages.push({ url, title: extracted.title || url, status: 'ok', extracted });
        } catch (err) {
          console.warn(`[CrawlerService] Failed ${url}: ${err.message}`);
          pages.push({ url, title: url, status: 'failed', error: err.message });
        }
        await this.pool.query(
          `UPDATE crawl_jobs SET pages_crawled=$1 WHERE id=$2`, [pages.length, jobId]
        );
      }

      const done   = pages.filter(p => p.status === 'ok').length;
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

  // ── Launch Playwright browser ────────────────────────────────────────────
  async _launchBrowser() {
    const { chromium } = require('playwright-chromium');
    return chromium.launch({
      headless: true,
      // Use system Chromium if CHROMIUM_PATH is set (Railway Dockerfile)
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',     // prevents crashes in Docker low-shm envs
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--mute-audio',
        '--disable-features=TranslateUI',
      ],
    });
  }

  // ── URL discovery ────────────────────────────────────────────────────────
  async _discoverUrls(seedUrl, mode, maxPages, browser) {
    if (mode === 'exact') return [seedUrl];

    const discovered = new Set([seedUrl]);
    const filter = URL_FILTERS[mode] || URL_FILTERS.domain;

    // Try sitemap.xml first — free URL discovery without JS rendering
    const sitemapUrls = await this._parseSitemap(seedUrl);
    for (const u of sitemapUrls) {
      if (discovered.size >= maxPages) break;
      if (filter(u, seedUrl)) discovered.add(u);
    }

    if (discovered.size >= maxPages) return [...discovered].slice(0, maxPages);

    // Parse links from homepage HTML
    try {
      const { html } = await this._fetchCheerio(seedUrl);
      const $ = cheerio.load(html);
      $('a[href]').each((_, el) => {
        if (discovered.size >= maxPages) return false;
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const abs = new URL(href, seedUrl).href.split('#')[0].split('?')[0];
          if (filter(abs, seedUrl) && !abs.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|ico|woff|woff2|ttf)$/i)) {
            discovered.add(abs);
          }
        } catch {}
      });
    } catch {}

    return [...discovered].slice(0, maxPages);
  }

  // axios's automatic redirect-following (the old maxRedirects: 5 here and in
  // _fetchCheerio) never re-checks the destination host — a "safe" public URL
  // can 3xx straight to an internal target. maxRedirects is disabled and
  // redirects are followed manually, re-validating the resolved IP each hop.
  async _safeAxiosGet(url, opts = {}, redirectsLeft = 5) {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new Error('Invalid URL. Must start with http:// or https://');
    }
    await this._assertHostIsSafe(urlObj.hostname);

    const resp = await axios.get(url, { ...opts, maxRedirects: 0, validateStatus: s => s < 500 });

    if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
      if (redirectsLeft <= 0) throw new Error('Too many redirects');
      const nextUrl = new URL(resp.headers.location, url).href;
      return this._safeAxiosGet(nextUrl, opts, redirectsLeft - 1);
    }
    return resp;
  }

  async _parseSitemap(seedUrl) {
    const urls = [];
    try {
      const base = new URL(seedUrl).origin;
      const resp = await this._safeAxiosGet(`${base}/sitemap.xml`, {
        timeout: 8000,
        headers: { 'User-Agent': this._randomUA() },
      });
      const matches = resp.data.match(/<loc>([^<]+)<\/loc>/g) || [];
      for (const m of matches) {
        const url = m.replace(/<\/?loc>/g, '').trim();
        if (url.startsWith('http')) urls.push(url);
        if (urls.length >= 200) break;
      }
    } catch {}
    return urls;
  }

  // ── Page extraction orchestrator ─────────────────────────────────────────
  async _extractPage(url, browser) {
    let html, bodyText, method;

    if (browser) {
      try {
        ({ html, bodyText, method } = await this._fetchPlaywright(url, browser));
      } catch (err) {
        console.warn(`[CrawlerService] Playwright page failed for ${url}: ${err.message} — using Cheerio`);
        ({ html, bodyText, method } = await this._fetchCheerio(url));
      }
    } else {
      ({ html, bodyText, method } = await this._fetchCheerio(url));
    }

    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || url;

    return {
      title,
      url,
      method,
      services:       this._extractServices($, bodyText),
      pricing:        this._extractPricing($, bodyText),
      hours:          this._extractHours($, bodyText),
      faqs:           this._extractFaqs($, bodyText),
      contact:        this._extractContact($, bodyText),
      testimonials:   this._extractTestimonials($),
      certifications: this._extractCertifications($, bodyText),
      about:          this._extractAbout($, bodyText),
    };
  }

  // ── Playwright fetch (JS rendering, stealth) ─────────────────────────────
  async _fetchPlaywright(url, browser) {
    await this._assertHostIsSafe(new URL(url).hostname);
    const ua = this._randomUA();

    const ctx = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept':           'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language':  'en-US,en;q=0.9',
        'Accept-Encoding':  'gzip, deflate, br',
        'Cache-Control':    'no-cache',
        'Sec-Fetch-Dest':   'document',
        'Sec-Fetch-Mode':   'navigate',
        'Sec-Fetch-Site':   'none',
        'Sec-Ch-Ua':        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Block every request the browser itself makes (redirects, subresources,
    // fetch()/XHR triggered by the page's own JS) that resolves to a private
    // or reserved IP. The single _assertHostIsSafe call above only covers the
    // initial navigation URL — Chromium has its own network stack and will
    // happily follow a JS-driven redirect or fetch() to an internal target
    // unless every request is checked here too.
    await ctx.route('**/*', async (route) => {
      let target;
      try { target = new URL(route.request().url()); } catch { return route.abort(); }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return route.continue();
      try {
        await this._assertHostIsSafe(target.hostname);
        return route.continue();
      } catch {
        return route.abort();
      }
    });

    // Stealth: remove webdriver fingerprint that Cloudflare and others detect
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver',  { get: () => false });
      Object.defineProperty(navigator, 'plugins',    { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages',  { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform',   { get: () => 'Win32' });
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      // Remove automation-related properties
      delete window.__playwright;
      delete window.__pw_manual;
    });

    const page = await ctx.newPage();
    try {
      // domcontentloaded is faster than networkidle and avoids timeouts on SPAs
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait briefly for JS frameworks to render initial content
      await page.waitForTimeout(1200);

      // Expand accordions, tabs, lazy sections — avoids dangerous clicks
      await this._safeExpand(page);

      const html     = await page.content();
      const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      return { html, bodyText, method: 'playwright' };
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  }

  // ── Cheerio/axios fetch (static HTML, fast, reliable fallback) ───────────
  async _fetchCheerio(url) {
    const ua = this._randomUA();
    const resp = await this._safeAxiosGet(url, {
      timeout: 18000,
      headers: {
        'User-Agent':                  ua,
        'Accept':                      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':             'en-US,en;q=0.9',
        'Accept-Encoding':             'gzip, deflate, br',
        'Cache-Control':               'no-cache',
        'Upgrade-Insecure-Requests':   '1',
        'Sec-Fetch-Dest':              'document',
        'Sec-Fetch-Mode':              'navigate',
        'Sec-Fetch-Site':              'none',
        'Sec-Ch-Ua':                   '"Chromium";v="124", "Google Chrome";v="124"',
        'Sec-Ch-Ua-Mobile':            '?0',
        'Sec-Ch-Ua-Platform':          '"Windows"',
      },
      maxContentLength: 10 * 1024 * 1024,
      decompress:       true,
    });

    if (resp.status === 403 || resp.status === 429) {
      throw new Error(`Blocked by site (HTTP ${resp.status}) — site uses bot protection`);
    }

    const html     = typeof resp.data === 'string' ? resp.data : '';
    const $        = cheerio.load(html);
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return { html, bodyText, $, method: 'cheerio' };
  }

  // ── Safe expand (Playwright: click accordions/tabs without triggering forms) ─
  async _safeExpand(page) {
    try {
      const bl = SAFE_CLICK_BLACKLIST.join(',');
      await page.evaluate((bl) => {
        const safe = el => !el.closest(bl);
        document.querySelectorAll(
          '[class*="accordion"],[class*="collapse"],[aria-expanded="false"],[data-toggle="collapse"],[data-bs-toggle="collapse"]'
        ).forEach(el => { if (safe(el)) try { el.click(); } catch {} });
        document.querySelectorAll(
          '[role="tab"],[class*="tab-btn"],[class*="tab-link"],[class*="tab-trigger"]'
        ).forEach(el => { if (safe(el)) try { el.click(); } catch {} });
      }, bl);
      await page.waitForTimeout(600);
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 12 EXTRACTION STRATEGIES
  // Strategy 1–5: Services | 6: Pricing | 7: Hours | 8: FAQs
  // Strategy 9: Contact | 10: Testimonials | 11: Certifications | 12: About
  // ════════════════════════════════════════════════════════════════════════════

  _extractServices($, bodyText) {
    const services = new Set();

    // Strategy 1: JSON-LD structured data (@type: Service / hasOfferCatalog)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '{}';
        const items = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [JSON.parse(raw)];
        for (const item of items) {
          if (item['@type'] === 'Service' && item.name) services.add(item.name.trim());
          const catalog = item.hasOfferCatalog?.itemListElement || [];
          for (const o of catalog) {
            if (o.name) services.add(o.name.trim());
            if (o.itemOffered?.name) services.add(o.itemOffered.name.trim());
          }
        }
      } catch {}
    });

    // Strategy 2: DOM class-based (service sections / cards)
    $('[class*="service"],[id*="service"],[class*="Service"],[class*="offering"],[class*="solution"]').each((_, el) => {
      const text = $(el).find('h1,h2,h3,h4,.title,.name,.heading').first().text().trim();
      if (text && text.length > 3 && text.length < 100 && !text.toLowerCase().includes('service')) {
        services.add(text);
      }
    });

    // Strategy 3: Navigation service links
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') || '').toLowerCase();
      const text = $(el).text().trim();
      if (
        (href.includes('service') || href.includes('what-we-do') || href.includes('our-work') || href.includes('work')) &&
        text.length > 3 && text.length < 80 &&
        !text.toLowerCase().match(/all service|view all|see all|learn more/)
      ) services.add(text);
    });

    // Strategy 4: Heading-scoped list items
    $('section,div,article').each((_, el) => {
      const heading = $(el).find('h1,h2,h3').first().text().toLowerCase();
      if (/services?|what we (do|offer|provide)|our work|offerings|specialt/i.test(heading)) {
        $(el).find('li,h4,h5,.service-item,.service-name,.card-title').each((_, item) => {
          const text = $(item).text().trim();
          if (text.length > 3 && text.length < 100) services.add(text);
        });
      }
    });

    // Strategy 5: Text pattern matching
    const patterns = [
      /(?:we offer|we provide|specializ(?:e|ing) in|our services? include)[:\s]+([^\n.]{5,70})/gi,
      /(?:✓|•|–|→|\*)\s*([A-Z][a-zA-Z &/-]{5,60})/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(bodyText)) !== null) {
        const s = m[1]?.trim();
        if (s && s.length > 5 && s.length < 80) services.add(s);
        if (services.size >= 30) break;
      }
    }

    return [...services].slice(0, 25);
  }

  _extractPricing($, bodyText) {
    const items = [];

    // From JSON-LD offers
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        const offers = Array.isArray(data.offers) ? data.offers : (data.offers ? [data.offers] : []);
        for (const o of offers) {
          if (o.name && o.price) items.push({ service: o.name.trim(), price: `$${o.price}` });
        }
      } catch {}
    });

    // From text
    const re = /([A-Za-z][A-Za-z ]{4,39})[:\s]+(\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*\/\s*\w+)?)/g;
    let m;
    while ((m = re.exec(bodyText)) !== null) {
      items.push({ service: m[1].trim(), price: m[2].trim() });
      if (items.length >= 15) break;
    }

    return items;
  }

  _extractHours($, bodyText) {
    // JSON-LD openingHours
    let hours = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (hours) return;
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data.openingHours) {
          hours = Array.isArray(data.openingHours) ? data.openingHours.join(', ') : String(data.openingHours);
        }
      } catch {}
    });

    // DOM + text fallback
    if (!hours) {
      $('[class*="hour"],[class*="Hour"],[id*="hour"],[itemprop="openingHours"]').each((_, el) => {
        if (hours) return;
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 8 && text.length < 200) hours = text;
      });
    }

    if (!hours) {
      const re = /(?:hours?|open|we.re open)[:\s]+([^\n]{10,100})/i;
      const m = re.exec(bodyText);
      if (m) hours = m[1].trim();
    }

    return hours;
  }

  _extractFaqs($, bodyText) {
    const faqs = [];

    // Strategy 1: JSON-LD FAQPage schema
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '{}';
        const items = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [JSON.parse(raw)];
        for (const item of items) {
          if (item['@type'] === 'FAQPage' && item.mainEntity) {
            for (const faq of item.mainEntity.slice(0, 15)) {
              if (faq.name && faq.acceptedAnswer?.text) {
                faqs.push({ q: faq.name.trim(), a: faq.acceptedAnswer.text.trim().substring(0, 400) });
              }
            }
          }
        }
      } catch {}
    });

    // Strategy 2: FAQ DOM patterns
    if (faqs.length < 5) {
      $('[class*="faq"],[id*="faq"],[class*="accordion"]').each((_, el) => {
        if (faqs.length >= 15) return false;
        const q = $(el).find('[class*="question"],[class*="title"],h3,h4,summary').first().text().trim();
        const a = $(el).find('[class*="answer"],[class*="content"],[class*="body"],p').first().text().trim();
        if (q && a && q.length > 5) {
          faqs.push({ q: q.substring(0, 200), a: a.substring(0, 400) });
        }
      });
    }

    // Strategy 3: Q:/A: text patterns
    if (faqs.length < 3) {
      const re = /(?:Q:|Question:)\s*([^\n?]+\?)\s*(?:A:|Answer:)\s*([^\n]{10,400})/gi;
      let m;
      while ((m = re.exec(bodyText)) !== null) {
        faqs.push({ q: m[1].trim(), a: m[2].trim() });
        if (faqs.length >= 15) break;
      }
    }

    return faqs;
  }

  _extractContact($, bodyText) {
    const contact = {};

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data.telephone && !contact.phone) contact.phone = data.telephone;
        if (data.email && !contact.email) contact.email = data.email;
        if (data.address && !contact.address) {
          const a = data.address;
          contact.address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ');
        }
      } catch {}
    });

    // tel: links (most reliable)
    if (!contact.phone) {
      $('a[href^="tel:"]').each((_, el) => {
        if (contact.phone) return;
        contact.phone = ($(el).attr('href') || '').replace('tel:', '').trim();
      });
    }

    // mailto: links
    if (!contact.email) {
      $('a[href^="mailto:"]').each((_, el) => {
        if (contact.email) return;
        const m = ($(el).attr('href') || '').replace('mailto:', '').split('?')[0].trim();
        if (m && !m.includes('example.com')) contact.email = m;
      });
    }

    // Text regex fallback
    if (!contact.phone) {
      const m = bodyText.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
      if (m) contact.phone = m[0].trim();
    }
    if (!contact.email) {
      const m = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (m && !m[0].includes('example.com')) contact.email = m[0].trim();
    }

    return contact;
  }

  _extractTestimonials($) {
    const testimonials = [];
    const selectors = [
      '[itemtype*="Review"]', 'blockquote',
      '[class*="testimonial"]', '[class*="review"]', '[class*="quote"]',
      '[id*="testimonial"]', '[id*="review"]',
      '[class*="feedback"]', '[class*="client-say"]',
    ];

    for (const sel of selectors) {
      if (testimonials.length >= 5) break;
      $(sel).each((_, el) => {
        if (testimonials.length >= 5) return false;
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 30 && text.length < 600 && !testimonials.includes(text.substring(0, 400))) {
          testimonials.push(text.substring(0, 400));
        }
      });
    }

    return testimonials;
  }

  _extractCertifications($, bodyText) {
    const certs = new Set();

    // DOM badges / certification sections
    $('[class*="certif"],[class*="licens"],[class*="badge"],[class*="accredit"],[class*="award"],[class*="trust"]').each((_, el) => {
      const text = $(el).find('img').attr('alt') || $(el).text().trim().replace(/\s+/g, ' ');
      if (text && text.length > 3 && text.length < 100) certs.add(text.trim());
      if (certs.size >= 10) return false;
    });

    // Text patterns
    const re = /(?:certified|licensed|insured|bonded|accredited|member of|BBB|award)[^\n.,]{0,60}/gi;
    let m;
    while ((m = re.exec(bodyText)) !== null) {
      certs.add(m[0].trim());
      if (certs.size >= 10) break;
    }

    return [...certs];
  }

  _extractAbout($, bodyText) {
    // Priority 1: JSON-LD description
    let about = '';
    $('script[type="application/ld+json"]').each((_, el) => {
      if (about) return;
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data.description && data.description.length > 40) about = data.description.substring(0, 600);
      } catch {}
    });

    // Priority 2: meta description
    if (!about) {
      const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      if (desc.length > 30) about = desc.substring(0, 400);
    }

    // Priority 3: About DOM section
    if (!about) {
      const domSels = [
        '[class*="about-us"],[id*="about-us"]',
        '[class*="about"],[id*="about"]',
        '[class*="mission"],[class*="story"],[class*="who-we"]',
        'main p, article p',
      ];
      for (const sel of domSels) {
        const text = $(sel).first().text().trim().replace(/\s+/g, ' ');
        if (text.length > 80) { about = text.substring(0, 600); break; }
      }
    }

    // Priority 4: text regex
    if (!about) {
      const re = /(?:about us|who we are|our story|our mission|we are)[:\s]+([^\n]{30,500})/i;
      const m = re.exec(bodyText);
      if (m) about = m[1].trim();
    }

    return about || bodyText.substring(0, 300).trim();
  }
}

module.exports = CrawlerService;
