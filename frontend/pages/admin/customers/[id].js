import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpArrowLeft, IpPlus, IpPower, IpCheckCircle, IpBilling, IpHistory,
  IpWarning, IpAdmin, IpEdit, IpClose, IpSave,
} from '../../../components/icons';
import Layout from '../../../components/Layout';
import { Card, Button, Badge, SectionHeader, EmptyState, Spinner } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import { adminAPI } from '../../../lib/api';

export default function AdminCustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  useEffect(() => {
    if (mounted && id) load();
  }, [mounted, id]);

  const load = async () => {
    try {
      const res = await adminAPI.getCustomer(id);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
      else if (err.response?.status === 404) router.replace('/admin/customers');
    }
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleAdjustCredits = async (amount, reason) => {
    try {
      await adminAPI.adjustCredits(id, amount, reason);
      showMsg('success', `Credits ${amount > 0 ? 'granted' : 'deducted'}: ${amount}`);
      setShowCreditsModal(false);
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed to adjust credits');
    }
  };

  const handleSuspend = async (reason) => {
    try {
      await adminAPI.suspend(id, reason);
      showMsg('success', 'Account suspended');
      setShowSuspendModal(false);
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed to suspend');
    }
  };

  const handleReactivate = async () => {
    if (!confirm('Reactivate this account?')) return;
    try {
      await adminAPI.reactivate(id);
      showMsg('success', 'Account reactivated');
      load();
    } catch (err) {
      showMsg('error', 'Failed to reactivate');
    }
  };

  const handleUpdate = async (fields) => {
    try {
      await adminAPI.updateCustomer(id, fields);
      showMsg('success', 'Customer updated');
      setShowEditModal(false);
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Update failed');
    }
  };

  const handleResetPassword = async () => {
    const pwd = prompt('Enter new password (8+ chars):');
    if (!pwd || pwd.length < 8) return;
    try {
      await adminAPI.resetPassword(id, pwd);
      showMsg('success', 'Password reset successfully');
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed');
    }
  };

  const handlePromote = async () => {
    if (!confirm('Grant admin privileges to this user?')) return;
    try {
      await adminAPI.promote(id);
      showMsg('success', 'User promoted to admin');
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed');
    }
  };

  const handleDemote = async () => {
    if (!confirm('Remove admin privileges from this user?')) return;
    try {
      await adminAPI.demote(id);
      showMsg('success', 'Admin privileges removed');
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed');
    }
  };

  if (!mounted || !data) {
    return (
      <Layout title="Customer">
        <Card>
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} />
          </div>
        </Card>
      </Layout>
    );
  }

  const c = data.customer;

  const msgStyle = {
    success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: t.success },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: t.error },
  };

  return (
    <Layout
      title={c.business_name || c.email}
      subtitle={c.email}
      action={<Button variant="ghost" onClick={() => router.push('/admin/customers')}><IpArrowLeft size={14} /> Back</Button>}
    >
      {message.text && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgStyle[message.type]?.bg, border: `1px solid ${msgStyle[message.type]?.border}`, color: msgStyle[message.type]?.color }}>
          {message.text}
        </div>
      )}

      {/* STATUS + ACTIONS */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant={c.suspended ? 'error' : c.status === 'active' ? 'success' : 'warning'}>
              {c.suspended ? 'Suspended' : c.status}
            </Badge>
            <Badge variant="default">{c.plan || 'trial'}</Badge>
            {c.is_admin && <Badge variant="primary">ADMIN</Badge>}
            {c.email_verified && <Badge variant="success">Email verified</Badge>}
            <span style={{ fontSize: 12, color: t.textMuted }}>Member since {new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
              <IpEdit size={13} /> Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowCreditsModal(true)}>
              <IpPlus size={13} /> Credits
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetPassword}>Reset Password</Button>
            {!c.is_admin
              ? <Button variant="secondary" size="sm" onClick={handlePromote}><IpAdmin size={13} /> Make Admin</Button>
              : <Button variant="secondary" size="sm" onClick={handleDemote}>Remove Admin</Button>
            }
            {c.suspended
              ? <Button variant="primary" size="sm" onClick={handleReactivate}><IpCheckCircle size={13} /> Reactivate</Button>
              : <Button variant="danger" size="sm" onClick={() => setShowSuspendModal(true)}><IpPower size={13} /> Suspend</Button>
            }
          </div>
        </div>
        {c.suspended && c.suspension_reason && (
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', gap: 10 }}>
            <IpWarning size={16} style={{ color: t.error, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.error }}>Suspended</div>
              <div style={{ fontSize: 12, color: t.text, marginTop: 2 }}>{c.suspension_reason}</div>
            </div>
          </div>
        )}
        {c.notes && (
          <div style={{ marginTop: 14, padding: 12, background: t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>NOTES</div>
            <div style={{ fontSize: 13, color: t.text }}>{c.notes}</div>
          </div>
        )}
      </Card>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Credits balance</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.text, fontFamily: 'monospace' }}>{c.credits_balance || 0}</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Industry</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{c.industry || '—'}</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{c.location || 'No location'}</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Last login</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : 'Never'}</div>
        </Card>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Posts (recent)</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.text }}>{data.recentPosts.length}+</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* CREDIT HISTORY */}
        <Card>
          <SectionHeader icon={IpBilling} title="Credit history" />
          {data.creditHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No transactions yet</div>
          ) : (
            data.creditHistory.slice(0, 10).map((tx) => (
              <div key={tx.id} style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{tx.description || tx.transaction_type}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{new Date(tx.created_at).toLocaleString()}</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: tx.amount > 0 ? t.success : t.error }}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))
          )}
        </Card>

        {/* ADMIN ACTIONS LOG */}
        <Card>
          <SectionHeader icon={IpHistory} title="Admin actions" />
          {data.adminActions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No admin actions yet</div>
          ) : (
            data.adminActions.slice(0, 10).map((log) => (
              <div key={log.id} style={{ padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.text, textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>by {log.admin_email} · {new Date(log.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* RECENT POSTS */}
      {data.recentPosts.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <SectionHeader icon={IpHistory} title="Recent posts" />
          {data.recentPosts.slice(0, 5).map((p) => (
            <div key={p.id} style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.caption || '(no caption)'}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString()} · {p.content_type}</div>
              </div>
              <Badge variant={p.status === 'posted' ? 'success' : p.status === 'scheduled' ? 'warning' : 'default'}>{p.status}</Badge>
            </div>
          ))}
        </Card>
      )}

      {showCreditsModal && <CreditsModal onClose={() => setShowCreditsModal(false)} onSubmit={handleAdjustCredits} t={t} />}
      {showSuspendModal && <SuspendModal onClose={() => setShowSuspendModal(false)} onSubmit={handleSuspend} t={t} />}
      {showEditModal && <EditModal customer={c} onClose={() => setShowEditModal(false)} onSubmit={handleUpdate} t={t} />}
    </Layout>
  );
}

function CreditsModal({ onClose, onSubmit, t }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const submit = () => {
    const n = parseInt(amount);
    if (!n || isNaN(n)) return alert('Enter a valid number (negative to deduct)');
    if (!reason || reason.length < 3) return alert('Reason required (min 3 chars)');
    onSubmit(n, reason);
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, maxWidth: 440, width: '100%' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Adjust credits</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Positive to grant, negative to deduct.</p>
        <input type="number" placeholder="e.g. 50 or -10" value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, marginBottom: 12, fontSize: 13 }} />
        <textarea placeholder="Reason (visible in audit log)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, marginBottom: 16, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function SuspendModal({ onClose, onSubmit, t }) {
  const [reason, setReason] = useState('');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, maxWidth: 440, width: '100%' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Suspend account</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>The customer will be blocked from logging in until reactivated.</p>
        <textarea placeholder="Reason for suspension..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, marginBottom: 16, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => reason.trim() && onSubmit(reason)} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Suspend</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ customer: c, onClose, onSubmit, t }) {
  const [form, setForm] = useState({ businessName: c.business_name || '', industry: c.industry || '', plan: c.plan || 'trial', status: c.status || 'trial', notes: c.notes || '' });
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, maxWidth: 480, width: '100%' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 20 }}>Edit customer</h3>
        {[{ key: 'businessName', label: 'Business Name', type: 'text' }, { key: 'industry', label: 'Industry', type: 'text' }].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>{label}</label>
            <input type="text" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>Plan</label>
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}>
              {['trial', 'starter', 'professional', 'premium'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}>
              {['trial', 'active', 'expired', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>Internal notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
            style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSubmit(form)} style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
