import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpCheck, IpCredits, IpSparkle, IpCrown, IpBilling, IpSchedule,
  IpTrendingUp, IpArrowUpRight, IpArrowDownRight, IpWarning, IpGift,
  IpLoader, IpExternalLink,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button } from '../components/ui';
import { useTheme } from '../lib/theme';

const PLAN_ICONS = { trial: IpGift, starter: IpCredits, professional: IpSparkle, premium: IpCrown };

const TX_META = {
  bonus:           { label: 'Bonus',           color: '#22C55E', dir: 1 },
  admin_grant:     { label: 'Admin grant',      color: '#22C55E', dir: 1 },
  admin_deduction: { label: 'Admin deduction',  color: '#EF4444', dir: -1 },
  usage:           { label: 'Used',             color: '#A0A0B0', dir: -1 },
  purchase:        { label: 'Purchase',         color: '#22C55E', dir: 1 },
  refund:          { label: 'Refund',           color: '#60A5FA', dir: 1 },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000) || 1}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const YEARLY_DISCOUNT = 0.20; // 20% off for annual billing

export default function Billing() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [checkingOut, setCheckingOut] = useState(null); // plan id being checked out

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    try {
      const [plansRes, currentRes, historyRes] = await Promise.all([
        fetch('/api/billing/plans', { headers }).then(r => r.json()),
        fetch('/api/billing/current', { headers }).then(r => r.json()),
        fetch('/api/billing/history', { headers }).then(r => r.json()),
      ]);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
      setCurrent(currentRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    setCheckingOut(plan.id);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/billing/checkout-link?plan=${plan.id}&cycle=${cycle}`, { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckingOut(null);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <Layout title="Plans & Billing">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${t.primaryBg}`, borderTopColor: t.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Layout>
    );
  }

  const planCredits = current?.currentPlan?.credits || 10;
  const usedThisMonth = parseInt(current?.creditsUsedThisMonth) || 0;
  const balance = parseInt(current?.creditsBalance) || 0;
  const usagePct = Math.min(100, planCredits > 0 ? Math.round((usedThisMonth / planCredits) * 100) : 0);

  const trialDaysLeft = current?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(current.trialEndsAt) - Date.now()) / 86_400_000))
    : null;

  const isTrial = current?.currentPlan?.id === 'trial';
  const nonTrialPlans = plans.filter(p => p.id !== 'trial');

  const displayPrice = (plan) => {
    if (cycle === 'yearly') return Math.round(plan.price * (1 - YEARLY_DISCOUNT));
    return plan.price;
  };

  return (
    <Layout title="Plans & Billing" subtitle="Manage your subscription and credit usage">
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* ── TOP ROW ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Current plan */}
          <div style={{
            background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)',
            borderRadius: 16, padding: 24, color: '#fff',
          }}>
            <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Current plan
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  {current?.currentPlan?.name}
                </h2>
                {current?.planChangedAt && (
                  <p style={{ opacity: 0.7, fontSize: 12, margin: '4px 0 0' }}>
                    Since {new Date(current.planChangedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>${current?.currentPlan?.price ?? 0}</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>per month</div>
              </div>
            </div>

            {isTrial && trialDaysLeft !== null && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IpSchedule size={14} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {trialDaysLeft === 0 ? 'Trial ends today' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left on trial`}
                </span>
              </div>
            )}

            {current?.hasActiveMembership && (
              <div style={{ marginTop: 16, padding: '8px 14px', background: 'rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IpCheck size={12} /> Active Whop subscription
              </div>
            )}
          </div>

          {/* Credit usage */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Credit usage this month
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 32, fontWeight: 800, fontFamily: 'monospace', color: t.text }}>{usedThisMonth}</span>
                <span style={{ fontSize: 14, color: t.textMuted }}> / {planCredits}</span>
              </div>
              <span style={{ fontSize: 13, color: usagePct >= 90 ? t.error : usagePct >= 70 ? t.warning : t.success, fontWeight: 700 }}>
                {usagePct}%
              </span>
            </div>

            <div style={{ height: 8, background: t.input, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 600ms ease',
                width: `${usagePct}%`,
                background: usagePct >= 90
                  ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                  : usagePct >= 70
                  ? 'linear-gradient(90deg, #EAB308, #CA8A04)'
                  : 'linear-gradient(90deg, #7C5CFC, #5B3FF0)',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div>
                <span style={{ color: t.textMuted }}>Balance: </span>
                <span style={{ color: t.primary, fontWeight: 700, fontFamily: 'monospace' }}>{balance}</span>
                <span style={{ color: t.textMuted }}> credits</span>
              </div>
              {usagePct >= 80 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: t.warning, fontSize: 12, fontWeight: 600 }}>
                  <IpWarning size={12} /> Running low
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── BILLING CYCLE TOGGLE ──────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>
              {isTrial ? 'Choose a plan to get started' : 'Available plans'}
            </h3>
            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
              Payments processed securely by Whop. Cancel anytime.
            </p>
          </div>

          <div style={{ display: 'flex', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, padding: 4, gap: 4 }}>
            {['monthly', 'yearly'].map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 150ms',
                  background: cycle === c ? t.primary : 'transparent',
                  color: cycle === c ? '#fff' : t.textMuted,
                }}
              >
                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                {c === 'yearly' && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.2)', color: '#22C55E', padding: '2px 6px', borderRadius: 4 }}>
                    -20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── PLAN CARDS ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {nonTrialPlans.map(plan => {
            const isCurrent = current?.currentPlan?.id === plan.id;
            const isDowngrade = !isTrial && !isCurrent &&
              (nonTrialPlans.findIndex(p => p.id === plan.id) < nonTrialPlans.findIndex(p => p.id === current?.currentPlan?.id));
            const PlanIcon = PLAN_ICONS[plan.id] || IpCredits;
            const isCheckingOut = checkingOut === plan.id;
            const price = displayPrice(plan);

            return (
              <div
                key={plan.id}
                style={{
                  background: t.card,
                  border: `2px solid ${isCurrent ? t.primary : plan.popular ? 'rgba(124,92,252,0.4)' : t.border}`,
                  borderRadius: 16, padding: 24, position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  opacity: isDowngrade ? 0.6 : 1,
                }}
              >
                {plan.popular && !isCurrent && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: t.primary, color: '#fff', padding: '4px 14px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>
                    Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', color: '#fff', padding: '4px 14px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>
                    Your Plan
                  </div>
                )}

                <PlanIcon size={20} style={{ color: t.primary, marginBottom: 10 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>{plan.name}</h3>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>${price}</span>
                  <span style={{ color: t.textMuted, fontSize: 13 }}> / mo</span>
                  {cycle === 'yearly' && (
                    <span style={{ display: 'block', fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      billed annually · <span style={{ textDecoration: 'line-through' }}>${plan.price}/mo</span>
                    </span>
                  )}
                </div>

                <div style={{ background: t.input, padding: '10px 12px', borderRadius: 8, marginBottom: 14, border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>Credits / month</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: t.primary, fontFamily: 'monospace' }}>{plan.credits}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ padding: '4px 0', fontSize: 13, color: t.textSecondary, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <IpCheck size={13} strokeWidth={3} style={{ color: t.success, flexShrink: 0, marginTop: 2 }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => !isCurrent && !isDowngrade && handleUpgrade(plan)}
                  disabled={isCurrent || isDowngrade || !!checkingOut}
                  variant={isCurrent ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', gap: 6 }}
                >
                  {isCurrent ? (
                    <><IpCheck size={13} strokeWidth={3} /> Current plan</>
                  ) : isDowngrade ? (
                    'Contact us to downgrade'
                  ) : isCheckingOut ? (
                    <><IpLoader size={13} /> Redirecting...</>
                  ) : (
                    <><IpExternalLink size={13} /> Upgrade Now</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── CREDIT HISTORY ─────────────────────────────────────────── */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IpTrendingUp size={16} style={{ color: t.primary }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Credit history</span>
            <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 'auto' }}>Last 50 transactions</span>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <IpBilling size={28} style={{ color: t.textMuted, margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>No transactions yet</p>
            </div>
          ) : (
            <div>
              {history.map(tx => {
                const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: t.textMuted, dir: 1 };
                const positive = meta.dir > 0 || tx.amount > 0;
                const Icon = positive ? IpArrowUpRight : IpArrowDownRight;
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 20px', borderBottom: `1px solid ${t.border}`,
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} style={{ color: positive ? '#22C55E' : '#EF4444' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || meta.label}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        {new Date(tx.created_at).toLocaleString()} · {timeAgo(tx.created_at)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: positive ? '#22C55E' : '#EF4444' }}>
                        {positive ? '+' : ''}{tx.amount}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        bal: {tx.balance_after}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
