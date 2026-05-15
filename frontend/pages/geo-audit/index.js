import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpSearch, IpRefresh, IpArrowRight, IpTrendingUp, IpInfo, IpWarning, IpClose, IpPlus,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, SectionHeader, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { geoAPI, authAPI } from '../../lib/api';

const LOADING_MESSAGES = [
  'Asking ChatGPT about your business...',
  'Checking Perplexity for local recommendations...',
  'Querying Claude about your industry...',
  'Analysing competitor mentions...',
  'Scanning for trust signals the AI looks for...',
  'Identifying which platforms the AI recommends...',
  'PostCore is reading the results...',
  'Calculating your AI visibility score...',
];

const FOCUS_OPTIONS = [
  { value: 'all',        label: 'All Services' },
  { value: 'residential', label: 'Residential' },
  { value: 'emergency',  label: 'Emergency / 24-7' },
  { value: 'commercial', label: 'Commercial' },
];

function ScoreGauge({ score, t }) {
  const color = score >= 70 ? t.success : score >= 40 ? t.warning : t.error;
  const label = score >= 70 ? 'Strong Foundation' : score >= 40 ? 'Emerging — clear path ahead' : 'Invisible — here\'s your playbook';
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{
        width: 120, height: 120, borderRadius: '50%', margin: '0 auto 16px',
        background: `conic-gradient(${color} ${score * 3.6}deg, ${t.border} 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', background: t.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
    </div>
  );
}

export default function GeoAuditPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [latestAudit, setLatestAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Config form state
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [serviceFocus, setServiceFocus] = useState('all');
  const [competitors, setCompetitors] = useState(['', '', '']);

  const pollRef = useRef(null);
  const msgRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [scoreRes, latestRes, historyRes, profileRes] = await Promise.all([
        geoAPI.getScore().catch(() => ({ data: {} })),
        geoAPI.getLatest().catch(() => ({ data: { audit: null } })),
        geoAPI.getHistory().catch(() => ({ data: { history: [] } })),
        authAPI.verify().catch(() => ({ data: {} })),
      ]);
      setScoreData(scoreRes.data);
      setLatestAudit(latestRes.data.audit);
      setHistory(historyRes.data.history || []);

      const customer = profileRes.data?.customer || {};
      setProfile(customer);
      setBusinessName(customer.business_name || '');
      setLocation(customer.location || '');

      if (latestRes.data.audit?.status === 'running') {
        setRunning(true);
        startPolling();
      }
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    let msgIdx = 0;
    msgRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(msgIdx);
    }, 4000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await geoAPI.getLatest();
        const audit = res.data.audit;
        if (audit?.status === 'complete' || audit?.status === 'failed') {
          stopPolling();
          setRunning(false);
          setLatestAudit(audit);
          const [scoreRes, histRes] = await Promise.all([
            geoAPI.getScore().catch(() => ({ data: {} })),
            geoAPI.getHistory().catch(() => ({ data: { history: [] } })),
          ]);
          setScoreData(scoreRes.data);
          setHistory(histRes.data.history || []);
          if (audit.status === 'failed') {
            setError('The audit encountered an error. Please try again.');
          }
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (msgRef.current) { clearInterval(msgRef.current); msgRef.current = null; }
  }

  useEffect(() => () => stopPolling(), []);

  async function handleRunAudit() {
    if (!location.trim()) {
      setError('Please enter your city or service area.');
      return;
    }
    setError('');
    setRunning(true);
    setLoadingMsg(0);
    try {
      await geoAPI.runAudit({
        businessName: businessName.trim(),
        location: location.trim(),
        serviceFocus,
        competitors: competitors.filter(Boolean),
      });
      startPolling();
    } catch (err) {
      setRunning(false);
      const msg = err.response?.data?.error || 'Failed to start audit';
      setError(msg);
      if (err.response?.status === 409) {
        startPolling();
        setRunning(true);
      }
    }
  }

  function updateCompetitor(idx, val) {
    const next = [...competitors];
    next[idx] = val;
    setCompetitors(next);
  }

  if (!mounted || loading) return null;

  const hasCompleted = latestAudit?.status === 'complete';
  const isFree = !scoreData?.freeAuditUsed;

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    background: t.input, border: `1px solid ${t.border}`,
    borderRadius: 8, color: t.text, outline: 'none', boxSizing: 'border-box',
  };
  const chipStyle = (active) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? t.primaryBg : 'transparent',
    color: active ? t.primary : t.textMuted,
    transition: 'all 150ms',
  });

  return (
    <Layout
      title="GEO Audit"
      subtitle="AI visibility check across ChatGPT, Claude & Perplexity"
      action={
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          ← Dashboard
        </Button>
      }
    >
      {running ? (
        /* ── LOADING STATE ── */
        <Card style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <Spinner size={48} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>
            Running your GEO Audit...
          </div>
          <div style={{ fontSize: 13, color: t.textMuted, minHeight: 20, transition: 'opacity 300ms' }}>
            {LOADING_MESSAGES[loadingMsg]}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: t.textMuted }}>
            Checking 15 questions across 3 AI engines — takes about 60–90 seconds
          </div>
        </Card>
      ) : !hasCompleted ? (
        /* ── NO AUDIT YET — CONFIG + CTA STATE ── */
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <IpWarning size={15} color={t.error} />
              <span style={{ fontSize: 13, color: t.error }}>{error}</span>
            </div>
          )}

          {/* Hero */}
          <Card style={{ marginBottom: 20, textAlign: 'center', padding: '32px 32px 24px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <IpSearch size={28} color="#fff" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: t.text }}>
              Find Out If AI Recommends Your Business
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: t.textSecondary, lineHeight: 1.7, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              PostCore runs 15 searches across ChatGPT, Claude, and Perplexity — then tells you
              exactly who's beating you, what trust signals the AI looks for, and which platforms
              you're missing from.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 0, flexWrap: 'wrap' }}>
              {[
                { label: '15 AI searches', sub: 'across 3 engines' },
                { label: isFree ? 'Free' : '10 credits', sub: isFree ? 'no credits needed' : 'per audit' },
                { label: '~90 seconds', sub: 'to complete' },
              ].map(({ label, sub }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{sub}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Config form */}
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader icon={IpInfo} title="Confirm your audit details" subtitle="Pre-filled from your profile — adjust anything before running" />
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business name</label>
                  <input
                    style={inputStyle}
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Mike's Plumbing"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>City / service area <span style={{ color: t.error }}>*</span></label>
                  <input
                    style={{ ...inputStyle, borderColor: !location.trim() ? t.error : t.border }}
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Austin, TX"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service focus</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FOCUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setServiceFocus(opt.value)}
                      style={chipStyle(serviceFocus === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Known competitors <span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none' }}>(optional — we'll track if they appear)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {competitors.map((val, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <input
                        style={{ ...inputStyle, paddingRight: val ? 36 : 12 }}
                        value={val}
                        onChange={e => updateCompetitor(idx, e.target.value)}
                        placeholder={`Competitor ${idx + 1} name`}
                      />
                      {val && (
                        <button
                          onClick={() => updateCompetitor(idx, '')}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.textMuted }}
                        >
                          <IpClose size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleRunAudit} style={{ justifyContent: 'center' }}>
                <IpSearch size={15} style={{ marginRight: 8 }} />
                {isFree ? 'Run Free GEO Audit' : 'Run GEO Audit (10 credits)'}
              </Button>
            </div>
          </Card>

          {/* What we check */}
          <Card>
            <SectionHeader icon={IpInfo} title="What the audit checks" />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { group: 'A', label: 'Brand visibility', desc: '"Who is the best plumber in [your city]?" — 5 direct queries', color: '#7C5CFC' },
                { group: 'B', label: 'Competitive intel', desc: '"What are the top plumbers in [your city]?" — extracts who AI actually recommends', color: '#F97316' },
                { group: 'C', label: 'Trust signal analysis', desc: '"What should I look for when hiring a plumber?" — reveals the AI\'s trust criteria', color: '#22C55E' },
                { group: 'D', label: 'Platform intelligence', desc: '"Where can I find plumber reviews?" — shows which directories the AI sends customers to', color: '#3B82F6' },
              ].map(({ group, label, desc, color }) => (
                <div key={group} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginTop: 1 }}>{group}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* ── HAS COMPLETED AUDIT — SCORE STATE ── */
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <IpWarning size={15} color={t.error} />
              <span style={{ fontSize: 13, color: t.error }}>{error}</span>
            </div>
          )}

          <Card style={{ marginBottom: 20 }}>
            <ScoreGauge score={latestAudit.geo_score || 0} t={t} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
                {latestAudit.report_data?.summary || `Your business appeared in ${latestAudit.citations_found || 0} of ${latestAudit.total_queries || 45} AI searches.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => router.push(`/geo-audit/${latestAudit.id}`)} style={{ justifyContent: 'center' }}>
                View Full Report <IpArrowRight size={14} style={{ marginLeft: 6 }} />
              </Button>
              <Button variant="secondary" onClick={() => setLatestAudit({ ...latestAudit, status: 'reset' })} style={{ justifyContent: 'center' }}>
                <IpRefresh size={14} style={{ marginRight: 6 }} />
                Re-configure & Run Again
              </Button>
            </div>
          </Card>

          {/* Score history */}
          {history.length > 1 && (
            <Card>
              <SectionHeader icon={IpTrendingUp} title="Score History" />
              <div style={{ marginTop: 12 }}>
                {history.slice(0, 6).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => router.push(`/geo-audit/${h.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: `1px solid ${t.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${h.geo_score >= 70 ? 'rgba(34,197,94,0.1)' : h.geo_score >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: h.geo_score >= 70 ? t.success : h.geo_score >= 40 ? t.warning : t.error,
                      }}>
                        {h.geo_score}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                          {h.citations_found || 0} of {h.total_queries || 45} brand citations
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>
                          {new Date(h.created_at).toLocaleDateString()}
                          {h.is_free && <span style={{ marginLeft: 6, color: t.primary, fontWeight: 600 }}>FREE</span>}
                        </div>
                      </div>
                    </div>
                    <IpArrowRight size={13} color={t.textMuted} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
