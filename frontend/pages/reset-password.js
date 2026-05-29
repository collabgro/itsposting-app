import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

export default function ResetPassword() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => setVisible(true), 80);
  }, []);

  useEffect(() => {
    if (router.isReady) {
      setToken(router.query.token || '');
    }
  }, [router.isReady, router.query.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (err.response?.status === 400) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else if (!err.response) {
        setError('Could not reach the server. Please check that the backend is running.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  function iStyle(field) {
    return {
      width: '100%', padding: '12px 14px', boxSizing: 'border-box',
      background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : t.input,
      border: `1px solid ${focusedField === field ? 'rgba(124,92,252,0.6)' : t.borderStrong}`,
      borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
      boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,252,0.12)' : 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
    };
  }

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh', position: 'relative',
      background: theme === 'dark' ? '#07070E' : t.bg,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 50% at 50% -5%, rgba(124,92,252,${theme === 'dark' ? '0.28' : '0.12'}) 0%, transparent 65%)`,
      }} />

      <div style={{
        position: 'relative', zIndex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Logo block */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', color: t.text }}>ItsPosting</div>
            <div style={{ fontSize: 14, color: t.textMuted, marginTop: 6, letterSpacing: '-0.01em' }}>
              Set a new password
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 16, padding: '32px 28px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.4)',
          }}>
            {/* No token in URL */}
            {!token && !loading ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🔗</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 10 }}>
                  Invalid reset link
                </div>
                <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                  This link is missing a reset token. Please request a new password reset link.
                </div>
                <Link href="/forgot-password" style={{
                  display: 'inline-block', padding: '11px 20px',
                  background: 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                  borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
                  textDecoration: 'none',
                  boxShadow: '0 4px 24px rgba(124,92,252,0.4)',
                }}>
                  Request new link →
                </Link>
              </div>
            ) : success ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 26,
                }}>
                  ✓
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: t.text, marginBottom: 10 }}>
                  Password updated
                </div>
                <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                  Your password has been changed successfully.
                </div>
                <Link href="/login" style={{
                  display: 'inline-block', padding: '11px 20px',
                  background: 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                  borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
                  textDecoration: 'none',
                  boxShadow: '0 4px 24px rgba(124,92,252,0.4)',
                }}>
                  Sign in now →
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{
                    padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', color: t.error,
                    borderRadius: 8, marginBottom: 20, fontSize: 13,
                  }}>
                    {error}{' '}
                    {error.includes('expired') || error.includes('invalid') ? (
                      <Link href="/forgot-password" style={{ color: '#9B7FFF', fontWeight: 600 }}>
                        Request a new one →
                      </Link>
                    ) : null}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      New password
                    </label>
                    <input
                      type="password" required autoComplete="new-password" placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onFocus={() => setFocusedField('new')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('new')}
                    />
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Confirm password
                    </label>
                    <input
                      type="password" required autoComplete="new-password" placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      style={iStyle('confirm')}
                    />
                  </div>

                  <button
                    type="submit" disabled={loading}
                    style={{
                      width: '100%', padding: '14px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                      background: loading ? t.textDisabled : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                      border: 'none', borderRadius: 10, color: '#fff',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 4px 24px rgba(124,92,252,0.4)',
                      transition: 'opacity 150ms, box-shadow 150ms',
                    }}
                  >
                    {loading ? 'Updating…' : 'Reset password →'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
            <Link href="/login" style={{ color: t.primary, fontWeight: 600 }}>← Back to login</Link>
          </p>

        </div>
      </div>
    </div>
  );
}

