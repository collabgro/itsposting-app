import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/theme';

// Call this from any page to change PostCore's mood
export function setMascotMood(mood, message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { mood, message } }));
  }
}

// Trigger a milestone celebration (e.g. 'first_post', 'streak_7', 'posts_10')
export function triggerMilestone(milestone) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('postcoreMood', { detail: { milestone } }));
  }
}

const MOODS = {
  idle: {
    anim: 'pc-float',
    eyeRy: 5.5,
    squint: false,
    browsL: 'M 17 21 Q 23 18 29 21',
    browsR: 'M 35 21 Q 41 18 47 21',
    mouth: 'M 22 43 Q 32 48 42 43',
    blush: false, sparkle: false,
    pupils: [0, 0],
    glow: 'rgba(79,47,214,0.28)',
    msg: "What are we posting today?",
  },
  happy: {
    anim: 'pc-bounce-gentle',
    eyeRy: 5.5,
    squint: true,
    browsL: 'M 17 19 Q 23 15 29 19',
    browsR: 'M 35 19 Q 41 15 47 19',
    mouth: 'M 18 40 Q 32 55 46 40',
    blush: true, sparkle: false,
    pupils: [0, 0],
    glow: 'rgba(124,92,252,0.38)',
    msg: "Looking great! Keep that streak going!",
  },
  thinking: {
    anim: 'pc-float-slow',
    eyeRy: 5.5,
    squint: false,
    browsL: 'M 17 19 Q 23 15 29 22',
    browsR: 'M 35 22 Q 41 15 47 19',
    mouth: 'M 24 43 Q 32 46 40 43',
    blush: false, sparkle: true,
    pupils: [2, -2],
    glow: 'rgba(99,102,241,0.22)',
    msg: "Working on something great for you...",
  },
  celebrating: {
    anim: 'pc-bounce-big',
    eyeRy: 5.5,
    squint: true,
    browsL: 'M 17 16 Q 23 12 29 16',
    browsR: 'M 35 16 Q 41 12 47 16',
    mouth: 'M 16 37 Q 32 57 48 37',
    blush: true, sparkle: true,
    pupils: [0, 0],
    glow: 'rgba(124,92,252,0.55)',
    msg: "Yes! That's what I'm talking about! 🎉",
  },
  worried: {
    anim: 'pc-wiggle',
    eyeRy: 5,
    squint: false,
    browsL: 'M 17 23 Q 23 18 29 21',
    browsR: 'M 35 21 Q 41 18 47 23',
    mouth: 'M 22 46 Q 32 40 42 46',
    blush: false, sparkle: false,
    pupils: [0, 2],
    glow: 'rgba(234,179,8,0.28)',
    msg: "Running low on credits — let's top up!",
  },
  sad: {
    anim: 'pc-float-slow',
    eyeRy: 4.5,
    squint: false,
    browsL: 'M 17 22 Q 23 20 29 22',
    browsR: 'M 35 22 Q 41 20 47 22',
    mouth: 'M 22 47 Q 32 40 42 47',
    blush: false, sparkle: false,
    pupils: [0, 3],
    glow: 'rgba(79,47,214,0.10)',
    msg: "Out of credits. Tap to upgrade and keep going!",
  },
  excited: {
    anim: 'pc-bounce-fast',
    eyeRy: 7,
    squint: false,
    browsL: 'M 17 15 Q 23 11 29 15',
    browsR: 'M 35 15 Q 41 11 47 15',
    mouth: 'M 16 38 Q 32 55 48 38',
    blush: true, sparkle: true,
    pupils: [0, 0],
    glow: 'rgba(124,92,252,0.48)',
    msg: "Let's make something amazing together!",
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

// Seasonal messages by month (1-12)
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

// Milestone messages (triggered by milestone type)
const MILESTONE_MSGS = {
  first_post:    "Your first post! You're officially on the map. Keep it going! 🎉",
  streak_3:      "3-day posting streak! Consistency is what beats the algorithm.",
  streak_7:      "7-day streak! That's one full week — your audience will notice.",
  streak_30:     "30-day streak! You're in the top 1% of consistent posters. Incredible!",
  posts_10:      "10 posts created! Your local reach is growing every single week.",
  posts_25:      "25 posts! PostCore is proud of you. Your business is showing up.",
  posts_50:      "50 posts! You've built a real content presence. Local customers see you.",
  posts_100:     "100 posts! That's a full year of showing up. Your community knows you.",
};

const PC_CSS = `
@keyframes pc-float {
  0%,100% { transform: translateY(0) rotate(-1deg); }
  50%      { transform: translateY(-5px) rotate(1deg); }
}
@keyframes pc-bounce-gentle {
  0%,100% { transform: translateY(0) scale(1); }
  40%     { transform: translateY(-7px) scale(1.04); }
  70%     { transform: translateY(-2px) scale(0.98); }
}
@keyframes pc-bounce-big {
  0%,100% { transform: translateY(0) scale(1) rotate(0); }
  20%     { transform: translateY(-14px) scale(1.1) rotate(-4deg); }
  45%     { transform: translateY(-5px) scale(1.04) rotate(2deg); }
  65%     { transform: translateY(-10px) scale(1.07) rotate(-2deg); }
  85%     { transform: translateY(-2px) scale(1.02); }
}
@keyframes pc-bounce-fast {
  0%,100% { transform: translateY(0) scale(1); }
  30%     { transform: translateY(-9px) scale(1.06); }
  65%     { transform: translateY(-3px) scale(1.02); }
}
@keyframes pc-float-slow {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-3px); }
}
@keyframes pc-wiggle {
  0%,100% { transform: rotate(0) translateX(0); }
  12%     { transform: rotate(-5deg) translateX(-3px); }
  34%     { transform: rotate(5deg) translateX(3px); }
  50%     { transform: rotate(-3deg) translateX(-2px); }
  68%     { transform: rotate(4deg) translateX(2px); }
  84%     { transform: rotate(-2deg); }
}
@keyframes pc-star-a {
  0%,100% { transform: translate(0,0) scale(0.85) rotate(0deg); opacity: 0.75; }
  50%     { transform: translate(5px,-9px) scale(1.1) rotate(90deg); opacity: 1; }
}
@keyframes pc-star-b {
  0%,100% { transform: translate(0,0) scale(0.65); opacity: 0.55; }
  50%     { transform: translate(-5px,-7px) scale(0.9); opacity: 0.95; }
}
@keyframes pc-star-c {
  0%,100% { transform: translate(0,0) scale(0.55) rotate(0deg); opacity: 0.45; }
  50%     { transform: translate(3px,-11px) scale(0.85) rotate(180deg); opacity: 0.85; }
}
@keyframes pc-tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.94); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
}
.pc-float        { animation: pc-float 3s ease-in-out infinite; }
.pc-bounce-gentle{ animation: pc-bounce-gentle 1.7s ease-in-out infinite; }
.pc-bounce-big   { animation: pc-bounce-big 0.95s ease-in-out infinite; }
.pc-bounce-fast  { animation: pc-bounce-fast 0.72s ease-in-out infinite; }
.pc-float-slow   { animation: pc-float-slow 4.2s ease-in-out infinite; }
.pc-wiggle       { animation: pc-wiggle 0.55s ease-in-out infinite; }
`;

export default function PostCoreMascot({ user }) {
  const { t } = useTheme();
  const router = useRouter();
  const [mood, setMood] = useState('idle');
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  const applyMood = (m) => { if (MOODS[m]) setMood(m); };

  // Fade in after sidebar loads
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  // Route-based mood
  useEffect(() => {
    const rm = ROUTE_MOODS[router.pathname];
    applyMood(rm || 'idle');
    setCustomMsg('');
  }, [router.pathname]);

  // Credits-based mood override
  useEffect(() => {
    const credits = user?.credits_balance ?? null;
    if (credits === null) return;
    if (credits === 0) applyMood('sad');
    else if (credits < 5) applyMood('worried');
  }, [user?.credits_balance]);

  // Seasonal idle message — shown when on dashboard and no other override
  useEffect(() => {
    if (router.pathname !== '/dashboard') return;
    const month = new Date().getMonth() + 1;
    const msg = SEASONAL_MSGS[month];
    if (msg) setCustomMsg(msg);
    return () => setCustomMsg('');
  }, [router.pathname]);

  // Milestone detection from user profile (posting_streak, total posts)
  useEffect(() => {
    if (!user) return;
    const streak = user.posting_streak || 0;
    const totalPosts = user.total_posts_this_month || 0;
    // Only show each milestone once per session (track in sessionStorage)
    const key = `milestone_shown_${streak}_${totalPosts}`;
    if (sessionStorage.getItem(key)) return;
    let milestoneMsg = null;
    if (streak === 30) milestoneMsg = MILESTONE_MSGS.streak_30;
    else if (streak === 7) milestoneMsg = MILESTONE_MSGS.streak_7;
    else if (streak === 3) milestoneMsg = MILESTONE_MSGS.streak_3;
    if (milestoneMsg) {
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        applyMood('celebrating');
        setCustomMsg(milestoneMsg);
        setTimeout(() => { applyMood('happy'); }, 3500);
        setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
      }, 2000);
    }
  }, [user?.posting_streak]);

  // Event-based mood (dispatched from wizard/quick-post/etc)
  useEffect(() => {
    const handler = (e) => {
      const { mood: m, message, milestone } = e.detail || {};
      // Handle milestone events
      if (milestone && MILESTONE_MSGS[milestone]) {
        const msg = MILESTONE_MSGS[milestone];
        applyMood('celebrating');
        setCustomMsg(msg);
        const t1 = setTimeout(() => applyMood('happy'), 3500);
        const t2 = setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
      if (!m || !MOODS[m]) return;
      applyMood(m);
      if (message) setCustomMsg(message);
      if (['celebrating', 'excited'].includes(m)) {
        const t1 = setTimeout(() => applyMood('happy'), 3500);
        const t2 = setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 7500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
      if (m === 'happy') {
        const t1 = setTimeout(() => { applyMood('idle'); setCustomMsg(''); }, 5500);
        return () => clearTimeout(t1);
      }
    };
    window.addEventListener('postcoreMood', handler);
    return () => window.removeEventListener('postcoreMood', handler);
  }, []);

  const m = MOODS[mood];
  const tooltipMsg = customMsg || m.msg;

  // Squint clipPath: bottom-half rect at the eye center line y=30
  // clips eye to a D-shape (flat top, round bottom) = happy squint
  const lClip = `pc-sq-l-${mood}`;
  const rClip = `pc-sq-r-${mood}`;

  return (
    <div style={{
      padding: '8px 0 4px',
      borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 700ms ease',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: PC_CSS }} />

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          width: 188,
          background: t.isDark ? 'rgba(15,12,30,0.96)' : 'rgba(255,255,255,0.97)',
          border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.32)' : 'rgba(124,92,252,0.22)'}`,
          borderRadius: 12,
          padding: '10px 13px',
          fontSize: 11.5,
          color: t.text,
          fontWeight: 500,
          lineHeight: 1.5,
          boxShadow: '0 10px 28px rgba(0,0,0,0.20)',
          zIndex: 400,
          textAlign: 'center',
          animation: 'pc-tooltip-in 180ms ease both',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>
          <span style={{ color: t.primary, fontWeight: 700 }}>PostCore </span>
          {tooltipMsg}
          {/* Caret */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%',
            transform: 'translateX(-50%)',
            width: 10, height: 6, overflow: 'hidden',
          }}>
            <div style={{
              width: 10, height: 10,
              background: t.isDark ? 'rgba(15,12,30,0.96)' : 'rgba(255,255,255,0.97)',
              border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.32)' : 'rgba(124,92,252,0.22)'}`,
              transform: 'rotate(45deg) translateY(-5px)',
            }} />
          </div>
        </div>
      )}

      {/* The mascot */}
      <div
        className={m.anim}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 52, height: 52,
          cursor: 'default',
          filter: `drop-shadow(0 3px 12px ${m.glow})`,
          userSelect: 'none',
        }}
      >
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <radialGradient id="pc-hg" cx="38%" cy="30%" r="72%">
              <stop offset="0%"   stopColor="#B09AFF" />
              <stop offset="50%"  stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#4A28D4" />
            </radialGradient>
            {/* Squint clipPaths — clip eye to bottom half (flat top = squint) */}
            {m.squint && (
              <>
                <clipPath id={lClip}>
                  <rect x={23 - m.eyeRy - 1} y="30" width={m.eyeRy * 2 + 2} height={m.eyeRy + 2} />
                </clipPath>
                <clipPath id={rClip}>
                  <rect x={41 - m.eyeRy - 1} y="30" width={m.eyeRy * 2 + 2} height={m.eyeRy + 2} />
                </clipPath>
              </>
            )}
          </defs>

          {/* Ground shadow */}
          <ellipse cx="32" cy="61" rx="13" ry="2.5" fill="rgba(0,0,0,0.09)" />

          {/* Head */}
          <circle cx="32" cy="33" r="25" fill="url(#pc-hg)" />

          {/* Specular highlight */}
          <ellipse cx="22" cy="20" rx="9" ry="5.5"
            fill="rgba(255,255,255,0.18)"
            transform="rotate(-25 22 20)" />

          {/* Sparkle stars */}
          {m.sparkle && (<>
            <g style={{ transformOrigin: '52px 11px', animation: 'pc-star-a 1.85s ease-in-out infinite' }}>
              <path d="M52 8 L53.3 10.6 L56 11 L54 13 L54.5 15.8 L52 14.4 L49.5 15.8 L50 13 L48 11 L50.7 10.6 Z"
                fill="#FCD34D" />
            </g>
            <g style={{ transformOrigin: '10px 17px', animation: 'pc-star-b 2.3s ease-in-out infinite' }}>
              <path d="M10 14 L11.2 16.6 L14 17 L12 19 L12.5 21.8 L10 20.4 L7.5 21.8 L8 19 L6 17 L8.8 16.6 Z"
                fill="#F9A8D4" />
            </g>
            <g style={{ transformOrigin: '57px 25px', animation: 'pc-star-c 2.6s ease-in-out infinite' }}>
              <circle cx="57" cy="25" r="2.5" fill="#A78BFA" />
            </g>
          </>)}

          {/* Blush */}
          {m.blush && (<>
            <ellipse cx="13" cy="39" rx="6" ry="4" fill="rgba(251,113,133,0.38)" />
            <ellipse cx="51" cy="39" rx="6" ry="4" fill="rgba(251,113,133,0.38)" />
          </>)}

          {/* Left eye */}
          {m.squint ? (
            <ellipse cx="23" cy="30" rx={m.eyeRy} ry={m.eyeRy}
              fill="white" clipPath={`url(#${lClip})`} />
          ) : (
            <ellipse cx="23" cy="30" rx={m.eyeRy} ry={m.eyeRy} fill="white" />
          )}
          <circle cx={23 + m.pupils[0]} cy={30 + m.pupils[1]} r="2.9" fill="#1a0a5c" />
          <circle cx={24.2 + m.pupils[0]} cy={28.7 + m.pupils[1]} r="1.2" fill="white" />

          {/* Right eye */}
          {m.squint ? (
            <ellipse cx="41" cy="30" rx={m.eyeRy} ry={m.eyeRy}
              fill="white" clipPath={`url(#${rClip})`} />
          ) : (
            <ellipse cx="41" cy="30" rx={m.eyeRy} ry={m.eyeRy} fill="white" />
          )}
          <circle cx={41 + m.pupils[0]} cy={30 + m.pupils[1]} r="2.9" fill="#1a0a5c" />
          <circle cx={42.2 + m.pupils[0]} cy={28.7 + m.pupils[1]} r="1.2" fill="white" />

          {/* Eyebrows */}
          <path d={m.browsL} stroke="rgba(255,255,255,0.88)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={m.browsR} stroke="rgba(255,255,255,0.88)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Mouth */}
          <path d={m.mouth} stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Label */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.07em',
        color: t.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
        textTransform: 'uppercase',
        marginTop: 2,
        marginBottom: 5,
      }}>
        PostCore
      </div>
    </div>
  );
}
