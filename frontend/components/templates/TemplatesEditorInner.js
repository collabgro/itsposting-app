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

const SNAP_THRESHOLD = 5;

function emptyPage() {
  return {
    id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    elements: [],
    bgType: 'color', bgColor: '#1a1a22',
    bgImageUrl: null, bgSource: null, bgSourceId: null,
    bgFilter: 'normal', bgBrightness: 0, bgContrast: 0, bgSaturation: 0,
    lockedIds: [], hiddenIds: [],
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
      onClick={(e) => !locked && onSelect(el.id, e)}
      onTap={(e) => !locked && onSelect(el.id, e)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? '#00C4CC' : undefined}
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
    onClick: (e) => !locked && onSelect(el.id, e),
    onTap: (e) => !locked && onSelect(el.id, e),
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    stroke: isSelected ? '#00C4CC' : undefined,
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

function TransformerLayer({ selectedIds, elements, stageRef, snapGuides, stageScale, canvasW, canvasH }) {
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
  const [clipboard, setClipboard] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, elementId } | null
  const [snapGuides, setSnapGuides] = useState({ v: [], h: [] });
  const [rightTab, setRightTab] = useState('properties');
  const [recentColors, setRecentColors] = useState([]);
  const [showShadowPanel, setShowShadowPanel] = useState(false);
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);
  const [imgTab, setImgTab] = useState('stock');

  // UI
  const [activeLeftTool, setActiveLeftTool] = useState('background');
  const [panelOpen, setPanelOpen] = useState(true);
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

  // Canvas display scale
  const containerRef = useRef(null);
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
        const sel = elements.find(el => el.id === selectedId);
        if (sel) setClipboard(JSON.parse(JSON.stringify(sel)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard) {
        const el = { ...JSON.parse(JSON.stringify(clipboard)), id: uid(), x: clipboard.x + 20, y: clipboard.y + 20 };
        pushHistory();
        patchElements(prev => [...prev, el]);
        setSelectedId(el.id);
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

      if (selectedId && selectedId !== '__bg__') {
        const NUDGE = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(selectedId, -NUDGE, 0); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudge(selectedId,  NUDGE, 0); return; }
        if (e.key === 'ArrowUp')    { e.preventDefault(); nudge(selectedId, 0, -NUDGE); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); nudge(selectedId, 0,  NUDGE); return; }
      }

      if (e.key === 'Escape') {
        clearSelection();
        setShowShadowPanel(false);
        setShowOutlinePanel(false);
        setCtxMenu(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedIds, editingTextId, history, historyIndex, elements, clipboard]);

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

  function addText() {
    pushHistory();
    const el = {
      id: uid(), type: 'text',
      x: canvasSize.w / 2 - 200, y: canvasSize.h / 2 - 30,
      text: 'Double-click to edit',
      fontSize: 48, fontFamily: 'Inter', fontStyle: 'bold',
      fill: '#ffffff', width: 400, align: 'center', opacity: 1,
    };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRect() {
    pushHistory();
    const el = { id: uid(), type: 'rect', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 50, width: 200, height: 100, fill: 'rgba(255,255,255,0.15)', cornerRadius: 12, opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCircle() {
    pushHistory();
    const el = { id: uid(), type: 'circle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addLine() {
    pushHistory();
    const el = { id: uid(), type: 'line', x: canvasSize.w / 2 - 150, y: canvasSize.h / 2, points: [0, 0, 300, 0], stroke: '#ffffff', strokeWidth: 4, opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addTriangle() {
    pushHistory();
    const el = { id: uid(), type: 'triangle', x: canvasSize.w / 2, y: canvasSize.h / 2, radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStar() {
    pushHistory();
    const el = { id: uid(), type: 'star', x: canvasSize.w / 2, y: canvasSize.h / 2, outerRadius: 80, innerRadius: 35, fill: 'rgba(255,255,255,0.15)', opacity: 1 };
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addArrow() {
    pushHistory();
    const el = { id: uid(), type: 'arrow', x: canvasSize.w / 2 - 100, y: canvasSize.h / 2, width: 200, fill: '#ffffff', strokeWidth: 4, opacity: 1 };
    patchElements(prev => [...prev, el]);
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
    patchElements(prev => [...prev, el]);
    setSelectedId(el.id);
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
      const data = await studioAPI.save({ imageDataUrl: dataUrl, canvasJson: snap, title: titleForSave, canvasWidth: canvasSize.w, canvasHeight: canvasSize.h, backgroundSource: currentPage.bgSource, backgroundId: currentPage.bgSourceId });
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

  function handleToolClick(toolId) {
    if (activeLeftTool === toolId && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveLeftTool(toolId);
      setPanelOpen(true);
    }
  }

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

      {/* ── Contextual action bar (Canva-style) ── */}
      <div onClick={() => { setShowShadowPanel(false); setShowOutlinePanel(false); }}
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
          const isUpper  = selectedEl.textTransform === 'uppercase';
          const D = () => <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px', flexShrink: 0 }} />;
          const Btn = ({ label, active, onClick, extraStyle = {} }) => (
            <button onClick={onClick} style={{ height: 30, minWidth: 30, padding: '0 7px', border: 'none', borderRadius: 6, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.text, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 80ms', ...extraStyle }}>{label}</button>
          );
          return (
            <>
              {/* Text color swatch */}
              <div style={{ position: 'relative', width: 32, height: 30, flexShrink: 0 }} title="Text color">
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 20, height: 20, borderRadius: 3, background: selectedEl.fill || '#fff', border: '1.5px solid rgba(128,128,128,0.35)', pointerEvents: 'none' }} />
                <input type="color" value={selectedEl.fill || '#ffffff'}
                  onChange={e => pickColor(e.target.value, c => updateElement({ ...selectedEl, fill: c }))}
                  onBlur={() => pushHistory()}
                  style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </div>
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
              <Btn label="aA" active={isUpper} extraStyle={{ fontSize: 12, fontWeight: 500 }}
                onClick={() => handleElementChange({ ...selectedEl, textTransform: isUpper ? 'none' : 'uppercase' })} />
              <D />
              {/* Alignment */}
              {[['left','≡ L'],['center','≡ C'],['right','≡ R']].map(([a, lbl]) => (
                <Btn key={a} label={lbl} active={selectedEl.align === a} onClick={() => handleElementChange({ ...selectedEl, align: a })} />
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
              <D />
              {/* Opacity */}
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap' }}>Opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity??1}
                onChange={e => updateElement({...selectedEl, opacity:parseFloat(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:30, flexShrink:0 }}>{Math.round((selectedEl.opacity??1)*100)}%</span>
              <div style={{ flex: 1 }} />
              <D />
              <Btn label="Position" active={false} onClick={() => {}} extraStyle={{ color: t.textMuted }} />
              <Btn label="✦ Animate" active={false} onClick={() => {}} extraStyle={{ color: t.primary, fontWeight: 500 }} />
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
              <Btn label="⟺ Flip H" active={!!selectedEl.flipH} onClick={flipH} />
              <Btn label="⇅ Flip V" active={!!selectedEl.flipV} onClick={flipV} />
              <D />
              <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
              <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                onMouseUp={() => pushHistory()} style={{ width:70, flexShrink:0 }} />
              <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
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
              <Btn label={lockedIds.has(selectedEl.id)?'🔒':'🔓'} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
              <div style={{ flex:1 }} />
              <D />
              <Btn label="Position" active={false} onClick={() => {}} />
              <Btn label="✦ Animate" active={false} onClick={() => {}} />
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
              <div style={{ position:'relative', width:32, height:30, flexShrink:0 }} title={['line','arrow'].includes(selectedEl.type) ? 'Stroke color' : 'Fill color'}>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:20, height:20, borderRadius:3, background:fillVal, border:'1.5px solid rgba(128,128,128,0.35)', pointerEvents:'none' }} />
                <input type="color" value={fillVal}
                  onChange={e => pickColor(e.target.value, c => updateElement({...selectedEl, [fillKey]: c}))}
                  onBlur={() => pushHistory()}
                  style={{ opacity:0, position:'absolute', inset:0, width:'100%', height:'100%', cursor:'pointer' }} />
              </div>
              {selectedEl.type === 'rect' && <>
                <D />
                <span style={{ fontSize:11, color:t.textMuted, whiteSpace:'nowrap', flexShrink:0 }}>Radius</span>
                <input type="range" min={0} max={200} value={selectedEl.cornerRadius||0}
                  onChange={e => updateElement({...selectedEl, cornerRadius:parseInt(e.target.value)})}
                  onMouseUp={() => pushHistory()} style={{ width:60, flexShrink:0 }} />
                <span style={{ fontSize:11, color:t.textMuted, minWidth:24, flexShrink:0 }}>{selectedEl.cornerRadius||0}</span>
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
              <Btn label={lockedIds.has(selectedEl.id)?'🔒':'🔓'} active={lockedIds.has(selectedEl.id)} onClick={() => toggleLocked(selectedEl.id)} />
              <div style={{ flex:1 }} />
              <D />
              <Btn label="Position" active={false} onClick={() => {}} />
              <Btn label="✦ Animate" active={false} onClick={() => {}} />
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
            { id: 'background', icon: '◻', label: 'Design'   },
            { id: 'text',       icon: 'T', label: 'Text'      },
            { id: 'images',     icon: '🖼', label: 'Images'   },
            { id: 'shapes',     icon: '✦', label: 'Elements'  },
            { id: 'filters',    icon: '◑', label: 'Filters'   },
            { id: 'adjust',     icon: '⊹', label: 'Adjust'    },
          ].map(tool => (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              style={{
                width: 60, padding: '10px 0 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: activeLeftTool === tool.id && panelOpen ? t.primaryBg : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: activeLeftTool === tool.id && panelOpen ? t.primary : t.textMuted,
                fontSize: 10, fontWeight: activeLeftTool === tool.id && panelOpen ? 600 : 400,
                transition: 'all 150ms ease',
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
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, minWidth: 320 }}>

            {/* BACKGROUND */}
            {activeLeftTool === 'background' && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Solid Color</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
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

          </div>
          )}
        </div>

        {/* ── Canvas area — multi-page vertical scroll ── */}
        <style>{`
          @keyframes ftb-in {
            from { opacity:0; transform:translateX(-50%) translateY(6px) scale(0.94); }
            to   { opacity:1; transform:translateX(-50%) translateY(0)   scale(1);    }
          }
        `}</style>
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', background: t.bg, padding: '24px 0', position: 'relative' }}>
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
                  <div style={{ width: stageDisplayW, display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
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

                  <div
                    style={{
                      position: 'relative', width: stageDisplayW, height: stageDisplayH, flexShrink: 0,
                      outline: isActive ? '2px solid #00C4CC' : '2px solid transparent',
                      borderRadius: 8, cursor: isActive ? 'default' : 'pointer',
                      opacity: page.hidden ? 0.35 : 1,
                    }}
                    onClick={!isActive ? () => { setActivePage(pageIdx); setSelectedId(null); } : undefined}
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
                        {pageBgType === 'color' ? (
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

                      {/* Layer 2: Content */}
                      <Layer>
                        {pageElements.map(el => (
                          el.type === 'image'
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
                              />
                        ))}
                      </Layer>

                      {/* Layer 3: Transformer + snap guides (active page only) */}
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
                          />
                        </Layer>
                      )}

                      {/* Layer 4: Rubber-band selection rect */}
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
                        { icon: '↑', title: 'Bring forward',       fn: () => bringForward(selectedId) },
                        { icon: '↓', title: 'Send backward',       fn: () => sendBackward(selectedId) },
                        { sep: true },
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
                                title={b.title}
                                onMouseDown={e => { e.stopPropagation(); b.fn(); }}
                                style={{
                                  width: 30, height: 30, border: 'none', borderRadius: 6,
                                  background: 'transparent', cursor: 'pointer', fontSize: 14,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: b.danger ? '#ef4444' : '#333',
                                  transition: 'background 80ms',
                                  flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = b.danger ? 'rgba(239,68,68,0.09)' : '#f0f0f0'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                {b.icon}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Add page button */}
            <button onClick={addPage} style={{ marginTop: 4, padding: '10px 28px', borderRadius: 8, border: `2px dashed ${t.border}`, background: 'none', color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em' }}>
              + Add Page
            </button>
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

      {/* ── Bottom status bar ── */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 16px', borderTop: `1px solid ${t.border}`,
        background: t.card, flexShrink: 0, zIndex: 8,
        fontSize: 12, color: t.textMuted, userSelect: 'none',
      }}>
        {/* Zoom out */}
        <button onClick={zoomOut} title="Zoom out (−)"
          style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          −
        </button>

        {/* Zoom slider */}
        <input type="range" min={25} max={300} step={25}
          value={Math.round(zoomFactor * 100)}
          onChange={e => setZoomFactor(parseInt(e.target.value) / 100)}
          style={{ width: 80, flexShrink: 0, cursor: 'pointer', accentColor: '#00C4CC' }} />

        {/* Zoom in */}
        <button onClick={zoomIn} title="Zoom in (+)"
          style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 16, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          +
        </button>

        {/* Zoom % pill — click to reset to 100% */}
        <button onClick={() => setZoomFactor(1)} title="Reset zoom to 100%"
          style={{ minWidth: 46, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 12, cursor: 'pointer',
            padding: '0 7px', flexShrink: 0, fontWeight: 500 }}>
          {Math.round(zoomFactor * 100)}%
        </button>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 6px', flexShrink: 0 }} />

        {/* Page counter */}
        <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Page {activePage + 1} / {pages.length}
        </span>

        {/* Spacer pushes right-side items to the far right */}
        <div style={{ flex: 1 }} />

        {/* Canvas dimensions */}
        <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {canvasSize.w} × {canvasSize.h} px
        </span>

        <div style={{ width: 1, height: 18, background: t.border, margin: '0 6px', flexShrink: 0 }} />

        {/* Notes placeholder */}
        <button title="Notes (coming soon)"
          style={{ height: 26, padding: '0 9px', border: 'none', borderRadius: 5,
            background: 'transparent', color: t.textMuted, fontSize: 12, cursor: 'default' }}>
          Notes
        </button>

        {/* Fullscreen */}
        <button title="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}
          style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: 5,
            background: t.input, color: t.text, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ⛶
        </button>
      </div>

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
          const p = { ...JSON.parse(JSON.stringify(clipboard)), id: `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, x: clipboard.x + 20, y: clipboard.y + 20 };
          pushHistory(); patchElements(prev => [...prev, p]); setSelectedId(p.id);
        };

        const ITEMS = [
          el && { label: 'Copy',          shortcut: 'Ctrl+C', fn: () => setClipboard(JSON.parse(JSON.stringify(el))) },
          clipboard && { label: 'Paste', shortcut: 'Ctrl+V', fn: pasteEl },
          el && { label: 'Duplicate',     shortcut: 'Ctrl+D', fn: dupEl },
          (el || clipboard) && { sep: true },
          el && { label: 'Bring Forward', shortcut: ']',      fn: () => bringForward(el.id) },
          el && { label: 'Send Backward', shortcut: '[',      fn: () => sendBackward(el.id) },
          el && { label: 'Bring to Front',shortcut: 'Shift+]',fn: () => bringToFront(el.id) },
          el && { label: 'Send to Back',  shortcut: 'Shift+[',fn: () => sendToBack(el.id) },
          el && { sep: true },
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
    </div>
  );
}
