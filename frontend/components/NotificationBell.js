import { useState, useEffect, useRef, useCallback } from 'react';
import { IpBell, IpBilling, IpUser, IpShieldAlert, IpInfo, IpCheckDouble } from './icons';
import { useTheme } from '../lib/theme';
import api from '../lib/api';

const POLL_INTERVAL = 60_000;

const TYPE_META = {
  credits:  { icon: IpBilling,     color: '#7C5CFC' },
  account:  { icon: IpUser,        color: '#EAB308' },
  security: { icon: IpShieldAlert, color: '#EF4444' },
  system:   { icon: IpInfo,        color: '#60A5FA' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function NotificationBell() {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data.notifications);
      setUnread(res.data.unread);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.patch(`/api/notifications/${id}/read`); } catch (_) {}
  };

  const markAllRead = async () => {
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try { await api.patch('/api/notifications/read-all'); } catch (_) {}
  };

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* BELL BUTTON */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8,
          background: open ? t.cardHover : t.card,
          border: `1px solid ${open ? t.primaryBorder : t.border}`,
          color: open ? t.primary : t.textSecondary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 150ms ease',
        }}
        title="Notifications"
      >
        <IpBell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
            border: `2px solid ${t.bg}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 340,
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft: 6, padding: '2px 7px', background: 'rgba(124,92,252,0.15)', color: t.primary, borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                  {unread} new
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <IpCheckDouble size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <IpBell size={28} style={{ color: t.textMuted, margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.system;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px',
                      borderBottom: `1px solid ${t.border}`,
                      background: n.read ? 'transparent' : 'rgba(124,92,252,0.04)',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { if (!n.read) e.currentTarget.style.background = 'rgba(124,92,252,0.08)'; }}
                    onMouseLeave={(e) => { if (!n.read) e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${meta.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={15} style={{ color: meta.color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: t.text, lineHeight: 1.3 }}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, flexShrink: 0, marginTop: 4 }} />
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: t.textMuted, margin: '3px 0 0', lineHeight: 1.5 }}>{n.message}</p>
                      <span style={{ fontSize: 11, color: t.textMuted, marginTop: 4, display: 'block' }}>{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
