import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useTheme } from '../../lib/theme';
import { useBranding } from '../../lib/branding';
import { agencyAPI } from '../../lib/api';
import {
  IpSparkle, IpTeam, IpDollar, IpAnalytics, IpPlus, IpChevronRight,
  IpWarning, IpMail, IpClose,
} from '../../components/icons';
import { SectionHeader, Spinner } from '../../components/ui';

function timeAgo(ts) {
  if (!ts) return 'Never';
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60)    return 'just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function BroadcastModal({ t, onClose, onSent }) {
  const [title, setTitle]   = useState('');
  const [msg, setMsg]       = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !msg.trim()) { setErr('Title and message are required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const { data } = await agencyAPI.broadcast({ title: title.trim(), message: msg.trim() });
      onSent(data.sent || 0);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Message All Clients</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Title</label>
            <input style={{ width: '100%', padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, boxSizing: 'border-box' }} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Platform update tonight" autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Message</label>
            <textarea style={{ width: '100%', padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, boxSizing: 'border-box', resize: 'vertical', minHeight: 90 }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Your message to all client workspaces…" />
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>Sends an in-app notification to all active client workspaces.</div>
          {err && <div style={{ fontSize: 12, color: t.error, marginBottom: 10 }}>{err}</div>}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px 0', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Sending…' : 'Send to All Clients'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgencyOverview() {
  const router    = useRouter();
  const { t }     = useTheme();
  const { appName } = useBranding();
  const [overview,   setOverview]   = useState(null);
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showBcast,  setShowBcast]  = useState(false);
  const [bcastMsg,   setBcastMsg]   = useState('');
  const [mounted,    setMounted]    = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    Promise.all([agencyAPI.getOverview(), agencyAPI.getAnalytics()])
      .then(([ov, an]) => {
        setOverview(ov.data);
        setAnalytics(an.data);
      })
      .catch(e => {
        const msg = e.response?.data?.error || e.message;
        if (e.response?.status === 403) {
          setError('Agency plan required. Please upgrade to access the Agency Dashboard.');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
    return () => window.removeEventListener('resize', check);
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
          <button onClick={() => router.push('/billing')} style={{ padding: '10px 22px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>View Plans</button>
        </div>
      </div>
    </Layout>
  );

  const stats = [
    { label: 'Total Clients',          value: overview?.totalClients || 0,          icon: IpTeam,      color: '#7C5CFC' },
    { label: 'Active Clients',          value: overview?.activeClients || 0,         icon: IpSparkle,   color: '#30D158' },
    { label: 'Credits Remaining',       value: overview?.creditsRemaining || 0,      icon: IpDollar,    color: '#FF9F0A' },
    { label: 'Credits Used This Month', value: Math.round(overview?.creditsUsedThisMonth || 0), icon: IpAnalytics, color: '#0A84FF' },
  ];

  const clients   = analytics?.clients || [];
  const atRisk    = analytics?.atRisk  || [];
  const maxCredits = Math.max(...clients.map(c => parseFloat(c.credits_used_this_month || 0)), 1);

  return (
    <Layout title="Agency" subtitle={`${appName} Agency Dashboard`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBcast(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: t.text, cursor: 'pointer' }}>
            <IpMail size={14} /> Message Clients
          </button>
          <button onClick={() => router.push('/agency/clients')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: t.primary, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <IpPlus size={14} /> Add Client
          </button>
        </div>
      }
    >
      <div style={gc}>

        {bcastMsg && (
          <div style={{ padding: '12px 18px', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: 10, color: '#30D158', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            {bcastMsg}
          </div>
        )}

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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (clients.length > 0 ? '1fr 320px' : '1fr'), gap: 20, marginBottom: 28, alignItems: 'start' }}>

          {/* Credit usage bar chart */}
          {clients.length > 0 && (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
              <SectionHeader icon={IpAnalytics} title="Credits Used This Month" subtitle="By client workspace" />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clients.slice(0, 8).map(c => {
                  const used   = parseFloat(c.credits_used_this_month || 0);
                  const budget = c.monthly_credit_budget ? parseInt(c.monthly_credit_budget) : null;
                  const pct    = budget ? Math.min(100, (used / budget) * 100) : (used / maxCredits) * 100;
                  const name   = c.workspace_display_name || c.business_name;
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: t.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{name}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>{used}{budget ? ` / ${budget}` : ''} credits</span>
                      </div>
                      <div style={{ height: 6, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#FF453A' : pct >= 70 ? '#FF9F0A' : t.primary, borderRadius: 3, transition: 'width 600ms ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {clients.length > 8 && (
                <button onClick={() => router.push('/agency/clients')} style={{ marginTop: 14, fontSize: 12, color: t.primary, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  View all {clients.length} clients →
                </button>
              )}
            </div>
          )}

          {/* At-risk clients */}
          {atRisk.length > 0 && (
            <div style={{ background: t.card, border: `1px solid rgba(255,159,10,0.3)`, borderRadius: 14, padding: 20 }}>
              <SectionHeader icon={IpWarning} title="Need Attention" subtitle={`${atRisk.length} client${atRisk.length > 1 ? 's' : ''} haven't posted in 7+ days`} />
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {atRisk.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.workspace_display_name || c.business_name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>Last post: {timeAgo(c.last_post_at)}</div>
                    </div>
                    <button onClick={() => router.push(`/agency/clients/${c.id}`)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', background: 'rgba(255,159,10,0.12)', color: '#FF9F0A', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <SectionHeader icon={IpAnalytics} title="Recent Credit Activity" subtitle="Last 10 events across your client workspaces" />
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginTop: 14 }}>
          {(!overview?.recentActivity || overview.recentActivity.length === 0) ? (
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
                {overview.recentActivity.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < overview.recentActivity.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: t.text, fontWeight: 600 }}>{row.workspace_display_name || row.business_name}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: t.textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || row.transaction_type}</td>
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
            { title: 'Clients',              sub: `${overview?.totalClients || 0} total workspaces`,   href: '/agency/clients', icon: IpTeam,      color: '#7C5CFC' },
            { title: 'Client Plans',          sub: `${overview?.activePlans || 0} active plans`,       href: '/agency/plans',   icon: IpDollar,    color: '#FF9F0A' },
            { title: 'White-Label Branding', sub: 'Logo, colors, AI name, signup URL',                href: '/settings?tab=white-label', icon: IpSparkle, color: '#0A84FF' },
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

      {showBcast && (
        <BroadcastModal
          t={t}
          onClose={() => setShowBcast(false)}
          onSent={count => { setShowBcast(false); setBcastMsg(`✓ Message sent to ${count} client workspace${count !== 1 ? 's' : ''}`); setTimeout(() => setBcastMsg(''), 5000); }}
        />
      )}
    </Layout>
  );
}
