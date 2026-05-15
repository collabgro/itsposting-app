import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpSearch, IpRefresh, IpArrowRight, IpTrendingUp, IpEdit, IpWarning, IpClose, IpPlus,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, SectionHeader, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { geoAPI, authAPI, scraperAPI } from '../../lib/api';

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

function ScoreRing({ score, size, t }) {
  const color = score >= 70 ? t.success : score >= 40 ? t.warning : t.error;
  const inner = Math.round(size * 0.73);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${color} ${score * 3.6}deg, ${t.border} 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: inner, height: inner, borderRadius: '50%', background: t.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: Math.round(size * 0.27), fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: Math.round(size * 0.14), color: t.textMuted, lineHeight: 1.2 }}>/100</span>
      </div>
    </div>
  );
}

export default function GeoAuditPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [latestAudit, setLatestAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Config form
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [serviceFocus, setServiceFocus] = useState('all');
  const [competitors, setCompetitors] = useState(['', '', '']);

  // Scraped data
  const [scrapedData, setScrapedData] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [serviceInput, setServiceInput] = useState('');

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
      const [scoreRes, latestRes, historyRes, profileRes, scraperRes] = await Promise.all([
        geoAPI.getScore().catch(() => ({ data: {} })),
        geoAPI.getLatest().catch(() => ({ data: { audit: null } })),
        geoAPI.getHistory().catch(() => ({ data: { history: [] } })),
        authAPI.verify().catch(() => ({ data: {} })),
        scraperAPI.getData().catch(() => ({ data: { hasData: false } })),
      ]);

      setScoreData(scoreRes.data);
      setLatestAudit(latestRes.data.audit);
      setHistory(historyRes.data.history || []);

      const customer = profileRes.data?.customer || {};
      setBusinessName(customer.business_name || '');
      setLocation(customer.location || '');

      const sd = scraperRes.data;
      setScrapedData(sd);
      if (sd?.hasData && Array.isArray(sd.services)) {
        setSelectedServices(sd.services.slice(0, 12));
      }

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
          if (audit.status === 'failed') setError('The audit encountered an error. Please try again.');
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
        services: selectedServices,
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

  const removeService = (idx) => setSelectedServices(s => s.filter((_, i) => i !== idx));
  const addService = () => {
    const v = serviceInput.trim();
    if (v && !selectedServices.includes(v)) setSelectedServices(s => [...s, v]);
    setServiceInput('');
  };

  if (!mounted || loading) return null;

  const hasCompleted = latestAudit?.status === 'complete';
  const isFree = !scoreData?.freeAuditUsed;
  const score = latestAudit?.geo_score || 0;
  const scoreColor = score >= 70 ? t.success : score >= 40 ? t.warning : t.error;
  const scoreLabel = score >= 70 ? 'Strong Foundation' : score >= 40 ? 'Emerging' : 'Invisible';

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
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const scrapedAtLabel = scrapedData?.scrapedAt
    ? `Scanned ${new Date(scrapedData.scrapedAt).toLocaleDateString()}`
    : '';

  return (
    <Layout
      title="GEO Audit"
      subtitle="AI visibility across ChatGPT, Claude & Perplexity"
      action={<Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>}
    >
      {running ? (
        /* ── LOADING STATE ── */
        <Card style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}><Spinner size={48} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>Running your GEO Audit...</div>
          <div style={{ fontSize: 13, color: t.textMuted, minHeight: 20, transition: 'opacity 300ms' }}>
            {LOADING_MESSAGES[loadingMsg]}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: t.textMuted }}>
            Checking 15 questions across 3 AI engines — takes about 60–90 seconds
          </div>
        </Card>
      ) : (
        <div style={{ maxWidth: 700, margin: '0 auto' }}>

          {/* Error banner */}
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <IpWarning size={15} color={t.error} />
              <span style={{ fontSize: 13, color: t.error }}>{error}</span>
            </div>
          )}

          {/* Compact score banner (only when a completed audit exists) */}
          {hasCompleted && (
            <Card style={{ marginBottom: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreRing score={score} size={56} t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor }}>{score}/100 — {scoreLabel}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    {latestAudit.report_data?.summary
                      ? latestAudit.report_data.summary.substring(0, 90) + (latestAudit.report_data.summary.length > 90 ? '…' : '')
                      : `${latestAudit.citations_found || 0} of ${latestAudit.total_queries || 45} AI searches`}
                  </div>
                </div>
                <Button size="sm" onClick={() => router.push(`/geo-audit/${latestAudit.id}`)} style={{ flexShrink: 0 }}>
                  View Report <IpArrowRight size={13} style={{ marginLeft: 4 }} />
                </Button>
              </div>
            </Card>
          )}

          {/* Config card */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              icon={IpEdit}
              title={hasCompleted ? 'Run Another Audit' : 'Set Up Your GEO Audit'}
              subtitle="Pre-filled from your profile — adjust anything before running"
            />

            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>

              {/* LEFT — Business context */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div>
                  <label style={labelStyle}>Business name</label>
                  <input
                    style={inputStyle}
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Mike's Plumbing"
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    City / service area <span style={{ color: t.error }}>*</span>
                  </label>
                  <input
                    style={{ ...inputStyle, borderColor: !location.trim() ? t.error : t.border }}
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Austin, TX"
                  />
                </div>

                {/* Website services (scraped) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Your services</label>
                    {scrapedData?.hasData && scrapedAtLabel && (
                      <span style={{ fontSize: 10, color: t.textMuted }}>{scrapedAtLabel}</span>
                    )}
                  </div>

                  {scrapedData?.hasData ? (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 30 }}>
                        {selectedServices.map((svc, idx) => (
                          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 20, fontSize: 12, color: t.text }}>
                            {svc}
                            <button
                              onClick={() => removeService(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.textMuted, lineHeight: 1, display: 'flex' }}
                            >
                              <IpClose size={11} />
                            </button>
                          </span>
                        ))}
                        {selectedServices.length === 0 && (
                          <span style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>All services removed — add some below</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={serviceInput}
                          onChange={e => setServiceInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addService()}
                          placeholder="Add a service..."
                        />
                        <button
                          onClick={addService}
                          disabled={!serviceInput.trim()}
                          style={{ padding: '9px 12px', background: t.primaryBg, border: `1px solid ${t.primary}`, borderRadius: 8, cursor: serviceInput.trim() ? 'pointer' : 'not-allowed', opacity: serviceInput.trim() ? 1 : 0.5, color: t.primary, display: 'flex', alignItems: 'center' }}
                        >
                          <IpPlus size={14} />
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
                        These help the AI audit target your actual work. Manage saved services in{' '}
                        <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.primary, fontSize: 10 }}>Settings</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        No website data yet.{' '}
                        <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.primary, fontSize: 12, fontWeight: 600 }}>
                          Scan your website in Settings
                        </button>{' '}
                        for more targeted audit questions.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — Audit config */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div>
                  <label style={labelStyle}>Service focus</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FOCUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setServiceFocus(opt.value)}
                        style={{ ...chipStyle(serviceFocus === opt.value), textAlign: 'left' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Known competitors{' '}
                    <span style={{ color: t.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {competitors.map((val, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <input
                          style={{ ...inputStyle, paddingRight: val ? 34 : 12 }}
                          value={val}
                          onChange={e => updateCompetitor(idx, e.target.value)}
                          placeholder={`Competitor ${idx + 1}`}
                        />
                        {val && (
                          <button
                            onClick={() => updateCompetitor(idx, '')}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.textMuted }}
                          >
                            <IpClose size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Run button */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
              <Button onClick={handleRunAudit} style={{ justifyContent: 'center', width: '100%' }}>
                <IpSearch size={15} style={{ marginRight: 8 }} />
                {isFree ? 'Run Free GEO Audit' : 'Run GEO Audit — 5 credits'}
              </Button>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: t.textMuted }}>
                15 questions × 3 AI engines · takes about 60–90 seconds
              </div>
            </div>
          </Card>

          {/* Past audits */}
          {history.length > 0 && (
            <Card>
              <SectionHeader icon={IpTrendingUp} title="Past Audits" />
              <div style={{ marginTop: 12 }}>
                {history.slice(0, 6).map((h) => {
                  const hColor = h.geo_score >= 70 ? t.success : h.geo_score >= 40 ? t.warning : t.error;
                  return (
                    <div
                      key={h.id}
                      onClick={() => router.push(`/geo-audit/${h.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${hColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: hColor, flexShrink: 0 }}>
                        {h.geo_score || 0}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                          {h.citations_found || 0} of {h.total_queries || 45} searches
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{new Date(h.created_at).toLocaleDateString()}</div>
                      </div>
                      {h.is_free && <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>FREE</span>}
                      <IpArrowRight size={12} color={t.textMuted} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
