import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  IpCalendar, IpSchedule, IpSparkle, IpPlus,
  IpTrendingUp, IpTrendingDown,
  IpDrafts, IpPhoto, IpCarousel, IpVideo,
  IpFacebook, IpInstagram, IpGlobe,
  IpArrowRight, IpFlame, IpTeam, IpAnalytics,
  IpClose, IpInfo,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, SectionHeader, EmptyState, Spinner, Skeleton } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI, intelligenceAPI } from '../lib/api';
import { format } from 'date-fns';

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

  const [mounted,      setMounted]      = useState(false);
  const [allPosts,     setAllPosts]     = useState([]);
  const [upcoming,     setUpcoming]     = useState([]);
  const [metrics,      setMetrics]      = useState(null);
  const [briefing,     setBriefing]     = useState(null);
  const [contentMix,   setContentMix]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [briefingOpen, setBriefingOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }

    Promise.all([
      postsAPI.getAll({ limit: 100 }).catch(() => ({ data: [] })),
      postsAPI.getUpcoming().catch(() => ({ data: [] })),
      intelligenceAPI.getMetrics().catch(() => ({ data: null })),
      intelligenceAPI.getBriefing().catch(() => ({ data: null })),
      intelligenceAPI.getContentHealth().catch(() => ({ data: null })),
    ]).then(([p, u, m, b, cm]) => {
      setAllPosts(Array.isArray(p.data) ? p.data : []);
      setUpcoming(Array.isArray(u.data) ? u.data : []);
      setMetrics(m.data);
      setBriefing(b.data);
      setContentMix(cm.data);
      setLoading(false);
    });
  }, []);

  const dismissBriefing = async () => {
    setBriefingOpen(false);
    if (briefing?.id) {
      await intelligenceAPI.markBriefingRead(briefing.id).catch(() => {});
    }
  };

  if (!mounted) return null;

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

  return (
    <>
      <Layout
        title="Dashboard"
        subtitle={today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => router.push('/wizard')}>
              <IpSparkle size={14} color="url(#brand-gradient)" /> Create
            </Button>
            <Button variant="primary" onClick={() => router.push('/upload')}>
              <IpPlus size={14} strokeWidth={2.5} /> Create Post
            </Button>
          </div>
        }
      >

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
                      {s.actionLabel || 'Create Post'} →
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
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={86} borderRadius={12} />)
          ) : (<>
            <MetricCard t={t}
              label="People Reached"
              main={fmt(metrics?.totalReach)}
              sub={metrics ? `~${fmt(metrics.estimatedLocalReach)} local est.` : 'No data yet'}
            />
            <MetricCard t={t}
              label="Est. New Customers"
              main={metrics ? `${metrics.estimatedNewCustomers.min}–${metrics.estimatedNewCustomers.max}` : '—'}
              sub={`Based on ${metrics ? 'industry' : '...'} averages`}
              disclaimer
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
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IpSchedule size={15} color="url(#brand-gradient)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Upcoming posts</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Next 30 days</div>
                </div>
              </div>
              {upcoming.length > 0 && <button onClick={() => router.push('/history?filter=scheduled')} style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>View all <IpArrowRight size={12} /></button>}
            </div>
            {upcoming.length === 0 ? (
              <EmptyState icon={IpCalendar} title="Your schedule is open"
                subtitle="PostCore recommends posting 3–6× per week. Create your first scheduled post."
                action={<Button variant="primary" size="sm" onClick={() => router.push('/wizard')}><IpSparkle size={12} /> Generate a Post</Button>} />
            ) : (
              <div>
                {upcoming.slice(0, 4).map(post => {
                  const TI = TYPE_ICON[post.content_type] || IpDrafts;
                  const tc = TYPE_COLOR[post.content_type] || t.primary;
                  const pp = parsePlatforms(post.platforms);
                  return (
                    <div key={post.id} onClick={() => router.push('/history')}
                      style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.cardHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.media_url ? <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target.style.display = 'none')} /> : <TI size={18} style={{ color: tc, opacity: 0.6 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: tc, textTransform: 'uppercase' }}>{post.content_type}</span>
                          {pp.slice(0, 2).map(pid => { const pm = PLAT_ICONS[pid]; if (!pm) return null; const PI = pm.icon; return <PI key={pid} size={11} style={{ color: pm.color }} />; })}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || 'No caption'}</div>
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>{format(new Date(post.scheduled_date), 'MMM d, h:mm a')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </Layout>

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
  { key: 'educational', label: 'Educational',  color: '#3B82F6', target: 70 },
  { key: 'socialProof', label: 'Social proof', color: '#22C55E', target: 20 },
  { key: 'promotional', label: 'Promotional',  color: '#EAB308', target: 10 },
];

function ContentHealthBar({ data, t, router }) {
  if (!data) return null;
  const { mix, recommendation, gaps } = data;
  const total = Object.values(mix).reduce((s, v) => s + v, 0);

  if (!total) {
    return (
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Content mix — target</div>
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
        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>Target mix — start posting to track your actual ratio</div>
      </div>
    );
  }

  const allSegments = [
    { key: 'educational', label: 'Educational',  color: '#3B82F6' },
    { key: 'socialProof', label: 'Social proof', color: '#22C55E' },
    { key: 'seasonal',    label: 'Seasonal',     color: '#A78BFA' },
    { key: 'promotional', label: 'Promotional',  color: '#EAB308' },
  ];
  const segments = allSegments.filter(s => mix[s.key] > 0);

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>Content mix — last 30 posts</div>
        {gaps.length > 0 && (
          <button onClick={() => router.push('/wizard')} style={{ fontSize: 11, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Fix balance →
          </button>
        )}
      </div>
      <div style={{ height: 7, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 8 }}>
        {segments.map(s => <div key={s.key} style={{ width: `${mix[s.key]}%`, background: s.color, transition: 'width 400ms ease' }} title={`${s.label}: ${mix[s.key]}%`} />)}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: gaps.length ? 8 : 0 }}>
        {segments.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 11, color: t.textMuted }}>{s.label} {mix[s.key]}%</span>
          </div>
        ))}
      </div>
      {gaps.length > 0 && (
        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>
          <span style={{ color: t.primary, fontWeight: 600 }}>PostCore: </span>{recommendation}
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
