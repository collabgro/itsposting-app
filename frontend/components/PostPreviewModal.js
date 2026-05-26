import { useState, useEffect } from 'react';
import { useTheme } from '../lib/theme';
import { postsAPI } from '../lib/api';
import { format } from 'date-fns';
import { IpClose } from './icons';
import {
  parseHashtags, parseMediaUrls,
  CHAR_LIMITS, PLATFORM_META, PLATFORM_ORDER, MOCKUP_MAP,
  PlatformTab,
} from './PostMockups';

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
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
              <PlatformTab key={pid} pid={pid} isActive={activePlatform === pid} onClick={setActivePlatform} darkBg />
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
                  style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.3)' }}
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
                  style={{ flex: 2, padding: '10px', background: saving || charOver ? t.border : 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving || charOver ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
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
                    <PlatformTab key={pid} pid={pid} isActive={activePlatform === pid} onClick={setActivePlatform} darkBg />
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
