/**
 * ItsPosting — Quick Post
 * Mobile-first single-screen flow: job site to social in 30 seconds.
 * No Layout wrapper — full-screen, distraction-free, thumb-friendly.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import {
  IpZap, IpSparkle, IpArrowLeft, IpCheck, IpRefresh,
  IpEdit, IpCarousel, IpSend, IpCopy,
  IpFacebook, IpInstagram, IpGoogle, IpAllPlatforms,
} from '../components/icons';

// ─── Tone icons (custom inline — not in icon system) ──────────────────────────
function IcoFriendly({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
    </svg>
  );
}
function IcoProfessional({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}
function IcoFunny({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 3 4 3 4-3 4-3" />
      <line x1="8" y1="9" x2="10" y2="9" />
      <line x1="14" y1="9" x2="16" y2="9" />
    </svg>
  );
}
function IcoExpert({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  );
}
function IcoUrgent({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
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
const PLATFORMS = [
  { id: 'facebook',        shortLabel: 'FB', Icon: IpFacebook },
  { id: 'instagram',       shortLabel: 'IG', Icon: IpInstagram },
  { id: 'google_business', shortLabel: 'GB', Icon: IpGoogle },
];
const TONES = [
  { id: 'friendly',     label: 'Friendly', Icon: IcoFriendly },
  { id: 'professional', label: 'Pro',      Icon: IcoProfessional },
  { id: 'funny',        label: 'Funny',    Icon: IcoFunny },
  { id: 'educational',  label: 'Expert',   Icon: IcoExpert },
  { id: 'urgent',       label: 'Urgent',   Icon: IcoUrgent },
];
const PLACEHOLDERS = [
  'Just finished a new concrete driveway in Springfield...',
  'Replaced a burst water heater in North Austin today...',
  'Cleared a badly blocked drain for a family this morning...',
  'Installed a new AC unit before the summer heat hits...',
  'Finished a full roof replacement — customer is thrilled...',
];
const LOADING_MSGS = [
  'Reading the room for your industry...',
  'Writing like a local expert...',
  'Adding that authentic local touch...',
  'Crafting your post right now...',
];

function FieldLabel({ t, children }) {
  return <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8, letterSpacing: '-0.01em' }}>{children}</label>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function QuickPost() {
  const router = useRouter();
  const { t } = useTheme();

  const [mounted,       setMounted]       = useState(false);
  const [prompt,        setPrompt]        = useState('');
  const [selectedPlats, setSelectedPlats] = useState(['facebook', 'instagram', 'google_business']);
  const [tone,          setTone]          = useState('friendly');
  const [generating,    setGenerating]    = useState(false);
  const [loadMsgIdx,    setLoadMsgIdx]    = useState(0);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState('');
  const [activeVar,     setActiveVar]     = useState('a');
  const [editing,       setEditing]       = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [copied,        setCopied]        = useState(false);
  const [phIdx,         setPhIdx]         = useState(0);

  const loadMsgTimer = useRef(null);
  const phTimer      = useRef(null);
  const textareaRef  = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    phTimer.current = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => { clearInterval(phTimer.current); clearInterval(loadMsgTimer.current); };
  }, []);

  useEffect(() => { if (prompt) clearInterval(phTimer.current); }, [prompt]);

  useEffect(() => {
    if (generating) {
      let i = 0; setLoadMsgIdx(0);
      loadMsgTimer.current = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setLoadMsgIdx(i); }, 1900);
    } else {
      clearInterval(loadMsgTimer.current);
    }
  }, [generating]);

  if (!mounted) return null;

  const allSelected = selectedPlats.length === 3;

  const togglePlatform = (id) => {
    if (id === 'all') {
      setSelectedPlats(allSelected ? ['facebook'] : ['facebook', 'instagram', 'google_business']);
      return;
    }
    setSelectedPlats(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(p => p !== id) : prev
        : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) { setError('Tell PostCore what just happened — one sentence is enough.'); textareaRef.current?.focus(); return; }
    setError(''); setResult(null); setEditing(false); setActiveVar('a'); setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType: 'static', prompt: `${text} [Tone: ${tone}]`, options: { platforms: selectedPlats, tone, quickPost: true } }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Generation failed'); }
      const data = await res.json();
      setResult(data);
      setEditedCaption(data.variations?.a?.caption || data.caption || '');
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again');
    } finally {
      setGenerating(false);
    }
  };

  const getCaption  = () => editing ? editedCaption : result?.variations?.[activeVar]?.caption || result?.caption || '';
  const getHashtags = () => result?.variations?.[activeVar]?.hashtags || result?.hashtags || [];
  const getEngQ     = () => result?.variations?.[activeVar]?.engagementQuestion || null;

  const handlePostNow = () => {
    sessionStorage.setItem('quickPostData', JSON.stringify({ caption: getCaption(), hashtags: getHashtags(), platforms: selectedPlats, tone }));
    router.push('/upload?from=quick-post');
  };
  const handleAllVariations = () => {
    sessionStorage.setItem('quickPostResult', JSON.stringify({ result, platforms: selectedPlats, tone, prompt }));
    router.push('/wizard?from=quick-post');
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(getCaption()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };
  const handleReset = () => { setResult(null); setError(''); setEditing(false); setPrompt(''); setActiveVar('a'); setTimeout(() => textareaRef.current?.focus(), 100); };

  const P = '20px';

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: t.bg, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: `14px ${P}` }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: t.card, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IpArrowLeft size={16} color={t.textSecondary} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: t.text }}>
            <IpZap size={15} color={t.primary} /> Quick Post
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>From job site to social in 30 seconds</div>
        </div>
        <button onClick={() => router.push('/wizard')} style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Full Wizard
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: `24px ${P} 72px`, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* 1. Prompt */}
        <div>
          <FieldLabel t={t}>What just happened?</FieldLabel>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => { setPrompt(e.target.value); if (error) setError(''); }}
            placeholder={PLACEHOLDERS[phIdx]}
            maxLength={400}
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', background: t.input, border: `2px solid ${error ? t.error : t.borderStrong}`, borderRadius: 12, color: t.text, fontSize: 16, fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', transition: 'border-color 150ms', WebkitAppearance: 'none' }}
            onFocus={e => (e.target.style.borderColor = t.primary)}
            onBlur={e => (e.target.style.borderColor = error ? t.error : t.borderStrong)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: error ? t.error : t.textMuted }}>{error || 'One sentence is enough — PostCore handles the rest'}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{prompt.length}/400</span>
          </div>
        </div>

        {/* 2. Platforms */}
        <div>
          <FieldLabel t={t}>Where are we posting?</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {PLATFORMS.map(p => {
              const sel = selectedPlats.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlatform(p.id)} style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: sel ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: sel ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}>
                  <p.Icon size={20} color={sel ? t.primary : t.textMuted} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: sel ? t.primary : t.textMuted }}>{p.shortLabel}</span>
                </button>
              );
            })}
            <button onClick={() => togglePlatform('all')} style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: allSelected ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: allSelected ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}>
              <IpAllPlatforms size={20} color={allSelected ? t.primary : t.textMuted} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: allSelected ? t.primary : t.textMuted }}>All</span>
            </button>
          </div>
        </div>

        {/* 3. Tone */}
        <div>
          <FieldLabel t={t}>What is the tone?</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {TONES.map(tn => {
              const sel = tone === tn.id;
              return (
                <button key={tn.id} onClick={() => setTone(tn.id)} title={tn.label} style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: sel ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: sel ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}>
                  <tn.Icon size={22} color={sel ? t.primary : t.textMuted} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: sel ? t.primary : t.textMuted }}>{tn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Generate button */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: '100%', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: generating ? t.textDisabled : t.primary, color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 200ms', boxShadow: generating ? 'none' : '0 4px 24px rgba(124,92,252,0.32)' }}
          >
            {generating ? <><Spinner size={17} />{LOADING_MSGS[loadMsgIdx]}</> : <><IpSparkle size={17} color="#fff" />Generate Post</>}
          </button>
        )}

        {/* 5. Result card */}
        {result && !generating && (
          <>
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.primaryBg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IpCheck size={12} color="#fff" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Your post is ready</span>
                </div>
                <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <IpRefresh size={12} color={t.textMuted} /> Start over
                </button>
              </div>

              {/* Variation tabs */}
              {result.variations && (
                <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
                  {['a', 'b', 'c'].map(key => {
                    if (!result.variations[key]) return null;
                    const active = activeVar === key;
                    return (
                      <button key={key} onClick={() => { setActiveVar(key); setEditing(false); setEditedCaption(result.variations[key].caption); }} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textMuted, transition: 'all 120ms' }}>
                        Version {key.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Caption */}
              <div style={{ padding: '14px 16px' }}>
                {editing ? (
                  <textarea value={editedCaption} onChange={e => setEditedCaption(e.target.value)} autoFocus rows={6} style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: t.input, border: `2px solid ${t.primary}`, borderRadius: 10, color: t.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical' }} />
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.primary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement prompt</div>
                  <div style={{ fontSize: 12, color: t.textSecondary, fontStyle: 'italic' }}>{getEngQ()}</div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 12px 12px', borderTop: `1px solid ${t.border}` }}>
                <button onClick={handlePostNow} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'opacity 150ms' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <IpSend size={13} color="#fff" /> Post Now
                </button>
                <button onClick={() => { if (!editing) setEditedCaption(getCaption()); setEditing(v => !v); }} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'opacity 150ms' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <IpEdit size={13} color={t.textSecondary} /> {editing ? 'Done' : 'Edit'}
                </button>
                <button onClick={handleAllVariations} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'opacity 150ms' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <IpCarousel size={13} color={t.textSecondary} /> All Vars
                </button>
              </div>
            </div>

            {/* Copy + Regenerate row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', color: copied ? t.success : t.textMuted, border: `1px solid ${copied ? t.success : t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}>
                {copied ? <><IpCheck size={13} color={t.success} />Copied!</> : <><IpCopy size={13} color={t.textMuted} />Copy caption</>}
              </button>
              <button onClick={() => { setResult(null); handleGenerate(); }} style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}>
                <IpRefresh size={13} color={t.textMuted} /> Try again
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes qp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
