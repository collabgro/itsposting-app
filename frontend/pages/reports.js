import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Card, Button, Badge, SectionHeader, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { analyticsAPI, postsAPI } from '../lib/api';
import {
  IpTrendingUp, IpHeart, IpComment, IpShare, IpPhoto as IpImage,
  IpCarousel, IpVideo, IpDrafts, IpSparkle, IpCalendar, IpTeam,
} from '../components/icons';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const CONTENT_TYPE_META = {
  photo:    { label: 'Photo',    color: '#A78BFA', icon: IpImage },
  carousel: { label: 'Carousel', color: '#F472B6', icon: IpCarousel },
  video:    { label: 'Video',    color: '#FB923C', icon: IpVideo },
  static:   { label: 'Text',     color: '#60A5FA', icon: IpDrafts },
};

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
        borderRadius: 8, padding: '8px 12px',
        color: t.text, fontSize: 14, cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
      ))}
    </select>
  );
}

function StatBox({ label, value, sub, color, icon: Icon }) {
  const { t } = useTheme();
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: color || t.text, fontFamily: 'monospace' }}>{value}</p>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textSecondary }}>{sub}</p>}
        </div>
        {Icon && <Icon size={22} color={color || t.textMuted} />}
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const { t } = useTheme();
  const router = useRouter();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const [selYear, selMonth] = selectedMonth.split('-').map(Number);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // period = days in that month
        const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
        // Use 30-day overview as an approximation; filter by month client-side
        const [overview, posts] = await Promise.all([
          analyticsAPI.getOverview({ period: daysInMonth }),
          analyticsAPI.listPosts({ limit: 100, period: daysInMonth }),
        ]);
        setData({ overview: overview.data, posts: posts.data?.posts || posts.data || [] });
      } catch {
        setData({ overview: {}, posts: [] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedMonth]);

  const ov = data?.overview || {};
  const posts = (data?.posts || []).filter(p => {
    const d = new Date(p.posted_at || p.created_at);
    return d.getFullYear() === selYear && d.getMonth() === selMonth && p.status === 'posted';
  });

  // Best post by engagement
  const bestPost = posts.reduce((best, p) => {
    const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
    const bestEng = (best?.likes || 0) + (best?.comments || 0) + (best?.shares || 0);
    return eng > bestEng ? p : best;
  }, null);

  // Content mix
  const typeCounts = {};
  posts.forEach(p => { typeCounts[p.content_type] = (typeCounts[p.content_type] || 0) + 1; });
  const totalPosts = posts.length;

  // Best day of week
  const dowCounts = Array(7).fill(0);
  posts.forEach(p => {
    const d = new Date(p.posted_at || p.created_at);
    dowCounts[d.getDay()]++;
  });
  const bestDowIdx = dowCounts.indexOf(Math.max(...dowCounts));
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Total engagement
  const totalEng = posts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0);
  const totalReach = posts.reduce((s, p) => s + (parseInt(p.reach) || 0), 0);

  const monthLabel = `${MONTH_NAMES[selMonth]} ${selYear}`;

  return (
    <Layout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <SectionHeader
            title="Monthly Report"
            subtitle={`Performance summary for ${monthLabel}`}
            icon={IpCalendar}
          />
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Top stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatBox label="Posts Published" value={loading ? '—' : totalPosts} sub={`in ${monthLabel}`} color={t.primary} icon={IpSparkle} />
          <StatBox label="People Reached" value={loading ? '—' : (totalReach > 999 ? `${(totalReach/1000).toFixed(1)}k` : totalReach)} sub="estimated local people" color={t.info} icon={IpTeam} />
          <StatBox label="Total Engagement" value={loading ? '—' : totalEng} sub="likes + comments + shares" color={t.warning} icon={IpHeart} />
          <StatBox label="Best Day" value={loading ? '—' : (totalPosts > 0 ? DOW[bestDowIdx].slice(0, 3) : '—')} sub={totalPosts > 0 ? `${dowCounts[bestDowIdx]} post${dowCounts[bestDowIdx] !== 1 ? 's' : ''}` : 'no posts yet'} color={t.success} icon={IpCalendar} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Best post */}
          <Card>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Post This Month</p>
            {loading ? (
              <p style={{ color: t.textMuted, fontSize: 14 }}>Loading...</p>
            ) : !bestPost ? (
              <EmptyState icon={IpSparkle} title="No posts yet" subtitle="Posts you publish this month will appear here." />
            ) : (
              <div>
                {bestPost.media_url && (
                  <div style={{
                    width: '100%', aspectRatio: '4/3', borderRadius: 8, marginBottom: 12,
                    background: t.border, overflow: 'hidden',
                  }}>
                    <img src={bestPost.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <p style={{
                  margin: '0 0 10px', fontSize: 13, color: t.text, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {bestPost.caption || 'No caption'}
                </p>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: t.textSecondary }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpHeart size={12} color={t.error} />{bestPost.likes || 0}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpComment size={12} color={t.primary} />{bestPost.comments || 0}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IpShare size={12} color={t.success} />{bestPost.shares || 0}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Content mix */}
          <Card>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Mix</p>
            {loading ? (
              <p style={{ color: t.textMuted, fontSize: 14 }}>Loading...</p>
            ) : totalPosts === 0 ? (
              <EmptyState icon={IpCalendar} title="No posts yet" subtitle="Publish posts this month to see your content breakdown." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const meta = CONTENT_TYPE_META[type] || { label: type, color: t.textMuted, icon: IpDrafts };
                  const pct = Math.round((count / totalPosts) * 100);
                  const Icon = meta.icon;
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.text }}>
                          <Icon size={14} color={meta.color} /> {meta.label}
                        </span>
                        <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: 'monospace' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: t.border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
                {/* 70/20/10 target reminder */}
                <div style={{ marginTop: 8, padding: '8px 10px', background: t.primaryBg, borderRadius: 8, fontSize: 12, color: t.textSecondary }}>
                  Target: <strong style={{ color: t.text }}>70%</strong> educational · <strong style={{ color: t.text }}>20%</strong> social proof · <strong style={{ color: t.text }}>10%</strong> promotional
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* All posts table */}
        <Card>
          <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Posts — {monthLabel}</p>
          {loading ? (
            <p style={{ color: t.textMuted, fontSize: 14 }}>Loading...</p>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={IpCalendar}
              title={`No posts in ${monthLabel}`}
              subtitle="Published posts will appear here once they go live."
              action={<Button onClick={() => router.push('/wizard')} icon={<IpSparkle size={16} />}>Create a Post</Button>}
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
                  {posts.map(p => {
                    const meta = CONTENT_TYPE_META[p.content_type] || { label: p.content_type, color: t.textMuted };
                    const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
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
                        <td style={{ padding: '10px 10px', color: t.text, fontFamily: 'monospace', textAlign: 'right' }}>
                          {parseInt(p.reach) ? (parseInt(p.reach) > 999 ? `${(parseInt(p.reach)/1000).toFixed(1)}k` : parseInt(p.reach)) : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', color: t.success, fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>
                          {eng || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <Button onClick={() => router.push('/analytics')} variant="secondary">Full Analytics</Button>
          <Button onClick={() => router.push('/roi')} icon={<IpTrendingUp size={16} />}>View ROI Estimate</Button>
        </div>
      </div>
    </Layout>
  );
}
