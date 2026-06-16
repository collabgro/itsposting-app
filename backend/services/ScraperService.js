const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

class ScraperService {
  // Real Chrome UAs — rotated to avoid bot detection
  static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  ];

  constructor() {
    this.timeout = 18000;
    this.userAgent = ScraperService.USER_AGENTS[Math.floor(Math.random() * ScraperService.USER_AGENTS.length)];
  }

  async scrapeWebsite(url) {
    if (!this.isValidUrl(url)) throw new Error('Invalid URL. Must start with http:// or https://');
    console.log(`🕷️  Scraping: ${url}`);
    try {
      const homepage = await this.fetchPage(url);
      const $ = cheerio.load(homepage.html);
      const data = {
        url,
        title: this.extractTitle($),
        description: this.extractDescription($),
        businessName: this.extractBusinessName($),
        services: this.extractServices($, homepage.html),
        about: this.extractAbout($),
        testimonials: this.extractTestimonials($),
        contactInfo: this.extractContactInfo($, homepage.html),
        images: this.extractImages($, url),
        socialLinks: this.extractSocialLinks($),
        keywords: this.extractKeywords($),
        scrapedAt: new Date().toISOString(),
      };
      const subpageData = await this.scrapeSubpages(url, $);
      if (subpageData.services.length > 0)
        data.services = [...new Set([...data.services, ...subpageData.services])];
      if (subpageData.about) data.about = data.about || subpageData.about;
      console.log(`✅ Scraped ${data.services.length} services, ${data.images.length} images`);
      return data;
    } catch (error) {
      console.error('Scrape error:', error.message);
      throw new Error(`Failed to scrape website: ${error.message}`);
    }
  }

  // Checks the actual resolved IP, not the hostname string — a hostname-only
  // blocklist is trivially bypassed by DNS rebinding (an attacker-controlled
  // domain whose A/AAAA record points straight at 169.254.169.254 or an
  // internal Railway service would never match a string pattern like /^10\./).
  _isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split('.').map(Number);
      return (
        a === 127 ||                              // loopback
        a === 10 ||                                // RFC1918
        (a === 172 && b >= 16 && b <= 31) ||        // RFC1918
        (a === 192 && b === 168) ||                 // RFC1918
        (a === 169 && b === 254) ||                 // link-local / cloud metadata
        (a === 100 && b >= 64 && b <= 127) ||        // CGNAT
        a === 0                                      // "this network"
      );
    }
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1') return true;              // loopback
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
      if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
      // IPv4-mapped IPv6 (::ffff:a.b.c.d) — recheck the embedded IPv4
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

  // Resolves the hostname to its real IP address(es) and validates those —
  // not the hostname string — so DNS rebinding can't bypass the check.
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

  async fetchPage(url, redirectsLeft = 5) {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new Error('Invalid URL. Must start with http:// or https://');
    }
    await this._assertHostIsSafe(urlObj.hostname);

    // maxRedirects is disabled here on purpose: axios/follow-redirects would
    // otherwise follow 3xx hops itself without re-running the DNS/IP check
    // above on each hop, letting a "safe" public URL redirect straight to an
    // internal target. Redirects are followed manually below so every hop is
    // re-validated.
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent':                this.userAgent,
        'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':           'en-US,en;q=0.9',
        'Accept-Encoding':           'gzip, deflate, br',
        'Cache-Control':             'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest':            'document',
        'Sec-Fetch-Mode':            'navigate',
        'Sec-Fetch-Site':            'none',
        'Sec-Ch-Ua':                 '"Chromium";v="124", "Google Chrome";v="124"',
        'Sec-Ch-Ua-Mobile':          '?0',
      },
      maxRedirects: 0,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      decompress: true,
      validateStatus: (s) => s < 500,
    });

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      if (redirectsLeft <= 0) throw new Error('Too many redirects');
      const nextUrl = new URL(response.headers.location, url).href;
      return this.fetchPage(nextUrl, redirectsLeft - 1);
    }

    return { html: response.data, finalUrl: url };
  }

  extractTitle($) {
    return ($('meta[property="og:title"]').attr('content') || $('title').text().trim() || '').substring(0, 200);
  }

  extractDescription($) {
    return ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').substring(0, 500);
  }

  extractBusinessName($) {
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName) return ogSiteName.trim();
    const title = $('title').text().trim();
    if (title) return title.split(/[|\-–—]/)[0].trim();
    return '';
  }

  extractServices($, html) {
    const services = new Set();
    const serviceKeywords = ['service', 'services', 'what we do', 'offerings', 'solutions', 'specialties', 'expertise'];
    $('section, div, ul').each((_, el) => {
      const $el = $(el);
      const heading = $el.find('h1, h2, h3').first().text().toLowerCase();
      if (serviceKeywords.some((k) => heading.includes(k))) {
        $el.find('li, h4, h5, .service-item, .service-name').each((_, item) => {
          const text = $(item).text().trim();
          if (text.length > 3 && text.length < 100) services.add(text);
        });
      }
    });
    $('a').each((_, el) => {
      const href = ($(el).attr('href') || '').toLowerCase();
      const text = $(el).text().trim();
      if ((href.includes('service') || href.includes('what-we-do')) && text.length > 3 && text.length < 80 && !text.toLowerCase().includes('all services'))
        services.add(text);
    });
    return Array.from(services).slice(0, 20);
  }

  extractAbout($) {
    const selectors = ['#about', '.about', '[class*="about"]'];
    for (const sel of selectors) {
      try {
        const text = $(sel).first().text().trim().replace(/\s+/g, ' ');
        if (text.length > 100 && text.length < 2000) return text.substring(0, 1500);
      } catch (e) { continue; }
    }
    return '';
  }

  extractContactInfo($, html) {
    const contact = { phone: null, email: null, address: null };
    const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) contact.phone = phoneMatch[0];
    const emailMatch = html.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (emailMatch && !emailMatch[0].includes('example.com')) contact.email = emailMatch[0];
    $('[itemtype*="PostalAddress"], .address, [class*="address"]').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 10 && text.length < 200 && !contact.address) contact.address = text;
    });
    return contact;
  }

  extractImages($, baseUrl) {
    const images = new Set();
    $('img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) {
        try { const u = new URL(baseUrl); src = `${u.protocol}//${u.host}${src}`; } catch (e) { return; }
      } else if (!src.startsWith('http')) return;
      const width = parseInt($(el).attr('width') || '0', 10);
      if (width > 0 && width < 200) return;
      if (src.includes('icon') || src.includes('logo-small') || src.includes('1x1.gif')) return;
      images.add(src);
    });
    return Array.from(images).slice(0, 10);
  }

  extractSocialLinks($) {
    const social = {};
    const platforms = { facebook: /facebook\.com/i, instagram: /instagram\.com/i, twitter: /twitter\.com|x\.com/i, linkedin: /linkedin\.com/i, youtube: /youtube\.com/i };
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      for (const [name, regex] of Object.entries(platforms)) {
        if (regex.test(href) && !social[name]) social[name] = href;
      }
    });
    return social;
  }

  extractKeywords($) {
    const meta = $('meta[name="keywords"]').attr('content');
    return meta ? meta.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 20) : [];
  }

  extractTestimonials($) {
    const testimonials = [];
    const selectors = [
      '[class*="testimonial"]', '[class*="review"]', '[class*="quote"]',
      '[id*="testimonial"]', '[id*="review"]', 'blockquote',
      '[class*="feedback"]', '[class*="client-say"]', '[class*="what-client"]',
    ];
    for (const sel of selectors) {
      try {
        $(sel).each((_, el) => {
          if (testimonials.length >= 3) return false;
          const $el = $(el);
          const text = $el.text().trim().replace(/\s+/g, ' ');
          if (text.length > 30 && text.length < 500) {
            const authorEl = $el.find('[class*="author"], [class*="name"], cite, [class*="client"]').first();
            testimonials.push({
              text: text.substring(0, 300),
              author: authorEl.text().trim().substring(0, 80) || '',
            });
          }
        });
      } catch (e) { continue; }
      if (testimonials.length >= 3) break;
    }
    return testimonials;
  }

  async scrapeSubpages(baseUrl, $) {
    const result = { services: [], about: '' };
    const subpagePatterns = [
      { pattern: /^\/services?$|services\.html$/i, key: 'services' },
      { pattern: /^\/about$|about\.html$|about-us/i, key: 'about' },
    ];
    const subpageUrls = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      for (const { pattern } of subpagePatterns) {
        if (pattern.test(href)) {
          try { subpageUrls.add(new URL(href, baseUrl).href); } catch (e) { continue; }
        }
      }
    });
    for (const url of Array.from(subpageUrls).slice(0, 2)) {
      try {
        const page = await this.fetchPage(url);
        const $$ = cheerio.load(page.html);
        if (url.toLowerCase().includes('service')) {
          $$('h2, h3, h4, .service-title, [class*="service"]').each((_, el) => {
            const text = $$(el).text().trim();
            if (text.length > 3 && text.length < 100) result.services.push(text);
          });
        } else if (url.toLowerCase().includes('about')) {
          const main = $$('main, article, .content, #content').first().text().trim();
          if (main.length > 100) result.about = main.substring(0, 1500);
        }
      } catch (e) { continue; }
    }
    return result;
  }

  isValidUrl(url) {
    try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }
}

module.exports = ScraperService;
