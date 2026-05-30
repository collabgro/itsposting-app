import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  IpDashboard, IpWizard, IpSparkle, IpCreatePost, IpCalendar, IpDrafts,
  IpMediaLibrary, IpAnalytics, IpBilling, IpSettings, IpAdmin,
  IpMail, IpMenu, IpClose, IpPlus, IpSun, IpMoon, IpLogout,
  IpChevronsUpDown, IpChevronRight, IpInbox, IpTeam, IpZap, IpBusiness, IpSearch,
  IpPhotoStudio, IpWarning, IpSchedule, IpUser, IpVideo, IpCheck, IpTrendingUp,
} from './icons';
import { useTheme } from '../lib/theme';
import { authAPI, dmsAPI, suggestionsAPI, workspacesAPI, postsAPI } from '../lib/api';
import NotificationBell from './NotificationBell';
import { ConfirmModal } from './ui';
import { ItsPostingLogo } from './ItsPostingLogo';

const ROLE_PERMISSIONS = {
  manager: { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, geo_audit:true, inbox:true, contacts:true, knowledge_base:true, settings:true },
  editor:  { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, geo_audit:false, inbox:true, contacts:false, knowledge_base:false, settings:false },
  viewer:  { wizard:false, upload:false, calendar:true, history:true, media:false, studio:false, analytics:true, geo_audit:false, inbox:false, contacts:false, knowledge_base:false, settings:false },
};

const MODULE_ROUTES = {
  wizard:         ['/wizard', '/quick-post'],
  upload:         ['/upload'],
  calendar:       ['/calendar'],
  history:        ['/history'],
  media:          ['/media'],
  studio:         ['/studio'],
  analytics:      ['/analytics'],
  geo_audit:      ['/geo-audit'],
  inbox:          ['/inbox'],
  contacts:       ['/contacts'],
  knowledge_base: ['/knowledge-base'],
  settings:       ['/settings'],
  billing:        ['__never__'],
};

const NAV_ITEMS = [
  { name: 'Dashboard',     href: '/dashboard',      icon: IpDashboard },

  { isDivider: true, label: 'Create' },
  { name: 'Quick Post',    href: '/quick-post',     icon: IpZap,          isQuickPost: true },
  { name: 'Post Wizard',   href: '/wizard',         icon: IpWizard,       showSuggBadge: true },
  { name: 'Video Wizard',  href: '/video-wizard',   icon: IpVideo },
  { name: 'Post Ideas',    href: '/ideas',          icon: IpSparkle },
  { name: 'Content Calendar', href: '/content-calendar', icon: IpSchedule },
  { name: 'Upload',        href: '/upload',         icon: IpCreatePost },

  { isDivider: true, label: 'Manage' },
  { name: 'Calendar',      href: '/calendar',       icon: IpCalendar },
  { name: 'Drafts',        href: '/history',        icon: IpDrafts },
  { name: 'Media Library', href: '/media',          icon: IpMediaLibrary },

  { isDivider: true, label: 'Insights' },
  { name: 'Analytics',        href: '/analytics',         icon: IpAnalytics },
  { name: 'AI Visibility',    href: '/geo-audit',         icon: IpSearch },
  { name: 'Competitor Intel', href: '/competitor-intel',  icon: IpTrendingUp },

  { isDivider: true, label: 'Engage' },
  { name: 'Inbox',         href: '/inbox',          icon: IpInbox,        badgeKey: 'dmUnread' },
  { name: 'Contacts',      href: '/contacts',       icon: IpTeam },

  { isDivider: true, label: 'Account' },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: IpBusiness },
  { name: 'Workspaces',    href: '/workspaces',     icon: IpTeam,         isWorkspaceNav: true },
  { name: 'Approvals',     href: '/approvals',      icon: IpCheck,        isWorkspaceNav: true, badgeKey: 'pendingApprovals' },
  { name: 'Billing',       href: '/billing',        icon: IpBilling },
  { name: 'Profile',       href: '/profile',        icon: IpUser },
  { name: 'Settings',      href: '/settings',       icon: IpSettings },
];

export default function Layout({ children, title, subtitle, action }) {
  const router = useRouter();
  const { theme, toggleTheme, t } = useTheme();
  const [user, setUser] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);
  const [unseenSugg, setUnseenSugg] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [hasToken, setHasToken] = useState(false);
  const [wsData, setWsData] = useState(null);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [switchingWs, setSwitchingWs] = useState(null);
  const [impersonatingAs, setImpersonatingAs] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 900);
    updateMobile();
    window.addEventListener('resize', updateMobile);
    const token = localStorage.getItem('token');
    setHasToken(!!token);
    setImpersonatingAs(localStorage.getItem('impersonating_as') || null);
    if (token) {
      (async () => {
        const tryVerify = async () => {
          try {
            const r = await authAPI.verify();
            if (r.data?.customer) setUser(r.data.customer);
            return true;
          } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
              localStorage.removeItem('token');
              router.push('/login');
              return false;
            }
            return null; // non-401/403: signal to retry
          }
        };

        let result = await tryVerify();
        if (result === false) return; // redirected to login
        if (result === null) {
          // Transient error (likely 500 from backend starting up) — retry once after 2s
          await new Promise(resolve => setTimeout(resolve, 2000));
          result = await tryVerify();
          if (result === false) return;
        }
        const [dmsResult, suggResult, wsResult, approvalResult] = await Promise.allSettled([
          dmsAPI.getStats(),
          suggestionsAPI.getCount(),
          workspacesAPI.list(),
          postsAPI.getPendingApproval(),
        ]);
        if (dmsResult.status === 'fulfilled') setDmUnread(dmsResult.value.data?.unreadCount || 0);
        if (suggResult.status === 'fulfilled') setUnseenSugg(suggResult.value.data?.count || 0);
        if (wsResult.status === 'fulfilled' && wsResult.value.data) setWsData(wsResult.value.data);
        if (approvalResult.status === 'fulfilled') setPendingApprovals(Array.isArray(approvalResult.value.data) ? approvalResult.value.data.length : 0);
      })();
    }
    const refreshCredits = async () => {
      try {
        const r = await authAPI.verify();
        if (r.data?.customer) setUser(r.data.customer);
      } catch {}
    };
    window.addEventListener('creditRefresh', refreshCredits);
    return () => {
      window.removeEventListener('resize', updateMobile);
      window.removeEventListener('creditRefresh', refreshCredits);
    };
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

  const badges = { dmUnread, unseenSugg, pendingApprovals };

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

  const wlConfig = user?.white_label_config || {};
  const wlPrimary = wlConfig.primaryColor || t.primary;

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
        { name: 'Referrals',       href: '/admin/referrals',   icon: IpAnalytics, isAdmin: true },
        { name: 'Broadcast',       href: '/admin/broadcast',   icon: IpMail,      isAdmin: true },
        { name: 'Email Queue',     href: '/admin/email-queue', icon: IpMail,      isAdmin: true },
        { name: 'Audit Log',       href: '/admin/audit',       icon: IpAdmin,     isAdmin: true },
        { name: 'Templates',       href: '/admin/templates',    icon: IpPhotoStudio, isAdmin: true },
        { name: 'PostCore Brain',  href: '/admin/llm',          icon: IpSparkle,     isAdmin: true },
      ]
    : baseNavItems;

  // Permission filter for sub-accounts (team members)
  const isSubAccount = !!user?.parent_customer_id;
  const effectivePerms = isSubAccount
    ? (user.workspace_permissions || ROLE_PERMISSIONS[user.workspace_role || 'viewer'])
    : null;
  const visibleNavItems = !effectivePerms
    ? navItems
    : navItems.filter(item => {
        if (item.isDivider || !item.href) return true;
        const mod = Object.entries(MODULE_ROUTES).find(([, hrefs]) => hrefs.includes(item.href))?.[0];
        if (!mod) return true;
        if (mod === 'billing') return false;
        return effectivePerms[mod] !== false;
      });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.text }}>
      {mobileNavOpen && isMobile && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 59 }} />
      )}
      {/* SIDEBAR */}
      <aside
        className="sidebar-glass"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: isMobile ? 280 : sidebarWidth,
          display: 'flex', flexDirection: 'column',
          transition: 'width 200ms ease, transform 200ms ease',
          transform: isMobile ? (mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          zIndex: 60, overflow: 'hidden',
        }}
      >
        {/* LOGO */}
        <div
          style={{
            height: 60, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`,
            flexShrink: 0,
          }}
        >
          {!isMobile && (
            wlConfig.logo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1 }}>
                <img src={wlConfig.logo} alt={wlConfig.agencyName || 'Logo'} style={{ height: 30, maxWidth: 150, objectFit: 'contain' }} />
                {wlConfig.agencyName && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wlConfig.agencyName}
                  </span>
                )}
              </div>
            ) : (
              <ItsPostingLogo size="sm" variant="full" theme={t.isDark ? 'dark' : 'light'} />
            )
          )}
          {isMobile && (
            <button
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
              style={{ width: 32, height: 32, borderRadius: 8, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <IpClose size={16} />
            </button>
          )}
        </div>

        {/* WORKSPACE SWITCHER */}
        {!isMobile && hasToken && !user && (
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 11, borderRadius: 4, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', width: '70%', marginBottom: 5 }} />
                <div style={{ height: 9, borderRadius: 4, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', width: '50%' }} />
              </div>
            </div>
          </div>
        )}
        {!isMobile && user && (
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`, flexShrink: 0, position: 'relative' }}>
            <div
              onClick={() => setWsDropdownOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, background: t.isDark ? (wsDropdownOpen ? 'rgba(124,92,252,0.1)' : 'rgba(255,255,255,0.035)') : (wsDropdownOpen ? 'rgba(124,92,252,0.07)' : 'rgba(0,0,0,0.03)'), border: `1px solid ${wsDropdownOpen ? t.primaryBorder : (t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')}`, cursor: 'pointer', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                {(user.favicon_url || user.logo_url)
                  ? <img src={user.favicon_url || user.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user.business_name || 'W').charAt(0).toUpperCase()}
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
                    <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #FB923C, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {(wsData.mainAccount.favicon_url || wsData.mainAccount.logo_url)
                        ? <img src={wsData.mainAccount.favicon_url || wsData.mainAccount.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (wsData.mainAccount.business_name || 'M').charAt(0).toUpperCase()}
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
                    <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {(ws.favicon_url || ws.logo_url)
                        ? <img src={ws.favicon_url || ws.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (ws.workspace_display_name || ws.business_name || 'W').charAt(0).toUpperCase()}
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
          <div style={{ padding: '10px 12px', flexShrink: 0 }}>
            <button
              onClick={() => router.push('/wizard')}
              className="btn-shimmer"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '12px 14px',
                background: `linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%)`,
                backgroundSize: '200% 100%',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700,
                transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 180ms ease', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(124,92,252,0.45), 0 1px 3px rgba(124,92,252,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,92,252,0.55), 0 2px 6px rgba(124,92,252,0.35), inset 0 1px 0 rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,92,252,0.45), 0 1px 3px rgba(124,92,252,0.3), inset 0 1px 0 rgba(255,255,255,0.15)';
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(0.97)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1)'; }}
            >
              <IpSparkle size={16} />
              Create new post
            </button>
          </div>
        )}

        {/* NAVIGATION */}
        <nav aria-label="Main navigation" style={{ flex: 1, padding: '4px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1 }}>
          {visibleNavItems.map((item) => {
            if (item.isDivider) {
              return (
                <div key={`divider-${item.label}`} style={{ padding: '20px 8px 5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.28)', textTransform: 'uppercase', letterSpacing: '0.11em' }}>{item.label}</span>
                  <div style={{ flex: 1, height: 1, background: t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)', opacity: 1 }} />
                </div>
              );
            }
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
            const hasSuggDot = item.showSuggBadge && unseenSugg > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'nav-active' : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: '8px 11px', marginBottom: 1,
                  borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? t.text : t.textMuted,
                  background: 'transparent',
                  borderLeft: active ? `2.5px solid ${t.primary}` : '2.5px solid transparent',
                  transition: 'all 160ms cubic-bezier(0.34,1.56,0.64,1)', whiteSpace: 'nowrap',
                  textDecoration: 'none', position: 'relative',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
                    e.currentTarget.style.color = t.text;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = t.textMuted;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}
                  className={active ? 'icon-3d-active' : 'icon-3d'}>
                  <item.icon
                    size={16}
                    strokeWidth={active ? 2.2 : 1.85}
                    color={active ? 'url(#brand-gradient)' : (item.isAdmin ? 'url(#brand-gradient)' : t.textMuted)}
                  />
                  {hasSuggDot && (
                    <div style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#EF4444', border: `1.5px solid ${t.isDark ? '#08080F' : '#fff'}`, boxShadow: '0 0 5px rgba(239,68,68,0.65)' }} />
                  )}
                </div>
                <span style={{ flex: 1 }}>{item.name}</span>
                {item.badgeKey && badges[item.badgeKey] > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(239,68,68,0.45)',
                  }}>
                    {badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                  </span>
                )}
                {item.isQuickPost && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 5, background: 'rgba(124,92,252,0.15)', color: t.primary, border: `1px solid rgba(124,92,252,0.25)` }}>
                    30s
                  </span>
                )}
                {item.betaBadge && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 5, background: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.25)', flexShrink: 0 }}>
                    Beta
                  </span>
                )}
              </Link>
            );
          })}
          </div>
          {isMobile && user && (
            <div style={{ padding: '8px 2px', borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
              <button
                onClick={() => { setMobileNavOpen(false); setShowLogoutConfirm(true); }}
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
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`, flexShrink: 0 }}>
            <div style={{ padding: '13px 14px', background: t.isDark ? 'rgba(124,92,252,0.09)' : 'rgba(124,92,252,0.05)', borderRadius: 12, border: `1px solid rgba(124,92,252,0.22)`, boxShadow: '0 4px 16px rgba(124,92,252,0.1), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, letterSpacing: '-0.01em' }}>Free Trial</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.primary }}>{user.credits_balance ?? 0} {isSubAccount ? 'shared credits' : 'credits left'}</div>
              </div>
              <div style={{ height: 5, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((user.credits_balance ?? 0) / 10) * 100)}%`, background: 'linear-gradient(90deg, #7C5CFC, #9B7FFF)', borderRadius: 99, boxShadow: '0 0 6px rgba(124,92,252,0.5)', transition: 'width 600ms ease' }} />
              </div>
              <Link href="/billing" className="btn-shimmer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 0', background: 'linear-gradient(135deg, #7C5CFC, #9B7FFF)', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em', boxShadow: '0 2px 8px rgba(124,92,252,0.35)', position: 'relative', overflow: 'hidden' }}>
                Upgrade to Pro →
              </Link>
            </div>
          </div>
        )}

        {/* USER PROFILE — clickable, opens popup */}
        {!isMobile && user && (
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`, flexShrink: 0, position: 'relative' }}>
            {/* Profile popup backdrop */}
            {showProfilePopup && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowProfilePopup(false)} />
            )}
            {/* Profile popup card */}
            {showProfilePopup && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: 12, right: 12,
                background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.2)', zIndex: 200, overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{ padding: '14px 16px', background: t.input, borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {user.logo_url
                        ? <img src={user.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (user.business_name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'User'}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: t.textMuted, textTransform: 'capitalize' }}>{user.plan || 'trial'} plan</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.primary }}>{user.credits_balance ?? 0} credits</span>
                  </div>
                </div>
                {/* Actions */}
                {[
                  { label: 'Edit Settings', icon: IpSettings, onClick: () => { setShowProfilePopup(false); router.push('/settings'); } },
                  { label: 'Billing & Plan', icon: IpBilling, onClick: () => { setShowProfilePopup(false); router.push('/billing'); } },
                  { label: 'Workspaces', icon: IpTeam, onClick: () => { setShowProfilePopup(false); router.push('/workspaces'); } },
                  { label: 'Invite someone', icon: IpPlus, onClick: () => { setShowProfilePopup(false); router.push('/workspaces?tab=team'); } },
                ].map(({ label, icon: Icon, onClick }) => (
                  <button key={label} onClick={onClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'transparent', border: 'none', color: t.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon size={15} color={t.textMuted} /> {label}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${t.border}` }} />
                <button
                  onClick={() => { setShowProfilePopup(false); setShowLogoutConfirm(true); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <IpLogout size={15} color="#ef4444" /> Log out
                </button>
              </div>
            )}
            {/* Clickable avatar row */}
            <button
              onClick={() => { setWsDropdownOpen(false); setShowProfilePopup(v => !v); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: showProfilePopup ? t.cardHover : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }}
              onMouseEnter={(e) => { if (!showProfilePopup) e.currentTarget.style.background = t.cardHover; }}
              onMouseLeave={(e) => { if (!showProfilePopup) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                {user.logo_url
                  ? <img src={user.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user.business_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'User'}</div>
                <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
              <IpChevronsUpDown size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
            </button>
          </div>
        )}

        {/* Powered by ItsPosting — shown in white-label mode unless hidden */}
        {wlConfig.logo && !wlConfig.hidePoweredBy && (
          <div style={{ padding: '8px 16px', flexShrink: 0, borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
            <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', opacity: 0.6 }}>
              Powered by <span style={{ fontWeight: 700, color: t.textMuted }}>ItsPosting</span>
            </div>
          </div>
        )}

      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : sidebarWidth, transition: 'margin-left 200ms ease', minWidth: 0 }}>
        {/* TOP BAR */}
        <header
          className="topbar-glass"
          style={{
            height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '0 20px' : '0 36px', position: 'sticky', top: 0, zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
            {title && <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-0.035em', lineHeight: 1 }}>{title}</h1>}
            {subtitle && <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1, margin: 0, letterSpacing: '-0.01em' }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isMobile && (
              <button
                aria-label="Open navigation menu"
                onClick={() => setMobileNavOpen(true)}
                style={{ width: 36, height: 36, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IpMenu size={16} />
              </button>
            )}
            <NotificationBell />
            <button
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
              style={{ width: 36, height: 36, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = t.card)}
            >
              {theme === 'dark' ? <IpSun size={16} /> : <IpMoon size={16} />}
            </button>
            {/* Workspace role badge — shown for invited members (Type B) */}
            {user?.is_member && user.workspace_role && !isMobile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                background: user.workspace_role === 'manager' ? 'rgba(124,92,252,0.12)' : 'rgba(234,179,8,0.12)',
                color: user.workspace_role === 'manager' ? t.primary : '#92400e',
                border: `1px solid ${user.workspace_role === 'manager' ? t.primaryBorder : 'rgba(234,179,8,0.3)'}`,
              }} title={`Your role in this workspace: ${user.workspace_role}`}>
                {user.workspace_role === 'manager' ? '🏆 Manager' : user.workspace_role === 'editor' ? '✏ Editor' : '👁 Viewer'}
              </div>
            )}
            {user && !isMobile && (
              <div className="credit-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, fontSize: 12 }}>
                <span style={{ color: t.textMuted, fontWeight: 500 }}>{isSubAccount ? 'Shared' : 'Credits'}</span>
                <span style={{ color: t.primary, fontWeight: 800, fontFamily: 'monospace', fontSize: 13 }}>{user.credits_balance ?? 0}</span>
              </div>
            )}
            {!isMobile && action}
          </div>
        </header>

        {/* ACTION SUB-BAR — mobile only, shows page action buttons below the header */}
        {isMobile && action && (
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: 64, zIndex: 39 }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>{isSubAccount ? 'Shared:' : 'Credits:'}</span>
                <span style={{ color: t.primary, fontWeight: 700, fontFamily: 'monospace' }}>{user.credits_balance ?? 0}</span>
              </div>
            )}
            {action}
          </div>
        )}

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
        <div
          key={router.pathname}
          className="page-fade-in"
          style={{
            padding: isMobile ? '24px 16px' : '40px 44px',
            paddingBottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : 48,
            minHeight: 'calc(100vh - 64px)',
            width: '100%',
            maxWidth: '100vw',
            overflowX: 'hidden',
          }}
        >{children}</div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <nav className="sidebar-glass" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          height: 60, paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {/* Home */}
          {[
            { href: '/dashboard',  icon: IpDashboard,  label: 'Home'     },
            { href: '/calendar',   icon: IpCalendar,   label: 'Calendar' },
          ].slice(0, 2).map(({ href, icon: Icon, label }) => {
            const active = router.pathname === href || router.pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 16px', borderRadius: 10, textDecoration: 'none', flex: 1,
                color: active ? t.primary : t.textMuted,
                transition: 'color 150ms',
              }}>
                <div style={{ position: 'relative' }}>
                  <Icon size={22} color={active ? 'url(#brand-gradient)' : t.textMuted} />
                  {active && (
                    <div style={{
                      position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%',
                      background: t.primary,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
              </Link>
            );
          })}

          {/* Center CREATE button */}
          <button
            onClick={() => router.push('/wizard')}
            style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryLight} 100%)`,
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${t.focusRing}`,
              cursor: 'pointer', transition: 'transform 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = `0 6px 24px ${t.focusRing}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 20px ${t.focusRing}`; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
            title="Post Wizard"
          >
            <IpSparkle size={22} color="#fff" />
          </button>

          {[
            { href: '/analytics', icon: IpAnalytics, label: 'Analytics' },
          ].map(({ href, icon: Icon, label }) => {
            const active = router.pathname === href || router.pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 16px', borderRadius: 10, textDecoration: 'none', flex: 1,
                color: active ? t.primary : t.textMuted,
                transition: 'color 150ms',
              }}>
                <div style={{ position: 'relative' }}>
                  <Icon size={22} color={active ? 'url(#brand-gradient)' : t.textMuted} />
                  {active && (
                    <div style={{
                      position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%', background: t.primary,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
              </Link>
            );
          })}

          {/* More / menu */}
          <button
            onClick={() => setMobileNavOpen(true)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 16px', flex: 1,
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.textMuted, transition: 'color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = t.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; }}
          >
            {user && (user.logo_url || user.favicon_url) ? (
              <img
                src={user.logo_url || user.favicon_url} alt=""
                style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', border: `1.5px solid ${t.border}` }}
              />
            ) : (
              <IpMenu size={22} />
            )}
            <span style={{ fontSize: 10, fontWeight: 500 }}>More</span>
          </button>
        </nav>
      )}

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <ConfirmModal
          title="Log out?"
          message="You'll need to sign in again to access your account."
          confirmLabel="Log out"
          confirmVariant="danger"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

    </div>
  );
}
