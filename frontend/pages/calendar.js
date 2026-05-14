import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpChevronLeft, IpChevronRight, IpPlus, IpCalendar as CalendarIcon,
  IpClose, IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGoogle, IpLinkedIn, IpTikTok,
  IpSchedule, IpSparkle, IpDelete,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Badge, Skeleton } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI } from '../lib/api';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns';

const TYPE_ICON  = { static: IpDrafts, photo: ImageIcon, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR = { static: '#60A5FA', photo: '#A78BFA', carousel: '#F472B6', video: '#FB923C' };
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadPosts();
  }, []);

  useEffect(() => { if (mounted) loadPosts(); }, [currentMonth]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await postsAPI.getAll({ limit: 200 });
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const days        = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  const getPostsForDay = (day) => posts.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date), day));

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : [];

  const handleDayClick = (day) => {
    if (selectedDay && isSameDay(day, selectedDay)) { setSelectedDay(null); return; }
    setSelectedDay(day);
  };

  const handleAddOnDay = () => {
    router.push('/wizard');
  };

  const [deletingPost, setDeletingPost] = useState(null);
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
      <Layout
        title="Calendar"
        subtitle="Schedule and manage your posts"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => router.push('/wizard')}><IpSparkle size={13} color="url(#brand-gradient)" /> AI Generate</Button>
            <Button variant="primary"   onClick={() => router.push('/upload')}><IpPlus size={14} strokeWidth={2.5} /> Create Post</Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 320px' : '1fr', gap: 20, transition: 'all 300ms' }}>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} height={88} borderRadius={8} />)}
                </div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {/* Empty month banner */}
                {!loading && posts.filter(p => p.scheduled_date && new Date(p.scheduled_date).getMonth() === currentMonth.getMonth() && new Date(p.scheduled_date).getFullYear() === currentMonth.getFullYear()).length === 0 && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: t.textMuted }}>
                      No posts scheduled for {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </span>
                    <button onClick={() => router.push('/wizard')} style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                      Schedule one →
                    </button>
                  </div>
                )}
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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
                          minHeight: 88, padding: 6, borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${isSelected ? t.primary : isToday ? t.primaryBorder : t.border}`,
                          background: isSelected ? t.primaryBg : isToday ? 'rgba(124,92,252,0.05)' : isCurrentMonth ? t.card : t.input,
                          opacity: !isCurrentMonth ? 0.35 : isPast ? 0.45 : 1,
                          transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = t.primaryBorder; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isToday ? t.primaryBorder : t.border; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: isToday ? 700 : isSelected ? 600 : 400, color: isToday || isSelected ? t.primary : t.textSecondary }}>
                            {format(day, 'd')}
                          </span>
                          {hasPosts && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: t.primary, background: t.primaryBg, padding: '1px 5px', borderRadius: 9 }}>
                              {dayPosts.length}
                            </span>
                          )}
                        </div>

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
                                <TypeIcon size={8} />
                                <span>{caption ? caption.slice(0, 20) : format(new Date(post.scheduled_date), 'h:mm a')}</span>
                              </div>
                            );
                          })}
                          {dayPosts.length > 2 && (
                            <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 4 }}>+{dayPosts.length - 2} more</div>
                          )}
                        </div>
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
                      {type.charAt(0).toUpperCase() + type.slice(1)}
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
                              <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, textTransform: 'uppercase' }}>{post.content_type}</span>
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
                          <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6, margin: '0 0 10px' }}>
                            {post.caption.slice(0, 120)}{post.caption.length > 120 ? '…' : ''}
                          </p>
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

                        {/* Delete */}
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingPost === post.id}
                          style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#EF4444', cursor: deletingPost === post.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: deletingPost === post.id ? 0.5 : 1 }}
                        >
                          <IpDelete size={11} /> {deletingPost === post.id ? 'Deleting…' : 'Delete'}
                        </button>
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

export async function getServerSideProps() { return { props: {} }; }
