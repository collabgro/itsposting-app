import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpCredits, IpFacebook, IpInstagram, IpGoogle,
  IpArrowLeft, IpArrowRight, IpRefresh, IpCopy,
  IpCheck, IpCheckCircle, IpEdit, IpSparkle, IpChevronRight, IpLinkedIn, IpTikTok,
  IpVideo, IpUser, IpPlus,
} from '../components/icons';
import Icon from '../components/Icon';
import Layout from '../components/Layout';
import { setMascotMood, triggerMilestone } from '../components/PostCoreMascot';
import { useTheme } from '../lib/theme';
import { useBranding } from '../lib/branding';
import api, { customerAPI, socialAPI, analyticsAPI, postsAPI, templatesAPI, wizardAPI, calendarPlansAPI } from '../lib/api';
import { CHAR_LIMITS, MOCKUP_MAP, PLATFORM_META } from '../components/PostMockups';

// ── Step 1: Content Type Selection ──────────────────────────────────────────
const CONTENT_TYPES = [
  { id: 'static',   icon: 'text_post',  label: 'Text Post',  desc: 'Text-only post, no image', credits: 1 },
  { id: 'photo',    icon: 'photo_post', label: 'Photo Post', desc: 'AI-generated image with caption', credits: 3 },
  { id: 'carousel', icon: 'carousel',   label: 'Carousel',   desc: 'Multiple slides in one post', credits: 5 },
  { id: 'video',    icon: 'video',      label: 'Video',      desc: 'AI-generated video content', credits: 10 },
];

// ── Step 2: Content Theme (Trigger) ──────────────────────────────────────────
const CONTENT_THEMES = [
  { id: 'custom',             icon: 'custom',         label: 'My own idea',             desc: 'You know what to post — describe it below' },
  { id: 'just_finished_job',  icon: 'job_finished',   label: 'Just finished a job',     desc: 'Show off a completed project' },
  { id: 'share_tip',          icon: 'share_tip',      label: 'Want to share a tip',     desc: 'Teach your audience something' },
  { id: 'got_review',         icon: 'got_review',     label: 'Got a great review',      desc: 'Showcase customer love' },
  { id: 'running_promo',      icon: 'promotion',      label: 'Running a promotion',     desc: 'Announce an offer or deal' },
  { id: 'seasonal',           icon: 'seasonal',       label: 'Seasonal content',        desc: null },
  { id: 'faq',                 icon: 'faq',            label: 'Answer a question',       desc: 'FAQ or myth-bust — builds authority' },
  { id: 'community',          icon: 'community',      label: 'Community / local event', desc: 'Connect with your neighborhood' },
  { id: 'team_spotlight',     icon: 'team_spotlight', label: 'Team spotlight',          desc: 'Put a face to your business' },
];

// ── Step 3: Tone ──────────────────────────────────────────────────────────────
const TONES = [
  { id: 'friendly',     icon: 'friendly',     label: 'Friendly & casual',          desc: 'Warm, approachable, conversational' },
  { id: 'professional', icon: 'professional', label: 'Professional & trustworthy',  desc: 'Polished, credible, authoritative' },
  { id: 'funny',        icon: 'funny',        label: 'Funny & relatable',           desc: 'Light-hearted, witty, human' },
  { id: 'educational',  icon: 'educational',  label: 'Educational & expert',        desc: 'Informative, detailed, insightful' },
  { id: 'urgent',       icon: 'urgent',       label: 'Urgent & must-act-now',       desc: 'Compelling, time-sensitive, direct' },
];

// ── Step 4: Details ──────────────────────────────────────────────────────────
const DETAILS_PLACEHOLDER = 'Add any specific details about this post...';

// ── Step 5: Platform ─────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'facebook',       icon: IpFacebook,  label: 'Facebook',        color: '#1877F2', bg: 'rgba(24,119,242,0.1)',  border: 'rgba(24,119,242,0.3)',  desc: 'Best for longer posts & community' },
  { id: 'instagram',      icon: IpInstagram, label: 'Instagram',       color: '#E1306C', bg: 'rgba(225,48,108,0.1)', border: 'rgba(225,48,108,0.3)', desc: 'Visual-first, hashtag-rich content' },
  { id: 'google_business',icon: IpGoogle,    label: 'Google Business', color: '#4285F4', bg: 'rgba(66,133,244,0.1)', border: 'rgba(66,133,244,0.3)', desc: 'Local search visibility & reviews' },
  { id: 'linkedin',       icon: IpLinkedIn,  label: 'LinkedIn',        color: '#0A66C2', bg: 'rgba(10,102,194,0.1)', border: 'rgba(10,102,194,0.3)', desc: 'Professional B2B audience reach' },
  { id: 'tiktok',         icon: IpTikTok,    label: 'TikTok',          color: '#010101', bg: 'rgba(1,1,1,0.07)',     border: 'rgba(1,1,1,0.2)',      desc: 'Short-form video-first audience' },
  { id: 'all',            icon: IpSparkle,   label: 'All Platforms',   color: '#7C5CFC', bg: 'rgba(124,92,252,0.1)', border: 'rgba(124,92,252,0.3)', desc: 'Auto-adapted for each platform' },
];

// ── Loading messages (content-type-aware, industry + city-aware) ─────────────
const LOADING_MESSAGES = {
  static:   (ind, city) => [
    `Reading what works for ${ind || 'your industry'} businesses${city ? ` in ${city}` : ''}...`,
    'Writing 3 variations with different angles...',
    'Adding seasonal context for this time of year...',
    'Almost ready...',
  ],
  photo:    (ind, city) => [
    `Reading what works for ${ind || 'your industry'} businesses${city ? ` in ${city}` : ''}...`,
    'Building the perfect image prompt...',
    'Generating your image...',
    'Adding finishing touches...',
  ],
  carousel: (ind, city) => [
    `Reading what works for ${ind || 'your industry'} businesses${city ? ` in ${city}` : ''}...`,
    'Drafting slide content...',
    'Creating slide images...',
    'Assembling your carousel...',
    'Almost done...',
  ],
  video: (ind, city, vType) => [
    `Reading what works for ${ind || 'your industry'} businesses${city ? ` in ${city}` : ''}...`,
    'Writing your video script...',
    vType === 'avatar' ? 'Preparing AI avatar presenter...' : 'Generating key frame image...',
    'Sending to video AI — this takes 1–2 minutes...',
    'Video rendering in background — captions are ready now!',
  ],
};

// ── Step 2: Choose Format ─────────────────────────────────────────────────────
const FORMAT_TABS = ['Popular', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Google'];

// Maps format ID → result screen platform tab key (auto-selects correct tab after generation)
const FORMAT_TO_RESULT_TAB = {
  'universal':    'instagram_feed',
  'ig-45':        'instagram_feed',
  'ig-story':     'instagram_feed',
  'ig-reel':      'instagram_feed',
  'ig-square':    'instagram_feed',
  'fb-landscape': 'facebook_feed',
  'fb-story':     'facebook_feed',
  'fb-square':    'facebook_feed',
  'gb-45':        'google_business',
  'li-post':      'linkedin_feed',
  'li-video':     'linkedin_feed',
  'tt-video':     'instagram_feed',
  'tt-story':     'instagram_feed',
};

// Reach/engagement hints shown on each format card (from Buffer 2026 research)
const FORMAT_REACH_HINTS = {
  'universal':    'Best for multi-platform posting',
  'ig-reel':      '~3× more organic reach than static posts',
  'ig-story':     'Full-screen · no competing content',
  'ig-45':        'Stops the scroll · best for feed posts',
  'ig-square':    'Clean square · works on all platforms',
  'fb-landscape': 'Best format for paid promotion',
  'fb-story':     'Full-screen · highly engaging on mobile',
  'fb-square':    'Versatile · great for feed and ads',
  'li-post':      '+21% engagement vs single image',
  'li-video':     'Gets more views in LinkedIn feed',
  'tt-video':     '~3× more organic reach than static posts',
  'tt-story':     'Full-screen immersive TikTok format',
  'gb-45':        'Boosts local search visibility',
};

const FORMAT_DATA = {
  Popular: [
    { id: 'universal',    platform: 'all',             label: 'All Platforms',        sublabel: '1080 × 1350 · Best for multi-platform', width: 1080, height: 1350 },
    { id: 'ig-45',        platform: 'instagram',       label: 'Instagram Post',       sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
    { id: 'ig-story',     platform: 'instagram',       label: 'Instagram Story',      sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'fb-landscape', platform: 'facebook',        label: 'Facebook Post',        sublabel: '1200 × 630 · 16:9',  width: 1200, height: 630  },
    { id: 'li-post',      platform: 'linkedin',        label: 'LinkedIn Post',        sublabel: '1200 × 1200 · 1:1',  width: 1200, height: 1200 },
    { id: 'tt-video',     platform: 'tiktok',          label: 'TikTok Video',         sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'gb-45',        platform: 'google_business', label: 'Google Business Post', sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
  ],
  Facebook: [
    { id: 'fb-landscape', platform: 'facebook', label: 'Facebook Post',   sublabel: '1200 × 630 · 16:9',  width: 1200, height: 630  },
    { id: 'fb-story',     platform: 'facebook', label: 'Facebook Story',  sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'fb-square',    platform: 'facebook', label: 'Facebook Square', sublabel: '1080 × 1080 · 1:1',  width: 1080, height: 1080 },
  ],
  Instagram: [
    { id: 'ig-45',     platform: 'instagram', label: 'Instagram Post',   sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
    { id: 'ig-story',  platform: 'instagram', label: 'Instagram Story',  sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'ig-reel',   platform: 'instagram', label: 'Instagram Reel',   sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'ig-square', platform: 'instagram', label: 'Instagram Square', sublabel: '1080 × 1080 · 1:1',  width: 1080, height: 1080 },
  ],
  LinkedIn: [
    { id: 'li-post',  platform: 'linkedin', label: 'LinkedIn Post',  sublabel: '1200 × 1200 · 1:1',  width: 1200, height: 1200 },
    { id: 'li-video', platform: 'linkedin', label: 'LinkedIn Video', sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
  ],
  TikTok: [
    { id: 'tt-video', platform: 'tiktok', label: 'TikTok Video', sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'tt-story', platform: 'tiktok', label: 'TikTok Story', sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
  ],
  Google: [
    { id: 'gb-45', platform: 'google_business', label: 'Google Business Post', sublabel: '1080 × 1350 · 4:5', width: 1080, height: 1350 },
  ],
};

// Content-type-aware recommendations for the hero row.
// Universal is always the first / BEST PICK for image content types.
const UNIVERSAL_FMT = { id: 'universal', platform: 'all', label: 'All Platforms', sublabel: '1080 × 1350 · Best for multi-platform', width: 1080, height: 1350 };

const RECOMMENDED_FORMATS = {
  static: [
    UNIVERSAL_FMT,
    { id: 'ig-45',        platform: 'instagram',       label: 'Instagram Post',       sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
    { id: 'fb-landscape', platform: 'facebook',        label: 'Facebook Post',        sublabel: '1200 × 630 · 16:9',  width: 1200, height: 630  },
  ],
  photo: [
    UNIVERSAL_FMT,
    { id: 'ig-45',     platform: 'instagram', label: 'Instagram Post',  sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
    { id: 'fb-landscape', platform: 'facebook', label: 'Facebook Post', sublabel: '1200 × 630 · 16:9', width: 1200, height: 630  },
  ],
  carousel: [
    UNIVERSAL_FMT,
    { id: 'ig-45',     platform: 'instagram', label: 'Instagram Post',  sublabel: '1080 × 1350 · 4:5',  width: 1080, height: 1350 },
    { id: 'li-post',   platform: 'linkedin',  label: 'LinkedIn Post',   sublabel: '1200 × 1200 · 1:1',  width: 1200, height: 1200 },
  ],
  video: [
    { id: 'ig-reel',   platform: 'instagram', label: 'Instagram Reel',  sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'tt-video',  platform: 'tiktok',    label: 'TikTok Video',    sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
    { id: 'fb-story',  platform: 'facebook',  label: 'Facebook Story',  sublabel: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
  ],
  branded_card: [
    UNIVERSAL_FMT,
    { id: 'ig-45',        platform: 'instagram', label: 'Instagram Post',  sublabel: '1080 × 1350 · 4:5', width: 1080, height: 1350 },
    { id: 'fb-landscape', platform: 'facebook',  label: 'Facebook Post',   sublabel: '1200 × 630 · 16:9', width: 1200, height: 630  },
  ],
};

const FORMAT_PLATFORM_COLORS = {
  all: '#7C3AED',  // brand purple for Universal
  facebook: '#1877F2', instagram: '#E1306C', linkedin: '#0A66C2',
  tiktok: '#111111', google_business: '#34A853',
  Google: '#34A853',
};

const FORMAT_TYPE_FILTER = {
  // video formats only show video formats; image formats show universal + image-only options
  video:        ['ig-reel', 'ig-story', 'fb-story', 'tt-video', 'tt-story', 'li-video'],
  carousel:     ['universal', 'ig-45', 'ig-square', 'li-post', 'fb-square'],
  photo:        ['universal', 'ig-45', 'ig-square', 'fb-landscape', 'fb-square', 'li-post', 'gb-45'],
  static:       ['universal', 'ig-45', 'fb-landscape', 'li-post', 'gb-45', 'fb-square'],
  branded_card: ['universal', 'ig-45', 'fb-landscape', 'li-post', 'gb-45', 'fb-square'],
};

// ── Real Pexels trade-business photos (CDN URLs — no key needed to display) ──
const FORMAT_SAMPLE = {
  'ig-45':        { photoId: 8488035  },  // plumber at work — portrait 4:5
  'ig-story':     { photoId: 37623615 },  // roofing — tall portrait 9:16
  'ig-reel':      { photoId: 6471913  },  // HVAC tech — tall portrait
  'ig-square':    { photoId: 16734519 },  // house painter — square
  'fb-landscape': { photoId: 4756489  },  // home renovation — landscape
  'fb-story':     { photoId: 33694016 },  // electrician — tall portrait
  'fb-square':    { photoId: 9354300  },  // landscaping — square
  'li-post':      { photoId: 7461108  },  // construction team — square
  'li-video':     { photoId: 4956920  },  // construction site — portrait
  'tt-video':     { photoId: 5463576  },  // HVAC technician — tall portrait
  'tt-story':     { photoId: 37704251 },  // roofing crew — tall portrait
  'gb-45':        { photoId: 9679179  },  // electrician — portrait 4:5
};
const FORMAT_SAMPLE_DEFAULT = { photoId: 1029635 }; // generic plumbing fallback

// ── Sample captions for Text Post mockups — plain text, like a real social post
const PLATFORM_SAMPLE_CAPTIONS = {
  instagram: {
    name: "Mike's Plumbing",
    handle: '@mikesplumbing',
    // paragraphs separated by '' (blank line)
    lines: [
      "5 signs your pipes need attention RIGHT NOW 🔧",
      '',
      "Low pressure? Discolored water? These aren't small warnings — they're red flags.",
      '',
      "#plumbing #homerepair #localplumber",
    ],
    tagIdx: 4,
  },
  facebook: {
    name: "Mike's Plumbing",
    handle: "Mike's Plumbing",
    lines: [
      "Most burst pipes give warning signs first.",
      '',
      "Low pressure, higher bills, or discolored water — call us before it becomes an emergency.",
      '',
      "What's your biggest plumbing fear? 👇",
    ],
    tagIdx: null,
  },
  linkedin: {
    name: "Mike's Plumbing Co.",
    handle: "Mike's Plumbing",
    lines: [
      "How a $200 inspection saved a client $4,000 👷",
      '',
      "A routine check caught a hairline crack before it burst. Preventive maintenance is always the smart call.",
      '',
      "#plumbing #homeservices #preventivemaintenance",
    ],
    tagIdx: 4,
  },
  tiktok: {
    name: "Mike's Plumbing",
    handle: '@mikesplumbing',
    lines: [
      "POV: You ignored that slow drip 💧",
      '',
      "3,000 gallons wasted per year. Here's how to fix it in 10 minutes — no tools needed.",
      '',
      "#plumbing #diytips #homehacks #fyp",
    ],
    tagIdx: 4,
  },
  google_business: {
    name: "Mike's Plumbing",
    handle: "Mike's Plumbing",
    lines: [
      "Serving Dallas homeowners since 2008.",
      '',
      "Fast, reliable repairs with same-day service. Call (214) 555-0182 — licensed & insured.",
    ],
    tagIdx: null,
  },
};

// ── Realistic device-frame mockup with Pexels photos ─────────────────────────
function FormatMockup({ width, height, platformColor, PlatformIcon, size = 'md', contentType, formatId }) {
  const [imgError, setImgError] = useState(false);

  const platform = formatId
    ? formatId.startsWith('fb') ? 'facebook'
    : formatId.startsWith('ig') ? 'instagram'
    : formatId.startsWith('li') ? 'linkedin'
    : formatId.startsWith('tt') ? 'tiktok'
    : formatId.startsWith('gb') ? 'google_business'
    : 'instagram'
    : 'instagram';

  const maxH = size === 'lg' ? 96 : 76;
  const maxW = size === 'lg' ? 136 : 108;
  const ratio = width / height;
  let cW, cH;
  if (ratio > maxW / maxH) { cW = maxW; cH = Math.round(maxW / ratio); }
  else { cH = maxH; cW = Math.round(maxH * ratio); }

  // Static text posts: phone frame for any portrait-or-square format (4:5, 1:1)
  // Other content types: only tall formats (9:16 stories/reels) get phone frame
  const isPortrait = contentType === 'static'
    ? height >= width * 1.0
    : height >= width * 1.3;
  const badgeSize = size === 'lg' ? 14 : 11;

  const sample = FORMAT_SAMPLE[formatId] || FORMAT_SAMPLE_DEFAULT;
  const pxW = Math.round(cW * 3);
  const pxH = Math.round(cH * 3);
  const photoUrl = `https://images.pexels.com/photos/${sample.photoId}/pexels-photo-${sample.photoId}.jpeg?auto=compress&cs=tinysrgb&w=${pxW}&h=${pxH}&fit=crop`;

  // ── Content-type overlay (video play button / carousel dots) ─────────────
  const ContentOverlay = ({ W, H }) => {
    if (contentType === 'video') {
      const isReel = H / W >= 1.6;
      const cx = W / 2, cy = H * (isReel ? 0.46 : 0.44);
      const r = Math.min(W, H) * 0.14;
      const tx = cx + r * 0.35, ty = cy;
      const pt = `${cx - r * 0.5},${cy - r * 0.65} ${tx + r * 0.5},${ty} ${cx - r * 0.5},${cy + r * 0.65}`;
      if (isReel) {
        const segW = (W - 12) / 3;
        return (
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }} fill="none">
            <rect x={6}            y={6} width={segW - 2} height={2} rx="1" fill="rgba(255,255,255,0.55)" />
            <rect x={6 + segW}     y={6} width={segW - 2} height={2} rx="1" fill="rgba(255,255,255,0.92)" />
            <rect x={6 + segW * 2} y={6} width={segW - 2} height={2} rx="1" fill="rgba(255,255,255,0.55)" />
            <circle cx={cx} cy={cy} r={r * 1.5} fill="rgba(0,0,0,0.35)" />
            <polygon points={pt} fill="rgba(255,255,255,0.95)" />
          </svg>
        );
      }
      return (
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }} fill="none">
          <circle cx={cx} cy={cy} r={r * 1.5} fill="rgba(0,0,0,0.35)" />
          <polygon points={pt} fill="rgba(255,255,255,0.95)" />
        </svg>
      );
    }
    if (contentType === 'carousel') {
      const dotY = H - 7, spacing = 5.5, dotR = 2;
      return (
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }} fill="none">
          <circle cx={W / 2 - spacing} cy={dotY} r={dotR} fill="rgba(255,255,255,0.42)" />
          <circle cx={W / 2}           cy={dotY} r={dotR * 1.15} fill="rgba(255,255,255,0.96)" />
          <circle cx={W / 2 + spacing} cy={dotY} r={dotR} fill="rgba(255,255,255,0.42)" />
        </svg>
      );
    }
    return null;
  };

  // ── Photo fill — real image + social-media-style overlays ────────────────
  const PhotoScreen = ({ W, H }) => (
    <div style={{ position: 'absolute', inset: 0 }}>
      {!imgError ? (
        <img
          src={photoUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg, ${platformColor}55, ${platformColor}28)` }} />
      )}
      {/* Bottom dark gradient for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 30%, rgba(0,0,0,0.72) 72%)' }} />
      {/* Header: avatar dot + handle bar */}
      <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: platformColor, border: '1.5px solid rgba(255,255,255,0.88)', flexShrink: 0 }} />
        <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.82)', width: Math.round(W * 0.42) }} />
      </div>
      {/* Caption text bars */}
      <div style={{ position: 'absolute', bottom: 9, left: 6, right: 6 }}>
        <div style={{ height: 2.5, borderRadius: 1.5, background: 'rgba(255,255,255,0.94)', marginBottom: 3, width: '88%' }} />
        <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.62)', width: '65%' }} />
      </div>
      {/* Engagement row: heart + comment */}
      <div style={{ position: 'absolute', bottom: 2, left: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
        <div style={{ width: 5, height: 4.5, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'rgba(255,72,72,0.88)' }} />
        <div style={{ height: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.52)', width: 10 }} />
        <div style={{ width: 5, height: 4.5, borderRadius: '2px 2px 0 2px', border: '1px solid rgba(255,255,255,0.60)', background: 'transparent' }} />
        <div style={{ height: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.52)', width: 7 }} />
      </div>
      <ContentOverlay W={W} H={H} />
    </div>
  );

  // ── Text-card: looks like a real social text post (Twitter/feed style) ───────
  const TextCard = ({ W, H }) => {
    const caption = PLATFORM_SAMPLE_CAPTIONS[platform] || PLATFORM_SAMPLE_CAPTIONS.instagram;
    const SCALE = 0.38;
    const VIRT = Math.round(W / SCALE);
    const virtH = Math.round(H / SCALE);
    const isWide = W > H * 1.1;
    // Landscape: show fewer lines
    const visibleLines = isWide ? caption.lines.slice(0, 3) : caption.lines;
    return (
      <div style={{ width: W, height: H, overflow: 'hidden', position: 'relative', background: '#0d0d18' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: VIRT, height: virtH, transform: `scale(${SCALE})`, transformOrigin: 'top left', padding: '14px 14px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          {/* Spacer matching removed header height */}
          <div style={{ height: 44 }} />
          {/* Body — all lines same weight, blank lines = paragraph break */}
          <div style={{ flex: 1 }}>
            {visibleLines.map((line, i) => (
              line === ''
                ? <div key={i} style={{ height: 8 }} />
                : <div key={i} style={{ fontSize: 12, lineHeight: 1.6, fontFamily: 'system-ui,-apple-system,sans-serif', color: i === caption.tagIdx ? `${platformColor}dd` : 'rgba(255,255,255,0.82)', wordBreak: 'break-word' }}>{line}</div>
            ))}
          </div>
          {/* Engagement row — clean SVG icons, no emoji */}
          {!isWide && (
            <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none"><path d="M11 1H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2l2.5 2.5L9 9h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1Z" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/></svg>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'system-ui' }}>12</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none"><path d="M6.5 1.5C4 1.5 2 3.3 2 5.5c0 2 1.7 3.6 4 4a1 1 0 0 1 .5.9v.6L9 9.2A6 6 0 0 0 11 5.5c0-2.2-2-4-4.5-4Z" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/></svg>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'system-ui' }}>47</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none"><path d="M2 6h9M8 3l3 3-3 3" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'system-ui' }}>Share</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isPortrait) {
    const bx = 5, bTop = 14, bBot = 12;
    const phoneW = cW + bx * 2, phoneH = cH + bTop + bBot;
    return (
      <div style={{ position: 'relative', width: phoneW, height: phoneH, flexShrink: 0 }}>
        {/* Phone shell */}
        <svg width={phoneW} height={phoneH} viewBox={`0 0 ${phoneW} ${phoneH}`} style={{ position: 'absolute', inset: 0 }} fill="none">
          <rect x="0.75" y="0.75" width={phoneW - 1.5} height={phoneH - 1.5} rx="11" fill="#1A1A2E" stroke="#3A3A5C" strokeWidth="1.5"/>
          <circle cx={bx + 5} cy={7} r="1" fill="#555577"/>
          <circle cx={bx + 9} cy={7} r="1" fill="#555577"/>
          <rect x={phoneW / 2 - 12} y={phoneH - 7} width="24" height="2.5" rx="1.25" fill="#444466"/>
        </svg>
        {/* Screen */}
        <div style={{ position: 'absolute', top: bTop, left: bx, width: cW, height: cH, borderRadius: 3, overflow: 'hidden' }}>
          {contentType === 'static' ? <TextCard W={cW} H={cH} /> : <PhotoScreen W={cW} H={cH} />}
        </div>
        {/* Platform badge */}
        {PlatformIcon && (
          <div style={{ position: 'absolute', top: bTop + 4, left: bx + 4, borderRadius: 3, lineHeight: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
            <PlatformIcon size={badgeSize} />
          </div>
        )}
      </div>
    );
  }

  // Landscape or square — browser/laptop chrome frame
  const chromH = size === 'lg' ? 11 : 9;
  const totalH = cH + chromH;
  return (
    <div style={{ position: 'relative', width: cW, height: totalH, flexShrink: 0 }}>
      {/* Outer shell */}
      <svg width={cW} height={totalH} viewBox={`0 0 ${cW} ${totalH}`} style={{ position: 'absolute', inset: 0 }} fill="none">
        <rect x="0.75" y="0.75" width={cW - 1.5} height={totalH - 1.5} rx="8" fill="#14141F" stroke="#32324A" strokeWidth="1.5"/>
        <line x1="0.75" y1={chromH} x2={cW - 0.75} y2={chromH} stroke="#2A2A3E" strokeWidth="1"/>
      </svg>
      {/* Browser chrome bar */}
      <div style={{ position: 'absolute', top: 1, left: 1, width: cW - 2, height: chromH - 1, display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 6, paddingRight: 6 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF5F57', flexShrink: 0 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FEBC2E', flexShrink: 0 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#28C840', flexShrink: 0 }} />
        <div style={{ flex: 1, height: size === 'lg' ? 4 : 3, borderRadius: 2, background: 'rgba(255,255,255,0.09)', marginLeft: 4 }} />
      </div>
      {/* Screen */}
      <div style={{ position: 'absolute', top: chromH, left: 1, width: cW - 2, height: cH, overflow: 'hidden', borderRadius: '0 0 7px 7px' }}>
        {contentType === 'static' ? <TextCard W={cW - 2} H={cH} /> : <PhotoScreen W={cW - 2} H={cH} />}
      </div>
      {/* Platform badge */}
      {PlatformIcon && (
        <div style={{ position: 'absolute', top: chromH + 4, left: 7, borderRadius: 3, lineHeight: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
          <PlatformIcon size={badgeSize} />
        </div>
      )}
    </div>
  );
}

function getSeasonalDesc() {
  const seasonal = [
    'New Year energy — fresh starts', "Valentine's — show your business love",
    'Spring prep — seasonal tips incoming', 'Spring in full swing — timely content',
    'Pre-summer — get ready messaging', 'Summer heat — seasonal urgency',
    'Mid-summer — keep momentum going', 'Back-to-school — business transition',
    'Fall prep — seasonal change content', 'Fall peak — timely seasonal posts',
    'Pre-holiday — build anticipation', 'Holiday season — festive content',
  ];
  return seasonal[new Date().getMonth()] || 'Timely seasonal content';
}

// Maps wizard content type to the field name the backend detail builder expects
function buildDetailsObject(contentType, detailsText) {
  if (!detailsText) return {};
  const map = {
    custom:            { custom_topic: detailsText },
    just_finished_job: { job_description: detailsText },
    share_tip:         { tip_topic: detailsText },
    got_review:        { review_text: detailsText },
    running_promo:     { promo_offer: detailsText },
    seasonal:          { seasonal_angle: detailsText },
    faq:               { question: detailsText },
    community:         { community_event: detailsText },
    team_spotlight:    { spotlight_subject: detailsText },
  };
  return map[contentType] || { job_description: detailsText };
}

// ── Inline API helpers (thin wrappers over the shared api instance) ──────────
async function apiPost(path, body) {
  const res = await api.post(path, body);
  return res.data;
}

async function apiPatch(path, body) {
  const res = await api.patch(path, body);
  return res.data;
}

async function apiGet(path) {
  const res = await api.get(path);
  return res.data;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Wizard() {
  const router = useRouter();
  const { t } = useTheme();
  const { aiName, appName } = useBranding();

  const isOnboarding = router.query.onboarding === 'true';

  const [step, setStep] = useState(1);            // 1–6, 'loading', 'results'
  const [contentType, setContentType] = useState(null); // Step 1
  const [videoType, setVideoType] = useState('services'); // 'services' | 'avatar' (shown when contentType='video')
  const [selectedFormat, setSelectedFormat] = useState(null); // Step 2
  const [formatTab, setFormatTab] = useState('Popular');
  const [hoveredFormat, setHoveredFormat] = useState(null);
  const [theme, setTheme] = useState(null);       // Step 3
  const [tone, setTone] = useState(null);         // Step 4
  const [details, setDetails] = useState('');     // Step 5
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); // Step 6
  const [includeCTA, setIncludeCTA] = useState(true);

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [profileTimezone, setProfileTimezone] = useState('');
  const [seasonalDesc, setSeasonalDesc] = useState(getSeasonalDesc());
  const [copiedId, setCopiedId] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState('A');
  const [selectedCardStyle, setSelectedCardStyle] = useState('A');
  const [selectedPlatformTab, setSelectedPlatformTab] = useState('instagram_feed');
  const [extraPhotoCardUrls, setExtraPhotoCardUrls] = useState({});
  const [extraCardsByPlatform, setExtraCardsByPlatform] = useState({});
  const [extraCarouselDesigns, setExtraCarouselDesigns] = useState({}); // { D: [slide1,slide2,...], E: [...] }
  const [loadingMoreDesigns, setLoadingMoreDesigns] = useState(false);
  const [altLineupQueue, setAltLineupQueue] = useState([]);
  const [moreDesignsModal, setMoreDesignsModal] = useState(null);
  const [wizardPreviewPlatform, setWizardPreviewPlatform] = useState('all');
  const [previewCaptionExpanded, setPreviewCaptionExpanded] = useState(false);

  const [connectedPlatforms, setConnectedPlatforms] = useState(null); // null = not yet loaded
  const [socialAccountsList, setSocialAccountsList] = useState([]);
  const [selectedWizardAccountIds, setSelectedWizardAccountIds] = useState([]);
  const [wizardAccountGroups, setWizardAccountGroups] = useState([]);
  const [wizardBestTimes, setWizardBestTimes] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [smartScheduleDismissed, setSmartScheduleDismissed] = useState(false);

  // Download state
  const [downloadModal, setDownloadModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Inline card text editor state
  const [cardEditOpen, setCardEditOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState(null);
  const [cardRerenderLoading, setCardRerenderLoading] = useState(false);

  // SVG live preview — document-first, raster-last (no network round-trips while editing)
  const [svgCards, setSvgCards] = useState(null);   // { A, B, C } SVG strings from API
  const [activeSvg, setActiveSvg] = useState(null); // currently displayed SVG

  // Result screen action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionToast, setActionToast] = useState(null);
  const [publishedTo, setPublishedTo] = useState(null); // set to platform string after successful publish
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [editedCaption, setEditedCaption] = useState('');
  const [captionHovered, setCaptionHovered] = useState(null);
  const [hashtagSets, setHashtagSets] = useState([]);
  const [showApplySetDropdown, setShowApplySetDropdown] = useState(false);
  const [showAddToSetDropdown, setShowAddToSetDropdown] = useState(false);
  const [addToSetName, setAddToSetName] = useState('');
  const [videoProgress, setVideoProgress] = useState(0);
  const [calendarPlanId, setCalendarPlanId] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const loadingInterval = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const token = localStorage.getItem('token');
    customerAPI.getProfile()
      .then(r => {
        const d = r.data;
        const ind = d.industry || '';
        setIndustry(ind);
        setCity(d.city || d.location || '');
        setProfileTimezone(d.timezone || '');
        // Fetch industry-specific seasonal description from wizard steps endpoint
        if (ind) {
          api.get(`/api/wizard/steps/${ind}/just_finished_job`)
            .then(sr => {
              const step2 = sr.data?.steps?.[1];
              const seasonalOpt = step2?.options?.find(o => o.value === 'seasonal');
              if (seasonalOpt?.description) setSeasonalDesc(seasonalOpt.description);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    analyticsAPI.getOptimalTimes().then(res => {
      setWizardBestTimes((res.data?.recommendations || []).slice(0, 3));
    }).catch(() => {});

    Promise.all([
      socialAPI.getAccounts(),
      socialAPI.getGroups().catch(() => ({ data: [] })),
    ]).then(([accountsRes, groupsRes]) => {
      const accounts = (accountsRes.data || []).filter(a => a.enabled);
      setSocialAccountsList(accounts);
      setConnectedPlatforms(accounts.map(a => a.platform));
      setWizardAccountGroups(groupsRes.data || []);
    }).catch(() => { setSocialAccountsList([]); setConnectedPlatforms([]); });

    templatesAPI.list().then(r => setTemplates(r.data || [])).catch(() => {});
    customerAPI.getHashtagSets().then(r => setHashtagSets(r.data || [])).catch(() => {});

    // Handle navigation from dashboard suggestion banner
    const suggestionPost = sessionStorage.getItem('suggestionPost');
    if (suggestionPost) {
      try {
        const data = JSON.parse(suggestionPost);
        if (data.pre_generated_caption) {
          const caption = typeof data.pre_generated_caption === 'string'
            ? data.pre_generated_caption
            : data.pre_generated_caption?.caption || '';
          setResults({ variations: { a: { caption, hashtags: [], imagePrompt: '', engagementQuestion: '' } }, fromSuggestion: true });
          const sp = data.platform || 'all';
          setSelectedPlatforms(sp === 'all' ? ['facebook','instagram','google_business','linkedin','tiktok'] : [sp]);
          setStep('results');
        }
        sessionStorage.removeItem('suggestionPost');
      } catch {}
    }

    // Handle navigation from quick-post "All Variations" button
    const quickPostResult = sessionStorage.getItem('quickPostResult');
    if (quickPostResult) {
      try {
        const data = JSON.parse(quickPostResult);
        if (data.result && (!data.timestamp || Date.now() - data.timestamp < 30 * 60 * 1000)) {
          setResults(data.result);
          setSelectedPlatforms(data.platforms || [data.platforms?.[0] || 'facebook']);
          setTone(data.tone || 'friendly');
          setStep('results');
        }
        sessionStorage.removeItem('quickPostResult');
      } catch {}
    }

    // Handle ?suggestedTime=tuesday-9 from analytics heatmap
    const st = new URLSearchParams(window.location.search).get('suggestedTime');
    if (st) {
      const [dayName, hourStr] = st.split('-');
      const DAYS_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const dow = DAYS_MAP[dayName?.toLowerCase().slice(0, 3)];
      const hour = parseInt(hourStr);
      if (dow !== undefined && !isNaN(hour)) {
        const today = new Date();
        const todayDow = today.getDay();
        let daysAhead = (dow - todayDow + 7) % 7;
        if (daysAhead === 0) daysAhead = 7;
        const target = new Date(today);
        target.setDate(today.getDate() + daysAhead);
        target.setHours(hour, 0, 0, 0);
        const pad = n => String(n).padStart(2, '0');
        setScheduleDate(`${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}T${pad(hour)}:00`);
      }
    }

    // Handle navigation from Post Ideas page (?theme=&details=&ideaTitle=)
    const params = new URLSearchParams(window.location.search);
    const ideaTheme = params.get('theme');
    const ideaDetails = params.get('details');
    if (ideaTheme) setTheme(ideaTheme);
    if (ideaDetails) setDetails(ideaDetails);

    // Handle navigation from Content Calendar — pre-fill wizard + track planId to link back
    const prefillRaw = sessionStorage.getItem('wizard_prefill');
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw);
        if (prefill.planId) setCalendarPlanId(prefill.planId);
        if (prefill.contentType) {
          // Map calendar plan content_type to wizard content type
          const typeMap = { photo_post: 'photo', text_card: 'static', story: 'photo', carousel: 'carousel', video: 'video' };
          setContentType(typeMap[prefill.contentType] || prefill.contentType);
        }
        if (prefill.notes) setDetails(prefill.notes);
        if (prefill.title) setDetails(d => d || prefill.title); // use title as fallback details
      } catch {}
      sessionStorage.removeItem('wizard_prefill');
    }
  }, []);

  useEffect(() => {
    if (step === 'loading') {
      const msgFn = LOADING_MESSAGES[effectiveContentTypeForDisplay] || LOADING_MESSAGES.photo;
      const msgs = msgFn(industry, city, videoType);
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIdx(i => (i + 1) % msgs.length);
      }, 1800);
    }
    return () => clearInterval(loadingInterval.current);
  }, [step]); // contentType/industry/videoType don't change during loading — no stale closure issue

  // Video status — SSE stream while videoRendering is active
  // Gets a one-time stream ticket, then opens an EventSource to /api/wizard/status/:postId
  // Falls back to polling if EventSource fails to connect
  useEffect(() => {
    if (!results?.videoRendering || results.videoRendering === 'completed' || results.videoRendering === 'failed') return;
    if (!results?.postId) return;

    setVideoProgress(0);
    let es = null;
    let pollInterval = null;
    let pollCount = 0;
    const MAX_POLLS = 100;
    let cancelled = false;

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        pollCount++;
        if (pollCount > MAX_POLLS) {
          setResults(r => ({ ...r, videoRendering: 'failed', imageFailed: true }));
          clearInterval(pollInterval);
          return;
        }
        try {
          const { status, videoUrl } = await apiGet(`/api/wizard/video-poll/${results.postId}`);
          setVideoProgress(Math.min(95, pollCount * 3));
          if (status === 'completed' && videoUrl) {
            setVideoProgress(100);
            setResults(r => ({ ...r, mediaUrl: videoUrl, videoRendering: 'completed' }));
            clearInterval(pollInterval);
          } else if (status === 'failed') {
            setResults(r => ({ ...r, videoRendering: 'failed', imageFailed: true }));
            clearInterval(pollInterval);
          }
        } catch { /* silent — retry next tick */ }
      }, 6000);
    };

    const startSSE = async () => {
      try {
        const ticketRes = await wizardAPI.getStreamTicket(results.postId);
        if (cancelled) return;
        const ticket = ticketRes.data?.ticket;
        if (!ticket) { startPolling(); return; }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        es = new EventSource(`${baseUrl}/api/wizard/status/${results.postId}?ticket=${ticket}`);

        es.onmessage = (e) => {
          if (cancelled) return;
          try {
            const { status, progress, videoUrl } = JSON.parse(e.data);
            if (typeof progress === 'number') setVideoProgress(progress);
            if (status === 'ready' && videoUrl) {
              setVideoProgress(100);
              setResults(r => ({ ...r, mediaUrl: videoUrl, videoRendering: 'completed' }));
              es.close();
            } else if (status === 'failed') {
              setResults(r => ({ ...r, videoRendering: 'failed', imageFailed: true }));
              es.close();
            }
          } catch {}
        };

        es.onerror = () => {
          es.close();
          if (!cancelled) startPolling();
        };
      } catch {
        if (!cancelled) startPolling();
      }
    };

    startSSE();

    return () => {
      cancelled = true;
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [results?.videoRendering, results?.postId]);

  // Prefetch Studio editor bundle as soon as results appear — eliminates the long load on "Edit in Studio"
  useEffect(() => {
    if (step === 'results' && results?.mediaUrl) {
      router.prefetch('/templates/editor');
    }
  }, [step, results?.mediaUrl]);

  // Auto-select accounts that match the chosen platform when results load
  useEffect(() => {
    if (step !== 'results' || !results || socialAccountsList.length === 0) return;
    const targetPlatforms = results.platform === 'all'
      ? ['facebook', 'instagram', 'google_business', 'linkedin', 'tiktok']
      : [results.platform].filter(Boolean);
    const matching = socialAccountsList.filter(a => targetPlatforms.includes(a.platform)).map(a => a.id);
    setSelectedWizardAccountIds(matching.length > 0 ? matching : socialAccountsList.map(a => a.id));
  }, [step, results?.platform, socialAccountsList]);

  const canProceed = () => {
    if (step === 1) return !!contentType;
    if (step === 2) return true; // format is optional — Skip sets Universal
    if (step === 3) return !!theme;
    if (step === 4) return !!tone;
    if (step === 5) return true;
    if (step === 6) return selectedPlatforms.length > 0;
    return false;
  };

  const handleLoadTemplate = async (tmpl) => {
    const s = tmpl.settings || {};
    if (s.contentType) setContentType(s.contentType);
    if (s.tone) setTone(s.tone);
    if (Array.isArray(s.platforms) && s.platforms.length > 0) setSelectedPlatforms(s.platforms);
    if (s.selectedFormat) setSelectedFormat(s.selectedFormat);
    setShowTemplatePicker(false);
    showToast('success', `Template "${tmpl.name}" applied`);
    templatesAPI.use(tmpl.id).catch(() => {});
    setTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, usage_count: (t.usage_count || 0) + 1 } : t));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const settings = {
        contentType,
        tone,
        platforms: selectedPlatforms,
        selectedFormat: selectedFormat || null,
      };
      const res = await templatesAPI.create({ name: templateName.trim(), settings });
      setTemplates(prev => [res.data, ...prev]);
      setShowSaveTemplate(false);
      setTemplateName('');
      showToast('success', 'Template saved!');
    } catch (e) {
      showToast('error', e.response?.data?.error || 'Failed to save template');
    }
  };

  // Format encodes platform — skip step 6 ("Where to post?") when a specific format is chosen
  const formatSkipsPlatformStep = selectedFormat && selectedFormat.id !== 'universal';

  // Video formats (9:16 story/reel/video types) force video generation even for non-video content types.
  // This must mirror the backend's `isVideoPost` logic so credit display and loading messages are correct.
  const VIDEO_FORMAT_IDS = ['ig-story', 'ig-reel', 'fb-story', 'li-video', 'tt-video', 'tt-story'];
  const fmtForcesVideo = selectedFormat?.id && VIDEO_FORMAT_IDS.includes(selectedFormat.id);
  const effectiveContentTypeForDisplay = fmtForcesVideo ? 'video' : contentType;

  const handleNext = async () => {
    if (step === 5 && formatSkipsPlatformStep) { await handleGenerate(); }
    else if (step === 6) { await handleGenerate(); }
    else setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 1) { router.push('/dashboard'); return; }
    if (step === 'results') { setStep(formatSkipsPlatformStep ? 5 : 6); return; }
    setStep(s => s - 1);
  };

  const handleReset = () => {
    setStep(1); setContentType(null); setVideoType('services'); setTheme(null); setTone(null); setSelectedPlatforms([]);
    setDetails(''); setIncludeCTA(true); setResults(null); setError(null);
    setSelectedFormat(null); setFormatTab('Popular'); setHoveredFormat(null); setSelectedPlatformTab('instagram_feed');
    setSelectedVariation('A'); setSelectedCardStyle('A'); setActiveSlide(0); setActionLoading(false); setActionToast(null);
    setExtraCarouselDesigns({});
    setSvgCards(null); setActiveSvg(null); setCardEditOpen(false); setEditingOverlay(null);
    setShowScheduleModal(false); setScheduleDate(''); setIsEditing(false); setEditedCaption('');
    setSmartScheduleDismissed(false);
  };

  const handleFormatSelect = (fmt) => {
    setSelectedFormat(fmt);
    // Pre-fill platform selection to match the chosen format so step 6 can be skipped
    if (!fmt.platform || fmt.platform === 'all') {
      setSelectedPlatforms([...ALL_PLATFORM_IDS]);
    } else {
      // Map format platform name to the platform ID used in selectedPlatforms
      const pid = fmt.platform; // they share the same naming
      if (ALL_PLATFORM_IDS.includes(pid)) setSelectedPlatforms([pid]);
    }
    setTimeout(() => setStep(3), 180);
  };

  const handleTryDifferentTone = () => {
    setStep(4); setTone(null); setResults(null);
  };

  const ALL_PLATFORM_IDS = PLATFORMS.filter(p => p.id !== 'all').map(p => p.id);

  const togglePlatform = (id) => {
    if (id === 'all') {
      setSelectedPlatforms(prev =>
        prev.length === ALL_PLATFORM_IDS.length ? [] : [...ALL_PLATFORM_IDS]
      );
    } else {
      setSelectedPlatforms(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    }
  };

  // ── SVG live editing helpers ───────────────────────────────────────────────
  // Mirror of backend wrapText — same logic, same maxChars per template
  function wrapTextFE(text, maxChars) {
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (candidate.length > maxChars && cur) { lines.push(cur); cur = word; }
      else { cur = candidate; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Update a single data-field in the active SVG string without a network call.
  // Returns the new SVG string (caller is responsible for setActiveSvg).
  function patchSvgField(currentSvg, field, value, overlayState) {
    if (!currentSvg || typeof document === 'undefined') return currentSvg;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentSvg, 'image/svg+xml');
      const uppercase = overlayState?.uppercase !== false;

      if (field === 'headline') {
        // Recalculate wrapped lines (max 13 chars — safe default across all 3 templates)
        const display = uppercase ? String(value).toUpperCase() : String(value);
        const lines = wrapTextFE(display, 13);
        for (let i = 0; i < 4; i++) {
          const el = doc.querySelector(`[data-field="headline-${i}"]`);
          if (el) el.textContent = lines[i] !== undefined ? lines[i] : '';
        }
      } else if (field === 'eyebrow') {
        const el = doc.querySelector('[data-field="eyebrow"]');
        if (el) el.textContent = String(value).toUpperCase();
      } else if (field === 'subtext') {
        // Update the first subtext line (accent pill in Template C, plain text in A/B)
        const el = doc.querySelector('[data-field="subtext-0"]');
        if (el) el.textContent = String(value);
        // Clear remaining subtext lines so stale text doesn't show
        for (let i = 1; i < 4; i++) {
          const el2 = doc.querySelector(`[data-field="subtext-${i}"]`);
          if (el2) el2.textContent = '';
        }
      } else if (field === 'cta') {
        const el = doc.querySelector('[data-field="cta"]');
        if (el) el.textContent = String(value).toUpperCase();
      } else if (field === 'badge') {
        const el = doc.querySelector('[data-field="badge"]');
        if (el) el.textContent = String(value).toUpperCase();
      } else if (field === 'services') {
        const arr = Array.isArray(value) ? value : [];
        for (let i = 0; i < 4; i++) {
          const el = doc.querySelector(`[data-field="service-${i}"]`);
          if (el) el.textContent = arr[i] || '';
        }
      }

      return new XMLSerializer().serializeToString(doc);
    } catch {
      return currentSvg; // silent fail — SVG stays unchanged
    }
  }

  // Click on a text element in the SVG preview → open editor + focus that field
  function handleSvgClick(e) {
    const target = e.target;
    const field = target.getAttribute?.('data-field') ||
                  target.closest?.('[data-field]')?.getAttribute('data-field');
    if (!field) return;

    const fieldToInputId = {
      eyebrow: 'card-input-eyebrow',
      badge:   'card-input-badge',
      cta:     'card-input-cta',
      phone:   null, // phone is not editable (comes from profile)
    };
    if (field.startsWith('headline')) fieldToInputId[field] = 'card-input-headline';
    if (field.startsWith('subtext'))  fieldToInputId[field] = 'card-input-subtext';
    if (field.startsWith('service'))  fieldToInputId[field] = 'card-input-services';

    const inputId = fieldToInputId[field];
    if (!inputId) return;

    if (!cardEditOpen) {
      setEditingOverlay(JSON.parse(JSON.stringify(results.cardOverlay)));
      setCardEditOpen(true);
    }
    // Focus the matching input after state update renders
    setTimeout(() => {
      const el = document.getElementById(inputId);
      if (el) { el.focus(); el.select?.(); }
    }, 60);
  }

  const handleGenerate = async () => {
    setStep('loading');
    setLoadingMsgIdx(0);
    setError(null);
    setMascotMood('thinking', 'On it! Crafting your content...');
    try {
      const startRes = await apiPost('/api/wizard/start', {});
      const wizardId = startRes.wizardId;

      // Submit each step's answers so the backend session is populated
      await apiPost('/api/wizard/step', { wizardId, stepId: 'content_type_selection', answers: { value: contentType } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'content_type', answers: { value: theme } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'tone', answers: { value: tone } });
      const detailsObj = buildDetailsObject(theme, details.trim());
      await apiPost('/api/wizard/step', { wizardId, stepId: 'details', answers: { ...detailsObj, includeCTA } });
      const platformValue = selectedPlatforms.length >= ALL_PLATFORM_IDS.length ? 'all' :
        selectedPlatforms.length === 1 ? selectedPlatforms[0] : 'all';
      await apiPost('/api/wizard/step', { wizardId, stepId: 'platform', answers: { value: platformValue } });
      if (selectedFormat) {
        await apiPost('/api/wizard/step', { wizardId, stepId: 'selected_format', answers: { value: selectedFormat } });
      }
      if (contentType === 'video') {
        await apiPost('/api/wizard/step', { wizardId, stepId: 'video_type', answers: { value: videoType } });
      }

      const genRes = await apiPost('/api/wizard/generate', { wizardId });
      setResults(genRes);
      setExtraPhotoCardUrls({});
      setExtraCardsByPlatform({});
      setExtraCarouselDesigns({});
      setMoreDesignsModal(null);
      setSelectedCardStyle('A');
      setActiveSlide(0);
      setPreviewCaptionExpanded(false);
      setSelectedVariation(genRes.recommended || 'A');
      if (genRes.photoCardUrls && genRes.cardLineupIndex !== null && genRes.cardLineupIndex !== undefined) {
        const base = genRes.cardLineupIndex;
        setAltLineupQueue([(base + 1) % 3, (base + 2) % 3]);
      } else {
        setAltLineupQueue([]);
      }
      // Auto-select the result tab that matches the format the customer chose
      if (selectedFormat?.id && FORMAT_TO_RESULT_TAB[selectedFormat.id]) {
        setSelectedPlatformTab(FORMAT_TO_RESULT_TAB[selectedFormat.id]);
      }
      // Populate SVG live-preview cards
      if (genRes.svgCards) {
        setSvgCards(genRes.svgCards);
        setActiveSvg(genRes.svgCards[genRes.recommended || 'A'] || genRes.svgCards.A || null);
      }
      setStep('results');
      setMascotMood('excited', 'Here are your 3 variations — pick the one you love!');
      window.dispatchEvent(new Event('creditRefresh'));

      // Link this post back to the calendar plan that triggered the wizard
      if (calendarPlanId && genRes.postId) {
        calendarPlansAPI.update(calendarPlanId, { post_id: genRes.postId, status: 'briefed' }).catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.');
      setStep(formatSkipsPlatformStep ? 5 : 6); // return to last visible step
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const showToast = (type, message) => {
    setActionToast({ type, message });
    setTimeout(() => setActionToast(null), type === 'success' ? 6000 : 4000);
  };

  const handlePostNow = async () => {
    if (!results?.postId) return;
    setActionLoading(true);
    try {
      const rawPlatform = results.platform;
      const platforms = rawPlatform === 'all'
        ? ALL_PLATFORM_IDS
        : rawPlatform ? [rawPlatform] : [];

      // Record chosen variation + update media_url + platform-specific URLs before publishing
      try {
        const patchData = { chosenVariation: selectedVariation };
        const styleKey = selectedCardStyle;
        const styleUrl = extraPhotoCardUrls[styleKey] || results.photoCardUrls?.[styleKey] || results.photoCardUrls?.[selectedVariation];
        if (styleUrl) patchData.mediaUrl = styleUrl;
        // Pass platform-specific card sizes so Facebook gets 1200×630 and Instagram gets 1080×1350
        const extraPlatformEntry = extraCardsByPlatform[styleKey];
        if (extraPlatformEntry) {
          const pmu = {};
          if (extraPlatformEntry.facebook) pmu.facebook = extraPlatformEntry.facebook;
          if (extraPlatformEntry.instagram) pmu.instagram = extraPlatformEntry.instagram;
          if (extraPlatformEntry.google_business) pmu.google_business = extraPlatformEntry.google_business;
          if (Object.keys(pmu).length > 0) patchData.platformMediaUrls = pmu;
        } else if (results.photoCardsByPlatform) {
          const pmu = {};
          if (results.photoCardsByPlatform.facebook_feed?.[styleKey]) pmu.facebook = results.photoCardsByPlatform.facebook_feed[styleKey];
          if (results.photoCardsByPlatform.instagram_feed?.[styleKey]) pmu.instagram = results.photoCardsByPlatform.instagram_feed[styleKey];
          if (results.photoCardsByPlatform.google_business?.[styleKey]) pmu.google_business = results.photoCardsByPlatform.google_business[styleKey];
          if (Object.keys(pmu).length > 0) patchData.platformMediaUrls = pmu;
        }
        await apiPatch(`/api/posts/${results.postId}`, patchData);
      } catch {}
      wizardAPI.feedback({ postId: results.postId, variationSelected: selectedVariation, mediaKept: !!results.mediaUrl, wasPublished: true }).catch(() => {});

      if (platforms.length > 0 || selectedWizardAccountIds.length > 0) {
        const pubRes = await api.post('/api/social/publish', {
          postId: results.postId,
          accountIds: selectedWizardAccountIds.length > 0 ? selectedWizardAccountIds : undefined,
          platforms: selectedWizardAccountIds.length > 0 ? undefined : platforms,
        });
        const { posted = [], errors = [] } = pubRes.data;
        if (posted.length > 0 && errors.length === 0) {
          setMascotMood('celebrating', `🎉 Live on ${posted.join(', ')}!`);
          showToast('success', `Published to ${posted.join(', ')}!`);
          setPublishedTo(posted.join(', '));
          if (calendarPlanId) calendarPlansAPI.update(calendarPlanId, { status: 'published' }).catch(() => {});
          // Trigger first_post milestone if this is their first post
          if (!localStorage.getItem('has_posted')) {
            localStorage.setItem('has_posted', '1');
            setTimeout(() => triggerMilestone('first_post'), 4000);
          }
        } else if (posted.length > 0) {
          showToast('success', `Published to ${posted.join(', ')}. Some platforms failed.`);
        } else {
          showToast('error', errors.map(e => `${e.platform}: ${e.message}`).join('; ') || 'Publish failed');
        }
      } else {
        await apiPatch(`/api/posts/${results.postId}`, { status: 'posted' });
        showToast('success', 'Post published!');
        setPublishedTo('your feed');
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || err.message || 'Failed to publish');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleSubmit = async (force = false) => {
    if (!results?.postId || !scheduleDate) return;
    // Check for scheduling conflicts before committing (skip if user already confirmed)
    if (!force) {
      try {
        const rawPlatform = results.platform;
        const platforms = rawPlatform === 'all'
          ? ALL_PLATFORM_IDS
          : rawPlatform ? [rawPlatform] : ['facebook'];
        const conflictRes = await postsAPI.checkConflicts(scheduleDate, platforms, results.postId);
        const conflicts = conflictRes.data?.conflicts || [];
        if (conflicts.length > 0) {
          setScheduleConflicts(conflicts);
          return; // show conflict warning in modal — user can force-schedule
        }
      } catch {}
      setScheduleConflicts([]);
    }
    setActionLoading(true);
    try {
      const schedulePatch = { status: 'scheduled', scheduledDate: scheduleDate, chosenVariation: selectedVariation };
      const schedStyleKey = selectedCardStyle;
      const scheduleStyleUrl = extraPhotoCardUrls[schedStyleKey] || results.photoCardUrls?.[schedStyleKey] || results.photoCardUrls?.[selectedVariation];
      if (scheduleStyleUrl) schedulePatch.mediaUrl = scheduleStyleUrl;
      const schedExtraPlatform = extraCardsByPlatform[schedStyleKey];
      if (schedExtraPlatform) {
        const pmu = {};
        if (schedExtraPlatform.facebook) pmu.facebook = schedExtraPlatform.facebook;
        if (schedExtraPlatform.instagram) pmu.instagram = schedExtraPlatform.instagram;
        if (schedExtraPlatform.google_business) pmu.google_business = schedExtraPlatform.google_business;
        if (Object.keys(pmu).length > 0) schedulePatch.platformMediaUrls = pmu;
      } else if (results.photoCardsByPlatform) {
        const pmu = {};
        if (results.photoCardsByPlatform.facebook_feed?.[schedStyleKey]) pmu.facebook = results.photoCardsByPlatform.facebook_feed[schedStyleKey];
        if (results.photoCardsByPlatform.instagram_feed?.[schedStyleKey]) pmu.instagram = results.photoCardsByPlatform.instagram_feed[schedStyleKey];
        if (results.photoCardsByPlatform.google_business?.[schedStyleKey]) pmu.google_business = results.photoCardsByPlatform.google_business[schedStyleKey];
        if (Object.keys(pmu).length > 0) schedulePatch.platformMediaUrls = pmu;
      }
      await apiPatch(`/api/posts/${results.postId}`, schedulePatch);
      wizardAPI.feedback({ postId: results.postId, variationSelected: selectedVariation, mediaKept: !!results.mediaUrl, wasPublished: false }).catch(() => {});
      setShowScheduleModal(false);
      setScheduleConflicts([]);
      showToast('success', 'Post scheduled!');
      if (calendarPlanId) calendarPlansAPI.update(calendarPlanId, { status: 'scheduled' }).catch(() => {});
    } catch (err) {
      showToast('error', err.message || 'Failed to schedule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!results?.postId || !editedCaption.trim()) return;
    setActionLoading(true);
    try {
      await apiPatch(`/api/posts/${results.postId}`, { caption: editedCaption.trim() });
      setResults(r => ({
        ...r,
        variations: {
          ...r.variations,
          [selectedVariation]: { ...r.variations[selectedVariation], caption: editedCaption.trim() },
        },
      }));
      setIsEditing(false);
      // Signal to PostCore Brain: customer edited this caption (quality signal)
      wizardAPI.feedback({ postId: results.postId, variationSelected: selectedVariation, wasEdited: true }).catch(() => {});
      showToast('success', 'Caption saved!');
    } catch (err) {
      showToast('error', err.message || 'Failed to save');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStart = () => {
    const variation = results?.variations?.[selectedVariation];
    setEditedCaption(variation?.caption || '');
    setIsEditing(true);
  };

  const handleDownload = async (withWatermark) => {
    if (!results?.mediaUrl) return;
    setDownloading(true);
    try {
      const activeMediaUrl = extraPhotoCardUrls[selectedCardStyle] || results.photoCardUrls?.[selectedCardStyle] || results.photoCardUrls?.[selectedVariation] || results.mediaUrl;
      const res = await wizardAPI.downloadImage({
        mediaUrl: activeMediaUrl,
        postId: results.postId,
        withWatermark,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itsposting-post${withWatermark ? '-branded' : ''}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (withWatermark) showToast('success', '+5 credits added to your account!');
      setDownloadModal(false);
    } catch (err) {
      showToast('error', 'Download failed. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Helper — resolves a card style key (A-I) to its URL, checking extra designs first
  const getCardUrl = (style) =>
    extraPhotoCardUrls[style] || results?.photoCardUrls?.[style] || null;

  const getCarouselSlideUrl = (designKey, slideIndex) =>
    extraCarouselDesigns[designKey]?.[slideIndex]
    || results?.carouselCardDesigns?.[designKey]?.[slideIndex]
    || results?.mediaVariants?.slides?.[slideIndex]?.imageUrl
    || null;

  const loadMoreDesigns = async () => {
    if (loadingMoreDesigns || altLineupQueue.length === 0) return;
    const isCarousel = results?.contentTypeSelection === 'carousel';
    if (!isCarousel && !results?.rawPhotoUrl) return;
    if (isCarousel && !results?.rawSlideUrls?.length) return;
    setLoadingMoreDesigns(true);
    const [nextIdx, ...remaining] = altLineupQueue;
    try {
      const loadedCount = Object.keys(extraPhotoCardUrls).length;
      const keyGroups = [['D','E','F'], ['G','H','I']];
      const keys = keyGroups[Math.floor(loadedCount / 3)] || keyGroups[0];

      if (isCarousel) {
        const { data } = await wizardAPI.moreDesigns({
          slideUrls: results.rawSlideUrls,
          slideOverlayTexts: results.slideOverlayTexts || [],
          slideData: results.slideMetadata || [],
          wizardTrigger: results.cardTrigger,
          lineupIndex: nextIdx,
        });
        const newDesigns = {};
        const newThumbs = {};
        if (data.carouselDesigns?.A) { newDesigns[keys[0]] = data.carouselDesigns.A; newThumbs[keys[0]] = data.cards?.A; }
        if (data.carouselDesigns?.B) { newDesigns[keys[1]] = data.carouselDesigns.B; newThumbs[keys[1]] = data.cards?.B; }
        if (data.carouselDesigns?.C) { newDesigns[keys[2]] = data.carouselDesigns.C; newThumbs[keys[2]] = data.cards?.C; }
        setExtraCarouselDesigns(prev => ({ ...prev, ...newDesigns }));
        setExtraPhotoCardUrls(prev => ({ ...prev, ...newThumbs }));
      } else {
        const { data } = await wizardAPI.moreDesigns({
          photoUrl: results.rawPhotoUrl,
          cardOverlay: results.cardOverlay,
          wizardTrigger: results.cardTrigger,
          lineupIndex: nextIdx,
        });
        const cardA = data.cards?.A;
        const cardB = data.cards?.B;
        const cardC = data.cards?.C;
        const newExtras = {};
        const newByPlatform = {};
        if (cardA) {
          newExtras[keys[0]] = cardA;
          if (data.cardsByPlatform) newByPlatform[keys[0]] = { facebook: data.cardsByPlatform.facebook_feed?.A, instagram: data.cardsByPlatform.instagram_feed?.A, google_business: data.cardsByPlatform.google_business?.A };
        }
        if (cardB) {
          newExtras[keys[1]] = cardB;
          if (data.cardsByPlatform) newByPlatform[keys[1]] = { facebook: data.cardsByPlatform.facebook_feed?.B, instagram: data.cardsByPlatform.instagram_feed?.B, google_business: data.cardsByPlatform.google_business?.B };
        }
        if (cardC) {
          newExtras[keys[2]] = cardC;
          if (data.cardsByPlatform) newByPlatform[keys[2]] = { facebook: data.cardsByPlatform.facebook_feed?.C, instagram: data.cardsByPlatform.instagram_feed?.C, google_business: data.cardsByPlatform.google_business?.C };
        }
        setExtraPhotoCardUrls(prev => ({ ...prev, ...newExtras }));
        setExtraCardsByPlatform(prev => ({ ...prev, ...newByPlatform }));
      }
      setAltLineupQueue(remaining);
      setMoreDesignsModal(true);
    } catch (err) {
      console.error('[Wizard] loadMoreDesigns failed:', err);
      showToast('error', 'Failed to load more designs. Please try again.');
    } finally {
      setLoadingMoreDesigns(false);
    }
  };

  const selectMoreDesign = (key) => {
    setSelectedCardStyle(key);
    setActiveSvg(null);
    setMoreDesignsModal(null);
  };

  const totalSteps = formatSkipsPlatformStep ? 5 : 6;
  const stepNum = typeof step === 'number' ? step : (step === 'results' ? totalSteps + 1 : totalSteps + 0.5);
  const progressPct = Math.min(100, ((stepNum - 1) / totalSteps) * 100);
  const stepLabels = formatSkipsPlatformStep
    ? ['Content type', 'Format', "What's happening?", "What's the vibe?", 'Any details?']
    : ['Content type', 'Format', "What's happening?", "What's the vibe?", 'Any details?', 'Where to post?'];

  return (
    <Layout title="Post Wizard" subtitle={`Guided content creation — powered by ${aiName}`}>
      <div style={{ maxWidth: step === 'results' ? 'none' : 800, margin: '0 auto', transition: 'max-width 300ms ease' }}>
        <style>{`
          @keyframes wizCardPop  { 0%{transform:translateY(-5px) scale(1.04)} 30%{transform:translateY(-7px) scale(1.06)} 100%{transform:translateY(-5px) scale(1.04)} }
          @keyframes wizLabelIn  { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
          @keyframes wizPencilIn { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>

        {/* ── Onboarding welcome banner ── */}
        {isOnboarding && step === 1 && (
          <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(91,63,240,0.06))', border: `1px solid ${t.primaryBorder}`, borderRadius: 14, padding: '18px 22px', marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpSparkle size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Welcome! Let's create your first post.</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>{aiName} will write 3 ready-to-use variations tailored to your industry. Just answer a few quick questions — it takes under 60 seconds.</div>
            </div>
          </div>
        )}

        {/* ── Progress pill strip ── */}
        {typeof step === 'number' && (
          <div style={{ marginBottom: 32 }}>
            {isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, flexShrink: 0 }}>{step}/{totalSteps}</span>
                <div style={{ flex: 1, height: 4, background: t.isDark ? 'rgba(255,255,255,0.06)' : t.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.primaryLight || '#9B7BFF'})`, borderRadius: 4, transition: 'width 500ms cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 8px rgba(124,92,252,0.4)' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepLabels[step - 1]}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {stepLabels.flatMap((label, i) => {
                  const isDone = step > i + 1;
                  const isActive = step === i + 1;
                  const pill = (
                    <div key={`pill-${i}`} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: isActive ? '7px 15px 7px 8px' : '6px 10px',
                      borderRadius: 20, flexShrink: 0,
                      background: isDone
                        ? 'rgba(34,197,94,0.1)'
                        : isActive
                          ? `linear-gradient(135deg, ${t.primary}, ${t.primaryLight || '#9B7BFF'})`
                          : t.isDark ? 'rgba(255,255,255,0.04)' : t.input,
                      border: isDone
                        ? '1.5px solid rgba(34,197,94,0.35)'
                        : isActive
                          ? 'none'
                          : `1.5px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`,
                      boxShadow: isActive ? `0 4px 16px rgba(124,92,252,0.42), inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      transition: 'all 350ms cubic-bezier(0.34,1.56,0.64,1)',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone
                          ? 'rgba(34,197,94,0.18)'
                          : isActive
                            ? 'rgba(255,255,255,0.18)'
                            : 'transparent',
                        fontSize: 11, fontWeight: 800,
                        color: isDone ? '#22C55E' : isActive ? '#fff' : t.textMuted,
                        transition: 'all 300ms ease',
                      }}>
                        {isDone ? <IpCheck size={11} color="#22C55E" strokeWidth={3} /> : i + 1}
                      </div>
                      {isActive && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', animation: 'wizLabelIn 280ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                          {label}
                        </span>
                      )}
                    </div>
                  );
                  const connector = i < stepLabels.length - 1 ? (
                    <div key={`con-${i}`} style={{ flex: 1, height: 2, minWidth: 6, background: step > i + 1 ? 'rgba(34,197,94,0.28)' : t.isDark ? 'rgba(255,255,255,0.06)' : t.border, transition: 'background 400ms ease' }} />
                  ) : null;
                  return connector ? [pill, connector] : [pill];
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 1 — Content Type Selection
        ───────────────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="step-enter">
            <StepHeading t={t} icon="text_post" title="What type of post?" sub="Choose the format that works best for your content" />

            {/* ── Load saved template ── */}
            {templates.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setShowTemplatePicker(p => !p)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: showTemplatePicker ? t.primaryBg : 'rgba(255,255,255,0.04)', border: `1px solid ${showTemplatePicker ? t.primaryBorder : t.border}`, borderRadius: 20, fontSize: 12, fontWeight: 600, color: showTemplatePicker ? t.primary : t.textSecondary, cursor: 'pointer' }}
                >
                  <IpSparkle size={12} color={showTemplatePicker ? 'url(#brand-gradient)' : undefined} /> Load a saved template
                </button>
                {showTemplatePicker && (
                  <div style={{ marginTop: 10, padding: '12px 14px', background: t.isDark ? 'rgba(12,12,20,0.92)' : t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadowMd }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Your templates
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {templates.map(tmpl => (
                        <button key={tmpl.id} onClick={() => handleLoadTemplate(tmpl)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tmpl.name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                              {tmpl.settings?.contentType || 'photo'} · {tmpl.settings?.tone || 'friendly'} · used {tmpl.usage_count || 0}×
                            </div>
                          </div>
                          <IpArrowRight size={14} color={t.textMuted} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: contentType === 'video' ? 20 : 32 }}>
              {CONTENT_TYPES.map((item) => {
                const selected = contentType === item.id;
                return (
                  <ThemeCard key={item.id} selected={selected} onClick={() => setContentType(item.id)} t={t}>
                    <div style={{ marginBottom: 10 }}><Icon name={item.icon} size={32} color={selected ? 'url(#brand-gradient)' : undefined} /></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                    <div style={{ fontSize: 10, color: t.primary, fontWeight: 600, marginTop: 6 }}>{item.credits} credit{item.credits !== 1 ? 's' : ''}</div>
                  </ThemeCard>
                );
              })}
            </div>

            {/* Video type sub-selection — shown only when Video is chosen */}
            {contentType === 'video' && (
              <div style={{ marginBottom: 32, padding: '18px 20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  What style of video?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  {[
                    {
                      id: 'services',
                      Icon: IpVideo,
                      label: 'Services Video',
                      desc: 'Animated scene showing your work in action',
                      tag: 'Recommended',
                    },
                    {
                      id: 'avatar',
                      Icon: IpUser,
                      label: 'Avatar Video',
                      desc: 'AI presenter talks to camera about your business',
                      tag: null,
                    },
                  ].map(vt => {
                    const selected = videoType === vt.id;
                    return (
                      <button
                        key={vt.id}
                        onClick={() => setVideoType(vt.id)}
                        style={{
                          padding: '14px 16px',
                          border: `2px solid ${selected ? t.primary : t.border}`,
                          borderRadius: 12,
                          background: selected ? `${t.primary}12` : t.card,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 150ms, background 150ms, transform 150ms, box-shadow 150ms',
                          position: 'relative',
                          boxShadow: selected ? `0 0 0 3px ${t.focusRing}` : 'none',
                        }}
                        onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = `${t.primary}70`; e.currentTarget.style.background = `${t.primary}06`; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                        onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; e.currentTarget.style.transform = 'translateY(0)'; } }}
                      >
                        {vt.tag && (
                          <div style={{ position: 'absolute', top: -1, right: 12, background: t.primary, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: '0 0 6px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {vt.tag}
                          </div>
                        )}
                        <div style={{ marginBottom: 8 }}><vt.Icon size={22} color={selected ? t.primary : t.textMuted} /></div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? t.primary : t.text, marginBottom: 4 }}>{vt.label}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{vt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <WizardNav t={t} onBack={handleBack} onNext={handleNext} canNext={canProceed()} nextLabel="Next →" />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 2 — Choose Format
        ───────────────────────────────────────────────────────────────────── */}
        {step === 2 && (() => {
          const recFormats = RECOMMENDED_FORMATS[contentType] || RECOMMENDED_FORMATS.photo;
          const ctLabel = CONTENT_TYPES.find(c => c.id === contentType)?.label || 'post';
          const subtext = {
            video:    'Vertical formats get the most reach for video',
            carousel: 'Square and portrait sizes work best for carousels',
            photo:    'Portrait formats stop the scroll better than landscape',
            static:   'Different platforms reward different sizes',
          }[contentType] || 'Pick the platform size that fits your post';

          const TEXT_POST_TAGLINES = {
            instagram:       'Caption style',
            facebook:        'Caption style',
            linkedin:        'Caption style',
            google_business: 'Caption style',
            tiktok:          'Tweet style',
          };
          const fmtIconMap = { facebook: IpFacebook, instagram: IpInstagram, linkedin: IpLinkedIn, tiktok: IpTikTok, google_business: IpGoogle };
          const tabIconMap = { Facebook: IpFacebook, Instagram: IpInstagram, LinkedIn: IpLinkedIn, TikTok: IpTikTok, Google: IpGoogle };

          const FormatCard = ({ fmt, isSelected, uid, size = 'md', isBest = false, contentType: ct }) => {
            const pColor = FORMAT_PLATFORM_COLORS[fmt.platform] || t.primary;
            const PIcon = fmtIconMap[fmt.platform];
            const isHovered = hoveredFormat === uid;
            return (
              <button
                onClick={() => handleFormatSelect(fmt)}
                onMouseEnter={() => setHoveredFormat(uid)}
                onMouseLeave={() => setHoveredFormat(null)}
                style={{
                  padding: size === 'lg' ? '18px 14px 16px' : '14px 10px 12px',
                  border: `2px solid ${isSelected ? pColor : isHovered ? pColor + '60' : t.border}`,
                  borderRadius: 14,
                  background: isSelected ? `${pColor}12` : isHovered ? `${pColor}06` : t.card,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: size === 'lg' ? 14 : 10,
                  transition: 'border-color 150ms, background 150ms, transform 150ms, box-shadow 150ms',
                  transform: isHovered && !isSelected ? 'translateY(-3px)' : 'none',
                  boxShadow: isSelected ? `0 0 0 3px ${pColor}20, 0 4px 16px ${pColor}18` : isHovered ? `0 6px 20px ${pColor}18` : 'none',
                  position: 'relative',
                }}
              >
                {/* Best pick ribbon */}
                {isBest && (
                  <div style={{ position: 'absolute', top: -1, right: 12, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight || t.primary})`, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: '0 0 6px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Best pick
                  </div>
                )}
                {/* Checkmark when selected */}
                {isSelected && (
                  <div style={{ position: 'absolute', top: 8, left: 10, width: 18, height: 18, borderRadius: '50%', background: pColor, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${pColor}50` }}>
                    <IpCheck size={10} color="#fff" strokeWidth={3} />
                  </div>
                )}
                {/* Fixed-height mockup container keeps all cards in a row vertically aligned */}
                <div style={{ height: size === 'lg' ? 130 : 102, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FormatMockup width={fmt.width} height={fmt.height} platformColor={pColor} PlatformIcon={PIcon} size={size} contentType={ct} formatId={fmt.id} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: size === 'lg' ? 13 : 11, fontWeight: 700, color: isSelected ? pColor : t.text, lineHeight: 1.3, marginBottom: 3 }}>{fmt.label}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
                    {ct === 'static' ? (TEXT_POST_TAGLINES[fmt.platform] || fmt.sublabel) : fmt.sublabel}
                  </div>
                  {(isHovered || isSelected) && ct !== 'static' && (
                    <div style={{ fontSize: 10, color: `${pColor}cc`, marginTop: 3, fontWeight: 600 }}>{fmt.width}×{fmt.height}</div>
                  )}
                  {FORMAT_REACH_HINTS[fmt.id] && (
                    <div style={{ fontSize: 9, color: fmt.id === 'universal' ? t.primary : t.textMuted, marginTop: 4, fontWeight: fmt.id === 'universal' ? 700 : 500, lineHeight: 1.3, opacity: 0.9 }}>
                      {FORMAT_REACH_HINTS[fmt.id]}
                    </div>
                  )}
                </div>
              </button>
            );
          };

          return (
            <div>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', marginBottom: 6 }}>Choose a format</h2>
                <p style={{ fontSize: 14, color: t.textMuted }}>{subtext}</p>
              </div>

              {/* ── Recommended row ── */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <IpSparkle size={12} color="url(#brand-gradient)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Best for {ctLabel}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
                  {recFormats.map((fmt, idx) => (
                    <FormatCard
                      key={`rec-${idx}`}
                      fmt={fmt}
                      uid={`rec-${idx}`}
                      isSelected={selectedFormat?.id === fmt.id}
                      size="lg"
                      isBest={idx === 0}
                      contentType={contentType}
                    />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ flex: 1, height: 1, background: t.border }} />
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>All formats</span>
                <div style={{ flex: 1, height: 1, background: t.border }} />
              </div>

              {/* ── Platform filter pills ── */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', padding: 4, background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, width: 'fit-content', boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}>
                {FORMAT_TABS.map(tab => {
                  const TIcon = tabIconMap[tab];
                  const active = formatTab === tab;
                  const tColor = FORMAT_PLATFORM_COLORS[tab.toLowerCase()] || t.primary;
                  return (
                    <button key={tab} onClick={() => setFormatTab(tab)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer',
                      border: `1.5px solid ${active ? tColor : 'transparent'}`,
                      background: active ? `${tColor}14` : 'transparent',
                      color: active ? tColor : t.textMuted,
                      transition: 'all 150ms ease',
                      boxShadow: active ? `0 2px 8px ${tColor}20` : 'none',
                    }}>
                      {TIcon && <TIcon size={11} style={{ color: 'inherit' }} />}
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* ── All formats grid ── */}
              {(() => {
                const allowedIds = FORMAT_TYPE_FILTER[contentType];
                const visibleFormats = allowedIds
                  ? (FORMAT_DATA[formatTab] || []).filter(f => allowedIds.includes(f.id))
                  : (FORMAT_DATA[formatTab] || []);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
                    {visibleFormats.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px 0', fontSize: 13, color: t.textMuted }}>
                        No {contentType} formats for this platform — try another tab
                      </div>
                    ) : visibleFormats.map((fmt, idx) => (
                      <FormatCard
                        key={`${formatTab}-${idx}`}
                        fmt={fmt}
                        uid={`${formatTab}-${idx}`}
                        isSelected={selectedFormat?.id === fmt.id}
                        contentType={contentType}
                      />
                    ))}
                  </div>
                );
              })()}

              {/* ── Footer nav ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover || t.input}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <IpArrowLeft size={14} /> Back
                </button>
                <button onClick={() => { handleFormatSelect(UNIVERSAL_FMT); }} style={{ fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Skip for now
                </button>
              </div>
            </div>
          );
        })()}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 3 — What's happening today?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="step-enter">
            <StepHeading t={t} icon="sparkles" title="What's happening today?" sub="Pick the type of post you want to create" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
              {CONTENT_THEMES.map((item) => {
                const selected = theme === item.id;
                const desc = item.id === 'seasonal' ? seasonalDesc : item.desc;
                return (
                  <ThemeCard key={item.id} selected={selected} onClick={() => setTheme(item.id)} t={t}>
                    <div style={{ marginBottom: 10 }}><Icon name={item.icon} size={32} color={selected ? 'url(#brand-gradient)' : undefined} /></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{desc}</div>
                  </ThemeCard>
                );
              })}
            </div>
            <WizardNav t={t} onBack={handleBack} onNext={handleNext} canNext={canProceed()} nextLabel="Next →" />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 4 — What's the vibe?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="step-enter">
            <StepHeading t={t} icon="friendly" title="What's the vibe?" sub="Choose the tone that fits your brand today" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {TONES.map((item) => {
                const selected = tone === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTone(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 18, padding: '18px 20px',
                      background: selected
                        ? t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)'
                        : t.isDark ? 'rgba(15,15,24,0.68)' : t.card,
                      backdropFilter: 'blur(16px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                      border: `2px solid ${selected ? 'rgba(124,92,252,0.5)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                      borderRadius: 14, cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                      textAlign: 'left',
                      boxShadow: selected
                        ? `0 8px 28px rgba(124,92,252,0.22), 0 0 0 3px rgba(124,92,252,0.08), inset 0 1px 0 rgba(255,255,255,0.07)`
                        : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})`,
                      transform: selected ? 'translateY(-2px)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; e.currentTarget.style.background = t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px rgba(124,92,252,0.14), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.05' : '0.9'})`; } }}
                    onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.background = t.isDark ? 'rgba(15,15,24,0.68)' : t.card; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})`; } }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selected
                        ? t.isDark ? 'rgba(124,92,252,0.18)' : 'rgba(124,92,252,0.1)'
                        : t.isDark ? 'rgba(255,255,255,0.04)' : t.input,
                      border: `1px solid ${selected ? 'rgba(124,92,252,0.4)' : t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`,
                      boxShadow: selected ? '0 2px 10px rgba(124,92,252,0.2)' : 'none',
                      transition: 'all 200ms ease',
                    }}>
                      <Icon name={item.icon} size={26} color={selected ? 'url(#brand-gradient)' : undefined} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: selected ? t.primary : t.text, marginBottom: 4, transition: 'color 150ms' }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                    {selected && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(124,92,252,0.45)' }}>
                        <IpCheck size={12} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <WizardNav t={t} onBack={handleBack} onNext={handleNext} canNext={canProceed()} nextLabel="Next →" />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 5 — Add any details (optional)
        ───────────────────────────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="step-enter">
            <StepHeading t={t} icon="edit" title="Add any details" sub={`Optional — but the more context you give ${aiName}, the better the posts`} />

            {/* Summary pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, padding: '14px 16px', background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.06)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid rgba(124,92,252,0.2)`, borderRadius: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <SelectionPill t={t} icon={CONTENT_THEMES.find(x => x.id === theme)?.icon} label={CONTENT_THEMES.find(x => x.id === theme)?.label || ''} />
              <SelectionPill t={t} icon={TONES.find(x => x.id === tone)?.icon} label={TONES.find(x => x.id === tone)?.label || ''} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>
                Context for {aiName}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={getDetailsPlaceholder(theme)}
                rows={5}
                style={{
                  width: '100%', padding: '14px 16px', background: t.input,
                  border: `1px solid ${t.border}`, borderRadius: 10, color: t.text,
                  fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                  fontFamily: 'inherit', transition: 'border-color 150ms', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = t.primary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
              />
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                {details.length}/500 characters · {aiName} will generate 3 variations from this
              </div>
            </div>

            {/* Include CTA toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, marginBottom: 32, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Include phone number & call to action</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Add a call-to-action pointing to your contact info</div>
              </div>
              <Toggle value={includeCTA} onChange={setIncludeCTA} t={t} />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warning" size={15} color="#EF4444" /> {error}
              </div>
            )}

            {formatSkipsPlatformStep && (() => {
              const ct = CONTENT_TYPES.find(c => c.id === effectiveContentTypeForDisplay);
              if (!ct) return null;
              return (
                <div style={{ padding: '10px 14px', background: t.surfaceHover, borderRadius: 8, fontSize: 13, color: t.textMuted, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IpSparkle size={14} color={t.primary} />
                  This will use <strong style={{ color: t.text }}>&nbsp;{ct.credits} credit{ct.credits !== 1 ? 's' : ''}</strong> from your balance.
                  {fmtForcesVideo && contentType !== 'video' && (
                    <span style={{ marginLeft: 4 }}> — video format</span>
                  )}
                </div>
              );
            })()}

            <WizardNav t={t} onBack={handleBack} onNext={handleNext} canNext={true}
              nextLabel={formatSkipsPlatformStep ? <><IpSparkle size={14} /> Generate Posts</> : 'Next →'}
              nextStyle={formatSkipsPlatformStep ? { background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, padding: '12px 28px', fontSize: 15 } : undefined} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 6 — Where are we posting?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 6 && (
          <div className="step-enter">
            <StepHeading t={t} icon="all_platforms" title="Where are we posting?" sub={`Select one or more platforms — ${aiName} adapts the caption for each`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
              {PLATFORMS.map((item) => {
                const selected = item.id === 'all'
                  ? selectedPlatforms.length === ALL_PLATFORM_IDS.length
                  : selectedPlatforms.includes(item.id);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => togglePlatform(item.id)}
                    style={{
                      padding: '22px 16px', background: selected ? item.bg : t.card,
                      border: `2px solid ${selected ? item.color : t.border}`,
                      borderRadius: 14, cursor: 'pointer', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
                      textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative', transform: selected ? 'translateY(-2px)' : 'none',
                      boxShadow: selected ? `0 8px 24px ${item.bg}` : 'none',
                    }}
                    onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = item.border; e.currentTarget.style.background = item.bg; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                    onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; e.currentTarget.style.transform = 'none'; } }}
                  >
                    {selected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IpCheck size={10} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: selected ? item.bg : t.input, border: `1px solid ${selected ? item.border : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Icon size={22} style={{ color: item.color }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                  </button>
                );
              })}
            </div>
            {/* Selection summary */}
            <div style={{ marginBottom: 20, fontSize: 13, color: selectedPlatforms.length > 0 ? t.primary : t.textMuted, fontWeight: 500, minHeight: 20 }}>
              {selectedPlatforms.length === 0 && 'Select at least one platform to continue'}
              {selectedPlatforms.length === ALL_PLATFORM_IDS.length && `All ${ALL_PLATFORM_IDS.length} platforms selected`}
              {selectedPlatforms.length > 0 && selectedPlatforms.length < ALL_PLATFORM_IDS.length && `${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''} selected`}
            </div>
            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warning" size={15} color="#EF4444" /> {error}
              </div>
            )}
            {(() => {
              const ct = CONTENT_TYPES.find(c => c.id === contentType);
              if (!ct) return null;
              return (
                <div style={{ padding: '10px 14px', background: t.surfaceHover, borderRadius: 8, fontSize: 13, color: t.textMuted, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IpSparkle size={14} color={t.primary} />
                  This will use <strong style={{ color: t.text }}>&nbsp;{ct.credits} credit{ct.credits !== 1 ? 's' : ''}</strong> from your balance.
                </div>
              );
            })()}
            <WizardNav
              t={t} onBack={handleBack} onNext={handleNext} canNext={canProceed()}
              nextLabel={<><IpSparkle size={14} /> Generate Posts</>}
              nextStyle={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, padding: '12px 28px', fontSize: 15 }}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            LOADING SCREEN
        ───────────────────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 480, gap: 36, position: 'relative', overflow: 'hidden' }}>
            {/* Ambient glow orbs */}
            <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)', top: '10%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', animation: 'wiz-orb-1 4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,63,240,0.08) 0%, transparent 70%)', top: '20%', left: '30%', transform: 'translateX(-50%)', pointerEvents: 'none', animation: 'wiz-orb-2 5s ease-in-out 0.8s infinite' }} />

            {/* Main spinner + icon */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Outer glow ring */}
              <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.15) 0%, transparent 70%)', animation: 'wiz-pulse 2s ease-in-out infinite' }} />
              {/* Spinning arc */}
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: '#7C5CFC', borderRightColor: '#9B7BFF', animation: 'spin 1.1s linear infinite' }} />
              {/* Inner spinning arc (opposite) */}
              <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: 'rgba(124,92,252,0.4)', animation: 'spin 1.8s linear reverse infinite' }} />
              {/* Logo */}
              <img src="/fav-icon.png" alt="ItsPosting" width={88} height={88} style={{ borderRadius: 24, display: 'block', animation: 'wiz-pulse 2.4s ease-in-out 0.2s infinite', boxShadow: '0 8px 32px rgba(124,92,252,0.4), 0 2px 8px rgba(0,0,0,0.3)' }} />
            </div>

            {/* Text */}
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 10, letterSpacing: '-0.02em' }}>Crafting your posts...</div>
              <div style={{ fontSize: 14, color: t.primary, minHeight: 24, fontWeight: 500, transition: 'opacity 400ms ease', animation: 'wiz-fade-in 400ms ease' }}>
                {((LOADING_MESSAGES[effectiveContentTypeForDisplay] || LOADING_MESSAGES.photo)(industry, city, videoType))[loadingMsgIdx] || ''}
              </div>
            </div>

            {/* Animated dots */}
            <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 1 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: `linear-gradient(135deg, #7C5CFC, #9B7BFF)`, opacity: loadingMsgIdx % 3 === i ? 1 : 0.25, animation: `bounce 1.4s ease-in-out ${i * 0.18}s infinite`, boxShadow: loadingMsgIdx % 3 === i ? '0 0 8px rgba(124,92,252,0.6)' : 'none', transition: 'opacity 300ms, box-shadow 300ms' }} />
              ))}
            </div>

            {/* Progress track */}
            <div style={{ width: 220, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #7C5CFC, #9B7BFF)',
                width: `${Math.min(((loadingMsgIdx + 1) / ((LOADING_MESSAGES[effectiveContentTypeForDisplay] || LOADING_MESSAGES.photo)(industry, city, videoType).length)) * 100, 95)}%`,
                transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 8px rgba(124,92,252,0.5)',
              }} />
            </div>

            <style>{`
              @keyframes wiz-pulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:0.85} }
              @keyframes spin       { to{transform:rotate(360deg)} }
              @keyframes bounce     { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-10px)} }
              @keyframes wiz-orb-1  { 0%,100%{transform:translateX(-50%) scale(1);opacity:1} 50%{transform:translateX(-50%) scale(1.15);opacity:0.7} }
              @keyframes wiz-orb-2  { 0%,100%{transform:translateX(-50%) scale(1);opacity:0.8} 60%{transform:translateX(-40%) scale(1.2);opacity:0.4} }
              @keyframes wiz-fade-in{ 0%{opacity:0;transform:translateY(4px)} 100%{opacity:1;transform:translateY(0)} }
              @keyframes toast-drop-in{ 0%{opacity:0;transform:translateX(-50%) translateY(-14px) scale(0.96)} 100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
            `}</style>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            RESULTS SCREEN
        ───────────────────────────────────────────────────────────────────── */}
        {step === 'results' && results && (
          <div>
            {/* Toast notification */}
            {actionToast && (
              <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '14px 24px', borderRadius: 14, background: actionToast.type === 'success' ? '#16A34A' : '#DC2626', color: '#fff', fontSize: 15, fontWeight: 700, boxShadow: '0 12px 40px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 280, whiteSpace: 'nowrap', animation: 'toast-drop-in 280ms cubic-bezier(0.16,1,0.3,1)' }}>
                <Icon name={actionToast.type === 'success' ? 'check' : 'warning'} size={18} color="#fff" />
                {actionToast.message}
              </div>
            )}

            <div style={{ marginBottom: 28, textAlign: 'center', animation: 'fadeIn 400ms cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 14px', borderRadius: 20, background: t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.25)', fontSize: 12, fontWeight: 700, color: t.primary, letterSpacing: '0.04em' }}>
                <IpSparkle size={12} color={t.primary} /> {aiName} generated 3 variations
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginBottom: 6, letterSpacing: '-0.03em' }}>Your posts are ready</div>
              <div style={{ fontSize: 14, color: t.textMuted }}>Pick whichever sounds most like you — then post or schedule</div>
            </div>

            {/* Two-column layout — captions LEFT, card+preview RIGHT (sticky) */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row-reverse', alignItems: 'flex-start' }}>

              {/* ── RIGHT (visually): Card image + platform preview — sticky ── */}
              {results.contentTypeSelection !== 'static' && <div style={{ flex: isMobile ? '0 0 100%' : 1, minWidth: isMobile ? 0 : 340, maxWidth: isMobile ? '100%' : '50%', position: isMobile ? 'static' : 'sticky', top: 20, alignSelf: 'flex-start' }}>

                {/* Image/video failed banner */}
                {results.imageFailed && (
                  <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#D97706', marginBottom: results.contentTypeSelection === 'video' ? 8 : 0 }}>
                      <Icon name="warning" size={14} color="#D97706" />
                      {results.contentTypeSelection === 'video'
                        ? 'Your captions are ready. The video is still generating — check back in a few minutes to add it, or post the caption now.'
                        : 'Image generation failed — your caption is ready to post without an image.'}
                    </div>
                    {results.contentTypeSelection === 'video' && (
                      <button
                        onClick={handlePostNow}
                        disabled={actionLoading}
                        style={{ marginTop: 4, padding: '7px 14px', background: '#D97706', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Post Caption-Only
                      </button>
                    )}
                  </div>
                )}

                {/* Media display — aspect ratio tracks selected platform */}
                <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`, background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, aspectRatio: results.contentTypeSelection === 'carousel' ? (results.carouselCardDesigns ? '4/5' : '1/1') : (({ instagram_feed: '4/5', facebook_feed: '1/1', linkedin_feed: '1200/627', google_business: '4/3', instagram_square: '1/1' })[results.photoCardsByPlatform ? selectedPlatformTab : 'instagram_feed'] || '4/5'), display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, transition: 'aspect-ratio 250ms ease', boxShadow: `0 8px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
                  {results.mediaUrl && results.videoRendering !== true ? (
                    results.contentTypeSelection === 'video' ? (
                      <video src={results.mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : results.contentTypeSelection === 'carousel' ? (
                      (() => {
                        const carouselSlides = results.mediaVariants?.slides || [];
                        const slide = carouselSlides[activeSlide];
                        const slideImg = getCarouselSlideUrl(selectedCardStyle, activeSlide) || slide?.imageUrl || results.mediaUrl;
                        return (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img src={slideImg} alt={`Slide ${activeSlide + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {/* Only show text overlay on raw NanoBanana slides — card designs already have text baked in */}
                            {!results.carouselCardDesigns && slide?.overlayText && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
                                padding: '48px 18px 18px',
                                color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center',
                                textShadow: '0 1px 5px rgba(0,0,0,0.6)', lineHeight: 1.3,
                              }}>
                                {slide.overlayText}
                              </div>
                            )}
                            {carouselSlides.length > 1 && (
                              <>
                                {/* Slide counter badge */}
                                <div style={{
                                  position: 'absolute', top: 10, right: 10,
                                  background: 'rgba(0,0,0,0.55)', borderRadius: 20,
                                  padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fff',
                                  backdropFilter: 'blur(4px)',
                                }}>
                                  {activeSlide + 1} / {carouselSlides.length}
                                </div>
                                {/* Prev arrow */}
                                {activeSlide > 0 && (
                                  <button onClick={() => setActiveSlide(s => s - 1)} style={{
                                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                    width: 36, height: 36, cursor: 'pointer', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                  }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                                  </button>
                                )}
                                {/* Next arrow */}
                                {activeSlide < carouselSlides.length - 1 && (
                                  <button onClick={() => setActiveSlide(s => s + 1)} style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                                    width: 36, height: 36, cursor: 'pointer', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                  }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                                  </button>
                                )}
                                {/* Dot indicators */}
                                <div style={{
                                  position: 'absolute', bottom: (!results.carouselCardDesigns && slide?.overlayText) ? 50 : 12,
                                  left: '50%', transform: 'translateX(-50%)',
                                  display: 'flex', gap: 5, alignItems: 'center',
                                }}>
                                  {carouselSlides.map((_, i) => (
                                    <button key={i} onClick={() => setActiveSlide(i)} style={{
                                      width: i === activeSlide ? 18 : 6, height: 6,
                                      borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                                      background: i === activeSlide ? '#fff' : 'rgba(255,255,255,0.5)',
                                      transition: 'all 150ms ease',
                                    }} />
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()
                    ) : activeSvg && results.photoCardUrls && !extraPhotoCardUrls[selectedCardStyle] ? (
                      /* SVG live preview — browser renders directly, zero network latency.
                         Clicking a text element opens the editor and focuses the matching field. */
                      <div
                        onClick={handleSvgClick}
                        dangerouslySetInnerHTML={{ __html: activeSvg }}
                        style={{
                          width: '100%', lineHeight: 0,
                          cursor: cardEditOpen ? 'text' : 'pointer',
                        }}
                        title={cardEditOpen ? 'Click any text to jump to that field' : 'Click to edit card text'}
                      />
                    ) : (
                      <img
                        src={
                          // Platform-specific card for extra designs (D-I) — use per-platform URL if available
                          (extraCardsByPlatform[selectedCardStyle] && (
                            extraCardsByPlatform[selectedCardStyle][selectedPlatformTab === 'facebook_feed' ? 'facebook' : selectedPlatformTab === 'google_business' ? 'google_business' : 'instagram']
                          ))
                            // Fallback to primary extra design URL (no platform variant available)
                            || extraPhotoCardUrls[selectedCardStyle]
                            // Platform-specific card for initial styles (A-C)
                            || (results.photoCardsByPlatform?.[selectedPlatformTab]?.[selectedCardStyle])
                            || (results.photoCardsByPlatform?.[selectedPlatformTab]?.[selectedVariation])
                            || results.photoCardUrls?.[selectedCardStyle]
                            || results.photoCardUrls?.[selectedVariation]
                            || (results.contentTypeSelection === 'branded_card' && results.brandedCardUrls?.[selectedVariation])
                            || results.mediaUrl
                        }
                        alt="Generated post"
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          // Landscape platforms need different aspect ratio
                          aspectRatio: selectedPlatformTab === 'linkedin_feed' ? '1200/627' : selectedPlatformTab === 'google_business' ? '4/3' : undefined,
                        }}
                      />
                    )
                  ) : (results.videoRendering === true || (results.videoRendering && results.videoRendering !== 'completed' && results.videoRendering !== 'failed')) ? (
                    <div style={{ textAlign: 'center', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      {/* Animated progress ring */}
                      <div style={{ position: 'relative', width: 88, height: 88 }}>
                        <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
                          {/* Track */}
                          <circle cx="44" cy="44" r="38" fill="none" stroke={t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="5" />
                          {/* Progress arc */}
                          <circle
                            cx="44" cy="44" r="38" fill="none"
                            stroke="url(#vp-grad)" strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 38}`}
                            strokeDashoffset={`${2 * Math.PI * 38 * (1 - videoProgress / 100)}`}
                            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                          />
                          <defs>
                            <linearGradient id="vp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#7C5CFC" />
                              <stop offset="100%" stopColor="#A78BFA" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: t.primary, letterSpacing: '-0.02em' }}>{videoProgress}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                          {videoProgress < 30 ? 'Starting video generation...' : videoProgress < 70 ? 'Rendering your video...' : 'Almost done...'}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>Caption is ready — you can post text now</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, color: t.textMuted }}>
                      <Icon name="image" size={48} color={t.textMuted} />
                      <div style={{ fontSize: 12, marginTop: 8 }}>No image</div>
                    </div>
                  )}
                </div>

                {/* ── Card Style Picker — 3 template thumbnails (photo + carousel) ── */}
                {(results.contentTypeSelection === 'photo' || results.contentTypeSelection === 'carousel') && results.photoCardUrls && (
                  (() => {
                    const ALL_STYLE_KEYS = ['A','B','C','D','E','F','G','H','I'];
                    const styleLabels = { A:'Style 1',B:'Style 2',C:'Style 3',D:'Style 4',E:'Style 5',F:'Style 6',G:'Style 7',H:'Style 8',I:'Style 9' };
                    const allUrls = { ...results.photoCardUrls, ...extraPhotoCardUrls };
                    const styleKeys = ALL_STYLE_KEYS.filter(k => allUrls[k]);
                    if (styleKeys.length < 2) return null;
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Card Design</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {styleKeys.map(key => {
                            const isActive = selectedCardStyle === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setSelectedCardStyle(key);
                                  if (svgCards?.[key]) setActiveSvg(svgCards[key]);
                                  else if (extraPhotoCardUrls[key]) setActiveSvg(null);
                                }}
                                style={{
                                  padding: 0, border: `2px solid ${isActive ? t.primary : t.border}`,
                                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                                  background: 'none', position: 'relative',
                                  boxShadow: isActive ? `0 0 0 3px ${t.primary}30, 0 4px 16px rgba(0,0,0,0.18)` : '0 2px 8px rgba(0,0,0,0.12)',
                                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                                  transition: 'all 160ms cubic-bezier(0.34,1.56,0.64,1)',
                                }}
                              >
                                <img
                                  src={allUrls[key]}
                                  alt={styleLabels[key]}
                                  style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }}
                                />
                                <div style={{
                                  position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                                  background: isActive ? t.primary : 'rgba(0,0,0,0.60)',
                                  color: '#fff', fontSize: 9, fontWeight: 800,
                                  padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                                  letterSpacing: '0.04em', backdropFilter: 'blur(6px)',
                                }}>
                                  {styleLabels[key]}
                                </div>
                                {isActive && (
                                  <div style={{
                                    position: 'absolute', top: 6, right: 6,
                                    width: 20, height: 20, borderRadius: '50%',
                                    background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                  }}>
                                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                      <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Load more / all loaded button */}
                        {altLineupQueue.length > 0 ? (
                          <button
                            type="button"
                            onClick={loadMoreDesigns}
                            disabled={loadingMoreDesigns}
                            style={{
                              marginTop: 10, width: '100%', padding: '9px 14px',
                              background: t.isDark ? 'rgba(124,92,252,0.10)' : 'rgba(124,92,252,0.06)',
                              border: `1px dashed ${t.isDark ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.3)'}`,
                              borderRadius: 10, cursor: loadingMoreDesigns ? 'default' : 'pointer',
                              color: t.primary, fontSize: 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                              transition: 'opacity 150ms',
                              opacity: loadingMoreDesigns ? 0.6 : 1,
                            }}
                          >
                            {loadingMoreDesigns ? (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                                </svg>
                                Loading designs…
                              </>
                            ) : (
                              <>
                                <IpRefresh size={13} color={t.primary} />
                                Load {altLineupQueue.length === 2 ? '3' : '3'} more designs
                              </>
                            )}
                          </button>
                        ) : styleKeys.length > 3 ? (
                          <button
                            type="button"
                            onClick={() => setMoreDesignsModal(true)}
                            style={{
                              marginTop: 10, width: '100%', padding: '9px 14px',
                              background: t.isDark ? 'rgba(124,92,252,0.10)' : 'rgba(124,92,252,0.06)',
                              border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.3)'}`,
                              borderRadius: 10, cursor: 'pointer',
                              color: t.primary, fontSize: 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                            Browse all {styleKeys.length} designs
                          </button>
                        ) : null}
                      </div>
                    );
                  })()
                )}

                {/* ── Carousel Slide Thumbnails ── */}
                {results.contentTypeSelection === 'carousel' && (results.mediaVariants?.slides || []).length > 1 && (
                  (() => {
                    const slides = results.mediaVariants.slides;
                    const aspectR = results.carouselCardDesigns ? '4/5' : '1/1';
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                          Slides ({slides.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(slides.length, 5)}, 1fr)`, gap: 8 }}>
                          {slides.map((slide, i) => {
                            const isActive = i === activeSlide;
                            const thumbUrl = getCarouselSlideUrl(selectedCardStyle, i) || slide.imageUrl || null;
                            return (
                              <button key={i} type="button" onClick={() => setActiveSlide(i)} style={{
                                position: 'relative', border: `2px solid ${isActive ? t.primary : 'transparent'}`,
                                borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'none',
                                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                transition: 'all 160ms cubic-bezier(0.34,1.56,0.64,1)',
                              }}>
                                {thumbUrl ? (
                                  <img src={thumbUrl} alt={`Slide ${i + 1}`} style={{ width: '100%', aspectRatio: aspectR, objectFit: 'cover', display: 'block' }} />
                                ) : (
                                  <div style={{ width: '100%', aspectRatio: aspectR, background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 10, color: t.textMuted }}>Slide {i + 1}</span>
                                  </div>
                                )}
                                <div style={{
                                  position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
                                  background: isActive ? t.primary : 'rgba(0,0,0,0.60)',
                                  color: '#fff', fontSize: 9, fontWeight: 800,
                                  padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
                                  backdropFilter: 'blur(4px)',
                                }}>
                                  {i + 1}
                                </div>
                                {isActive && (
                                  <div style={{
                                    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                                    background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
                                      <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* ── Platform Tabs — show when platform-native cards are available ── */}
                {results.photoCardsByPlatform && Object.keys(results.photoCardsByPlatform).length > 1 && (
                  (() => {
                    const PLATFORM_TAB_META = {
                      instagram_feed:  { label: 'Instagram', Icon: IpInstagram, ratio: '4:5'    },
                      facebook_feed:   { label: 'Facebook',  Icon: IpFacebook,  ratio: '1:1'    },
                      google_business: { label: 'Google',    Icon: IpGoogle,    ratio: '4:3'    },
                      linkedin_feed:   { label: 'LinkedIn',  Icon: IpLinkedIn,  ratio: '1.91:1' },
                    };
                    const availablePlatforms = Object.keys(results.photoCardsByPlatform);
                    return (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                          Platform Preview
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {availablePlatforms.map(platform => {
                            const meta = PLATFORM_TAB_META[platform] || { label: platform, Icon: IpSparkle, ratio: '' };
                            const isActive = selectedPlatformTab === platform;
                            const TabIcon = meta.Icon;
                            return (
                              <button
                                key={platform}
                                type="button"
                                onClick={() => setSelectedPlatformTab(platform)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 12px', borderRadius: 20,
                                  background: isActive ? t.primary : t.isDark ? 'rgba(255,255,255,0.05)' : t.input,
                                  border: `1.5px solid ${isActive ? t.primary : t.border}`,
                                  color: isActive ? '#ffffff' : t.textSecondary,
                                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                                  cursor: 'pointer', transition: 'all 150ms ease',
                                  boxShadow: isActive ? `0 2px 10px ${t.primary}40` : 'none',
                                }}
                              >
                                <TabIcon size={13} color={isActive ? '#ffffff' : t.textSecondary} />
                                {meta.label}
                                <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>{meta.ratio}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Inline card text editor — photo posts with cardOverlay.
                    Live preview: every keystroke instantly patches the SVG in the preview
                    panel above (zero network). "Save to Post" finalises to JPEG via Sharp. */}
                {results.contentTypeSelection === 'photo' && results.cardOverlay && (
                  <div style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => {
                        if (!cardEditOpen) {
                          setEditingOverlay(JSON.parse(JSON.stringify(results.cardOverlay)));
                          // Sync SVG back to the saved state so form and preview start aligned
                          if (svgCards?.[selectedCardStyle]) setActiveSvg(svgCards[selectedCardStyle]);
                          else if (svgCards?.[selectedVariation]) setActiveSvg(svgCards[selectedVariation]);
                        }
                        setCardEditOpen(o => !o);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderRadius: cardEditOpen ? '10px 10px 0 0' : 10,
                        background: cardEditOpen ? t.primaryBg : 'transparent',
                        border: `1.5px solid ${cardEditOpen ? t.primaryBorder : t.border}`,
                        color: cardEditOpen ? t.primary : t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <span>Edit Card Text</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{cardEditOpen ? '▲ close' : '▼ open'}</span>
                    </button>
                    {cardEditOpen && editingOverlay && (
                      <div style={{ border: `1.5px solid ${t.primaryBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 14, background: t.card, display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Live-preview hint */}
                        {activeSvg && (
                          <div style={{ fontSize: 11, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '5px 10px' }}>
                            Preview updates as you type. Click any text on the card to jump to that field.
                          </div>
                        )}

                        {[
                          { key: 'headline', label: 'Headline',                      id: 'card-input-headline' },
                          { key: 'eyebrow',  label: 'Eyebrow (small text above)',    id: 'card-input-eyebrow'  },
                          { key: 'subtext',  label: 'Subtext',                       id: 'card-input-subtext'  },
                          { key: 'cta',      label: 'CTA button text',               id: 'card-input-cta'      },
                          { key: 'badge',    label: 'Badge (top-right trust pill)',  id: 'card-input-badge'    },
                        ].map(({ key, label, id }) => (
                          <div key={key}>
                            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</div>
                            <input
                              id={id}
                              value={editingOverlay[key] || ''}
                              onChange={e => {
                                const v = e.target.value;
                                setEditingOverlay(o => ({ ...o, [key]: v }));
                                // Instant SVG patch — no network call
                                setActiveSvg(prev => patchSvgField(prev, key, v, editingOverlay));
                              }}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                            />
                          </div>
                        ))}

                        <div>
                          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Services (one per line, shown as checklist on card)</div>
                          <textarea
                            id="card-input-services"
                            rows={3}
                            value={(editingOverlay.services || []).join('\n')}
                            onChange={e => {
                              const arr = e.target.value.split('\n');
                              setEditingOverlay(o => ({ ...o, services: arr.filter(Boolean) }));
                              // Patch services — include empty lines so line removal works
                              setActiveSvg(prev => patchSvgField(prev, 'services', arr, editingOverlay));
                            }}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Save to Post — finalises the edited text to proper JPEG via Sharp */}
                        <button
                          disabled={cardRerenderLoading}
                          onClick={async () => {
                            setCardRerenderLoading(true);
                            try {
                              const photoUrl = results.rawPhotoUrl || results.mediaUrl;
                              const { data } = await wizardAPI.rerenderCard({ photoUrl, cardOverlay: editingOverlay });
                              // Update JPEG cards and refresh SVG from server (canonical render)
                              setResults(r => ({
                                ...r,
                                cardOverlay: editingOverlay,
                                photoCardUrls: data.photoCardUrls,
                                mediaUrl: data.photoCardUrls[selectedVariation] || data.photoCardUrls.A,
                              }));
                              if (data.svgCards) {
                                setSvgCards(data.svgCards);
                                setActiveSvg(data.svgCards[selectedVariation] || data.svgCards.A);
                              }
                              setCardEditOpen(false);
                            } catch (err) {
                              showToast('error', 'Failed to save card. Please try again.');
                            } finally {
                              setCardRerenderLoading(false);
                            }
                          }}
                          style={{
                            width: '100%', padding: '10px', borderRadius: 8,
                            background: cardRerenderLoading ? t.border : '#7C5CFC',
                            color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                            cursor: cardRerenderLoading ? 'wait' : 'pointer',
                          }}
                        >
                          {cardRerenderLoading ? 'Saving…' : 'Save to Post'}
                        </button>
                        <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center' }}>
                          Preview above updates live. Save finalises to high-quality image.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit in Studio CTA — only for image posts with a generated image */}
                {results.mediaUrl && results.contentTypeSelection !== 'video' && results.videoRendering !== true && (
                  <button
                    onClick={() => {
                      const cardUrl = results.contentTypeSelection === 'photo'
                        ? getCardUrl(selectedCardStyle)
                        : results.contentTypeSelection === 'carousel'
                        ? (getCarouselSlideUrl(selectedCardStyle, activeSlide) || results.mediaUrl)
                        : null;
                      router.push(`/templates/editor?addImage=${encodeURIComponent(cardUrl || results.mediaUrl)}&size=ig_portrait`);
                    }}
                    style={{
                      width: '100%', marginBottom: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 10,
                      background: 'transparent', border: `1.5px solid ${t.border}`,
                      color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C5CFC'; e.currentTarget.style.background = t.primaryBg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 15 }}>✐</span>
                    Edit in Studio
                  </button>
                )}

                {/* Download image button */}
                {results.mediaUrl && results.contentTypeSelection !== 'video' && results.videoRendering !== true && (
                  <button
                    onClick={() => setDownloadModal(true)}
                    style={{
                      width: '100%', marginBottom: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 10,
                      background: 'transparent', border: `1.5px solid ${t.border}`,
                      color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.borderStrong; e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }}
                  >
                    ↓ Download Image
                  </button>
                )}

                {/* Edit in Video Editor CTA — only for completed video posts */}
                {results.contentTypeSelection === 'video' && results.mediaUrl && results.videoRendering !== true && (
                  <button
                    onClick={() => router.push(results.studioCreationId
                      ? `/templates/video-editor?id=${results.studioCreationId}`
                      : `/templates/video-editor?videoUrl=${encodeURIComponent(results.mediaUrl)}`
                    )}
                    style={{
                      width: '100%', marginBottom: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 10,
                      background: 'transparent', border: `1.5px solid ${t.primaryBorder}`,
                      color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.background = t.primaryBg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 15 }}>✏️</span>
                    Edit Video
                  </button>
                )}

                {/* Platform badges with connection status */}
                {(() => {
                  const targetPlatforms = results.platform === 'all'
                    ? ALL_PLATFORM_IDS
                    : [results.platform].filter(Boolean);
                  const noneConnected = connectedPlatforms !== null && connectedPlatforms.length > 0
                    && !targetPlatforms.some(p => connectedPlatforms.includes(p));
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: noneConnected ? 8 : 12 }}>
                        {targetPlatforms.map(p => {
                          const config = PLATFORMS.find(x => x.id === p);
                          if (!config) return null;
                          const PIcon = config.icon;
                          const isConnected = connectedPlatforms === null || connectedPlatforms.includes(p);
                          return (
                            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: isConnected ? config.bg : t.input, border: `1px solid ${isConnected ? config.border : t.border}`, fontSize: 11, fontWeight: 600, color: isConnected ? config.color : t.textMuted, opacity: isConnected ? 1 : 0.65 }}>
                              <PIcon size={12} style={{ color: isConnected ? config.color : t.textMuted }} />
                              {config.label}
                              {connectedPlatforms !== null && (
                                isConnected
                                  ? <IpCheck size={10} strokeWidth={3} style={{ color: config.color }} />
                                  : <span style={{ fontSize: 9 }}>not connected</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      {noneConnected && (
                        <div style={{ fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)' }}>
                          <span>⚠</span>
                          <span>No accounts connected for these platforms.{' '}
                            <a href="/settings" style={{ color: t.primary, textDecoration: 'underline' }}>Connect in Settings →</a>
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Regenerate image button */}
                {results.postId && results.contentTypeSelection !== 'video' && results.contentTypeSelection !== 'static' && results.contentTypeSelection !== 'branded_card' && results.contentTypeSelection !== 'carousel' && (
                  <button
                    onClick={async () => {
                      if (actionLoading) return;
                      setActionLoading(true);
                      try {
                        const res = await api.post('/api/wizard/regenerate-image', {
                          postId: results.postId,
                          imagePrompt: results.imagePrompt || '',
                        });
                        setResults(r => ({ ...r, mediaUrl: res.data.mediaUrl }));
                        showToast('success', 'New image generated!');
                        window.dispatchEvent(new Event('creditRefresh'));
                      } catch (e) {
                        showToast('error', e.response?.data?.error || 'Image regeneration failed');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    style={{ width: '100%', padding: '9px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: actionLoading ? 0.6 : 1 }}
                    onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.borderColor = t.primaryBorder; }}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}
                  >
                    <IpRefresh size={13} /> {actionLoading ? 'Generating...' : 'Regenerate Image'}
                  </button>
                )}

              </div>}

              {/* ── LEFT (visually): Variations + actions ── */}
              <div style={{ flex: 1, minWidth: 280 }}>

                {/* Variation radio cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {results.variations && (() => {
                    // Find which variation has the highest predicted engagement score
                    const vars = Object.entries(results.variations);
                    const scoresPresent = vars.some(([, v]) => v.engagementScore != null);
                    const bestLabel = scoresPresent
                      ? vars.reduce((best, [key, v]) => (v.engagementScore || 0) > (results.variations[best]?.engagementScore || 0) ? key : best, 'A')
                      : null;
                    return vars.map(([label, variation]) => {
                    const isSelected = selectedVariation === label;
                    const labelColors = { A: t.primary, B: t.info, C: t.success };
                    const color = labelColors[label] || t.primary;
                    return (
                      <div
                        key={label}
                        onClick={() => { if (!isEditing) { setSelectedVariation(label); setIsEditing(false); setShowApplySetDropdown(false); setShowAddToSetDropdown(false); if (svgCards?.[label]) setActiveSvg(svgCards[label]); if (results?.postId) wizardAPI.feedback({ postId: results.postId, variationSelected: label }).catch(() => {}); } }}
                        style={{
                          background: isSelected
                            ? t.isDark ? 'rgba(15,15,24,0.82)' : t.card
                            : t.isDark ? 'rgba(15,15,24,0.65)' : t.card,
                          backdropFilter: 'blur(20px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                          border: `2px solid ${isSelected ? color : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                          borderRadius: 18, overflow: 'hidden',
                          cursor: isEditing ? 'default' : 'pointer',
                          transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                          boxShadow: isSelected
                            ? `0 8px 32px ${color}28, 0 0 0 3px ${color}12, inset 0 1px 0 rgba(255,255,255,0.07)`
                            : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})`,
                        }}
                        onMouseEnter={(e) => { if (!isSelected && !isEditing) { e.currentTarget.style.borderColor = `${color}50`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${color}20, inset 0 1px 0 rgba(255,255,255,0.05)`; } }}
                        onMouseLeave={(e) => { if (!isSelected && !isEditing) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.85'})`; } }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: isSelected ? `${color}12` : t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isSelected ? `${color}20` : t.isDark ? 'rgba(255,255,255,0.05)' : t.border}` }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: isSelected ? `linear-gradient(135deg, ${color}, ${color}cc)` : t.isDark ? 'rgba(255,255,255,0.06)' : t.input, border: `2px solid ${isSelected ? 'transparent' : t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: isSelected ? '#fff' : t.textMuted, flexShrink: 0, boxShadow: isSelected ? `0 2px 8px ${color}50` : 'none', transition: 'all 200ms ease' }}>
                            {label}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? color : t.textSecondary, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            Variation {label}
                            {variation.hookType && <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12 }}> · {
                              results.contentTypeSelection === 'branded_card'
                                ? ({ full_overlay: 'Full color', bold_split: 'Bold split', side_accent: 'Side accent' }[variation.hookType] || variation.hookType)
                                : variation.hookType
                            }</span>}
                            {bestLabel === label && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 1px 4px rgba(245,158,11,0.35)' }}>
                                Best
                              </span>
                            )}
                          </span>
                        </div>

                        {isSelected && (
                          <div style={{ padding: '14px 16px' }}>
                            {isEditing ? (
                              (() => {
                                const editPlatforms = results?.platform === 'all'
                                  ? [...new Set(selectedWizardAccountIds.length > 0
                                      ? socialAccountsList.filter(a => selectedWizardAccountIds.includes(a.id)).map(a => a.platform)
                                      : ['facebook', 'instagram', 'google_business'])]
                                  : [results?.platform].filter(Boolean);
                                const overEditLimit = editPlatforms.filter(p => CHAR_LIMITS[p] && editedCaption.length > CHAR_LIMITS[p]);
                                return (
                                  <div>
                                    <textarea
                                      value={editedCaption}
                                      onChange={e => setEditedCaption(e.target.value)}
                                      rows={6}
                                      style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${overEditLimit.length > 0 ? '#ef4444' : t.primary}`, borderRadius: 8, color: t.text, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                      autoFocus
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                      <div style={{ fontSize: 11, color: overEditLimit.length > 0 ? '#ef4444' : t.textMuted }}>
                                        {editedCaption.length.toLocaleString()} chars
                                        {overEditLimit.length > 0 && ` · Too long for: ${overEditLimit.join(', ')}`}
                                      </div>
                                      {editPlatforms.map(p => CHAR_LIMITS[p] ? (
                                        <span key={p} style={{ fontSize: 10, marginLeft: 6, color: editedCaption.length > CHAR_LIMITS[p] ? '#ef4444' : t.textMuted }}>
                                          {p.replace('_', ' ')}: {editedCaption.length}/{CHAR_LIMITS[p]}
                                        </span>
                                      ) : null)}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div
                                onMouseEnter={() => setCaptionHovered(label)}
                                onMouseLeave={() => setCaptionHovered(null)}
                                style={{ position: 'relative', marginBottom: 10 }}
                              >
                                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', paddingRight: captionHovered === label ? 60 : 0, transition: 'padding 150ms ease' }}>
                                  {variation.caption}
                                </div>
                                {captionHovered === label && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleEditStart(); }}
                                    style={{
                                      position: 'absolute', top: 0, right: 0,
                                      padding: '4px 9px', borderRadius: 7,
                                      background: t.isDark ? 'rgba(124,92,252,0.18)' : 'rgba(124,92,252,0.09)',
                                      border: `1px solid rgba(124,92,252,0.3)`,
                                      color: t.primary, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: 4,
                                      animation: 'wizPencilIn 150ms ease',
                                    }}
                                  >
                                    <IpEdit size={11} /> Edit
                                  </button>
                                )}
                              </div>
                            )}

                            {variation.engagementQuestion && !isEditing && (
                              <div style={{ padding: '10px 12px', background: 'rgba(234,179,8,0.08)', borderRadius: 6, borderLeft: '3px solid #EAB308', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Icon name="message" size={11} color="#EAB308" /> Suggested question
                                </div>
                                <div style={{ fontSize: 12, color: t.text, fontStyle: 'italic' }}>{variation.engagementQuestion}</div>
                              </div>
                            )}

                            {variation.hashtags && variation.hashtags.length > 0 && !isEditing && (
                              <div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                  {variation.hashtags.slice(0, 8).map((tag, i) => (
                                    <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: t.primaryBg, color: t.primary, fontSize: 11, fontWeight: 500 }}>
                                      {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
                                  ))}
                                </div>
                                {/* Hashtag set controls */}
                                {hashtagSets.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowApplySetDropdown(v => !v); setShowAddToSetDropdown(false); }}
                                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, color: t.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                      >
                                        Apply saved set ▾
                                      </button>
                                      {showApplySetDropdown && (
                                        <div
                                          onClick={e => e.stopPropagation()}
                                          style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 50, minWidth: 180, overflow: 'hidden' }}
                                        >
                                          {hashtagSets.map(set => (
                                            <button
                                              key={set.id}
                                              onClick={() => {
                                                const updatedVariations = {
                                                  ...results.variations,
                                                  [label]: { ...variation, hashtags: set.tags },
                                                };
                                                setResults(r => ({ ...r, variations: updatedVariations }));
                                                customerAPI.updateHashtagSets(hashtagSets.map(s => s.id === set.id ? { ...s, usage_count: (s.usage_count || 0) + 1 } : s)).catch(() => {});
                                                setHashtagSets(prev => prev.map(s => s.id === set.id ? { ...s, usage_count: (s.usage_count || 0) + 1 } : s));
                                                setShowApplySetDropdown(false);
                                              }}
                                              style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${t.border}`, color: t.text, fontSize: 12, fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                                              onMouseEnter={e => e.currentTarget.style.background = t.input}
                                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            >
                                              <div style={{ fontWeight: 600, marginBottom: 2 }}>{set.name}</div>
                                              <div style={{ fontSize: 11, color: t.textMuted }}>{(set.tags || []).slice(0, 4).map(x => `#${x}`).join(' ')}{set.tags?.length > 4 ? ` +${set.tags.length - 4}` : ''}</div>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowAddToSetDropdown(v => !v); setShowApplySetDropdown(false); setAddToSetName(''); }}
                                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, color: t.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                      >
                                        <IpPlus size={11} /> Add to set
                                      </button>
                                      {showAddToSetDropdown && (
                                        <div
                                          onClick={e => e.stopPropagation()}
                                          style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 50, minWidth: 200, padding: 10 }}
                                        >
                                          <div style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New set name</div>
                                          <input
                                            value={addToSetName}
                                            onChange={e => setAddToSetName(e.target.value)}
                                            placeholder="e.g. Seasonal, Roofing..."
                                            maxLength={60}
                                            style={{ width: '100%', padding: '7px 9px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                                            onKeyDown={e => e.stopPropagation()}
                                          />
                                          <button
                                            disabled={!addToSetName.trim()}
                                            onClick={() => {
                                              const name = addToSetName.trim();
                                              if (!name || !variation.hashtags?.length) return;
                                              const tags = variation.hashtags.map(h => h.replace(/^#+/, ''));
                                              const newSet = { id: String(Date.now()), name, tags, usage_count: 0 };
                                              const updated = [...hashtagSets, newSet];
                                              customerAPI.updateHashtagSets(updated).catch(() => {});
                                              setHashtagSets(updated);
                                              setShowAddToSetDropdown(false);
                                              setAddToSetName('');
                                            }}
                                            style={{ width: '100%', padding: '7px 12px', background: t.primary, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !addToSetName.trim() ? 0.5 : 1 }}
                                          >
                                            Save as set
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {!isSelected && (
                          <div style={{ padding: '10px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {variation.caption?.substring(0, 80)}...
                          </div>
                        )}
                      </div>
                    );
                  });
                  })()}
                </div>

                {/* Account picker — shown when multiple accounts are connected */}
                {socialAccountsList.length > 0 && (
                  <div style={{ paddingTop: 14, paddingBottom: 4, borderTop: `1px solid ${t.border}`, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Post to</div>
                    {/* Group quick-select chips */}
                    {wizardAccountGroups.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {wizardAccountGroups.map(group => (
                          <button key={group.id} type="button" onClick={() => setSelectedWizardAccountIds(group.account_ids || [])} style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${t.primary}`, background: t.primaryBg, color: t.primary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {group.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {PLATFORMS.filter(p => p.id !== 'all' && socialAccountsList.some(a => a.platform === p.id)).map(({ id: platId, label: platLabel, icon: PlatIcon }) => {
                        const platAccounts = socialAccountsList.filter(a => a.platform === platId);
                        return platAccounts.map(account => {
                          const checked = selectedWizardAccountIds.includes(account.id);
                          return (
                            <label key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 7, background: checked ? t.primaryBg : 'transparent', border: `1px solid ${checked ? t.primaryBorder : 'transparent'}`, transition: 'all 150ms' }}>
                              <input type="checkbox" checked={checked} onChange={() => setSelectedWizardAccountIds(prev => prev.includes(account.id) ? prev.filter(x => x !== account.id) : [...prev, account.id])} style={{ accentColor: t.primary, width: 14, height: 14, flexShrink: 0 }} />
                              <PlatIcon size={13} style={{ color: FORMAT_PLATFORM_COLORS[platId] || t.textMuted, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{account.account_name || account.username || platLabel}</span>
                              {account.username && account.account_name && <span style={{ fontSize: 11, color: t.textMuted }}>@{account.username.replace(/^@/, '')}</span>}
                            </label>
                          );
                        });
                      })}
                    </div>
                  </div>
                )}

                {/* PostCore Smart Schedule recommendation */}
                {!smartScheduleDismissed && wizardBestTimes.length > 0 && results.postId && (() => {
                  const bt = wizardBestTimes[0];
                  const today = new Date();
                  const todayDow = today.getDay();
                  let daysAhead = (bt.dow - todayDow + 7) % 7;
                  if (daysAhead === 0 && today.getHours() >= bt.hour) daysAhead = 7;
                  const target = new Date(today);
                  target.setDate(today.getDate() + daysAhead);
                  const pad = n => String(n).padStart(2, '0');
                  const iso = `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}T${pad(bt.hour)}:00`;
                  const handleAcceptSmartSchedule = async () => {
                    setScheduleDate(iso);
                    setSmartScheduleDismissed(true);
                    try {
                      setActionLoading(true);
                      await import('../lib/api').then(({ default: api }) =>
                        api.patch(`/api/posts/${results.postId}`, { status: 'scheduled', scheduledDate: iso, chosenVariation: selectedVariation })
                      );
                      showToast('success', `Scheduled for ${bt.label} ✓`);
                    } catch (err) {
                      showToast('error', err.message || 'Failed to schedule');
                    } finally { setActionLoading(false); }
                  };
                  return (
                    <div style={{ margin: '0 0 12px 0', padding: '12px 14px', background: t.isDark ? 'rgba(124,92,252,0.1)' : 'rgba(124,92,252,0.07)', border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.3)' : 'rgba(124,92,252,0.2)'}`, borderRadius: 12, position: 'relative' }}>
                      <button onClick={() => setSmartScheduleDismissed(true)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <IpSparkle size={12} color={t.primary} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{aiName} recommends</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>{bt.label}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>{bt.reason}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={handleAcceptSmartSchedule} disabled={actionLoading} style={{ padding: '7px 14px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                          {actionLoading ? 'Scheduling…' : `✓ Schedule for ${bt.label}`}
                        </button>
                        <button onClick={() => { setSmartScheduleDismissed(true); setShowScheduleModal(true); }} style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Choose different time
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Action bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}` }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleSaveEdit} disabled={actionLoading} style={{ flex: 1, padding: '10px 16px', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name="check" size={14} color="#fff" /> Save Caption
                      </button>
                      <button onClick={() => setIsEditing(false)} style={{ padding: '10px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const targetPlatforms = results.platform === 'all'
                          ? ['facebook', 'instagram', 'google_business']
                          : [results.platform].filter(Boolean);
                        const noneConnected = connectedPlatforms !== null && connectedPlatforms.length > 0
                          && !targetPlatforms.some(p => connectedPlatforms.includes(p));
                        const activeCaption = results.variations?.[selectedVariation.toLowerCase()]?.caption || '';
                        const activePlatforms = selectedWizardAccountIds.length > 0
                          ? socialAccountsList.filter(a => selectedWizardAccountIds.includes(a.id)).map(a => a.platform)
                          : targetPlatforms;
                        const overLimit = activePlatforms.some(p => CHAR_LIMITS[p] && activeCaption.length > CHAR_LIMITS[p]);
                        const blocked = noneConnected || overLimit;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {publishedTo ? (
                              <div style={{ width: '100%', padding: '14px', background: 'rgba(22,163,74,0.08)', border: '2px solid rgba(22,163,74,0.40)', borderRadius: 11, color: '#16A34A', fontSize: 14, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'fadeIn 350ms ease' }}>
                                <IpCheckCircle size={16} color="#16A34A" /> Live on {publishedTo}
                              </div>
                            ) : (
                              <button onClick={handlePostNow} disabled={actionLoading || !results.postId || blocked} style={{ width: '100%', padding: '13px 14px', background: blocked ? '#9CA3AF' : `linear-gradient(135deg, ${t.primary}, ${t.primaryLight || '#9B7BFF'})`, border: 'none', borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700, cursor: (actionLoading || blocked) ? 'not-allowed' : 'pointer', opacity: (actionLoading || blocked) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: blocked ? 'none' : '0 4px 16px rgba(124,92,252,0.38)', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)' }}>
                                <Icon name="send" size={14} color="#fff" /> {actionLoading ? 'Publishing...' : 'Post Now'}
                              </button>
                            )}
                            {overLimit && !publishedTo && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center' }}>Caption too long for some platforms — edit to fix</div>}
                          </div>
                        );
                      })()}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
                        <button onClick={() => setShowScheduleModal(true)} disabled={actionLoading || !results.postId}
                          style={{ padding: '10px 12px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 11, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})`, transition: 'all 150ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.09)' : t.border; e.currentTarget.style.color = t.textSecondary; }}
                        >
                          <Icon name="schedule" size={13} /> Schedule
                        </button>
                        <button onClick={handleEditStart}
                          style={{ padding: '10px 12px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 11, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})`, transition: 'all 150ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.09)' : t.border; e.currentTarget.style.color = t.textSecondary; }}
                        >
                          <Icon name="edit" size={13} /> Edit
                        </button>
                        <button onClick={() => { showToast('success', 'Draft saved — find it in History'); setTimeout(handleReset, 1800); }}
                          style={{ padding: '10px 12px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 11, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})`, transition: 'all 150ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.09)' : t.border; e.currentTarget.style.color = t.textSecondary; }}
                        >
                          <IpArrowLeft size={13} /> Save Draft
                        </button>
                        <button onClick={() => setShowSaveTemplate(true)}
                          style={{ padding: '10px 12px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 11, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.85'})`, transition: 'all 150ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.09)' : t.border; e.currentTarget.style.color = t.textSecondary; }}
                        >
                          <IpSparkle size={12} /> Template
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Full-width Post Preview ── */}
            {!isMobile && (() => {
              try {
              const varData = results?.variations?.[selectedVariation];
              if (!varData) return null;
              const previewPlatforms = (results?.platform === 'all'
                ? ALL_PLATFORM_IDS
                : [results?.platform]).filter(p => p && MOCKUP_MAP[p]);
              if (previewPlatforms.length === 0) return null;
              const activePid = (wizardPreviewPlatform === 'all' || !previewPlatforms.includes(wizardPreviewPlatform))
                ? 'all' : wizardPreviewPlatform;
              const previewMediaUrl = extraPhotoCardUrls[selectedCardStyle] || results?.photoCardUrls?.[selectedCardStyle] || results?.photoCardUrls?.[selectedVariation] || results?.mediaUrl || null;
              const previewPost = {
                media_url: previewMediaUrl,
                hashtags: varData.hashtags || [],
                content_type: results?.contentTypeSelection === 'static' ? 'static' : 'photo',
              };
              const fullPreviewCaption = [varData.caption, varData.engagementQuestion].filter(Boolean).join('\n\n');
              const PREVIEW_CAP_MAX = 220;
              const needsCaptionExpand = fullPreviewCaption.length > PREVIEW_CAP_MAX;
              const previewCaption = (previewCaptionExpanded || !needsCaptionExpand)
                ? fullPreviewCaption
                : fullPreviewCaption.slice(0, PREVIEW_CAP_MAX);
              const getProfileForPlatform = (pid) => {
                const acct = socialAccountsList.find(a => a.platform === pid);
                return { name: acct?.account_name || acct?.username || 'Your Business', picture: acct?.profile_picture || null };
              };
              const ActiveMockup = activePid !== 'all' ? MOCKUP_MAP[activePid] : null;
              const mockupPids = previewPlatforms.filter(pid => MOCKUP_MAP[pid]);
              return (
                <div style={{ marginTop: 28, background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.border}`, borderRadius: 16, padding: '20px 24px 24px', boxShadow: t.shadowSm }}>
                  {/* Header + tabs */}
                  <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}`, marginBottom: 20, paddingBottom: 0, gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginRight: 12 }}>Post Preview</div>
                    <button type="button" onClick={() => setWizardPreviewPlatform('all')}
                      style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: activePid === 'all' ? t.primary : t.textMuted, borderBottom: `2px solid ${activePid === 'all' ? t.primary : 'transparent'}`, marginBottom: -1, transition: 'all 150ms', whiteSpace: 'nowrap' }}
                    >All</button>
                    {mockupPids.map(pid => {
                      const meta = PLATFORM_META[pid];
                      const PlatIcon = meta?.Icon;
                      const isAct = activePid === pid;
                      return (
                        <button key={pid} type="button" onClick={() => setWizardPreviewPlatform(pid)}
                          style={{ padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${isAct ? (meta?.color || t.primary) : 'transparent'}`, marginBottom: -1, transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {PlatIcon && <PlatIcon size={18} style={{ color: isAct ? meta?.color : t.textMuted, transition: 'color 150ms' }} />}
                          {meta && <span style={{ fontSize: 12, fontWeight: 600, color: isAct ? meta.color : t.textMuted, transition: 'color 150ms' }}>{meta.label}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mockup area */}
                  {activePid === 'all' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(mockupPids.length, 3)}, 1fr)`, gap: 24 }}>
                      {mockupPids.map(pid => {
                        const Mock = MOCKUP_MAP[pid];
                        const meta = PLATFORM_META[pid];
                        return (
                          <div key={pid}>
                            {meta && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                {meta.Icon && <meta.Icon size={14} style={{ color: meta.color }} />}
                                <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                              </div>
                            )}
                            <Mock post={previewPost} caption={previewCaption} profile={getProfileForPlatform(pid)} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ maxWidth: 560, margin: '0 auto' }}>
                      {ActiveMockup && <ActiveMockup post={previewPost} caption={previewCaption} profile={getProfileForPlatform(activePid)} />}
                    </div>
                  )}

                  {/* See more / See less caption toggle */}
                  {needsCaptionExpand && (
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewCaptionExpanded(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: t.primary, padding: '4px 10px' }}
                      >
                        {previewCaptionExpanded ? 'See less ↑' : '…See more ↓'}
                      </button>
                    </div>
                  )}
                </div>
              );
              } catch (e) {
                console.error('[Wizard] Post Preview render error:', e);
                return null;
              }
            })()}

            {/* ── Save as template modal ── */}
            {showSaveTemplate && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowSaveTemplate(false)}>
                <div style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>Save as template</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Saves content type, tone, and platforms so you can reuse this setup quickly.</div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Template name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                    placeholder='e.g. "Before/After Photo" or "Friendly Instagram"'
                    autoFocus
                    maxLength={100}
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleSaveTemplate} disabled={!templateName.trim()}
                      style={{ flex: 1, padding: '10px 16px', background: templateName.trim() ? t.primary : 'rgba(124,92,252,0.3)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: templateName.trim() ? 'pointer' : 'not-allowed' }}>
                      Save template
                    </button>
                    <button onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }} style={{ padding: '10px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Inline schedule modal ── */}
            {showScheduleModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowScheduleModal(false)}>
                <div style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 22, padding: 26, width: '100%', maxWidth: 380, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: t.isDark ? '0 24px 64px rgba(0,0,0,0.65), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>Schedule Post</div>
                  {wizardBestTimes.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Best times for you</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {wizardBestTimes.map((bt, i) => {
                          const today = new Date();
                          const todayDow = today.getDay();
                          let daysAhead = (bt.dow - todayDow + 7) % 7;
                          if (daysAhead === 0 && today.getHours() >= bt.hour) daysAhead = 7;
                          const target = new Date(today);
                          target.setDate(today.getDate() + daysAhead);
                          const pad = n => String(n).padStart(2, '0');
                          const iso = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(bt.hour)}:00`;
                          return (
                            <button key={i} type="button" onClick={() => setScheduleDate(iso)} title={bt.reason}
                              style={{ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${t.primary}`, background: scheduleDate === iso ? t.primary : t.primaryBg, color: scheduleDate === iso ? '#fff' : t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              {bt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Date & Time</label>
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${scheduleDate && new Date(scheduleDate) < new Date() ? t.error : t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  {scheduleDate && new Date(scheduleDate) < new Date() && (
                    <div style={{ fontSize: 12, color: t.error, marginBottom: 12, marginTop: 4 }}>That time has already passed</div>
                  )}
                  {profileTimezone && (
                    <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16, marginTop: scheduleDate && new Date(scheduleDate) < new Date() ? 0 : 8 }}>
                      Scheduling in: {profileTimezone}
                    </div>
                  )}
                  {/* ── Conflict warning ── */}
                  {scheduleConflicts.length > 0 && (
                    <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>
                        Scheduling conflict
                      </div>
                      {scheduleConflicts.map(c => (
                        <div key={c.id} style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                          You already have a {c.platform} post at {new Date(c.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          onClick={() => handleScheduleSubmit(true)}
                          style={{ flex: 1, padding: '8px 12px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, color: '#F59E0B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Schedule anyway
                        </button>
                        <button
                          onClick={() => setScheduleConflicts([])}
                          style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Change time
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button
                      onClick={() => handleScheduleSubmit(false)}
                      disabled={actionLoading || !scheduleDate || (scheduleDate && new Date(scheduleDate) < new Date())}
                      style={{ flex: 1, padding: '10px 16px', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: scheduleDate && !actionLoading && new Date(scheduleDate) > new Date() ? 'pointer' : 'not-allowed', opacity: scheduleDate && !actionLoading && new Date(scheduleDate) > new Date() ? 1 : 0.5 }}
                    >
                      {actionLoading ? 'Scheduling...' : 'Schedule'}
                    </button>
                    <button onClick={() => { setShowScheduleModal(false); setScheduleConflicts([]); }} style={{ padding: '10px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── More Designs Gallery Modal ── */}
      {moreDesignsModal && results && (() => {
        const ALL_KEYS = ['A','B','C','D','E','F','G','H','I'];
        const allUrls = { ...results.photoCardUrls, ...extraPhotoCardUrls };
        const availableKeys = ALL_KEYS.filter(k => allUrls[k]);
        const styleLabels = { A:'Style 1',B:'Style 2',C:'Style 3',D:'Style 4',E:'Style 5',F:'Style 6',G:'Style 7',H:'Style 8',I:'Style 9' };
        return (
          <div
            onClick={() => setMoreDesignsModal(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: t.card, borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: availableKeys.length > 3 ? 900 : 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', border: `1px solid ${t.border}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>Pick a design</div>
                  <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>{availableKeys.length} designs available — choose the one you like</div>
                </div>
                <button onClick={() => setMoreDesignsModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {availableKeys.map(key => {
                  const url = allUrls[key];
                  const isActive = selectedCardStyle === key;
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: `2px solid ${isActive ? '#7C5CFC' : t.border}`, aspectRatio: '4/5', background: t.input, position: 'relative' }}>
                        <img src={url} alt={styleLabels[key]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {isActive && (
                          <div style={{ position: 'absolute', top: 8, right: 8, background: '#7C5CFC', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700, color: '#fff' }}>Active</div>
                        )}
                      </div>
                      <button
                        onClick={() => selectMoreDesign(key)}
                        style={{ width: '100%', padding: '10px 0', background: isActive ? 'rgba(124,92,252,0.12)' : 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', border: isActive ? '1.5px solid #7C5CFC' : 'none', borderRadius: 10, color: isActive ? '#7C5CFC' : '#fff', fontSize: 13, fontWeight: 700, cursor: isActive ? 'default' : 'pointer', letterSpacing: '0.01em' }}
                        disabled={isActive}
                      >
                        {isActive ? '✓ Selected' : `Select ${styleLabels[key]}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Download Image Modal ── */}
      {downloadModal && results?.mediaUrl && (
        <div
          onClick={() => !downloading && setDownloadModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.isDark ? 'rgba(12,12,20,0.97)' : t.card, border: `1px solid ${t.border}`,
              borderRadius: 20, padding: '28px 24px', maxWidth: 420, width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'scaleIn 200ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Download your image</div>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 22 }}>Choose how you'd like to download this post image.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Watermark option */}
              <button
                onClick={() => handleDownload(true)}
                disabled={downloading}
                style={{
                  padding: '16px 18px', borderRadius: 14, border: `1.5px solid rgba(124,92,252,0.5)`,
                  background: 'rgba(124,92,252,0.08)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 150ms', opacity: downloading ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>With {appName} watermark</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34C759', background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.25)', borderRadius: 6, padding: '2px 8px' }}>+5 free credits</span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Adds "Made with {appName}" in the corner. One-time bonus — share your work, earn credits.</div>
              </button>

              {/* Clean option */}
              <button
                onClick={() => handleDownload(false)}
                disabled={downloading}
                style={{
                  padding: '16px 18px', borderRadius: 14, border: `1px solid ${t.border}`,
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 150ms', opacity: downloading ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Download clean</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>No watermark — post it anywhere as your own.</div>
              </button>
            </div>

            {downloading && <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: t.textMuted }}>Downloading…</div>}
            <button onClick={() => setDownloadModal(false)} disabled={downloading} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}

    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeading({ t, icon, title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 12 }}>
        <Icon name={icon} size={32} color="url(#brand-gradient)" />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', marginBottom: 6 }}>{title}</h2>
      <p style={{ fontSize: 14, color: t.textMuted }}>{sub}</p>
    </div>
  );
}

function ThemeCard({ selected, onClick, t, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '22px 16px',
        background: selected
          ? t.isDark ? 'rgba(124,92,252,0.13)' : 'rgba(124,92,252,0.08)'
          : t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: `2px solid ${selected ? 'rgba(124,92,252,0.55)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
        borderRadius: 18, cursor: 'pointer',
        transition: 'border-color 180ms, background 180ms, box-shadow 200ms',
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
        transform: selected ? 'translateY(-5px) scale(1.04)' : 'none',
        animation: selected ? 'wizCardPop 320ms cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
        boxShadow: selected
          ? `0 14px 40px rgba(124,92,252,0.32), 0 0 0 4px rgba(124,92,252,0.12), inset 0 1px 0 rgba(255,255,255,0.1)`
          : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.35)'; e.currentTarget.style.background = t.isDark ? 'rgba(124,92,252,0.07)' : 'rgba(124,92,252,0.04)'; e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'; e.currentTarget.style.boxShadow = `0 8px 28px rgba(124,92,252,0.18), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.06' : '0.9'})`; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.background = t.isDark ? 'rgba(15,15,24,0.72)' : t.card; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`; } }}
    >
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(124,92,252,0.5)' }}>
          <IpCheck size={10} color="#fff" strokeWidth={3} />
        </div>
      )}
      {children}
    </button>
  );
}

function SelectionPill({ t, icon, label }) {
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, background: t.card, border: `1px solid ${t.primaryBorder}`, fontSize: 12, fontWeight: 600, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {icon && <Icon name={icon} size={12} color="url(#brand-gradient)" />}
      {label}
    </span>
  );
}

function Toggle({ value, onChange, t }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{ width: 48, height: 28, borderRadius: 14, flexShrink: 0, background: value ? '#34C759' : t.borderStrong, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 150ms ease', padding: 3, display: 'flex', alignItems: 'center', justifyContent: value ? 'flex-end' : 'flex-start' }}
    >
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1)' }} />
    </button>
  );
}

function WizardNav({ t, onBack, onNext, canNext, nextLabel = 'Next →', nextStyle = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', background: t.isDark ? 'rgba(15,15,24,0.68)' : 'transparent', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 11, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', boxShadow: t.isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.06)' : t.cardHover; e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.15)' : t.borderStrong; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = t.isDark ? 'rgba(15,15,24,0.68)' : 'transparent'; e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.09)' : t.border; }}
      >
        <IpArrowLeft size={14} /> Back
      </button>
      <button onClick={onNext} disabled={!canNext}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 26px', background: canNext ? `linear-gradient(135deg, ${t.primary}, ${t.primaryLight || '#9B7BFF'})` : t.textDisabled, border: 'none', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: canNext ? 'pointer' : 'not-allowed', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', opacity: canNext ? 1 : 0.5, boxShadow: canNext ? '0 4px 16px rgba(124,92,252,0.35)' : 'none', ...nextStyle }}
        onMouseEnter={(e) => { if (canNext) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,92,252,0.5)'; } }}
        onMouseLeave={(e) => { if (canNext) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.35)'; } }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function VariationCard({ label, variation, t, copiedId, onCopy, onUse, selected, onSelect }) {
  const labelColors = { A: t.primary, B: t.info, C: t.success };
  const color = labelColors[label] || t.primary;
  const copyId = `var-${label}`;
  const captionText = variation.caption + (variation.engagementQuestion ? '\n\n' + variation.engagementQuestion : '');

  return (
    <div style={{ background: t.card, border: `2px solid ${selected ? color : t.border}`, borderRadius: 16, overflow: 'hidden', transition: 'all 200ms ease', boxShadow: selected ? '0 4px 20px rgba(124,92,252,0.15)' : 'none' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: `${color}12`, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff' }}>
            {label}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>
            Variation {label}
            {variation.hookType && <span style={{ color: t.textMuted, fontWeight: 400 }}> · {variation.hookType} hook</span>}
          </span>
        </div>
        <button onClick={onSelect} style={{ fontSize: 11, fontWeight: 600, color: selected ? color : t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          {selected ? '▲ Collapse' : '▼ Expand'}
        </button>
      </div>

      {/* Caption */}
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 14, color: t.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: selected ? 'none' : '120px', overflow: selected ? 'visible' : 'hidden', position: 'relative' }}>
          {variation.caption}
          {!selected && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: `linear-gradient(to bottom, transparent, ${t.card})` }} />}
        </div>
        {!selected && (
          <button onClick={onSelect} style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4, fontWeight: 600 }}>
            Read more →
          </button>
        )}
      </div>

      {/* Engagement question */}
      {variation.engagementQuestion && (
        <div style={{ padding: '12px 20px', background: 'rgba(234,179,8,0.08)', borderBottom: `1px solid ${t.border}`, borderLeft: '3px solid #EAB308' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="message" size={12} color="#EAB308" /> Suggested question</div>
          <div style={{ fontSize: 13, color: t.text, fontStyle: 'italic' }}>{variation.engagementQuestion}</div>
        </div>
      )}

      {/* Hashtags */}
      {variation.hashtags && variation.hashtags.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hashtags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {variation.hashtags.slice(0, 10).map((tag, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: t.primaryBg, color: t.primary, fontSize: 11, fontWeight: 500, border: `1px solid ${t.primaryBorder}` }}>
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Image prompt */}
      {variation.imagePrompt && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="image" size={12} color={t.textMuted} /> Image Prompt</div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>{variation.imagePrompt}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onUse} style={{ flex: 1, minWidth: 120, padding: '10px 16px', background: color, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
          <IpChevronRight size={14} /> Use This Post
        </button>
        <button onClick={() => onCopy(captionText, copyId)} style={{ padding: '10px 16px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.primaryBorder)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}>
          {copiedId === copyId ? <><IpCheck size={13} color="#22C55E" /> Copied!</> : <><IpCopy size={13} /> Copy</>}
        </button>
        <button onClick={onUse} style={{ padding: '10px 16px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.primaryBorder)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}>
          <IpEdit size={13} /> Edit
        </button>
      </div>
    </div>
  );
}

function getDetailsPlaceholder(theme) {
  const map = {
    custom:            "Describe your idea — e.g. 'I want to post about why we switched to eco-friendly products' or 'Remind people we cover the Westside area' — anything goes.",
    just_finished_job: 'e.g. Just finished a full bathroom renovation in Springfield. Replaced tiles, new vanity, added rainfall shower. Customer was thrilled...',
    share_tip:         'e.g. Tip about what NOT to flush down the drain — we see this cause blockages every week...',
    got_review:        'e.g. Customer Maria left us a 5-star review saying we saved her from a burst pipe at 11pm on a Friday...',
    running_promo:     'e.g. 20% off all AC tune-ups booked before June 15. Normally $129, now $99...',
    seasonal:          "e.g. With summer coming, we're seeing a lot of AC systems failing that haven't been serviced. Here's what to check...",
    faq:               "e.g. Question: Do I need to service my AC every year? Myth to bust: Only if it's not working. Truth: Annual tune-ups prevent 80% of breakdowns...",
    community:         "e.g. We're sponsoring the Riverside Little League team again this year — so proud to support local kids...",
    team_spotlight:    "e.g. Meet Mike, our lead HVAC tech who has been with us for 11 years. He's seen it all and is certified on all major brands...",
  };
  return map[theme] || 'Describe what happened, any specific details, customer name, neighborhood, or anything your AI advisor should know...';
}
