import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpAdmin, IpRefresh, IpArrowLeft, IpWarning, IpSearch,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Badge, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 50;

const ACTION_VARIANT = {
  adjust_credits: 'success',
  suspend_customer: 'error',
  reactivate_customer: 'success',
  reset_password: 'warning',
  promote_admin: 'warning',
  demote_admin: 'warning',
  update_customer: 'info',
  retry_email: 'info',
  retry_all_failed_emails: 'info',
  broadcast: 'primary',
  impersonate: 'warning',
  remove_post: 'error',
};

const ALL_ACTIONS = [
  'adjust_credits', 'suspend_customer', 'reactivate_customer',
  'reset_password', 'promote_admin', 'demote_admin', 'update_customer',
  'retry_email', 'retry_all_failed_emails', 'broadcast', 'impersonate', 'remove_post',
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatAction(action) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AuditLog() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(0);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterAdmin, setFilterAdmin] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (filterAction) params.action_type = filterAction;
      if (filterAdmin) params.admin_email = filterAdmin;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo + 'T23:59:59';
      const { data } = await adminAPI.getAuditLog(params);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterAdmin, dateFrom, dateTo]);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setPage(0);
    loadData(0);
  }, [filterAction, filterAdmin, dateFrom, dateTo, mounted]);

  useEffect(() => {
    if (mounted) loadData(page);
  }, [page, mounted]);

  if (!mounted) return null;

  const inputStyle = {
    padding: '9px 12px', background: t.input, border: `1px solid ${t.borderStrong}`,
    borderRadius: 8, color: t.text, fontSize: 13,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <Layout
      title="Audit Log"
      subtitle="Admin action history"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <IpArrowLeft size={12} /> Admin Portal
          </button>
          <button
            onClick={() => loadData(page)}
            style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <IpRefresh size={12} /> Refresh
          </button>
        </div>
      }
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <IpWarning size={15} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
          </div>
        )}

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={inputStyle}>
            <option value="">All actions</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{formatAction(a)}</option>
            ))}
          </select>
          <div style={{ position: 'relative' }}>
            <IpSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
            <input
              type="text" placeholder="Filter by admin email..."
              value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: 200 }}
            />
          </div>
          <input
            type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
            title="From date"
          />
          <input
            type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
            title="To date"
          />
          {(filterAction || filterAdmin || dateFrom || dateTo) && (
            <button
              onClick={() => { setFilterAction(''); setFilterAdmin(''); setDateFrom(''); setDateTo(''); }}
              style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}
            >
              Clear filters
            </button>
          )}
        </div>

        <Card style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHeader icon={IpAdmin} title="Audit Log" subtitle={`${total} total actions`} />
          </div>

          {loading ? (
            <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
              <Spinner size={32} />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={IpAdmin} title="No audit entries" subtitle="Try adjusting your filters" />
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {['When', 'Admin', 'Action', 'Target', 'IP', 'Details'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: t.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <>
                      <tr
                        key={entry.id}
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                        style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: expanded === entry.id ? t.input : 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                          <div title={new Date(entry.created_at).toLocaleString()}>{timeAgo(entry.created_at)}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: t.text, whiteSpace: 'nowrap' }}>
                          {entry.admin_email || `Admin #${entry.admin_id}`}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={ACTION_VARIANT[entry.action] || 'info'} style={{ fontSize: 11 }}>
                            {formatAction(entry.action)}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted }}>
                          {entry.target_type && (
                            <span>{entry.target_type}{entry.target_id ? ` #${entry.target_id}` : ''}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>
                          {entry.ip_address || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: t.primary }}>
                          {entry.details && Object.keys(entry.details).length > 0 ? 'Click to expand' : '—'}
                        </td>
                      </tr>
                      {expanded === entry.id && entry.details && (
                        <tr key={`${entry.id}-detail`} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td colSpan={6} style={{ padding: '12px 16px', background: t.input }}>
                            <pre style={{ margin: 0, fontSize: 12, color: t.text, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>
                  Showing {from}–{to} of {total} entries
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
      </div>
    </Layout>
  );
}
