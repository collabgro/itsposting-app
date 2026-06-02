import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useTheme } from '../../lib/theme';
import { agencyAPI } from '../../lib/api';
import {
  IpPlus, IpTeam, IpClose, IpDelete, IpWarning, IpChevronRight, IpCheck,
} from '../../components/icons';
import { Spinner, SectionHeader } from '../../components/ui';

const STATUS_COLOR = {
  active:    { color: '#30D158', bg: 'rgba(48,209,88,0.12)',  label: 'Active' },
  suspended: { color: '#FF453A', bg: 'rgba(255,69,58,0.12)',  label: 'Suspended' },
  inactive:  { color: '#8E8E93', bg: 'rgba(142,142,147,0.12)', label: 'Inactive' },
};

function clientStatus(c) {
  if (c.suspended) return STATUS_COLOR.suspended;
  if (c.status !== 'active') return STATUS_COLOR.inactive;
  return STATUS_COLOR.active;
}

function AddClientModal({ t, plans, onClose, onCreated }) {
  const [form, setForm]   = useState({ businessName: '', industry: '', location: '', planId: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]      = useState('');

  const industries = [
    'plumbing','hvac','roofing','electrical','painting','landscaping',
    'concrete','pest_control','cleaning','general_contractor',
  ];

  async function submit(e) {
    e.preventDefault();
    if (!form.businessName.trim()) { setErr('Business name required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const { data } = await agencyAPI.createClient({
        businessName: form.businessName.trim(),
        industry:     form.industry || null,
        location:     form.location || null,
      });
      if (form.planId && data.client?.id) {
        await agencyAPI.assignPlan(data.client.id, parseInt(form.planId)).catch(() => {});
      }
      onCreated(data.client);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const boxStyle     = { background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' };
  const labelStyle   = { display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 };
  const inputStyle   = { width: '100%', padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, boxSizing: 'border-box' };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>Add New Client</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Business Name *</label>
            <input style={inputStyle} value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="e.g. Mike's Plumbing" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Industry</label>
              <select style={inputStyle} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                <option value="">Select industry</option>
                {industries.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State" />
            </div>
          </div>
          {plans.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Assign Plan (optional)</label>
              <select style={inputStyle} value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}>
                <option value="">No plan yet</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.credits_per_month} credits/mo</option>)}
              </select>
            </div>
          )}
          {err && <div style={{ fontSize: 12, color: t.error, marginBottom: 12 }}>{err}</div>}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px 0', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Client Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AllocateCreditsModal({ t, client, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e) {
    e.preventDefault();
    const n = parseInt(amount);
    if (!n || n < 1) { setErr('Enter a valid amount (minimum 1).'); return; }
    setSaving(true);
    setErr('');
    try {
      await agencyAPI.addCredits(client.id, { amount: n, reason: reason.trim() || undefined });
      onDone();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const boxStyle     = { background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' };
  const labelStyle   = { display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 };
  const inputStyle   = { width: '100%', padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, boxSizing: 'border-box' };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Allocate Credits</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{client.workspace_display_name || client.business_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Credits to Allocate</label>
            <input type="number" min="1" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Reason (optional)</label>
            <input style={inputStyle} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Monthly top-up" />
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, padding: '10px 12px', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
            Credits are deducted from your agency account and transferred to this client workspace.
          </div>
          {err && <div style={{ fontSize: 12, color: t.error, marginBottom: 10 }}>{err}</div>}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px 0', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Allocating…' : 'Allocate Credits'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgencyClients() {
  const router    = useRouter();
  const { t }     = useTheme();
  const [clients, setClients] = useState([]);
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [creditClient, setCreditClient] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null); // { client, planId }
  const [saving, setSaving]           = useState(false);
  const [mounted, setMounted]         = useState(false);

  async function load() {
    try {
      const [cr, pr] = await Promise.all([agencyAPI.getClients(), agencyAPI.getPlans()]);
      setClients(cr.data.clients || []);
      setPlans(pr.data.plans || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setMounted(true); load(); }, []);
  if (!mounted) return null;

  async function toggleSuspend(client) {
    if (!confirm(`${client.suspended ? 'Reactivate' : 'Suspend'} "${client.business_name}"?`)) return;
    try {
      await agencyAPI.updateClient(client.id, { suspended: !client.suspended });
      setClients(cs => cs.map(c => c.id === client.id ? { ...c, suspended: !c.suspended } : c));
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  async function assignPlanInline(clientId, planId) {
    setSaving(true);
    try {
      await agencyAPI.assignPlan(clientId, planId ? parseInt(planId) : null);
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
      setAssignTarget(null);
    }
  }

  const gc = { maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' };

  if (loading) return (
    <Layout title="Clients" subtitle="Your agency client workspaces">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner /></div>
    </Layout>
  );

  return (
    <Layout
      title="Clients"
      subtitle={`${clients.length} client workspace${clients.length !== 1 ? 's' : ''}`}
      action={
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <IpPlus size={15} /> Add Client
        </button>
      }
    >
      <div style={gc}>
        {error && <div style={{ padding: '14px 18px', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, color: t.error, fontSize: 13, marginBottom: 20 }}>{error}</div>}

        {clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 16 }}>
            <IpTeam size={40} color={t.textMuted} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>No clients yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 360, margin: '0 auto 24px' }}>
              Add your first client workspace and assign them a plan to get started.
            </div>
            <button onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <IpPlus size={15} /> Add First Client
            </button>
          </div>
        ) : (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Client', 'Plan', 'Credits Used', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => {
                  const st   = clientStatus(c);
                  const used = parseFloat(c.credits_used_this_month || 0);
                  const budget = c.monthly_credit_budget;
                  return (
                    <tr key={c.id} style={{ borderBottom: i < clients.length - 1 ? `1px solid ${t.border}` : 'none', background: 'transparent' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.workspace_display_name || c.business_name}</div>
                        {c.location && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{c.location}</div>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {assignTarget?.clientId === c.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select
                              defaultValue={c.plan_id || ''}
                              onChange={async e => { try { await assignPlanInline(c.id, e.target.value); } catch (err) { alert(err.response?.data?.error || err.message); } }}
                              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.bg, color: t.text, cursor: 'pointer' }}
                            >
                              <option value="">No plan</option>
                              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button onClick={() => setAssignTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => setAssignTarget({ clientId: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {c.plan_name ? (
                              <span style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>{c.plan_name}</span>
                            ) : (
                              <span style={{ fontSize: 12, color: t.textMuted }}>+ Assign plan</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{used}</div>
                        {budget && <div style={{ fontSize: 11, color: t.textMuted }}>of {budget} budget</div>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => router.push(`/agency/clients/${c.id}`)} title="View detail" style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: t.text, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                            View
                          </button>
                          <button onClick={async () => {
                            try {
                              const { data } = await agencyAPI.impersonate(c.id);
                              localStorage.setItem('agency_backup_token', localStorage.getItem('token') || '');
                              localStorage.setItem('token', data.token);
                              window.location.href = '/dashboard';
                            } catch (err) { alert(err.response?.data?.error || err.message); }
                          }} title="Login as this client" style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(10,132,255,0.1)', color: '#0A84FF', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                            Login As
                          </button>
                          <button onClick={() => setCreditClient(c)} title="Allocate credits" style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(124,92,252,0.1)', color: t.primary, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                            Credits
                          </button>
                          <button onClick={() => toggleSuspend(c)} title={c.suspended ? 'Reactivate' : 'Suspend'} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: c.suspended ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: c.suspended ? '#30D158' : t.error, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                            {c.suspended ? 'Reactivate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddClientModal
          t={t}
          plans={plans.filter(p => p.is_active)}
          onClose={() => setShowAdd(false)}
          onCreated={client => { setShowAdd(false); load(); }}
        />
      )}

      {creditClient && (
        <AllocateCreditsModal
          t={t}
          client={creditClient}
          onClose={() => setCreditClient(null)}
          onDone={() => { setCreditClient(null); load(); }}
        />
      )}
    </Layout>
  );
}
