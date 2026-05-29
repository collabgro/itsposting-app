import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { calendarPlansAPI } from '../lib/api';
import { IpSparkle, IpClose, IpDelete, IpCheck, IpArrowRight, IpAnalytics } from '../components/icons';

// ─── config ────────────────────────────────────────────────────────────────
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

const CARD_COLORS = { purple:'#7C5CFC', blue:'#3B82F6', green:'#22C55E', orange:'#F97316', red:'#EF4444', pink:'#EC4899' };
const PLATFORMS   = [
  { value:'facebook',        label:'Facebook'       },
  { value:'instagram',       label:'Instagram'      },
  { value:'google_business', label:'Google Biz'     },
  { value:'linkedin',        label:'LinkedIn'       },
  { value:'tiktok',          label:'TikTok'         },
];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── date helpers ─────────────────────────────────────────────────────────
function daysInMonth(y, m)  { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfWeek(y, m) { return new Date(y, m, 1).getDay(); }
function pad(n)  { return String(n).padStart(2, '0'); }
function toStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function fmtShort(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtLong(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function typeColor(ct) { return CONTENT_TYPES.find(c => c.value === ct)?.color || '#9CA3AF'; }

// ─── PlanCard ─────────────────────────────────────────────────────────────
function PlanCard({ plan, onClick, t }) {
  const tc    = typeColor(plan.content_type);
  const scfg  = STATUS_CFG[plan.status] || STATUS_CFG.planned;
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(plan); }}
      style={{
        borderLeft: `3px solid ${tc}`,
        background: scfg.bg, border: `1px solid ${scfg.border}`,
        borderLeftColor: tc, borderRadius: 6, padding: '4px 7px',
        cursor: 'pointer', marginBottom: 3,
        transition: 'transform 100ms, box-shadow 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 10px rgba(0,0,0,0.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {plan.title || 'Untitled'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: scfg.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: t.textMuted }}>{scfg.label}</span>
      </div>
    </div>
  );
}

// ─── CalendarCell ────────────────────────────────────────────────────────
function CalendarCell({ day, dateStr, plans, isToday, isCurrent, onSelectPlan, onAddPlan, t }) {
  const [hov, setHov] = useState(false);
  const dayPlans = plans.filter(p => p.plan_date === dateStr);
  const visible  = dayPlans.slice(0, 3);
  const overflow = dayPlans.length - 3;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        minHeight: 92, borderRadius: 8, padding: '6px 7px',
        background: isToday ? 'rgba(124,92,252,0.09)' : hov ? 'rgba(255,255,255,0.025)' : 'transparent',
        border: isToday ? '1.5px solid rgba(124,92,252,0.38)' : '1px solid rgba(255,255,255,0.05)',
        opacity: isCurrent ? 1 : 0.32,
        transition: 'background 120ms',
        position: 'relative', overflow: 'hidden',
        cursor: isCurrent ? 'default' : undefined,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, marginBottom: 5 }}>
        {isToday ? (
          <span style={{ background:'#7C5CFC', color:'#fff', borderRadius:'50%', width:22, height:22,
            display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{day}</span>
        ) : (
          <span style={{ color: t.text }}>{day}</span>
        )}
      </div>
      {visible.map(p => <PlanCard key={p.id} plan={p} onClick={onSelectPlan} t={t} />)}
      {overflow > 0 && <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 4 }}>+{overflow} more</div>}
      {hov && isCurrent && (
        <button
          onClick={() => onAddPlan(dateStr)}
          style={{
            position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%',
            background:'rgba(124,92,252,0.75)', border:'none', color:'#fff',
            fontSize:16, lineHeight:1, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >+</button>
      )}
    </div>
  );
}

// ─── PlanDrawer ───────────────────────────────────────────────────────────
function PlanDrawer({ plan, defaultDate, onClose, onSave, onDelete, onGenerate, t, theme }) {
  const isNew = !plan?.id;
  const [form, setForm] = useState({
    title:        plan?.title        || '',
    content_type: plan?.content_type || 'photo_post',
    platforms:    plan?.platforms    || ['facebook','instagram'],
    notes:        plan?.notes        || '',
    color:        plan?.color        || 'purple',
    status:       plan?.status       || 'planned',
    plan_date:    plan?.plan_date    || defaultDate || '',
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const togglePlatform = p => set('platforms', form.platforms.includes(p) ? form.platforms.filter(x=>x!==p) : [...form.platforms, p]);

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
    width:'100%', padding:'9px 12px', boxSizing:'border-box',
    background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
    borderRadius:8, color:t.text, fontSize:13, outline:'none',
  };
  const lbl = { fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 };

  return (
    <div style={{
      position:'fixed', top:0, right:0, bottom:0, width:380, zIndex:1000,
      background: theme==='dark' ? '#0F0F18' : t.bg,
      borderLeft:'1px solid rgba(255,255,255,0.08)',
      boxShadow:'-8px 0 40px rgba(0,0,0,0.5)',
      display:'flex', flexDirection:'column',
      animation:'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Header */}
      <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:t.text }}>{isNew ? 'New Content Plan' : 'Edit Plan'}</div>
          {form.plan_date && <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{fmtLong(form.plan_date)}</div>}
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', padding:4 }}>
          <IpClose size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {/* Title */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Content Idea</label>
          <input value={form.title} onChange={e=>set('title',e.target.value)}
            placeholder="e.g. Before & after roof repair job" style={inp} maxLength={200} />
        </div>

        {/* Date (editable) */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Date</label>
          <input type="date" value={form.plan_date} onChange={e=>set('plan_date',e.target.value)} style={inp} />
        </div>

        {/* Content type */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Content Type</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {CONTENT_TYPES.map(ct => (
              <button key={ct.value} onClick={()=>set('content_type',ct.value)} style={{
                padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                border:`1px solid ${form.content_type===ct.value ? ct.color : 'rgba(255,255,255,0.1)'}`,
                background: form.content_type===ct.value ? `${ct.color}22` : 'transparent',
                color: form.content_type===ct.value ? ct.color : t.textMuted,
                transition:'all 120ms',
              }}>{ct.label}</button>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Platforms</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p.value} onClick={()=>togglePlatform(p.value)} style={{
                padding:'5px 11px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
                border:`1px solid ${form.platforms.includes(p.value) ? '#7C5CFC' : 'rgba(255,255,255,0.1)'}`,
                background: form.platforms.includes(p.value) ? 'rgba(124,92,252,0.15)' : 'transparent',
                color: form.platforms.includes(p.value) ? '#9B7FFF' : t.textMuted,
                transition:'all 120ms',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Brief / Notes */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Content Brief</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
            placeholder="What should this post be about? What to show, say, highlight? PostCore uses this to generate your post."
            style={{ ...inp, height:96, resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }} maxLength={2000} />
        </div>

        {/* Color label */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Color Label</label>
          <div style={{ display:'flex', gap:8 }}>
            {Object.entries(CARD_COLORS).map(([key, hex]) => (
              <button key={key} onClick={()=>set('color',key)} style={{
                width:22, height:22, borderRadius:'50%', background:hex, border:'none', cursor:'pointer',
                outline: form.color===key ? `2.5px solid ${hex}` : '2.5px solid transparent',
                outlineOffset:2, transition:'outline 100ms',
              }} />
            ))}
          </div>
        </div>

        {/* Status — edit mode only */}
        {!isNew && (
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', gap:10 }}>
        {/* View performance — shown when plan has a linked published post */}
        {!isNew && plan?.post_id && (plan?.status === 'published' || plan?.post_status === 'posted') && (
          <a href={`/analytics/posts/${plan.post_id}`} style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            padding:'10px', borderRadius:10,
            background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)',
            color:'#22C55E', fontSize:13, fontWeight:700, textDecoration:'none',
            transition:'background 120ms',
          }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(34,197,94,0.18)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(34,197,94,0.1)'}
          >
            <IpAnalytics size={14} color="#22C55E" />
            View post performance <IpArrowRight size={12} />
          </a>
        )}
        {!isNew && plan?.status !== 'published' && (
          <button onClick={handleGenerate} disabled={generating} style={{
            width:'100%', padding:'11px',
            background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
            border:'none', borderRadius:10, color:'#fff',
            fontSize:13, fontWeight:700,
            cursor: generating ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            boxShadow:'0 4px 16px rgba(124,92,252,0.4)',
            opacity: generating ? 0.7 : 1,
          }}>
            <IpSparkle size={14} />
            {generating ? 'Opening Wizard…' : 'Generate with PostCore →'}
          </button>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{
            flex:1, padding:'10px',
            background: saving ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.13)', borderRadius:10,
            color: form.title.trim() ? t.text : t.textMuted,
            fontSize:13, fontWeight:600, cursor: saving ? 'wait' : 'pointer',
          }}>{saving ? 'Saving…' : isNew ? 'Add to Calendar' : 'Save Changes'}</button>
          {!isNew && (
            <button onClick={()=>onDelete(plan.id)} style={{
              padding:'10px 14px', background:'rgba(239,68,68,0.08)',
              border:'1px solid rgba(239,68,68,0.2)', borderRadius:10,
              color:'#EF4444', cursor:'pointer',
            }}><IpDelete size={15} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AiFillModal ──────────────────────────────────────────────────────────
const PERIOD_PRESETS = [
  { id:'week',    label:'This Week',    days: 7  },
  { id:'10days',  label:'Next 10 Days', days: 10 },
  { id:'month',   label:'This Month',   days: null },
  { id:'custom',  label:'Custom',       days: null },
];

function AiFillModal({ viewMonth, viewYear, onConfirm, onClose, loading, t }) {
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd, setCustomEnd]     = useState(addDays(todayStr(), 29));
  const [postsPerWeek, setPostsPerWeek] = useState(3);

  function resolveRange() {
    const today = todayStr();
    if (period === 'week') {
      const d = new Date();
      const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { startDate: mon.toISOString().split('T')[0], endDate: sun.toISOString().split('T')[0] };
    }
    if (period === '10days') {
      return { startDate: today, endDate: addDays(today, 9) };
    }
    if (period === 'month') {
      const last = daysInMonth(viewYear, viewMonth);
      return {
        startDate: `${viewYear}-${pad(viewMonth+1)}-01`,
        endDate:   `${viewYear}-${pad(viewMonth+1)}-${pad(last)}`,
      };
    }
    return { startDate: customStart, endDate: customEnd };
  }

  const range    = resolveRange();
  const start    = new Date(range.startDate + 'T00:00:00');
  const end      = new Date(range.endDate   + 'T00:00:00');
  const days     = Math.round((end - start) / 86400000) + 1;
  const weeks    = Math.max(1, Math.ceil(days / 7));
  const estPosts = Math.min(weeks * postsPerWeek, 28);

  const handleGo = () => onConfirm({ ...range, postsPerWeek });

  const chip = (id) => ({
    padding:'7px 16px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
    border:`1.5px solid ${period===id ? '#7C5CFC' : 'rgba(255,255,255,0.1)'}`,
    background: period===id ? 'rgba(124,92,252,0.15)' : 'transparent',
    color: period===id ? '#9B7FFF' : t.textMuted,
    transition:'all 130ms',
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200,
      background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{
        width:'100%', maxWidth:480,
        background:'#0F0F18', borderRadius:16,
        border:'1px solid rgba(255,255,255,0.1)',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
        overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <IpSparkle size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>AI Content Plan</div>
              <div style={{ fontSize:12, color:'#6B7280' }}>PostCore will plan your chosen period</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', padding:4 }}>
            <IpClose size={18} />
          </button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Period selector */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Time Period</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PERIOD_PRESETS.map(p => (
                <button key={p.id} onClick={()=>setPeriod(p.id)} style={chip(p.id)}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {period === 'custom' && (
            <div style={{ marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Start Date</div>
                <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{
                  width:'100%', padding:'9px 11px', boxSizing:'border-box',
                  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
                  borderRadius:8, color:'#fff', fontSize:13, outline:'none',
                }} />
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>End Date</div>
                <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} min={customStart} style={{
                  width:'100%', padding:'9px 11px', boxSizing:'border-box',
                  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
                  borderRadius:8, color:'#fff', fontSize:13, outline:'none',
                }} />
              </div>
            </div>
          )}

          {/* Posts per week */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
              Posts per week
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {[2,3,5,7].map(n => (
                <button key={n} onClick={()=>setPostsPerWeek(n)} style={{
                  ...chip(n === postsPerWeek ? 'selected' : ''),
                  border:`1.5px solid ${postsPerWeek===n ? '#7C5CFC' : 'rgba(255,255,255,0.1)'}`,
                  background: postsPerWeek===n ? 'rgba(124,92,252,0.15)' : 'transparent',
                  color: postsPerWeek===n ? '#9B7FFF' : '#6B7280',
                  padding:'7px 0', width:52, textAlign:'center',
                }}>{n}x</button>
              ))}
            </div>
          </div>

          {/* Preview summary */}
          <div style={{
            background:'rgba(124,92,252,0.08)', border:'1px solid rgba(124,92,252,0.2)',
            borderRadius:10, padding:'12px 16px', marginBottom:20,
          }}>
            <div style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.6 }}>
              PostCore will generate{' '}
              <strong style={{ color:'#9B7FFF' }}>{estPosts} content ideas</strong>
              {' '}across{' '}
              <strong style={{ color:'#fff' }}>{fmtShort(range.startDate)} – {fmtShort(range.endDate)}</strong>
              {' '}({days} days).
              <br />
              You'll review and approve before anything is added.
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleGo}
            disabled={loading}
            style={{
              width:'100%', padding:'13px',
              background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              border:'none', borderRadius:11, color:'#fff',
              fontSize:14, fontWeight:700, cursor: loading ? 'wait' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:'0 4px 20px rgba(124,92,252,0.45)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <><span style={{ animation:'spin 0.9s linear infinite', display:'inline-block' }}>⟳</span> PostCore is planning…</>
            ) : (
              <><IpSparkle size={15} /> Generate {estPosts} Ideas</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AiSuggestionsPanel ───────────────────────────────────────────────────
function AiSuggestionsPanel({ suggestions, dateRange, onConfirm, onDismiss, loading, t }) {
  const [selected, setSelected] = useState(() => new Set(suggestions.map((_,i)=>i)));
  const toggle  = i => { const s=new Set(selected); s.has(i)?s.delete(i):s.add(i); setSelected(s); };
  const all     = () => setSelected(new Set(suggestions.map((_,i)=>i)));
  const none    = () => setSelected(new Set());

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1100,
      background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{
        width:'100%', maxWidth:680, maxHeight:'88vh',
        background:'#0F0F18', borderRadius:16,
        border:'1px solid rgba(255,255,255,0.1)',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <IpSparkle size={16} color="#fff" />
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:'#fff' }}>PostCore's Content Plan</div>
          </div>
          <div style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.55 }}>
            {suggestions.length} ideas for {fmtShort(dateRange?.start)} – {fmtShort(dateRange?.end)}.
            Deselect anything you don't want, then add the rest to your calendar.
          </div>
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={all}  style={{ fontSize:11, color:'#7C5CFC', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Select all</button>
            <span style={{ color:'#374151' }}>·</span>
            <button onClick={none} style={{ fontSize:11, color:'#6B7280', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>None</button>
            <span style={{ fontSize:11, color:'#4B5563', marginLeft:'auto' }}>{selected.size} / {suggestions.length} selected</span>
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 24px' }}>
          {suggestions.map((s, i) => {
            const tc = typeColor(s.content_type);
            const checked = selected.has(i);
            return (
              <div key={i} onClick={()=>toggle(i)} style={{
                display:'flex', alignItems:'flex-start', gap:12,
                padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)',
                cursor:'pointer', opacity: checked ? 1 : 0.4, transition:'opacity 120ms',
              }}>
                <div style={{
                  width:18, height:18, borderRadius:4, flexShrink:0, marginTop:2,
                  border:`2px solid ${checked ? '#7C5CFC' : 'rgba(255,255,255,0.2)'}`,
                  background: checked ? '#7C5CFC' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {checked && <IpCheck size={10} color="#fff" />}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:11, color:'#6B7280' }}>{fmtShort(s.plan_date)}</span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                      background:`${tc}22`, color:tc }}>
                      {CONTENT_TYPES.find(c=>c.value===s.content_type)?.label || s.content_type}
                    </span>
                    {(s.platforms||[]).length > 0 && (
                      <span style={{ fontSize:10, color:'#4B5563' }}>
                        {s.platforms.map(p=>p.split('_')[0]).join(', ')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F3F4F6', marginBottom:3 }}>{s.title}</div>
                  <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.55 }}>{s.notes}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:10 }}>
          <button
            onClick={()=>onConfirm(suggestions.filter((_,i)=>selected.has(i)))}
            disabled={loading || selected.size===0}
            style={{
              flex:1, padding:'12px',
              background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              border:'none', borderRadius:10, color:'#fff',
              fontSize:14, fontWeight:700,
              cursor: selected.size===0||loading ? 'not-allowed' : 'pointer',
              opacity: selected.size===0 ? 0.5 : 1,
            }}
          >
            {loading ? 'Adding to calendar…' : `Add ${selected.size} to Calendar`}
          </button>
          <button onClick={onDismiss} style={{
            padding:'12px 20px', background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
            color:'#9CA3AF', fontSize:13, fontWeight:600, cursor:'pointer',
          }}>Discard</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ContentCalendarPage() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(false);

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editPlan,   setEditPlan]   = useState(null);
  const [newDate,    setNewDate]    = useState('');

  // ai fill
  const [showAiFillModal, setShowAiFillModal]   = useState(false);
  const [aiLoading,       setAiLoading]         = useState(false);
  const [aiSuggestions,   setAiSuggestions]     = useState(null);
  const [aiDateRange,     setAiDateRange]       = useState(null);
  const [addingBulk,      setAddingBulk]        = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const last = daysInMonth(viewYear, viewMonth);
      const start = `${viewYear}-${pad(viewMonth+1)}-01`;
      const end   = `${viewYear}-${pad(viewMonth+1)}-${pad(last)}`;
      const res = await calendarPlansAPI.list(start, end);
      setPlans(res.data.plans || []);
    } catch (e) {
      console.error('[ContentCalendar] load:', e);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { if (mounted) loadPlans(); }, [mounted, loadPlans]);

  function prevMonth() {
    if (viewMonth===0) { setViewYear(y=>y-1); setViewMonth(11); }
    else setViewMonth(m=>m-1);
  }
  function nextMonth() {
    if (viewMonth===11) { setViewYear(y=>y+1); setViewMonth(0); }
    else setViewMonth(m=>m+1);
  }

  function openNewPlan(date) { setEditPlan(null); setNewDate(date); setDrawerOpen(true); }
  function openEditPlan(p)   { setEditPlan(p);    setNewDate('');   setDrawerOpen(true); }

  async function savePlan(data) {
    if (editPlan?.id) {
      const r = await calendarPlansAPI.update(editPlan.id, data);
      setPlans(prev => prev.map(p => p.id===editPlan.id ? r.data.plan : p));
    } else {
      const r = await calendarPlansAPI.create({ ...data, plan_date: newDate });
      setPlans(prev => [...prev, r.data.plan]);
    }
    setDrawerOpen(false);
  }

  async function deletePlan(id) {
    await calendarPlansAPI.remove(id);
    setPlans(prev => prev.filter(p=>p.id!==id));
    setDrawerOpen(false);
  }

  async function generateFromPlan(id) {
    const res = await calendarPlansAPI.getContext(id);
    const ctx = res.data.wizardContext;
    sessionStorage.setItem('wizard_prefill', JSON.stringify({ ...ctx, planId: id }));
    setDrawerOpen(false);
    router.push('/wizard?from=calendar');
  }

  async function handleAiFill(opts) {
    setAiLoading(true);
    try {
      const res = await calendarPlansAPI.aiFill(opts);
      setAiSuggestions(res.data.suggestions || []);
      setAiDateRange(res.data.dateRange || null);
      setShowAiFillModal(false);
    } catch (e) {
      alert('Failed to generate ideas. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function confirmAISuggestions(confirmed) {
    setAddingBulk(true);
    try {
      const created = await Promise.all(confirmed.map(s => calendarPlansAPI.create(s)));
      setPlans(prev => [...prev, ...created.map(r=>r.data.plan)]);
      setAiSuggestions(null);
      // Navigate to the month of the first suggestion if different
      if (confirmed.length > 0) {
        const d = new Date(confirmed[0].plan_date + 'T00:00:00');
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    } catch (e) {
      console.error('[ContentCalendar] bulk add:', e);
    } finally {
      setAddingBulk(false);
    }
  }

  // Calendar grid construction
  const firstDay  = firstDayOfWeek(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevDays  = daysInMonth(viewYear, viewMonth===0 ? 11 : viewMonth-1);
  const cells = [];
  for (let i=firstDay-1; i>=0; i--)         cells.push({ day:prevDays-i,  cur:false });
  for (let d=1; d<=totalDays; d++)           cells.push({ day:d,           cur:true  });
  while (cells.length < 42)                  cells.push({ day:cells.length-firstDay-totalDays+1, cur:false });

  const nPlanned   = plans.filter(p=>p.status==='planned').length;
  const nScheduled = plans.filter(p=>p.status==='scheduled').length;
  const nPublished = plans.filter(p=>p.status==='published').length;

  if (!mounted) return null;

  return (
    <Layout title="Content Calendar" subtitle="Plan your strategy — then generate posts with PostCore">
      <style>{`
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth:1200, margin:'0 auto' }}>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>

          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={prevMonth} style={{ padding:'7px 13px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:t.text, cursor:'pointer', fontSize:17 }}>‹</button>
            <div style={{ minWidth:168, textAlign:'center', fontSize:20, fontWeight:800, color:t.text, letterSpacing:'-0.03em' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button onClick={nextMonth} style={{ padding:'7px 13px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:t.text, cursor:'pointer', fontSize:17 }}>›</button>
            <button onClick={()=>{setViewYear(today.getFullYear());setViewMonth(today.getMonth());}}
              style={{ padding:'6px 12px', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:t.textMuted, cursor:'pointer', fontSize:12, fontWeight:600 }}>Today</button>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:8 }}>
            {[{l:'Planned',v:nPlanned,c:'#9CA3AF'},{l:'Scheduled',v:nScheduled,c:'#7C5CFC'},{l:'Published',v:nPublished,c:'#22C55E'}].map(s=>(
              <div key={s.l} style={{ padding:'5px 13px', borderRadius:20, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:s.c }} />
                <span style={{ fontSize:11, color:t.textMuted }}>{s.l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:t.text }}>{s.v}</span>
              </div>
            ))}
          </div>

          {/* AI Fill button */}
          <button
            onClick={()=>setShowAiFillModal(true)}
            style={{
              padding:'9px 18px',
              background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              border:'none', borderRadius:10, color:'#fff',
              fontSize:13, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', gap:7,
              boxShadow:'0 4px 16px rgba(124,92,252,0.35)',
            }}
          >
            <IpSparkle size={14} />
            AI Plan
          </button>
        </div>

        {/* ── Empty state banner ──────────────────────────────────────── */}
        {plans.length===0 && !loading && (
          <div style={{
            background:'rgba(124,92,252,0.07)', border:'1px solid rgba(124,92,252,0.18)',
            borderRadius:12, padding:'14px 18px', marginBottom:18,
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ width:36, height:36, borderRadius:8, background:'linear-gradient(135deg,#7C5CFC,#9B7FFF)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <IpSparkle size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:t.text }}>No plans for {MONTH_NAMES[viewMonth]}</div>
              <div style={{ fontSize:13, color:t.textMuted, marginTop:1 }}>
                Tap <strong style={{ color:'#9B7FFF' }}>AI Plan</strong> to generate a full content strategy, or click any day cell to add an idea manually.
              </div>
            </div>
          </div>
        )}

        {/* ── Calendar grid ───────────────────────────────────────────── */}
        <div style={{
          background: theme==='dark' ? 'rgba(15,15,24,0.6)' : t.card,
          border:'1px solid rgba(255,255,255,0.07)', borderRadius:14,
          backdropFilter:'blur(16px)', overflow:'hidden',
        }}>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {DAY_LABELS.map(d=>(
              <div key={d} style={{ padding:'9px 8px', fontSize:11, fontWeight:700, color:t.textMuted,
                textTransform:'uppercase', letterSpacing:'0.07em', textAlign:'center',
                borderRight:'1px solid rgba(255,255,255,0.04)' }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:6, gap:4 }}>
            {cells.map((cell, idx) => {
              // Compute year/month for off-month cells
              let cy = viewYear, cm = viewMonth;
              if (!cell.cur && idx < 7) { cm = viewMonth===0 ? 11 : viewMonth-1; if (viewMonth===0) cy--; }
              else if (!cell.cur)       { cm = viewMonth===11 ? 0 : viewMonth+1; if (viewMonth===11) cy++; }
              const dateStr = toStr(cy, cm, cell.day);
              const isToday = cell.cur && cell.day===today.getDate() && viewMonth===today.getMonth() && viewYear===today.getFullYear();
              return (
                <CalendarCell
                  key={idx}
                  day={cell.day}
                  dateStr={dateStr}
                  plans={cell.cur ? plans : []}
                  isToday={isToday}
                  isCurrent={cell.cur}
                  onSelectPlan={openEditPlan}
                  onAddPlan={openNewPlan}
                  t={t}
                />
              );
            })}
          </div>
        </div>

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <div style={{ marginTop:14, display:'flex', gap:16, flexWrap:'wrap' }}>
          {CONTENT_TYPES.map(ct=>(
            <div key={ct.value} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:3, height:14, borderRadius:2, background:ct.color }} />
              <span style={{ fontSize:11, color:t.textMuted }}>{ct.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modals / Drawers ─────────────────────────────────────────── */}

      {showAiFillModal && (
        <AiFillModal
          viewMonth={viewMonth}
          viewYear={viewYear}
          onConfirm={handleAiFill}
          onClose={()=>setShowAiFillModal(false)}
          loading={aiLoading}
          t={t}
        />
      )}

      {aiSuggestions && (
        <AiSuggestionsPanel
          suggestions={aiSuggestions}
          dateRange={aiDateRange}
          onConfirm={confirmAISuggestions}
          onDismiss={()=>setAiSuggestions(null)}
          loading={addingBulk}
          t={t}
        />
      )}

      {drawerOpen && (
        <PlanDrawer
          plan={editPlan}
          defaultDate={newDate}
          onClose={()=>setDrawerOpen(false)}
          onSave={savePlan}
          onDelete={deletePlan}
          onGenerate={generateFromPlan}
          t={t}
          theme={theme}
        />
      )}

    </Layout>
  );
}
