import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpChevronLeft, IpChevronRight, IpPlus, IpCalendar as CalendarIcon,
  IpClose, IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGoogle, IpLinkedIn, IpTikTok,
  IpSchedule, IpSparkle, IpDelete, IpCheck,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Badge, Skeleton } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, socialAPI } from '../lib/api';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns';

const TYPE_ICON  = { static: IpDrafts, photo: ImageIcon, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR  = { static: '#60A5FA', photo: '#A78BFA', carousel: '#F472B6', video: '#FB923C' };
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

  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const visibleFrom = startOfWeek(monthStart);
  const visibleTo   = endOfWeek(monthEnd);
  const days        = eachDayOfInterval({ start: visibleFrom, end: visibleTo });

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await postsAPI.getAll({
        from:  visibleFrom.toISOString(),
        to:    visibleTo.toISOString(),
        limit: 200,
      });
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const filteredPosts = posts.filter(p => {
    if (platformFilter !== 'all' && !parsePlatforms(p.platforms).includes(platformFilter)) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });
  const getPostsForDay = (day) => filteredPosts.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), day));

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : [];

  const handleDayClick = (day) => {
    if (selectedDay && isSameDay(day, selectedDay)) { setSelectedDay(null); return; }
    setSelectedDay(day);
  };

  const handleAddOnDay = () => {
    const dateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
    router.push(dateStr ? `/upload?scheduleDate=${dateStr}` : '/upload');
  };

  const [deletingPost, setDeletingPost]     = useState(null);
  const [publishingPost, setPublishingPost] = useState(null);
  const [calToast, setCalToast]             = useState(null);
  const [reschedulingPost, setReschedulingPost] = useState(null);
  const [rescheduleDate, setRescheduleDate]     = useState('');
  const [rescheduleTime, setRescheduleTime]     = useState('');
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

  const handleReschedule = async (post) => {
    if (!rescheduleDate || !rescheduleTime) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await postsAPI.update(post.id, { scheduledDate: `${rescheduleDate}T${rescheduleTime}`, timezone: tz });
      const newDate = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_date: newDate } : p));
      setReschedulingPost(null);
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

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, background: t.input,
    border: `1px solid ${t.border}`, color: t.text, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', appearance: 'none',
    WebkitAppearance: 'none', paddingRight: 24,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'calc(100% - 6px) 50%',
  };

  if (!mounted) return null;

  return (
    <>
      {calToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '10px 20px', borderRadius: 10, background: calToast.type === 'error' ? '#EF4444' : '#22C55E', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
          {calToast.msg}
        </div>
      )}
      <Layout
        title="Calendar"
        subtitle="Schedule and manage your posts"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => router.push('/wizard')}><IpSparkle size={13} color="url(#brand-gradient)" /> Post Wizard</Button>
            <Button variant="primary"   onClick={() => router.push('/upload')}><IpPlus size={14} strokeWidth={2.5} /> Upload</Button>
          </div>
        }
      >
        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Platform */}
          <div style={{ display: 'flex', gap: 3, background: t.card, border: `1px solid ${t.border}`, borderRadius: 9, padding: 3 }}>
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
          <div style={{ display: 'flex', gap: 3, background: t.card, border: `1px solid ${t.border}`, borderRadius: 9, padding: 3 }}>
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

          {(platformFilter !== 'all' || statusFilter !== 'all') && (
            <button onClick={() => { setPlatformFilter('all'); setStatusFilter('all'); }}
              style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: (selectedDay && !isMobile) ? '1fr 320px' : '1fr', gap: 20, transition: 'all 300ms' }}>

          {/* ── CALENDAR ─────────────────────────────────────── */}
          <Card padding={0}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarIcon size={18} color="url(#brand-gradient)" />
                {/* Month selector */}
                <div style={{ position: 'relative' }}>
                  <select value={currentMonth.getMonth()} onChange={handleMonthChange} style={selectStyle}>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                {/* Year selector */}
                <div style={{ position: 'relative' }}>
                  <select value={currentMonth.getFullYear()} onChange={handleYearChange} style={selectStyle}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedDay(null); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  <IpChevronLeft size={16} />
                </button>
                <button
                  onClick={() => { setCurrentMonth(new Date()); setSelectedDay(null); }}
                  style={{ padding: '6px 14px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  Today
                </button>
                <button
                  onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedDay(null); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = t.input}
                >
                  <IpChevronRight size={16} />
                </button>
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

                    return (
                      <div
                        key={day.toString()}
                        onClick={() => handleDayClick(day)}
                        style={{
                          minHeight: isMobile ? 52 : 88,
                          padding: isMobile ? '3px 2px' : 6,
                          borderRadius: isMobile ? 7 : 10,
                          cursor: 'pointer',
                          border: isSelected
                            ? `1.5px solid ${t.primary}`
                            : isToday
                            ? `1.5px solid ${t.primaryBorder}`
                            : !hasPosts && !isPast && isCurrentMonth
                            ? `1px dashed ${t.border}`
                            : `1px solid ${t.border}`,
                          background: isSelected ? t.primaryBg : isToday ? 'rgba(124,92,252,0.05)' : isCurrentMonth ? t.card : t.input,
                          opacity: !isCurrentMonth ? 0.35 : isPast ? 0.45 : 1,
                          transition: 'border-color 120ms ease, background 120ms ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = t.primaryBorder;
                            e.currentTarget.style.borderStyle = 'solid';
                            e.currentTarget.style.background = isToday ? 'rgba(124,92,252,0.08)' : t.cardHover;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = isToday ? t.primaryBorder : t.border;
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayPosts.slice(0, 2).map(post => {
                              const typeColor = TYPE_COLOR[post.content_type] || t.primary;
                              const TypeIcon  = TYPE_ICON[post.content_type] || IpDrafts;
                              const caption   = post.caption || '';
                              return (
                                <div
                                  key={post.id}
                                  title={caption}
                                  style={{
                                    fontSize: 10, padding: '3px 5px', borderRadius: 4,
                                    background: `${typeColor}18`,
                                    border: `1px solid ${typeColor}40`,
                                    color: typeColor,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    display: 'flex', alignItems: 'center', gap: 3,
                                  }}
                                >
                                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[post.status] || '#94A3B8', flexShrink: 0 }} />
                                  <TypeIcon size={8} />
                                  <span>{caption ? caption.slice(0, 20) : format(new Date(post.scheduled_date), 'h:mm a')}</span>
                                </div>
                              );
                            })}
                            {dayPosts.length > 2 && (
                              <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 4 }}>+{dayPosts.length - 2} more</div>
                            )}
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
          </Card>

          {/* ── DAY PANEL ────────────────────────────────────── */}
          {selectedDay && (
            <Card padding={0} style={{ overflow: 'hidden', height: 'fit-content' }}>
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
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text }} />
                                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text }} />
                                <button onClick={() => handleReschedule(post)}
                                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, cursor: 'pointer' }}>
                                  Save
                                </button>
                                <button onClick={() => setReschedulingPost(null)}
                                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </div>
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
            </Card>
          )}
        </div>
      </Layout>

    </>
  );
}

