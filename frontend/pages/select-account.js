import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import { useBranding } from '../lib/branding';
import { workspacesAPI } from '../lib/api';
import { IpSparkle, IpCheckCircle, IpWarning } from '../components/icons';

const ROLE_META = {
  manager: { label: 'Manager', color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)' },
  editor:  { label: 'Editor',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  viewer:  { label: 'Viewer',  color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
};

function InitialAvatar({ name, gradient, size = 44, fontSize = 18 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: gradient, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize, fontWeight: 700, color: '#fff',
      flexShrink: 0,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function SelectAccount() {
  const router = useRouter();
  const { t } = useTheme();
  const { appName, logo, primaryColor } = useBranding();
  const brandColor = primaryColor || '#7C5CFC';
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }

    workspacesAPI.accessible()
      .then(res => {
        const { ownAccount, ownWorkspaces = [], memberships = [] } = res.data;
        const totalAccounts = 1 + ownWorkspaces.length + memberships.length;
        if (totalAccounts <= 1) {
          // Only own account — go straight to dashboard
          router.replace('/dashboard');
          return;
        }
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        router.replace('/dashboard');
      });
  }, []);

  async function handleSelect(type, id) {
    if (switching) return;
    setSwitching(id);
    setError('');
    try {
      if (type === 'own_main') {
        // If in any workspace context, clear it; otherwise just go to dashboard
        try {
          const res = await workspacesAPI.switchToMain();
          localStorage.setItem('token', res.data.token);
        } catch {
          // Already on own main account — token is fine as-is
        }
        router.push('/dashboard');
      } else {
        // Own workspace or external membership — switch context
        const res = await workspacesAPI.switchTo(id);
        localStorage.setItem('token', res.data.token);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to switch account. Please try again.');
      setSwitching(null);
    }
  }

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IpSparkle size={20} color="#fff" />
          </div>
          <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #7C5CFC, #9B7FFF)', borderRadius: 8, animation: 'progress 1.4s ease-in-out infinite', width: '40%' }} />
          </div>
        </div>
        <style>{`@keyframes progress { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>
      </div>
    );
  }

  const { ownAccount, ownWorkspaces = [], memberships = [] } = data || {};

  return (
    <div style={{
      minHeight: '100vh', background: t.background,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(124,92,252,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32, justifyContent: 'center' }}>
          {logo ? (
            <img src={logo} alt={appName} style={{ height: 34, maxWidth: 160, objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IpSparkle size={19} color="#fff" />
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.025em' }}>{appName}</span>
            </>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: t.isDark ? '0 24px 80px rgba(0,0,0,0.45)' : '0 20px 60px rgba(0,0,0,0.12)',
        }}>

          {/* Header */}
          <div style={{ padding: '26px 28px 20px', borderBottom: `1px solid ${t.border}` }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
              Choose an account to continue
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: t.textMuted }}>
              Select which account you want to work in
            </p>
          </div>

          {/* Account list */}
          <div style={{ padding: '12px 10px', maxHeight: 440, overflowY: 'auto' }}>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 8px 12px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                <IpWarning size={14} /> {error}
              </div>
            )}

            {/* ── MY ACCOUNTS ── */}
            {(ownAccount || ownWorkspaces.length > 0) && (
              <>
                <div style={{ padding: '4px 10px 6px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  My Accounts
                </div>

                {/* Own main account */}
                {ownAccount && (
                  <AccountRow
                    key="own-main"
                    id="own-main"
                    type="own_main"
                    name={ownAccount.business_name}
                    subtitle={[ownAccount.industry?.replace(/_/g, ' '), ownAccount.location].filter(Boolean).join(' · ') || 'Main account'}
                    badge={{ label: 'Main', color: '#FB923C', bg: 'rgba(251,146,60,0.14)' }}
                    gradient="linear-gradient(135deg, #FB923C, #F97316)"
                    logoUrl={ownAccount.favicon_url || ownAccount.logo_url}
                    credits={ownAccount.credits_balance}
                    plan={ownAccount.plan}
                    switching={switching}
                    onSelect={handleSelect}
                    t={t}
                  />
                )}

                {/* Own child workspaces */}
                {ownWorkspaces.map((ws) => (
                  <AccountRow
                    key={ws.id}
                    id={ws.id}
                    type="workspace"
                    name={ws.workspace_display_name || ws.business_name}
                    subtitle={[ws.industry?.replace(/_/g, ' '), ws.location].filter(Boolean).join(' · ') || 'Workspace'}
                    badge={{ label: 'Workspace', color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)' }}
                    gradient="linear-gradient(135deg, #7C5CFC, #5B3FF0)"
                    logoUrl={ws.favicon_url || ws.logo_url}
                    switching={switching}
                    onSelect={handleSelect}
                    t={t}
                  />
                ))}
              </>
            )}

            {/* ── SHARED WITH ME ── */}
            {memberships.length > 0 && (
              <>
                <div style={{ padding: `${ownAccount || ownWorkspaces.length > 0 ? '16px' : '4px'} 10px 6px`, fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Shared with me
                </div>

                {memberships.map((m) => {
                  const rm = ROLE_META[m.role || 'editor'];
                  const wsName = m.workspace_display_name || m.business_name;
                  return (
                    <AccountRow
                      key={m.membership_id}
                      id={m.workspace_id}
                      type="membership"
                      name={wsName}
                      subtitle={`by ${m.owner_business_name}${m.industry ? ` · ${m.industry.replace(/_/g, ' ')}` : ''}`}
                      badge={{ label: rm.label, color: rm.color, bg: rm.bg }}
                      gradient="linear-gradient(135deg, #0EA5E9, #0284C7)"
                      logoUrl={m.favicon_url || m.logo_url}
                      switching={switching}
                      onSelect={handleSelect}
                      t={t}
                    />
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 28px', borderTop: `1px solid ${t.border}`, textAlign: 'center' }}>
            <button
              onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: t.textMuted, textDecoration: 'underline', padding: 0 }}
            >
              Sign in with a different account
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: t.textMuted }}>
          &copy; {new Date().getFullYear()} {appName}
        </p>
      </div>
    </div>
  );
}

function AccountRow({ id, type, name, subtitle, badge, gradient, logoUrl, credits, plan, switching, onSelect, t }) {
  const isActive = switching === id || (type === 'own_main' && switching === 'own-main');
  const isSwitching = isActive;

  return (
    <button
      onClick={() => onSelect(type, id)}
      disabled={!!switching}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 10px', borderRadius: 12, border: 'none',
        background: isSwitching ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : 'transparent',
        cursor: switching ? 'not-allowed' : 'pointer',
        textAlign: 'left', transition: 'background 130ms ease',
        opacity: switching && !isSwitching ? 0.5 : 1,
        marginBottom: 2,
      }}
      onMouseEnter={(e) => { if (!switching) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={(e) => { if (!isSwitching) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div style={{ width: 44, height: 44, borderRadius: 11, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (name || '?').charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            {name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: badge.bg, color: badge.color, flexShrink: 0 }}>
            {badge.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
          {credits != null && (
            <span style={{ color: t.primary, fontWeight: 600 }}>{` · ${credits} credits`}</span>
          )}
        </div>
      </div>

      {/* Right indicator */}
      <div style={{ flexShrink: 0, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isSwitching
          ? <span style={{ fontSize: 11, color: t.textMuted }}>…</span>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        }
      </div>
    </button>
  );
}

