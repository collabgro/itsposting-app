import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IpSparkle, IpCheckCircle, IpWarning, IpCheck } from '../components/icons';
import { useTheme } from '../lib/theme';
import { inviteAPI } from '../lib/api';

const ROLE_META = {
  manager: { label: 'Manager',  color: '#7C5CFC' },
  editor:  { label: 'Editor',   color: '#3B82F6' },
  viewer:  { label: 'Viewer',   color: '#64748B' },
};

const ROLE_DEFAULTS = {
  manager: { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, reports:true, geo_audit:true, inbox:true, receptionist:true, contacts:true, knowledge_base:true, settings:true },
  editor:  { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, reports:false, geo_audit:false, inbox:true, receptionist:false, contacts:false, knowledge_base:false, settings:false },
  viewer:  { wizard:false, upload:false, calendar:true, history:true, media:false, studio:false, analytics:true, reports:true, geo_audit:false, inbox:false, receptionist:false, contacts:false, knowledge_base:false, settings:false },
};

const MODULE_LABELS = {
  wizard: 'Post Wizard', upload: 'Create & Upload', calendar: 'Calendar',
  history: 'History & Drafts', media: 'Media Library', studio: 'Photo Studio',
  analytics: 'Analytics', reports: 'Reports & ROI', geo_audit: 'GEO Audit',
  inbox: 'Inbox & DMs', receptionist: 'AI Receptionist', contacts: 'Contacts',
  knowledge_base: 'Teach PostCore', settings: 'Business Settings',
};

// page state machine:  loading | invalid | ready_new | ready_existing | submitting | success

export default function AcceptInvite() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pageState, setPageState] = useState('loading');
  const [invite, setInvite] = useState(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const token = router.query.token;
    if (!token) { setErrorMsg('No invite token found in this link.'); setPageState('invalid'); return; }

    inviteAPI.getInvite(token)
      .then(res => {
        setInvite(res.data.invite);
        setExistingAccount(res.data.existingAccount);
        setPageState(res.data.existingAccount ? 'ready_existing' : 'ready_new');
      })
      .catch(err => {
        setErrorMsg(err.response?.data?.error || 'This invite link is invalid or has expired.');
        setPageState('invalid');
      });
  }, [router.isReady]);

  async function handleAccept(e) {
    e.preventDefault();
    setFormError('');
    if (!password) { setFormError('Password is required'); return; }
    if (!existingAccount && password.length < 8) { setFormError('Password must be at least 8 characters'); return; }

    setPageState('submitting');
    try {
      const token = router.query.token;
      const { data } = await inviteAPI.acceptInvite(token, { password });
      localStorage.setItem('token', data.token);
      setPageState('success');
      setTimeout(() => router.push('/dashboard'), 1600);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Something went wrong. Please try again.');
      setPageState(existingAccount ? 'ready_existing' : 'ready_new');
    }
  }

  if (!mounted) return null;

  const effectivePerms = invite ? (invite.permissions || ROLE_DEFAULTS[invite.role || 'editor']) : {};
  const enabledModules = Object.entries(effectivePerms).filter(([, v]) => v).map(([k]) => MODULE_LABELS[k]).filter(Boolean);
  const roleMeta = invite ? ROLE_META[invite.role || 'editor'] : null;
  const daysLeft = invite ? Math.max(0, Math.ceil((new Date(invite.expiresAt || invite.expires_at) - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  const inputStyle = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: t.input, border: `1px solid ${t.border}`, borderRadius: 10,
    color: t.text, fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: t.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(124,92,252,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7C5CFC 0%, #5B3FF0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IpSparkle size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>ItsPosting</span>
        </div>

        {/* ── LOADING ── */}
        {pageState === 'loading' && (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <p style={{ color: t.textMuted, fontSize: 14 }}>Loading invite…</p>
          </div>
        )}

        {/* ── INVALID ── */}
        {pageState === 'invalid' && (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 36, textAlign: 'center' }}>
            <IpWarning size={36} color="#ef4444" style={{ marginBottom: 16 }} />
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: t.text }}>Invite not valid</h2>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: t.textMuted, lineHeight: 1.65 }}>{errorMsg}</p>
            <Link href="/login" style={{ display: 'inline-block', padding: '11px 24px', background: t.primary, borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Log in instead
            </Link>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {pageState === 'success' && (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 36, textAlign: 'center' }}>
            <IpCheckCircle size={40} color="#22c55e" style={{ marginBottom: 16 }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: t.text }}>You're in!</h2>
            <p style={{ margin: 0, fontSize: 14, color: t.textMuted }}>Taking you to the dashboard…</p>
          </div>
        )}

        {/* ── READY (new or existing user) ── */}
        {(pageState === 'ready_new' || pageState === 'ready_existing' || pageState === 'submitting') && invite && (
          <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Invite info banner */}
            <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.14) 0%, rgba(91,63,240,0.08) 100%)', borderBottom: `1px solid ${t.border}`, padding: '22px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(invite.inviterBusinessName || 'B').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>{invite.inviterBusinessName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: t.textMuted }}>
                    invited you to join as{' '}
                    <strong style={{ color: roleMeta?.color }}>{roleMeta?.label}</strong>
                  </p>
                </div>
              </div>

              {/* Module access preview */}
              {enabledModules.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>You'll have access to</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {enabledModules.map(label => (
                      <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <IpCheck size={9} color="#22c55e" /> {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiry notice */}
              {daysLeft !== null && (
                <p style={{ margin: '10px 0 0', fontSize: 11, color: daysLeft <= 1 ? '#D97706' : t.textMuted }}>
                  {daysLeft === 0
                    ? 'This invite expires today'
                    : `This invite expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                </p>
              )}
            </div>

            {/* Form */}
            <div style={{ padding: '26px 28px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: t.text }}>
                {existingAccount ? 'Log in to accept' : 'Create your account'}
              </h2>
              <p style={{ margin: '0 0 22px', fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
                {existingAccount
                  ? `Enter your password for ${invite.email} to accept the invitation.`
                  : 'Just set a password — no business details needed, you\'re joining as a team member.'}
              </p>

              <form onSubmit={handleAccept}>
                {/* Email — read-only, pre-filled from invite */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Email</label>
                  <input type="email" value={invite.email} readOnly
                    style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed', color: t.textSecondary }} />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>
                    {existingAccount ? 'Your password' : 'Choose a password'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={existingAccount ? 'Enter your password' : 'At least 8 characters'}
                      autoFocus
                      style={{ ...inputStyle, paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 11, fontWeight: 600, padding: 4 }}>
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {formError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#ef4444' }}>
                    <IpWarning size={14} /> {formError}
                  </div>
                )}

                <button type="submit" disabled={pageState === 'submitting' || !password}
                  style={{ width: '100%', padding: '13px 0', background: '#7C5CFC', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: pageState === 'submitting' || !password ? 'not-allowed' : 'pointer', opacity: pageState === 'submitting' || !password ? 0.6 : 1, marginBottom: 16 }}>
                  {pageState === 'submitting' ? 'Joining…' : existingAccount ? `Log in and accept invite` : `Join ${invite.inviterBusinessName}`}
                </button>

                <p style={{ margin: 0, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
                  {existingAccount ? (
                    <>Not you? <Link href="/signup" style={{ color: t.primary, textDecoration: 'none', fontWeight: 600 }}>Sign up with a different email</Link></>
                  ) : (
                    <>Already have an account? <Link href="/login" style={{ color: t.primary, textDecoration: 'none', fontWeight: 600 }}>Log in</Link></>
                  )}
                </p>
              </form>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: t.textMuted }}>
          &copy; {new Date().getFullYear()} ItsPosting · AI Social Media for Local Businesses
        </p>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
