import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useTheme } from '../../lib/theme';
import { agencyAPI } from '../../lib/api';
import { IpPlus, IpClose, IpDelete, IpTeam, IpDollar } from '../../components/icons';
import { Spinner, SectionHeader } from '../../components/ui';

const DEFAULT_FLAGS = {
  wizard: true, quick_post: true, calendar: true, analytics: true,
  geo_audit: false, inbox: false, competitor_intel: false,
  templates: true, media_library: true, api_keys: false,
};

const FLAG_LABELS = {
  wizard:          'Post Wizard',
  quick_post:      'Quick Post',
  calendar:        'Calendar',
  analytics:       'Analytics',
  geo_audit:       'AI Visibility (GEO Audit)',
  inbox:           'Inbox',
  competitor_intel:'Competitor Intel',
  templates:       'Templates',
  media_library:   'Media Library',
  api_keys:        'API Keys',
};

function PlanModal({ t, plan, onClose, onSaved }) {
  const isEdit = !!plan;
  const [form, setForm] = useState({
    name:              plan?.name              || '',
    creditsPerMonth:   plan?.credits_per_month || 50,
    monthlyCapEnabled: plan?.monthly_cap_enabled || false,
    priceMonthly:      plan?.price_monthly     || '',
    priceYearly:       plan?.price_yearly      || '',
    featureFlags:      { ...DEFAULT_FLAGS, ...(plan?.feature_flags || {}) },
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Plan name required.'); return; }
    if (!form.creditsPerMonth || form.creditsPerMonth < 1) { setErr('Credits must be at least 1.'); return; }
    setSaving(true);
    setErr('');
    const payload = {
      name:             form.name.trim(),
      creditsPerMonth:  parseInt(form.creditsPerMonth),
      monthlyCapEnabled: !!form.monthlyCapEnabled,
      priceMonthly:     form.priceMonthly ? parseFloat(form.priceMonthly) : null,
      priceYearly:      form.priceYearly  ? parseFloat(form.priceYearly)  : null,
      featureFlags:     form.featureFlags,
    };
    try {
      const { data } = isEdit
        ? await agencyAPI.updatePlan(plan.id, payload)
        : await agencyAPI.createPlan(payload);
      onSaved(isEdit ? data.plan : data.plan);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const boxStyle     = { background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' };
  const labelStyle   = { display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 };
  const inputStyle   = { width: '100%', padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, boxSizing: 'border-box' };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{isEdit ? 'Edit Plan' : 'Create Plan'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Plan Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter, Pro, Premium" autoFocus />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Credits per Month *</label>
            <input type="number" min="1" style={inputStyle} value={form.creditsPerMonth} onChange={e => setForm(f => ({ ...f, creditsPerMonth: e.target.value }))} />
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>How many credits clients on this plan receive monthly.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={form.monthlyCapEnabled}
                onChange={e => setForm(f => ({ ...f, monthlyCapEnabled: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Enforce monthly cap</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Block client usage once they've hit their credit limit.</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Your Price / Month ($)</label>
              <input type="number" min="0" step="0.01" style={inputStyle} value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: e.target.value }))} placeholder="e.g. 49.00" />
            </div>
            <div>
              <label style={labelStyle}>Your Price / Year ($)</label>
              <input type="number" min="0" step="0.01" style={inputStyle} value={form.priceYearly} onChange={e => setForm(f => ({ ...f, priceYearly: e.target.value }))} placeholder="e.g. 470.00" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 18 }}>Prices are for your records only — billing your clients is handled separately.</div>

          {/* Feature Flags */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Features Clients Can Access</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: 6 }}>
              {Object.entries(FLAG_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!form.featureFlags[key]}
                    onChange={e => setForm(f => ({ ...f, featureFlags: { ...f.featureFlags, [key]: e.target.checked } }))}
                    style={{ width: 14, height: 14, flexShrink: 0 }}
                  />
                  <span style={{ color: t.text }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {err && <div style={{ fontSize: 12, color: t.error, marginBottom: 12 }}>{err}</div>}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px 0', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgencyPlans() {
  const { t }         = useTheme();
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan]   = useState(null);
  const [mounted, setMounted]     = useState(false);

  async function load() {
    try {
      const { data } = await agencyAPI.getPlans();
      setPlans(data.plans || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setMounted(true); load(); }, []);
  if (!mounted) return null;

  async function archive(plan) {
    if (!confirm(`Archive plan "${plan.name}"? Clients already on this plan won't be affected.`)) return;
    try {
      await agencyAPI.updatePlan(plan.id, { isActive: false });
      setPlans(ps => ps.filter(p => p.id !== plan.id));
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  const gc = { maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' };

  if (loading) return (
    <Layout title="Client Plans" subtitle="Define the plans you offer to clients">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner /></div>
    </Layout>
  );

  return (
    <Layout
      title="Client Plans"
      subtitle="Define plans with credit budgets to assign to your clients"
      action={
        <button onClick={() => { setEditPlan(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <IpPlus size={15} /> Create Plan
        </button>
      }
    >
      <div style={gc}>
        {error && <div style={{ padding: '14px 18px', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, color: t.error, fontSize: 13, marginBottom: 20 }}>{error}</div>}

        {/* Example plan cards */}
        {plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 16 }}>
            <IpDollar size={40} color={t.textMuted} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>No plans yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 400, margin: '0 auto 12px', lineHeight: 1.6 }}>
              Create plans to assign to your clients — each plan defines a monthly credit budget.
              For example:
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
              {[
                { name: 'Starter', credits: 50 },
                { name: 'Pro', credits: 100 },
                { name: 'Premium', credits: 200 },
              ].map(ex => (
                <div key={ex.name} style={{ padding: '10px 18px', background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 9, fontSize: 13, color: t.textSecondary }}>
                  {ex.name} — {ex.credits} credits/mo
                </div>
              ))}
            </div>
            <button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <IpPlus size={15} /> Create First Plan
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {plans.filter(p => p.is_active).map(plan => (
              <div key={plan.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {parseInt(plan.client_count || 0)} client{parseInt(plan.client_count || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditPlan(plan); setShowModal(true); }} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(124,92,252,0.1)', color: t.primary, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => archive(plan)} title="Archive" style={{ padding: '5px 8px', background: 'rgba(255,69,58,0.1)', color: t.error, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                      <IpDelete size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 9 }}>
                    <span style={{ fontSize: 12, color: t.textMuted }}>Credits / month</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{plan.credits_per_month}</span>
                  </div>
                  {plan.monthly_cap_enabled && (
                    <div style={{ fontSize: 11, color: '#FF9F0A', fontWeight: 600 }}>Monthly cap enforced</div>
                  )}
                  {plan.price_monthly && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 9 }}>
                      <span style={{ fontSize: 12, color: t.textMuted }}>Your price</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                        ${parseFloat(plan.price_monthly).toFixed(2)}/mo
                        {plan.price_yearly ? ` · $${parseFloat(plan.price_yearly).toFixed(2)}/yr` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <PlanModal
          t={t}
          plan={editPlan}
          onClose={() => { setShowModal(false); setEditPlan(null); }}
          onSaved={() => { setShowModal(false); setEditPlan(null); load(); }}
        />
      )}
    </Layout>
  );
}
