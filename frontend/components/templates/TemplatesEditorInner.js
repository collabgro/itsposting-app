import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import { Stage, Layer, Rect, Image as KonvaImage, Text, Circle, Line, Transformer, RegularPolygon, Star, Arrow } from 'react-konva';
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

const FONTS = ['Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Open Sans', 'Lato', 'Oswald', 'Raleway'];

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

const SNAP_THRESHOLD = 6;

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
      stroke={isSelected ? '#7C5CFC' : undefined}
      strokeWidth={isSelected ? 3 : 0}
    />
  );
}

// ─── ImageNode ───────────────────────────────────────────────────────────────

function ImageNode({ el, isSelected, onSelect, onChange, onDragMove, onSnapClear, locked, hidden }) {
  const shapeRef = useRef(null);
  const [img] = useImage(el.src, 'anonymous');
  const w = el.width || 200;
  const h = el.height || 200;
  const flipSX = el.flipH ? -1 : 1;
  const flipSY = el.flipV ? -1 : 1;

  const handleDragMove = (e) => {
    if (!onDragMove) return;
    const tlX = e.target.x() - w / 2;
    const tlY = e.target.y() - h / 2;
    const { x: nx, y: ny } = onDragMove(el.id, tlX, tlY, w, h);
    e.target.position({ x: nx + w / 2, y: ny + h / 2 });
  };

  const handleDragEnd = (e) => {
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
      opacity={el.opacity ?? 1}
      cornerRadius={el.cornerRadius || 0}
      draggable={!locked}
      visible={!hidden}
      onClick={() => !locked && onSelect(el.id)}
      onTap={() => !locked && onSelect(el.id)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? '#7C5CFC' : undefined}
      strokeWidth={isSelected ? 1.5 : 0}
    />
  );
}

// ─── ContentNode ──────────────────────────────────────────────────────────────

function ContentNode({ el, isSelected, onSelect, onChange, stageW, stageH, onDblClick, onDragMove, onSnapClear, locked, hidden }) {
  const shapeRef = useRef(null);

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
    if (onSnapClear) onSnapClear();
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    if (el.type === 'text') {
      onChange({
        ...el, x: node.x(), y: node.y(),
        width: Math.max(20, node.width() * node.scaleX()),
        scaleX: 1, scaleY: 1, rotation: node.rotation(),
      });
    } else {
      onChange({
        ...el, x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * node.scaleX()),
        height: Math.max(5, node.height() * node.scaleY()),
        scaleX: 1, scaleY: 1, rotation: node.rotation(),
      });
    }
    node.scaleX(1);
    node.scaleY(1);
  };

  const common = {
    ref: shapeRef,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation || 0,
    draggable: !locked,
    visible: !hidden && el.visible !== false,
    onClick: () => !locked && onSelect(el.id),
    onTap: () => !locked && onSelect(el.id),
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    stroke: isSelected ? '#7C5CFC' : undefined,
    strokeWidth: isSelected ? 1.5 : 0,
  };

  if (el.type === 'text') return (
    <Text
      {...common}
      text={el.text}
      fontSize={el.fontSize || 36}
      fontFamily={el.fontFamily || 'Inter'}
      fontStyle={el.fontStyle || 'normal'}
      textDecoration={el.textDecoration || ''}
      fill={el.fill || '#ffffff'}
      width={el.width || 400}
      align={el.align || 'center'}
      opacity={el.opacity ?? 1}
      shadowEnabled={el.shadow?.enabled || false}
      shadowColor={el.shadow?.color || '#000000'}
      shadowBlur={el.shadow?.blur ?? 4}
      shadowOffsetX={el.shadow?.offsetX ?? 2}
      shadowOffsetY={el.shadow?.offsetY ?? 2}
      shadowOpacity={el.shadow?.opacity ?? 0.5}
      stroke={el.outline?.enabled ? (el.outline.color || '#000000') : ''}
      strokeWidth={el.outline?.enabled ? (el.outline.width ?? 1) : 0}
      onDblClick={() => onDblClick(el.id)}
      onDblTap={() => onDblClick(el.id)}
    />
  );

  if (el.type === 'rect') return (
    <Rect {...common}
      width={el.width || 200} height={el.height || 100}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
      cornerRadius={el.cornerRadius || 0}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'circle') return (
    <Circle {...common}
      radius={el.radius || 60}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'line') return (
    <Line {...common}
      points={el.points || [0, 0, el.width || 200, 0]}
      stroke={el.stroke || '#ffffff'}
      strokeWidth={el.strokeWidth || 3}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'triangle') return (
    <RegularPolygon {...common}
      sides={3}
      radius={el.radius || 60}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
      opacity={el.opacity ?? 1}
    />
  );

  if (el.type === 'star') return (
    <Star {...common}
      numPoints={5}
      outerRadius={el.outerRadius || 60}
      innerRadius={el.innerRadius || 25}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
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
      opacity={el.opacity ?? 1}
    />
  );

  return null;
}

// ─── TransformerLayer ────────────────────────────────────────────────────────

function TransformerLayer({ selectedId, elements, stageRef, snapGuides, stageScale, canvasW, canvasH }) {
  const trRef = useRef(null);

  useLayoutEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (!selectedId || selectedId === '__bg__') {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current.findOne(`#${selectedId}`);
    if (!node) return;
    trRef.current.nodes([node]);
    trRef.current.getLayer()?.batchDraw();
  });

  const selectedEl = elements.find(e => e.id === selectedId);
  const isText = selectedEl?.type === 'text';

  return (
    <>
      <Transformer
        ref={trRef}
        enabledAnchors={isText
          ? ['middle-left', 'middle-right']
          : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
        }
        boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
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
  const canvasSize = CANVAS_SIZES.find(s => s.id === canvasSizeId) || CANVAS_SIZES[0];

  // Background
  const [bgType, setBgType] = useState('color');
  const [bgColor, setBgColor] = useState('#1a1a22');
  const [bgImageUrl, setBgImageUrl] = useState(null);
  const [bgSource, setBgSource] = useState(null);
  const [bgSourceId, setBgSourceId] = useState(null);
  const [bgFilter, setBgFilter] = useState('normal');
  const [bgBrightness, setBgBrightness] = useState(0);
  const [bgContrast, setBgContrast] = useState(0);
  const [bgSaturation, setBgSaturation] = useState(0);

  // Elements
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textareaValue, setTextareaValue] = useState('');
  const [textareaPos, setTextareaPos] = useState({ x: 0, y: 0, w: 0 });

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canva-parity state
  const [clipboard, setClipboard] = useState(null);
  const [snapGuides, setSnapGuides] = useState({ v: [], h: [] });
  const [rightTab, setRightTab] = useState('properties');
  const [lockedIds, setLockedIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [recentColors, setRecentColors] = useState([]);
  const [showShadowPanel, setShowShadowPanel] = useState(false);
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);
  const [imgTab, setImgTab] = useState('stock');

  // UI
  const [activeLeftTool, setActiveLeftTool] = useState('background');
  const [bgPhotos, setBgPhotos] = useState([]);
  const [bgPhotosLoading, setBgPhotosLoading] = useState(false);
  const [bgTab, setBgTab] = useState('stock');
  const [saving, setSaving] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [savedCreationId, setSavedCreationId] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postPlatforms, setPostPlatforms] = useState(['instagram']);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState(false);
  const [titleForSave, setTitleForSave] = useState('Untitled');

  // Canvas display scale
  const containerRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);
  const [stageDisplayW, setStageDisplayW] = useState(540);
  const [stageDisplayH, setStageDisplayH] = useState(675);
  const stageRef = useRef(null);
  const trLayerRef = useRef(null);

  // ── Display scale ──────────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 20;
      const maxH = window.innerHeight - 160;
      const scaleW = maxW / canvasSize.w;
      const scaleH = maxH / canvasSize.h;
      const scale = Math.min(scaleW, scaleH, 1);
      setStageScale(scale);
      setStageDisplayW(Math.floor(canvasSize.w * scale));
      setStageDisplayH(Math.floor(canvasSize.h * scale));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSizeId, canvasSize.w, canvasSize.h]);

  // ── Load photos ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeLeftTool !== 'background' && activeLeftTool !== 'images') return;
    if (bgPhotos.length > 0) return;
    setBgPhotosLoading(true);
    studioAPI.getPhotos({ limit: 60, offset: 0 })
      .then(data => setBgPhotos(data.photos || []))
      .catch(() => {})
      .finally(() => setBgPhotosLoading(false));
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

  // ── Keyboard handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (editingTextId) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedId !== '__bg__') {
        pushHistory();
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const sel = elements.find(el => el.id === selectedId);
        if (sel) setClipboard(JSON.parse(JSON.stringify(sel)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard) {
        const el = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + 20, y: clipboard.y + 20 };
        pushHistory();
        setElements(prev => [...prev, el]);
        setSelectedId(el.id);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        const sel = elements.find(el => el.id === selectedId);
        if (sel) {
          const el = { ...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x + 20, y: sel.y + 20 };
          pushHistory();
          setElements(prev => [...prev, el]);
          setSelectedId(el.id);
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

      if (e.key === 'Escape') {
        setSelectedId(null);
        setShowShadowPanel(false);
        setShowOutlinePanel(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingTextId, history, historyIndex, elements, clipboard]);

  // ── History helpers ────────────────────────────────────────────────────────
  function snapshot() {
    return {
      elements: JSON.parse(JSON.stringify(elements)),
      bgType, bgColor, bgImageUrl, bgSource, bgSourceId,
      bgFilter, bgBrightness, bgContrast, bgSaturation,
      lockedIds: [...lockedIds],
      hiddenIds: [...hiddenIds],
    };
  }

  function pushHistory() {
    const snap = snapshot();
    setHistory(prev => [...prev.slice(0, historyIndex + 1), snap].slice(-50));
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    setElements(snap.elements || []);
    if (snap.bgType) setBgType(snap.bgType);
    if (snap.bgColor) setBgColor(snap.bgColor);
    if (snap.bgImageUrl !== undefined) setBgImageUrl(snap.bgImageUrl);
    if (snap.bgSource !== undefined) setBgSource(snap.bgSource);
    if (snap.bgSourceId !== undefined) setBgSourceId(snap.bgSourceId);
    if (snap.bgFilter) setBgFilter(snap.bgFilter);
    if (snap.bgBrightness !== undefined) setBgBrightness(snap.bgBrightness);
    if (snap.bgContrast !== undefined) setBgContrast(snap.bgContrast);
    if (snap.bgSaturation !== undefined) setBgSaturation(snap.bgSaturation);
    if (snap.lockedIds) setLockedIds(new Set(snap.lockedIds));
    if (snap.hiddenIds) setHiddenIds(new Set(snap.hiddenIds));
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

  function addText() {
    pushHistory();
    const el = {
      id: uid(), type: 'text',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 30,
      text: 'Double-click to edit',
      fontSize: 48, fontFamily: 'Inter', fontStyle: 'bold',
      fill: '#ffffff', width: 400, align: 'center', opacity: 1,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRect() {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 50, width: 200, height: 100, fill: 'rgba(255,255,255,0.15)', cornerRadius: 12, opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCircle() {
    pushHistory();
    const el = { id: uid(), type: 'circle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addLine() {
    pushHistory();
    const el = { id: uid(), type: 'line', x: canvasSize.w / 2 - 150, y: canvasSize.h / 2, points: [0, 0, 300, 0], stroke: '#ffffff', strokeWidth: 4, opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTriangle() {
    pushHistory();
    const el = { id: uid(), type: 'triangle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStar() {
    pushHistory();
    const el = { id: uid(), type: 'star', x: canvasSize.w / 2, y: canvasSize.h / 2, outerRadius: 80, innerRadius: 35, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addArrow() {
    pushHistory();
    const el = { id: uid(), type: 'arrow', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2, width: 200, fill: '#ffffff', strokeWidth: 4, opacity: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
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
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function updateElement(updated) {
    setElements(prev => prev.map(el => el.id === updated.id ? updated : el));
  }

  function handleElementChange(updated) {
    pushHistory();
    updateElement(updated);
  }

  // ── Nudge ──────────────────────────────────────────────────────────────────
  function nudge(id, dx, dy) {
    pushHistory();
    setElements(prev => prev.map(el => el.id === id ? { ...el, x: el.x + dx, y: el.y + dy } : el));
  }

  // ── Flip ──────────────────────────────────────────────────────────────────
  function flipH() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    setElements(prev => prev.map(e => e.id === el.id ? { ...e, flipH: !e.flipH } : e));
  }

  function flipV() {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'image') return;
    pushHistory();
    setElements(prev => prev.map(e => e.id === el.id ? { ...e, flipV: !e.flipV } : e));
  }

  // ── Layer order ────────────────────────────────────────────────────────────
  function bringForward(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    setElements(prev => {
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
    setElements(prev => {
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
    setElements(prev => { const el = prev.find(e => e.id === tid); return el ? [...prev.filter(e => e.id !== tid), el] : prev; });
  }

  function sendToBack(id) {
    const tid = id || selectedId; if (!tid) return;
    pushHistory();
    setElements(prev => { const el = prev.find(e => e.id === tid); return el ? [el, ...prev.filter(e => e.id !== tid)] : prev; });
  }

  // ── Lock / Hidden ──────────────────────────────────────────────────────────
  function toggleLocked(id) {
    setLockedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleHidden(id) {
    setHiddenIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
    return { x: snapX, y: snapY };
  }

  function clearSnapGuides() { setSnapGuides({ v: [], h: [] }); }

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
    setElements(prev => prev.map(e => e.id === id ? { ...e, visible: false } : e));
  }

  function commitTextEdit() {
    if (!editingTextId) return;
    pushHistory();
    setElements(prev => prev.map(e => e.id === editingTextId ? { ...e, text: textareaValue, visible: true } : e));
    setEditingTextId(null);
  }

  // ── Background helpers ─────────────────────────────────────────────────────
  function selectBgPhoto(photo) {
    pushHistory();
    setBgType('image');
    setBgImageUrl(photo.url);
    setBgSource(photo.source || 'stock');
    setBgSourceId(photo.id);
  }

  function applyFilterPreset(key) {
    const p = FILTER_PRESETS[key];
    if (!p) return;
    pushHistory();
    setBgFilter(key);
    setBgBrightness(p.brightness);
    setBgContrast(p.contrast);
    setBgSaturation(p.saturation);
  }

  // ── Save & Post ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!stageRef.current) return;
    setSaving(true);
    try {
      setSelectedId(null);
      await new Promise(r => requestAnimationFrame(r));
      await document.fonts.ready;
      if (trLayerRef.current) trLayerRef.current.hide();
      const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.9, pixelRatio: canvasSize.w / stageRef.current.width() });
      if (trLayerRef.current) trLayerRef.current.show();
      const snap = snapshot();
      const data = await studioAPI.save({ imageDataUrl: dataUrl, canvasJson: snap, title: titleForSave, canvasWidth: canvasSize.w, canvasHeight: canvasSize.h, backgroundSource: bgSource, backgroundId: bgSourceId });
      setSavedCreationId(data.creation.id);
      setPostModalOpen(true);
    } catch (err) {
      console.error('[TemplatesEditor] save:', err);
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', overflow: 'hidden', background: t.bg }}>

      {/* ── Top toolbar ── */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: `1px solid ${t.border}`, background: t.card, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/media?tab=templates')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          ← Templates
        </button>
        <select value={canvasSizeId} onChange={e => setCanvasSizeId(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer' }}>
          {CANVAS_SIZES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.w}×{s.h})</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={undo} disabled={historyIndex < 0} title="Undo (Ctrl+Z)"
            style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: historyIndex < 0 ? t.textMuted : t.text, fontSize: 13, cursor: historyIndex < 0 ? 'not-allowed' : 'pointer' }}>⟲</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"
            style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: historyIndex >= history.length - 1 ? t.textMuted : t.text, fontSize: 13, cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer' }}>⟳</button>
        </div>
        <input value={titleForSave} onChange={e => setTitleForSave(e.target.value)} placeholder="Template title..."
          style={{ flex: 1, maxWidth: 220, padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none' }} />
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save & Post'}
          </button>
        </div>
      </div>

      {/* ── Contextual action bar ── */}
      <div onClick={() => { setShowShadowPanel(false); setShowOutlinePanel(false); }}
        style={{ height: 44, display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', borderBottom: `1px solid ${t.border}`, background: t.card, flexShrink: 0, zIndex: 9, overflowX: 'auto' }}>

        {/* Nothing selected → align selected element to canvas */}
        {!selectedEl && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: t.textMuted, marginRight: 2, whiteSpace: 'nowrap' }}>Select + align:</span>
            {[{ dir: 'left', label: '⬅' }, { dir: 'centerH', label: '⬌' }, { dir: 'right', label: '➡' }, { dir: 'top', label: '⬆' }, { dir: 'centerV', label: '⬍' }, { dir: 'bottom', label: '⬇' }].map(({ dir, label }) => (
              <button key={dir} onClick={() => alignEl(dir)}
                style={{ padding: '4px 7px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        )}

        {/* Text selected */}
        {selectedEl?.type === 'text' && (
          <>
            <select value={selectedEl.fontFamily || 'Inter'}
              onChange={e => handleElementChange({ ...selectedEl, fontFamily: e.target.value })}
              style={{ padding: '3px 6px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, maxWidth: 140 }}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" value={selectedEl.fontSize || 36} min={8} max={400}
              onChange={e => handleElementChange({ ...selectedEl, fontSize: parseInt(e.target.value) || 36 })}
              style={{ width: 50, padding: '3px 5px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12 }} />
            {[{ k: 'bold', lbl: 'B', fs: { fontWeight: 700 } }, { k: 'italic', lbl: 'I', fs: { fontStyle: 'italic' } }].map(({ k, lbl, fs }) => {
              const active = (selectedEl.fontStyle || '').includes(k);
              return (
                <button key={k} onClick={() => {
                  const cur = selectedEl.fontStyle || 'normal';
                  const next = active ? cur.replace(k, '').trim() || 'normal' : (cur === 'normal' ? k : `${cur} ${k}`);
                  handleElementChange({ ...selectedEl, fontStyle: next });
                }} style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${active ? t.primary : t.border}`, background: active ? t.primaryBg : t.input, color: active ? t.primary : t.text, fontSize: 13, cursor: 'pointer', ...fs }}>{lbl}</button>
              );
            })}
            <button onClick={() => handleElementChange({ ...selectedEl, textDecoration: selectedEl.textDecoration === 'underline' ? '' : 'underline' })}
              style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${selectedEl.textDecoration === 'underline' ? t.primary : t.border}`, background: selectedEl.textDecoration === 'underline' ? t.primaryBg : t.input, color: selectedEl.textDecoration === 'underline' ? t.primary : t.text, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>U</button>
            <input type="color" value={selectedEl.fill || '#ffffff'}
              onChange={e => pickColor(e.target.value, color => updateElement({ ...selectedEl, fill: color }))}
              onBlur={() => pushHistory()}
              title="Text color"
              style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} />
            {['left', 'center', 'right'].map(a => (
              <button key={a} onClick={() => handleElementChange({ ...selectedEl, align: a })}
                style={{ padding: '3px 6px', borderRadius: 5, border: `1px solid ${selectedEl.align === a ? t.primary : t.border}`, background: selectedEl.align === a ? t.primaryBg : t.input, color: selectedEl.align === a ? t.primary : t.text, fontSize: 12, cursor: 'pointer' }}>
                {a === 'left' ? '⬅' : a === 'center' ? '⬛' : '➡'}
              </button>
            ))}
            <div style={{ width: 1, height: 24, background: t.border, flexShrink: 0 }} />
            {/* Shadow */}
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowShadowPanel(p => !p); setShowOutlinePanel(false); }}
                style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${selectedEl.shadow?.enabled ? t.primary : t.border}`, background: selectedEl.shadow?.enabled ? t.primaryBg : t.input, color: selectedEl.shadow?.enabled ? t.primary : t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Shadow
              </button>
              {showShadowPanel && (
                <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 300, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: 12, width: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: t.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedEl.shadow?.enabled || false}
                      onChange={e => handleElementChange({ ...selectedEl, shadow: { ...(selectedEl.shadow || {}), enabled: e.target.checked } })} />
                    Enable Shadow
                  </label>
                  {selectedEl.shadow?.enabled && (
                    <>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 2 }}>Color</label>
                      <input type="color" value={selectedEl.shadow?.color || '#000000'}
                        onChange={e => updateElement({ ...selectedEl, shadow: { ...selectedEl.shadow, color: e.target.value } })}
                        onBlur={() => pushHistory()}
                        style={{ width: '100%', height: 24, marginBottom: 6, cursor: 'pointer', borderRadius: 4, border: `1px solid ${t.border}` }} />
                      {[{ label: 'Blur', key: 'blur', min: 0, max: 40, def: 4 }, { label: 'Offset X', key: 'offsetX', min: -30, max: 30, def: 2 }, { label: 'Offset Y', key: 'offsetY', min: -30, max: 30, def: 2 }].map(({ label, key, min, max, def }) => (
                        <div key={key} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={{ fontSize: 11, color: t.textMuted }}>{label}</label>
                            <span style={{ fontSize: 11, color: t.textMuted }}>{selectedEl.shadow?.[key] ?? def}</span>
                          </div>
                          <input type="range" min={min} max={max} value={selectedEl.shadow?.[key] ?? def}
                            onChange={e => updateElement({ ...selectedEl, shadow: { ...(selectedEl.shadow || {}), [key]: parseInt(e.target.value) } })}
                            onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Outline */}
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowOutlinePanel(p => !p); setShowShadowPanel(false); }}
                style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${selectedEl.outline?.enabled ? t.primary : t.border}`, background: selectedEl.outline?.enabled ? t.primaryBg : t.input, color: selectedEl.outline?.enabled ? t.primary : t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Outline
              </button>
              {showOutlinePanel && (
                <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 300, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: 12, width: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: t.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedEl.outline?.enabled || false}
                      onChange={e => handleElementChange({ ...selectedEl, outline: { ...(selectedEl.outline || {}), enabled: e.target.checked } })} />
                    Enable Outline
                  </label>
                  {selectedEl.outline?.enabled && (
                    <>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 2 }}>Color</label>
                      <input type="color" value={selectedEl.outline?.color || '#000000'}
                        onChange={e => updateElement({ ...selectedEl, outline: { ...selectedEl.outline, color: e.target.value } })}
                        onBlur={() => pushHistory()}
                        style={{ width: '100%', height: 24, marginBottom: 6, cursor: 'pointer', borderRadius: 4, border: `1px solid ${t.border}` }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: 11, color: t.textMuted }}>Width</label>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{selectedEl.outline?.width ?? 1}</span>
                      </div>
                      <input type="range" min={1} max={20} value={selectedEl.outline?.width ?? 1}
                        onChange={e => updateElement({ ...selectedEl, outline: { ...(selectedEl.outline || {}), width: parseInt(e.target.value) } })}
                        onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ width: 1, height: 24, background: t.border, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>Opacity</span>
            <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
              onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
              onMouseUp={() => pushHistory()} style={{ width: 70 }} />
            <span style={{ fontSize: 11, color: t.textMuted }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
          </>
        )}

        {/* Image/Shape selected */}
        {selectedEl && selectedEl.type !== 'text' && (
          <>
            {selectedEl.type === 'image' && (
              <>
                <button onClick={flipH} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Flip H</button>
                <button onClick={flipV} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Flip V</button>
                <div style={{ width: 1, height: 24, background: t.border, flexShrink: 0 }} />
              </>
            )}
            <button onClick={() => bringForward()} title="Bring Forward" style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>↑ Fwd</button>
            <button onClick={() => sendBackward()} title="Send Backward" style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>↓ Back</button>
            <button onClick={() => bringToFront()} title="Bring to Front" style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>⤒ Front</button>
            <button onClick={() => sendToBack()} title="Send to Back" style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>⤓ Back</button>
            <div style={{ width: 1, height: 24, background: t.border, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>Opacity</span>
            <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
              onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
              onMouseUp={() => pushHistory()} style={{ width: 70 }} />
            <span style={{ fontSize: 11, color: t.textMuted }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
            <div style={{ width: 1, height: 24, background: t.border, flexShrink: 0 }} />
            <button onClick={() => toggleLocked(selectedEl.id)} title={lockedIds.has(selectedEl.id) ? 'Unlock' : 'Lock'}
              style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${lockedIds.has(selectedEl.id) ? t.primary : t.border}`, background: lockedIds.has(selectedEl.id) ? t.primaryBg : t.input, color: lockedIds.has(selectedEl.id) ? t.primary : t.text, fontSize: 13, cursor: 'pointer' }}>
              {lockedIds.has(selectedEl.id) ? '🔒' : '🔓'}
            </button>
          </>
        )}
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ width: 260, borderRight: `1px solid ${t.border}`, background: t.card, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {/* Tool tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0, overflowX: 'auto' }}>
            {[
              { id: 'background', label: 'BG' },
              { id: 'text',       label: 'T'  },
              { id: 'images',     label: '🖼'  },
              { id: 'shapes',     label: '◻'  },
              { id: 'filters',    label: '◑'  },
              { id: 'adjust',     label: '⊹'  },
            ].map(tool => (
              <button key={tool.id} onClick={() => setActiveLeftTool(tool.id)}
                style={{ flex: 1, padding: '10px 0', border: 'none', background: activeLeftTool === tool.id ? t.primaryBg : 'transparent', color: activeLeftTool === tool.id ? t.primary : t.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer', borderBottom: activeLeftTool === tool.id ? `2px solid ${t.primary}` : '2px solid transparent', whiteSpace: 'nowrap' }}>
                {tool.label}
              </button>
            ))}
          </div>

          {/* Tool content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

            {/* BACKGROUND */}
            {activeLeftTool === 'background' && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Solid Color</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {COLOR_PALETTE.map(hex => (
                      <button key={hex} onClick={() => { pushHistory(); setBgType('color'); setBgColor(hex); pickColor(hex, () => {}); }}
                        style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: bgType === 'color' && bgColor === hex ? `3px solid ${t.primary}` : `2px solid ${t.border}`, cursor: 'pointer' }} />
                    ))}
                    <input type="color" value={bgColor}
                      onChange={e => { setBgType('color'); setBgColor(e.target.value); }}
                      onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }} title="Custom color" />
                  </div>
                  {recentColors.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>Recent</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {recentColors.map(c => (
                          <button key={c} onClick={() => { pushHistory(); setBgType('color'); setBgColor(c); }}
                            style={{ width: 22, height: 22, borderRadius: 4, background: c, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
                        ))}
                      </div>
                    </div>
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
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>Loading...</div>
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
              <div>
                <button onClick={addText}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
                  + Add Text
                </button>
                {selectedEl?.type === 'text' && (
                  <div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>FONT</label>
                      <select value={selectedEl.fontFamily || 'Inter'}
                        onChange={e => handleElementChange({ ...selectedEl, fontFamily: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13 }}>
                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>SIZE</label>
                      <input type="range" min={12} max={200} value={selectedEl.fontSize || 36}
                        onChange={e => updateElement({ ...selectedEl, fontSize: parseInt(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                      <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{selectedEl.fontSize || 36}px</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>COLOR</label>
                      <RecentColorsRow onPick={c => handleElementChange({ ...selectedEl, fill: c })} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {COLOR_PALETTE.map(hex => (
                          <button key={hex} onClick={() => { handleElementChange({ ...selectedEl, fill: hex }); pickColor(hex, () => {}); }}
                            style={{ width: 24, height: 24, borderRadius: 5, background: hex, border: selectedEl.fill === hex ? `3px solid ${t.primary}` : `1px solid ${t.border}`, cursor: 'pointer' }} />
                        ))}
                        <input type="color" value={selectedEl.fill || '#ffffff'}
                          onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                          onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                          style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {[{ label: 'B', style: 'bold' }, { label: 'I', style: 'italic' }].map(({ label, style }) => {
                        const active = (selectedEl.fontStyle || '').includes(style);
                        return (
                          <button key={style} onClick={() => {
                            const cur = selectedEl.fontStyle || 'normal';
                            const next = active ? cur.replace(style, '').trim() || 'normal' : (cur === 'normal' ? style : `${cur} ${style}`);
                            handleElementChange({ ...selectedEl, fontStyle: next });
                          }}
                            style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${active ? t.primary : t.border}`, background: active ? t.primaryBg : t.input, color: active ? t.primary : t.text, fontWeight: style === 'bold' ? 700 : 400, fontStyle: style === 'italic' ? 'italic' : 'normal', cursor: 'pointer', fontSize: 14 }}>
                            {label}
                          </button>
                        );
                      })}
                      {['left', 'center', 'right'].map(align => (
                        <button key={align} onClick={() => handleElementChange({ ...selectedEl, align })}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${selectedEl.align === align ? t.primary : t.border}`, background: selectedEl.align === align ? t.primaryBg : t.input, color: selectedEl.align === align ? t.primary : t.text, cursor: 'pointer', fontSize: 12 }}>
                          {align === 'left' ? '⬅' : align === 'center' ? '⬛' : '➡'}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>OPACITY</label>
                      <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity ?? 1}
                        onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                        onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                      <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{Math.round((selectedEl.opacity ?? 1) * 100)}%</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* IMAGES */}
            {activeLeftTool === 'images' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Add Image to Canvas</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: t.input, borderRadius: 7, padding: 3 }}>
                  {['stock', 'mine'].map(tab => (
                    <button key={tab} onClick={() => setImgTab(tab)}
                      style={{ flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: imgTab === tab ? t.card : 'transparent', color: imgTab === tab ? t.text : t.textMuted, cursor: 'pointer' }}>
                      {tab === 'stock' ? 'Stock' : 'My Media'}
                    </button>
                  ))}
                </div>
                {bgPhotosLoading ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>Loading...</div>
                ) : displayedImgPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>
                    {imgTab === 'mine' ? 'No uploaded images yet' : 'No stock photos available'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {displayedImgPhotos.map(photo => (
                      <div key={photo.id}
                        onMouseEnter={() => setHoveredPhotoId(photo.id)}
                        onMouseLeave={() => setHoveredPhotoId(null)}
                        style={{ borderRadius: 7, overflow: 'hidden', border: `2px solid ${t.border}`, position: 'relative', cursor: 'pointer' }}>
                        <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        {hoveredPhotoId === photo.id && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 4 }}>
                            <button onClick={() => selectBgPhoto(photo)}
                              style={{ width: '100%', padding: '5px 0', fontSize: 10, fontWeight: 600, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
                              Set as BG
                            </button>
                            <button onClick={() => addImageElement(photo.url)}
                              style={{ width: '100%', padding: '5px 0', fontSize: 10, fontWeight: 600, borderRadius: 5, border: 'none', background: t.primary, color: '#fff', cursor: 'pointer' }}>
                              Add to Canvas
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SHAPES */}
            {activeLeftTool === 'shapes' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Rectangle', fn: addRect },
                    { label: 'Circle', fn: addCircle },
                    { label: 'Triangle', fn: addTriangle },
                    { label: 'Star', fn: addStar },
                    { label: 'Arrow', fn: addArrow },
                    { label: 'Line', fn: addLine },
                  ].map(({ label, fn }) => (
                    <button key={label} onClick={fn}
                      style={{ padding: '14px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {selectedEl && selectedEl.type !== 'text' && selectedEl.type !== 'image' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>FILL COLOR</label>
                    <RecentColorsRow onPick={c => handleElementChange({ ...selectedEl, fill: c })} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onClick={() => { handleElementChange({ ...selectedEl, fill: hex }); pickColor(hex, () => {}); }}
                          style={{ width: 24, height: 24, borderRadius: 5, background: hex, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
                      ))}
                      <input type="color" value={selectedEl.fill || '#ffffff'}
                        onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                        onBlur={e => { pushHistory(); pickColor(e.target.value, () => {}); }}
                        style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1 }} />
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>OPACITY</label>
                    <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity !== undefined ? selectedEl.opacity : 1}
                      onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                      onMouseUp={() => pushHistory()} style={{ width: '100%' }} />
                    <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{Math.round((selectedEl.opacity !== undefined ? selectedEl.opacity : 1) * 100)}%</div>
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
                  { label: 'Brightness', value: bgBrightness, min: -1, max: 1, step: 0.05, set: setBgBrightness },
                  { label: 'Contrast',   value: bgContrast,   min: -100, max: 100, step: 5, set: setBgContrast },
                  { label: 'Saturation', value: bgSaturation, min: -1, max: 1, step: 0.05, set: setBgSaturation },
                ].map(({ label, value, min, max, step, set }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{value}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={value}
                      onChange={e => set(parseFloat(e.target.value))}
                      onMouseUp={() => { setBgFilter('normal'); pushHistory(); }}
                      style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto', background: t.bg, position: 'relative' }}>
          <div style={{ position: 'relative', width: stageDisplayW, height: stageDisplayH, flexShrink: 0 }}>
            <Stage
              ref={stageRef}
              width={canvasSize.w}
              height={canvasSize.h}
              scaleX={stageScale}
              scaleY={stageScale}
              style={{ borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.3)', display: 'block', width: stageDisplayW, height: stageDisplayH }}
              onClick={e => {
                if (e.target === e.target.getStage()) { setSelectedId(null); setShowShadowPanel(false); setShowOutlinePanel(false); }
              }}
            >
              {/* Layer 1: Background */}
              <Layer>
                {bgType === 'color' ? (
                  <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill={bgColor} onClick={() => setSelectedId('__bg__')} />
                ) : bgImageUrl ? (
                  <BgImage url={bgImageUrl} filter={bgFilter} brightness={bgBrightness} contrast={bgContrast} saturation={bgSaturation}
                    stageW={canvasSize.w} stageH={canvasSize.h} onClick={() => setSelectedId('__bg__')} isSelected={selectedId === '__bg__'} />
                ) : (
                  <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill="#1a1a22" />
                )}
              </Layer>

              {/* Layer 2: Content */}
              <Layer>
                {elements.map(el => (
                  el.type === 'image'
                    ? <ImageNode
                        key={el.id}
                        el={el}
                        isSelected={selectedId === el.id}
                        onSelect={setSelectedId}
                        onChange={handleElementChange}
                        onDragMove={computeSnap}
                        onSnapClear={clearSnapGuides}
                        locked={lockedIds.has(el.id)}
                        hidden={hiddenIds.has(el.id)}
                      />
                    : <ContentNode
                        key={el.id}
                        el={el}
                        isSelected={selectedId === el.id}
                        onSelect={setSelectedId}
                        onChange={handleElementChange}
                        stageW={canvasSize.w}
                        stageH={canvasSize.h}
                        onDblClick={startEditText}
                        onDragMove={computeSnap}
                        onSnapClear={clearSnapGuides}
                        locked={lockedIds.has(el.id)}
                        hidden={hiddenIds.has(el.id)}
                      />
                ))}
              </Layer>

              {/* Layer 3: Transformer + snap guides */}
              <Layer ref={trLayerRef}>
                <TransformerLayer
                  selectedId={selectedId}
                  elements={elements}
                  stageRef={stageRef}
                  snapGuides={snapGuides}
                  stageScale={stageScale}
                  canvasW={canvasSize.w}
                  canvasH={canvasSize.h}
                />
              </Layer>
            </Stage>

            {/* Inline text textarea */}
            {editingTextId && (
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
          </div>
        </div>

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
                    <button onClick={() => { pushHistory(); setBgType('color'); setBgImageUrl(null); setBgSource(null); setBgSourceId(null); }}
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

                    <button onClick={() => { pushHistory(); setElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); }}
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
    </div>
  );
}
