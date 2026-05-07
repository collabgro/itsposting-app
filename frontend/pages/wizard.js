import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpJobDone, IpTip, IpReview, IpPromotion, IpSeasonal, IpCommunity,
  IpFAQ, IpTeam, IpBriefcase,
  IpCredits, IpFacebook, IpInstagram, IpGoogle,
  IpArrowLeft, IpArrowRight, IpRefresh, IpCopy,
  IpCheck, IpEdit, IpSparkle, IpChevronRight,
} from '../components/icons';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';

// ── Step 1 data ──────────────────────────────────────────────────────────────
const CONTENT_THEMES = [
  { id: 'just_finished_job',      emoji: '🔨', label: 'Just finished a job',     desc: 'Show off a completed project' },
  { id: 'share_tip',              emoji: '💡', label: 'Want to share a tip',      desc: 'Teach your audience something' },
  { id: 'got_review',             emoji: '⭐', label: 'Got a great review',       desc: 'Showcase customer love' },
  { id: 'running_promo',          emoji: '📅', label: 'Running a promotion',      desc: 'Announce an offer or deal' },
  { id: 'seasonal',               emoji: '🌤️', label: 'Seasonal content',         desc: null },
  { id: 'community',              emoji: '🏘️', label: 'Community / local event',  desc: 'Connect with your neighborhood' },
  { id: 'faq',                    emoji: '❓', label: 'FAQ or myth-busting',      desc: 'Answer what customers always ask' },
  { id: 'team_spotlight',         emoji: '🎉', label: 'Team spotlight',           desc: 'Put a face to your business' },
];

// ── Step 2 data ──────────────────────────────────────────────────────────────
const TONES = [
  { id: 'friendly',     emoji: '😊', label: 'Friendly & casual',         desc: 'Warm, approachable, conversational' },
  { id: 'professional', emoji: '💼', label: 'Professional & trustworthy', desc: 'Polished, credible, authoritative' },
  { id: 'funny',        emoji: '😄', label: 'Funny & relatable',         desc: 'Light-hearted, witty, human' },
  { id: 'educational',  emoji: '📚', label: 'Educational & expert',      desc: 'Informative, detailed, insightful' },
  { id: 'urgent',       emoji: '🔥', label: 'Urgent & must-act-now',     desc: 'Compelling, time-sensitive, direct' },
];

// ── Step 3 data ──────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'facebook',       icon: IpFacebook,  label: 'Facebook',        color: '#1877F2', bg: 'rgba(24,119,242,0.1)',  border: 'rgba(24,119,242,0.3)',  desc: 'Best for longer posts & community' },
  { id: 'instagram',      icon: IpInstagram, label: 'Instagram',       color: '#E1306C', bg: 'rgba(225,48,108,0.1)', border: 'rgba(225,48,108,0.3)', desc: 'Visual-first, hashtag-rich content' },
  { id: 'google_business',icon: IpGoogle,    label: 'Google Business', color: '#4285F4', bg: 'rgba(66,133,244,0.1)', border: 'rgba(66,133,244,0.3)', desc: 'Local search visibility & reviews' },
  { id: 'all',            icon: IpSparkle,   label: 'All Three',       color: '#7C5CFC', bg: 'rgba(124,92,252,0.1)', border: 'rgba(124,92,252,0.3)', desc: 'Auto-adapted for each platform' },
];

// ── Loading messages ──────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  (industry) => `Reading the room for ${industry || 'your industry'}...`,
  () => 'Writing like a local expert...',
  () => 'Adding that authentic touch...',
  () => 'Crafting your three variations...',
  () => 'Almost ready — putting on the finishing touches...',
];

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
async function apiPost(path, body) {
  const token = localStorage.getItem('token');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Wizard() {
  const router = useRouter();
  const { t } = useTheme();

  const [step, setStep] = useState(1);            // 1–4, 'loading', 'results'
  const [theme, setTheme] = useState(null);       // Step 1
  const [tone, setTone] = useState(null);         // Step 2
  const [platform, setPlatform] = useState(null); // Step 3
  const [details, setDetails] = useState('');     // Step 4
  const [includeCTA, setIncludeCTA] = useState(true);

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [industry, setIndustry] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);

  const loadingInterval = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const token = localStorage.getItem('token');
    fetch('/api/customers/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setIndustry(d.industry || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 'loading') {
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
      }, 1800);
    }
    return () => clearInterval(loadingInterval.current);
  }, [step]);

  const canProceed = () => {
    if (step === 1) return !!theme;
    if (step === 2) return !!tone;
    if (step === 3) return !!platform;
    if (step === 4) return true;
    return false;
  };

  const handleNext = async () => {
    if (step === 4) { await handleGenerate(); }
    else setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 1) { router.push('/dashboard'); return; }
    if (step === 'results') { setStep(4); return; }
    setStep(s => s - 1);
  };

  const handleReset = () => {
    setStep(1); setTheme(null); setTone(null); setPlatform(null);
    setDetails(''); setIncludeCTA(true); setResults(null);
    setError(null); setSelectedVariation(null);
  };

  const handleTryDifferentTone = () => {
    setStep(2); setTone(null); setResults(null);
  };

  const handleGenerate = async () => {
    setStep('loading');
    setLoadingMsgIdx(0);
    setError(null);
    try {
      const startRes = await apiPost('/api/wizard/start', {});
      const wizardId = startRes.wizardId;

      // Submit each step's answers so the backend session is populated
      await apiPost('/api/wizard/step', { wizardId, stepId: 'content_type', answers: { value: theme } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'tone', answers: { value: tone } });
      const detailsObj = buildDetailsObject(theme, details.trim());
      await apiPost('/api/wizard/step', { wizardId, stepId: 'details', answers: { ...detailsObj, includeCTA } });
      await apiPost('/api/wizard/step', { wizardId, stepId: 'platform', answers: { value: platform } });

      const genRes = await apiPost('/api/wizard/generate', { wizardId });
      setResults(genRes);
      setStep('results');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStep(4);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleUsePost = (variation) => {
    sessionStorage.setItem('wizardPost', JSON.stringify({
      caption: variation.caption,
      hashtags: variation.hashtags,
      imagePrompt: variation.imagePrompt,
      engagementQuestion: variation.engagementQuestion,
      platform: platform === 'all' ? 'facebook' : platform,
      contentTheme: theme,
      tone,
    }));
    router.push('/upload?from=wizard');
  };

  const stepNum = typeof step === 'number' ? step : (step === 'results' ? 5 : 4.5);
  const progressPct = Math.min(100, ((stepNum - 1) / 4) * 100);
  const stepLabels = ["What's happening?", "What's the vibe?", 'Where to post?', 'Any details?'];

  return (
    <Layout title="Post Wizard" subtitle="Guided content creation — powered by PostCore">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

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
            STEP 1 — What's happening today?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeading t={t} emoji="✨" title="What's happening today?" sub="Pick the type of post you want to create" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
              {CONTENT_THEMES.map((item) => {
                const selected = theme === item.id;
                const desc = item.id === 'seasonal' ? getSeasonalDesc() : item.desc;
                return (
                  <ThemeCard key={item.id} selected={selected} onClick={() => setTheme(item.id)} t={t}>
                    <div style={{ fontSize: 32, marginBottom: 10, lineHeight: 1 }}>{item.emoji}</div>
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
            STEP 2 — What's the vibe?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <StepHeading t={t} emoji="🎭" title="What's the vibe?" sub="Choose the tone that fits your brand today" />
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
                      fontSize: 24,
                    }}>
                      {item.emoji}
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
            STEP 3 — Where are we posting?
        ───────────────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <StepHeading t={t} emoji="📡" title="Where are we posting?" sub="Choose your platform — PostCore adapts the content automatically" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 32 }}>
              {PLATFORMS.map((item) => {
                const selected = platform === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPlatform(item.id)}
                    style={{
                      padding: '22px 16px', background: selected ? item.bg : t.card,
                      border: `2px solid ${selected ? item.color : t.border}`,
                      borderRadius: 14, cursor: 'pointer', transition: 'all 200ms ease',
                      textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = item.border; e.currentTarget.style.background = item.bg; } }}
                    onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; } }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: item.bg, border: `1px solid ${item.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <item.icon size={22} style={{ color: item.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                    {selected && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IpCheck size={11} color="#fff" strokeWidth={3} />
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
            STEP 4 — Add any details (optional)
        ───────────────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <StepHeading t={t} emoji="✏️" title="Add any details" sub="Optional — but the more context you give PostCore, the better the posts" />

            {/* Summary pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, padding: '14px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10 }}>
              <SelectionPill t={t} label={CONTENT_THEMES.find(x => x.id === theme)?.emoji + ' ' + CONTENT_THEMES.find(x => x.id === theme)?.label} />
              <SelectionPill t={t} label={TONES.find(x => x.id === tone)?.emoji + ' ' + TONES.find(x => x.id === tone)?.label} />
              <SelectionPill t={t} label={PLATFORMS.find(x => x.id === platform)?.label} />
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
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.error, fontSize: 13, marginBottom: 20 }}>
                ⚠️ {error}
              </div>
            )}

            <WizardNav
              t={t} onBack={handleBack} onNext={handleNext} canNext={true}
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
                {LOADING_MESSAGES[loadingMsgIdx](industry)}
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
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 6 }}>Your posts are ready!</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>PostCore generated 3 variations — pick your favourite or customise it</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
              {results.variations && Object.entries(results.variations).map(([label, variation]) => (
                <VariationCard
                  key={label} label={label} variation={variation} t={t}
                  copiedId={copiedId} onCopy={handleCopy}
                  onUse={() => handleUsePost(variation)}
                  selected={selectedVariation === label}
                  onSelect={() => setSelectedVariation(label === selectedVariation ? null : label)}
                />
              ))}
            </div>

            {results.hashtags && results.hashtags.length > 0 && (
              <div style={{ padding: '16px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Hashtags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {results.hashtags.map((tag, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: t.primaryBg, color: t.primary, fontSize: 12, fontWeight: 500, border: `1px solid ${t.primaryBorder}` }}>
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {results.imagePrompt && (
              <div style={{ padding: '16px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📸 Image Prompt Suggestion</div>
                <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{results.imagePrompt}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
              <button onClick={handleTryDifferentTone} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.primaryBorder; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }}>
                <IpRefresh size={14} /> Try Different Tone
              </button>
              <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.primaryBorder; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }}>
                <IpArrowLeft size={14} /> Start Over
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeading({ t, emoji, title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{emoji}</div>
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

function SelectionPill({ t, label }) {
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, background: t.card, border: `1px solid ${t.primaryBorder}`, fontSize: 12, fontWeight: 600, color: t.primary }}>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>💬 Engagement Question</div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📸 Image Prompt</div>
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
