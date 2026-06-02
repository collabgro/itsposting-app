import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { useTheme } from '../../../lib/theme';
import { agencyAPI } from '../../../lib/api';
import { IpClose, IpTeam, IpDollar, IpCheck, IpWarning } from '../../../components/icons';
import { Spinner, SectionHeader } from '../../../components/ui';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Allocate Credits</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Credits to Allocate</label>
            <input type="number" min="1" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Reason (optional)</label>
            <input style={inputStyle} value={reason} onChange={e => setReason(e.target.value)} placeholder="Monthly top-up" />
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

const TX_LABEL = {
  deduction:        { label: 'Used',            color: '#FF453A' },
  addition:         { label: 'Added',            color: '#30D158' },
  admin_grant:      { label: 'Admin grant',      color: '#30D158' },
  agency_allocation:{ label: 'Agency allocation', color: '#7C5CFC' },
  bonus:            { label: 'Bonus',            color: '#FF9F0A' },
};

export default function AgencyClientDetail() {
  const router    = useRouter();
  const { id }    = router.query;
  const { t }     = useTheme();
  const [data, setData]           = useState(null);
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const [mounted, setMounted]     = useState(false);

  async function load() {
    if (!id) return;
    try {
      const [dr, pr] = await Promise.all([agencyAPI.getClient(id), agencyAPI.getPlans()]);
      setData(dr.data);
      setPlans(pr.data.plans?.filter(p => p.is_active) || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (id) load(); }, [id]);
  if (!mounted) return null;

  async function toggleSuspend() {
    const c = data.client;
    if (!confirm(`${c.suspended ? 'Reactivate' : 'Suspend'} this client?`)) return;
    try {
      const { data: r } = await agencyAPI.updateClient(c.id, { suspended: !c.suspended });
      setData(d => ({ ...d, client: { ...d.client, suspended: r.client.suspended } }));
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  async function assignPlan(planId) {
    try {
      await agencyAPI.assignPlan(data.client.id, planId ? parseInt(planId) : null);
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  const gc = { maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' };

  if (loading) return (
    <Layout title="Client Detail">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner /></div>
    </Layout>
  );

  if (error) return (
    <Layout title="Client Detail">
      <div style={gc}><div style={{ padding: '40px 0', textAlign: 'center', color: t.error }}>{error}</div></div>
    </Layout>
  );

  const { client, creditHistory, monthlyUsage } = data || {};
  const isSuspended = client?.suspended;

  return (
    <Layout
      title={client?.workspace_display_name || client?.business_name || 'Client'}
      subtitle={client?.industry ? `${client.industry.replace(/_/g, ' ')} · ${client.location || ''}` : client?.location || ''}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCredits(true)} style={{ padding: '9px 16px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Credits
          </button>
          <button onClick={toggleSuspend} style={{ padding: '9px 16px', background: isSuspended ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: isSuspended ? '#30D158' : t.error, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {isSuspended ? 'Reactivate' : 'Suspend'}
          </button>
        </div>
      }
    >
      <div style={gc}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {/* Plan card */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
            <SectionHeader icon={IpDollar} title="Plan" subtitle="Credit budget assigned to this client" />
            <div style={{ marginTop: 14 }}>
              {client?.plan_name ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{client.plan_name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{client.credits_per_month} credits/month</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>No plan assigned</div>
              )}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Change Plan</label>
              <select
                defaultValue={client?.plan_id || ''}
                onChange={e => assignPlan(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, color: t.text }}
              >
                <option value="">No plan</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.credits_per_month} credits/mo</option>)}
              </select>
            </div>
          </div>

          {/* Status card */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
            <SectionHeader icon={IpTeam} title="Status" subtitle="Client workspace details" />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Status',    value: isSuspended ? 'Suspended' : 'Active', color: isSuspended ? t.error : '#30D158' },
                { label: 'Industry',  value: client?.industry?.replace(/_/g, ' ') || '—' },
                { label: 'Location',  value: client?.location || '—' },
                { label: 'Created',   value: client?.created_at ? formatDate(client.created_at) : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.color || t.text }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Credit history */}
        <SectionHeader icon={IpDollar} title="Credit History" subtitle="Last 30 transactions for this workspace" />
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginTop: 14 }}>
          {(!creditHistory || creditHistory.length === 0) ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No credit activity yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Type', 'Amount', 'Description', 'Date'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditHistory.map((row, i) => {
                  const txInfo = TX_LABEL[row.transaction_type] || { label: row.transaction_type, color: t.textMuted };
                  return (
                    <tr key={row.id} style={{ borderBottom: i < creditHistory.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: txInfo.color, background: `${txInfo.color}18` }}>{txInfo.label}</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: row.amount > 0 ? '#30D158' : t.error }}>
                        {row.amount > 0 ? '+' : ''}{row.amount}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: t.textMuted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description || '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: t.textMuted }}>{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCredits && (
        <AllocateCreditsModal
          t={t}
          client={client}
          onClose={() => setShowCredits(false)}
          onDone={() => { setShowCredits(false); load(); }}
        />
      )}
    </Layout>
  );
}
