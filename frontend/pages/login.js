import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { authAPI } from '../lib/api';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

const TESTIMONIALS = [
  {
    quote: "First post got 847 views on Google Business. I've never used social media before — PostCore just handled it.",
    name: 'Mike R.',
    biz: "Mike's Plumbing · Chicago, IL",
    result: '+847 views',
    color: '#3B82F6',
  },
  {
    quote: "Running promotions used to take me hours. Now I tap a few buttons and it writes everything — seasonal stuff too.",
    name: 'Sarah K.',
    biz: 'HVAC Solutions · Denver, CO',
    result: '40% more reviews',
    color: '#8B5CF6',
  },
  {
    quote: "We went from posting once a month to 3 times a week. Our phone hasn't stopped ringing since spring.",
    name: 'Carlos M.',
    biz: 'Roofer Pro · Austin, TX',
    result: '3× posting freq',
    color: '#10B981',
  },
  {
    quote: "I'm a plumber, not a marketer. PostCore knows what month it is and what to say. It's like having a full-time person.",
    name: 'Tom H.',
    biz: 'Hill Plumbing · Seattle, WA',
    result: '200 new followers',
    color: '#F59E0B',
  },
];

const PLATFORM_ICONS = [
  { label: 'Facebook',  color: '#1877F2', bg: 'rgba(24,119,242,0.12)', path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
  { label: 'Instagram', color: '#E1306C', bg: 'rgba(225,48,108,0.12)', path: null, ig: true },
  { label: 'Google',    color: '#4285F4', bg: 'rgba(66,133,244,0.12)', path: null, google: true },
  { label: 'LinkedIn',  color: '#0A66C2', bg: 'rgba(10,102,194,0.12)', path: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { label: 'TikTok',    color: '#010101', bg: 'rgba(255,255,255,0.08)', path: null, tiktok: true },
];

function PlatformPill({ plat }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 20,
      background: plat.bg, border: `1px solid ${plat.color}30`,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2">
        {plat.path && <path d={plat.path} stroke={plat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={plat.ig || plat.google || plat.tiktok ? 'none' : 'none'} />}
        {plat.ig && (
          <>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke={plat.color} strokeWidth="2" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke={plat.color} strokeWidth="2" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke={plat.color} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {plat.google && (
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={plat.color} />
        )}
        {plat.tiktok && (
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke={plat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color: plat.color, letterSpacing: '-0.01em' }}>{plat.label}</span>
    </div>
  );
}

function TestimonialSlider() {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState(1); // 1 = forward
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => advance(1), 4200);
    return () => clearInterval(timer.current);
  }, [idx]);

  function advance(direction) {
    if (animating) return;
    setAnimating(true);
    setDir(direction);
    setTimeout(() => {
      setIdx(i => (i + direction + TESTIMONIALS.length) % TESTIMONIALS.length);
      setAnimating(false);
    }, 320);
  }

  const t = TESTIMONIALS[idx];

  return (
    <div style={{ position: 'relative', minHeight: 160 }}>
      <div style={{
        opacity: animating ? 0 : 1,
        transform: animating ? `translateX(${dir > 0 ? '-24px' : '24px'})` : 'translateX(0)',
        transition: 'opacity 320ms ease, transform 320ms ease',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
          border: `1px solid ${t.color}30`, borderLeft: `3px solid ${t.color}`,
          borderRadius: 14, padding: '18px 20px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 14 }}>
            "{t.quote}"
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{t.biz}</div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: `${t.color}20`, border: `1px solid ${t.color}40`,
              fontSize: 11, fontWeight: 700, color: t.color,
            }}>
              {t.result}
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => { clearInterval(timer.current); setDir(i > idx ? 1 : -1); advance(i > idx ? 1 : -1); }}
            style={{
              width: i === idx ? 20 : 6, height: 6, borderRadius: 3, border: 'none',
              background: i === idx ? '#7C5CFC' : 'rgba(255,255,255,0.2)',
              cursor: 'pointer', padding: 0,
              transition: 'width 300ms cubic-bezier(0.34,1.56,0.64,1), background 200ms ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('token')) { router.replace('/dashboard'); return; }
    setTimeout(() => setVisible(true), 80);
    const check = () => setIsWide(window.innerWidth >= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(formData);
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setLoading(false);
    }
  };

  function iStyle(field) {
    return {
      width: '100%', padding: '12px 14px', boxSizing: 'border-box',
      background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : t.input,
      border: `1px solid ${focusedField === field ? 'rgba(124,92,252,0.6)' : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : t.borderStrong)}`,
      borderRadius: 10, color: t.text, fontSize: 14, outline: 'none',
      boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,252,0.15)' : 'none',
      transition: 'border-color 150ms, box-shadow 150ms',
    };
  }

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', display: 'flex',
      background: theme === 'dark' ? '#07070E' : t.bg,
      overflow: 'hidden',
    }}>
      {/* Global ambient */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 60% at 30% 0%, rgba(124,92,252,${theme==='dark'?'0.22':'0.10'}) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 80% 100%, rgba(0,196,204,${theme==='dark'?'0.10':'0.06'}) 0%, transparent 60%)`,
      }} />

      {/* LEFT PANEL — only on wide screens */}
      {isWide && (
        <div style={{
          width: '50%', minHeight: '100vh', position: 'relative', flexShrink: 0, zIndex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 52px',
          background: 'linear-gradient(160deg, rgba(12,6,30,0.98) 0%, rgba(8,4,22,0.98) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-32px)',
          transition: 'opacity 800ms cubic-bezier(0.16,1,0.3,1), transform 800ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Ambient orbs */}
          <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(124,92,252,0.18)', filter: 'blur(80px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,196,204,0.10)', filter: 'blur(60px)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44 }}>
            <ItsPostingLogo size="lg" variant="full" theme="dark" />
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
              Your business,<br />
              <span style={{ background: 'linear-gradient(90deg,#7C5CFC,#00C4CC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                posting on autopilot.
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, maxWidth: 340 }}>
              PostCore knows your trade, your season, and your city. First post in 60 seconds — no social media experience needed.
            </div>
          </div>

          {/* Testimonials */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 14 }}>
              What local businesses say
            </div>
            <TestimonialSlider />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 36 }}>
            {[
              { n: '1,200+', label: 'Businesses' },
              { n: '47,000+', label: 'Posts created' },
              { n: '60 sec', label: 'Avg. post time' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Platform pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 10 }}>
              Posts to all platforms
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATFORM_ICONS.map(p => <PlatformPill key={p.label} plat={p} />)}
            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL — form */}
      <div style={{
        flex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 700ms 100ms cubic-bezier(0.16,1,0.3,1), transform 700ms 100ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Logo (mobile only — wide screens show it in left panel) */}
          {!isWide && (
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
                <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', color: t.text }}>ItsPosting</div>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Your business, posting on autopilot.</div>
            </div>
          )}

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: '-0.035em', lineHeight: 1.15, marginBottom: 6 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 13, color: t.textMuted }}>
              Sign in to your account to continue
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: theme === 'dark' ? 'rgba(15,15,24,0.88)' : 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius: 20, padding: '32px 28px',
            boxShadow: theme === 'dark'
              ? '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 0 0 1px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
          }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', color: t.error,
                borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Email address
                </label>
                <input
                  type="email" required placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={iStyle('email')}
                />
              </div>

              <div style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Password
                  </label>
                  <Link href="/forgot-password" style={{ fontSize: 12, color: '#9B7FFF', textDecoration: 'none', fontWeight: 600 }}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password" required autoComplete="current-password" placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={iStyle('password')}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 7,
                  fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
                  background: loading ? t.textDisabled : 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                  border: 'none', borderRadius: 10, color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(124,92,252,0.45)',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,92,252,0.55)'; }}}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 24px rgba(124,92,252,0.45)'; }}
              >
                {loading
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Signing in…</>
                  : 'Sign in →'}
              </button>
            </form>

            {/* Trust line */}
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span style={{ fontSize: 11, color: t.textMuted }}>Bank-level security · No credit card required</span>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: t.textMuted }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: t.primary, fontWeight: 700 }}>Start free trial →</Link>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
