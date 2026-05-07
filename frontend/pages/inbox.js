import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { dmsAPI } from '../lib/api';
import {
  IpInbox, IpFacebook, IpInstagram, IpRefresh, IpSend, IpSparkle,
  IpClose, IpWarning,
} from '../components/icons';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function PlatformBadge({ platform, t }) {
  const isIG = platform === 'instagram';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: isIG ? 'rgba(225,48,108,0.12)' : 'rgba(24,119,242,0.12)',
      color: isIG ? '#E1306C' : '#1877F2',
    }}>
      {isIG ? <IpInstagram size={10} /> : <IpFacebook size={10} />}
      {isIG ? 'Instagram' : 'Facebook'}
    </span>
  );
}

function WindowStatus({ conv, t }) {
  const status = conv.messaging_window_status;
  if (status === 'open') return null;
  if (status === 'human_agent') {
    const secs = Math.max(0, Math.floor(conv.window_seconds_remaining || 0));
    const hours = Math.floor(secs / 3600);
    return (
      <span style={{ fontSize: 10, color: t.warning, display: 'flex', alignItems: 'center', gap: 3 }}>
        <IpWarning size={10} /> Human agent ({hours}h left)
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, color: t.error, display: 'flex', alignItems: 'center', gap: 3 }}>
      <IpClose size={10} /> Window closed
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { t } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({ unreadCount: 0, openCount: 0, facebookCount: 0, instagramCount: 0 });
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [showAutoReplies, setShowAutoReplies] = useState(false);
  const [autoReplies, setAutoReplies] = useState([]);
  const [showMobileThread, setShowMobileThread] = useState(false);

  const threadEndRef = useRef(null);

  useEffect(() => { loadStats(); loadConversations(); }, []);
  useEffect(() => { loadConversations(); }, [filter]);

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function loadStats() {
    try {
      const res = await dmsAPI.getStats();
      setStats(res.data);
    } catch (_) {}
  }

  async function loadConversations() {
    setLoading(true);
    try {
      const params = { limit: 30 };
      if (filter === 'facebook') params.platform = 'facebook';
      if (filter === 'instagram') params.platform = 'instagram';
      if (filter === 'unread') params.unread = 'true';
      if (filter === 'starred') params.starred = 'true';
      const res = await dmsAPI.list(params);
      setConversations(res.data.conversations || []);
    } catch (_) {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conv) {
    setSelected(conv);
    setMessages([]);
    setAiDraft(null);
    setSendError(null);
    setShowMobileThread(true);
    setMsgLoading(true);
    try {
      const res = await dmsAPI.getConversation(conv.id);
      setMessages(res.data.messages || []);
      setSelected(res.data.conversation);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, is_read: true } : c));
    } catch (_) {} finally {
      setMsgLoading(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await dmsAPI.reply(selected.id, reply.trim());
      const newMsg = {
        id: Date.now(),
        direction: 'outgoing',
        message_text: reply.trim(),
        sent_at: new Date().toISOString(),
        reply_type: 'manual',
      };
      setMessages(prev => [...prev, newMsg]);
      setConversations(prev => prev.map(c =>
        c.id === selected.id
          ? { ...c, last_message_preview: reply.trim().substring(0, 100), last_message_direction: 'outgoing', last_message_at: new Date().toISOString() }
          : c
      ));
      setReply('');
      setAiDraft(null);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to send message';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  async function generateAiDraft() {
    if (!selected || aiLoading) return;
    setAiLoading(true);
    setAiDraft(null);
    try {
      const res = await dmsAPI.aiReply(selected.id, 'friendly');
      setAiDraft(res.data.draft);
    } catch (_) {
      setAiDraft('Sorry, I could not generate a reply right now.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await dmsAPI.sync();
      setTimeout(() => { loadConversations(); loadStats(); }, 3000);
    } catch (_) {} finally {
      setTimeout(() => setSyncing(false), 3000);
    }
  }

  async function toggleStar(convId, e) {
    e.stopPropagation();
    try {
      const res = await dmsAPI.toggleStar(convId);
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, is_starred: res.data.isStarred } : c
      ));
    } catch (_) {}
  }

  async function markClosed(convId) {
    try {
      await dmsAPI.setStatus(convId, 'closed');
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, status: 'closed' } : c));
      if (selected?.id === convId) setSelected(prev => ({ ...prev, status: 'closed' }));
    } catch (_) {}
  }

  const FILTERS = [
    { key: 'all', label: 'All', count: stats.openCount },
    { key: 'unread', label: 'Unread', count: stats.unreadCount },
    { key: 'facebook', label: 'Facebook', count: stats.facebookCount },
    { key: 'instagram', label: 'Instagram', count: stats.instagramCount },
    { key: 'starred', label: 'Starred' },
  ];

  const canReply = selected && selected.messaging_window_status !== 'closed';
  const windowClosed = selected && selected.messaging_window_status === 'closed';

  return (
    <Layout title="Inbox" subtitle="Your Facebook & Instagram DMs in one place">
      <div style={{ display: 'flex', height: 'calc(100vh - 128px)', gap: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}` }}>

        {/* ── LEFT PANEL: Conversation List ── */}
        <div style={{
          width: showMobileThread ? 0 : '100%',
          minWidth: showMobileThread ? 0 : undefined,
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${t.border}`,
          background: t.sidebar,
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'max-width 200ms ease',
        }}
          className="inbox-list-panel"
        >
          {/* Header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IpInbox size={18} style={{ color: t.primary }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Inbox</span>
                {stats.unreadCount > 0 && (
                  <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {stats.unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sync new messages"
                style={{ padding: '6px 10px', borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <IpRefresh size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: filter === f.key ? 600 : 400,
                    background: filter === f.key ? t.primaryBg : 'transparent',
                    color: filter === f.key ? t.primary : t.textMuted,
                    border: filter === f.key ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}{f.count > 0 ? ` (${f.count})` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>Loading…</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <IpInbox size={40} style={{ color: t.textMuted, margin: '0 auto 12px', display: 'block' }} />
                <div style={{ color: t.textMuted, fontSize: 13 }}>No conversations yet</div>
                <div style={{ color: t.textMuted, fontSize: 11, marginTop: 4 }}>Hit Sync to check for new DMs</div>
              </div>
            ) : (
              conversations.map(conv => {
                const isActive = selected?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                      background: isActive ? t.primaryBg : conv.is_read ? 'transparent' : `${t.primaryBg}44`,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.cardHover; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = conv.is_read ? 'transparent' : `${t.primaryBg}44`; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                        {(conv.sender_name || '?').charAt(0).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: conv.is_read ? 500 : 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {conv.sender_name || 'Unknown'}
                          </span>
                          <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>
                            {timeAgo(conv.last_message_at)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <PlatformBadge platform={conv.platform} t={t} />
                          {conv.urgency === 'urgent' && (
                            <span style={{ fontSize: 10, color: t.error, fontWeight: 600 }}>URGENT</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {conv.last_message_direction === 'outgoing' ? 'You: ' : ''}
                            {conv.last_message_preview || 'No messages yet'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 6 }}>
                            {!conv.is_read && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary }} />
                            )}
                            <button
                              onClick={e => toggleStar(conv.id, e)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: conv.is_starred ? '#F59E0B' : t.textMuted, fontSize: 14 }}
                              title={conv.is_starred ? 'Unstar' : 'Star'}
                            >
                              ★
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Thread ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, minWidth: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <IpInbox size={52} style={{ color: t.textMuted }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Select a conversation</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>Choose a DM from the list to view and reply</div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => { setShowMobileThread(false); setSelected(null); }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20, padding: '0 4px', display: 'none' }}
                    className="mobile-back-btn"
                  >
                    ←
                  </button>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                    {(selected.sender_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{selected.sender_name || 'Unknown'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PlatformBadge platform={selected.platform} t={t} />
                      <WindowStatus conv={selected} t={t} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status === 'open' && (
                    <button
                      onClick={() => markClosed(selected.id)}
                      style={{ padding: '6px 12px', borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  )}
                  {selected.status === 'closed' && (
                    <span style={{ padding: '6px 10px', borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12 }}>
                      Closed
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
                {msgLoading ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: 24 }}>Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: 24 }}>No messages yet</div>
                ) : (
                  messages.map((msg, i) => {
                    const isOut = msg.direction === 'outgoing';
                    return (
                      <div key={msg.id || i} style={{ display: 'flex', flexDirection: isOut ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
                        {!isOut && (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0 }}>
                            {(selected.sender_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ maxWidth: '68%' }}>
                          <div style={{
                            padding: '10px 14px', borderRadius: isOut ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isOut ? t.primary : t.card,
                            color: isOut ? '#fff' : t.text,
                            fontSize: 13, lineHeight: 1.5,
                            border: isOut ? 'none' : `1px solid ${t.border}`,
                          }}>
                            {msg.message_text}
                          </div>
                          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, textAlign: isOut ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 4, justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                            {isOut && msg.reply_type === 'auto_reply' && <span style={{ background: t.primaryBg, color: t.primary, padding: '1px 4px', borderRadius: 3 }}>Auto</span>}
                            {isOut && msg.reply_type === 'ai_draft' && <span style={{ background: t.primaryBg, color: t.primary, padding: '1px 4px', borderRadius: 3 }}>PostCore</span>}
                            {timeAgo(msg.sent_at || msg.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Reply box */}
              <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
                {sendError && (
                  <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: t.error, fontSize: 12 }}>
                    {sendError}
                  </div>
                )}

                {/* AI draft suggestion */}
                {aiDraft && (
                  <div style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: t.primaryBg, border: `1px solid ${t.primaryBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.primary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IpSparkle size={12} /> PostCore suggestion
                      </span>
                      <button onClick={() => setAiDraft(null)} style={{ border: 'none', background: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14 }}>×</button>
                    </div>
                    <p style={{ fontSize: 12, color: t.text, margin: 0, lineHeight: 1.5 }}>{aiDraft}</p>
                    <button
                      onClick={() => { setReply(aiDraft); setAiDraft(null); }}
                      style={{ marginTop: 8, padding: '4px 12px', borderRadius: 5, background: t.primary, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Use this reply
                    </button>
                  </div>
                )}

                {windowClosed ? (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12, textAlign: 'center' }}>
                    The 7-day messaging window has closed. The customer needs to message you first before you can reply.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 8,
                        background: t.input, border: `1px solid ${t.border}`,
                        color: t.text, fontSize: 13, resize: 'none', outline: 'none',
                        fontFamily: 'inherit', lineHeight: 1.5,
                      }}
                      onFocus={e => e.target.style.borderColor = t.primary}
                      onBlur={e => e.target.style.borderColor = t.border}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        onClick={generateAiDraft}
                        disabled={aiLoading}
                        title="Generate PostCore AI reply"
                        style={{ padding: '8px 10px', borderRadius: 8, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <IpSparkle size={14} />
                        {aiLoading ? '…' : 'AI Reply'}
                      </button>
                      <button
                        onClick={sendReply}
                        disabled={!reply.trim() || sending}
                        style={{ padding: '8px 14px', borderRadius: 8, background: reply.trim() ? t.primary : t.card, color: reply.trim() ? '#fff' : t.textMuted, border: `1px solid ${reply.trim() ? t.primary : t.border}`, cursor: reply.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}
                      >
                        <IpSend size={14} />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 700px) {
          .inbox-list-panel { max-width: 100% !important; }
          .mobile-back-btn { display: block !important; }
        }
      `}</style>
    </Layout>
  );
}
