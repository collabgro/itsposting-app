import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpSparkle, IpPlus, IpDelete, IpRefresh, IpArrowRight,
  IpCheck, IpWarning, IpClose, IpGlobe, IpTrendingUp, IpAnalytics,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Skeleton, ErrorCard, useToast } from '../components/ui';
import { useTheme } from '../lib/theme';
import { competitorAPI } from '../lib/api';

const MAX = 3;

function CardSection({ title, icon, children, t }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function OpportunityCard({ opp, t, onUse }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, marginBottom: 8,
      background: t.isDark ? 'rgba(124,92,252,0.07)' : 'rgba(124,92,252,0.05)',
      border: `1px solid rgba(124,92,252,0.2)`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, marginBottom: 3 }}>{opp.angle}</div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>{opp.why}</div>
          {opp.wizardHint && (
            <div style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic' }}>
              Wizard: "{opp.wizardHint}"
            </div>
          )}
        </div>
        <button
          onClick={() => onUse(opp)}
          style={{
            flexShrink: 0, padding: '6px 12px', background: t.primary, border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(124,92,252,0.3)',
          }}
        >
          Use this <IpArrowRight size={10} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function CompetitorCard({ comp, t, onDelete, onAnalyze, onUseOpportunity, analyzing }) {
  const [expanded, setExpanded] = useState(true);
  const analysis = comp.analysis;

  return (
    <div style={{
      background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
      borderRadius: 16,
      boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        borderBottom: analysis ? `1px solid ${t.border}` : 'none',
        background: t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.08))',
          border: `1px solid rgba(124,92,252,0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IpGlobe size={16} color={t.primary} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {comp.name || comp.website}
          </div>
          {comp.name && comp.website && (
            <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comp.website}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {comp.scraped_at && (
            <span style={{ fontSize: 10, color: t.textMuted, padding: '2px 7px', background: t.input, borderRadius: 5, alignSelf: 'center' }}>
              {new Date(comp.scraped_at).toLocaleDateString()}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => onAnalyze(comp.id)} loading={analyzing === comp.id} style={{ whiteSpace: 'nowrap' }}>
            <IpRefresh size={12} /> {comp.scraped_at ? 'Re-analyze' : 'Analyze'} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 2 }}>1 cr</span>
          </Button>
          <button
            onClick={() => onDelete(comp.id)}
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7, cursor: 'pointer', color: t.textMuted }}
            title="Remove competitor"
          >
            <IpDelete size={13} />
          </button>
        </div>
      </div>

      {/* Analysis content */}
      {analysis && (
        <div style={{ padding: '16px 20px' }}>
          {/* Headline */}
          {analysis.headline && (
            <div style={{
              fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.5,
              marginBottom: 14, padding: '10px 14px',
              background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
              borderRadius: 8, borderLeft: `3px solid ${t.primary}`,
            }}>
              {analysis.headline}
            </div>
          )}

          {/* Signal pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {analysis.pricingSignal && (
              <div style={{ fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>💰</span> {analysis.pricingSignal}
              </div>
            )}
            {analysis.reviewSignal && (
              <div style={{ fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>⭐</span> {analysis.reviewSignal}
              </div>
            )}
            {analysis.socialSignal && (
              <div style={{ fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>📱</span> {analysis.socialSignal}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Strengths */}
            {analysis.strengths?.length > 0 && (
              <CardSection title="Their strengths" icon="🎯" t={t}>
                {analysis.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: '#EF4444', flexShrink: 0, marginTop: 1 }}>•</span>
                    <span style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </CardSection>
            )}
            {/* Gaps */}
            {analysis.gaps?.length > 0 && (
              <CardSection title="Their gaps" icon="💡" t={t}>
                {analysis.gaps.map((g, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: '#22C55E', flexShrink: 0, marginTop: 1 }}>•</span>
                    <span style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>{g}</span>
                  </div>
                ))}
              </CardSection>
            )}
          </div>

          {/* Opportunities */}
          {analysis.contentOpportunities?.length > 0 && (
            <CardSection title="Content opportunities for you" icon="✨" t={t}>
              {analysis.contentOpportunities.map((opp, i) => (
                <OpportunityCard key={i} opp={opp} t={t} onUse={onUseOpportunity} />
              ))}
            </CardSection>
          )}

          {/* Verdict */}
          {analysis.overallVerdict && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: t.isDark ? 'rgba(124,92,252,0.1)' : 'rgba(124,92,252,0.07)',
              border: `1px solid rgba(124,92,252,0.2)`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                PostCore's verdict
              </div>
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{analysis.overallVerdict}</div>
            </div>
          )}
        </div>
      )}

      {!analysis && !analyzing && (
        <div style={{ padding: '14px 20px', fontSize: 13, color: t.textMuted }}>
          Hit "Analyze" to let PostCore study this competitor and show you content opportunities.
        </div>
      )}

      {analyzing === comp.id && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${t.primaryBorder}`, borderTopColor: t.primary, animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center' }}>
            Scraping their website and running PostCore analysis…<br />
            <span style={{ fontSize: 11, color: t.textMuted }}>This takes 15–30 seconds</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

export default function CompetitorIntelPage() {
  const { t } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    load();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  async function load() {
    try {
      setLoadError(false);
      const res = await competitorAPI.list();
      setCompetitors(res.data.competitors || []);
    } catch (err) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      const res = await competitorAPI.add({ name: addName.trim(), website: addUrl.trim() });
      setCompetitors(prev => [...prev, res.data.competitor]);
      setAddName(''); setAddUrl('');
      setShowAdd(false);
      showToast('success', 'Competitor added');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to add competitor');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this competitor?')) return;
    try {
      await competitorAPI.remove(id);
      setCompetitors(prev => prev.filter(c => c.id !== id));
      showToast('success', 'Competitor removed');
    } catch {
      showToast('error', 'Failed to remove competitor');
    }
  }

  async function handleAnalyze(id) {
    setAnalyzing(id);
    try {
      const res = await competitorAPI.analyze(id);
      setCompetitors(prev => prev.map(c => c.id === id ? res.data.competitor : c));
      showToast('success', `Analysis complete — ${res.data.creditsUsed} credit used`);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Analysis failed');
    } finally {
      setAnalyzing(null);
    }
  }

  function handleUseOpportunity(opp) {
    // Pre-fill wizard with the opportunity hint
    const hint = opp.wizardHint || opp.angle;
    router.push(`/wizard?details=${encodeURIComponent(hint)}`);
  }

  return (
    <Layout
      title="Competitor Intel"
      subtitle="See what competitors are doing — then do it better"
      action={
        competitors.length < MAX && !showAdd ? (
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <IpPlus size={14} strokeWidth={2.5} /> Add Competitor
          </Button>
        ) : null
      }
    >
      {/* Info banner */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20,
        padding: '14px 18px', borderRadius: 12,
        background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.06)',
        border: `1px solid rgba(124,92,252,0.2)`,
      }}>
        <IpSparkle size={16} color={t.primary} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          <strong style={{ color: t.text }}>How this works:</strong> Add up to {MAX} competitors by website URL.
          PostCore scrapes their site and generates a strategic breakdown — strengths, gaps, and 3 content angles you can use to outcompete them.
          Each analysis costs 1 credit.
        </div>
      </div>

      {/* Add competitor form */}
      {showAdd && (
        <div style={{
          marginBottom: 20, padding: '18px 20px',
          background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`,
          borderRadius: 14,
          boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>Add a Competitor</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 5 }}>
                Nickname (optional)
              </label>
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="e.g. Main rival"
                style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = t.primary}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 5 }}>
                Website URL *
              </label>
              <input
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="https://competitorbusiness.com"
                style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = t.primary}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={handleAdd} loading={adding} disabled={!addUrl.trim()}>
              Add Competitor
            </Button>
            <Button variant="secondary" onClick={() => { setShowAdd(false); setAddName(''); setAddUrl(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1].map(i => <Skeleton key={i} height={120} borderRadius={16} />)}
        </div>
      ) : loadError ? (
        <ErrorCard title="Could not load competitors" message="Check your connection and try again." onRetry={load} />
      ) : competitors.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 32px',
          background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
          borderRadius: 16,
          boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Know your competition</div>
          <div style={{ fontSize: 14, color: t.textMuted, maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>
            Add a competitor's website and PostCore will analyze their positioning, find their content gaps, and show you 3 angles to win more local customers.
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <IpPlus size={14} strokeWidth={2.5} /> Add Your First Competitor
          </Button>
        </div>
      ) : (
        <>
          {competitors.map(comp => (
            <CompetitorCard
              key={comp.id}
              comp={comp}
              t={t}
              onDelete={handleDelete}
              onAnalyze={handleAnalyze}
              onUseOpportunity={handleUseOpportunity}
              analyzing={analyzing}
            />
          ))}
          {competitors.length < MAX && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'transparent', border: `1.5px dashed ${t.border}`, borderRadius: 12,
                color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 150ms, color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.color = t.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
            >
              <IpPlus size={14} /> Add another competitor ({competitors.length}/{MAX})
            </button>
          )}
        </>
      )}
    </Layout>
  );
}
