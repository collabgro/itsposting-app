import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  IpDashboard, IpWizard, IpSparkle, IpCreatePost, IpCalendar, IpDrafts,
  IpMediaLibrary, IpAnalytics, IpBilling, IpSettings, IpAdmin,
  IpMail, IpMenu, IpClose, IpPlus, IpSun, IpMoon,
  IpChevronsUpDown, IpChevronRight, IpInbox, IpTeam, IpZap,
} from './icons';
import { useTheme } from '../lib/theme';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { name: 'Dashboard',   href: '/dashboard',  icon: IpDashboard },
  { name: 'Quick Post',  href: '/quick-post', icon: IpZap, isQuickPost: true },
  { name: 'Post Wizard', href: '/wizard',     icon: IpWizard,     showSuggBadge: true },
  { name: 'Create Post', href: '/upload',     icon: IpCreatePost },
  { name: 'Calendar',    href: '/calendar',   icon: IpCalendar },
  { name: 'Drafts',      href: '/history',    icon: IpDrafts },
  { name: 'Media Library', href: '/media',    icon: IpMediaLibrary },
  { name: 'Analytics',  href: '/analytics',  icon: IpAnalytics },
  { name: 'Inbox',      href: '/inbox',      icon: IpInbox, badgeKey: 'dmUnread' },
  { name: 'Contacts',   href: '/contacts',   icon: IpTeam },
  { name: 'Billing',    href: '/billing',    icon: IpBilling },
  { name: 'Settings',   href: '/settings',   icon: IpSettings },
];

export default function Layout({ children, title, subtitle, action }) {
  const router = useRouter();
  const { theme, toggleTheme, t } = useTheme();
  const [user, setUser] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);
  const [unseenSugg, setUnseenSugg] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 900);
    updateMobile();
    window.addEventListener('resize', updateMobile);
    const token = localStorage.getItem('token');
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      fetch('/api/auth/verify', { headers })
        .then((r) => r.json())
        .then((d) => d.customer && setUser(d.customer))
        .catch(() => {});
      fetch('/api/dms/stats', { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setDmUnread(d.unreadCount || 0))
        .catch(() => {});
      fetch('/api/suggestions/count', { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setUnseenSugg(d.count || 0))
        .catch(() => {});
    }
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  const badges = { dmUnread, unseenSugg };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const sidebarWidth = 240;

  // Nav items + conditionally add admin link for admins
  const navItems = user?.is_admin
    ? [...NAV_ITEMS,
        { name: 'Admin Portal', href: '/admin', icon: IpAdmin, isAdmin: true },
        { name: 'Email Queue', href: '/admin/email-queue', icon: IpMail, isAdmin: true },
      ]
    : NAV_ITEMS;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.text }}>
      {mobileNavOpen && isMobile && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 59 }} />
      )}
      {/* SIDEBAR */}
      <aside
        style={{
          position: isMobile ? 'fixed' : 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: isMobile ? 280 : sidebarWidth,
          background: t.sidebar, borderRight: `1px solid ${t.border}`,
          display: 'flex', flexDirection: 'column',
          transition: 'width 200ms ease, transform 200ms ease',
          transform: isMobile ? (mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          zIndex: 60, overflow: 'hidden',
        }}
      >
        {/* LOGO */}
        <div
          style={{
            height: 64, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: `1px solid ${t.border}`, flexShrink: 0,
          }}
        >
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {logoFailed ? (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC 0%, #E040FB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IpZap size={15} color="#fff" />
                </div>
              ) : (
                <img
                  src={theme === 'dark' ? '/itsposting-logo.png' : '/itsposting.png'}
                  alt="ItsPosting"
                  width={32}
                  height={32}
                  style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                  onError={() => setLogoFailed(true)}
                />
              )}
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>ItsPosting</span>
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileNavOpen(false)}
              style={{ width: 32, height: 32, borderRadius: 8, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <IpClose size={16} />
            </button>
          )}
        </div>

        {/* WORKSPACE SWITCHER */}
        {!isMobile && user && (
          <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                {(user.business_name || 'W').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'Workspace'}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{user.industry || 'Business'}</div>
              </div>
              <IpChevronsUpDown size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
            </div>
          </div>
        )}

        {/* CREATE NEW POST */}
        {!isMobile && (
          <div style={{ padding: '12px', flexShrink: 0 }}>
            <button
              onClick={() => router.push('/upload')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 500, transition: 'all 150ms ease', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.primaryBorder; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }}
            >
              <IpPlus size={16} strokeWidth={2.5} style={{ color: t.primary }} />
              <span>Create new post</span>
            </button>
          </div>
        )}

        {/* NAVIGATION */}
        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
            const hasSuggDot = item.showSuggBadge && unseenSugg > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 12, padding: '10px 14px', marginBottom: 2,
                  borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? t.text : t.textSecondary,
                  background: active ? (item.isAdmin ? 'rgba(124,92,252,0.15)' : t.primaryBg) : 'transparent',
                  border: active ? `1px solid ${item.isAdmin ? 'rgba(124,92,252,0.4)' : t.primaryBorder}` : '1px solid transparent',
                  transition: 'all 150ms ease', whiteSpace: 'nowrap',
                  textDecoration: 'none', position: 'relative',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.cardHover; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <item.icon size={16} strokeWidth={2} style={{ color: active ? t.primary : (item.isAdmin ? t.primary : t.textMuted) }} />
                  {hasSuggDot && (
                    <div style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#EF4444', border: `1.5px solid ${t.sidebar}` }} />
                  )}
                </div>
                <span style={{ flex: 1 }}>{item.name}</span>
                {item.badgeKey && badges[item.badgeKey] > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', flexShrink: 0,
                  }}>
                    {badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                  </span>
                )}
                {item.isQuickPost && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 4, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}` }}>
                    30s
                  </span>
                )}
                {active && !item.badgeKey && !item.isQuickPost && <IpChevronRight size={14} style={{ color: t.textMuted }} />}
              </Link>
            );
          })}
        </nav>

        {/* TRIAL CARD */}
        {!isMobile && user?.status === 'trial' && (
          <div style={{ padding: '12px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', background: t.card, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>Free trial version</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>{user.credits_balance ?? 0} credits remaining</div>
              <div style={{ height: 4, background: t.input, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((user.credits_balance ?? 0) / 10) * 100)}%`, background: t.primary, borderRadius: 2 }} />
              </div>
              <Link href="/billing" style={{ fontSize: 12, fontWeight: 600, color: t.primary, textDecoration: 'none' }}>Upgrade now →</Link>
            </div>
          </div>
        )}

        {/* USER PROFILE */}
{!isMobile && user && (
  <div style={{ padding: '12px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, transition: 'background 150ms' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>
        {(user.business_name || user.email || 'U').charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'User'}</div>
        <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
      </div>
    </div>
    <button
      onClick={handleLogout}
      style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}
    >
      Log out
    </button>
  </div>
)}


      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : sidebarWidth, transition: 'margin-left 200ms ease', minWidth: 0 }}>
        {/* TOP BAR */}
        <header
          style={{
            height: 64, background: t.bg, borderBottom: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '0 16px' : '0 32px', position: 'sticky', top: 0, zIndex: 40,
          }}
        >
          <div>
            {title && <h1 style={{ fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{title}</h1>}
            {subtitle && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isMobile && (
              <button onClick={() => setMobileNavOpen(true)} style={{ width: 36, height: 36, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IpMenu size={16} />
              </button>
            )}
            <NotificationBell />
            <button
              onClick={toggleTheme}
              style={{ width: 36, height: 36, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = t.card)}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <IpSun size={16} /> : <IpMoon size={16} />}
            </button>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: t.textMuted }}>Credits:</span>
                <span style={{ color: t.primary, fontWeight: 700, fontFamily: 'monospace' }}>{user.credits_balance ?? 0}</span>
              </div>
            )}
            {action}
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div style={{
          padding: isMobile ? 16 : 32,
          minHeight: 'calc(100vh - 64px)',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}>{children}</div>
      </main>
    </div>
  );
}
