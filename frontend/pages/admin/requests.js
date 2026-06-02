import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpCheckCircle, IpClose, IpWarning, IpComment, IpMail,
  IpAdmin, IpChevronRight, IpRefresh,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader, EmptyState, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const TYPE_META = {
  credit_purchase: { label: 'Credit Purchase', color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)' },
  agency_plan:     { label: 'Agency Plan',     color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
};

const STATUS_META = {
  pending:     { label: 'Pending',     color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
  in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  resolved:    { label: 'Resolved',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  rejected:    { label: 'Rejected',    color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000) || 1}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function RequestCard({ req, t, gc, onRefresh, onMsg }) {
  const [expanded, setExpanded]         = useState(false);
  const [action, setAction]             = useState(null); // 'email'|'notify'|'reject'|null
  const [actionMsg, setActionMsg]       = useState('');
  const [rejectNote, setRejectNote]     = useState('');
  const [loading, setLoading]           = useState(false);
  const [toast, setToast]               = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const tm = TYPE_META[req.type] || TYPE_META.credit_purchase;
  const sm = STATUS_META[req.status] || STATUS_META.pending;

  const isCredit = req.type === 'credit_purchase';
  const requestDetail = isCredit
    ? `${req.request_data?.credits} credits — $${req.request_data?.price}`
    : `${req.request_data?.clients || '?'} clients`;

  const handleApprove = async () => {
    if (!confirm(`Approve this ${isCredit ? 'credit purchase' : 'agency plan upgrade'} for ${req.business_name}?`)) return;
    setLoading(true);
    try {
      await adminAPI.approveServiceRequest(req.id);
      showToast('Approved! Customer notified.');
      onRefresh();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to approve');
    } finally { setLoading(false); }
  };

  const handleContact = async (channel) => {
    const msg = channel === 'email' ? emailBody.trim() : actionMsg.trim();
    if (!msg) { showToast('Please enter a message'); return; }
    setLoading(true);
    try {
      await adminAPI.contactServiceRequest(req.id, channel, msg);
      showToast(`${channel === 'email' ? 'Email' : 'Notification'} sent!`);
      setAction(null); setActionMsg(''); setEmailBody('');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send');
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { showToast('Please enter a reason'); return; }
    setLoading(true);
    try {
      await adminAPI.updateServiceRequest(req.id, { status: 'rejected', admin_notes: rejectNote.trim() });
      showToast('Request rejected. Customer notified.');
      onRefresh();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reject');
    } finally { setLoading(false); }
  };

  const handleMarkInProgress = async () => {
    try {
      await adminAPI.updateServiceRequest(req.id, { status: 'in_progress' });
      showToast('Marked in progress');
      onRefresh();
    } catch { showToast('Failed to update'); }
  };

  const isResolved = req.status === 'resolved' || req.status === 'rejected';

  return (
    <div style={{ ...gc, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: sm.color, flexShrink: 0, boxShadow: req.status === 'pending' ? `0 0 8px ${sm.color}` : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{req.business_name}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{req.email}</span>
            <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: tm.bg, color: tm.color }}>{tm.label}</span>
            <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>{sm.label}</span>
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>{requestDetail}</div>
          {req.request_data?.message && (
            <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic', marginTop: 4 }}>"{req.request_data.message}"</div>
          )}
          {req.request_data?.useCase && (
            <div style={{ fontSize: 12, color: t.textMuted, fontStyle: 'italic', marginTop: 4 }}>"{req.request_data.useCase}"</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>{timeAgo(req.created_at)}</span>
          {!isResolved && (
            <>
              <button
                onClick={handleApprove}
                disabled={loading}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Approve
              </button>
              <button
                onClick={() => { setAction(action === 'email' ? null : 'email'); setEmailSubject(`Re: your ${tm.label} request`); setEmailBody(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.border}`, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <IpMail size={13} /> Email
              </button>
              <button
                onClick={() => { setAction(action === 'notify' ? null : 'notify'); setActionMsg(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.border}`, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <IpComment size={13} /> Notify
              </button>
              <button
                onClick={() => { setAction(action === 'reject' ? null : 'reject'); setRejectNote(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Reject
              </button>
              {req.status === 'pending' && (
                <button
                  onClick={handleMarkInProgress}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark In Progress
                </button>
              )}
            </>
          )}
          <button
            onClick={() => window.open(`/admin/customers/${req.customer_id}`, '_blank')}
            style={{ padding: '6px 12px', borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.border}`, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <IpAdmin size={13} /> Profile
          </button>
        </div>
      </div>

      {/* Inline action panels */}
      {action === 'email' && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${t.border}`, background: t.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send email to {req.email}</div>
          <textarea
            rows={4}
            placeholder="Type your message to the customer..."
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleContact('email')} disabled={loading} style={{ padding: '8px 16px', background: '#7C5CFC', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Sending…' : 'Send Email'}
            </button>
            <button onClick={() => setAction(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {action === 'notify' && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${t.border}`, background: t.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send in-app notification</div>
          <input
            type="text"
            maxLength={200}
            placeholder="Short notification message..."
            value={actionMsg}
            onChange={e => setActionMsg(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleContact('notification')} disabled={loading} style={{ padding: '8px 16px', background: '#7C5CFC', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Sending…' : 'Send Notification'}
            </button>
            <button onClick={() => setAction(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {action === 'reject' && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${t.border}`, background: t.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for rejection (sent to customer)</div>
          <textarea
            rows={2}
            placeholder="e.g. We couldn't process this at this time. Please contact support."
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: t.input, border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: t.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReject} disabled={loading} style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Rejecting…' : 'Reject & Notify Customer'}
            </button>
            <button onClick={() => setAction(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Admin notes (resolved/rejected) */}
      {req.admin_notes && (
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textMuted }}>
          <strong>Admin note:</strong> {req.admin_notes}
          {req.resolved_by && <span style={{ marginLeft: 8, opacity: 0.6 }}>— {req.resolved_by}</span>}
        </div>
      )}

      {toast && (
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: toast.includes('!') ? '#22c55e' : '#ef4444', background: toast.includes('!') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function AdminRequests() {
  const router = useRouter();
  const { t } = useTheme();
  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  const [mounted, setMounted]       = useState(false);
  const [requests, setRequests]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => { setMounted(true); if (!localStorage.getItem('token')) router.replace('/login'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getServiceRequests({
        ...(filterType   ? { type: filterType }     : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(search       ? { search }               : {}),
        limit: 50,
      });
      setRequests(res.data.requests || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, search]);

  useEffect(() => { if (mounted) load(); }, [mounted, filterType, filterStatus, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  if (!mounted) return null;

  const btnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? '#7C5CFC' : t.border}`,
    background: active ? 'rgba(124,92,252,0.12)' : 'transparent',
    color: active ? '#7C5CFC' : t.textMuted,
    transition: 'all 120ms',
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <Layout
      title="Service Requests"
      subtitle="Credit purchases and agency plan applications"
      action={
        <Button variant="secondary" onClick={load}>
          <IpRefresh size={14} /> Refresh
        </Button>
      }
    >
      {/* Filters */}
      <div style={{ ...gc, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btnStyle(!filterType)} onClick={() => setFilterType('')}>All types</button>
            <button style={btnStyle(filterType === 'credit_purchase')} onClick={() => setFilterType(filterType === 'credit_purchase' ? '' : 'credit_purchase')}>Credits</button>
            <button style={btnStyle(filterType === 'agency_plan')} onClick={() => setFilterType(filterType === 'agency_plan' ? '' : 'agency_plan')}>Agency</button>
          </div>
          <div style={{ width: 1, height: 24, background: t.border }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btnStyle(!filterStatus)} onClick={() => setFilterStatus('')}>All statuses</button>
            <button style={btnStyle(filterStatus === 'pending')} onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}>Pending</button>
            <button style={btnStyle(filterStatus === 'in_progress')} onClick={() => setFilterStatus(filterStatus === 'in_progress' ? '' : 'in_progress')}>In Progress</button>
            <button style={btnStyle(filterStatus === 'resolved')} onClick={() => setFilterStatus(filterStatus === 'resolved' ? '' : 'resolved')}>Resolved</button>
            <button style={btnStyle(filterStatus === 'rejected')} onClick={() => setFilterStatus(filterStatus === 'rejected' ? '' : 'rejected')}>Rejected</button>
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ padding: '6px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', width: 200 }}
            />
            <button type="submit" style={{ padding: '6px 14px', background: '#7C5CFC', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
            {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Clear</button>}
          </form>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 12 }}>
          {total} request{total !== 1 ? 's' : ''} found
          {pendingCount > 0 && <span style={{ marginLeft: 12, color: '#FB923C', fontWeight: 700 }}>● {pendingCount} pending</span>}
        </div>
      </div>

      {/* Request list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size={36} />
        </div>
      ) : requests.length === 0 ? (
        <div style={{ ...gc, padding: 24 }}>
          <EmptyState
            icon={IpComment}
            title="No requests"
            subtitle="Customer credit purchase and agency plan applications will appear here."
          />
        </div>
      ) : (
        requests.map(req => (
          <RequestCard
            key={req.id}
            req={req}
            t={t}
            gc={{ ...gc, padding: 0 }}
            onRefresh={load}
          />
        ))
      )}
    </Layout>
  );
}
