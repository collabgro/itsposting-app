import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpCheck, IpCredits, IpSparkle, IpCrown, IpBilling, IpSchedule,
  IpTrendingUp, IpArrowUpRight, IpArrowDownRight, IpWarning, IpGift,
  IpExternalLink, IpDollar, IpClose,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Spinner, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { billingAPI, referralsAPI } from '../lib/api';

const PLAN_ICONS = { trial: IpGift, starter: IpCredits, professional: IpSparkle, premium: IpCrown };
const PLAN_TAGLINES = {
  starter:      'Good for 1-person businesses just getting started',
  professional: 'Best for businesses posting 3× or more per week',
  premium:      'For businesses serious about growing their online presence',
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
  const TX_META = {
    bonus:               { label: 'Bonus',            color: t.success,   dir: 1 },
    monthly_allocation:  { label: 'Monthly credits',  color: t.primary,   dir: 1 },
    admin_grant:         { label: 'Admin grant',       color: t.success,   dir: 1 },
    admin_deduction:     { label: 'Admin deduction',   color: t.error,     dir: -1 },
    usage:               { label: 'Used',              color: t.textMuted, dir: -1 },
    debit:               { label: 'Post generated',    color: t.textMuted, dir: -1 },
    purchase:            { label: 'Purchase',          color: t.primary,   dir: 1 },
    refund:              { label: 'Refund',            color: t.success,   dir: 1 },
    refund_failed:       { label: 'Refund failed',     color: t.error,     dir: -1 },
  };
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
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'referral'
  const [referralData, setReferralData] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadData();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, currentRes, historyRes] = await Promise.allSettled([
        billingAPI.getPlans().then(r => r.data),
        billingAPI.getCurrent().then(r => r.data),
        billingAPI.getHistory().then(r => r.data),
      ]);

      if (plansRes.status === 'fulfilled') {
        const resolvedPlans = Array.isArray(plansRes.value) ? plansRes.value : [];
        setPlans(resolvedPlans);
        if (resolvedPlans.length === 0) setPlansError(true);
      } else {
        console.error('[Billing] plans fetch failed:', plansRes.reason);
        setPlansError(true);
      }

      if (currentRes.status === 'fulfilled') {
        setCurrent(currentRes.value);
        if (currentRes.value?.billingCycle) setCycle(currentRes.value.billingCycle);
      } else {
        console.error('[Billing] current fetch failed:', currentRes.reason);
      }

      if (historyRes.status === 'fulfilled') {
        setHistory(Array.isArray(historyRes.value) ? historyRes.value : []);
      } else {
        console.error('[Billing] history fetch failed:', historyRes.reason);
      }
    } catch (err) {
      console.error('[Billing] loadData error:', err);
      setPlansError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    setCheckingOut(plan.id);
    setUpgradeError('');
    try {
      const { data } = await billingAPI.getCheckoutLink(plan.id, cycle);
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeError(data.error || 'Checkout link unavailable. Please contact support.');
      }
    } catch (err) {
      setUpgradeError(err.response?.data?.error || 'Could not connect to billing. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  };

  const handleBuyCredits = async (pack) => {
    setBuyingPack(pack.id);
    setCreditMsg('');
    setUpgradeError('');
    try {
      const { data } = await billingAPI.buyCredits(pack.id);
      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        setCreditMsg(data.message);
      } else {
        setUpgradeError('Unable to process. Please contact support.');
      }
    } catch (err) {
      setUpgradeError(err.response?.data?.error || 'Could not connect to billing. Please try again.');
    } finally {
      setBuyingPack(null);
    }
  };

  const handleCancelPlan = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await billingAPI.cancel();
      setShowCancelModal(false);
      await loadData();
    } catch (err) {
      setCancelError(err.response?.data?.error || err.message || 'Cancellation failed');
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
  const totalCredits = balance + usedThisMonth;
  const usagePct = Math.min(100, totalCredits > 0 ? Math.round((usedThisMonth / totalCredits) * 100) : 0);

  const trialDaysLeft = current?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(current.trialEndsAt) - Date.now()) / 86_400_000))
    : null;

  const isTrial = current?.currentPlan?.id === 'trial';
  const isCancelled = current?.status === 'cancelled';
  const nonTrialPlans = plans.filter(p => p.id !== 'trial');

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  const displayPrice = (plan) => {
    if (cycle === 'yearly') return plan.yearlyPrice ?? Math.round(plan.price * 0.9);
    return plan.price;
  };

  return (
    <Layout title="Plans & Billing" subtitle="Manage your subscription and credit usage">
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* ── TOP ROW ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Current plan */}
          <div style={{
            background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryHover} 100%)`,
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
                <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
                  ${current?.billingCycle === 'yearly'
                    ? (current?.currentPlan?.yearlyPrice ?? current?.currentPlan?.price ?? 0)
                    : (current?.currentPlan?.price ?? 0)}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>
                  {current?.billingCycle === 'yearly' ? 'per month · billed yearly' : 'per month'}
                </div>
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

          {/* Credit usage — circular ring */}
          <div style={{ ...gc, padding: 24 }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Credit usage this month
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* SVG Circular progress ring */}
              {(() => {
                const R = 42, C = 2 * Math.PI * R;
                const ringColor = usagePct >= 90 ? t.error : usagePct >= 70 ? t.warning : t.primary;
                const dashOffset = C * (1 - Math.min(usagePct, 100) / 100);
                return (
                  <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                    <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      <defs>
                        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={ringColor} />
                          <stop offset="100%" stopColor={usagePct >= 90 ? '#FF6B62' : usagePct >= 70 ? '#FFB347' : '#9B7FFF'} />
                        </linearGradient>
                      </defs>
                      {/* Track */}
                      <circle cx="50" cy="50" r={R} fill="none" stroke={t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="8" />
                      {/* Progress */}
                      <circle cx="50" cy="50" r={R} fill="none" stroke="url(#ring-grad)" strokeWidth="8"
                        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: 'monospace', lineHeight: 1 }}>{usagePct}</div>
                      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>%</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: t.text, letterSpacing: '-0.04em' }}>{usedThisMonth}</span>
                  <span style={{ fontSize: 13, color: t.textMuted }}> / {totalCredits}</span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>credits used this month</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.primary, fontFamily: 'monospace' }}>{balance}</span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>remaining</span>
                </div>
                {usagePct >= 80 && (
                  <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: t.warning, fontSize: 12, fontWeight: 700, padding: '4px 10px', background: `${t.warning}15`, borderRadius: 6 }}>
                    <IpWarning size={12} /> {usagePct >= 95 ? 'Almost out!' : 'Running low'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── TAB NAV ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: t.input, border: `1px solid ${t.border}`, borderRadius: 12, padding: 4 }}>
          {[
            { id: 'plans',    label: 'Plans & Credits', icon: IpCredits },
            { id: 'referral', label: 'Refer & Earn',    icon: IpGift },
          ].map(tab => (
            <button key={tab.id} onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'referral' && !referralData && !referralLoading) {
                setReferralLoading(true);
                referralsAPI.getMyCode().then(r => setReferralData(r.data)).catch(() => {}).finally(() => setReferralLoading(false));
              }
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 150ms', background: activeTab === tab.id ? t.primary : 'transparent', color: activeTab === tab.id ? '#fff' : t.textMuted, boxShadow: activeTab === tab.id ? '0 2px 8px rgba(124,92,252,0.3)' : 'none' }}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── REFERRAL TAB ─────────────────────────────────────────── */}
        {activeTab === 'referral' && (
          <div>
            {referralLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
            ) : referralData ? (
              <>
                {/* Hero */}
                <div style={{ background: `linear-gradient(135deg, ${t.primary} 0%, #9B7FFF 50%, #6D3FF2 100%)`, borderRadius: 20, padding: 32, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <IpGift size={28} style={{ color: '#fff' }} />
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Refer & Earn Credits</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Earn 20 free credits for every business that upgrades</div>
                      </div>
                    </div>
                    {/* Referral link */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IpExternalLink size={13} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralData.link}</span>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(referralData.link); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2500); }} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {referralCopied ? <><IpCheck size={14} /> Copied!</> : 'Copy link'}
                      </button>
                    </div>
                    {/* Share buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('I use ItsPosting to manage my business social media with AI. Try it free: ' + referralData.link)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>Share on X</a>
                      <a href={`https://wa.me/?text=${encodeURIComponent('Try ItsPosting — AI social media for local businesses. Free trial: ' + referralData.link)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>WhatsApp</a>
                      <a href={`mailto:?subject=Try ItsPosting&body=${encodeURIComponent('I use ItsPosting to automate my business social media with AI. Try it free: ' + referralData.link)}`} style={{ padding: '7px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>Email</a>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Total referrals',    value: referralData.total_referrals,    icon: IpTrendingUp,    color: t.primary },
                    { label: 'Upgraded to paid',   value: referralData.upgraded_referrals, icon: IpArrowUpRight,  color: '#10b981' },
                    { label: 'Credits released',   value: referralData.credits_earned,     icon: IpCredits,       color: '#10b981' },
                    { label: 'Credits pending',    value: referralData.credits_pending || 0, icon: IpCredits,     color: '#f59e0b' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
                      <stat.icon size={20} style={{ color: stat.color, margin: '0 auto 10px', display: 'block' }} />
                      <div style={{ fontSize: 32, fontWeight: 800, color: t.text, fontFamily: 'monospace', letterSpacing: '-0.04em' }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                {(referralData.credits_pending > 0) && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#f59e0b', marginBottom: 16 }}>
                    <strong>{referralData.credits_pending} credits</strong> are pending admin review for {referralData.pending_count} referral{referralData.pending_count !== 1 ? 's' : ''}. Credits are released once an admin approves the award.
                  </div>
                )}

                {/* How it works */}
                <div style={{ background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>How it works</div>
                  {[
                    { step: '1', text: 'Share your referral link with another local business owner' },
                    { step: '2', text: 'They sign up and try ItsPosting free for 7 days' },
                    { step: '3', text: 'When they upgrade to a paid plan, you automatically earn 20 credits' },
                    { step: '4', text: 'No limit — refer as many businesses as you like' },
                  ].map(item => (
                    <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{item.step}</div>
                      <span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, paddingTop: 4 }}>{item.text}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: '12px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, fontSize: 12, color: t.textSecondary }}>
                    <strong style={{ color: t.primary }}>Your referral code: </strong>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em', color: t.text }}>{referralData.code}</span>
                    <span style={{ color: t.textMuted }}> — Include this in your referral link automatically</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: t.textMuted, fontSize: 14 }}>
                Could not load referral data. <button onClick={() => { setReferralLoading(true); referralsAPI.getMyCode().then(r => setReferralData(r.data)).catch(() => {}).finally(() => setReferralLoading(false)); }} style={{ color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Try again</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plans' && <>

        {/* ── BILLING CYCLE TOGGLE ──────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>
              {isTrial ? 'Pick the right plan for your business' : 'Your plan options'}
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
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: `${t.success}33`, color: t.success, padding: '2px 6px', borderRadius: 4 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24, paddingTop: 14 }}>
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
                  background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card,
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: `2px solid ${isCurrent ? t.primary : plan.popular ? 'rgba(124,92,252,0.4)' : t.border}`,
                  borderRadius: 20, padding: 24, position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  opacity: isDowngrade ? 0.6 : 1,
                  boxShadow: isCurrent
                    ? `0 0 0 1px rgba(124,92,252,0.25), 0 12px 40px rgba(124,92,252,0.18), inset 0 1px 0 rgba(255,255,255,0.06)`
                    : plan.popular
                      ? `0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)`
                      : `${t.shadowMd}, inset 0 1px 0 rgba(255,255,255,0.03)`,
                  transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
                }}
                onMouseEnter={e => { if (!isDowngrade) { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = t.shadowXl; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                    background: `linear-gradient(135deg, ${t.primary}, ${t.primaryHover})`, color: '#fff', padding: '4px 14px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>
                    Your Plan
                  </div>
                )}

                <PlanIcon size={20} color="url(#brand-gradient)" style={{ marginBottom: 10 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>{plan.name}</h3>
                {PLAN_TAGLINES[plan.id] && (
                  <p style={{ fontSize: 12, color: t.textMuted, margin: '0 0 10px', lineHeight: 1.4 }}>{PLAN_TAGLINES[plan.id]}</p>
                )}

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>${price}</span>
                  <span style={{ color: t.textMuted, fontSize: 14 }}> / mo</span>
                  {cycle === 'yearly' && (
                    <span style={{ display: 'block', fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      billed annually · <span style={{ textDecoration: 'line-through' }}>${plan.price}/mo</span>
                    </span>
                  )}
                  {cycle === 'yearly' && (
                    <span style={{ display: 'block', fontSize: 12, color: t.success, marginTop: 4, fontWeight: 600 }}>
                      ${Math.round(price * 12)}/yr — save ${Math.round((plan.price - price) * 12)}
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
                  onClick={() => {
                    if (isDowngrade) { window.location.href = 'mailto:support@itsposting.com?subject=Downgrade request'; return; }
                    if (!isCurrent) handleUpgrade(plan);
                  }}
                  disabled={isCurrent || !!checkingOut}
                  variant={isCurrent ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14, fontWeight: 700, gap: 6 }}
                >
                  {isCurrent ? (
                    <><IpCheck size={13} strokeWidth={3} /> Current plan</>
                  ) : isDowngrade ? (
                    'Email us to downgrade'
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
          <div style={{ padding: '14px 18px', background: `${t.error}15`, border: `1px solid ${t.error}33`, borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <IpWarning size={16} style={{ color: t.error, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.error, marginBottom: 2 }}>Checkout unavailable</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{upgradeError}</div>
            </div>
            <button onClick={() => setUpgradeError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 0, lineHeight: 1 }}><IpClose size={16} /></button>
          </div>
        )}

        {/* ── BUY MORE CREDITS ───────────────────────────────────────── */}
        <div style={{ ...gc, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <IpCredits size={16} color="url(#brand-gradient)" />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: 0 }}>Buy More Credits</h3>
              </div>
              <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>Top up your balance anytime — added instantly, never expire</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: t.textMuted }}>
              <span>Photo post = 3 credits</span>
              <span>Carousel = 5 credits</span>
              <span>Video = 10 credits</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {CREDIT_PACKS.map(pack => {
              const isBestValue = pack.id === 'credits_200';
              const isRecommended = pack.id === 'credits_100';
              const costPerCredit = (pack.price / pack.amount).toFixed(2);
              const photoEquiv = Math.floor(pack.amount / 3);
              const carouselEquiv = Math.floor(pack.amount / 5);
              const context = pack.amount >= 100
                ? `≈ ${carouselEquiv} carousels`
                : `≈ ${photoEquiv} photo posts`;
              const isActive = buyingPack === pack.id;

              return (
                <button
                  key={pack.id}
                  onClick={() => handleBuyCredits(pack)}
                  disabled={!!buyingPack}
                  style={{
                    padding: '16px 12px', border: `2px solid ${isActive ? t.primaryBorder : isRecommended ? t.primaryBorder : isBestValue ? 'rgba(251,191,36,0.5)' : t.border}`,
                    borderRadius: 12, background: isActive ? t.primaryBg : isRecommended ? t.primaryBg : t.input,
                    cursor: buyingPack ? 'not-allowed' : 'pointer', textAlign: 'center',
                    transition: 'all 150ms', opacity: buyingPack && !isActive ? 0.5 : 1,
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!buyingPack) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; } }}
                  onMouseLeave={e => { if (!buyingPack) { e.currentTarget.style.borderColor = isRecommended ? t.primaryBorder : isBestValue ? 'rgba(251,191,36,0.5)' : t.border; e.currentTarget.style.background = isRecommended ? t.primaryBg : t.input; } }}
                >
                  {isBestValue && (
                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#fff', padding: '2px 10px', borderRadius: 9999, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      Best Value
                    </div>
                  )}
                  {isRecommended && !isBestValue && (
                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: t.primary, color: '#fff', padding: '2px 10px', borderRadius: 9999, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      Popular
                    </div>
                  )}
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.primary, fontFamily: 'monospace', lineHeight: 1 }}>{pack.amount}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 8 }}>credits</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 6 }}>${pack.price}</div>
                  <div style={{ fontSize: 10, color: t.textSecondary, padding: '3px 6px', background: 'rgba(124,92,252,0.08)', borderRadius: 6 }}>{context}</div>
                  {isActive && <div style={{ fontSize: 10, color: t.primary, marginTop: 6, fontWeight: 600 }}>Redirecting…</div>}
                </button>
              );
            })}
          </div>
          {creditMsg && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              {creditMsg}
              <button onClick={() => setCreditMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={14} /></button>
            </div>
          )}
        </div>

        {/* ── CREDIT HISTORY ─────────────────────────────────────────── */}
        <div style={{ ...gc, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IpTrendingUp size={16} color="url(#brand-gradient)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Credit history</span>
            <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 'auto' }}>Last 50 transactions</span>
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon={IpDollar}
              title="No transactions yet"
              subtitle="Your credit usage history will appear here after your first post."
            />
          ) : (
            <div>
              {history.map((tx, idx) => {
                const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: t.textMuted, dir: 1 };
                const positive = tx.amount >= 0;
                const Icon = positive ? IpArrowUpRight : IpArrowDownRight;
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 20px',
                      borderBottom: idx < history.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: positive ? `${t.success}1a` : `${t.error}1a`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} style={{ color: positive ? t.success : t.error }} />
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
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: positive ? t.success : t.error }}>
                        {positive ? '+' : ''}{tx.amount}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        After: {tx.balance_after}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

        </> }
        {/* END plans tab */}

      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: t.isDark ? 'rgba(12,12,20,0.95)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', borderRadius: 22, padding: 32, maxWidth: 420, width: '100%', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`, boxShadow: t.isDark ? '0 24px 64px rgba(0,0,0,0.65), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 16px 48px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,1)' }}>
            <IpWarning size={28} style={{ color: t.error, display: 'block', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, textAlign: 'center', margin: '0 0 10px' }}>
              Cancel your subscription?
            </h3>
            <p style={{ fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 1.6, margin: '0 0 20px' }}>
              You'll keep full <strong>{current?.currentPlan?.name}</strong> access until{' '}
              <strong>{current?.planExpiresAt ? new Date(current.planExpiresAt).toLocaleDateString() : 'your billing date'}</strong>.
              After that, your account returns to the free trial. We won't charge your card again.
            </p>
            {cancelError && (
              <div style={{ padding: '10px 14px', background: `${t.error}15`, border: `1px solid ${t.error}33`, borderRadius: 8, fontSize: 12, color: t.error, marginBottom: 16 }}>
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
                style={{ flex: 1, justifyContent: 'center', background: t.error, color: '#fff' }}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      </div>
    </Layout>
  );
}

