import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpTrendingUp, IpCheckCircle, IpCloseCircle, IpRefresh, IpTeam,
  IpDollar, IpWarning, IpSchedule,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const STATUS_META = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  released: { label: 'Released', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
    }}>{m.label}</span>
  );
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminReferrals() {
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

  const [mounted, setMounted]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [awards, setAwards]         = useState([]);
  const [summary, setSummary]       = useState({});
  const [total, setTotal]           = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast]           = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    load();
  }, [filterStatus]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await adminAPI.listReferrals(params);
      setAwards(res.data.awards || []);
      setSummary(res.data.summary || {});
      setTotal(res.data.total || 0);
    } catch {
      showToast('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleRelease = async (award) => {
    setActionLoading(`release-${award.id}`);
    try {
      await adminAPI.releaseReferral(award.id);
      showToast(`Released ${award.credits} credits to ${award.referrer_name}`);
      load();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to release');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    setActionLoading(`reject-${rejectModal.id}`);
    try {
      await adminAPI.rejectReferral(rejectModal.id, rejectReason.trim() || undefined);
      showToast('Award rejected');
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  if (!mounted) return null;

  const TABS = [
    { id: '',         label: 'All',      count: total },
    { id: 'pending',  label: 'Pending',  count: summary.pending?.count  || 0 },
    { id: 'released', label: 'Released', count: summary.released?.count || 0 },
    { id: 'rejected', label: 'Rejected', count: summary.rejected?.count || 0 },
  ];

  return (
    <Layout title="Referral Management">
      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, margin: 0 }}>Referral Management</h1>
            <p style={{ fontSize: 14, color: t.textMuted, margin: '4px 0 0' }}>
              Review and release pending referral credit awards
            </p>
          </div>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: t.text, cursor: 'pointer' }}
          >
            <IpRefresh size={14} /> Refresh
          </button>
        </div>

        {/* Summary stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            {
              icon: IpSchedule, label: 'Pending Awards', color: '#f59e0b',
              value: summary.pending?.count || 0,
              sub: `${summary.pending?.credits || 0} credits awaiting release`,
            },
            {
              icon: IpCheckCircle, label: 'Released', color: '#10b981',
              value: summary.released?.count || 0,
              sub: `${summary.released?.credits || 0} credits paid out`,
            },
            {
              icon: IpCloseCircle, label: 'Rejected', color: '#ef4444',
              value: summary.rejected?.count || 0,
              sub: `${summary.rejected?.credits || 0} credits saved`,
            },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} style={{ ...gc, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginTop: 2 }}>{card.label}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{card.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: t.input, padding: 4, borderRadius: 10, width: 'fit-content', marginBottom: 20 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterStatus === tab.id ? t.card : 'transparent',
                color: filterStatus === tab.id ? t.text : t.textMuted,
                transition: 'all 150ms',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: filterStatus === tab.id ? t.primaryBg : 'rgba(255,255,255,0.07)', color: filterStatus === tab.id ? t.primary : t.textMuted }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={gc}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          ) : awards.length === 0 ? (
            <EmptyState icon={IpTrendingUp} title="No referral awards" subtitle="Pending awards will appear here when referred users upgrade to a paid plan." />
          ) : (
            <div>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 120px 160px', gap: 12, padding: '0 12px 10px', borderBottom: `1px solid ${t.border}`, fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Referrer</span>
                <span>Referred (paid customer)</span>
                <span>Credits</span>
                <span>Status</span>
                <span>Date</span>
                <span>Actions</span>
              </div>

              {awards.map(award => {
                const isReleasing = actionLoading === `release-${award.id}`;
                const isRejecting = actionLoading === `reject-${award.id}`;
                return (
                  <div
                    key={award.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 120px 160px',
                      gap: 12, padding: '14px 12px', borderBottom: `1px solid ${t.border}`,
                      alignItems: 'center', transition: 'background 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Referrer */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{award.referrer_name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{award.referrer_email}</div>
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                        Plan: <span style={{ color: t.text, fontWeight: 600 }}>{award.referrer_plan || 'trial'}</span>
                      </div>
                    </div>

                    {/* Referred */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{award.referred_name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{award.referred_email}</div>
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                        Plan: <span style={{ color: '#10b981', fontWeight: 700 }}>{award.referred_plan || '—'}</span>
                        {' · '} Joined {fmt(award.referred_joined_at)}
                      </div>
                    </div>

                    {/* Credits */}
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.primary }}>{award.credits}</div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={award.status} />
                      {award.rejection_reason && (
                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }} title={award.rejection_reason}>
                          {award.rejection_reason.substring(0, 40)}{award.rejection_reason.length > 40 ? '…' : ''}
                        </div>
                      )}
                      {award.released_at && (
                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                          by {award.released_by_email || 'admin'}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 12, color: t.textMuted }}>{fmt(award.created_at)}</div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {award.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleRelease(award)}
                            disabled={!!actionLoading}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                              borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#10b981', cursor: 'pointer',
                              opacity: isReleasing ? 0.6 : 1, transition: 'all 150ms',
                            }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
                          >
                            {isReleasing ? <Spinner size={12} /> : <IpCheckCircle size={13} />}
                            Release
                          </button>
                          <button
                            onClick={() => { setRejectModal(award); setRejectReason(''); }}
                            disabled={!!actionLoading}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#ef4444', cursor: 'pointer',
                              opacity: isRejecting ? 0.6 : 1, transition: 'all 150ms',
                            }}
                            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}
                          >
                            <IpCloseCircle size={13} /> Reject
                          </button>
                        </>
                      )}
                      {award.status !== 'pending' && (
                        <span style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic' }}>
                          {award.status === 'released' ? `Released ${fmt(award.released_at)}` : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reject confirmation modal */}
        {rejectModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) { setRejectModal(null); setRejectReason(''); } }}
          >
            <div style={{ ...gc, maxWidth: 420, width: '100%', padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <IpWarning size={20} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Reject Award</span>
              </div>
              <p style={{ fontSize: 13, color: t.textMuted, margin: '0 0 16px' }}>
                Reject the 20-credit award for <strong style={{ color: t.text }}>{rejectModal.referrer_name}</strong>?
                The referrer will not receive credits. This cannot be undone.
              </p>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>
                Reason (optional)
              </label>
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Fraudulent referral, self-referral detected..."
                maxLength={200}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={!!actionLoading}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Award'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 22px', fontSize: 13, fontWeight: 600, color: t.text, boxShadow: t.shadow, zIndex: 2000, whiteSpace: 'nowrap' }}>
            {toast}
          </div>
        )}
      </div>
    </Layout>
  );
}
