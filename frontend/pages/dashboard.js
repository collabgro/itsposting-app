import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IpCalendar, IpSchedule, IpSparkle, IpPlus,
  IpTrendingUp, IpTrendingDown,
  IpDrafts, IpPhoto, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGlobe, IpLinkedIn, IpTikTok,
  IpArrowRight, IpFlame, IpTeam, IpAnalytics,
  IpClose, IpInfo, IpCheck, IpCheckCircle, IpSettings,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, SectionHeader, EmptyState, Spinner, Skeleton } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, intelligenceAPI, geoAPI, analyticsAPI, socialAPI } from '../lib/api';
import { format } from 'date-fns';
import PostPreviewModal from '../components/PostPreviewModal';
import { setMascotMood } from '../components/PostCoreMascot';

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
  const [reviews,        setReviews]        = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [generatingReviewId, setGeneratingReviewId] = useState(null);

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

      // Mascot mood from dashboard state
      const postedCount = posts.filter(p => p.status === 'posted').length;
      const streak = m.data?.postingStreak || 0;
      if (postedCount === 0) {
        setMascotMood('excited', "Welcome! Let's create your very first post.");
      } else if (streak >= 7) {
        setMascotMood('celebrating', `${streak}-day streak — you're on fire!`);
      } else if (streak >= 3) {
        setMascotMood('happy', `${streak}-day streak! Keep it going.`);
      } else if (m.data?.isOutperforming) {
        setMascotMood('happy', "You're outperforming businesses your size — nice work!");
      }

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

  const loadReviews = () => {
    setReviewsLoading(true);
    socialAPI.getReviews().then(res => {
      setReviews((res.data?.reviews || []).slice(0, 3));
    }).catch(() => setReviews([])).finally(() => setReviewsLoading(false));
  };

  const handleTurnReviewIntoPost = async (review) => {
    setGeneratingReviewId(review.id);
    setMascotMood('thinking', 'Turning that 5-star review into a post...');
    try {
      const res = await socialAPI.generateReviewPost({
        reviewText: review.text,
        reviewerName: review.reviewerName,
        starRating: review.starRating,
      });
      const { caption, suggestedHashtags } = res.data;
      sessionStorage.setItem('uploadPrefill', JSON.stringify({ caption, hashtags: suggestedHashtags }));
      setMascotMood('celebrating', 'Review turned into a caption — ready to post!');
      router.push('/upload');
    } catch { /* silently fail */ }
    finally { setGeneratingReviewId(null); }
  };

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
          <div style={{ fontSize: 15, color: t.error }}>Failed to load dashboard data.</div>
          <button onClick={loadDashboard} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: t.primary, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
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
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: t.isDark
              ? 'linear-gradient(135deg, rgba(124,92,252,0.22) 0%, rgba(0,196,204,0.10) 60%, rgba(124,92,252,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(0,196,204,0.07) 60%, rgba(124,92,252,0.05) 100%)',
            border: `1px solid ${t.primaryBorder}`,
            borderRadius: 20, padding: '28px 32px', marginBottom: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
            boxShadow: '0 8px 32px rgba(124,92,252,0.12)',
          }}>
            {/* Corner glow orbs */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(0,196,204,0.12)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(124,92,252,0.15)', filter: 'blur(35px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#7C5CFC,#00C4CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(124,92,252,0.45)' }}>
                  <IpSparkle size={17} color="#fff" />
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>Welcome — let's make your first post</div>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 480, lineHeight: 1.6 }}>You have 10 free credits. A photo post takes under 2 minutes — pick what happened today and PostCore will write the caption and create the image.</div>
            </div>
            <Button shimmer variant="primary" onClick={() => router.push('/quick-post')} style={{ position: 'relative', zIndex: 1, whiteSpace: 'nowrap', padding: '13px 26px', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
              <IpSparkle size={14} color="#fff" /> Make your first post
            </Button>
          </div>
        )}

        {/* ── 0b. Quick Actions ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { icon: IpSparkle, label: 'Post for today',     sub: 'AI generates it',       color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)', path: '/quick-post' },
              { icon: IpCalendar, label: 'Schedule week',     sub: 'Plan ahead',             color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  path: '/calendar' },
              { icon: IpAnalytics, label: 'My performance',   sub: 'See what\'s working',    color: '#10B981', bg: 'rgba(16,185,129,0.10)', path: '/analytics' },
              { icon: IpSettings, label: 'Connect accounts',  sub: 'FB, IG, Google',         color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  path: '/settings' },
            ].map(q => (
              <div
                key={q.label}
                onClick={() => router.push(q.path)}
                style={{
                  background: q.bg,
                  border: `1px solid ${q.color}30`,
                  borderRadius: 14, padding: '14px 16px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${q.color}25`; e.currentTarget.style.borderColor = `${q.color}55`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${q.color}30`; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${q.color}20`, border: `1px solid ${q.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <q.icon size={16} color={q.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{q.label}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{q.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 0c. Activation Checklist ── */}
        {!loading && <ActivationChecklist allPosts={allPosts} upcoming={upcoming} geoScore={geoScore} t={t} router={router} />}

        {/* ── 1. PostCore Briefing Banner ── */}
        {showBrief && bd && (
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(24px) saturate(180%)',
            border: `1px solid ${t.isDark ? 'rgba(0,196,204,0.25)' : 'rgba(0,196,204,0.35)'}`,
            borderLeft: '3.5px solid #00C4CC',
            borderRadius: 18, padding: 22, marginBottom: 22,
            boxShadow: t.isDark
              ? '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 4px 20px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}>
            {/* teal ambient glow */}
            <div style={{ position: 'absolute', top: -30, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(0,196,204,0.12)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <button
              onClick={dismissBriefing}
              style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 120ms, border-color 120ms', zIndex: 2 }}
              onMouseEnter={e => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.borderStrong; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.input; e.currentTarget.style.borderColor = t.border; }}
            >
              <IpClose size={12} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative', zIndex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#00C4CC,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,196,204,0.4)' }}>
                <IpSparkle size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{bd.greeting}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>{bd.weekSummary}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(2, bd.sections?.length || 1)}, 1fr)`, gap: 10, position: 'relative', zIndex: 1 }}>
              {(bd.sections || []).slice(0, 2).map((s, i) => (
                <div key={i} style={{
                  padding: '13px 15px',
                  background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${t.border}`, borderRadius: 12,
                  transition: 'border-color 150ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = t.primaryBorder}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#00C4CC', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.55, marginBottom: s.action ? 8 : 0 }}>{s.observation}</div>
                  {s.action && (
                    <button onClick={() => router.push('/wizard')} style={{ fontSize: 11, fontWeight: 700, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {s.actionLabel || 'Create a Post'} <IpArrowRight size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {bd.closingNote && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 12, fontStyle: 'italic', position: 'relative', zIndex: 1 }}>{bd.closingNote}</div>}
          </div>
        )}

        {/* ── 2. Business Metrics Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 8 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={104} borderRadius={18} />)
          ) : (<>
            <MetricCard t={t} accent="info"
              label="People Reached"
              main={fmt(metrics?.totalReach)}
              sub={metrics ? `~${fmt(metrics.estimatedLocalReach)} local people` : 'No data yet'}
            />
            <MetricCard t={t} accent={metrics?.isOutperforming ? 'success' : 'warning'}
              label="Engagement Rate"
              main={metrics ? `${metrics.engagementRate}%` : '—'}
              sub={metrics
                ? (metrics.isOutperforming
                    ? `Top ${100 - metrics.percentileRank}% in industry`
                    : `Industry avg ${metrics.industryAvgEngagement}%`)
                : 'Post to see data'}
            />
            {/* Streak card */}
            <div style={{
              background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
              backdropFilter: 'blur(16px) saturate(160%)',
              WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: `1px solid ${metrics?.postingStreak >= 3 ? 'rgba(234,179,8,0.4)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
              borderLeft: `3px solid ${metrics?.postingStreak >= 3 ? '#EAB308' : t.isDark ? 'rgba(255,255,255,0.15)' : t.border}`,
              borderRadius: 18, padding: 22,
              boxShadow: metrics?.postingStreak >= 3
                ? `${t.shadowSm}, 0 0 16px rgba(234,179,8,0.18), inset 0 1px 0 rgba(255,255,255,0.04)`
                : `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
              position: 'relative', overflow: 'hidden',
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = t.shadowMd; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `${t.isDark ? t.shadowSm : t.shadowSm}, inset 0 1px 0 rgba(255,255,255,0.04)`; }}
            >
              {metrics?.postingStreak >= 3 && (
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: '#EAB308', opacity: 0.07, pointerEvents: 'none' }} />
              )}
              <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 10, letterSpacing: '-0.01em' }}>Posting Streak</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: metrics?.postingStreak >= 3 ? '#EAB308' : t.text, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                {metrics?.postingStreak >= 3 && <IpFlame size={22} color="#EAB308" />}
                {metrics?.postingStreak ? `${metrics.postingStreak}d` : '—'}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                {metrics?.postingStreak ? 'Keep posting to grow reach' : 'Post today to start your streak'}
              </div>
            </div>
            {/* GEO / AI Visibility card */}
            <div
              onClick={() => router.push('/geo-audit')}
              style={{
                background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
                backdropFilter: 'blur(16px) saturate(160%)',
                WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                borderLeft: `3px solid ${geoScore?.score > 0 ? (geoScore.score >= 70 ? '#22C55E' : geoScore.score >= 40 ? '#F59E0B' : '#EF4444') : t.primary}`,
                borderRadius: 18, padding: 22,
                boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `${t.shadowMd}, 0 0 20px rgba(124,92,252,0.15)`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`; }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: t.primary, opacity: 0.06, pointerEvents: 'none' }} />
              <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 10, letterSpacing: '-0.01em' }}>AI Visibility</div>
              {geoScore && geoScore.score > 0 ? (
                <>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 7, color: geoScore.score >= 70 ? t.success : geoScore.score >= 40 ? t.warning : t.error }}>
                    {geoScore.score}<span style={{ fontSize: 14, color: t.textMuted, fontWeight: 500, letterSpacing: 0 }}>/100</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                    See how to improve <IpArrowRight size={10} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: t.text, marginBottom: 7 }}>—</div>
                  <div style={{ fontSize: 11, color: t.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {geoScore?.freeAuditUsed ? 'Check your score' : 'Get your free score'} <IpArrowRight size={10} />
                  </div>
                </>
              )}
            </div>
          </>)}
        </div>

        {metrics && (
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IpInfo size={11} /> {metrics.disclaimer}
          </div>
        )}

        {/* ── 3. Content Health Bar ── */}
        {contentMix && <ContentHealthBar data={contentMix} t={t} router={router} />}

        {/* ── 3b. Share a Review card ── */}
        <div style={{ marginTop: 0, padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(234,179,8,0.08) 100%)',
                border: '1px solid rgba(234,179,8,0.3)',
                boxShadow: '0 4px 12px rgba(234,179,8,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>⭐</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>Share a Review</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>Turn 5-star reviews into posts with one click</div>
              </div>
            </div>
            {reviews === null && (
              <Button variant="secondary" size="sm" onClick={loadReviews} disabled={reviewsLoading}>
                {reviewsLoading ? 'Loading…' : 'Load Reviews'}
              </Button>
            )}
          </div>
          {reviews === null ? (
            <div style={{ fontSize: 12, color: t.textMuted, padding: '6px 0' }}>
              Load your most recent Google reviews and convert any of them into a ready-to-post caption.
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ fontSize: 12, color: t.textMuted }}>No reviews found. Make sure your Google Business account is connected in Settings.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(review => (
                <div
                  key={review.id}
                  style={{ padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}`, transition: 'border-color 150ms, box-shadow 150ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.borderStrong; e.currentTarget.style.boxShadow = t.shadowSm; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{review.reviewerName}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#EAB308' }}>{'⭐'.repeat(review.starRating)}</span>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleTurnReviewIntoPost(review)} disabled={generatingReviewId === review.id} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {generatingReviewId === review.id ? 'Generating…' : 'Turn into Post →'}
                    </Button>
                  </div>
                  {review.text && <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, maxHeight: 56, overflow: 'hidden', WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{review.text}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. Calendar + Upcoming ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginTop: 4 }}>
          <div style={{ padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
            <SectionHeader
              icon={IpCalendar}
              title={`${today.toLocaleString('default', { month: 'long' })} ${year}`}
              action={<Button variant="secondary" size="sm" onClick={() => router.push('/calendar')}>Full calendar</Button>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                <div key={i} style={{ fontSize: 9, color: t.textMuted, textAlign: 'center', padding: '0 0 8px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d}</div>
              ))}
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const isToday = day === today.getDate();
                const dp = getPostsForDay(day);
                return (
                  <div key={idx} onClick={() => router.push('/calendar')}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 3,
                      borderRadius: 8, cursor: 'pointer',
                      background: isToday
                        ? `linear-gradient(135deg, rgba(124,92,252,0.22) 0%, rgba(124,92,252,0.12) 100%)`
                        : 'transparent',
                      border: isToday ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                      boxShadow: isToday ? '0 0 0 3px rgba(124,92,252,0.1)' : 'none',
                      transition: 'background 120ms, border-color 120ms, box-shadow 120ms',
                    }}
                    onMouseEnter={(e) => { if (!isToday) { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.borderStrong; } }}
                    onMouseLeave={(e) => { if (!isToday) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
                  >
                    <span style={{ fontSize: 11, color: isToday ? t.primary : t.textSecondary, fontWeight: isToday ? 800 : 400, lineHeight: 1 }}>{day}</span>
                    {dp.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {dp.slice(0, 3).map((p, i) => (
                          <div key={i} style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: TYPE_COLOR[p.content_type] || t.primary,
                            boxShadow: `0 0 3px ${TYPE_COLOR[p.content_type] || t.primary}`,
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11,
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.2) 0%, rgba(124,92,252,0.08) 100%)',
                    border: `1px solid ${t.primaryBorder}`,
                    boxShadow: '0 3px 10px rgba(124,92,252,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IpSchedule size={16} color={t.primary} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Upcoming posts</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>Next 30 days</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={upcomingFilter}
                    onChange={e => setUpcomingFilter(e.target.value)}
                    style={{ fontSize: 12, background: t.input, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="all">All platforms</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="google_business">Google Business</option>
                  </select>
                  {upcoming.length > 0 && (
                    <button onClick={() => router.push('/history?filter=scheduled')} style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      View all <IpArrowRight size={11} />
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
                      style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', alignItems: 'center', transition: 'background 120ms ease' }}
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
          </div>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes checkpop{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.2) rotate(4deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}`}</style>
    </>
  );
}

function MetricCard({ t, label, main, sub, subColor, accent = 'primary' }) {
  const accentColors = { primary: t.primary, info: t.info || '#3B82F6', success: t.success || '#22C55E', warning: t.warning || '#F59E0B' };
  const col = accentColors[accent] || t.primary;
  return (
    <div
      style={{
        background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
        borderLeft: `3px solid ${col}`,
        borderRadius: 18, padding: 22,
        boxShadow: `${t.shadowSm}, 0 0 12px ${col}18, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
        transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `${t.shadowMd}, 0 0 20px ${col}25`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `${t.shadowSm}, 0 0 12px ${col}18, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`; }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: col, opacity: 0.07, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginBottom: 10, letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: col, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 7, textShadow: `0 0 20px ${col}40` }}>{main}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || col, fontWeight: 500 }}>{sub}</div>}
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
  const allSegments = [
    { key: 'educational', label: 'How-to Tips',    color: '#3B82F6', target: 70 },
    { key: 'socialProof', label: 'Customer Wins',  color: '#22C55E', target: 20 },
    { key: 'promotional', label: 'Special Offers', color: '#EAB308', target: 10 },
  ];

  const glassContentBar = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 18, padding: '18px 22px', marginBottom: 22,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  if (!total) {
    return (
      <div style={glassContentBar}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12, letterSpacing: '-0.02em' }}>Content Balance</div>
        <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 12 }}>
          {allSegments.map(s => <div key={s.key} style={{ width: `${s.target}%`, background: s.color, opacity: 0.3, borderRadius: 99 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          {allSegments.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: t.textMuted }}>{s.label} <span style={{ opacity: 0.7 }}>target {s.target}%</span></span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>Post a few times and PostCore will track whether your content mix is on target.</div>
      </div>
    );
  }

  const segments = allSegments.filter(s => mix[s.key] > 0);

  return (
    <div style={glassContentBar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>Content Balance <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, letterSpacing: 0 }}>— last 30 posts</span></div>
        {gaps.length > 0 && (
          <button onClick={() => router.push('/wizard')} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
            Fix balance <IpArrowRight size={10} />
          </button>
        )}
      </div>
      <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 12 }}>
        {segments.map(s => (
          <div key={s.key} style={{
            width: `${mix[s.key]}%`, background: s.color,
            transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)', borderRadius: 99,
          }} title={`${s.label}: ${mix[s.key]}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: (gaps.length || recommendation) ? 12 : 0 }}>
        {allSegments.map(s => {
          const actual = mix[s.key] || 0;
          const off = actual < s.target - 10 || actual > s.target + 10;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, opacity: actual ? 1 : 0.3 }} />
              <span style={{ fontSize: 11, color: off ? s.color : t.textMuted, fontWeight: off ? 700 : 400 }}>
                {s.label} <span style={{ fontWeight: 700 }}>{actual}%</span>
                <span style={{ opacity: 0.45 }}> / {s.target}%</span>
              </span>
            </div>
          );
        })}
      </div>
      {recommendation && (
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.55 }}>
          <span style={{ color: t.primary, fontWeight: 700 }}>PostCore: </span>{recommendation}
        </div>
      )}
    </div>
  );
}

function ActivationChecklist({ allPosts, upcoming, geoScore, t, router }) {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const postedCount = allPosts.filter(p => p.status === 'posted').length;

  const STEPS = [
    {
      id: 'first_post',
      label: 'Create your first post',
      sub: 'Use the Post Wizard or Quick Post',
      done: postedCount > 0,
      action: () => router.push('/quick-post'),
      cta: 'Create now',
    },
    {
      id: 'connect_social',
      label: 'Connect a social account',
      sub: 'Facebook, Instagram, or Google Business',
      done: typeof window !== 'undefined' && !!localStorage.getItem('ip_social_connected'),
      action: () => router.push('/settings'),
      cta: 'Connect',
    },
    {
      id: 'schedule_post',
      label: 'Schedule a post for this week',
      sub: 'Plan ahead — consistency drives reach',
      done: upcoming.length > 0,
      action: () => router.push('/calendar'),
      cta: 'Schedule',
    },
    {
      id: 'knowledge_base',
      label: 'Add 3 entries to your Knowledge Base',
      sub: 'Services, FAQs, pricing — PostCore uses this',
      done: typeof window !== 'undefined' && !!localStorage.getItem('ip_kb_done'),
      action: () => router.push('/knowledge-base'),
      cta: 'Add now',
    },
    {
      id: 'geo_audit',
      label: 'Run your free AI Visibility check',
      sub: 'See how your business ranks in AI search',
      done: !!(geoScore?.score > 0),
      action: () => router.push('/geo-audit'),
      cta: geoScore?.freeAuditUsed ? 'View results' : 'Free check',
    },
  ];

  const completedCount = STEPS.filter(s => s.done).length;
  const allDone = completedCount === STEPS.length;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const d = localStorage.getItem('ip_checklist_dismissed');
    if (d) setDismissed(true);
  }, []);

  if (dismissed || allDone) return null;

  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div style={{
      background: t.isDark ? 'rgba(15,15,24,0.75)' : t.card,
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
      borderLeft: '3px solid #7C5CFC',
      borderRadius: 16, marginBottom: 22,
      boxShadow: `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
              Get set up
            </span>
            <div style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(124,92,252,0.15)', color: '#7C5CFC', border: '1px solid rgba(124,92,252,0.25)',
            }}>
              {completedCount}/{STEPS.length}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ flex: 1, maxWidth: 160, height: 4, borderRadius: 2, background: t.isDark ? 'rgba(255,255,255,0.08)' : t.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7C5CFC,#00C4CC)', borderRadius: 2, transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
          <span style={{ fontSize: 11, color: t.textMuted }}>{pct}% complete</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); localStorage.setItem('ip_checklist_dismissed', '1'); setDismissed(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: t.textMuted, display: 'flex', alignItems: 'center' }}
          >
            <IpClose size={13} />
          </button>
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div style={{ borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}` }}>
          {STEPS.map((step, i) => (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
              borderBottom: i < STEPS.length - 1 ? `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : t.border}` : 'none',
              opacity: step.done ? 0.6 : 1,
            }}>
              {/* Check circle */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: step.done ? 'rgba(34,197,94,0.15)' : (t.isDark ? 'rgba(255,255,255,0.04)' : t.input),
                border: `1px solid ${step.done ? 'rgba(34,197,94,0.4)' : (t.isDark ? 'rgba(255,255,255,0.1)' : t.border)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: step.done ? 'checkpop 300ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              }}>
                {step.done && <IpCheck size={11} color="#22C55E" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: step.done ? 500 : 600, color: step.done ? t.textMuted : t.text, letterSpacing: '-0.01em', textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </div>
                {!step.done && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{step.sub}</div>}
              </div>
              {!step.done && (
                <button
                  onClick={step.action}
                  style={{
                    padding: '5px 12px', background: t.primaryBg,
                    border: `1px solid ${t.primaryBorder}`, borderRadius: 7,
                    color: t.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,92,252,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = t.primaryBg}
                >
                  {step.cta} →
                </button>
              )}
            </div>
          ))}

          {/* Footer bonus callout */}
          <div style={{ padding: '10px 18px', background: t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>🎁</span>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              Complete all 5 steps and get <strong style={{ color: t.primary }}>10 bonus credits</strong> added automatically.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const TOUR_STEPS = [
  {
    iconBg: 'rgba(124,92,252,0.15)',
    iconColor: '#7C5CFC',
    Icon: IpSparkle,
    title: 'Meet PostCore, your AI advisor',
    body: 'PostCore learns your trade, your season, and your location — then writes social posts that actually sound like you. No blank boxes, no guessing what to say.',
  },
  {
    iconBg: 'rgba(196,75,184,0.15)',
    iconColor: '#9B7FFF',
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
                ? 'linear-gradient(90deg, #00C4CC, #7C5CFC)'
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
              background: 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
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

