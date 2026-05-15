import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Card, Button, Badge, StatCard, SectionHeader, EmptyState, Spinner } from '../components/ui';
import { useTheme } from '../lib/theme';
import { receptionistAPI } from '../lib/api';
import {
  IpSparkle, IpSettings, IpInbox, IpTeam, IpActivity, IpCheckCircle,
  IpWarning, IpChevronRight, IpClose, IpBusiness, IpReview, IpCheck, IpPublish,
} from '../components/icons';

const BETA_BADGE = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.15)', color: '#ca8a04', fontSize: 11, fontWeight: 700, letterSpacing: 0.3 };

const STAGE_COLORS = {
  new:               '#6b7280',
  contacted:         '#3b82f6',
  qualified:         '#8b5cf6',
  booked:            '#f59e0b',
  completed:         '#22c55e',
  review_requested:  '#14b8a6',
  reviewed:          '#10b981',
};
const STAGE_LABELS = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  booked: 'Booked', completed: 'Completed',
  review_requested: 'Review Requested', reviewed: 'Reviewed',
};

export default function ReceptionistPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | conversations | leads | settings
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [stageCounts, setStageCounts] = useState({});
  const [conversations, setConversations] = useState([]);
  const [reviewActions, setReviewActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showAutoHandleWarning, setShowAutoHandleWarning] = useState(false);

  // Settings form state
  const [form, setForm] = useState({
    enabled: false,
    autoHandle: false,
    activePlatforms: [],
    tone: 'friendly',
    escalateKeywords: ['legal', 'lawsuit', 'refund', 'scam', 'terrible'],
    bookingLink: '',
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    afterHoursMessage: '',
    // Per-customer credentials
    twilioAccountSid: '',
    twilioAuthToken: '',       // write-only — never pre-populated from server
    twilioPhoneNumber: '',
    twilioWhatsappNumber: '',
    calcomApiKey: '',          // write-only — never pre-populated from server
  });
  const [newKeyword, setNewKeyword] = useState('');

  // Test simulator state
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Onboarding: show wizard if no config yet
  const [onboarding, setOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [cfgRes, statsRes, reviewRes] = await Promise.all([
        receptionistAPI.getConfig(),
        receptionistAPI.getStats(),
        receptionistAPI.getReviewActions().catch(() => ({ data: { actions: [] } })),
      ]);
      setReviewActions(reviewRes.data?.actions || []);
      const cfg = cfgRes.data?.config;
      setConfig(cfg);
      setStats(statsRes.data);

      if (!cfg) {
        setOnboarding(true);
      } else {
        setForm({
          enabled: cfg.enabled || false,
          autoHandle: cfg.auto_handle || false,
          activePlatforms: cfg.active_platforms || [],
          tone: cfg.tone || 'friendly',
          escalateKeywords: cfg.escalate_keywords || [],
          bookingLink: cfg.booking_link || '',
          businessHoursStart: cfg.business_hours_start || '08:00',
          businessHoursEnd: cfg.business_hours_end || '18:00',
          timezone: cfg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          afterHoursMessage: cfg.after_hours_message || '',
          // Pre-populate non-secret fields; auth tokens are write-only
          twilioAccountSid: cfg.twilio_account_sid || '',
          twilioAuthToken: '',       // never pre-populated
          twilioPhoneNumber: cfg.twilio_phone_number || '',
          twilioWhatsappNumber: cfg.twilio_whatsapp_number || '',
          calcomApiKey: '',          // never pre-populated
        });
      }
    } catch (err) {
      console.error('[receptionist] load:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      const { data } = await receptionistAPI.getLeads({ limit: 50 });
      setLeads(data?.leads || []);
      setStageCounts(data?.stageCounts || {});
    } catch {}
  };

  const loadConversations = async () => {
    try {
      const { data } = await receptionistAPI.getConversations({ limit: 30 });
      setConversations(data?.conversations || []);
    } catch {}
  };

  useEffect(() => {
    if (!loading && activeTab === 'leads') loadLeads();
    if (!loading && activeTab === 'conversations') loadConversations();
  }, [activeTab, loading]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload = {
        enabled: form.enabled,
        autoHandle: form.autoHandle,
        activePlatforms: form.activePlatforms,
        tone: form.tone,
        escalateKeywords: form.escalateKeywords,
        bookingLink: form.bookingLink || null,
        businessHoursStart: form.businessHoursStart,
        businessHoursEnd: form.businessHoursEnd,
        timezone: form.timezone,
        afterHoursMessage: form.afterHoursMessage || null,
        twilioAccountSid: form.twilioAccountSid || null,
        twilioPhoneNumber: form.twilioPhoneNumber || null,
        twilioWhatsappNumber: form.twilioWhatsappNumber || null,
      };
      // Only send secrets when the user has typed a new value
      if (form.twilioAuthToken) payload.twilioAuthToken = form.twilioAuthToken;
      if (form.calcomApiKey) payload.calcomApiKey = form.calcomApiKey;
      await receptionistAPI.saveConfig(payload);
      setSaveMsg('Settings saved');
      await loadAll();
      setOnboarding(false);
    } catch (err) {
      setSaveMsg('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await receptionistAPI.test(testMsg.trim());
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: err.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      activePlatforms: f.activePlatforms.includes(p)
        ? f.activePlatforms.filter(x => x !== p)
        : [...f.activePlatforms, p],
    }));
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !form.escalateKeywords.includes(kw)) {
      setForm(f => ({ ...f, escalateKeywords: [...f.escalateKeywords, kw] }));
    }
    setNewKeyword('');
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <Layout title="AI Receptionist">
        <Card><div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><Spinner size={36} /></div></Card>
      </Layout>
    );
  }

  // ── ONBOARDING WIZARD ────────────────────────────────────────────
  if (onboarding) {
    return (
      <Layout title="AI Receptionist" subtitle="Let's get your AI Receptionist set up">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <BetaBanner t={t} />
          <Card style={{ padding: 32 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: onboardingStep >= n ? t.primary : t.border, transition: 'background 300ms' }} />
              ))}
            </div>

            {onboardingStep === 1 && (
              <OnboardStep1 form={form} setForm={setForm} togglePlatform={togglePlatform} t={t} onNext={() => setOnboardingStep(2)} />
            )}
            {onboardingStep === 2 && (
              <OnboardStep2 form={form} setForm={setForm} t={t} onNext={() => setOnboardingStep(3)} onBack={() => setOnboardingStep(1)} />
            )}
            {onboardingStep === 3 && (
              <OnboardStep3 testMsg={testMsg} setTestMsg={setTestMsg} testResult={testResult} testing={testing} handleTest={handleTest} t={t} onNext={() => setOnboardingStep(4)} onBack={() => setOnboardingStep(2)} />
            )}
            {onboardingStep === 4 && (
              <OnboardStep4 form={form} setForm={setForm} saving={saving} saveMsg={saveMsg} handleSave={handleSave} t={t} onBack={() => setOnboardingStep(3)} />
            )}
          </Card>
        </div>
      </Layout>
    );
  }

  // ── TABS ─────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'leads', label: 'Leads' },
    { id: 'settings', label: 'Settings' },
  ];

  const titleAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={BETA_BADGE}>Beta</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: form.enabled ? 'rgba(34,197,94,0.1)' : t.card, border: `1px solid ${form.enabled ? 'rgba(34,197,94,0.3)' : t.border}` }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: form.enabled ? '#22c55e' : t.textMuted }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: form.enabled ? '#22c55e' : t.textMuted }}>{form.enabled ? 'Active' : 'Inactive'}</span>
      </div>
    </div>
  );

  return (
    <Layout title="AI Receptionist" subtitle="Your 24/7 automated lead handler" action={titleAction}>
      <BetaBanner t={t} />

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500,
              color: activeTab === tab.id ? t.primary : t.textSecondary,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${activeTab === tab.id ? t.primary : 'transparent'}`,
              marginBottom: -1, transition: 'all 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats} config={config} form={form} t={t} router={router}
          reviewActions={reviewActions}
          onEditSettings={() => setActiveTab('settings')}
          onSkipReview={async (id) => {
            try {
              await receptionistAPI.skipReviewAction(id);
              setReviewActions(prev => prev.filter(a => a.id !== id));
            } catch (_) {}
          }}
        />
      )}

      {/* CONVERSATIONS TAB */}
      {activeTab === 'conversations' && (
        <ConversationsTab conversations={conversations} t={t} router={router} />
      )}

      {/* LEADS TAB */}
      {activeTab === 'leads' && (
        <LeadsTab leads={leads} stageCounts={stageCounts} t={t} />
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <SettingsTab
          form={form} setForm={setForm} saving={saving} saveMsg={saveMsg}
          handleSave={handleSave} togglePlatform={togglePlatform}
          newKeyword={newKeyword} setNewKeyword={setNewKeyword} addKeyword={addKeyword}
          showAutoHandleWarning={showAutoHandleWarning} setShowAutoHandleWarning={setShowAutoHandleWarning}
          testMsg={testMsg} setTestMsg={setTestMsg} testResult={testResult}
          testing={testing} handleTest={handleTest} t={t} config={config}
        />
      )}
    </Layout>
  );
}

// ── Beta Banner ──────────────────────────────────────────────────────
function BetaBanner({ t }) {
  return (
    <div style={{ padding: '10px 16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <IpWarning size={14} style={{ color: '#ca8a04', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#ca8a04' }}>
        <strong>AI Receptionist is in Beta.</strong> Responses are AI-generated and may not always be perfect. Review conversations regularly and disable auto-handle if needed.
      </span>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────
function OverviewTab({ stats, config, form, t, router, reviewActions = [], onSkipReview, onEditSettings }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard label="AI handled today" value={stats?.aiHandledToday ?? 0} hint="Conversations auto-responded" accent="primary" />
        <StatCard label="Escalated (open)" value={stats?.escalatedOpen ?? 0} hint="Need your attention" accent={stats?.escalatedOpen > 0 ? 'error' : 'success'} />
        <StatCard label="Unread pending" value={stats?.pendingUnread ?? 0} hint="New messages waiting" accent="warning" />
      </div>

      {/* Review flywheel */}
      {reviewActions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {reviewActions.map(action => (
            <div key={action.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}><IpReview size={20} style={{ color: '#f59e0b' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 3 }}>{action.title}</div>
                {action.excerpt && (
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: 8 }}>
                    "{action.excerpt}{action.excerpt.length >= 120 ? '…' : ''}"
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ background: '#10b981', fontSize: 11 }}
                    onClick={() => router.push('/quick-post?type=customer_testimonial')}
                  >
                    Use as social post
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ fontSize: 11 }}
                    onClick={() => onSkipReview(action.id)}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <SectionHeader icon={IpSettings} title="Quick status" />
          <StatusRow label="Receptionist" value={config?.enabled ? 'Enabled' : 'Disabled'} ok={config?.enabled} />
          <StatusRow label="Auto-handle" value={config?.auto_handle ? 'On (sends automatically)' : 'Off (drafts only)'} ok={config?.auto_handle} warn={!config?.auto_handle} />
          <StatusRow label="Active platforms" value={(config?.active_platforms || []).join(', ') || 'None configured'} ok={(config?.active_platforms || []).length > 0} />
          <StatusRow label="Knowledge base" value="Connected" ok />
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary" size="sm" onClick={onEditSettings}>Edit settings</Button>
          </div>
        </Card>

        <Card>
          <SectionHeader icon={IpSparkle} title="Test your receptionist" />
          <TestSimulator t={t} />
        </Card>
      </div>

      {stats?.escalatedOpen > 0 && (
        <Card style={{ marginTop: 16, borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IpWarning size={18} style={{ color: t.error }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{stats.escalatedOpen} conversation{stats.escalatedOpen > 1 ? 's' : ''} need your attention</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Escalated conversations are waiting for a human response</div>
            </div>
            <Button variant="primary" size="sm" onClick={() => router.push('/inbox')}>View inbox</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusRow({ label, value, ok, warn }) {
  const color = ok ? '#22c55e' : warn ? '#f59e0b' : '#ef4444';
  const dot = ok ? '●' : warn ? '◐' : '○';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{dot} {value}</span>
    </div>
  );
}

function TestSimulator({ t }) {
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!msg.trim()) return;
    setTesting(true);
    setResult(null);
    try {
      const { data } = await receptionistAPI.test(msg.trim());
      setResult(data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Send a test message and see how your AI Receptionist would respond.</p>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="e.g. How much does drain cleaning cost?"
        style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) runTest(); }}
      />
      <Button variant="primary" size="sm" onClick={runTest} style={{ marginTop: 8 }} disabled={testing || !msg.trim()}>
        {testing ? 'Testing...' : 'Send test message'}
      </Button>
      {result && !result.error && (
        <div style={{ marginTop: 12, padding: 12, background: t.primaryBg, borderRadius: 8, border: `1px solid ${t.primaryBorder}` }}>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>
            Intent: <strong>{result.intent}</strong>
            {result.wouldEscalate && <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 700 }}>⚡ Would escalate</span>}
          </div>
          <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.6 }}>{result.reply}</p>
        </div>
      )}
      {result?.error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>{result.error}</div>
      )}
    </div>
  );
}

// ── Conversations Tab ────────────────────────────────────────────────
function ConversationsTab({ conversations, t, router }) {
  if (!conversations.length) {
    return (
      <Card>
        <EmptyState icon={IpInbox} title="No conversations yet" subtitle="Conversations handled by AI Receptionist will appear here" />
        <div style={{ textAlign: 'center', paddingBottom: 20 }}>
          <Button variant="secondary" onClick={() => router.push('/inbox')}>Open Inbox</Button>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      {conversations.map(conv => (
        <div
          key={conv.id}
          onClick={() => router.push('/inbox')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', borderRadius: 8, cursor: 'pointer', borderBottom: `1px solid ${t.border}` }}
          onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{conv.sender_name || 'Customer'}</span>
              <Badge variant={conv.platform === 'instagram' ? 'primary' : 'default'}>{conv.platform}</Badge>
              {conv.last_ai_handled && <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>AI</span>}
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{(conv.last_message || '').substring(0, 80)}</div>
          </div>
          <IpChevronRight size={14} color={t.textMuted} />
        </div>
      ))}
      <div style={{ padding: '12px 8px', textAlign: 'center' }}>
        <Button variant="ghost" onClick={() => router.push('/inbox')}>View all in Inbox</Button>
      </div>
    </Card>
  );
}

// ── Leads Tab ────────────────────────────────────────────────────────
function LeadsTab({ leads, stageCounts, t }) {
  const stages = ['new', 'contacted', 'qualified', 'booked', 'completed', 'review_requested', 'reviewed'];
  if (!leads.length) {
    return <Card><EmptyState icon={IpTeam} title="No leads yet" subtitle="Contacts with a receptionist stage will appear here once the AI Receptionist starts handling conversations" /></Card>;
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {stages.map(stage => {
          const count = stageCounts[stage] || 0;
          return (
            <div key={stage} style={{ padding: '6px 12px', borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, fontSize: 12 }}>
              <span style={{ color: STAGE_COLORS[stage], fontWeight: 700 }}>●</span>
              <span style={{ marginLeft: 6, color: t.textSecondary }}>{STAGE_LABELS[stage]}</span>
              {count > 0 && <span style={{ marginLeft: 6, background: STAGE_COLORS[stage], color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{count}</span>}
            </div>
          );
        })}
      </div>
      <Card>
        {leads.map(lead => (
          <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', borderBottom: `1px solid ${t.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{lead.name || lead.phone || 'Unknown'}</div>
              {lead.last_ai_summary && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{lead.last_ai_summary}</div>}
            </div>
            <Badge style={{ background: STAGE_COLORS[lead.receptionist_stage] + '20', color: STAGE_COLORS[lead.receptionist_stage], border: `1px solid ${STAGE_COLORS[lead.receptionist_stage]}40` }}>
              {STAGE_LABELS[lead.receptionist_stage] || lead.receptionist_stage}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Webhook URL row with copy button ────────────────────────────────
function WebhookUrlRow({ label, url, t }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: t.textMuted, width: 70, flexShrink: 0 }}>{label}:</span>
      <code style={{ flex: 1, fontSize: 11, color: t.text, background: 'transparent', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
      <button
        onClick={copy}
        style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${t.border}`, background: t.card, color: t.textSecondary, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
      >
        {copied ? <IpCheck size={14} /> : 'Copy'}
      </button>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────
function SettingsTab({ form, setForm, saving, saveMsg, handleSave, togglePlatform, newKeyword, setNewKeyword, addKeyword, showAutoHandleWarning, setShowAutoHandleWarning, testMsg, setTestMsg, testResult, testing, handleTest, t, config }) {
  const { t: theme } = useTheme();

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6, display: 'block' };

  const webhookBase = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:8080'
    : (process.env.NEXT_PUBLIC_API_URL || '');
  const smsWebhookUrl = `${webhookBase}/api/twilio/sms/inbound`;
  const waWebhookUrl = `${webhookBase}/api/twilio/whatsapp/inbound`;

  const platforms = [
    { id: 'instagram', label: 'Instagram DMs', note: 'Meta Business API' },
    { id: 'facebook', label: 'Facebook Messenger', note: 'Meta Business API' },
    { id: 'sms', label: 'SMS', note: 'Requires Twilio credentials below' },
    { id: 'whatsapp', label: 'WhatsApp Business', note: 'Requires Twilio credentials below' },
    { id: 'gmb', label: 'Google My Business', note: 'Requires GMB connection' },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Enable / Auto-handle */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpSparkle} title="Receptionist mode" />
        <ToggleRow
          label="Enable AI Receptionist"
          description="When enabled, your AI Receptionist monitors incoming DMs and generates responses"
          checked={form.enabled}
          onChange={v => setForm(f => ({ ...f, enabled: v }))}
          t={t}
        />
        <ToggleRow
          label="Auto-handle (sends automatically)"
          description="AI sends replies without waiting for your review. Only enable if you trust the responses."
          checked={form.autoHandle}
          onChange={v => {
            if (v) { setShowAutoHandleWarning(true); }
            else { setForm(f => ({ ...f, autoHandle: false })); }
          }}
          t={t}
          warn
        />
      </Card>

      {showAutoHandleWarning && (
        <div style={{ padding: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠ Enable auto-handle?</div>
          <p style={{ fontSize: 13, color: t.text, marginBottom: 16 }}>
            Auto-handle means your AI Receptionist will send replies directly to customers without you reviewing them first.
            This is an experimental feature. Monitor conversations closely after enabling.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" style={{ background: '#ef4444' }} onClick={() => { setForm(f => ({ ...f, autoHandle: true })); setShowAutoHandleWarning(false); }}>
              Yes, enable auto-handle
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAutoHandleWarning(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Active platforms */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpInbox} title="Active platforms" />
        {platforms.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{p.label}</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{p.note}</div>
            </div>
            <ToggleSwitch checked={form.activePlatforms.includes(p.id)} onChange={() => togglePlatform(p.id)} />
          </div>
        ))}
      </Card>

      {/* Twilio credentials */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpActivity} title="SMS & WhatsApp — Twilio" />
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Connect your own Twilio account to handle SMS and WhatsApp messages.
          Get your credentials at <strong>console.twilio.com</strong>.
          {config?.has_twilio_configured && (
            <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IpCheck size={12} style={{ color: '#22c55e' }} />Connected</span>
          )}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Account SID</label>
            <input
              value={form.twilioAccountSid}
              onChange={e => setForm(f => ({ ...f, twilioAccountSid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Auth Token {config?.has_twilio_configured && <span style={{ color: '#22c55e', fontWeight: 400 }}>(saved)</span>}</label>
            <input
              type="password"
              value={form.twilioAuthToken}
              onChange={e => setForm(f => ({ ...f, twilioAuthToken: e.target.value }))}
              placeholder={config?.has_twilio_configured ? '••••••••  (leave blank to keep)' : 'Paste your Auth Token'}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>SMS Phone Number</label>
            <input
              value={form.twilioPhoneNumber}
              onChange={e => setForm(f => ({ ...f, twilioPhoneNumber: e.target.value }))}
              placeholder="+12125551234"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp Number <span style={{ fontWeight: 400, color: t.textMuted }}>(optional)</span></label>
            <input
              value={form.twilioWhatsappNumber}
              onChange={e => setForm(f => ({ ...f, twilioWhatsappNumber: e.target.value }))}
              placeholder="+12125551234"
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Webhook URLs — paste these in Twilio console</div>
          <WebhookUrlRow label="SMS" url={smsWebhookUrl} t={t} />
          <WebhookUrlRow label="WhatsApp" url={waWebhookUrl} t={t} />
        </div>
      </Card>

      {/* Cal.com API */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpCheckCircle} title="Cal.com Booking API" />
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Connect your Cal.com account so the AI can show real availability when customers ask to book.
          Get your API key at <strong>cal.com/settings/developer/api-keys</strong>.
          {config?.has_calcom_configured && (
            <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IpCheck size={12} style={{ color: '#22c55e' }} />Connected</span>
          )}
        </p>
        <div>
          <label style={labelStyle}>Cal.com API Key {config?.has_calcom_configured && <span style={{ color: '#22c55e', fontWeight: 400 }}>(saved)</span>}</label>
          <input
            type="password"
            value={form.calcomApiKey}
            onChange={e => setForm(f => ({ ...f, calcomApiKey: e.target.value }))}
            placeholder={config?.has_calcom_configured ? '••••••••  (leave blank to keep)' : 'cal_live_xxxxxxxxxxxxxxxx'}
            style={inputStyle}
          />
        </div>
      </Card>

      {/* Tone + Booking */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpBusiness} title="Response style" />
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tone</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['friendly', 'professional', 'expert'].map(tone => (
              <button
                key={tone}
                onClick={() => setForm(f => ({ ...f, tone }))}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 150ms',
                  background: form.tone === tone ? t.primaryBg : t.card,
                  border: `1px solid ${form.tone === tone ? t.primaryBorder : t.border}`,
                  color: form.tone === tone ? t.primary : t.textSecondary,
                }}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Cal.com booking link (optional)</label>
          <input
            value={form.bookingLink}
            onChange={e => setForm(f => ({ ...f, bookingLink: e.target.value }))}
            placeholder="https://cal.com/yourbusiness"
            style={inputStyle}
          />
        </div>
      </Card>

      {/* Business hours */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Business hours" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Open</label>
            <input type="time" value={form.businessHoursStart} onChange={e => setForm(f => ({ ...f, businessHoursStart: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Close</label>
            <input type="time" value={form.businessHoursEnd} onChange={e => setForm(f => ({ ...f, businessHoursEnd: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Timezone</label>
          <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="e.g. America/New_York" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>After-hours message (optional)</label>
          <textarea
            value={form.afterHoursMessage}
            onChange={e => setForm(f => ({ ...f, afterHoursMessage: e.target.value }))}
            placeholder="Thanks for reaching out! We're currently closed but will respond first thing tomorrow morning."
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
          />
        </div>
      </Card>

      {/* Escalation keywords */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpWarning} title="Escalation keywords" />
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>When a customer message contains these words, the AI will stop and alert you immediately.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {form.escalateKeywords.map(kw => (
            <div key={kw} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{kw}</span>
              <button onClick={() => setForm(f => ({ ...f, escalateKeywords: f.escalateKeywords.filter(k => k !== kw) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <IpClose size={10} style={{ color: '#ef4444' }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="Add keyword..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button variant="secondary" size="sm" onClick={addKeyword}>Add</Button>
        </div>
      </Card>

      {/* Test simulator */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader icon={IpSparkle} title="Test receptionist" />
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Send a test message to see how your AI Receptionist would respond. Nothing is sent to real customers.</p>
        <textarea
          value={testMsg}
          onChange={e => setTestMsg(e.target.value)}
          placeholder="e.g. Do you fix burst pipes? How much would it cost?"
          style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleTest(); }}
        />
        <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing || !testMsg.trim()}>
          {testing ? 'Testing...' : 'Send test'}
        </Button>
        {testResult && !testResult.error && (
          <div style={{ marginTop: 12, padding: 12, background: t.primaryBg, borderRadius: 8, border: `1px solid ${t.primaryBorder}` }}>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>
              Intent: <strong>{testResult.intent}</strong>
              {testResult.wouldEscalate && <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 700 }}>⚡ Would escalate to you</span>}
            </div>
            <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.6 }}>{testResult.reply}</p>
          </div>
        )}
        {testResult?.error && <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>{testResult.error}</div>}
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('Failed') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>}
      </div>
    </div>
  );
}

// ── Toggle row component ─────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange, t, warn }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{description}</div>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} warn={warn} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange, warn }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? (warn ? '#ef4444' : '#7c5cfc') : '#d1d5db',
        position: 'relative', flexShrink: 0, transition: 'background 200ms',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Onboarding steps ─────────────────────────────────────────────────
function OnboardStep1({ form, setForm, togglePlatform, t, onNext }) {
  const platforms = [
    { id: 'instagram', label: 'Instagram DMs' },
    { id: 'facebook', label: 'Facebook Messenger' },
    { id: 'sms', label: 'SMS (Phase 2)' },
    { id: 'whatsapp', label: 'WhatsApp (Phase 2)' },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Connect your channels</h2>
      <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>Which platforms should your AI Receptionist monitor?</p>
      {platforms.map(p => (
        <div key={p.id} onClick={() => togglePlatform(p.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 10, border: `1px solid ${form.activePlatforms.includes(p.id) ? t.primaryBorder : t.border}`, background: form.activePlatforms.includes(p.id) ? t.primaryBg : t.card, marginBottom: 8, cursor: 'pointer', transition: 'all 150ms' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{p.label}</span>
          {form.activePlatforms.includes(p.id) && <IpCheckCircle size={16} style={{ color: t.primary }} />}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <Button variant="primary" onClick={onNext}>Next →</Button>
      </div>
    </div>
  );
}

function OnboardStep2({ form, setForm, t, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Booking + hours</h2>
      <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>Help your AI Receptionist book appointments and know when you're open.</p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6, display: 'block' }}>Cal.com booking link (optional)</label>
        <input
          value={form.bookingLink}
          onChange={e => setForm(f => ({ ...f, bookingLink: e.target.value }))}
          placeholder="https://cal.com/yourbusiness or leave blank"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6, display: 'block' }}>Open time</label>
          <input type="time" value={form.businessHoursStart} onChange={e => setForm(f => ({ ...f, businessHoursStart: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6, display: 'block' }}>Close time</label>
          <input type="time" value={form.businessHoursEnd} onChange={e => setForm(f => ({ ...f, businessHoursEnd: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext}>Next →</Button>
      </div>
    </div>
  );
}

function OnboardStep3({ testMsg, setTestMsg, testResult, testing, handleTest, t, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Test your receptionist</h2>
      <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>Make sure your knowledge base is set up. Send a test message to see how the AI responds.</p>
      <textarea
        value={testMsg}
        onChange={e => setTestMsg(e.target.value)}
        placeholder="e.g. How much does a drain cleaning cost?"
        style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleTest(); }}
      />
      <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing || !testMsg.trim()}>
        {testing ? 'Testing...' : 'Send test'}
      </Button>
      {testResult && !testResult.error && (
        <div style={{ marginTop: 12, padding: 12, background: t.primaryBg, borderRadius: 8, border: `1px solid ${t.primaryBorder}` }}>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Intent: <strong>{testResult.intent}</strong></div>
          <p style={{ fontSize: 13, color: t.text, margin: 0 }}>{testResult.reply}</p>
        </div>
      )}
      <p style={{ fontSize: 12, color: t.textMuted, marginTop: 16 }}>
        Not happy with the response? <a href="/knowledge-base" style={{ color: t.primary }}>Add more to your Knowledge Base</a> first.
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext}>Looks good →</Button>
      </div>
    </div>
  );
}

function OnboardStep4({ form, setForm, saving, saveMsg, handleSave, t, onBack }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Go live</h2>
      <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>Enable your AI Receptionist and choose whether it should send replies automatically or just prepare drafts for you to review.</p>
      <div style={{ padding: 16, background: t.card, borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Enable AI Receptionist</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>Start monitoring and responding to messages</div>
          </div>
          <ToggleSwitch checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
        </div>
      </div>
      <div style={{ padding: 16, background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Auto-handle (experimental)</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>AI sends replies automatically. We recommend starting with this OFF and enabling later once you've reviewed a few responses.</div>
          </div>
          <ToggleSwitch checked={form.autoHandle} onChange={v => setForm(f => ({ ...f, autoHandle: v }))} warn />
        </div>
      </div>
      {saveMsg && <div style={{ marginBottom: 12, fontSize: 13, color: saveMsg.startsWith('Failed') ? '#ef4444' : '#22c55e' }}>{saveMsg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Setting up...' : <><IpPublish size={14} /> Go Live</>}
        </Button>
      </div>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
