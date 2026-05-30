import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { calendarPlansAPI } from '../lib/api';
import {
  IpSparkle, IpClose, IpDelete, IpCheck, IpArrowRight, IpAnalytics,
  IpCalendar, IpChevronRight, IpArrowLeft,
} from '../components/icons';

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: 'photo_post', label: 'Photo',    color: '#3B82F6' },
  { value: 'carousel',   label: 'Carousel', color: '#7C5CFC' },
  { value: 'video',      label: 'Video',    color: '#EF4444' },
  { value: 'text_card',  label: 'Text',     color: '#22C55E' },
  { value: 'story',      label: 'Story',    color: '#F97316' },
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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

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
  if (view === 'monthly') {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  const days = view === 'weekly' ? 6 : 9;
  const end  = new Date(anchor + 'T00:00:00');
  end.setDate(end.getDate() + days);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(d)} – ${fmt(end)}, ${d.getFullYear()}`;
}

// Move anchor forward/backward based on view
function shiftAnchor(view, anchor, dir) {
  const d = new Date(anchor + 'T00:00:00');
  if (view === 'monthly') {
    d.setDate(1);
    d.setMonth(d.getMonth() + dir);
  } else if (view === 'weekly') {
    d.setDate(d.getDate() + dir * 7);
  } else { // 10-day
    d.setDate(d.getDate() + dir * 10);
  }
  return d.toISOString().split('T')[0];
}

// Generate the list of dates for the current view
function getDates(view, anchor) {
  if (view === 'monthly') {
    const d = new Date(anchor + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth();
    const total = daysInMonth(y, m);
    return Array.from({ length: total }, (_, i) => toStr(y, m, i + 1));
  }
  const days = view === 'weekly' ? 7 : 10;
  return Array.from({ length: days }, (_, i) => addDays(anchor, i));
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
        borderLeft: `3px solid ${tc}`, background: scfg.bg, border: `1px solid ${scfg.border}`,
        borderLeftColor: tc, borderRadius: 6, padding: '4px 7px',
        cursor: 'pointer', marginBottom: 4, transition: 'transform 100ms, box-shadow 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none';              e.currentTarget.style.boxShadow = 'none'; }}
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

// ─── DayCell (used in Weekly and 10-Day views) ────────────────────────────────

function DayCell({ dateStr, plans, isToday, isPast, onSelect, onAdd, t, compact }) {
  const [hov, setHov] = useState(false);
  const dayPlans = plans.filter(p => p.plan_date === dateStr);
  const visible  = dayPlans.slice(0, compact ? 2 : 3);
  const overflow = dayPlans.length - visible.length;
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = DAY_NAMES_SHORT[d.getDay()];
  const dayNum  = d.getDate();

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, minWidth: 0, borderRadius: 12,
        border: isToday ? `2px solid rgba(124,92,252,0.5)` : `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}`,
        background: isToday ? (t.isDark ? 'rgba(124,92,252,0.07)' : 'rgba(124,92,252,0.03)') : hov ? (t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent',
        padding: '10px 10px 8px',
        opacity: isPast && !isToday ? 0.45 : 1,
        transition: 'all 120ms', position: 'relative', cursor: 'default',
        minHeight: 120,
      }}
    >
      {/* Day header */}
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
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(124,92,252,0.75)', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >+</button>
        )}
      </div>

      {/* Plan chips */}
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
        >+</button>
      )}
    </div>
  );
}

// ─── ContentMixBar ────────────────────────────────────────────────────────────

function ContentMixBar({ plans, t }) {
  const counts = { educational: 0, social_proof: 0, promotional: 0 };
  plans.forEach(p => {
    const ct = p.content_type;
    if (['photo_post','text_card','carousel'].includes(ct)) {
      // rough mapping based on notes
      if (p.notes?.toLowerCase().includes('promo') || p.notes?.toLowerCase().includes('offer') || p.notes?.toLowerCase().includes('deal')) counts.promotional++;
      else if (p.notes?.toLowerCase().includes('review') || p.notes?.toLowerCase().includes('testimonial') || p.notes?.toLowerCase().includes('before')) counts.social_proof++;
      else counts.educational++;
    } else {
      counts.educational++;
    }
  });
  const total = plans.length || 1;
  const eduPct  = Math.round((counts.educational  / total) * 100);
  const socPct  = Math.round((counts.social_proof / total) * 100);
  const proPct  = 100 - eduPct - socPct;

  const target  = { edu: 70, soc: 20, pro: 10 };
  const eduOk   = Math.abs(eduPct  - target.edu) <= 15;
  const mixOk   = eduOk;

  if (plans.length === 0) return null;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderRadius:10, background: t.isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)', border:`1px solid ${t.border}`, marginBottom:20, flexWrap:'wrap' }}>
      <div style={{ fontSize:11, fontWeight:700, color: mixOk ? t.success : '#F59E0B', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>
        {mixOk ? '✓ Good mix' : '⚠ Adjust mix'}
      </div>
      <div style={{ flex:1, minWidth:160, height:6, borderRadius:3, background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display:'flex', overflow:'hidden' }}>
        <div style={{ width:`${eduPct}%`, background:'#3B82F6', transition:'width 300ms' }} />
        <div style={{ width:`${socPct}%`, background:'#7C5CFC', transition:'width 300ms' }} />
        <div style={{ width:`${Math.max(proPct,0)}%`, background:'#F59E0B', transition:'width 300ms' }} />
      </div>
      <div style={{ display:'flex', gap:12, fontSize:11, color:t.textMuted, flexShrink:0 }}>
        <span><span style={{ color:'#3B82F6', fontWeight:700 }}>{eduPct}%</span> Edu</span>
        <span><span style={{ color:'#7C5CFC', fontWeight:700 }}>{socPct}%</span> Proof</span>
        <span><span style={{ color:'#F59E0B', fontWeight:700 }}>{Math.max(proPct,0)}%</span> Promo</span>
        <span style={{ color:t.textMuted }}>Target: 70 · 20 · 10</span>
      </div>
    </div>
  );
}

// ─── PlanDrawer ───────────────────────────────────────────────────────────────

function PlanDrawer({ plan, defaultDate, onClose, onSave, onDelete, onGenerate, t, theme, isMobile }) {
  const isNew = !plan?.id;
  const [form, setForm] = useState({
    title:        plan?.title        || '',
    content_type: plan?.content_type || 'photo_post',
    platforms:    plan?.platforms    || ['facebook','instagram'],
    notes:        plan?.notes        || '',
    status:       plan?.status       || 'planned',
    plan_date:    plan?.plan_date    || defaultDate || '',
  });
  const [saving,     setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const togglePlatform = p => set('platforms', form.platforms.includes(p) ? form.platforms.filter(x => x !== p) : [...form.platforms, p]);

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

  const inp = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: t.text, fontSize: 13, outline: 'none',
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 };

  const drawerStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, maxHeight: '90vh',
    borderRadius: '20px 20px 0 0',
    background: theme === 'dark' ? '#0F0F18' : t.bg,
    borderTop: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', animation: 'slideUp 240ms cubic-bezier(0.16,1,0.3,1)',
  } : {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1000,
    background: theme === 'dark' ? '#0F0F18' : t.bg,
    borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
  };

  return (
    <>
      {isMobile && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />}
      <div style={drawerStyle}>
        {isMobile && <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} /></div>}
        <div style={{ padding: isMobile ? '12px 20px' : '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{isNew ? 'Plan Content' : 'Edit Plan'}</div>
            {form.plan_date && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{new Date(form.plan_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 4 }}><IpClose size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Content Idea</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Before & after pipe repair job" style={inp} maxLength={200} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Date</label>
            <input type="date" value={form.plan_date} onChange={e => set('plan_date', e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Content Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CONTENT_TYPES.map(ct => (
                <button key={ct.value} onClick={() => set('content_type', ct.value)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${form.content_type === ct.value ? ct.color : 'rgba(255,255,255,0.1)'}`,
                  background: form.content_type === ct.value ? `${ct.color}22` : 'transparent',
                  color: form.content_type === ct.value ? ct.color : t.textMuted, transition: 'all 120ms',
                }}>{ct.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Platforms</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => togglePlatform(p.value)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${form.platforms.includes(p.value) ? '#7C5CFC' : 'rgba(255,255,255,0.1)'}`,
                  background: form.platforms.includes(p.value) ? 'rgba(124,92,252,0.15)' : 'transparent',
                  color: form.platforms.includes(p.value) ? '#9B7FFF' : t.textMuted, transition: 'all 120ms',
                }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Content Brief</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What should this post be about? PostCore uses this to generate your content."
              style={{ ...inp, height: 88, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} maxLength={2000} />
          </div>
          {!isNew && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isNew && plan?.post_id && plan?.status === 'published' && (
            <a href={`/analytics/posts/${plan.post_id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              <IpAnalytics size={14} color="#22C55E" /> View performance <IpArrowRight size={12} />
            </a>
          )}
          {!isNew && plan?.status !== 'published' && (
            <button onClick={handleGenerate} disabled={generating} style={{ width: '100%', padding: 11, background: 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 16px rgba(124,92,252,0.4)', opacity: generating ? 0.7 : 1 }}>
              <IpSparkle size={14} /> {generating ? 'Opening Wizard…' : 'Generate with PostCore →'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: t.text, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: (!form.title.trim() || saving) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : isNew ? 'Add to Calendar' : 'Save Changes'}
            </button>
            {!isNew && (
              <button onClick={() => onDelete(plan.id)} style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: 10, color: '#FF453A', cursor: 'pointer' }}>
                <IpDelete size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideUp      { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0);   opacity: 1; } }
      `}</style>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContentCalendarPage() {
  const router  = useRouter();
  const { theme, t } = useTheme();

  const [view,      setView]      = useState('weekly');  // 'weekly' | '10day' | 'monthly'
  const [anchor,    setAnchor]    = useState(() => {
    // Weekly: start of current week (Mon); 10day: today; monthly: 1st of month
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7)); // Monday
    return mon.toISOString().split('T')[0];
  });

  const [plans,     setPlans]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [filling,   setFilling]   = useState(false);
  const [drawer,    setDrawer]    = useState(null);  // null | { plan?, defaultDate }
  const [isMobile,  setIsMobile]  = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load plans whenever anchor/view changes
  useEffect(() => {
    const dates = getDates(view, anchor);
    if (!dates.length) return;
    loadPlans(dates[0], dates[dates.length - 1]);
  }, [view, anchor]);

  // When view changes, recalibrate anchor sensibly
  const handleViewChange = (newView) => {
    const today = todayStr();
    if (newView === 'monthly') {
      const d = new Date(anchor + 'T00:00:00');
      d.setDate(1);
      setAnchor(d.toISOString().split('T')[0]);
    } else if (newView === 'weekly') {
      const d = new Date(today);
      const day = d.getDay();
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
      const { data } = await calendarPlansAPI.list(start, end);
      setPlans(Array.isArray(data) ? data : []);
    } catch { setPlans([]); }
    finally  { setLoading(false); }
  };

  const handleAiFill = async () => {
    setFilling(true);
    try {
      const dates = getDates(view, anchor);
      const { data } = await calendarPlansAPI.aiFill({ start: dates[0], end: dates[dates.length - 1], view });
      if (Array.isArray(data)) setPlans(prev => {
        const ids = new Set(data.map(p => p.id));
        return [...prev.filter(p => !ids.has(p.id)), ...data];
      });
    } catch (e) { console.error(e); }
    finally { setFilling(false); }
  };

  const handleSave = async (form) => {
    try {
      if (drawer?.plan?.id) {
        const { data } = await calendarPlansAPI.update(drawer.plan.id, form);
        setPlans(prev => prev.map(p => p.id === data.id ? data : p));
      } else {
        const { data } = await calendarPlansAPI.create(form);
        setPlans(prev => [...prev, data]);
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

  const handleGenerate = async (id) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    setDrawer(null);
    router.push(`/wizard?brief=${encodeURIComponent(plan.notes || plan.title || '')}&date=${plan.plan_date}`);
  };

  const today  = todayStr();
  const dates  = getDates(view, anchor);
  const label  = fmtPeriodLabel(view, anchor);

  // ── Render monthly grid ──────────────────────────────────────────────────

  const renderMonthly = () => {
    const d   = new Date(anchor + 'T00:00:00');
    const y   = d.getFullYear(), m = d.getMonth();
    const fst = firstDayOfWeek(y, m);
    const tot = daysInMonth(y, m);

    const cells = [];
    // Leading empty cells
    for (let i = 0; i < fst; i++) cells.push(null);
    for (let day = 1; day <= tot; day++) cells.push(day);
    // Trailing cells to complete last row
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div>
        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: t.textMuted, padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
          ))}
        </div>
        {/* Calendar cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = toStr(y, m, day);
            return (
              <MonthCell
                key={dateStr} day={day} dateStr={dateStr} plans={plans}
                isToday={dateStr === today} isCurrent={true}
                onSelect={plan => setDrawer({ plan })}
                onAdd={dt => setDrawer({ defaultDate: dt })}
                t={t}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render weekly / 10-day grid ──────────────────────────────────────────

  const renderColumns = () => {
    const compact = dates.length > 7;
    return (
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
        {dates.map(dateStr => {
          const d = new Date(dateStr + 'T00:00:00');
          return (
            <DayCell
              key={dateStr} dateStr={dateStr} plans={plans}
              isToday={dateStr === today}
              isPast={dateStr < today}
              onSelect={plan => setDrawer({ plan })}
              onAdd={dt => setDrawer({ defaultDate: dt })}
              t={t} compact={compact}
            />
          );
        })}
      </div>
    );
  };

  // ── Mobile agenda view ────────────────────────────────────────────────────

  const renderAgenda = () => (
    <div>
      {dates.map(dateStr => {
        const d = new Date(dateStr + 'T00:00:00');
        const dayPlans = plans.filter(p => p.plan_date === dateStr);
        const isToday  = dateStr === today;
        const isPast   = dateStr < today;
        return (
          <div key={dateStr} style={{ borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`, opacity: isPast && !isToday ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px 6px', background: isToday ? 'rgba(124,92,252,0.07)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: isToday ? 800 : 600, background: isToday ? '#7C5CFC' : 'transparent', color: isToday ? '#fff' : t.text }}>
                  {d.getDate()}
                </span>
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
                  {DAY_NAMES_FULL[d.getDay()]}
                </span>
              </div>
              <button onClick={() => setDrawer({ defaultDate: dateStr })} style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(124,92,252,0.18)', border: 'none', color: '#9B7FFF', fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            {dayPlans.length > 0 && (
              <div style={{ padding: '0 4px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {dayPlans.map(p => (
                  <div key={p.id} onClick={() => setDrawer({ plan: p })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${t.border}`, cursor: 'pointer' }}>
                    <div style={{ width: 4, height: 32, borderRadius: 2, background: typeColor(p.content_type), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled'}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{(STATUS_CFG[p.status] || STATUS_CFG.planned).label}</div>
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

  return (
    <Layout title="Content Calendar" subtitle="Plan your social content — PostCore fills it for you">
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>

        {/* View switcher */}
        <div style={{ display: 'flex', gap: 2, background: t.input, padding: 3, borderRadius: 10, border: `1px solid ${t.border}` }}>
          {[['weekly','Weekly'],['10day','10-Day'],['monthly','Monthly']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => handleViewChange(v)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: view === v ? t.primary : 'transparent',
                color: view === v ? '#fff' : t.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: view === v ? '0 1px 6px rgba(124,92,252,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navigation + period label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setAnchor(a => shiftAnchor(view, a, -1))}
            style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IpArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text, minWidth: 180, textAlign: 'center' }}>{label}</span>
          <button
            onClick={() => setAnchor(a => shiftAnchor(view, a, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IpChevronRight size={14} />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              if (view === 'monthly') {
                const d = new Date(now.getFullYear(), now.getMonth(), 1);
                setAnchor(d.toISOString().split('T')[0]);
              } else if (view === 'weekly') {
                const d = new Date(now);
                const day = d.getDay();
                d.setDate(d.getDate() - ((day + 6) % 7));
                setAnchor(d.toISOString().split('T')[0]);
              } else {
                setAnchor(todayStr());
              }
            }}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Today
          </button>
        </div>

        {/* AI Fill button */}
        <button
          onClick={handleAiFill}
          disabled={filling}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: filling ? t.textMuted : 'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: filling ? 'not-allowed' : 'pointer',
            boxShadow: filling ? 'none' : '0 4px 14px rgba(124,92,252,0.4)',
            opacity: filling ? 0.7 : 1, transition: 'all 150ms', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!filling) e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,92,252,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = filling ? 'none' : '0 4px 14px rgba(124,92,252,0.4)'; }}
        >
          <IpSparkle size={14} />
          {filling ? 'PostCore is planning…' : `AI Fill ${view === 'monthly' ? 'Month' : view === 'weekly' ? 'Week' : '10 Days'}`}
        </button>
      </div>

      {/* ── Content mix bar ── */}
      <ContentMixBar plans={plans} t={t} />

      {/* ── Calendar body ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: t.textMuted, fontSize: 14 }}>
          Loading calendar…
        </div>
      ) : isMobile ? (
        renderAgenda()
      ) : view === 'monthly' ? (
        renderMonthly()
      ) : (
        renderColumns()
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
        {CONTENT_TYPES.map(ct => (
          <div key={ct.value} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: ct.color }} />
            <span style={{ fontSize: 11, color: t.textMuted }}>{ct.label}</span>
          </div>
        ))}
        <div style={{ height: 10, width: 1, background: t.border, alignSelf: 'center' }} />
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.dot }} />
            <span style={{ fontSize: 11, color: t.textMuted }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* ── Plan drawer ── */}
      {drawer && (
        <PlanDrawer
          plan={drawer.plan}
          defaultDate={drawer.defaultDate}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onGenerate={handleGenerate}
          t={t} theme={theme} isMobile={isMobile}
        />
      )}
    </Layout>
  );
}
