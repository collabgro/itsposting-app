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

// ─── Mood definitions ────────────────────────────────────────────────────────
const MOODS = {
  idle: {
    bodyAnim: 'pc2-idle', armL: 'pc2-arm-idle-l', armR: 'pc2-arm-idle-r',
    eyeRy: 5.5, squint: false,
    browsL: 'M 27 22 Q 32 19 37 22', browsR: 'M 43 22 Q 48 19 53 22',
    mouth: 'M 29 40 Q 40 46 51 40',
    blush: false, sparkle: false,
    glow: 'rgba(79,47,214,0.30)',
    msg: "What are we posting today?",
  },
  happy: {
    bodyAnim: 'pc2-bounce-gentle', armL: 'pc2-arm-idle-l', armR: 'pc2-arm-wave-r',
    eyeRy: 3.2, squint: true,
    browsL: 'M 27 20 Q 32 17 37 20', browsR: 'M 43 20 Q 48 17 53 20',
    mouth: 'M 26 38 Q 40 51 54 38',
    blush: true, sparkle: false,
    glow: 'rgba(124,92,252,0.42)',
    msg: "Looking great! Keep that streak going!",
  },
  thinking: {
    bodyAnim: 'pc2-float-slow', armL: 'pc2-arm-think', armR: 'pc2-arm-idle-r',
    eyeRy: 5.5, squint: false,
    browsL: 'M 27 20 Q 32 17 37 23', browsR: 'M 43 23 Q 48 17 53 20',
    mouth: 'M 31 41 Q 40 45 49 41',
    blush: false, sparkle: true,
    glow: 'rgba(99,102,241,0.24)',
    msg: "Working on something great for you...",
  },
  celebrating: {
    bodyAnim: 'pc2-bounce-big', armL: 'pc2-arm-cele-l', armR: 'pc2-arm-cele-r',
    eyeRy: 3.0, squint: true,
    browsL: 'M 27 18 Q 32 14 37 18', browsR: 'M 43 18 Q 48 14 53 18',
    mouth: 'M 24 36 Q 40 55 56 36',
    blush: true, sparkle: true,
    glow: 'rgba(124,92,252,0.60)',
    msg: "Yes! That's what I'm talking about! 🎉",
  },
  worried: {
    bodyAnim: 'pc2-wiggle', armL: 'pc2-arm-idle-l', armR: 'pc2-arm-idle-r',
    eyeRy: 4.8, squint: false,
    browsL: 'M 27 24 Q 32 20 37 22', browsR: 'M 43 22 Q 48 20 53 24',
    mouth: 'M 29 44 Q 40 38 51 44',
    blush: false, sparkle: false,
    glow: 'rgba(234,179,8,0.32)',
    msg: "Running low on credits — let's top up!",
  },
  sad: {
    bodyAnim: 'pc2-float-slow', armL: 'pc2-arm-idle-l', armR: 'pc2-arm-idle-r',
    eyeRy: 4.2, squint: false,
    browsL: 'M 27 24 Q 32 21 37 24', browsR: 'M 43 24 Q 48 21 53 24',
    mouth: 'M 30 46 Q 40 39 50 46',
    blush: false, sparkle: false,
    glow: 'rgba(79,47,214,0.12)',
    msg: "Out of credits. Tap to upgrade and keep going!",
  },
  excited: {
    bodyAnim: 'pc2-excited', armL: 'pc2-arm-wave-l', armR: 'pc2-arm-wave-r',
    eyeRy: 6.5, squint: false,
    browsL: 'M 27 17 Q 32 13 37 17', browsR: 'M 43 17 Q 48 13 53 17',
    mouth: 'M 24 37 Q 40 54 56 37',
    blush: true, sparkle: true,
    glow: 'rgba(124,92,252,0.52)',
    msg: "Let's make something amazing together!",
  },
  viral: {
    bodyAnim: 'pc2-pulse-zoom', armL: 'pc2-arm-cele-l', armR: 'pc2-arm-cele-r',
    eyeRy: 7.0, squint: true,
    browsL: 'M 24 15 Q 32 10 37 15', browsR: 'M 43 15 Q 48 10 56 15',
    mouth: 'M 22 34 Q 40 58 58 34',
    blush: true, sparkle: true,
    glow: 'rgba(251,191,36,0.72)',
    msg: "That post is on fire! Your community loves it! 🔥",
  },
  first_encouragement: {
    bodyAnim: 'pc2-bounce-gentle', armL: 'pc2-arm-idle-l', armR: 'pc2-arm-wave-r',
    eyeRy: 5.8, squint: false,
    browsL: 'M 27 20 Q 32 17 37 20', browsR: 'M 43 20 Q 48 17 53 20',
    mouth: 'M 28 40 Q 40 48 52 40',
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
  '/ideas':          'thinking',
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

// ─── Seasonal hat / accessory ─────────────────────────────────────────────────
function SeasonalAccessory({ month }) {
  // Offset transform to match new head center (40, 30) vs old (32, 33)
  return (
    <g transform="translate(8, -3)">
      {month === 12 && (
        <g>
          <path d="M 16 12 Q 24 6 30 1 Q 31.5 -1 33 1 Q 39 6 48 12 Z" fill="#DC2626" />
          <ellipse cx="32" cy="12" rx="16.5" ry="3.8" fill="white" />
          <circle cx="31.5" cy="2" r="4" fill="white" />
        </g>
      )}
      {(month === 1 || month === 2) && (
        <g>
          <path d="M 17 13 Q 15 5 24 2 Q 32 0 40 2 Q 49 5 47 13 Z" fill="#3B82F6" />
          <ellipse cx="32" cy="13" rx="15.5" ry="3.5" fill="#1D4ED8" />
          <circle cx="32" cy="3" r="4.5" fill="#93C5FD" />
        </g>
      )}
      {(month >= 3 && month <= 5) && (
        <g>
          <circle cx="32" cy="7" r="3.2" fill="#FCD34D" />
          <circle cx="25" cy="10" r="2.6" fill="#F472B6" />
          <circle cx="39" cy="10" r="2.6" fill="#F472B6" />
          <ellipse cx="22" cy="14" rx="3" ry="1.5" fill="#4ADE80" transform="rotate(-25 22 14)" />
          <ellipse cx="42" cy="14" rx="3" ry="1.5" fill="#4ADE80" transform="rotate(25 42 14)" />
        </g>
      )}
      {(month >= 6 && month <= 8) && (
        <g>
          <rect x="14.5" y="24.5" width="17" height="11" rx="5.5" fill="#0F172A" opacity="0.93" />
          <rect x="32.5" y="24.5" width="17" height="11" rx="5.5" fill="#0F172A" opacity="0.93" />
          <rect x="31.5" y="28.5" width="1" height="2" rx="0.5" fill="#374151" />
          <path d="M 14.5 29.5 L 6 28" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          <path d="M 49.5 29.5 L 58 28" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {month === 10 && (
        <g>
          <ellipse cx="32" cy="14" rx="16" ry="3.5" fill="#1F2937" />
          <path d="M 18 14 Q 23 8 28 3 Q 30 0 32 1 Q 34 0 36 3 Q 41 8 46 14 Z" fill="#111827" />
          <rect x="18" y="12" width="28" height="3.5" rx="1.5" fill="#7C5CFC" opacity="0.9" />
        </g>
      )}
    </g>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const PC_CSS = `
/* Body animations */
@keyframes pc2-idle {
  0%,100% { transform: translateY(0px) rotate(-0.8deg); }
  30%     { transform: translateY(-5px) rotate(1deg); }
  70%     { transform: translateY(-3px) rotate(-0.4deg); }
}
@keyframes pc2-bounce-gentle {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  35%     { transform: translateY(-8px) scaleX(0.95) scaleY(1.06); }
  60%     { transform: translateY(-3px) scaleX(1.02) scaleY(0.98); }
}
@keyframes pc2-bounce-big {
  0%,100% { transform: translateY(0) scaleX(1) scaleY(1); }
  15%     { transform: translateY(-6px) scaleX(1.05) scaleY(0.96); }
  30%     { transform: translateY(-22px) scaleX(0.88) scaleY(1.13); }
  50%     { transform: translateY(-14px) scaleX(0.93) scaleY(1.08); }
  65%     { transform: translateY(-20px) scaleX(0.90) scaleY(1.11); }
  80%     { transform: translateY(-4px) scaleX(1.04) scaleY(0.97); }
}
@keyframes pc2-excited {
  0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
  18%     { transform: translateY(-13px) rotate(-3.5deg) scale(1.07); }
  40%     { transform: translateY(-7px) rotate(3deg) scale(1.04); }
  62%     { transform: translateY(-16px) rotate(-2deg) scale(1.09); }
  82%     { transform: translateY(-5px) rotate(2deg) scale(1.03); }
}
@keyframes pc2-wiggle {
  0%,100% { transform: rotate(0deg) translateX(0); }
  14%     { transform: rotate(-6deg) translateX(-4px); }
  42%     { transform: rotate(6deg) translateX(4px); }
  58%     { transform: rotate(-4deg) translateX(-2px); }
  78%     { transform: rotate(5deg) translateX(3px); }
}
@keyframes pc2-float-slow {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-3px); }
}
@keyframes pc2-pulse-zoom {
  0%,100% { transform: scale(1) rotate(0deg); }
  18%     { transform: scale(1.14) rotate(-4deg); }
  40%     { transform: scale(1.09) rotate(3deg); }
  60%     { transform: scale(1.17) rotate(-2deg); }
  80%     { transform: scale(1.07) rotate(2deg); }
}

/* Arm animations — rotates around shoulder pivot via transformOrigin */
@keyframes pc2-arm-idle-l {
  0%,100% { transform: rotate(10deg); }
  50%     { transform: rotate(14deg); }
}
@keyframes pc2-arm-idle-r {
  0%,100% { transform: rotate(-10deg); }
  50%     { transform: rotate(-14deg); }
}
@keyframes pc2-arm-wave-r {
  0%,100% { transform: rotate(-10deg); }
  20%     { transform: rotate(-62deg); }
  45%     { transform: rotate(-34deg); }
  70%     { transform: rotate(-68deg); }
}
@keyframes pc2-arm-wave-l {
  0%,100% { transform: rotate(10deg); }
  20%     { transform: rotate(62deg); }
  45%     { transform: rotate(34deg); }
  70%     { transform: rotate(68deg); }
}
@keyframes pc2-arm-cele-l {
  0%,100% { transform: rotate(-72deg); }
  50%     { transform: rotate(-82deg) translateX(-2px); }
}
@keyframes pc2-arm-cele-r {
  0%,100% { transform: rotate(72deg); }
  50%     { transform: rotate(82deg) translateX(2px); }
}
@keyframes pc2-arm-think {
  0%,100% { transform: rotate(-30deg); }
  50%     { transform: rotate(-33deg); }
}

/* Sparkle particles */
@keyframes pc2-star-a {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(22px,-28px) scale(1.3) rotate(360deg); }
}
@keyframes pc2-star-b {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  14%  { opacity:1; }
  100% { opacity:0; transform:translate(-20px,-30px) scale(1.1); }
}
@keyframes pc2-star-c {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg); }
  22%  { opacity:0.9; }
  100% { opacity:0; transform:translate(14px,-36px) scale(0.9) rotate(-280deg); }
}
@keyframes pc2-star-d {
  0%   { opacity:0; transform:translate(0,0) scale(0); }
  18%  { opacity:1; }
  100% { opacity:0; transform:translate(-25px,-22px) scale(0.8); }
}

/* Sweat drop for worried */
@keyframes pc2-sweat {
  0%,100% { transform:translateY(0); opacity:0.75; }
  65%     { transform:translateY(8px); opacity:0.3; }
}

/* Tooltip appear */
@keyframes pc2-tooltip-in {
  from { opacity:0; transform:translateX(-50%) translateY(8px) scale(0.91); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}

/* Cursor click ripple */
@keyframes pc2-click-ripple {
  0%   { transform:scale(0.8); opacity:0.9; }
  100% { transform:scale(2.0); opacity:0; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────
export default function PostCoreMascot({ user }) {
  const { t } = useTheme();
  const router = useRouter();
  const mascotRef = useRef(null);
  const lastMoveRef = useRef(Date.now());

  const [mood, setMood]         = useState('idle');
  const [visible, setVisible]   = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [blinking, setBlinking] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [clickFlash, setClickFlash] = useState(false);

  const month = new Date().getMonth() + 1;
  const applyMood = (m) => { if (MOODS[m]) setMood(m); };

  // ── Fade in ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t1);
  }, []);

  // ── Eye tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      lastMoveRef.current = Date.now();
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const hx = rect.left + rect.width * 0.5;
      const hy = rect.top + rect.height * 0.33; // head center
      const dx = e.clientX - hx;
      const dy = e.clientY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const MAX = 2.8;
      setEyeOffset(dist < 10 ? { x: 0, y: 0 } : {
        x: Math.max(-MAX, Math.min(MAX, (dx / dist) * MAX * Math.min(1, dist / 180))),
        y: Math.max(-MAX, Math.min(MAX, (dy / dist) * MAX * Math.min(1, dist / 180))),
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ── Idle look-around (when mouse hasn't moved for 5s) ────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastMoveRef.current > 5000) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1.2 + Math.random() * 1.4;
        setEyeOffset({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        setTimeout(() => {
          if (Date.now() - lastMoveRef.current > 5000) {
            setEyeOffset({ x: 0, y: 0 });
          }
        }, 900 + Math.random() * 1000);
      }
    }, 4500 + Math.random() * 2000);
    return () => clearInterval(iv);
  }, []);

  // ── Natural blinking ─────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const doBlink = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); doBlink(); }, 135);
      }, 2400 + Math.random() * 3600);
    };
    doBlink();
    return () => clearTimeout(timer);
  }, []);

  // ── Route-based mood ─────────────────────────────────────────────────────
  useEffect(() => {
    applyMood(ROUTE_MOODS[router.pathname] || 'idle');
    setCustomMsg('');
  }, [router.pathname]);

  // ── Credits-based mood ───────────────────────────────────────────────────
  useEffect(() => {
    const credits = user?.credits_balance ?? null;
    if (credits === null) return;
    if (credits === 0) applyMood('sad');
    else if (credits < 5) applyMood('worried');
  }, [user?.credits_balance]);

  // ── Seasonal + first-time user ───────────────────────────────────────────
  useEffect(() => {
    if (router.pathname !== '/dashboard') return;
    const msg = SEASONAL_MSGS[month];
    if (user && !user.posting_streak && !user.total_posts_this_month) {
      const key = 'pc_first_encourage_shown';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        const t1 = setTimeout(() => { applyMood('first_encouragement'); setCustomMsg(MOODS.first_encouragement.msg); }, 3200);
        const t2 = setTimeout(() => { applyMood('idle'); setCustomMsg(msg || ''); }, 10000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    }
    if (msg) setCustomMsg(msg);
    return () => setCustomMsg('');
  }, [router.pathname, user?.posting_streak, user?.total_posts_this_month]);

  // ── Streak milestones ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const streak = user.posting_streak || 0;
    const totalPosts = user.total_posts_this_month || 0;
    const key = `ms_${streak}_${totalPosts}`;
    if (sessionStorage.getItem(key)) return;
    let milestoneMsg = null;
    if (streak === 30) milestoneMsg = MILESTONE_MSGS.streak_30;
    else if (streak === 7) milestoneMsg = MILESTONE_MSGS.streak_7;
    else if (streak === 3) milestoneMsg = MILESTONE_MSGS.streak_3;
    if (milestoneMsg) {
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        applyMood('celebrating'); setCustomMsg(milestoneMsg);
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      }, 2000);
    }
  }, [user?.posting_streak]);

  // ── Monthly post-count milestones ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const total = user.total_posts_this_month || 0;
    if (total < 10) return;
    const key = `ms_posts_${total}`;
    if (sessionStorage.getItem(key)) return;
    let msg = null;
    if (total >= 50) msg = MILESTONE_MSGS.posts_50;
    else if (total >= 25) msg = MILESTONE_MSGS.posts_25;
    else if (total >= 10) msg = MILESTONE_MSGS.posts_10;
    if (msg) {
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        applyMood('celebrating'); setCustomMsg(msg);
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      }, 1800);
    }
  }, [user?.total_posts_this_month]);

  // ── Event-based mood ─────────────────────────────────────────────────────
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
      if (m === 'viral') {
        setTimeout(() => applyMood('celebrating'), 5000);
        setTimeout(() => applyMood('happy'), 8500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 12000);
        return;
      }
      if (['celebrating', 'excited'].includes(m)) {
        setTimeout(() => applyMood('happy'), 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
        return;
      }
      if (m === 'happy') {
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 5500);
      }
    };
    window.addEventListener('postcoreMood', handler);
    return () => window.removeEventListener('postcoreMood', handler);
  }, []);

  // ── Click handler: celebrate! ────────────────────────────────────────────
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

  // Eye ry: blink overrides squint overrides normal
  const eyeRy = blinking ? 0.4 : (m.squint ? m.eyeRy : m.eyeRy);
  const eyeRyDisplay = blinking ? 0.4 : m.eyeRy;

  // Arm animation: hover overrides mood
  const armRAnim = hovered ? 'pc2-arm-wave-r' : m.armR;
  const armLAnim = m.armL;

  const bodyAnim = m.bodyAnim;
  const bodyDuration = {
    'pc2-idle': '3.2s', 'pc2-bounce-gentle': '1.6s', 'pc2-bounce-big': '0.9s',
    'pc2-excited': '0.8s', 'pc2-wiggle': '0.52s', 'pc2-float-slow': '4s',
    'pc2-pulse-zoom': '0.58s',
  }[bodyAnim] || '3.2s';

  return (
    <div style={{
      padding: '10px 0 6px',
      borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 800ms ease',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: PC_CSS }} />

      {/* ── Tooltip ──────────────────────────────────────────────────────── */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          width: 192,
          background: t.isDark ? 'rgba(10,8,24,0.97)' : 'rgba(255,255,255,0.98)',
          border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.25)'}`,
          borderRadius: 13,
          padding: '10px 13px',
          fontSize: 11.5,
          color: t.text,
          fontWeight: 500,
          lineHeight: 1.55,
          boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          zIndex: 400,
          textAlign: 'center',
          animation: 'pc2-tooltip-in 200ms ease both',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          pointerEvents: 'none',
        }}>
          <span style={{ color: t.primary, fontWeight: 700, display: 'block', marginBottom: 3, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>PostCore</span>
          {tooltipMsg}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, overflow: 'hidden' }}>
            <div style={{ width: 10, height: 10, background: t.isDark ? 'rgba(10,8,24,0.97)' : 'rgba(255,255,255,0.98)', border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.25)'}`, transform: 'rotate(45deg) translateY(-5px)' }} />
          </div>
        </div>
      )}

      {/* ── The character ─────────────────────────────────────────────────── */}
      <div
        ref={mascotRef}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 72, height: 90,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          position: 'relative',
        }}
      >
        {/* Click ripple */}
        {clickFlash && (
          <div style={{
            position: 'absolute',
            top: '28%', left: '50%',
            width: 48, height: 48,
            marginLeft: -24, marginTop: -24,
            borderRadius: '50%',
            border: `2px solid ${t.primary}`,
            animation: 'pc2-click-ripple 0.5s ease-out both',
            pointerEvents: 'none',
            zIndex: 10,
          }} />
        )}

        <svg
          viewBox="0 0 80 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Head + body gradient */}
            <radialGradient id="pc2-head-g" cx="36%" cy="28%" r="72%">
              <stop offset="0%"  stopColor="#C4B5FD" />
              <stop offset="48%" stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#4A28D4" />
            </radialGradient>
            {/* Body gradient (slightly darker) */}
            <radialGradient id="pc2-body-g" cx="40%" cy="25%" r="80%">
              <stop offset="0%"  stopColor="#9D7CF8" />
              <stop offset="60%" stopColor="#6035D4" />
              <stop offset="100%" stopColor="#3B1FB0" />
            </radialGradient>
            {/* Glow filter */}
            <filter id="pc2-glow-f" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Body anim wrapper */}
          <g style={{ animation: `${bodyAnim} ${bodyDuration} ease-in-out infinite`, transformOrigin: '40px 50px' }}>

            {/* Ground shadow */}
            <ellipse cx="40" cy="98" rx="16" ry="2.8" fill="rgba(0,0,0,0.10)" />

            {/* ── Left arm (behind body) ─────────────────────────────── */}
            <g style={{
              transformBox: 'view-box',
              transformOrigin: '22px 57px',
              animation: `${armLAnim} ${armLAnim.includes('cele') ? '0.7s' : armLAnim.includes('wave') ? '0.65s' : '3.4s'} ease-in-out infinite`,
            }}>
              <rect x="9" y="57" width="14" height="24" rx="7" fill="url(#pc2-body-g)" />
              {/* Hand */}
              <circle cx="16" cy="84" r="7.5" fill="#7C5CFC" />
              <circle cx="14" cy="82" r="2.5" fill="#9D7CF8" opacity="0.6" />
            </g>

            {/* ── Right arm (behind body) ────────────────────────────── */}
            <g style={{
              transformBox: 'view-box',
              transformOrigin: '58px 57px',
              animation: `${armRAnim} ${armRAnim.includes('cele') ? '0.7s' : armRAnim.includes('wave') ? '0.6s' : '3.4s'} ease-in-out infinite`,
            }}>
              <rect x="57" y="57" width="14" height="24" rx="7" fill="url(#pc2-body-g)" />
              {/* Hand */}
              <circle cx="64" cy="84" r="7.5" fill="#7C5CFC" />
              <circle cx="62" cy="82" r="2.5" fill="#9D7CF8" opacity="0.6" />
            </g>

            {/* ── Body ──────────────────────────────────────────────────── */}
            <rect x="21" y="52" width="38" height="26" rx="12" fill="url(#pc2-body-g)" />
            {/* Body specular */}
            <ellipse cx="33" cy="56" rx="10" ry="3.5" fill="rgba(255,255,255,0.14)" transform="rotate(-10 33 56)" />
            {/* Chest badge */}
            <rect x="33" y="59" width="14" height="11" rx="4" fill="rgba(255,255,255,0.12)" />
            <text x="40" y="67.5" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="5.5" fontWeight="700" fontFamily="system-ui, sans-serif">PC</text>

            {/* ── Legs ──────────────────────────────────────────────────── */}
            <rect x="26" y="75" width="12" height="18" rx="6" fill="#4A28D4" />
            <rect x="42" y="75" width="12" height="18" rx="6" fill="#4A28D4" />
            {/* Shoe tips */}
            <ellipse cx="32" cy="93" rx="8" ry="4" fill="#3B1FB0" />
            <ellipse cx="48" cy="93" rx="8" ry="4" fill="#3B1FB0" />

            {/* ── Head ──────────────────────────────────────────────────── */}
            <circle cx="40" cy="30" r="26" fill="url(#pc2-head-g)" />
            {/* Head specular */}
            <ellipse cx="30" cy="18" rx="10" ry="6" fill="rgba(255,255,255,0.20)" transform="rotate(-20 30 18)" />
            {/* Neck join */}
            <ellipse cx="40" cy="54" rx="10" ry="4" fill="url(#pc2-body-g)" />

            {/* ── Glow halo ─────────────────────────────────────────────── */}
            <circle cx="40" cy="30" r="26" fill="none" stroke={m.glow} strokeWidth="6" opacity="0.5" style={{ filter: 'blur(4px)' }} />

            {/* ── Sparkle particles ─────────────────────────────────────── */}
            {m.sparkle && (<>
              <g style={{ transformOrigin: '62px 8px', animation: 'pc2-star-a 1.9s ease-in-out infinite' }}>
                <path d="M62 5 L63.4 7.6 L66 8 L64 10 L64.5 12.8 L62 11.4 L59.5 12.8 L60 10 L58 8 L60.7 7.6 Z" fill="#FCD34D" />
              </g>
              <g style={{ transformOrigin: '10px 14px', animation: 'pc2-star-b 2.4s ease-in-out infinite 0.3s' }}>
                <path d="M10 11 L11.3 13.6 L14 14 L12 16 L12.5 18.8 L10 17.4 L7.5 18.8 L8 16 L6 14 L8.8 13.6 Z" fill="#F9A8D4" />
              </g>
              <g style={{ transformOrigin: '66px 22px', animation: 'pc2-star-c 2.7s ease-in-out infinite 0.6s' }}>
                <circle cx="66" cy="22" r="3" fill="#A78BFA" />
              </g>
              <g style={{ transformOrigin: '8px 38px', animation: 'pc2-star-d 2.1s ease-in-out infinite 0.9s' }}>
                <circle cx="8" cy="38" r="2.5" fill="#6EE7B7" />
              </g>
            </>)}

            {/* ── Blush cheeks ──────────────────────────────────────────── */}
            {m.blush && (<>
              <ellipse cx="18" cy="37" rx="6.5" ry="4" fill="rgba(251,113,133,0.40)" />
              <ellipse cx="62" cy="37" rx="6.5" ry="4" fill="rgba(251,113,133,0.40)" />
            </>)}

            {/* ── Left eye ──────────────────────────────────────────────── */}
            <ellipse cx="32" cy="30" rx="6" ry={eyeRyDisplay} fill="white" />
            {!blinking && (<>
              <circle cx={32 + eyeOffset.x} cy={30 + eyeOffset.y} r="3.1" fill="#180A4A" />
              <circle cx={33 + eyeOffset.x} cy={29 + eyeOffset.y} r="1.3" fill="white" />
            </>)}

            {/* ── Right eye ─────────────────────────────────────────────── */}
            <ellipse cx="48" cy="30" rx="6" ry={eyeRyDisplay} fill="white" />
            {!blinking && (<>
              <circle cx={48 + eyeOffset.x} cy={30 + eyeOffset.y} r="3.1" fill="#180A4A" />
              <circle cx={49 + eyeOffset.x} cy={29 + eyeOffset.y} r="1.3" fill="white" />
            </>)}

            {/* ── Eyebrows ──────────────────────────────────────────────── */}
            <path d={m.browsL} stroke="rgba(255,255,255,0.90)" strokeWidth="2.4" strokeLinecap="round" />
            <path d={m.browsR} stroke="rgba(255,255,255,0.90)" strokeWidth="2.4" strokeLinecap="round" />

            {/* ── Mouth ─────────────────────────────────────────────────── */}
            <path d={m.mouth} stroke="rgba(255,255,255,0.96)" strokeWidth="2.4" strokeLinecap="round" fill="none" />

            {/* ── Sweat drop (worried mood) ──────────────────────────────── */}
            {mood === 'worried' && (
              <g style={{ animation: 'pc2-sweat 1.1s ease-in-out infinite' }}>
                <circle cx="58" cy="18" r="2.5" fill="#93C5FD" opacity="0.85" />
                <path d="M 58 12 Q 61 15 58 18" fill="#93C5FD" opacity="0.7" />
              </g>
            )}

            {/* ── Seasonal accessory ────────────────────────────────────── */}
            <SeasonalAccessory month={month} />

          </g>{/* end body anim group */}
        </svg>
      </div>

      {/* Label */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: t.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
        textTransform: 'uppercase',
        marginTop: 1,
        marginBottom: 5,
      }}>
        PostCore
      </div>
    </div>
  );
}
