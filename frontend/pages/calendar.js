import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpChevronLeft, IpChevronRight, IpPlus, IpCalendar as CalendarIcon,
  IpClose, IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGoogle, IpLinkedIn, IpTikTok,
  IpSchedule, IpSparkle, IpDelete, IpCheck,
  IpHeart, IpComment, IpShare, IpSearch, IpEdit, IpAnalytics, IpCopy,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Badge, Skeleton, Select, EmptyState, ErrorCard, useToast, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, socialAPI, wizardAPI, calendarPlansAPI } from '../lib/api';
import PostPreviewModal from '../components/PostPreviewModal';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
} from 'date-fns';

const TYPE_ICON  = { static: IpDrafts, photo: ImageIcon, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR  = { static: '#60A5FA', photo: '#06B6D4', carousel: '#F472B6', video: '#FF9F0A' };
const TYPE_LABEL = { static: 'Text Card', photo: 'Photo', carousel: 'Carousel', video: 'Video' };
const STATUS_DOT  = { posted: '#22C55E', scheduled: '#F59E0B', draft: '#94A3B8', failed: '#EF4444', posting: '#60A5FA' };
const STATUS_VAR = { posted: 'success', scheduled: 'warning', draft: 'default', failed: 'error' };
const PLATFORM_ICONS = {
  facebook:        { icon: IpFacebook,  color: '#1877F2' },
  instagram:       { icon: IpInstagram, color: '#E1306C' },
  google_business: { icon: IpGoogle,    color: '#4285F4' },
  linkedin:        { icon: IpLinkedIn,  color: '#0A66C2' },
  tiktok:          { icon: IpTikTok,    color: '#010101' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Calendar() {
  const router = useRouter();
  const { t }  = useTheme();
  const [mounted, setMounted]           = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDay, setSelectedDay]   = useState(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [isMobile, setIsMobile]             = useState(false);
  const [view, setView]                     = useState('month');
  const [weekOffset, setWeekOffset]         = useState(0);
  const [hoveredPost, setHoveredPost]       = useState(null);
  const [hoverPos, setHoverPos]             = useState({ x: 0, y: 0 });
  const [draggingPost, setDraggingPost]     = useState(null);
  const [dragOverDay, setDragOverDay]       = useState(null);

  // Auto-plan my month state
  const [planMonthModal, setPlanMonthModal]     = useState(false);
  const [planMonthLoading, setPlanMonthLoading] = useState(false);
  const [planMonthSlots, setPlanMonthSlots]     = useState([]);
  const [planMonthName, setPlanMonthName]       = useState('');
  const [planMonthSaving, setPlanMonthSaving]   = useState(false);
  const [planMonthSaved, setPlanMonthSaved]     = useState(0);

  // Bulk scheduling state
  const [bulkMode, setBulkMode]           = useState(false);
  const [bulkDays, setBulkDays]           = useState([]);
  const [bulkTone, setBulkTone]           = useState('friendly');
  const [bulkPlatform, setBulkPlatform]   = useState('all');
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [bulkPreview, setBulkPreview]     = useState(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);

  const [calPlans, setCalPlans] = useState([]);

  // ── Page view toggle ───────────────────────────────────────────────────────
  const [pageView, setPageView]                 = useState('calendar'); // 'calendar' | 'list'

  // ── Calendar: content type filter + GHL expanded day popup ────────────────
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [expandedDay, setExpandedDay]             = useState(null); // { day, posts, x, y }

  // ── List view state ────────────────────────────────────────────────────────
  const [listPosts, setListPosts]               = useState([]);
  const [listLoading, setListLoading]           = useState(false);
  const [listFilter, setListFilter]             = useState('all');
  const [listSearch, setListSearch]             = useState('');
  const [listDateRange, setListDateRange]       = useState('all');
  const [listPlatformFilter, setListPlatformFilter] = useState('all');
  const [listContentType, setListContentType]   = useState('all');
  const [listViewMode, setListViewMode]         = useState('list');
  const [listSelectedIds, setListSelectedIds]   = useState([]);
  const [listLoadError, setListLoadError]       = useState(false);
  const [listTotal, setListTotal]               = useState(0);
  const [listDeleting, setListDeleting]         = useState(null);
  const [listPublishingPost, setListPublishingPost] = useState(null);
  const [cloning, setCloning]                   = useState(null);
  const [hoveredCard, setHoveredCard]           = useState(null);
  const [confirmModal, setConfirmModal]         = useState(null);
  const [previewPostId, setPreviewPostId]       = useState(null);
  const [previewDefaultMode, setPreviewDefaultMode] = useState('view');
  const [kebabMenu, setKebabMenu]               = useState(null); // { postId, x, y }

  const { showToast } = useToast();

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadPosts();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => { if (mounted) loadPosts(); }, [currentMonth]);

  // List view effects
  useEffect(() => { if (mounted && pageView === 'list') loadListPosts(); }, [pageView, listFilter]);
  useEffect(() => { if (router.query.view === 'list') setPageView('list'); }, [router.query.view]);
  useEffect(() => {
    if (!mounted || pageView !== 'list') return;
    const tid = setTimeout(() => loadListPosts(), 300);
    return () => clearTimeout(tid);
  }, [listSearch]);
  useEffect(() => {
    if (!kebabMenu) return;
    const handler = () => setKebabMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [kebabMenu]);
  useEffect(() => {
    if (!expandedDay) return;
    const handler = (e) => { if (!e.target.closest('[data-expanded-popup]')) setExpandedDay(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [expandedDay]);

  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const visibleFrom = startOfWeek(monthStart);
  const visibleTo   = endOfWeek(monthEnd);
  const days        = eachDayOfInterval({ start: visibleFrom, end: visibleTo });

  const loadPosts = async () => {
    setLoading(true);
    try {
      const pad = n => String(n).padStart(2,'0');
      const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const [postsRes] = await Promise.all([
        postsAPI.getAll({ from: visibleFrom.toISOString(), to: visibleTo.toISOString(), limit: 200 }),
        calendarPlansAPI.list(fmtDate(visibleFrom), fmtDate(visibleTo))
          .then(r => setCalPlans(r.data?.plans || []))
          .catch(() => {}),
      ]);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const loadListPosts = async () => {
    setListLoading(true); setListLoadError(false);
    try {
      const params = { limit: 100, ...(listFilter !== 'all' && { status: listFilter }), ...(listSearch.trim() && { search: listSearch.trim() }) };
      const res = await postsAPI.getAll(params);
      const rows = Array.isArray(res.data) ? res.data : [];
      setListPosts(rows); setListTotal(rows.length);
    } catch { setListLoadError(true); } finally { setListLoading(false); }
  };

  const handleClone = async (post) => {
    setCloning(post.id); setKebabMenu(null);
    try {
      let hashtags = [];
      try { hashtags = post.hashtags ? JSON.parse(post.hashtags) : []; } catch {}
      await postsAPI.create({
        caption: post.caption, content_type: post.content_type,
        media_url: post.media_url, platforms: parsePlatforms(post.platforms),
        hashtags, status: 'draft', source: post.source,
      });
      showToast('Post cloned as draft!', 'success');
      loadListPosts();
    } catch { showToast('Failed to clone post', 'error'); }
    finally { setCloning(null); }
  };

  const handleListDelete = (id) => {
    setConfirmModal({
      title: 'Delete Post',
      message: 'This will permanently delete this post and cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setListDeleting(id);
        try {
          await postsAPI.delete(id);
          setListPosts(prev => prev.filter(p => p.id !== id));
          showToast('Post deleted', 'success');
        } catch (e) { showToast(e.response?.data?.error || 'Delete failed', 'error'); }
        finally { setListDeleting(null); }
      },
    });
  };

  const handleListPublishNow = async (post) => {
    const platforms = parsePlatforms(post.platforms);
    setListPublishingPost(post.id);
    try {
      await socialAPI.publish(post.id, platforms.length > 0 ? platforms : undefined);
      setListPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted' } : p));
      showToast('Post published!', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Failed to publish', 'error'); }
    finally { setListPublishingPost(null); }
  };

  const openPreview = (postId, mode = 'view') => {
    setPreviewDefaultMode(mode); setPreviewPostId(postId);
  };

  const toggleListSelect = (id, e) => {
    if (e) e.stopPropagation();
    setListSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkListDelete = () => {
    setConfirmModal({
      title: `Delete ${listSelectedIds.length} post${listSelectedIds.length > 1 ? 's' : ''}`,
      message: 'This will permanently delete the selected posts. This cannot be undone.',
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        try {
          await Promise.all(listSelectedIds.map(id => postsAPI.delete(id)));
          setListPosts(prev => prev.filter(p => !listSelectedIds.includes(p.id)));
          showToast(`${listSelectedIds.length} post${listSelectedIds.length > 1 ? 's' : ''} deleted`, 'success');
          setListSelectedIds([]);
        } catch { showToast('Some posts failed to delete', 'error'); }
      },
    });
  };

  const handleBulkListPublish = async () => {
    try {
      const toPublish = listSelectedIds.filter(id => {
        const post = listPosts.find(p => p.id === id);
        return post && (post.status === 'draft' || post.status === 'scheduled');
      });
      await Promise.allSettled(toPublish.map(id => {
        const post = listPosts.find(p => p.id === id);
        const platforms = parsePlatforms(post?.platforms);
        return socialAPI.publish(id, platforms.length > 0 ? platforms : undefined);
      }));
      setListPosts(prev => prev.map(p => toPublish.includes(p.id) ? { ...p, status: 'posted' } : p));
      showToast(`Published ${toPublish.length} post${toPublish.length !== 1 ? 's' : ''}`, 'success');
      setListSelectedIds([]);
    } catch { showToast('Some posts failed to publish', 'error'); }
  };

  // List display posts (filtered client-side)
  const listDateRangeCutoff = (() => {
    const n = new Date();
    if (listDateRange === '7d')   { const d = new Date(n); d.setDate(d.getDate() - 7); return d; }
    if (listDateRange === '30d')  { const d = new Date(n); d.setDate(d.getDate() - 30); return d; }
    if (listDateRange === 'month') { return new Date(n.getFullYear(), n.getMonth(), 1); }
    return null;
  })();
  const listDisplayPosts = listPosts.filter(p => {
    if (listPlatformFilter !== 'all' && !parsePlatforms(p.platforms).includes(listPlatformFilter)) return false;
    if (listContentType !== 'all' && p.content_type !== listContentType) return false;
    if (listDateRangeCutoff) { const d = new Date(p.scheduled_date || p.created_at); if (d < listDateRangeCutoff) return false; }
    return true;
  });

  const filteredPosts = posts.filter(p => {
    if (platformFilter !== 'all' && !parsePlatforms(p.platforms).includes(platformFilter)) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (contentTypeFilter !== 'all' && p.content_type !== contentTypeFilter) return false;
    return true;
  });
  const getPostsForDay = (day) => filteredPosts.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), day));
  const getPlansForDay = (day) => {
    const pad = n => String(n).padStart(2,'0');
    const str = `${day.getFullYear()}-${pad(day.getMonth()+1)}-${pad(day.getDate())}`;
    return calPlans.filter(p => p.plan_date === str && p.status !== 'published' && p.status !== 'skipped');
  };

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : [];

  const handleDayClick = (day) => {
    if (bulkMode) {
      const iso = day.toISOString().slice(0, 10);
      setBulkDays(prev => {
        const already = prev.includes(iso);
        if (already) return prev.filter(d => d !== iso);
        if (prev.length >= 7) return prev; // max 7
        return [...prev, iso];
      });
      return;
    }
    if (selectedDay && isSameDay(day, selectedDay)) { setSelectedDay(null); return; }
    setSelectedDay(day);
  };

  const handleBulkGenerate = async () => {
    if (bulkDays.length === 0) return;
    setBulkLoading(true);
    try {
      const dates = bulkDays.map(d => `${d}T09:00:00`);
      const res = await wizardAPI.bulkGenerate({ dates, tone: bulkTone, platform: bulkPlatform });
      setBulkPreview(res.data);
    } catch (e) {
      showCalToast(e.response?.data?.error || 'Generation failed', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (!bulkPreview?.preview) return;
    setBulkConfirming(true);
    try {
      const postsPayload = bulkPreview.preview.map(p => ({
        date: p.date,
        caption: p.caption,
      }));
      const res = await wizardAPI.bulkConfirm({ posts: postsPayload, platform: bulkPlatform, tone: bulkTone });
      showCalToast(`${res.data.savedCount} posts scheduled!`);
      setBulkMode(false);
      setBulkDays([]);
      setBulkPreview(null);
      window.dispatchEvent(new Event('creditRefresh'));
      loadPosts();
    } catch (e) {
      showCalToast(e.response?.data?.error || 'Failed to save posts', 'error');
    } finally {
      setBulkConfirming(false);
    }
  };

  const handleAddOnDay = () => {
    const dateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
    router.push(dateStr ? `/upload?scheduleDate=${dateStr}` : '/upload');
  };

  const handlePlanMonth = async () => {
    setPlanMonthLoading(true);
    setPlanMonthSlots([]);
    setPlanMonthSaved(0);
    try {
      const month = currentMonth.getMonth() + 1;
      const year  = currentMonth.getFullYear();
      const res = await wizardAPI.planMonth({ month, year });
      setPlanMonthSlots(res.data.slots || []);
      setPlanMonthName(res.data.monthName || '');
      setPlanMonthModal(true);
    } catch (err) {
      showCalToast(err?.response?.data?.error || 'Failed to generate plan', 'error');
    } finally {
      setPlanMonthLoading(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!planMonthSlots.length) return;
    setPlanMonthSaving(true);
    let completed = 0;
    const results = await Promise.allSettled(
      planMonthSlots.map(async slot => {
        const platforms = slot.platform === 'all' ? ['facebook','instagram','google_business'] : [slot.platform];
        const res = await postsAPI.create({
          caption: slot.captionPreview,
          content_type: slot.contentType,
          status: 'draft',
          scheduled_date: `${slot.date}T09:00:00`,
          platforms,
          source: 'ai_generated',
          notes: slot.topic,
        });
        completed++;
        setPlanMonthSaved(completed);
        return res;
      })
    );
    const saved = results.filter(r => r.status === 'fulfilled').length;
    await loadPosts();
    setPlanMonthModal(false);
    setPlanMonthSlots([]);
    showCalToast(`${saved} draft posts added to your calendar!`, 'success');
    setPlanMonthSaving(false);
  };

  const [deletingPost, setDeletingPost]     = useState(null);
  const [publishingPost, setPublishingPost] = useState(null);
  const [calToast, setCalToast]             = useState(null);
  const [reschedulingPost, setReschedulingPost]   = useState(null);
  const [rescheduleDate, setRescheduleDate]       = useState('');
  const [rescheduleTime, setRescheduleTime]       = useState('');
  const [rescheduleConflict, setRescheduleConflict] = useState(null);
  const [editingCaption, setEditingCaption]     = useState(null);
  const [editCaptionText, setEditCaptionText]   = useState('');
  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      await postsAPI.delete(postId);
      setPosts(prev => {
        const updated = prev.filter(p => p.id !== postId);
        // Close side panel if no posts remain on that day
        if (selectedDay) {
          const remaining = updated.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), selectedDay));
          if (remaining.length === 0) setSelectedDay(null);
        }
        return updated;
      });
    } catch (e) { console.error(e); }
    finally { setDeletingPost(null); }
  };

  const showCalToast = (msg, type = 'success') => {
    setCalToast({ msg, type });
    setTimeout(() => setCalToast(null), 3500);
  };

  const handlePublishNow = async (post) => {
    const platforms = parsePlatforms(post.platforms);
    setPublishingPost(post.id);
    try {
      await socialAPI.publish(post.id, platforms.length > 0 ? platforms : undefined);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted' } : p));
      showCalToast('Post published!');
    } catch (e) {
      showCalToast(e.response?.data?.error || 'Failed to publish', 'error');
    } finally {
      setPublishingPost(null);
    }
  };

  const handleReschedule = async (post, force = false) => {
    if (!rescheduleDate || !rescheduleTime) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check for conflicts before saving (skip if user already confirmed)
    if (!force) {
      try {
        const platforms = post.platforms
          ? (Array.isArray(post.platforms) ? post.platforms : JSON.parse(post.platforms))
          : [post.platform];
        const conflictRes = await postsAPI.checkConflicts(`${rescheduleDate}T${rescheduleTime}`, platforms, post.id);
        const conflicts = conflictRes.data?.conflicts || [];
        if (conflicts.length > 0) {
          const conflictPost = conflicts[0];
          const conflictTime = new Date(conflictPost.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setRescheduleConflict({ post, conflictTime, conflictPlatform: conflictPost.platform });
          return;
        }
      } catch {}
      setRescheduleConflict(null);
    }
    try {
      await postsAPI.update(post.id, { scheduledDate: `${rescheduleDate}T${rescheduleTime}`, timezone: tz });
      const newDate = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_date: newDate } : p));
      setReschedulingPost(null);
      setRescheduleConflict(null);
      showCalToast('Rescheduled!');
    } catch (e) {
      showCalToast(e.response?.data?.error || 'Failed to reschedule', 'error');
    }
  };

  const handleSaveCaption = async (post) => {
    try {
      await postsAPI.update(post.id, { caption: editCaptionText });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, caption: editCaptionText } : p));
      setEditingCaption(null);
      showCalToast('Caption saved!');
    } catch (e) {
      showCalToast('Failed to save caption', 'error');
    }
  };

  const handleMonthChange = (e) => {
    const d = new Date(currentMonth);
    d.setMonth(parseInt(e.target.value));
    setCurrentMonth(d);
    setSelectedDay(null);
  };

  const handleYearChange = (e) => {
    const d = new Date(currentMonth);
    d.setFullYear(parseInt(e.target.value));
    setCurrentMonth(d);
    setSelectedDay(null);
  };

  // Week view: 7 days centred on today + offset
  const weekViewStart = startOfWeek(addWeeks(new Date(), weekOffset));
  const weekViewEnd   = endOfWeek(weekViewStart);
  const weekViewDays  = eachDayOfInterval({ start: weekViewStart, end: weekViewEnd });

  const handleDropOnDay = async (day) => {
    if (!draggingPost) return;
    const post = posts.find(p => p.id === draggingPost);
    if (!post) return;
    let newDate;
    if (post.scheduled_date) {
      const orig = new Date(post.scheduled_date);
      newDate = new Date(day);
      newDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    } else {
      newDate = new Date(day);
      newDate.setHours(9, 0, 0, 0);
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await postsAPI.update(draggingPost, { scheduledDate: newDate.toISOString(), timezone: tz });
      setPosts(prev => prev.map(p => p.id === draggingPost ? { ...p, scheduled_date: newDate.toISOString() } : p));
      // Non-blocking conflict check after drag — just warn, don't undo
      try {
        const dragPost = posts.find(p => p.id === draggingPost);
        const platforms = dragPost?.platforms
          ? (Array.isArray(dragPost.platforms) ? dragPost.platforms : JSON.parse(dragPost.platforms))
          : [dragPost?.platform];
        const conflictRes = await postsAPI.checkConflicts(newDate.toISOString(), platforms, draggingPost);
        const conflicts = conflictRes.data?.conflicts || [];
        if (conflicts.length > 0) {
          const conflictTime = new Date(conflicts[0].scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          showCalToast(`Rescheduled — note: another post is already at ${conflictTime}`, 'warning');
        } else {
          showCalToast('Post rescheduled!');
        }
      } catch { showCalToast('Post rescheduled!'); }
    } catch { showCalToast('Failed to reschedule', 'error'); }
    setDraggingPost(null);
    setDragOverDay(null);
  };

  const handlePostHover = (post, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.min(rect.right + 10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280);
    const py = Math.min(rect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220);
    setHoverPos({ x: px, y: py });
    setHoveredPost(post);
  };

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, background: t.input,
    border: `1px solid ${t.border}`, color: t.text, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', appearance: 'none',
    WebkitAppearance: 'none', paddingRight: 24,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'calc(100% - 6px) 50%',
  };

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  if (!mounted) return null;

  return (
    <>
      {calToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '10px 20px', borderRadius: 10, background: calToast.type === 'error' ? '#EF4444' : calToast.type === 'warning' ? '#F59E0B' : '#22C55E', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', maxWidth: 380, textAlign: 'center' }}>
          {calToast.msg}
        </div>
      )}
      <Layout
        title="Calendar"
        subtitle="Schedule and manage your posts"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Calendar / List view toggle */}
            <div style={{ display: 'flex', padding: 3, gap: 2, background: t.isDark ? 'rgba(255,255,255,0.04)' : t.input, border: `1px solid ${t.border}`, borderRadius: 10 }}>
              <button onClick={() => setPageView('calendar')} title="Calendar view"
                style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: pageView === 'calendar' ? `1px solid ${t.primaryBorder}` : '1px solid transparent', background: pageView === 'calendar' ? t.primaryBg : 'transparent', color: pageView === 'calendar' ? t.primary : t.textMuted }}>
                <CalendarIcon size={13} />
              </button>
              <button onClick={() => setPageView('list')} title="List view"
                style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: pageView === 'list' ? `1px solid ${t.primaryBorder}` : '1px solid transparent', background: pageView === 'list' ? t.primaryBg : 'transparent', color: pageView === 'list' ? t.primary : t.textMuted, fontSize: 16, fontWeight: 700 }}>
                ≡
              </button>
            </div>
            {pageView === 'calendar' && <>
              <Button variant="secondary" onClick={handlePlanMonth} disabled={planMonthLoading} style={{ background: 'rgba(124,92,252,0.08)', borderColor: 'rgba(124,92,252,0.3)' }}>
                <IpSparkle size={13} color="url(#brand-gradient)" /> {planMonthLoading ? 'Planning...' : 'Auto-plan month'}
              </Button>
              <Button variant="secondary" onClick={() => { setBulkMode(m => !m); setBulkDays([]); setBulkPreview(null); }} style={{ background: bulkMode ? 'rgba(124,92,252,0.15)' : undefined, borderColor: bulkMode ? 'rgba(124,92,252,0.5)' : undefined }}>
                <CalendarIcon size={13} /> Plan my week
              </Button>
            </>}
            <Button variant="secondary" onClick={() => router.push('/wizard')}><IpSparkle size={13} /> Post Wizard</Button>
            <Button variant="primary"   onClick={() => router.push('/upload')}><IpPlus size={14} strokeWidth={2.5} /> Upload</Button>
          </div>
        }
      >
        {/* ── Calendar view ── */}
        {pageView === 'calendar' && <>

        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 4 : 0 }}>
          {/* Platform */}
          <div style={{ display: 'flex', gap: 3, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 10, padding: 3, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
            <button onClick={() => setPlatformFilter('all')}
              style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                background: platformFilter === 'all' ? t.primaryBg : 'transparent',
                color: platformFilter === 'all' ? t.primary : t.textMuted,
                border: platformFilter === 'all' ? `1px solid ${t.primaryBorder}` : '1px solid transparent' }}>
              All
            </button>
            {[
              { id: 'facebook',        Icon: IpFacebook,  color: '#1877F2', label: 'Facebook'        },
              { id: 'instagram',       Icon: IpInstagram, color: '#E1306C', label: 'Instagram'       },
              { id: 'tiktok',          Icon: IpTikTok,    color: '#010101', label: 'TikTok'          },
              { id: 'linkedin',        Icon: IpLinkedIn,  color: '#0A66C2', label: 'LinkedIn'        },
              { id: 'google_business', Icon: IpGoogle,    color: '#4285F4', label: 'Google Business' },
            ].map(({ id, Icon, color, label }) => (
              <button key={id} onClick={() => setPlatformFilter(id)} title={label}
                style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  background: platformFilter === id ? `${color}18` : 'transparent',
                  border: platformFilter === id ? `1px solid ${color}55` : '1px solid transparent',
                  color: platformFilter === id ? color : t.textMuted }}>
                <Icon size={13} />
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />

          {/* Status */}
          <div style={{ display: 'flex', gap: 3, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 10, padding: 3, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
            {[
              { id: 'all',       label: 'All'       },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'draft',     label: 'Drafts'    },
              { id: 'posted',    label: 'Posted'    },
            ].map(opt => (
              <button key={opt.id} onClick={() => setStatusFilter(opt.id)}
                style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: statusFilter === opt.id ? t.primaryBg : 'transparent',
                  color: statusFilter === opt.id ? t.primary : t.textMuted,
                  border: statusFilter === opt.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent' }}>
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />

          {/* Post Type filter */}
          <div style={{ display: 'flex', gap: 3, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 10, padding: 3, boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
            {[
              { id: 'all', label: 'All types', color: null },
              { id: 'static', label: 'Text', color: '#60A5FA' },
              { id: 'photo', label: 'Photo', color: '#06B6D4' },
              { id: 'carousel', label: 'Carousel', color: '#F472B6' },
              { id: 'video', label: 'Video', color: '#FF9F0A' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setContentTypeFilter(opt.id)}
                style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: contentTypeFilter === opt.id ? (opt.color ? `${opt.color}18` : t.primaryBg) : 'transparent',
                  color: contentTypeFilter === opt.id ? (opt.color || t.primary) : t.textMuted,
                  border: contentTypeFilter === opt.id ? `1px solid ${opt.color ? `${opt.color}55` : t.primaryBorder}` : '1px solid transparent' }}>
                {opt.label}
              </button>
            ))}
          </div>

          {(platformFilter !== 'all' || statusFilter !== 'all' || contentTypeFilter !== 'all') && (
            <button onClick={() => { setPlatformFilter('all'); setStatusFilter('all'); setContentTypeFilter('all'); }}
              style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              Clear
            </button>
          )}
        </div>

        {/* ── Bulk scheduling banner ── */}
        {bulkMode && (
          <div style={{ background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Planning mode — select up to 7 days
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  {bulkDays.length === 0
                    ? 'Click any day on the calendar to add it to your plan.'
                    : `${bulkDays.length} day${bulkDays.length > 1 ? 's' : ''} selected: ${bulkDays.map(d => new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')}`
                  }
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Select
                  value={bulkTone}
                  onChange={e => setBulkTone(e.target.value)}
                  options={[
                    { value: 'friendly', label: 'Friendly' },
                    { value: 'professional', label: 'Professional' },
                    { value: 'funny', label: 'Funny' },
                    { value: 'educational', label: 'Educational' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                  style={{ width: 150 }}
                />
                <Select
                  value={bulkPlatform}
                  onChange={e => setBulkPlatform(e.target.value)}
                  options={[
                    { value: 'all', label: 'All platforms' },
                    { value: 'facebook', label: 'Facebook' },
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'google_business', label: 'Google Business' },
                  ]}
                  style={{ width: 170 }}
                />
                <button
                  onClick={handleBulkGenerate}
                  disabled={bulkDays.length === 0 || bulkLoading}
                  style={{ padding: '7px 16px', background: bulkDays.length > 0 && !bulkLoading ? '#7C5CFC' : 'rgba(124,92,252,0.3)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: bulkDays.length > 0 && !bulkLoading ? 'pointer' : 'not-allowed' }}>
                  {bulkLoading ? 'Generating…' : `Generate ${bulkDays.length || ''} posts`}
                </button>
                <button onClick={() => { setBulkMode(false); setBulkDays([]); setBulkPreview(null); }}
                  style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bulk preview modal ── */}
        {bulkPreview && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: t.isDark ? 'rgba(12,12,20,0.97)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>Review your week</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
                PostCore generated {bulkPreview.preview.length} posts — 1 credit each = {bulkPreview.preview.length} credits total
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {bulkPreview.preview.map((item, i) => (
                  <div key={i} style={{ background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px' }}>
                        {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{item.theme}</div>
                    </div>
                    <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, maxHeight: 80, overflow: 'hidden', position: 'relative' }}>
                      {item.caption.substring(0, 200)}{item.caption.length > 200 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleBulkConfirm}
                  disabled={bulkConfirming}
                  style={{ flex: 1, padding: '12px 20px', background: '#7C5CFC', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: bulkConfirming ? 'not-allowed' : 'pointer', opacity: bulkConfirming ? 0.6 : 1 }}>
                  {bulkConfirming ? 'Scheduling…' : `Confirm & schedule ${bulkPreview.preview.length} posts`}
                </button>
                <button onClick={() => setBulkPreview(null)} style={{ padding: '12px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Go back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom-sheet backdrop */}
        {selectedDay && isMobile && (
          <div
            onClick={() => setSelectedDay(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 89 }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: (selectedDay && !isMobile) ? '1fr 320px' : '1fr', gap: 20, transition: 'all 300ms' }}>

          {/* ── CALENDAR ─────────────────────────────────────── */}
          <div style={{ ...gc, padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px' : '18px 24px', borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarIcon size={18} color="url(#brand-gradient)" />
                <Select
                  value={String(currentMonth.getMonth())}
                  onChange={e => handleMonthChange({ target: { value: e.target.value } })}
                  options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
                  style={{ width: 140 }}
                />
                <Select
                  value={String(currentMonth.getFullYear())}
                  onChange={e => handleYearChange({ target: { value: e.target.value } })}
                  options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
                  style={{ width: 100 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={() => view === 'week' ? setWeekOffset(w => w - 1) : (setCurrentMonth(subMonths(currentMonth, 1)), setSelectedDay(null))}
                  style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  <IpChevronLeft size={16} />
                </button>
                <button
                  onClick={() => view === 'week' ? setWeekOffset(0) : (setCurrentMonth(new Date()), setSelectedDay(null))}
                  style={{ padding: '6px 14px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  Today
                </button>
                <button
                  onClick={() => view === 'week' ? setWeekOffset(w => w + 1) : (setCurrentMonth(addMonths(currentMonth, 1)), setSelectedDay(null))}
                  style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  <IpChevronRight size={16} />
                </button>
                {/* View toggle */}
                <div style={{ display: 'flex', padding: 3, gap: 2, background: t.isDark ? 'rgba(255,255,255,0.04)' : t.input, border: `1px solid ${t.border}`, borderRadius: 10 }}>
                  {['month', 'week'].map(v => (
                    <button key={v} onClick={() => setView(v)}
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 150ms',
                        background: view === v ? t.primaryBg : 'transparent',
                        color: view === v ? t.primary : t.textMuted,
                        border: view === v ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                      }}>{v}</button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4, marginBottom: isMobile ? 2 : 4 }}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: isMobile ? 9 : 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em', padding: isMobile ? '4px 0' : '6px 0' }}>{isMobile ? d.charAt(0) : d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4 }}>
                  {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} height={isMobile ? 56 : 88} borderRadius={8} />)}
                </div>
              </div>
            ) : view === 'week' ? (
              /* ── WEEK VIEW ── */
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                    {format(weekViewStart, 'MMM d')} – {format(weekViewEnd, 'MMM d, yyyy')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 7}, 1fr)`, gap: 8 }}>
                  {(isMobile ? weekViewDays.slice(1, 6) : weekViewDays).map(day => {
                    const dayPosts = getPostsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isDragOver = dragOverDay && isSameDay(dragOverDay, day) && draggingPost;
                    return (
                      <div key={day.toString()}
                        onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay(null); }}
                        onDrop={(e) => { e.preventDefault(); handleDropOnDay(day); }}
                        style={{
                          borderRadius: 12, overflow: 'hidden', minHeight: 160,
                          border: isDragOver ? `2px dashed ${t.primary}` : isToday ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
                          background: isDragOver ? 'rgba(124,92,252,0.08)' : isToday ? 'rgba(124,92,252,0.04)' : t.card,
                          transition: 'border-color 120ms, background 120ms',
                        }}
                      >
                        {/* Column header */}
                        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, background: isToday ? 'rgba(124,92,252,0.1)' : t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? t.primary : t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{format(day, 'EEE')}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: isToday ? t.primary : t.text, lineHeight: 1.2 }}>{format(day, 'd')}</div>
                        </div>
                        {/* Posts */}
                        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {dayPosts.map(post => {
                            const tc = TYPE_COLOR[post.content_type] || t.primary;
                            const TI = TYPE_ICON[post.content_type] || IpDrafts;
                            return (
                              <div key={post.id}
                                draggable="true"
                                onDragStart={(e) => { e.stopPropagation(); setDraggingPost(post.id); }}
                                onDragEnd={() => { setDraggingPost(null); setDragOverDay(null); }}
                                onMouseEnter={(e) => { e.stopPropagation(); handlePostHover(post, e); }}
                                onMouseLeave={(e) => { e.stopPropagation(); setHoveredPost(null); }}
                                onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                                style={{ padding: '5px 7px', borderRadius: 8, background: `${tc}14`, borderLeft: `3px solid ${tc}`, cursor: 'grab', opacity: draggingPost === post.id ? 0.35 : 1, transition: 'opacity 150ms' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                  <TI size={10} style={{ color: tc, flexShrink: 0 }} />
                                  <span style={{ fontSize: 9, color: t.textMuted, flexShrink: 0 }}>
                                    {post.scheduled_date ? format(new Date(post.scheduled_date), 'h:mma') : 'Draft'}
                                  </span>
                                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8', flexShrink: 0 }} />
                                </div>
                                {post.caption && (
                                  <div style={{ fontSize: 10, color: t.text, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                                    {post.caption.slice(0, 55)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {dayPosts.length === 0 && (
                            <button onClick={() => { setSelectedDay(day); }}
                              style={{ padding: '7px 4px', borderRadius: 7, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
                            >
                              <IpPlus size={9} strokeWidth={2.5} /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {/* Empty month banner */}
                {!loading && filteredPosts.filter(p => p.scheduled_date && new Date(p.scheduled_date).getMonth() === currentMonth.getMonth() && new Date(p.scheduled_date).getFullYear() === currentMonth.getFullYear()).length === 0 && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: t.textMuted }}>
                      {platformFilter !== 'all' || statusFilter !== 'all'
                        ? 'No posts match these filters'
                        : `No posts scheduled for ${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`}
                    </span>
                    {platformFilter === 'all' && statusFilter === 'all' && (
                      <button onClick={() => router.push('/wizard')} style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                        Schedule one →
                      </button>
                    )}
                  </div>
                )}
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4, marginBottom: isMobile ? 2 : 4 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: isMobile ? 9 : 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em', padding: isMobile ? '4px 0' : '6px 0' }}>{isMobile ? d.charAt(0) : d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4 }}>
                  {days.map(day => {
                    const dayPosts       = getPostsForDay(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isToday        = isSameDay(day, new Date());
                    const isSelected     = selectedDay && isSameDay(day, selectedDay);
                    const isPast         = day < new Date() && !isToday;
                    const hasPosts       = dayPosts.length > 0;
                    const isBulkSelected = bulkMode && bulkDays.includes(day.toISOString().slice(0, 10));

                    const isDragOver = dragOverDay && isSameDay(dragOverDay, day) && draggingPost;
                    return (
                      <div
                        key={day.toString()}
                        onClick={() => handleDayClick(day)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay(null); }}
                        onDrop={(e) => { e.preventDefault(); handleDropOnDay(day); }}
                        style={{
                          minHeight: isMobile ? 60 : 140,
                          padding: isMobile ? '3px 2px' : 6,
                          borderRadius: isMobile ? 7 : 10,
                          cursor: 'pointer',
                          border: isDragOver
                            ? `2px dashed ${t.primary}`
                            : isBulkSelected
                              ? `2px solid #7C5CFC`
                              : isSelected
                              ? `1.5px solid ${t.primary}`
                              : isToday
                              ? `1.5px solid ${t.primary}`
                              : !hasPosts && !isPast && isCurrentMonth
                              ? `1px dashed ${t.border}`
                              : `1px solid ${t.border}`,
                          background: isDragOver ? 'rgba(124,92,252,0.1)' : isBulkSelected ? 'rgba(124,92,252,0.12)' : isSelected ? t.primaryBg : isToday ? 'rgba(124,92,252,0.08)' : isCurrentMonth ? t.card : t.input,
                          opacity: !isCurrentMonth ? 0.35 : isPast ? 0.45 : 1,
                          boxShadow: isDragOver
                            ? `0 0 0 3px rgba(124,92,252,0.2)`
                            : isSelected
                              ? `0 0 0 3px rgba(124,92,252,0.15), inset 0 1px 0 rgba(255,255,255,0.06)`
                              : isToday
                                ? `0 0 0 2px rgba(124,92,252,0.25)`
                                : 'none',
                          transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected && !isDragOver) {
                            e.currentTarget.style.borderColor = t.primaryBorder;
                            e.currentTarget.style.borderStyle = 'solid';
                            e.currentTarget.style.background = isToday ? 'rgba(124,92,252,0.08)' : t.cardHover;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected && !isDragOver) {
                            e.currentTarget.style.borderColor = isToday ? t.primary : t.border;
                            e.currentTarget.style.borderStyle = (!hasPosts && !isPast && isCurrentMonth) ? 'dashed' : 'solid';
                            e.currentTarget.style.background = isToday ? 'rgba(124,92,252,0.05)' : isCurrentMonth ? t.card : t.input;
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 2 : 4 }}>
                          <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: isToday ? 700 : isSelected ? 600 : 400, color: isToday || isSelected ? t.primary : t.textSecondary }}>
                            {format(day, 'd')}
                          </span>
                          {hasPosts && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: t.primary, background: t.primaryBg, padding: '1px 3px', borderRadius: 9 }}>
                              {dayPosts.length}
                            </span>
                          )}
                        </div>

                        {/* On mobile: show colored dots only. On desktop: show text chips */}
                        {isMobile ? (
                          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {dayPosts.slice(0, 3).map(post => (
                              <div key={post.id} style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[post.content_type] || t.primary, flexShrink: 0 }} />
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {dayPosts.slice(0, 1).map(post => {
                              const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                              const TypeIcon  = TYPE_ICON[post.content_type] || IpDrafts;
                              const caption   = post.caption || '';
                              const postPlatformsArr = parsePlatforms(post.platforms);
                              const timeStr = post.scheduled_date ? format(new Date(post.scheduled_date), 'h:mm a') : 'Draft';
                              return (
                                <div key={post.id} draggable="true"
                                  onDragStart={(e) => { e.stopPropagation(); setDraggingPost(post.id); }}
                                  onDragEnd={() => { setDraggingPost(null); setDragOverDay(null); }}
                                  onMouseEnter={(e) => { e.stopPropagation(); handlePostHover(post, e); }}
                                  onMouseLeave={(e) => { e.stopPropagation(); setHoveredPost(null); }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                                  style={{ borderRadius: 7, overflow: 'hidden', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, background: t.isDark ? 'rgba(255,255,255,0.04)' : '#fff', opacity: draggingPost === post.id ? 0.35 : 1, cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: t.textMuted, fontWeight: 600, minWidth: 0, overflow: 'hidden' }}>
                                      <TypeIcon size={9} style={{ color: typeColor, flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timeStr}</span>
                                    </div>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8', flexShrink: 0, marginLeft: 4 }} />
                                  </div>
                                  {caption && <div style={{ fontSize: 10, color: t.textSecondary, padding: '3px 6px', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{caption}</div>}
                                  {post.media_url && <img src={post.media_url} alt="" loading="lazy" style={{ width: '100%', height: 46, objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px 4px', overflow: 'hidden' }}>
                                    {postPlatformsArr.slice(0, 2).map(pid => { const pm = PLATFORM_ICONS[pid]; if (!pm) return null; const PI = pm.icon; return <PI key={pid} size={9} style={{ color: pm.color }} />; })}
                                    {postPlatformsArr.length > 2 && <span style={{ fontSize: 8, color: t.textMuted, fontWeight: 700 }}>+{postPlatformsArr.length - 2}</span>}
                                    <span style={{ fontSize: 8, marginLeft: 'auto', padding: '1px 4px', borderRadius: 4, background: (STATUS_DOT[post.status] || '#94A3B8') + '22', color: STATUS_DOT[post.status] || '#94A3B8', fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{post.status}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {dayPosts.length > 1 && (
                              <button onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setExpandedDay({ day, posts: dayPosts, x: rect.right + 8, y: rect.top }); }}
                                style={{ fontSize: 10, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', paddingLeft: 4, textAlign: 'left', fontWeight: 600 }}>
                                See {dayPosts.length - 1} more ▾
                              </button>
                            )}
                            {/* Content calendar plan indicator */}
                            {isCurrentMonth && (() => {
                              const dayCalPlans = getPlansForDay(day);
                              if (!dayCalPlans.length) return null;
                              return (
                                <div
                                  title={`${dayCalPlans.length} content plan${dayCalPlans.length > 1 ? 's' : ''} in Content Calendar`}
                                  onClick={e => { e.stopPropagation(); router.push('/content-calendar'); }}
                                  style={{
                                    fontSize: 9, padding: '2px 5px', borderRadius: 4,
                                    background: 'rgba(124,92,252,0.1)', border: '1px dashed rgba(124,92,252,0.35)',
                                    color: '#9B7FFF', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 3, width: 'fit-content',
                                  }}
                                >
                                  ★ {dayCalPlans.length} planned
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.border}`, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>Post types:</span>
                  {Object.entries(TYPE_COLOR).map(([type, color]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.textMuted }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                      {TYPE_LABEL[type] || type.charAt(0).toUpperCase() + type.slice(1)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── DAY PANEL ────────────────────────────────────── */}
          {selectedDay && (
            <div style={isMobile ? {
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
              maxHeight: '78vh', overflowY: 'auto',
              borderRadius: '20px 20px 0 0',
              background: t.isDark ? 'rgba(10,10,18,0.99)' : t.card,
              border: `1px solid ${t.border}`,
              boxShadow: '0 -16px 48px rgba(0,0,0,0.45)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
            } : { ...gc, padding: 0, overflow: 'hidden', height: 'fit-content' }}>
              {/* Mobile drag handle */}
              {isMobile && (
                <div style={{ padding: '10px 0 2px', display: 'flex', justifyContent: 'center', cursor: 'grab', flexShrink: 0 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: t.textMuted, opacity: 0.35 }} />
                </div>
              )}
              <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
                    {format(selectedDay, 'EEEE')}
                  </div>
                  <div style={{ fontSize: 13, color: t.textMuted }}>{format(selectedDay, 'MMMM d, yyyy')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => handleAddOnDay(selectedDay)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.primary }}
                    title="Add post on this day"
                  >
                    <IpPlus size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setSelectedDay(null)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSecondary }}
                  >
                    <IpClose size={14} />
                  </button>
                </div>
              </div>

              {selectedDayPosts.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>No posts scheduled for this day</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button variant="primary" size="sm" onClick={() => handleAddOnDay(selectedDay)}>
                      <IpSparkle size={12} /> Generate with AI
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => router.push('/upload')}>
                      Manual upload
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {selectedDayPosts.map(post => {
                    const TypeIcon  = TYPE_ICON[post.content_type] || IpDrafts;
                    const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                    const postPlatforms = parsePlatforms(post.platforms);

                    return (
                      <div
                        key={post.id}
                        style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}
                      >
                        {/* Thumb + type */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {post.media_url
                              ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                              : <TypeIcon size={22} style={{ color: typeColor, opacity: 0.5 }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, textTransform: 'uppercase' }}>{TYPE_LABEL[post.content_type] || post.content_type}</span>
                              <Badge variant={STATUS_VAR[post.status] || 'default'}>{post.status}</Badge>
                            </div>
                            {post.scheduled_date && (
                              <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <IpSchedule size={10} />
                                {format(new Date(post.scheduled_date), 'h:mm a')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Caption */}
                        {post.caption && (
                          editingCaption === post.id ? (
                            <div style={{ marginBottom: 10 }}>
                              <textarea
                                value={editCaptionText}
                                onChange={e => setEditCaptionText(e.target.value)}
                                rows={4}
                                style={{ width: '100%', fontSize: 12, lineHeight: 1.6, padding: '6px 8px', borderRadius: 6, border: `1px solid ${t.primaryBorder}`, background: t.input, color: t.text, resize: 'vertical', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                <button onClick={() => handleSaveCaption(post)}
                                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, cursor: 'pointer' }}>
                                  Save
                                </button>
                                <button onClick={() => setEditingCaption(null)}
                                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginBottom: 10 }}>
                              <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6, margin: '0 0 4px' }}>
                                {post.caption.slice(0, 120)}{post.caption.length > 120 ? '…' : ''}
                              </p>
                              {(post.status === 'scheduled' || post.status === 'draft') && (
                                <button
                                  onClick={() => { setEditCaptionText(post.caption); setEditingCaption(post.id); }}
                                  style={{ fontSize: 11, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                >
                                  Edit caption
                                </button>
                              )}
                            </div>
                          )
                        )}

                        {/* Platforms */}
                        {postPlatforms.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 10, color: t.textMuted }}>Posting to:</span>
                            {postPlatforms.map(pid => {
                              const pm = PLATFORM_ICONS[pid];
                              if (!pm) return null;
                              const PI = pm.icon;
                              return <PI key={pid} size={13} style={{ color: pm.color }} title={pid} />;
                            })}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(post.status === 'scheduled' || post.status === 'draft' || post.status === 'failed') && (
                              <button
                                onClick={() => handlePublishNow(post)}
                                disabled={publishingPost === post.id}
                                style={{
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: post.status === 'failed' ? 'rgba(245,158,11,0.10)' : 'rgba(34,197,94,0.10)',
                                  border: `1px solid ${post.status === 'failed' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.25)'}`,
                                  color: post.status === 'failed' ? '#F59E0B' : '#22C55E',
                                  cursor: publishingPost === post.id ? 'not-allowed' : 'pointer',
                                  opacity: publishingPost === post.id ? 0.6 : 1,
                                }}
                              >
                                <IpCheck size={11} strokeWidth={3} />
                                {publishingPost === post.id ? '…' : post.status === 'failed' ? 'Retry' : 'Publish Now'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              disabled={deletingPost === post.id}
                              style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#EF4444', cursor: deletingPost === post.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: deletingPost === post.id ? 0.5 : 1 }}
                            >
                              <IpDelete size={11} /> {deletingPost === post.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                          {/* Reschedule */}
                          {(post.status === 'scheduled' || post.status === 'draft') && (
                            reschedulingPost === post.id ? (
                              <>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text }} />
                                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text }} />
                                <button onClick={() => handleReschedule(post)}
                                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, cursor: 'pointer' }}>
                                  Save
                                </button>
                                <button onClick={() => { setReschedulingPost(null); setRescheduleConflict(null); }}
                                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                              {rescheduleConflict?.post?.id === post.id && (
                                <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11 }}>
                                  <div style={{ color: '#F59E0B', fontWeight: 700, marginBottom: 4 }}>Conflict — {rescheduleConflict.conflictPlatform} already scheduled at {rescheduleConflict.conflictTime}</div>
                                  <button onClick={() => handleReschedule(post, true)}
                                    style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B', cursor: 'pointer' }}>
                                    Schedule anyway
                                  </button>
                                </div>
                              )}
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  const d = new Date(post.scheduled_date);
                                  setRescheduleDate(d.toISOString().slice(0, 10));
                                  setRescheduleTime(d.toISOString().slice(11, 16));
                                  setReschedulingPost(post.id);
                                }}
                                style={{ padding: '4px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <IpSchedule size={11} /> Reschedule
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ padding: '12px 18px' }}>
                    <Button variant="secondary" size="sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleAddOnDay(selectedDay)}>
                      <IpPlus size={12} strokeWidth={2.5} /> Add another post
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </> /* end calendar view */}

        {/* ── LIST VIEW ── */}
        {pageView === 'list' && <>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <IpSearch size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }} />
            <input type="text" placeholder="Search your posts…" value={listSearch} onChange={e => setListSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`, borderRadius: 12, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', boxShadow: `inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.03' : '0.8'})` }} />
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Platform pills */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'facebook', label: 'Facebook', Icon: IpFacebook, color: '#1877F2' },
                { id: 'instagram', label: 'Instagram', Icon: IpInstagram, color: '#E1306C' },
                { id: 'tiktok', label: 'TikTok', Icon: IpTikTok, color: '#000000' },
                { id: 'linkedin', label: 'LinkedIn', Icon: IpLinkedIn, color: '#0A66C2' },
                { id: 'google_business', label: 'Google Business', Icon: IpGoogle, color: '#4285F4' },
              ].map(pf => {
                const isActive = listPlatformFilter === pf.id;
                const col = pf.color || t.primary;
                return (
                  <button key={pf.id} onClick={() => setListPlatformFilter(pf.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', fontSize: 12, fontWeight: isActive ? 700 : 500, border: `1px solid ${isActive ? col + '55' : t.border}`, background: isActive ? col + '18' : t.card, color: isActive ? col : t.textMuted, cursor: 'pointer', flexShrink: 0 }}>
                    {pf.Icon && <pf.Icon size={12} />}{pf.label}
                  </button>
                );
              })}
            </div>
            <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />
            {/* Date range */}
            <div style={{ display: 'flex', gap: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 9, padding: 3, flexShrink: 0 }}>
              {[{ id: 'all', label: 'All time' }, { id: '7d', label: 'Last 7d' }, { id: '30d', label: 'Last 30d' }, { id: 'month', label: 'This month' }].map(opt => (
                <button key={opt.id} onClick={() => setListDateRange(opt.id)}
                  style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: listDateRange === opt.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent', background: listDateRange === opt.id ? t.primaryBg : 'transparent', color: listDateRange === opt.id ? t.primary : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Content type */}
            <div style={{ display: 'flex', gap: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 9, padding: 3, flexShrink: 0 }}>
              {[{ id: 'all', label: 'All types' }, { id: 'photo', label: 'Photo', color: '#06B6D4' }, { id: 'video', label: 'Video', color: '#FF9F0A' }, { id: 'carousel', label: 'Carousel', color: '#F472B6' }, { id: 'static', label: 'Text', color: '#60A5FA' }].map(opt => (
                <button key={opt.id} onClick={() => setListContentType(opt.id)}
                  style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: listContentType === opt.id ? `1px solid ${(opt.color || t.primary) + '55'}` : '1px solid transparent', background: listContentType === opt.id ? (opt.color ? opt.color + '18' : t.primaryBg) : 'transparent', color: listContentType === opt.id ? (opt.color || t.primary) : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, flexWrap: 'wrap', width: 'fit-content', boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}>
            {[{ id: 'all', label: 'All' }, { id: 'posted', label: 'Published' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'draft', label: 'Drafts' }, { id: 'failed', label: 'Failed' }].map(f => (
              <button key={f.id} onClick={() => setListFilter(f.id)}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, color: listFilter === f.id ? t.text : t.textMuted, background: listFilter === f.id ? t.primaryBg : 'transparent', border: listFilter === f.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                {f.label}{f.id === 'all' && <span style={{ fontSize: 11, padding: '0 5px', background: t.input, borderRadius: 9, color: t.textMuted }}>{listTotal}</span>}
              </button>
            ))}
          </div>

          {/* Result count + view controls */}
          {!listLoading && (
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{listDisplayPosts.length} post{listDisplayPosts.length !== 1 ? 's' : ''}</span>
              {(listPlatformFilter !== 'all' || listContentType !== 'all' || listDateRange !== 'all' || listSearch) && (
                <button onClick={() => { setListPlatformFilter('all'); setListContentType('all'); setListDateRange('all'); setListSearch(''); }}
                  style={{ fontSize: 11, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>Clear filters</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {listSelectedIds.length > 0 && (
                  <button onClick={() => setListSelectedIds([])}
                    style={{ fontSize: 11, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                    {listSelectedIds.length} selected — clear
                  </button>
                )}
                {listDisplayPosts.length > 0 && (
                  <button onClick={() => listSelectedIds.length === listDisplayPosts.length ? setListSelectedIds([]) : setListSelectedIds(listDisplayPosts.map(p => p.id))}
                    style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                    {listSelectedIds.length === listDisplayPosts.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
                <div style={{ display: 'flex', padding: 3, gap: 2, background: t.isDark ? 'rgba(255,255,255,0.04)' : t.input, border: `1px solid ${t.border}`, borderRadius: 9 }}>
                  {[{ id: 'list', label: '≡ List' }, { id: 'grid', label: '⊞ Grid' }].map(v => (
                    <button key={v.id} onClick={() => setListViewMode(v.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: listViewMode === v.id ? t.primaryBg : 'transparent', color: listViewMode === v.id ? t.primary : t.textMuted, border: listViewMode === v.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent', transition: 'all 150ms' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Post list / grid */}
          {listLoadError ? (
            <ErrorCard title="Could not load posts" message="Check your connection and try again." onRetry={loadListPosts} style={{ marginTop: 24 }} />
          ) : listLoading ? (
            listViewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 3}, 1fr)`, gap: 8 }}>
                {Array.from({ length: isMobile ? 6 : 9 }).map((_, i) => <Skeleton key={i} height={180} borderRadius={12} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={118} borderRadius={14} />)}
              </div>
            )
          ) : listDisplayPosts.length === 0 ? (
            <div style={{ padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16 }}>
              <EmptyState icon={IpDrafts} title={listSearch ? 'No posts match your search' : 'No posts yet'} subtitle={listSearch ? 'Try a different search term' : 'Create your first post to get started'}
                action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}><Button variant="secondary" size="sm" onClick={() => router.push('/wizard')}><IpSparkle size={12} /> Post Wizard</Button><Button variant="secondary" size="sm" onClick={() => router.push('/upload')}>Manual upload</Button></div>} />
            </div>
          ) : listViewMode === 'grid' ? (
            /* Grid view */
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 3}, 1fr)`, gap: 8 }}>
              {listDisplayPosts.map(post => {
                const TypeIcon = TYPE_ICON[post.content_type] || IpDrafts;
                const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                const isHovered = hoveredCard === post.id;
                const isSelected = listSelectedIds.includes(post.id);
                return (
                  <div key={post.id} onClick={() => listSelectedIds.length > 0 ? toggleListSelect(post.id) : openPreview(post.id, 'view')}
                    onMouseEnter={() => setHoveredCard(post.id)} onMouseLeave={() => setHoveredCard(null)}
                    style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: isSelected ? `2px solid ${t.primary}` : `1px solid ${isHovered ? 'rgba(124,92,252,0.4)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, transform: isHovered && !isSelected ? 'translateY(-2px)' : 'none', boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.25)' : t.shadowSm, background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, transition: 'all 200ms' }}>
                    <div style={{ aspectRatio: '1', background: t.input, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {post.media_url ? <img src={post.media_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} /> : <TypeIcon size={32} style={{ color: typeColor, opacity: 0.4 }} />}
                      <div onClick={(e) => toggleListSelect(post.id, e)} style={{ position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: '50%', background: isSelected ? '#7C5CFC' : 'rgba(0,0,0,0.45)', border: `2px solid ${isSelected ? '#7C5CFC' : 'rgba(255,255,255,0.7)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: listSelectedIds.length > 0 || isHovered ? 1 : 0, transition: 'opacity 150ms' }}>
                        {isSelected && <IpCheck size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
                        <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 5px', borderRadius: 4, textTransform: 'uppercase' }}>{TYPE_LABEL[post.content_type] || 'POST'}</span>
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px 10px' }}>
                      <p style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.caption || <span style={{ color: t.textMuted, fontStyle: 'italic' }}>No caption</span>}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        {parsePlatforms(post.platforms).slice(0, 3).map(pid => { const pm = PLATFORM_ICONS[pid]; if (!pm) return null; const PI = pm.icon; return <PI key={pid} size={11} style={{ color: pm.color }} />; })}
                        {post.scheduled_date && <span style={{ fontSize: 9, color: t.textMuted, marginLeft: 'auto' }}>{format(new Date(post.scheduled_date), 'MMM d')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view — GHL-style table */
            <div style={{ background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 72px 130px 100px 110px 140px 44px', padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)', alignItems: 'center', gap: 8 }}>
                <div><input type="checkbox" checked={listDisplayPosts.length > 0 && listSelectedIds.length === listDisplayPosts.length} onChange={() => listSelectedIds.length === listDisplayPosts.length ? setListSelectedIds([]) : setListSelectedIds(listDisplayPosts.map(p => p.id))} style={{ cursor: 'pointer', accentColor: '#7C5CFC' }} /></div>
                {['Caption', 'Media', 'Status', 'Type', 'Date', 'Social', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{h}</div>
                ))}
              </div>
              {/* Table rows */}
              {listDisplayPosts.map((post, rowIdx) => {
                const TypeIcon = TYPE_ICON[post.content_type] || IpDrafts;
                const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                const postPlatforms = parsePlatforms(post.platforms);
                const isHovered = hoveredCard === post.id;
                const dotColor = STATUS_DOT[post.status] || '#94A3B8';
                const isSelected = listSelectedIds.includes(post.id);
                const isKebabOpen = kebabMenu?.postId === post.id;
                return (
                  <div key={post.id}
                    onClick={() => listSelectedIds.length > 0 ? toggleListSelect(post.id) : openPreview(post.id, 'view')}
                    onMouseEnter={() => setHoveredCard(post.id)} onMouseLeave={() => setHoveredCard(null)}
                    style={{ display: 'grid', gridTemplateColumns: '44px 1fr 72px 130px 100px 110px 140px 44px', padding: '10px 16px', borderBottom: rowIdx < listDisplayPosts.length - 1 ? `1px solid ${t.border}` : 'none', background: isSelected ? (t.isDark ? 'rgba(124,92,252,0.1)' : 'rgba(124,92,252,0.05)') : isHovered ? t.cardHover : 'transparent', cursor: 'pointer', alignItems: 'center', gap: 8, transition: 'background 150ms' }}>
                    {/* Checkbox */}
                    <div onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={e => toggleListSelect(post.id, e)} style={{ cursor: 'pointer', accentColor: '#7C5CFC' }} />
                    </div>
                    {/* Caption */}
                    <div style={{ fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {post.caption || <span style={{ color: t.textMuted, fontStyle: 'italic' }}>No caption</span>}
                    </div>
                    {/* Media */}
                    <div>
                      {post.media_url
                        ? <img src={post.media_url} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 7, display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 7, background: `${typeColor}18`, border: `1px solid ${typeColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TypeIcon size={18} style={{ color: typeColor, opacity: 0.6 }} /></div>
                      }
                    </div>
                    {/* Status */}
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: dotColor }}>
                        <IpSchedule size={11} />
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                    </div>
                    {/* Type */}
                    <div>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {TYPE_LABEL[post.content_type] || post.content_type}
                      </span>
                    </div>
                    {/* Date */}
                    <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>
                      {post.scheduled_date ? format(new Date(post.scheduled_date), 'dd MMM yyyy') : format(new Date(post.created_at), 'dd MMM yyyy')}
                    </div>
                    {/* Social — overlapping circles */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {postPlatforms.slice(0, 3).map((pid, idx) => {
                        const pm = PLATFORM_ICONS[pid];
                        if (!pm) return null;
                        const PI = pm.icon;
                        return (
                          <div key={pid} title={pid} style={{ width: 24, height: 24, borderRadius: '50%', background: pm.color + '22', border: `2px solid ${t.isDark ? '#0f0f18' : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: idx > 0 ? -7 : 0, position: 'relative', zIndex: 3 - idx }}>
                            <PI size={12} style={{ color: pm.color }} />
                          </div>
                        );
                      })}
                      {postPlatforms.length > 3 && (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.input, border: `2px solid ${t.isDark ? '#0f0f18' : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7, fontSize: 9, color: t.textMuted, fontWeight: 700 }}>
                          +{postPlatforms.length - 3}
                        </div>
                      )}
                    </div>
                    {/* Kebab */}
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
                      <button onClick={e => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setKebabMenu(isKebabOpen ? null : { postId: post.id, x: rect.right - 150, y: rect.bottom + 4 });
                      }} style={{ width: 30, height: 30, borderRadius: 7, background: isKebabOpen ? t.primaryBg : 'transparent', border: `1px solid ${isKebabOpen ? t.primaryBorder : 'transparent'}`, color: isKebabOpen ? t.primary : t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.border; }}
                        onMouseLeave={e => { if (!isKebabOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}>
                        ⋮
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating bulk action bar */}
          {listSelectedIds.length > 0 && (
            <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 20, background: t.isDark ? 'rgba(12,12,20,0.96)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{listSelectedIds.length} selected</span>
              <div style={{ width: 1, height: 18, background: t.border }} />
              <button onClick={handleBulkListPublish} style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <IpCheck size={12} strokeWidth={3} /> Publish All
              </button>
              <button onClick={handleBulkListDelete} style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <IpDelete size={12} /> Delete All
              </button>
              <button onClick={() => setListSelectedIds([])} style={{ width: 28, height: 28, borderRadius: '50%', background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IpClose size={12} />
              </button>
            </div>
          )}
        </>}
      </Layout>

      <style>{`@keyframes calPreviewIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {/* ── Hover post preview popup ── */}
      {hoveredPost && (
        <div style={{
          position: 'fixed', left: hoverPos.x, top: hoverPos.y, width: 252,
          zIndex: 9999, pointerEvents: 'none',
          background: t.isDark ? 'rgba(12,12,20,0.97)' : 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.12)',
          animation: 'calPreviewIn 120ms ease',
        }}>
          {hoveredPost.media_url && (
            <img src={hoveredPost.media_url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: TYPE_COLOR[hoveredPost.content_type] || t.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {TYPE_LABEL[hoveredPost.content_type] || hoveredPost.content_type}
              </span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[hoveredPost.status] || '#94A3B8' }} />
              <span style={{ fontSize: 9, color: t.textMuted, textTransform: 'capitalize' }}>{hoveredPost.status}</span>
            </div>
            {hoveredPost.caption && (
              <p style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.55, margin: '0 0 8px' }}>
                {hoveredPost.caption.slice(0, 110)}{hoveredPost.caption.length > 110 ? '…' : ''}
              </p>
            )}
            {hoveredPost.scheduled_date && (
              <div style={{ fontSize: 10, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <IpSchedule size={10} />
                {format(new Date(hoveredPost.scheduled_date), 'EEE, MMM d · h:mm a')}
              </div>
            )}
            {parsePlatforms(hoveredPost.platforms).length > 0 && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {parsePlatforms(hoveredPost.platforms).map(pid => {
                  const pm = PLATFORM_ICONS[pid];
                  if (!pm) return null;
                  const PI = pm.icon;
                  return <PI key={pid} size={13} style={{ color: pm.color }} />;
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GHL "See X more" expanded day popup ── */}
      {expandedDay && (
        <div data-expanded-popup onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: Math.min(expandedDay.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300), top: Math.min(expandedDay.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 420), width: 280, zIndex: 9998, background: t.isDark ? 'rgba(12,12,20,0.97)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.28)', padding: 14, maxHeight: 420, overflowY: 'auto', animation: 'calPreviewIn 120ms ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{format(expandedDay.day, 'EEEE, MMMM d')}</span>
            <button onClick={() => setExpandedDay(null)} style={{ width: 24, height: 24, borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}><IpClose size={12} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expandedDay.posts.map(post => {
              const tc = TYPE_COLOR[post.content_type] || t.primary;
              const TI = TYPE_ICON[post.content_type] || IpDrafts;
              return (
                <div key={post.id} style={{ padding: '10px 12px', borderRadius: 10, background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${t.border}`, borderLeft: `3px solid ${tc}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <TI size={10} style={{ color: tc }} />
                    <span style={{ fontSize: 10, color: t.textMuted }}>{post.scheduled_date ? format(new Date(post.scheduled_date), 'h:mm a') : 'Draft'}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8' }} />
                    <Badge variant={STATUS_VAR[post.status] || 'default'} style={{ fontSize: 9 }}>{post.status}</Badge>
                  </div>
                  {post.caption && <p style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5, margin: '0 0 8px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.caption}</p>}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                    {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
                      <button onClick={() => { handlePublishNow(post); setExpandedDay(null); }} disabled={publishingPost === post.id}
                        style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IpCheck size={10} strokeWidth={3} /> Publish
                      </button>
                    )}
                    <button onClick={() => { handleDeletePost(post.id); setExpandedDay(null); }} disabled={deletingPost === post.id}
                      style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <IpDelete size={10} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Kebab menu dropdown ── */}
      {kebabMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: kebabMenu.x, top: kebabMenu.y, width: 150, zIndex: 9999, background: t.isDark ? 'rgba(12,12,20,0.97)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', padding: '4px', animation: 'calPreviewIn 100ms ease' }}>
          {[
            { label: 'Edit', icon: IpEdit, action: (post) => { openPreview(post.id, 'edit'); setKebabMenu(null); }, show: (post) => post.status === 'draft' || post.status === 'scheduled' },
            { label: 'Clone', icon: IpCopy, action: (post) => handleClone(post), show: () => true },
            { label: 'Publish Now', icon: IpCheck, action: (post) => { handleListPublishNow(post); setKebabMenu(null); }, show: (post) => post.status === 'draft' || post.status === 'scheduled' },
            { label: 'Delete', icon: IpDelete, action: (post) => { handleListDelete(post.id); setKebabMenu(null); }, show: () => true, danger: true },
          ].map(item => {
            const post = listDisplayPosts.find(p => p.id === kebabMenu.postId);
            if (!post || (item.show && !item.show(post))) return null;
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={e => { e.stopPropagation(); item.action(post); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: item.danger ? '#EF4444' : t.text, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : t.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Icon size={13} /> {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Confirm + Preview modals ── */}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
      {previewPostId && listDisplayPosts.find(p => p.id === previewPostId) && (
        <PostPreviewModal
          post={listDisplayPosts.find(p => p.id === previewPostId)}
          allPosts={listDisplayPosts}
          defaultMode={previewDefaultMode}
          onClose={() => { setPreviewPostId(null); setPreviewDefaultMode('view'); }}
          onNavigate={id => { setPreviewDefaultMode('view'); setPreviewPostId(id); }}
          onUpdate={updated => setListPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onDelete={id => { setListPosts(prev => prev.filter(p => p.id !== id)); setPreviewPostId(null); }}
        />
      )}

      {/* ── Auto-plan my month modal ── */}
      {planMonthModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !planMonthSaving) setPlanMonthModal(false); }}
        >
          <div style={{ background: t.isDark ? 'rgba(15,15,24,0.98)' : t.card, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`, borderRadius: 18, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <IpSparkle size={18} color="url(#brand-gradient)" />
                    <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>PostCore planned {planMonthName} for you</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>{planMonthSlots.length} posts · 70% educational, 20% social proof, 10% promotional</p>
                </div>
                {!planMonthSaving && (
                  <button onClick={() => setPlanMonthModal(false)} style={{ padding: 8, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, cursor: 'pointer', color: t.textMuted }}>
                    <IpClose size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Slot list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
              {planMonthSlots.map((slot, i) => {
                const CATEGORY_COLORS = { educational: '#60A5FA', social_proof: '#A78BFA', promotional: '#FB923C' };
                const TYPE_COLORS = { static: '#60A5FA', photo: '#06B6D4', carousel: '#F472B6', video: '#FF9F0A' };
                const catColor = CATEGORY_COLORS[slot.category] || t.primary;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14, padding: '12px 0', borderBottom: `1px solid ${t.border}`, alignItems: 'flex-start' }}>
                    {/* Date */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {new Date(slot.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>
                        {new Date(slot.date + 'T12:00:00').getDate()}
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>
                        {new Date(slot.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </div>
                    {/* Content */}
                    <div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${catColor}18`, color: catColor }}>
                          {slot.category === 'social_proof' ? 'Social proof' : slot.category.charAt(0).toUpperCase() + slot.category.slice(1)}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${TYPE_COLORS[slot.contentType] || t.primary}15`, color: TYPE_COLORS[slot.contentType] || t.primary }}>
                          {slot.contentType === 'static' ? 'Text card' : slot.contentType.charAt(0).toUpperCase() + slot.contentType.slice(1)}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: t.input, color: t.textMuted }}>
                          {slot.platform === 'all' ? 'All platforms' : slot.platform.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{slot.topic}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>{slot.captionPreview}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer actions */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
                {planMonthSaving
                  ? `Saving drafts… ${planMonthSaved}/${planMonthSlots.length}`
                  : 'All posts will be saved as drafts. You can edit any post before publishing.'
                }
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!planMonthSaving && (
                  <button onClick={() => setPlanMonthModal(false)} style={{ padding: '10px 20px', borderRadius: 9, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleConfirmPlan}
                  disabled={planMonthSaving}
                  style={{ padding: '10px 24px', borderRadius: 9, background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: planMonthSaving ? 'default' : 'pointer', opacity: planMonthSaving ? 0.75 : 1, display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  <IpCheck size={14} />
                  {planMonthSaving ? `Saving ${planMonthSaved}/${planMonthSlots.length}…` : `Add ${planMonthSlots.length} drafts to calendar`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

