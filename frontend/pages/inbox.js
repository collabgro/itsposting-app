import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { dmsAPI } from '../lib/api';
import {
  IpInbox, IpFacebook, IpInstagram, IpRefresh, IpSend, IpSparkle,
  IpClose, IpWarning, IpPlus, IpDelete, IpEdit, IpCheck, IpSave, IpZap,
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
  const [arLoading, setArLoading] = useState(false);
  const [arSaving, setArSaving] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const BLANK_RULE = { trigger_type: 'first_message', keywords: '', reply_text: '', delay_seconds: 0, send_only_once: true, is_active: true };
  const [newRule, setNewRule] = useState(BLANK_RULE);

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

  async function openAutoReplies() {
    setShowAutoReplies(true);
    setArLoading(true);
    try {
      const res = await dmsAPI.getAutoReplies();
      setAutoReplies(res.data.rules || []);
    } catch (_) { setAutoReplies([]); } finally { setArLoading(false); }
  }

  async function saveRule() {
    if (!newRule.reply_text.trim()) return;
    setArSaving(true);
    try {
      const payload = {
        ...newRule,
        keywords: newRule.trigger_type === 'keyword'
          ? newRule.keywords.split(',').map(k => k.trim()).filter(Boolean)
          : [],
        delay_seconds: Number(newRule.delay_seconds) || 0,
      };
      if (editingRule) {
        await dmsAPI.updateAutoReply(editingRule.id, payload);
      } else {
        await dmsAPI.createAutoReply(payload);
      }
      const res = await dmsAPI.getAutoReplies();
      setAutoReplies(res.data.rules || []);
      setShowAddRule(false);
      setEditingRule(null);
      setNewRule(BLANK_RULE);
    } catch (_) {} finally { setArSaving(false); }
  }

  async function deleteRule(id) {
    try {
      await dmsAPI.deleteAutoReply(id);
      setAutoReplies(prev => prev.filter(r => r.id !== id));
    } catch (_) {}
  }

  async function toggleRuleActive(rule) {
    try {
      await dmsAPI.updateAutoReply(rule.id, { ...rule, is_active: !rule.is_active });
      setAutoReplies(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (_) {}
  }

  function startEdit(rule) {
    setEditingRule(rule);
    setNewRule({
      trigger_type: rule.trigger_type,
      keywords: (rule.keywords || []).join(', '),
      reply_text: rule.reply_text,
      delay_seconds: rule.delay_seconds || 0,
      send_only_once: rule.send_only_once ?? true,
      is_active: rule.is_active ?? true,
    });
    setShowAddRule(true);
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={openAutoReplies}
                  title="Manage auto-reply rules"
                  style={{ padding: '6px 10px', borderRadius: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
                >
                  <IpZap size={13} /> Auto-Replies
                </button>
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

      {/* ── Auto-Reply Rules Panel ── */}
      {showAutoReplies && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <div onClick={() => { setShowAutoReplies(false); setShowAddRule(false); setEditingRule(null); setNewRule(BLANK_RULE); }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

          {/* Drawer */}
          <div style={{ position: 'relative', width: 480, maxWidth: '100vw', background: t.bg, borderLeft: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IpZap size={18} style={{ color: t.primary }} /> Auto-Reply Rules
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>Automatically respond to DMs when certain conditions are met</div>
              </div>
              <button onClick={() => { setShowAutoReplies(false); setShowAddRule(false); setEditingRule(null); setNewRule(BLANK_RULE); }} style={{ width: 32, height: 32, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IpClose size={14} />
              </button>
            </div>

            {/* Rules list */}
            <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
              {arLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, color: t.textMuted, fontSize: 13 }}>
                  <img src="/icon-192.png" alt="" style={{ width: 18, height: 18, borderRadius: 4, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} /> Loading rules…
                </div>
              ) : autoReplies.length === 0 && !showAddRule ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <IpZap size={40} style={{ color: t.textMuted, margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No auto-reply rules yet</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 20 }}>Set up automatic responses for first-time messages, keywords, or any incoming DM.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {autoReplies.map(rule => (
                    <div key={rule.id} style={{ background: t.card, border: `1px solid ${rule.is_active ? t.primaryBorder : t.border}`, borderRadius: 10, padding: '14px 16px', opacity: rule.is_active ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 4, background: rule.trigger_type === 'first_message' ? 'rgba(59,130,246,0.15)' : rule.trigger_type === 'keyword' ? 'rgba(234,179,8,0.15)' : 'rgba(124,92,252,0.12)', color: rule.trigger_type === 'first_message' ? '#3B82F6' : rule.trigger_type === 'keyword' ? '#D97706' : t.primary }}>
                              {rule.trigger_type === 'first_message' ? 'First message' : rule.trigger_type === 'keyword' ? 'Keyword' : 'Any message'}
                            </span>
                            {rule.trigger_type === 'keyword' && rule.keywords?.length > 0 && (
                              <span style={{ fontSize: 11, color: t.textMuted }}>"{rule.keywords.slice(0, 2).join('", "')}{rule.keywords.length > 2 ? `…` : ''}"</span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, marginBottom: 6 }}>"{rule.reply_text}"</div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: t.textMuted }}>
                            {rule.delay_seconds > 0 && <span>⏱ {rule.delay_seconds >= 60 ? `${Math.round(rule.delay_seconds / 60)}m delay` : `${rule.delay_seconds}s delay`}</span>}
                            {rule.send_only_once && <span>⚡ Once per user</span>}
                            <span>Used {rule.times_triggered || 0}×</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                          {/* Active toggle */}
                          <button onClick={() => toggleRuleActive(rule)} style={{ width: 36, height: 20, borderRadius: 10, background: rule.is_active ? t.primary : t.border, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms' }}>
                            <div style={{ position: 'absolute', top: 2, left: rule.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms ease' }} />
                          </button>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => startEdit(rule)} style={{ padding: '4px 8px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                              <IpEdit size={11} /> Edit
                            </button>
                            <button onClick={() => deleteRule(rule.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                              <IpDelete size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Edit form */}
              {showAddRule ? (
                <div style={{ background: t.card, border: `1px solid ${t.primaryBorder}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>{editingRule ? 'Edit Rule' : 'New Auto-Reply Rule'}</div>

                  {/* Trigger type */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>When to trigger</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['first_message', 'First message'], ['keyword', 'Keyword match'], ['any', 'Any message']].map(([val, label]) => (
                        <button key={val} onClick={() => setNewRule(r => ({ ...r, trigger_type: val }))} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: `2px solid ${newRule.trigger_type === val ? t.primary : t.border}`, background: newRule.trigger_type === val ? t.primaryBg : t.input, color: newRule.trigger_type === val ? t.primary : t.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', textAlign: 'center' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keywords (shown only for keyword trigger) */}
                  {newRule.trigger_type === 'keyword' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Keywords <span style={{ color: t.textMuted, fontWeight: 400 }}>(comma-separated)</span></label>
                      <input value={newRule.keywords} onChange={e => setNewRule(r => ({ ...r, keywords: e.target.value }))} placeholder="e.g. price, quote, cost" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} onFocus={e => (e.target.style.borderColor = t.primary)} onBlur={e => (e.target.style.borderColor = t.border)} />
                    </div>
                  )}

                  {/* Reply text */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Auto-reply message</label>
                    <textarea value={newRule.reply_text} onChange={e => setNewRule(r => ({ ...r, reply_text: e.target.value }))} placeholder="Hi! Thanks for reaching out to us. We'll get back to you within a few hours. For urgent inquiries, call us at..." rows={4} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none' }} onFocus={e => (e.target.style.borderColor = t.primary)} onBlur={e => (e.target.style.borderColor = t.border)} />
                  </div>

                  {/* Options row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Delay before sending</label>
                      <select value={newRule.delay_seconds} onChange={e => setNewRule(r => ({ ...r, delay_seconds: Number(e.target.value) }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, cursor: 'pointer' }}>
                        <option value={0}>Immediately</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                        <option value={600}>10 minutes</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Frequency</label>
                      <button onClick={() => setNewRule(r => ({ ...r, send_only_once: !r.send_only_once }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: newRule.send_only_once ? t.primaryBg : t.input, border: `1px solid ${newRule.send_only_once ? t.primaryBorder : t.border}`, color: newRule.send_only_once ? t.primary : t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        {newRule.send_only_once ? <><IpCheck size={12} /> Once per user</> : 'Every message'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveRule} disabled={arSaving || !newRule.reply_text.trim()} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, background: newRule.reply_text.trim() ? t.primary : t.border, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: newRule.reply_text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {arSaving ? <img src="/icon-192.png" alt="" style={{ width: 14, height: 14, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} /> : <IpSave size={14} />}
                      {arSaving ? 'Saving…' : editingRule ? 'Update Rule' : 'Save Rule'}
                    </button>
                    <button onClick={() => { setShowAddRule(false); setEditingRule(null); setNewRule(BLANK_RULE); }} style={{ padding: '10px 16px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddRule(true)} style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'transparent', border: `2px dashed ${t.border}`, color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 150ms' }} onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
                  <IpPlus size={15} /> Add new auto-reply rule
                </button>
              )}
            </div>

            {/* Footer hint */}
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
                💡 Auto-replies are sent from your connected Facebook / Instagram accounts. Rules only trigger during active messaging windows.
              </div>
            </div>
          </div>
        </div>
      )}

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
