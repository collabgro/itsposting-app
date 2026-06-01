import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { studioAPI, customerAPI } from '../lib/api';
import { IpPhotoStudio, IpClose, IpVideo, IpSparkle, IpSearch, IpCopy, IpEdit, IpDelete } from '../components/icons';
import { EmptyState } from '../components/ui';

const INDUSTRIES = ['all','plumbing','hvac','roofing','concrete','landscaping','electrical','painting','pest_control','cleaning','general_contractor'];
const INDUSTRY_LABELS = {
  all:'All', plumbing:'Plumbing', hvac:'HVAC', roofing:'Roofing', concrete:'Concrete',
  landscaping:'Landscaping', electrical:'Electrical', painting:'Painting',
  pest_control:'Pest Control', cleaning:'Cleaning', general_contractor:'General',
};
const CANVAS_SIZES = [
  { id:'ig_portrait', label:'Instagram Portrait', desc:'1080 × 1350 px — best for feed posts', icon:'📷' },
  { id:'ig_square',   label:'Instagram Square',   desc:'1080 × 1080 px — grid-friendly',      icon:'⬛' },
  { id:'ig_story',    label:'Instagram Story',    desc:'1080 × 1920 px — full screen',         icon:'📱' },
  { id:'fb_post',     label:'Facebook Post',      desc:'1200 × 630 px — landscape',            icon:'🖼️' },
  { id:'google_biz',  label:'Google Business',    desc:'720 × 720 px — square',                icon:'🔍' },
];

const CAT_ICONS = {
  'before-after':'◑', 'social-proof':'⭐', 'seasonal':'❄', 'educational':'💡',
  'promotional':'📣', 'team':'👥',
};

// Relative time helper
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Canvas size label
function sizeLabel(w, h) {
  if (!w || !h) return null;
  if (w === 1080 && h === 1350) return 'Portrait';
  if (w === 1080 && h === 1080) return 'Square';
  if (w === 1080 && h === 1920) return 'Story';
  if (w === 1200 && h === 630) return 'Facebook';
  if (w === 720  && h === 720)  return 'Google';
  return `${w}×${h}`;
}

// Rounded-rect path helper (avoids ctx.roundRect which is unavailable in older Safari)
function rrect(ctx, x, y, w, h, r) {
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function TemplatesPage() {
  const router = useRouter();
  const { t } = useTheme();

  const [curatedTemplates,     setCuratedTemplates]     = useState([]);
  const [curatedLoading,       setCuratedLoading]       = useState(false);
  const [selectedIndustry,     setSelectedIndustry]     = useState('all');
  const [creations,            setCreations]            = useState([]);
  const [creationsLoading,     setCreationsLoading]     = useState(false);
  const [templateThumbs,       setTemplateThumbs]       = useState({});
  const [templatePexelsThumbs, setTemplatePexelsThumbs] = useState({});
  const [showSizePicker,       setShowSizePicker]       = useState(false);
  const [pickerSizeId,         setPickerSizeId]         = useState('ig_portrait');
  const [isAdmin,              setIsAdmin]              = useState(false);
  const [activeSection,        setActiveSection]        = useState('templates'); // 'templates' | 'mydesigns'

  // My Designs UI state
  const [designSearch,    setDesignSearch]    = useState('');
  const [designSort,      setDesignSort]      = useState('recent'); // 'recent' | 'oldest' | 'name'
  const [menuOpenId,      setMenuOpenId]      = useState(null);
  const [renamingId,      setRenamingId]      = useState(null);
  const [renameValue,     setRenameValue]     = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [duplicatingId,   setDuplicatingId]   = useState(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    customerAPI.getProfile().then(r => setIsAdmin(!!r.data?.is_admin)).catch(() => {});
    loadCurated();
    loadCreations();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadCurated = async (industry = 'all') => {
    setCuratedLoading(true);
    try {
      const { data } = await studioAPI.getTemplates(industry !== 'all' ? { industry, limit: 30 } : { limit: 30 });
      setCuratedTemplates(data?.templates || []);
    } catch { setCuratedTemplates([]); }
    finally { setCuratedLoading(false); }
  };

  const loadCreations = async () => {
    setCreationsLoading(true);
    try {
      const { data } = await studioAPI.getCreations({ limit: 50 });
      setCreations(Array.isArray(data?.creations) ? data.creations : []);
    } catch { setCreations([]); }
    finally { setCreationsLoading(false); }
  };

  const handleRenameStart = useCallback((c) => {
    setMenuOpenId(null);
    setRenamingId(c.id);
    setRenameValue(c.overlay_title || 'Untitled');
  }, []);

  const handleRenameSave = useCallback(async (id) => {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;
    try {
      await studioAPI.updateCreation(id, { title: trimmed });
      setCreations(prev => prev.map(c => c.id === id ? { ...c, overlay_title: trimmed, updated_at: new Date().toISOString() } : c));
    } catch {}
  }, [renameValue]);

  const handleDuplicate = useCallback(async (c) => {
    setMenuOpenId(null);
    setDuplicatingId(c.id);
    try {
      const { data } = await studioAPI.duplicateCreation(c.id);
      if (data?.creation) setCreations(prev => [data.creation, ...prev]);
    } catch {}
    setDuplicatingId(null);
  }, []);

  const handleDelete = useCallback(async (id) => {
    setDeleteConfirmId(null);
    try {
      await studioAPI.deleteCreation(id);
      setCreations(prev => prev.filter(c => c.id !== id));
    } catch {}
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpenId]);

  // Filtered + sorted designs
  const filteredDesigns = creations
    .filter(c => !designSearch || (c.overlay_title || '').toLowerCase().includes(designSearch.toLowerCase()))
    .sort((a, b) => {
      if (designSort === 'name') return (a.overlay_title || '').localeCompare(b.overlay_title || '');
      if (designSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

  // Canvas-side thumbnail generation — renders actual template layout
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!curatedTemplates.length) return;
    const needsThumbs = curatedTemplates.filter(tmpl => !tmpl.thumbnail_url && !templateThumbs[tmpl.id]);
    if (!needsThumbs.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const TW = 200, TH = 250;
    canvas.width = TW; canvas.height = TH;
    const newThumbs = {};

    needsThumbs.forEach(tmpl => {
      ctx.clearRect(0, 0, TW, TH);

      const page  = tmpl.canvas_json?.pages?.[0] || {};
      const srcW  = tmpl.canvas_width  || 1080;
      const srcH  = tmpl.canvas_height || 1350;
      // Cover-scale: fill TW×TH, clip overflow
      const scale = Math.max(TW / srcW, TH / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const offX  = (TW - drawW) / 2;
      const offY  = (TH - drawH) / 2;

      const bgType = page.bgType || 'color';
      const bgHex  = page.bgColor || '#1a1a2e';
      const bgGrad = page.bgGradient;

      // Clip to canvas bounds
      ctx.save();
      ctx.beginPath();
      ctx.rect(offX, offY, drawW, drawH);
      ctx.clip();

      // ── Background ──────────────────────────────────────────
      if (bgType === 'gradient' && bgGrad?.c1 && bgGrad?.c2) {
        const angle = ((bgGrad.angle || 135) * Math.PI) / 180;
        const cx = offX + drawW / 2, cy = offY + drawH / 2;
        const grd = ctx.createLinearGradient(
          cx - Math.cos(angle) * drawW / 2, cy - Math.sin(angle) * drawH / 2,
          cx + Math.cos(angle) * drawW / 2, cy + Math.sin(angle) * drawH / 2,
        );
        grd.addColorStop(0, bgGrad.c1);
        if (bgGrad.midColor) grd.addColorStop(0.5, bgGrad.midColor);
        grd.addColorStop(1, bgGrad.c2);
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = bgHex;
      }
      ctx.fillRect(offX, offY, drawW, drawH);

      // ── Elements ─────────────────────────────────────────────
      (page.elements || []).forEach(el => {
        if (el.hidden) return;
        const op = el.opacity ?? 1;
        if (op <= 0) return;

        const ex = offX + (el.x || 0) * scale;
        const ey = offY + (el.y || 0) * scale;
        const ew = (el.width  || 100) * scale;
        const eh = (el.height ||  40) * scale;

        ctx.save();
        ctx.globalAlpha = op;

        // Rotation around element centre
        if (el.rotation) {
          ctx.translate(ex + ew / 2, ey + eh / 2);
          ctx.rotate((el.rotation * Math.PI) / 180);
          ctx.translate(-(ex + ew / 2), -(ey + eh / 2));
        }

        if (el.type === 'rect') {
          const cr = (el.cornerRadius || 0) * scale;
          ctx.beginPath();
          rrect(ctx, ex, ey, ew, eh, cr);
          ctx.fillStyle = el.fill || 'transparent';
          if (el.fill) ctx.fill();
          if (el.stroke && el.strokeWidth) {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = el.strokeWidth * scale;
            ctx.stroke();
          }

        } else if (el.type === 'circle') {
          const rx = ew / 2, ry = eh / 2;
          ctx.beginPath();
          ctx.ellipse(ex + rx, ey + ry, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = el.fill || 'transparent';
          if (el.fill) ctx.fill();

        } else if (el.type === 'text' && el.text) {
          const fw = parseInt(el.fontWeight) || 400;
          const isBold = fw >= 600;
          const isItalic = (el.fontStyle || '').includes('italic');
          const fs = Math.max(4, (el.fontSize || 16) * scale);
          ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${fs}px sans-serif`;
          ctx.fillStyle = el.fill || '#fff';
          ctx.textBaseline = 'top';
          ctx.textAlign = el.align || 'left';
          const textX = el.align === 'center' ? ex + ew / 2
                       : el.align === 'right'  ? ex + ew
                       : ex;
          const lineH = fs * (el.lineHeight || 1.2);
          // Simple line-wrap within element width
          const words2 = String(el.text).split(' ');
          let curLine = '';
          let ty = ey;
          words2.forEach(word => {
            const test = curLine + word + ' ';
            if (ew > 0 && ctx.measureText(test).width > ew && curLine) {
              ctx.fillText(curLine.trim(), textX, ty);
              curLine = word + ' ';
              ty += lineH;
            } else {
              curLine = test;
            }
          });
          ctx.fillText(curLine.trim(), textX, ty);

        } else if (el.type === 'image') {
          // Image placeholder — tinted block so the layout is still visible
          ctx.fillStyle = 'rgba(128,128,128,0.18)';
          ctx.beginPath();
          rrect(ctx, ex, ey, ew, eh, 4 * scale);
          ctx.fill();
        }

        ctx.restore();
      });

      ctx.restore(); // end clip

      newThumbs[tmpl.id] = canvas.toDataURL('image/jpeg', 0.9);
    });

    setTemplateThumbs(prev => ({ ...prev, ...newThumbs }));
  }, [curatedTemplates]);

  const handleIndustryFilter = (ind) => {
    setSelectedIndustry(ind);
    setCuratedTemplates([]);
    loadCurated(ind);
  };

  const inpStyle = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: t.input, border: `1px solid ${t.border}`,
    borderRadius: 10, color: t.text, fontSize: 13, outline: 'none',
    transition: 'border-color 140ms',
  };

  return (
    <Layout title="Templates" subtitle="Ready-made designs for every industry">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: t.input, padding: 4, borderRadius: 12, width: isMobile ? '100%' : 'fit-content', border: `1px solid ${t.border}` }}>
        {[
          { id: 'templates',  label: 'ItsPosting Templates', icon: IpSparkle },
          { id: 'mydesigns',  label: 'My Designs',           icon: IpPhotoStudio },
        ].map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
              padding: '8px 18px', borderRadius: 9, border: 'none',
              flex: isMobile ? 1 : undefined,
              background: active ? t.primary : 'transparent',
              color: active ? '#fff' : t.textMuted,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 150ms ease',
              boxShadow: active ? '0 2px 8px rgba(124,92,252,0.35)' : 'none',
            }}>
              <Icon size={14} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        {activeSection === 'templates' ? (
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
            Click any template to customise it with your branding
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
            {creations.length > 0 ? `${creations.length} design${creations.length !== 1 ? 's' : ''} saved` : 'No designs yet'}
          </p>
        )}
        <button
          onClick={() => setShowSizePicker(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: t.primary, color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.35)',
            transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,92,252,0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none';             e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,92,252,0.35)'; }}
        >
          <IpPhotoStudio size={14} /> New Design
        </button>
      </div>

      {/* ── Templates section ── */}
      {activeSection === 'templates' && (
        <div>
          {/* Industry filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {INDUSTRIES.map(ind => (
              <button key={ind} onClick={() => handleIndustryFilter(ind)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: selectedIndustry === ind ? t.primary : t.input,
                color:      selectedIndustry === ind ? '#fff'     : t.textMuted,
                border:     `1px solid ${selectedIndustry === ind ? t.primary : t.border}`,
                cursor: 'pointer', transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.text; } }}
              onMouseLeave={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.border;        e.currentTarget.style.color = t.textMuted; } }}
              >
                {INDUSTRY_LABELS[ind]}
              </button>
            ))}
          </div>

          {curatedLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.07}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : curatedTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🎨</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 8 }}>Templates coming soon</div>
              <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>ItsPosting is building industry-specific templates for your business. Check back soon!</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, paddingBottom: 60 }}>
              {curatedTemplates.map(tmpl => {
                const thumbSrc = tmpl.thumbnail_url || templatePexelsThumbs[tmpl.id] || templateThumbs[tmpl.id];
                const page    = tmpl.canvas_json?.pages?.[0] || {};
                const bgColor = page.bgColor || '#1a1a2e';
                const bgGrad  = page.bgGradient;
                // luminance-aware contrast for JSX fallback
                const hex3 = bgColor.replace('#', '');
                const fr = parseInt(hex3.substring(0, 2), 16) || 26;
                const fg = parseInt(hex3.substring(2, 4), 16) || 26;
                const fb = parseInt(hex3.substring(4, 6), 16) || 46;
                const fbLum = (0.299 * fr + 0.587 * fg + 0.114 * fb) / 255;
                const fbTextClr = fbLum < 0.5 ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.75)';
                const fbBg = page.bgType === 'gradient' && bgGrad?.c1 && bgGrad?.c2
                  ? `linear-gradient(${bgGrad.angle || 135}deg, ${bgGrad.c1}, ${bgGrad.c2})`
                  : bgColor;
                return (
                  <div
                    key={tmpl.id}
                    style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', position: 'relative', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.tmpl-hover').style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border;        e.currentTarget.style.transform = 'none';                            e.currentTarget.style.boxShadow = 'none';       e.currentTarget.querySelector('.tmpl-hover').style.opacity = '0'; }}
                  >
                    <div style={{ aspectRatio: '4/5', background: t.input, position: 'relative', overflow: 'hidden' }}>
                      {thumbSrc
                        ? <img src={thumbSrc} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: fbBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                            <span style={{ fontSize: 28 }}>{CAT_ICONS[tmpl.category] || '✦'}</span>
                            <span style={{ fontSize: 10, color: fbTextClr, textAlign: 'center', fontWeight: 700, lineHeight: 1.4 }}>{tmpl.name}</span>
                          </div>
                      }
                      <div className="tmpl-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', gap: 10, flexDirection: 'column', backdropFilter: 'blur(2px)' }}>
                        <button
                          onClick={() => router.push(`/templates/editor?template=${tmpl.id}`)}
                          style={{ padding: '9px 22px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.5)' }}
                        >
                          Use Template
                        </button>
                        {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/templates/editor?template=${tmpl.id}`); }}
                            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 22, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            ✏ Edit Template
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</div>
                      {tmpl.category && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, textTransform: 'capitalize' }}>{tmpl.category.replace(/-/g, ' ')}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── My Designs section ── */}
      {activeSection === 'mydesigns' && (
        <div>
          {creationsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : creations.length === 0 ? (
            <EmptyState
              icon={IpPhotoStudio}
              title="No designs yet"
              subtitle="Click 'New Design' above to create your first branded graphic"
              action={<button onClick={() => setShowSizePicker(true)} style={{ padding: '10px 24px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.35)' }}>New Design</button>}
            />
          ) : (
            <>
              {/* ── Search + Sort toolbar ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                  <IpSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }} />
                  <input
                    value={designSearch}
                    onChange={e => setDesignSearch(e.target.value)}
                    placeholder="Search designs…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 34px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 13, outline: 'none' }}
                  />
                  {designSearch && (
                    <button onClick={() => setDesignSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                      <IpClose size={12} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[{ id: 'recent', label: 'Recent' }, { id: 'oldest', label: 'Oldest' }, { id: 'name', label: 'A–Z' }].map(s => (
                    <button key={s.id} onClick={() => setDesignSort(s.id)} style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 120ms ease',
                      background: designSort === s.id ? t.primary : t.input,
                      color:      designSort === s.id ? '#fff'     : t.textMuted,
                      border:     `1px solid ${designSort === s.id ? t.primary : t.border}`,
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── No search results ── */}
              {filteredDesigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>No designs match "{designSearch}"</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, paddingBottom: 60 }}>
                  {filteredDesigns.map(c => {
                    const editPath = c.creation_type === 'video' ? `/templates/editor?id=${c.id}&mode=video` : `/templates/editor?id=${c.id}`;
                    const badge = sizeLabel(c.canvas_width, c.canvas_height);
                    const isDuplicating = duplicatingId === c.id;
                    const isDeleting = deleteConfirmId === c.id;
                    return (
                      <div key={c.id} style={{ borderRadius: 14, overflow: 'visible', border: `1px solid ${t.border}`, background: t.card, position: 'relative', transition: 'border-color 180ms ease, box-shadow 180ms ease', cursor: 'default' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.dhover-edit').style.opacity = '1'; e.currentTarget.querySelector('.dhover-menu-btn').style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.querySelector('.dhover-edit').style.opacity = '0'; e.currentTarget.querySelector('.dhover-menu-btn').style.opacity = '0'; }}
                      >
                        {/* ── Thumbnail ── */}
                        <div
                          style={{ aspectRatio: c.creation_type === 'video' ? '9/16' : '4/5', borderRadius: '13px 13px 0 0', overflow: 'hidden', position: 'relative', background: t.input, cursor: 'pointer' }}
                          onClick={() => router.push(editPath)}
                        >
                          {c.creation_type === 'video' ? (
                            c.output_url
                              ? <video src={c.output_url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: t.textMuted }}>{c.render_status === 'rendering' ? 'Rendering…' : 'Processing'}</div>
                          ) : (
                            c.output_url
                              ? <img src={c.output_url} alt={c.overlay_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: t.textMuted }}>No preview</div>
                          )}

                          {/* Type / size badge — top-left */}
                          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
                            {c.creation_type === 'video' && (
                              <span style={{ background: 'rgba(0,0,0,0.72)', borderRadius: 5, padding: '3px 7px', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                                <IpVideo size={9} /> Video
                              </span>
                            )}
                            {badge && (
                              <span style={{ background: 'rgba(0,0,0,0.56)', borderRadius: 5, padding: '3px 7px', fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 500, backdropFilter: 'blur(4px)' }}>
                                {badge}
                              </span>
                            )}
                          </div>

                          {/* Kebab menu button — top-right, reveals on hover */}
                          <button
                            className="dhover-menu-btn"
                            onClick={e => { e.stopPropagation(); setMenuOpenId(prev => prev === c.id ? null : c.id); }}
                            style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 7, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms, background 120ms', backdropFilter: 'blur(4px)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.85)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" fill="#fff"/><circle cx="12" cy="12" r="2" fill="#fff"/><circle cx="12" cy="19" r="2" fill="#fff"/></svg>
                          </button>

                          {/* Kebab dropdown */}
                          {menuOpenId === c.id && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 44, right: 8, background: t.card, border: `1px solid ${t.border}`, borderRadius: 11, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', zIndex: 50, minWidth: 162, overflow: 'hidden' }}>
                              {[
                                { label: 'Edit', icon: IpEdit, action: () => { setMenuOpenId(null); router.push(editPath); } },
                                { label: isDuplicating ? 'Duplicating…' : 'Make a copy', icon: IpCopy, action: () => handleDuplicate(c) },
                                { label: 'Rename', action: () => handleRenameStart(c), icon: null },
                                { label: 'Delete', icon: IpDelete, action: () => { setMenuOpenId(null); setDeleteConfirmId(c.id); }, danger: true },
                              ].map(item => (
                                <button key={item.label} onClick={item.action} style={{
                                  width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', cursor: isDuplicating && item.label !== 'Edit' ? 'default' : 'pointer',
                                  color: item.danger ? '#ef4444' : t.text, fontSize: 13, fontWeight: 500, textAlign: 'left',
                                  display: 'flex', alignItems: 'center', gap: 9, transition: 'background 100ms',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : (t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'); }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  {item.icon && <item.icon size={13} />}
                                  {!item.icon && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Edit CTA — bottom gradient, reveals on hover */}
                          <div className="dhover-edit" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 10px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)', opacity: 0, transition: 'opacity 150ms', pointerEvents: 'none' }}>
                            <div style={{ width: '100%', padding: '8px 0', background: 'rgba(255,255,255,0.95)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'center', letterSpacing: '0.01em' }}>
                              Open
                            </div>
                          </div>
                        </div>

                        {/* ── Info strip below thumbnail ── */}
                        <div style={{ padding: '10px 12px 12px' }}>
                          {renamingId === c.id ? (
                            <input
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => handleRenameSave(c.id)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(c.id); if (e.key === 'Escape') setRenamingId(null); }}
                              autoFocus
                              style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${t.primary}`, borderRadius: 5, color: t.text, fontSize: 13, fontWeight: 600, padding: '2px 6px', outline: 'none' }}
                            />
                          ) : (
                            <div
                              onClick={() => handleRenameStart(c)}
                              title="Click to rename"
                              style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', paddingBottom: 1 }}
                            >
                              {c.overlay_title || 'Untitled'}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
                            Edited {timeAgo(c.updated_at || c.created_at)}
                          </div>
                        </div>

                        {/* ── Delete confirmation inline ── */}
                        {isDeleting && (
                          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, background: t.isDark ? 'rgba(15,10,30,0.93)' : 'rgba(255,255,255,0.95)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 40, padding: 20, backdropFilter: 'blur(4px)' }}>
                            <div style={{ fontSize: 28 }}>🗑️</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, textAlign: 'center' }}>Delete this design?</div>
                            <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', lineHeight: 1.5 }}>This cannot be undone.</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                              <button onClick={() => handleDelete(c.id)} style={{ padding: '7px 16px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Size Picker Modal ── */}
      {showSizePicker && (
        <div onClick={() => setShowSizePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'scaleIn 200ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Choose a canvas size</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: t.textMuted }}>Select the platform you're designing for</p>
              </div>
              <button onClick={() => setShowSizePicker(false)} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
                <IpClose size={15} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CANVAS_SIZES.map(size => (
                <label key={size.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, border: `2px solid ${pickerSizeId === size.id ? t.primary : t.border}`, background: pickerSizeId === size.id ? (t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.05)') : 'transparent', cursor: 'pointer', transition: 'all 120ms ease' }}>
                  <input type="radio" name="canvas-size" value={size.id} checked={pickerSizeId === size.id} onChange={() => setPickerSizeId(size.id)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{size.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{size.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{size.desc}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${pickerSizeId === size.id ? t.primary : t.border}`, background: pickerSizeId === size.id ? t.primary : 'transparent', flexShrink: 0, transition: 'all 120ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pickerSizeId === size.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={() => { setShowSizePicker(false); router.push(`/templates/editor?size=${pickerSizeId}`); }}
                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#7C5CFC,#9B7FFF)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,92,252,0.4)' }}
              >
                Start Designing →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%,100% { opacity:0.5; } 50% { opacity:1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </Layout>
  );
}
