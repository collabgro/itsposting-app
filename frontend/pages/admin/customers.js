import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Search, ChevronRight, Users, Shield } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card, Button, Badge, EmptyState } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

export default function AdminCustomers() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState({ customers: [], total: 0 });
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterSuspended, setFilterSuspended] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    // Pre-fill filter from query param
    if (router.query.suspended) setFilterSuspended(router.query.suspended);
    load();
  }, []);

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(load, 300);
      return () => clearTimeout(timer);
    }
  }, [search, filterPlan, filterSuspended]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterPlan) params.plan = filterPlan;
      if (filterSuspended !== '') params.suspended = filterSuspended;
      const res = await adminAPI.listCustomers(params);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const inputStyle = { padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13, cursor: 'pointer' };

  return (
    <Layout
      title="Customers"
      subtitle={`${data.total} total`}
      action={<Button variant="ghost" onClick={() => router.push('/admin')}>← Admin</Button>}
    >
      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
          <input
            type="text" placeholder="Search by email or business name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} style={inputStyle}>
          <option value="">All plans</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="premium">Premium</option>
        </select>
        <select value={filterSuspended} onChange={(e) => setFilterSuspended(e.target.value)} style={inputStyle}>
          <option value="">All status</option>
          <option value="false">Active only</option>
          <option value="true">Suspended only</option>
        </select>
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: t.textMuted }}>Loading customers...</div>
        ) : data.customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" subtitle="Try adjusting your search or filters" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                {['Business', 'Email', 'Plan', 'Credits', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: t.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
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
                  <td style={{ padding: '12px 16px' }}>
                    <ChevronRight size={14} style={{ color: t.textMuted }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
