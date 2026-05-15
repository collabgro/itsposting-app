import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpArrowLeft, IpCheckCircle, IpCloseCircle, IpTrendingUp, IpSparkle,
  IpWarning, IpRefresh, IpInfo, IpTeam, IpArrowRight, IpSearch, IpExternalLink,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, Badge, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { geoAPI } from '../../lib/api';

const IMPACT_VARIANT = { high: 'success', medium: 'warning', low: 'default' };
const EFFORT_VARIANT = { high: 'error', medium: 'warning', low: 'success' };
const VERDICT_COLOR = { high: 'success', medium: 'warning', low: 'error' };

const PLATFORM_DISPLAY = {
  yelp: 'Yelp',
  angi: 'Angi',
  angie: 'Angi',
  homeadvisor: 'HomeAdvisor',
  google: 'Google Business',
  nextdoor: 'Nextdoor',
  thumbtack: 'Thumbtack',
  houzz: 'Houzz',
  bark: 'Bark',
  porch: 'Porch',
  taskrabbit: 'TaskRabbit',
  facebook: 'Facebook',
  bbb: 'BBB',
  'better business bureau': 'BBB',
  bing: 'Bing Places',
};

function ScoreRing({ score, size = 100, t }) {
  const color = score >= 70 ? t.success : score >= 40 ? t.warning : t.error;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `conic-gradient(${color} ${score * 3.6}deg, ${t.border} 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <div style={{ width: size - 22, height: size - 22, borderRadius: '50%', background: t.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.24, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.1, color: t.textMuted, textTransform: 'uppercase' }}>/100</span>
      </div>
    </div>
  );
}

export default function GeoAuditReport() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  useEffect(() => {
    if (!mounted || !id) return;
    loadAudit();
  }, [mounted, id]);

  async function loadAudit() {
    setLoading(true);
    try {
      const res = await geoAPI.getAudit(id);
      setAudit(res.data.audit);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/geo-audit');
      else setError('Failed to load audit report');
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  if (loading) {
    return (
      <Layout title="GEO Audit Report" action={<Button variant="ghost" onClick={() => router.push('/geo-audit')}>← Back</Button>}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spinner size={40} />
        </div>
      </Layout>
    );
  }

  if (error || !audit) {
    return (
      <Layout title="GEO Audit Report" action={<Button variant="ghost" onClick={() => router.push('/geo-audit')}>← Back</Button>}>
        <EmptyState icon={IpWarning} title="Report not found" subtitle={error || 'This audit may have been removed.'} action={<Button onClick={() => router.push('/geo-audit')}>Back to GEO Audit</Button>} />
      </Layout>
    );
  }

  if (audit.status === 'running') {
    return (
      <Layout title="GEO Audit Report" action={<Button variant="ghost" onClick={() => router.push('/geo-audit')}>← Back</Button>}>
        <Card style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: 40 }}>
          <Spinner size={48} />
          <p style={{ margin: '20px 0 0', color: t.textMuted, fontSize: 14 }}>Audit is still running…</p>
          <Button variant="secondary" style={{ marginTop: 16 }} onClick={() => router.push('/geo-audit')}>
            ← Back to GEO Audit
          </Button>
        </Card>
      </Layout>
    );
  }

  const report = audit.report_data || {};
  const verdict = report.verdict || 'low';
  const score = audit.geo_score || 0;
  const scoreColor = score >= 70 ? t.success : score >= 40 ? t.warning : t.error;
  const competitors = report.topCompetitors || [];
  const recommendations = report.recommendations || [];
  const queryGrid = report.queryGrid || [];
  const trustSignals = report.trustSignalSummary || [];
  const platforms = report.platformSummary || [];

  // Score label
  const scoreLabel = score >= 70 ? 'Strong Foundation' : score >= 40 ? 'Emerging' : 'Invisible';

  return (
    <Layout
      title="GEO Audit Report"
      subtitle={`${audit.industry || ''} · ${audit.location || ''}`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={loadAudit}>
            <IpRefresh size={13} /> Refresh
          </Button>
          <Button variant="ghost" onClick={() => router.push('/geo-audit')}>
            <IpArrowLeft size={13} /> Back
          </Button>
        </div>
      }
    >
      {/* ── 1. SCORE CARD ── */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreRing score={score} size={110} t={t} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>AI Visibility Score</h2>
              <Badge variant={VERDICT_COLOR[verdict]}>{scoreLabel}</Badge>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
              {report.summary || `Your business appeared in ${audit.citations_found || 0} of ${audit.total_queries || 45} AI searches.`}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>{audit.citations_found || 0}</span>
                <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 4 }}>brand citations</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{audit.total_queries || 45}</span>
                <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 4 }}>total searches</span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, alignSelf: 'center' }}>
                {new Date(audit.created_at).toLocaleDateString()}
              </div>
            </div>
            {/* Score breakdown hint */}
            <p style={{ margin: '10px 0 0', fontSize: 11, color: t.textMuted, fontStyle: 'italic' }}>
              Score = brand mentions + market competition + trust signal richness
            </p>
          </div>
        </div>
      </Card>

      {/* ── 2. QUERY GRID ── */}
      {queryGrid.length > 0 && (
        <Card style={{ marginBottom: 20, padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
            <SectionHeader icon={IpSearch} title="Search Results" subtitle={`${queryGrid.length} questions across ChatGPT, Claude & Perplexity`} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: t.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Question
                  </th>
                  {['ChatGPT', 'Claude', 'Perplexity'].map(e => (
                    <th key={e} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryGrid.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: t.textSecondary, fontStyle: 'italic', maxWidth: 320 }}>
                      "{row.question}"
                    </td>
                    {[row.chatgpt, row.claude, row.perplexity].map((mentioned, j) => (
                      <td key={j} style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {mentioned
                          ? <IpCheckCircle size={16} color={t.success} />
                          : <IpCloseCircle size={16} color={`${t.error}80`} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 3. COMPETITORS ── */}
      {competitors.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader icon={IpTeam} title="Who's Being Recommended Instead" subtitle="Businesses most frequently cited by AI engines in your area" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {competitors.map((c, i) => (
              <div key={i} style={{ padding: '14px 16px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#FB923C,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: t.textMuted }}>
                      appeared in {c.appearances} search{c.appearances !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
                {c.gap && (
                  <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                    <strong style={{ color: t.text }}>Why they rank: </strong>{c.gap}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 4. TRUST SIGNAL ANALYSIS ── */}
      {trustSignals.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader icon={IpCheckCircle} title="What the AI Expects to See" subtitle="Trust criteria that appeared across AI searches — these are the signals that get businesses recommended" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trustSignals.map((ts, i) => {
              const pct = Math.round((ts.count / (ts.total || 45)) * 100);
              const isStrong = pct >= 50;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
                  {isStrong
                    ? <IpCheckCircle size={15} color={t.success} />
                    : <IpCloseCircle size={15} color={`${t.error}80`} />
                  }
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{ts.signal}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isStrong ? t.success : t.textMuted }}>
                      {ts.count}/{ts.total || 45}
                    </span>
                    <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>searches</span>
                  </div>
                  <div style={{ width: 60 }}>
                    <div style={{ height: 4, borderRadius: 2, background: t.border }}>
                      <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: isStrong ? t.success : t.error }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '12px 14px', background: `${t.primary}10`, borderRadius: 8, border: `1px solid ${t.primary}30` }}>
            <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              <strong style={{ color: t.text }}>PostCore tip: </strong>
              {trustSignals[0]
                ? `"${trustSignals[0].signal}" appeared in ${trustSignals[0].count} of ${trustSignals[0].total || 45} searches. If you don't have content that demonstrates this, create one today using the wizard below.`
                : 'Create content that demonstrates your credentials — licensed, insured, and years of experience. These are what the AI looks for when recommending a business.'}
            </p>
          </div>
        </Card>
      )}

      {/* ── 5. PLATFORM INTELLIGENCE ── */}
      {platforms.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader icon={IpInfo} title="Where Customers Are Looking" subtitle="Platforms the AI recommended when people asked where to find your type of business" />
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {platforms.map((p, i) => {
                const displayName = PLATFORM_DISPLAY[p.platform?.toLowerCase()] || p.platform;
                return (
                  <a
                    key={i}
                    href={p.url || '#'}
                    target={p.url ? '_blank' : '_self'}
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 20,
                      background: t.input, border: `1px solid ${t.border}`,
                      fontSize: 12, fontWeight: 600, color: t.text,
                      textDecoration: 'none', cursor: p.url ? 'pointer' : 'default',
                    }}
                  >
                    {displayName}
                    <span style={{ fontSize: 10, color: t.textMuted }}>({p.count}x)</span>
                    {p.url && <IpExternalLink size={11} color={t.textMuted} />}
                  </a>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              Click any platform to create or claim your listing. Each one you're listed on increases
              the chance of appearing in AI recommendations.
            </p>
          </div>
        </Card>
      )}

      {/* ── 6. RECOMMENDATIONS ── */}
      {recommendations.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader icon={IpSparkle} title="Your 5-Action Plan" subtitle="PostCore's recommendations based on exactly what was found in your audit" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: '16px',
                background: t.input,
                border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${t.primary}`,
                borderRadius: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: t.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: t.primary, flexShrink: 0 }}>
                    {rec.priority || i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                      {rec.action}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {rec.impact && (
                        <Badge variant={IMPACT_VARIANT[rec.impact] || 'default'}>
                          {rec.impact} impact
                        </Badge>
                      )}
                      {rec.effort && (
                        <Badge variant={EFFORT_VARIANT[rec.effort] || 'default'}>
                          {rec.effort} effort
                        </Badge>
                      )}
                      {rec.wizardCta && rec.wizardParams && (
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => {
                            const params = new URLSearchParams(rec.wizardParams).toString();
                            router.push(`/wizard?${params}`);
                          }}
                        >
                          {rec.wizardCta} <IpArrowRight size={11} style={{ marginLeft: 4 }} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 7. TRACK PROGRESS ── */}
      <Card>
        <SectionHeader icon={IpTrendingUp} title="Track Your Progress" />
        <p style={{ margin: '12px 0 20px', fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          Re-run this audit in 30 days after implementing the recommendations above.
          PostCore will show you which AI searches now mention your business.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button onClick={() => router.push('/geo-audit')} variant="secondary">
            <IpRefresh size={14} style={{ marginRight: 6 }} />
            View All Audits
          </Button>
          <Button onClick={() => router.push('/wizard')} variant="ghost">
            <IpSparkle size={14} style={{ marginRight: 6 }} />
            Create Content Now
          </Button>
        </div>
      </Card>
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
