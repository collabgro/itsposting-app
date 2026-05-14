import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpAdmin, IpRefresh, IpArrowLeft, IpWarning,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Badge, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

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
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminAPI.getAuditLog({ limit: 100 });
      setEntries(Array.isArray(data) ? data : (data.entries || []));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

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
            onClick={() => loadData()}
            style={{ fontSize: 12, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <IpRefresh size={12} /> Refresh
          </button>
        </div>
      }
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <IpWarning size={15} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
          </div>
        )}

        <Card style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHeader icon={IpAdmin} title="Audit Log" subtitle={`${entries.length} recent actions`} />
          </div>

          {loading ? (
            <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
              <Spinner size={32} />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={IpAdmin} title="No audit entries yet" subtitle="Admin actions will appear here" />
          ) : (
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
          )}
        </Card>
      </div>
    </Layout>
  );
}
