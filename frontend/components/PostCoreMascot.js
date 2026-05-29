import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';

export function setMascotMood(mood, message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { mood, message } }));
  }
}
export function triggerMilestone(milestone) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { milestone } }));
  }
}

// ─── Mood definitions — coords for new 100×130 viewBox ───────────────────────
// Head center: (50, 44)  Eyes at y≈43  Brows at y≈28–32  Mouth at y≈63–70
const MOODS = {
  idle: {
    bodyAnim: 'pc3-float', armL: 'pc3-arm-idle-l', armR: 'pc3-arm-idle-r',
    eyeRy: 14, squint: false, showTeeth: false,
    browsL: 'M 24 30 Q 35 26 45 30', browsR: 'M 55 30 Q 65 26 76 30',
    mouth: 'M 35 65 Q 50 75 65 65',
    blush: true, sparkle: false,
    glow: 'rgba(108,60,240,0.30)',
    msg: "What are we posting today?",
  },
  happy: {
    bodyAnim: 'pc3-bounce-soft', armL: 'pc3-arm-idle-l', armR: 'pc3-arm-wave-r',
    eyeRy: 9, squint: true, showTeeth: false,
    browsL: 'M 24 27 Q 35 22 45 27', browsR: 'M 55 27 Q 65 22 76 27',
    mouth: 'M 30 63 Q 50 80 70 63',
    blush: true, sparkle: false,
    glow: 'rgba(124,92,252,0.42)',
    msg: "Looking great! Keep that streak going!",
  },
  thinking: {
    bodyAnim: 'pc3-float-slow', armL: 'pc3-arm-think', armR: 'pc3-arm-idle-r',
    eyeRy: 14, squint: false, showTeeth: false,
    browsL: 'M 24 27 Q 35 22 45 31', browsR: 'M 55 31 Q 65 22 76 27',
    mouth: 'M 37 66 Q 50 71 63 66',
    blush: false, sparkle: true,
    glow: 'rgba(99,102,241,0.24)',
    msg: "Working on something great for you...",
  },
  celebrating: {
    bodyAnim: 'pc3-bounce-big', armL: 'pc3-arm-cele-l', armR: 'pc3-arm-cele-r',
    eyeRy: 9, squint: true, showTeeth: true,
    browsL: 'M 24 24 Q 35 18 45 24', browsR: 'M 55 24 Q 65 18 76 24',
    mouth: 'M 28 61 Q 50 84 72 61',
    blush: true, sparkle: true,
    glow: 'rgba(124,92,252,0.60)',
    msg: "Yes! That's what I'm talking about! 🎉",
  },
  worried: {
    bodyAnim: 'pc3-wiggle', armL: 'pc3-arm-idle-l', armR: 'pc3-arm-idle-r',
    eyeRy: 13, squint: false, showTeeth: false,
    browsL: 'M 24 32 Q 35 27 45 30', browsR: 'M 55 30 Q 65 27 76 32',
    mouth: 'M 35 69 Q 50 62 65 69',
    blush: false, sparkle: false,
    glow: 'rgba(234,179,8,0.32)',
    msg: "Running low on credits — let's top up!",
  },
  sad: {
    bodyAnim: 'pc3-float-slow', armL: 'pc3-arm-idle-l', armR: 'pc3-arm-idle-r',
    eyeRy: 12, squint: false, showTeeth: false,
    browsL: 'M 24 33 Q 35 31 45 33', browsR: 'M 55 33 Q 65 31 76 33',
    mouth: 'M 35 71 Q 50 63 65 71',
    blush: false, sparkle: false,
    glow: 'rgba(79,47,214,0.12)',
    msg: "Out of credits. Tap to upgrade and keep going!",
  },
  excited: {
    bodyAnim: 'pc3-excited', armL: 'pc3-arm-wave-l', armR: 'pc3-arm-wave-r',
    eyeRy: 16, squint: false, showTeeth: true,
    browsL: 'M 24 22 Q 35 16 45 22', browsR: 'M 55 22 Q 65 16 76 22',
    mouth: 'M 26 60 Q 50 85 74 60',
    blush: true, sparkle: true,
    glow: 'rgba(124,92,252,0.52)',
    msg: "Let's make something amazing together!",
  },
  viral: {
    bodyAnim: 'pc3-pulse-zoom', armL: 'pc3-arm-cele-l', armR: 'pc3-arm-cele-r',
    eyeRy: 18, squint: true, showTeeth: true,
    browsL: 'M 20 20 Q 35 14 45 20', browsR: 'M 55 20 Q 65 14 80 20',
    mouth: 'M 22 57 Q 50 90 78 57',
    blush: true, sparkle: true,
    glow: 'rgba(251,191,36,0.72)',
    msg: "That post is on fire! Your community loves it! 🔥",
  },
  first_encouragement: {
    bodyAnim: 'pc3-bounce-soft', armL: 'pc3-arm-idle-l', armR: 'pc3-arm-wave-r',
    eyeRy: 15, squint: false, showTeeth: false,
    browsL: 'M 24 27 Q 35 22 45 27', browsR: 'M 55 27 Q 65 22 76 27',
    mouth: 'M 33 65 Q 50 76 67 65',
    blush: true, sparkle: false,
    glow: 'rgba(124,92,252,0.44)',
    msg: "Your first post is one tap away. Let's do it together!",
  },
};

const ROUTE_MOODS = {
  '/wizard':         'excited',
  '/quick-post':     'happy',
  '/analytics':      'happy',
  '/billing':        'worried',
  '/knowledge-base': 'thinking',
  '/studio':         'excited',
  '/geo-audit':      'thinking',
};

const SEASONAL_MSGS = {
  1:  "January — frozen pipe season. Your customers need you right now.",
  2:  "February is slower for most trades. A behind-the-scenes post builds trust.",
  3:  "Spring prep is starting. Post your spring services before competitors do.",
  4:  "April storm season. Homeowners are searching — show your availability.",
  5:  "May is peak season. Before/after photos perform best right now.",
  6:  "June — homeowners want fast, reliable. Show your turnaround times.",
  7:  "Summer heat. An AC tip or cooling post will stop scrollers in their tracks.",
  8:  "Back-to-school rush. Show how you fit around a busy schedule.",
  9:  "September — pre-winter prime time. Post heating and fall prep content now.",
  10: "October urgency works. Homeowners are rushing to beat the cold.",
  11: "November — last call for year-end jobs. A limited-availability post converts.",
  12: "December — year-end appreciation posts build loyalty for next year.",
};

const MILESTONE_MSGS = {
  first_post:  "Your first post! You're officially on the map. Keep it going! 🎉",
  streak_3:    "3-day posting streak! Consistency is what beats the algorithm.",
  streak_7:    "7-day streak! That's one full week — your audience will notice.",
  streak_30:   "30-day streak! You're in the top 1% of consistent posters. Incredible!",
  posts_10:    "10 posts this month! Your local reach is growing every single week.",
  posts_25:    "25 posts! PostCore is proud of you. Your business is showing up.",
  posts_50:    "50 posts! You've built a real content presence. Local customers see you.",
  posts_100:   "100 posts! That's a full year of showing up. Your community knows you.",
  viral_post:  "🔥 That post is on fire! Your community loves this content!",
};

// ─── Seasonal accessories (repositioned for new head at 50, 44) ───────────────
function SeasonalAccessory({ month }) {
  if (month === 12) return (
    <g>
      <path d="M 26 22 Q 36 10 45 4 Q 48 -1 51 4 Q 60 10 72 22 Z" fill="#DC2626" />
      <ellipse cx="50" cy="22" rx="24" ry="5" fill="white" />
      <circle cx="51" cy="4" r="6" fill="white" />
    </g>
  );
  if (month === 1 || month === 2) return (
    <g>
      <path d="M 28 22 Q 24 8 37 4 Q 50 0 63 4 Q 76 8 72 22 Z" fill="#3B82F6" />
      <ellipse cx="50" cy="22" rx="22" ry="5" fill="#1D4ED8" />
      <circle cx="50" cy="5" r="7" fill="#93C5FD" />
    </g>
  );
  if (month >= 3 && month <= 5) return (
    <g>
      <circle cx="50" cy="9" r="5" fill="#FCD34D" />
      <circle cx="39" cy="13" r="4" fill="#F472B6" />
      <circle cx="61" cy="13" r="4" fill="#F472B6" />
      <ellipse cx="34" cy="20" rx="4.5" ry="2.5" fill="#4ADE80" transform="rotate(-25 34 20)" />
      <ellipse cx="66" cy="20" rx="4.5" ry="2.5" fill="#4ADE80" transform="rotate(25 66 20)" />
    </g>
  );
  if (month >= 6 && month <= 8) return (
    <g>
      <rect x="21" y="37" width="24" height="15" rx="7.5" fill="#0F172A" opacity="0.92" />
      <rect x="55" y="37" width="24" height="15" rx="7.5" fill="#0F172A" opacity="0.92" />
      <rect x="45" y="41" width="10" height="6" rx="2" fill="#374151" />
      <path d="M 21 44 L 8 42" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <path d="M 79 44 L 92 42" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="29" cy="40" rx="6" ry="3.5" fill="rgba(99,179,237,0.14)" />
      <ellipse cx="67" cy="40" rx="6" ry="3.5" fill="rgba(99,179,237,0.14)" />
    </g>
  );
  if (month === 10) return (
    <g>
      <ellipse cx="50" cy="19" rx="22" ry="5" fill="#1F2937" />
      <path d="M 30 19 Q 37 10 43 4 Q 47 -2 50 0 Q 53 -2 57 4 Q 63 10 70 19 Z" fill="#111827" />
      <rect x="28" y="17" width="44" height="5" rx="2.5" fill="#7C5CFC" opacity="0.9" />
    </g>
  );
  return null;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const PC_CSS = `
@keyframes pc3-float {
  0%,100% { transform: translateY(0) rotate(-0.6deg); }
  35%     { transform: translateY(-6px) rotate(0.8deg); }
  70%     { transform: translateY(-3px) rotate(-0.3deg); }
}
@keyframes pc3-bounce-soft {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  35%     { transform: translateY(-9px) scaleX(0.95) scaleY(1.06); }
  65%     { transform: translateY(-3px) scaleX(1.02) scaleY(0.98); }
}
@keyframes pc3-bounce-big {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  10%     { transform: translateY(-4px) scaleX(1.06) scaleY(0.94); }
  28%     { transform: translateY(-22px) scaleX(0.88) scaleY(1.14); }
  50%     { transform: translateY(-12px) scaleX(0.94) scaleY(1.07); }
  68%     { transform: translateY(-20px) scaleX(0.90) scaleY(1.11); }
  85%     { transform: translateY(-4px) scaleX(1.04) scaleY(0.97); }
}
@keyframes pc3-excited {
  0%,100% { transform: translateY(0) rotate(0) scale(1); }
  20%     { transform: translateY(-14px) rotate(-4deg) scale(1.07); }
  45%     { transform: translateY(-7px) rotate(3.5deg) scale(1.04); }
  65%     { transform: translateY(-17px) rotate(-2.5deg) scale(1.09); }
  85%     { transform: translateY(-5px) rotate(2deg) scale(1.03); }
}
@keyframes pc3-wiggle {
  0%,100% { transform: rotate(0) translateX(0); }
  15%     { transform: rotate(-6.5deg) translateX(-5px); }
  42%     { transform: rotate(6.5deg) translateX(5px); }
  58%     { transform: rotate(-4deg) translateX(-3px); }
  78%     { transform: rotate(5deg) translateX(4px); }
}
@keyframes pc3-float-slow {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-4px); }
}
@keyframes pc3-pulse-zoom {
  0%,100% { transform: scale(1) rotate(0); }
  20%     { transform: scale(1.14) rotate(-4deg); }
  45%     { transform: scale(1.08) rotate(3deg); }
  65%     { transform: scale(1.16) rotate(-2deg); }
  85%     { transform: scale(1.07) rotate(2deg); }
}
/* Arms — pivot via transformOrigin */
@keyframes pc3-arm-idle-l {
  0%,100% { transform: rotate(8deg); }
  50%     { transform: rotate(13deg); }
}
@keyframes pc3-arm-idle-r {
  0%,100% { transform: rotate(-8deg); }
  50%     { transform: rotate(-13deg); }
}
@keyframes pc3-arm-wave-r {
  0%,100% { transform: rotate(-8deg); }
  22%     { transform: rotate(-64deg); }
  48%     { transform: rotate(-36deg); }
  72%     { transform: rotate(-70deg); }
}
@keyframes pc3-arm-wave-l {
  0%,100% { transform: rotate(8deg); }
  22%     { transform: rotate(64deg); }
  48%     { transform: rotate(36deg); }
  72%     { transform: rotate(70deg); }
}
@keyframes pc3-arm-cele-l {
  0%,100% { transform: rotate(-72deg); }
  50%     { transform: rotate(-84deg) translateX(-3px); }
}
@keyframes pc3-arm-cele-r {
  0%,100% { transform: rotate(72deg); }
  50%     { transform: rotate(84deg) translateX(3px); }
}
@keyframes pc3-arm-think {
  0%,100% { transform: rotate(-34deg); }
  50%     { transform: rotate(-38deg); }
}
/* Sparkles */
@keyframes pc3-star-a {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(28px,-34px) scale(1.4) rotate(400deg); }
}
@keyframes pc3-star-b {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  15%  { opacity:1; }
  100% { opacity:0; transform:translate(-26px,-38px) scale(1.1); }
}
@keyframes pc3-star-c {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  22%  { opacity:0.9; }
  100% { opacity:0; transform:translate(18px,-44px) scale(0.9) rotate(-320deg); }
}
@keyframes pc3-star-d {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(-30px,-28px) scale(0.85); }
}
@keyframes pc3-sweat {
  0%,100% { transform:translateY(0); opacity:0.8; }
  65%     { transform:translateY(10px); opacity:0.3; }
}
@keyframes pc3-tooltip-in {
  from { opacity:0; transform:translateY(-50%) translateX(-10px) scale(0.92); }
  to   { opacity:1; transform:translateY(-50%) translateX(0) scale(1); }
}
@keyframes pc3-click-ripple {
  0%   { transform:scale(0.7); opacity:0.85; }
  100% { transform:scale(2.2); opacity:0; }
}
@keyframes pc3-antenna-bob {
  0%,100% { transform: rotate(-4deg); }
  50%     { transform: rotate(6deg); }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────
export default function PostCoreMascot({ user, compact = false }) {
  const { t } = useTheme();
  const router = useRouter();
  const mascotRef = useRef(null);
  const lastMoveRef = useRef(Date.now());

  const [mood, setMood]           = useState('idle');
  const [visible, setVisible]     = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [blinking, setBlinking]   = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [clickFlash, setClickFlash] = useState(false);

  const month = new Date().getMonth() + 1;
  const applyMood = (m) => { if (MOODS[m]) setMood(m); };

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(t1);
  }, []);

  // Eye tracking
  useEffect(() => {
    const onMove = (e) => {
      lastMoveRef.current = Date.now();
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const hx = rect.left + rect.width * 0.5;
      const hy = rect.top + rect.height * 0.36;
      const dx = e.clientX - hx, dy = e.clientY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const MAX = 3.5;
      setEyeOffset(dist < 12 ? { x: 0, y: 0 } : {
        x: Math.max(-MAX, Math.min(MAX, (dx / dist) * MAX * Math.min(1, dist / 160))),
        y: Math.max(-MAX, Math.min(MAX, (dy / dist) * MAX * Math.min(1, dist / 160))),
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Idle look-around
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastMoveRef.current > 5000) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 2;
        setEyeOffset({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        setTimeout(() => {
          if (Date.now() - lastMoveRef.current > 5000) setEyeOffset({ x: 0, y: 0 });
        }, 800 + Math.random() * 1000);
      }
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(iv);
  }, []);

  // Blinking
  useEffect(() => {
    let timer;
    const doBlink = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); doBlink(); }, 140);
      }, 2500 + Math.random() * 3500);
    };
    doBlink();
    return () => clearTimeout(timer);
  }, []);

  // Route mood
  useEffect(() => {
    applyMood(ROUTE_MOODS[router.pathname] || 'idle');
    setCustomMsg('');
  }, [router.pathname]);

  // Credits mood
  useEffect(() => {
    const credits = user?.credits_balance ?? null;
    if (credits === null) return;
    if (credits === 0) applyMood('sad');
    else if (credits < 5) applyMood('worried');
  }, [user?.credits_balance]);

  // Seasonal + first-time
  useEffect(() => {
    if (router.pathname !== '/dashboard') return;
    const msg = SEASONAL_MSGS[month];
    if (user && !user.posting_streak && !user.total_posts_this_month) {
      const key = 'pc_first_show';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        const t1 = setTimeout(() => { applyMood('first_encouragement'); setCustomMsg(MOODS.first_encouragement.msg); }, 3000);
        const t2 = setTimeout(() => { applyMood('idle'); setCustomMsg(msg || ''); }, 10000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    }
    if (msg) setCustomMsg(msg);
    return () => setCustomMsg('');
  }, [router.pathname, user?.posting_streak, user?.total_posts_this_month]);

  // Streak milestones
  useEffect(() => {
    if (!user) return;
    const streak = user.posting_streak || 0;
    const total  = user.total_posts_this_month || 0;
    const key = `ms_${streak}_${total}`;
    if (sessionStorage.getItem(key)) return;
    let msg = null;
    if (streak === 30) msg = MILESTONE_MSGS.streak_30;
    else if (streak === 7) msg = MILESTONE_MSGS.streak_7;
    else if (streak === 3) msg = MILESTONE_MSGS.streak_3;
    if (msg) {
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        applyMood('celebrating'); setCustomMsg(msg);
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      }, 2000);
    }
  }, [user?.posting_streak]);

  // Post-count milestones
  useEffect(() => {
    if (!user) return;
    const total = user.total_posts_this_month || 0;
    if (total < 10) return;
    const key = `ms_posts_${total}`;
    if (sessionStorage.getItem(key)) return;
    let msg = total >= 50 ? MILESTONE_MSGS.posts_50 : total >= 25 ? MILESTONE_MSGS.posts_25 : MILESTONE_MSGS.posts_10;
    if (msg) {
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        applyMood('celebrating'); setCustomMsg(msg);
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      }, 1800);
    }
  }, [user?.total_posts_this_month]);

  // Event-based
  useEffect(() => {
    const handler = (e) => {
      const { mood: m, message, milestone } = e.detail || {};
      if (milestone && MILESTONE_MSGS[milestone]) {
        const msg = MILESTONE_MSGS[milestone];
        if (milestone === 'viral_post') {
          applyMood('viral'); setCustomMsg(msg);
          setTimeout(() => applyMood('celebrating'), 5000);
          setTimeout(() => applyMood('happy'), 8500);
          setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 12000);
          return;
        }
        applyMood('celebrating'); setCustomMsg(msg);
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
        return;
      }
      if (!m || !MOODS[m]) return;
      applyMood(m);
      if (message) setCustomMsg(message);
      if (['celebrating', 'excited'].includes(m)) {
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      } else if (m === 'happy') {
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 5500);
      }
    };
    window.addEventListener('postcoreMood', handler);
    return () => window.removeEventListener('postcoreMood', handler);
  }, []);

  const handleClick = () => {
    setClickFlash(true);
    setTimeout(() => setClickFlash(false), 500);
    applyMood('celebrating');
    setCustomMsg(MOODS.celebrating.msg);
    setTimeout(() => applyMood('happy'), 3000);
    setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 6000);
  };

  const m = MOODS[mood];
  const tooltipMsg = customMsg || m.msg;
  const ex = eyeOffset.x, ey = eyeOffset.y;

  // Eye geometry
  const eyeRy     = blinking ? 1 : m.eyeRy;
  const squintRy  = m.squint && !blinking ? m.eyeRy * 0.58 : eyeRy;
  const irisScale = blinking ? 0 : m.squint ? 0.7 : 1;

  const armDur = (anim) =>
    anim.includes('cele') ? '0.72s' : anim.includes('wave') ? '0.62s' :
    anim.includes('think') ? '2.8s' : '3.5s';

  const bodyDur = {
    'pc3-float': '3.5s', 'pc3-bounce-soft': '1.7s', 'pc3-bounce-big': '0.9s',
    'pc3-excited': '0.82s', 'pc3-wiggle': '0.55s', 'pc3-float-slow': '4.2s',
    'pc3-pulse-zoom': '0.60s',
  }[m.bodyAnim] || '3.5s';

  const armRAnim = hovered ? 'pc3-arm-wave-r' : m.armR;
  const charW = compact ? 48 : 88;
  const charH = compact ? 62 : 114;

  return (
    <div style={{
      ...(compact ? {} : {
        padding: '6px 0 4px',
        borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
      }),
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 900ms ease',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: PC_CSS }} />

      {/* Tooltip — to the right, never overlaps nav */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: 'calc(100% + 14px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 200,
          background: t.isDark ? 'rgba(8,6,20,0.97)' : 'rgba(255,255,255,0.98)',
          border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.38)' : 'rgba(124,92,252,0.28)'}`,
          borderRadius: 14,
          padding: '11px 14px',
          fontSize: 11.5,
          color: t.text,
          fontWeight: 500,
          lineHeight: 1.55,
          boxShadow: '0 14px 36px rgba(0,0,0,0.26)',
          zIndex: 400,
          animation: 'pc3-tooltip-in 200ms ease both',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          pointerEvents: 'none',
        }}>
          <span style={{ color: t.primary, fontWeight: 700, display: 'block', marginBottom: 3, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>PostCore</span>
          {tooltipMsg}
          <div style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)', width: 6, height: 10, overflow: 'hidden' }}>
            <div style={{ width: 10, height: 10, background: t.isDark ? 'rgba(8,6,20,0.97)' : 'rgba(255,255,255,0.98)', border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.38)' : 'rgba(124,92,252,0.28)'}`, transform: 'rotate(45deg) translateX(-5px)' }} />
          </div>
        </div>
      )}

      {/* Character container */}
      <div
        ref={mascotRef}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: charW, height: charH, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', position: 'relative' }}
      >
        {clickFlash && (
          <div style={{ position: 'absolute', top: '32%', left: '50%', width: 52, height: 52, marginLeft: -26, marginTop: -26, borderRadius: '50%', border: `2.5px solid ${t.primary}`, animation: 'pc3-click-ripple 0.55s ease-out both', pointerEvents: 'none', zIndex: 10 }} />
        )}

        <svg viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            {/* Head — warm sphere radial gradient */}
            <radialGradient id="pc3-hg" cx="36%" cy="28%" r="70%">
              <stop offset="0%"  stopColor="#D8B4FE" />
              <stop offset="30%" stopColor="#A855F7" />
              <stop offset="65%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#4C1D95" />
            </radialGradient>
            {/* Body gradient */}
            <radialGradient id="pc3-bodg" cx="42%" cy="22%" r="78%">
              <stop offset="0%"  stopColor="#C084FC" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#4C1D95" />
            </radialGradient>
            {/* Ear gradient */}
            <radialGradient id="pc3-eg" cx="58%" cy="34%" r="68%">
              <stop offset="0%"  stopColor="#C084FC" />
              <stop offset="100%" stopColor="#5B21B6" />
            </radialGradient>
            {/* Eye iris — bright cyan for maximum contrast against purple */}
            <radialGradient id="pc3-iris" cx="36%" cy="30%" r="65%">
              <stop offset="0%"  stopColor="#BAE6FD" />
              <stop offset="42%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#075985" />
            </radialGradient>
            {/* Ambient glow on head */}
            <radialGradient id="pc3-glow" cx="38%" cy="30%" r="60%">
              <stop offset="0%"  stopColor="rgba(216,180,254,0.28)" />
              <stop offset="100%" stopColor="rgba(124,58,237,0)" />
            </radialGradient>
          </defs>

          {/* ── Body animation wrapper ── */}
          <g style={{ animation: `${m.bodyAnim} ${bodyDur} ease-in-out infinite`, transformOrigin: '50px 65px' }}>

            {/* Ground shadow */}
            <ellipse cx="50" cy="128" rx="20" ry="3.5" fill="rgba(0,0,0,0.13)" />

            {/* ══ LEFT FOOT ══ */}
            <ellipse cx="30" cy="124" rx="13" ry="6" fill="#3B0F9E" />
            <ellipse cx="28" cy="122" rx="7" ry="3" fill="rgba(255,255,255,0.10)" />

            {/* ══ RIGHT FOOT ══ */}
            <ellipse cx="70" cy="124" rx="13" ry="6" fill="#3B0F9E" />
            <ellipse cx="68" cy="122" rx="7" ry="3" fill="rgba(255,255,255,0.10)" />

            {/* ══ LEFT LEG ══ */}
            <path d="M 36 110 C 34 116 30 120 28 122 C 32 126 38 126 38 120 C 38 116 38 112 36 110 Z" fill="#5B21B6" />

            {/* ══ RIGHT LEG ══ */}
            <path d="M 64 110 C 66 116 70 120 72 122 C 68 126 62 126 62 120 C 62 116 62 112 64 110 Z" fill="#5B21B6" />

            {/* ══ LEFT ARM (behind head+body) ══ */}
            <g style={{ transformBox: 'view-box', transformOrigin: '24px 86px', animation: `${m.armL} ${armDur(m.armL)} ease-in-out infinite` }}>
              {/* Arm — organic teardrop path */}
              <path d="M 24 86 C 16 90 10 100 10 112 C 10 122 16 128 22 124 C 26 120 22 110 24 100 C 26 94 26 90 24 86 Z"
                fill="url(#pc3-bodg)" />
              {/* Hand (round fist) */}
              <circle cx="16" cy="124" r="10" fill="#8B5CF6" />
              <ellipse cx="13" cy="119" rx="5" ry="3" fill="rgba(255,255,255,0.18)" />
            </g>

            {/* ══ RIGHT ARM (behind head+body) ══ */}
            <g style={{ transformBox: 'view-box', transformOrigin: '76px 86px', animation: `${armRAnim} ${armDur(armRAnim)} ease-in-out infinite` }}>
              <path d="M 76 86 C 84 90 90 100 90 112 C 90 122 84 128 78 124 C 74 120 78 110 76 100 C 74 94 74 90 76 86 Z"
                fill="url(#pc3-bodg)" />
              <circle cx="84" cy="124" r="10" fill="#8B5CF6" />
              <ellipse cx="81" cy="119" rx="5" ry="3" fill="rgba(255,255,255,0.18)" />
            </g>

            {/* ══ BODY ══ */}
            <path d="M 26 92 C 18 98 16 108 16 116 C 16 124 30 130 50 130 C 70 130 84 124 84 116 C 84 108 82 98 74 92 C 66 86 58 84 50 84 C 42 84 34 86 26 92 Z"
              fill="url(#pc3-bodg)" />

            {/* Body belly highlight (soft) */}
            <ellipse cx="50" cy="112" rx="20" ry="14" fill="#C084FC" opacity="0.22" />
            <ellipse cx="43" cy="106" rx="10" ry="6" fill="rgba(255,255,255,0.10)" transform="rotate(-10 43 106)" />

            {/* Body chest badge */}
            <rect x="41" y="96" width="18" height="13" rx="5.5" fill="rgba(255,255,255,0.11)" />
            <text x="50" y="106" textAnchor="middle" fill="rgba(255,255,255,0.68)" fontSize="6.5" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif">PC</text>

            {/* ══ LEFT EAR ══ */}
            <circle cx="15" cy="48" r="13" fill="url(#pc3-eg)" />
            <circle cx="14" cy="51" r="6.5" fill="rgba(196,132,252,0.30)" />
            <ellipse cx="12" cy="43" rx="5" ry="3.5" fill="rgba(255,255,255,0.15)" transform="rotate(-20 12 43)" />

            {/* ══ RIGHT EAR ══ */}
            <circle cx="85" cy="48" r="13" fill="url(#pc3-eg)" />
            <circle cx="86" cy="51" r="6.5" fill="rgba(196,132,252,0.30)" />
            <ellipse cx="82" cy="43" rx="5" ry="3.5" fill="rgba(255,255,255,0.15)" transform="rotate(20 82 43)" />

            {/* ══ ANTENNA ══ */}
            <g style={{ transformOrigin: '52px 22px', animation: 'pc3-antenna-bob 2.6s ease-in-out infinite' }}>
              <path d="M 50 10 Q 51 18 52 24" stroke="#6D28D9" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <circle cx="51" cy="8" r="7" fill="#F472B6" />
              <ellipse cx="49" cy="5.5" rx="2.8" ry="1.8" fill="rgba(255,255,255,0.65)" />
            </g>

            {/* ══ HEAD ══ */}
            <circle cx="50" cy="44" r="36" fill="url(#pc3-hg)" />
            {/* Ambient inner glow */}
            <circle cx="50" cy="44" r="36" fill="url(#pc3-glow)" />
            {/* Top-left specular highlight */}
            <ellipse cx="34" cy="25" rx="14" ry="8.5" fill="rgba(255,255,255,0.22)" transform="rotate(-22 34 25)" />
            {/* Secondary subtle shine */}
            <ellipse cx="60" cy="58" rx="8" ry="5" fill="rgba(124,58,237,0.28)" />

            {/* Seasonal accessory */}
            <SeasonalAccessory month={month} />

            {/* ══ SPARKLES ══ */}
            {m.sparkle && (<>
              <g style={{ transformOrigin: '80px 10px', animation: 'pc3-star-a 1.9s ease-in-out infinite' }}>
                <path d="M80 7 L81.5 9.5 L84 10 L82 12 L82.6 15 L80 13.6 L77.4 15 L78 12 L76 10 L78.5 9.5 Z" fill="#FCD34D" />
              </g>
              <g style={{ transformOrigin: '8px 22px', animation: 'pc3-star-b 2.4s ease-in-out infinite 0.3s' }}>
                <path d="M8 19 L9.4 21.5 L12 22 L10 24 L10.6 26.8 L8 25.4 L5.4 26.8 L6 24 L4 22 L6.6 21.5 Z" fill="#F0ABFC" />
              </g>
              <g style={{ transformOrigin: '84px 30px', animation: 'pc3-star-c 2.7s ease-in-out infinite 0.6s' }}>
                <circle cx="84" cy="30" r="4" fill="#A5F3FC" />
              </g>
              <g style={{ transformOrigin: '6px 50px', animation: 'pc3-star-d 2.1s ease-in-out infinite 0.9s' }}>
                <circle cx="6" cy="50" r="3" fill="#6EE7B7" />
              </g>
            </>)}

            {/* ══ BLUSH CHEEKS ══ */}
            {m.blush && (<>
              <ellipse cx="20" cy="56" rx="9" ry="5.5" fill="rgba(251,113,133,0.42)" />
              <ellipse cx="80" cy="56" rx="9" ry="5.5" fill="rgba(251,113,133,0.42)" />
            </>)}

            {/* ══ EYEBROWS ══ */}
            <path d={m.browsL} stroke="#2D0760" strokeWidth="3.8" strokeLinecap="round" fill="none" />
            <path d={m.browsR} stroke="#2D0760" strokeWidth="3.8" strokeLinecap="round" fill="none" />

            {/* ══ LEFT EYE — multi-layer Pixar style ══ */}
            {/* Outer shadow */}
            <ellipse cx="35" cy="45" rx="15" ry="16.5" fill="#1a0050" opacity="0.22" />
            {/* Sclera */}
            <ellipse cx="35" cy="43" rx="13.5" ry={squintRy} fill="white" />
            {/* Upper lid shadow overlay */}
            <ellipse cx="35" cy="32" rx="13.5" ry="8" fill="rgba(20,0,60,0.18)" />
            {/* Iris */}
            {!blinking && <circle cx={35 + ex} cy={43 + ey} r={9.5 * irisScale} fill="url(#pc3-iris)" />}
            {/* Pupil */}
            {!blinking && <circle cx={35 + ex} cy={43 + ey} r={5.5 * irisScale} fill="#050015" />}
            {/* Main catchlight — oval, upper-right */}
            {!blinking && <ellipse cx={38.5 + ex} cy={38.5 + ey} rx={4 * irisScale} ry={2.6 * irisScale} fill="white" />}
            {/* Secondary tiny catchlight — lower-left */}
            {!blinking && <circle cx={31 + ex} cy={48 + ey} r={1.8 * irisScale} fill="white" opacity="0.75" />}
            {/* Lash line */}
            <path d="M 22 37 Q 35 29 48 37" stroke="#1E0648" strokeWidth="2.8" strokeLinecap="round" fill="none" />

            {/* ══ RIGHT EYE — multi-layer ══ */}
            <ellipse cx="65" cy="45" rx="15" ry="16.5" fill="#1a0050" opacity="0.22" />
            <ellipse cx="65" cy="43" rx="13.5" ry={squintRy} fill="white" />
            <ellipse cx="65" cy="32" rx="13.5" ry="8" fill="rgba(20,0,60,0.18)" />
            {!blinking && <circle cx={65 + ex} cy={43 + ey} r={9.5 * irisScale} fill="url(#pc3-iris)" />}
            {!blinking && <circle cx={65 + ex} cy={43 + ey} r={5.5 * irisScale} fill="#050015" />}
            {!blinking && <ellipse cx={68.5 + ex} cy={38.5 + ey} rx={4 * irisScale} ry={2.6 * irisScale} fill="white" />}
            {!blinking && <circle cx={61 + ex} cy={48 + ey} r={1.8 * irisScale} fill="white" opacity="0.75" />}
            <path d="M 52 37 Q 65 29 78 37" stroke="#1E0648" strokeWidth="2.8" strokeLinecap="round" fill="none" />

            {/* ══ NOSE ══ */}
            <ellipse cx="50" cy="60" rx="5" ry="3" fill="rgba(74,0,180,0.28)" />
            <circle cx="47.5" cy="59" r="2" fill="rgba(74,0,180,0.22)" />
            <circle cx="52.5" cy="59" r="2" fill="rgba(74,0,180,0.22)" />

            {/* ══ MOUTH ══ */}
            {/* Mouth shadow/outline */}
            {m.showTeeth && (
              <path d={m.mouth} fill="#1E0648" opacity="0.9" />
            )}
            {/* Smile stroke */}
            <path d={m.mouth} stroke="rgba(30,6,72,0.88)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            {/* Teeth bar for big smiles */}
            {m.showTeeth && (
              <clipPath id="pc3-teeth-clip">
                <path d={m.mouth} />
              </clipPath>
            )}
            {m.showTeeth && (
              <ellipse cx="50" cy="70" rx="20" ry="9" fill="white" opacity="0.92" clipPath="url(#pc3-teeth-clip)" />
            )}

            {/* ══ SWEAT DROP (worried) ══ */}
            {mood === 'worried' && (
              <g style={{ animation: 'pc3-sweat 1.1s ease-in-out infinite' }}>
                <ellipse cx="76" cy="24" rx="3.5" ry="2.5" fill="#93C5FD" opacity="0.90" />
                <path d="M 76 16 Q 80 20 76 24" fill="#93C5FD" opacity="0.75" />
              </g>
            )}

          </g>{/* end body anim group */}
        </svg>
      </div>

      {/* Label — sidebar only */}
      {!compact && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: t.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)', textTransform: 'uppercase', marginTop: 1, marginBottom: 4 }}>
          PostCore
        </div>
      )}
    </div>
  );
}
