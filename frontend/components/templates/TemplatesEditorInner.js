import { useState, useEffect, useRef, useLayoutEffect, createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Stage, Layer, Rect, Image as KonvaImage, Text, Circle, Line, Transformer, RegularPolygon, Star, Arrow, Shape } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useTheme } from '../../lib/theme';
import { studioAPI } from '../../lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_SIZES = [
  { id: 'ig_portrait', label: 'Instagram Portrait', w: 1080, h: 1350 },
  { id: 'ig_square',   label: 'Instagram Square',   w: 1080, h: 1080 },
  { id: 'ig_story',    label: 'Instagram Story',    w: 1080, h: 1920 },
  { id: 'fb_post',     label: 'Facebook Post',       w: 1200, h: 630  },
  { id: 'google_biz',  label: 'Google Business',     w: 720,  h: 720  },
];

const FONTS = [
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito', 'Poppins', 'Source Sans Pro',
  // Serif
  'Playfair Display', 'Merriweather', 'EB Garamond', 'Lora',
  // Display
  'Oswald', 'Raleway', 'Bebas Neue', 'Anton',
  // Script / handwriting
  'Dancing Script', 'Pacifico', 'Caveat',
  // Monospace
  'Space Mono', 'Courier New',
];

const FILTER_PRESETS = {
  normal: { brightness: 0,    contrast: 0,   saturation: 0    },
  warm:   { brightness: 0.05, contrast: 10,  saturation: 0.3  },
  cool:   { brightness: 0,    contrast: 5,   saturation: -0.2 },
  faded:  { brightness: 0.15, contrast: -20, saturation: -0.3 },
  vivid:  { brightness: 0.05, contrast: 25,  saturation: 0.5  },
  bw:     { brightness: 0,    contrast: 15,  saturation: -1   },
  moody:  { brightness: -0.1, contrast: 20,  saturation: -0.2 },
};

const COLOR_PALETTE = [
  '#1a1a22', '#ffffff', '#7C5CFC', '#f59e0b', '#10b981',
  '#ef4444', '#3b82f6', '#ec4899', '#0ea5e9', '#84cc16',
];

const EXTENDED_PALETTE = [
  '#000000','#434343','#666666','#999999','#CCCCCC','#D9D9D9','#EFEFEF','#F3F3F3','#FFFFFF',
  '#FF0000','#FF4500','#FF9900','#FFFF00','#00FF00','#00FFFF','#4A86E8','#0000FF','#9900FF','#FF00FF',
  '#EA9999','#F9CB9C','#FFE599','#B6D7A8','#A2C4C9','#9FC5E8','#B4A7D6','#D5A6BD',
  '#CC4125','#E06666','#F6B26B','#FFD966','#93C47D','#76A5AF','#6FA8DC','#8E7CC3','#C27BA0',
  '#1a1a22','#7C5CFC','#00C4CC','#10b981',
];

// ─── ColorPickerButton ────────────────────────────────────────────────────────
function ColorPickerButton({ value = '#ffffff', onChange, onCommit, recentColors = [], size = 22 }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const docColors = useContext(DocColorsCtx);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => { setHex(value); }, [value]);

  const openPicker = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 228;
    const left = Math.min(r.left, window.innerWidth - panelW - 8);
    const top  = r.bottom + 6;
    setPos({ x: Math.max(8, left), y: top });
    setOpen(true);
  };

  const apply = (color) => { setHex(color); onChange?.(color); };

  const handleHex = (v) => {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange?.(v);
  };

  const close = () => { setOpen(false); onCommit?.(); };

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onMouseDown={close} />}
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); openPicker(); }}
          style={{ width: size + 6, height: size + 6, padding: 2, border: '1.5px solid rgba(128,128,128,0.4)', borderRadius: 4, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 2, background: value }} />
        </button>
      </div>
      {open && (
        <div onMouseDown={e => e.stopPropagation()}
          style={{ position: 'fixed', left: pos.x, top: pos.y, width: 228, background: '#1e1e28', border: '1px solid #2a2a35', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9991, padding: 12 }}>
          {/* Preview + hex input + wheel picker + eyedropper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: hex, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
            <input value={hex} onChange={e => handleHex(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #2a2a35', background: '#13131a', color: '#f4f4f5', fontSize: 12, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
            {typeof EyeDropper !== 'undefined' && (
              <button title="Pick color from screen" onMouseDown={async e => {
                e.preventDefault();
                setOpen(false);
                try {
                  const result = await new EyeDropper().open();
                  apply(result.sRGBHex);
                  onCommit?.();
                } catch (_) {}
              }} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #2a2a35', background: '#13131a', color: '#a0a0b0', fontSize: 14, cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ⊕
              </button>
            )}
            <div style={{ position: 'relative', width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
              <input type="color" value={hex} onChange={e => apply(e.target.value)} onBlur={close}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'crosshair' }} />
            </div>
          </div>
          {/* Full palette grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 3, marginBottom: 8 }}>
            {EXTENDED_PALETTE.map(c => (
              <button key={c} onMouseDown={() => { apply(c); close(); }}
                style={{ aspectRatio: '1', background: c, border: hex === c ? '2px solid #00C4CC' : '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          {/* Document colors */}
          {docColors.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 5, marginTop: 4 }}>Document</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {docColors.map(c => (
                  <button key={c} onMouseDown={() => { apply(c); close(); }}
                    style={{ width: 20, height: 20, background: c, border: hex === c ? '2px solid #00C4CC' : '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </div>
            </>
          )}
          {/* Recent colors */}
          {recentColors.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 5 }}>Recent</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {recentColors.map(c => (
                  <button key={c} onMouseDown={() => { apply(c); close(); }}
                    style={{ width: 20, height: 20, background: c, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const SNAP_THRESHOLD = 5;

const DocColorsCtx = createContext([]);

function applyTextTransform(text, transform) {
  if (!text || !transform || transform === 'none') return text;
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
  return text;
}

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
Konva.Filters.Duotone = function(imageData) {
  const d = imageData.data;
  const c1 = _hexToRgb(this.duotoneColor1 || '#1a1a22');
  const c2 = _hexToRgb(this.duotoneColor2 || '#00C4CC');
  for (let i = 0; i < d.length; i += 4) {
    const luma = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) / 255;
    d[i]   = Math.round(c1[0] + (c2[0] - c1[0]) * luma);
    d[i+1] = Math.round(c1[1] + (c2[1] - c1[1]) * luma);
    d[i+2] = Math.round(c1[2] + (c2[2] - c1[2]) * luma);
  }
};

const BLEND_MODES = [
  ['source-over','Normal'],['multiply','Multiply'],['screen','Screen'],
  ['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],
  ['color-dodge','Color Dodge'],['color-burn','Color Burn'],
  ['hard-light','Hard Light'],['soft-light','Soft Light'],
  ['difference','Difference'],['exclusion','Exclusion'],
];

const QUICK_ACTIONS = [
  { id: 'text',     icon: 'T',  label: 'Add text',        sub: 'Insert a text element',    shortcut: 'T'       },
  { id: 'rect',     icon: '▭',  label: 'Add rectangle',   sub: 'Insert a rectangle shape', shortcut: 'R'       },
  { id: 'circle',   icon: '○',  label: 'Add circle',      sub: 'Insert a circle shape',    shortcut: 'C'       },
  { id: 'line',     icon: '╱',  label: 'Add line',        sub: 'Insert a line shape'                          },
  { id: 'undo',     icon: '⟲',  label: 'Undo',            sub: 'Undo last action',          shortcut: 'Ctrl+Z'  },
  { id: 'redo',     icon: '⟳',  label: 'Redo',            sub: 'Redo last undone action',   shortcut: 'Ctrl+Y'  },
  { id: 'duplicate',    icon: '⊞',  label: 'Duplicate',        sub: 'Duplicate selected element',   shortcut: 'Ctrl+D'      },
  { id: 'pasteinplace', icon: '⧉',  label: 'Paste in place',  sub: 'Paste at original position',   shortcut: 'Ctrl+⇧V'    },
  { id: 'delete',       icon: '🗑', label: 'Delete',           sub: 'Delete selected element',      shortcut: 'Del'         },
  { id: 'newpage',  icon: '+',  label: 'Add new page',    sub: 'Insert a blank page after this one'            },
  { id: 'download', icon: '⬇', label: 'Download PNG',    sub: 'Export canvas as PNG'                         },
  { id: 'zoomin',   icon: '🔍', label: 'Zoom in',         sub: 'Increase canvas zoom',      shortcut: 'Ctrl++'  },
  { id: 'zoomout',  icon: '🔎', label: 'Zoom out',        sub: 'Decrease canvas zoom',      shortcut: 'Ctrl+–'  },
  { id: 'zoomfit',  icon: '⤢',  label: 'Fit to screen',  sub: 'Reset zoom to fit canvas',  shortcut: 'Ctrl+0'  },
  { id: 'selectall',icon: '⊡',  label: 'Select all',     sub: 'Select all unlocked elements', shortcut: 'Ctrl+A' },
  { id: 'showgrid', icon: '⊞',  label: 'Toggle grid',    sub: 'Show/hide dot grid overlay',   shortcut: 'G'      },
  { id: 'nextel',   icon: '⭢',  label: 'Next element',   sub: 'Select next element on page',  shortcut: 'Tab'    },
  { id: 'prevel',   icon: '⭠',  label: 'Prev element',   sub: 'Select previous element',      shortcut: 'Shift+Tab' },
];

const ANIMATE_PRESETS = [
  { id: 'none',       label: 'None',       icon: '○',  desc: 'No animation'      },
  { id: 'fade',       label: 'Fade',       icon: '◌',  desc: 'Fade in smoothly'   },
  { id: 'rise',       label: 'Rise',       icon: '↑',  desc: 'Slide up + fade'    },
  { id: 'sink',       label: 'Sink',       icon: '↓',  desc: 'Slide down + fade'  },
  { id: 'slide-left', label: 'From left',  icon: '←',  desc: 'Slide in from left' },
  { id: 'slide-right',label: 'From right', icon: '→',  desc: 'Slide in from right'},
  { id: 'pop',        label: 'Pop',        icon: '◉',  desc: 'Scale up + fade'    },
  { id: 'spin',       label: 'Spin',       icon: '↻',  desc: 'Rotate in'          },
];

const GRADIENT_PRESETS = [
  { label: 'Midnight', c1: '#7C5CFC', c2: '#00C4CC', angle: 135 },
  { label: 'Sunset',   c1: '#f97316', c2: '#ec4899', angle: 135 },
  { label: 'Ocean',    c1: '#0ea5e9', c2: '#10b981', angle: 135 },
  { label: 'Fire',     c1: '#ef4444', c2: '#f97316', angle: 90  },
  { label: 'Forest',   c1: '#22c55e', c2: '#0ea5e9', angle: 135 },
  { label: 'Dusk',     c1: '#8b5cf6', c2: '#ec4899', angle: 135 },
  { label: 'Gold',     c1: '#fbbf24', c2: '#ef4444', angle: 90  },
  { label: 'Night',    c1: '#1e1b4b', c2: '#374151', angle: 180 },
];

function gradientPoints(angle, w, h) {
  const rad = (angle - 90) * Math.PI / 180;
  return {
    startPoint: { x: w / 2 - Math.cos(rad) * w / 2, y: h / 2 - Math.sin(rad) * h / 2 },
    endPoint:   { x: w / 2 + Math.cos(rad) * w / 2, y: h / 2 + Math.sin(rad) * h / 2 },
  };
}

function emptyPage() {
  return {
    id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    elements: [],
    bgType: 'color', bgColor: '#1a1a22',
    bgGradient: null,
    bgImageUrl: null, bgSource: null, bgSourceId: null,
    bgFilter: 'normal', bgBrightness: 0, bgContrast: 0, bgSaturation: 0,
    lockedIds: [], hiddenIds: [],
    duration: 5, // seconds (used in video mode)
  };
}

// ─── BgImage ─────────────────────────────────────────────────────────────────

function BgImage({ url, filter, brightness, contrast, saturation, stageW, stageH, onClick, isSelected }) {
  const [image] = useImage(url, 'anonymous');
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !image) return;
    ref.current.cache();
    ref.current.filters([Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]);
    ref.current.brightness(brightness);
    ref.current.contrast(contrast);
    ref.current.saturation(saturation);
    ref.current.getLayer()?.batchDraw();
  }, [image, brightness, contrast, saturation, filter]);

  if (!image) return null;

  const scale = Math.max(stageW / image.width, stageH / image.height);
  const scaledW = image.width * scale;
  const scaledH = image.height * scale;

  return (
    <KonvaImage
      ref={ref}
      image={image}
      x={(stageW - scaledW) / 2}
      y={(stageH - scaledH) / 2}
      width={scaledW}
      height={scaledH}
      onClick={onClick}
      onTap={onClick}
      stroke={isSelected ? '#00C4CC' : undefined}
      strokeWidth={isSelected ? 3 : 0}
    />
  );
}

// ─── ImageNode ───────────────────────────────────────────────────────────────

function ImageNode({ el, isSelected, onSelect, onChange, onDragMove, onSnapClear, locked, hidden }) {
  const shapeRef = useRef(null);
  const [img] = useImage(el.src, 'anonymous');
  const [isDragging, setIsDragging] = useState(false);

  // Apply Konva image filters when brightness/contrast/saturation/blur/duotone are set
  useEffect(() => {
    if (!shapeRef.current || !img) return;
    const node = shapeRef.current;
    const hasDuotone = el.duotone?.enabled;
    const hasFx = (el.brightness ?? 0) !== 0 || (el.contrast ?? 0) !== 0 || (el.saturation ?? 0) !== 0 || (el.blur ?? 0) > 0 || hasDuotone;
    if (hasFx) {
      const filters = [Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL];
      if ((el.blur ?? 0) > 0) filters.push(Konva.Filters.Blur);
      if (hasDuotone) filters.push(Konva.Filters.Duotone);
      node.filters(filters);
      node.brightness(el.brightness ?? 0);
      node.contrast(el.contrast ?? 0);
      node.saturation(el.saturation ?? 0);
      node.blurRadius(el.blur ?? 0);
      if (hasDuotone) {
        node.duotoneColor1 = el.duotone.c1 || '#1a1a22';
        node.duotoneColor2 = el.duotone.c2 || '#00C4CC';
      }
      node.cache();
    } else {
      node.filters([]);
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [img, el.brightness, el.contrast, el.saturation, el.blur, el.duotone?.enabled, el.duotone?.c1, el.duotone?.c2]);
  const w = el.width || 200;
  const h = el.height || 200;
  const flipSX = el.flipH ? -1 : 1;
  const flipSY = el.flipV ? -1 : 1;

  // Compute Konva crop prop from cropTop/Bottom/Left/Right (0-49 integer percentages)
  const imgNatW = img?.naturalWidth || img?.width || w;
  const imgNatH = img?.naturalHeight || img?.height || h;
  const cTop    = (el.cropTop    || 0) / 100;
  const cBottom = (el.cropBottom || 0) / 100;
  const cLeft   = (el.cropLeft   || 0) / 100;
  const cRight  = (el.cropRight  || 0) / 100;
  const hasCrop = cTop > 0 || cBottom > 0 || cLeft > 0 || cRight > 0;
  const cropProp = hasCrop ? {
    x: imgNatW * cLeft,
    y: imgNatH * cTop,
    width:  Math.max(1, imgNatW * (1 - cLeft - cRight)),
    height: Math.max(1, imgNatH * (1 - cTop - cBottom)),
  } : undefined;

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    const tlX = e.target.x() - w / 2;
    const tlY = e.target.y() - h / 2;
    const { x: nx, y: ny } = onDragMove(el.id, tlX, tlY, w, h);
    e.target.position({ x: nx + w / 2, y: ny + h / 2 });
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x() - w / 2, y: e.target.y() - h / 2 });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const rawSX = node.scaleX();
    const rawSY = node.scaleY();
    const newW = Math.max(5, Math.abs(node.width() * rawSX));
    const newH = Math.max(5, Math.abs(node.height() * rawSY));
    const newFlipH = rawSX < 0 ? !el.flipH : el.flipH;
    const newFlipV = rawSY < 0 ? !el.flipV : el.flipV;
    const resetSX = newFlipH ? -1 : 1;
    const resetSY = newFlipV ? -1 : 1;
    onChange({
      ...el,
      x: node.x() - newW / 2,
      y: node.y() - newH / 2,
      width: newW,
      height: newH,
      flipH: newFlipH,
      flipV: newFlipV,
      rotation: node.rotation(),
    });
    node.scaleX(resetSX);
    node.scaleY(resetSY);
    node.width(newW);
    node.height(newH);
    node.offsetX(newW / 2);
    node.offsetY(newH / 2);
  };

  return (
    <KonvaImage
      ref={shapeRef}
      id={el.id}
      image={img}
      x={el.x + w / 2}
      y={el.y + h / 2}
      width={w}
      height={h}
      offsetX={w / 2}
      offsetY={h / 2}
      scaleX={flipSX}
      scaleY={flipSY}
      rotation={el.rotation || 0}
      opacity={isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1)}
      cornerRadius={el.cornerRadius || 0}
      draggable={!locked}
      visible={!hidden}
      onClick={(e) => !locked && onSelect(el.id, e)}
      onTap={(e) => !locked && onSelect(el.id, e)}
      onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? '#00C4CC' : (el.borderEnabled && el.borderColor ? el.borderColor : undefined)}
      strokeWidth={isSelected ? 1.5 : (el.borderEnabled && el.borderWidth ? el.borderWidth : 0)}
      dash={isSelected ? undefined : (() => { if (!el.borderEnabled) return undefined; const s=el.borderStyle||'solid'; const w=el.borderWidth||2; if(s==='dashed') return [w*4,w*3]; if(s==='dotted') return [w,w*2.5]; return undefined; })()}
      globalCompositeOperation={el.blendMode || 'source-over'}
      shadowEnabled={el.shadow?.enabled || false}
      shadowColor={el.shadow?.color || '#000000'}
      shadowBlur={el.shadow?.blur ?? 8}
      shadowOffsetX={el.shadow?.offsetX ?? 4}
      shadowOffsetY={el.shadow?.offsetY ?? 4}
      shadowOpacity={el.shadow?.opacity ?? 0.5}
      {...(cropProp ? { crop: cropProp } : {})}
    />
  );
}

// ─── ContentNode ──────────────────────────────────────────────────────────────

function ContentNode({ el, isSelected, onSelect, onChange, stageW, stageH, onDblClick, onDragMove, onSnapClear, locked, hidden }) {
  const shapeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [measuredH, setMeasuredH] = useState(() => (el.fontSize || 36) * 1.5);

  useEffect(() => {
    if (el.type !== 'text' || !shapeRef.current) return;
    const h = shapeRef.current.height();
    if (h > 0 && Math.abs(h - measuredH) > 1) setMeasuredH(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.text, el.fontSize, el.fontFamily, el.fontStyle, el.lineHeight, el.letterSpacing, el.width]);

  const isCenterOrigin = ['circle', 'triangle', 'star'].includes(el.type);

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    let rawX = e.target.x();
    let rawY = e.target.y();
    let elW, elH;
    if (isCenterOrigin) {
      const r = el.radius || el.outerRadius || 60;
      rawX -= r; rawY -= r;
      elW = elH = r * 2;
    } else {
      elW = el.width || (el.points ? el.width || 200 : 200);
      elH = el.height || 100;
    }
    const { x: nx, y: ny } = onDragMove(el.id, rawX, rawY, elW, elH);
    if (isCenterOrigin) {
      const r = el.radius || el.outerRadius || 60;
      e.target.position({ x: nx + r, y: ny + r });
    } else {
      e.target.position({ x: nx, y: ny });
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    if (el.type === 'text') {
      const scaleX = node.scaleX();
      onChange({
        ...el,
        x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * Math.abs(scaleX)),
        fontSize: Math.max(8, Math.min(400, Math.round((el.fontSize || 36) * Math.abs(scaleX)))),
        scaleX: 1, scaleY: 1,
        rotation: node.rotation(),
      });
    } else {
      const rawSX = node.scaleX();
      const rawSY = node.scaleY();
      const newFlipH = rawSX < 0 ? !el.flipH : (el.flipH || false);
      const newFlipV = rawSY < 0 ? !el.flipV : (el.flipV || false);
      onChange({
        ...el, x: node.x(), y: node.y(),
        width:  Math.max(5, Math.abs(node.width()  * rawSX)),
        height: Math.max(5, Math.abs(node.height() * rawSY)),
        flipH: newFlipH, flipV: newFlipV,
        scaleX: 1, scaleY: 1, rotation: node.rotation(),
      });
      node.scaleX(newFlipH ? -1 : 1);
      node.scaleY(newFlipV ? -1 : 1);
    }
  };

  const common = {
    ref: shapeRef,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation || 0,
    opacity: isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1),
    draggable: !locked,
    visible: !hidden && el.visible !== false,
    onClick: (e) => !locked && onSelect(el.id, e),
    onTap: (e) => !locked && onSelect(el.id, e),
    onDragStart: e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; },
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    stroke: isSelected ? '#00C4CC' : (el.borderEnabled && el.borderColor ? el.borderColor : undefined),
    strokeWidth: isSelected ? 1.5 : (el.borderEnabled && el.borderWidth ? el.borderWidth : 0),
    dash: isSelected ? undefined : (() => {
      if (!el.borderEnabled) return undefined;
      const s = el.borderStyle || 'solid';
      const w = el.borderWidth || 2;
      if (s === 'dashed') return [w * 4, w * 3];
      if (s === 'dotted') return [w, w * 2.5];
      return undefined;
    })(),
    scaleX: el.flipH ? -1 : 1,
    scaleY: el.flipV ? -1 : 1,
    globalCompositeOperation: el.blendMode || 'source-over',
    shadowEnabled: el.shadow?.enabled || false,
    shadowColor: el.shadow?.color || '#000000',
    shadowBlur: el.shadow?.blur ?? 4,
    shadowOffsetX: el.shadow?.offsetX ?? 2,
    shadowOffsetY: el.shadow?.offsetY ?? 2,
    shadowOpacity: el.shadow?.opacity ?? 0.5,
  };

  if (el.type === 'text') {
    const tbPad = el.textBg?.padding ?? 6;
    const isGradText = el.fillType === 'gradient' && el.fillGradient;
    let gradTextProps = {};
    if (isGradText) {
      const g = el.fillGradient;
      const { startPoint, endPoint } = gradientPoints(g.angle ?? 135, el.width || 400, (el.fontSize || 36) * 2);
      gradTextProps = {
        fill: undefined,
        fillLinearGradientStartPoint: startPoint,
        fillLinearGradientEndPoint: endPoint,
        fillLinearGradientColorStops: [0, g.c1 || '#ffffff', 1, g.c2 || '#000000'],
      };
    }
    const textNode = (
      <Text
        {...common}
        text={applyTextTransform(el.text, el.textTransform)}
        fontSize={el.fontSize || 36}
        fontFamily={el.fontFamily || 'Inter'}
        fontStyle={el.fontStyle || 'normal'}
        textDecoration={el.textDecoration || ''}
        fill={isGradText ? undefined : (el.fill || '#ffffff')}
        {...gradTextProps}
        width={el.width || 400}
        align={el.align || 'center'}
        opacity={el.opacity ?? 1}
        lineHeight={el.lineHeight ?? 1.2}
        letterSpacing={el.letterSpacing ?? 0}
        shadowEnabled={el.shadow?.enabled || false}
        shadowColor={el.shadow?.color || '#000000'}
        shadowBlur={el.shadow?.blur ?? 4}
        shadowOffsetX={el.shadow?.offsetX ?? 2}
        shadowOffsetY={el.shadow?.offsetY ?? 2}
        shadowOpacity={el.shadow?.opacity ?? 0.5}
        stroke={el.outline?.enabled ? (el.outline.color || '#000000') : ''}
        strokeWidth={el.outline?.enabled ? (el.outline.width ?? 1) : 0}
        verticalAlign={el.verticalAlign || 'middle'}
        onDblClick={() => onDblClick(el.id)}
        onDblTap={() => onDblClick(el.id)}
      />
    );
    if (!el.textBg?.enabled) return textNode;
    return (
      <>
        <Rect
          x={(el.x || 0) - tbPad}
          y={(el.y || 0) - tbPad}
          width={(el.width || 400) + tbPad * 2}
          height={measuredH + tbPad * 2}
          fill={el.textBg.color || '#ffffff'}
          opacity={el.textBg.opacity ?? 1}
          cornerRadius={el.textBg.radius ?? 4}
          rotation={el.rotation || 0}
          listening={false}
          visible={!hidden && el.visible !== false}
        />
        {textNode}
      </>
    );
  }

  // Compute gradient fill props for shapes
  const shapeW = el.width || 200;
  const shapeH = el.height || 200;
  const isGradFill = el.fillType === 'gradient' && el.fillGradient;
  let gradFillProps = {};
  if (isGradFill) {
    const g = el.fillGradient;
    const gw = el.radius ? (el.radius || el.outerRadius || 60) * 2 : shapeW;
    const gh = el.radius ? (el.radius || el.outerRadius || 60) * 2 : shapeH;
    const { startPoint, endPoint } = gradientPoints(g.angle ?? 135, gw, gh);
    gradFillProps = {
      fill: undefined,
      fillLinearGradientStartPoint: startPoint,
      fillLinearGradientEndPoint: endPoint,
      fillLinearGradientColorStops: [0, g.c1 || '#ffffff', 1, g.c2 || '#000000'],
    };
  }

  if (el.type === 'rect') return (
    <Rect {...common}
      width={shapeW} height={el.height || 100}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      cornerRadius={el.cornerRadius || 0}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'circle') return (
    <Circle {...common}
      radius={el.radius || 60}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'line') return (
    <Line {...common}
      points={el.points || [0, 0, el.width || 200, 0]}
      stroke={el.stroke || '#ffffff'}
      strokeWidth={el.strokeWidth || 3}
      dash={(() => { const s = el.strokeStyle||'solid'; const w = el.strokeWidth||3; if (s==='dashed') return [w*4,w*3]; if (s==='dotted') return [w,w*2.5]; return undefined; })()}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'triangle') return (
    <RegularPolygon {...common}
      sides={el.sides || 3}
      radius={el.radius || 60}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'star') return (
    <Star {...common}
      numPoints={el.numPoints || 5}
      outerRadius={el.outerRadius || 60}
      innerRadius={el.innerRadius || 25}
      fill={isGradFill ? undefined : (el.fill || 'rgba(255,255,255,0.2)')}
      {...gradFillProps}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'arrow') return (
    <Arrow {...common}
      points={[0, 0, el.width || 200, 0]}
      pointerLength={15}
      pointerWidth={12}
      fill={el.fill || '#ffffff'}
      stroke={el.fill || '#ffffff'}
      strokeWidth={el.strokeWidth || 4}
      dash={(() => { const s = el.strokeStyle||'solid'; const w = el.strokeWidth||4; if (s==='dashed') return [w*4,w*3]; if (s==='dotted') return [w,w*2.5]; return undefined; })()}
      opacity={el.opacity ?? 1}
    />
  );

  return null;
}

// ─── GroupNode ───────────────────────────────────────────────────────────────

function GroupNode({ el, isSelected, onSelect, onChange, stageW, stageH, onDragMove, onSnapClear, locked, hidden }) {
  const groupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    const { x: nx, y: ny } = onDragMove(el.id, e.target.x(), e.target.y(), el.width, el.height);
    e.target.position({ x: nx, y: ny });
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const s = e.target.getStage(); if (s) s.container().style.cursor = '';
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    node.scaleX(1); node.scaleY(1);
    onChange({
      ...el,
      x: node.x(), y: node.y(),
      width:  Math.max(5, el.width  * sx),
      height: Math.max(5, el.height * sy),
      rotation: node.rotation(),
      children: (el.children || []).map(child => ({
        ...child,
        x:           child.x * sx,
        y:           child.y * sy,
        width:       child.width       != null ? Math.max(1, child.width       * sx) : undefined,
        height:      child.height      != null ? Math.max(1, child.height      * sy) : undefined,
        fontSize:    child.fontSize    != null ? Math.max(8, Math.round(child.fontSize * sx)) : undefined,
        radius:      child.radius      != null ? child.radius      * sx : undefined,
        outerRadius: child.outerRadius != null ? child.outerRadius * sx : undefined,
        innerRadius: child.innerRadius != null ? child.innerRadius * sx : undefined,
      })),
    });
  };

  return (
    <Group
      ref={groupRef}
      id={el.id}
      x={el.x}
      y={el.y}
      rotation={el.rotation || 0}
      opacity={isDragging ? Math.min(el.opacity ?? 1, 0.65) : (el.opacity ?? 1)}
      draggable={!locked}
      visible={!hidden && el.visible !== false}
      globalCompositeOperation={el.blendMode || 'source-over'}
      onClick={(e)  => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onTap={(e)    => { e.cancelBubble = true; if (!locked) onSelect(el.id, e); }}
      onDragStart={e => { setIsDragging(true); const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing'; }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {(el.children || []).map(child =>
        child.type === 'image'
          ? <ImageNode  key={child.id} el={child} isSelected={false} onSelect={() => {}} onChange={() => {}} locked={false} hidden={false} />
          : <ContentNode key={child.id} el={child} isSelected={false} onSelect={() => {}} onChange={() => {}} stageW={stageW} stageH={stageH} onDblClick={() => {}} locked={false} hidden={false} />
      )}
      {isSelected && (
        <Rect x={0} y={0} width={el.width} height={el.height}
          stroke="#00C4CC" strokeWidth={1.5} fill="transparent" listening={false} />
      )}
    </Group>
  );
}

// ─── Canvas Rulers ───────────────────────────────────────────────────────────

function RulerH({ canvasW, stageScale, isDark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#1a1a24' : '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#2a2a38' : '#d8d8d8';
    ctx.fillRect(0, h - 1, w, 1);
    const majorStep = stageScale >= 2 ? 50 : stageScale >= 1 ? 100 : stageScale >= 0.5 ? 200 : 500;
    const minorStep = majorStep / 5;
    ctx.lineWidth = 1;
    ctx.font = '8px system-ui, sans-serif';
    for (let px = 0; px <= canvasW + majorStep; px += minorStep) {
      const x = Math.round(px * stageScale) + 0.5;
      if (x > w) break;
      const isMajor = px % majorStep === 0;
      ctx.strokeStyle = isDark ? (isMajor ? '#555' : '#3a3a4a') : (isMajor ? '#bbb' : '#e0e0e0');
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x, isMajor ? 2 : h * 0.55); ctx.stroke();
      if (isMajor && px > 0) {
        ctx.fillStyle = isDark ? '#666' : '#999';
        ctx.fillText(String(px), x + 2, 9);
      }
    }
  }, [canvasW, stageScale, isDark]);
  const displayW = Math.round(canvasW * stageScale);
  return <canvas ref={ref} width={displayW} height={20} style={{ display: 'block', width: displayW, height: 20, flexShrink: 0 }} />;
}

function RulerV({ canvasH, stageScale, isDark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#1a1a24' : '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#2a2a38' : '#d8d8d8';
    ctx.fillRect(w - 1, 0, 1, h);
    const majorStep = stageScale >= 2 ? 50 : stageScale >= 1 ? 100 : stageScale >= 0.5 ? 200 : 500;
    const minorStep = majorStep / 5;
    ctx.lineWidth = 1;
    ctx.font = '8px system-ui, sans-serif';
    for (let px = 0; px <= canvasH + majorStep; px += minorStep) {
      const y = Math.round(px * stageScale) + 0.5;
      if (y > h) break;
      const isMajor = px % majorStep === 0;
      ctx.strokeStyle = isDark ? (isMajor ? '#555' : '#3a3a4a') : (isMajor ? '#bbb' : '#e0e0e0');
      ctx.beginPath(); ctx.moveTo(w, y); ctx.lineTo(isMajor ? 2 : w * 0.55, y); ctx.stroke();
      if (isMajor && px > 0) {
        ctx.fillStyle = isDark ? '#666' : '#999';
        ctx.save();
        ctx.translate(w - 3, y - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(px), 0, 0);
        ctx.restore();
      }
    }
  }, [canvasH, stageScale, isDark]);
  const displayH = Math.round(canvasH * stageScale);
  return <canvas ref={ref} width={20} height={displayH} style={{ display: 'block', width: 20, height: displayH, flexShrink: 0 }} />;
}

// ─── TransformerLayer ────────────────────────────────────────────────────────

function TransformerLayer({ selectedIds, elements, stageRef, snapGuides, stageScale, canvasW, canvasH, onLiveBounds, onLiveBoundsClear }) {
  const trRef = useRef(null);

  useLayoutEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const validIds = (selectedIds || []).filter(id => id && id !== '__bg__');
    if (!validIds.length) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }
    const nodes = validIds.map(id => stageRef.current.findOne(`#${id}`)).filter(Boolean);
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  });

  // Only use text-only handles when a single text element is selected
  const singleEl = selectedIds?.length === 1 ? elements.find(e => e.id === selectedIds[0]) : null;
  const isText = singleEl?.type === 'text';

  return (
    <>
      <Transformer
        ref={trRef}
        borderStroke="#00C4CC"
        borderStrokeWidth={1.5 / stageScale}
        anchorSize={10 / stageScale}
        anchorCornerRadius={2 / stageScale}
        anchorStroke="#00C4CC"
        anchorFill="#ffffff"
        anchorStrokeWidth={1.5 / stageScale}
        rotateAnchorOffset={28 / stageScale}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={5}
        enabledAnchors={isText
          ? ['middle-left', 'middle-right']
          : ['top-left', 'top-right', 'bottom-left', 'bottom-right',
             'top-center', 'bottom-center', 'middle-left', 'middle-right']
        }
        boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
        onTransform={e => {
          const node = e.target;
          onLiveBounds?.({ x: Math.round(node.x()), y: Math.round(node.y()), w: Math.round(node.width() * Math.abs(node.scaleX())), h: Math.round(node.height() * Math.abs(node.scaleY())) });
        }}
        onTransformEnd={() => onLiveBoundsClear?.()}
      />
      {(snapGuides?.v || []).map((x, i) => (
        <Line key={`sv${i}`} points={[x, 0, x, canvasH]} stroke="#FF0080"
          strokeWidth={1 / stageScale} dash={[4 / stageScale, 4 / stageScale]} listening={false} />
      ))}
      {(snapGuides?.h || []).map((y, i) => (
        <Line key={`sh${i}`} points={[0, y, canvasW, y]} stroke="#FF0080"
          strokeWidth={1 / stageScale} dash={[4 / stageScale, 4 / stageScale]} listening={false} />
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplatesEditorInner() {
  const { t } = useTheme();
  const router = useRouter();

  // Canvas
  const [canvasSizeId, setCanvasSizeId] = useState('ig_portrait');
  const [canvasCustomW, setCanvasCustomW] = useState(1080);
  const [canvasCustomH, setCanvasCustomH] = useState(1080);
  const [showCustomSizeForm, setShowCustomSizeForm] = useState(false);
  const [scaleOnResize, setScaleOnResize] = useState(false);
  const canvasSize = canvasSizeId === 'custom'
    ? { id: 'custom', label: `Custom ${canvasCustomW}×${canvasCustomH}`, w: canvasCustomW, h: canvasCustomH }
    : (CANVAS_SIZES.find(s => s.id === canvasSizeId) || CANVAS_SIZES[0]);
  const prevCanvasSizeRef = useRef({ w: canvasSize.w, h: canvasSize.h });

  // Pages (multi-page state — replaces individual bg + elements state)
  const [pages, setPages] = useState(() => [emptyPage()]);
  const [activePage, setActivePage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // multi-select
  const [selectionStart, setSelectionStart] = useState(null); // rubber-band drag
  const [selectionRect, setSelectionRect] = useState(null);   // rubber-band rect
  const [editingTextId, setEditingTextId] = useState(null);
  const [textareaValue, setTextareaValue] = useState('');
  const [textareaPos, setTextareaPos] = useState({ x: 0, y: 0, w: 0 });

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canva-parity state
  const [clipboard,      setClipboard]      = useState(null);
  const [styleClipboard, setStyleClipboard] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, elementId } | null
  const [snapGuides, setSnapGuides] = useState({ v: [], h: [] });
  const [rightTab, setRightTab] = useState('properties');
  const [recentColors, setRecentColors] = useState([]);
  const [showShadowPanel, setShowShadowPanel] = useState(false);
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  const [showPositionPanel, setShowPositionPanel] = useState(false);
  const [showAnimatePanel, setShowAnimatePanel] = useState(false);
  // Find & Replace
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText,        setFindText]        = useState('');
  const [replaceText,     setReplaceText]     = useState('');
  const [frMatchCount,    setFrMatchCount]    = useState(0);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [showSpacingPanel, setShowSpacingPanel] = useState(false);
  const [showCropPanel, setShowCropPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);
  const [imgTab, setImgTab] = useState('stock');
  const [uploadMediaTab, setUploadMediaTab] = useState('Images');
  const [bgRemoverDismissed, setBgRemoverDismissed] = useState(false);
  const [showImgUrlInput, setShowImgUrlInput] = useState(false);
  const [imgUrlValue, setImgUrlValue] = useState('');
  const [projectTab, setProjectTab] = useState('All');
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [savedDesignsLoading, setSavedDesignsLoading] = useState(false);
  const [hoveredDesign, setHoveredDesign] = useState(null); // { id, title, pagesCount, x, y }
  const [layerDragId, setLayerDragId] = useState(null);
  // Quick actions palette
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  // Text panel font search
  const [fontSearch, setFontSearch] = useState('');
  // Elements panel category tab
  const [elemTab, setElemTab] = useState('shapes');
  // Pages thumbnail sidebar
  const [showPagesPanel, setShowPagesPanel] = useState(false);
  // Page notes panel
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  // Canvas grid overlay
  const [showGrid, setShowGrid] = useState(false);
  // Canvas rulers + drag guides
  const [showRulers, setShowRulers] = useState(false);
  // Video mode
  const [isVideoMode, setIsVideoMode] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'video');
  const [videoPlayhead, setVideoPlayhead] = useState(0); // seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const [editingClipIdx, setEditingClipIdx] = useState(null); // page index being duration-edited
  const [rulerGuides, setRulerGuides] = useState({ h: [], v: [] });
  const [draggingGuide, setDraggingGuide] = useState(null); // { axis:'h'|'v', pos:number } canvas px
  const [liveBounds, setLiveBounds] = useState(null); // { x,y,w,h } shown while dragging/resizing
  const canvasWrapperRef = useRef(null);
  // Top bar dropdowns
  const [titleEditing, setTitleEditing] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showResizeMenu, setShowResizeMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [editModeOpen, setEditModeOpen] = useState(false);
  const [editMode, setEditMode] = useState('editing');
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [previewUrl,  setPreviewUrl]    = useState(null);
  const [presentPlaying,  setPresentPlaying]  = useState(false);
  const [presentInterval, setPresentInterval] = useState(3);

  // UI
  const [activeLeftTool, setActiveLeftTool] = useState('templates');
  const [panelOpen, setPanelOpen] = useState(true);
  const [bgPhotos, setBgPhotos] = useState([]);
  const [bgPhotosLoading, setBgPhotosLoading] = useState(false);
  const [bgTab, setBgTab] = useState('stock');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const autosaveTimerRef = useRef(null);
  const postModalOpen_ref = useRef(false); // prevent autosave opening post modal
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [savedCreationId, setSavedCreationId] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postPlatforms, setPostPlatforms] = useState(['instagram']);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState(false);
  const [titleForSave, setTitleForSave] = useState('Untitled');

  // Tooltip
  const [tip, setTip] = useState(null);
  const tipTimerRef = useRef(null);

  // ── Derived page state (computed from pages[activePage]) ───────────────────
  const currentPage = pages[activePage] || pages[0];
  const elements    = currentPage.elements;
  const bgType      = currentPage.bgType;
  const bgColor     = currentPage.bgColor;
  const bgImageUrl  = currentPage.bgImageUrl;
  const bgSource    = currentPage.bgSource;
  const bgSourceId  = currentPage.bgSourceId;
  const bgFilter    = currentPage.bgFilter;
  const bgBrightness = currentPage.bgBrightness;
  const bgContrast   = currentPage.bgContrast;
  const bgSaturation = currentPage.bgSaturation;
  const bgGradient   = currentPage.bgGradient;
  const lockedIds   = new Set(currentPage.lockedIds);
  const hiddenIds   = new Set(currentPage.hiddenIds);

  function patchPage(patch) {
    setPages(prev => prev.map((p, i) => i === activePage ? { ...p, ...patch } : p));
  }

  function patchElements(updater) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      return { ...p, elements: typeof updater === 'function' ? updater(p.elements) : updater };
    }));
  }

  // Unified select handler — supports Shift+click multi-select
  function handleSelect(id, e) {
    if (e?.evt?.shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        return [...prev, id];
      });
      setSelectedId(id);
    } else {
      setSelectedIds([id]);
      setSelectedId(id);
    }
  }

  function clearSelection() {
    setSelectedId(null);
    setSelectedIds([]);
  }

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  function showTip(e, text, shortcut) {
    clearTimeout(tipTimerRef.current);
    const r = e.currentTarget.getBoundingClientRect();
    tipTimerRef.current = setTimeout(() => {
      setTip({ text, shortcut, x: r.left + r.width / 2, y: r.bottom + 6 });
    }, 400);
  }
  function hideTip() {
    clearTimeout(tipTimerRef.current);
    setTip(null);
  }
  // Parse "Label (Shortcut)" → { text, shortcut }
  function parseTipTitle(t) {
    const m = t?.match(/^(.+?)\s*\((.+?)\)$/);
    return m ? { text: m[1].trim(), shortcut: m[2].trim() } : { text: t || '', shortcut: undefined };
  }

  // Canvas display scale
  const containerRef = useRef(null);
  const replaceFileRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);
  const [stageDisplayW, setStageDisplayW] = useState(540);
  const [stageDisplayH, setStageDisplayH] = useState(675);
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const baseScaleRef = useRef(1);
  const stageRef = useRef(null);
  const trLayerRef = useRef(null);

  // ── Display scale ──────────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 48;
      const base = Math.min(maxW / canvasSize.w, 1);
      baseScaleRef.current = base;
      const scale = base * zoomFactor;
      setStageScale(scale);
      setStageDisplayW(Math.floor(canvasSize.w * scale));
      setStageDisplayH(Math.floor(canvasSize.h * scale));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSizeId, canvasSize.w, canvasSize.h, zoomFactor]);

  function zoomIn()  { setZoomFactor(z => Math.min(parseFloat((z + 0.25).toFixed(2)), 3)); }
  function zoomOut() { setZoomFactor(z => Math.max(parseFloat((z - 0.25).toFixed(2)), 0.25)); }

  // ── Scale elements when canvas size changes (scaleOnResize) ───────────────
  useEffect(() => {
    const prev = prevCanvasSizeRef.current;
    const rW = canvasSize.w / prev.w;
    const rH = canvasSize.h / prev.h;
    prevCanvasSizeRef.current = { w: canvasSize.w, h: canvasSize.h };
    if (!scaleOnResize || (rW === 1 && rH === 1)) return;
    pushHistory();
    setPages(prev => prev.map(page => ({
      ...page,
      elements: page.elements.map(el => ({
        ...el,
        x: (el.x || 0) * rW,
        y: (el.y || 0) * rH,
        width:  el.width  != null ? el.width  * rW : el.width,
        height: el.height != null ? el.height * rH : el.height,
        fontSize: el.fontSize != null ? Math.max(8, Math.round(el.fontSize * Math.min(rW, rH))) : el.fontSize,
        strokeWidth: el.strokeWidth != null ? Math.max(1, Math.round(el.strokeWidth * Math.min(rW, rH))) : el.strokeWidth,
      })),
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.w, canvasSize.h]);

  // ── Load photos (triggers on both old IDs and new Canva IDs) ─────────────
  useEffect(() => {
    const isMediaTool = ['background', 'images', 'uploads', 'templates'].includes(activeLeftTool);
    if (!isMediaTool) return;
    if (bgPhotos.length > 0) return;
    setBgPhotosLoading(true);
    studioAPI.getPhotos({ limit: 60, offset: 0 })
      .then(data => setBgPhotos(data.photos || []))
      .catch(() => {})
      .finally(() => setBgPhotosLoading(false));
  }, [activeLeftTool]);

  // ── Load saved designs for Projects panel ─────────────────────────────────
  useEffect(() => {
    if (activeLeftTool !== 'projects') return;
    if (savedDesigns.length > 0) return;
    setSavedDesignsLoading(true);
    studioAPI.getCreations({ limit: 20 })
      .then(data => setSavedDesigns(data?.creations || []))
      .catch(() => {})
      .finally(() => setSavedDesignsLoading(false));
  }, [activeLeftTool]);

  // ── Load existing creation ─────────────────────────────────────────────────
  useEffect(() => {
    const id = router.query?.id;
    if (!id) return;
    studioAPI.getCreation(id).then(data => {
      const c = data.creation;
      if (c.canvas_json) restoreSnapshot(c.canvas_json);
      if (c.overlay_title) setTitleForSave(c.overlay_title);
    }).catch(() => {});
  }, [router.query?.id]);

  // ── Autosave to localStorage (2s debounce — prevents data loss) ───────────
  useEffect(() => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const key = `ip_autosave_${router.query?.id || 'new'}`;
        localStorage.setItem(key, JSON.stringify({ pages, titleForSave, canvasSizeId, ts: Date.now() }));
      } catch {}
    }, 2000);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [pages]);

  // ── Keyboard handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (editingTextId) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        pushHistory();
        const toDelete = new Set(selectedIds);
        patchElements(prev => prev.filter(el => !toDelete.has(el.id)));
        clearSelection();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (selectedIds.length > 1) {
          const multi = elements.filter(el => selectedIds.includes(el.id));
          setClipboard(JSON.parse(JSON.stringify(multi)));
        } else {
          const sel = elements.find(el => el.id === selectedId);
          if (sel) setClipboard(JSON.parse(JSON.stringify(sel)));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        pushHistory();
        const inPlace = e.shiftKey;
        if (Array.isArray(clipboard)) {
          const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid(), x: el.x + (inPlace ? 0 : 20), y: el.y + (inPlace ? 0 : 20) }));
          patchElements(prev => [...prev, ...newEls]);
          const newIds = newEls.map(e => e.id);
          setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
        } else {
          const el = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + (inPlace ? 0 : 20), y: clipboard.y + (inPlace ? 0 : 20) };
          patchElements(prev => [...prev, el]);
          setSelectedId(el.id);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        const sel = elements.find(el => el.id === selectedId);
        if (sel) {
          const el = { ...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x + 20, y: sel.y + 20 };
          pushHistory();
          patchElements(prev => [...prev, el]);
          setSelectedId(el.id);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' &&  e.shiftKey) { e.preventDefault(); ungroupSelected(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') { e.preventDefault(); setShowFindReplace(p => !p); return; }
      if (e.altKey && e.key === 'c') { e.preventDefault(); copyStyle(); return; }
      if (e.altKey && e.key === 'v') { e.preventDefault(); pasteStyle(); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const selectableIds = elements
          .filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id))
          .map(el => el.id);
        if (selectableIds.length) {
          setSelectedIds(selectableIds);
          setSelectedId(selectableIds[selectableIds.length - 1]);
        }
        return;
      }

      if (selectedId && selectedId !== '__bg__') {
        const NUDGE = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(selectedId, -NUDGE, 0); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudge(selectedId,  NUDGE, 0); return; }
        if (e.key === 'ArrowUp')    { e.preventDefault(); nudge(selectedId, 0, -NUDGE); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); nudge(selectedId, 0,  NUDGE); return; }
      }

      // Tab — cycle through elements on current page
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        const selectable = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id));
        if (selectable.length === 0) return;
        const idx = selectable.findIndex(el => el.id === selectedId);
        const next = e.shiftKey
          ? (idx <= 0 ? selectable.length - 1 : idx - 1)
          : (idx < 0 || idx >= selectable.length - 1 ? 0 : idx + 1);
        setSelectedId(selectable[next].id);
        setSelectedIds([]);
        return;
      }

      if (e.key === 'Escape') {
        if (previewOpen) { setPreviewOpen(false); return; }
        clearSelection();
        setShowShadowPanel(false);
        setShowOutlinePanel(false);
        setShowPositionPanel(false);
        setShowAnimatePanel(false);
        setShowAdjustPanel(false);
        setCtxMenu(null);
        setQuickOpen(false);
        return;
      }

      // Quick actions palette
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setQuickQuery('');
        setQuickOpen(o => !o);
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomOut(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoomFactor(1); return; }

      // Grid toggle
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); setShowGrid(o => !o); return;
        }
      }

      // Preview navigation (when preview is open)
      if (previewOpen) {
        if (e.key === 'ArrowRight') { setActivePage(i => Math.min(i + 1, pages.length - 1)); return; }
        if (e.key === 'ArrowLeft')  { setActivePage(i => Math.max(i - 1, 0)); return; }
        return;
      }

      // Tool hotkeys (only when no element focused and no modifier held)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !selectedId) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 't' || e.key === 'T') { addText(); return; }
        if (e.key === 'r' || e.key === 'R') { addRect(); return; }
        if (e.key === 'c' || e.key === 'C') { addCircle(); return; }
        if (e.key === 'p' || e.key === 'P') { setPreviewOpen(true); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedIds, editingTextId, history, historyIndex, elements, clipboard, zoomFactor, previewOpen]);

  // ── Preview capture ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!previewOpen || !stageRef.current) return;
    setPreviewUrl(null);
    const timer = setTimeout(() => {
      if (!stageRef.current) return;
      setSelectedId(null); setSelectedIds([]);
      if (trLayerRef.current) trLayerRef.current.hide();
      requestAnimationFrame(() => {
        if (!stageRef.current) return;
        const pixelRatio = canvasSize.w / stageRef.current.width();
        const url = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
        if (trLayerRef.current) trLayerRef.current.show();
        setPreviewUrl(url);
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [previewOpen, activePage]);

  // ── Presentation auto-play ─────────────────────────────────────────────────
  useEffect(() => {
    if (!presentPlaying || !previewOpen || pages.length < 2) return;
    const id = setInterval(() => {
      setActivePage(p => {
        const next = p + 1;
        if (next >= pages.length) { setPresentPlaying(false); return p; }
        return next;
      });
    }, presentInterval * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentPlaying, previewOpen, presentInterval, pages.length]);

  // ── History helpers ────────────────────────────────────────────────────────
  function snapshot() {
    return { pages: JSON.parse(JSON.stringify(pages)), activePage };
  }

  function pushHistory() {
    const snap = snapshot();
    setHistory(prev => [...prev.slice(0, historyIndex + 1), snap].slice(-50));
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    if (snap.pages) {
      // New multi-page format
      setPages(snap.pages);
      setActivePage(snap.activePage ?? 0);
    } else {
      // Legacy single-page format (old saves)
      setPages([{
        ...emptyPage(),
        elements:      snap.elements      || [],
        bgType:        snap.bgType        || 'color',
        bgColor:       snap.bgColor       || '#1a1a22',
        bgImageUrl:    snap.bgImageUrl    ?? null,
        bgSource:      snap.bgSource      ?? null,
        bgSourceId:    snap.bgSourceId    ?? null,
        bgFilter:      snap.bgFilter      || 'normal',
        bgBrightness:  snap.bgBrightness  ?? 0,
        bgContrast:    snap.bgContrast    ?? 0,
        bgSaturation:  snap.bgSaturation  ?? 0,
        lockedIds:     snap.lockedIds     || [],
        hiddenIds:     snap.hiddenIds     || [],
      }]);
      setActivePage(0);
    }
    setSelectedId(null);
  }

  function undo() {
    if (historyIndex < 0) return;
    restoreSnapshot(history[historyIndex]);
    setHistoryIndex(prev => prev - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    restoreSnapshot(history[historyIndex + 1]);
    setHistoryIndex(prev => prev + 1);
  }

  // ── Element helpers ────────────────────────────────────────────────────────
  const uid = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  function addText(overrides = {}) {
    pushHistory();
    const el = {
      id: uid(), type: 'text',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 30,
      text: 'Double-click to edit',
      fontSize: 48, fontFamily: 'Inter', fontStyle: 'bold',
      fill: '#ffffff', width: 400, align: 'center', opacity: 1,
      ...overrides,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRect(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 50, width: 200, height: 100, fill: 'rgba(255,255,255,0.15)', cornerRadius: 12, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCircle(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'circle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addLine(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'line', x: canvasSize.w / 2 - 150, y: canvasSize.h / 2, points: [0, 0, 300, 0], stroke: '#ffffff', strokeWidth: 4, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTriangle(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'triangle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStar(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'star', x: canvasSize.w / 2, y: canvasSize.h / 2, outerRadius: 80, innerRadius: 35, fill: 'rgba(255,255,255,0.15)', opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addArrow(overrides = {}) {
    pushHistory();
    const el = { id: uid(), type: 'arrow', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2, width: 200, fill: '#ffffff', strokeWidth: 4, opacity: 1, ...overrides };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function setElementAsBackground(el) {
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchPage({ bgType: 'image', bgImageUrl: el.src, bgSource: 'upload' });
    patchElements(prev => prev.filter(e => e.id !== el.id));
    setSelectedId(null);
  }

  function addImageElement(url) {
    const w = canvasSize.w * 0.6;
    const h = w;
    pushHistory();
    const el = {
      id: uid(), type: 'image', src: url,
      x: (canvasSize.w - w) / 2, y: (canvasSize.h - h) / 2,
      width: w, height: h, rotation: 0,
      opacity: 1, flipH: false, flipV: false, cornerRadius: 0,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    if (!url) return;
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left) / stageScale;
    const canvasY = (e.clientY - rect.top)  / stageScale;
    // Check if drop landed on an existing image element (replace)
    const hit = [...elements].reverse().find(el => {
      if (el.type !== 'image') return false;
      return canvasX >= el.x && canvasX <= el.x + (el.width || 200) &&
             canvasY >= el.y && canvasY <= el.y + (el.height || 200);
    });
    pushHistory();
    if (hit) {
      patchElements(prev => prev.map(el => el.id === hit.id ? { ...el, src: url } : el));
      setSelectedId(hit.id);
    } else {
      const w = canvasSize.w * 0.5;
      const newEl = { id: uid(), type: 'image', src: url,
        x: canvasX - w / 2, y: canvasY - w / 2,
        width: w, height: w, rotation: 0, opacity: 1, flipH: false, flipV: false, cornerRadius: 0 };
      patchElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
    }
  }

  function updateElement(updated) {
    patchElements(prev => prev.map(el => el.id === updated.id ? updated : el));
  }

  function handleElementChange(updated) {
    pushHistory();
    updateElement(updated);
  }

  // ── Nudge ──────────────────────────────────────────────────────────────────
  function nudge(id, dx, dy) {
    pushHistory();
    patchElements(prev => prev.map(el => el.id === id ? { ...el, x: el.x + dx, y: el.y + dy } : el));
  }

  function alignEl(id, direction) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const isCenterOrigin = ['circle', 'triangle', 'star'].includes(el.type);
    const elW = el.width || (el.radius ? el.radius * 2 : 100);
    const elH = el.height || (el.radius ? el.radius * 2 : 100);
    const cW = canvasSize.w, cH = canvasSize.h;
    let patch = {};
    if (direction === 'centerH') patch = { x: isCenterOrigin ? cW / 2 : cW / 2 - elW / 2 };
    if (direction === 'centerV') patch = { y: isCenterOrigin ? cH / 2 : cH / 2 - elH / 2 };
    if (direction === 'left')    patch = { x: isCenterOrigin ? elW / 2 : 0 };
    if (direction === 'right')   patch = { x: isCenterOrigin ? cW - elW / 2 : cW - elW };
    if (direction === 'top')     patch = { y: isCenterOrigin ? elH / 2 : 0 };
    if (direction === 'bottom')  patch = { y: isCenterOrigin ? cH - elH / 2 : cH - elH };
    pushHistory();
    patchElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  // ── Distribute ────────────────────────────────────────────────────────────
  function distributeH() {
    if (selectedIds.length < 3) return;
    const els = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
    const getL = e => ['circle','triangle','star'].includes(e.type) ? e.x - (e.radius||e.outerRadius||60) : e.x;
    const getW = e => ['circle','triangle','star'].includes(e.type) ? (e.radius||e.outerRadius||60)*2 : (e.width||100);
    const sorted = [...els].sort((a, b) => getL(a) - getL(b));
    const span  = (getL(sorted[sorted.length - 1]) + getW(sorted[sorted.length - 1])) - getL(sorted[0]);
    const total = sorted.reduce((s, e) => s + getW(e), 0);
    const gap   = (span - total) / (sorted.length - 1);
    const updates = new Map();
    let cursor = getL(sorted[0]);
    for (const e of sorted) {
      const isCO = ['circle','triangle','star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      updates.set(e.id, { ...e, x: isCO ? cursor + r : cursor });
      cursor += getW(e) + gap;
    }
    pushHistory();
    patchElements(prev => prev.map(e => updates.has(e.id) ? updates.get(e.id) : e));
  }

  function distributeV() {
    if (selectedIds.length < 3) return;
    const els = selectedIds.map(id => elements.find(e => e.id === id)).filter(Boolean);
    const getT = e => ['circle','triangle','star'].includes(e.type) ? e.y - (e.radius||e.outerRadius||60) : e.y;
    const getH = e => ['circle','triangle','star'].includes(e.type) ? (e.radius||e.outerRadius||60)*2 : (e.height||60);
    const sorted = [...els].sort((a, b) => getT(a) - getT(b));
    const span  = (getT(sorted[sorted.length - 1]) + getH(sorted[sorted.length - 1])) - getT(sorted[0]);
    const total = sorted.reduce((s, e) => s + getH(e), 0);
    const gap   = (span - total) / (sorted.length - 1);
    const updates = new Map();
    let cursor = getT(sorted[0]);
    for (const e of sorted) {
      const isCO = ['circle','triangle','star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      updates.set(e.id, { ...e, y: isCO ? cursor + r : cursor });
      cursor += getH(e) + gap;
    }
    pushHistory();
    patchElements(prev => prev.map(e => updates.has(e.id) ? updates.get(e.id) : e));
  }

  // ── Copy / Paste style ────────────────────────────────────────────────────
  const STYLE_TEXT_KEYS  = ['fontSize','fontFamily','fontStyle','textDecoration','textTransform','align','verticalAlign','letterSpacing','lineHeight'];
  const STYLE_SHAPE_KEYS = ['stroke','strokeWidth','strokeStyle','cornerRadius','borderStyle'];
  const STYLE_COMMON_KEYS = ['opacity','fill','shadow'];

  function copyStyle() {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const s = { _type: el.type };
    [...STYLE_COMMON_KEYS, ...STYLE_TEXT_KEYS, ...STYLE_SHAPE_KEYS].forEach(k => {
      if (el[k] != null) s[k] = el[k];
    });
    setStyleClipboard(s);
  }

  function pasteStyle(targetId) {
    const id = targetId || selectedId;
    const target = elements.find(e => e.id === id);
    if (!styleClipboard || !target) return;
    const { _type, ...props } = styleClipboard;
    const textSet  = new Set(STYLE_TEXT_KEYS);
    const shapeSet = new Set(STYLE_SHAPE_KEYS);
    const patch = {};
    for (const [k, v] of Object.entries(props)) {
      if (textSet.has(k)  && target.type !== 'text') continue;
      if (shapeSet.has(k) && target.type === 'text') continue;
      patch[k] = v;
    }
    pushHistory();
    patchElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function pasteStyleToAll() {
    if (!styleClipboard || selectedIds.length < 2) return;
    const { _type, ...props } = styleClipboard;
    const textSet  = new Set(STYLE_TEXT_KEYS);
    const shapeSet = new Set(STYLE_SHAPE_KEYS);
    pushHistory();
    patchElements(prev => prev.map(e => {
      if (!selectedIds.includes(e.id)) return e;
      const patch = {};
      for (const [k, v] of Object.entries(props)) {
        if (textSet.has(k)  && e.type !== 'text') continue;
        if (shapeSet.has(k) && e.type === 'text') continue;
        patch[k] = v;
      }
      return { ...e, ...patch };
    }));
  }

  // ── Find & Replace ────────────────────────────────────────────────────────
  function findReplaceAll(find, replace) {
    if (!find) return;
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let count = 0;
    setPages(prev => prev.map(page => ({
      ...page,
      elements: page.elements.map(el => {
        if (el.type !== 'text' || !el.text) return el;
        const updated = el.text.replace(re, () => { count++; return replace; });
        return updated !== el.text ? { ...el, text: updated } : el;
      }),
    })));
    setFrMatchCount(count);
    return count;
  }

  // ── Flip ──────────────────────────────────────────────────────────────────
  function flipH() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === el.id ? { ...e, flipH: !e.flipH } : e));
  }

  function flipV() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === el.id ? { ...e, flipV: !e.flipV } : e));
  }

  function fitToPage() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    const elW = el.width || 200; const elH = el.height || 200;
    const scale = Math.min(canvasSize.w / elW, canvasSize.h / elH);
    const nw = elW * scale; const nh = elH * scale;
    updateElement({ ...el, x: (canvasSize.w - nw) / 2, y: (canvasSize.h - nh) / 2, width: nw, height: nh });
  }

  function fillPage() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    const elW = el.width || 200; const elH = el.height || 200;
    const scale = Math.max(canvasSize.w / elW, canvasSize.h / elH);
    const nw = elW * scale; const nh = elH * scale;
    updateElement({ ...el, x: (canvasSize.w - nw) / 2, y: (canvasSize.h - nh) / 2, width: nw, height: nh });
  }

  // ── Layer order ────────────────────────────────────────────────────────────
  function bringForward(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => {
      const idx = prev.findIndex(e => e.id === tid);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function sendBackward(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => {
      const idx = prev.findIndex(e => e.id === tid);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  }

  function bringToFront(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => { const el = prev.find(e => e.id === tid); return el ? [...prev.filter(e => e.id !== tid), el] : prev; });
  }

  function sendToBack(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    patchElements(prev => { const el = prev.find(e => e.id === tid); return el ? [el, ...prev.filter(e => e.id !== tid)] : prev; });
  }

  // ── Lock / Hidden ──────────────────────────────────────────────────────────
  function toggleLocked(id) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      const has = p.lockedIds.includes(id);
      return { ...p, lockedIds: has ? p.lockedIds.filter(x => x !== id) : [...p.lockedIds, id] };
    }));
  }

  function toggleHidden(id) {
    setPages(prev => prev.map((p, i) => {
      if (i !== activePage) return p;
      const has = p.hiddenIds.includes(id);
      return { ...p, hiddenIds: has ? p.hiddenIds.filter(x => x !== id) : [...p.hiddenIds, id] };
    }));
  }

  // ── Alignment ─────────────────────────────────────────────────────────────
  function alignEl(dir) {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    pushHistory();
    const isCO = ['circle', 'triangle', 'star'].includes(el.type);
    const r = el.radius || el.outerRadius || 60;
    const w = isCO ? r * 2 : (el.width || 200);
    const h = isCO ? r * 2 : (el.height || 100);
    let updates = {};
    if (dir === 'left')    updates = { x: isCO ? r : 0 };
    if (dir === 'centerH') updates = { x: isCO ? canvasSize.w / 2 : (canvasSize.w - w) / 2 };
    if (dir === 'right')   updates = { x: isCO ? canvasSize.w - r : canvasSize.w - w };
    if (dir === 'top')     updates = { y: isCO ? r : 0 };
    if (dir === 'centerV') updates = { y: isCO ? canvasSize.h / 2 : (canvasSize.h - h) / 2 };
    if (dir === 'bottom')  updates = { y: isCO ? canvasSize.h - r : canvasSize.h - h };
    updateElement({ ...el, ...updates });
  }

  // ── Snap computation ───────────────────────────────────────────────────────
  function computeSnap(draggedId, rawX, rawY, elW, elH) {
    const threshold = SNAP_THRESHOLD / stageScale;
    const vGuides = [], hGuides = [];
    let snapX = rawX, snapY = rawY;
    const dEx = [rawX, rawX + elW / 2, rawX + elW];
    const dEy = [rawY, rawY + elH / 2, rawY + elH];
    const offX = [0, elW / 2, elW];
    const offY = [0, elH / 2, elH];
    const tgX = [0, canvasSize.w / 2, canvasSize.w];
    const tgY = [0, canvasSize.h / 2, canvasSize.h];

    for (const e of elements) {
      if (e.id === draggedId || lockedIds.has(e.id) || hiddenIds.has(e.id)) continue;
      const isCO = ['circle', 'triangle', 'star'].includes(e.type);
      const r = e.radius || e.outerRadius || 60;
      const ew = isCO ? r * 2 : (e.width || (e.type === 'arrow' ? e.width || 200 : 200));
      const eh = isCO ? r * 2 : (e.height || 100);
      const etlx = isCO ? e.x - r : e.x;
      const etly = isCO ? e.y - r : e.y;
      tgX.push(etlx, etlx + ew / 2, etlx + ew);
      tgY.push(etly, etly + eh / 2, etly + eh);
    }

    let snapXFound = false, snapYFound = false;
    for (const t of tgX) {
      if (snapXFound) break;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(dEx[i] - t) < threshold) { snapX = t - offX[i]; vGuides.push(t); snapXFound = true; break; }
      }
    }
    for (const t of tgY) {
      if (snapYFound) break;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(dEy[i] - t) < threshold) { snapY = t - offY[i]; hGuides.push(t); snapYFound = true; break; }
      }
    }
    setSnapGuides({ v: vGuides, h: hGuides });
    setLiveBounds({ x: Math.round(snapX), y: Math.round(snapY), w: Math.round(elW || 0), h: Math.round(elH || 0) });
    return { x: snapX, y: snapY };
  }

  function clearSnapGuides() { setSnapGuides({ v: [], h: [] }); setLiveBounds(null); }

  // ── Ruler drag guides ──────────────────────────────────────────────────────
  function startRulerDrag(axis) {
    const onMove = (ev) => {
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const raw = axis === 'h' ? (ev.clientY - rect.top) / stageScale : (ev.clientX - rect.left) / stageScale;
      const pos = Math.max(0, Math.min(raw, axis === 'h' ? canvasSize.h : canvasSize.w));
      setDraggingGuide({ axis, pos });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const raw = axis === 'h' ? (ev.clientY - rect.top) / stageScale : (ev.clientX - rect.left) / stageScale;
        const pos = Math.round(raw);
        if (pos > 0 && pos < (axis === 'h' ? canvasSize.h : canvasSize.w)) {
          setRulerGuides(prev => ({ ...prev, [axis]: [...prev[axis], pos] }));
        }
      }
      setDraggingGuide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ── Recent colors ──────────────────────────────────────────────────────────
  function pickColor(color, applyFn) {
    applyFn(color);
    setRecentColors(prev => [color, ...prev.filter(c => c !== color)].slice(0, 8));
  }

  // ── Text inline editing ────────────────────────────────────────────────────
  function startEditText(id) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#${id}`);
    if (!node) return;
    const absPos = node.getAbsolutePosition();
    setTextareaPos({ x: absPos.x * stageScale, y: absPos.y * stageScale, w: (el.width || 400) * stageScale, fontSize: (el.fontSize || 36) * stageScale });
    setTextareaValue(el.text || '');
    setEditingTextId(id);
    patchElements(prev => prev.map(e => e.id === id ? { ...e, visible: false } : e));
  }

  function commitTextEdit() {
    if (!editingTextId) return;
    pushHistory();
    patchElements(prev => prev.map(e => e.id === editingTextId ? { ...e, text: textareaValue, visible: true } : e));
    setEditingTextId(null);
  }

  // ── Background helpers ─────────────────────────────────────────────────────
  function selectBgPhoto(photo) {
    pushHistory();
    patchPage({ bgType: 'image', bgImageUrl: photo.url, bgSource: photo.source || 'stock', bgSourceId: photo.id });
  }

  function applyFilterPreset(key) {
    const p = FILTER_PRESETS[key];
    if (!p) return;
    pushHistory();
    patchPage({ bgFilter: key, bgBrightness: p.brightness, bgContrast: p.contrast, bgSaturation: p.saturation });
  }

  // ── Page management ───────────────────────────────────────────────────────
  function addPage() {
    pushHistory();
    const newPage = emptyPage();
    setPages(prev => [...prev, newPage]);
    setActivePage(pages.length);
    setSelectedId(null);
  }

  function duplicatePage(idx) {
    pushHistory();
    const copy = { ...JSON.parse(JSON.stringify(pages[idx])), id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
    setPages(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    setActivePage(idx + 1);
    setSelectedId(null);
  }

  function deletePage(idx) {
    if (pages.length <= 1) return;
    pushHistory();
    setPages(prev => prev.filter((_, i) => i !== idx));
    setActivePage(prev => Math.min(prev, pages.length - 2));
    setSelectedId(null);
  }

  function addElToAllPages(elId) {
    const el = elements.find(e => e.id === elId);
    if (!el) return;
    pushHistory();
    setPages(prev => prev.map((p, i) => {
      if (i === activePage) return p;
      const copy = { ...JSON.parse(JSON.stringify(el)), id: uid() };
      return { ...p, elements: [...p.elements, copy] };
    }));
  }

  function elBounds(e) {
    const isCO = ['circle', 'triangle', 'star'].includes(e.type);
    const r = e.radius || e.outerRadius || 60;
    if (isCO) return { x: e.x - r, y: e.y - r, w: r * 2, h: r * 2 };
    return { x: e.x, y: e.y, w: e.width || 100, h: e.height || 60 };
  }

  function groupSelected() {
    if (selectedIds.length < 2) return;
    const toGroup = elements.filter(e => selectedIds.includes(e.id));
    if (!toGroup.length) return;
    pushHistory();
    const bounds = toGroup.map(elBounds);
    const minX = Math.min(...bounds.map(b => b.x));
    const minY = Math.min(...bounds.map(b => b.y));
    const maxX = Math.max(...bounds.map(b => b.x + b.w));
    const maxY = Math.max(...bounds.map(b => b.y + b.h));
    const grpIdx = Math.min(...toGroup.map(e => elements.indexOf(e)));
    const group = {
      id: uid(), type: 'group',
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      rotation: 0, opacity: 1,
      children: toGroup.map(e => ({ ...JSON.parse(JSON.stringify(e)), x: e.x - minX, y: e.y - minY })),
    };
    patchElements(prev => {
      const filtered = prev.filter(e => !selectedIds.includes(e.id));
      filtered.splice(grpIdx, 0, group);
      return filtered;
    });
    setSelectedId(group.id);
    setSelectedIds([group.id]);
  }

  function ungroupSelected() {
    const grp = elements.find(e => e.id === selectedId && e.type === 'group');
    if (!grp) return;
    pushHistory();
    const grpIdx = elements.indexOf(grp);
    const restored = (grp.children || []).map(child => ({
      ...child, id: uid(), x: grp.x + child.x, y: grp.y + child.y,
    }));
    patchElements(prev => {
      const filtered = prev.filter(e => e.id !== grp.id);
      filtered.splice(grpIdx, 0, ...restored);
      return filtered;
    });
    const newIds = restored.map(e => e.id);
    setSelectedIds(newIds);
    setSelectedId(newIds[newIds.length - 1] || null);
  }

  function movePageUp(idx) {
    if (idx <= 0) return;
    pushHistory();
    setPages(prev => { const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; });
    setActivePage(idx - 1);
  }

  function movePageDown(idx) {
    if (idx >= pages.length - 1) return;
    pushHistory();
    setPages(prev => { const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; });
    setActivePage(idx + 1);
  }

  // ── Save & Post ────────────────────────────────────────────────────────────
  async function downloadAllPages() {
    if (!stageRef.current) return;
    const savedPage = activePage;
    clearSelection();
    setSelectedId(null);
    if (trLayerRef.current) trLayerRef.current.hide();
    const pixelRatio = canvasSize.w / stageDisplayW;
    for (let i = 0; i < pages.length; i++) {
      setActivePage(i);
      await new Promise(r => setTimeout(r, 300));
      await new Promise(r => requestAnimationFrame(r));
      const uri = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}_page${i + 1}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 80));
    }
    if (trLayerRef.current) trLayerRef.current.show();
    setActivePage(savedPage);
  }

  function downloadCanvas(mimeType, ext, quality) {
    if (!stageRef.current) return;
    const pixelRatio = canvasSize.w / stageDisplayW;
    clearSelection();
    if (trLayerRef.current) trLayerRef.current.hide();
    requestAnimationFrame(() => {
      const uri = stageRef.current.toDataURL({ mimeType, quality, pixelRatio });
      if (trLayerRef.current) trLayerRef.current.show();
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}.${ext}`;
      a.click();
    });
  }

  function downloadTransparentPng() {
    if (!stageRef.current) return;
    const pixelRatio = canvasSize.w / stageDisplayW;
    clearSelection();
    if (trLayerRef.current) trLayerRef.current.hide();
    const bgLayer = stageRef.current.getLayers()[0];
    if (bgLayer) bgLayer.hide();
    requestAnimationFrame(() => {
      const uri = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio });
      if (bgLayer) bgLayer.show();
      if (trLayerRef.current) trLayerRef.current.show();
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${titleForSave || 'design'}_transparent.png`;
      a.click();
    });
  }

  async function handleSave() {
    if (!stageRef.current) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      setSelectedId(null);
      await new Promise(r => requestAnimationFrame(r));
      await document.fonts.ready;
      if (trLayerRef.current) trLayerRef.current.hide();
      const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.9, pixelRatio: canvasSize.w / stageRef.current.width() });
      if (trLayerRef.current) trLayerRef.current.show();
      const snap = snapshot();
      const data = await studioAPI.save({ imageDataUrl: dataUrl, canvasJson: snap, title: titleForSave, canvasWidth: canvasSize.w, canvasHeight: canvasSize.h, backgroundSource: currentPage.bgSource, backgroundId: currentPage.bgSourceId });
      setSavedCreationId(data.creation.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      setPostModalOpen(true);
    } catch (err) {
      console.error('[TemplatesEditor] save:', err);
      setSaveStatus('idle');
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePost() {
    if (!savedCreationId) return;
    setPosting(true);
    setPostError('');
    try {
      await studioAPI.postCreation(savedCreationId, { caption: postCaption, platforms: postPlatforms, scheduleMode: 'now' });
      setPostSuccess(true);
    } catch (err) {
      setPostError(err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedEl = elements.find(e => e.id === selectedId);
  const stockPhotos = bgPhotos.filter(p => p.source === 'stock');
  const myPhotos = bgPhotos.filter(p => p.source === 'mine');
  const displayedBgPhotos = bgTab === 'stock' ? stockPhotos : myPhotos;
  const displayedImgPhotos = imgTab === 'stock' ? stockPhotos : myPhotos;

  // ── Color picker helper ────────────────────────────────────────────────────
  const RecentColorsRow = ({ onPick }) => recentColors.length === 0 ? null : (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
      {recentColors.map(c => (
        <button key={c} onClick={() => onPick(c)}
          style={{ width: 20, height: 20, borderRadius: 4, background: c, border: `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
      ))}
    </div>
  );

  function handleToolClick(toolId) {
    if (activeLeftTool === toolId && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveLeftTool(toolId);
      setPanelOpen(true);
    }
  }

  // ─── Document colors (extracted from all elements across all pages) ────────
  const docColors = useMemo(() => {
    const seen = new Set();
    const add = c => { if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) seen.add(c.toLowerCase()); };
    pages.forEach(page => {
      add(page.bgColor);
      if (page.bgGradient) { add(page.bgGradient.c1); add(page.bgGradient.c2); }
      page.elements.forEach(el => {
        add(el.fill); add(el.stroke); add(el.borderColor);
        add(el.outline?.color); add(el.shadow?.color);
        add(el.textBg?.color); add(el.tintColor);
        add(el.fillGradient?.c1); add(el.fillGradient?.c2);
      });
    });
    return [...seen].slice(0, 20);
  }, [pages]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <DocColorsCtx.Provider value={docColors}>
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', overflow: 'hidden', background: t.bg }}>

      {/* ── Top toolbar (Canva-style) ── */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: `1px solid ${t.border}`, background: t.card, flexShrink: 0, zIndex: 10, position: 'relative' }}>

        {/* ── Left zone ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>

          {/* Back */}
          <button onClick={() => router.push('/media?tab=templates')} title="Back to templates"
            style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: 'transparent', color: t.text, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ←
          </button>

          {/* File dropdown */}
          <div style={{ position: 'relative' }}>
            {showFileMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowFileMenu(false)} />}
            <button onClick={() => { setShowFileMenu(m => !m); setShowResizeMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 34, padding: '0 10px', border: `1px solid ${showFileMenu ? t.primary : t.border}`, borderRadius: 7, background: showFileMenu ? t.primaryBg : t.input, color: showFileMenu ? t.primary : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              File <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </button>
            {showFileMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 290, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, overflow: 'hidden' }}>
                {/* Header: title + dimensions */}
                <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{titleForSave || 'Untitled design'}</span>
                    <button onMouseDown={e => { e.preventDefault(); setTitleEditing(true); setShowFileMenu(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, padding: '2px 4px', borderRadius: 4 }}>✏</button>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{canvasSize.w}×{canvasSize.h}px</div>
                </div>
                {/* Menu items */}
                <div style={{ padding: '4px 0' }}>
                  {[
                    { icon: '⊕', label: 'Create new design',      fn: () => { if (elements.length === 0 || confirm('Start a new blank design?')) { pushHistory(); setPages([emptyPage()]); setActivePage(0); clearSelection(); setTitleForSave(''); } } },
                    { icon: '↑', label: 'Upload files',            fn: () => { triggerUpload?.(); } },
                    null,
                    { icon: '⚙', label: 'Settings',               arrow: true, fn: () => {} },
                    { icon: '♿', label: 'Accessibility',          arrow: true, fn: () => {} },
                    null,
                    { icon: '💾', label: 'Save',                   right: saving ? 'Saving…' : 'All changes saved', fn: () => handleSave() },
                    { icon: '⊙', label: 'Make available offline',  fn: () => {} },
                    { icon: '📁', label: 'Move',                   fn: () => {} },
                    { icon: '⧉', label: 'Make a copy',            fn: () => { const copy = JSON.parse(JSON.stringify(pages)); const now = Date.now(); copy.forEach((p,i) => { p.id = `page_${now+i}_copy`; }); pushHistory(); setPages(copy); } },
                    null,
                    { icon: '⬇', label: 'Download PNG',           fn: () => downloadCanvas('image/png',  'png',  1)    },
                    { icon: '⬇', label: 'Download JPEG',          fn: () => downloadCanvas('image/jpeg', 'jpg',  0.92) },
                    { icon: '🖨', label: 'Print',                  right: 'Ctrl+P', fn: () => window.print() },
                    null,
                    { icon: '⟳', label: 'Version history',        fn: () => {} },
                    { icon: '🗑', label: 'Move to Trash',          danger: true, fn: () => {} },
                  ].map((item, i) => item === null
                    ? <div key={i} style={{ height: 1, background: t.border, margin: '4px 0' }} />
                    : (
                      <button key={i} onMouseDown={e => { e.preventDefault(); item.fn(); setShowFileMenu(false); }}
                        style={{ width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', color: item.danger ? '#ef4444' : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', transition: 'background 100ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.input}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.right && <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>{item.right}</span>}
                        {item.arrow && <span style={{ color: t.textMuted }}>›</span>}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resize/canvas-size dropdown */}
          <div style={{ position: 'relative' }}>
            {showResizeMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowResizeMenu(false)} />}
            <button onClick={() => { setShowResizeMenu(m => !m); setShowFileMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 34, padding: '0 10px', border: `1px solid ${showResizeMenu ? t.primary : t.border}`, borderRadius: 7, background: showResizeMenu ? t.primaryBg : t.input, color: showResizeMenu ? t.primary : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{canvasSize.label}</span>
              <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▾</span>
            </button>
            {showResizeMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, overflow: 'hidden' }}>
                {/* Search */}
                <div style={{ padding: '10px 14px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '7px 12px' }}>
                    <span style={{ color: t.textMuted }}>🔍</span>
                    <input placeholder="Search resize options" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                  </div>
                </div>
                {/* Suggested */}
                <div style={{ padding: '4px 14px 6px', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested</div>
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px', overflowX: 'auto' }}>
                  {[
                    { label: 'Instagram Story',     w: 1080, h: 1920, id: 'ig_story',   tw: 34, th: 60 },
                    { label: 'Instagram Post (4:5)', w: 1080, h: 1350, id: 'ig_portrait', tw: 38, th: 48 },
                    { label: 'Facebook Post',        w: 1200, h:  630, id: 'fb_post',    tw: 56, th: 30 },
                  ].map(p => (
                    <button key={p.label} onMouseDown={() => { setCanvasSizeId(p.id); setShowCustomSizeForm(false); setShowResizeMenu(false); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: `1px solid ${canvasSizeId === p.id ? t.primary : t.border}`, borderRadius: 9, padding: '10px 8px', background: canvasSizeId === p.id ? t.primaryBg : 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                      <div style={{ width: p.tw, height: p.th, background: t.input, borderRadius: 4, border: `1px solid ${t.border}` }} />
                      <span style={{ fontSize: 11, fontWeight: 500, textAlign: 'center', maxWidth: 80, color: t.text }}>{p.label}</span>
                      <span style={{ fontSize: 10, color: t.textMuted }}>{p.w}×{p.h}px</span>
                    </button>
                  ))}
                </div>
                {/* Browse by category */}
                {/* Scale-on-resize toggle */}
                <div style={{ padding: '8px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: t.text, userSelect: 'none', flex: 1 }}>
                    <input type="checkbox" checked={scaleOnResize} onChange={e => setScaleOnResize(e.target.checked)}
                      style={{ accentColor: '#00C4CC', width: 14, height: 14, cursor: 'pointer' }} />
                    Scale content with canvas
                  </label>
                  <span style={{ fontSize: 10, color: t.textMuted }}>Magic Resize</span>
                </div>
                <div style={{ padding: '4px 14px 4px', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: `1px solid ${t.border}` }}>Browse by category</div>
                {/* Custom size row — expands to W×H form */}
                <button
                  onClick={() => setShowCustomSizeForm(p => !p)}
                  style={{ width: '100%', padding: '9px 16px', border: 'none', background: showCustomSizeForm ? t.primaryBg : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: showCustomSizeForm ? t.primary : t.text, fontSize: 13, cursor: 'pointer', transition: 'background 100ms' }}
                  onMouseEnter={e => { if (!showCustomSizeForm) e.currentTarget.style.background = t.input; }}
                  onMouseLeave={e => { if (!showCustomSizeForm) e.currentTarget.style.background = 'transparent'; }}>
                  <span>Custom size</span>
                  <span style={{ color: showCustomSizeForm ? t.primary : t.textMuted }}>{showCustomSizeForm ? '▴' : '›'}</span>
                </button>
                {showCustomSizeForm && (
                  <div style={{ padding: '10px 16px 12px', background: t.input, borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'end', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Width (px)</div>
                        <input type="number" min={100} max={8000} value={canvasCustomW}
                          onChange={e => setCanvasCustomW(Math.max(100, Math.min(8000, parseInt(e.target.value) || 100)))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <span style={{ fontSize: 14, color: t.textMuted, paddingBottom: 4 }}>×</span>
                      <div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Height (px)</div>
                        <input type="number" min={100} max={8000} value={canvasCustomH}
                          onChange={e => setCanvasCustomH(Math.max(100, Math.min(8000, parseInt(e.target.value) || 100)))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <button
                      onMouseDown={() => { setCanvasSizeId('custom'); setShowCustomSizeForm(false); setShowResizeMenu(false); }}
                      style={{ width: '100%', background: t.primary, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Apply custom size
                    </button>
                  </div>
                )}
                {['Social media', 'Presentations', 'Videos', 'Website', 'Whiteboard'].map(c => (
                  <button key={c} style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: t.text, fontSize: 13, cursor: 'pointer', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span>{c}</span><span style={{ color: t.textMuted }}>›</span>
                  </button>
                ))}
                <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${t.border}` }}>
                  <button style={{ width: '100%', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Try it free for 30 days
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── "✏ Editing ▾" mode dropdown ── */}
          <div style={{ position: 'relative' }}>
            {editModeOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setEditModeOpen(false)} />}
            <button onClick={() => { setEditModeOpen(o => !o); setShowFileMenu(false); setShowResizeMenu(false); setShowDownloadMenu(false); }}
              style={{ height: 34, padding: '0 10px', border: `1px solid ${editModeOpen ? t.primary : t.border}`, borderRadius: 7, background: editModeOpen ? t.primaryBg : t.input, color: editModeOpen ? t.primary : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              ✏ Editing <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </button>
            {editModeOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 220, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, padding: '4px 0' }}>
                {[
                  { id: 'editing',    label: 'Editing',    sub: 'Make changes'  },
                  { id: 'commenting', label: 'Commenting', sub: 'Add feedback'  },
                  { id: 'viewing',    label: 'Viewing',    sub: 'Read-only'     },
                ].map(m => (
                  <button key={m.id} onClick={() => { setEditMode(m.id); setEditModeOpen(false); }}
                    style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 13, color: t.text, textAlign: 'left', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{m.sub}</div>
                    </div>
                    {editMode === m.id && <span style={{ color: '#00C4CC', fontSize: 14 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Video mode toggle ── */}
          <button onClick={() => { setIsVideoMode(m => !m); setIsPlaying(false); setVideoPlayhead(0); }}
            onMouseEnter={e => showTip(e, isVideoMode ? 'Back to Image mode' : 'Edit as Video')} onMouseLeave={hideTip}
            style={{ height: 34, padding: '0 11px', border: `1px solid ${isVideoMode ? '#00C4CC' : t.border}`, borderRadius: 7, background: isVideoMode ? 'rgba(0,196,204,0.1)' : t.input, color: isVideoMode ? '#00C4CC' : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 100ms, border-color 100ms, color 100ms', flexShrink: 0 }}>
            {isVideoMode ? '◻ Image' : '▶ Video'}
          </button>
        </div>

        {/* ── Center zone: absolutely centered editable title ── */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center' }}>
          {titleEditing ? (
            <input
              autoFocus
              value={titleForSave}
              onChange={e => setTitleForSave(e.target.value)}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
              style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${t.primary}`, background: t.input, color: t.text, fontSize: 14, fontWeight: 600, outline: 'none', minWidth: 180, textAlign: 'center' }}
            />
          ) : (
            <button onClick={() => setTitleEditing(true)} title="Click to rename"
              style={{ padding: '5px 12px', border: '1px solid transparent', borderRadius: 7, background: 'transparent', color: t.text, fontSize: 14, fontWeight: 600, cursor: 'text', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${t.border}`; e.currentTarget.style.background = t.input; }}
              onMouseLeave={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = 'transparent'; }}>
              {titleForSave || 'Untitled design'} ✎
            </button>
          )}
        </div>

        {/* ── Right zone ── */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Undo / Redo */}
          <button onClick={undo} disabled={historyIndex < 0}
            onMouseEnter={e => showTip(e, 'Undo', 'Ctrl+Z')} onMouseLeave={hideTip}
            style={{ width: 34, height: 34, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: historyIndex < 0 ? t.textMuted : t.text, fontSize: 16, cursor: historyIndex < 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms' }}>⟲</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}
            onMouseEnter={e => showTip(e, 'Redo', 'Ctrl+Y')} onMouseLeave={hideTip}
            style={{ width: 34, height: 34, border: `1px solid ${t.border}`, borderRadius: 7, background: t.input, color: historyIndex >= history.length - 1 ? t.textMuted : t.text, fontSize: 16, cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms' }}>⟳</button>

          <div style={{ width: 1, height: 22, background: t.border, flexShrink: 0 }} />

          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.textMuted }}>
              <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span>
              Saving…
            </div>
          )}
          {saveStatus === 'saved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#00C4CC', animation: 'save-check 250ms ease forwards' }}>
              ✓ Saved
            </div>
          )}

          {/* Preview */}
          <button onClick={() => setPreviewOpen(true)}
            onMouseEnter={e => showTip(e, 'Preview', 'P')} onMouseLeave={hideTip}
            style={{ height: 36, padding: '0 13px', border: `1px solid ${t.border}`, borderRadius: 8, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'background 100ms' }}>
            ⊙ Preview
          </button>

          {/* Share */}
          <button onClick={() => { setShareOpen(o => !o); setShowFileMenu(false); setShowResizeMenu(false); setShowDownloadMenu(false); setEditModeOpen(false); }}
            onMouseEnter={e => showTip(e, 'Share design')} onMouseLeave={hideTip}
            style={{ height: 36, padding: '0 18px', borderRadius: 8, background: shareOpen ? '#6B4FE0' : t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 100ms' }}>
            Share
          </button>

          {/* Download dropdown */}
          <div style={{ position: 'relative' }}>
            {showDownloadMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setShowDownloadMenu(false)} />}
            <button onClick={() => { setShowDownloadMenu(m => !m); setShowFileMenu(false); setShowResizeMenu(false); }}
              style={{ height: 36, padding: '0 13px', border: `1px solid ${showDownloadMenu ? t.primary : t.border}`, borderRadius: 8, background: showDownloadMenu ? t.primaryBg : t.input, color: showDownloadMenu ? t.primary : t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
              ⬇ <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </button>
            {showDownloadMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 180, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, padding: '4px 0' }}>
                {[
                  { label: 'PNG (lossless)',      fn: () => downloadCanvas('image/png',  'png',  1)    },
                  { label: 'JPEG (smaller)',       fn: () => downloadCanvas('image/jpeg', 'jpg',  0.92) },
                  { label: 'PNG (transparent bg)', fn: () => downloadTransparentPng()                   },
                  ...(pages.length > 1 ? [{ label: `All ${pages.length} pages (PNG)`, fn: downloadAllPages }] : []),
                ].map((item, i) => (
                  <button key={i} onMouseDown={e => { e.preventDefault(); item.fn(); setShowDownloadMenu(false); }}
                    style={{ width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contextual action bar (Canva-style) ── */}
      <div onClick={() => { setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); setShowAdjustPanel(false); setShowSpacingPanel(false); setShowCropPanel(false); setShowFilterPanel(false); }}
        style={{ height: 44, display: 'flex', alignItems: 'center', gap: 1, padding: '0 12px', borderBottom: `1px solid ${t.border}`, background: t.card, flexShrink: 0, zIndex: 9, overflowX: 'auto' }}>

        {/* ── Multi-select bar ── */}
        {selectedIds.length > 1 && (() => {
          const D = () => <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px', flexShrink: 0 }} />;
          const Btn = ({ label, onClick, danger }) => (
            <button onClick={onClick} style={{ height: 30, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: danger ? '#ef4444' : t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, transition: 'background 80ms' }}>{label}</button>
          );
          const ALIGNS = [
            { label: '⊢ Left',   fn: () => { pushHistory(); const minX = Math.min(...selectedIds.map(id => elements.find(e=>e.id===id)?.x || 0)); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: minX} : el)); } },
            { label: '⊣ Right',  fn: () => { pushHistory(); const maxR = Math.max(...selectedIds.map(id => { const el=elements.find(e=>e.id===id); return (el?.x||0)+(el?.width||100); })); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: maxR-(el.width||100)} : el)); } },
            { label: '⊤ Top',    fn: () => { pushHistory(); const minY = Math.min(...selectedIds.map(id => elements.find(e=>e.id===id)?.y || 0)); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: minY} : el)); } },
            { label: '⊥ Bottom', fn: () => { pushHistory(); const maxB = Math.max(...selectedIds.map(id => { const el=elements.find(e=>e.id===id); return (el?.y||0)+(el?.height||60); })); patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: maxB-(el.height||60)} : el)); } },
            { label: '⊞ Center H', fn: () => { pushHistory(); const xs = selectedIds.map(id => elements.find(e=>e.id===id)?.x||0); const midX = (Math.min(...xs) + Math.max(...xs)) / 2; patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, x: midX-(el.width||100)/2} : el)); } },
            { label: '⊟ Center V', fn: () => { pushHistory(); const ys = selectedIds.map(id => elements.find(e=>e.id===id)?.y||0); const midY = (Math.min(...ys) + Math.max(...ys)) / 2; patchElements(prev => prev.map(el => selectedIds.includes(el.id) ? {...el, y: midY-(el.height||60)/2} : el)); } },
          ];
          return (
            <>
              <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0, paddingRight: 6 }}>{selectedIds.length} selected</span>
              <D />
              {ALIGNS.map((a, i) => <Btn key={i} label={a.label} onClick={a.fn} />)}
              {selectedIds.length >= 3 && (
                <>
                  <D />
                  <Btn label="⇔ Dist H" onClick={distributeH} />
                  <Btn label="⇕ Dist V" onClick={distributeV} />
                </>
              )}
              {styleClipboard && (
                <>
                  <D />
                  <Btn label="◈ Paste style to all" onClick={pasteStyleToAll} />
                </>
              )}
              <D />
              <Btn label="⊡ Group" onClick={groupSelected} />
              <D />
              <Btn label="⧉ Duplicate all" onClick={() => {
                pushHistory();
                const copies = selectedIds.map(id => {
                  const el = elements.find(e => e.id === id);
                  return el ? { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x+20, y: el.y+20 } : null;
                }).filter(Boolean);
                patchElements(prev => [...prev, ...copies]);
                setSelectedIds(copies.map(c => c.id));
                setSelectedId(copies[copies.length - 1]?.id || null);
              }} />
              <D />
              <Btn label="🗑 Delete all" danger onClick={() => { pushHistory(); const s = new Set(selectedIds); patchElements(prev => prev.filter(e => !s.has(e.id))); clearSelection(); }} />
              <div style={{ flex: 1 }} />
              <button onClick={clearSelection} style={{ height: 30, padding: '0 8px', border: 'none', borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 11, cursor: 'pointer' }}>✕ Deselect</button>
            </>
          );
        })()}

        {/* ── Nothing / background selected ── */}
        {selectedIds.length <= 1 && (!selectedEl && !selectedId) && (
          <span style={{ fontSize: 12, color: t.textMuted }}>{canvasSize.w} × {canvasSize.h} px — select an element to edit</span>
        )}
        {selectedIds.length <= 1 && selectedId === '__bg__' && (
          <span style={{ fontSize: 12, color: t.textMuted }}>Background — use the Design panel to change colors or photos</span>
        )}

        {/* ── TEXT selected ── */}
        {selectedIds.length <= 1 && selectedEl?.type === 'text' && (() => {
          const isBold   = (selectedEl.fontStyle || '').includes('bold');
          const isItalic = (selectedEl.fontStyle || '').includes('italic');
          const isUnder  = selectedEl.textDecoration === 'underline';
          const isStrike = selectedEl.textDecoration === 'line-through';
          const textXform = selectedEl.textTransform || 'none';
          const isUpper  = textXform !== 'none';
          const TEXT_XFORM_CYCLE = { none: 'uppercase', uppercase: 'lowercase', lowercase: 'capitalize', capitalize: 'none' };
          const TEXT_XFORM_LABEL = { none: 'Aa', uppercase: 'AA', lowercase: 'aa', capitalize: 'Ab' };
          const TEXT_XFORM_TIP   = { none: 'Text case: Normal', uppercase: 'Text case: UPPERCASE', lowercase: 'Text case: lowercase', capitalize: 'Text case: Title Case' };
          const D = () => <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px', flexShrink: 0 }} />;
          const Btn = ({ label, active, onClick, extraStyle = {} }) => (
            <button onClick={onClick} style={{ height: 30, minWidth: 30, padding: '0 7px', border: 'none', borderRadius: 6, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 80ms', ...extraStyle }}>{label}</button>
          );
          return (
            <>
              {/* Text color swatch */}
              <ColorPickerButton
                value={selectedEl.fill || '#ffffff'}
                onChange={c => pickColor(c, color => updateElement({ ...selectedEl, fill: color, fillType: 'solid' }))}
                onCommit={() => pushHistory()}
                recentColors={recentColors}
              />
              {/* Gradient text toggle */}
              <Btn label="⚏ Grad" active={selectedEl.fillType === 'gradient'}
                onClick={() => {
                  if (selectedEl.fillType === 'gradient') {
                    pushHistory(); updateElement({ ...selectedEl, fillType: 'solid' });
                  } else {
                    pushHistory(); updateElement({ ...selectedEl, fillType: 'gradient',
                      fillGradient: selectedEl.fillGradient || { c1: selectedEl.fill || '#7C5CFC', c2: '#00C4CC', angle: 135 } });
                  }
                }} />
              {selectedEl.fillType === 'gradient' && selectedEl.fillGradient && (
                <>
                  <ColorPickerButton value={selectedEl.fillGradient.c1 || '#7C5CFC'}
                    onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c1: c } })}
                    onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                  <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>→</span>
                  <ColorPickerButton value={selectedEl.fillGradient.c2 || '#00C4CC'}
                    onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c2: c } })}
                    onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                  <select value={selectedEl.fillGradient.angle ?? 135}
                    onChange={e => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, angle: parseInt(e.target.value) } }); }}
                    style={{ height: 24, padding: '0 3px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                    {[0,45,90,135,180,225,270,315].map(a => <option key={a} value={a}>{a}°</option>)}
                  </select>
                </>
              )}
              <D />
              {/* Font family */}
              <select value={selectedEl.fontFamily || 'Inter'} onChange={e => handleElementChange({ ...selectedEl, fontFamily: e.target.value })}
                style={{ height: 30, padding: '0 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, maxWidth: 130, cursor: 'pointer', flexShrink: 0 }}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {/* Font size – n + */}
              <button onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fontSize: Math.max(8, (selectedEl.fontSize || 36) - 1) }); }}
                style={{ width: 24, height: 30, border: `1px solid ${t.border}`, borderRight: 'none', borderRadius: '6px 0 0 6px', background: t.input, color: t.text, fontSize: 16, cursor: 'pointer', flexShrink: 0, marginLeft: 4 }}>–</button>
              <input type="number" value={selectedEl.fontSize || 36} min={8} max={400}
                onChange={e => handleElementChange({ ...selectedEl, fontSize: parseInt(e.target.value) || 36 })}
                onBlur={() => pushHistory()}
                style={{ width: 46, height: 30, border: `1px solid ${t.border}`, borderRadius: 0, background: t.input, color: t.text, fontSize: 13, textAlign: 'center', outline: 'none' }} />
              <button onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fontSize: Math.min(400, (selectedEl.fontSize || 36) + 1) }); }}
                style={{ width: 24, height: 30, border: `1px solid ${t.border}`, borderLeft: 'none', borderRadius: '0 6px 6px 0', background: t.input, color: t.text, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>+</button>
              <D />
              {/* B I U S aA */}
              <Btn label="B" active={isBold} extraStyle={{ fontWeight: 700 }}
                onClick={() => { const c = selectedEl.fontStyle||'normal'; handleElementChange({ ...selectedEl, fontStyle: isBold ? c.replace('bold','').trim()||'normal' : c==='normal'?'bold':`${c} bold` }); }} />
              <Btn label="I" active={isItalic} extraStyle={{ fontStyle: 'italic' }}
                onClick={() => { const c = selectedEl.fontStyle||'normal'; handleElementChange({ ...selectedEl, fontStyle: isItalic ? c.replace('italic','').trim()||'normal' : c==='normal'?'italic':`${c} italic` }); }} />
              <Btn label="U" active={isUnder}  extraStyle={{ textDecoration: 'underline' }}
                onClick={() => handleElementChange({ ...selectedEl, textDecoration: isUnder ? '' : 'underline' })} />
              <Btn label="S" active={isStrike} extraStyle={{ textDecoration: 'line-through' }}
                onClick={() => handleElementChange({ ...selectedEl, textDecoration: isStrike ? '' : 'line-through' })} />
              <button
                onMouseEnter={e => showTip(e, TEXT_XFORM_TIP[textXform])}
                onMouseLeave={hideTip}
                onClick={() => handleElementChange({ ...selectedEl, textTransform: TEXT_XFORM_CYCLE[textXform] })}
                style={{ height: 30, minWidth: 30, padding: '0 7px', border: 'none', borderRadius: 6, background: isUpper ? t.primaryBg : 'transparent', color: isUpper ? t.primary : t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 80ms', letterSpacing: '0.04em' }}>
                {TEXT_XFORM_LABEL[textXform]}
              </button>
              <D />
              {/* Horizontal alignment */}
              {[['left','≡ L'],['center','≡ C'],['right','≡ R']].map(([a, lbl]) => (
                <Btn key={a} label={lbl} active={selectedEl.align === a} onClick={() => handleElementChange({ ...selectedEl, align: a })} />
              ))}
              <D />
              {/* Vertical alignment */}
              {[['top','⬆','Top'],['middle','⬛','Mid'],['bottom','⬇','Bot']].map(([v,icon,lbl]) => (
                <Btn key={v} label={icon} active={(selectedEl.verticalAlign||'middle') === v}
                  title={`Align text ${v}`}
                  onClick={() => handleElementChange({ ...selectedEl, verticalAlign: v })} />
              ))}
              <D />
              {/* Shadow dropdown */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Shadow" active={!!selectedEl.shadow?.enabled}
                  onClick={() => { setShowShadowPanel(p => !p); setShowOutlinePanel(false); }} />
                {showShadowPanel && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                        onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                      Enable shadow
                    </label>
                    {selectedEl.shadow?.enabled && <>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Color</label>
                      <input type="color" value={selectedEl.shadow?.color || '#000000'}
                        onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                        onBlur={() => pushHistory()} style={{ width: '100%', height: 28, marginBottom: 10, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}` }} />
                      {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:4},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:2},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:2}].map(({lbl,k,mn,mx,def}) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:11, color:t.textMuted }}>{lbl}</span>
                            <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.shadow?.[k]??def}</span>
                          </div>
                          <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                            onChange={e => updateElement({ ...selectedEl, shadow: {...(selectedEl.shadow||{}), [k]:parseInt(e.target.value)} })}
                            onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                        </div>
                      ))}
                    </>}
                  </div>
                )}
              </div>
              {/* Outline dropdown */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Outline" active={!!selectedEl.outline?.enabled}
                  onClick={() => { setShowOutlinePanel(p => !p); setShowShadowPanel(false); }} />
                {showOutlinePanel && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 190, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={selectedEl.outline?.enabled || false}
                        onChange={e => handleElementChange({ ...selectedEl, outline: {...(selectedEl.outline||{}), enabled: e.target.checked} })} />
                      Enable outline
                    </label>
                    {selectedEl.outline?.enabled && <>
                      <label style={{ fontSize:11, color:t.textMuted, display:'block', marginBottom:4 }}>Color</label>
                      <input type="color" value={selectedEl.outline?.color||'#000000'}
                        onChange={e => updateElement({...selectedEl, outline:{...selectedEl.outline, color:e.target.value}})}
                        onBlur={() => pushHistory()} style={{ width:'100%', height:28, marginBottom:10, cursor:'pointer', borderRadius:6, border:`1px solid ${t.border}` }} />
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:11, color:t.textMuted }}>Width</span>
                        <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.outline?.width??1}</span>
                      </div>
                      <input type="range" min={1} max={20} value={selectedEl.outline?.width??1}
                        onChange={e => updateElement({...selectedEl, outline:{...(selectedEl.outline||{}), width:parseInt(e.target.value)}})}
                        onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                    </>}
                  </div>
                )}
              </div>
              {/* Spacing dropdown */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Spacing" active={showSpacingPanel}
                  onClick={() => { setShowSpacingPanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); }} />
                {showSpacingPanel && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    {[
                      { lbl: 'Letter spacing', k: 'letterSpacing', min: -10, max: 40, step: 0.5, def: 0, fmt: v => `${v}px` },
                      { lbl: 'Line height',    k: 'lineHeight',    min: 0.5, max: 4,  step: 0.05, def: 1.2, fmt: v => v.toFixed(2) },
                    ].map(({ lbl, k, min, max, step, def, fmt }) => (
                      <div key={k} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{lbl}</span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{fmt(selectedEl?.[k] ?? def)}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={selectedEl?.[k] ?? def}
                          onChange={e => updateElement({ ...selectedEl, [k]: parseFloat(e.target.value) })}
                          onMouseUp={() => pushHistory()}
                          style={{ width: '100%', accentColor: '#00C4CC' }} />
                      </div>
                    ))}
                    <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, letterSpacing: 0, lineHeight: 1.2 }); }}
                      style={{ width: '100%', padding: '6px', border: `1px solid ${t.border}`, borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      Reset spacing
                    </button>
                  </div>
                )}
              </div>
              <D />
              {/* Text background (highlight) */}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Highlight</span>
              <ColorPickerButton
                value={selectedEl.textBg?.color || '#ffff00'}
                onChange={c => { updateElement({ ...selectedEl, textBg: { ...(selectedEl.textBg||{}), enabled: true, color: c, opacity: selectedEl.textBg?.opacity ?? 1 } }); }}
                onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
              <input type="range" min={0} max={1} step={0.05}
                value={selectedEl.textBg?.enabled ? (selectedEl.textBg?.opacity ?? 1) : 0}
                onChange={e => { const v = parseFloat(e.target.value); updateElement({ ...selectedEl, textBg: { ...(selectedEl.textBg||{}), enabled: v > 0, color: selectedEl.textBg?.color || '#ffff00', opacity: v } }); }}
                onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
              {selectedEl.textBg?.enabled && (
                <button onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, textBg: { ...selectedEl.textBg, enabled: false, opacity: 0 } }); }}
                  title="Remove highlight"
                  style={{ height:24, padding:'0 6px', border:`1px solid ${t.border}`, borderRadius:5, background:'transparent', color:t.textMuted, fontSize:11, cursor:'pointer', flexShrink:0 }}>×</button>
              )}
              <D />
              {/* Opacity */}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap' }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Blend</span>
              <select value={selectedEl.blendMode||'source-over'} onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id===selectedEl.id ? {...el, blendMode:e.target.value} : el)); }} style={{ height:24, padding:'0 3px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, maxWidth:90 }}>
                {BLEND_MODES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                {[['left','⊢','Align left'],['centerH','↔','Center H'],['right','⊣','Align right'],['top','⊤','Align top'],['centerV','↕','Center V'],['bottom','⊥','Align bottom']].map(([dir,icon,title]) => (
                  <button key={dir} title={title} onMouseDown={e => { e.preventDefault(); alignEl(selectedEl.id, dir); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:t.text, fontSize:13, width:22, height:24, borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {icon}
                  </button>
                ))}
              </div>
              <D />
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Position" active={showPositionPanel}
                  onClick={() => { setShowPositionPanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); }} />
                {showPositionPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {[['X', 'x'], ['Y', 'y']].map(([lbl, k]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>{lbl}</div>
                          <input type="number" value={Math.round(selectedEl[k] || 0)}
                            onChange={e => updateElement({ ...selectedEl, [k]: parseInt(e.target.value) || 0 })}
                            onBlur={() => pushHistory()}
                            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>
                    {(selectedEl.width != null || selectedEl.height != null) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        {[['W', 'width'], ['H', 'height']].map(([lbl, k]) => (
                          <div key={k}>
                            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>{lbl}</div>
                            <input type="number" value={Math.round(selectedEl[k] || 0)}
                              onChange={e => updateElement({ ...selectedEl, [k]: Math.max(1, parseInt(e.target.value) || 1) })}
                              onBlur={() => pushHistory()}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: t.textMuted }}>Rotation</span>
                        <span style={{ fontSize: 10, color: t.textMuted }}>{Math.round(selectedEl.rotation || 0)}°</span>
                      </div>
                      <input type="range" min={-180} max={180} value={selectedEl.rotation || 0}
                        onChange={e => updateElement({ ...selectedEl, rotation: parseInt(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: '#00C4CC' }} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Layer</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                      {[['⤒','Bring to front',()=>bringToFront()],['↑','Bring forward',()=>bringForward()],['↓','Send backward',()=>sendBackward()],['⤓','Send to back',()=>sendToBack()]].map(([lbl,title,fn]) => (
                        <button key={title} title={title} onClick={fn}
                          style={{ padding: '6px 0', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 15, cursor: 'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="✦ Animate" active={showAnimatePanel || !!(selectedEl?.animateIn && selectedEl.animateIn !== 'none')}
                  onClick={() => { setShowAnimatePanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); }}
                  extraStyle={{ color: t.primary, fontWeight: 500 }} />
                {showAnimatePanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, width: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Entrance animation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      {ANIMATE_PRESETS.map(a => {
                        const isActive = (selectedEl.animateIn || 'none') === a.id;
                        return (
                          <button key={a.id} title={a.desc}
                            onClick={() => { pushHistory(); handleElementChange({ ...selectedEl, animateIn: a.id }); }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${isActive ? '#00C4CC' : t.border}`, background: isActive ? 'rgba(0,196,204,0.1)' : t.input, cursor: 'pointer', color: isActive ? '#00C4CC' : t.text }}>
                            <span style={{ fontSize: 18 }}>{a.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedEl.animateIn && selectedEl.animateIn !== 'none' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Duration</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="range" min={200} max={2000} step={100} value={selectedEl.animateDuration || 600}
                            onChange={e => updateElement({ ...selectedEl, animateDuration: parseInt(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                          <span style={{ fontSize: 11, color: t.textMuted, minWidth: 36, textAlign: 'right' }}>{((selectedEl.animateDuration || 600) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── IMAGE selected ── */}
        {selectedIds.length <= 1 && selectedEl?.type === 'image' && (() => {
          const D = () => <div style={{ width:1, height:22, background:t.border, margin:'0 4px', flexShrink:0 }} />;
          const Btn = ({ label, active, onClick }) => (
            <button onClick={onClick} style={{ height:30, padding:'0 9px', border:'none', borderRadius:6, background:active?t.primaryBg:'transparent', color:active?t.primary:t.text, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', transition:'background 80ms' }}>{label}</button>
          );
          return (
            <>
              <Btn label="⇄ Replace" active={false} onClick={() => replaceFileRef.current?.click()} />
              <Btn label="🖼 Set as BG" active={false} onClick={() => setElementAsBackground(selectedEl)} />
              <D />
              {/* Color tint */}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Tint</span>
              <ColorPickerButton
                value={selectedEl.tintColor || '#000000'}
                onChange={c => updateElement({ ...selectedEl, tintColor: c, tintOpacity: selectedEl.tintOpacity ?? 0.5 })}
                onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.tintOpacity ?? 0}
                onChange={e => { const v = parseFloat(e.target.value); updateElement({ ...selectedEl, tintOpacity: v, tintColor: selectedEl.tintColor || '#000000' }); }}
                onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
              <button onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, tintOpacity: 0, tintColor: undefined }); }}
                style={{ height:24, padding:'0 6px', border:`1px solid ${t.border}`, borderRadius:5, background:'transparent', color:t.textMuted, fontSize:11, cursor:'pointer', flexShrink:0 }} title="Remove tint">×</button>
              <D />
              <Btn label="⟺ Flip H" active={!!selectedEl.flipH} onClick={flipH} />
              <Btn label="⇅ Flip V" active={!!selectedEl.flipV} onClick={flipV} />
              <D />
              <Btn label="⤢ Fit page"  active={false} onClick={fitToPage}  />
              <Btn label="⤡ Fill page" active={false} onClick={fillPage} />
              <D />
              {/* Shape presets */}
              {[
                { label: '▭', title: 'Square', r: 0 },
                { label: '▢', title: 'Rounded', r: 30 },
                { label: '●', title: 'Circle', r: Math.round(Math.min(selectedEl.width||200, selectedEl.height||200) / 2) },
              ].map(({ label, title, r }) => (
                <button key={title} title={title} onMouseDown={e => { e.preventDefault(); pushHistory(); updateElement({ ...selectedEl, cornerRadius: r }); }}
                  style={{ height:28, padding:'0 8px', border:`1px solid ${(selectedEl.cornerRadius||0)===r ? '#00C4CC' : t.border}`, borderRadius:5, background:(selectedEl.cornerRadius||0)===r?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.cornerRadius||0)===r?'#00C4CC':t.text, fontSize:14, cursor:'pointer', flexShrink:0 }}>
                  {label}
                </button>
              ))}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
              <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
              <D />
              {/* Image border */}
              <Btn label="Border" active={!!selectedEl.borderEnabled}
                onClick={() => handleElementChange({...selectedEl, borderEnabled: !selectedEl.borderEnabled, borderColor: selectedEl.borderColor||'#ffffff', borderWidth: selectedEl.borderWidth||3})} />
              {selectedEl.borderEnabled && <>
                <ColorPickerButton
                  value={selectedEl.borderColor || '#ffffff'}
                  onChange={c => pickColor(c, color => updateElement({ ...selectedEl, borderColor: color }))}
                  onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                <input type="range" min={1} max={30} value={selectedEl.borderWidth||3}
                  onChange={e => updateElement({...selectedEl, borderWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.borderWidth||3}px</span>
                {[['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, borderStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.borderStyle||'solid')===s?'#00C4CC':t.border}`, borderRadius:5, background:(selectedEl.borderStyle||'solid')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.borderStyle||'solid')===s?'#00C4CC':t.text, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em' }}>
                    {icon}
                  </button>
                ))}
              </>}
              <D />
              <Btn label="↑ Fwd"   active={false} onClick={() => bringForward()} />
              <Btn label="↓ Back"  active={false} onClick={() => sendBackward()} />
              <Btn label="⤒ Front" active={false} onClick={() => bringToFront()} />
              <Btn label="⤓ Back"  active={false} onClick={() => sendToBack()} />
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Blend</span>
              <select value={selectedEl.blendMode||'source-over'} onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id===selectedEl.id ? {...el, blendMode:e.target.value} : el)); }} style={{ height:24, padding:'0 3px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, maxWidth:90 }}>
                {BLEND_MODES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <D />
              <Btn label={lockedIds.has(selectedEl.id)?'🔒':'🔓'} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
              <D />
              {/* Image Filter presets panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="◐ Filter" active={showFilterPanel || !!(selectedEl.filterPreset && selectedEl.filterPreset !== 'normal') || !!selectedEl.duotone?.enabled}
                  onClick={() => { setShowFilterPanel(p => !p); setShowAdjustPanel(false); setShowCropPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showFilterPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, width: 230, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Filter presets</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      {Object.entries(FILTER_PRESETS).map(([key, p]) => {
                        const isActive = (selectedEl.filterPreset || 'normal') === key;
                        return (
                          <button key={key}
                            onClick={() => {
                              pushHistory();
                              updateElement({ ...selectedEl, filterPreset: key, brightness: p.brightness, contrast: p.contrast, saturation: p.saturation });
                            }}
                            style={{ padding: '6px 0', borderRadius: 7, border: `1.5px solid ${isActive ? '#00C4CC' : t.border}`, background: isActive ? 'rgba(0,196,204,0.12)' : t.input, color: isActive ? '#00C4CC' : t.text, fontSize: 10, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
                            {key}
                          </button>
                        );
                      })}
                    </div>
                    {/* Duotone section */}
                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>Duotone</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: t.text }}>
                          <input type="checkbox" checked={selectedEl.duotone?.enabled || false}
                            onChange={e => { pushHistory(); updateElement({ ...selectedEl, duotone: { ...(selectedEl.duotone||{}), enabled: e.target.checked, c1: selectedEl.duotone?.c1||'#1a1a22', c2: selectedEl.duotone?.c2||'#00C4CC' } }); }}
                            style={{ accentColor: '#00C4CC', cursor: 'pointer' }} />
                          On
                        </label>
                      </div>
                      {selectedEl.duotone?.enabled && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <ColorPickerButton value={selectedEl.duotone?.c1 || '#1a1a22'}
                            onChange={c => updateElement({ ...selectedEl, duotone: { ...selectedEl.duotone, c1: c } })}
                            onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                          <span style={{ color: t.textMuted, fontSize: 11 }}>→</span>
                          <ColorPickerButton value={selectedEl.duotone?.c2 || '#00C4CC'}
                            onChange={c => updateElement({ ...selectedEl, duotone: { ...selectedEl.duotone, c2: c } })}
                            onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {[
                          { c1: '#1a1a22', c2: '#00C4CC' },
                          { c1: '#1a1a22', c2: '#7C5CFC' },
                          { c1: '#1a1a22', c2: '#f97316' },
                          { c1: '#0c1445', c2: '#ec4899' },
                          { c1: '#000000', c2: '#ffffff' },
                          { c1: '#1e3a1e', c2: '#84cc16' },
                        ].map((pair, i) => {
                          const isOn = selectedEl.duotone?.enabled && selectedEl.duotone?.c1 === pair.c1 && selectedEl.duotone?.c2 === pair.c2;
                          return (
                            <button key={i} title={`${pair.c1} → ${pair.c2}`}
                              onMouseDown={() => { pushHistory(); updateElement({ ...selectedEl, duotone: { enabled: true, c1: pair.c1, c2: pair.c2 } }); }}
                              style={{ width: 30, height: 20, borderRadius: 5, border: `2px solid ${isOn ? '#00C4CC' : t.border}`, background: `linear-gradient(90deg, ${pair.c1} 0%, ${pair.c2} 100%)`, cursor: 'pointer', padding: 0 }} />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Image Adjust panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="◑ Adjust" active={showAdjustPanel || (selectedEl.brightness||0)!==0 || (selectedEl.contrast||0)!==0 || (selectedEl.saturation||0)!==0 || (selectedEl.blur||0)>0}
                  onClick={() => { setShowAdjustPanel(p => !p); setShowCropPanel(false); setShowFilterPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showAdjustPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    {[
                      { label: 'Brightness', k: 'brightness', min: -1,   max: 1,   step: 0.05, def: 0 },
                      { label: 'Contrast',   k: 'contrast',   min: -100, max: 100, step: 5,    def: 0 },
                      { label: 'Saturation', k: 'saturation', min: -1,   max: 1,   step: 0.05, def: 0 },
                      { label: 'Blur',       k: 'blur',       min: 0,    max: 40,  step: 0.5,  def: 0 },
                    ].map(({ label, k, min, max, step, def }) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{+(selectedEl[k] ?? def).toFixed(2)}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={selectedEl[k] ?? def}
                          onChange={e => updateElement({ ...selectedEl, [k]: parseFloat(e.target.value) })}
                          onMouseUp={() => pushHistory()} style={{ width: '100%', accentColor: '#00C4CC' }} />
                      </div>
                    ))}
                    <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, brightness: 0, contrast: 0, saturation: 0, blur: 0 }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                      Reset adjustments
                    </button>
                  </div>
                )}
              </div>
              {/* Crop panel */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="⚟ Crop" active={showCropPanel || (selectedEl.cropTop||0)>0 || (selectedEl.cropBottom||0)>0 || (selectedEl.cropLeft||0)>0 || (selectedEl.cropRight||0)>0}
                  onClick={() => { setShowCropPanel(p => !p); setShowAdjustPanel(false); setShowFilterPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showCropPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Crop edges (%)</div>
                    {[
                      { label: 'Top',    k: 'cropTop'    },
                      { label: 'Bottom', k: 'cropBottom' },
                      { label: 'Left',   k: 'cropLeft'   },
                      { label: 'Right',  k: 'cropRight'  },
                    ].map(({ label, k }) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{(selectedEl[k] || 0).toFixed(0)}%</span>
                        </div>
                        <input type="range" min={0} max={49} step={1} value={selectedEl[k] || 0}
                          onChange={e => updateElement({ ...selectedEl, [k]: parseInt(e.target.value) })}
                          onMouseUp={() => pushHistory()}
                          style={{ width: '100%', accentColor: '#00C4CC' }} />
                      </div>
                    ))}
                    <button onClick={() => { pushHistory(); updateElement({ ...selectedEl, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      Reset crop
                    </button>
                  </div>
                )}
              </div>
              {/* Shadow panel for images */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Shadow" active={!!selectedEl.shadow?.enabled}
                  onClick={() => { setShowShadowPanel(p => !p); setShowAdjustPanel(false); setShowFilterPanel(false); setShowCropPanel(false); setShowPositionPanel(false); setShowAnimatePanel(false); }} />
                {showShadowPanel && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                        onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                      Enable shadow
                    </label>
                    {selectedEl.shadow?.enabled && <>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Color</label>
                      <input type="color" value={selectedEl.shadow?.color || '#000000'}
                        onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                        onBlur={() => pushHistory()} style={{ width: '100%', height: 28, marginBottom: 10, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}` }} />
                      {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:8},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:4},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:4}].map(({lbl,k,mn,mx,def}) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:11, color:t.textMuted }}>{lbl}</span>
                            <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.shadow?.[k]??def}</span>
                          </div>
                          <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                            onChange={e => updateElement({ ...selectedEl, shadow: {...(selectedEl.shadow||{}), [k]:parseInt(e.target.value)} })}
                            onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                        </div>
                      ))}
                    </>}
                  </div>
                )}
              </div>
              <div style={{ flex:1 }} />
              <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                {[['left','⊢','Align left'],['centerH','↔','Center H'],['right','⊣','Align right'],['top','⊤','Align top'],['centerV','↕','Center V'],['bottom','⊥','Align bottom']].map(([dir,icon,title]) => (
                  <button key={dir} title={title} onMouseDown={e => { e.preventDefault(); alignEl(selectedEl.id, dir); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:t.text, fontSize:13, width:22, height:24, borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {icon}
                  </button>
                ))}
              </div>
              <D />
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Position" active={showPositionPanel}
                  onClick={() => { setShowPositionPanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); }} />
                {showPositionPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {[['X','x'],['Y','y']].map(([lbl,k]) => (
                        <div key={k}>
                          <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>{lbl}</div>
                          <input type="number" value={Math.round(selectedEl[k]||0)} onChange={e=>updateElement({...selectedEl,[k]:parseInt(e.target.value)||0})} onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                        </div>
                      ))}
                    </div>
                    {(selectedEl.width!=null||selectedEl.height!=null) && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:4, alignItems:'end' }}>
                          <div>
                            <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>W</div>
                            <input type="number" value={Math.round(selectedEl.width||0)}
                              onChange={e => { const nw=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, width:nw, height: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nw*selectedEl.height/selectedEl.width)) : selectedEl.height}); }}
                              onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                          </div>
                          <button onClick={() => setLockAspectRatio(p=>!p)} title={lockAspectRatio?'Unlock aspect ratio':'Lock aspect ratio'}
                            style={{ height:28, width:20, border:'none', background:'transparent', cursor:'pointer', color:lockAspectRatio?'#00C4CC':t.textMuted, fontSize:13, padding:0, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            ⛓
                          </button>
                          <div>
                            <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>H</div>
                            <input type="number" value={Math.round(selectedEl.height||0)}
                              onChange={e => { const nh=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, height:nh, width: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nh*selectedEl.width/selectedEl.height)) : selectedEl.width}); }}
                              onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:10, color:t.textMuted }}>Rotation</span>
                        <span style={{ fontSize:10, color:t.textMuted }}>{Math.round(selectedEl.rotation||0)}°</span>
                      </div>
                      <input type="range" min={-180} max={180} value={selectedEl.rotation||0} onChange={e=>updateElement({...selectedEl,rotation:parseInt(e.target.value)})} onMouseUp={()=>pushHistory()} style={{ width:'100%', accentColor:'#00C4CC' }} />
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Layer</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                      {[['⤒','Bring to front',()=>bringToFront()],['↑','Bring forward',()=>bringForward()],['↓','Send backward',()=>sendBackward()],['⤓','Send to back',()=>sendToBack()]].map(([lbl,title,fn]) => (
                        <button key={title} title={title} onClick={fn} style={{ padding:'6px 0', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:15, cursor:'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="✦ Animate" active={showAnimatePanel || !!(selectedEl?.animateIn && selectedEl.animateIn !== 'none')}
                  onClick={() => { setShowAnimatePanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); }} />
                {showAnimatePanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, width: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Entrance animation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      {ANIMATE_PRESETS.map(a => {
                        const isActive = (selectedEl.animateIn || 'none') === a.id;
                        return (
                          <button key={a.id} title={a.desc}
                            onClick={() => { pushHistory(); handleElementChange({ ...selectedEl, animateIn: a.id }); }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${isActive ? '#00C4CC' : t.border}`, background: isActive ? 'rgba(0,196,204,0.1)' : t.input, cursor: 'pointer', color: isActive ? '#00C4CC' : t.text }}>
                            <span style={{ fontSize: 18 }}>{a.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedEl.animateIn && selectedEl.animateIn !== 'none' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Duration</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="range" min={200} max={2000} step={100} value={selectedEl.animateDuration || 600}
                            onChange={e => updateElement({ ...selectedEl, animateDuration: parseInt(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                          <span style={{ fontSize: 11, color: t.textMuted, minWidth: 36, textAlign: 'right' }}>{((selectedEl.animateDuration || 600) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── SHAPE selected (rect, circle, line, triangle, star, arrow) ── */}
        {selectedIds.length <= 1 && selectedEl && !['text','image'].includes(selectedEl.type) && (() => {
          const D = () => <div style={{ width:1, height:22, background:t.border, margin:'0 4px', flexShrink:0 }} />;
          const Btn = ({ label, active, onClick }) => (
            <button onClick={onClick} style={{ height:30, padding:'0 9px', border:'none', borderRadius:6, background:active?t.primaryBg:'transparent', color:active?t.primary:t.text, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', transition:'background 80ms' }}>{label}</button>
          );
          const fillKey = ['line','arrow'].includes(selectedEl.type) ? 'stroke' : 'fill';
          const fillVal = (selectedEl[fillKey] || '#ffffff').startsWith('rgba') ? '#888888' : (selectedEl[fillKey] || '#ffffff');
          return (
            <>
              {/* Fill/stroke color swatch */}
              <ColorPickerButton
                value={fillVal}
                onChange={c => pickColor(c, color => updateElement({ ...selectedEl, [fillKey]: color, fillType: 'solid' }))}
                onCommit={() => pushHistory()}
                recentColors={recentColors}
              />
              {/* Gradient toggle (not for lines/arrows) */}
              {!['line','arrow'].includes(selectedEl.type) && (
                <>
                  <Btn label="⚏ Gradient" active={selectedEl.fillType === 'gradient'}
                    onClick={() => {
                      if (selectedEl.fillType === 'gradient') {
                        pushHistory(); updateElement({ ...selectedEl, fillType: 'solid' });
                      } else {
                        pushHistory(); updateElement({ ...selectedEl, fillType: 'gradient',
                          fillGradient: selectedEl.fillGradient || { c1: selectedEl.fill || '#7C5CFC', c2: '#00C4CC', angle: 135 } });
                      }
                    }} />
                  {selectedEl.fillType === 'gradient' && selectedEl.fillGradient && (
                    <>
                      <ColorPickerButton
                        value={selectedEl.fillGradient.c1 || '#7C5CFC'}
                        onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c1: c } })}
                        onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                      <span style={{ fontSize: 10, color: t.textMuted }}>→</span>
                      <ColorPickerButton
                        value={selectedEl.fillGradient.c2 || '#00C4CC'}
                        onChange={c => updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, c2: c } })}
                        onCommit={() => pushHistory()} recentColors={recentColors} size={18} />
                      <select value={selectedEl.fillGradient.angle ?? 135}
                        onChange={e => { pushHistory(); updateElement({ ...selectedEl, fillGradient: { ...selectedEl.fillGradient, angle: parseInt(e.target.value) } }); }}
                        style={{ height: 24, padding: '0 3px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                        {[0,45,90,135,180,225,270,315].map(a => <option key={a} value={a}>{a}°</option>)}
                      </select>
                    </>
                  )}
                </>
              )}
              {['line','arrow'].includes(selectedEl.type) && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Width</span>
                <input type="range" min={1} max={20} value={selectedEl.strokeWidth||3}
                  onChange={e => updateElement({...selectedEl, strokeWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.strokeWidth||3}px</span>
                {[['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, strokeStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.strokeStyle||'solid')===s?'#00C4CC':t.border}`, borderRadius:5, background:(selectedEl.strokeStyle||'solid')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.strokeStyle||'solid')===s?'#00C4CC':t.text, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em' }}>
                    {icon}
                  </button>
                ))}
              </>}
              {selectedEl.type === 'rect' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                  onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0 }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
              </>}
              {selectedEl.type === 'triangle' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Sides</span>
                <input type="range" min={3} max={12} value={selectedEl.sides||3}
                  onChange={e => updateElement({...selectedEl, sides:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:18, flexShrink:0 }}>{selectedEl.sides||3}</span>
              </>}
              {selectedEl.type === 'star' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Points</span>
                <input type="range" min={3} max={12} value={selectedEl.numPoints||5}
                  onChange={e => updateElement({...selectedEl, numPoints:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:18, flexShrink:0 }}>{selectedEl.numPoints||5}</span>
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Depth</span>
                <input type="range" min={5} max={90} value={Math.round(((selectedEl.innerRadius||25)/(selectedEl.outerRadius||60))*100)}
                  onChange={e => { const outer=selectedEl.outerRadius||60; updateElement({...selectedEl, innerRadius:Math.max(2,Math.round(outer*parseInt(e.target.value)/100))}); }}
                  onMouseUp={() => pushHistory()} style={{ width:55, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:28, flexShrink:0 }}>{Math.round(((selectedEl.innerRadius||25)/(selectedEl.outerRadius||60))*100)}%</span>
              </>}
              <D />
              {/* Border toggle + color + width */}
              <Btn label="Border" active={!!selectedEl.borderEnabled}
                onClick={() => handleElementChange({...selectedEl, borderEnabled: !selectedEl.borderEnabled, borderColor: selectedEl.borderColor||'#ffffff', borderWidth: selectedEl.borderWidth||2})} />
              {selectedEl.borderEnabled && <>
                <ColorPickerButton
                  value={selectedEl.borderColor || '#ffffff'}
                  onChange={c => pickColor(c, color => updateElement({ ...selectedEl, borderColor: color }))}
                  onCommit={() => pushHistory()}
                  recentColors={recentColors}
                  size={18}
                />
                <input type="range" min={1} max={20} value={selectedEl.borderWidth||2}
                  onChange={e => updateElement({...selectedEl, borderWidth:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0, accentColor:'#00C4CC' }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.borderWidth||2}px</span>
                {[['solid','─'],['dashed','╌'],['dotted','···']].map(([s,icon]) => (
                  <button key={s} title={s.charAt(0).toUpperCase()+s.slice(1)} onClick={() => { pushHistory(); updateElement({...selectedEl, borderStyle: s}); }}
                    style={{ height:26, padding:'0 8px', border:`1px solid ${(selectedEl.borderStyle||'solid')===s?'#00C4CC':t.border}`, borderRadius:5, background:(selectedEl.borderStyle||'solid')===s?'rgba(0,196,204,0.1)':'transparent', color:(selectedEl.borderStyle||'solid')===s?'#00C4CC':t.text, fontSize:13, cursor:'pointer', flexShrink:0, letterSpacing:'0.05em' }}>
                    {icon}
                  </button>
                ))}
              </>}
              <D />
              {/* Flip buttons (skip for circle — symmetric) */}
              {selectedEl.type !== 'circle' && <>
                <Btn label="⟺ Flip H" active={!!selectedEl.flipH} onClick={() => { pushHistory(); updateElement({ ...selectedEl, flipH: !selectedEl.flipH }); }} />
                <Btn label="⇅ Flip V" active={!!selectedEl.flipV} onClick={() => { pushHistory(); updateElement({ ...selectedEl, flipV: !selectedEl.flipV }); }} />
                <D />
              </>}
              {/* Shadow panel for shapes */}
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Shadow" active={!!selectedEl.shadow?.enabled}
                  onClick={() => { setShowShadowPanel(p => !p); setShowPositionPanel(false); }} />
                {showShadowPanel && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 210, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: t.text, cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                        onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow||{}), enabled: e.target.checked } })} />
                      Enable shadow
                    </label>
                    {selectedEl.shadow?.enabled && <>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Color</label>
                      <input type="color" value={selectedEl.shadow?.color || '#000000'}
                        onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                        onBlur={() => pushHistory()} style={{ width: '100%', height: 28, marginBottom: 10, cursor: 'pointer', borderRadius: 6, border: `1px solid ${t.border}` }} />
                      {[{lbl:'Blur',k:'blur',mn:0,mx:40,def:4},{lbl:'Offset X',k:'offsetX',mn:-30,mx:30,def:2},{lbl:'Offset Y',k:'offsetY',mn:-30,mx:30,def:2}].map(({lbl,k,mn,mx,def}) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:11, color:t.textMuted }}>{lbl}</span>
                            <span style={{ fontSize:11, color:t.textMuted }}>{selectedEl.shadow?.[k]??def}</span>
                          </div>
                          <input type="range" min={mn} max={mx} value={selectedEl.shadow?.[k]??def}
                            onChange={e => updateElement({ ...selectedEl, shadow: {...(selectedEl.shadow||{}), [k]:parseInt(e.target.value)} })}
                            onMouseUp={() => pushHistory()} style={{ width:'100%' }} />
                        </div>
                      ))}
                    </>}
                  </div>
                )}
              </div>
              <D />
              <Btn label="↑ Fwd"   active={false} onClick={() => bringForward()} />
              <Btn label="↓ Back"  active={false} onClick={() => sendBackward()} />
              <Btn label="⤒ Front" active={false} onClick={() => bringToFront()} />
              <Btn label="⤓ Back"  active={false} onClick={() => sendToBack()} />
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Blend</span>
              <select value={selectedEl.blendMode||'source-over'} onChange={e => { pushHistory(); patchElements(p => p.map(el => el.id===selectedEl.id ? {...el, blendMode:e.target.value} : el)); }} style={{ height:24, padding:'0 3px', borderRadius:5, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:11, cursor:'pointer', flexShrink:0, maxWidth:90 }}>
                {BLEND_MODES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <D />
              <Btn label={lockedIds.has(selectedEl.id)?'🔒':'🔓'} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
              <div style={{ flex:1 }} />
              <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                {[['left','⊢','Align left'],['centerH','↔','Center H'],['right','⊣','Align right'],['top','⊤','Align top'],['centerV','↕','Center V'],['bottom','⊥','Align bottom']].map(([dir,icon,title]) => (
                  <button key={dir} title={title} onMouseDown={e => { e.preventDefault(); alignEl(selectedEl.id, dir); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:t.text, fontSize:13, width:22, height:24, borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {icon}
                  </button>
                ))}
              </div>
              <D />
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="Position" active={showPositionPanel}
                  onClick={() => { setShowPositionPanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); }} />
                {showPositionPanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      {[['X','x'],['Y','y']].map(([lbl,k]) => (
                        <div key={k}>
                          <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>{lbl}</div>
                          <input type="number" value={Math.round(selectedEl[k]||0)} onChange={e=>updateElement({...selectedEl,[k]:parseInt(e.target.value)||0})} onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                        </div>
                      ))}
                    </div>
                    {(selectedEl.width!=null||selectedEl.height!=null) && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:4, alignItems:'end' }}>
                          <div>
                            <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>W</div>
                            <input type="number" value={Math.round(selectedEl.width||0)}
                              onChange={e => { const nw=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, width:nw, height: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nw*selectedEl.height/selectedEl.width)) : selectedEl.height}); }}
                              onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                          </div>
                          <button onClick={() => setLockAspectRatio(p=>!p)} title={lockAspectRatio?'Unlock aspect ratio':'Lock aspect ratio'}
                            style={{ height:28, width:20, border:'none', background:'transparent', cursor:'pointer', color:lockAspectRatio?'#00C4CC':t.textMuted, fontSize:13, padding:0, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            ⛓
                          </button>
                          <div>
                            <div style={{ fontSize:10, color:t.textMuted, marginBottom:3 }}>H</div>
                            <input type="number" value={Math.round(selectedEl.height||0)}
                              onChange={e => { const nh=Math.max(1,parseInt(e.target.value)||1); updateElement({...selectedEl, height:nh, width: lockAspectRatio&&selectedEl.height&&selectedEl.width ? Math.max(1,Math.round(nh*selectedEl.width/selectedEl.height)) : selectedEl.width}); }}
                              onBlur={()=>pushHistory()} style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:12, boxSizing:'border-box' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:10, color:t.textMuted }}>Rotation</span>
                        <span style={{ fontSize:10, color:t.textMuted }}>{Math.round(selectedEl.rotation||0)}°</span>
                      </div>
                      <input type="range" min={-180} max={180} value={selectedEl.rotation||0} onChange={e=>updateElement({...selectedEl,rotation:parseInt(e.target.value)})} onMouseUp={()=>pushHistory()} style={{ width:'100%', accentColor:'#00C4CC' }} />
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Layer</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                      {[['⤒','Bring to front',()=>bringToFront()],['↑','Bring forward',()=>bringForward()],['↓','Send backward',()=>sendBackward()],['⤓','Send to back',()=>sendToBack()]].map(([lbl,title,fn]) => (
                        <button key={title} title={title} onClick={fn} style={{ padding:'6px 0', borderRadius:6, border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:15, cursor:'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Btn label="✦ Animate" active={showAnimatePanel || !!(selectedEl?.animateIn && selectedEl.animateIn !== 'none')}
                  onClick={() => { setShowAnimatePanel(p => !p); setShowShadowPanel(false); setShowOutlinePanel(false); setShowPositionPanel(false); }} />
                {showAnimatePanel && selectedEl && (
                  <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 400, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, width: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Entrance animation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      {ANIMATE_PRESETS.map(a => {
                        const isActive = (selectedEl.animateIn || 'none') === a.id;
                        return (
                          <button key={a.id} title={a.desc}
                            onClick={() => { pushHistory(); handleElementChange({ ...selectedEl, animateIn: a.id }); }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${isActive ? '#00C4CC' : t.border}`, background: isActive ? 'rgba(0,196,204,0.1)' : t.input, cursor: 'pointer', color: isActive ? '#00C4CC' : t.text }}>
                            <span style={{ fontSize: 18 }}>{a.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedEl.animateIn && selectedEl.animateIn !== 'none' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>Duration</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="range" min={200} max={2000} step={100} value={selectedEl.animateDuration || 600}
                            onChange={e => updateElement({ ...selectedEl, animateDuration: parseInt(e.target.value) })}
                            onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                          <span style={{ fontSize: 11, color: t.textMuted, minWidth: 36, textAlign: 'right' }}>{((selectedEl.animateDuration || 600) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar: 72px icon strip + 320px collapsible flyout ── */}

        {/* 72px icon strip — always visible */}
        <div style={{ width: 72, borderRight: `1px solid ${t.border}`, background: t.card,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 0', flexShrink: 0, gap: 2 }}>
          {[
            { id: 'templates', icon: '▦', label: 'Templates' },
            { id: 'elements',  icon: '✦', label: 'Elements'  },
            { id: 'text',      icon: 'T',  label: 'Text',      shortcut: 'T' },
            { id: 'brand',     icon: '◈', label: 'Brand',  pro: true },
            { id: 'uploads',   icon: '⬆', label: 'Uploads'   },
            { id: 'layers',    icon: '▥', label: 'Layers'    },
            { id: 'tools',     icon: '✐', label: 'Tools'     },
            { id: 'projects',  icon: '⊟', label: 'Projects'  },
          ].map(tool => (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              onMouseEnter={e => showTip(e, tool.label, tool.shortcut)}
              onMouseLeave={hideTip}
              style={{
                width: 60, padding: '10px 0 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: activeLeftTool === tool.id && panelOpen ? t.primaryBg : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: activeLeftTool === tool.id && panelOpen ? t.primary : t.textMuted,
                fontSize: 10, fontWeight: activeLeftTool === tool.id && panelOpen ? 600 : 400,
                transition: 'background 100ms ease, color 100ms ease, transform 100ms ease',
                position: 'relative',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tool.icon}</span>
              {tool.label}
              {tool.pro && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 8, color: '#FFB800' }}>👑</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {[
            { id: 'apps',  icon: '⊞', label: 'Apps'  },
            { id: 'magic', icon: '⟡', label: 'Magic Media' },
          ].map(tool => (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              onMouseEnter={e => showTip(e, tool.label)}
              onMouseLeave={hideTip}
              style={{
                width: 60, padding: '10px 0 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: activeLeftTool === tool.id && panelOpen ? t.primaryBg : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: activeLeftTool === tool.id && panelOpen ? t.primary : t.textMuted,
                fontSize: 10, fontWeight: activeLeftTool === tool.id && panelOpen ? 600 : 400,
                transition: 'background 100ms ease, color 100ms ease',
              }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>

        {/* 320px collapsible flyout */}
        <div style={{
          width: panelOpen ? 320 : 0,
          overflow: 'hidden',
          transition: 'width 200ms ease',
          borderRight: panelOpen ? `1px solid ${t.border}` : 'none',
          background: t.card,
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Collapse/expand arrow */}
          <button onClick={() => setPanelOpen(o => !o)} style={{
            position: 'absolute', right: -13, top: '50%',
            transform: 'translateY(-50%)',
            width: 26, height: 52,
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: '0 8px 8px 0', cursor: 'pointer',
            zIndex: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: t.textMuted, fontSize: 14,
          }}>
            {panelOpen ? '‹' : '›'}
          </button>

          {/* Tool content — rendered only when flyout is open */}
          {panelOpen && (
          <div key={activeLeftTool} style={{ flex: 1, overflowY: 'auto', padding: 14, minWidth: 320, animation: 'panel-in 160ms ease forwards' }}>

            {/* TEMPLATES / DESIGN */}
            {(activeLeftTool === 'background' || activeLeftTool === 'templates') && (
              <div>
                {/* Search templates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}`, marginBottom: 16 }}>
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🔍</span>
                  <input placeholder="Search templates" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🎤</span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Background Color</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {/* Transparent background tile */}
                    <button onClick={() => { pushHistory(); patchPage({ bgType: 'transparent', bgColor: 'transparent' }); }}
                      title="No background (transparent)"
                      style={{ width: 28, height: 28, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                        background: 'repeating-conic-gradient(#888 0% 25%, #fff 0% 50%) 0 0 / 10px 10px',
                        border: bgType === 'transparent' ? `3px solid ${t.primary}` : `2px solid ${t.border}` }} />
                    {COLOR_PALETTE.map(hex => (
                      <button key={hex} onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgColor: hex }); pickColor(hex, () => {}); }}
                        style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: bgType === 'color' && bgColor === hex ? `3px solid ${t.primary}` : `2px solid ${t.border}`, cursor: 'pointer' }} />
                    ))}
                    <input type="color" value={bgColor}
                      onChange={e => { patchPage({ bgType: 'color', bgColor: e.target.value }); }}
                      onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} title="Custom color" />
                  </div>
                  {recentColors.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Recent</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {recentColors.map(c => (
                          <button key={c} onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgColor: c }); }}
                            style={{ width: 22, height: 22, borderRadius: 4, background: c, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* ── Gradient section ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Gradient</div>
                  {/* Preset swatches */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                    {GRADIENT_PRESETS.map(g => {
                      const isActive = bgType === 'gradient' && bgGradient?.c1 === g.c1 && bgGradient?.c2 === g.c2;
                      return (
                        <button key={g.label} title={g.label}
                          onClick={() => { pushHistory(); patchPage({ bgType: 'gradient', bgGradient: { c1: g.c1, c2: g.c2, angle: g.angle } }); }}
                          style={{ height: 36, borderRadius: 7, border: `2px solid ${isActive ? '#00C4CC' : t.border}`, background: `linear-gradient(${g.angle}deg, ${g.c1}, ${g.c2})`, cursor: 'pointer', padding: 0 }} />
                      );
                    })}
                  </div>
                  {/* Custom gradient editor */}
                  {bgType === 'gradient' && bgGradient && (
                    <div style={{ background: t.input, borderRadius: 9, padding: '10px 10px 8px' }}>
                      {/* Preview bar */}
                      <div style={{ height: 14, borderRadius: 5, marginBottom: 10,
                        background: bgGradient.type === 'radial'
                          ? `radial-gradient(circle, ${bgGradient.c1}, ${bgGradient.c2})`
                          : `linear-gradient(${bgGradient.angle}deg, ${bgGradient.c1}, ${bgGradient.c2})` }} />
                      {/* Linear / Radial toggle */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, background: t.card, borderRadius: 7, padding: 3 }}>
                        {['linear','radial'].map(type => (
                          <button key={type} onClick={() => { pushHistory(); patchPage({ bgGradient: { ...bgGradient, type } }); }}
                            style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 500, borderRadius: 5, border: 'none',
                              background: (bgGradient.type || 'linear') === type ? t.primaryBg : 'transparent',
                              color: (bgGradient.type || 'linear') === type ? t.primary : t.textMuted, cursor: 'pointer', textTransform: 'capitalize' }}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {/* Color stops */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Color 1</div>
                          <input type="color" value={bgGradient.c1}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, c1: e.target.value } })}
                            onBlur={() => pushHistory()}
                            style={{ width: '100%', height: 30, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>Color 2</div>
                          <input type="color" value={bgGradient.c2}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, c2: e.target.value } })}
                            onBlur={() => pushHistory()}
                            style={{ width: '100%', height: 30, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
                        </div>
                        <button title="Swap colors"
                          onClick={() => { pushHistory(); patchPage({ bgGradient: { ...bgGradient, c1: bgGradient.c2, c2: bgGradient.c1 } }); }}
                          style={{ width: 28, height: 28, marginTop: 14, borderRadius: 6, border: `1px solid ${t.border}`, background: t.card, color: t.text, cursor: 'pointer', flexShrink: 0, fontSize: 14 }}>
                          ⇄
                        </button>
                      </div>
                      {/* Angle (linear only) */}
                      {(bgGradient.type || 'linear') === 'linear' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: t.textMuted, whiteSpace: 'nowrap' }}>Angle</span>
                          <input type="range" min={0} max={360} step={15} value={bgGradient.angle ?? 135}
                            onChange={e => patchPage({ bgGradient: { ...bgGradient, angle: parseInt(e.target.value) } })}
                            onMouseUp={() => pushHistory()}
                            style={{ flex: 1, accentColor: '#00C4CC' }} />
                          <span style={{ fontSize: 10, color: t.textMuted, width: 28, textAlign: 'right' }}>{bgGradient.angle ?? 135}°</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Quick angle presets when no gradient active */}
                  {bgType !== 'gradient' && (
                    <button onClick={() => { pushHistory(); patchPage({ bgType: 'gradient', bgGradient: GRADIENT_PRESETS[0] }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      + Custom gradient
                    </button>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Photo Background</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: t.input, borderRadius: 7, padding: 3 }}>
                    {['stock', 'mine'].map(tab => (
                      <button key={tab} onClick={() => setBgTab(tab)}
                        style={{ flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: bgTab === tab ? t.card : 'transparent', color: bgTab === tab ? t.text : t.textMuted, cursor: 'pointer' }}>
                        {tab === 'stock' ? 'Stock' : 'My Media'}
                      </button>
                    ))}
                  </div>
                  {bgPhotosLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ borderRadius: 7, aspectRatio: '1', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ) : displayedBgPhotos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>
                      {bgTab === 'mine' ? 'No uploaded images yet' : 'No stock photos available'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {displayedBgPhotos.map(photo => (
                        <div key={photo.id} onClick={() => selectBgPhoto(photo)}
                          style={{ borderRadius: 7, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${bgImageUrl === photo.url ? t.primary : t.border}`, transition: 'border-color 120ms' }}>
                          <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TEXT */}
            {activeLeftTool === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Search bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.textMuted, fontSize: 13, flexShrink: 0 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search fonts and combinations"
                    value={fontSearch}
                    onChange={e => setFontSearch(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }}
                  />
                </div>

                {/* Add a text box — Canva purple CTA */}
                <button onMouseDown={e => { e.preventDefault(); addText(); }}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: t.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>T</span> Add a text box
                </button>

                {/* Magic Write */}
                <button style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  ✨ Magic Write
                </button>

                {/* Default text styles */}
                {!fontSearch && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8, letterSpacing: '0.02em' }}>Default text styles</div>
                    <button onMouseDown={e => { e.preventDefault(); addText({ fontSize: 48, fontStyle: 'bold', text: 'Add a heading' }); }}
                      style={{ width: '100%', padding: '14px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 26, fontWeight: 700, textAlign: 'left', cursor: 'pointer', marginBottom: 6, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Add a heading
                    </button>
                    <button onMouseDown={e => { e.preventDefault(); addText({ fontSize: 32, fontStyle: 'bold', text: 'Add a subheading' }); }}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 17, fontWeight: 600, textAlign: 'left', cursor: 'pointer', marginBottom: 6, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Add a subheading
                    </button>
                    <button onMouseDown={e => { e.preventDefault(); addText({ fontSize: 16, fontStyle: 'normal', text: 'Add a little bit of body text' }); }}
                      style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontWeight: 400, textAlign: 'left', cursor: 'pointer', marginBottom: 6, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      Add a little bit of body text
                    </button>
                  </div>
                )}

                {/* Brand Kit */}
                {!fontSearch && (
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>Brand Kit</span>
                      <button style={{ background: 'none', border: 'none', color: t.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>Edit 👑</button>
                    </div>
                    <button style={{ width: '100%', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.text, fontSize: 13, cursor: 'pointer' }}>
                      + Add your brand fonts
                    </button>
                  </div>
                )}

                {/* Scrollable font list */}
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Fonts</div>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
                  {FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(f => {
                    const isActive = selectedEl?.type === 'text' && (selectedEl.fontFamily || 'Inter') === f;
                    return (
                      <button key={f} onMouseDown={e => { e.preventDefault(); if (selectedEl?.type === 'text') handleElementChange({ ...selectedEl, fontFamily: f }); }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${isActive ? '#00C4CC' : 'transparent'}`, background: isActive ? 'rgba(0,196,204,0.08)' : 'transparent', color: t.text, fontSize: 15, fontFamily: f, textAlign: 'left', cursor: 'pointer', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {f}
                      </button>
                    );
                  })}
                  {FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 12, padding: '20px 0' }}>No fonts match "{fontSearch}"</div>
                  )}
                </div>

                {/* Properties — only when a text element is selected */}
                {selectedEl?.type === 'text' && (
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                    {/* Size + B/I/Align row */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                      <input type="number" min={8} max={400} value={selectedEl.fontSize || 36}
                        onChange={e => handleElementChange({ ...selectedEl, fontSize: Math.max(8, Math.min(400, parseInt(e.target.value) || 36)) })}
                        onBlur={() => pushHistory()}
                        style={{ width: 56, padding: '6px 8px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, textAlign: 'center' }} />
                      {[{ label: 'B', style: 'bold' }, { label: 'I', style: 'italic' }].map(({ label, style }) => {
                        const active = (selectedEl.fontStyle || '').includes(style);
                        return (
                          <button key={style} onMouseDown={e => { e.preventDefault(); const cur = selectedEl.fontStyle || 'normal'; const next = active ? cur.replace(style, '').trim() || 'normal' : (cur === 'normal' ? style : `${cur} ${style}`); handleElementChange({ ...selectedEl, fontStyle: next }); }}
                            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${active ? '#00C4CC' : t.border}`, background: active ? 'rgba(0,196,204,0.1)' : t.input, color: active ? '#00C4CC' : t.text, fontWeight: style === 'bold' ? 700 : 400, fontStyle: style === 'italic' ? 'italic' : 'normal', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
                            {label}
                          </button>
                        );
                      })}
                      {[['left', '≡'], ['center', '☰'], ['right', '≡']].map(([align, icon], i) => (
                        <button key={align} onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, align }); }}
                          style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${(selectedEl.align || 'left') === align ? '#00C4CC' : t.border}`, background: (selectedEl.align || 'left') === align ? 'rgba(0,196,204,0.1)' : t.input, color: (selectedEl.align || 'left') === align ? '#00C4CC' : t.text, cursor: 'pointer', fontSize: 12, flexShrink: 0, transform: i === 2 ? 'scaleX(-1)' : 'none' }}>
                          {icon}
                        </button>
                      ))}
                    </div>
                    {/* Color row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fill: hex }); pickColor(hex, () => {}); }}
                          style={{ width: 22, height: 22, borderRadius: 5, background: hex, border: selectedEl.fill === hex ? `2px solid #00C4CC` : `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
                      ))}
                      <input type="color" value={selectedEl.fill || '#ffffff'}
                        onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                        onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, flexShrink: 0 }} />
                    </div>
                    {/* Line height & letter spacing */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Line height</span>
                      <input type="range" min={0.8} max={3} step={0.05} value={selectedEl.lineHeight ?? 1.2}
                        onChange={e => updateElement({ ...selectedEl, lineHeight: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{(selectedEl.lineHeight ?? 1.2).toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Spacing</span>
                      <input type="range" min={-5} max={30} step={0.5} value={selectedEl.letterSpacing ?? 0}
                        onChange={e => updateElement({ ...selectedEl, letterSpacing: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{(selectedEl.letterSpacing ?? 0).toFixed(1)}</span>
                    </div>
                    {/* Opacity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', width: 70 }}>Opacity</span>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                        onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* UPLOADS */}
            {(activeLeftTool === 'images' || activeLeftTool === 'uploads') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🔍</span>
                  <input placeholder="Search keywords, tags, color" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                {/* Upload + three-dot */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files[0]; if (f) { const url = URL.createObjectURL(f); addImageElement(url); } }} />
                    ↑ Upload files
                  </label>
                  <button style={{ width: 38, background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', color: t.text, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
                </div>
                {/* Record yourself */}
                <button style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  🎥 Record yourself
                </button>
                {/* Add from URL */}
                {!showImgUrlInput ? (
                  <button onClick={() => setShowImgUrlInput(true)}
                    style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    🔗 Add from URL
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      autoFocus
                      placeholder="Paste image URL (https://...)"
                      value={imgUrlValue}
                      onChange={e => setImgUrlValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && imgUrlValue.trim()) {
                          addImageElement(imgUrlValue.trim());
                          setImgUrlValue('');
                          setShowImgUrlInput(false);
                        }
                        if (e.key === 'Escape') { setShowImgUrlInput(false); setImgUrlValue(''); }
                      }}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.primary}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { if (imgUrlValue.trim()) { addImageElement(imgUrlValue.trim()); setImgUrlValue(''); setShowImgUrlInput(false); } }}
                        disabled={!imgUrlValue.trim()}
                        style={{ flex: 1, background: imgUrlValue.trim() ? t.primary : t.border, color: imgUrlValue.trim() ? '#fff' : t.textMuted, border: 'none', borderRadius: 8, padding: '9px', fontWeight: 600, fontSize: 13, cursor: imgUrlValue.trim() ? 'pointer' : 'default' }}>
                        Add
                      </button>
                      <button onClick={() => { setShowImgUrlInput(false); setImgUrlValue(''); }}
                        style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px', color: t.text, fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 4 }}>
                  {['Images', 'Videos', 'Designs', 'Folders'].map(tab => (
                    <button key={tab} onClick={() => setUploadMediaTab(tab)}
                      style={{ paddingBottom: 8, paddingTop: 4, paddingLeft: 6, paddingRight: 6, border: 'none', borderBottom: `2px solid ${uploadMediaTab === tab ? t.primary : 'transparent'}`, background: 'transparent', color: uploadMediaTab === tab ? t.primary : t.textMuted, fontSize: 12, fontWeight: uploadMediaTab === tab ? 600 : 400, cursor: 'pointer', transition: 'all 150ms' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                {/* Background Remover promo */}
                {!bgRemoverDismissed && (
                  <div style={{ background: t.input, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🎨</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Background Remover</div>
                      <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Remove image backgrounds instantly</div>
                    </div>
                    <button onClick={() => setBgRemoverDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                )}
                {/* Media grid */}
                {bgPhotosLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} style={{ borderRadius: 6, aspectRatio: '1', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                    ))}
                  </div>
                ) : displayedImgPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, padding: '30px 0', fontSize: 12 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>☁</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No media yet</div>
                    <div>Upload files to get started</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                    {displayedImgPhotos.map(photo => (
                      <div key={photo.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('text/plain', photo.url)}
                        onMouseEnter={() => setHoveredPhotoId(photo.id)}
                        onMouseLeave={() => setHoveredPhotoId(null)}
                        style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${t.border}`, position: 'relative', cursor: 'grab', aspectRatio: '1' }}>
                        <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                        {hoveredPhotoId === photo.id && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 }}>
                            <button onClick={() => selectBgPhoto(photo)}
                              style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                              Set BG
                            </button>
                            <button onClick={() => addImageElement(photo.url)}
                              style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 4, border: 'none', background: t.primary, color: '#fff', cursor: 'pointer' }}>
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ELEMENTS */}
            {(activeLeftTool === 'shapes' || activeLeftTool === 'elements') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* AI search bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.primary, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>+</span>
                  <input placeholder="Describe your ideal element" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                  <span style={{ color: t.textMuted, fontSize: 13, flexShrink: 0 }}>🎤</span>
                </div>
                {/* Generate + Search buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, background: 'transparent', color: t.primary, border: `1.5px solid ${t.primary}`, borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    ✦ Generate <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
                  </button>
                  <button style={{ flex: 1, background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Search
                  </button>
                </div>
                {/* Browse categories */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Browse categories</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { icon: '▭', label: 'Shapes',     bg: '#FFF0E0', fn: () => addRect() },
                    { icon: '✦', label: 'Graphics',   bg: '#F0E8FF', fn: () => {} },
                    { icon: '▶', label: 'Animations', bg: '#E0F8FF', fn: () => {} },
                    { icon: '⬜', label: 'Frames',    bg: '#FFF0F0', fn: () => addRect({ fill: 'transparent', stroke: '#888', strokeWidth: 3 }) },
                    { icon: '⊞', label: 'Grids',     bg: '#F0FFE8', fn: () => { for(let r=0;r<2;r++) for(let c=0;c<2;c++) addRect({ x: canvasSize.w/2 - 220 + c*115, y: canvasSize.h/2 - 120 + r*115, width: 110, height: 110 }); } },
                    { icon: '📊', label: 'Charts',   bg: '#E8F4FF', fn: () => {} },
                  ].map(c => (
                    <button key={c.label} onMouseDown={e => { e.preventDefault(); c.fn(); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', border: `1px solid ${t.border}`, borderRadius: 10, background: t.input, cursor: 'pointer', color: t.text }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{c.icon}</div>
                      <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}</span>
                    </button>
                  ))}
                </div>
                {/* Quick add shapes */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginTop: 4 }}>Quick add</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {[
                    { label: 'Rectangle', icon: '▭', fn: () => addRect() },
                    { label: 'Circle',    icon: '●', fn: () => addCircle() },
                    { label: 'Triangle',  icon: '▲', fn: () => addTriangle() },
                    { label: 'Star',      icon: '★', fn: () => addStar() },
                    { label: 'Arrow',     icon: '→', fn: () => addArrow() },
                    { label: 'Line',      icon: '╱', fn: () => addLine() },
                    { label: 'Rounded',   icon: '▢', fn: () => addRect({ cornerRadius: 20 }) },
                    { label: 'Diamond',   icon: '◆', fn: () => addTriangle({ sides: 4, rotation: 45 }) },
                  ].map(({ label, icon, fn }) => (
                    <button key={label} onMouseDown={e => { e.preventDefault(); fn(); }}
                      style={{ padding: '12px 0 8px', borderRadius: 9, border: `1px solid ${t.border}`, background: t.input, color: t.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                    </button>
                  ))}
                </div>
                {/* Shape properties when selected */}
                {selectedEl && selectedEl.type !== 'text' && selectedEl.type !== 'image' && (
                  <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Fill</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onMouseDown={e => { e.preventDefault(); handleElementChange({ ...selectedEl, fill: hex }); pickColor(hex, () => {}); }}
                          style={{ width: 22, height: 22, borderRadius: 5, background: hex, border: selectedEl.fill === hex ? `2px solid #00C4CC` : `1px solid ${t.border}`, cursor: 'pointer', flexShrink: 0 }} />
                      ))}
                      <input type="color" value={selectedEl.fill || '#ffffff'}
                        onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                        onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1, flexShrink: 0 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>Opacity</span>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity !== undefined ? selectedEl.opacity : 1}
                        onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ flex: 1, accentColor: '#00C4CC' }} />
                      <span style={{ fontSize: 11, color: t.textMuted, width: 28, textAlign: 'right' }}>{Math.round((selectedEl.opacity !== undefined ? selectedEl.opacity : 1) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FILTERS */}
            {activeLeftTool === 'filters' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Filter Presets</div>
                {bgType !== 'image' && <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background first</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.keys(FILTER_PRESETS).map(key => (
                    <button key={key} onClick={() => applyFilterPreset(key)}
                      style={{ padding: '8px 0', borderRadius: 7, border: `1px solid ${bgFilter === key ? t.primary : t.border}`, background: bgFilter === key ? t.primaryBg : t.input, color: bgFilter === key ? t.primary : t.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ADJUST */}
            {activeLeftTool === 'adjust' && (
              <div>
                {bgType !== 'image' && <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background to adjust</div>}
                {[
                  { label: 'Brightness', value: bgBrightness, min: -1,   max: 1,   step: 0.05, key: 'bgBrightness' },
                  { label: 'Contrast',   value: bgContrast,   min: -100, max: 100, step: 5,    key: 'bgContrast'   },
                  { label: 'Saturation', value: bgSaturation, min: -1,   max: 1,   step: 0.05, key: 'bgSaturation' },
                ].map(({ label, value, min, max, step, key }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{value}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={value}
                      onChange={e => patchPage({ [key]: parseFloat(e.target.value) })}
                      onMouseUp={() => { patchPage({ bgFilter: 'normal' }); pushHistory(); }}
                      style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
            )}

            {/* BRAND */}
            {activeLeftTool === 'brand' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🔍</span>
                  <input placeholder="Search your brand assets" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                {[
                  { icon: '◎', label: 'All assets'       },
                  { icon: '📋', label: 'Guidelines'       },
                  { icon: '⊞', label: 'Brand Templates', badge: 'New' },
                  { icon: '🏷', label: 'Logos'            },
                  { icon: '🎨', label: 'Colors'           },
                ].map(item => (
                  <button key={item.label}
                    style={{ width: '100%', padding: '11px 12px', border: 'none', borderBottom: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && <span style={{ fontSize: 10, background: t.primaryBg, color: t.primary, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{item.badge}</span>}
                  </button>
                ))}
                <div style={{ background: t.input, borderRadius: 12, padding: 18, textAlign: 'center', marginTop: 8, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>✦</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8, lineHeight: 1.5 }}>Apply your brand colors, fonts, logo, and much more effortlessly</div>
                  <button style={{ width: '100%', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                    👑 Try Business for 30 days
                  </button>
                  <button style={{ width: '100%', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px', color: t.text, fontSize: 13, cursor: 'pointer' }}>
                    + Start with 3 free colors
                  </button>
                </div>
              </div>
            )}

            {/* LAYERS */}
            {activeLeftTool === 'layers' && (() => {
              // Reversed so top of list = visually front element
              const layerEls = [...elements].reverse();
              const typeIcon = type => type === 'text' ? 'T' : type === 'image' ? '🖼' : type === 'group' ? '⊞' : '▭';
              const typeName = (el, i) => {
                if (el.text) return el.text.slice(0, 22) + (el.text.length > 22 ? '…' : '');
                return el.type === 'image' ? `Image ${i + 1}` : el.type === 'group' ? `Group ${i + 1}` : `Shape ${i + 1}`;
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                      Page {activePage + 1} — {elements.length} element{elements.length !== 1 ? 's' : ''}
                    </span>
                    {selectedId && (
                      <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', fontSize: 11, color: t.textMuted, cursor: 'pointer' }}>Deselect</button>
                    )}
                  </div>
                  {layerEls.length === 0 && (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '28px 0', fontSize: 12 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>▥</div>
                      No elements on this page yet
                    </div>
                  )}
                  {layerEls.map((el, i) => {
                    const isSelected = selectedId === el.id || selectedIds.includes(el.id);
                    const isHidden = hiddenIds.has(el.id);
                    const isLocked = lockedIds.has(el.id);
                    return (
                      <div key={el.id}
                        draggable
                        onDragStart={() => setLayerDragId(el.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (!layerDragId || layerDragId === el.id) return;
                          pushHistory();
                          patchElements(prev => {
                            const from = prev.findIndex(e => e.id === layerDragId);
                            const toEl = prev.findIndex(e => e.id === el.id);
                            if (from < 0 || toEl < 0) return prev;
                            const arr = [...prev];
                            const [moved] = arr.splice(from, 1);
                            arr.splice(toEl, 0, moved);
                            return arr;
                          });
                          setLayerDragId(null);
                        }}
                        onDragEnd={() => setLayerDragId(null)}
                        onClick={() => { setSelectedId(el.id); setSelectedIds([el.id]); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 8px', borderRadius: 7,
                          background: isSelected ? t.primaryBg : layerDragId === el.id ? t.input : 'transparent',
                          border: `1px solid ${isSelected ? '#00C4CC' : 'transparent'}`,
                          cursor: 'grab', opacity: isHidden ? 0.4 : 1,
                          transition: 'background 80ms, border-color 80ms',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.input; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0, color: isSelected ? '#00C4CC' : t.textMuted }}>
                          {typeIcon(el.type)}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: isSelected ? t.text : t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {typeName(el, layerEls.length - 1 - i)}
                        </span>
                        <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }}
                          title={isHidden ? 'Show element' : 'Hide element'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHidden ? t.textMuted : t.text, fontSize: 13, padding: '0 2px', flexShrink: 0, opacity: isHidden ? 0.5 : 0.75 }}>
                          {isHidden ? '🙈' : '👁'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); toggleLocked(el.id); }}
                          title={isLocked ? 'Unlock element' : 'Lock element'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLocked ? '#FFB800' : t.textMuted, fontSize: 12, padding: '0 2px', flexShrink: 0 }}>
                          {isLocked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    );
                  })}
                  {elements.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 0', borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textMuted, textAlign: 'center' }}>
                      Drag rows to reorder · Click to select
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TOOLS / DRAW */}
            {activeLeftTool === 'tools' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Draw</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { icon: '↖', label: 'Select',     active: true  },
                    { icon: '✏', label: 'Pen'                       },
                    { icon: '◌', label: 'Highlighter'               },
                    { icon: 'T', label: 'Text'                      },
                    { icon: '─', label: 'Line'                      },
                    { icon: '▭', label: 'Rectangle'                 },
                    { icon: '⬜', label: 'Frame'                    },
                    { icon: '⊞', label: 'Grid'                     },
                    { icon: '⌫', label: 'Eraser'                   },
                  ].map(tool => (
                    <button key={tool.label}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 4px', border: `1.5px solid ${tool.active ? t.primary : t.border}`, borderRadius: 10, background: tool.active ? t.primaryBg : t.input, cursor: 'pointer', color: tool.active ? t.primary : t.text }}
                      onMouseEnter={e => { if (!tool.active) { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.background = t.primaryBg; } }}
                      onMouseLeave={e => { if (!tool.active) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.input; } }}>
                      <span style={{ fontSize: 22 }}>{tool.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: tool.active ? 600 : 400 }}>{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PROJECTS */}
            {activeLeftTool === 'projects' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🔍</span>
                  <input placeholder="Search your content" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                <button style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>📁</span> Your projects</span>
                  <span style={{ color: t.textMuted }}>▾</span>
                </button>
                <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, gap: 4 }}>
                  {['All', 'Designs', 'Folders'].map(tab => (
                    <button key={tab} onClick={() => setProjectTab(tab)}
                      style={{ paddingBottom: 8, paddingTop: 4, paddingLeft: 8, paddingRight: 8, border: 'none', borderBottom: `2px solid ${projectTab === tab ? t.primary : 'transparent'}`, background: 'transparent', color: projectTab === tab ? t.primary : t.textMuted, fontSize: 13, fontWeight: projectTab === tab ? 600 : 400, cursor: 'pointer' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                {savedDesignsLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i}>
                        <div style={{ aspectRatio: '4/5', borderRadius: 8, background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: `shimmer 1.4s ${i * 0.15}s ease-in-out infinite`, marginBottom: 6 }} />
                        <div style={{ height: 12, borderRadius: 4, width: '70%', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s ease-in-out infinite', marginBottom: 4 }} />
                        <div style={{ height: 10, borderRadius: 4, width: '50%', background: `linear-gradient(90deg, ${t.input} 25%, ${t.border} 50%, ${t.input} 75%)`, backgroundSize: '1000px 100%', animation: 'shimmer 1.4s 0.1s ease-in-out infinite' }} />
                      </div>
                    ))}
                  </div>
                ) : savedDesigns.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, padding: '24px 0', fontSize: 12 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No designs yet</div>
                    <div>Saved designs will appear here</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Designs</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {savedDesigns.map(d => (
                        <div key={d.id}
                          onClick={() => { if (typeof window !== 'undefined') window.location.href = `/templates/editor?id=${d.id}`; }}
                          onMouseEnter={e => {
                            const r = e.currentTarget.getBoundingClientRect();
                            const pagesCount = Array.isArray(d.pages_json) ? d.pages_json.length : 1;
                            setHoveredDesign({ id: d.id, title: d.title || 'Untitled', pagesCount, x: r.right + 10, y: r.top });
                          }}
                          onMouseLeave={() => setHoveredDesign(null)}
                          style={{ cursor: 'pointer' }}>
                          <div style={{ aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${hoveredDesign?.id === d.id ? '#00C4CC' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: t.textMuted, marginBottom: 5, transition: 'border-color 120ms' }}>
                            {d.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{d.title || 'Untitled'}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{canvasSize.w}×{canvasSize.h}px</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* APPS */}
            {activeLeftTool === 'apps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.input, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}` }}>
                  <span style={{ color: t.textMuted, fontSize: 13 }}>🔍</span>
                  <input placeholder="Search apps" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13 }} />
                </div>
                {[
                  { icon: '🗄', label: 'Google Drive',   sub: 'Import from Drive'         },
                  { icon: '▶', label: 'YouTube',         sub: 'Add YouTube videos'         },
                  { icon: '📸', label: 'Instagram',      sub: 'Import Instagram photos'    },
                  { icon: '🎵', label: 'Soundcloud',     sub: 'Add background music'       },
                ].map(app => (
                  <button key={app.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: 10, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = t.input}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{app.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{app.label}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{app.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* MAGIC MEDIA */}
            {activeLeftTool === 'magic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: t.primary }}>✦</span> Magic Media
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
                  Turn your text into stunning images and videos with AI
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.input, borderRadius: 8, padding: '10px 12px', border: `1px solid ${t.border}` }}>
                  <textarea placeholder="Describe an image or video…" rows={3}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🖼 Image
                  </button>
                  <button style={{ flex: 1, background: t.input, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🎬 Video
                  </button>
                </div>
                <button style={{ background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ✦ Generate
                </button>
              </div>
            )}

          </div>
          )}
        </div>

        {/* ── Canvas area — multi-page vertical scroll ── */}
        <style>{`
          @keyframes ftb-in {
            from { opacity:0; transform:translateX(-50%) translateY(6px) scale(0.94); }
            to   { opacity:1; transform:translateX(-50%) translateY(0)   scale(1);    }
          }
          @keyframes panel-in {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0);   }
          }
          @keyframes save-check {
            from { opacity:0; transform:scale(0.7); }
            50%  { opacity:1; transform:scale(1.1); }
            to   { opacity:1; transform:scale(1);   }
          }
          @keyframes spin { to { transform:rotate(360deg); } }
          @keyframes shimmer {
            0%   { background-position:-500px 0; }
            100% { background-position: 500px 0; }
          }
          @keyframes preview-fade {
            from { opacity:0; transform:scale(0.97); }
            to   { opacity:1; transform:scale(1);    }
          }
        `}</style>
        <div ref={containerRef}
          onWheel={e => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setZoomFactor(z => Math.max(0.1, Math.min(3, parseFloat((z + delta).toFixed(2)))));
            }
          }}
          style={{ flex: 1, overflowY: 'auto', background: t.bg, padding: '24px 0', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {pages.map((page, pageIdx) => {
              const isActive = pageIdx === activePage;
              const pageElements = page.elements;
              const pageBgType = page.bgType;
              const pageBgColor = page.bgColor;
              const pageBgImageUrl = page.bgImageUrl;
              const pageBgFilter = page.bgFilter;
              const pageBgBrightness = page.bgBrightness;
              const pageBgContrast = page.bgContrast;
              const pageBgSaturation = page.bgSaturation;
              const pageLockedIds = new Set(page.lockedIds);
              const pageHiddenIds = new Set(page.hiddenIds);
              return (
                <div key={page.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {/* ── Page label row ── */}
                  <div style={{ width: showRulers && isActive ? stageDisplayW + 20 : stageDisplayW, display: 'flex', alignItems: 'center', gap: 6, padding: `0 2px 0 ${showRulers && isActive ? 22 : 2}px` }}>
                    <span
                      onClick={() => { setActivePage(pageIdx); setSelectedId(null); }}
                      style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#00C4CC' : t.textMuted, cursor: 'pointer', minWidth: 52, userSelect: 'none' }}
                    >
                      Page {pageIdx + 1}
                    </span>
                    <span style={{ color: t.border, fontSize: 12 }}>–</span>
                    <input
                      value={page.title || ''}
                      onChange={e => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, title: e.target.value } : p))}
                      placeholder="Add title"
                      onClick={() => { setActivePage(pageIdx); setSelectedId(null); }}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: isActive ? t.text : t.textMuted, fontSize: 12, minWidth: 0 }}
                    />
                    {/* Controls */}
                    {[
                      { title: 'Move up',    icon: '▲', action: () => movePageUp(pageIdx),   disabled: pageIdx === 0 },
                      { title: 'Move down',  icon: '▼', action: () => movePageDown(pageIdx), disabled: pageIdx === pages.length - 1 },
                      { title: page.hidden ? 'Show page' : 'Hide page', icon: page.hidden ? '🙈' : '👁', action: () => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, hidden: !p.hidden } : p)) },
                      { title: page.pageLocked ? 'Unlock page' : 'Lock page', icon: page.pageLocked ? '🔒' : '🔓', action: () => setPages(prev => prev.map((p, i) => i === pageIdx ? { ...p, pageLocked: !p.pageLocked } : p)) },
                      { title: 'Duplicate page', icon: '⧉', action: () => duplicatePage(pageIdx) },
                      { title: 'Delete page',    icon: '🗑', action: () => deletePage(pageIdx), disabled: pages.length <= 1, danger: true },
                      { title: 'Add page after', icon: '+', action: () => {
                          pushHistory();
                          const np = emptyPage();
                          setPages(prev => [...prev.slice(0, pageIdx + 1), np, ...prev.slice(pageIdx + 1)]);
                          setActivePage(pageIdx + 1);
                          setSelectedId(null);
                        }
                      },
                    ].map(({ title, icon, action, disabled, danger }) => (
                      <button
                        key={title}
                        title={title}
                        onClick={e => { e.stopPropagation(); if (!disabled) action(); }}
                        style={{
                          width: 22, height: 22, padding: 0, border: 'none', borderRadius: 4,
                          background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
                          color: disabled ? t.border : danger ? '#ef4444' : t.textMuted,
                          fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: disabled ? 0.4 : 1, flexShrink: 0,
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>

                  {/* Ruler + canvas wrapper */}
                  <div style={{ position: 'relative', paddingLeft: showRulers && isActive ? 20 : 0, paddingTop: showRulers && isActive ? 20 : 0 }}>
                    {showRulers && isActive && (
                      <>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: t.isDark ? '#1a1a24' : '#ebebeb', zIndex: 3, borderRight: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }} />
                        <div onMouseDown={e => { e.preventDefault(); startRulerDrag('h'); }} style={{ position: 'absolute', top: 0, left: 20, zIndex: 3, cursor: 's-resize' }}><RulerH canvasW={canvasSize.w} stageScale={stageScale} isDark={!!t.isDark} /></div>
                        <div onMouseDown={e => { e.preventDefault(); startRulerDrag('v'); }} style={{ position: 'absolute', top: 20, left: 0, zIndex: 3, cursor: 'e-resize' }}><RulerV canvasH={canvasSize.h} stageScale={stageScale} isDark={!!t.isDark} /></div>
                      </>
                    )}
                  <div
                    ref={isActive ? canvasWrapperRef : null}
                    style={{
                      position: 'relative', width: stageDisplayW, height: stageDisplayH, flexShrink: 0,
                      outline: isActive ? '2px solid #00C4CC' : '2px solid transparent',
                      borderRadius: 8, cursor: isActive ? 'default' : 'pointer',
                      opacity: page.hidden ? 0.35 : 1,
                      background: pageBgType === 'transparent'
                        ? 'repeating-conic-gradient(#aaa 0% 25%, #fff 0% 50%) 0 0 / 20px 20px'
                        : undefined,
                    }}
                    onClick={!isActive ? () => { setActivePage(pageIdx); setSelectedId(null); } : undefined}
                    onDragOver={isActive ? e => e.preventDefault() : undefined}
                    onDrop={isActive ? handleCanvasDrop : undefined}
                  >
                    <Stage
                      ref={isActive ? stageRef : null}
                      width={canvasSize.w}
                      height={canvasSize.h}
                      scaleX={stageScale}
                      scaleY={stageScale}
                      style={{ borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.3)', display: 'block', width: stageDisplayW, height: stageDisplayH }}
                      onClick={isActive ? (e => {
                        if (e.target === e.target.getStage()) {
                          clearSelection();
                          setShowShadowPanel(false);
                          setShowOutlinePanel(false);
                          setShowPositionPanel(false);
                        }
                      }) : undefined}
                      onMouseDown={isActive ? (e => {
                        // Only start rubber-band when clicking empty canvas
                        if (e.target !== e.target.getStage()) return;
                        const pos = e.target.getRelativePointerPosition();
                        setSelectionStart(pos);
                        setSelectionRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
                        clearSelection();
                      }) : undefined}
                      onMouseMove={isActive ? (e => {
                        if (!selectionStart) return;
                        const pos = e.target.getStage().getRelativePointerPosition();
                        setSelectionRect({
                          x: Math.min(selectionStart.x, pos.x),
                          y: Math.min(selectionStart.y, pos.y),
                          w: Math.abs(pos.x - selectionStart.x),
                          h: Math.abs(pos.y - selectionStart.y),
                        });
                      }) : undefined}
                      onMouseUp={isActive ? (() => {
                        if (selectionRect && (selectionRect.w > 4 || selectionRect.h > 4)) {
                          const sr = selectionRect;
                          const hit = pageElements.filter(el => {
                            if (pageLockedIds.has(el.id) || pageHiddenIds.has(el.id)) return false;
                            const ex = el.x || 0, ey = el.y || 0;
                            const ew = el.width || 100, eh = el.height || 60;
                            return ex < sr.x + sr.w && ex + ew > sr.x && ey < sr.y + sr.h && ey + eh > sr.y;
                          });
                          if (hit.length > 0) {
                            setSelectedIds(hit.map(e => e.id));
                            setSelectedId(hit[hit.length - 1].id);
                          }
                        }
                        setSelectionStart(null);
                        setSelectionRect(null);
                      }) : undefined}
                      onContextMenu={isActive ? (e => {
                        e.evt.preventDefault();
                        const { clientX, clientY } = e.evt;
                        const isStage = e.target === e.target.getStage();
                        const targetId = isStage ? null : (e.target.id() || null);
                        if (targetId) { setSelectedId(targetId); setSelectedIds([targetId]); }
                        setCtxMenu({ x: clientX, y: clientY, elementId: targetId });
                      }) : undefined}
                    >
                      {/* Layer 1: Background */}
                      <Layer>
                        {pageBgType === 'gradient' && page.bgGradient ? (
                          (() => {
                            const g = page.bgGradient;
                            const isRadial = g.type === 'radial';
                            const cx = canvasSize.w / 2, cy = canvasSize.h / 2;
                            const r = Math.max(canvasSize.w, canvasSize.h) * 0.65;
                            const { startPoint, endPoint } = isRadial ? { startPoint: { x: cx, y: cy }, endPoint: { x: cx, y: cy } } : gradientPoints(g.angle ?? 135, canvasSize.w, canvasSize.h);
                            return (
                              <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h}
                                {...(isRadial ? {
                                  fillRadialGradientStartPoint: startPoint,
                                  fillRadialGradientEndPoint: endPoint,
                                  fillRadialGradientStartRadius: 0,
                                  fillRadialGradientEndRadius: r,
                                  fillRadialGradientColorStops: [0, g.c1, 1, g.c2],
                                } : {
                                  fillLinearGradientStartPoint: startPoint,
                                  fillLinearGradientEndPoint: endPoint,
                                  fillLinearGradientColorStops: [0, g.c1, 1, g.c2],
                                })}
                                onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined}
                              />
                            );
                          })()
                        ) : pageBgType === 'transparent' ? (
                          null
                        ) : pageBgType === 'color' ? (
                          <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill={pageBgColor}
                            onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined} />
                        ) : pageBgImageUrl ? (
                          <BgImage url={pageBgImageUrl} filter={pageBgFilter} brightness={pageBgBrightness} contrast={pageBgContrast} saturation={pageBgSaturation}
                            stageW={canvasSize.w} stageH={canvasSize.h}
                            onClick={isActive ? () => { setSelectedId('__bg__'); setSelectedIds([]); } : undefined}
                            isSelected={isActive && selectedId === '__bg__'} />
                        ) : (
                          <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill="#1a1a22" />
                        )}
                      </Layer>

                      {/* Layer 2: Grid overlay (active page only) */}
                      {isActive && showGrid && (
                        <Layer listening={false}>
                          <Shape
                            perfectDrawEnabled={false}
                            sceneFunc={(ctx) => {
                              const step = 50;
                              ctx.fillStyle = 'rgba(150,150,150,0.4)';
                              for (let x = step; x < canvasSize.w; x += step) {
                                for (let y = step; y < canvasSize.h; y += step) {
                                  ctx.fillRect(x - 1, y - 1, 2, 2);
                                }
                              }
                            }}
                          />
                        </Layer>
                      )}

                      {/* Layer 3: Content */}
                      <Layer>
                        {pageElements.flatMap(el => {
                          const node = el.type === 'group'
                            ? <GroupNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                stageW={canvasSize.w}
                                stageH={canvasSize.h}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />
                          : el.type === 'image'
                            ? <ImageNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />
                            : <ContentNode
                                key={el.id}
                                el={el}
                                isSelected={isActive && (selectedId === el.id || selectedIds.includes(el.id))}
                                onSelect={isActive ? handleSelect : () => {}}
                                onChange={isActive ? handleElementChange : () => {}}
                                stageW={canvasSize.w}
                                stageH={canvasSize.h}
                                onDblClick={isActive ? startEditText : () => {}}
                                onDragMove={isActive ? computeSnap : null}
                                onSnapClear={isActive ? clearSnapGuides : null}
                                locked={pageLockedIds.has(el.id)}
                                hidden={pageHiddenIds.has(el.id)}
                              />;
                          const tint = el.type === 'image' && el.tintColor && (el.tintOpacity || 0) > 0
                            ? <Rect key={`${el.id}_tint`}
                                x={el.x} y={el.y}
                                width={el.width || 200} height={el.height || 200}
                                fill={el.tintColor}
                                opacity={el.tintOpacity || 0}
                                cornerRadius={el.cornerRadius || 0}
                                rotation={el.rotation || 0}
                                listening={false}
                                globalCompositeOperation="source-atop"
                              />
                            : null;
                          return tint ? [node, tint] : [node];
                        })}
                      </Layer>

                      {/* Layer 4: Transformer + snap guides (active page only) */}
                      {isActive && (
                        <Layer ref={trLayerRef}>
                          <TransformerLayer
                            selectedIds={selectedIds.length > 0 ? selectedIds : (selectedId && selectedId !== '__bg__' ? [selectedId] : [])}
                            elements={pageElements}
                            stageRef={stageRef}
                            snapGuides={snapGuides}
                            stageScale={stageScale}
                            canvasW={canvasSize.w}
                            canvasH={canvasSize.h}
                            onLiveBounds={setLiveBounds}
                            onLiveBoundsClear={() => setLiveBounds(null)}
                          />
                        </Layer>
                      )}

                      {/* Layer 5: Rubber-band selection rect */}
                      {isActive && selectionRect && selectionRect.w > 1 && (
                        <Layer listening={false}>
                          <Rect
                            x={selectionRect.x} y={selectionRect.y}
                            width={selectionRect.w} height={selectionRect.h}
                            fill="rgba(0,196,204,0.05)"
                            stroke="#00C4CC"
                            strokeWidth={1 / stageScale}
                            dash={[4 / stageScale, 4 / stageScale]}
                          />
                        </Layer>
                      )}
                    </Stage>

                    {/* Inline text textarea (active page only) */}
                    {isActive && editingTextId && (
                      <textarea
                        autoFocus
                        value={textareaValue}
                        onChange={e => setTextareaValue(e.target.value)}
                        onBlur={commitTextEdit}
                        onKeyDown={e => { if (e.key === 'Escape') commitTextEdit(); }}
                        style={{
                          position: 'absolute',
                          left: textareaPos.x, top: textareaPos.y,
                          width: textareaPos.w,
                          fontSize: textareaPos.fontSize,
                          fontFamily: elements.find(e => e.id === editingTextId)?.fontFamily || 'Inter',
                          color: elements.find(e => e.id === editingTextId)?.fill || '#ffffff',
                          background: 'rgba(0,0,0,0.4)',
                          border: `2px solid ${t.primary}`,
                          borderRadius: 4, padding: 4, outline: 'none', resize: 'none',
                          overflow: 'hidden', zIndex: 100, lineHeight: 1.3, minHeight: 40,
                        }}
                        rows={3}
                      />
                    )}

                    {/* ── Floating object toolbar (Canva-style) — single-select only ── */}
                    {isActive && selectedIds.length <= 1 && selectedId && selectedId !== '__bg__' && !editingTextId && (() => {
                      const el = elements.find(e => e.id === selectedId);
                      if (!el) return null;
                      // Compute element bounds in canvas coords
                      const isCO = ['circle', 'triangle', 'star'].includes(el.type);
                      const r    = el.radius || el.outerRadius || 60;
                      const elX  = isCO ? el.x - r : el.x;
                      const elY  = isCO ? el.y - r : el.y;
                      const elW  = isCO ? r * 2 : (el.width || 200);
                      const elH  = isCO ? r * 2 : (el.type === 'text' ? Math.max(60, (el.fontSize || 36) * 1.4) : (el.height || 100));
                      // Screen coords
                      const cx       = (elX + elW / 2) * stageScale;
                      const nearTop  = elY * stageScale < 58;
                      const toolbarY = nearTop ? (elY + elH) * stageScale + 10 : elY * stageScale - 50;
                      const isLocked = lockedIds.has(selectedId);
                      // Actions
                      const copyEl = () => setClipboard(JSON.parse(JSON.stringify(el)));
                      const dupEl  = () => {
                        const d = { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x + 20, y: el.y + 20 };
                        pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id);
                      };
                      const delEl  = () => { pushHistory(); patchElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); };
                      const BTNS = [
                        { icon: '⧉', title: 'Copy (Ctrl+C)',      fn: copyEl },
                        { icon: '⊞', title: 'Duplicate (Ctrl+D)', fn: dupEl },
                        { sep: true },
                        { icon: '◈', title: 'Copy style (Alt+C)',  fn: copyStyle },
                        ...(styleClipboard ? [{ icon: '◈', title: 'Paste style (Alt+V)', fn: () => pasteStyle(), highlight: true }] : []),
                        { sep: true },
                        { icon: '↑', title: 'Bring forward',       fn: () => bringForward(selectedId) },
                        { icon: '↓', title: 'Send backward',       fn: () => sendBackward(selectedId) },
                        { sep: true },
                        ...(el.type === 'group' ? [{ icon: '⊟', title: 'Ungroup (Ctrl+Shift+G)', fn: ungroupSelected }, { sep: true }] : []),
                        ...(pages.length > 1 ? [{ icon: '⊛', title: 'Add to all pages', fn: () => addElToAllPages(selectedId) }, { sep: true }] : []),
                        { icon: isLocked ? '🔒' : '🔓', title: isLocked ? 'Unlock' : 'Lock', fn: () => toggleLocked(selectedId) },
                        { sep: true },
                        { icon: '🗑', title: 'Delete (Del)', fn: delEl, danger: true },
                      ];
                      return (
                        <div
                          key={selectedId}
                          style={{
                            position: 'absolute', left: cx, top: toolbarY,
                            transform: 'translateX(-50%)',
                            background: '#ffffff',
                            border: '1px solid #e2e2e2',
                            borderRadius: 10,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
                            display: 'flex', alignItems: 'center',
                            padding: '3px 5px', gap: 1,
                            zIndex: 200, whiteSpace: 'nowrap',
                            animation: 'ftb-in 130ms cubic-bezier(0.19,1,0.22,1) forwards',
                          }}
                        >
                          {BTNS.map((b, i) =>
                            b.sep ? (
                              <div key={i} style={{ width: 1, height: 18, background: '#e2e2e2', margin: '0 3px', flexShrink: 0 }} />
                            ) : (
                              <button
                                key={i}
                                onMouseDown={e => { e.stopPropagation(); b.fn(); }}
                                onMouseEnter={e => { const p = parseTipTitle(b.title); showTip(e, p.text, p.shortcut); e.currentTarget.style.background = b.danger ? 'rgba(239,68,68,0.09)' : b.highlight ? 'rgba(0,196,204,0.2)' : '#f0f0f0'; }}
                                onMouseLeave={e => { hideTip(); e.currentTarget.style.background = b.highlight ? 'rgba(0,196,204,0.1)' : 'transparent'; }}
                                style={{
                                  width: 30, height: 30, border: 'none', borderRadius: 6,
                                  background: b.highlight ? 'rgba(0,196,204,0.1)' : 'transparent',
                                  cursor: 'pointer', fontSize: 14,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: b.danger ? '#ef4444' : b.highlight ? '#00C4CC' : '#333',
                                  transition: 'background 80ms',
                                  flexShrink: 0,
                                }}
                              >
                                {b.icon}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Ruler guide lines (click to remove) ── */}
                    {isActive && rulerGuides.h.map((yPx, i) => (
                      <div key={`gh${i}`} onClick={() => setRulerGuides(g => ({ ...g, h: g.h.filter((_, j) => j !== i) }))}
                        style={{ position: 'absolute', left: 0, right: 0, top: Math.round(yPx * stageScale), height: 1, background: 'rgba(0,196,204,0.75)', cursor: 'n-resize', pointerEvents: 'auto', zIndex: 201 }}>
                        <div style={{ position: 'absolute', right: 4, top: -9, fontSize: 9, color: '#00C4CC', opacity: 0.8, userSelect: 'none', whiteSpace: 'nowrap' }}>{Math.round(yPx)}px ×</div>
                      </div>
                    ))}
                    {isActive && rulerGuides.v.map((xPx, i) => (
                      <div key={`gv${i}`} onClick={() => setRulerGuides(g => ({ ...g, v: g.v.filter((_, j) => j !== i) }))}
                        style={{ position: 'absolute', top: 0, bottom: 0, left: Math.round(xPx * stageScale), width: 1, background: 'rgba(0,196,204,0.75)', cursor: 'e-resize', pointerEvents: 'auto', zIndex: 201 }}>
                        <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, color: '#00C4CC', opacity: 0.8, userSelect: 'none', whiteSpace: 'nowrap', transform: 'rotate(-90deg)', transformOrigin: 'bottom left' }}>{Math.round(xPx)}px</div>
                      </div>
                    ))}
                    {/* Dragging guide preview */}
                    {isActive && draggingGuide && draggingGuide.axis === 'h' && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: Math.round(draggingGuide.pos * stageScale), height: 1, background: 'rgba(0,196,204,0.9)', pointerEvents: 'none', zIndex: 202 }} />
                    )}
                    {isActive && draggingGuide && draggingGuide.axis === 'v' && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: Math.round(draggingGuide.pos * stageScale), width: 1, background: 'rgba(0,196,204,0.9)', pointerEvents: 'none', zIndex: 202 }} />
                    )}
                    {/* Live bounds label while dragging / resizing */}
                    {isActive && liveBounds && (
                      <div style={{ position: 'absolute', left: Math.max(2, Math.round((liveBounds.x + liveBounds.w / 2) * stageScale) - 48), top: Math.max(2, Math.round(liveBounds.y * stageScale) - 28), background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none', zIndex: 203, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                        {liveBounds.w > 0 && liveBounds.h > 0 ? `${liveBounds.w} × ${liveBounds.h}` : `${liveBounds.x}, ${liveBounds.y}`}
                      </div>
                    )}
                  </div>
                  </div>{/* close ruler wrapper */}
                </div>
              );
            })}

            {/* Add page button */}
            <button onClick={addPage} style={{ marginTop: 4, padding: '10px 28px', borderRadius: 8, border: `2px dashed ${t.border}`, background: 'none', color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em' }}>
              + Add Page
            </button>
          </div>
        </div>

        {/* ── Pages thumbnail sidebar (toggled from bottom bar) ── */}
        {showPagesPanel && (
          <div style={{ width: 140, borderLeft: `1px solid ${t.border}`, background: t.card, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</span>
              <button onClick={() => setShowPagesPanel(false)}
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pages.map((page, i) => {
                const isAct = i === activePage;
                return (
                  <div key={page.id} style={{ position: 'relative' }}>
                    {/* Page number label */}
                    <div style={{ fontSize: 9, fontWeight: 600, color: isAct ? '#00C4CC' : t.textMuted, textAlign: 'center', marginBottom: 3 }}>{i + 1}</div>
                    {/* Thumbnail tile */}
                    <div onClick={() => { setActivePage(i); setSelectedId(null); setSelectedIds([]); }}
                      style={{ width: '100%', aspectRatio: `${canvasSize.w} / ${canvasSize.h}`, borderRadius: 5, border: `2px solid ${isAct ? '#00C4CC' : t.border}`, background: page.bgType === 'gradient' && page.bgGradient ? `linear-gradient(${page.bgGradient.angle}deg, ${page.bgGradient.c1}, ${page.bgGradient.c2})` : (page.bgColor || '#1a1a22'), cursor: 'pointer', overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}>
                      {/* Tiny color-coded element indicators */}
                      {page.elements.slice(0, 8).map(el => (
                        <div key={el.id} style={{
                          position: 'absolute',
                          left: `${(el.x / canvasSize.w) * 100}%`,
                          top: `${(el.y / canvasSize.h) * 100}%`,
                          width: `${Math.min(((el.width || el.radius * 2 || 60) / canvasSize.w) * 100, 40)}%`,
                          height: `${Math.min(((el.height || el.radius * 2 || 40) / canvasSize.h) * 100, 30)}%`,
                          background: el.fill || el.stroke || 'rgba(255,255,255,0.3)',
                          opacity: el.opacity ?? 1,
                          borderRadius: el.type === 'circle' ? '50%' : 2,
                          pointerEvents: 'none',
                        }} />
                      ))}
                    </div>
                    {/* Delete button (only when >1 page) */}
                    {pages.length > 1 && (
                      <button onClick={e => { e.stopPropagation(); deletePage(i); }}
                        style={{ position: 'absolute', top: 16, right: -4, width: 14, height: 14, background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 8, cursor: 'pointer', lineHeight: '14px', textAlign: 'center', padding: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Add page button */}
              <button onClick={addPage}
                style={{ width: '100%', aspectRatio: `${canvasSize.w} / ${canvasSize.h}`, borderRadius: 5, border: `2px dashed ${t.border}`, background: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +
              </button>
            </div>
          </div>
        )}

        {/* ── Right panel ── */}
        <div style={{ width: 230, borderLeft: `1px solid ${t.border}`, background: t.card, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            {['properties', 'layers'].map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)}
                style={{ flex: 1, padding: '9px 0', border: 'none', background: rightTab === tab ? t.primaryBg : 'transparent', color: rightTab === tab ? t.primary : t.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: rightTab === tab ? `2px solid ${t.primary}` : '2px solid transparent', textTransform: 'capitalize' }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

            {/* PROPERTIES TAB */}
            {rightTab === 'properties' && (
              <>
                {!selectedId && <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', paddingTop: 40 }}>Click an element to edit it</div>}

                {selectedId === '__bg__' && bgType === 'image' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Background</div>
                    <button onClick={() => { pushHistory(); patchPage({ bgType: 'color', bgImageUrl: null, bgSource: null, bgSourceId: null }); }}
                      style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
                      Remove Photo
                    </button>
                  </div>
                )}

                {selectedEl && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12, textTransform: 'capitalize' }}>{selectedEl.type}</div>

                    {selectedEl.type === 'text' && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>CONTENT</label>
                        <textarea value={selectedEl.text} onChange={e => updateElement({ ...selectedEl, text: e.target.value })} onBlur={() => pushHistory()} rows={3}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 2 }}>X</label>
                        <input type="number" value={Math.round(selectedEl.x)}
                          onChange={e => updateElement({ ...selectedEl, x: parseInt(e.target.value) || 0 })} onBlur={() => pushHistory()}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 2 }}>Y</label>
                        <input type="number" value={Math.round(selectedEl.y)}
                          onChange={e => updateElement({ ...selectedEl, y: parseInt(e.target.value) || 0 })} onBlur={() => pushHistory()}
                          style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    {(selectedEl.type === 'rect' || selectedEl.type === 'image' || selectedEl.type === 'arrow') && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 2 }}>W</label>
                          <input type="number" value={Math.round(selectedEl.width || 0)}
                            onChange={e => updateElement({ ...selectedEl, width: parseInt(e.target.value) || 1 })} onBlur={() => pushHistory()}
                            style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 2 }}>H</label>
                          <input type="number" value={Math.round(selectedEl.height || selectedEl.width || 0)}
                            onChange={e => updateElement({ ...selectedEl, height: parseInt(e.target.value) || 1 })} onBlur={() => pushHistory()}
                            style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 2 }}>OPACITY</label>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                        onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                      <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'right' }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</div>
                    </div>

                    <button onClick={() => { pushHistory(); patchElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); }}
                      style={{ width: '100%', padding: '7px 0', marginTop: 4, borderRadius: 7, border: `1px solid rgba(239,68,68,0.3)`, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Delete Element
                    </button>
                  </div>
                )}
              </>
            )}

            {/* LAYERS TAB */}
            {rightTab === 'layers' && (
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>{elements.length} element{elements.length !== 1 ? 's' : ''}</div>
                {elements.length === 0 && (
                  <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', paddingTop: 20 }}>No elements yet</div>
                )}
                {[...elements].reverse().map((el) => {
                  const isActive = selectedId === el.id;
                  const isLocked = lockedIds.has(el.id);
                  const isHidden = hiddenIds.has(el.id);
                  const typeIcon = el.type === 'text' ? 'T' : el.type === 'image' ? '🖼' : el.type === 'circle' ? '●' : el.type === 'triangle' ? '▲' : el.type === 'star' ? '★' : el.type === 'arrow' ? '→' : el.type === 'line' ? '─' : '■';
                  const label = el.type === 'text' ? (el.text || 'Text').slice(0, 18) : el.type.charAt(0).toUpperCase() + el.type.slice(1);
                  return (
                    <div key={el.id}
                      onClick={() => !isLocked && setSelectedId(el.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 6px', borderRadius: 6, background: isActive ? t.primaryBg : 'none', cursor: isLocked ? 'default' : 'pointer', marginBottom: 2, opacity: isHidden ? 0.45 : 1 }}>
                      <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }} title={isHidden ? 'Show' : 'Hide'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: 0, flexShrink: 0 }}>
                        {isHidden ? '👁‍🗨' : '👁'}
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleLocked(el.id); }} title={isLocked ? 'Unlock' : 'Lock'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLocked ? t.primary : t.textMuted, fontSize: 12, padding: 0, flexShrink: 0 }}>
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                      <span style={{ fontSize: 11, flexShrink: 0 }}>{typeIcon}</span>
                      <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? t.primary : t.text }}>{label}</span>
                      <button onClick={e => { e.stopPropagation(); bringForward(el.id); }} title="Move Up"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: '0 2px', flexShrink: 0 }}>↑</button>
                      <button onClick={e => { e.stopPropagation(); sendBackward(el.id); }} title="Move Down"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 13, padding: '0 2px', flexShrink: 0 }}>↓</button>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Video Timeline (slides in when isVideoMode) ── */}
      {(() => {
        const pageDurations = pages.map(p => p.duration || 5);
        const totalDur = pageDurations.reduce((a, b) => a + b, 0);
        const TRACK_H = 36;
        const RULER_H = 24;
        const TIMELINE_W_PX = 600;
        const pxPerSec = TIMELINE_W_PX / Math.max(totalDur, 1);

        const togglePlay = () => {
          if (isPlaying) {
            clearInterval(playIntervalRef.current);
            setIsPlaying(false);
          } else {
            setIsPlaying(true);
            playIntervalRef.current = setInterval(() => {
              setVideoPlayhead(p => {
                if (p >= totalDur) { clearInterval(playIntervalRef.current); setIsPlaying(false); return 0; }
                return p + 0.1;
              });
            }, 100);
          }
        };

        const fmtTime = (s) => {
          const m = Math.floor(s / 60); const sec = (s % 60).toFixed(1);
          return `${m}:${sec.padStart(4, '0')}`;
        };

        return (
          <div style={{
            height: isVideoMode ? 200 : 0, overflow: 'hidden',
            transition: 'height 220ms ease',
            background: t.card, borderTop: `1px solid ${t.border}`,
            flexShrink: 0, display: 'flex', flexDirection: 'column',
          }}>
            {/* Playback controls row */}
            <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <button onClick={() => { setVideoPlayhead(0); setIsPlaying(false); clearInterval(playIntervalRef.current); }}
                style={{ width: 28, height: 26, border: `1px solid ${t.border}`, borderRadius: 5, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏮</button>
              <button onClick={togglePlay}
                style={{ width: 36, height: 30, border: 'none', borderRadius: 6, background: '#00C4CC', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span style={{ fontSize: 12, color: t.textMuted, fontFamily: 'monospace', minWidth: 90 }}>
                {fmtTime(videoPlayhead)} / {fmtTime(totalDur)}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: t.textMuted }}>{pages.length} page{pages.length !== 1 ? 's' : ''} · {totalDur}s</span>
              <button
                onClick={() => {
                  alert('Video export: Each page is exported as a PNG frame.\n\nFull MP4 export is coming soon — for now, use File → Download to export individual pages.');
                }}
                style={{ height: 26, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 5, background: t.input, color: t.text, fontSize: 11, cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                ⬇ Export
              </button>
              <button onClick={() => setIsVideoMode(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            {/* Timeline tracks area */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex' }}>
              {/* Track labels */}
              <div style={{ width: 80, borderRight: `1px solid ${t.border}`, flexShrink: 0, paddingTop: RULER_H }}>
                {['Main', 'Text', 'Audio'].map(label => (
                  <div key={label} style={{ height: TRACK_H, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, fontWeight: 600, color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>{label}</div>
                ))}
              </div>

              {/* Timeline ruler + clip lanes */}
              <div style={{ flex: 1, position: 'relative' }}>
                {/* Time ruler */}
                <div style={{ height: RULER_H, display: 'flex', alignItems: 'flex-end', borderBottom: `1px solid ${t.border}`, paddingBottom: 2, position: 'relative', background: t.card }}>
                  {Array.from({ length: Math.ceil(totalDur) + 1 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: i * pxPerSec, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 1, height: i % 5 === 0 ? 12 : 6, background: t.border }} />
                      {i % 5 === 0 && <span style={{ fontSize: 9, color: t.textMuted, position: 'absolute', bottom: 14, left: 2 }}>{i}s</span>}
                    </div>
                  ))}
                </div>

                {/* Main track — pages as clips (double-click to edit duration) */}
                <div style={{ height: TRACK_H, borderBottom: `1px solid ${t.border}`, position: 'relative', background: t.input }}>
                  {(() => {
                    let offset = 0;
                    return pages.map((page, i) => {
                      const dur = page.duration || 5;
                      const left = offset * pxPerSec;
                      const w = Math.max(dur * pxPerSec - 2, 30);
                      const isActivePage = i === activePage;
                      const isEditingThis = editingClipIdx === i;
                      offset += dur;
                      return (
                        <div key={page.id}
                          onClick={() => { setActivePage(i); setSelectedId(null); }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingClipIdx(i); }}
                          title={`Page ${i + 1} · ${dur}s — dbl-click to set duration`}
                          style={{ position: 'absolute', left, top: 3, width: w, height: TRACK_H - 8, borderRadius: 4, background: isActivePage ? 'rgba(0,196,204,0.35)' : 'rgba(155,79,212,0.3)', border: `1px solid ${isActivePage ? '#00C4CC' : 'rgba(155,79,212,0.5)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden', gap: 4 }}>
                          {isEditingThis ? (
                            <input autoFocus type="number" min={1} max={60} defaultValue={dur}
                              onBlur={e => { const v = Math.max(1, Math.min(60, parseFloat(e.target.value) || dur)); patchPage({ duration: v }); setEditingClipIdx(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingClipIdx(null); }}
                              onClick={e => e.stopPropagation()}
                              style={{ width: 44, fontSize: 10, background: t.card, border: `1px solid #00C4CC`, borderRadius: 3, color: t.text, padding: '1px 3px', outline: 'none' }} />
                          ) : (
                            <>
                              <span style={{ fontSize: 10, fontWeight: 600, color: isActivePage ? '#00C4CC' : t.text, whiteSpace: 'nowrap' }}>P{i + 1}</span>
                              <span style={{ fontSize: 9, color: t.textMuted, whiteSpace: 'nowrap' }}>{dur}s</span>
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Text track — text elements as clips (click to select) */}
                <div style={{ height: TRACK_H, borderBottom: `1px solid ${t.border}`, position: 'relative', background: t.bg }}>
                  {elements.filter(e => e.type === 'text').map(el => {
                    const dur = el.videoDuration || 3;
                    const start = el.videoStart || 0;
                    const isSelEl = selectedId === el.id;
                    return (
                      <div key={el.id} onClick={() => { setSelectedId(el.id); setSelectedIds([el.id]); }}
                        title={el.text || 'Text element'}
                        style={{ position: 'absolute', left: start * pxPerSec, top: 3, width: Math.max(dur * pxPerSec - 2, 4), height: TRACK_H - 8, borderRadius: 4, background: isSelEl ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)', border: `1px solid ${isSelEl ? '#f59e0b' : 'rgba(245,158,11,0.5)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden', gap: 3 }}>
                        <span style={{ fontSize: 9, color: '#f59e0b' }}>T</span>
                        <span style={{ fontSize: 9, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(el.text || '').slice(0, 12)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Audio track (placeholder) */}
                <div style={{ height: TRACK_H, position: 'relative', background: t.bg }} />

                {/* Playhead */}
                <div style={{ position: 'absolute', top: 0, left: videoPlayhead * pxPerSec, width: 2, height: '100%', background: '#00C4CC', pointerEvents: 'none', zIndex: 5 }}>
                  <div style={{ width: 8, height: 8, background: '#00C4CC', borderRadius: '50%', position: 'absolute', top: 0, left: -3 }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bottom status bar (Canva-style) ── */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 12px', borderTop: `1px solid ${t.border}`,
        background: t.card, flexShrink: 0, zIndex: 8, position: 'relative',
        fontSize: 12, color: t.textMuted, userSelect: 'none',
      }}>
        {/* Notes panel */}
        {showNotesPanel && (
          <div style={{ position: 'absolute', bottom: 44, left: 12, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, boxShadow: '0 -4px 20px rgba(0,0,0,0.2)', zIndex: 20 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Page {activePage + 1} notes</span>
              <button onClick={() => setShowNotesPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <textarea
              value={currentPage.notes || ''}
              onChange={e => patchPage({ notes: e.target.value })}
              placeholder="Add notes for this page…"
              style={{ width: '100%', minHeight: 100, padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            {currentPage.notes && (
              <button onClick={() => { patchPage({ notes: '' }); }} style={{ marginTop: 6, background: 'none', border: 'none', color: t.textMuted, fontSize: 11, cursor: 'pointer', padding: 0 }}>Clear notes</button>
            )}
          </div>
        )}
        {/* Notes button */}
        <button onClick={() => setShowNotesPanel(p => !p)}
          style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: showNotesPanel ? t.primaryBg : 'transparent', color: showNotesPanel ? t.primary : (currentPage.notes ? t.text : t.textMuted), fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
          onMouseEnter={e => { if (!showNotesPanel) e.currentTarget.style.background = t.input; }}
          onMouseLeave={e => { if (!showNotesPanel) e.currentTarget.style.background = 'transparent'; }}>
          📝 Notes{currentPage.notes ? ' •' : ''}
        </button>
        {/* Timer */}
        <button style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: t.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = t.input}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          ⏱ Timer
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Fit to screen */}
        <button onClick={() => setZoomFactor(1)}
          onMouseEnter={e => showTip(e, 'Fit to screen', 'Ctrl+0')} onMouseLeave={hideTip}
          style={{ height: 26, padding: '0 8px', border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.textMuted, fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, transition: 'background 100ms' }}
          onMouseEnterCapture={e => e.currentTarget.style.color = t.text}
          onMouseLeaveCapture={e => e.currentTarget.style.color = t.textMuted}>
          ⤢ Fit
        </button>

        {/* Zoom out */}
        <button onClick={zoomOut}
          onMouseEnter={e => showTip(e, 'Zoom out', 'Ctrl+−')} onMouseLeave={hideTip}
          style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 100ms' }}>
          −
        </button>

        {/* Zoom slider */}
        <input type="range" min={25} max={300} step={25}
          value={Math.round(zoomFactor * 100)}
          onChange={e => setZoomFactor(parseInt(e.target.value) / 100)}
          style={{ width: 90, flexShrink: 0, cursor: 'pointer', accentColor: '#00C4CC' }} />

        {/* Zoom in */}
        <button onClick={zoomIn}
          onMouseEnter={e => showTip(e, 'Zoom in', 'Ctrl++')} onMouseLeave={hideTip}
          style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 100ms' }}>
          +
        </button>

        {/* Zoom % pill — click to reset to 100% */}
        <button onClick={() => setZoomFactor(1)}
          onMouseEnter={e => showTip(e, 'Reset zoom', 'Ctrl+0')} onMouseLeave={hideTip}
          style={{ minWidth: 46, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 12, cursor: 'pointer',
            padding: '0 7px', flexShrink: 0, fontWeight: 500, transition: 'background 100ms' }}>
          {Math.round(zoomFactor * 100)}%
        </button>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 4px', flexShrink: 0 }} />

        {/* Pages toggle */}
        <button onClick={() => setShowPagesPanel(o => !o)}
          onMouseEnter={e => showTip(e, 'Pages panel')} onMouseLeave={hideTip}
          style={{ height: 26, padding: '0 10px', border: `1px solid ${showPagesPanel ? '#00C4CC' : t.border}`, borderRadius: 5,
            background: showPagesPanel ? 'rgba(0,196,204,0.1)' : t.input, color: showPagesPanel ? '#00C4CC' : t.text,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'background 100ms' }}>
          Pages
        </button>

        {/* Page counter */}
        <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', flexShrink: 0, minWidth: 32, textAlign: 'center' }}>
          {activePage + 1}/{pages.length}
        </span>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 4px', flexShrink: 0 }} />

        {/* Rulers toggle */}
        <button onClick={() => setShowRulers(o => !o)}
          onMouseEnter={e => showTip(e, 'Toggle rulers', 'Shift+R')} onMouseLeave={hideTip}
          style={{ width: 28, height: 26, border: `1px solid ${showRulers ? '#00C4CC' : t.border}`, borderRadius: 5,
            background: showRulers ? 'rgba(0,196,204,0.1)' : t.input, color: showRulers ? '#00C4CC' : t.text,
            fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms' }}>
          ⊹
        </button>

        {/* Grid toggle */}
        <button onClick={() => setShowGrid(o => !o)}
          onMouseEnter={e => showTip(e, 'Toggle grid', 'G')} onMouseLeave={hideTip}
          style={{ width: 28, height: 26, border: `1px solid ${showGrid ? '#00C4CC' : t.border}`, borderRadius: 5,
            background: showGrid ? 'rgba(0,196,204,0.1)' : t.input, color: showGrid ? '#00C4CC' : t.text,
            fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 100ms' }}>
          ⊞
        </button>

        {/* Fullscreen */}
        <button onClick={() => document.documentElement.requestFullscreen?.()}
          onMouseEnter={e => showTip(e, 'Fullscreen')} onMouseLeave={hideTip}
          style={{ width: 28, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 100ms' }}>
          ⤢
        </button>

        {/* Help */}
        <button onClick={() => setQuickOpen(true)}
          onMouseEnter={e => showTip(e, 'Keyboard shortcuts', '?')} onMouseLeave={hideTip}
          style={{ width: 28, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 100ms' }}>
          ?
        </button>
      </div>

      {/* ── Quick Actions palette (/ key) ── */}
      {quickOpen && (() => {
        const actions = QUICK_ACTIONS.filter(a =>
          !quickQuery ||
          a.label.toLowerCase().includes(quickQuery.toLowerCase()) ||
          (a.sub || '').toLowerCase().includes(quickQuery.toLowerCase())
        );

        const dispatch = (id) => {
          setQuickOpen(false);
          setQuickQuery('');
          if (id === 'text')     return addText();
          if (id === 'rect')     return addRect();
          if (id === 'circle')   return addCircle();
          if (id === 'line')     { pushHistory(); const el = { id: uid(), type: 'line', x: canvasSize.w/2-80, y: canvasSize.h/2, points: [0,0,160,0], stroke: '#ffffff', strokeWidth: 3, opacity: 1 }; patchElements(prev => [...prev, el]); setSelectedId(el.id); return; }
          if (id === 'undo')     return undo();
          if (id === 'redo')     return redo();
          if (id === 'duplicate'){ const sel = elements.find(e => e.id === selectedId); if (sel) { const d = {...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x+20, y: sel.y+20}; pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id); } return; }
          if (id === 'pasteinplace') { if (clipboard) { pushHistory(); if (Array.isArray(clipboard)) { const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid() })); patchElements(prev => [...prev, ...newEls]); const ids = newEls.map(e => e.id); setSelectedIds(ids); setSelectedId(ids[ids.length - 1]); } else { const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid() }; patchElements(prev => [...prev, p]); setSelectedId(p.id); } } return; }
          if (id === 'delete')   { if (selectedIds.length > 0) { pushHistory(); const s = new Set(selectedIds); patchElements(p => p.filter(e => !s.has(e.id))); clearSelection(); } return; }
          if (id === 'newpage')  return addPage();
          if (id === 'download') return downloadCanvas('image/png', 'png', 1);
          if (id === 'zoomin')   return zoomIn();
          if (id === 'zoomout')  return zoomOut();
          if (id === 'zoomfit')  return setZoomFactor(1);
          if (id === 'selectall') {
            const ids = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id)).map(el => el.id);
            if (ids.length) { setSelectedIds(ids); setSelectedId(ids[ids.length - 1]); }
            return;
          }
          if (id === 'showgrid') { setShowGrid(o => !o); return; }
          if (id === 'nextel' || id === 'prevel') {
            const selectable = elements.filter(el => !lockedIds.has(el.id) && !hiddenIds.has(el.id));
            if (!selectable.length) return;
            const idx = selectable.findIndex(el => el.id === selectedId);
            const next = id === 'prevel'
              ? (idx <= 0 ? selectable.length - 1 : idx - 1)
              : (idx < 0 || idx >= selectable.length - 1 ? 0 : idx + 1);
            setSelectedId(selectable[next].id); setSelectedIds([]);
            return;
          }
        };

        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1998, background: 'rgba(0,0,0,0.25)' }}
              onMouseDown={() => { setQuickOpen(false); setQuickQuery(''); }} />
            <div style={{
              position: 'fixed', top: '28%', left: '50%', transform: 'translateX(-50%)',
              width: 500, background: t.card, border: `1px solid ${t.border}`,
              borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
              zIndex: 1999, overflow: 'hidden',
            }}>
              {/* Search input */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${t.border}`, gap: 10 }}>
                <span style={{ fontSize: 18, color: t.textMuted, flexShrink: 0 }}>🔍</span>
                <input
                  autoFocus
                  value={quickQuery}
                  onChange={e => setQuickQuery(e.target.value)}
                  placeholder='Search actions or press "/" for commands…'
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 15 }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setQuickOpen(false); setQuickQuery(''); }
                    if (e.key === 'Enter' && actions.length > 0) dispatch(actions[0].id);
                  }}
                />
                <kbd style={{ fontSize: 11, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>Esc</kbd>
              </div>

              {/* Action list */}
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '6px 0' }}>
                {actions.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: t.textMuted }}>No actions match "{quickQuery}"</div>
                )}
                {actions.map(a => (
                  <button key={a.id}
                    onMouseDown={e => { e.preventDefault(); dispatch(a.id); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 60ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.input, borderRadius: 8, fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{a.label}</div>
                      {a.sub && <div style={{ fontSize: 12, color: t.textMuted }}>{a.sub}</div>}
                    </div>
                    {a.shortcut && (
                      <kbd style={{ fontSize: 11, color: t.textMuted, background: t.input, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>{a.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>

              {/* Footer hint */}
              <div style={{ padding: '8px 18px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 16, fontSize: 11, color: t.textMuted }}>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>↵</kbd> select</span>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>Esc</kbd> close</span>
                <span><kbd style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: 3, padding: '1px 5px' }}>/</kbd> to re-open</span>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Right-click context menu ── */}
      {ctxMenu && (() => {
        const el = ctxMenu.elementId ? elements.find(e => e.id === ctxMenu.elementId) : null;
        const isLocked = el && lockedIds.has(el.id);
        const isHidden = el && hiddenIds.has(el.id);

        // Clamp to viewport so menu never overflows
        const menuW = 192, menuH = el ? 320 : 80;
        const mx = Math.min(ctxMenu.x, window.innerWidth  - menuW - 8);
        const my = Math.min(ctxMenu.y, window.innerHeight - menuH - 8);

        const close = () => setCtxMenu(null);

        const dupEl = () => {
          if (!el) return;
          const d = { ...JSON.parse(JSON.stringify(el)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: el.x + 20, y: el.y + 20 };
          pushHistory(); patchElements(prev => [...prev, d]); setSelectedId(d.id);
        };
        const delEl = () => {
          if (!el) return;
          pushHistory(); patchElements(prev => prev.filter(e => e.id !== el.id)); setSelectedId(null);
        };
        const pasteEl = () => {
          if (!clipboard) return;
          pushHistory();
          if (Array.isArray(clipboard)) {
            const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid(), x: el.x + 20, y: el.y + 20 }));
            patchElements(prev => [...prev, ...newEls]);
            const newIds = newEls.map(e => e.id);
            setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
          } else {
            const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + 20, y: clipboard.y + 20 };
            patchElements(prev => [...prev, p]); setSelectedId(p.id);
          }
        };

        const ITEMS = [
          el && { label: 'Copy',          shortcut: 'Ctrl+C', fn: () => setClipboard(JSON.parse(JSON.stringify(el))) },
          clipboard && { label: Array.isArray(clipboard) && clipboard.length > 1 ? `Paste ${clipboard.length} items` : 'Paste', shortcut: 'Ctrl+V', fn: pasteEl },
          clipboard && { label: 'Paste in place', shortcut: 'Ctrl+⇧V', fn: () => {
            if (!clipboard) return;
            pushHistory();
            if (Array.isArray(clipboard)) {
              const newEls = clipboard.map(el => ({ ...JSON.parse(JSON.stringify(el)), id: uid() }));
              patchElements(prev => [...prev, ...newEls]);
              const newIds = newEls.map(e => e.id);
              setSelectedIds(newIds); setSelectedId(newIds[newIds.length - 1]);
            } else {
              const p = { ...JSON.parse(JSON.stringify(clipboard)), id: uid() };
              patchElements(prev => [...prev, p]); setSelectedId(p.id);
            }
          }},
          el && { label: 'Duplicate',     shortcut: 'Ctrl+D', fn: dupEl },
          (el || clipboard) && { sep: true },
          el && { label: 'Bring Forward', shortcut: ']',      fn: () => bringForward(el.id) },
          el && { label: 'Send Backward', shortcut: '[',      fn: () => sendBackward(el.id) },
          el && { label: 'Bring to Front',shortcut: 'Shift+]',fn: () => bringToFront(el.id) },
          el && { label: 'Send to Back',  shortcut: 'Shift+[',fn: () => sendToBack(el.id) },
          el && { sep: true },
          el && el.type === 'group' && { label: 'Ungroup', shortcut: 'Ctrl+⇧G', fn: () => ungroupSelected() },
          el && el.type === 'image' && { label: '🖼 Set as background', fn: () => setElementAsBackground(el) },
          el && pages.length > 1 && { label: 'Add to all pages', fn: () => addElToAllPages(el.id) },
          (el?.type === 'group' || el?.type === 'image' || pages.length > 1) && el && { sep: true },
          el && { label: isLocked ? 'Unlock' : 'Lock',        fn: () => toggleLocked(el.id) },
          el && { label: isHidden ? 'Show'   : 'Hide',        fn: () => toggleHidden(el.id) },
          el && { sep: true },
          el && { label: 'Delete', shortcut: 'Del', fn: delEl, danger: true },
        ].filter(Boolean);

        return (
          <>
            {/* Invisible overlay to close on outside click */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onMouseDown={close}
              onContextMenu={e => { e.preventDefault(); close(); }}
            />
            {/* Menu */}
            <div style={{
              position: 'fixed', left: mx, top: my,
              width: menuW, background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              zIndex: 1000, overflow: 'hidden',
              padding: '4px 0',
            }}>
              {ITEMS.map((item, i) =>
                item.sep ? (
                  <div key={i} style={{ height: 1, background: t.border, margin: '4px 0' }} />
                ) : (
                  <button key={i}
                    onMouseDown={e => { e.stopPropagation(); item.fn(); close(); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 14px', border: 'none', background: 'transparent',
                      color: item.danger ? '#ef4444' : t.text,
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      transition: 'background 60ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : t.input; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 12, flexShrink: 0 }}>{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          </>
        );
      })()}

      {/* ── Post modal ── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: t.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, border: `1px solid ${t.border}` }}>
            {postSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Posted!</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Your template has been posted.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setPostModalOpen(false); setPostSuccess(false); router.push('/media?tab=templates'); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    View Templates
                  </button>
                  <button onClick={() => { setPostModalOpen(false); setPostSuccess(false); }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Keep Editing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>Post Your Graphic</h3>
                  <button onClick={() => setPostModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20 }}>×</button>
                </div>
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Caption (optional)</label>
                <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)} rows={3} placeholder="Add a caption..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 8 }}>Platforms</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {['facebook', 'instagram', 'google_business'].map(p => {
                    const active = postPlatforms.includes(p);
                    return (
                      <button key={p} onClick={() => setPostPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                        style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: `1px solid ${active ? t.primary : t.border}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textMuted, cursor: 'pointer', fontWeight: 500, textTransform: 'capitalize' }}>
                        {p.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
                {postError && <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{postError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPostModalOpen(false)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handlePost} disabled={posting || postPlatforms.length === 0}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: postPlatforms.length === 0 ? t.textDisabled : t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: posting || postPlatforms.length === 0 ? 'not-allowed' : 'pointer' }}>
                    {posting ? 'Posting...' : 'Post Now'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      {tip && (
        <div style={{
          position: 'fixed', left: tip.x, top: tip.y,
          transform: 'translateX(-50%)',
          background: 'rgba(17,24,39,0.92)', color: '#fff',
          padding: '5px 10px', borderRadius: 6, fontSize: 12,
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          lineHeight: 1.4,
        }}>
          {tip.text}
          {tip.shortcut && (
            <kbd style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 3, padding: '1px 5px', fontSize: 11,
              fontFamily: 'monospace',
            }}>
              {tip.shortcut}
            </kbd>
          )}
        </div>
      )}

      {/* Hidden file input for image replace */}
      <input ref={replaceFileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (!f || !selectedId) return;
          const url = URL.createObjectURL(f);
          pushHistory();
          patchElements(prev => prev.map(el => el.id === selectedId ? { ...el, url } : el));
          e.target.value = '';
        }} />

      {/* ── Design card hover preview ── */}
      {hoveredDesign && (
        <div style={{
          position: 'fixed',
          left: Math.min(hoveredDesign.x, window.innerWidth - 200),
          top: Math.max(8, Math.min(hoveredDesign.y, window.innerHeight - 130)),
          width: 180,
          background: 'rgba(17,24,39,0.96)',
          color: '#fff',
          borderRadius: 10,
          padding: '12px 14px',
          zIndex: 9998,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'panel-in 120ms ease forwards',
        }}>
          <div style={{ aspectRatio: '4/5', borderRadius: 6, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {hoveredDesign.title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hoveredDesign.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>{canvasSize.w}×{canvasSize.h}px</div>
          {hoveredDesign.pagesCount > 1 && (
            <div style={{ fontSize: 11, color: '#00C4CC' }}>{hoveredDesign.pagesCount} pages</div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Click to open</div>
        </div>
      )}

      {/* ── Share panel ── */}
      {shareOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShareOpen(false)} />
          <div style={{ position: 'fixed', top: 56, right: 0, width: 380, height: 'calc(100vh - 56px)', background: t.card, borderLeft: `1px solid ${t.border}`, zIndex: 300, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: t.text }}>Share design</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>📊 0 visitors</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16 }}>⚙</button>
                <button onClick={() => setShareOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            </div>
            {/* People with access */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14, color: t.text }}>People with access</div>
              <input placeholder="Add people, groups or teams" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {/* Access level */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14, color: t.text }}>Access level</div>
              <select style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none' }}>
                <option>Only you can access</option>
                <option>Anyone with the link can view</option>
                <option>Anyone with the link can edit</option>
              </select>
            </div>
            {/* Copy link */}
            <button onClick={() => { navigator.clipboard?.writeText(window.location.href); }}
              style={{ background: t.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🔗 Copy link
            </button>
            {/* Custom link */}
            <button style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px', color: t.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              + Create custom link <span style={{ fontSize: 12 }}>👑</span>
            </button>
            {/* Divider */}
            <div style={{ borderTop: `1px solid ${t.border}` }} />
            {/* Action grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { icon: '⬇', label: 'Download',      action: () => { downloadCanvas('image/png', 'png', 1); setShareOpen(false); } },
                { icon: '▶', label: 'Present',        color: '#FF7A00', action: () => { setPreviewOpen(true); setShareOpen(false); } },
                { icon: '🔗', label: 'Public',        action: () => {} },
                { icon: '⊞', label: 'Template link', pro: true, action: () => {} },
              ].map(o => (
                <button key={o.label} onClick={o.action}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 4px', background: 'transparent', cursor: 'pointer', position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.input}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 22, color: o.color || t.text }}>{o.icon}</span>
                  <span style={{ fontSize: 11, color: t.text }}>{o.label}</span>
                  {o.pro && <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 9 }}>👑</span>}
                </button>
              ))}
            </div>
            {/* Save button */}
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
              <button onClick={() => { handleSave(); setShareOpen(false); }} disabled={saving}
                style={{ width: '100%', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px', color: t.text, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : '💾 Save design'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Find & Replace panel ── */}
      {showFindReplace && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 599 }} onClick={() => setShowFindReplace(false)} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', top: 60, right: 16, width: 320, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, zIndex: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>Find & Replace</span>
              <button onClick={() => setShowFindReplace(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Find</div>
              <input autoFocus value={findText} onChange={e => { setFindText(e.target.value); setFrMatchCount(0); }}
                placeholder="Search text…"
                onKeyDown={e => { if (e.key === 'Enter') { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); } if (e.key === 'Escape') setShowFindReplace(false); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Replace with</div>
              <input value={replaceText} onChange={e => setReplaceText(e.target.value)}
                placeholder="Replacement…"
                onKeyDown={e => { if (e.key === 'Enter') { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); } if (e.key === 'Escape') setShowFindReplace(false); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {frMatchCount !== 0 && (
              <div style={{ marginBottom: 8, fontSize: 12, color: frMatchCount > 0 ? '#10b981' : t.textMuted }}>
                {frMatchCount > 0 ? `✓ Replaced ${frMatchCount} occurrence${frMatchCount > 1 ? 's' : ''}` : 'No matches found'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { pushHistory(); const n = findReplaceAll(findText, replaceText); if (!n) setFrMatchCount(-1); }}
                disabled={!findText}
                style={{ flex: 1, background: findText ? t.primary : t.input, color: findText ? '#fff' : t.textMuted, border: 'none', borderRadius: 7, padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: findText ? 'pointer' : 'not-allowed', opacity: findText ? 1 : 0.6 }}>
                Replace all
              </button>
              <button onClick={() => setShowFindReplace(false)}
                style={{ padding: '9px 14px', background: t.input, color: t.text, border: `1px solid ${t.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div
          onClick={() => { setPreviewOpen(false); setPresentPlaying(false); }}
          style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          {/* Close */}
          <button onClick={() => { setPreviewOpen(false); setPresentPlaying(false); }}
            style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>

          {/* Page counter + auto-play controls */}
          <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:8 }} onClick={e => e.stopPropagation()}>
            {pages.length > 1 && (
              <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 14px', color:'#fff', fontSize:13 }}>
                {activePage + 1} / {pages.length}
              </div>
            )}
            {pages.length > 1 && (
              <>
                <button onClick={() => setPresentPlaying(p => !p)}
                  title={presentPlaying ? 'Pause' : 'Auto-play slides'}
                  style={{ background: presentPlaying ? '#00C4CC' : 'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {presentPlaying ? '⏸' : '▶'}
                </button>
                <select value={presentInterval} onChange={e => setPresentInterval(+e.target.value)}
                  style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:16, padding:'4px 8px', fontSize:12, cursor:'pointer', outline:'none' }}>
                  {[2,3,5,8,10].map(s => <option key={s} value={s} style={{ background:'#1e1e28' }}>{s}s</option>)}
                </select>
              </>
            )}
          </div>

          {/* Canvas image */}
          {previewUrl
            ? <img key={previewUrl} src={previewUrl} onClick={e => e.stopPropagation()}
                style={{ maxWidth:'85vw', maxHeight:'85vh', objectFit:'contain', borderRadius:6, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', animation:'preview-fade 220ms cubic-bezier(0.2,0,0,1) forwards' }} />
            : <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Rendering…</div>
          }

          {/* Left arrow */}
          {pages.length > 1 && activePage > 0 && (
            <button onClick={e => { e.stopPropagation(); setActivePage(i => i - 1); }}
              style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ‹
            </button>
          )}

          {/* Right arrow */}
          {pages.length > 1 && activePage < pages.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setActivePage(i => i + 1); }}
              style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ›
            </button>
          )}
        </div>
      )}

    </div>
    </DocColorsCtx.Provider>
  );
}
