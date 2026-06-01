import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpSearch, IpRefresh, IpArrowRight, IpTrendingUp, IpEdit, IpWarning, IpClose, IpPlus,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, SectionHeader, Spinner } from '../../components/ui';
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
  const glow = score >= 70 ? 'rgba(34,197,94,0.3)' : score >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
  const inner = Math.round(size * 0.73);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${color} ${score * 3.6}deg, ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border} 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 3px ${glow}, 0 4px 16px ${glow}` }}>
      <div style={{ width: inner, height: inner, borderRadius: '50%', background: t.isDark ? 'rgba(12,12,20,0.95)' : t.card, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
  const [isMobile, setIsMobile] = useState(false);

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
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
          if (audit.status === 'complete') {
            router.push(`/geo-audit/${audit.id}`);
            return;
          }
          // failed — stay on page, show error + refreshed state
          setLatestAudit(audit);
          const [scoreRes, histRes] = await Promise.all([
            geoAPI.getScore().catch(() => ({ data: {} })),
            geoAPI.getHistory().catch(() => ({ data: { history: [] } })),
          ]);
          setScoreData(scoreRes.data);
          setHistory(histRes.data.history || []);
          setError('The audit encountered an error. Please try again.');
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
      if (err.response?.status === 409) {
        // Audit already running — resume polling silently
        startPolling();
        return;
      }
      setRunning(false);
      setError(err.response?.data?.error || 'Failed to start audit');
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
    padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    border: `1.5px solid ${active ? 'rgba(124,92,252,0.5)' : t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`,
    background: active ? (t.isDark ? 'rgba(124,92,252,0.14)' : 'rgba(124,92,252,0.08)') : t.isDark ? 'rgba(15,15,24,0.6)' : 'transparent',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: active ? t.primary : t.textMuted,
    transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
    boxShadow: active ? '0 3px 10px rgba(124,92,252,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
    transform: active ? 'translateY(-1px)' : 'none',
  });
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const scrapedAtLabel = scrapedData?.scrapedAt
    ? `Scanned ${new Date(scrapedData.scrapedAt).toLocaleDateString()}`
    : '';

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  return (
    <Layout
      title="AI Visibility"
      subtitle="AI visibility across ChatGPT, Claude & Perplexity"
      action={<Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>}
    >
      {running ? (
        /* ── LOADING STATE ── */
        <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: '48px 32px', background: t.isDark ? 'rgba(15,15,24,0.82)' : t.card, backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', borderRadius: 22, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          {/* ambient glow */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(124,92,252,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ marginBottom: 24, position: 'relative' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 8px 28px rgba(124,92,252,0.4)', animation: 'geo-pulse 2s ease-in-out infinite' }}>
              <IpSearch size={28} color="#fff" />
            </div>
            <div style={{ position: 'absolute', inset: -8, top: -8, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#7C5CFC', animation: 'spin 1.2s linear infinite' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 10, letterSpacing: '-0.02em', position: 'relative' }}>Checking your AI visibility...</div>
          <div style={{ fontSize: 13, color: t.primary, minHeight: 22, transition: 'opacity 400ms', fontWeight: 500, position: 'relative' }}>
            {LOADING_MESSAGES[loadingMsg]}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: t.textMuted, position: 'relative' }}>
            15 questions × 3 AI engines · 60–90 seconds
          </div>
          <style>{`
            @keyframes geo-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
            @keyframes spin { to{transform:rotate(360deg)} }
          `}</style>
        </div>
      ) : (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Error banner */}
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <IpWarning size={15} color={t.error} />
              <span style={{ fontSize: 13, color: t.error }}>{error}</span>
            </div>
          )}

          {/* Two-column layout: config form left, score + history right */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT: Config card ── */}
            <div style={{ ...gc, marginBottom: 0 }}>
              <SectionHeader
                icon={IpEdit}
                title={hasCompleted ? 'Run Another Check' : 'Set Up Your Visibility Check'}
                subtitle="Pre-filled from your profile — adjust anything before running"
              />

              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 24 }}>

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

                {/* RIGHT column — Audit config */}
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
                  {isFree ? 'Run Free Visibility Check' : 'Run Visibility Check — 5 credits'}
                </Button>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: t.textMuted }}>
                  15 questions × 3 AI engines · takes about 60–90 seconds
                </div>
              </div>
            </div>

            {/* ── RIGHT: Score card + Past audits sidebar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Latest score card */}
              {hasCompleted ? (
                <div style={{ ...gc, marginBottom: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <ScoreRing score={score} size={96} t={t} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: scoreColor, marginBottom: 4 }}>{scoreLabel}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                        {latestAudit.report_data?.summary
                          ? latestAudit.report_data.summary.substring(0, 100) + (latestAudit.report_data.summary.length > 100 ? '…' : '')
                          : `${latestAudit.citations_found || 0} of ${latestAudit.total_queries || 45} AI searches found your business`}
                      </div>
                    </div>
                    <Button onClick={() => router.push(`/geo-audit/${latestAudit.id}`)} style={{ width: '100%', justifyContent: 'center' }}>
                      View Full Report <IpArrowRight size={13} style={{ marginLeft: 4 }} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ ...gc, marginBottom: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #7C5CFC22, #5B3FF022)', border: `1px solid ${t.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IpSearch size={22} color={t.primary} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>No audits yet</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                        Run your first free AI Visibility Check to see how often your business appears when local customers search for your services.
                      </div>
                    </div>
                    {isFree && (
                      <div style={{ padding: '8px 14px', background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(91,63,240,0.08))', border: `1px solid ${t.primary}30`, borderRadius: 10, fontSize: 12, color: t.primary, fontWeight: 600 }}>
                        First check is FREE
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Past audits */}
              {history.length > 0 && (
                <div style={{ ...gc, marginBottom: 0 }}>
                  <SectionHeader icon={IpTrendingUp} title="Past Audits" />
                  <div style={{ marginTop: 12 }}>
                    {history.slice(0, 8).map((h) => {
                      const hColor = h.geo_score >= 70 ? t.success : h.geo_score >= 40 ? t.warning : t.error;
                      return (
                        <div
                          key={h.id}
                          onClick={() => router.push(`/geo-audit/${h.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`, cursor: 'pointer', borderRadius: 8, transition: 'all 150ms ease' }}
                          onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : t.cardHover; e.currentTarget.style.paddingLeft = '12px'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '8px'; }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${hColor}18`, border: `1px solid ${hColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: hColor, flexShrink: 0 }}>
                            {h.geo_score || 0}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                              {h.citations_found || 0}/{h.total_queries || 45} searches
                            </div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{new Date(h.created_at).toLocaleDateString()}</div>
                          </div>
                          {h.is_free && <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>FREE</span>}
                          <IpArrowRight size={12} color={t.textMuted} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}

