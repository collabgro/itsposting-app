import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpArrowLeft, IpHeart, IpComment, IpShare, IpEye,
  IpTrendingUp, IpTrendingDown, IpFacebook, IpInstagram, IpGoogle, IpGlobe, IpTip,
  IpCheckCircle, IpWarning, IpInfo,
} from '../../../components/icons';
import Layout from '../../../components/Layout';
import { Card, Button, Badge, SectionHeader, EmptyState, Spinner } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import { analyticsAPI } from '../../../lib/api';

const PLATFORM_META = {
  facebook: { name: 'Facebook', color: '#1877F2', icon: IpFacebook },
  instagram: { name: 'Instagram', color: '#E1306C', icon: IpInstagram },
  google_business: { name: 'Google Business', color: '#4285F4', icon: IpGoogle },
};

const INSIGHT_ICON = { good: IpCheckCircle, short: IpWarning, few: IpWarning, long: IpWarning, many: IpWarning, consider_better_time: IpInfo };
const INSIGHT_COLOR = { good: 'success', short: 'warning', few: 'warning', long: 'warning', many: 'warning', consider_better_time: 'default' };

export default function PostPerformance() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  useEffect(() => {
    if (mounted && id) load();
  }, [mounted, id]);

  const load = async () => {
    try {
      const res = await analyticsAPI.getPostDetail(id);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || loading) {
    return (
      <Layout title="Post Performance">
        <Card>
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} />
          </div>
        </Card>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout title="Post Performance">
        <Card><EmptyState icon={IpTrendingUp} title="Post not found" subtitle="This post may have been deleted" /></Card>
      </Layout>
    );
  }

  const { post, platformMetrics, comparison, insights, accountAverage } = data;
  const eng = post.engagement || {};

  const hashtags = (() => { try { return Array.isArray(post.hashtags) ? post.hashtags : JSON.parse(post.hashtags || '[]'); } catch { return []; } })();
  const platforms = (() => { try { return Array.isArray(post.platforms) ? post.platforms : JSON.parse(post.platforms || '[]'); } catch { return []; } })();

  return (
    <Layout
      title="Post Performance"
      subtitle={post.posted_at ? `Posted ${new Date(post.posted_at).toLocaleString()}` : `Status: ${post.status}`}
      action={<Button variant="ghost" onClick={() => router.push('/analytics')}><IpArrowLeft size={14} /> Analytics</Button>}
    >
      {/* PREVIEW + COMPARISON */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 20 }}>
        {/* POST CARD */}
        <Card>
          {post.media_url ? (
            <img src={post.media_url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 14, aspectRatio: '1/1', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', background: t.input, borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Text post</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Badge variant="primary">{post.content_type}</Badge>
            <Badge variant={post.status === 'posted' ? 'success' : 'warning'}>{post.status}</Badge>
          </div>
          {post.caption && <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, marginBottom: 10 }}>{post.caption.slice(0, 200)}{post.caption.length > 200 ? '...' : ''}</p>}
          {hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {hashtags.slice(0, 8).map((h, i) => <span key={i} style={{ fontSize: 11, color: t.primary }}>#{h}</span>)}
            </div>
          )}
          {platforms.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {platforms.map((pl) => {
                const meta = PLATFORM_META[pl];
                if (!meta) return null;
                const Icon = meta.icon;
                return <div key={pl} style={{ width: 24, height: 24, borderRadius: 6, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={12} color="#fff" /></div>;
              })}
            </div>
          )}
        </Card>

        {/* COMPARISON CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Likes', key: 'likes', icon: IpHeart, color: '#F43F5E' },
              { label: 'Comments', key: 'comments', icon: IpComment, color: 'url(#brand-gradient)' },
              { label: 'Shares', key: 'shares', icon: IpShare, color: t.success },
            ].map(({ label, key, icon: Icon, color }) => {
              const cmp = comparison[key];
              const isAbove = cmp.diff >= 0;
              return (
                <div key={key} style={{ background: t.input, borderRadius: 12, padding: 16, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon size={16} style={{ color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: t.text, fontFamily: 'monospace', marginBottom: 6 }}>{cmp.value}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isAbove ? <IpTrendingUp size={12} style={{ color: t.success }} /> : <IpTrendingDown size={12} style={{ color: t.error }} />}
                    <span style={{ fontSize: 11, color: isAbove ? t.success : t.error, fontWeight: 600 }}>
                      {isAbove ? '+' : ''}{Math.round(cmp.diff)}% vs avg
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Avg: {cmp.avg}</div>
                </div>
              );
            })}
          </div>

          {/* ACCOUNT AVERAGE CONTEXT */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Your account averages</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Avg likes', value: accountAverage.likes },
                { label: 'Avg comments', value: accountAverage.comments },
                { label: 'Avg shares', value: accountAverage.shares },
                { label: 'Avg score', value: accountAverage.performanceScore?.toFixed(0) },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.textSecondary, fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* PER-PLATFORM BREAKDOWN */}
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader icon={IpTrendingUp} title="Performance by platform" />
        {platformMetrics.length === 0 ? (
          <EmptyState icon={IpGlobe} title="No platform data yet" subtitle="Connect your social accounts to see per-platform engagement" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, platformMetrics.length)}, 1fr)`, gap: 16 }}>
            {platformMetrics.map((m) => {
              const meta = PLATFORM_META[m.platform] || { name: m.platform, icon: IpGlobe, color: t.primary };
              const Icon = meta.icon;
              const totalEng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
              return (
                <div key={m.platform} style={{ background: t.input, borderRadius: 12, padding: 18, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{meta.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{totalEng} total engagements</div>
                    </div>
                  </div>
                  {m.note ? (
                    <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>{m.note}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Likes', value: m.likes, icon: IpHeart, color: '#F43F5E' },
                        { label: 'Comments', value: m.comments, icon: IpComment, color: 'url(#brand-gradient)' },
                        { label: 'Shares', value: m.shares, icon: IpShare, color: t.success },
                        { label: 'Reach', value: m.reach, icon: IpEye, color: t.info },
                        { label: 'Impressions', value: m.impressions, icon: IpEye, color: t.textMuted },
                      ].filter((item) => item.value > 0).map(({ label, value, icon: MetricIcon, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MetricIcon size={12} style={{ color }} />
                            <span style={{ fontSize: 12, color: t.textSecondary }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'monospace' }}>{value?.toLocaleString()}</span>
                        </div>
                      ))}
                      {[...Array(5)].every((_, i) => [m.likes, m.comments, m.shares, m.reach, m.impressions][i] === 0) && (
                        <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>No engagement data yet</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* INSIGHTS */}
      {insights.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader icon={IpTip} title="Post insights" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {insights.map((insight) => {
              const Icon = INSIGHT_ICON[insight.assessment] || IpInfo;
              return (
                <div key={insight.type} style={{ padding: 14, background: t.input, borderRadius: 10, border: `1px solid ${t.border}`, display: 'flex', gap: 10 }}>
                  <Icon size={16} style={{ color: insight.assessment === 'good' ? t.success : insight.assessment.includes('consider') ? t.textMuted : t.warning, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 2 }}>{insight.label}</div>
                    <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{insight.value}</div>
                    <Badge variant={INSIGHT_COLOR[insight.assessment] || 'default'} style={{ marginTop: 6, fontSize: 10 }}>
                      {insight.assessment.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TIMELINE — only shown if we have snapshot data */}
      {data.timeline && data.timeline.length > 0 && (
        <Card>
          <SectionHeader icon={IpTrendingUp} title="Engagement timeline" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Platform', 'Likes', 'Comments', 'Shares', 'Reach', 'Snapshot time'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', color: t.textMuted, fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.timeline.map((snap, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '8px 12px', color: t.text, fontWeight: 500 }}>{PLATFORM_META[snap.platform]?.name || snap.platform}</td>
                    <td style={{ padding: '8px 12px', color: t.text, fontFamily: 'monospace' }}>{snap.likes}</td>
                    <td style={{ padding: '8px 12px', color: t.text, fontFamily: 'monospace' }}>{snap.comments}</td>
                    <td style={{ padding: '8px 12px', color: t.text, fontFamily: 'monospace' }}>{snap.shares}</td>
                    <td style={{ padding: '8px 12px', color: t.text, fontFamily: 'monospace' }}>{snap.reach}</td>
                    <td style={{ padding: '8px 12px', color: t.textMuted }}>{new Date(snap.snapshot_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Layout>
  );
}

