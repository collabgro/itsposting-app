import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { useBranding } from '../lib/branding';
import { calendarPlansAPI, customerAPI } from '../lib/api';
import {
  IpSparkle, IpClose, IpDelete, IpArrowRight, IpAnalytics,
  IpCalendar, IpChevronRight, IpArrowLeft, IpPlus,
  IpPhoto, IpCarousel, IpVideo, IpTextCard,
} from '../components/icons';

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: 'photo_post', label: 'Photo',    color: '#3B82F6', Icon: IpPhoto },
  { value: 'carousel',   label: 'Carousel', color: '#7C5CFC', Icon: IpCarousel },
  { value: 'video',      label: 'Video',    color: '#EF4444', Icon: IpVideo },
  { value: 'text_card',  label: 'Text',     color: '#22C55E', Icon: IpTextCard },
  { value: 'story',      label: 'Story',    color: '#F97316', Icon: IpSparkle },
];

const STATUS_CFG = {
  planned:   { label: 'Planned',   dot: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.18)' },
  briefed:   { label: 'Briefed',   dot: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.22)'  },
  scheduled: { label: 'Scheduled', dot: '#7C5CFC', bg: 'rgba(124,92,252,0.10)', border: 'rgba(124,92,252,0.25)'  },
  published: { label: 'Published', dot: '#22C55E', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.22)'   },
  skipped:   { label: 'Skipped',   dot: '#4B5563', bg: 'rgba(75,85,99,0.06)',    border: 'rgba(75,85,99,0.12)'    },
};

const PLATFORMS = [
  { value: 'facebook',        label: 'Facebook',    abbr: 'FB',  color: '#1877F2' },
  { value: 'instagram',       label: 'Instagram',   abbr: 'IG',  color: '#E1306C' },
  { value: 'google_business', label: 'Google Biz',  abbr: 'GB',  color: '#34A853' },
  { value: 'linkedin',        label: 'LinkedIn',    abbr: 'LI',  color: '#0A66C2' },
  { value: 'tiktok',          label: 'TikTok',      abbr: 'TT',  color: '#000000' },
];

const POST_MIX_TYPES = [
  { key: 'photo_post', label: 'Photo Posts',  color: '#3B82F6', desc: 'Before/after, job showcase' },
  { key: 'text_card',  label: 'Text Cards',   color: '#22C55E', desc: 'Tips, FAQs, quick advice' },
  { key: 'carousel',   label: 'Carousels',    color: '#7C5CFC', desc: 'Step-by-step, multiple tips' },
  { key: 'video',      label: 'Video Posts',  color: '#EF4444', desc: 'Process reveals, walk-throughs' },
];

const CONTENT_ANGLE_CFG = {
  educational:  { label: 'Educational',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
  social_proof: { label: 'Social Proof', color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)'  },
  promotional:  { label: 'Promotional',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
};

const MONTH_NAMES    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const LOADING_MESSAGES = [
  'Checking seasonal trends for your industry…',
  'Identifying your customers\' biggest pain points…',
  'Selecting high-engagement content angles…',
  'Crafting scroll-stopping hooks…',
  'Writing platform-optimised captions…',
  'Adding local references for your area…',
  'Balancing the 70/20/10 content mix…',
  'Scheduling posts for maximum reach…',
  'Running the AI quality check…',
  'Finalising your content plan…',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2,'0'); }
function toStr(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function typeColor(ct) { return CONTENT_TYPES.find(c => c.value === ct)?.color || '#9CA3AF'; }
function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function firstDayOfWeek(y, m) { return new Date(y, m, 1).getDay(); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtPeriodLabel(view, anchor) {
  const d = new Date(anchor + 'T00:00:00');
  if (view === 'monthly') return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  const days = view === 'weekly' ? 6 : 9;
  const end  = new Date(anchor + 'T00:00:00');
  end.setDate(end.getDate() + days);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)} – ${fmt(end)}, ${d.getFullYear()}`;
}

function shiftAnchor(view, anchor, dir) {
  const d = new Date(anchor + 'T00:00:00');
  if (view === 'monthly') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else if (view === 'weekly') { d.setDate(d.getDate() + dir * 7); }
  else { d.setDate(d.getDate() + dir * 10); }
  return d.toISOString().split('T')[0];
}

function getDates(view, anchor) {
  if (view === 'monthly') {
    const d = new Date(anchor + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth();
    return Array.from({ length: daysInMonth(y, m) }, (_, i) => toStr(y, m, i + 1));
  }
  const days = view === 'weekly' ? 7 : 10;
  return Array.from({ length: days }, (_, i) => addDays(anchor, i));
}

// Parse AI-generated notes JSON, falling back to plain text
function parseNotes(notes) {
  try {
    const parsed = JSON.parse(notes || '{}');
    if (parsed.caption) return parsed;
  } catch {}
  return { caption: notes || '', hashtags: [], engagement_question: '', content_angle: 'educational', hook: '' };
}

// Renders the branded SVG icon for a given content type value
function ContentIcon({ type, size = 14, color }) {
  const ct = CONTENT_TYPES.find(c => c.value === type);
  if (!ct?.Icon) return null;
  const Icon = ct.Icon;
  return <Icon size={size} color={color || ct.color} style={{ flexShrink: 0 }} />;
}

// ─── MiniPlanChip ─────────────────────────────────────────────────────────────

function MiniPlanChip({ plan, onClick, t }) {
  const tc   = typeColor(plan.content_type);
  const scfg = STATUS_CFG[plan.status] || STATUS_CFG.planned;
  const ct   = CONTENT_TYPES.find(c => c.value === plan.content_type);
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(plan); }}
      style={{
        borderLeft: `3px solid ${tc}`, background: scfg.bg,
        border: `1px solid ${scfg.border}`, borderLeftColor: tc,
        borderRadius: 7, padding: '4px 8px',
        cursor: 'pointer', marginBottom: 4, transition: 'all 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {plan.title || 'Untitled'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: scfg.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 9.5, color: t.textMuted }}>{scfg.label}</span>
        {ct && <span style={{ fontSize: 9, color: tc, fontWeight: 700, marginLeft: 'auto' }}>{ct.label}</span>}
      </div>
    </div>
  );
}

// ─── DayCell ──────────────────────────────────────────────────────────────────

function DayCell({ dateStr, plans, isToday, isPast, onSelect, onAdd, t, compact }) {
  const [hov, setHov] = useState(false);
  const dayPlans = plans.filter(p => p.plan_date === dateStr);
  const visible  = dayPlans.slice(0, compact ? 2 : 3);
  const overflow = dayPlans.length - visible.length;
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = DAY_NAMES_SHORT[d.getDay()];
  const dayNum  = d.getDate();
  const isEmpty = dayPlans.length === 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, minWidth: 0, borderRadius: 12,
        border: isToday
          ? '2px solid rgba(124,92,252,0.5)'
          : isEmpty && hov
          ? `1.5px dashed rgba(124,92,252,0.4)`
          : `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}`,
        background: isToday
          ? (t.isDark ? 'rgba(124,92,252,0.07)' : 'rgba(124,92,252,0.03)')
          : hov ? (t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent',
        padding: '10px 10px 8px',
        opacity: isPast && !isToday ? 0.45 : 1,
        transition: 'all 120ms', position: 'relative', cursor: 'default',
        minHeight: 120,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dayName}</div>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isToday ? '#7C5CFC' : 'transparent',
            fontSize: 14, fontWeight: isToday ? 800 : 600,
            color: isToday ? '#fff' : t.text, marginTop: 2,
          }}>
            {dayNum}
          </div>
        </div>
        {hov && (
          <button
            onClick={() => onAdd(dateStr)}
            style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(124,92,252,0.8)', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(124,92,252,0.4)' }}
          >
            <IpPlus size={12} />
          </button>
        )}
      </div>

      {isEmpty && hov && !isPast && (
        <div style={{ fontSize: 10, color: 'rgba(124,92,252,0.6)', textAlign: 'center', marginTop: 8, fontWeight: 600 }}>
          Add post
        </div>
      )}

      {visible.map(p => <MiniPlanChip key={p.id} plan={p} onClick={onSelect} t={t} />)}
      {overflow > 0 && (
        <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 3 }}>+{overflow} more</div>
      )}
    </div>
  );
}

// ─── MonthCell ────────────────────────────────────────────────────────────────

function MonthCell({ day, dateStr, plans, isToday, isCurrent, onSelect, onAdd, t }) {
  const [hov, setHov] = useState(false);
  const dayPlans = plans.filter(p => p.plan_date === dateStr);
  const visible  = dayPlans.slice(0, 3);
  const overflow = dayPlans.length - 3;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        minHeight: 90, borderRadius: 8, padding: '6px 7px',
        background: isToday ? 'rgba(124,92,252,0.09)' : hov ? (t.isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)') : 'transparent',
        border: isToday ? '1.5px solid rgba(124,92,252,0.38)' : `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`,
        opacity: isCurrent ? 1 : 0.3, transition: 'background 120ms',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, marginBottom: 5 }}>
        {isToday
          ? <span style={{ background:'#7C5CFC', color:'#fff', borderRadius:'50%', width:22, height:22, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{day}</span>
          : <span style={{ color: t.text }}>{day}</span>
        }
      </div>
      {visible.map(p => <MiniPlanChip key={p.id} plan={p} onClick={onSelect} t={t} />)}
      {overflow > 0 && <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 3 }}>+{overflow} more</div>}
      {hov && isCurrent && (
        <button
          onClick={() => onAdd(dateStr)}
          style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(124,92,252,0.75)', border:'none', color:'#fff', fontSize:16, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <IpPlus size={10} />
        </button>
      )}
    </div>
  );
}

// ─── ContentMixBar ────────────────────────────────────────────────────────────

function ContentMixBar({ plans, t }) {
  if (plans.length === 0) return null;
  const counts = { educational: 0, social_proof: 0, promotional: 0 };
  plans.forEach(p => {
    try {
      const nd = parseNotes(p.notes);
      const angle = nd.content_angle || 'educational';
      if (counts[angle] !== undefined) counts[angle]++;
      else counts.educational++;
    } catch { counts.educational++; }
  });
  const total  = plans.length || 1;
  const eduPct = Math.round((counts.educational  / total) * 100);
  const socPct = Math.round((counts.social_proof / total) * 100);
  const proPct = 100 - eduPct - socPct;
  const mixOk  = Math.abs(eduPct - 70) <= 20;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderRadius:10, background: t.isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)', border:`1px solid ${t.border}`, marginBottom:20, flexWrap:'wrap' }}>
      <div style={{ fontSize:11, fontWeight:700, color: mixOk ? '#22C55E' : '#F59E0B', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>
        {mixOk ? '✓ Good mix' : '⚠ Adjust mix'}
      </div>
      <div style={{ flex:1, minWidth:160, height:6, borderRadius:3, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display:'flex', overflow:'hidden' }}>
        <div style={{ width:`${eduPct}%`, background:'#3B82F6', transition:'width 400ms ease' }} />
        <div style={{ width:`${socPct}%`, background:'#7C5CFC', transition:'width 400ms ease' }} />
        <div style={{ width:`${Math.max(proPct,0)}%`, background:'#F59E0B', transition:'width 400ms ease' }} />
      </div>
      <div style={{ display:'flex', gap:12, fontSize:11, color:t.textMuted, flexShrink:0 }}>
        <span><span style={{ color:'#3B82F6', fontWeight:700 }}>{eduPct}%</span> Edu</span>
        <span><span style={{ color:'#7C5CFC', fontWeight:700 }}>{socPct}%</span> Proof</span>
        <span><span style={{ color:'#F59E0B', fontWeight:700 }}>{Math.max(proPct,0)}%</span> Promo</span>
        <span style={{ color:t.textMuted, opacity:0.6 }}>Target: 70 · 20 · 10</span>
      </div>
    </div>
  );
}

// ─── AI Fill Setup Modal ──────────────────────────────────────────────────────

function AiFillModal({ t, theme, open, onClose, onGenerate, userCredits, periodLabel, view }) {
  const { aiName } = useBranding();
  const [mix, setMix]           = useState({ photo_post: 2, text_card: 2, carousel: 1, video: 0 });
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);

  const totalPosts  = Object.values(mix).reduce((a, b) => a + b, 0);
  const creditCost  = totalPosts;
  const canAfford   = userCredits >= creditCost && totalPosts > 0;
  const noPlatform  = platforms.length === 0;

  const updateMix = (key, delta) => {
    setMix(prev => ({ ...prev, [key]: Math.max(0, Math.min(7, (prev[key] || 0) + delta)) }));
  };
  const togglePlatform = (p) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  if (!open) return null;

  const viewLabel = view === 'monthly' ? 'Month' : view === 'weekly' ? 'Week' : '10 Days';

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1002, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(5px)' }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:1003, width:'min(500px, calc(100vw - 24px))',
        background: t.isDark ? '#0D0D1A' : '#fff',
        borderRadius:20, border:`1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`,
        boxShadow:'0 30px 80px rgba(0,0,0,0.55)',
        display:'flex', flexDirection:'column',
        animation:'fadeScaleIn 200ms cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Header */}
        <div style={{ padding:'20px 22px 16px', borderBottom:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 14px rgba(124,92,252,0.4)' }}>
              <IpSparkle size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:t.text }}>AI Fill {viewLabel}</div>
              <div style={{ fontSize:12, color:t.textMuted, marginTop:1 }}>{periodLabel}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', padding:4, borderRadius:6, marginTop:2 }}>
            <IpClose size={18} />
          </button>
        </div>

        <div style={{ padding:'20px 22px', maxHeight:'62vh', overflowY:'auto' }}>

          {/* Content Mix */}
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              Content Mix
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {POST_MIX_TYPES.map(({ key, label, color, desc }) => (
                <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderRadius:12, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', border:`1px solid ${mix[key] > 0 ? color + '33' : t.border}`, transition:'border 150ms' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><ContentIcon type={key} size={18} color={color} /></div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{label}</div>
                      <div style={{ fontSize:11, color:t.textMuted, marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <button
                      onClick={() => updateMix(key, -1)}
                      disabled={mix[key] === 0}
                      style={{ width:30, height:30, borderRadius:8, background: mix[key] === 0 ? 'transparent' : `${color}18`, border:`1px solid ${mix[key] === 0 ? t.border : color + '55'}`, color: mix[key] === 0 ? t.textMuted : color, fontSize:18, cursor:mix[key]===0?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, opacity:mix[key]===0?0.25:1, transition:'all 150ms' }}
                    >−</button>
                    <span style={{ fontSize:17, fontWeight:800, color: mix[key] > 0 ? color : t.textMuted, minWidth:22, textAlign:'center', transition:'color 150ms' }}>{mix[key]}</span>
                    <button
                      onClick={() => updateMix(key, 1)}
                      style={{ width:30, height:30, borderRadius:8, background:`${color}18`, border:`1px solid ${color}55`, color, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, transition:'all 150ms' }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              Platforms
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => togglePlatform(p.value)}
                  style={{ padding:'7px 15px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', border:`1.5px solid ${platforms.includes(p.value) ? p.color : t.border}`, background: platforms.includes(p.value) ? `${p.color}18` : 'transparent', color: platforms.includes(p.value) ? p.color : t.textMuted, transition:'all 150ms' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {noPlatform && <div style={{ fontSize:11, color:'#EF4444', marginTop:8 }}>Select at least one platform</div>}
          </div>

          {/* PostCore intelligence bullets */}
          <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(124,92,252,0.07)', border:'1px solid rgba(124,92,252,0.18)', marginBottom:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#9B7FFF', marginBottom:8 }}>{aiName} will use:</div>
            {[
              '✓ Seasonal intelligence for your industry this month',
              '✓ Industry-specific pain points & proven hook formulas',
              '✓ 70/20/10 content rotation (edu → proof → promo)',
              '✓ Platform-optimised captions with local references',
            ].map((item, i) => (
              <div key={i} style={{ fontSize:12, color: t.isDark ? 'rgba(200,190,255,0.85)' : '#5B4FD4', marginBottom: i < 3 ? 5 : 0, lineHeight:1.5 }}>{item}</div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 22px', borderTop:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:13 }}>
              <span style={{ color:t.text, fontWeight:700 }}>{totalPosts} post{totalPosts!==1?'s':''}</span>
              <span style={{ color:t.textMuted }}> · </span>
              <span style={{ color: userCredits >= creditCost ? '#22C55E' : '#EF4444', fontWeight:700 }}>{creditCost} credit{creditCost!==1?'s':''}</span>
            </div>
            <div style={{ fontSize:12, color: userCredits >= creditCost ? t.textMuted : '#EF4444', fontWeight:500 }}>
              You have <strong>{userCredits}</strong> credits
            </div>
          </div>

          {totalPosts === 0 && <div style={{ textAlign:'center', fontSize:12, color:'#F59E0B', marginBottom:10 }}>Add at least one post type above</div>}
          {!canAfford && totalPosts > 0 && (
            <div style={{ textAlign:'center', fontSize:12, color:'#EF4444', marginBottom:10 }}>
              Not enough credits — you need {creditCost - userCredits} more
            </div>
          )}
          {noPlatform && totalPosts > 0 && (
            <div style={{ textAlign:'center', fontSize:12, color:'#F59E0B', marginBottom:10 }}>Select at least one platform</div>
          )}

          <button
            onClick={() => canAfford && !noPlatform && onGenerate({ mix, platforms })}
            disabled={!canAfford || noPlatform}
            style={{
              width:'100%', padding:'13px 20px', borderRadius:12, border:'none',
              background: (!canAfford || noPlatform) ? (t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              color: (!canAfford || noPlatform) ? t.textMuted : '#fff',
              fontSize:14, fontWeight:800, cursor:(!canAfford || noPlatform)?'not-allowed':'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:(!canAfford || noPlatform)?'none':'0 4px 18px rgba(124,92,252,0.45)',
              transition:'all 150ms', letterSpacing:'0.01em',
            }}
          >
            <IpSparkle size={16} />
            {canAfford && !noPlatform ? `Generate ${totalPosts} Post${totalPosts!==1?'s':''} →` : 'Set up your plan above'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      `}</style>
    </>
  );
}

// ─── Generating Overlay ───────────────────────────────────────────────────────

function GeneratingOverlay({ t }) {
  const { aiName } = useBranding();
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
    }, 1800);
    const progTimer = setInterval(() => {
      setProgress(p => Math.min(p + 6, 95));
    }, 900);
    return () => { clearInterval(msgTimer); clearInterval(progTimer); };
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1010, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'min(420px, calc(100vw - 32px))', padding:'40px 36px', borderRadius:24, background: t.isDark ? '#0D0D1A' : '#fff', border:`1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, boxShadow:'0 30px 80px rgba(0,0,0,0.5)', textAlign:'center' }}>
        <div style={{ width:60, height:60, borderRadius:18, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 8px 28px rgba(124,92,252,0.5)', animation:'postCorePulse 2s ease-in-out infinite' }}>
          <IpSparkle size={28} color="#fff" />
        </div>
        <div style={{ fontSize:17, fontWeight:800, color:t.text, marginBottom:6 }}>{aiName} is writing…</div>
        <div style={{ fontSize:13, color:t.textMuted, marginBottom:28, minHeight:40, lineHeight:1.5, transition:'opacity 300ms' }}>
          {LOADING_MESSAGES[msgIdx]}
        </div>
        <div style={{ height:5, borderRadius:3, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow:'hidden', marginBottom:20 }}>
          <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#7C5CFC,#9B7FFF)', borderRadius:3, transition:'width 800ms ease' }} />
        </div>
        <div style={{ fontSize:12, color:t.textMuted }}>Using your industry knowledge + seasonal data</div>
      </div>
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ t, plans, onClose, onConfirm }) {
  const [idx,    setIdx]    = useState(0);
  const [kept,   setKept]   = useState(() => new Set(plans.map((_, i) => i)));
  const [saving, setSaving] = useState(false);

  const plan    = plans[idx] || {};
  const isKept  = kept.has(idx);
  const ct      = CONTENT_TYPES.find(c => c.value === plan.content_type);
  const angleCfg= CONTENT_ANGLE_CFG[plan.content_angle] || CONTENT_ANGLE_CFG.educational;
  const hashtags= Array.isArray(plan.hashtags) ? plan.hashtags : [];

  const toggle = () => {
    setKept(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });
  };

  const handleConfirm = async () => {
    setSaving(true);
    const approved = plans.filter((_, i) => kept.has(i));
    await onConfirm(approved);
    setSaving(false);
  };

  const keptCount = kept.size;

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:1004, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(7px)' }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:1005, width:'min(560px, calc(100vw - 24px))',
        background: t.isDark ? '#0D0D1A' : '#fff',
        borderRadius:20, border:`1px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`,
        boxShadow:'0 30px 80px rgba(0,0,0,0.6)',
        display:'flex', flexDirection:'column', maxHeight:'90vh',
        animation:'fadeScaleIn 200ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }`}</style>

        {/* Header */}
        <div style={{ padding:'16px 20px 14px', borderBottom:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:t.text }}>Review your content plan</div>
              <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{plans.length} posts generated — keep what you love</div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', padding:4, borderRadius:6 }}><IpClose size={18} /></button>
          </div>

          {/* Progress dots */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            {plans.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  height:7, width: i === idx ? 22 : 7, borderRadius:4,
                  background: !kept.has(i) ? (t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : i === idx ? '#7C5CFC' : '#22C55E',
                  border:'none', cursor:'pointer', padding:0, transition:'all 200ms',
                  opacity: !kept.has(i) && i !== idx ? 0.35 : 1,
                }}
              />
            ))}
            <span style={{ fontSize:11, color:t.textMuted, marginLeft:8 }}>{idx + 1} of {plans.length}</span>
          </div>
        </div>

        {/* Post content */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          {/* Type + angle + date */}
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:13, flexWrap:'wrap' }}>
            {ct && (
              <span style={{ padding:'3px 10px', borderRadius:20, background:`${ct.color}18`, border:`1px solid ${ct.color}33`, color:ct.color, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <ContentIcon type={plan.content_type} size={11} color={ct.color} /> {ct.label}
              </span>
            )}
            <span style={{ padding:'3px 10px', borderRadius:20, background:angleCfg.bg, border:`1px solid ${angleCfg.color}33`, color:angleCfg.color, fontSize:11, fontWeight:700 }}>
              {angleCfg.label}
            </span>
            <span style={{ fontSize:12, color:t.textMuted, marginLeft:'auto', fontWeight:600 }}>
              {new Date((plan.plan_date || '') + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
            </span>
          </div>

          {/* Platforms */}
          {Array.isArray(plan.platforms) && plan.platforms.length > 0 && (
            <div style={{ display:'flex', gap:6, marginBottom:13, flexWrap:'wrap' }}>
              {plan.platforms.map(p => {
                const pc = PLATFORMS.find(x => x.value === p);
                return pc ? <span key={p} style={{ padding:'2px 9px', borderRadius:20, background:`${pc.color}18`, fontSize:11, fontWeight:700, color:pc.color, border:`1px solid ${pc.color}33` }}>{pc.label}</span> : null;
              })}
            </div>
          )}

          {/* Title */}
          <div style={{ fontSize:15, fontWeight:800, color:t.text, marginBottom:11, lineHeight:1.4 }}>{plan.title || 'Content idea'}</div>

          {/* Hook highlight */}
          {plan.hook && (
            <div style={{ padding:'8px 12px', borderRadius:9, background:'rgba(124,92,252,0.09)', border:'1px solid rgba(124,92,252,0.2)', marginBottom:11, fontSize:12, color:'#9B7FFF', fontWeight:600, lineHeight:1.5, display:'flex', alignItems:'flex-start', gap:6 }}>
              <IpSparkle size={13} color="#9B7FFF" style={{ flexShrink:0, marginTop:1 }} />
              <span>Hook: "{plan.hook}"</span>
            </div>
          )}

          {/* Caption */}
          {plan.caption && (
            <div style={{ padding:'14px 16px', borderRadius:12, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', border:`1px solid ${t.border}`, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Caption</div>
              <div style={{ fontSize:13, color:t.text, lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                {plan.caption.length > 700 ? plan.caption.substring(0, 700) + '…' : plan.caption}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:13 }}>
              {hashtags.slice(0, 15).map((h, i) => (
                <span key={i} style={{ fontSize:11, color:'#7C5CFC', background:'rgba(124,92,252,0.09)', padding:'2px 9px', borderRadius:20, border:'1px solid rgba(124,92,252,0.18)', fontWeight:600 }}>
                  #{(h || '').replace(/^#/, '')}
                </span>
              ))}
            </div>
          )}

          {/* Skip indicator */}
          {!isKept && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.22)', fontSize:12, color:'#EF4444', fontWeight:600, textAlign:'center' }}>
              Marked to skip — no credits charged for this post
            </div>
          )}
        </div>

        {/* Navigation + actions */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}` }}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              style={{ width:36, height:38, borderRadius:10, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border:`1px solid ${t.border}`, color:t.textMuted, cursor:idx===0?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:idx===0?0.3:1 }}
            >
              <IpArrowLeft size={14} />
            </button>

            <button
              onClick={toggle}
              style={{
                flex:1, padding:'9px 16px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
                border:`1.5px solid ${isKept ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.5)'}`,
                background: isKept ? 'rgba(239,68,68,0.09)' : 'rgba(34,197,94,0.09)',
                color: isKept ? '#EF4444' : '#22C55E',
                transition:'all 150ms', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              }}
            >
              {isKept ? '✕  Skip this post' : '✓  Keep this post'}
            </button>

            <button
              onClick={() => setIdx(i => Math.min(plans.length - 1, i + 1))}
              disabled={idx === plans.length - 1}
              style={{ width:36, height:38, borderRadius:10, background:'rgba(124,92,252,0.1)', border:'1px solid rgba(124,92,252,0.3)', color:'#9B7FFF', cursor:idx===plans.length-1?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:idx===plans.length-1?0.35:1 }}
            >
              <IpChevronRight size={14} />
            </button>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, color:t.textMuted }}>
              <span style={{ color:'#22C55E', fontWeight:800 }}>{keptCount}</span> kept
              {keptCount > 0 && <span> · <span style={{ fontWeight:700, color:t.text }}>{keptCount} credit{keptCount!==1?'s':''}</span></span>}
            </div>
            <button
              onClick={handleConfirm}
              disabled={saving || keptCount === 0}
              style={{
                padding:'10px 22px', borderRadius:11, border:'none',
                background: keptCount === 0 ? (t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)') : 'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
                color: keptCount === 0 ? t.textMuted : '#fff',
                fontSize:13, fontWeight:800, cursor:(saving||keptCount===0)?'not-allowed':'pointer',
                display:'flex', alignItems:'center', gap:7,
                boxShadow: keptCount === 0 ? 'none' : '0 4px 16px rgba(124,92,252,0.4)',
                opacity: saving ? 0.7 : 1, transition:'all 150ms',
              }}
            >
              <IpCalendar size={14} />
              {saving ? 'Adding to calendar…' : keptCount === 0 ? 'Skip all' : `Add ${keptCount} post${keptCount!==1?'s':''} to calendar`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Plan Drawer ──────────────────────────────────────────────────────────────

function PlanDrawer({ plan, defaultDate, onClose, onSave, onDelete, onGenerate, t, theme, isMobile }) {
  const { aiName } = useBranding();
  const isNew = !plan?.id;

  // Parse AI-generated notes JSON so the caption field shows cleanly
  const initialNotes = (() => {
    if (!plan?.notes) return '';
    try {
      const parsed = JSON.parse(plan.notes);
      if (parsed.caption) return parsed.caption;
    } catch {}
    return plan.notes;
  })();

  const [form, setForm] = useState({
    title:        plan?.title        || '',
    content_type: plan?.content_type || 'photo_post',
    platforms:    plan?.platforms    || ['facebook','instagram'],
    notes:        initialNotes,
    status:       plan?.status       || 'planned',
    plan_date:    plan?.plan_date    || defaultDate || '',
  });
  const [saving,     setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const togglePlatform = p => set('platforms', form.platforms.includes(p) ? form.platforms.filter(x => x !== p) : [...form.platforms, p]);

  // Try to show hashtags if this is an AI-generated plan
  let aiHashtags = [];
  try { aiHashtags = JSON.parse(plan?.notes || '{}').hashtags || []; } catch {}

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({ ...form });
    setSaving(false);
  };
  const handleGenerate = async () => {
    if (!plan?.id) return;
    setGenerating(true);
    await onGenerate(plan.id);
    setGenerating(false);
  };

  const inp = { width:'100%', padding:'9px 12px', boxSizing:'border-box', background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border:`1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : t.border}`, borderRadius:9, color:t.text, fontSize:13, outline:'none', fontFamily:'inherit' };
  const lbl = { fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:7 };

  const drawerStyle = isMobile ? {
    position:'fixed', bottom:0, left:0, right:0, zIndex:1000, maxHeight:'90vh',
    borderRadius:'20px 20px 0 0',
    background: t.isDark ? '#0F0F18' : t.bg,
    borderTop:`1px solid rgba(255,255,255,0.10)`, boxShadow:'0 -12px 48px rgba(0,0,0,0.6)',
    display:'flex', flexDirection:'column', animation:'slideUp 240ms cubic-bezier(0.16,1,0.3,1)',
  } : {
    position:'fixed', top:0, right:0, bottom:0, width:380, zIndex:1000,
    background: t.isDark ? '#0F0F18' : t.bg,
    borderLeft:`1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : t.border}`, boxShadow:'-8px 0 40px rgba(0,0,0,0.4)',
    display:'flex', flexDirection:'column', animation:'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(3px)' }} />
      <div style={drawerStyle}>
        {isMobile && <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}><div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.2)' }} /></div>}
        <div style={{ padding: isMobile ? '12px 20px' : '18px 20px 14px', borderBottom:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:t.text }}>{isNew ? 'Plan Content' : 'Edit Plan'}</div>
            {form.plan_date && <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{new Date(form.plan_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', padding:4 }}><IpClose size={18} /></button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Content Idea</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Before & after pipe repair job" style={inp} maxLength={200} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Date</label>
            <input type="date" value={form.plan_date} onChange={e => set('plan_date', e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Content Type</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {CONTENT_TYPES.map(ct => (
                <button key={ct.value} onClick={() => set('content_type', ct.value)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, border:`1px solid ${form.content_type === ct.value ? ct.color : t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`, background: form.content_type === ct.value ? `${ct.color}22` : 'transparent', color: form.content_type === ct.value ? ct.color : t.textMuted, transition:'all 120ms' }}>
                  <ContentIcon type={ct.value} size={12} color={form.content_type === ct.value ? ct.color : t.textMuted} /> {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Platforms</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => togglePlatform(p.value)} style={{ padding:'5px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${form.platforms.includes(p.value) ? '#7C5CFC' : t.isDark ? 'rgba(255,255,255,0.1)' : t.border}`, background: form.platforms.includes(p.value) ? 'rgba(124,92,252,0.15)' : 'transparent', color: form.platforms.includes(p.value) ? '#9B7FFF' : t.textMuted, transition:'all 120ms' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Content Brief / Caption</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What should this post be about? Your AI advisor uses this when you generate."
              style={{ ...inp, height:100, resize:'vertical', lineHeight:1.6 }} maxLength={5000} />
          </div>
          {aiHashtags.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Suggested Hashtags</label>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {aiHashtags.slice(0, 15).map((h, i) => (
                  <span key={i} style={{ fontSize:11, color:'#7C5CFC', background:'rgba(124,92,252,0.09)', padding:'2px 9px', borderRadius:20, border:'1px solid rgba(124,92,252,0.18)', fontWeight:600 }}>
                    #{(h || '').replace(/^#/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!isNew && (
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ padding:'16px 20px', borderTop:`1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, display:'flex', flexDirection:'column', gap:8 }}>
          {!isNew && plan?.post_id && plan?.status === 'published' && (
            <a href={`/analytics/posts/${plan.post_id}`} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:10, borderRadius:10, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', color:'#22C55E', fontSize:13, fontWeight:700, textDecoration:'none' }}>
              <IpAnalytics size={14} color="#22C55E" /> View performance <IpArrowRight size={12} />
            </a>
          )}
          {!isNew && plan?.status !== 'published' && (
            <button onClick={handleGenerate} disabled={generating} style={{ width:'100%', padding:11, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:generating?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 4px 16px rgba(124,92,252,0.4)', opacity:generating?0.7:1 }}>
              <IpSparkle size={14} /> {generating ? 'Opening Wizard…' : `Generate with ${aiName} →`}
            </button>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{ flex:1, padding:10, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', border:`1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : t.border}`, borderRadius:10, color:t.text, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:(!form.title.trim()||saving)?0.5:1 }}>
              {saving ? 'Saving…' : isNew ? 'Add to Calendar' : 'Save Changes'}
            </button>
            {!isNew && (
              <button onClick={() => onDelete(plan.id)} style={{ width:40, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,69,58,0.1)', border:'1px solid rgba(255,69,58,0.25)', borderRadius:10, color:'#FF453A', cursor:'pointer' }}>
                <IpDelete size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes slideUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
      `}</style>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContentCalendarPage() {
  const router  = useRouter();
  const { theme, t } = useTheme();
  const { aiName } = useBranding();

  const [view,       setView]       = useState('weekly');
  const [anchor,     setAnchor]     = useState(() => {
    const now = new Date(), day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    return mon.toISOString().split('T')[0];
  });

  const [plans,      setPlans]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [drawer,     setDrawer]     = useState(null);
  const [isMobile,   setIsMobile]   = useState(false);
  const [userCredits, setUserCredits] = useState(0);

  // AI fill flow states
  const [fillModal,   setFillModal]   = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [reviewPlans, setReviewPlans] = useState(null); // null | plan[]
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    // Fetch credits
    customerAPI.getProfile().then(r => {
      setUserCredits(r.data?.customer?.credits_balance ?? r.data?.credits_balance ?? 0);
    }).catch(() => {});
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const dates = getDates(view, anchor);
    if (!dates.length) return;
    loadPlans(dates[0], dates[dates.length - 1]);
  }, [view, anchor]);

  const handleViewChange = (newView) => {
    const today = todayStr();
    if (newView === 'monthly') {
      const d = new Date(anchor + 'T00:00:00'); d.setDate(1);
      setAnchor(d.toISOString().split('T')[0]);
    } else if (newView === 'weekly') {
      const d = new Date(today), day = d.getDay();
      d.setDate(d.getDate() - ((day + 6) % 7));
      setAnchor(d.toISOString().split('T')[0]);
    } else {
      setAnchor(today);
    }
    setView(newView);
  };

  const loadPlans = async (start, end) => {
    setLoading(true);
    try {
      const res = await calendarPlansAPI.list(start, end);
      // API returns { plans: [...] }
      const arr = res.data?.plans ?? res.data ?? [];
      setPlans(Array.isArray(arr) ? arr : []);
    } catch { setPlans([]); }
    finally  { setLoading(false); }
  };

  // Step 1 — open modal
  const handleOpenFill = () => setFillModal(true);

  // Step 2 — call ai-generate (no credits, no DB save yet)
  const handleGenerate = async ({ mix, platforms }) => {
    setFillModal(false);
    setGenerating(true);
    try {
      const dates = getDates(view, anchor);
      const res   = await calendarPlansAPI.aiGenerate({
        start:     dates[0],
        end:       dates[dates.length - 1],
        mix,
        platforms,
      });
      const generated = res.data?.plans ?? [];
      if (!Array.isArray(generated) || generated.length === 0) {
        showToast(aiName + ' returned no plans. Please try again.', 'error');
        return;
      }
      setReviewPlans(generated);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate plans. Please try again.';
      showToast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Step 3 — save approved plans + deduct credits
  const handleBulkSave = async (approvedPlans) => {
    try {
      const res  = await calendarPlansAPI.bulkSave(approvedPlans);
      const saved = res.data?.plans ?? [];
      const cost  = res.data?.creditsCost ?? approvedPlans.length;
      const remaining = res.data?.creditsRemaining;

      // Merge into calendar
      if (saved.length > 0) {
        setPlans(prev => {
          const ids = new Set(saved.map(p => p.id));
          return [...prev.filter(p => !ids.has(p.id)), ...saved];
        });
      }
      setReviewPlans(null);
      if (remaining !== undefined) setUserCredits(remaining);
      showToast(`${saved.length} post${saved.length !== 1 ? 's' : ''} added to your calendar — ${cost} credit${cost !== 1 ? 's' : ''} used.`, 'success');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save plans. Please try again.';
      showToast(msg, 'error');
    }
  };

  const handleSave = async (form) => {
    try {
      if (drawer?.plan?.id) {
        const res = await calendarPlansAPI.update(drawer.plan.id, form);
        const updated = res.data?.plan ?? res.data;
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const res = await calendarPlansAPI.create(form);
        const created = res.data?.plan ?? res.data;
        setPlans(prev => [...prev, created]);
      }
      setDrawer(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await calendarPlansAPI.remove(id);
      setPlans(prev => prev.filter(p => p.id !== id));
      setDrawer(null);
    } catch (e) { console.error(e); }
  };

  const handleGenerateFromPlan = async (id) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    setDrawer(null);
    // Parse JSON notes (AI-generated plans store structured data there)
    let brief = plan.title || '';
    try {
      const nd = JSON.parse(plan.notes || '{}');
      brief = nd.caption || plan.notes || plan.title || '';
    } catch {
      brief = plan.notes || plan.title || '';
    }
    router.push(`/wizard?brief=${encodeURIComponent(brief.substring(0, 500))}&date=${plan.plan_date}`);
  };

  const today  = todayStr();
  const dates  = getDates(view, anchor);
  const label  = fmtPeriodLabel(view, anchor);

  // Period stats
  const periodPublished  = plans.filter(p => p.status === 'published').length;
  const periodScheduled  = plans.filter(p => p.status === 'scheduled').length;
  const periodPlanned    = plans.filter(p => p.status === 'planned' || p.status === 'briefed').length;

  // ── Monthly grid ─────────────────────────────────────────────────────────

  const renderMonthly = () => {
    const d   = new Date(anchor + 'T00:00:00');
    const y   = d.getFullYear(), m = d.getMonth();
    const fst = firstDayOfWeek(y, m);
    const tot = daysInMonth(y, m);

    const cells = [];
    for (let i = 0; i < fst; i++) cells.push(null);
    for (let day = 1; day <= tot; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:4 }}>
          {DAY_NAMES_SHORT.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:t.textMuted, padding:'4px 0', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = toStr(y, m, day);
            return (
              <MonthCell key={dateStr} day={day} dateStr={dateStr} plans={plans} isToday={dateStr === today} isCurrent={true} onSelect={plan => setDrawer({ plan })} onAdd={dt => setDrawer({ defaultDate: dt })} t={t} />
            );
          })}
        </div>
      </div>
    );
  };

  // ── Weekly / 10-day columns ──────────────────────────────────────────────

  const renderColumns = () => {
    const compact = dates.length > 7;
    return (
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8 }}>
        {dates.map(dateStr => (
          <DayCell key={dateStr} dateStr={dateStr} plans={plans} isToday={dateStr === today} isPast={dateStr < today} onSelect={plan => setDrawer({ plan })} onAdd={dt => setDrawer({ defaultDate: dt })} t={t} compact={compact} />
        ))}
      </div>
    );
  };

  // ── Mobile agenda ────────────────────────────────────────────────────────

  const renderAgenda = () => (
    <div>
      {dates.map(dateStr => {
        const d        = new Date(dateStr + 'T00:00:00');
        const dayPlans = plans.filter(p => p.plan_date === dateStr);
        const isToday  = dateStr === today;
        const isPast   = dateStr < today;
        return (
          <div key={dateStr} style={{ borderBottom:`1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`, opacity: isPast && !isToday ? 0.55 : 1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 4px 6px', background: isToday ? 'rgba(124,92,252,0.07)' : 'transparent' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:isToday?800:600, background:isToday?'#7C5CFC':'transparent', color:isToday?'#fff':t.text }}>{d.getDate()}</span>
                <span style={{ fontSize:12, color:t.textMuted, fontWeight:500 }}>{DAY_NAMES_FULL[d.getDay()]}</span>
              </div>
              <button onClick={() => setDrawer({ defaultDate: dateStr })} style={{ width:26, height:26, borderRadius:'50%', background:'rgba(124,92,252,0.18)', border:'none', color:'#9B7FFF', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <IpPlus size={12} />
              </button>
            </div>
            {dayPlans.length > 0 && (
              <div style={{ padding:'0 4px 10px', display:'flex', flexDirection:'column', gap:5 }}>
                {dayPlans.map(p => (
                  <div key={p.id} onClick={() => setDrawer({ plan: p })} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border:`1px solid ${t.border}`, cursor:'pointer' }}>
                    <div style={{ width:4, height:32, borderRadius:2, background:typeColor(p.content_type), flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title || 'Untitled'}</div>
                      <div style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>{(STATUS_CFG[p.status] || STATUS_CFG.planned).label}</div>
                    </div>
                    <IpChevronRight size={14} color={t.textMuted} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Empty state ──────────────────────────────────────────────────────────

  const isEmpty = plans.length === 0 && !loading;

  return (
    <Layout title="Content Calendar" subtitle={`Plan your content — ${aiName} fills it for you`}>

      {/* Global keyframes */}
      <style>{`
        @keyframes slideUp   { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes shimmer   { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes postCorePulse { 0%,100% { box-shadow:0 8px 28px rgba(124,92,252,0.5); } 50% { box-shadow:0 8px 36px rgba(124,92,252,0.8); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, padding:'12px 18px', borderRadius:12, background: toast.type === 'error' ? '#1A0A0A' : (t.isDark ? '#0A1A0E' : '#F0FFF4'), border:`1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`, color: toast.type === 'error' ? '#EF4444' : '#22C55E', fontSize:13, fontWeight:700, boxShadow:'0 8px 32px rgba(0,0,0,0.3)', maxWidth:380, lineHeight:1.5, animation:'slideUp 220ms ease' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>

        {/* View switcher */}
        <div style={{ display:'flex', gap:2, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', padding:3, borderRadius:11, border:`1px solid ${t.border}` }}>
          {[['weekly','Weekly'],['10day','10-Day'],['monthly','Monthly']].map(([v, lbl]) => (
            <button key={v} onClick={() => handleViewChange(v)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background: view === v ? '#7C5CFC' : 'transparent', color: view === v ? '#fff' : t.textMuted, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 150ms', boxShadow: view === v ? '0 2px 8px rgba(124,92,252,0.35)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setAnchor(a => shiftAnchor(view, a, -1))} style={{ width:32, height:32, borderRadius:8, background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border:`1px solid ${t.border}`, color:t.textMuted, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <IpArrowLeft size={14} />
          </button>
          <span style={{ fontSize:14, fontWeight:700, color:t.text, minWidth:190, textAlign:'center' }}>{label}</span>
          <button onClick={() => setAnchor(a => shiftAnchor(view, a, 1))} style={{ width:32, height:32, borderRadius:8, background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border:`1px solid ${t.border}`, color:t.textMuted, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <IpChevronRight size={14} />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              if (view === 'monthly') {
                const d = new Date(now.getFullYear(), now.getMonth(), 1);
                setAnchor(d.toISOString().split('T')[0]);
              } else if (view === 'weekly') {
                const d = new Date(now), day = d.getDay();
                d.setDate(d.getDate() - ((day + 6) % 7));
                setAnchor(d.toISOString().split('T')[0]);
              } else { setAnchor(todayStr()); }
            }}
            style={{ padding:'6px 12px', borderRadius:8, background:'transparent', border:`1px solid ${t.border}`, color:t.textMuted, fontSize:12, fontWeight:600, cursor:'pointer' }}
          >Today</button>
        </div>

        {/* AI Fill button */}
        <button
          onClick={handleOpenFill}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:11, border:'none', background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 16px rgba(124,92,252,0.45)', transition:'all 150ms', whiteSpace:'nowrap', letterSpacing:'0.01em' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(124,92,252,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.45)'; e.currentTarget.style.transform = 'none'; }}
        >
          <IpSparkle size={15} />
          AI Fill {view === 'monthly' ? 'Month' : view === 'weekly' ? 'Week' : '10 Days'}
        </button>
      </div>

      {/* Period stats */}
      {plans.length > 0 && (
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { label:'Planned',   count:periodPlanned,   color:'#6B7280' },
            { label:'Scheduled', count:periodScheduled, color:'#7C5CFC' },
            { label:'Published', count:periodPublished,  color:'#22C55E' },
          ].map(({ label, count, color }) => count > 0 && (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border:`1px solid ${t.border}` }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:color }} />
              <span style={{ fontSize:12, fontWeight:700, color }}>{count}</span>
              <span style={{ fontSize:12, color:t.textMuted }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content mix bar */}
      <ContentMixBar plans={plans} t={t} />

      {/* Calendar body */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px 0' }}>
          {[...Array(view === 'weekly' ? 7 : 5)].map((_, i) => (
            <div key={i} style={{ height:120, borderRadius:12, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border:`1px solid ${t.border}`, animation:'shimmer 1.4s infinite' }} />
          ))}
        </div>
      ) : isEmpty ? (
        // Empty state
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg,rgba(124,92,252,0.15),rgba(124,92,252,0.05))', border:'1.5px solid rgba(124,92,252,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
            <IpCalendar size={32} color="rgba(124,92,252,0.6)" />
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:t.text, marginBottom:8 }}>Your {view === 'monthly' ? 'month' : view === 'weekly' ? 'week' : '10 days'} is open</div>
          <div style={{ fontSize:14, color:t.textMuted, maxWidth:340, lineHeight:1.6, marginBottom:28 }}>
            Let {aiName} fill it with perfectly timed, industry-specific content — just set your mix and go.
          </div>
          <button
            onClick={handleOpenFill}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 24px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(124,92,252,0.45)', letterSpacing:'0.01em' }}
          >
            <IpSparkle size={16} />
            AI Fill {view === 'monthly' ? 'Month' : view === 'weekly' ? 'Week' : '10 Days'}
          </button>
          <button onClick={() => setDrawer({ defaultDate: today })} style={{ marginTop:12, padding:'8px 16px', borderRadius:10, border:`1px solid ${t.border}`, background:'transparent', color:t.textMuted, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Add a post manually
          </button>
        </div>
      ) : isMobile ? renderAgenda()
        : view === 'monthly' ? renderMonthly()
        : renderColumns()
      }

      {/* Legend */}
      {plans.length > 0 && (
        <div style={{ display:'flex', gap:16, marginTop:20, flexWrap:'wrap' }}>
          {CONTENT_TYPES.map(ct => (
            <div key={ct.value} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:ct.color }} />
              <span style={{ fontSize:11, color:t.textMuted }}>{ct.label}</span>
            </div>
          ))}
          <div style={{ height:10, width:1, background:t.border, alignSelf:'center' }} />
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:v.dot }} />
              <span style={{ fontSize:11, color:t.textMuted }}>{v.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AiFillModal
        t={t}
        theme={theme}
        open={fillModal}
        onClose={() => setFillModal(false)}
        onGenerate={handleGenerate}
        userCredits={userCredits}
        periodLabel={label}
        view={view}
      />

      {generating && <GeneratingOverlay t={t} />}

      {reviewPlans && (
        <ReviewModal
          t={t}
          plans={reviewPlans}
          onClose={() => setReviewPlans(null)}
          onConfirm={handleBulkSave}
        />
      )}

      {drawer && (
        <PlanDrawer
          plan={drawer.plan}
          defaultDate={drawer.defaultDate}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onGenerate={handleGenerateFromPlan}
          t={t} theme={theme} isMobile={isMobile}
        />
      )}
    </Layout>
  );
}
