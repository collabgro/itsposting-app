import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';

export function setMascotMood(mood, message) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { mood, message } }));
}
export function triggerMilestone(milestone) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { milestone } }));
}

// ─── Moods ────────────────────────────────────────────────────────────────────
// ViewBox 0 0 140 185 | Head cx=70 cy=76 r=54 | Eyes left(44,72) right(96,72)
// Eye sclera rx=20 ry=22 | Brows above y=50 | Nose cy=90 | Mouth start y≥100
const MOODS = {
  idle: {
    bodyAnim: 'pc7-float', armL: 'pc7-arm-idle-l', armR: 'pc7-arm-idle-r',
    eyeRy: 22, squint: false, showTeeth: false, starEye: false,
    browsL: 'M 22 44 C 34 34 50 34 57 40',
    browsR: 'M 83 40 C 90 34 106 34 118 44',
    mouth: 'M 48 101 Q 70 117 92 101',
    blush: true, sparkle: false,
    msg: "What are we posting today?",
  },
  happy: {
    bodyAnim: 'pc7-bounce-soft', armL: 'pc7-arm-idle-l', armR: 'pc7-arm-wave-r',
    eyeRy: 11, squint: true, showTeeth: false, starEye: false,
    browsL: 'M 22 40 C 34 30 50 30 57 36',
    browsR: 'M 83 36 C 90 30 106 30 118 40',
    mouth: 'M 40 101 Q 70 122 100 101',
    blush: true, sparkle: false,
    msg: "Looking great! Keep that streak going!",
  },
  thinking: {
    bodyAnim: 'pc7-float-slow', armL: 'pc7-arm-think', armR: 'pc7-arm-idle-r',
    eyeRy: 22, squint: false, showTeeth: false, starEye: false,
    browsL: 'M 22 42 C 34 32 50 36 57 42',
    browsR: 'M 83 44 C 90 38 106 33 118 42',
    mouth: 'M 50 104 Q 70 114 90 104',
    blush: false, sparkle: true,
    msg: "Working on something great for you...",
  },
  celebrating: {
    bodyAnim: 'pc7-bounce-big', armL: 'pc7-arm-cele-l', armR: 'pc7-arm-cele-r',
    eyeRy: 11, squint: true, showTeeth: true, starEye: true,
    browsL: 'M 18 36 C 32 25 50 25 57 31',
    browsR: 'M 83 31 C 90 25 108 25 122 36',
    mouth: 'M 32 100 Q 70 126 108 100',
    blush: true, sparkle: true,
    msg: "Yes! That's what I'm talking about! 🎉",
  },
  worried: {
    bodyAnim: 'pc7-wiggle', armL: 'pc7-arm-idle-l', armR: 'pc7-arm-idle-r',
    eyeRy: 19, squint: false, showTeeth: false, starEye: false,
    browsL: 'M 22 46 C 34 42 50 40 57 44',
    browsR: 'M 83 44 C 90 40 106 42 118 46',
    mouth: 'M 48 113 Q 70 102 92 113',
    blush: false, sparkle: false,
    msg: "Running low on credits — let's top up!",
  },
  sad: {
    bodyAnim: 'pc7-float-slow', armL: 'pc7-arm-idle-l', armR: 'pc7-arm-idle-r',
    eyeRy: 16, squint: false, showTeeth: false, starEye: false,
    browsL: 'M 22 48 C 34 47 50 46 57 48',
    browsR: 'M 83 48 C 90 46 106 47 118 48',
    mouth: 'M 46 113 Q 70 100 94 113',
    blush: false, sparkle: false,
    msg: "Out of credits. Tap to upgrade and keep going!",
  },
  excited: {
    bodyAnim: 'pc7-excited', armL: 'pc7-arm-wave-l', armR: 'pc7-arm-wave-r',
    eyeRy: 22, squint: false, showTeeth: true, starEye: true,
    browsL: 'M 18 36 C 32 25 50 25 57 31',
    browsR: 'M 83 31 C 90 25 108 25 122 36',
    mouth: 'M 28 100 Q 70 128 112 100',
    blush: true, sparkle: true,
    msg: "Let's make something amazing together!",
  },
  viral: {
    bodyAnim: 'pc7-pulse-zoom', armL: 'pc7-arm-cele-l', armR: 'pc7-arm-cele-r',
    eyeRy: 22, squint: false, showTeeth: true, starEye: true,
    browsL: 'M 16 34 C 31 22 50 22 57 28',
    browsR: 'M 83 28 C 90 22 109 22 124 34',
    mouth: 'M 24 99 Q 70 130 116 99',
    blush: true, sparkle: true,
    msg: "That post is on fire! Your community loves it! 🔥",
  },
  first_encouragement: {
    bodyAnim: 'pc7-bounce-soft', armL: 'pc7-arm-idle-l', armR: 'pc7-arm-wave-r',
    eyeRy: 22, squint: false, showTeeth: false, starEye: false,
    browsL: 'M 22 43 C 34 33 50 33 57 39',
    browsR: 'M 83 39 C 90 33 106 33 118 43',
    mouth: 'M 48 101 Q 70 117 92 101',
    blush: true, sparkle: false,
    msg: "Your first post is one tap away. Let's do it together!",
  },
};

const ROUTE_MOODS = {
  '/wizard': 'excited', '/quick-post': 'happy', '/analytics': 'happy',
  '/billing': 'worried', '/knowledge-base': 'thinking',
  '/studio': 'excited', '/geo-audit': 'thinking',
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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const PC_CSS = `
@keyframes pc7-float {
  0%,100% { transform: translateY(0) rotate(-0.6deg); }
  40%     { transform: translateY(-8px) rotate(0.9deg); }
  75%     { transform: translateY(-3px) rotate(-0.3deg); }
}
@keyframes pc7-bounce-soft {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  35%     { transform: translateY(-12px) scaleX(0.93) scaleY(1.08); }
  65%     { transform: translateY(-5px) scaleX(1.02) scaleY(0.98); }
}
@keyframes pc7-bounce-big {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  14%     { transform: translateY(-6px) scaleX(1.08) scaleY(0.92); }
  30%     { transform: translateY(-28px) scaleX(0.86) scaleY(1.16); }
  54%     { transform: translateY(-14px) scaleX(0.92) scaleY(1.09); }
  70%     { transform: translateY(-24px) scaleX(0.89) scaleY(1.12); }
  88%     { transform: translateY(-5px) scaleX(1.05) scaleY(0.96); }
}
@keyframes pc7-excited {
  0%,100% { transform: translateY(0) rotate(0) scale(1); }
  20%     { transform: translateY(-16px) rotate(-4.5deg) scale(1.09); }
  45%     { transform: translateY(-8px) rotate(5deg) scale(1.05); }
  68%     { transform: translateY(-20px) rotate(-3deg) scale(1.11); }
  85%     { transform: translateY(-6px) rotate(2.5deg) scale(1.04); }
}
@keyframes pc7-wiggle {
  0%,100% { transform: rotate(0) translateX(0); }
  15%     { transform: rotate(-7.5deg) translateX(-6px); }
  42%     { transform: rotate(7.5deg) translateX(6px); }
  60%     { transform: rotate(-4.5deg) translateX(-3px); }
  80%     { transform: rotate(6deg) translateX(4px); }
}
@keyframes pc7-float-slow {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-5px); }
}
@keyframes pc7-pulse-zoom {
  0%,100% { transform: scale(1) rotate(0); }
  22%     { transform: scale(1.16) rotate(-4.5deg); }
  47%     { transform: scale(1.10) rotate(4.5deg); }
  70%     { transform: scale(1.18) rotate(-3deg); }
  88%     { transform: scale(1.09) rotate(2.5deg); }
}
/* Arms */
@keyframes pc7-arm-idle-l {
  0%,100% { transform: rotate(5deg); }
  50%     { transform: rotate(11deg); }
}
@keyframes pc7-arm-idle-r {
  0%,100% { transform: rotate(-5deg); }
  50%     { transform: rotate(-11deg); }
}
@keyframes pc7-arm-wave-l {
  0%,100% { transform: rotate(5deg); }
  25%     { transform: rotate(68deg); }
  52%     { transform: rotate(40deg); }
  76%     { transform: rotate(74deg); }
}
@keyframes pc7-arm-wave-r {
  0%,100% { transform: rotate(-5deg); }
  25%     { transform: rotate(-68deg); }
  52%     { transform: rotate(-40deg); }
  76%     { transform: rotate(-74deg); }
}
@keyframes pc7-arm-cele-l {
  0%,100% { transform: rotate(-74deg); }
  50%     { transform: rotate(-88deg); }
}
@keyframes pc7-arm-cele-r {
  0%,100% { transform: rotate(74deg); }
  50%     { transform: rotate(88deg); }
}
@keyframes pc7-arm-think {
  0%,100% { transform: rotate(-36deg); }
  50%     { transform: rotate(-40deg); }
}
/* Sparkles */
@keyframes pc7-star-a {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(34px,-42px) scale(1.6) rotate(430deg); }
}
@keyframes pc7-star-b {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  15%  { opacity:1; }
  100% { opacity:0; transform:translate(-32px,-46px) scale(1.3); }
}
@keyframes pc7-star-c {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  22%  { opacity:1; }
  100% { opacity:0; transform:translate(24px,-54px) scale(1.1) rotate(-350deg); }
}
@keyframes pc7-star-d {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(-36px,-34px) scale(0.9); }
}
@keyframes pc7-sweat {
  0%,100% { transform:translateY(0); opacity:0.90; }
  65%     { transform:translateY(12px); opacity:0.28; }
}
@keyframes pc7-tooltip-in {
  from { opacity:0; transform:translateY(-50%) translateX(-12px) scale(0.90); }
  to   { opacity:1; transform:translateY(-50%) translateX(0) scale(1); }
}
@keyframes pc7-ripple {
  0%   { transform:scale(0.7); opacity:0.9; }
  100% { transform:scale(2.8); opacity:0; }
}
@keyframes pc7-star-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
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

  // Reveal
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(id);
  }, []);

  // Eye tracking
  useEffect(() => {
    const onMove = (e) => {
      lastMoveRef.current = Date.now();
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const hx = rect.left + rect.width * 0.5;
      const hy = rect.top  + rect.height * 0.38;
      const dx = e.clientX - hx, dy = e.clientY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const MAX = 4;
      setEyeOffset(dist < 15 ? { x: 0, y: 0 } : {
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
        const r = 1.5 + Math.random() * 2.5;
        setEyeOffset({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        setTimeout(() => {
          if (Date.now() - lastMoveRef.current > 5000) setEyeOffset({ x: 0, y: 0 });
        }, 900 + Math.random() * 1100);
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

  // Seasonal + first post
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
    const key = `ms_streak_${streak}`;
    if (sessionStorage.getItem(key)) return;
    const msg = streak === 30 ? MILESTONE_MSGS.streak_30 : streak === 7 ? MILESTONE_MSGS.streak_7 : streak === 3 ? MILESTONE_MSGS.streak_3 : null;
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
    const msg = total >= 50 ? MILESTONE_MSGS.posts_50 : total >= 25 ? MILESTONE_MSGS.posts_25 : MILESTONE_MSGS.posts_10;
    sessionStorage.setItem(key, '1');
    setTimeout(() => {
      applyMood('celebrating'); setCustomMsg(msg);
      setTimeout(() => applyMood('happy'), 3500);
      setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
    }, 1800);
  }, [user?.total_posts_this_month]);

  // Custom event handler
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

  const eyeRy    = blinking ? 1.5 : m.eyeRy;
  const squintRy = m.squint && !blinking ? m.eyeRy * 0.50 : eyeRy;
  const irisR    = (blinking || m.squint) ? 13 * (blinking ? 0 : 0.68) : 14.5;
  const pupilR   = (blinking || m.squint) ? 9  * (blinking ? 0 : 0.68) : 9;

  const armDur = (a) =>
    a.includes('cele') ? '0.74s' : a.includes('wave') ? '0.66s' :
    a.includes('think') ? '2.8s' : '3.8s';

  const bodyDur = {
    'pc7-float': '3.8s', 'pc7-bounce-soft': '1.8s', 'pc7-bounce-big': '0.9s',
    'pc7-excited': '0.86s', 'pc7-wiggle': '0.56s', 'pc7-float-slow': '4.4s',
    'pc7-pulse-zoom': '0.64s',
  }[m.bodyAnim] || '3.8s';

  const armRAnim = hovered ? 'pc7-arm-wave-r' : m.armR;
  const charW = compact ? 54 : 92;
  const charH = compact ? 54 : 122;

  // Compact: crop to head only (face + horns + top fur)
  const svgVB = compact ? '4 4 132 128' : '0 0 140 185';

  // ─── Color palette — light, warm, fluffy (NOT dark purple robot) ─────────────
  const C_WHITE  = '#FFFFFF';
  const C_FUR_HL = '#F8F5FF';   // Near-white lavender
  const C_FUR    = '#EDE9FE';   // Very light lavender
  const C_MID    = '#C4B5FD';   // Soft purple
  const C_DEEP   = '#7C3AED';   // Deep shadow only

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

      {/* Tooltip — right side, never overlaps nav */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: 'calc(100% + 14px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 214,
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
          animation: 'pc7-tooltip-in 200ms ease both',
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

      {/* Character wrapper */}
      <div
        ref={mascotRef}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: charW, height: charH, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', position: 'relative' }}
      >
        {clickFlash && (
          <div style={{
            position: 'absolute', top: '30%', left: '50%',
            width: 60, height: 60, marginLeft: -30, marginTop: -30,
            borderRadius: '50%', border: `2.5px solid ${t.primary}`,
            animation: 'pc7-ripple 0.55s ease-out both',
            pointerEvents: 'none', zIndex: 10,
          }} />
        )}

        {/* ───────────────────── SVG Character ───────────────────── */}
        <svg viewBox={svgVB} fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>

          <defs>
            {/* HEAD / BODY — light lavender-cream sphere, NOT dark purple */}
            <radialGradient id="pc7-fur" cx="33%" cy="21%" r="72%">
              <stop offset="0%"   stopColor="#FFFFFF" />      {/* Pure white specular */}
              <stop offset="14%"  stopColor="#F8F5FF" />      {/* Near-white lavender */}
              <stop offset="36%"  stopColor="#EDE9FE" />      {/* Light lavender */}
              <stop offset="62%"  stopColor="#C4B5FD" />      {/* Soft purple */}
              <stop offset="84%"  stopColor="#8B5CF6" />      {/* Medium purple */}
              <stop offset="100%" stopColor="#5B21B6" />      {/* Deep shadow edge */}
            </radialGradient>

            {/* LIMBS — slightly richer */}
            <radialGradient id="pc7-limb" cx="38%" cy="20%" r="74%">
              <stop offset="0%"   stopColor="#F0EBFF" />
              <stop offset="44%"  stopColor="#C4B5FD" />
              <stop offset="100%" stopColor="#6D28D9" />
            </radialGradient>

            {/* HORN */}
            <radialGradient id="pc7-horn" cx="38%" cy="22%" r="70%">
              <stop offset="0%"   stopColor="#F5F0FF" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </radialGradient>

            {/* EYE IRIS — warm honey amber: the most welcoming eye color */}
            <radialGradient id="pc7-iris" cx="33%" cy="26%" r="66%">
              <stop offset="0%"   stopColor="#FFFFF5" />      {/* Bright center */}
              <stop offset="18%"  stopColor="#FEF3C7" />      {/* Pale gold */}
              <stop offset="44%"  stopColor="#FCD34D" />      {/* Warm gold */}
              <stop offset="70%"  stopColor="#F59E0B" />      {/* Rich amber */}
              <stop offset="90%"  stopColor="#D97706" />      {/* Deep amber */}
              <stop offset="100%" stopColor="#92400E" />      {/* Dark amber edge */}
            </radialGradient>

            {/* BLUSH — soft radial fade */}
            <radialGradient id="pc7-bl" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(251,113,133,0.68)" />
              <stop offset="100%" stopColor="rgba(251,113,133,0)" />
            </radialGradient>
            <radialGradient id="pc7-br" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(251,113,133,0.68)" />
              <stop offset="100%" stopColor="rgba(251,113,133,0)" />
            </radialGradient>

            {/* DROP SHADOW — gives character depth off the screen */}
            <filter id="pc7-shadow" x="-30%" y="-10%" width="160%" height="150%">
              <feDropShadow dx="0" dy="9" stdDeviation="11" floodColor="#4C1D95" floodOpacity="0.36"/>
            </filter>

            {/* GLOW — for sparkle / excited states */}
            <filter id="pc7-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* ═══════════════ BODY ANIMATION WRAPPER ═══════════════ */}
          <g style={{
            animation: `${m.bodyAnim} ${bodyDur} ease-in-out infinite`,
            transformOrigin: '70px 100px',
            filter: 'url(#pc7-shadow)',
          }}>

            {/* Ground shadow (uses filter:none to avoid double shadow) */}
            <ellipse cx="70" cy="182" rx="26" ry="5" fill="rgba(0,0,0,0.11)" style={{ filter: 'none' }} />

            {/* ══ FEET ══ */}
            <ellipse cx="44"  cy="175" rx="18" ry="9"   fill={C_MID} />
            <ellipse cx="41"  cy="171" rx="10" ry="5"   fill="rgba(255,255,255,0.48)" />
            <ellipse cx="96"  cy="175" rx="18" ry="9"   fill={C_MID} />
            <ellipse cx="93"  cy="171" rx="10" ry="5"   fill="rgba(255,255,255,0.48)" />

            {/* ══ LEGS ══ */}
            <path d="M 50 157 C 48 166 44 172 42 174 C 47 178 55 178 55 171 C 55 166 55 162 50 157 Z" fill={C_MID} />
            <path d="M 90 157 C 92 166 96 172 98 174 C 93 178 85 178 85 171 C 85 166 85 162 90 157 Z" fill={C_MID} />

            {/* ══ LEFT ARM ══ */}
            <g style={{ transformBox: 'view-box', transformOrigin: '30px 130px', animation: `${m.armL} ${armDur(m.armL)} ease-in-out infinite` }}>
              {/* Arm body */}
              <path d="M 30 130 C 21 134 14 146 13 158 C 12 169 18 177 25 174 C 31 171 27 160 29 148 C 31 139 31 134 30 130 Z"
                fill="url(#pc7-limb)" />
              {/* Fluffy bumps on arm edge */}
              <circle cx="13" cy="150" r="9"  fill={C_FUR_HL} opacity="0.70" />
              <circle cx="12" cy="163" r="9"  fill={C_FUR_HL} opacity="0.65" />
              {/* Round hand */}
              <circle cx="18" cy="174" r="14" fill={C_FUR} />
              <ellipse cx="14" cy="168" rx="7.5" ry="4.5" fill="rgba(255,255,255,0.72)" />
              {/* Finger nubs */}
              <circle cx="8"  cy="180" r="5.5" fill={C_MID} />
              <circle cx="17" cy="184" r="5.5" fill={C_MID} />
              <circle cx="26" cy="180" r="5.5" fill={C_MID} />
            </g>

            {/* ══ RIGHT ARM ══ */}
            <g style={{ transformBox: 'view-box', transformOrigin: '110px 130px', animation: `${armRAnim} ${armDur(armRAnim)} ease-in-out infinite` }}>
              <path d="M 110 130 C 119 134 126 146 127 158 C 128 169 122 177 115 174 C 109 171 113 160 111 148 C 109 139 109 134 110 130 Z"
                fill="url(#pc7-limb)" />
              <circle cx="127" cy="150" r="9"  fill={C_FUR_HL} opacity="0.70" />
              <circle cx="128" cy="163" r="9"  fill={C_FUR_HL} opacity="0.65" />
              <circle cx="122" cy="174" r="14" fill={C_FUR} />
              <ellipse cx="118" cy="168" rx="7.5" ry="4.5" fill="rgba(255,255,255,0.72)" />
              <circle cx="114" cy="180" r="5.5" fill={C_MID} />
              <circle cx="123" cy="184" r="5.5" fill={C_MID} />
              <circle cx="132" cy="180" r="5.5" fill={C_MID} />
            </g>

            {/* ══ BODY ══ */}
            <ellipse cx="70" cy="158" rx="37" ry="30" fill="url(#pc7-fur)" />
            {/* Body fur bumps (sides) */}
            <circle cx="33" cy="150" r="11" fill={C_WHITE} opacity="0.52" />
            <circle cx="107" cy="150" r="11" fill={C_WHITE} opacity="0.52" />
            <circle cx="35" cy="168" r="10" fill={C_WHITE} opacity="0.45" />
            <circle cx="105" cy="168" r="10" fill={C_WHITE} opacity="0.45" />
            {/* Body specular highlight */}
            <ellipse cx="56" cy="147" rx="18" ry="12" fill="rgba(255,255,255,0.30)" transform="rotate(-12 56 147)" />
            {/* PC badge */}
            <rect x="59" y="152" width="22" height="15" rx="6.5" fill="rgba(109,40,217,0.15)" />
            <text x="70" y="163.5" textAnchor="middle" fill="rgba(109,40,217,0.70)"
              fontSize="8" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif" letterSpacing="-0.5">PC</text>

            {/* ══ HEAD FUR BUMPS — BACK LAYER (creates fluffy cloud outline) ══ */}
            <circle cx="70"  cy="14"  r="14" fill={C_WHITE} />  {/* Top center */}
            <circle cx="52"  cy="17"  r="13" fill={C_WHITE} />  {/* Top left */}
            <circle cx="88"  cy="17"  r="13" fill={C_WHITE} />  {/* Top right */}
            <circle cx="35"  cy="25"  r="12" fill={C_WHITE} />  {/* Upper-left */}
            <circle cx="105" cy="25"  r="12" fill={C_WHITE} />  {/* Upper-right */}
            <circle cx="19"  cy="48"  r="12" fill={C_WHITE} />  {/* Left upper */}
            <circle cx="121" cy="48"  r="12" fill={C_WHITE} />  {/* Right upper */}
            <circle cx="13"  cy="74"  r="12" fill={C_WHITE} />  {/* Left mid */}
            <circle cx="127" cy="74"  r="12" fill={C_WHITE} />  {/* Right mid */}
            <circle cx="15"  cy="102" r="11" fill={C_WHITE} />  {/* Left lower */}
            <circle cx="125" cy="102" r="11" fill={C_WHITE} />  {/* Right lower */}

            {/* ══ HEAD MAIN SPHERE ══ */}
            <circle cx="70" cy="76" r="54" fill="url(#pc7-fur)" />

            {/* Head 3D sphere highlights */}
            {/* Large primary specular (upper-left — defines the light source) */}
            <ellipse cx="44" cy="42" rx="23" ry="15" fill="rgba(255,255,255,0.42)" transform="rotate(-22 44 42)" />
            {/* Smaller secondary shimmer */}
            <ellipse cx="34" cy="62" rx="11" ry="7"  fill="rgba(255,255,255,0.24)" transform="rotate(-10 34 62)" />
            {/* Rim light at bottom (creates roundness) */}
            <ellipse cx="70" cy="126" rx="30" ry="8"  fill="rgba(196,181,253,0.28)" />

            {/* ══ HEAD FUR BUMPS — FRONT LAYER (adds depth to fur) ══ */}
            <circle cx="22"  cy="56"  r="10" fill={C_WHITE} opacity="0.50" />
            <circle cx="118" cy="56"  r="10" fill={C_WHITE} opacity="0.50" />
            <circle cx="26"  cy="36"  r="10" fill={C_WHITE} opacity="0.46" />
            <circle cx="114" cy="36"  r="10" fill={C_WHITE} opacity="0.46" />

            {/* ══ HORNS — rounded yeti-style (not sharp — cute!) ══ */}
            {/* Left horn */}
            <ellipse cx="46" cy="30" rx="9" ry="15" fill="url(#pc7-horn)" transform="rotate(-20 46 30)" />
            <ellipse cx="45" cy="28" rx="5.5" ry="9.5" fill="rgba(255,255,255,0.55)" transform="rotate(-20 45 28)" />
            {/* Right horn */}
            <ellipse cx="94" cy="30" rx="9" ry="15" fill="url(#pc7-horn)" transform="rotate(20 94 30)" />
            <ellipse cx="95" cy="28" rx="5.5" ry="9.5" fill="rgba(255,255,255,0.55)" transform="rotate(20 95 28)" />

            {/* ══ SPARKLES ══ */}
            {m.sparkle && (<>
              <g style={{ transformOrigin: '109px 18px', animation: 'pc7-star-a 2.1s ease-in-out infinite' }}>
                <path d="M109 15 L110.8 17.8 L114 18 L111.7 20.3 L112.5 23.6 L109 21.8 L105.5 23.6 L106.3 20.3 L104 18 L107.2 17.8 Z" fill="#FCD34D" />
              </g>
              <g style={{ transformOrigin: '7px 38px', animation: 'pc7-star-b 2.6s ease-in-out infinite 0.3s' }}>
                <path d="M7 35 L8.7 37.8 L12 38 L9.7 40.3 L10.5 43.6 L7 41.8 L3.5 43.6 L4.3 40.3 L2 38 L5.3 37.8 Z" fill="#F0ABFC" />
              </g>
              <g style={{ transformOrigin: '113px 46px', animation: 'pc7-star-c 2.9s ease-in-out infinite 0.6s' }}>
                <circle cx="113" cy="46" r="6" fill="#BAE6FD" />
              </g>
              <g style={{ transformOrigin: '4px 72px', animation: 'pc7-star-d 2.3s ease-in-out infinite 0.9s' }}>
                <circle cx="4" cy="72" r="5" fill="#6EE7B7" />
              </g>
            </>)}

            {/* ══ BLUSH CHEEKS — radial gradient fade ══ */}
            {m.blush && (<>
              <ellipse cx="22"  cy="90" rx="18" ry="11" fill="url(#pc7-bl)" />
              <ellipse cx="118" cy="90" rx="18" ry="11" fill="url(#pc7-br)" />
            </>)}

            {/* ══ EYEBROWS — thick, expressive ══ */}
            <path d={m.browsL} stroke="#1E0048" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d={m.browsR} stroke="#1E0048" strokeWidth="5" strokeLinecap="round" fill="none" />

            {/* ══ LEFT EYE — full Pixar treatment ══ */}
            {/* Outer shadow drop */}
            <ellipse cx="44" cy="74" rx="23" ry="26" fill="rgba(30,0,72,0.13)" />
            {/* White sclera */}
            <ellipse cx="44" cy="72" rx="20" ry={squintRy} fill={C_WHITE} />
            {/* Upper eyelid shadow — creates Pixar hooded-eye depth */}
            <ellipse cx="44" cy="54" rx="20" ry="15" fill="rgba(30,0,72,0.16)" />
            {/* Iris — warm amber honey */}
            {!blinking && <circle cx={44 + ex} cy={72 + ey} r={irisR} fill="url(#pc7-iris)" />}
            {/* Pupil — large for curious/engaged look */}
            {!blinking && <circle cx={44 + ex} cy={72 + ey} r={pupilR} fill="#080012" />}
            {/* Star shimmer in pupil (exciting moods) */}
            {!blinking && m.starEye && (
              <g style={{ transformOrigin: `${44+ex}px ${72+ey}px`, animation: 'pc7-star-spin 3.5s linear infinite' }}>
                <path
                  d={`M${44+ex} ${65+ey} L${46.2+ex} ${70.2+ey} L${51+ex} ${70.2+ey} L${47.1+ex} ${73.4+ey} L${48.8+ex} ${79+ey} L${44+ex} ${75.8+ey} L${39.2+ex} ${79+ey} L${40.9+ex} ${73.4+ey} L${37+ex} ${70.2+ey} L${41.8+ex} ${70.2+ey} Z`}
                  fill="rgba(255,245,160,0.88)"
                />
              </g>
            )}
            {/* Main catchlight — large oval, upper-right (Pixar signature) */}
            {!blinking && <ellipse cx={49.5 + ex} cy={63 + ey} rx={7}   ry={4.5} fill={C_WHITE} opacity="0.97" />}
            {/* Secondary sparkle catchlight — lower-left */}
            {!blinking && <circle  cx={34    + ex} cy={80 + ey} r={3.2} fill={C_WHITE} opacity="0.72" />}
            {/* Upper lash line */}
            <path d="M 22 57 Q 44 43 66 57" stroke="#120026" strokeWidth="4.2" strokeLinecap="round" fill="none" />
            {/* Lower lash (subtle) */}
            <path d="M 26 87 Q 44 97 62 87" stroke="#120026" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.30" />

            {/* ══ RIGHT EYE ══ */}
            <ellipse cx="96" cy="74" rx="23" ry="26" fill="rgba(30,0,72,0.13)" />
            <ellipse cx="96" cy="72" rx="20" ry={squintRy} fill={C_WHITE} />
            <ellipse cx="96" cy="54" rx="20" ry="15" fill="rgba(30,0,72,0.16)" />
            {!blinking && <circle cx={96 + ex} cy={72 + ey} r={irisR} fill="url(#pc7-iris)" />}
            {!blinking && <circle cx={96 + ex} cy={72 + ey} r={pupilR} fill="#080012" />}
            {!blinking && m.starEye && (
              <g style={{ transformOrigin: `${96+ex}px ${72+ey}px`, animation: 'pc7-star-spin 3.5s linear infinite 0.7s' }}>
                <path
                  d={`M${96+ex} ${65+ey} L${98.2+ex} ${70.2+ey} L${103+ex} ${70.2+ey} L${99.1+ex} ${73.4+ey} L${100.8+ex} ${79+ey} L${96+ex} ${75.8+ey} L${91.2+ex} ${79+ey} L${92.9+ex} ${73.4+ey} L${89+ex} ${70.2+ey} L${93.8+ex} ${70.2+ey} Z`}
                  fill="rgba(255,245,160,0.88)"
                />
              </g>
            )}
            {!blinking && <ellipse cx={101.5 + ex} cy={63 + ey} rx={7}   ry={4.5} fill={C_WHITE} opacity="0.97" />}
            {!blinking && <circle  cx={86     + ex} cy={80 + ey} r={3.2} fill={C_WHITE} opacity="0.72" />}
            <path d="M 74 57 Q 96 43 118 57" stroke="#120026" strokeWidth="4.2" strokeLinecap="round" fill="none" />
            <path d="M 78 87 Q 96 97 114 87" stroke="#120026" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.30" />

            {/* ══ NOSE — cute pink button ══ */}
            <ellipse cx="70" cy="91" rx="8.5" ry="6" fill="#FCA5A5" opacity="0.84" />
            <circle  cx="64" cy="89" r="3.8" fill="#F87171" opacity="0.68" />
            <circle  cx="76" cy="89" r="3.8" fill="#F87171" opacity="0.68" />
            <ellipse cx="66" cy="88" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.55)" />

            {/* ══ MOUTH ══ */}
            {m.showTeeth && <path d={m.mouth} fill="#1E0048" opacity="0.90" />}
            <path d={m.mouth} stroke="#1E0048" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            {m.showTeeth && (
              <>
                <clipPath id="pc7-teeth">
                  <path d={m.mouth} />
                </clipPath>
                {/* Teeth bar */}
                <rect x="34" y="100" width="72" height="24" rx="5" fill={C_WHITE} opacity="0.95" clipPath="url(#pc7-teeth)" />
                {/* Tooth dividers */}
                <line x1="52" y1="100" x2="52" y2="124" stroke="rgba(220,210,255,0.42)" strokeWidth="1.4" clipPath="url(#pc7-teeth)" />
                <line x1="70" y1="100" x2="70" y2="124" stroke="rgba(220,210,255,0.42)" strokeWidth="1.4" clipPath="url(#pc7-teeth)" />
                <line x1="88" y1="100" x2="88" y2="124" stroke="rgba(220,210,255,0.42)" strokeWidth="1.4" clipPath="url(#pc7-teeth)" />
              </>
            )}

            {/* ══ SWEAT DROP (worried only) ══ */}
            {mood === 'worried' && (
              <g style={{ animation: 'pc7-sweat 1.1s ease-in-out infinite' }}>
                <ellipse cx="114" cy="36" rx="5" ry="3.5" fill="#93C5FD" opacity="0.88" />
                <path d="M 114 24 Q 120 30 114 36" fill="#93C5FD" opacity="0.76" />
              </g>
            )}

          </g>{/* end body animation group */}
        </svg>
      </div>

      {/* "PostCore" label — sidebar non-compact only */}
      {!compact && (
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: t.isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)',
          textTransform: 'uppercase', marginTop: 1, marginBottom: 4,
        }}>
          PostCore
        </div>
      )}
    </div>
  );
}
