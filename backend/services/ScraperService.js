const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
  constructor() {
    this.timeout = 15000;
    this.userAgent = 'Mozilla/5.0 (compatible; ItsPostingBot/1.0)';
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

  async fetchPage(url) {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: { 'User-Agent': this.userAgent, 'Accept': 'text/html,application/xhtml+xml' },
      maxRedirects: 5,
      validateStatus: (s) => s < 400,
    });
    return { html: response.data, finalUrl: response.request.res?.responseUrl || url };
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
