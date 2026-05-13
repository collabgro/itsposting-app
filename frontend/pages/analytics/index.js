import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpTrendingUp, IpHeart, IpComment, IpShare, IpAnalytics, IpChevronRight,
  IpSchedule, IpSparkle, IpDrafts, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpReview, IpCalendar, IpInfo,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, Badge, StatCard, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { analyticsAPI } from '../../lib/api';
import { format, addDays } from 'date-fns';
/* ─── constants ──────────────────────────────────────────── */
const DAYS     = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS    = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const FMT_HOUR = h => { const a = h >= 12 ? 'pm' : 'am'; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}${a}`; };

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

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadAll();
  }, []);

  useEffect(() => { if (mounted) loadOverview(); }, [period]);
  useEffect(() => { if (mounted) loadPosts(); }, [sort]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [o, p, ot, cp] = await Promise.all([
        analyticsAPI.getOverview({ period }),
        analyticsAPI.listPosts({ sort: 'recent' }),
        analyticsAPI.getOptimalTimes(),
        analyticsAPI.getContentPerformance(),
      ]);
      setOverview(o.data);
      setPosts(Array.isArray(p.data) ? p.data : []);
      setOptTimes(ot.data);
      setContentPerf(cp.data);
    } catch (err) { console.error('Analytics load error:', err); }
    finally { setLoading(false); }
  };

  const loadOverview = async () => {
    try { const r = await analyticsAPI.getOverview({ period }); setOverview(r.data); } catch {}
  };

  const loadPosts = async () => {
    try { const r = await analyticsAPI.listPosts({ sort }); setPosts(Array.isArray(r.data) ? r.data : []); } catch {}
  };

  const handleUseTime = () => {
    router.push('/wizard');
  };

  if (!mounted) return null;

  const summary = overview?.summary || {};
  const maxCpScore = contentPerf?.byType
    ? Math.max(...contentPerf.byType.map(r => parseFloat(r.avg_score) || 0), 1)
    : 1;

  return (
    <>
      <Layout
        title="Analytics"
        subtitle="Track performance and find the best times to post"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10 }}>
              {[['7','7d'], ['30','30d'], ['90','90d']].map(([val, lbl]) => (
                <button
                  key={val} onClick={() => setPeriod(val)}
                  style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, color: period === val ? t.text : t.textMuted, background: period === val ? t.primaryBg : 'transparent', border: period === val ? `1px solid ${t.primaryBorder}` : '1px solid transparent', cursor: 'pointer', transition: 'all 150ms' }}
                >{lbl}</button>
              ))}
            </div>
            <Button variant="primary" onClick={() => router.push('/wizard')}>
              <IpSparkle size={13} /> Generate Post
            </Button>
          </div>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spinner size={40} />
          </div>
        ) : (
          <>
            {/* ── STAT CARDS ─────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Posts published" value={parseInt(summary.posted) || 0}       hint={`${parseInt(summary.active_days) || 0} active days`} accent="primary" />
              <StatCard label="Total likes"     value={parseInt(summary.total_likes) || 0}    accent="primary" />
              <StatCard label="Total comments"  value={parseInt(summary.total_comments) || 0} accent="success" />
              <StatCard label="Total shares"    value={parseInt(summary.total_shares) || 0}   accent="warning" />
            </div>

            {/* ── SCHEDULING OPTIMIZER ───────────────────────── */}
            <Card style={{ marginBottom: 24 }}>
              {/* Header */}
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

              {/* TOP 3 RECOMMENDATION CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {(optTimes?.recommendations || []).slice(0, 3).map((slot, idx) => (
                  <div
                    key={idx}
                    style={{ padding: 16, border: `2px solid ${idx === 0 ? t.primary : t.border}`, borderRadius: 12, background: idx === 0 ? t.primaryBg : t.input, position: 'relative', overflow: 'hidden' }}
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
                    {/* Hour headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${HOURS.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
                      <div />
                      {HOURS.map(h => (
                        <div key={h} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{FMT_HOUR(h)}</div>
                      ))}
                    </div>

                    {/* Rows */}
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
                              title={count > 0
                                ? `${DAYS[dow]} ${FMT_HOUR(hour)} · ${count} post${count !== 1 ? 's' : ''} · avg score ${Math.round(score)}`
                                : isRec ? `${DAYS[dow]} ${FMT_HOUR(hour)} · Recommended slot` : undefined}
                              style={{
                                height: 28, borderRadius: 5, cursor: count > 0 || isRec ? 'pointer' : 'default',
                                background: bg || (isRec && !optTimes?.hasRealData ? 'rgba(124,92,252,0.12)' : t.input),
                                border: isRec ? `1.5px solid ${t.primaryBorder}` : `1px solid ${t.border}`,
                                transform: isHov && count > 0 ? 'scaleY(1.18)' : 'scaleY(1)',
                                transition: 'all 120ms ease',
                                position: 'relative',
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

                    {/* Legend */}
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

              {/* EXTRA RECOMMENDATIONS */}
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
            </Card>

            {/* ── CONTENT PERFORMANCE + DOW BARS ─────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

              {/* Content type performance */}
              <Card>
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
              </Card>

              {/* Posting day distribution */}
              <Card>
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
              </Card>
            </div>

            {/* ── ALL POSTS TABLE ─────────────────────────────── */}
            <Card>
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
                            <span style={{ fontSize: 22 }}>{p.content_type === 'carousel' ? '🎞' : p.content_type === 'video' ? '🎬' : '📝'}</span>
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
                            <span style={{ color: meta.color, fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>{p.content_type}</span>
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
            </Card>
          </>
        )}
      </Layout>

    </>
  );
}

export async function getServerSideProps() { return { props: {} }; }
