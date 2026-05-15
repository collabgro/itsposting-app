/**
 * ItsPosting — Quick Post
 * Mobile-first single-screen flow: job site to social in 30 seconds.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import Layout from '../components/Layout';
import {
  IpSparkle, IpCheck, IpRefresh,
  IpEdit, IpSend, IpCopy,
  IpFacebook, IpInstagram, IpGoogle, IpAllPlatforms,
  IpLinkedIn, IpTikTok,
  IpHeart, IpBusiness, IpWarning, IpLaugh,
  IpPhoto, IpTextCard,
} from '../components/icons';
import { useToast } from '../components/ui';
import { contentAPI } from '../lib/api';

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
const CONTENT_TYPES = [
  { id: 'static', label: 'Text Card',  sublabel: '1 credit',  Icon: IpTextCard },
  { id: 'photo',  label: 'Photo Post', sublabel: '3 credits', Icon: IpPhoto },
];

const PLATFORMS = [
  { id: 'facebook',        shortLabel: 'FB', Icon: IpFacebook },
  { id: 'instagram',       shortLabel: 'IG', Icon: IpInstagram },
  { id: 'linkedin',        shortLabel: 'LI', Icon: IpLinkedIn },
  { id: 'tiktok',          shortLabel: 'TK', Icon: IpTikTok },
  { id: 'google_business', shortLabel: 'GB', Icon: IpGoogle },
];

const ALL_PLATFORM_IDS = PLATFORMS.map(p => p.id);

const TONES = [
  { id: 'friendly',     label: 'Friendly', Icon: IpHeart },
  { id: 'professional', label: 'Pro',      Icon: IpBusiness },
  { id: 'funny',        label: 'Funny',    Icon: IpLaugh },
  { id: 'educational',  label: 'Expert',   Icon: IpSparkle },
  { id: 'urgent',       label: 'Urgent',   Icon: IpWarning },
];

const PLACEHOLDERS = [
  'Just finished a new concrete driveway in Springfield...',
  'Replaced a burst water heater in North Austin today...',
  'Cleared a badly blocked drain for a family this morning...',
  'Installed a new AC unit before the summer heat hits...',
  'Finished a full roof replacement — customer is thrilled...',
];

const LOADING_MSGS = {
  static: [
    'Reading the room for your industry...',
    'Writing like a local expert...',
    'Adding that authentic local touch...',
    'Crafting your post right now...',
  ],
  photo: [
    'Reading the room for your industry...',
    'Writing your caption...',
    'Generating your image...',
    'Almost there — polishing the details...',
  ],
};

// ─── FieldLabel with optional step number ─────────────────────────────────────
function FieldLabel({ t, children, step }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10, letterSpacing: '-0.01em' }}>
      {step && (
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {step}
        </span>
      )}
      {children}
    </label>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function QuickPost() {
  const router = useRouter();
  const { t } = useTheme();
  const { showToast } = useToast();

  const [mounted,       setMounted]       = useState(false);
  const [contentType,   setContentType]   = useState('static');
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
      loadMsgTimer.current = setInterval(() => {
        i = (i + 1) % LOADING_MSGS[contentType].length;
        setLoadMsgIdx(i);
      }, 1900);
    } else {
      clearInterval(loadMsgTimer.current);
    }
  }, [generating]);

  if (!mounted) return null;

  const allSelected = selectedPlats.length === ALL_PLATFORM_IDS.length;
  const creditCost  = contentType === 'photo' ? 3 : 1;

  const togglePlatform = (id) => {
    if (id === 'all') {
      setSelectedPlats(allSelected ? ['facebook'] : [...ALL_PLATFORM_IDS]);
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
      const { data } = await contentAPI.generate({
        contentType,
        prompt: `${text} [Tone: ${tone}]`,
        options: { platforms: selectedPlats, tone, quickPost: true },
      });
      setResult(data);
      setEditedCaption(data.variations?.a?.caption || data.caption || '');
      showToast('Post ready — choose a version below', 'success');
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
    sessionStorage.setItem('quickPostData', JSON.stringify({
      caption: getCaption(), hashtags: getHashtags(),
      platforms: selectedPlats, tone, mediaUrl: result?.mediaUrl || null,
    }));
    router.push('/upload?from=quick-post');
  };
  const handleOpenWizard = () => {
    sessionStorage.setItem('quickPostResult', JSON.stringify({ result, platforms: selectedPlats, tone, prompt }));
    router.push('/wizard?from=quick-post');
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(getCaption()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };
  const handleReset = () => {
    setResult(null); setError(''); setEditing(false); setPrompt(''); setActiveVar('a');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const platformChips = PLATFORMS.filter(p => selectedPlats.includes(p.id));

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
      <div style={{ maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>

        {/* ── Step 1: Content type ───────────────────────────────────── */}
        <div>
          <FieldLabel t={t} step="1">Content type</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CONTENT_TYPES.map(ct => {
              const sel = contentType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => { setContentType(ct.id); setResult(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, border: sel ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: sel ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms', textAlign: 'left' }}
                >
                  <ct.Icon size={22} color={sel ? 'url(#brand-gradient)' : t.textMuted} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sel ? t.primary : t.text }}>{ct.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{ct.sublabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Step 2: Prompt ─────────────────────────────────────────── */}
        <div>
          <FieldLabel t={t} step="2">What just happened?</FieldLabel>
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

        {/* ── Step 3: Platforms ──────────────────────────────────────── */}
        <div>
          <FieldLabel t={t} step="3">Where are we posting?</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PLATFORMS.map(p => {
              const sel = selectedPlats.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: sel ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: sel ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}
                >
                  <p.Icon size={20} color={sel ? 'url(#brand-gradient)' : t.textMuted} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: sel ? t.primary : t.textMuted }}>{p.shortLabel}</span>
                </button>
              );
            })}
            <button
              onClick={() => togglePlatform('all')}
              style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: allSelected ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: allSelected ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}
            >
              <IpAllPlatforms size={20} color={allSelected ? 'url(#brand-gradient)' : t.textMuted} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: allSelected ? t.primary : t.textMuted }}>All</span>
            </button>
          </div>
        </div>

        {/* ── Step 4: Tone ───────────────────────────────────────────── */}
        <div>
          <FieldLabel t={t} step="4">What is the tone?</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {TONES.map(tn => {
              const sel = tone === tn.id;
              return (
                <button
                  key={tn.id}
                  onClick={() => setTone(tn.id)}
                  title={tn.label}
                  style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, border: sel ? `2px solid ${t.primary}` : `1px solid ${t.border}`, background: sel ? t.primaryBg : t.card, cursor: 'pointer', transition: 'all 150ms' }}
                >
                  {tn.Icon
                    ? <tn.Icon size={22} color={sel ? 'url(#brand-gradient)' : t.textMuted} />
                    : <span style={{ fontSize: 20, lineHeight: 1 }}>{tn.emoji}</span>
                  }
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: sel ? t.primary : t.textMuted }}>{tn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Generate button ────────────────────────────────────────── */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: '100%', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: generating ? t.textDisabled : t.primary, color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 200ms', boxShadow: generating ? 'none' : '0 4px 24px rgba(124,92,252,0.32)' }}
          >
            {generating ? (
              <><Spinner size={17} />{LOADING_MSGS[contentType][loadMsgIdx]}</>
            ) : (
              <>
                <IpSparkle size={17} color="#fff" />
                Generate Post
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 20, marginLeft: 2 }}>
                  {creditCost} credit{creditCost > 1 ? 's' : ''}
                </span>
              </>
            )}
          </button>
        )}

        {/* ── Result card ────────────────────────────────────────────── */}
        {result && !generating && (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.primaryBg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IpCheck size={12} color="#fff" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, flexShrink: 0 }}>Post ready</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {platformChips.map(p => (
                    <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: t.input, border: `1px solid ${t.border}` }}>
                      <p.Icon size={10} color={t.textMuted} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>{p.shortLabel}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                <IpRefresh size={12} color={t.textMuted} /> Try again
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
                    {result.provider && (
                      <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                        {result.provider === 'nanobanana' ? 'NanoBanana · Gemini 2.5 Flash' : result.provider}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 72, borderRadius: 12, background: t.input, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: t.textMuted }}>Image unavailable — caption ready to use</span>
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
                  autoFocus
                  rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: t.input, border: `2px solid ${t.primary}`, borderRadius: 10, color: t.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical' }}
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
              <button
                onClick={handlePostNow}
                style={{ width: '100%', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'opacity 150ms', boxShadow: '0 2px 12px rgba(124,92,252,0.28)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <IpSend size={15} color="#fff" /> Post Now
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => { if (!editing) setEditedCaption(getCaption()); setEditing(v => !v); }}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <IpEdit size={13} color={t.textSecondary} /> {editing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={handleOpenWizard}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: t.card, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <IpSparkle size={13} color={t.textSecondary} /> Wizard
                </button>
                <button
                  onClick={handleCopy}
                  style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: copied ? 'rgba(34,197,94,0.08)' : t.card, color: copied ? t.success : t.textSecondary, border: `1px solid ${copied ? t.success : t.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                >
                  {copied
                    ? <><IpCheck size={13} color={t.success} />Copied</>
                    : <><IpCopy size={13} color={t.textSecondary} />Copy</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes qp-spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
