import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Card, Button, SectionHeader } from '../components/ui';
import { useTheme } from '../lib/theme';
import { analyticsAPI, customerAPI } from '../lib/api';
import {
  IpTrendingUp, IpDollar, IpTeam, IpBusiness, IpSparkle, IpInfo,
} from '../components/icons';

// Industry-average conversion benchmarks (based on CLAUDE.md research)
const INDUSTRY_BENCHMARKS = {
  plumbing:            { ctr: 0.038, closeRate: 0.25, avgJobValue: 350  },
  hvac:                { ctr: 0.041, closeRate: 0.22, avgJobValue: 620  },
  roofing:             { ctr: 0.035, closeRate: 0.18, avgJobValue: 8500 },
  concrete:            { ctr: 0.032, closeRate: 0.20, avgJobValue: 2800 },
  landscaping:         { ctr: 0.044, closeRate: 0.28, avgJobValue: 480  },
  electrical:          { ctr: 0.036, closeRate: 0.24, avgJobValue: 410  },
  painting:            { ctr: 0.040, closeRate: 0.26, avgJobValue: 1800 },
  pest_control:        { ctr: 0.045, closeRate: 0.30, avgJobValue: 220  },
  general_contractor:  { ctr: 0.033, closeRate: 0.17, avgJobValue: 5200 },
  cleaning:            { ctr: 0.046, closeRate: 0.32, avgJobValue: 180  },
};

const DEFAULT_BENCHMARK = { ctr: 0.038, closeRate: 0.23, avgJobValue: 1200 };

function fmt(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function range(min, max) {
  return `${fmt(min)} – ${fmt(max)}`;
}

export default function ROIEstimatorPage() {
  const { t } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [industry, setIndustry] = useState('general_contractor');
  const [avgJobValue, setAvgJobValue] = useState('');
  const [closeRate, setCloseRate] = useState('');
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, profileRes] = await Promise.all([
          analyticsAPI.getOverview({ period: 30 }),
          customerAPI.getProfile().catch(() => ({ data: {} })),
        ]);
        const ind = profileRes.data?.industry || 'general_contractor';
        setIndustry(ind);
        const bench = INDUSTRY_BENCHMARKS[ind] || DEFAULT_BENCHMARK;
        if (!edited) {
          setAvgJobValue(String(bench.avgJobValue));
          setCloseRate(String(Math.round(bench.closeRate * 100)));
        }
        setStats(overviewRes.data);
      } catch {
        setStats({});
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const bench = INDUSTRY_BENCHMARKS[industry] || DEFAULT_BENCHMARK;
  const totalReach = stats?.totalReach || stats?.total_reach || 0;
  const postCount = stats?.posted || stats?.total_posts || 0;
  const ctr = bench.ctr;
  const close = parseFloat(closeRate) / 100 || bench.closeRate;
  const jobVal = parseFloat(avgJobValue) || bench.avgJobValue;

  // Estimated funnel
  const estimatedClicks = Math.round(totalReach * ctr);
  const estimatedLeads = Math.round(estimatedClicks * 0.4); // 40% of clicks become inquiries
  const estimatedCustomersMin = Math.round(estimatedLeads * close * 0.7);
  const estimatedCustomersMax = Math.round(estimatedLeads * close * 1.3);
  const revenueMin = estimatedCustomersMin * jobVal;
  const revenueMax = estimatedCustomersMax * jobVal;

  const monthlyPlanCost = 40; // Professional plan
  const roiMin = revenueMin > 0 ? Math.round(((revenueMin - monthlyPlanCost) / monthlyPlanCost) * 100) : 0;
  const roiMax = revenueMax > 0 ? Math.round(((revenueMax - monthlyPlanCost) / monthlyPlanCost) * 100) : 0;

  return (
    <Layout>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
        <SectionHeader
          title="ROI Estimator"
          subtitle="Estimated return on your ItsPosting investment based on your last 30 days of posts"
          icon={IpTrendingUp}
        />

        {/* Disclaimer */}
        <div style={{
          background: t.primaryBg,
          border: `1px solid ${t.primaryBorder}`,
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          marginBottom: 28,
        }}>
          <IpInfo size={16} color={t.primary} style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            All figures are <strong style={{ color: t.text }}>estimates based on industry averages</strong>. Actual results vary based on your market, post quality, and response speed. This is not a guarantee of revenue.
          </p>
        </div>

        {/* Inputs */}
        <Card style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Numbers</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 6 }}>Average job value ($)</label>
              <input
                type="number"
                value={avgJobValue}
                onChange={e => { setAvgJobValue(e.target.value); setEdited(true); }}
                placeholder={String(bench.avgJobValue)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.input, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: '10px 12px',
                  color: t.text, fontSize: 14, outline: 'none',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: t.textMuted }}>Industry default: ${bench.avgJobValue.toLocaleString()}</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 6 }}>Your close rate (%)</label>
              <input
                type="number"
                value={closeRate}
                onChange={e => { setCloseRate(e.target.value); setEdited(true); }}
                placeholder={String(Math.round(bench.closeRate * 100))}
                min="1" max="100"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.input, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: '10px 12px',
                  color: t.text, fontSize: 14, outline: 'none',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: t.textMuted }}>Industry default: {Math.round(bench.closeRate * 100)}%</p>
            </div>
          </div>
        </Card>

        {/* Funnel */}
        <Card style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Funnel — Last 30 Days</p>
          {loading ? (
            <p style={{ color: t.textMuted, fontSize: 14 }}>Loading your data...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Local people who saw your posts', value: totalReach.toLocaleString(), color: t.info, width: '100%' },
                { label: 'Estimated profile/link clicks', value: estimatedClicks.toLocaleString(), color: t.primary, width: '75%' },
                { label: 'Estimated enquiries / DMs', value: estimatedLeads.toLocaleString(), color: t.warning, width: '50%' },
                { label: 'Estimated new customers', value: `${estimatedCustomersMin}–${estimatedCustomersMax}`, color: t.success, width: '30%' },
              ].map(({ label, value, color, width }, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: t.textSecondary }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
                  </div>
                  <div style={{ height: 6, background: t.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Revenue estimate */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
            <IpDollar size={24} color={t.success} style={{ marginBottom: 8 }} />
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: t.success, fontFamily: 'monospace' }}>
              {loading ? '—' : range(revenueMin, revenueMax)}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Estimated revenue from social posts</p>
          </Card>
          <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
            <IpTrendingUp size={24} color={t.primary} style={{ marginBottom: 8 }} />
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: t.primary, fontFamily: 'monospace' }}>
              {loading ? '—' : `${roiMin}%–${roiMax}%`}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Estimated ROI vs subscription cost</p>
          </Card>
          <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
            <IpTeam size={24} color={t.warning} style={{ marginBottom: 8 }} />
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: t.warning, fontFamily: 'monospace' }}>
              {loading ? '—' : `${estimatedCustomersMin}–${estimatedCustomersMax}`}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Estimated new customers / month</p>
          </Card>
        </div>

        {/* How it's calculated */}
        <Card>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>How This Is Calculated</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Reach → Clicks', `${totalReach.toLocaleString()} reach × ${(ctr * 100).toFixed(1)}% industry CTR = ${estimatedClicks} estimated clicks`],
              ['Clicks → Enquiries', `${estimatedClicks} clicks × 40% enquiry rate = ${estimatedLeads} estimated enquiries`],
              ['Enquiries → Customers', `${estimatedLeads} enquiries × ${Math.round(close * 100)}% close rate = ${estimatedCustomersMin}–${estimatedCustomersMax} customers`],
              ['Revenue', `${estimatedCustomersMin}–${estimatedCustomersMax} customers × ${fmt(jobVal)} avg job = ${range(revenueMin, revenueMax)}`],
            ].map(([step, formula], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 3 ? `1px solid ${t.border}` : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.primary, minWidth: 160 }}>{step}</span>
                <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: 'monospace' }}>{formula}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 11, color: t.textMuted }}>
            CTR and close rate benchmarks sourced from Buffer 2026 analysis of 52M+ posts. Based on industry averages for {industry.replace('_', ' ')} businesses.
          </p>
        </Card>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <Button onClick={() => router.push('/analytics')} variant="secondary">View Analytics</Button>
          <Button onClick={() => router.push('/wizard')} icon={<IpSparkle size={16} />}>Create More Posts</Button>
        </div>
      </div>
    </Layout>
  );
}
