import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';
import { IpSparkle, IpCalendar, IpAnalytics } from '../components/icons';
import { ItsPostingLogo } from '../components/ItsPostingLogo';

const FEATURES = [
  {
    Icon: IpSparkle,
    iconBg: 'rgba(124,92,252,0.15)',
    iconColor: '#7C5CFC',
    title: 'AI-Written Posts',
    body: 'PostCore generates captions and images tailored to your trade and current season. Sounds genuinely like you, not a robot.',
  },
  {
    Icon: IpCalendar,
    iconBg: 'rgba(59,130,246,0.12)',
    iconColor: '#3B82F6',
    title: 'Auto-Schedule',
    body: 'Plan your whole week in one sitting. We post while you\'re on the job site.',
  },
  {
    Icon: IpAnalytics,
    iconBg: 'rgba(34,197,94,0.12)',
    iconColor: '#22C55E',
    title: 'Track Performance',
    body: 'See which posts drive calls and leads. Know what\'s working in plain language.',
  },
];

export default function Welcome() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const name = localStorage.getItem('ip_onboard_name') || '';
    setBusinessName(name);
    setTimeout(() => setVisible(true), 80);
  }, []);

  function go(path) {
    localStorage.removeItem('ip_onboard_name');
    router.push(path);
  }

  if (!mounted) return null;

  const displayName = businessName || 'your business';

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

      {/* Centered content */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '40px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 560,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Logo + welcome text */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <ItsPostingLogo size="xl" variant="icon" theme={t.isDark ? 'dark' : 'light'} />
            </div>

            <div style={{
              fontWeight: 800, fontSize: 34, letterSpacing: '-0.04em',
              color: t.text, lineHeight: 1.1, marginBottom: 10,
            }}>
              Welcome, {displayName}!
            </div>
            <div style={{ fontSize: 16, color: t.textMuted, letterSpacing: '-0.01em' }}>
              Your AI social media manager is ready.
            </div>
          </div>

          {/* Feature cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 36,
          }}>
            {FEATURES.map(({ Icon, iconBg, iconColor, title, body }) => (
              <div key={title} style={{
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 14, padding: '18px 14px',
                textAlign: 'center',
                boxShadow: theme === 'dark' ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                }}>
                  <Icon size={22} style={{ color: iconColor }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6, letterSpacing: '-0.01em' }}>
                  {title}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                  {body}
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
            <button
              onClick={() => go('/wizard?onboarding=true')}
              style={{
                width: '100%', padding: '14px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                background: 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)',
                border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(124,92,252,0.4)',
              }}
            >
              <IpSparkle size={16} />
              Create my first post
            </button>
            <button
              onClick={() => go('/dashboard')}
              style={{
                width: '100%', padding: '13px',
                fontSize: 14, fontWeight: 600,
                background: 'transparent',
                border: `1px solid ${t.border}`,
                borderRadius: 12, color: t.textSecondary,
                cursor: 'pointer', transition: 'border-color 150ms',
              }}
            >
              Explore the app →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

