import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import Layout from '../components/Layout';
import Icon from '../components/Icon';
import {
  IpSparkle, IpCheck, IpRefresh,
  IpEdit, IpSend, IpCopy,
  IpFacebook, IpInstagram, IpGoogle,
  IpLinkedIn, IpTikTok,
  IpHeart, IpBusiness, IpWarning, IpLaugh,
  IpCheckCircle, IpInfo, IpDollar, IpCalendar, IpTeam,
} from '../components/icons';
import { useToast } from '../components/ui';
import { contentAPI, socialAPI } from '../lib/api';
import { setMascotMood } from '../components/PostCoreMascot';

function Spinner({ color = '#fff', size = 16 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: `2px solid ${color}30`, borderTopColor: color,
      borderRadius: '50%', animation: 'qp-spin 0.7s linear infinite',
    }} />
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'static', icon: 'text_post',  label: 'Text Card',  desc: 'Simple text-only, no image', cost: '1 credit'  },
  { id: 'photo',  icon: 'photo_post', label: 'Photo Post', desc: 'AI generates a real photo',  cost: '3 credits' },
];

const JOB_TYPES = [
  {
    id: 'job_done',  label: 'Finished a Job',     desc: 'Show off a completed project',     Icon: IpCheckCircle,
    prompt: 'Just completed a job',
    color: '#22C55E',
    detailHint: 'E.g. replaced water heater, fixed burst pipe, emergency call...',
  },
  {
    id: 'review',    label: 'Got a 5-Star Review', desc: 'Turn 5 stars into new customers',  Icon: IpSparkle,
    prompt: 'Received a 5-star customer review',
    color: '#EAB308',
    detailHint: 'Who left it? Long-time customer, first-time client, referral...',
  },
  {
    id: 'tip',       label: 'Sharing a Tip',       desc: 'Teach, build trust, get saves',    Icon: IpInfo,
    prompt: 'Sharing a helpful maintenance or safety tip',
    color: '#3B82F6',
    detailHint: 'What\'s the tip? E.g. check your water pressure monthly...',
  },
  {
    id: 'deal',      label: 'Running a Deal',      desc: 'Announce an offer or discount',    Icon: IpDollar,
    prompt: 'Running a special promotion or discount',
    color: '#F472B6',
    detailHint: 'What\'s the offer? E.g. 10% off first service this month...',
  },
  {
    id: 'seasonal',  label: 'Seasonal Content',    desc: 'Post what matters this month',     Icon: IpCalendar,
    prompt: 'Seasonal content relevant to this time of year',
    color: '#A78BFA',
    detailHint: 'Any specific angle? E.g. winter pipe protection, summer AC prep...',
  },
  {
    id: 'team',      label: 'Team Moment',         desc: 'Put a face to your business',      Icon: IpTeam,
    prompt: 'Showcasing our team or behind the scenes',
    color: '#FB923C',
    detailHint: 'Who or what are you showcasing?',
  },
];

const PLATFORMS = [
  { id: 'facebook',        label: 'Facebook',    shortLabel: 'FB', Icon: IpFacebook,  color: '#1877F2' },
  { id: 'instagram',       label: 'Instagram',   shortLabel: 'IG', Icon: IpInstagram, color: '#E1306C' },
  { id: 'google_business', label: 'Google Biz',  shortLabel: 'GB', Icon: IpGoogle,    color: '#4285F4' },
  { id: 'linkedin',        label: 'LinkedIn',    shortLabel: 'LI', Icon: IpLinkedIn,  color: '#0A66C2' },
  { id: 'tiktok',          label: 'TikTok',      shortLabel: 'TK', Icon: IpTikTok,    color: '#69C9D0' },
];

const TONES = [
  { id: 'friendly',     label: 'Friendly', desc: 'Warm & conversational',   Icon: IpHeart },
  { id: 'professional', label: 'Pro',      desc: 'Polished & credible',      Icon: IpBusiness },
  { id: 'funny',        label: 'Funny',    desc: 'Light-hearted & witty',    Icon: IpLaugh },
  { id: 'educational',  label: 'Expert',   desc: 'Informative & insightful', Icon: IpSparkle },
  { id: 'urgent',       label: 'Urgent',   desc: 'Time-sensitive & direct',  Icon: IpWarning },
];

const LOADING_MSGS = {
  static: [
    'Writing your caption...',
    'Tailoring it to your industry...',
    'Adding a local touch...',
    'Almost done...',
  ],
  photo: [
    'Writing your caption...',
    'Creating your image...',
    'Adding a local touch...',
    'Almost done...',
  ],
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function QuickPost() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const { showToast } = useToast();

  const [mounted,       setMounted]       = useState(false);
  const [contentType,   setContentType]   = useState('static');
  const [jobType,       setJobType]       = useState(null);
  const [details,       setDetails]       = useState('');
  const [selectedPlats, setSelectedPlats] = useState(['facebook', 'instagram', 'google_business']);
  const [tone,          setTone]          = useState('friendly');
  const [generating,    setGenerating]    = useState(false);
  const [loadMsgIdx,    setLoadMsgIdx]    = useState(0);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState('');
  const [shake,         setShake]         = useState(false);
  const [activeVar,     setActiveVar]     = useState('a');
  const [editing,       setEditing]       = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [copied,        setCopied]        = useState(false);
  const [posting,       setPosting]       = useState(false);
  const [posted,        setPosted]        = useState(false);
  const [isMobile,      setIsMobile]      = useState(false);

  const loadMsgTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => { clearInterval(loadMsgTimer.current); window.removeEventListener('resize', checkMobile); };
  }, []);

  useEffect(() => {
    if (generating) {
      let i = 0; setLoadMsgIdx(0);
      loadMsgTimer.current = setInterval(() => {
        i = (i + 1) % LOADING_MSGS[contentType].length;
        setLoadMsgIdx(i);
      }, 1900);
    } else {
      clearInterval(loadMsgTimer.current);
    }
  }, [generating]);

  if (!mounted) return null;

  const creditCost = contentType === 'photo' ? 3 : 1;
  const dark = theme === 'dark';

  const togglePlatform = (id) => {
    setSelectedPlats(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(p => p !== id) : prev
        : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!jobType) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setError('Pick what happened today');
      return;
    }
    const jt = JOB_TYPES.find(j => j.id === jobType);
    const detailSuffix = details.trim() ? ` — ${details.trim()}` : '';
    const assembled = `${jt.prompt}${detailSuffix}`;

    setError(''); setResult(null); setEditing(false); setActiveVar('a'); setGenerating(true);
    setMascotMood('thinking', 'Crafting your post...');
    try {
      const { data } = await contentAPI.generate({
        contentType,
        prompt: `${assembled} [Tone: ${tone}]`,
        options: { platforms: selectedPlats, tone, quickPost: true },
      });
      setResult(data);
      setEditedCaption(data.variations?.a?.caption || data.caption || '');
      setMascotMood('excited', 'Your post is ready — pick a variation!');
      showToast('Post ready — choose a version below', 'success');
      window.dispatchEvent(new Event('creditRefresh'));
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again');
    } finally {
      setGenerating(false);
    }
  };

  const getCaption  = () => editing ? editedCaption : result?.variations?.[activeVar]?.caption || result?.caption || '';
  const getHashtags = () => result?.variations?.[activeVar]?.hashtags || result?.hashtags || [];
  const getEngQ     = () => result?.variations?.[activeVar]?.engagementQuestion || null;

  const handlePostNow = async () => {
    if (!result?.postId) return;
    setPosting(true);
    try {
      const pubRes = await socialAPI.publish(result.postId, selectedPlats);
      const { posted: postedTo = [], errors = [] } = pubRes.data;
      if (postedTo.length > 0) {
        setPosted(true);
        setMascotMood('celebrating', `🎉 Live on ${postedTo.join(', ')}!`);
        showToast(`Published to ${postedTo.join(', ')}!`, 'success');
        window.dispatchEvent(new Event('creditRefresh'));
      } else {
        const msg = errors.map(e => `${e.platform}: ${e.message}`).join('; ') || 'Publish failed — check your connected accounts';
        showToast(msg, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not publish — please try again', 'error');
    } finally {
      setPosting(false);
    }
  };
  const handleOpenWizard = () => {
    const wizardResult = {
      variations: {
        a: {
          caption: result?.caption || '',
          hashtags: result?.hashtags || [],
          imagePrompt: result?.imagePrompt || '',
          engagementQuestion: result?.engagementQuestion || '',
        },
      },
      fromQuickPost: true,
    };
    sessionStorage.setItem('quickPostResult', JSON.stringify({ result: wizardResult, platforms: selectedPlats, tone, prompt: JOB_TYPES.find(j => j.id === jobType)?.prompt || '', timestamp: Date.now() }));
    router.push('/wizard?from=quick-post');
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(getCaption()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };
  const handleReset = () => {
    setResult(null); setError(''); setEditing(false); setPosted(false);
    setJobType(null); setDetails(''); setShowDetails(false); setActiveVar('a');
  };

  const platformChips = PLATFORMS.filter(p => selectedPlats.includes(p.id));
  const selectedJob   = JOB_TYPES.find(j => j.id === jobType);

  // ─── Shared input style ───────────────────────────────────────────────────
  const iStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: dark ? 'rgba(255,255,255,0.04)' : t.input,
    border: `1px solid ${t.borderStrong}`, borderRadius: 10,
    color: t.text, fontSize: 13, fontFamily: 'inherit',
    lineHeight: 1.6, resize: 'none', outline: 'none',
  };

  return (
    <Layout
      title="Quick Post"
      subtitle="From job site to social in 30 seconds"
      action={
        <button onClick={() => router.push('/wizard')} style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Full Wizard
        </button>
      }
    >
      <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36, paddingBottom: 48 }}>

        {/* ── Content type cards ─────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
            Content type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {CONTENT_TYPES.map(ct => {
              const sel = contentType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => { setContentType(ct.id); setResult(null); }}
                  style={{
                    padding: '20px 18px',
                    background: sel ? (dark ? 'rgba(124,92,252,0.13)' : 'rgba(124,92,252,0.07)') : (dark ? 'rgba(15,15,24,0.72)' : t.card),
                    backdropFilter: 'blur(16px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                    border: `2px solid ${sel ? 'rgba(124,92,252,0.5)' : (dark ? 'rgba(255,255,255,0.07)' : t.border)}`,
                    borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: sel ? `0 8px 28px rgba(124,92,252,0.25), 0 0 0 3px rgba(124,92,252,0.08), inset 0 1px 0 rgba(255,255,255,0.07)` : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${dark ? '0.04' : '0.8'})`,
                    transform: sel ? 'translateY(-3px)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}
                  onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px rgba(155,79,212,0.12)`; } }}
                  onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: sel ? `${t.primary}20` : (dark ? 'rgba(255,255,255,0.06)' : t.input),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 150ms',
                  }}>
                    <Icon name={ct.icon} size={26} style={{ color: sel ? t.primary : t.textMuted }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: sel ? t.primary : t.text, marginBottom: 3 }}>
                      {ct.label}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>{ct.desc}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12, width: 'fit-content',
                    background: sel ? `${t.primary}18` : (dark ? 'rgba(255,255,255,0.06)' : t.input),
                    color: sel ? t.primary : t.textMuted,
                    border: `1px solid ${sel ? t.primaryBorder : 'transparent'}`,
                  }}>
                    {ct.cost}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Job type cards ─────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em' }}>01</span>
              What&apos;s happening today?
            </span>
            {error && !jobType && (
              <span style={{ fontSize: 11, color: t.error, fontWeight: 600 }}>{error}</span>
            )}
          </div>
          <div
            style={{
              display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : '1fr 1fr 1fr', gap: 12,
              animation: shake ? 'qp-shake 400ms ease' : 'none',
            }}
          >
            {JOB_TYPES.map(jt => {
              const sel = jobType === jt.id;
              const JtIcon = jt.Icon;
              return (
                <button
                  key={jt.id}
                  onClick={() => { setJobType(jt.id); setError(''); }}
                  style={{
                    padding: '14px 10px',
                    background: sel ? `${jt.color}18` : dark ? 'rgba(15,15,24,0.68)' : t.card,
                    backdropFilter: 'blur(14px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
                    border: `2px solid ${sel ? jt.color + '80' : dark ? 'rgba(255,255,255,0.07)' : t.border}`,
                    borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: sel ? `0 6px 20px ${jt.color}30, inset 0 1px 0 rgba(255,255,255,0.07)` : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${dark ? '0.03' : '0.7'})`,
                    transform: sel ? 'translateY(-3px) scale(1.02)' : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = jt.color + '55'; e.currentTarget.style.background = `${jt.color}08`; e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 4px 16px ${jt.color}18`; } }}
                  onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : t.card; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: sel ? `${jt.color}25` : dark ? 'rgba(255,255,255,0.06)' : t.input,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 150ms',
                  }}>
                    <JtIcon size={18} style={{ color: sel ? jt.color : t.textMuted }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, color: sel ? jt.color : t.text }}>
                      {jt.label}
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.3, marginTop: 3 }}>
                      {jt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Add details (auto-reveals on job type selection) ──────── */}
        {jobType && (
          <>
            <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em' }}>02</span>
                Add details
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>(optional)</span>
              </div>
              <textarea
                rows={3}
                maxLength={200}
                placeholder={selectedJob?.detailHint || 'Any extra context for PostCore...'}
                value={details}
                onChange={e => setDetails(e.target.value)}
                style={{ ...iStyle, padding: '12px 16px', fontSize: 14 }}
              />
            </div>
          </>
        )}

        {/* ── Platform row ──────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em' }}>03</span>
              Platforms
            </div>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
              {selectedPlats.length === PLATFORMS.length ? 'All platforms' : `${selectedPlats.length} of ${PLATFORMS.length} selected`}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 8 : 16 }}>

            {/* All card */}
            {(() => {
              const allActive = selectedPlats.length === PLATFORMS.length;
              return (
                <button
                  onClick={() => allActive ? setSelectedPlats([PLATFORMS[0].id]) : setSelectedPlats(PLATFORMS.map(p => p.id))}
                  title="All platforms"
                  style={{
                    position: 'relative',
                    padding: '24px 10px 22px',
                    background: allActive ? (dark ? 'rgba(124,92,252,0.13)' : 'rgba(124,92,252,0.07)') : dark ? 'rgba(15,15,24,0.68)' : t.card,
                    backdropFilter: 'blur(14px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
                    border: `2px solid ${allActive ? 'rgba(124,92,252,0.5)' : (dark ? 'rgba(255,255,255,0.07)' : t.border)}`,
                    borderRadius: 18, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 12,
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: allActive ? `0 0 0 3px rgba(124,92,252,0.12), 0 6px 20px rgba(124,92,252,0.22), inset 0 1px 0 rgba(255,255,255,0.07)` : `${t.shadowSm}`,
                  }}
                >
                  {allActive && (
                    <div style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: '50%', background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IpCheck size={11} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    width: 60, height: 60, borderRadius: 16,
                    background: allActive ? t.primaryBg : dark ? 'rgba(255,255,255,0.06)' : t.input,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${allActive ? t.primaryBorder : 'transparent'}`,
                    transition: 'background 160ms',
                  }}>
                    {/* Mini 2×2 grid of platform dots */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {PLATFORMS.slice(0, 4).map((pp) => (
                        <div key={pp.id} style={{ width: 10, height: 10, borderRadius: 3, background: allActive ? pp.color : (dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'), transition: 'background 160ms' }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', textAlign: 'center', color: allActive ? t.primary : t.textSecondary, lineHeight: 1.2 }}>
                    All
                  </span>
                </button>
              );
            })()}

            {/* Individual platform cards */}
            {PLATFORMS.map(p => {
              const active = selectedPlats.includes(p.id);
              const PIcon = p.Icon;
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  title={p.label}
                  style={{
                    position: 'relative',
                    padding: '24px 10px 22px',
                    background: active ? `${p.color}18` : dark ? 'rgba(15,15,24,0.68)' : t.card,
                    backdropFilter: 'blur(14px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(150%)',
                    border: `2px solid ${active ? p.color + '80' : (dark ? 'rgba(255,255,255,0.07)' : t.border)}`,
                    borderRadius: 18, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 12,
                    transition: 'all 160ms ease',
                    boxShadow: active ? `0 0 0 3px ${p.color}28, 0 4px 18px ${p.color}18` : 'none',
                  }}
                >
                  {active && (
                    <div style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IpCheck size={11} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    width: 60, height: 60, borderRadius: 16,
                    background: active ? `${p.color}22` : dark ? 'rgba(255,255,255,0.06)' : t.input,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 160ms',
                    border: `1px solid ${active ? p.color + '40' : 'transparent'}`,
                  }}>
                    <PIcon size={30} style={{ color: active ? p.color : t.textMuted }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', textAlign: 'center', color: active ? p.color : t.textSecondary, lineHeight: 1.2 }}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: 0 }} />

        {/* ── Tone chips ────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em' }}>04</span>
            Tone
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: 8 }}>
            {TONES.map(tn => {
              const sel = tone === tn.id;
              const TIcon = tn.Icon;
              return (
                <button
                  key={tn.id}
                  onClick={() => setTone(tn.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '12px 8px',
                    borderRadius: 12, cursor: 'pointer', transition: 'all 120ms',
                    border: sel ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
                    background: sel ? t.primaryBg : 'transparent',
                  }}
                >
                  <TIcon size={16} style={{ color: sel ? t.primary : t.textMuted, flexShrink: 0 }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: sel ? t.primary : t.text, lineHeight: 1 }}>{tn.label}</div>
                    <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, lineHeight: 1.3 }}>{tn.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Error (API failure) ───────────────────────────────────── */}
        {error && jobType && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 13, color: t.error }}>
            {error}
          </div>
        )}

        {/* ── Generate button ────────────────────────────────────────── */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: generating || !jobType
                ? dark ? 'rgba(255,255,255,0.06)' : t.input
                : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
              color: generating || !jobType ? t.textMuted : '#fff',
              border: `1px solid ${generating || !jobType ? t.border : 'transparent'}`,
              borderRadius: 14, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
              cursor: generating ? 'not-allowed' : 'pointer',
              transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: generating || !jobType ? 'none' : '0 4px 24px rgba(124,92,252,0.35)',
            }}
          onMouseEnter={e => { if (!generating && jobType) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.5)'; } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = (!generating && jobType) ? '0 4px 24px rgba(124,92,252,0.35)' : 'none'; }}
          >
            {generating ? (
              <><Spinner size={17} color={t.textMuted} />{LOADING_MSGS[contentType][loadMsgIdx]}</>
            ) : (
              <>
                <IpSparkle size={17} style={{ color: jobType ? '#fff' : t.textMuted }} />
                {jobType ? 'Generate Post' : 'Choose what happened ↑'}
                {jobType && (
                  <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 20, marginLeft: 2 }}>
                    {creditCost} credit{creditCost > 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {/* ── Result card ────────────────────────────────────────────── */}
        {result && !generating && (
          <div style={{ background: dark ? 'rgba(15,15,24,0.82)' : t.card, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: `1px solid ${dark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: `${t.shadowLg}, inset 0 1px 0 rgba(255,255,255,0.06)`, animation: 'fadeIn 300ms cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : t.border}`, background: dark ? 'rgba(124,92,252,0.13)' : 'rgba(124,92,252,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IpCheck size={12} color="#fff" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, flexShrink: 0 }}>Post ready</span>
                {selectedJob && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: `${selectedJob.color}18`,
                    color: selectedJob.color,
                    border: `1px solid ${selectedJob.color}40`,
                    flexShrink: 0,
                  }}>
                    {selectedJob.label}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {platformChips.map(p => (
                    <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: t.input, border: `1px solid ${t.border}` }}>
                      <p.Icon size={10} style={{ color: t.textMuted }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>{p.shortLabel}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                <IpRefresh size={12} style={{ color: t.textMuted }} /> Try again
              </button>
            </div>

            {/* Image preview (photo posts only) */}
            {contentType === 'photo' && (
              <div style={{ padding: '12px 12px 0' }}>
                {result.mediaUrl ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={result.mediaUrl}
                      alt="Generated"
                      style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 72, borderRadius: 12, background: t.input, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: t.textMuted }}>Image could not be generated — your text is ready</span>
                  </div>
                )}
              </div>
            )}

            {/* Variation tabs */}
            {result.variations && (
              <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
                {['a', 'b', 'c'].map(key => {
                  if (!result.variations[key]) return null;
                  const active = activeVar === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setActiveVar(key); setEditing(false); setEditedCaption(result.variations[key].caption); }}
                      style={{ padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textMuted, transition: 'all 120ms' }}
                    >
                      Version {key.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Caption */}
            <div style={{ padding: '14px 16px' }}>
              {editing ? (
                <textarea
                  value={editedCaption}
                  onChange={e => setEditedCaption(e.target.value)}
                  autoFocus rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: t.input, border: `2px solid ${t.primary}`, borderRadius: 10, color: t.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical', outline: 'none' }}
                />
              ) : (
                <p style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{getCaption()}</p>
              )}
            </div>

            {/* Hashtags */}
            {getHashtags().length > 0 && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {getHashtags().slice(0, 8).map((h, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}` }}>
                    {h.startsWith('#') ? h : `#${h}`}
                  </span>
                ))}
              </div>
            )}

            {/* Engagement question */}
            {getEngQ() && (
              <div style={{ margin: '0 16px 14px', padding: '10px 12px', background: 'rgba(124,92,252,0.06)', border: `1px solid ${t.primaryBorder}`, borderLeft: `3px solid ${t.primary}`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.primary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested question</div>
                <div style={{ fontSize: 12, color: t.textSecondary, fontStyle: 'italic' }}>{getEngQ()}</div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {posted ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: '100%', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, fontSize: 14, fontWeight: 700, color: t.success }}>
                    <IpCheck size={16} style={{ color: t.success }} /> Posted successfully!
                  </div>
                  <button onClick={handleReset} style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.input, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Post another
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePostNow}
                  disabled={posting || !result?.postId}
                  style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: posting ? 'rgba(124,92,252,0.6)' : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: posting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(124,92,252,0.35)', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)' }}
                  onMouseEnter={e => { if (!posting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,92,252,0.5)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.35)'; }}
                >
                  {posting ? <><Spinner size={15} /> Publishing…</> : <><IpSend size={15} color="#fff" /> Post Now</>}
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => { if (!editing) setEditedCaption(getCaption()); setEditing(v => !v); }}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <IpEdit size={13} style={{ color: t.textSecondary }} /> {editing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={handleOpenWizard}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <IpSparkle size={13} style={{ color: t.textSecondary }} /> Wizard
                </button>
                <button
                  onClick={handleCopy}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: copied ? 'rgba(34,197,94,0.08)' : t.card, color: copied ? t.success : t.textSecondary, border: `1px solid ${copied ? t.success : t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                >
                  {copied
                    ? <><IpCheck size={13} style={{ color: t.success }} />Copied</>
                    : <><IpCopy size={13} style={{ color: t.textSecondary }} />Copy</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`
        @keyframes qp-spin  { to { transform: rotate(360deg); } }
        @keyframes qp-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
      `}</style>
    </Layout>
  );
}

