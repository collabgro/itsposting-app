import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function ResetPassword() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setEntered(true), 60);
  }, []);

  useEffect(() => {
    if (router.isReady) setToken(router.query.token || '');
  }, [router.isReady, router.query.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      if (err.response?.status === 400) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else if (!err.response) {
        setError('Could not reach the server. Please try again.');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputBase = (field) => ({
    width: '100%',
    padding: '13px 44px 13px 16px',
    boxSizing: 'border-box',
    background: t.isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    border: `1.5px solid ${focused === field ? 'rgba(124,92,252,0.70)' : t.isDark ? 'rgba(255,255,255,0.09)' : t.border}`,
    borderRadius: 11,
    color: t.text,
    fontSize: 14,
    outline: 'none',
    letterSpacing: '-0.01em',
    boxShadow: focused === field ? '0 0 0 4px rgba(124,92,252,0.11)' : 'none',
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
  });

  const eyeBtn = (onClick, open) => ({
    btn: {
      position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', padding: 4, cursor: 'pointer',
      color: t.textMuted, display: 'flex', alignItems: 'center',
      borderRadius: 6, transition: 'color 150ms ease',
    },
  });

  if (!mounted) return null;

  const strengthColor = newPassword.length === 0 ? 'transparent'
    : newPassword.length < 8 ? '#FF453A'
    : newPassword.length < 12 ? '#FFD60A'
    : '#30D158';

  const strengthLabel = newPassword.length === 0 ? ''
    : newPassword.length < 8 ? 'Too short'
    : newPassword.length < 12 ? 'Good'
    : 'Strong';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      background: t.isDark ? '#040409' : '#F4F3FF',
      padding: '40px 24px',
      overflow: 'hidden',
    }}>
      {/* Ambient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: t.isDark
          ? 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(124,92,252,0.22) 0%, transparent 58%)'
          : 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(124,92,252,0.12) 0%, transparent 58%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 380,
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : 'translateY(14px)',
        transition: 'opacity 650ms cubic-bezier(0.16,1,0.3,1), transform 650ms cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
          <h1 style={{ margin: '14px 0 6px', fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.04em' }}>
            Set new password
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: t.textMuted, letterSpacing: '-0.01em' }}>
            Choose a strong password for your account
          </p>
        </div>

        {/* No token */}
        {!token && !loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: t.text, marginBottom: 10 }}>
              Invalid reset link
            </div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 28, lineHeight: 1.65 }}>
              This link is missing a reset token. Please request a new password reset link.
            </div>
            <Link href="/forgot-password" style={{
              display: 'inline-block', padding: '12px 22px',
              background: 'linear-gradient(135deg, #7C5CFC 0%, #9472FF 100%)',
              borderRadius: 11, color: '#fff', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', letterSpacing: '-0.01em',
              boxShadow: '0 4px 24px rgba(124,92,252,0.38)',
            }}>
              Request reset link →
            </Link>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(48,209,88,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: t.text, marginBottom: 10, letterSpacing: '-0.03em' }}>
              Password updated
            </div>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 28, lineHeight: 1.65 }}>
              Your password has been changed. You can now sign in with your new password.
            </div>
            <Link href="/login" style={{
              display: 'inline-block', padding: '12px 28px',
              background: 'linear-gradient(135deg, #7C5CFC 0%, #9472FF 100%)',
              borderRadius: 11, color: '#fff', fontWeight: 700, fontSize: 14,
              textDecoration: 'none', letterSpacing: '-0.01em',
              boxShadow: '0 4px 24px rgba(124,92,252,0.38)',
            }}>
              Sign in →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 9,
                padding: '11px 14px', marginBottom: 22,
                background: t.errorBg,
                border: `1px solid ${t.errorBorder}`,
                borderRadius: 10, fontSize: 13, color: t.error,
                lineHeight: 1.55,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  {error}
                  {(error.includes('expired') || error.includes('invalid')) && (
                    <> <Link href="/forgot-password" style={{ color: t.primary, fontWeight: 700, textDecoration: 'none' }}>Request a new one →</Link></>
                  )}
                </span>
              </div>
            )}

            {/* New password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: '-0.01em', marginBottom: 7 }}>
                New password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onFocus={() => setFocused('new')}
                  onBlur={() => setFocused(null)}
                  style={inputBase('new')}
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowNew(v => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                    color: t.textMuted, display: 'flex', alignItems: 'center', borderRadius: 6,
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = t.text}
                  onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
              {/* Strength bar */}
              {newPassword.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: t.isDark ? 'rgba(255,255,255,0.08)' : t.border, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: strengthColor,
                      width: newPassword.length < 8 ? '33%' : newPassword.length < 12 ? '66%' : '100%',
                      transition: 'width 300ms ease, background 300ms ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor, minWidth: 40 }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: '-0.01em', marginBottom: 7 }}>
                Confirm password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                  style={{
                    ...inputBase('confirm'),
                    borderColor: confirmPassword && confirmPassword !== newPassword
                      ? 'rgba(255,69,58,0.60)'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'rgba(48,209,88,0.60)'
                      : inputBase('confirm').border,
                  }}
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                    color: t.textMuted, display: 'flex', alignItems: 'center', borderRadius: 6,
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = t.text}
                  onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <div style={{ marginTop: 7, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: confirmPassword === newPassword ? '#30D158' : t.error }}>
                  {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                background: loading
                  ? (t.isDark ? 'rgba(255,255,255,0.07)' : '#E5E5EF')
                  : 'linear-gradient(135deg, #7C5CFC 0%, #9472FF 100%)',
                border: 'none', borderRadius: 11,
                color: loading ? t.textDisabled : '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 30px rgba(124,92,252,0.38)',
                transition: 'transform 180ms ease, box-shadow 180ms ease',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(124,92,252,0.50)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 30px rgba(124,92,252,0.38)'; }}
            >
              {loading ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                  </svg>
                  Updating…
                </>
              ) : 'Set new password'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13.5, color: t.textMuted, letterSpacing: '-0.01em' }}>
          <Link href="/login" style={{ color: t.primary, fontWeight: 600, textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 100px ${t.isDark ? '#0A0A16' : '#ffffff'} inset !important;
          -webkit-text-fill-color: ${t.text} !important;
          caret-color: ${t.text};
        }
      `}</style>
    </div>
  );
}
