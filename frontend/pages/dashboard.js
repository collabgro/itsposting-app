import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IpCalendar, IpSchedule, IpSparkle, IpPlus,
  IpTrendingUp, IpTrendingDown,
  IpDrafts, IpPhoto, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGlobe, IpLinkedIn, IpTikTok,
  IpArrowRight, IpFlame, IpTeam, IpAnalytics,
  IpClose, IpInfo,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, SectionHeader, EmptyState, Spinner, Skeleton } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, intelligenceAPI, geoAPI, analyticsAPI } from '../lib/api';
import { format } from 'date-fns';
import PostPreviewModal from '../components/PostPreviewModal';

const TYPE_ICON  = { static: IpDrafts, photo: IpPhoto, carousel: IpCarousel, video: IpVideo };
const TYPE_COLOR = { static: '#60A5FA', photo: '#A78BFA', carousel: '#F472B6', video: '#FB923C' };
const PLAT_ICONS = {
  facebook:        { icon: IpFacebook,  color: '#1877F2' },
  instagram:       { icon: IpInstagram, color: '#E1306C' },
  google_business: { icon: IpGlobe,     color: '#4285F4' },
};

function parsePlatforms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function fmt(n) { return n?.toLocaleString() ?? '—'; }

export default function Dashboard() {
  const router = useRouter();
  const { t }  = useTheme();

  const [mounted,        setMounted]        = useState(false);
  const [allPosts,       setAllPosts]       = useState([]);
  const [upcoming,       setUpcoming]       = useState([]);
  const [metrics,        setMetrics]        = useState(null);
  const [briefing,       setBriefing]       = useState(null);
  const [contentMix,     setContentMix]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState(false);
  const [briefingOpen,   setBriefingOpen]   = useState(true);
  const [geoScore,       setGeoScore]       = useState(null);
  const [showTour,       setShowTour]       = useState(false);
  const [upcomingFilter, setUpcomingFilter] = useState('all');
  const [previewPostId,  setPreviewPostId]  = useState(null);

  const loadDashboard = () => {
    setLoadError(false);
    setLoading(true);
    Promise.all([
      postsAPI.getAll({ limit: 100 }),
      postsAPI.getUpcoming(),
      intelligenceAPI.getMetrics().catch(() => ({ data: null })),
      intelligenceAPI.getBriefing().catch(() => ({ data: null })),
      intelligenceAPI.getContentHealth().catch(() => ({ data: null })),
      geoAPI.getScore().catch(() => ({ data: null })),
    ]).then(([p, u, m, b, cm, g]) => {
      const posts = Array.isArray(p.data) ? p.data : [];
      setAllPosts(posts);
      setUpcoming(Array.isArray(u.data) ? u.data : []);
      setMetrics(m.data);
      setBriefing(b.data);
      setContentMix(cm.data);
      setGeoScore(g?.data || null);
      setLoading(false);

      // Background metrics sync: if we have posted content but zero reach, pull real data
      const totalPosts = posts.filter(p => p.status === 'posted').length;
      const totalReach = m.data?.totalReach || 0;
      if (totalPosts > 0 && totalReach === 0) {
        analyticsAPI.syncMetrics().catch(() => {});
      }
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  };

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    if (!localStorage.getItem('tour_done')) { setTimeout(() => setShowTour(true), 800); }
    loadDashboard();
  }, []);

  const dismissBriefing = async () => {
    setBriefingOpen(false);
    if (briefing?.id) {
      await intelligenceAPI.markBriefingRead(briefing.id).catch(() => {});
    }
  };

  if (!mounted) return null;

  if (loadError) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16, padding: 40 }}>
          <div style={{ fontSize: 15, color: '#EF4444' }}>Failed to load dashboard data.</div>
          <button onClick={loadDashboard} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  const today   = new Date();
  const year    = today.getFullYear();
  const month   = today.getMonth();
  const calDays = [];
  const first   = new Date(year, month, 1);
  const last    = new Date(year, month + 1, 0);
  for (let i = 0; i < first.getDay(); i++) calDays.push(null);
  for (let d = 1; d <= last.getDate(); d++) calDays.push(d);

  const isMonday  = today.getDay() === 1;
  const showBrief = briefingOpen && briefing?.briefing_data && (isMonday || !briefing.is_read);

  const postsThisMonth = allPosts.filter(p => {
    const dt = new Date(p.scheduled_date || p.created_at);
    return dt.getFullYear() === year && dt.getMonth() === month;
  });
  const getPostsForDay = d => postsThisMonth.filter(p =>
    new Date(p.scheduled_date || p.created_at).getDate() === d
  );

  // Loading handled inline with skeleton cards — no full-page spinner needed

  const bd = briefing?.briefing_data;

  const filteredUpcoming = upcomingFilter === 'all'
    ? upcoming
    : upcoming.filter(p => parsePlatforms(p.platforms).includes(upcomingFilter));

  return (
    <>
      <Layout
        title="Dashboard"
        subtitle={today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => router.push('/wizard')}>
              <IpSparkle size={14} color="url(#brand-gradient)" /> Post Wizard
            </Button>
            <Button variant="primary" onClick={() => router.push('/upload')}>
              <IpPlus size={14} strokeWidth={2.5} /> Upload
            </Button>
          </div>
        }
      >

        {/* ── 0. First-time user welcome banner ── */}
        {!loading && allPosts.length === 0 && (
          <div style={{ background: `linear-gradient(135deg, ${t.primary}18 0%, ${t.primaryHover}10 100%)`, border: `1px solid ${t.primaryBorder}`, borderRadius: 16, padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 6 }}>Welcome — let's make your first post</div>
              <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 460 }}>You have 10 free credits. A photo post takes under 2 minutes — pick what happened today and we'll write the caption and create the image.</div>
            </div>
            <Button variant="primary" onClick={() => router.push('/quick-post')} style={{ whiteSpace: 'nowrap', padding: '12px 24px', fontSize: 14, fontWeight: 700 }}>
              <IpSparkle size={14} color="#fff" /> Make your first post
            </Button>
          </div>
        )}

        {/* ── 1. PostCore Briefing Banner ── */}
        {showBrief && bd && (
          <div style={{ background: t.card, border: `1px solid ${t.primaryBorder}`, borderRadius: 14, padding: 20, marginBottom: 20, position: 'relative' }}>
            <button onClick={dismissBriefing} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 7, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IpClose size={13} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${t.primary},${t.primaryHover})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IpSparkle size={16} color="#fff" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{bd.greeting}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{bd.weekSummary}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(2, bd.sections?.length || 1)}, 1fr)`, gap: 10 }}>
              {(bd.sections || []).slice(0, 2).map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{s.observation}</div>
                  {s.action && (
                    <button onClick={() => router.push('/wizard')} style={{ fontSize: 11, fontWeight: 700, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {s.actionLabel || 'Create a Post'} →
                    </button>
                  )}
                </div>
              ))}
            </div>
            {bd.closingNote && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 12, fontStyle: 'italic' }}>{bd.closingNote}</div>}
          </div>
        )}

        {/* ── 2. Business Metrics Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 16 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={86} borderRadius={12} />)
          ) : (<>
            <MetricCard t={t}
              label="People Reached"
              main={fmt(metrics?.totalReach)}
              sub={metrics ? `~${fmt(metrics.estimatedLocalReach)} local people` : 'No data yet'}
            />
            <MetricCard t={t}
              label="Engagement Rate"
              main={metrics ? `${metrics.engagementRate}%` : '—'}
              sub={metrics
                ? (metrics.isOutperforming
                    ? `Top ${100 - metrics.percentileRank}% in industry`
                    : `Industry avg ${metrics.industryAvgEngagement}%`)
                : 'Post to see data'}
              subColor={metrics?.isOutperforming ? t.success : t.warning}
            />
            <div style={{ background: metrics?.postingStreak >= 3 ? 'rgba(234,179,8,0.07)' : t.card, border: `1px solid ${metrics?.postingStreak >= 3 ? 'rgba(234,179,8,0.28)' : t.border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 6 }}>Posting Streak</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: metrics?.postingStreak >= 3 ? '#EAB308' : t.text, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {metrics?.postingStreak >= 3 && <IpFlame size={20} color="#EAB308" />}
                {metrics?.postingStreak ? `${metrics.postingStreak} days` : '—'}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                {metrics?.postingStreak ? 'Keep posting to grow reach' : 'Post today to start'}
              </div>
            </div>
            {/* GEO Score card */}
            <div
              onClick={() => router.push('/geo-audit')}
              style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'background 150ms' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = t.card)}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 6 }}>Search Visibility</div>
              {geoScore && geoScore.score > 0 ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 3, color: geoScore.score >= 70 ? t.success : geoScore.score >= 40 ? t.warning : t.error }}>
                    {geoScore.score}<span style={{ fontSize: 14, color: t.textMuted, fontWeight: 500 }}>/100</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.primary, fontWeight: 600 }}>
                    See how to improve →
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 3 }}>—</div>
                  <div style={{ fontSize: 11, color: t.primary, fontWeight: 600 }}>
                    {geoScore?.freeAuditUsed ? 'Check your score →' : 'Get your free score →'}
                  </div>
                </>
              )}
            </div>
          </>)}
        </div>

        {metrics && (
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IpInfo size={11} /> {metrics.disclaimer}
          </div>
        )}

        {/* ── 3. Content Health Bar ── */}
        {contentMix && <ContentHealthBar data={contentMix} t={t} router={router} />}

        {/* ── 4. Calendar + Upcoming ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
          <Card>
            <SectionHeader
              icon={IpCalendar}
              title={`${today.toLocaleString('default', { month: 'long' })} ${year}`}
              action={<Button variant="secondary" size="sm" onClick={() => router.push('/calendar')}>Full calendar</Button>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>)}
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const isToday = day === today.getDate();
                const dp = getPostsForDay(day);
                return (
                  <div key={idx} onClick={() => router.push('/calendar')}
                    style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 6, cursor: 'pointer', background: isToday ? t.primaryBg : 'transparent', border: isToday ? `1px solid ${t.primaryBorder}` : '1px solid transparent' }}>
                    <span style={{ fontSize: 12, color: isToday ? t.primary : t.textSecondary, fontWeight: isToday ? 700 : 400 }}>{day}</span>
                    {dp.length > 0 && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {dp.slice(0, 3).map((p, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: TYPE_COLOR[p.content_type] || t.primary }} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IpSchedule size={15} color="url(#brand-gradient)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Upcoming posts</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>Next 30 days</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={upcomingFilter}
                    onChange={e => setUpcomingFilter(e.target.value)}
                    style={{ fontSize: 12, background: t.input, color: t.text, border: `1px solid ${t.border}`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="all">All platforms</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="google_business">Google Business</option>
                  </select>
                  {upcoming.length > 0 && (
                    <button onClick={() => router.push('/history?filter=scheduled')} style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      View all <IpArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {filteredUpcoming.length === 0 ? (
              upcoming.length === 0 ? (
                <EmptyState icon={IpCalendar} title="Nothing scheduled yet"
                  subtitle="Posting 3× a week gets local businesses 5× more reach. Let's schedule your first one."
                  action={<Button variant="primary" size="sm" onClick={() => router.push('/wizard')}><IpSparkle size={12} /> Create a Post</Button>} />
              ) : (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                  No scheduled posts for this platform.
                </div>
              )
            ) : (
              <div>
                {filteredUpcoming.slice(0, 4).map(post => {
                  const TI = TYPE_ICON[post.content_type] || IpDrafts;
                  const tc = TYPE_COLOR[post.content_type] || t.primary;
                  const pp = parsePlatforms(post.platforms);
                  const fmtLabel = post.content_type === 'static' ? 'TEXT' : (post.content_type || '').toUpperCase();
                  return (
                    <div key={post.id} onClick={() => setPreviewPostId(post.id)}
                      style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.cardHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {post.media_url
                          ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} />
                          : <TI size={22} style={{ color: tc, opacity: 0.5 }} />}
                        <div style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 8, fontWeight: 800, background: 'rgba(0,0,0,0.62)', color: '#fff', borderRadius: 3, padding: '1px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {fmtLabel}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                          {pp.slice(0, 3).map(pid => {
                            const pm = PLAT_ICONS[pid];
                            if (pm) { const PI = pm.icon; return <PI key={pid} size={12} style={{ color: pm.color }} />; }
                            if (pid === 'linkedin')  return <IpLinkedIn key={pid} size={12} style={{ color: '#0A66C2' }} />;
                            if (pid === 'tiktok')    return <IpTikTok   key={pid} size={12} style={{ color: '#010101' }} />;
                            return null;
                          })}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || 'No text preview'}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{format(new Date(post.scheduled_date), 'MMM d, h:mm a')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </Layout>

      {showTour && (
        <DashboardTour
          onClose={() => { localStorage.setItem('tour_done', '1'); setShowTour(false); }}
          router={router}
        />
      )}

      {previewPostId && upcoming.find(p => p.id === previewPostId) && (
        <PostPreviewModal
          post={upcoming.find(p => p.id === previewPostId)}
          allPosts={upcoming}
          onClose={() => setPreviewPostId(null)}
          onNavigate={setPreviewPostId}
          onUpdate={updated => setUpcoming(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onDelete={id => { setUpcoming(prev => prev.filter(p => p.id !== id)); setPreviewPostId(null); }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function MetricCard({ t, label, main, sub, subColor, disclaimer }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {disclaimer && <IpInfo size={11} style={{ color: t.textDisabled }} title="Estimate based on industry averages" />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', marginBottom: 3 }}>{main}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || t.textMuted }}>{sub}</div>}
    </div>
  );
}

const TARGET_MIX = [
  { key: 'educational', label: 'How-to Tips',    color: '#3B82F6', target: 70 },
  { key: 'socialProof', label: 'Customer Wins',  color: '#22C55E', target: 20 },
  { key: 'promotional', label: 'Special Offers', color: '#EAB308', target: 10 },
];

function ContentHealthBar({ data, t, router }) {
  if (!data) return null;
  const { mix, recommendation, gaps } = data;
  const total = Object.values(mix).reduce((s, v) => s + v, 0);

  if (!total) {
    return (
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Content Balance</div>
        <div style={{ height: 7, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 8 }}>
          {TARGET_MIX.map(s => <div key={s.key} style={{ width: `${s.target}%`, background: s.color, opacity: 0.35 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
          {TARGET_MIX.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: t.textMuted }}>{s.label} {s.target}%</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>Post a few times and we'll show whether your content mix is on track</div>
      </div>
    );
  }

  const allSegments = [
    { key: 'educational', label: 'How-to Tips',    color: '#3B82F6', target: 70 },
    { key: 'socialProof', label: 'Customer Wins',  color: '#22C55E', target: 20 },
    { key: 'promotional', label: 'Special Offers', color: '#EAB308', target: 10 },
  ];
  const segments = allSegments.filter(s => mix[s.key] > 0);

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>Content Balance — last 30 posts</div>
        {gaps.length > 0 && (
          <button onClick={() => router.push('/wizard')} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Fix balance →
          </button>
        )}
      </div>
      <div style={{ height: 7, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 8 }}>
        {segments.map(s => <div key={s.key} style={{ width: `${mix[s.key]}%`, background: s.color, transition: 'width 400ms ease' }} title={`${s.label}: ${mix[s.key]}%`} />)}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: (gaps.length || recommendation) ? 8 : 0 }}>
        {allSegments.map(s => {
          const actual = mix[s.key] || 0;
          const off = actual < s.target - 10 || actual > s.target + 10;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, opacity: actual ? 1 : 0.3 }} />
              <span style={{ fontSize: 11, color: off ? s.color : t.textMuted, fontWeight: off ? 600 : 400 }}>
                {s.label} {actual}%<span style={{ opacity: 0.5 }}> / {s.target}%</span>
              </span>
            </div>
          );
        })}
      </div>
      {recommendation && (
        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>
          <span style={{ color: t.primary, fontWeight: 600 }}>Tip: </span>{recommendation}
        </div>
      )}
    </div>
  );
}

const TOUR_STEPS = [
  {
    iconBg: 'rgba(124,92,252,0.15)',
    iconColor: '#9B4FD4',
    Icon: IpSparkle,
    title: 'Meet PostCore, your AI advisor',
    body: 'PostCore learns your trade, your season, and your location — then writes social posts that actually sound like you. No blank boxes, no guessing what to say.',
  },
  {
    iconBg: 'rgba(196,75,184,0.15)',
    iconColor: '#C44BB8',
    Icon: IpPlus,
    title: 'Generate a post in 60 seconds',
    body: 'Tap the + button any time. PostCore asks 3 quick questions and returns 3 ready-to-use variations with images. Tap one, post it. Done.',
  },
  {
    iconBg: 'rgba(59,130,246,0.15)',
    iconColor: '#3B82F6',
    Icon: IpCalendar,
    title: 'Plan your week, post on autopilot',
    body: 'Use the Calendar to schedule posts in advance. Posting 3× a week consistently is proven to get 5× more reach for local businesses.',
  },
  {
    iconBg: 'linear-gradient(135deg,rgba(124,92,252,0.2),rgba(196,75,184,0.2))',
    iconColor: '#C084FC',
    Icon: IpSparkle,
    title: "You've got 10 credits — let's go",
    body: "Start with a before & after photo post — they get the most engagement for trade businesses. Your first post is on us.",
  },
];

function DashboardTour({ onClose, router }) {
  const { t } = useTheme();
  const [step, setStep] = useState(0);

  function dismiss() { onClose(); }
  function next() { if (step < TOUR_STEPS.length - 1) setStep(s => s + 1); }
  function goCreate() { onClose(); router.push('/wizard?onboarding=true'); }

  const { iconBg, iconColor, Icon, title, body } = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 20, padding: '32px 28px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: i === step ? 2 : 1, borderRadius: 3,
              background: i <= step
                ? 'linear-gradient(90deg, #9B4FD4, #C44BB8)'
                : t.border,
              transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Icon size={32} style={{ color: iconColor }} />
        </div>

        {/* Text */}
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: t.text, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
          {body}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={dismiss}
            style={{
              padding: '10px 16px', background: 'transparent',
              border: `1px solid ${t.border}`, borderRadius: 10,
              color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Skip tour
          </button>
          <button
            onClick={isLast ? goCreate : next}
            style={{
              padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #9B4FD4 0%, #C44BB8 100%)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(155,79,212,0.35)',
            }}
          >
            {isLast ? 'Create my first post →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

