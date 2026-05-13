import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpTeam, IpTrendingUp, IpDollar, IpWarning, IpActivity,
  IpAdmin, IpChevronRight, IpAnalytics, IpCheckCircle, IpCloseCircle,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Button, Badge, StatCard, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getHealth(),
      ]);
      setStats(statsRes.data);
      setHealth(healthRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Admin access required. Redirecting...');
        setTimeout(() => router.replace('/dashboard'), 2000);
      } else {
        setError(err.response?.data?.error || 'Failed to load admin stats');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (error) {
    return (
      <Layout title="Admin Portal">
        <Card>
          <EmptyState icon={IpAdmin} title="Access Denied" subtitle={error} />
        </Card>
      </Layout>
    );
  }

  if (loading || !stats) {
    return (
      <Layout title="Admin Portal">
        <Card>
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} />
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout
      title="Admin Portal"
      subtitle="Platform overview and customer management"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => router.push('/admin/audit')}>Audit Log</Button>
          <Button variant="primary" onClick={() => router.push('/admin/customers')}>
            <IpTeam size={14} /> Manage Customers
          </Button>
        </div>
      }
    >
      {/* Health banner */}
      {health && (
        <div style={{ padding: '12px 16px', background: health.status === 'healthy' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${health.status === 'healthy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          {health.status === 'healthy' ? <IpCheckCircle size={16} style={{ color: t.success }} /> : <IpCloseCircle size={16} style={{ color: t.error }} />}
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{health.status === 'healthy' ? 'All systems operational' : 'System issues detected'}</span>
            <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 12 }}>DB: {health.database?.version?.split(' ').slice(0, 2).join(' ')}</span>
            {health.errors24h > 0 && <span style={{ fontSize: 12, color: t.error, marginLeft: 12 }}>⚠ {health.errors24h} failed posts in last 24h</span>}
            <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 12 }}>
              AI: {health.services?.anthropic ? '✓ Claude' : '✗ Claude'} · {health.services?.nanobanana ? '✓ Gemini' : '✗ Gemini'} · {health.services?.cloudinary ? '✓ Cloudinary' : '✗ Cloudinary'}
            </span>
          </div>
        </div>
      )}

      {/* TOP STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard label="Total customers" value={stats.users.total} hint={`+${stats.users.new_this_week || 0} this week`} accent="primary" />
        <StatCard label="Active subscribers" value={stats.users.active || 0} hint={`${stats.users.active_this_week || 0} active this week`} accent="success" />
        <StatCard label="MRR" value={`$${(stats.revenue.mrr || 0).toLocaleString()}`} hint={`$${(stats.revenue.arr || 0).toLocaleString()} ARR`} accent="success" />
        <StatCard label="Total posts" value={stats.posts.total_posts || 0} hint={`${stats.posts.today || 0} today`} accent="primary" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* REVENUE BREAKDOWN */}
        <Card>
          <SectionHeader icon={IpDollar} title="Revenue breakdown" />
          {stats.revenue.breakdown.length === 0 ? (
            <EmptyState icon={IpDollar} title="No paying customers yet" subtitle="Revenue will appear once customers upgrade" />
          ) : (
            stats.revenue.breakdown.map((row) => (
              <div key={row.plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{row.plan}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{row.count} customer{row.count > 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontFamily: 'monospace', color: t.primary, fontWeight: 700, fontSize: 15 }}>
                  ${parseInt(row.mrr || 0).toLocaleString()}/mo
                </div>
              </div>
            ))
          )}
        </Card>

        {/* RECENT SIGNUPS */}
        <Card>
          <SectionHeader
            icon={IpActivity}
            title="Recent signups"
            action={<Button variant="ghost" size="sm" onClick={() => router.push('/admin/customers')}>View all <IpChevronRight size={12} /></Button>}
          />
          {stats.recentSignups.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/admin/customers/${c.id}`)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 150ms' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.business_name}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{c.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge variant={c.suspended ? 'error' : c.status === 'active' ? 'success' : 'warning'}>
                  {c.suspended ? 'Suspended' : c.plan || c.status}
                </Badge>
                <IpChevronRight size={14} style={{ color: t.textMuted }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* QUICK STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.warning, fontFamily: 'monospace' }}>{stats.users.trial || 0}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Trial accounts</div>
        </Card>
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.error, fontFamily: 'monospace' }}>{stats.users.suspended || 0}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Suspended</div>
        </Card>
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.primary, fontFamily: 'monospace' }}>{stats.posts.posted || 0}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Posts published</div>
        </Card>
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.success, fontFamily: 'monospace' }}>{parseInt(stats.posts.credits_consumed || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Credits consumed</div>
        </Card>
      </div>

      {stats.users.suspended > 0 && (
        <Card style={{ borderColor: 'rgba(234,179,8,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IpWarning size={18} style={{ color: t.warning }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{stats.users.suspended} suspended account{stats.users.suspended > 1 ? 's' : ''}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Review and reactivate as needed</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => router.push('/admin/customers?suspended=true')}>Review</Button>
          </div>
        </Card>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
