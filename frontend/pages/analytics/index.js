import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpTrendingUp, IpHeart, IpComment, IpShare, IpAnalytics, IpChevronRight,
  IpSchedule, IpSparkle, IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpCalendar, IpInfo, IpCheck, IpRefresh,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, StatCard, SectionHeader, EmptyState, Spinner, SkeletonPage, ErrorCard } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { analyticsAPI } from '../../lib/api';
import { format, addDays } from 'date-fns';

/* ─── constants ──────────────────────────────────────────── */
const DAYS     = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const HOURS    = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const FMT_HOUR = h => { const a = h >= 12 ? 'pm' : 'am'; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}${a}`; };
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const TYPE_META = {
  static:   { label: 'Text Card',  icon: IpDrafts,   color: '#60A5FA' },
  photo:    { label: 'Photo Post', icon: ImageIcon,  color: '#A78BFA' },
  carousel: { label: 'Carousel',   icon: IpCarousel, color: '#F472B6' },
  video:    { label: 'Video',      icon: IpVideo,    color: '#FB923C' },
};

/* ─── helpers ────────────────────────────────────────────── */
function heatColor(score, maxScore) {
  if (!maxScore || score === 0) return null;
  const t = Math.max(0, Math.min(1, score / maxScore));
  return `rgba(124,92,252,${(t * 0.78 + 0.08).toFixed(2)})`;
}

function buildScheduledDate(dow, hour) {
  const today    = new Date();
  const todayDow = today.getDay();
  let daysAhead  = (dow - todayDow + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const target = addDays(today, daysAhead);
  target.setHours(hour, 0, 0, 0);
  return target.toISOString().slice(0, 16);
}

/* ─── MonthPicker ────────────────────────────────────────── */
function EngagementTrendChart({ posts, t, gc }) {
  const W = 600, H = 120, PAD = { top: 12, right: 20, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Build daily buckets for last 30 days
  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toDateString());
  }
  const buckets = {};
  days.forEach(d => { buckets[d] = 0; });
  posts.forEach(p => {
    const dateKey = new Date(p.posted_at || p.created_at).toDateString();
    if (buckets[dateKey] !== undefined) {
      buckets[dateKey] += (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + 1;
    }
  });
  const values = days.map(d => buckets[d]);
  const maxV = Math.max(...values, 1);

  // Build SVG path
  const pts = values.map((v, i) => {
    const x = PAD.left + (i / (values.length - 1)) * chartW;
    const y = PAD.top + chartH - (v / maxV) * chartH;
    return [x, y];
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = [
    `M ${pts[0][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)}`,
    ...pts.map(p => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`),
    `L ${pts[pts.length - 1][0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Trend: compare first half avg vs second half avg
  const half = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const secondAvg = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const trending = secondAvg > firstAvg * 1.1 ? 'up' : secondAvg < firstAvg * 0.9 ? 'down' : 'flat';

  const totalEng = values.reduce((a, b) => a + b, 0);

  // X-axis labels: show first, middle, last
  const xLabels = [
    { i: 0, label: '30d ago' },
    { i: 14, label: '15d ago' },
    { i: 29, label: 'Today' },
  ];

  return (
    <div style={{ ...gc, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
            Engagement trend <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted }}>— last 30 days</span>
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Likes + comments + shares per day across all posts</div>
        </div>
        <div style={{ display: 'flex', align: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: t.text, lineHeight: 1 }}>{totalEng.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>total interactions</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: trending === 'up' ? 'rgba(34,197,94,0.12)' : trending === 'down' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
            color: trending === 'up' ? '#22C55E' : trending === 'down' ? '#EF4444' : t.textMuted,
            border: `1px solid ${trending === 'up' ? 'rgba(34,197,94,0.3)' : trending === 'down' ? 'rgba(239,68,68,0.3)' : t.border}`,
          }}>
            {trending === 'up' ? '↑ Trending up' : trending === 'down' ? '↓ Trending down' : '→ Steady'}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="engAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7C5CFC" stopOpacity={t.isDark ? '0.45' : '0.30'} />
              <stop offset="100%" stopColor="#7C5CFC" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(frac => {
            const y = PAD.top + chartH - frac * chartH;
            return (
              <g key={frac}>
                <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                  stroke={t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}
                  strokeDasharray="3 4" strokeWidth="1" />
                <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fill={t.isDark ? 'rgba(255,255,255,0.3)' : '#8E8E93'}
                  fontSize="9" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif">
                  {Math.round(maxV * frac)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#engAreaGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="#7C5CFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots on non-zero days */}
          {pts.map(([x, y], i) => values[i] > 0 && (
            <circle key={i} cx={x} cy={y} r="3" fill="#7C5CFC" stroke={t.isDark ? '#05050A' : '#fff'} strokeWidth="1.5" />
          ))}

          {/* X axis labels */}
          {xLabels.map(({ i, label }) => (
            <text key={i}
              x={PAD.left + (i / (values.length - 1)) * chartW}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}
              fill={t.isDark ? 'rgba(255,255,255,0.3)' : '#8E8E93'}
              fontSize="9" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif">
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function MonthPicker({ value, onChange }) {
  const { t } = useTheme();
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() });
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: t.input, border: `1px solid ${t.border}`,
        borderRadius: 8, padding: '8px 14px',
        color: t.text, fontSize: 14, cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
      ))}
    </select>
  );
}

/* ─── page ───────────────────────────────────────────────── */
export default function Analytics() {
  const router = useRouter();
  const { t }  = useTheme();

  const [mounted, setMounted]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [overview, setOverview]       = useState(null);
  const [posts, setPosts]             = useState([]);
  const [sort, setSort]               = useState('recent');
  const [period, setPeriod]           = useState('30');
  const [optTimes, setOptTimes]       = useState(null);
  const [contentPerf, setContentPerf] = useState(null);
  const [hoverCell, setHoverCell]     = useState(null);
  const [streak, setStreak]           = useState(null);
  const [contentMix, setContentMix]   = useState(null);
  const [varStats, setVarStats]       = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${n.getMonth()}`;
  });
  const [reportPosts, setReportPosts]     = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Sync metrics state
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadAll();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync tab from URL query
  useEffect(() => {
    if (router.query.tab && ['overview', 'posts', 'monthly'].includes(router.query.tab)) {
      setActiveTab(router.query.tab);
    }
  }, [router.query.tab]);

  useEffect(() => { if (mounted) loadOverview(); }, [period]);
  useEffect(() => { if (mounted) loadPosts(); }, [sort]);

  useEffect(() => {
    if (activeTab !== 'monthly' || !mounted) return;
    loadMonthlyReport();
  }, [activeTab, reportMonth]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    router.push({ pathname: router.pathname, query: { tab } }, undefined, { shallow: true });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [o, p, ot, cp, str, cm, vs, lb] = await Promise.all([
        analyticsAPI.getOverview({ period }),
        analyticsAPI.listPosts({ sort: 'recent' }),
        analyticsAPI.getOptimalTimes(),
        analyticsAPI.getContentPerformance(),
        analyticsAPI.getStreak().catch(() => ({ data: null })),
        analyticsAPI.getContentMix().catch(() => ({ data: null })),
        analyticsAPI.getVariationStats().catch(() => ({ data: null })),
        analyticsAPI.getLeaderboard().catch(() => ({ data: null })),
      ]);
      setOverview(o.data);
      setPosts(Array.isArray(p.data) ? p.data : []);
      setOptTimes(ot.data);
      setContentPerf(cp.data);
      if (str?.data) setStreak(str.data);
      if (cm?.data) setContentMix(cm.data);
      if (vs?.data) setVarStats(vs.data);
      if (lb?.data) setLeaderboard(lb.data);
    } catch (err) { console.error('Analytics load error:', err); }
    finally { setLoading(false); }
  };

  const loadOverview = async () => {
    try { const r = await analyticsAPI.getOverview({ period }); setOverview(r.data); } catch {}
  };

  const loadPosts = async () => {
    try { const r = await analyticsAPI.listPosts({ sort }); setPosts(Array.isArray(r.data) ? r.data : []); } catch {}
  };

  const loadMonthlyReport = async () => {
    setReportLoading(true);
    try {
      const [selYear, selMonth] = reportMonth.split('-').map(Number);
      const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
      const r = await analyticsAPI.listPosts({ limit: 100, period: daysInMonth });
      const all = Array.isArray(r.data) ? r.data : (r.data?.posts || []);
      const filtered = all.filter(p => {
        const d = new Date(p.posted_at || p.created_at);
        return d.getFullYear() === selYear && d.getMonth() === selMonth && p.status === 'posted';
      });
      setReportPosts(filtered);
    } catch { setReportPosts([]); }
    finally { setReportLoading(false); }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      await analyticsAPI.syncMetrics();
      setSyncMsg('Metrics synced');
      // Refresh overview and posts after sync
      await Promise.all([loadOverview(), loadPosts()]);
      setTimeout(() => setSyncMsg(''), 3000);
    } catch {
      setSyncMsg('Sync failed — check your social connections');
      setTimeout(() => setSyncMsg(''), 4000);
    } finally { setSyncing(false); }
  };

  const handleUseTime = (slot) => {
    if (slot?.dow !== undefined && slot?.hour !== undefined) {
      router.push(`/wizard?suggestedTime=${DAYS[slot.dow].toLowerCase()}-${slot.hour}`);
    } else {
      router.push('/wizard');
    }
  };

  if (!mounted) return null;

  const summary = overview?.summary || {};
  const maxCpScore = contentPerf?.byType
    ? Math.max(...contentPerf.byType.map(r => parseFloat(r.avg_score) || 0), 1)
    : 1;

  // Monthly report derived data
  const [selYear, selMonth] = reportMonth.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES[selMonth]} ${selYear}`;

  const bestPost = reportPosts.reduce((best, p) => {
    const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
    const bEng = (best?.likes || 0) + (best?.comments || 0) + (best?.shares || 0);
    return eng > bEng ? p : best;
  }, null);

  const typeCounts = {};
  reportPosts.forEach(p => { typeCounts[p.content_type] = (typeCounts[p.content_type] || 0) + 1; });

  const dowCounts = Array(7).fill(0);
  reportPosts.forEach(p => { const d = new Date(p.posted_at || p.created_at); dowCounts[d.getDay()]++; });
  const bestDowIdx = dowCounts.indexOf(Math.max(...dowCounts));

  const totalEng = reportPosts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0);
  const totalReach = reportPosts.reduce((s, p) => s + (parseInt(p.reach) || 150), 0);

  const TAB_DEFS = [
    { id: 'overview', label: 'Overview' },
    { id: 'posts',    label: 'Posts' },
    { id: 'monthly',  label: 'Monthly Report' },
  ];

  const gc = {
    padding: '20px',
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  return (
    <>
      <Layout
        title="Analytics"
        subtitle="Track performance and find the best times to post"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Sync button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {syncMsg && (
                <span style={{ fontSize: 12, color: syncMsg.includes('failed') ? t.error : t.success, fontWeight: 600 }}>
                  {syncMsg}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Pull real engagement data from Facebook & Instagram"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: syncing ? t.textMuted : t.text, cursor: syncing ? 'default' : 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { if (!syncing) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; }}
              >
                {syncing ? <Spinner size={12} /> : <IpRefresh size={12} />}
                {syncing ? 'Syncing…' : 'Sync metrics'}
              </button>
            </div>
            {/* Period selector — visible on overview tab */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', gap: 4, padding: 3, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10 }}>
                {[['7','7d'], ['30','30d'], ['90','90d']].map(([val, lbl]) => (
                  <button
                    key={val} onClick={() => setPeriod(val)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, color: period === val ? t.text : t.textMuted, background: period === val ? t.primaryBg : 'transparent', border: period === val ? `1px solid ${t.primaryBorder}` : '1px solid transparent', cursor: 'pointer', transition: 'all 150ms' }}
                  >{lbl}</button>
                ))}
              </div>
            )}
            <Button variant="primary" onClick={() => router.push('/wizard')}>
              <IpSparkle size={13} /> Generate Post
            </Button>
          </div>
        }
      >
        {/* ── TAB BAR ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24, padding: 4,
          background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
          borderRadius: 14, width: 'fit-content',
          boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.05' : '0.9'})`,
        }}>
          {TAB_DEFS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '9px 22px',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? t.primary : t.textSecondary,
                background: activeTab === tab.id ? t.primaryBg : 'transparent',
                border: activeTab === tab.id ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: activeTab === tab.id ? `0 2px 10px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.08)` : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          loading ? (
            <SkeletonPage rows={4} cards={4} />
          ) : (
            <>
              {/* ── STAT CARDS ─────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard label="Posts published" value={parseInt(summary.posted) || 0}       hint={`${parseInt(summary.active_days) || 0} active days`} accent="primary" />
                <StatCard label="Total likes"     value={parseInt(summary.total_likes) || 0}    accent="primary" />
                <StatCard label="Total comments"  value={parseInt(summary.total_comments) || 0} accent="success" />
                <StatCard label="Total shares"    value={parseInt(summary.total_shares) || 0}   accent="warning" />
              </div>

              {/* ── ENGAGEMENT TREND CHART ─────────────────────── */}
              {posts.length > 1 && <EngagementTrendChart posts={posts} t={t} gc={gc} />}

              {/* ── STREAK CARD ────────────────────────────────── */}
              {streak !== null && streak.streak > 0 && (
                <div style={{ ...gc, marginBottom: 24, borderLeft: `4px solid ${streak.isOnFire ? '#F59E0B' : streak.streak >= 3 ? '#22C55E' : t.primary}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: streak.isOnFire ? 'rgba(245,158,11,0.12)' : streak.streak >= 3 ? 'rgba(34,197,94,0.1)' : t.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                      {streak.isOnFire ? '🔥' : streak.streak >= 3 ? '⚡' : '📅'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{streak.label} posting streak</div>
                      <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                        {streak.isOnFire
                          ? "You're on fire! Keep posting daily to maintain your momentum."
                          : streak.streak >= 3
                          ? 'Great consistency! Keep it up to build trust with your audience.'
                          : 'Good start — post tomorrow to grow your streak.'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 42, fontWeight: 800, color: streak.isOnFire ? '#F59E0B' : streak.streak >= 3 ? '#22C55E' : t.primary, lineHeight: 1, fontFamily: 'monospace' }}>{streak.streak}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>day{streak.streak !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CONTENT MIX ────────────────────────────────── */}
              {contentMix && contentMix.totalPosts > 0 && (
                <div style={{ ...gc, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Content Mix <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted }}>· last 30 days</span></div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Target: 30% educational · 25% social proof · 20% seasonal · 25% promotional</div>
                    </div>
                    <div style={{ padding: '5px 12px', borderRadius: 20, background: contentMix.healthScore >= 80 ? 'rgba(34,197,94,0.1)' : contentMix.healthScore >= 55 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${contentMix.healthScore >= 80 ? 'rgba(34,197,94,0.3)' : contentMix.healthScore >= 55 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 13, fontWeight: 700, color: contentMix.healthScore >= 80 ? '#22C55E' : contentMix.healthScore >= 55 ? '#EAB308' : '#EF4444' }}>
                      {contentMix.healthScore}/100
                    </div>
                  </div>

                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your mix</div>
                  <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                    {Object.entries(contentMix.mix).map(([bucket, pct]) => (
                      pct > 0 && (
                        <div key={bucket} style={{ width: `${pct}%`, background: contentMix.bucketColors[bucket], display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 600ms ease', minWidth: pct > 4 ? 'auto' : 0, overflow: 'hidden' }} title={`${contentMix.bucketLabels[bucket]}: ${pct}%`}>
                          {pct > 8 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{pct}%</span>}
                        </div>
                      )
                    ))}
                  </div>

                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</div>
                  <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                    {Object.entries(contentMix.idealMix).map(([bucket, pct]) => (
                      <div key={bucket} style={{ width: `${pct}%`, background: contentMix.bucketColors[bucket], opacity: 0.35, transition: 'width 600ms ease' }} title={`${contentMix.bucketLabels[bucket]} target: ${pct}%`} />
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                    {Object.keys(contentMix.bucketLabels).map(bucket => (
                      <div key={bucket} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: contentMix.bucketColors[bucket], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: t.textMuted }}>
                          {contentMix.bucketLabels[bucket]} <strong style={{ color: t.text }}>{contentMix.mix[bucket]}%</strong> <span style={{ color: t.textMuted }}>(target {contentMix.idealMix[bucket]}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {contentMix.recommendation && contentMix.recommendation !== 'Your content mix is well balanced. Keep it up!' && (
                    <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <IpInfo size={13} style={{ color: '#EAB308', flexShrink: 0, marginTop: 1 }} />
                      <span>{contentMix.recommendation}</span>
                    </div>
                  )}
                  {contentMix.recommendation === 'Your content mix is well balanced. Keep it up!' && (
                    <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <IpCheck size={14} style={{ color: t.success, flexShrink: 0 }} />
                      <span>{contentMix.recommendation}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── POSTCORE STYLE INSIGHT ─────────────────────── */}
              {varStats?.hasData && (
                <div style={{ ...gc, marginBottom: 24, borderLeft: '4px solid #7C5CFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IpSparkle size={18} color="url(#brand-gradient)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>PostCore Learns Your Style</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>Based on {varStats.total} variation choice{varStats.total !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {(['A', 'B', 'C']).map(label => {
                      const choice = varStats.choices.find(c => c.label === label) || { label, count: 0, pct: 0 };
                      const isTop = label === varStats.preferredLabel;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: isTop ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isTop ? 'rgba(124,92,252,0.4)' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: isTop ? '#7C5CFC' : t.textMuted, flexShrink: 0 }}>
                            {label}
                          </div>
                          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${choice.pct}%`, background: isTop ? 'linear-gradient(90deg, #7C5CFC, #5B3FF0)' : 'rgba(255,255,255,0.15)', borderRadius: 4, transition: 'width 600ms ease' }} />
                          </div>
                          <div style={{ fontSize: 12, color: isTop ? t.text : t.textMuted, fontWeight: isTop ? 700 : 400, minWidth: 50, textAlign: 'right' }}>
                            {choice.pct}% <span style={{ color: t.textMuted, fontWeight: 400 }}>({choice.count})</span>
                          </div>
                          {isTop && <div style={{ fontSize: 10, fontWeight: 700, color: '#7C5CFC', background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>preferred</div>}
                        </div>
                      );
                    })}
                  </div>

                  {varStats.styleInsight && (
                    <div style={{ padding: '10px 14px', background: 'rgba(124,92,252,0.07)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 8, fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <IpSparkle size={13} color="#7C5CFC" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{varStats.styleInsight}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── EMPTY STATE ────────────────────────────────── */}
              {!loading && parseInt(summary.posted) === 0 && (
                <div style={{ ...gc, marginBottom: 24 }}>
                  <EmptyState
                    icon={IpTrendingUp}
                    title="No data for this period"
                    subtitle="Publish posts to start building your analytics."
                    action={<Button variant="primary" onClick={() => router.push('/wizard')}><IpSparkle size={13} /> Create a Post</Button>}
                  />
                </div>
              )}

              {/* ── SCHEDULING OPTIMIZER ───────────────────────── */}
              <div style={{ ...gc, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IpSchedule size={18} color="url(#brand-gradient)" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', marginBottom: 3 }}>Scheduling Optimizer</h2>
                      <p style={{ fontSize: 13, color: t.textMuted }}>
                        {optTimes?.hasRealData
                          ? 'Best times derived from your engagement history'
                          : 'Smart defaults — will personalise as your posts accumulate engagement data'}
                      </p>
                    </div>
                  </div>
                  {!optTimes?.hasRealData && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, fontSize: 12, color: t.warning, flexShrink: 0 }}>
                      <IpInfo size={12} /> Industry defaults
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {(optTimes?.recommendations || []).slice(0, 3).map((slot, idx) => (
                    <div
                      key={idx}
                      style={{ padding: 16, border: `2px solid ${idx === 0 ? 'rgba(124,92,252,0.55)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, background: idx === 0 ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : (t.isDark ? 'rgba(255,255,255,0.03)' : t.input), position: 'relative', overflow: 'hidden', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: idx === 0 ? '0 8px 28px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.07)' : `${t.shadowSm}` }}
                    >
                      {idx === 0 && (
                        <div style={{ position: 'absolute', top: 10, right: 10, background: t.primary, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Best
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: idx === 0 ? 'rgba(124,92,252,0.25)' : t.card, border: `1px solid ${idx === 0 ? t.primaryBorder : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: idx === 0 ? t.primary : t.textSecondary }}>
                          {idx + 1}
                        </div>
                        {slot.isDefault
                          ? <span style={{ fontSize: 10, color: t.warning, background: 'rgba(234,179,8,0.1)', padding: '2px 7px', borderRadius: 9, fontWeight: 600 }}>industry avg</span>
                          : <span style={{ fontSize: 10, color: t.success, background: 'rgba(34,197,94,0.1)', padding: '2px 7px', borderRadius: 9, fontWeight: 600 }}>your data</span>}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: '-0.04em', marginBottom: 4 }}>{slot.label}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: 14, minHeight: 36 }}>{slot.reason}</div>
                      {slot.score !== null && (
                        <div style={{ fontSize: 11, color: t.primary, fontFamily: 'monospace', marginBottom: 10 }}>
                          avg {Math.round(slot.score)} engagement · {slot.count} post{slot.count !== 1 ? 's' : ''}
                        </div>
                      )}
                      <button
                        onClick={() => handleUseTime(slot)}
                        style={{ width: '100%', padding: '8px 0', background: idx === 0 ? t.primary : t.card, color: idx === 0 ? '#fff' : t.text, border: `1px solid ${idx === 0 ? 'transparent' : t.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.background = idx === 0 ? '#6849e0' : t.primaryBg; e.currentTarget.style.borderColor = idx === 0 ? 'transparent' : t.primaryBorder; }}
                        onMouseLeave={e => { e.currentTarget.style.background = idx === 0 ? t.primary : t.card; e.currentTarget.style.borderColor = idx === 0 ? 'transparent' : t.border; }}
                      >
                        <IpSparkle size={12} /> Schedule for this slot
                      </button>
                    </div>
                  ))}
                </div>

                {/* HEATMAP */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Engagement heatmap
                    <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted, textTransform: 'none', letterSpacing: 0 }}>— cells with purple tint = better performance</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 580 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${HOURS.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
                        <div />
                        {HOURS.map(h => (
                          <div key={h} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{FMT_HOUR(h)}</div>
                        ))}
                      </div>
                      {DAYS.map((day, dow) => (
                        <div key={day} style={{ display: 'grid', gridTemplateColumns: `52px repeat(${HOURS.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, display: 'flex', alignItems: 'center' }}>{day}</div>
                          {HOURS.map(hour => {
                            const key    = `${dow}-${hour}`;
                            const cell   = optTimes?.grid?.[key];
                            const score  = cell?.score || 0;
                            const count  = cell?.count || 0;
                            const bg     = heatColor(score, optTimes?.maxScore || 0);
                            const isRec  = optTimes?.recommendations?.slice(0, 3).some(r => r.dow === dow && r.hour === hour);
                            const isHov  = hoverCell === key;
                            return (
                              <div
                                key={hour}
                                onMouseEnter={() => setHoverCell(key)}
                                onMouseLeave={() => setHoverCell(null)}
                                onClick={() => isRec && handleUseTime({ dow, hour })}
                                title={count > 0
                                  ? `${DAYS[dow]} ${FMT_HOUR(hour)} · ${count} post${count !== 1 ? 's' : ''} · avg score ${Math.round(score)}`
                                  : isRec ? `${DAYS[dow]} ${FMT_HOUR(hour)} · Recommended — click to schedule` : undefined}
                                style={{
                                  height: 28, borderRadius: 5, cursor: count > 0 || isRec ? 'pointer' : 'default',
                                  background: bg || (isRec && !optTimes?.hasRealData ? 'rgba(124,92,252,0.12)' : t.input),
                                  border: isRec ? `1.5px solid ${t.primaryBorder}` : `1px solid ${t.border}`,
                                  transform: isHov && count > 0 ? 'scaleY(1.18)' : 'scaleY(1)',
                                  transition: 'all 120ms ease', position: 'relative',
                                }}
                              >
                                {count > 0 && (
                                  <div style={{ position: 'absolute', bottom: 3, right: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                        <span style={{ fontSize: 10, color: t.textMuted }}>Low</span>
                        {[0.1, 0.25, 0.4, 0.6, 0.8, 1.0].map(v => (
                          <div key={v} style={{ width: 20, height: 12, borderRadius: 3, background: `rgba(124,92,252,${(v * 0.78 + 0.08).toFixed(2)})` }} />
                        ))}
                        <span style={{ fontSize: 10, color: t.textMuted }}>High</span>
                        <span style={{ fontSize: 10, color: t.textMuted, margin: '0 6px' }}>·</span>
                        <div style={{ width: 16, height: 12, borderRadius: 3, border: `1.5px solid ${t.primaryBorder}`, background: 'rgba(124,92,252,0.12)' }} />
                        <span style={{ fontSize: 10, color: t.textMuted }}>Recommended</span>
                        <span style={{ fontSize: 10, color: t.textMuted, margin: '0 6px' }}>·</span>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', border: '1px solid #888' }} />
                        <span style={{ fontSize: 10, color: t.textMuted }}>Has posts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {optTimes?.recommendations?.length > 3 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Also worth trying</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {optTimes.recommendations.slice(3).map((slot, i) => (
                        <button
                          key={i}
                          onClick={() => handleUseTime(slot)}
                          style={{ padding: '7px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.text, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.input; }}
                        >
                          <IpSchedule size={11} color="url(#brand-gradient)" /> {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── CONTENT PERFORMANCE + DOW BARS ─────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                <div style={gc}>
                  <SectionHeader icon={IpAnalytics} title="Content type performance" subtitle="Avg engagement by type" />
                  {!contentPerf?.byType?.length ? (
                    <EmptyState icon={IpAnalytics} title="No data yet" subtitle="Publish posts to see performance by type" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {contentPerf.byType.map(row => {
                        const meta   = TYPE_META[row.content_type] || { label: row.content_type, color: t.primary, icon: IpDrafts };
                        const Icon   = meta.icon;
                        const score  = parseFloat(row.avg_score) || 0;
                        const barPct = maxCpScore > 0 ? (score / maxCpScore) * 100 : 0;
                        return (
                          <div key={row.content_type}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Icon size={13} style={{ color: meta.color }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{meta.label}</span>
                                <span style={{ fontSize: 11, color: t.textMuted }}>· {row.total}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: t.textMuted }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpHeart size={10} /> {Math.round(parseFloat(row.avg_likes) || 0)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpComment size={10} /> {Math.round(parseFloat(row.avg_comments) || 0)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpShare size={10} /> {Math.round(parseFloat(row.avg_shares) || 0)}</span>
                              </div>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: t.input, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${barPct}%`, background: meta.color, borderRadius: 4, transition: 'width 600ms ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={gc}>
                  <SectionHeader icon={IpCalendar} title="Your posting days" subtitle="How you spread content across the week" />
                  {!contentPerf?.byDow?.length ? (
                    <EmptyState icon={IpCalendar} title="No data yet" subtitle="Create posts to see your posting patterns" />
                  ) : (
                    <div>
                      {(() => {
                        const maxCount = Math.max(...contentPerf.byDow.map(r => parseInt(r.count)), 1);
                        const dowMap   = {};
                        for (const r of contentPerf.byDow) dowMap[parseInt(r.dow)] = parseInt(r.count);
                        return DAYS.map((day, i) => {
                          const count  = dowMap[i] || 0;
                          const pct    = (count / maxCount) * 100;
                          const isTopRec = optTimes?.recommendations?.[0]?.dow === i;
                          return (
                            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 30, fontSize: 12, fontWeight: 600, color: isTopRec ? t.primary : t.textSecondary, flexShrink: 0 }}>{day}</div>
                              <div style={{ flex: 1, height: 22, borderRadius: 6, background: t.input, overflow: 'hidden', position: 'relative' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: isTopRec ? t.primary : `${t.primary}60`, borderRadius: 6, transition: 'width 600ms ease' }} />
                              </div>
                              <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontWeight: 600, color: count > 0 ? t.text : t.textMuted, flexShrink: 0 }}>{count}</div>
                              {isTopRec && <div style={{ fontSize: 9, color: t.primary, background: t.primaryBg, padding: '2px 6px', borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>best</div>}
                            </div>
                          );
                        });
                      })()}

                      {contentPerf.byDow.length > 0 && (() => {
                        const best = contentPerf.byDow.reduce((a, b) => parseInt(a.count) > parseInt(b.count) ? a : b);
                        const rec  = optTimes?.recommendations?.[0];
                        return (
                          <div style={{ marginTop: 12, padding: '10px 12px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, fontSize: 12, color: t.textSecondary }}>
                            You post most on <strong style={{ color: t.text }}>{DAYS[parseInt(best.dow)]}</strong>s
                            {rec && parseInt(best.dow) !== rec.dow && (
                              <> — but your top recommended slot is <button onClick={() => handleUseTime(rec)} style={{ color: t.primary, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 12 }}>{rec.label}</button></>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* ── INDUSTRY LEADERBOARD ─────────────────────── */}
              {leaderboard && (
                <div style={gc}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IpTrendingUp size={16} color="url(#brand-gradient)" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>How you stack up</span>
                      <span style={{ fontSize: 13, color: t.textMuted }}>
                        — {leaderboard.industry ? leaderboard.industry.replace(/_/g, ' ') : 'your industry'} businesses this month
                      </span>
                    </div>
                    {leaderboard.hasData && leaderboard.percentileBucket && (() => {
                      const bucketColors = {
                        'Top 10%':     { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
                        'Top 25%':     { bg: 'rgba(124,92,252,0.12)', border: 'rgba(124,92,252,0.3)', text: t.primary },
                        'Top 50%':     { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)', text: '#60A5FA' },
                        'Bottom 25%':  { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
                      };
                      const c = bucketColors[leaderboard.percentileBucket] || bucketColors['Top 50%'];
                      return (
                        <div style={{ padding: '4px 12px', borderRadius: 20, background: c.bg, border: `1px solid ${c.border}`, fontSize: 12, fontWeight: 700, color: c.text }}>
                          {leaderboard.percentileBucket}
                        </div>
                      );
                    })()}
                  </div>

                  {!leaderboard.hasData ? (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                      Not enough data in your industry yet — check back after more businesses join.
                    </div>
                  ) : (
                    <>
                      {/* Top performers */}
                      {leaderboard.topPerformers?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Top performers</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {leaderboard.topPerformers.map((p, i) => {
                              const medals = ['🥇', '🥈', '🥉'];
                              const maxScore = leaderboard.topPerformers[0]?.avg_score || 1;
                              const pct = Math.round((p.avg_score / maxScore) * 100);
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 16, flexShrink: 0 }}>{medals[i] || '·'}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{p.city || 'Unknown area'}</span>
                                      <span style={{ fontSize: 11, color: t.textMuted }}>{Math.round(p.avg_score)} avg score</span>
                                    </div>
                                    <div style={{ height: 5, borderRadius: 3, background: t.input, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : i === 1 ? 'linear-gradient(90deg,#94a3b8,#64748b)' : 'linear-gradient(90deg,#cd7c3a,#a26028)', borderRadius: 3, transition: 'width 700ms ease' }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Your ranking */}
                      {leaderboard.myScore !== undefined && (
                        <div style={{ padding: '12px 14px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.primary, marginBottom: 8 }}>Your ranking</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{Math.round(leaderboard.myScore)}</span>
                            <span style={{ fontSize: 12, color: t.textMuted }}>avg engagement score</span>
                          </div>
                          {/* Progress toward next tier */}
                          {leaderboard.nextTierScore && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: t.textMuted }}>Progress to {leaderboard.nextTier}</span>
                                <span style={{ fontSize: 11, color: t.textMuted }}>{Math.round(leaderboard.nextTierScore)} needed</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: t.input, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.round((leaderboard.myScore / leaderboard.nextTierScore) * 100))}%`,
                                  background: `linear-gradient(90deg,${t.primary},#a855f7)`,
                                  borderRadius: 3,
                                  transition: 'width 700ms ease',
                                }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PostCore tips */}
                      {leaderboard.topTips?.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            <IpSparkle size={10} style={{ marginRight: 4 }} />
                            What top performers are doing
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {leaderboard.topTips.map((tip, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: t.textSecondary }}>
                                <span style={{ color: t.primary, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      {leaderboard.percentileBucket !== 'Top 10%' && (
                        <button
                          onClick={() => router.push('/wizard')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: `linear-gradient(135deg,${t.primary},#a855f7)`, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', width: '100%', justifyContent: 'center', transition: 'opacity 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          <IpSparkle size={13} />
                          Want to break into the top 10%? Create a post now
                          <IpChevronRight size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* POSTS TAB                                          */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'posts' && (
          loading ? (
            <SkeletonPage rows={6} cards={2} />
          ) : (
            <div style={gc}>
              <SectionHeader
                icon={IpAnalytics}
                title="All posts"
                action={
                  <div style={{ display: 'flex', gap: 4, background: t.input, padding: 3, borderRadius: 8 }}>
                    {[{ id: 'recent', label: 'Recent' }, { id: 'best', label: 'Best' }].map(s => (
                      <button
                        key={s.id} onClick={() => setSort(s.id)}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', color: sort === s.id ? t.text : t.textMuted, background: sort === s.id ? t.card : 'transparent', transition: 'all 150ms' }}
                      >{s.label}</button>
                    ))}
                  </div>
                }
              />

              {posts.length === 0 ? (
                <EmptyState icon={IpAnalytics} title="No published posts yet" subtitle="Once you start posting, performance data will appear here" />
              ) : (
                <div>
                  {posts.map(p => {
                    const eng   = p.engagement || {};
                    const total = (parseInt(eng.likes) || 0) + (parseInt(eng.comments) || 0) + (parseInt(eng.shares) || 0);
                    const meta  = TYPE_META[p.content_type] || { color: t.primary };
                    return (
                      <div
                        key={p.id}
                        onClick={() => router.push(`/analytics/posts/${p.id}`)}
                        style={{ display: 'flex', gap: 14, padding: '13px 8px', cursor: 'pointer', borderBottom: `1px solid ${t.border}`, alignItems: 'center', borderRadius: 8, transition: 'background 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {p.media_url ? (
                          <img src={p.media_url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 8, background: t.input, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.content_type === 'carousel' ? <IpCarousel size={22} style={{ color: t.textMuted }} /> : p.content_type === 'video' ? <IpVideo size={22} style={{ color: t.textMuted }} /> : <IpDrafts size={22} style={{ color: t.textMuted }} />}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                            {p.caption || '(no caption)'}
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: t.textMuted }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpHeart size={10} /> {eng.likes || 0}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpComment size={10} /> {eng.comments || 0}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IpShare size={10} /> {eng.shares || 0}</span>
                            <span style={{ color: meta.color, fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>{meta.label || p.content_type}</span>
                            {p.posted_at && <span>{format(new Date(p.posted_at), 'MMM d, yyyy')}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: total > 0 ? t.primary : t.textMuted, fontFamily: 'monospace' }}>{total}</div>
                            <div style={{ fontSize: 10, color: t.textMuted }}>total</div>
                          </div>
                          {p.performance_score > 0 && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: t.success, fontFamily: 'monospace' }}>{Math.round(p.performance_score)}</div>
                              <div style={{ fontSize: 10, color: t.textMuted }}>score</div>
                            </div>
                          )}
                          <IpChevronRight size={16} style={{ color: t.textMuted }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* MONTHLY REPORT TAB                                 */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'monthly' && (
          <>
            {/* Month picker header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Monthly Report</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>Performance summary for {monthLabel}</div>
              </div>
              <MonthPicker value={reportMonth} onChange={setReportMonth} />
            </div>

            {reportLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={40} /></div>
            ) : (
              <>
                {/* 4 stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: 'Posts Published', value: reportPosts.length, sub: `in ${monthLabel}`, color: t.primary },
                    { label: 'Estimated Reach', value: totalReach > 999 ? `~${(totalReach/1000).toFixed(1)}k` : `~${totalReach}`, sub: 'estimated local people', color: '#3B82F6' },
                    { label: 'Total Engagement', value: totalEng, sub: 'likes + comments + shares', color: '#F59E0B' },
                    { label: 'Best Day', value: reportPosts.length > 0 ? DAYS_FULL[bestDowIdx].slice(0, 3) : '—', sub: reportPosts.length > 0 ? `${dowCounts[bestDowIdx]} post${dowCounts[bestDowIdx] !== 1 ? 's' : ''}` : 'no posts yet', color: '#22C55E' },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ ...gc, padding: '18px 20px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color, fontFamily: 'monospace', textShadow: `0 0 20px ${color}40` }}>{value}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textSecondary }}>{sub}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  {/* Top post */}
                  <div style={gc}>
                    <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Post This Month</p>
                    {!bestPost ? (
                      <EmptyState icon={IpSparkle} title="No posts yet" subtitle={`Publish posts in ${monthLabel} to see top performers.`} />
                    ) : (
                      <div
                        onClick={() => router.push(`/analytics/posts/${bestPost.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {bestPost.media_url && (
                          <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8, marginBottom: 12, background: t.border, overflow: 'hidden' }}>
                            <img src={bestPost.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: t.text, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {bestPost.caption || 'No text preview'}
                        </p>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: t.textSecondary }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpHeart size={12} />{bestPost.likes || 0}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpComment size={12} />{bestPost.comments || 0}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpShare size={12} />{bestPost.shares || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content mix */}
                  <div style={gc}>
                    <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Mix</p>
                    {reportPosts.length === 0 ? (
                      <EmptyState icon={IpCalendar} title="No posts yet" subtitle="Publish posts this month to see your content breakdown." />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {Object.entries(typeCounts).map(([type, count]) => {
                          const meta = TYPE_META[type] || { label: type, color: t.textMuted, icon: IpDrafts };
                          const pct = Math.round((count / reportPosts.length) * 100);
                          const Icon = meta.icon;
                          return (
                            <div key={type}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.text }}>
                                  <Icon size={14} style={{ color: meta.color }} /> {meta.label}
                                </span>
                                <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: 'monospace' }}>{count} ({pct}%)</span>
                              </div>
                              <div style={{ height: 6, background: t.border, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 4 }} />
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 8, padding: '8px 10px', background: t.primaryBg, borderRadius: 8, fontSize: 12, color: t.textSecondary }}>
                          Target: <strong style={{ color: t.text }}>70%</strong> educational · <strong style={{ color: t.text }}>20%</strong> social proof · <strong style={{ color: t.text }}>10%</strong> promotional
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* All posts table */}
                <div style={gc}>
                  <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Posts — {monthLabel}</p>
                  {reportPosts.length === 0 ? (
                    <EmptyState
                      icon={IpCalendar}
                      title={`No posts in ${monthLabel}`}
                      subtitle="Published posts will appear here once they go live."
                      action={<Button onClick={() => router.push('/wizard')}><IpSparkle size={14} /> Create a Post</Button>}
                    />
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                            {['Date', 'Type', 'Platform', 'Caption', 'Reach', 'Engagement'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: t.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportPosts.map(p => {
                            const meta = TYPE_META[p.content_type] || { label: p.content_type, color: t.textMuted };
                            const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
                            const reach = parseInt(p.reach) || 0;
                            const hasReal = p.performance_score > 0;
                            return (
                              <tr
                                key={p.id}
                                onClick={() => router.push(`/analytics/posts/${p.id}`)}
                                style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{ padding: '10px 10px', color: t.textSecondary, whiteSpace: 'nowrap' }}>
                                  {new Date(p.posted_at || p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </td>
                                <td style={{ padding: '10px 10px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: `${meta.color}1a`, padding: '2px 8px', borderRadius: 20 }}>
                                    {meta.label}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 10px', color: t.textSecondary, textTransform: 'capitalize' }}>
                                  {(p.platform || '').replace('_', ' ') || '—'}
                                </td>
                                <td style={{ padding: '10px 10px', color: t.text, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.caption?.slice(0, 80) || '—'}
                                </td>
                                <td style={{ padding: '10px 10px', color: t.textSecondary, fontFamily: 'monospace', textAlign: 'right' }}>
                                  {reach > 0
                                    ? <span title="Real synced reach">{reach > 999 ? `${(reach/1000).toFixed(1)}k` : reach}</span>
                                    : <span title="Estimated reach" style={{ color: t.textMuted }}>~150 est.</span>}
                                </td>
                                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: eng > 0 ? t.success : t.textMuted }}>
                                  {eng || '—'}
                                  {!hasReal && eng > 0 && <span style={{ fontSize: 10, fontWeight: 400, color: t.textMuted }}> est.</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </Layout>
    </>
  );
}

