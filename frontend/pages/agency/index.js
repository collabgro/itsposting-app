import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useTheme } from '../../lib/theme';
import { useBranding } from '../../lib/branding';
import { agencyAPI } from '../../lib/api';
import { IpSparkle, IpTeam, IpDollar, IpAnalytics, IpPlus, IpChevronRight } from '../../components/icons';
import { StatCard, SectionHeader, Spinner } from '../../components/ui';

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60)   return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function AgencyOverview() {
  const router    = useRouter();
  const { t }     = useTheme();
  const { appName } = useBranding();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    agencyAPI.getOverview()
      .then(r => setData(r.data))
      .catch(e => {
        const msg = e.response?.data?.error || e.message;
        if (e.response?.status === 403) {
          setError('Agency plan required. Please upgrade to access the Agency Dashboard.');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (!mounted) return null;

  const gc = { maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' };

  if (loading) return (
    <Layout title="Agency" subtitle="Your agency dashboard">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner /></div>
    </Layout>
  );

  if (error) return (
    <Layout title="Agency" subtitle="Your agency dashboard">
      <div style={gc}>
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: t.error, marginBottom: 16 }}>{error}</div>
          <button onClick={() => router.push('/billing')} style={{ padding: '10px 22px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            View Plans
          </button>
        </div>
      </div>
    </Layout>
  );

  const stats = [
    { label: 'Total Clients',          value: data?.totalClients || 0,          icon: IpTeam,      color: '#7C5CFC' },
    { label: 'Active Clients',          value: data?.activeClients || 0,          icon: IpSparkle,   color: '#30D158' },
    { label: 'Credits Remaining',       value: data?.creditsRemaining || 0,       icon: IpDollar,    color: '#FF9F0A' },
    { label: 'Credits Used This Month', value: data?.creditsUsedThisMonth || 0,   icon: IpAnalytics, color: '#0A84FF' },
  ];

  return (
    <Layout title="Agency" subtitle="Manage your clients and plans">
      <div style={gc}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={20} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/agency/clients')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <IpPlus size={15} /> Add Client
          </button>
          <button onClick={() => router.push('/agency/plans')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.card, color: t.text, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <IpDollar size={15} /> Manage Plans
          </button>
          <button onClick={() => router.push('/settings?tab=white-label')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: t.card, color: t.text, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <IpSparkle size={15} /> White-Label Branding
          </button>
        </div>

        {/* Recent activity */}
        <SectionHeader icon={IpAnalytics} title="Recent Client Activity" subtitle="Last 10 credit events across your client workspaces" />
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginTop: 14 }}>
          {(!data?.recentActivity || data.recentActivity.length === 0) ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
              No activity yet — add your first client to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Client', 'Event', 'Credits', 'When'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < data.recentActivity.length - 1 ? `1px solid ${t.border}` : 'none', background: 'transparent' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: t.text, fontWeight: 600 }}>{row.workspace_display_name || row.business_name}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: t.textMuted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || row.transaction_type}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: row.amount < 0 ? t.error : '#30D158' }}>{row.amount > 0 ? '+' : ''}{row.amount}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: t.textMuted }}>{timeAgo(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick nav cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 28 }}>
          {[
            { title: 'Clients', sub: `${data?.totalClients || 0} total workspaces`, href: '/agency/clients', icon: IpTeam, color: '#7C5CFC' },
            { title: 'Client Plans', sub: `${data?.activePlans || 0} active plans`, href: '/agency/plans', icon: IpDollar, color: '#FF9F0A' },
            { title: 'White-Label Branding', sub: 'Logo, colors, AI name', href: '/settings?tab=white-label', icon: IpSparkle, color: '#0A84FF' },
          ].map(card => (
            <button key={card.title} onClick={() => router.push(card.href)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <card.icon size={20} color={card.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{card.title}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{card.sub}</div>
              </div>
              <IpChevronRight size={16} color={t.textMuted} />
            </button>
          ))}
        </div>

      </div>
    </Layout>
  );
}
