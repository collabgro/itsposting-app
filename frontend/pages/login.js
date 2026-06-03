import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI, publicAPI } from '../lib/api';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

const QUOTES = [
  {
    text: "First post got 847 views on Google Business. I'd never touched social media before — the AI just handled it.",
    name: 'Mike R.',
    biz: "Mike's Plumbing · Chicago, IL",
    accent: '#9472FF',
  },
  {
    text: "Running seasonal promotions used to take me hours. Now I tap three buttons and it's done.",
    name: 'Sarah K.',
    biz: 'HVAC Solutions · Denver, CO',
    accent: '#2DD4BF',
  },
  {
    text: "We went from posting once a month to three times a week. Our phone hasn't stopped ringing since spring.",
    name: 'Carlos M.',
    biz: 'Roofer Pro · Austin, TX',
    accent: '#30D158',
  },
  {
    text: "I'm a plumber, not a marketer. It knows what month it is and exactly what to say.",
    name: 'Tom H.',
    biz: 'Hill Plumbing · Seattle, WA',
    accent: '#FBBF24',
  },
];

function QuoteCycler() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 350);
    }, 5200);
    return () => clearInterval(t);
  }, []);

  const q = QUOTES[idx];

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 350ms ease, transform 350ms ease',
    }}>
      {/* Accent line */}
      <div style={{
        width: 28, height: 2, borderRadius: 2,
        background: q.accent,
        marginBottom: 20,
        transition: 'background 350ms ease',
      }} />
      <p style={{
        fontSize: 15.5,
        lineHeight: 1.7,
        color: 'rgba(255,255,255,0.72)',
        fontStyle: 'italic',
        letterSpacing: '-0.015em',
        margin: '0 0 20px',
      }}>
        &ldquo;{q.text}&rdquo;
      </p>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.01em' }}>
        {q.name}{' '}
        <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.22)' }}>· {q.biz}</span>
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [agencyBranding, setAgencyBranding] = useState(null);
  // OTP step
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('token')) { router.replace('/dashboard'); return; }
    setTimeout(() => setEntered(true), 60);
    const onResize = () => setIsWide(window.innerWidth >= 920);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Detect agency branding: check ?a=handle URL param first, then hostname
  useEffect(() => {
    if (!router.isReady) return;
    const handle = router.query.a;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const params = handle ? { handle } : { domain: hostname };
    publicAPI.getAgencyBranding(params)
      .then(res => { if (res.data?.agencyName || res.data?.logo) setAgencyBranding(res.data); })
      .catch(() => {}); // Silently fail — fallback to ItsPosting branding
  }, [router.isReady]);

  // Resend countdown tick
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-submit when all 6 OTP digits are filled (avoids stale-closure issue)
  useEffect(() => {
    if (step === 'otp' && otpDigits.join('').length === 6 && !loading) {
      handleOtpSubmit(otpDigits.join(''));
    }
  }, [otpDigits]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(formData);
      if (data.requiresOtp) {
        setMaskedEmail(data.maskedEmail);
        setStep('otp');
        setResendCooldown(60);
        setLoading(false);
        return;
      }
      // Fallback if OTP is ever bypassed server-side
      localStorage.setItem('token', data.token);
      router.push('/select-account');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleOtpSubmit = useCallback(async (codeOverride) => {
    const otp = codeOverride !== undefined ? codeOverride : otpDigits.join('');
    if (otp.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.verifyOtp({ email: formData.email, otp });
      localStorage.setItem('token', data.token);
      router.push('/select-account');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      setLoading(false);
    }
  }, [formData.email, otpDigits, router]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      await authAPI.resendOtp({ email: formData.email });
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleOtpChange = (i, rawVal) => {
    const val = rawVal.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[i] = val;
    setOtpDigits(next);
    if (val && i < 5) {
      setTimeout(() => otpRefs.current[i + 1]?.focus(), 0);
    }
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''].map((_, j) => pasted[j] || '');
    setOtpDigits(next);
    const filled = pasted.length;
    setTimeout(() => {
      if (filled < 6) otpRefs.current[filled]?.focus();
    }, 0);
  };

  // Agency-aware accent color — falls back to ItsPosting purple
  const brandColor = agencyBranding?.primaryColor || '#7C5CFC';
  const brandName  = agencyBranding?.agencyName   || 'ItsPosting';
  const brandLogo  = agencyBranding?.logo          || null;
  const isWhiteLabeled = !!agencyBranding;

  const inputBase = (field) => ({
    width: '100%',
    padding: '13px 16px',
    boxSizing: 'border-box',
    background: t.isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    border: `1.5px solid ${
      focused === field
        ? `${brandColor}b3`
        : t.isDark ? 'rgba(255,255,255,0.09)' : t.border
    }`,
    borderRadius: 11,
    color: t.text,
    fontSize: 14,
    outline: 'none',
    letterSpacing: '-0.01em',
    boxShadow: focused === field ? `0 0 0 4px ${brandColor}1c` : 'none',
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
  });

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      position: 'relative',
      background: t.isDark ? '#040409' : '#F4F3FF',
      overflow: 'hidden',
    }}>

      {/* Page-level ambient glow — uses agency brand color */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: t.isDark
          ? `radial-gradient(ellipse 65% 55% at 20% -8%, ${brandColor}38 0%, transparent 55%), radial-gradient(ellipse 45% 45% at 80% 110%, rgba(0,196,204,0.08) 0%, transparent 55%)`
          : `radial-gradient(ellipse 65% 55% at 20% -8%, ${brandColor}1c 0%, transparent 55%)`,
      }} />

      {/* ─── LEFT PANEL ─── */}
      {isWide && (
        <div style={{
          width: '46%',
          minHeight: '100vh',
          flexShrink: 0,
          background: '#02020A',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 56px',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateX(-18px)',
          transition: 'opacity 800ms cubic-bezier(0.16,1,0.3,1), transform 800ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Ambient orbs — use agency brand color when white-labeled */}
          <div style={{
            position: 'absolute', top: -110, left: -90,
            width: 420, height: 420, borderRadius: '50%',
            background: `${brandColor}21`, filter: 'blur(100px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -70, right: -70,
            width: 280, height: 280, borderRadius: '50%',
            background: 'rgba(0,196,204,0.07)', filter: 'blur(80px)', pointerEvents: 'none',
          }} />

          {/* Logo — agency branded or ItsPosting default */}
          <div>
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} style={{ height: 32, maxWidth: 180, objectFit: 'contain' }} />
            ) : isWhiteLabeled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>
                  {brandName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{brandName}</span>
              </div>
            ) : (
              <ItsPostingLogo size="sm" variant="full" theme="dark" />
            )}
          </div>

          {/* Main content block — vertically centered */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', paddingTop: 32, paddingBottom: 32,
          }}>
            {/* Overline */}
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 22,
            }}>
              AI-Powered Social Media
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: 50,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-0.058em',
              lineHeight: 1.0,
              margin: '0 0 18px',
            }}>
              Your business,<br />
              <span style={{
                background: 'linear-gradient(128deg, #C4B5FD 0%, #7C5CFC 42%, #2DD4BF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                on autopilot.
              </span>
            </h2>

            {/* Subtitle — hide PostCore reference for white-labeled agencies */}
            {!isWhiteLabeled && (
              <p style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.65,
                margin: '0 0 52px',
                maxWidth: 300,
                letterSpacing: '-0.015em',
              }}>
                ItsPosting AI knows your trade, your season, and your city.
                First post in 60 seconds — no marketing experience needed.
              </p>
            )}
            {isWhiteLabeled && (
              <p style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.65,
                margin: '0 0 52px',
                maxWidth: 300,
                letterSpacing: '-0.015em',
              }}>
                AI-powered social media for local businesses.
                Post in seconds — no marketing experience needed.
              </p>
            )}

            {/* Quote */}
            <QuoteCycler />
          </div>

          {/* Bottom strip */}
          <div style={{
            paddingTop: 26,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.16)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}>
            1,200+ businesses &nbsp;·&nbsp; 47,000+ posts created
          </div>
        </div>
      )}

      {/* ─── RIGHT PANEL — FORM ─── */}
      <div style={{
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateY(14px)',
          transition: 'opacity 650ms 90ms cubic-bezier(0.16,1,0.3,1), transform 650ms 90ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Mobile — logo icon + tagline */}
          {!isWide && (
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              {brandLogo ? (
                <img src={brandLogo} alt={brandName} style={{ height: 40, maxWidth: 200, objectFit: 'contain' }} />
              ) : isWhiteLabeled ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>
                    {brandName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>{brandName}</span>
                </div>
              ) : (
                <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
              )}
              <p style={{ margin: '14px 0 0', fontSize: 13, color: t.textMuted, letterSpacing: '-0.01em' }}>
                Your business, on autopilot.
              </p>
            </div>
          )}

          {step === 'otp' ? (
            /* ─── OTP STEP ─── */
            <div>
              {/* Icon + heading */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: `linear-gradient(135deg, ${brandColor}28, ${brandColor}10)`,
                  border: `1px solid ${brandColor}30`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                  boxShadow: `0 0 0 8px ${brandColor}08`,
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke={brandColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h1 style={{
                  fontSize: 28, fontWeight: 800, color: t.text,
                  letterSpacing: '-0.046em', lineHeight: 1.1, margin: '0 0 10px',
                }}>
                  Verify it&rsquo;s you
                </h1>
                <p style={{ fontSize: 14, color: t.textMuted, margin: 0, lineHeight: 1.6 }}>
                  We sent a 6-digit code to{' '}
                  <strong style={{ color: t.text, fontWeight: 700 }}>{maskedEmail}</strong>
                </p>
              </div>

              {/* Resend success */}
              {resendSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '11px 14px',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 10,
                  marginBottom: 14,
                  fontSize: 13,
                  color: '#22C55E',
                  letterSpacing: '-0.01em',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  New code sent — check your email for the latest code
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '11px 14px',
                  background: t.errorBg,
                  border: `1px solid ${t.errorBorder}`,
                  borderRadius: 10,
                  marginBottom: 22,
                  fontSize: 13,
                  color: t.error,
                  letterSpacing: '-0.01em',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* 6 digit boxes */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={1}
                    value={digit}
                    autoFocus={i === 0}
                    disabled={loading}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    style={{
                      width: 48, height: 58,
                      borderRadius: 12,
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      color: t.text,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
                      background: t.isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      border: `1.5px solid ${digit ? `${brandColor}c0` : t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`,
                      boxShadow: digit ? `0 0 0 4px ${brandColor}1c, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
                      outline: 'none',
                      cursor: loading ? 'not-allowed' : 'text',
                      transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      caretColor: brandColor,
                    }}
                  />
                ))}
              </div>

              {/* Verify button */}
              <button
                onClick={() => handleOtpSubmit()}
                disabled={loading || otpDigits.join('').length < 6}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  background: (loading || otpDigits.join('').length < 6)
                    ? (t.isDark ? 'rgba(255,255,255,0.07)' : '#E5E5EF')
                    : `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)`,
                  border: 'none',
                  borderRadius: 11,
                  color: (loading || otpDigits.join('').length < 6) ? t.textDisabled : '#fff',
                  cursor: (loading || otpDigits.join('').length < 6) ? 'not-allowed' : 'pointer',
                  boxShadow: (loading || otpDigits.join('').length < 6) ? 'none' : `0 4px 30px ${brandColor}61`,
                  transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease',
                }}
                onMouseEnter={e => {
                  if (!loading && otpDigits.join('').length === 6) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 8px 40px ${brandColor}80`;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = (loading || otpDigits.join('').length < 6) ? 'none' : `0 4px 30px ${brandColor}61`;
                }}
              >
                {loading ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                    </svg>
                    Verifying…
                  </>
                ) : (
                  'Verify Code'
                )}
              </button>

              {/* Resend row */}
              <div style={{ textAlign: 'center', marginTop: 22 }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>Didn&rsquo;t receive it?{' '}</span>
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: 13, color: t.textMuted }}>Resend in <strong style={{ color: t.text }}>{resendCooldown}s</strong></span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    style={{
                      background: 'none', border: 'none', cursor: resendLoading ? 'default' : 'pointer',
                      color: brandColor, fontWeight: 700, fontSize: 13, padding: 0,
                      opacity: resendLoading ? 0.6 : 1, textDecoration: 'underline',
                      textDecorationColor: `${brandColor}60`,
                    }}
                  >
                    {resendLoading ? 'Sending…' : 'Resend code'}
                  </button>
                )}
              </div>

              {/* Back to sign in */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => {
                    setStep('credentials');
                    setOtpDigits(['', '', '', '', '', '']);
                    setError('');
                    setResendCooldown(0);
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: t.textMuted, fontSize: 12.5, padding: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                  </svg>
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            /* ─── CREDENTIALS STEP ─── */
            <>
              {/* Heading */}
              <div style={{ marginBottom: 30 }}>
                <h1 style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: t.text,
                  letterSpacing: '-0.046em',
                  lineHeight: 1.1,
                  margin: '0 0 8px',
                }}>
                  Welcome back
                </h1>
                <p style={{
                  fontSize: 14,
                  color: t.textMuted,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  Sign in to continue to {brandName}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '11px 14px',
                  background: t.errorBg,
                  border: `1px solid ${t.errorBorder}`,
                  borderRadius: 10,
                  marginBottom: 22,
                  fontSize: 13,
                  color: t.error,
                  letterSpacing: '-0.01em',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.text,
                    letterSpacing: '-0.01em',
                    marginBottom: 7,
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    style={inputBase('email')}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.text,
                      letterSpacing: '-0.01em',
                    }}>
                      Password
                    </label>
                    <Link href="/forgot-password" style={{
                      fontSize: 12.5,
                      color: brandColor,
                      fontWeight: 600,
                      textDecoration: 'none',
                      letterSpacing: '-0.01em',
                    }}>
                      Forgot?
                    </Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      style={{ ...inputBase('password'), paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd(v => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute', right: 13, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', padding: 4,
                        cursor: 'pointer', color: t.textMuted,
                        display: 'flex', alignItems: 'center',
                        borderRadius: 6,
                        transition: 'color 150ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = t.text}
                      onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
                    >
                      {showPwd ? (
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
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    background: loading
                      ? (t.isDark ? 'rgba(255,255,255,0.07)' : '#E5E5EF')
                      : `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)`,
                    border: 'none',
                    borderRadius: 11,
                    color: loading ? t.textDisabled : '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : `0 4px 30px ${brandColor}61`,
                    transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease',
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = `0 8px 40px ${brandColor}80`;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = loading ? 'none' : `0 4px 30px ${brandColor}61`;
                  }}
                >
                  {loading ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              {/* Trust */}
              <div style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '-0.01em' }}>
                  Secure sign-in · No credit card required
                </span>
              </div>

              {/* Sign up link */}
              <p style={{
                textAlign: 'center',
                marginTop: 30,
                fontSize: 13.5,
                color: t.textMuted,
                letterSpacing: '-0.01em',
              }}>
                No account?{' '}
                <Link href="/signup" style={{
                  color: brandColor,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}>
                  Start free trial →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 100px ${t.isDark ? '#0A0A16' : '#ffffff'} inset !important;
          -webkit-text-fill-color: ${t.text} !important;
          caret-color: ${t.text};
        }
      `}</style>
    </div>
  );
}
