import { useState, useEffect, useRef } from 'react';
import {
  IpClose, IpSparkle, IpPhoto as ImageIcon, IpVideo, IpCarousel, IpDrafts,
  IpCredits, IpCheck, IpChevronLeft, IpChevronRight, IpCalendar, IpSchedule,
  IpFacebook, IpInstagram, IpGoogle, IpHash, IpWarning, IpRefresh, IpTip,
  IpLinkedIn, IpTikTok, IpSearch,
} from './icons';
import { contentAPI, postsAPI, analyticsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../lib/theme';
import { Button, Spinner } from './ui';

const CONTENT_TYPES = [
  { id: 'static',   name: 'Text Card',   icon: IpDrafts,   credits: 1,  desc: 'Styled quote or tip on a branded background', example: 'Share a quick maintenance tip' },
  { id: 'photo',    name: 'Photo Post',  icon: ImageIcon,  credits: 3,  desc: 'Generated image with matching caption',         example: 'A freshly sealed concrete driveway' },
  { id: 'carousel', name: 'Carousel',    icon: IpCarousel, credits: 5,  desc: '5-slide educational series with visuals',       example: '5 tips for spring garden prep' },
  { id: 'video',    name: 'Video Post',  icon: IpVideo,    credits: 10, desc: '30-second avatar explainer video',              example: 'Explain your top service offering' },
];

const PLATFORMS = [
  { id: 'facebook',        label: 'Facebook',         icon: IpFacebook,  charLimit: 63206 },
  { id: 'instagram',       label: 'Instagram',        icon: IpInstagram, charLimit: 2200 },
  { id: 'google_business', label: 'Business Profile', icon: IpGoogle,    charLimit: 1500 },
  { id: 'linkedin',        label: 'LinkedIn',         icon: IpLinkedIn,  charLimit: 3000 },
  { id: 'tiktok',          label: 'TikTok',           icon: IpTikTok,    charLimit: 2200 },
];

const PLATFORM_COLORS = {
  facebook:        '#1877F2',
  instagram:       '#E1306C',
  linkedin:        '#0A66C2',
  tiktok:          '#111111',
  google_business: '#4285F4',
};

const FORMAT_TABS = ['Popular', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok'];

const FORMAT_DATA = {
  Popular: [
    { platform: 'instagram', label: 'Instagram Post (4:5)',      width: 1080, height: 1350, frame: 'phone' },
    { platform: 'instagram', label: 'Instagram Story',           width: 1080, height: 1920, frame: 'phone' },
    { platform: 'facebook',  label: 'Facebook Post (Landscape)', width: 1200, height: 630,  frame: 'landscape' },
    { platform: 'linkedin',  label: 'LinkedIn Post',             width: 1200, height: 1200, frame: 'square' },
    { platform: 'linkedin',  label: 'LinkedIn Video',            width: 1280, height: 1920, frame: 'phone' },
    { platform: 'tiktok',    label: 'TikTok Video',              width: 1080, height: 1920, frame: 'phone' },
  ],
  Facebook: [
    { platform: 'facebook', label: 'Facebook Post (Landscape)', width: 1200, height: 630,  frame: 'landscape' },
    { platform: 'facebook', label: 'Facebook Story',            width: 1080, height: 1920, frame: 'phone' },
    { platform: 'facebook', label: 'Facebook Video',            width: 1080, height: 1080, frame: 'square' },
  ],
  Instagram: [
    { platform: 'instagram', label: 'Instagram Post (4:5)', width: 1080, height: 1350, frame: 'phone' },
    { platform: 'instagram', label: 'Instagram Story',      width: 1080, height: 1920, frame: 'phone' },
    { platform: 'instagram', label: 'Instagram Reel',       width: 1080, height: 1920, frame: 'phone' },
  ],
  LinkedIn: [
    { platform: 'linkedin', label: 'LinkedIn Post',  width: 1200, height: 1200, frame: 'square' },
    { platform: 'linkedin', label: 'LinkedIn Video', width: 1280, height: 1920, frame: 'phone' },
  ],
  TikTok: [
    { platform: 'tiktok', label: 'TikTok Video', width: 1080, height: 1920, frame: 'phone' },
    { platform: 'tiktok', label: 'TikTok Story', width: 1080, height: 1920, frame: 'phone' },
  ],
};

const GEN_STEPS  = ['Creating your draft', 'Writing copy', 'Generating visuals', 'Finalizing your post'];
const STEP_DELAYS = [800, 2200, 5000, 9000];

// ── SVG Mockup Frames ──────────────────────────────────────────────────────
function FormatMockup({ frame, platformColor, uid }) {
  const gId = `fg-${uid}`;
  if (frame === 'phone') {
    return (
      <svg viewBox="0 0 90 162" style={{ width: '100%', display: 'block', maxHeight: 128 }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#9B4FD4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#E040A0" stopOpacity="0.13" />
          </linearGradient>
        </defs>
        <rect x="4" y="2" width="82" height="158" rx="13" fill="#181828" stroke="#2e2e42" strokeWidth="1" />
        <rect x="8" y="13" width="74" height="134" rx="5" fill={`url(#${gId})`} />
        <rect x="30" y="2" width="30" height="8" rx="4" fill="#0e0e1a" />
        <rect x="16" y="84" width="46" height="4"   rx="2"   fill="rgba(255,255,255,0.13)" />
        <rect x="20" y="94" width="35" height="3"   rx="1.5" fill="rgba(255,255,255,0.07)" />
        <rect x="16" y="104" width="28" height="3"  rx="1.5" fill="rgba(255,255,255,0.06)" />
        <circle cx="18" cy="24" r="6" fill={platformColor} />
      </svg>
    );
  }
  if (frame === 'landscape') {
    return (
      <svg viewBox="0 0 160 90" style={{ width: '100%', display: 'block', maxHeight: 128 }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#9B4FD4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#E040A0" stopOpacity="0.13" />
          </linearGradient>
        </defs>
        <rect x="2" y="6" width="156" height="78" rx="8" fill="#181828" stroke="#2e2e42" strokeWidth="1" />
        <rect x="6" y="10" width="148" height="70" rx="5" fill={`url(#${gId})`} />
        <circle cx="14" cy="16" r="3" fill="#2e2e42" />
        <circle cx="22" cy="16" r="3" fill="#2e2e42" />
        <circle cx="30" cy="16" r="3" fill="#2e2e42" />
        <rect x="14" y="50" width="64" height="5"   rx="2.5" fill="rgba(255,255,255,0.13)" />
        <rect x="14" y="60" width="46" height="3.5" rx="1.75" fill="rgba(255,255,255,0.07)" />
        <circle cx="18" cy="26" r="6" fill={platformColor} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" style={{ width: '100%', display: 'block', maxHeight: 128 }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#9B4FD4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#E040A0" stopOpacity="0.13" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="10" fill="#181828" stroke="#2e2e42" strokeWidth="1" />
      <rect x="8" y="8" width="104" height="104" rx="7" fill={`url(#${gId})`} />
      <rect x="16" y="68" width="56" height="5"   rx="2.5" fill="rgba(255,255,255,0.13)" />
      <rect x="16" y="79" width="40" height="3.5" rx="1.75" fill="rgba(255,255,255,0.07)" />
      <rect x="16" y="88" width="32" height="3"   rx="1.5"  fill="rgba(255,255,255,0.05)" />
      <circle cx="20" cy="20" r="7" fill={platformColor} />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ContentCreatorModal({
  onClose, onSuccess,
  defaultDate = '', defaultScheduleMode = 'now',
  initialPrompt = '', initialContentType = '',
}) {
  const { t } = useTheme();

  // Steps: 1=content type  2=format picker  3=prompt  4=generating  5=result
  const [step, setStep]           = useState(initialPrompt && initialContentType ? 3 : 1);
  const [contentType, setContentType] = useState(initialContentType || '');
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [formatTab,     setFormatTab]     = useState('Popular');
  const [formatSearch,  setFormatSearch]  = useState('');
  const [hoveredFormat, setHoveredFormat] = useState(null);
  const [prompt,        setPrompt]        = useState(initialPrompt || '');
  const [generating,    setGenerating]    = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [credits,    setCredits]    = useState(null);
  const [providers,  setProviders]  = useState(null);
  const [doneSteps,  setDoneSteps]  = useState([]);
  const [platforms,  setPlatforms]  = useState(['facebook', 'instagram']);
  const [scheduleMode,  setScheduleMode]  = useState(defaultScheduleMode);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [saving,      setSaving]    = useState(false);
  const [topSlots,    setTopSlots]  = useState([]);
  const timersRef = useRef([]);

  useEffect(() => {
    contentAPI.getCredits().then(r => setCredits(r.data)).catch(() => {});
    contentAPI.getProviders().then(r => setProviders(r.data)).catch(() => {});
    analyticsAPI.getOptimalTimes().then(r => setTopSlots((r.data?.recommendations || []).slice(0, 3))).catch(() => {});
  }, []);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const startGenAnimations = () => {
    setDoneSteps([]);
    STEP_DELAYS.forEach((delay, idx) => {
      const id = setTimeout(() => setDoneSteps(prev => [...prev, idx]), delay);
      timersRef.current.push(id);
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Please enter a prompt'); return; }
    setGenerating(true);
    setDoneSteps([]);
    setStep(4);
    clearTimers();
    startGenAnimations();
    try {
      const res = await contentAPI.generate({ contentType, prompt, selectedFormat });
      setGeneratedContent(res.data);
      setCredits(prev => prev ? { ...prev, balance: res.data.creditsRemaining } : null);
      setStep(5);
      toast.success('Draft created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
      setStep(3);
    } finally {
      setGenerating(false);
      clearTimers();
    }
  };

  const removeHashtag = tag => setGeneratedContent(prev => ({ ...prev, hashtags: prev.hashtags.filter(h => h !== tag) }));

  const handleSave = async () => {
    if (platforms.length === 0) { toast.error('Select at least one platform'); return; }
    if (scheduleMode === 'later' && !scheduledDate) { toast.error('Pick a date and time'); return; }
    setSaving(true);
    try {
      if (generatedContent?.postId) {
        await postsAPI.update(generatedContent.postId, {
          platforms,
          scheduledDate: scheduleMode === 'later' ? scheduledDate : null,
          status: scheduleMode === 'later' ? 'scheduled' : 'draft',
        });
      }
      toast.success(scheduleMode === 'later' ? 'Post scheduled!' : 'Post saved');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const captionLen    = generatedContent?.caption?.length || 0;
  const platformLimit = Math.min(...platforms.map(id => PLATFORMS.find(p => p.id === id)?.charLimit || 9999));
  const overLimit     = captionLen > platformLimit;

  const getFormats = () => {
    const list = FORMAT_DATA[formatTab] || [];
    if (!formatSearch.trim()) return list;
    return list.filter(f => f.label.toLowerCase().includes(formatSearch.toLowerCase()));
  };

  const TAB_ICONS = { Facebook: IpFacebook, Instagram: IpInstagram, LinkedIn: IpLinkedIn, TikTok: IpTikTok };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
      <div style={{ background: t.card, borderRadius: 18, border: `1px solid ${t.border}`, width: '100%', maxWidth: step === 2 ? 900 : 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.6)', transition: 'max-width 300ms ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IpSparkle size={16} color="url(#brand-gradient)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: 0 }}>Content Creator</h2>
              {credits && <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}><span style={{ color: t.primary, fontWeight: 700, fontFamily: 'monospace' }}>{credits.balance}</span> credits available</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary, cursor: 'pointer', flexShrink: 0 }}><IpClose size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* ── STEP 1 — Content type ── */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>What would you like to create today?</p>
              {providers && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: '10px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <IpCredits size={13} style={{ color: t.warning, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>Image sources:</span>
                  <span style={{ fontSize: 12, color: providers.nanobanana?.available ? t.success : t.textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{providers.nanobanana?.available ? <IpCheck size={12} /> : '○'} Image One</span>
                  <span style={{ fontSize: 12, color: providers.midjourney?.available ? t.success : t.textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{providers.midjourney?.available ? <IpCheck size={12} /> : '○'} Image Two</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {CONTENT_TYPES.map(type => {
                  const Icon = type.icon;
                  const canAfford = !credits || credits.balance >= type.credits;
                  return (
                    <button key={type.id} onClick={() => { if (canAfford) { setContentType(type.id); setStep(2); } else toast.error('Insufficient credits'); }} disabled={!canAfford}
                      style={{ padding: 20, border: `2px solid ${t.border}`, background: t.input, borderRadius: 14, textAlign: 'left', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: canAfford ? 1 : 0.45, transition: 'all 150ms' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Icon size={22} color={canAfford ? 'url(#brand-gradient)' : t.textMuted} />
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`, fontFamily: 'monospace' }}>{type.credits} cr</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>{type.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{type.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2 — Choose Format ── */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} style={{ fontSize: 12, color: t.primary, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                <IpChevronLeft size={14} /> Back
              </button>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <IpSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }} />
                <input type="text" placeholder="What would you like to create?" value={formatSearch} onChange={e => setFormatSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 10, color: t.text, fontSize: 13 }} />
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 20 }}>
                {FORMAT_TABS.map(tab => {
                  const active = formatTab === tab && !formatSearch.trim();
                  const TabIcon = TAB_ICONS[tab];
                  const tabColor = PLATFORM_COLORS[tab.toLowerCase()] || t.primary;
                  return (
                    <button key={tab} onClick={() => { setFormatTab(tab); setFormatSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 16px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap',
                        border: active ? '2px solid rgba(155,79,212,0.55)' : `1px solid ${t.border}`,
                        background: active ? 'linear-gradient(135deg, rgba(155,79,212,0.14), rgba(224,64,160,0.10))' : t.input,
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        color: active ? t.primary : t.textMuted, cursor: 'pointer', transition: 'all 150ms',
                      }}>
                      {TabIcon && <TabIcon size={13} style={{ color: active ? t.primary : tabColor }} />}
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Section heading */}
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>
                {formatSearch.trim() ? `Results for "${formatSearch}"` : formatTab}
              </div>

              {/* Format grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
                {getFormats().map((fmt, idx) => {
                  const pColor  = PLATFORM_COLORS[fmt.platform] || '#7C5CFC';
                  const cardKey = `${fmt.label}-${idx}`;
                  const isHov   = hoveredFormat === cardKey;
                  return (
                    <button key={cardKey}
                      onClick={() => { setSelectedFormat(fmt); setPlatforms([fmt.platform]); setStep(3); }}
                      onMouseEnter={() => setHoveredFormat(cardKey)}
                      onMouseLeave={() => setHoveredFormat(null)}
                      style={{
                        padding: '14px 12px 12px', border: `1px solid ${isHov ? 'rgba(155,79,212,0.45)' : t.border}`,
                        background: t.input, borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                        boxShadow: isHov ? '0 10px 28px rgba(155,79,212,0.2)' : 'none',
                        transition: 'all 180ms ease',
                      }}>
                      <div style={{ position: 'relative', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '100%', maxWidth: 96 }}>
                          <FormatMockup frame={fmt.frame} platformColor={pColor} uid={cardKey} />
                        </div>
                        {isHov && (
                          <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', fontFamily: 'monospace', pointerEvents: 'none' }}>
                            {fmt.width} × {fmt.height}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>{fmt.label}</div>
                    </button>
                  );
                })}
                {getFormats().length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: t.textMuted, fontSize: 13 }}>
                    No formats match your search
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3 — Prompt ── */}
          {step === 3 && (
            <div>
              {initialPrompt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: t.primary }}>
                  <IpSparkle size={13} style={{ flexShrink: 0 }} />
                  <span><strong>PostCore draft loaded</strong> — edit the caption or generate something new</span>
                </div>
              )}
              <button onClick={() => setStep(2)} style={{ fontSize: 12, color: t.primary, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                <IpChevronLeft size={14} /> Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '12px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, marginBottom: 20 }}>
                {(() => { const tp = CONTENT_TYPES.find(x => x.id === contentType); return tp ? <><tp.icon size={16} color="url(#brand-gradient)" style={{ flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tp.name}</span><span style={{ fontSize: 12, color: t.textMuted }}>·</span><span style={{ fontSize: 12, color: t.textMuted }}>{tp.credits} credits</span></> : null; })()}
                {selectedFormat && (
                  <>
                    <span style={{ fontSize: 12, color: t.textMuted }}>·</span>
                    <span style={{ fontSize: 12, color: t.textSecondary }}>{selectedFormat.label}</span>
                    <span style={{ fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>{selectedFormat.width}×{selectedFormat.height}</span>
                  </>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Describe what you want</label>
                <textarea autoFocus placeholder={`Example: "${CONTENT_TYPES.find(tp => tp.id === contentType)?.example}"`} value={prompt} onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }} rows={5}
                  style={{ width: '100%', padding: '12px 14px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 10, color: t.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>Tip: be specific — include your location, service type, or target audience. Press ⌘+Enter to generate.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${t.border}`, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>Cost: <strong style={{ color: t.text, fontFamily: 'monospace' }}>{CONTENT_TYPES.find(tp => tp.id === contentType)?.credits} credits</strong>{credits && <span style={{ color: t.textMuted }}> · {credits.balance} available</span>}</span>
                <button onClick={handleGenerate} disabled={!prompt.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: !prompt.trim() ? t.textDisabled : t.primary, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: prompt.trim() ? 'pointer' : 'not-allowed', border: 'none' }}>
                  <IpSparkle size={14} /> Generate
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4 — Generating ── */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Spinner size={48} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>Creating your draft</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>This usually takes a few seconds</div>
              <div style={{ display: 'grid', gap: 8, maxWidth: 320, margin: '0 auto' }}>
                {GEN_STEPS.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: doneSteps.includes(i) ? 'rgba(34,197,94,0.08)' : t.input, border: `1px solid ${doneSteps.includes(i) ? 'rgba(34,197,94,0.3)' : t.border}` }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: doneSteps.includes(i) ? t.success : t.textMuted, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{doneSteps.includes(i) ? <IpCheck size={11} style={{ color: '#fff' }} /> : <span style={{ fontSize: 11 }}>{i + 1}</span>}</div>
                    <div style={{ fontSize: 13, color: t.text }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 5 — Result ── */}
          {step === 5 && generatedContent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div style={{ padding: 16, background: t.input, border: `1px solid ${t.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Preview</div>
                {generatedContent.mediaUrl && generatedContent.contentType !== 'video' && (
                  <img src={generatedContent.mediaUrl} alt="Generated preview" style={{ width: '100%', borderRadius: 14, objectFit: 'cover', maxHeight: 420, marginBottom: 14 }} />
                )}
                {generatedContent.contentType === 'video' && generatedContent.mediaUrl && (
                  <video controls src={generatedContent.mediaUrl} style={{ width: '100%', borderRadius: 14, background: '#000', marginBottom: 14 }} />
                )}
                {generatedContent.contentType === 'carousel' && generatedContent.slides?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 14 }}>
                    {generatedContent.slides.map((slide, idx) => (
                      <div key={idx} style={{ border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', background: t.input }}>
                        {slide.mediaUrl
                          ? <img src={slide.mediaUrl} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, fontSize: 12, padding: 10 }}>No image</div>}
                        <div style={{ padding: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{slide.title || `Slide ${idx + 1}`}</div>
                          {slide.text && <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>{slide.text}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{generatedContent.caption}</div>
                {generatedContent.hashtags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {generatedContent.hashtags.map(tag => (
                      <span key={tag} style={{ padding: '6px 10px', borderRadius: 999, background: t.primaryBg, color: t.primary, fontSize: 12 }}>{tag.startsWith('#') ? tag : `#${tag}`}</span>
                    ))}
                  </div>
                )}
                {generatedContent.videoError && (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.2)', color: '#B8323E', fontSize: 12 }}>{generatedContent.videoError}</div>
                )}
                {!generatedContent.mediaUrl && generatedContent.contentType !== 'video' && (
                  <div style={{ marginTop: 14, fontSize: 12, color: t.textMuted }}>No image was generated. Set GOOGLE_AI_API_KEY to enable image generation.</div>
                )}
                {generatedContent.contentType === 'video' && !generatedContent.mediaUrl && (
                  <div style={{ marginTop: 14, fontSize: 12, color: t.textMuted }}>Video pending — HeyGen generates it when HEYGEN_API_KEY is configured.</div>
                )}
                {generatedContent.script && (
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: t.input, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>Video script</div>
                    <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{generatedContent.script}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <button type="button" onClick={() => setScheduleMode('now')}   style={{ padding: 12, borderRadius: 10, border: `1px solid ${scheduleMode === 'now'   ? t.primary : t.border}`, background: scheduleMode === 'now'   ? t.primaryBg : t.input, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: t.text }}>Save as draft</button>
                <button type="button" onClick={() => setScheduleMode('later')} style={{ padding: 12, borderRadius: 10, border: `1px solid ${scheduleMode === 'later' ? t.primary : t.border}`, background: scheduleMode === 'later' ? t.primaryBg : t.input, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: t.text }}>Schedule</button>
              </div>
              {scheduleMode === 'later' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 10, color: t.text, boxSizing: 'border-box' }} />
                  {topSlots.length > 0 && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {topSlots.map((slot, idx) => (
                        <button key={idx} type="button" onClick={() => setScheduledDate(slot.value)}
                          style={{ padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{slot.label}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{slot.value}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save post'}</Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
