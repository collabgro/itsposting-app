import { useState, useEffect } from 'react';
import { useTheme } from '../lib/theme';
import { postsAPI } from '../lib/api';
import { format } from 'date-fns';
import {
  IpClose, IpFacebook, IpInstagram, IpLinkedIn, IpTikTok, IpGoogle,
} from './icons';

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function parseMediaUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function parseHashtags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

const CHAR_LIMITS = {
  facebook: 63206,
  instagram: 2200,
  tiktok: 150,
  linkedin: 3000,
  google_business: 1500,
};

const PLATFORM_META = {
  facebook:        { label: 'Facebook',        color: '#1877F2', Icon: IpFacebook },
  instagram:       { label: 'Instagram',       color: '#E1306C', Icon: IpInstagram },
  linkedin:        { label: 'LinkedIn',        color: '#0A66C2', Icon: IpLinkedIn },
  tiktok:          { label: 'TikTok',          color: '#010101', Icon: IpTikTok },
  google_business: { label: 'Google Business', color: '#4285F4', Icon: IpGoogle },
};

const PLATFORM_ORDER = ['facebook', 'instagram', 'linkedin', 'tiktok', 'google_business'];

// ── Platform mockup sub-components ──────────────────────────────────────────

function PostImage({ post, style = {} }) {
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;

  if (post.content_type === 'static' || !src) return null;

  if (post.content_type === 'video') {
    return (
      <video
        src={src}
        controls
        style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'cover', ...style }}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <img
        src={src}
        alt=""
        style={{ width: '100%', display: 'block', objectFit: 'cover', ...style }}
        onError={e => { e.target.style.display = 'none'; }}
      />
      {isCarousel && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
          {mediaUrls.slice(0, 5).map((_, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#1877F2' : 'rgba(0,0,0,0.25)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

function FbActionBtn({ label }) {
  return (
    <button style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#65676B', fontWeight: 600, borderRadius: 6, fontFamily: 'inherit' }}>
      {label}
    </button>
  );
}

function FacebookMockup({ post, caption }) {
  const hashtags = parseHashtags(post.hashtags);
  const fullText = caption + (hashtags.length ? '\n' + hashtags.map(h => `#${h}`).join(' ') : '');
  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#050505' }}>Your Business</div>
          <div style={{ fontSize: 12, color: '#65676B', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IpFacebook size={11} style={{ color: '#1877F2' }} /> JUST NOW · 🌐
          </div>
        </div>
        <span style={{ color: '#65676B', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>···</span>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 15, color: '#050505', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {fullText}
      </div>
      <PostImage post={post} style={{ maxHeight: 400 }} />
      <div style={{ height: 1, background: '#E4E6EB', margin: '0 16px' }} />
      <div style={{ display: 'flex', padding: '2px 8px' }}>
        <FbActionBtn label="👍 Like" />
        <FbActionBtn label="💬 Comment" />
        <FbActionBtn label="↗ Share" />
      </div>
    </div>
  );
}

function InstagramMockup({ post, caption }) {
  const hashtags = parseHashtags(post.hashtags);
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const isCarousel = post.content_type === 'carousel' && mediaUrls.length > 1;
  const hasMedia = post.content_type !== 'static' && src;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 470, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#000' }}>yourbusiness</div>
        <span style={{ color: '#000', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>···</span>
      </div>
      {hasMedia && (
        <div style={{ position: 'relative', width: '100%', paddingTop: isCarousel ? '100%' : '125%', overflow: 'hidden', background: '#f0f0f0' }}>
          <img
            src={src}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          {post.content_type === 'video' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>▶</div>
            </div>
          )}
          {isCarousel && mediaUrls.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
              {mediaUrls.slice(0, 5).map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '10px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ cursor: 'pointer' }}>♡</span>
          <span style={{ cursor: 'pointer' }}>💬</span>
          <span style={{ cursor: 'pointer' }}>✈️</span>
        </div>
        <span style={{ cursor: 'pointer' }}>🔖</span>
      </div>
      <div style={{ padding: '4px 14px 12px', fontSize: 14, color: '#000', lineHeight: 1.4 }}>
        <span style={{ fontWeight: 700 }}>yourbusiness</span>{' '}
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</span>
        {hashtags.length > 0 && (
          <div style={{ color: '#4B91F7', marginTop: 4, fontSize: 13 }}>{hashtags.map(h => `#${h}`).join(' ')}</div>
        )}
        <div style={{ fontSize: 12, color: '#8E8E8E', marginTop: 5 }}>JUST NOW</div>
      </div>
    </div>
  );
}

function LinkedInMockup({ post, caption }) {
  const hasMedia = post.content_type !== 'static';
  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 500, margin: '0 auto', fontFamily: '-apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#000' }}>Your Business</div>
          <div style={{ fontSize: 12, color: '#666' }}>Local Business · Just now 🌐</div>
        </div>
        <button style={{ padding: '5px 14px', background: 'none', border: '1px solid #0A66C2', color: '#0A66C2', borderRadius: 16, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Follow</button>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#000', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</div>
      {hasMedia && <PostImage post={post} style={{ maxHeight: 380 }} />}
      <div style={{ display: 'flex', padding: '2px 8px', borderTop: '1px solid #E9E5DF' }}>
        {['👍 Like', '💬 Comment', '↻ Repost', '✈ Send'].map(a => (
          <button key={a} style={{ flex: 1, padding: '10px 2px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600, fontFamily: 'inherit' }}>{a}</button>
        ))}
      </div>
    </div>
  );
}

function TikTokMockup({ post, caption }) {
  const mediaUrls = parseMediaUrls(post.media_urls);
  const src = mediaUrls[0] || post.media_url;
  const truncated = caption.length > 90 ? caption.slice(0, 90) + '…' : caption;

  return (
    <div style={{ margin: '0 auto', width: 260, position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#111', aspectRatio: '9/16', fontFamily: 'system-ui, sans-serif' }}>
      {src ? (
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={() => {}} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 45%, transparent 70%)' }} />
      {post.content_type === 'video' && src && (
        <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>▶</div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 52, color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>@yourbusiness</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>{truncated}</div>
        <div style={{ fontSize: 11, marginTop: 7, opacity: 0.75 }}>🎵 Original audio · yourbusiness</div>
      </div>
      <div style={{ position: 'absolute', right: 8, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: '#fff' }}>
        {[['❤️', '25K'], ['💬', '560'], ['↪', '80']].map(([icon, count]) => (
          <div key={icon} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleBusinessMockup({ post, caption }) {
  const hasMedia = post.content_type !== 'static';
  const short = caption.length > 130 ? caption.slice(0, 130) + '…' : caption;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.14)', overflow: 'hidden', maxWidth: 460, margin: '0 auto', fontFamily: '"Google Sans", Roboto, sans-serif' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: '#fff' }}>
          <span style={{ fontWeight: 800, fontSize: 20, background: 'linear-gradient(135deg,#4285F4 30%,#EA4335 30%,#EA4335 55%,#FBBC05 55%,#FBBC05 75%,#34A853 75%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>Your Business</div>
      </div>
      {hasMedia && <PostImage post={post} style={{ maxHeight: 280 }} />}
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ fontSize: 14, color: '#3c4043', lineHeight: 1.6 }}>{short}</div>
        <button style={{ marginTop: 12, padding: '8px 22px', background: 'none', border: '1px solid #4285F4', color: '#4285F4', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Learn more
        </button>
      </div>
    </div>
  );
}

const MOCKUP_MAP = {
  facebook:        FacebookMockup,
  instagram:       InstagramMockup,
  linkedin:        LinkedInMockup,
  tiktok:          TikTokMockup,
  google_business: GoogleBusinessMockup,
};

// ── Platform tab pill ────────────────────────────────────────────────────────

function PlatformTab({ pid, isActive, onClick }) {
  const meta = PLATFORM_META[pid];
  if (!meta) return null;
  const PI = meta.Icon;
  return (
    <button
      onClick={() => onClick(pid)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        border: `1px solid ${isActive ? meta.color : 'rgba(255,255,255,0.1)'}`,
        background: isActive ? `${meta.color}22` : 'transparent',
        color: isActive ? meta.color : 'rgba(255,255,255,0.55)',
        fontSize: 12, fontWeight: isActive ? 700 : 500,
        cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
      }}
    >
      <PI size={13} /> {meta.label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PostPreviewModal({ post, allPosts, onClose, onNavigate, onUpdate, onDelete, defaultMode = 'view' }) {
  const { t } = useTheme();

  const platforms     = parsePlatforms(post?.platforms);
  const tabPlatforms  = PLATFORM_ORDER.filter(p => platforms.includes(p));
  if (tabPlatforms.length === 0) tabPlatforms.push('facebook');

  const [mode,           setMode]           = useState(defaultMode);
  const [activePlatform, setActivePlatform] = useState(tabPlatforms[0]);
  const [editCaption,    setEditCaption]    = useState(post?.caption || '');
  const [editDate,       setEditDate]       = useState(() => post?.scheduled_date ? new Date(post.scheduled_date).toISOString().slice(0, 16) : '');
  const [saving,         setSaving]         = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [saveError,      setSaveError]      = useState('');

  // Reset when post changes (navigation)
  useEffect(() => {
    if (!post) return;
    const pts = parsePlatforms(post.platforms);
    const tabs = PLATFORM_ORDER.filter(p => pts.includes(p));
    setActivePlatform(tabs[0] || 'facebook');
    setEditCaption(post.caption || '');
    setEditDate(post.scheduled_date ? new Date(post.scheduled_date).toISOString().slice(0, 16) : '');
    setMode(defaultMode);
    setConfirmDelete(false);
    setSaveError('');
  }, [post?.id]);

  // ESC closes in view mode
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && mode === 'view') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  if (!post) return null;

  const idx      = allPosts.findIndex(p => p.id === post.id);
  const prevPost = idx > 0 ? allPosts[idx - 1] : null;
  const nextPost = idx < allPosts.length - 1 ? allPosts[idx + 1] : null;

  const minLimit = Math.min(...tabPlatforms.map(p => CHAR_LIMITS[p] || 63206));
  const charOver = editCaption.length > minLimit;

  const handleNavigate = (target) => {
    if (mode === 'edit') {
      const dirty = editCaption !== post.caption || editDate !== new Date(post.scheduled_date || 0).toISOString().slice(0, 16);
      if (dirty && !window.confirm('Discard unsaved changes and navigate?')) return;
    }
    onNavigate(target.id);
  };

  const handleSave = async () => {
    if (charOver || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await postsAPI.update(post.id, {
        caption: editCaption,
        ...(editDate ? { scheduledDate: editDate } : {}),
      });
      onUpdate(res.data);
      setMode('view');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await postsAPI.delete(post.id);
      onDelete(post.id);
    } catch {
      setSaveError('Delete failed.');
    }
  };

  const scheduledLabel = post.scheduled_date
    ? format(new Date(post.scheduled_date), 'EEE MMM d, h:mm a')
    : 'Draft';

  const ActiveMockup = MOCKUP_MAP[activePlatform] || FacebookMockup;

  const navBtnStyle = (enabled) => ({
    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: enabled ? 'pointer' : 'default',
    background: enabled ? t.input : 'transparent',
    border: `1px solid ${enabled ? t.border : 'transparent'}`,
    color: enabled ? t.text : t.textMuted,
  });

  const modalWidth = mode === 'edit' ? 980 : 560;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={mode === 'view' ? onClose : undefined}
    >
      <div
        style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, width: '100%', maxWidth: modalWidth, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 28px 90px rgba(0,0,0,0.55)', transition: 'max-width 300ms cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── VIEW MODE ─────────────────────────────────────────────────────── */}
        {mode === 'view' && (<>

          {/* Top nav bar */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button style={navBtnStyle(!!prevPost)} disabled={!prevPost} onClick={() => prevPost && handleNavigate(prevPost)}>← Prev</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{scheduledLabel}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{idx + 1} of {allPosts.length}</div>
            </div>
            <button style={navBtnStyle(!!nextPost)} disabled={!nextPost} onClick={() => nextPost && handleNavigate(nextPost)}>Next →</button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 2 }}>
              <IpClose size={13} />
            </button>
          </div>

          {/* Platform tabs */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 7, flexWrap: 'wrap', flexShrink: 0 }}>
            {tabPlatforms.map(pid => (
              <PlatformTab key={pid} pid={pid} isActive={activePlatform === pid} onClick={setActivePlatform} />
            ))}
          </div>

          {/* Mockup preview */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', background: t.background || '#0A0A0F' }}>
            <ActiveMockup post={post} caption={post.caption || ''} />
          </div>

          {/* Bottom actions */}
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <span style={{ fontSize: 13, color: '#EF4444', flex: 1 }}>Permanently delete this post?</span>
                <button onClick={handleDelete} style={{ padding: '7px 16px', background: '#EF4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '7px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setMode('edit')}
                  style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#9B4FD4,#C44BB8)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(155,79,212,0.3)' }}
                >
                  ✏ Edit Post
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  🗑 Delete
                </button>
              </>
            )}
          </div>
        </>)}

        {/* ── EDIT MODE ─────────────────────────────────────────────────────── */}
        {mode === 'edit' && (<>

          {/* Edit header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => setMode('view')}
              style={{ padding: '6px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Preview
            </button>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: t.text }}>Edit Post</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IpClose size={13} />
            </button>
          </div>

          {/* Two-panel body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Left — editor */}
            <div style={{ width: '42%', minWidth: 300, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '22px 20px', gap: 20 }}>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Caption</label>
                  <span style={{ fontSize: 11, color: charOver ? '#EF4444' : t.textMuted, fontWeight: charOver ? 700 : 400 }}>
                    {editCaption.length.toLocaleString()} / {minLimit.toLocaleString()}
                  </span>
                </div>
                <textarea
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  rows={9}
                  style={{ width: '100%', background: t.input, border: `1px solid ${charOver ? '#EF4444' : t.border}`, borderRadius: 10, padding: '12px', fontSize: 14, color: t.text, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                  placeholder="Write your caption..."
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Scheduled for</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{ width: '100%', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: t.text, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Platforms</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {tabPlatforms.map(pid => {
                    const meta = PLATFORM_META[pid];
                    if (!meta) return null;
                    const PI = meta.Icon;
                    return (
                      <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, background: `${meta.color}18`, border: `1px solid ${meta.color}40`, fontSize: 12, color: meta.color, fontWeight: 600 }}>
                        <PI size={12} /> {meta.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {saveError && (
                <div style={{ fontSize: 13, color: '#EF4444', padding: '9px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => { setMode('view'); setSaveError(''); }}
                  style={{ flex: 1, padding: '10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || charOver}
                  style={{ flex: 2, padding: '10px', background: saving || charOver ? t.border : 'linear-gradient(135deg,#9B4FD4,#C44BB8)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving || charOver ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: '#EF4444', flex: 1 }}>Delete this post?</span>
                  <button onClick={handleDelete} style={{ padding: '5px 12px', background: '#EF4444', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: '5px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 13, cursor: 'pointer' }}>No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
                >
                  Delete post
                </button>
              )}
            </div>

            {/* Right — live preview */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Post Preview</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {tabPlatforms.map(pid => (
                    <PlatformTab key={pid} pid={pid} isActive={activePlatform === pid} onClick={setActivePlatform} />
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', background: t.background || '#0A0A0F' }}>
                <ActiveMockup post={post} caption={editCaption} />
              </div>
            </div>
          </div>
        </>)}

      </div>
    </div>
  );
}
