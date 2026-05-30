import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { IpSearch, IpChevronRight, IpTeam, IpAdmin, IpSave, IpChevronUp, IpChevronDown } from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, EmptyState, Spinner, Select } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 25;

const SORT_COLS = [
  { key: 'business_name', label: 'Business' },
  { key: null,            label: 'Email' },
  { key: null,            label: 'Plan' },
  { key: 'credits_balance', label: 'Credits' },
  { key: null,            label: 'Status' },
  { key: 'created_at',   label: 'Joined' },
  { key: 'last_login_at', label: 'Last Login' },
  { key: null,            label: '' },
];

export default function AdminCustomers() {
  const router = useRouter();
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
  const [data, setData] = useState({ customers: [], total: 0 });
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterSuspended, setFilterSuspended] = useState('');
  const [filterAccountType, setFilterAccountType] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [impersonatingId, setImpersonatingId] = useState(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE, sort_by: sortBy, sort_order: sortOrder };
      if (search) params.search = search;
      if (filterPlan) params.plan = filterPlan;
      if (filterSuspended !== '') params.suspended = filterSuspended;
      if (filterAccountType) params.account_type = filterAccountType;
      const res = await adminAPI.listCustomers(params);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, search, filterPlan, filterSuspended, filterAccountType]);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    if (router.query.suspended) setFilterSuspended(router.query.suspended);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(timer);
  }, [search, filterPlan, filterSuspended, filterAccountType, mounted]);

  useEffect(() => {
    if (mounted) load(page);
  }, [page, sortBy, sortOrder, mounted]);

  function toggleSort(col) {
    if (!col) return;
    if (sortBy === col) {
      setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(0);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await adminAPI.exportCustomers();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* swallow */ } finally {
      setExporting(false);
    }
  }

  const handleImpersonate = async (e, customerId, businessName) => {
    e.stopPropagation();
    setImpersonatingId(customerId);
    try {
      const { data: impData } = await adminAPI.impersonate(customerId);
      localStorage.setItem('admin_backup_token', localStorage.getItem('token'));
      localStorage.setItem('impersonating_as', impData.businessName || businessName);
      localStorage.setItem('token', impData.token);
      router.push('/dashboard');
    } catch (err) {
      setImpersonatingId(null);
      alert(err.response?.data?.error || 'Impersonation failed');
    }
  };

  if (!mounted) return null;

  const inputStyle = {
    padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`,
    borderRadius: 8, color: t.text, fontSize: 13,
  };

  const totalPages = Math.ceil(data.total / PAGE_SIZE);
  const from = data.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, data.total);

  return (
    <Layout
      title="Customers"
      subtitle={`${data.total} total`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={exporting}>
            <IpSave size={13} style={{ marginRight: 4 }} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button variant="ghost" onClick={() => router.push('/admin')}>← Admin</Button>
        </div>
      }
    >
      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <IpSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
          <input
            type="text" placeholder="Search by email or business name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <Select
          value={filterPlan}
          onChange={e => { setFilterPlan(e.target.value); setPage(0); }}
          placeholder="All plans"
          options={[
            { value: '', label: 'All plans' },
            { value: 'trial', label: 'Trial' },
            { value: 'starter', label: 'Starter' },
            { value: 'professional', label: 'Professional' },
            { value: 'premium', label: 'Premium' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          value={filterSuspended}
          onChange={e => { setFilterSuspended(e.target.value); setPage(0); }}
          placeholder="All status"
          options={[
            { value: '', label: 'All status' },
            { value: 'false', label: 'Active only' },
            { value: 'true', label: 'Suspended only' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          value={filterAccountType}
          onChange={e => { setFilterAccountType(e.target.value); setPage(0); }}
          placeholder="All accounts"
          options={[
            { value: '', label: 'All accounts' },
            { value: 'main', label: 'Main accounts' },
            { value: 'workspace', label: 'Workspaces only' },
          ]}
          style={{ width: 170 }}
        />
      </div>

      <div style={{ ...gc, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: t.textMuted }}>Loading customers...</div>
        ) : data.customers.length === 0 ? (
          <EmptyState icon={IpTeam} title="No customers found" subtitle="Try adjusting your search or filters" />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {SORT_COLS.map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={() => key && toggleSort(key)}
                      style={{
                        padding: '12px 16px', fontSize: 11, fontWeight: 600, color: key ? t.text : t.textMuted,
                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap', cursor: key ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      {label}
                      {key && sortBy === key && (
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortOrder === 'asc' ? <IpChevronUp size={12} /> : <IpChevronDown size={12} />}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/admin/customers/${c.id}`)}
                    style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#7C5CFC,#5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(c.business_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.business_name || '—'}</div>
                          {c.is_admin && <span style={{ fontSize: 10, color: t.primary, fontWeight: 600 }}>ADMIN</span>}
                          {c.parent_customer_id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(124,92,252,0.15)', color: '#7C5CFC' }}>Workspace</span>
                              {c.parent_business_name && <span style={{ fontSize: 10, color: t.textMuted }}>↳ {c.parent_business_name}</span>}
                            </div>
                          ) : parseInt(c.workspace_count) > 0 ? (
                            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                              {c.workspace_count} sub-account{parseInt(c.workspace_count) !== 1 ? 's' : ''}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: t.textSecondary }}>{c.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={c.plan === 'premium' ? 'primary' : c.plan === 'professional' ? 'success' : 'default'}>
                        {c.plan || 'trial'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: t.text }}>{c.credits_balance ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={c.suspended ? 'error' : c.status === 'active' ? 'success' : 'warning'}>
                        {c.suspended ? 'Suspended' : c.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                      {c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!c.is_admin && !c.suspended && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleImpersonate(e, c.id, c.business_name)}
                            disabled={impersonatingId !== null}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {impersonatingId === c.id
                              ? <Spinner size={12} />
                              : <><IpAdmin size={12} style={{ marginRight: 4 }} />Login as</>
                            }
                          </Button>
                        )}
                        <IpChevronRight size={14} style={{ color: t.textMuted }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* PAGINATION */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                Showing {from}–{to} of {data.total} customers
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm" variant="secondary"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  ← Prev
                </Button>
                <span style={{ fontSize: 12, color: t.textMuted, lineHeight: '30px', padding: '0 8px' }}>
                  {page + 1} / {totalPages || 1}
                </span>
                <Button
                  size="sm" variant="secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next →
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

