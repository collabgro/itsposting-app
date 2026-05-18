import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpMail, IpCheckCircle, IpSchedule, IpWarning, IpRefresh,
  IpArrowLeft, IpSend, IpSearch,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, Badge, SectionHeader, StatCard, EmptyState, Spinner, ConfirmModal } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 50;

const STATUS_VARIANT = { sent: 'success', pending: 'warning', failed: 'error' };
const STATUS_ICON = { sent: IpCheckCircle, pending: IpSchedule, failed: IpWarning };

const TEMPLATE_LABELS = {
  account_suspended: 'Account Suspended',
  account_reactivated: 'Account Reactivated',
  credits_adjusted: 'Credits Adjusted',
  password_reset: 'Password Reset',
  password_reset_admin: 'Password Reset (Admin)',
  welcome: 'Welcome Email',
  admin_broadcast: 'Admin Broadcast',
};

export default function EmailQueuePage() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState({ emails: [], stats: {}, total: 0 });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterRecipient, setFilterRecipient] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmModal, setConfirmModal] = useState(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (filterStatus) params.status = filterStatus;
      if (filterTemplate) params.template = filterTemplate;
      if (filterRecipient.trim()) params.recipient = filterRecipient.trim();
      const res = await adminAPI.getEmailQueue(params);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterTemplate, filterRecipient]);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  // Debounce recipient search
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(timer);
  }, [filterRecipient, mounted]);

  useEffect(() => {
    if (!mounted) return;
    setPage(0);
    load(0);
  }, [filterStatus, filterTemplate, mounted]);

  useEffect(() => {
    if (mounted) load(page);
  }, [page, mounted]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleRetry = async (id) => {
    try {
      await adminAPI.retryEmail(id);
      showMsg('success', 'Email queued for retry');
      load(page);
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Retry failed');
    }
  };

  const handleRetryAll = () => {
    setConfirmModal({
      title: 'Retry All Failed Emails',
      message: 'This will re-queue all failed emails for delivery. Continue?',
      confirmLabel: 'Retry All',
      onConfirm: async () => {
        try {
          const res = await adminAPI.retryAllEmails();
          showMsg('success', `${res.data.count} email(s) re-queued`);
          load(0);
        } catch {
          showMsg('error', 'Failed to retry all');
        }
      },
    });
  };

  if (!mounted) return null;

  const stats = data.stats || {};
  const total = data.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  const msgStyle = {
    success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: t.success },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: t.error },
  };

  const selectStyle = {
    padding: '9px 12px', background: t.input, border: `1px solid ${t.borderStrong}`,
    borderRadius: 8, color: t.text, fontSize: 13,
  };

  return (
    <Layout
      title="Email Queue"
      subtitle="Outgoing notifications and status"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => load(page)}><IpRefresh size={13} /> Refresh</Button>
          {parseInt(stats.failed) > 0 && (
            <Button variant="danger" onClick={handleRetryAll}>
              <IpRefresh size={13} /> Retry all failed ({stats.failed})
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push('/admin')}><IpArrowLeft size={13} /> Admin</Button>
        </div>
      }
    >
      {message.text && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgStyle[message.type]?.bg, border: `1px solid ${msgStyle[message.type]?.border}`, color: msgStyle[message.type]?.color }}>
          {message.text}
        </div>
      )}

      {/* PROVIDER BANNER */}
      <div style={{
        padding: '12px 16px', marginBottom: 20, borderRadius: 10,
        background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.25)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <IpMail size={16} style={{ color: t.primary, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
            Email provider: <span style={{ color: t.primary, textTransform: 'capitalize' }}>{process.env.NEXT_PUBLIC_EMAIL_PROVIDER || 'Log-only (no emails sent)'}</span>
          </span>
          <span style={{ fontSize: 12, color: t.textMuted, display: 'block', marginTop: 2 }}>
            To activate real delivery, set <code style={{ color: t.primary, fontSize: 11 }}>EMAIL_PROVIDER</code> to <code style={{ color: t.textMuted, fontSize: 11 }}>sendgrid</code>, <code style={{ color: t.textMuted, fontSize: 11 }}>resend</code>, or <code style={{ color: t.textMuted, fontSize: 11 }}>smtp</code> and add the matching credentials.
          </span>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Pending" value={parseInt(stats.pending) || 0} accent="warning" />
        <StatCard label="Sent" value={parseInt(stats.sent) || 0} accent="success" />
        <StatCard label="Failed" value={parseInt(stats.failed) || 0} accent={parseInt(stats.failed) > 0 ? 'error' : 'default'} />
        <StatCard label="Last 24 hours" value={parseInt(stats.last_24h) || 0} accent="primary" />
      </div>

      {/* TABLE */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SectionHeader icon={IpSend} title="Email log" style={{ flex: 1, margin: 0 }} />

          {/* Recipient search */}
          <div style={{ position: 'relative' }}>
            <IpSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
            <input
              type="text" placeholder="Filter by recipient..."
              value={filterRecipient} onChange={(e) => setFilterRecipient(e.target.value)}
              style={{ ...selectStyle, paddingLeft: 30, width: 200 }}
            />
          </div>

          {/* Template filter */}
          <select value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)} style={selectStyle}>
            <option value="">All templates</option>
            {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Status filter */}
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={32} />
          </div>
        ) : data.emails.length === 0 ? (
          <EmptyState icon={IpMail} title="No emails found" subtitle="Try adjusting your filters" />
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Recipient', 'Template', 'Status', 'Attempts', 'Scheduled', 'Sent / Error', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: t.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.emails.map((email) => {
                  const StatusIcon = STATUS_ICON[email.status] || IpSchedule;
                  return (
                    <tr key={email.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.text }}>{email.to_email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: t.textSecondary }}>
                          {TEMPLATE_LABELS[email.template_name] || email.template_name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={STATUS_VARIANT[email.status] || 'default'}>
                          <StatusIcon size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                          {email.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: t.textMuted }}>
                        {email.attempts}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                        {new Date(email.scheduled_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                        {email.sent_at && (
                          <span style={{ fontSize: 12, color: t.success }}>{new Date(email.sent_at).toLocaleString()}</span>
                        )}
                        {email.last_error && (
                          <span
                            style={{ fontSize: 11, color: t.error, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={email.last_error}
                          >
                            {email.last_error}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {email.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(email.id)}
                            style={{ padding: '5px 12px', background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: 6, color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            <IpRefresh size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                Showing {from}–{to} of {total} emails
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  style={{ padding: '6px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: page === 0 ? t.textMuted : t.text, fontSize: 12, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: 12, color: t.textMuted }}>{page + 1} / {totalPages || 1}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: page >= totalPages - 1 ? t.textMuted : t.text, fontSize: 12, cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </Layout>
  );
}

