import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpCredits, IpFacebook, IpInstagram, IpGoogle,
  IpArrowLeft, IpArrowRight, IpRefresh, IpCopy,
  IpCheck, IpEdit, IpSparkle, IpChevronRight, IpLinkedIn, IpTikTok,
} from '../components/icons';
import Icon from '../components/Icon';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';

// ── Step 1: Content Type Selection ──────────────────────────────────────────
const CONTENT_TYPES = [
  { id: 'static',   icon: 'text_post',  label: 'Text Post',      desc: 'Simple text with image', credits: 1 },
  { id: 'photo',    icon: 'photo_post', label: 'Photo Post',     desc: 'Single image with caption', credits: 3 },
  { id: 'carousel', icon: 'carousel',   label: 'Carousel',       desc: 'Multiple slides in one post', credits: 5 },
  { id: 'video',    icon: 'video',      label: 'Video',          desc: 'AI-generated video content', credits: 10 },
];

// ── Step 2: Content Theme (Trigger) ──────────────────────────────────────────
const CONTENT_THEMES = [
  { id: 'just_finished_job',  icon: 'job_finished',   label: 'Just finished a job',    desc: 'Show off a completed project' },
  { id: 'share_tip',          icon: 'share_tip',      label: 'Want to share a tip',     desc: 'Teach your audience something' },
  { id: 'got_review',         icon: 'got_review',     label: 'Got a great review',      desc: 'Showcase customer love' },
  { id: 'running_promo',      icon: 'promotion',      label: 'Running a promotion',     desc: 'Announce an offer or deal' },
  { id: 'seasonal',           icon: 'seasonal',       label: 'Seasonal content',        desc: null },
  { id: 'community',          icon: 'community',      label: 'Community / local event', desc: 'Connect with your neighborhood' },
  { id: 'faq',                icon: 'faq',            label: 'FAQ or myth-busting',     desc: 'Answer what customers always ask' },
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

// ── Loading messages (content-type-aware) ────────────────────────────────────
const LOADING_MESSAGES = {
  static:   (ind) => [`Reading the room for ${ind || 'your industry'}...`, 'Writing like a local expert...', 'Adding that authentic touch...', 'Almost ready...'],
  photo:    (ind) => [`Reading the room for ${ind || 'your industry'}...`, 'Building the perfect image prompt...', 'Generating your image...', 'Adding finishing touches...'],
  carousel: (ind) => [`Reading the room for ${ind || 'your industry'}...`, 'Drafting slide content...', 'Creating slide images...', 'Assembling your carousel...', 'Almost done...'],
  video:    (ind) => [`Reading the room for ${ind || 'your industry'}...`, 'Writing your video script...', 'Sending to video AI...', 'Video rendering — captions ready now...'],
};

// ── Step 2: Choose Format ─────────────────────────────────────────────────────
const FORMAT_TABS = ['Popular', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok'];

const FORMAT_DATA = {
  Popular: [
    { platform: 'instagram', label: 'Instagram Post',  sublabel: '4:5 Portrait',   width: 1080, height: 1350 },
    { platform: 'instagram', label: 'Instagram Story', sublabel: '9:16 Vertical',  width: 1080, height: 1920 },
    { platform: 'facebook',  label: 'Facebook Post',   sublabel: 'Landscape',      width: 1200, height: 630  },
    { platform: 'linkedin',  label: 'LinkedIn Post',   sublabel: 'Square',         width: 1200, height: 1200 },
    { platform: 'tiktok',    label: 'TikTok Video',    sublabel: '9:16 Vertical',  width: 1080, height: 1920 },
  ],
  Facebook: [
    { platform: 'facebook', label: 'Facebook Post',   sublabel: 'Landscape',      width: 1200, height: 630  },
    { platform: 'facebook', label: 'Facebook Story',  sublabel: '9:16 Vertical',  width: 1080, height: 1920 },
    { platform: 'facebook', label: 'Facebook Square', sublabel: '1:1 Square',     width: 1080, height: 1080 },
  ],
  Instagram: [
    { platform: 'instagram', label: 'Instagram Post',   sublabel: '4:5 Portrait',  width: 1080, height: 1350 },
    { platform: 'instagram', label: 'Instagram Story',  sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'instagram', label: 'Instagram Reel',   sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'instagram', label: 'Instagram Square', sublabel: '1:1 Square',    width: 1080, height: 1080 },
  ],
  LinkedIn: [
    { platform: 'linkedin', label: 'LinkedIn Post',  sublabel: '1:1 Square',     width: 1200, height: 1200 },
    { platform: 'linkedin', label: 'LinkedIn Video', sublabel: '9:16 Vertical',  width: 1280, height: 1920 },
  ],
  TikTok: [
    { platform: 'tiktok', label: 'TikTok Video', sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'tiktok', label: 'TikTok Story', sublabel: '9:16 Vertical', width: 1080, height: 1920 },
  ],
};

// Content-type-aware recommendations for the hero row
const RECOMMENDED_FORMATS = {
  static: [
    { platform: 'instagram', label: 'Instagram Post',  sublabel: '4:5 Portrait',  width: 1080, height: 1350 },
    { platform: 'facebook',  label: 'Facebook Post',   sublabel: 'Landscape',     width: 1200, height: 630  },
    { platform: 'linkedin',  label: 'LinkedIn Post',   sublabel: '1:1 Square',    width: 1200, height: 1200 },
  ],
  photo: [
    { platform: 'instagram', label: 'Instagram Post',  sublabel: '4:5 Portrait',  width: 1080, height: 1350 },
    { platform: 'instagram', label: 'Instagram Story', sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'facebook',  label: 'Facebook Post',   sublabel: 'Landscape',     width: 1200, height: 630  },
  ],
  carousel: [
    { platform: 'instagram', label: 'Instagram Post',  sublabel: '4:5 Portrait',  width: 1080, height: 1350 },
    { platform: 'linkedin',  label: 'LinkedIn Post',   sublabel: '1:1 Square',    width: 1200, height: 1200 },
    { platform: 'facebook',  label: 'Facebook Post',   sublabel: 'Landscape',     width: 1200, height: 630  },
  ],
  video: [
    { platform: 'tiktok',    label: 'TikTok Video',    sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'instagram', label: 'Instagram Reel',  sublabel: '9:16 Vertical', width: 1080, height: 1920 },
    { platform: 'facebook',  label: 'Facebook Story',  sublabel: '9:16 Vertical', width: 1080, height: 1920 },
  ],
};

const FORMAT_PLATFORM_COLORS = {
  facebook: '#1877F2', instagram: '#E1306C', linkedin: '#0A66C2',
  tiktok: '#111111', google_business: '#4285F4',
};

// Aspect-ratio-accurate preview rectangle
function FormatMockup({ width, height, platformColor, PlatformIcon, size = 'md' }) {
  const maxH = size === 'lg' ? 84 : 68;
  const maxW = size === 'lg' ? 126 : 100;
  let w, h;
  if (width / height > maxW / maxH) {
    w = maxW; h = Math.round(maxW * height / width);
  } else {
    h = maxH; w = Math.round(maxH * width / height);
  }
  return (
    <div style={{
      width: w, height: h, borderRadius: 7, flexShrink: 0,
      background: `linear-gradient(145deg, ${platformColor}26, ${platformColor}0a)`,
      border: `1.5px solid ${platformColor}45`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* diagonal shimmer */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, ${platformColor}1a 0%, transparent 55%)` }} />
      {/* simulated text lines */}
      <div style={{ position: 'absolute', bottom: '22%', left: '10%', right: '12%', height: 2.5, borderRadius: 2, background: `${platformColor}40` }} />
      <div style={{ position: 'absolute', bottom: '12%', left: '10%', right: '32%', height: 2, borderRadius: 2, background: `${platformColor}28` }} />
      {/* platform badge */}
      {PlatformIcon && (
        <div style={{
          position: 'absolute', top: 5, left: 5,
          width: 17, height: 17, borderRadius: 4,
          background: platformColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 1px 4px ${platformColor}55`,
        }}>
          <PlatformIcon size={10} color="#fff" />
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
    just_finished_job: { job_description: detailsText },
    share_tip:         { tip_topic: detailsText },
    got_review:        { review_text: detailsText },
    running_promo:     { promo_offer: detailsText },
    seasonal:          { seasonal_angle: detailsText },
    community:         { community_event: detailsText },
    faq:               { question: detailsText },
    team_spotlight:    { spotlight_subject: detailsText },
  };
  return map[contentType] || { job_description: detailsText };
}

// ── Inline API calls (wizard is self-contained) ───────────────────────────────
function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch {
    console.error('[Wizard] Non-JSON response from server:', res.status, text.substring(0, 600));
    throw new Error(`Server error (${res.status}) — please try again.`);
  }
}

async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function apiPatch(path, body) {
  const res = await fetch(path, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders() });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Wizard() {
  const router = useRouter();
  const { t } = useTheme();

  const isOnboarding = router.query.onboarding === 'true';

  const [step, setStep] = useState(1);            // 1–6, 'loading', 'results'
  const [contentType, setContentType] = useState(null); // Step 1
  const [selectedFormat, setSelectedFormat] = useState(null); // Step 2
  const [formatTab, setFormatTab] = useState('Popular');
  const [hoveredFormat, setHoveredFormat] = useState(null);
  const [theme, setTheme] = useState(null);       // Step 3
  const [tone, setTone] = useState(null);         // Step 4
  const [details, setDetails] = useState('');     // Step 5
  const [platform, setPlatform] = useState(null); // Step 6
  const [includeCTA, setIncludeCTA] = useState(true);

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [industry, setIndustry] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState('A');

  // Result screen action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionToast, setActionToast] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');

  const loadingInterval = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const token = localStorage.getItem('token');
    fetch('/api/customers/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setIndustry(d.industry || ''))
      .catch(() => {});

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
          setPlatform(data.platform || 'all');
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
        if (data.result) {
          setResults(data.result);
          setPlatform(data.platforms?.[0] || 'facebook');
          setTone(data.tone || 'friendly');
          setStep('results');
        }
        sessionStorage.removeItem('quickPostResult');
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (step === 'loading') {
      const msgs = (LOADING_MESSAGES[contentType] || LOADING_MESSAGES.photo)(industry);
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIdx(i => (i + 1) % msgs.length);
      }, 1800);
    }
    return () => clearInterval(loadingInterval.current);
  }, [step]); // contentType/industry don't change during loading so no stale closure issue

  // Video polling — fires every 6s while videoRendering is true
  // Uses /video-poll/:postId which looks up the HeyGen job ID from the post record
  // Times out after 10 minutes (100 polls) — HeyGen videos take 2-5 min typically
  useEffect(() => {
    if (!results?.videoRendering || results.videoRendering === 'completed' || results.videoRendering === 'failed') return;
    if (!results?.postId) return;
    let pollCount = 0;
    const MAX_POLLS = 100; // 100 × 6s = 10 minutes — extra headroom for HeyGen backlog
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        setResults(r => ({ ...r, videoRendering: 'failed', imageFailed: true }));
        clearInterval(interval);
        return;
      }
      try {
        const { status, videoUrl } = await apiGet(`/api/wizard/video-poll/${results.postId}`);
        if (status === 'completed' && videoUrl) {
          setResults(r => ({ ...r, mediaUrl: videoUrl, videoRendering: 'completed' }));
          clearInterval(interval);
        } else if (status === 'failed') {
          setResults(r => ({ ...r, videoRendering: 'failed', imageFailed: true }));
          clearInterval(interval);
        }
        // 'processing' → keep polling
      } catch { /* polling errors are silent — retry next tick */ }
    }, 6000);
    return () => clearInterval(interval);
  }, [results?.videoRendering, results?.postId]);

  const canProceed = () => {
    if (step === 1) return !!contentType;
    if (step === 2) return true; // format is optional
    if (step === 3) return !!theme;
    if (step === 4) return !!tone;
    if (step === 5) return true;
    if (step === 6) return !!platform;
    return false;
  };

  const handleNext = async () => {
    if (step === 6) { await handleGenerate(); }
    else setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 1) { router.push('/dashboard'); return; }
    if (step === 'results') { setStep(6); return; }
    setStep(s => s - 1);
  };

  const handleReset = () => {
    setStep(1); setContentType(null); setTheme(null); setTone(null); setPlatform(null);
    setDetails(''); setIncludeCTA(true); setResults(null); setError(null);
    setSelectedFormat(null); setFormatTab('Popular'); setHoveredFormat(null);
    setSelectedVariation('A'); setActionLoading(false); setActionToast(null);
    setShowScheduleModal(false); setScheduleDate(''); setIsEditing(false); setEditedCaption('');
  };

  const handleFormatSelect = (fmt) => {
    setSelectedFormat(fmt);
    setTimeout(() => setStep(3), 180);
  };

  const handleTryDifferentTone = () => {
    setStep(4); setTone(null); setResults(null);
  };

  const handleGenerate = async () => {
    setStep('loading');
    setLoadingMsgIdx(0);
    setError(null);
    try {
      const startRes = await apiPost('/api/wizard/start', {});
      const wizardId = startRes.wizardId;

      // Submit each step's answers so the backend session is populated
      await apiPost('/api/wizard/step', { wizardId, stepId: 'content_type_selection', answers: { value: contentType } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'content_type', answers: { value: theme } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'tone', answers: { value: tone } });
      const detailsObj = buildDetailsObject(theme, details.trim());
      await apiPost('/api/wizard/step', { wizardId, stepId: 'details', answers: { ...detailsObj, includeCTA } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'platform', answers: { value: platform } });
      if (selectedFormat) {
        await apiPost('/api/wizard/step', { wizardId, stepId: 'selected_format', answers: { value: selectedFormat } });
      }

      const genRes = await apiPost('/api/wizard/generate', { wizardId });
      setResults(genRes);
      setSelectedVariation('A');
      setStep('results');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStep(6); // stay on platform step so the error banner is visible
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
    setTimeout(() => setActionToast(null), 3500);
  };

  const handlePostNow = async () => {
    if (!results?.postId) return;
    setActionLoading(true);
    try {
      await apiPatch(`/api/posts/${results.postId}`, { status: 'posted' });
      showToast('success', 'Post published!');
    } catch (err) {
      showToast('error', err.message || 'Failed to publish');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleSubmit = async () => {
    if (!results?.postId || !scheduleDate) return;
    setActionLoading(true);
    try {
      await apiPatch(`/api/posts/${results.postId}`, { status: 'scheduled', scheduledDate: scheduleDate });
      setShowScheduleModal(false);
      showToast('success', 'Post scheduled!');
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

  const stepNum = typeof step === 'number' ? step : (step === 'results' ? 7 : 6.5);
  const progressPct = Math.min(100, ((stepNum - 1) / 6) * 100);
  const stepLabels = ['Content type', 'Format', "What's happening?", "What's the vibe?", 'Any details?', 'Where to post?'];

  return (
    <Layout title="Post Wizard" subtitle="Guided content creation — powered by PostCore">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* ── Onboarding welcome banner ── */}
        {isOnboarding && step === 1 && (
          <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(91,63,240,0.06))', border: `1px solid ${t.primaryBorder}`, borderRadius: 14, padding: '18px 22px', marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpSparkle size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Welcome! Let's create your first post.</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>PostCore will write 3 ready-to-use variations tailored to your industry. Just answer a few quick questions — it takes under 60 seconds.</div>
            </div>
          </div>
        )}

        {/* ── Progress header ── */}
        {typeof step === 'number' && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              {stepLabels.map((label, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', margin: '0 auto 6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: step > i + 1 ? t.primary : step === i + 1 ? t.primary : t.card,
                    border: `2px solid ${step >= i + 1 ? t.primary : t.border}`,
                    color: step >= i + 1 ? '#fff' : t.textMuted,
                    transition: 'all 250ms ease',
                  }}>
                    {step > i + 1 ? <IpCheck size={12} strokeWidth={3} /> : i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: step === i + 1 ? t.primary : t.textMuted, fontWeight: step === i + 1 ? 600 : 400 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 3, background: t.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.primaryLight})`, borderRadius: 2, transition: 'width 400ms ease' }} />
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 1 — Content Type Selection
        ───────────────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeading t={t} icon="text_post" title="What type of post?" sub="Choose the format that works best for your content" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
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
          const fmtIconMap = { facebook: IpFacebook, instagram: IpInstagram, linkedin: IpLinkedIn, tiktok: IpTikTok, google_business: IpGoogle };
          const tabIconMap = { Facebook: IpFacebook, Instagram: IpInstagram, LinkedIn: IpLinkedIn, TikTok: IpTikTok };

          const FormatCard = ({ fmt, isSelected, uid, size = 'md', isBest = false }) => {
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
                <FormatMockup width={fmt.width} height={fmt.height} platformColor={pColor} PlatformIcon={PIcon} size={size} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: size === 'lg' ? 13 : 11, fontWeight: 700, color: isSelected ? pColor : t.text, lineHeight: 1.3, marginBottom: 3 }}>{fmt.label}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{fmt.sublabel}</div>
                  {(isHovered || isSelected) && (
                    <div style={{ fontSize: 10, color: `${pColor}cc`, marginTop: 3, fontWeight: 600 }}>{fmt.width}×{fmt.height}</div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {recFormats.map((fmt, idx) => (
                    <FormatCard
                      key={`rec-${idx}`}
                      fmt={fmt}
                      uid={`rec-${idx}`}
                      isSelected={selectedFormat?.label === fmt.label && selectedFormat?.platform === fmt.platform}
                      size="lg"
                      isBest={idx === 0}
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
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {FORMAT_TABS.map(tab => {
                  const TIcon = tabIconMap[tab];
                  const active = formatTab === tab;
                  const tColor = FORMAT_PLATFORM_COLORS[tab.toLowerCase()] || t.primary;
                  return (
                    <button key={tab} onClick={() => setFormatTab(tab)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer',
                      border: `1.5px solid ${active ? tColor : t.border}`,
                      background: active ? `${tColor}12` : 'transparent',
                      color: active ? tColor : t.textMuted,
                      transition: 'all 150ms',
                    }}>
                      {TIcon && <TIcon size={11} style={{ color: 'inherit' }} />}
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* ── All formats grid ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
                {(FORMAT_DATA[formatTab] || []).map((fmt, idx) => (
                  <FormatCard
                    key={`${formatTab}-${idx}`}
                    fmt={fmt}
                    uid={`${formatTab}-${idx}`}
                    isSelected={selectedFormat?.label === fmt.label && selectedFormat?.platform === fmt.platform}
                  />
                ))}
              </div>

              {/* ── Footer nav ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover || t.input}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <IpArrowLeft size={14} /> Back
                </button>
                <button onClick={() => { setSelectedFormat(null); setStep(3); }} style={{ fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', textDecoration: 'underline', textUnderlineOffset: 3 }}>
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
          <div>
            <StepHeading t={t} icon="sparkles" title="What's happening today?" sub="Pick the type of post you want to create" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
              {CONTENT_THEMES.map((item) => {
                const selected = theme === item.id;
                const desc = item.id === 'seasonal' ? getSeasonalDesc() : item.desc;
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
          <div>
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
                      background: selected ? t.primaryBg : t.card,
                      border: `2px solid ${selected ? t.primary : t.border}`,
                      borderRadius: 12, cursor: 'pointer', transition: 'all 200ms ease', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = t.primaryBorder; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = t.border; }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selected ? t.primaryBg : t.input,
                      border: `1px solid ${selected ? t.primaryBorder : t.border}`,
                    }}>
                      <Icon name={item.icon} size={24} color={selected ? 'url(#brand-gradient)' : undefined} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{item.desc}</div>
                    </div>
                    {selected && (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          <div>
            <StepHeading t={t} icon="edit" title="Add any details" sub="Optional — but the more context you give PostCore, the better the posts" />

            {/* Summary pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, padding: '14px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10 }}>
              <SelectionPill t={t} icon={CONTENT_THEMES.find(x => x.id === theme)?.icon} label={CONTENT_THEMES.find(x => x.id === theme)?.label || ''} />
              <SelectionPill t={t} icon={TONES.find(x => x.id === tone)?.icon} label={TONES.find(x => x.id === tone)?.label || ''} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>
                Context for PostCore
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
                {details.length}/500 characters · PostCore will generate 3 variations from this
              </div>
            </div>

            {/* Include CTA toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Include business phone / CTA</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Add a call-to-action pointing to your contact info</div>
              </div>
              <Toggle value={includeCTA} onChange={setIncludeCTA} t={t} />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warning" size={15} color="#EF4444" /> {error}
              </div>
            )}

            <WizardNav t={t} onBack={handleBack} onNext={handleNext} canNext={true} nextLabel="Next →" />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 6 — Where are we posting?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 6 && (
          <div>
            <StepHeading t={t} icon="all_platforms" title="Where are we posting?" sub="PostCore will adapt the caption style for each platform" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
              {PLATFORMS.map((item) => {
                const selected = platform === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPlatform(item.id)}
                    style={{
                      padding: '22px 16px', background: selected ? item.bg : t.card,
                      border: `2px solid ${selected ? item.color : t.border}`,
                      borderRadius: 14, cursor: 'pointer', transition: 'all 200ms ease',
                      textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative', transform: selected ? 'translateY(-2px)' : 'none',
                      boxShadow: selected ? `0 8px 24px ${item.bg}` : 'none',
                    }}
                    onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = item.border; e.currentTarget.style.background = item.bg; } }}
                    onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; } }}
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
            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warning" size={15} color="#EF4444" /> {error}
              </div>
            )}
            <WizardNav
              t={t} onBack={handleBack} onNext={handleNext} canNext={canProceed()}
              nextLabel="✨ Generate Posts"
              nextStyle={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, padding: '12px 28px', fontSize: 15 }}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            LOADING SCREEN
        ───────────────────────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 32 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s ease-in-out infinite' }}>
                <IpSparkle size={36} color="#fff" />
              </div>
              <div style={{ position: 'absolute', inset: -8, borderRadius: 28, border: '3px solid transparent', borderTopColor: t.primary, borderRightColor: t.primaryLight, animation: 'spin 1.2s linear infinite' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 10 }}>Crafting your posts...</div>
              <div style={{ fontSize: 14, color: t.primary, minHeight: 22, transition: 'opacity 300ms' }}>
                {((LOADING_MESSAGES[contentType] || LOADING_MESSAGES.photo)(industry))[loadingMsgIdx] || ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, opacity: 0.3 + (loadingMsgIdx % 3 === i ? 0.7 : 0), animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`, transition: 'opacity 300ms' }} />
              ))}
            </div>
            <style>{`
              @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
              @keyframes spin  { to{transform:rotate(360deg)} }
              @keyframes bounce{ 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
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
              <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: actionToast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={actionToast.type === 'success' ? 'check' : 'warning'} size={15} color="#fff" />
                {actionToast.message}
              </div>
            )}

            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 4 }}>🎉 Your posts are ready!</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>PostCore generated 3 variations — pick your favourite</div>
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

              {/* ── LEFT: Media panel (40%) ── */}
              <div style={{ flex: '0 0 280px', minWidth: 220 }}>

                {/* Image/video failed banner */}
                {results.imageFailed && (
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#D97706' }}>
                    <Icon name="warning" size={14} color="#D97706" />
                    {results.contentTypeSelection === 'video'
                      ? 'Video generation failed — captions are ready to post'
                      : 'Image generation failed — caption-only mode'}
                  </div>
                )}

                {/* Media display */}
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {results.mediaUrl && results.videoRendering !== true ? (
                    results.contentTypeSelection === 'video' ? (
                      <video src={results.mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={results.mediaUrl} alt="Generated post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )
                  ) : (results.videoRendering === true || (results.videoRendering && results.videoRendering !== 'completed' && results.videoRendering !== 'failed')) ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <img src="/icon-192.png" alt="" aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 11, animation: 'logo-pulse 1.2s ease-in-out infinite', margin: '0 auto 12px', display: 'block' }} />
                      <div style={{ fontSize: 13, color: t.textMuted }}>Video rendering...</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Caption is ready to post now</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, color: t.textMuted }}>
                      <Icon name="image" size={48} color={t.textMuted} />
                      <div style={{ fontSize: 12, marginTop: 8 }}>No image</div>
                    </div>
                  )}
                </div>

                {/* Platform badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(results.platform === 'all' ? ['facebook', 'instagram', 'google_business'] : [results.platform]).map(p => {
                    const config = PLATFORMS.find(x => x.id === p);
                    if (!config) return null;
                    const PIcon = config.icon;
                    return (
                      <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: config.bg, border: `1px solid ${config.border}`, fontSize: 11, fontWeight: 600, color: config.color }}>
                        <PIcon size={12} style={{ color: config.color }} /> {config.label}
                      </span>
                    );
                  })}
                </div>

                {/* Regenerate image button */}
                {results.postId && results.contentTypeSelection !== 'video' && results.contentTypeSelection !== 'static' && (
                  <button
                    onClick={() => {
                      sessionStorage.setItem('regenPost', JSON.stringify({ postId: results.postId, imagePrompt: results.imagePrompt }));
                      showToast('success', 'Use "Regenerate Image" after the page refreshes');
                    }}
                    style={{ width: '100%', padding: '9px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = t.primaryBorder}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}
                  >
                    <IpRefresh size={13} /> Regenerate Image
                  </button>
                )}
              </div>

              {/* ── RIGHT: Variations + actions (60%) ── */}
              <div style={{ flex: 1, minWidth: 280 }}>

                {/* Variation radio cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {results.variations && Object.entries(results.variations).map(([label, variation]) => {
                    const isSelected = selectedVariation === label;
                    const labelColors = { A: '#7C5CFC', B: '#3B82F6', C: '#10B981' };
                    const color = labelColors[label] || t.primary;
                    return (
                      <div
                        key={label}
                        onClick={() => { if (!isEditing) { setSelectedVariation(label); setIsEditing(false); } }}
                        style={{ background: t.card, border: `2px solid ${isSelected ? color : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: isEditing ? 'default' : 'pointer', transition: 'all 150ms', boxShadow: isSelected ? `0 4px 16px ${color}25` : 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: isSelected ? `${color}10` : 'transparent', borderBottom: `1px solid ${t.border}` }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: isSelected ? color : t.input, border: `2px solid ${isSelected ? color : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: isSelected ? '#fff' : t.textMuted, flexShrink: 0 }}>
                            {label}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? color : t.textSecondary }}>
                            Variation {label}
                            {variation.hookType && <span style={{ color: t.textMuted, fontWeight: 400, fontSize: 12 }}> · {variation.hookType}</span>}
                          </span>
                        </div>

                        {isSelected && (
                          <div style={{ padding: '14px 16px' }}>
                            {isEditing ? (
                              <textarea
                                value={editedCaption}
                                onChange={e => setEditedCaption(e.target.value)}
                                rows={6}
                                style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.primary}`, borderRadius: 8, color: t.text, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                autoFocus
                              />
                            ) : (
                              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
                                {variation.caption}
                              </div>
                            )}

                            {variation.engagementQuestion && !isEditing && (
                              <div style={{ padding: '10px 12px', background: 'rgba(234,179,8,0.08)', borderRadius: 6, borderLeft: '3px solid #EAB308', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Icon name="message" size={11} color="#EAB308" /> Engagement Question
                                </div>
                                <div style={{ fontSize: 12, color: t.text, fontStyle: 'italic' }}>{variation.engagementQuestion}</div>
                              </div>
                            )}

                            {variation.hashtags && variation.hashtags.length > 0 && !isEditing && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {variation.hashtags.slice(0, 8).map((tag, i) => (
                                  <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: t.primaryBg, color: t.primary, fontSize: 11, fontWeight: 500 }}>
                                    {tag.startsWith('#') ? tag : `#${tag}`}
                                  </span>
                                ))}
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
                  })}
                </div>

                {/* Action bar */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveEdit} disabled={actionLoading} style={{ flex: 1, padding: '10px 16px', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name="check" size={14} color="#fff" /> Save Caption
                      </button>
                      <button onClick={() => setIsEditing(false)} style={{ padding: '10px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handlePostNow} disabled={actionLoading || !results.postId} style={{ flex: 1, minWidth: 100, padding: '10px 14px', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name="send" size={14} color="#fff" /> Post Now
                      </button>
                      <button onClick={() => setShowScheduleModal(true)} disabled={actionLoading || !results.postId} style={{ padding: '10px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="schedule" size={14} /> Schedule
                      </button>
                      <button onClick={handleEditStart} style={{ padding: '10px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="edit" size={14} /> Edit
                      </button>
                      <button onClick={handleReset} style={{ padding: '10px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IpArrowLeft size={14} /> Start Over
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Inline schedule modal ── */}
            {showScheduleModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: t.card, borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>Schedule Post</div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Date & Time</label>
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleScheduleSubmit} disabled={actionLoading || !scheduleDate} style={{ flex: 1, padding: '10px 16px', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: scheduleDate && !actionLoading ? 'pointer' : 'not-allowed', opacity: scheduleDate && !actionLoading ? 1 : 0.5 }}>
                      {actionLoading ? 'Scheduling...' : 'Schedule'}
                    </button>
                    <button onClick={() => setShowScheduleModal(false)} style={{ padding: '10px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
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
        padding: '22px 16px', background: selected ? t.primaryBg : t.card,
        border: `2px solid ${selected ? t.primary : t.border}`,
        borderRadius: 14, cursor: 'pointer', transition: 'all 200ms ease',
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', transform: selected ? 'translateY(-2px)' : 'none',
        boxShadow: selected ? '0 8px 24px rgba(124,92,252,0.2)' : 'none',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)'; e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; } }}
    >
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      onClick={() => onChange(!value)}
      style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: value ? t.primary : t.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms' }}
    >
      <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function WizardNav({ t, onBack, onNext, canNext, nextLabel = 'Next →', nextStyle = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <IpArrowLeft size={14} /> Back
      </button>
      <button onClick={onNext} disabled={!canNext}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: canNext ? t.primary : t.textDisabled, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: canNext ? 'pointer' : 'not-allowed', transition: 'all 150ms', opacity: canNext ? 1 : 0.5, ...nextStyle }}
        onMouseEnter={(e) => { if (canNext && !nextStyle.background) e.currentTarget.style.background = t.primaryHover; }}
        onMouseLeave={(e) => { if (canNext && !nextStyle.background) e.currentTarget.style.background = t.primary; }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function VariationCard({ label, variation, t, copiedId, onCopy, onUse, selected, onSelect }) {
  const labelColors = { A: '#7C5CFC', B: '#3B82F6', C: '#10B981' };
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="message" size={12} color="#EAB308" /> Engagement Question</div>
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
    just_finished_job: 'e.g. Just finished a full bathroom renovation in Springfield. Replaced tiles, new vanity, added rainfall shower. Customer was thrilled...',
    share_tip:         'e.g. Tip about what NOT to flush down the drain — we see this cause blockages every week...',
    got_review:        'e.g. Customer Maria left us a 5-star review saying we saved her from a burst pipe at 11pm on a Friday...',
    running_promo:     'e.g. 20% off all AC tune-ups booked before June 15. Normally $129, now $99...',
    seasonal:          "e.g. With summer coming, we're seeing a lot of AC systems failing that haven't been serviced. Here's what to check...",
    community:         "e.g. We're sponsoring the Riverside Little League team again this year — so proud to support local kids...",
    faq:               'e.g. FAQ: "Can I use chemical drain cleaners?" — our honest answer as plumbers is almost always NO, here\'s why...',
    team_spotlight:    "e.g. Meet Mike, our lead HVAC tech who has been with us for 11 years. He's seen it all and is certified on all major brands...",
  };
  return map[theme] || 'Describe what happened, any specific details, customer name, neighborhood, or anything PostCore should know...';
}
