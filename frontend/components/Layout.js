import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  IpDashboard, IpWizard, IpSparkle, IpCreatePost, IpCalendar, IpDrafts,
  IpMediaLibrary, IpAnalytics, IpBilling, IpSettings, IpAdmin,
  IpMail, IpMenu, IpClose, IpPlus, IpSun, IpMoon, IpLogout,
  IpChevronsUpDown, IpChevronRight, IpInbox, IpTeam, IpZap, IpBusiness, IpTrendingUp, IpSearch,
  IpPhotoStudio, IpWarning,
} from './icons';
import { useTheme } from '../lib/theme';
import { authAPI, dmsAPI, suggestionsAPI, workspacesAPI } from '../lib/api';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { name: 'Dashboard',   href: '/dashboard',  icon: IpDashboard },
  { name: 'Quick Post',  href: '/quick-post', icon: IpZap, isQuickPost: true },
  { name: 'Post Wizard', href: '/wizard',     icon: IpWizard,     showSuggBadge: true },
  { name: 'Create Post', href: '/upload',     icon: IpCreatePost },
  { name: 'Calendar',    href: '/calendar',   icon: IpCalendar },
  { name: 'Drafts',      href: '/history',    icon: IpDrafts },
  { name: 'Media Library', href: '/media',    icon: IpMediaLibrary },
  { name: 'Photo Studio', href: '/studio',    icon: IpPhotoStudio },
  { name: 'Analytics',      href: '/analytics',      icon: IpAnalytics },
  { name: 'Reports',        href: '/reports',        icon: IpDrafts },
  { name: 'ROI Estimator',  href: '/roi',            icon: IpTrendingUp },
  { name: 'GEO Audit',     href: '/geo-audit',      icon: IpSearch },
  { name: 'Inbox',          href: '/inbox',          icon: IpInbox, badgeKey: 'dmUnread' },
  { name: 'AI Receptionist', href: '/receptionist', icon: IpSparkle, betaBadge: true },
  { name: 'Teach PostCore', href: '/knowledge-base', icon: IpBusiness },
  { name: 'Contacts',   href: '/contacts',   icon: IpTeam },
  { name: 'Workspaces', href: '/workspaces', icon: IpTeam, isWorkspaceNav: true },
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
  const [hasToken, setHasToken] = useState(false);
  const [wsData, setWsData] = useState(null);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [switchingWs, setSwitchingWs] = useState(null);
  const [impersonatingAs, setImpersonatingAs] = useState(null);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 900);
    updateMobile();
    window.addEventListener('resize', updateMobile);
    const token = localStorage.getItem('token');
    setHasToken(!!token);
    setImpersonatingAs(localStorage.getItem('impersonating_as') || null);
    if (token) {
      (async () => {
        try {
          const r = await authAPI.verify();
          if (r.data?.customer) setUser(r.data.customer);
        } catch (err) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem('token');
            router.push('/login');
            return;
          }
        }
        const [dmsResult, suggResult, wsResult] = await Promise.allSettled([
          dmsAPI.getStats(),
          suggestionsAPI.getCount(),
          workspacesAPI.list(),
        ]);
        if (dmsResult.status === 'fulfilled') setDmUnread(dmsResult.value.data?.unreadCount || 0);
        if (suggResult.status === 'fulfilled') setUnseenSugg(suggResult.value.data?.count || 0);
        if (wsResult.status === 'fulfilled' && wsResult.value.data) setWsData(wsResult.value.data);
      })();
    }
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  async function switchToWorkspace(wsId) {
    setSwitchingWs(wsId);
    try {
      const { data } = await workspacesAPI.switchTo(wsId);
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard';
    } catch { /* swallow */ } finally {
      setSwitchingWs(null);
    }
  }

  async function switchToMain() {
    setSwitchingWs('main');
    try {
      const { data } = await workspacesAPI.switchToMain();
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard';
    } catch { /* swallow */ } finally {
      setSwitchingWs(null);
    }
  }

  const badges = { dmUnread, unseenSugg };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const exitImpersonation = () => {
    const backup = localStorage.getItem('admin_backup_token');
    if (backup) localStorage.setItem('token', backup);
    localStorage.removeItem('admin_backup_token');
    localStorage.removeItem('impersonating_as');
    router.push('/admin/customers');
  };

  const sidebarWidth = 240;

  // Hide Workspaces nav item when operating inside a workspace (not the main account)
  const isInWorkspace = wsData?.mainAccount && wsData.mainAccount.id !== user?.id;
  const baseNavItems = NAV_ITEMS.filter(item => !(item.isWorkspaceNav && isInWorkspace));

  // Nav items + conditionally add admin link for admins
  const navItems = user?.is_admin
    ? [
        ...baseNavItems,
        { isDivider: true, label: 'Admin' },
        { name: 'Admin Portal',    href: '/admin',             icon: IpAdmin,     isAdmin: true },
        { name: 'Customers',       href: '/admin/customers',   icon: IpTeam,      isAdmin: true },
        { name: 'Post Moderation', href: '/admin/posts',       icon: IpDrafts,    isAdmin: true },
        { name: 'Broadcast',       href: '/admin/broadcast',   icon: IpMail,      isAdmin: true },
        { name: 'Email Queue',     href: '/admin/email-queue', icon: IpMail,      isAdmin: true },
        { name: 'Audit Log',       href: '/admin/audit',       icon: IpAdmin,     isAdmin: true },
        { name: 'Stock Photos',    href: '/admin/stock-photos', icon: IpPhotoStudio, isAdmin: true },
      ]
    : baseNavItems;

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
              <img src="/itsposting-logo.png" alt="ItsPosting" width={32} height={32} style={{ borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: t.text, whiteSpace: 'nowrap' }}>ItsPosting</span>
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
          <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, position: 'relative' }}>
            <div
              onClick={() => setWsDropdownOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: t.card, border: `1px solid ${wsDropdownOpen ? t.primaryBorder : t.border}`, cursor: 'pointer', transition: 'border-color 150ms' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                {(user.business_name || 'W').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'Workspace'}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{wsData?.mainAccount && wsData.mainAccount.id !== user.id ? 'Workspace' : (user.industry || 'Main account')}</div>
              </div>
              <IpChevronsUpDown size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
            </div>

            {wsDropdownOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% - 4px)', left: 12, right: 12,
                  background: t.card, border: `1px solid ${t.border}`, borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.16)', zIndex: 200, overflow: 'hidden',
                }}
              >
                {/* Close dropdown on outside click */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: -1 }}
                  onClick={() => setWsDropdownOpen(false)}
                />
                <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Switch workspace
                </div>

                {/* Main account row */}
                {wsData?.mainAccount && (
                  <button
                    onClick={() => {
                      if (wsData.mainAccount.id === user.id) { setWsDropdownOpen(false); return; }
                      setWsDropdownOpen(false);
                      switchToMain();
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: wsData.mainAccount.id === user.id ? t.primaryBg : 'transparent',
                      border: 'none', cursor: wsData.mainAccount.id === user.id ? 'default' : 'pointer',
                      borderRadius: 6, transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { if (wsData.mainAccount.id !== user.id) e.currentTarget.style.background = t.cardHover; }}
                    onMouseLeave={(e) => { if (wsData.mainAccount.id !== user.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #FB923C, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(wsData.mainAccount.business_name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wsData.mainAccount.business_name}</div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>Main account</div>
                    </div>
                    {wsData.mainAccount.id === user.id && switchingWs !== 'main' && (
                      <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>Active</span>
                    )}
                    {switchingWs === 'main' && <span style={{ fontSize: 10, color: t.textMuted }}>Switching…</span>}
                  </button>
                )}

                {/* Workspace rows */}
                {wsData?.workspaces?.filter(ws => ws.status !== 'inactive').map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      if (ws.id === user.id) { setWsDropdownOpen(false); return; }
                      setWsDropdownOpen(false);
                      switchToWorkspace(ws.id);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: ws.id === user.id ? t.primaryBg : 'transparent',
                      border: 'none', cursor: ws.id === user.id ? 'default' : 'pointer',
                      borderRadius: 6, transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => { if (ws.id !== user.id) e.currentTarget.style.background = t.cardHover; }}
                    onMouseLeave={(e) => { if (ws.id !== user.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(ws.workspace_display_name || ws.business_name || 'W').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.workspace_display_name || ws.business_name}</div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>Workspace</div>
                    </div>
                    {ws.id === user.id && <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>Active</span>}
                    {switchingWs === ws.id && <span style={{ fontSize: 10, color: t.textMuted }}>Switching…</span>}
                  </button>
                ))}

                {/* Add workspace / Manage */}
                <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 8px 8px', display: 'flex', gap: 6 }}>
                  {wsData && wsData.workspaces && (wsData.workspaces.filter(w => w.status !== 'inactive').length + 1) < (wsData.planLimit || 1) && (
                    <button
                      onClick={() => { setWsDropdownOpen(false); router.push('/workspaces'); }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 7, color: t.primary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <IpPlus size={12} /> Add workspace
                    </button>
                  )}
                  <button
                    onClick={() => { setWsDropdownOpen(false); router.push('/workspaces'); }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            )}
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
              <IpPlus size={16} strokeWidth={2.5} color="url(#brand-gradient)" />
              <span>Create new post</span>
            </button>
          </div>
        )}

        {/* NAVIGATION */}
        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1 }}>
          {navItems.map((item) => {
            if (item.isDivider) {
              return (
                <div key={`divider-${item.label}`} style={{ padding: '14px 14px 4px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
              );
            }
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
                  <item.icon size={16} strokeWidth={2} color={active ? 'url(#brand-gradient)' : (item.isAdmin ? 'url(#brand-gradient)' : t.textMuted)} />
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
                {item.betaBadge && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)', flexShrink: 0 }}>
                    Beta
                  </span>
                )}
                {active && !item.badgeKey && !item.isQuickPost && !item.betaBadge && <IpChevronRight size={14} style={{ color: t.textMuted }} />}
              </Link>
            );
          })}
          </div>
          {isMobile && user && (
            <div style={{ padding: '8px 2px', borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
              <button
                onClick={handleLogout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: t.textMuted, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all 150ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; }}
              >
                <IpLogout size={16} /> Log out
              </button>
            </div>
          )}
        </nav>

        {/* TRIAL CARD */}
        {!isMobile && user?.status === 'trial' && (
          <div style={{ padding: '12px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', background: t.card, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 2 }}>Free trial version</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>{user.credits_balance ?? 0} {user.is_sub_account ? 'shared credits' : 'credits remaining'}</div>
              <div style={{ height: 4, background: t.input, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((user.credits_balance ?? 0) / 10) * 100)}%`, background: t.primary, borderRadius: 2 }} />
              </div>
              <Link href="/billing" style={{ fontSize: 12, fontWeight: 600, color: t.primary, textDecoration: 'none' }}>Upgrade now →</Link>
            </div>
          </div>
        )}

        {/* USER PROFILE */}
        {!isMobile && user && (
          <div style={{ padding: '12px 12px 0', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                {(user.business_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'User'}</div>
                <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
            {user?.status !== 'trial' && (
              <Link
                href="/billing"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', marginTop: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'all 150ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.primary; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.color = t.primary; }}
              >
                <IpBilling size={13} color="url(#brand-gradient)" /> Upgrade Plan
              </Link>
            )}
          </div>
        )}
        {!isMobile && hasToken && (
          <div style={{ padding: user ? '6px 12px 12px' : '12px 12px 12px', borderTop: user ? 'none' : `1px solid ${t.border}`, flexShrink: 0 }}>
            <button
              onClick={handleLogout}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}
            >
              <IpLogout size={13} /> Log out
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

        {/* IMPERSONATION BANNER */}
        {impersonatingAs && (
          <div style={{
            background: '#F59E0B', color: '#000', padding: '10px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 13, fontWeight: 600, position: 'sticky', top: 64, zIndex: 39,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IpWarning size={14} /> Viewing as: {impersonatingAs} — all actions are real</span>
            <button
              onClick={exitImpersonation}
              style={{ padding: '5px 14px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.25)', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Exit View
            </button>
          </div>
        )}

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
