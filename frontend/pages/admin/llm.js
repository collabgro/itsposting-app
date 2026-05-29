import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpSparkle, IpAnalytics, IpDatabase, IpRefresh, IpCheck,
  IpWarning, IpTrendingUp, IpTeam, IpAdmin, IpChevronRight,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const TABS = [
  { id: 'overview',  label: 'Overview',      icon: IpSparkle },
  { id: 'training',  label: 'Training Data',  icon: IpDatabase },
  { id: 'models',    label: 'Model Versions', icon: IpAdmin },
  { id: 'ab',        label: 'A/B Testing',    icon: IpAnalytics },
  { id: 'quality',   label: 'Quality Monitor',icon: IpTrendingUp },
  { id: 'curated',   label: 'Curated Examples',icon: IpTeam },
];

const THRESHOLD = 10000;

export default function AdminLLM() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [trainingData, setTrainingData] = useState([]);
  const [trainingTotal, setTrainingTotal] = useState(0);
  const [models, setModels] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [curated, setCurated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadOverview();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (tab === 'training') loadTraining();
    if (tab === 'models') loadModels();
    if (tab === 'ab') loadExperiments();
    if (tab === 'curated') loadCurated();
  }, [tab, mounted]);

  const loadOverview = async () => {
    try {
      const res = await adminAPI.getLLMOverview();
      setOverview(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Admin access required.');
        setTimeout(() => router.replace('/dashboard'), 2000);
      } else {
        setError('Failed to load LLM overview');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTraining = async () => {
    try {
      const res = await adminAPI.getLLMTrainingData({ limit: 20 });
      setTrainingData(res.data.examples || []);
      setTrainingTotal(res.data.total || 0);
    } catch {}
  };

  const loadModels = async () => {
    try {
      const res = await adminAPI.getLLMModels();
      setModels(res.data.models || []);
    } catch {}
  };

  const loadExperiments = async () => {
    try {
      const res = await adminAPI.getLLMExperiments();
      setExperiments(res.data.experiments || []);
    } catch {}
  };

  const loadCurated = async () => {
    try {
      const res = await adminAPI.getLLMCuratedExamples();
      setCurated(res.data.examples || []);
    } catch {}
  };

  if (!mounted) return null;

  if (error) {
    return (
      <Layout title="PostCore Brain — Admin">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: t.error }}>{error}</div>
        </div>
      </Layout>
    );
  }

  const tabStyle = (id) => ({
    padding: '8px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: tab === id
      ? 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)'
      : 'transparent',
    color: tab === id ? '#fff' : t.textMuted,
    transition: 'all 160ms ease',
    display: 'flex', alignItems: 'center', gap: 6,
  });

  return (
    <Layout title="PostCore Brain — Admin">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>

        {/* Header */}
        <div style={{ ...gc, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #5B21B6, #7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(124,92,252,0.35)' }}>
                <IpSparkle size={26} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>PostCore Brain</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>ItsPosting proprietary LLM — Admin only. Not visible to customers.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}>
                PRE-TRAINING PHASE
              </span>
              <Button variant="ghost" size="sm" onClick={loadOverview} style={{ gap: 6 }}>
                <IpRefresh size={13} /> Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20, padding: '6px 8px', background: t.isDark ? 'rgba(15,15,24,0.5)' : t.card, borderRadius: 14, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}` }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab ────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>Loading...</div>
            ) : overview ? (
              <>
                {/* Training progress */}
                <div style={gc}>
                  <SectionHeader icon={IpDatabase} title="Training Data Progress" subtitle={`${overview.trainingExamples.toLocaleString()} examples collected — need ${THRESHOLD.toLocaleString()} to train first model`} />
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{overview.trainingExamples.toLocaleString()} / {THRESHOLD.toLocaleString()} examples</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.primary }}>{overview.progressPct}%</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${overview.progressPct}%`, borderRadius: 8, background: 'linear-gradient(90deg, #5B21B6, #7C5CFC, #A78BFA)', transition: 'width 600ms ease', boxShadow: '0 0 12px rgba(124,92,252,0.5)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>
                      {overview.progressPct < 100
                        ? `${(THRESHOLD - overview.trainingExamples).toLocaleString()} more examples needed before first training run`
                        : 'Threshold reached — training run available'}
                    </div>
                  </div>
                </div>

                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total examples', value: overview.trainingExamples.toLocaleString(), icon: IpDatabase, color: '#7C5CFC' },
                    { label: 'With user selection', value: overview.withSelection.toLocaleString(), icon: IpCheck, color: '#10B981' },
                    { label: 'With reach data', value: overview.withReach.toLocaleString(), icon: IpTrendingUp, color: '#3B82F6' },
                    { label: 'Avg quality score', value: overview.avgQuality ? `${overview.avgQuality}/5` : 'No data yet', icon: IpSparkle, color: '#F59E0B' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} style={{ ...gc, marginBottom: 0, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* By industry */}
                {overview.byIndustry && overview.byIndustry.length > 0 && (
                  <div style={gc}>
                    <SectionHeader icon={IpAnalytics} title="Training Data by Industry" subtitle="Examples per industry — imbalanced coverage may affect model quality" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                      {overview.byIndustry.map(({ industry, count }) => {
                        const pct = Math.min(100, Math.round((parseInt(count) / overview.trainingExamples) * 100));
                        return (
                          <div key={industry} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 110, fontSize: 12, fontWeight: 600, color: t.text, flexShrink: 0, textTransform: 'capitalize' }}>{industry.replace('_', ' ')}</div>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'linear-gradient(90deg, #7C5CFC, #A78BFA)' }} />
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted, width: 55, textAlign: 'right', flexShrink: 0 }}>{parseInt(count).toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Current model status */}
                <div style={gc}>
                  <SectionHeader icon={IpAdmin} title="Current Model Configuration" subtitle="All traffic currently served by Claude — PostCore Brain not yet trained" />
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>claude-sonnet-4-6</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>Production — Anthropic API</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge variant="success">Active</Badge>
                        <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>100%</span>
                      </div>
                    </div>
                    {models.filter(m => m.status !== 'retired').map(model => (
                      <div key={model.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: model.status === 'production' ? '#10B981' : '#F59E0B' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{model.version_name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{model.base_model} — {model.training_examples?.toLocaleString()} examples</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge variant={model.status === 'production' ? 'success' : 'warning'}>{model.status}</Badge>
                          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{model.traffic_pct}%</span>
                        </div>
                      </div>
                    ))}
                    {models.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: t.textMuted }}>
                        No PostCore Brain models trained yet. Collect {(THRESHOLD - overview.trainingExamples).toLocaleString()} more examples to begin.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Training Data tab ────────────────────────────────────── */}
        {tab === 'training' && (
          <div style={gc}>
            <SectionHeader icon={IpDatabase} title="Training Data" subtitle={`${trainingTotal.toLocaleString()} examples total — collected automatically from wizard generations`} />
            {trainingData.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpDatabase size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No training data yet</div>
                <div style={{ fontSize: 13, color: t.textMuted }}>Training examples are collected automatically each time a customer uses the wizard.</div>
              </div>
            ) : (
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['ID', 'Industry', 'Content Type', 'Variation', 'Edited', 'Reach', 'Engagement', 'Quality', 'Model', 'Date'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: t.textMuted, fontWeight: 600, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trainingData.map(ex => (
                      <tr key={ex.id} style={{ borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : t.border}` }}>
                        <td style={{ padding: '8px 12px', color: t.textMuted }}>{ex.id}</td>
                        <td style={{ padding: '8px 12px', color: t.text, textTransform: 'capitalize' }}>{ex.industry?.replace('_', ' ') || '—'}</td>
                        <td style={{ padding: '8px 12px', color: t.text }}>{ex.content_type?.replace('_', ' ') || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {ex.variation_selected ? <Badge variant="success">{ex.variation_selected}</Badge> : <span style={{ color: t.textMuted }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {ex.was_edited ? <Badge variant="warning">Edited</Badge> : <span style={{ color: t.textMuted }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: t.text }}>{ex.post_reach || '—'}</td>
                        <td style={{ padding: '8px 12px', color: t.text }}>{ex.post_engagement || '—'}</td>
                        <td style={{ padding: '8px 12px', color: t.text }}>{ex.quality_score ? `${ex.quality_score}/5` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: t.textMuted, fontSize: 11 }}>{ex.model_used?.split('-').slice(-1)[0] || '—'}</td>
                        <td style={{ padding: '8px 12px', color: t.textMuted, whiteSpace: 'nowrap' }}>{ex.created_at ? new Date(ex.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Model Versions tab ───────────────────────────────────── */}
        {tab === 'models' && (
          <div style={gc}>
            <SectionHeader icon={IpAdmin} title="Model Versions" subtitle="History of all PostCore Brain training runs" />
            {models.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpAdmin size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No models trained yet</div>
                <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 400, margin: '0 auto' }}>
                  Collect {THRESHOLD.toLocaleString()} training examples to unlock the first training run.
                  Training runs happen monthly on RunPod A100 (~$200/run).
                </div>
                <div style={{ marginTop: 20, padding: '14px 20px', background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, display: 'inline-block' }}>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Planned base model</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 3 }}>Llama 3.1 8B Instruct (MIT License)</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Fine-tuning method: LoRA (rank 16) · Target: ~150ms inference</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {models.map(model => (
                  <div key={model.id} style={{ padding: '16px 18px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{model.version_name}</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{model.base_model}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Badge variant={model.status === 'production' ? 'success' : model.status === 'staging' ? 'warning' : 'default'}>{model.status}</Badge>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{model.traffic_pct}% traffic</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                      {[
                        ['Training examples', model.training_examples?.toLocaleString() || '—'],
                        ['BLEU score', model.eval_bleu || '—'],
                        ['Human score', model.eval_human_score ? `${model.eval_human_score}/5` : '—'],
                        ['Trained', model.trained_at ? new Date(model.trained_at).toLocaleDateString() : '—'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── A/B Testing tab ──────────────────────────────────────── */}
        {tab === 'ab' && (
          <div style={gc}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionHeader icon={IpAnalytics} title="A/B Experiments" subtitle="Compare PostCore Brain vs Claude on live traffic" />
              {models.length > 0 && (
                <Button variant="primary" size="sm" onClick={() => {}}>New experiment</Button>
              )}
            </div>
            {experiments.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpAnalytics size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No experiments yet</div>
                <div style={{ fontSize: 13, color: t.textMuted }}>
                  {models.length === 0
                    ? 'Train a model first, then run an A/B experiment to compare quality vs Claude.'
                    : 'Create an experiment to test the trained model on a % of live wizard traffic.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {experiments.map(exp => (
                  <div key={exp.id} style={{ padding: '16px 18px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Experiment #{exp.id} — {exp.version_name || 'Unknown model'}</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{exp.traffic_pct}% traffic · Started {new Date(exp.started_at).toLocaleDateString()}</div>
                      </div>
                      <Badge variant={exp.result === 'promoted' ? 'success' : exp.result === 'rolled_back' ? 'error' : 'default'}>
                        {exp.result || 'ongoing'}
                      </Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                      {[
                        ['Total calls', exp.calls_total?.toLocaleString() || '0'],
                        ['Selection rate', exp.user_selection_rate ? `${(exp.user_selection_rate * 100).toFixed(1)}%` : '—'],
                        ['Edit rate', exp.edit_rate ? `${(exp.edit_rate * 100).toFixed(1)}%` : '—'],
                        ['Avg reach', exp.avg_reach ? Math.round(exp.avg_reach).toLocaleString() : '—'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {exp.notes && <div style={{ marginTop: 10, fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>{exp.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quality Monitor tab ──────────────────────────────────── */}
        {tab === 'quality' && (
          <div style={gc}>
            <SectionHeader icon={IpTrendingUp} title="Quality Monitor" subtitle="Real-time quality signals — lower edit rate and regeneration rate = better model" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
              <div style={{ padding: '20px 24px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Live metrics (last 24h)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
                  {[
                    { label: 'PostCore Brain calls', value: '0', note: 'Model not in production yet' },
                    { label: 'Claude calls', value: overview?.trainingExamples > 0 ? '—' : '—', note: 'From wizard generations' },
                    { label: 'Avg latency (Claude)', value: '~2,200ms', note: 'p50 estimate' },
                    { label: 'User edit rate', value: '—', note: 'Lower = better quality' },
                    { label: 'Regeneration rate', value: '—', note: 'Lower = fewer do-overs' },
                  ].map(({ label, value, note }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '16px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <IpWarning size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#D97706', marginBottom: 4 }}>Quality monitoring is not yet active</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      Quality charts will appear here once PostCore Brain is in production and handling live traffic.
                      Metrics tracked: user edit rate, regeneration rate, variation selection rate (A/B/C), post reach comparison.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Curated Examples tab ─────────────────────────────────── */}
        {tab === 'curated' && (
          <div style={gc}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionHeader icon={IpTeam} title="Curated Gold Examples" subtitle="Human-annotated high-quality examples that anchor fine-tuning quality" />
              <Button variant="primary" size="sm" onClick={() => {}}>Add example</Button>
            </div>
            {curated.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpTeam size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No curated examples yet</div>
                <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 420, margin: '0 auto' }}>
                  Add 200 hand-crafted "gold standard" posts per industry (10 industries × 200 = 2,000 total).
                  These are the quality anchors the fine-tuned model learns from.
                </div>
                <div style={{ marginTop: 20, padding: '12px 20px', background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, display: 'inline-block', fontSize: 12, color: t.textMuted }}>
                  Target: 2,000 curated examples across 10 industries
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {curated.map(ex => (
                  <div key={ex.id} style={{ padding: '14px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{ex.industry?.replace('_', ' ')} — {ex.content_type?.replace('_', ' ')}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>{'⭐'.repeat(Math.round(ex.quality_score || 0))}</span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{ex.annotated_by}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{JSON.stringify(ex.ideal_output?.variation_a?.caption || '').substring(0, 120)}...</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
