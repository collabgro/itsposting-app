import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpHeart, IpComment, IpShare, IpDrafts, IpPlus, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpSearch, IpDelete, IpEdit, IpFacebook, IpInstagram, IpGoogle, IpCalendar, IpAnalytics,
  IpSparkle, IpSchedule, IpClose, IpCheck, IpLinkedIn, IpTikTok,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Badge, EmptyState, Skeleton, useToast, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, socialAPI } from '../lib/api';
import { format } from 'date-fns';
import PostPreviewModal from '../components/PostPreviewModal';

const TYPE_ICON  = { static: IpDrafts, photo: ImageIcon, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR = { static: '#60A5FA', photo: '#A78BFA', carousel: '#F472B6', video: '#FB923C' };
const TYPE_LABEL = { static: 'TEXT', photo: 'PHOTO', carousel: 'CAROUSEL', video: 'VIDEO' };
const STATUS_VAR = { posted: 'success', scheduled: 'warning', draft: 'default', failed: 'error' };
const STATUS_DOT = { posted: '#22C55E', scheduled: '#F59E0B', draft: '#94A3B8', failed: '#EF4444' };
const PLATFORM_ICONS = {
  facebook:        { icon: IpFacebook,  color: '#1877F2' },
  instagram:       { icon: IpInstagram, color: '#E1306C' },
  google_business: { icon: IpGoogle,    color: '#4285F4' },
  linkedin:        { icon: IpLinkedIn,  color: '#0A66C2' },
  tiktok:          { icon: IpTikTok,    color: '#000000' },
};

const PLATFORM_FILTERS = [
  { id: 'all',             label: 'All' },
  { id: 'facebook',        label: 'Facebook',        Icon: IpFacebook,  color: '#1877F2' },
  { id: 'instagram',       label: 'Instagram',       Icon: IpInstagram, color: '#E1306C' },
  { id: 'tiktok',          label: 'TikTok',          Icon: IpTikTok,    color: '#000000' },
  { id: 'linkedin',        label: 'LinkedIn',        Icon: IpLinkedIn,  color: '#0A66C2' },
  { id: 'google_business', label: 'Google Business', Icon: IpGoogle,    color: '#4285F4' },
];

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function History() {
  const router = useRouter();
  const { t } = useTheme();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [total, setTotal] = useState(0);
  const [publishingPost, setPublishingPost] = useState(null);
  const [previewPostId, setPreviewPostId] = useState(null);
  const [previewDefaultMode, setPreviewDefaultMode] = useState('view');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  const [contentType, setContentType] = useState('all');
  const [viewMode, setViewMode] = useState('list');   // 'list' | 'grid'
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadPosts();
  }, []);

  useEffect(() => {
    if (router.query.filter && mounted) setFilter(router.query.filter);
  }, [router.query.filter]);

  useEffect(() => { if (mounted) loadPosts(); }, [filter]);
  useEffect(() => {
    if (!mounted) return;
    const tid = setTimeout(() => loadPosts(), 300);
    return () => clearTimeout(tid);
  }, [search]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params = { limit: 100, ...(filter !== 'all' && { status: filter }), ...(search.trim() && { search: search.trim() }) };
      const res = await postsAPI.getAll(params);
      const rows = Array.isArray(res.data) ? res.data : [];
      setPosts(rows);
      setTotal(rows.length);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      title: 'Delete Post',
      message: 'This will permanently delete this post and cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setDeleting(id);
        try {
          await postsAPI.delete(id);
          setPosts(prev => prev.filter(p => p.id !== id));
          showToast('Post deleted', 'success');
        } catch (e) { showToast(e.response?.data?.error || 'Delete failed', 'error'); }
        finally { setDeleting(null); }
      },
    });
  };

  const handlePublishNow = async (post) => {
    const id = post.id;
    const platforms = parsePlatforms(post.platforms);
    setPublishingPost(id);
    try {
      await socialAPI.publish(id, platforms.length > 0 ? platforms : undefined);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'posted' } : p));
      showToast('Post published!', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Failed to publish', 'error'); }
    finally { setPublishingPost(null); }
  };

  const openPreview = (postId, mode = 'view') => {
    setPreviewDefaultMode(mode);
    setPreviewPostId(postId);
  };

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      title: `Delete ${selectedIds.length} post${selectedIds.length > 1 ? 's' : ''}`,
      message: 'This will permanently delete the selected posts. This cannot be undone.',
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map(id => postsAPI.delete(id)));
          setPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
          showToast(`${selectedIds.length} post${selectedIds.length > 1 ? 's' : ''} deleted`, 'success');
          setSelectedIds([]);
        } catch { showToast('Some posts failed to delete', 'error'); }
      },
    });
  };

  const handleBulkPublish = async () => {
    try {
      const toPublish = selectedIds.filter(id => {
        const post = posts.find(p => p.id === id);
        return post && (post.status === 'draft' || post.status === 'scheduled');
      });
      await Promise.allSettled(toPublish.map(id => {
        const post = posts.find(p => p.id === id);
        const platforms = parsePlatforms(post?.platforms);
        return socialAPI.publish(id, platforms.length > 0 ? platforms : undefined);
      }));
      setPosts(prev => prev.map(p => toPublish.includes(p.id) ? { ...p, status: 'posted' } : p));
      showToast(`Published ${toPublish.length} post${toPublish.length !== 1 ? 's' : ''}`, 'success');
      setSelectedIds([]);
    } catch { showToast('Some posts failed to publish', 'error'); }
  };

  const dateRangeCutoff = (() => {
    const now = new Date();
    if (dateRange === '7d')   { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (dateRange === '30d')  { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    if (dateRange === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
    return null;
  })();

  const displayPosts = posts.filter(p => {
    if (platformFilter !== 'all' && !parsePlatforms(p.platforms).includes(platformFilter)) return false;
    if (contentType !== 'all' && p.content_type !== contentType) return false;
    if (dateRangeCutoff) {
      const d = new Date(p.scheduled_date || p.created_at);
      if (d < dateRangeCutoff) return false;
    }
    return true;
  });

  const FILTERS = [
    { id: 'all', label: 'All', count: total },
    { id: 'posted', label: 'Published' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'draft', label: 'Drafts' },
    { id: 'failed', label: 'Failed' },
  ];

  const activePlatformMeta = PLATFORM_FILTERS.find(f => f.id === platformFilter);

  if (!mounted) return null;

  return (
    <>
      <Layout
        title="Content History"
        subtitle="All your posts"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => router.push('/wizard')}>
              <IpSparkle size={13} color="url(#brand-gradient)" /> Post Wizard
            </Button>
            <Button variant="primary" onClick={() => router.push('/upload')}>
              <IpPlus size={14} strokeWidth={2.5} /> Upload
            </Button>
          </div>
        }
      >
        {/* ── Search bar ── */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <IpSearch size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search your posts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`, borderRadius: 12, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms', boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.8'})` }}
          />
        </div>

        {/* ── Filter row: platform + date range + content type ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Platform */}
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {PLATFORM_FILTERS.map(pf => {
              const isActive = platformFilter === pf.id;
              const activeColor = pf.color || t.primary;
              return (
                <button key={pf.id} onClick={() => setPlatformFilter(pf.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', fontSize: 12, fontWeight: isActive ? 700 : 500, border: `1px solid ${isActive ? activeColor + '55' : t.border}`, background: isActive ? activeColor + '18' : t.card, color: isActive ? activeColor : t.textMuted, cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0 }}>
                  {pf.Icon && <pf.Icon size={12} />}
                  {pf.label}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />

          {/* Date range */}
          <div style={{ display: 'flex', gap: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 9, padding: 3, flexShrink: 0 }}>
            {[{ id: 'all', label: 'All time' }, { id: '7d', label: 'Last 7d' }, { id: '30d', label: 'Last 30d' }, { id: 'month', label: 'This month' }].map(opt => (
              <button key={opt.id} onClick={() => setDateRange(opt.id)}
                style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: dateRange === opt.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent', background: dateRange === opt.id ? t.primaryBg : 'transparent', color: dateRange === opt.id ? t.primary : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Content type */}
          <div style={{ display: 'flex', gap: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 9, padding: 3, flexShrink: 0 }}>
            {[{ id: 'all', label: 'All types' }, { id: 'photo', label: 'Photo', color: '#A78BFA' }, { id: 'video', label: 'Video', color: '#FB923C' }, { id: 'carousel', label: 'Carousel', color: '#F472B6' }, { id: 'static', label: 'Text', color: '#60A5FA' }].map(opt => (
              <button key={opt.id} onClick={() => setContentType(opt.id)}
                style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: contentType === opt.id ? `1px solid ${(opt.color || t.primary) + '55'}` : '1px solid transparent', background: contentType === opt.id ? (opt.color ? opt.color + '18' : t.primaryBg) : 'transparent', color: contentType === opt.id ? (opt.color || t.primary) : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {opt.label}
              </button>
            ))}
          </div>

        </div>

        {/* ── Status filter pills ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, flexWrap: 'wrap', width: 'fit-content', boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                color: filter === f.id ? t.text : t.textMuted,
                background: filter === f.id ? t.primaryBg : 'transparent',
                border: filter === f.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center',
              }}
            >
              {f.label}
              {f.count !== undefined && filter === 'all' && (
                <span style={{ fontSize: 11, padding: '0 5px', background: t.input, borderRadius: 9, color: t.textMuted }}>{f.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Result count + view controls ── */}
        {!loading && (
          <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              {displayPosts.length} post{displayPosts.length !== 1 ? 's' : ''}
              {platformFilter !== 'all' ? ` on ${activePlatformMeta?.label}` : ''}
              {contentType !== 'all' ? ` · ${contentType}` : ''}
              {dateRange !== 'all' ? ` · ${dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'this month'}` : ''}
              {search ? ` matching "${search}"` : ''}
            </span>
            {(platformFilter !== 'all' || contentType !== 'all' || dateRange !== 'all' || search) && (
              <button
                onClick={() => { setPlatformFilter('all'); setContentType('all'); setDateRange('all'); setSearch(''); }}
                style={{ fontSize: 11, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>
                Clear filters
              </button>
            )}
            {/* View toggle + select */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])}
                  style={{ fontSize: 11, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                  {selectedIds.length} selected — clear
                </button>
              )}
              {displayPosts.length > 0 && (
                <button onClick={() => { selectedIds.length === displayPosts.length ? setSelectedIds([]) : setSelectedIds(displayPosts.map(p => p.id)); }}
                  style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                  {selectedIds.length === displayPosts.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
              <div style={{ display: 'flex', padding: 3, gap: 2, background: t.isDark ? 'rgba(255,255,255,0.04)' : t.input, border: `1px solid ${t.border}`, borderRadius: 9 }}>
                {[{ id: 'list', label: '≡ List' }, { id: 'grid', label: '⊞ Grid' }].map(v => (
                  <button key={v.id} onClick={() => setViewMode(v.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: viewMode === v.id ? t.primaryBg : 'transparent',
                      color: viewMode === v.id ? t.primary : t.textMuted,
                      border: viewMode === v.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                      transition: 'all 150ms',
                    }}>{v.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Post list / grid ── */}
        {loading ? (
          viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} height={180} borderRadius={12} />)}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={118} borderRadius={14} />)}
          </div>
          )
        ) : displayPosts.length === 0 ? (
          <div style={{ padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
            <EmptyState
              icon={IpDrafts}
              title={
                search ? 'No posts match your search'
                : (platformFilter !== 'all' || contentType !== 'all' || dateRange !== 'all') ? 'No posts match these filters'
                : 'No posts yet'
              }
              subtitle={
                search ? 'Try a different search term or clear the search'
                : (platformFilter !== 'all' || contentType !== 'all' || dateRange !== 'all') ? 'Try adjusting the filters above, or clear them all'
                : 'Create your first post to get started'
              }
              action={
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="secondary" size="sm" onClick={() => router.push('/wizard')}><IpSparkle size={12} /> Post Wizard</Button>
                  <Button variant="secondary" size="sm" onClick={() => router.push('/upload')}>Manual upload</Button>
                </div>
              }
            />
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {displayPosts.map(post => {
              const TypeIcon = TYPE_ICON[post.content_type] || IpDrafts;
              const typeColor = TYPE_COLOR[post.content_type] || t.primary;
              const isHovered = hoveredCard === post.id;
              const isSelected = selectedIds.includes(post.id);
              return (
                <div key={post.id}
                  onClick={() => selectedIds.length > 0 ? toggleSelect(post.id) : openPreview(post.id, 'view')}
                  onMouseEnter={() => setHoveredCard(post.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                    border: isSelected ? `2px solid ${t.primary}` : `1px solid ${isHovered ? 'rgba(124,92,252,0.4)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                    transform: isHovered && !isSelected ? 'translateY(-2px)' : 'none',
                    boxShadow: isHovered ? `0 8px 24px rgba(0,0,0,0.25)` : isSelected ? `0 0 0 3px rgba(124,92,252,0.15)` : t.shadowSm,
                    background: isSelected ? 'rgba(124,92,252,0.08)' : t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {/* Image */}
                  <div style={{ aspectRatio: '1', background: t.input, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {post.media_url
                      ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} />
                      : <TypeIcon size={32} style={{ color: typeColor, opacity: 0.4 }} />
                    }
                    {/* Selection circle */}
                    <div onClick={(e) => toggleSelect(post.id, e)}
                      style={{ position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: '50%',
                        background: isSelected ? '#7C5CFC' : 'rgba(0,0,0,0.45)',
                        border: `2px solid ${isSelected ? '#7C5CFC' : 'rgba(255,255,255,0.7)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: selectedIds.length > 0 || isHovered ? 1 : 0,
                        transition: 'opacity 150ms, background 150ms',
                      }}
                    >
                      {isSelected && <IpCheck size={10} color="#fff" strokeWidth={3} />}
                    </div>
                    {/* Status dot + type chip */}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
                      <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 5px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{TYPE_LABEL[post.content_type] || 'POST'}</span>
                    </div>
                  </div>
                  {/* Caption */}
                  <div style={{ padding: '8px 10px 10px' }}>
                    <p style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {post.caption || <span style={{ color: t.textMuted, fontStyle: 'italic' }}>No caption</span>}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      {parsePlatforms(post.platforms).slice(0, 3).map(pid => {
                        const pm = PLATFORM_ICONS[pid];
                        if (!pm) return null;
                        const PI = pm.icon;
                        return <PI key={pid} size={11} style={{ color: pm.color }} />;
                      })}
                      {post.scheduled_date && (
                        <span style={{ fontSize: 9, color: t.textMuted, marginLeft: 'auto' }}>
                          {format(new Date(post.scheduled_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayPosts.map(post => {
              const TypeIcon = TYPE_ICON[post.content_type] || IpDrafts;
              const typeColor = TYPE_COLOR[post.content_type] || t.primary;
              const typeLabel = TYPE_LABEL[post.content_type] || 'POST';
              const postPlatforms = parsePlatforms(post.platforms);
              const isHovered = hoveredCard === post.id;
              const isDraft = post.status === 'draft';
              const isScheduled = post.status === 'scheduled';
              const dotColor = STATUS_DOT[post.status] || '#94A3B8';
              const isSelected = selectedIds.includes(post.id);

              return (
                <div
                  key={post.id}
                  onClick={() => selectedIds.length > 0 ? toggleSelect(post.id) : openPreview(post.id, 'view')}
                  onMouseEnter={() => setHoveredCard(post.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    display: 'flex',
                    gap: 0,
                    background: isSelected
                      ? t.isDark ? 'rgba(124,92,252,0.1)' : 'rgba(124,92,252,0.06)'
                      : t.isDark ? (isHovered ? 'rgba(20,20,32,0.88)' : 'rgba(15,15,24,0.72)') : t.card,
                    backdropFilter: 'blur(16px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                    border: `${isSelected ? 2 : 1}px solid ${isSelected ? t.primary : isHovered ? 'rgba(124,92,252,0.4)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                    transform: isHovered && !isSelected ? 'translateY(-3px)' : 'none',
                    boxShadow: isSelected
                      ? `0 0 0 3px rgba(124,92,252,0.15)`
                      : isHovered
                        ? `0 12px 36px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.06)`
                        : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{ width: 4, background: typeColor, flexShrink: 0 }} />

                  {/* Thumbnail */}
                  <div style={{
                    width: 96, height: 96, flexShrink: 0,
                    margin: '16px 0 16px 16px', borderRadius: 10,
                    overflow: 'hidden', background: t.input,
                    border: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {post.media_url
                      ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} />
                      : <TypeIcon size={30} style={{ color: typeColor, opacity: 0.45 }} />
                    }
                    <div style={{
                      position: 'absolute', bottom: 4, left: 4,
                      fontSize: 8, fontWeight: 800,
                      background: 'rgba(0,0,0,0.65)', color: '#fff',
                      borderRadius: 4, padding: '2px 5px',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {typeLabel}
                    </div>
                    {/* Selection circle */}
                    <div onClick={(e) => toggleSelect(post.id, e)}
                      style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%',
                        background: isSelected ? '#7C5CFC' : 'rgba(0,0,0,0.45)',
                        border: `2px solid ${isSelected ? '#7C5CFC' : 'rgba(255,255,255,0.7)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: selectedIds.length > 0 || isHovered ? 1 : 0,
                        transition: 'opacity 150ms, background 150ms',
                        zIndex: 1,
                      }}
                    >
                      {isSelected && <IpCheck size={9} color="#fff" strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

                    {/* Row 1: badges + platforms + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                      {/* Status with dot */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: dotColor }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>

                      {post.source === 'ai_generated' && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`, fontWeight: 600 }}>AI</span>
                      )}

                      {/* Platform icons */}
                      {postPlatforms.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {postPlatforms.map(pid => {
                            const pm = PLATFORM_ICONS[pid];
                            if (!pm) return null;
                            const PI = pm.icon;
                            return <PI key={pid} size={14} style={{ color: pm.color }} title={pid} />;
                          })}
                        </div>
                      )}

                      {/* Date — pushed to right */}
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 'auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IpCalendar size={10} />
                        {post.scheduled_date
                          ? format(new Date(post.scheduled_date), 'MMM d, yyyy · h:mm a')
                          : format(new Date(post.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {/* Row 2: Caption (2-line clamp) */}
                    <p style={{
                      fontSize: 13, color: t.textSecondary, lineHeight: 1.55,
                      margin: '0 0 8px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {post.caption || <span style={{ color: t.textMuted, fontStyle: 'italic' }}>No text preview</span>}
                    </p>

                    {/* Row 3: engagement + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: t.textMuted, flexWrap: 'wrap' }}>
                      {post.engagement && (
                        <>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpHeart size={12} /> {post.engagement.likes || 0}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpComment size={12} /> {post.engagement.comments || 0}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpShare size={12} /> {post.engagement.shares || 0}</span>
                        </>
                      )}
                      {post.credits_used === 0 && <span style={{ color: t.success, fontSize: 11 }}>Free</span>}
                      {post.credits_used > 0 && <span style={{ fontSize: 11 }}>{post.credits_used} credit{post.credits_used === 1 ? '' : 's'}</span>}

                      {/* Action buttons */}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>

                        {post.status === 'posted' && (
                          <button
                            onClick={() => router.push(`/analytics/posts/${post.id}`)}
                            style={{ padding: '5px 11px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <IpAnalytics size={11} /> Analytics
                          </button>
                        )}

                        {isDraft && (
                          <button
                            onClick={() => handlePublishNow(post)}
                            disabled={publishingPost === post.id}
                            style={{ padding: '5px 11px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#22C55E', cursor: publishingPost === post.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: publishingPost === post.id ? 0.6 : 1 }}
                          >
                            <IpCheck size={11} strokeWidth={3} /> {publishingPost === post.id ? '…' : 'Publish Now'}
                          </button>
                        )}

                        {(isDraft || isScheduled) && (
                          <button
                            onClick={() => openPreview(post.id, 'edit')}
                            style={{ padding: '5px 11px', background: 'rgba(124,92,252,0.10)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#7C5CFC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <IpEdit size={11} /> Edit
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={deleting === post.id}
                          style={{ padding: '5px 11px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, fontSize: 11, fontWeight: 600, color: t.error, cursor: deleting === post.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: deleting === post.id ? 0.5 : 1 }}
                        >
                          <IpDelete size={11} /> {deleting === post.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Floating bulk action bar ── */}
        {selectedIds.length > 0 && (
          <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 20, background: t.isDark ? 'rgba(12,12,20,0.96)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', animation: 'bulkBarIn 200ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{selectedIds.length} selected</span>
            <div style={{ width: 1, height: 18, background: t.border }} />
            <button onClick={handleBulkPublish}
              style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IpCheck size={12} strokeWidth={3} /> Publish All
            </button>
            <button onClick={handleBulkDelete}
              style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IpDelete size={12} /> Delete All
            </button>
            <button onClick={() => setSelectedIds([])}
              style={{ width: 28, height: 28, borderRadius: '50%', background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IpClose size={12} />
            </button>
          </div>
        )}
        <style>{`@keyframes bulkBarIn { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }`}</style>

      </Layout>

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}

      {previewPostId && displayPosts.find(p => p.id === previewPostId) && (
        <PostPreviewModal
          post={displayPosts.find(p => p.id === previewPostId)}
          allPosts={displayPosts}
          defaultMode={previewDefaultMode}
          onClose={() => { setPreviewPostId(null); setPreviewDefaultMode('view'); }}
          onNavigate={id => { setPreviewDefaultMode('view'); setPreviewPostId(id); }}
          onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onDelete={id => { setPosts(prev => prev.filter(p => p.id !== id)); setPreviewPostId(null); }}
        />
      )}
    </>
  );
}

