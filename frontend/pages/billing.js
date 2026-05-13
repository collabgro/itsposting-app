import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpCheck, IpCredits, IpSparkle, IpCrown, IpBilling, IpSchedule,
  IpTrendingUp, IpArrowUpRight, IpArrowDownRight, IpWarning, IpGift,
  IpExternalLink,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Spinner } from '../components/ui';
import { useTheme } from '../lib/theme';

const PLAN_ICONS = { trial: IpGift, starter: IpCredits, professional: IpSparkle, premium: IpCrown };

const TX_META = {
  bonus:               { label: 'Bonus',            color: '#22C55E', dir: 1 },
  monthly_allocation:  { label: 'Monthly credits',  color: '#22C55E', dir: 1 },
  admin_grant:         { label: 'Admin grant',       color: '#22C55E', dir: 1 },
  admin_deduction:     { label: 'Admin deduction',   color: '#EF4444', dir: -1 },
  usage:               { label: 'Used',              color: '#A0A0B0', dir: -1 },
  purchase:            { label: 'Purchase',          color: '#22C55E', dir: 1 },
  refund:              { label: 'Refund',            color: '#60A5FA', dir: 1 },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000) || 1}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const CREDIT_PACKS = [
  { id: 'credits_25',  amount: 25,  price: 10 },
  { id: 'credits_50',  amount: 50,  price: 20 },
  { id: 'credits_75',  amount: 75,  price: 30 },
  { id: 'credits_100', amount: 100, price: 40 },
  { id: 'credits_125', amount: 125, price: 50 },
  { id: 'credits_150', amount: 150, price: 60 },
  { id: 'credits_200', amount: 200, price: 80 },
  { id: 'credits_250', amount: 250, price: 100 },
];

export default function Billing() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [cycle, setCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [checkingOut, setCheckingOut] = useState(null); // plan id being checked out
  const [buyingPack, setBuyingPack] = useState(null); // credit pack id being purchased
  const [upgradeError, setUpgradeError] = useState('');
  const [creditMsg, setCreditMsg] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

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
      const resolvedPlans = Array.isArray(plansRes) ? plansRes : [];
      setPlans(resolvedPlans);
      if (resolvedPlans.length === 0) setPlansError(true);
      setCurrent(currentRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (err) {
      console.error(err);
      setPlansError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    setCheckingOut(plan.id);
    setUpgradeError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/billing/checkout-link?plan=${plan.id}&cycle=${cycle}`, { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeError(data.error || 'Checkout link unavailable. Please contact support.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setUpgradeError('Could not connect to billing. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  };

  const handleBuyCredits = async (pack) => {
    setBuyingPack(pack.id);
    setCreditMsg('');
    setUpgradeError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/billing/buy-credits?pack=${pack.id}`, { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        setCreditMsg(data.message);
      } else {
        setUpgradeError('Unable to process. Please contact support.');
      }
    } catch (err) {
      console.error('Buy credits error:', err);
      setUpgradeError('Could not connect to billing. Please try again.');
    } finally {
      setBuyingPack(null);
    }
  };

  const handleCancelPlan = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');
      setShowCancelModal(false);
      await loadData();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <Layout title="Plans & Billing">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spinner size={36} />
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
  const isCancelled = current?.status === 'cancelled';
  const nonTrialPlans = plans.filter(p => p.id !== 'trial');

  const displayPrice = (plan) => {
    if (cycle === 'yearly') return plan.yearlyPrice ?? Math.round(plan.price * 0.9);
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

            {!isTrial && !isCancelled && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <IpCheck size={11} />
                      {current?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} plan active
                    </div>
                    {current?.planExpiresAt && (
                      <div style={{ opacity: 0.8 }}>Renews {new Date(current.planExpiresAt).toLocaleDateString()}</div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    style={{ padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    Cancel plan
                  </button>
                </div>
              </div>
            )}
            {isCancelled && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#FCA5A5', marginBottom: 4 }}>
                  <IpWarning size={13} /> Subscription cancelled
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  Full access until {current?.planExpiresAt ? new Date(current.planExpiresAt).toLocaleDateString() : 'end of period'}. No further charges.
                </div>
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
                    Save 10%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── PLAN CARDS ─────────────────────────────────────────────── */}
        {plansError && nonTrialPlans.length === 0 && (
          <div style={{ padding: '32px 24px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, textAlign: 'center', marginBottom: 24 }}>
            <IpWarning size={28} style={{ color: t.warning, margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontSize: 14, color: t.textSecondary, margin: '0 0 12px' }}>Could not load plans — please refresh the page.</p>
            <button onClick={loadData} style={{ fontSize: 13, fontWeight: 600, color: t.primary, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
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

                <PlanIcon size={20} color="url(#brand-gradient)" style={{ marginBottom: 10 }} />
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
                    <><img src="/icon-192.png" alt="" style={{ width: 13, height: 13, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} /> Redirecting...</>
                  ) : (
                    <><IpExternalLink size={13} /> Upgrade Now</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {upgradeError && (
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <IpWarning size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', marginBottom: 2 }}>Checkout unavailable</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{upgradeError}</div>
            </div>
            <button onClick={() => setUpgradeError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── BUY MORE CREDITS ───────────────────────────────────────── */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <IpCredits size={16} color="url(#brand-gradient)" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: 0 }}>Buy More Credits</h3>
            </div>
            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>Top up your balance anytime — added instantly, never expire</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {CREDIT_PACKS.map(pack => (
              <button
                key={pack.id}
                onClick={() => handleBuyCredits(pack)}
                disabled={!!buyingPack}
                style={{
                  padding: '14px 10px', border: `1px solid ${buyingPack === pack.id ? t.primaryBorder : t.border}`, borderRadius: 10,
                  background: buyingPack === pack.id ? t.primaryBg : t.input,
                  cursor: buyingPack ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 150ms', opacity: buyingPack && buyingPack !== pack.id ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!buyingPack) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.input; }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: t.primary, fontFamily: 'monospace', lineHeight: 1 }}>{pack.amount}</div>
                <div style={{ fontSize: 11, color: t.textMuted, margin: '3px 0 8px' }}>credits</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>${pack.price}</div>
                {buyingPack === pack.id && <div style={{ fontSize: 10, color: t.primary, marginTop: 4 }}>Redirecting…</div>}
              </button>
            ))}
          </div>
          {creditMsg && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              {creditMsg}
              <button onClick={() => setCreditMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14 }}>×</button>
            </div>
          )}
        </Card>

        {/* ── CREDIT HISTORY ─────────────────────────────────────────── */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IpTrendingUp size={16} color="url(#brand-gradient)" />
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

      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: t.card, borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', border: `1px solid ${t.border}` }}>
            <IpWarning size={28} style={{ color: '#EF4444', display: 'block', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, textAlign: 'center', margin: '0 0 10px' }}>
              Cancel your subscription?
            </h3>
            <p style={{ fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 1.6, margin: '0 0 20px' }}>
              You'll keep full <strong>{current?.currentPlan?.name}</strong> access until{' '}
              <strong>{current?.planExpiresAt ? new Date(current.planExpiresAt).toLocaleDateString() : 'your billing date'}</strong>.
              After that, your account returns to the free trial. We won't charge your card again.
            </p>
            {cancelError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#EF4444', marginBottom: 16 }}>
                {cancelError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                onClick={() => { setShowCancelModal(false); setCancelError(''); }}
                variant="secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={cancelling}
              >
                Keep my plan
              </Button>
              <Button
                onClick={handleCancelPlan}
                style={{ flex: 1, justifyContent: 'center', background: '#EF4444', color: '#fff' }}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
