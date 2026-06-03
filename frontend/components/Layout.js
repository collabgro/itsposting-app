import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useBranding } from '../lib/branding';
import {
  IpDashboard, IpWizard, IpSparkle, IpCreatePost, IpCalendar, IpDrafts,
  IpMediaLibrary, IpAnalytics, IpBilling, IpSettings, IpAdmin,
  IpMail, IpMenu, IpClose, IpPlus, IpSun, IpMoon, IpLogout,
  IpChevronsUpDown, IpChevronRight, IpInbox, IpTeam, IpZap, IpBusiness, IpSearch,
  IpPhotoStudio, IpWarning, IpSchedule, IpVideo, IpCheck, IpTrendingUp, IpTip, IpComment,
  IpGift, IpWand,
} from './icons';
import { useTheme } from '../lib/theme';
import { authAPI, dmsAPI, suggestionsAPI, workspacesAPI, postsAPI, intelligenceAPI, analyticsAPI, billingAPI, geoAPI, knowledgeAPI, customerAPI, mediaAPI, adminAPI } from '../lib/api';
import NotificationBell from './NotificationBell';
import { ConfirmModal } from './ui';
import { ItsPostingLogo } from './ItsPostingLogo';

const ROLE_PERMISSIONS = {
  manager: { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, geo_audit:true, inbox:true, knowledge_base:true, settings:true },
  editor:  { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, geo_audit:false, inbox:true, knowledge_base:false, settings:false },
  viewer:  { wizard:false, upload:false, calendar:true, history:true, media:false, studio:false, analytics:true, geo_audit:false, inbox:false, knowledge_base:false, settings:false },
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
  knowledge_base: ['/knowledge-base'],
  settings:       ['/settings'],
  billing:        ['__never__'],
};

const NAV_ITEMS = [
  { name: 'Dashboard',     href: '/dashboard',      icon: IpDashboard },

  { isDivider: true, label: 'Create' },
  { name: 'Quick Post',    href: '/quick-post',     icon: IpZap,          isQuickPost: true,  featureKey: 'quick_post' },
  { name: 'AI Post',       href: '/wizard',         icon: IpWand,         showSuggBadge: true, featureKey: 'wizard' },
  { name: 'Templates Studio', href: '/templates',  icon: IpPhotoStudio,  featureKey: 'templates' },
  { name: 'Post Ideas',    href: '/ideas',          icon: IpTip },
  { name: 'Content Calendar', href: '/content-calendar', icon: IpSchedule },
  { name: 'Social Planner', href: '/upload',         icon: IpCreatePost },

  { isDivider: true, label: 'Manage' },
  { name: 'Calendar',      href: '/calendar',       icon: IpCalendar,     featureKey: 'calendar' },
  { name: 'Media Library', href: '/media',          icon: IpMediaLibrary, featureKey: 'media_library' },

  { isDivider: true, label: 'Insights' },
  { name: 'Analytics',        href: '/analytics',         icon: IpAnalytics,   featureKey: 'analytics' },
  { name: 'AI Visibility',    href: '/geo-audit',         icon: IpSearch,      featureKey: 'geo_audit' },
  { name: 'Competitor Intel', href: '/competitor-intel',  icon: IpTrendingUp,  featureKey: 'competitor_intel' },

  { isDivider: true, label: 'Engage' },
  { name: 'Inbox',         href: '/inbox',          icon: IpInbox,        badgeKey: 'dmUnread', featureKey: 'inbox' },

  { isDivider: true, label: 'Account' },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: IpBusiness },
  { name: 'Workspaces',    href: '/workspaces',     icon: IpTeam,         isWorkspaceNav: true },
  { name: 'Refer & Earn',  href: '/billing?tab=referral', icon: IpGift },
  { name: 'Billing',       href: '/billing',        icon: IpBilling },
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
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [hasToken, setHasToken] = useState(false);
  const [wsData, setWsData] = useState(null);
  const [myMemberships, setMyMemberships] = useState([]);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [switchingWs, setSwitchingWs] = useState(null);
  const [impersonatingAs, setImpersonatingAs] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // ── Nav hover prefetch ───────────────────────────────────────────────────────
  // Each route is prefetched at most once per session (tracked in a Set).
  // Fires when the cursor enters the nav link — by the time the user clicks,
  // the data is already cached and the destination page loads instantly.
  const _prefetched = useRef(new Set());
  const handleNavHover = useCallback((href) => {
    if (_prefetched.current.has(href)) return;
    _prefetched.current.add(href);
    switch (href) {
      case '/dashboard':
        postsAPI.getAll({ limit: 100 }).catch(() => {});
        intelligenceAPI.getMetrics().catch(() => {});
        intelligenceAPI.getBriefing().catch(() => {});
        break;
      case '/calendar':
      case '/history':
        postsAPI.getAll({ limit: 200 }).catch(() => {});
        break;
      case '/analytics':
        analyticsAPI.getOverview().catch(() => {});
        break;
      case '/billing':
        billingAPI.getCurrent().catch(() => {});
        break;
      case '/geo-audit':
        geoAPI.getLatest().catch(() => {});
        geoAPI.getHistory().catch(() => {});
        break;
      case '/knowledge-base':
        knowledgeAPI.list().catch(() => {});
        break;
      case '/settings':
        customerAPI.getProfile().catch(() => {});
        customerAPI.getSocialAccounts().catch(() => {});
        break;
      case '/media':
        mediaAPI.getQuota().catch(() => {});
        break;
      default:
        break;
    }
  }, []);

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
        const [dmsResult, suggResult, wsResult, membershipsResult, approvalResult] = await Promise.allSettled([
          dmsAPI.getStats(),
          suggestionsAPI.getCount(),
          workspacesAPI.list(),
          workspacesAPI.myMemberships(),
          postsAPI.getPendingApproval(),
        ]);
        if (dmsResult.status === 'fulfilled') setDmUnread(dmsResult.value.data?.unreadCount || 0);
        if (suggResult.status === 'fulfilled') setUnseenSugg(suggResult.value.data?.count || 0);
        if (wsResult.status === 'fulfilled' && wsResult.value.data) setWsData(wsResult.value.data);
        if (membershipsResult.status === 'fulfilled') setMyMemberships(membershipsResult.value.data?.memberships || []);
        if (approvalResult.status === 'fulfilled') setPendingApprovals(Array.isArray(approvalResult.value.data) ? approvalResult.value.data.length : 0);
        // Load pending service requests count for admin badge (non-fatal)
        adminAPI.getServiceRequestsCount().then(r => setPendingRequestsCount(r.data?.count || 0)).catch(() => {});
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
  const { appName, aiName } = useBranding();

  // Always show Workspaces nav — members need it to manage their memberships
  const baseNavItems = NAV_ITEMS;

  // Nav items + agency section (agency plan owners) + admin section (platform admins)
  const isAgency = user?.plan === 'agency' && !user?.parent_customer_id && !user?.is_member;
  const withAgency = isAgency
    ? [
        ...baseNavItems,
        { isDivider: true, label: 'Agency' },
        { name: 'Agency Overview', href: '/agency',         icon: IpSparkle,  isAgency: true },
        { name: 'Clients',         href: '/agency/clients', icon: IpTeam,     isAgency: true },
        { name: 'Client Plans',    href: '/agency/plans',   icon: IpBilling,  isAgency: true },
        { name: 'Branding',        href: '/settings?tab=white-label', icon: IpSettings, isAgency: true },
      ]
    : baseNavItems;

  const navItems = user?.is_admin
    ? [
        ...withAgency,
        { isDivider: true, label: 'Admin' },
        { name: 'Admin Portal',    href: '/admin',             icon: IpAdmin,       isAdmin: true },
        { name: 'Customers',       href: '/admin/customers',   icon: IpTeam,        isAdmin: true },
        { name: 'Requests',        href: '/admin/requests',    icon: IpComment,     isAdmin: true, badge: pendingRequestsCount > 0 ? pendingRequestsCount : null },
        { name: 'Post Moderation', href: '/admin/posts',       icon: IpDrafts,      isAdmin: true },
        { name: 'Referrals',       href: '/admin/referrals',   icon: IpAnalytics,   isAdmin: true },
        { name: 'Broadcast',       href: '/admin/broadcast',   icon: IpMail,        isAdmin: true },
        { name: 'Email Queue',     href: '/admin/email-queue', icon: IpMail,        isAdmin: true },
        { name: 'Audit Log',       href: '/admin/audit',       icon: IpAdmin,       isAdmin: true },
        { name: 'Templates',       href: '/admin/templates',   icon: IpPhotoStudio, isAdmin: true },
        { name: `${aiName} Brain`, href: '/admin/llm',         icon: IpSparkle,     isAdmin: true },
      ]
    : withAgency;

  // Permission filter for sub-accounts (Type A) and invited members (Type B)
  const isSubAccount = !!user?.parent_customer_id;
  const isMember = !!user?.is_member;
  const effectivePerms = (isSubAccount || isMember)
    ? (user.workspace_permissions || ROLE_PERMISSIONS[user.workspace_role || 'editor'])
    : null;
  const featureFlags = user?.feature_flags || null;
  const visibleNavItems = navItems.filter(item => {
    if (item.isDivider || !item.href) return true;
    // Agency feature flags (for sub-accounts under agency plans)
    if (featureFlags && item.featureKey && featureFlags[item.featureKey] === false) return false;
    // Workspace role permissions (for sub-accounts and members)
    if (effectivePerms) {
      const mod = Object.entries(MODULE_ROUTES).find(([, hrefs]) => hrefs.includes(item.href))?.[0];
      if (!mod) return true;
      if (mod === 'billing') return false;
      return effectivePerms[mod] !== false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.text }}>
      <Head>
        <title>{title ? `${title} — ${appName}` : appName}</title>
      </Head>
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
            ) : wlConfig.agencyName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: wlPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {wlConfig.agencyName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {wlConfig.agencyName}
                </span>
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
              {(() => {
                const activeMem = user?.is_member ? myMemberships.find(m => m.workspace_id === user.workspace_id) : null;
                const displayName = activeMem ? (activeMem.workspace_display_name || activeMem.business_name) : (user.business_name || 'Workspace');
                const displaySub = activeMem ? `by ${activeMem.owner_business_name}` : (wsData?.mainAccount && wsData.mainAccount.id !== user.id ? 'Workspace' : (user.industry || 'Main account'));
                const displayAvatar = activeMem ? (activeMem.favicon_url || activeMem.logo_url) : (user.favicon_url || user.logo_url);
                return (
                  <>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {displayAvatar
                        ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{displaySub}</div>
                    </div>
                  </>
                );
              })()}
              <IpChevronsUpDown size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
            </div>

            {wsDropdownOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% - 4px)', left: 12, right: 12,
                  background: t.card, border: `1px solid ${t.border}`, borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.16)', zIndex: 200, overflow: 'hidden',
                  maxHeight: 380, overflowY: 'auto',
                }}
              >
                {/* Close dropdown on outside click */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: -1 }}
                  onClick={() => setWsDropdownOpen(false)}
                />

                {/* ── When operating inside another owner's workspace (Type B member):
                     show "Back to my account" as the first row ── */}
                {user?.is_member && (
                  <>
                    <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      My Account
                    </div>
                    <button
                      onClick={() => { setWsDropdownOpen(false); switchToMain(); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 150ms' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #FB923C, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                        {(user.favicon_url || user.logo_url)
                          ? <img src={user.favicon_url || user.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (user.business_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.business_name || 'My Account'}</div>
                        <div style={{ fontSize: 10, color: t.textMuted }}>← Back to my account</div>
                      </div>
                      {switchingWs === 'main' && <span style={{ fontSize: 10, color: t.textMuted }}>Switching…</span>}
                    </button>
                    <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
                  </>
                )}

                {/* ── Own account hierarchy (only for non-member users) ── */}
                {!user?.is_member && (
                  <>
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
                          padding: '8px 10px',
                          background: wsData.mainAccount.id === user.id ? t.primaryBg : 'transparent',
                          border: 'none',
                          cursor: wsData.mainAccount.id === user.id ? 'default' : 'pointer',
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

                    {/* Child workspace rows */}
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
                  </>
                )}

                {/* ── For Type B members: show current workspace as non-clickable label ── */}
                {user?.is_member && (() => {
                  const activeMembership = myMemberships.find(m => m.workspace_id === user.workspace_id);
                  if (!activeMembership) return null;
                  return (
                    <>
                      <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
                      <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Currently viewing
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: t.primaryBg }}>
                        <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(activeMembership.business_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeMembership.workspace_display_name || activeMembership.business_name}</div>
                          <div style={{ fontSize: 10, color: t.textMuted }}>by {activeMembership.owner_business_name}</div>
                        </div>
                        <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>Active</span>
                      </div>
                    </>
                  );
                })()}

                {/* ── External memberships (shared accounts from other owners) ── */}
                {myMemberships.filter(m => !(user?.is_member && m.workspace_id === user.workspace_id)).length > 0 && (
                  <>
                    <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
                    <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Shared accounts
                    </div>
                    {myMemberships.filter(m => !(user?.is_member && m.workspace_id === user.workspace_id)).map((m) => {
                      const wsName = m.workspace_display_name || m.business_name;
                      const isActiveMembership = user?.workspace_id === m.workspace_id;
                      return (
                        <button
                          key={m.membership_id}
                          onClick={() => {
                            if (isActiveMembership) { setWsDropdownOpen(false); return; }
                            setWsDropdownOpen(false);
                            switchToWorkspace(m.workspace_id);
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', background: isActiveMembership ? t.primaryBg : 'transparent',
                            border: 'none', cursor: isActiveMembership ? 'default' : 'pointer',
                            borderRadius: 6, transition: 'background 150ms',
                          }}
                          onMouseEnter={(e) => { if (!isActiveMembership) e.currentTarget.style.background = t.cardHover; }}
                          onMouseLeave={(e) => { if (!isActiveMembership) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                            {(m.favicon_url || m.logo_url)
                              ? <img src={m.favicon_url || m.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : (wsName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wsName}</div>
                            <div style={{ fontSize: 10, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {m.owner_business_name}</div>
                          </div>
                          {isActiveMembership && <span style={{ fontSize: 10, color: t.primary, fontWeight: 700 }}>Active</span>}
                          {switchingWs === m.workspace_id && <span style={{ fontSize: 10, color: t.textMuted }}>Switching…</span>}
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Add workspace / Manage */}
                <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 8px 8px', display: 'flex', gap: 6 }}>
                  {!user?.is_member && wsData && wsData.workspaces && (wsData.workspaces.filter(w => w.status !== 'inactive').length + 1) < (wsData.planLimit || 1) && (
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
                gap: 8, padding: '13px 14px',
                background: `linear-gradient(135deg, ${wlPrimary} 0%, ${wlPrimary}e8 45%, #9B7FFF 100%)`,
                border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 14, color: '#fff',
                transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 180ms ease', cursor: 'pointer',
                boxShadow: `0 6px 24px ${wlPrimary}80, 0 1px 4px ${wlPrimary}59, inset 0 1px 0 rgba(255,255,255,0.22)`,
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 10px 32px ${wlPrimary}99, 0 2px 8px ${wlPrimary}66, inset 0 1px 0 rgba(255,255,255,0.28)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 6px 24px ${wlPrimary}80, 0 1px 4px ${wlPrimary}59, inset 0 1px 0 rgba(255,255,255,0.22)`;
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
                  background: active ? `${wlPrimary}12` : 'transparent',
                  borderLeft: active ? `2.5px solid ${wlPrimary}` : '2.5px solid transparent',
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
                  handleNavHover(item.href);
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
                    color={active
                      ? (wlConfig.primaryColor ? wlPrimary : 'url(#brand-gradient)')
                      : (item.isAdmin ? (wlConfig.primaryColor ? wlPrimary : 'url(#brand-gradient)') : t.textMuted)
                    }
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
                {item.badge != null && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: '#FB923C',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(251,146,60,0.45)',
                  }}>
                    {item.badge > 99 ? '99+' : item.badge}
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
            <div style={{ padding: '13px 14px', background: `${wlPrimary}17`, borderRadius: 12, border: `1px solid ${wlPrimary}38`, boxShadow: `0 4px 16px ${wlPrimary}1a, inset 0 1px 0 rgba(255,255,255,0.06)` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, letterSpacing: '-0.01em' }}>Free Trial</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: wlPrimary }}>{user.credits_balance ?? 0} {isSubAccount ? 'shared credits' : 'credits left'}</div>
              </div>
              <div style={{ height: 5, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((user.credits_balance ?? 0) / 10) * 100)}%`, background: `linear-gradient(90deg, ${wlPrimary}, ${wlPrimary}cc)`, borderRadius: 99, boxShadow: `0 0 6px ${wlPrimary}80`, transition: 'width 600ms ease' }} />
              </div>
              <Link href="/billing" className="btn-shimmer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 0', background: `linear-gradient(135deg, ${wlPrimary}, ${wlPrimary}cc)`, borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em', boxShadow: `0 2px 8px ${wlPrimary}59`, position: 'relative', overflow: 'hidden' }}>
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: wlPrimary }}>{user.credits_balance ?? 0} credits</span>
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
        {(wlConfig.agencyName || wlConfig.logo || wlConfig.primaryColor) && !wlConfig.hidePoweredBy && (
          <div style={{ padding: '8px 16px', flexShrink: 0, borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
            <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', opacity: 0.6 }}>
              Powered by <span style={{ fontWeight: 700, color: t.textMuted }}>ItsPosting</span>
            </div>
          </div>
        )}

      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : sidebarWidth, transition: 'margin-left 200ms ease', minWidth: 0, maxWidth: '100vw', overflowX: 'hidden' }}>
        {/* TOP BAR */}
        <header
          className="topbar-glass"
          style={{
            height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '0 16px' : '0 36px', position: 'sticky', top: 0, zIndex: 40,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {title && <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: t.text, letterSpacing: '-0.035em', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>}
            {subtitle && <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1, margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>}
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
              <Link href="/billing" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
                  background: `linear-gradient(135deg, ${wlPrimary}22, ${wlPrimary}10)`,
                  border: `1.5px solid ${wlPrimary}66`,
                  cursor: 'pointer', transition: 'all 140ms ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${wlPrimary}33, ${wlPrimary}18)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${wlPrimary}22, ${wlPrimary}10)`; e.currentTarget.style.transform = ''; }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={wlPrimary} style={{ flexShrink: 0 }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  <span style={{ color: wlPrimary, fontWeight: 600, fontSize: 12 }}>{isSubAccount ? 'Shared' : 'Credits'}</span>
                  <span style={{ color: wlPrimary, fontWeight: 800, fontFamily: 'monospace', fontSize: 15, letterSpacing: '-0.02em' }}>{user.credits_balance ?? 0}</span>
                </div>
              </Link>
            )}
            {!isMobile && action}
          </div>
        </header>

        {/* ACTION SUB-BAR — mobile only, shows page action buttons below the header */}
        {isMobile && action && (
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg, display: 'flex', gap: 8, alignItems: 'center', position: 'sticky', top: 64, zIndex: 39, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>{isSubAccount ? 'Shared:' : 'Credits:'}</span>
                <span style={{ color: wlPrimary, fontWeight: 700, fontFamily: 'monospace' }}>{user.credits_balance ?? 0}</span>
              </div>
            )}
            {action}
          </div>
        )}

        {/* ADMIN IMPERSONATION BANNER */}
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

        {/* AGENCY IMPERSONATION BANNER */}
        {!impersonatingAs && typeof window !== 'undefined' && localStorage.getItem('agency_backup_token') && (
          <div style={{
            background: '#0A84FF', color: '#fff', padding: '10px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 13, fontWeight: 600, position: 'sticky', top: 64, zIndex: 39,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IpWarning size={14} /> Agency view: {user?.business_name} — changes are live
            </span>
            <button
              onClick={() => {
                const backup = localStorage.getItem('agency_backup_token');
                if (backup) localStorage.setItem('token', backup);
                localStorage.removeItem('agency_backup_token');
                window.location.href = '/agency/clients';
              }}
              style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Exit to Agency
            </button>
          </div>
        )}

        {/* PAGE CONTENT */}
        <div
          key={router.pathname}
          className="page-fade-in"
          style={{
            padding: isMobile ? '20px 14px' : '40px 44px',
            paddingBottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : 48,
            minHeight: 'calc(100vh - 64px)',
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
            boxSizing: 'border-box',
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
