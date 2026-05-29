import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpArrowLeft, IpPlus, IpPower, IpCheckCircle, IpBilling, IpHistory,
  IpWarning, IpAdmin, IpEdit, IpClose, IpSave, IpTeam,
} from '../../../components/icons';
import Layout from '../../../components/Layout';
import { Button, Badge, SectionHeader, EmptyState, Spinner, ConfirmModal } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import { adminAPI } from '../../../lib/api';

export default function AdminCustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTheme();
  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
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

  const handleReactivate = () => {
    setConfirmModal({
      title: 'Reactivate Account',
      message: 'Reactivate this account? The customer will regain access immediately.',
      confirmLabel: 'Reactivate',
      onConfirm: async () => {
        try {
          await adminAPI.reactivate(id);
          showMsg('success', 'Account reactivated');
          load();
        } catch {
          showMsg('error', 'Failed to reactivate');
        }
      },
    });
  };

  const handleChangePlan = async (planData) => {
    try {
      await adminAPI.changePlan(id, planData);
      showMsg('success', `Plan changed to ${planData.plan}`);
      setShowPlanModal(false);
      load();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed to change plan');
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

  const handleResetPassword = () => {
    setShowPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (pwd) => {
    setShowPasswordModal(false);
    try {
      await adminAPI.resetPassword(id, pwd);
      showMsg('success', 'Password reset successfully');
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Failed');
    }
  };

  const handlePromote = () => {
    setConfirmModal({
      title: 'Grant Admin Privileges',
      message: 'This user will gain full admin access. Are you sure?',
      confirmLabel: 'Promote',
      onConfirm: async () => {
        try {
          await adminAPI.promote(id);
          showMsg('success', 'User promoted to admin');
          load();
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Failed');
        }
      },
    });
  };

  const handleDemote = () => {
    setConfirmModal({
      title: 'Remove Admin Privileges',
      message: 'This user will lose admin access immediately.',
      confirmLabel: 'Demote',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await adminAPI.demote(id);
          showMsg('success', 'Admin privileges removed');
          load();
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Failed');
        }
      },
    });
  };

  const handleImpersonate = async () => {
    try {
      const { data: impData } = await adminAPI.impersonate(id);
      localStorage.setItem('admin_backup_token', localStorage.getItem('token'));
      localStorage.setItem('impersonating_as', impData.businessName);
      localStorage.setItem('token', impData.token);
      router.push('/dashboard');
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Impersonation failed');
    }
  };

  if (!mounted || !data) {
    return (
      <Layout title="Customer">
        <div style={gc}>
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} />
          </div>
        </div>
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
      <div style={{ ...gc, marginBottom: 20 }}>
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
            <Button variant="secondary" size="sm" onClick={() => setShowPlanModal(true)}>
              <IpBilling size={13} /> Change Plan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowCreditsModal(true)}>
              <IpPlus size={13} /> Credits
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetPassword}>Reset Password</Button>
            {!c.is_admin && !c.suspended && (
              <Button variant="primary" size="sm" onClick={handleImpersonate}>
                <IpAdmin size={13} /> Login as Customer
              </Button>
            )}
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
      </div>

      {/* ACCOUNT FAMILY — Parent */}
      {data.parentAccount && (
        <div style={{ ...gc, marginBottom: 20 }}>
          <SectionHeader icon={IpTeam} title="Parent Account" subtitle="This workspace is under:" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#FB923C,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(data.parentAccount.business_name || 'M').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{data.parentAccount.business_name}</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{data.parentAccount.email}</div>
            </div>
            <Badge variant={data.parentAccount.plan === 'premium' ? 'primary' : data.parentAccount.plan === 'professional' ? 'success' : 'default'}>
              {data.parentAccount.plan || 'trial'}
            </Badge>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/customers/${data.parentAccount.id}`)}>
              View Parent
            </Button>
          </div>
        </div>
      )}

      {/* ACCOUNT FAMILY — Sub-accounts */}
      {data.workspaces && data.workspaces.length > 0 && (
        <div style={{ ...gc, marginBottom: 20 }}>
          <SectionHeader icon={IpTeam} title={`Sub-accounts (${data.workspaces.length})`} />
          <div style={{ marginTop: 12 }}>
            {data.workspaces.map((ws) => (
              <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(ws.workspace_display_name || ws.business_name || 'W').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{ws.workspace_display_name || ws.business_name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{[ws.industry?.replace('_', ' '), ws.location].filter(Boolean).join(' · ') || 'No details'}</div>
                </div>
                <Badge variant={ws.status === 'active' ? 'success' : 'warning'}>{ws.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/customers/${ws.id}`)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ ...gc, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Credits balance</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.text, fontFamily: 'monospace' }}>{c.credits_balance || 0}</div>
        </div>
        <div style={{ ...gc, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Industry</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{c.industry || '—'}</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{c.location || 'No location'}</div>
        </div>
        <div style={{ ...gc, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Last login</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : 'Never'}</div>
        </div>
        <div style={{ ...gc, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 4 }}>Posts (recent)</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.text }}>{data.recentPosts.length}+</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* CREDIT HISTORY */}
        <div style={gc}>
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
        </div>

        {/* ADMIN ACTIONS LOG */}
        <div style={gc}>
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
        </div>
      </div>

      {/* RECENT POSTS */}
      {data.recentPosts.length > 0 && (
        <div style={{ ...gc, marginTop: 20 }}>
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
        </div>
      )}

      {showCreditsModal && <CreditsModal onClose={() => setShowCreditsModal(false)} onSubmit={handleAdjustCredits} t={t} />}
      {showSuspendModal && <SuspendModal onClose={() => setShowSuspendModal(false)} onSubmit={handleSuspend} t={t} />}
      {showEditModal && <EditModal customer={c} onClose={() => setShowEditModal(false)} onSubmit={handleUpdate} t={t} />}
      {showPlanModal && <ChangePlanModal customer={c} onClose={() => setShowPlanModal(false)} onSubmit={handleChangePlan} t={t} />}
      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} onSubmit={handleResetPasswordSubmit} t={t} />}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </Layout>
  );
}

function CreditsModal({ onClose, onSubmit, t }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const n = parseInt(amount);
    if (!n || isNaN(n)) { setError('Enter a valid number (negative to deduct)'); return; }
    if (!reason || reason.length < 3) { setError('Reason required (min 3 chars)'); return; }
    setError('');
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
          style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, marginBottom: error ? 8 : 16, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
        {error && <div style={{ fontSize: 12, color: t.error, marginBottom: 12 }}>{error}</div>}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
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

function ChangePlanModal({ customer: c, onClose, onSubmit, t }) {
  const PLANS = [
    { id: 'trial',        name: 'Trial',        credits: 10,  price: 'Free'    },
    { id: 'starter',      name: 'Starter',      credits: 50,  price: '$20/mo'  },
    { id: 'professional', name: 'Professional', credits: 100, price: '$40/mo'  },
    { id: 'premium',      name: 'Premium',      credits: 150, price: '$60/mo'  },
  ];
  const [selectedPlan, setSelectedPlan] = useState(c.plan || 'trial');
  const [billingCycle, setBillingCycle] = useState(c.billing_cycle || 'monthly');
  const [allocateCredits, setAllocateCredits] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const chosen = PLANS.find((p) => p.id === selectedPlan);

  const submit = () => {
    if (reason.trim().length < 3) { setError('Reason required (min 3 chars)'); return; }
    setError('');
    onSubmit({ plan: selectedPlan, billingCycle: selectedPlan === 'trial' ? 'monthly' : billingCycle, allocateCredits, reason: reason.trim() });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>Change Plan</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
          Currently on: <strong style={{ color: t.text }}>{c.plan || 'trial'}</strong>
        </p>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          {PLANS.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${selectedPlan === p.id ? t.primary : t.border}`,
                background: selectedPlan === p.id ? `${t.primary}15` : t.input,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{p.credits} credits · {p.price}</div>
            </div>
          ))}
        </div>

        {/* Billing cycle toggle (hidden for trial) */}
        {selectedPlan !== 'trial' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 8 }}>Billing cycle</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['monthly', 'yearly'].map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  style={{
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${billingCycle === cycle ? t.primary : t.border}`,
                    background: billingCycle === cycle ? t.primary : 'transparent',
                    color: billingCycle === cycle ? '#fff' : t.text,
                  }}
                >
                  {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Allocate credits checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allocateCredits}
            onChange={(e) => setAllocateCredits(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: t.text }}>
            Allocate plan credits now
            {allocateCredits && chosen && (
              <span style={{ color: t.success, marginLeft: 6, fontWeight: 600 }}>+{chosen.credits} credits</span>
            )}
          </span>
        </label>

        {/* Reason */}
        <div style={{ marginBottom: error ? 8 : 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 6 }}>Reason (audit log)</label>
          <textarea
            placeholder="e.g. Admin override — onboarding gift"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${error ? t.error : t.borderStrong}`, borderRadius: 8, color: t.text, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }}
          />
        </div>
        {error && <div style={{ fontSize: 12, color: t.error, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ onClose, onSubmit, t }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!pwd || pwd.length < 8) { setError('Password must be at least 8 characters'); return; }
    onSubmit(pwd);
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, maxWidth: 400, width: '100%' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Reset Password</h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Enter a new password for this account (min 8 characters).</p>
        <input
          type="password" placeholder="New password" value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
          style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${error ? t.error : t.borderStrong}`, borderRadius: 8, color: t.text, marginBottom: error ? 8 : 16, fontSize: 13 }}
        />
        {error && <div style={{ fontSize: 12, color: t.error, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Reset Password</button>
        </div>
      </div>
    </div>
  );
}

