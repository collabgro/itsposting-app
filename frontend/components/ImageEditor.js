import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../lib/theme';

const FILTERS = [
  { id: 'none',     label: 'None',    css: '' },
  { id: 'duotone',  label: 'Duotone', css: 'sepia(100%) saturate(300%) hue-rotate(220deg)' },
  { id: 'bw',       label: 'B & W',   css: 'grayscale(100%)' },
  { id: 'vintage',  label: 'Vintage', css: 'sepia(50%) contrast(0.9) brightness(0.9) saturate(1.3)' },
  { id: 'cold',     label: 'Cold',    css: 'saturate(0.8) hue-rotate(200deg) brightness(1.05)' },
  { id: 'warm',     label: 'Warm',    css: 'sepia(30%) saturate(1.3) hue-rotate(-20deg)' },
];

const CROP_PRESETS = [
  { id: 'custom',       label: 'Custom',    desc: '',       ratio: null,  group: 'Custom' },
  { id: 'ig-square',    label: 'Square',    desc: '1:1',    ratio: 1,     group: 'Instagram' },
  { id: 'ig-landscape', label: 'Landscape', desc: '1.91:1', ratio: 1.91,  group: 'Instagram' },
  { id: 'ig-portrait',  label: 'Portrait',  desc: '4:5',    ratio: 4/5,   group: 'Instagram' },
  { id: 'ig-story',     label: 'Story',     desc: '9:16',   ratio: 9/16,  group: 'Instagram' },
  { id: 'fb-landscape', label: 'Landscape', desc: '1.91:1', ratio: 1.91,  group: 'Facebook' },
  { id: 'fb-square',    label: 'Square',    desc: '1:1',    ratio: 1,     group: 'Facebook' },
];

const STICKER_EMOJIS = ['😀','😂','🥰','😎','🤩','👍','🔥','💯','⭐','🎉','💪','🙌','✅','❤️','🚀','🏆','💡','🎯','📸','✨'];
const SHAPES = ['square', 'circle', 'triangle', 'star', 'pentagon', 'hexagon'];

export default function ImageEditor({ imageUrl, onSave, onClose }) {
  const { t } = useTheme();
  const [activeTool, setActiveTool] = useState('crop');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0, saturation: 0, blur: 0 });
  const [cropPreset, setCropPreset] = useState('custom');
  const [expandedSticker, setExpandedSticker] = useState('Emojis');
  const [saving, setSaving] = useState(false);
  const [brushHardness, setBrushHardness] = useState(100);
  const [brushSize, setBrushSize] = useState(13);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushColorHex, setBrushColorHex] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const previewRef = useRef(null);
  const lastPos = useRef(null);

  const filterCss = useMemo(() => {
    const parts = [];
    const flt = FILTERS.find(f => f.id === selectedFilter);
    if (flt?.css) parts.push(flt.css);
    if (adj.brightness !== 0) parts.push(`brightness(${1 + adj.brightness / 100})`);
    if (adj.contrast   !== 0) parts.push(`contrast(${1 + adj.contrast / 100})`);
    if (adj.saturation !== 0) parts.push(`saturate(${1 + adj.saturation / 100})`);
    if (adj.blur       !== 0) parts.push(`blur(${adj.blur}px)`);
    return parts.join(' ') || 'none';
  }, [selectedFilter, adj]);

  // Init canvas size to match the displayed image
  useEffect(() => {
    if (activeTool !== 'brush') return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const sync = () => {
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;
      canvas.style.width = img.offsetWidth + 'px';
      canvas.style.height = img.offsetHeight + 'px';
    };
    if (img.complete) sync(); else img.addEventListener('load', sync, { once: true });
  }, [activeTool]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = useCallback((e) => {
    if (activeTool !== 'brush') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, [activeTool]);

  const draw = useCallback((e) => {
    if (!isDrawing || activeTool !== 'brush') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    const alpha = brushHardness / 100;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = brushColor;
    ctx.shadowBlur = brushHardness < 80 ? (100 - brushHardness) * 0.3 : 0;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [isDrawing, activeTool, brushColor, brushSize, brushHardness]);

  const endDraw = useCallback(() => { setIsDrawing(false); lastPos.current = null; }, []);

  const clearBrush = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    setSaving(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const preset = CROP_PRESETS.find(p => p.id === cropPreset);
      let sw = img.naturalWidth, sh = img.naturalHeight;
      let sx = 0, sy = 0;
      if (preset?.ratio) {
        const srcRatio = sw / sh;
        if (srcRatio > preset.ratio) { sw = Math.round(sh * preset.ratio); sx = Math.round((img.naturalWidth - sw) / 2); }
        else if (srcRatio < preset.ratio) { sh = Math.round(sw / preset.ratio); sy = Math.round((img.naturalHeight - sh) / 2); }
      }
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (filterCss !== 'none') ctx.filter = filterCss;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      // Composite brush strokes on top
      const brushCanvas = canvasRef.current;
      if (brushCanvas && brushCanvas.width > 0) {
        ctx.filter = 'none';
        ctx.drawImage(brushCanvas, 0, 0, sw, sh);
      }
      canvas.toBlob(blob => { onSave(URL.createObjectURL(blob)); setSaving(false); }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { onSave(imageUrl); setSaving(false); };
    img.src = imageUrl;
  };

  const toolIconStyle = (id) => ({
    width: 48, height: 48, background: activeTool === id ? t.primary : 'none',
    border: 'none', cursor: 'pointer', borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: activeTool === id ? '#fff' : t.textMuted, transition: 'all 150ms',
  });

  const SliderRow = ({ label, value, onChange, min, max }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: t.textSecondary }}>{label}</span>
        <input type="number" value={value} min={min} max={max}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 52, padding: '3px 6px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, textAlign: 'center' }}
        />
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: t.primary, cursor: 'pointer' }}
      />
    </div>
  );

  const PANEL_TITLE = { crop: 'Crop', filters: 'Filters', adjustments: 'Adjustments', text: 'Text', stickers: 'Stickers', brush: 'Brush' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.isDark ? '#111118' : '#fff', borderRadius: 16, width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Edit Image</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>The supported image formats are PNG and JPEG.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" disabled title="Undo" style={{ width: 32, height: 32, background: 'none', border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'default', opacity: 0.35, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
            <button type="button" disabled title="Redo" style={{ width: 32, height: 32, background: 'none', border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'default', opacity: 0.35, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
            </button>
            <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px' }} />
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, borderRadius: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left sidebar — tool icons */}
          <div style={{ width: 60, background: t.isDark ? 'rgba(255,255,255,0.02)' : '#f7f8fa', borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 4, flexShrink: 0 }}>
            {[
              { id: 'crop',        svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 2 6 18 22 18"/><polyline points="2 6 18 6 18 22"/></svg> },
              { id: 'filters',     svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg> },
              { id: 'adjustments', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> },
              { id: 'text',        svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
              { id: 'stickers',    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
              { id: 'brush',       svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg> },
            ].map(({ id, svg }) => (
              <button key={id} type="button" title={PANEL_TITLE[id]}
                onClick={() => setActiveTool(id)}
                style={toolIconStyle(id)}
                onMouseEnter={e => { if (activeTool !== id) e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { if (activeTool !== id) e.currentTarget.style.background = 'none'; }}
              >{svg}</button>
            ))}
          </div>

          {/* Options panel */}
          <div style={{ width: 290, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${t.border}`, background: t.isDark ? 'rgba(255,255,255,0.02)' : '#f7f8fa', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{PANEL_TITLE[activeTool]}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

              {/* ── CROP ── */}
              {activeTool === 'crop' && (
                <div>
                  {['Custom', 'Instagram', 'Facebook'].map(group => {
                    const presets = CROP_PRESETS.filter(p => p.group === group);
                    if (!presets.length) return null;
                    return (
                      <div key={group} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{group}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: group === 'Custom' ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
                          {presets.map(preset => {
                            const isActive = cropPreset === preset.id;
                            const visW = preset.ratio ? (preset.ratio >= 1 ? 40 : Math.round(40 * preset.ratio)) : 40;
                            const visH = preset.ratio ? (preset.ratio <= 1 ? 40 : Math.round(40 / preset.ratio)) : 40;
                            return (
                              <button key={preset.id} type="button" onClick={() => setCropPreset(preset.id)}
                                style={{ padding: '14px 8px 12px', background: isActive ? t.primaryBg : t.isDark ? 'rgba(255,255,255,0.03)' : '#f7f8fa', border: `1.5px solid ${isActive ? t.primary : t.border}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 150ms' }}
                              >
                                <div style={{ width: visW, height: visH, background: isActive ? t.primary : t.isDark ? 'rgba(255,255,255,0.15)' : '#d0d5dd', borderRadius: 3, opacity: isActive ? 0.7 : 0.5, transition: 'all 150ms' }} />
                                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? t.primary : t.textSecondary }}>{preset.label}</div>
                                {preset.desc && <div style={{ fontSize: 10, color: t.textMuted, marginTop: -4 }}>{preset.desc}</div>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => {}}
                    style={{ width: '100%', padding: '10px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Apply Crop
                  </button>
                </div>
              )}

              {/* ── FILTERS ── */}
              {activeTool === 'filters' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FILTERS.map(flt => {
                    const isActive = selectedFilter === flt.id;
                    return (
                      <button key={flt.id} type="button" onClick={() => setSelectedFilter(flt.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: isActive ? t.primaryBg : t.isDark ? 'rgba(255,255,255,0.03)' : '#f7f8fa', border: `1.5px solid ${isActive ? t.primary : t.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: isActive ? t.primary : 'transparent', transition: 'all 150ms' }}>
                          <polyline points="1,5 4,8 9,2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? t.primary : t.text, flex: 1 }}>{flt.label}</span>
                        <div style={{ width: 52, height: 52, borderRadius: 7, overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${isActive ? t.primary : t.border}` }}>
                          {flt.id === 'none'
                            ? <div style={{ width: '100%', height: '100%', background: t.isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                              </div>
                            : <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: flt.css }} />
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── ADJUSTMENTS ── */}
              {activeTool === 'adjustments' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Light</div>
                  <SliderRow label="Brightness" value={adj.brightness} onChange={v => setAdj(p => ({ ...p, brightness: v }))} min={-100} max={100} />
                  <SliderRow label="Contrast"   value={adj.contrast}   onChange={v => setAdj(p => ({ ...p, contrast: v }))}   min={-100} max={100} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, marginTop: 4 }}>Color</div>
                  <SliderRow label="Saturation" value={adj.saturation} onChange={v => setAdj(p => ({ ...p, saturation: v }))} min={-100} max={100} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, marginTop: 4 }}>Detail</div>
                  <SliderRow label="Blur" value={adj.blur} onChange={v => setAdj(p => ({ ...p, blur: v }))} min={0} max={20} />
                  <button type="button" onClick={() => setAdj({ brightness: 0, contrast: 0, saturation: 0, blur: 0 })}
                    style={{ marginTop: 8, padding: '8px 14px', background: 'none', border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                    Reset adjustments
                  </button>
                </div>
              )}

              {/* ── TEXT ── */}
              {activeTool === 'text' && (
                <div>
                  <button type="button"
                    style={{ width: '100%', padding: '10px', background: t.primaryBg, border: `1.5px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New text
                  </button>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Font family</label>
                    <select style={{ width: '100%', padding: '8px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none' }}>
                      {['Arial (sans-serif)', 'Georgia (serif)', 'Courier New (mono)', 'Trebuchet MS', 'Verdana'].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Font size</label>
                      <select style={{ width: '100%', padding: '8px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.text, fontSize: 13, outline: 'none' }}>
                        {[12,14,16,18,20,24,28,32,40,48,56,64].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Alignment</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>,
                        ].map((svg, i) => (
                          <button key={i} type="button" style={{ flex: 1, padding: '6px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>{svg}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Font color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7 }}>
                      <input type="color" defaultValue="#000000" style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
                      <span style={{ fontSize: 13, color: t.textMuted, fontFamily: 'monospace' }}>#000000</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6, padding: '10px 12px', background: t.isDark ? 'rgba(255,255,255,0.03)' : '#f7f8fa', borderRadius: 8, border: `1px solid ${t.border}` }}>
                    Click "+ New text" then click on the image to add a text layer.
                  </div>
                </div>
              )}

              {/* ── STICKERS ── */}
              {activeTool === 'stickers' && (
                <div>
                  {['Emojis', 'Shapes'].map(group => {
                    const isOpen = expandedSticker === group;
                    return (
                      <div key={group} style={{ marginBottom: 8 }}>
                        <button type="button" onClick={() => setExpandedSticker(isOpen ? null : group)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${t.border}` }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', color: t.textMuted, flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text, flex: 1 }}>{group}</span>
                          <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                            {group === 'Emojis'
                              ? <div style={{ width: '100%', height: '100%', background: '#f5c542', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>😀</div>
                              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#ddd,#bbb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
                                </div>
                            }
                          </div>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '12px 0' }}>
                            {group === 'Emojis' ? (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                {STICKER_EMOJIS.map(em => (
                                  <button key={em} type="button" title={em}
                                    style={{ width: '100%', aspectRatio: '1', background: t.isDark ? 'rgba(255,255,255,0.04)' : '#f7f8fa', border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.1)' : '#eee'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : '#f7f8fa'; }}
                                  >{em}</button>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                {SHAPES.map(shape => (
                                  <button key={shape} type="button" title={shape}
                                    style={{ padding: 10, background: t.isDark ? 'rgba(255,255,255,0.04)' : '#f7f8fa', border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.1)' : '#eee'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : '#f7f8fa'; }}
                                  >
                                    <ShapePreview shape={shape} color={t.isDark ? 'rgba(255,255,255,0.3)' : '#aaa'} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── BRUSH ── */}
              {activeTool === 'brush' && (
                <div>
                  <SliderRow label="Brush hardness" value={brushHardness} onChange={setBrushHardness} min={0} max={100} />
                  <SliderRow label="Brush size"     value={brushSize}     onChange={setBrushSize}     min={1} max={50} />
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, color: t.textSecondary, display: 'block', marginBottom: 8 }}>Brush color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7 }}>
                      <input type="color" value={brushColor}
                        onChange={e => { setBrushColor(e.target.value); setBrushColorHex(e.target.value); }}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
                      <span style={{ fontSize: 13, color: t.textMuted, fontFamily: 'monospace' }}>{brushColorHex}</span>
                    </div>
                  </div>
                  <button type="button" onClick={clearBrush}
                    style={{ width: '100%', padding: '8px', background: 'none', border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Clear brush strokes
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Preview area */}
          <div ref={previewRef} style={{ flex: 1, background: t.isDark ? '#090910' : '#eff0f5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: activeTool === 'brush' ? 'crosshair' : 'default' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imageUrl} alt="Edit preview"
                style={{ display: 'block', maxWidth: '88%', maxHeight: '76vh', objectFit: 'contain', filter: filterCss, borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.25)', transition: 'filter 200ms', userSelect: 'none' }}
                draggable={false}
              />
              {/* Canvas overlay for brush drawing */}
              {activeTool === 'brush' && (
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, borderRadius: 8, cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize * 2}' height='${brushSize * 2}' viewBox='0 0 ${brushSize * 2} ${brushSize * 2}'%3E%3Ccircle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' stroke='%23000' strokeWidth='1.5' fill='none'/%3E%3C/svg%3E") ${brushSize} ${brushSize}, crosshair` }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              )}
              {/* Crop ratio overlay */}
              {activeTool === 'crop' && (() => {
                const preset = CROP_PRESETS.find(p => p.id === cropPreset);
                if (!preset?.ratio) return null;
                const r = preset.ratio;
                return (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ position: 'relative', width: r >= 1 ? '80%' : `${80 * r}%`, aspectRatio: `${r}`, maxHeight: '80%', border: '2.5px solid rgba(99,155,255,0.95)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.38)', borderRadius: 2 }}>
                      {['tl','tr','bl','br'].map(c => (
                        <div key={c} style={{ position: 'absolute', width: 14, height: 14, borderColor: 'rgba(99,155,255,0.95)', borderStyle: 'solid', borderWidth: 0, ...(c.includes('t') ? { top: -2, borderTopWidth: 3 } : { bottom: -2, borderBottomWidth: 3 }), ...(c.includes('l') ? { left: -2, borderLeftWidth: 3 } : { right: -2, borderRightWidth: 3 }) }} />
                      ))}
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', opacity: 0.3 }}>
                        {Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ border: '0.5px solid rgba(99,155,255,0.8)' }} />)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 22px', background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.primary}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
          >Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ padding: '9px 28px', background: saving ? t.border : t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', minWidth: 80 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}

function ShapePreview({ shape, color }) {
  const s = { width: 28, height: 28, fill: color };
  if (shape === 'square')   return <svg viewBox="0 0 28 28" style={s}><rect x="2" y="2" width="24" height="24" rx="2" fill={color}/></svg>;
  if (shape === 'circle')   return <svg viewBox="0 0 28 28" style={s}><circle cx="14" cy="14" r="12" fill={color}/></svg>;
  if (shape === 'triangle') return <svg viewBox="0 0 28 28" style={s}><polygon points="14,2 26,26 2,26" fill={color}/></svg>;
  if (shape === 'star')     return <svg viewBox="0 0 28 28" style={s}><polygon points="14,2 17.5,11 27,11 19.5,17 22,26 14,21 6,26 8.5,17 1,11 10.5,11" fill={color}/></svg>;
  if (shape === 'pentagon') return <svg viewBox="0 0 28 28" style={s}><polygon points="14,2 26,11 21,24 7,24 2,11" fill={color}/></svg>;
  if (shape === 'hexagon')  return <svg viewBox="0 0 28 28" style={s}><polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill={color}/></svg>;
  return null;
}
