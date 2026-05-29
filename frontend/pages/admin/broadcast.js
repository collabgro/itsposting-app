import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { IpMail, IpTeam, IpArrowLeft, IpCheckCircle, IpWarning } from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader, Spinner } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const SEGMENTS = [
  { key: 'all',          label: 'All Users',      desc: 'Every non-suspended customer' },
  { key: 'trial',        label: 'Trial Only',     desc: 'Free trial accounts' },
  { key: 'starter',      label: 'Starter+',       desc: 'Active Starter plan customers' },
  { key: 'professional', label: 'Professional+',  desc: 'Active Professional plan customers' },
  { key: 'premium',      label: 'Premium',        desc: 'Active Premium plan customers' },
  { key: 'inactive',     label: 'Inactive 14d',   desc: 'No login in the last 14 days' },
];

const SEGMENT_VARIANT = {
  all: 'primary', trial: 'warning', starter: 'info',
  professional: 'success', premium: 'primary', inactive: 'error',
};

const MAX_MESSAGE = 500;

export default function BroadcastPage() {
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
  const [mounted, setMounted] = useState(false);

  // Compose form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('all');
  const [deliveryNotif, setDeliveryNotif] = useState(true);
  const [deliveryEmail, setDeliveryEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { sentTo: N } or null
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await adminAPI.getBroadcasts();
      setHistory(res.data.broadcasts || []);
    } catch { /* swallow */ } finally {
      setHistoryLoading(false);
    }
  }

  function validateForm() {
    if (!title.trim()) return 'Title is required';
    if (!message.trim()) return 'Message is required';
    if (!deliveryNotif && !deliveryEmail) return 'Select at least one delivery method';
    return '';
  }

  function handleSendClick() {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setFormError('');
    setConfirmOpen(true);
  }

  async function handleConfirmSend() {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const delivery = deliveryNotif && deliveryEmail ? 'both'
        : deliveryNotif ? 'notification'
        : 'email';
      const res = await adminAPI.broadcast({ title: title.trim(), message: message.trim(), target_segment: segment, delivery_method: delivery });
      setResult({ sentTo: res.data.sentTo });
      setTitle('');
      setMessage('');
      setSegment('all');
      setDeliveryNotif(true);
      setDeliveryEmail(false);
      loadHistory();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  const segObj = SEGMENTS.find(s => s.key === segment) || SEGMENTS[0];

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 14px', background: t.input, border: `1px solid ${t.border}`,
    borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
    transition: 'border-color 150ms',
  };

  return (
    <Layout
      title="Broadcast"
      subtitle="Send announcements to customers"
      action={
        <Button variant="ghost" onClick={() => router.push('/admin')}>
          <IpArrowLeft size={13} /> Admin
        </Button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: COMPOSE ── */}
        <div style={gc}>
          <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Compose Broadcast
          </p>

          {result && (
            <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IpCheckCircle size={16} color={t.success} />
              <span style={{ fontSize: 13, color: t.success, fontWeight: 600 }}>
                Broadcast sent to {result.sentTo} customer{result.sentTo !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {formError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <IpWarning size={14} color={t.error} />
              <span style={{ fontSize: 13, color: t.error }}>{formError}</span>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 6 }}>
              Title
            </label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platform maintenance on Saturday"
              style={inputStyle}
              maxLength={255}
            />
          </div>

          {/* Message */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 6 }}>
              Message <span style={{ color: t.textMuted, fontSize: 11 }}>({message.length}/{MAX_MESSAGE})</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              placeholder="Write your announcement here..."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>

          {/* Target segment */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 10 }}>
              Target Segment
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSegment(s.key)}
                  style={{
                    padding: '10px 8px',
                    background: segment === s.key ? t.primaryBg : t.card,
                    border: `1px solid ${segment === s.key ? t.primaryBorder : t.border}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: segment === s.key ? t.primary : t.text, marginBottom: 2 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.3 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: t.textSecondary, marginBottom: 10 }}>
              Delivery Method
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { key: 'notif', label: 'In-app notification', val: deliveryNotif, set: setDeliveryNotif },
                { key: 'email', label: 'Email', val: deliveryEmail, set: setDeliveryEmail },
              ].map(({ key, label, val, set }) => (
                <button
                  key={key}
                  onClick={() => set(!val)}
                  style={{
                    flex: 1, padding: '10px 14px',
                    background: val ? t.primaryBg : t.card,
                    border: `1px solid ${val ? t.primaryBorder : t.border}`,
                    borderRadius: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${val ? t.primary : t.textMuted}`, background: val ? t.primary : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {val && <IpCheckCircle size={10} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: val ? t.primary : t.text }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview card */}
          {title.trim() && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</p>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{title}</div>
              {message && <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message}</div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <Badge variant={SEGMENT_VARIANT[segment] || 'default'}>{segObj.label}</Badge>
                {deliveryNotif && <Badge variant="info">In-app</Badge>}
                {deliveryEmail && <Badge variant="info">Email</Badge>}
              </div>
            </div>
          )}

          <Button
            onClick={handleSendClick}
            disabled={sending}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <IpMail size={14} style={{ marginRight: 6 }} />
            {sending ? 'Sending…' : `Send to "${segObj.label}"`}
          </Button>
        </div>

        {/* ── RIGHT: HISTORY ── */}
        <div>
          <div style={gc}>
            <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Broadcast History
            </p>

            {historyLoading ? (
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                <Spinner size={24} />
              </div>
            ) : history.length === 0 ? (
              <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '24px 0' }}>
                No broadcasts sent yet
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history.map((b) => (
                  <div key={b.id} style={{ padding: '12px 14px', background: t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{b.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <Badge variant={SEGMENT_VARIANT[b.target_segment] || 'default'} style={{ fontSize: 10 }}>
                        {b.target_segment}
                      </Badge>
                      <Badge variant="info" style={{ fontSize: 10 }}>{b.delivery_method}</Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: t.textMuted }}>
                        <IpTeam size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {b.sent_to_count} recipient{b.sent_to_count !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: t.text }}>Confirm Broadcast</h3>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
              You are about to send <strong style={{ color: t.text }}>"{title}"</strong> to the <strong style={{ color: t.text }}>{segObj.label}</strong> segment.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: t.textMuted }}>
              Delivery: {deliveryNotif && 'In-app notification'}{deliveryNotif && deliveryEmail && ' + '}{deliveryEmail && 'Email'}
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: t.warning, fontWeight: 600 }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={handleConfirmSend} style={{ flex: 1, justifyContent: 'center' }}>
                Send Now
              </Button>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

