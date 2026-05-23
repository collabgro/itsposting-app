import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Stage, Layer, Rect, Image as KonvaImage, Text, Circle, Line, Transformer } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useTheme } from '../../lib/theme';
import { studioAPI, socialAPI } from '../../lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_SIZES = [
  { id: 'ig_portrait', label: 'Instagram Portrait', w: 1080, h: 1350 },
  { id: 'ig_square',   label: 'Instagram Square',   w: 1080, h: 1080 },
  { id: 'ig_story',    label: 'Instagram Story',    w: 1080, h: 1920 },
  { id: 'fb_post',     label: 'Facebook Post',       w: 1200, h: 630  },
  { id: 'google_biz',  label: 'Google Business',     w: 720,  h: 720  },
];

const FONTS = ['Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Open Sans'];

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

// ─── Sub-components ──────────────────────────────────────────────────────────

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

function ContentNode({ el, isSelected, onSelect, onChange, stageW, stageH, onDblClick }) {
  const shapeRef = useRef(null);

  const handleDragEnd = (e) => {
    onChange({ ...el, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    if (el.type === 'text') {
      onChange({
        ...el,
        x: node.x(), y: node.y(),
        width: Math.max(20, node.width() * node.scaleX()),
        scaleX: 1, scaleY: 1,
        rotation: node.rotation(),
      });
    } else {
      onChange({
        ...el,
        x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * node.scaleX()),
        height: Math.max(5, node.height() * node.scaleY()),
        scaleX: 1, scaleY: 1,
        rotation: node.rotation(),
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
    draggable: true,
    onClick: () => onSelect(el.id),
    onTap: () => onSelect(el.id),
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
      fill={el.fill || '#ffffff'}
      width={el.width || 400}
      align={el.align || 'center'}
      visible={el.visible !== false}
      onDblClick={() => onDblClick(el.id)}
      onDblTap={() => onDblClick(el.id)}
    />
  );

  if (el.type === 'rect') return (
    <Rect
      {...common}
      width={el.width || 200}
      height={el.height || 100}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
      cornerRadius={el.cornerRadius || 0}
      opacity={el.opacity !== undefined ? el.opacity : 1}
    />
  );

  if (el.type === 'circle') return (
    <Circle
      {...common}
      radius={el.radius || 60}
      fill={el.fill || 'rgba(255,255,255,0.2)'}
      opacity={el.opacity !== undefined ? el.opacity : 1}
    />
  );

  if (el.type === 'line') return (
    <Line
      {...common}
      points={el.points || [0, 0, el.width || 200, 0]}
      stroke={el.stroke || '#ffffff'}
      strokeWidth={el.strokeWidth || 3}
      opacity={el.opacity !== undefined ? el.opacity : 1}
    />
  );

  return null;
}

function TransformerLayer({ selectedId, elements, stageRef }) {
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
    <Transformer
      ref={trRef}
      enabledAnchors={isText
        ? ['middle-left', 'middle-right']
        : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
      }
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 5 || newBox.height < 5) return oldBox;
        return newBox;
      }}
    />
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

  // Undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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

  // ── Compute display scale ──────────────────────────────────────────────────
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
    if (activeLeftTool !== 'background') return;
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

  // ── Keyboard delete ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (editingTextId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && selectedId !== '__bg__') {
          pushHistory();
          setElements(prev => prev.filter(el => el.id !== selectedId));
          setSelectedId(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingTextId, history, historyIndex, elements]);

  // ── History helpers ────────────────────────────────────────────────────────
  function snapshot() {
    return {
      elements: JSON.parse(JSON.stringify(elements)),
      bgType, bgColor, bgImageUrl, bgSource, bgSourceId,
      bgFilter, bgBrightness, bgContrast, bgSaturation,
    };
  }

  function pushHistory() {
    const snap = snapshot();
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, snap].slice(-50);
    });
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
      fill: '#ffffff', width: 400, align: 'center',
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addRect() {
    pushHistory();
    const el = {
      id: uid(), type: 'rect',
      x: canvasSize.w / 2 - 100, y: canvasSize.h / 2 - 50,
      width: 200, height: 100,
      fill: 'rgba(255,255,255,0.15)',
      cornerRadius: 12, opacity: 1,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addCircle() {
    pushHistory();
    const el = {
      id: uid(), type: 'circle',
      x: canvasSize.w / 2, y: canvasSize.h / 2,
      radius: 80, fill: 'rgba(255,255,255,0.15)', opacity: 1,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  }

  function addLine() {
    pushHistory();
    const el = {
      id: uid(), type: 'line',
      x: canvasSize.w / 2 - 150, y: canvasSize.h / 2,
      points: [0, 0, 300, 0],
      stroke: '#ffffff', strokeWidth: 4, opacity: 1,
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

  // ── Text inline editing ────────────────────────────────────────────────────
  function startEditText(id) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#${id}`);
    if (!node) return;
    const absPos = node.getAbsolutePosition();
    const scale = stageScale;
    setTextareaPos({
      x: absPos.x * scale,
      y: absPos.y * scale,
      w: (el.width || 400) * scale,
      fontSize: (el.fontSize || 36) * scale,
    });
    setTextareaValue(el.text || '');
    setEditingTextId(id);
    setElements(prev => prev.map(e => e.id === id ? { ...e, visible: false } : e));
  }

  function commitTextEdit() {
    if (!editingTextId) return;
    pushHistory();
    setElements(prev => prev.map(e =>
      e.id === editingTextId
        ? { ...e, text: textareaValue, visible: true }
        : e
    ));
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
      const dataUrl = stageRef.current.toDataURL({
        mimeType: 'image/jpeg',
        quality: 0.9,
        pixelRatio: canvasSize.w / stageRef.current.width(),
      });
      if (trLayerRef.current) trLayerRef.current.show();

      const snap = snapshot();
      const data = await studioAPI.save({
        imageDataUrl: dataUrl,
        canvasJson: snap,
        title: titleForSave,
        canvasWidth: canvasSize.w,
        canvasHeight: canvasSize.h,
        backgroundSource: bgSource,
        backgroundId: bgSourceId,
      });
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
      await studioAPI.postCreation(savedCreationId, {
        caption: postCaption,
        platforms: postPlatforms,
        scheduleMode: 'now',
      });
      setPostSuccess(true);
    } catch (err) {
      setPostError(err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  // ── Selected element for right panel ──────────────────────────────────────
  const selectedEl = elements.find(e => e.id === selectedId);

  // ── Filtered photos by tab ─────────────────────────────────────────────────
  const stockPhotos = bgPhotos.filter(p => p.source === 'stock');
  const myPhotos    = bgPhotos.filter(p => p.source === 'mine');
  const displayedPhotos = bgTab === 'stock' ? stockPhotos : myPhotos;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', overflow: 'hidden', background: t.bg }}>

      {/* ── Toolbar ── */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: `1px solid ${t.border}`, background: t.card, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/media?tab=templates')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          ← Templates
        </button>

        <select value={canvasSizeId} onChange={e => setCanvasSizeId(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, cursor: 'pointer' }}>
          {CANVAS_SIZES.map(s => (
            <option key={s.id} value={s.id}>{s.label} ({s.w}×{s.h})</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={undo} disabled={historyIndex < 0}
            title="Undo (Ctrl+Z)"
            style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: historyIndex < 0 ? t.textMuted : t.text, fontSize: 13, cursor: historyIndex < 0 ? 'not-allowed' : 'pointer' }}>
            ⟲
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: historyIndex >= history.length - 1 ? t.textMuted : t.text, fontSize: 13, cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer' }}>
            ⟳
          </button>
        </div>

        <input
          value={titleForSave}
          onChange={e => setTitleForSave(e.target.value)}
          placeholder="Template title..."
          style={{ flex: 1, maxWidth: 220, padding: '6px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none' }}
        />

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save & Post'}
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ width: 260, borderRight: `1px solid ${t.border}`, background: t.card, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {/* Tool icons */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            {[
              { id: 'background', label: 'BG' },
              { id: 'text',       label: 'T'  },
              { id: 'shapes',     label: '◻'  },
              { id: 'filters',    label: '◑'  },
              { id: 'adjust',     label: '⊹'  },
            ].map(tool => (
              <button key={tool.id} onClick={() => setActiveLeftTool(tool.id)}
                style={{ flex: 1, padding: '10px 0', border: 'none', background: activeLeftTool === tool.id ? t.primaryBg : 'transparent', color: activeLeftTool === tool.id ? t.primary : t.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer', borderBottom: activeLeftTool === tool.id ? `2px solid ${t.primary}` : '2px solid transparent' }}>
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
                      <button key={hex} onClick={() => { pushHistory(); setBgType('color'); setBgColor(hex); }}
                        style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: bgType === 'color' && bgColor === hex ? `3px solid ${t.primary}` : `2px solid ${t.border}`, cursor: 'pointer' }} />
                    ))}
                    <input type="color" value={bgColor}
                      onChange={e => { pushHistory(); setBgType('color'); setBgColor(e.target.value); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2 }}
                      title="Custom color" />
                  </div>
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
                  ) : displayedPhotos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: t.textMuted, padding: '20px 0', fontSize: 12 }}>
                      {bgTab === 'mine' ? 'No uploaded images yet' : 'No stock photos available'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {displayedPhotos.map(photo => (
                        <div key={photo.id} onClick={() => selectBgPhoto(photo)}
                          style={{ borderRadius: 7, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${bgImageUrl === photo.url ? t.primary : t.border}`, transition: 'border-color 120ms' }}>
                          <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
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
                        onMouseUp={() => pushHistory()}
                        style={{ width: '100%' }} />
                      <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{selectedEl.fontSize || 36}px</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>COLOR</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {COLOR_PALETTE.map(hex => (
                          <button key={hex} onClick={() => handleElementChange({ ...selectedEl, fill: hex })}
                            style={{ width: 24, height: 24, borderRadius: 5, background: hex, border: selectedEl.fill === hex ? `3px solid ${t.primary}` : `1px solid ${t.border}`, cursor: 'pointer' }} />
                        ))}
                        <input type="color" value={selectedEl.fill || '#ffffff'}
                          onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                          onBlur={() => pushHistory()}
                          style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'B', style: 'bold' },
                        { label: 'I', style: 'italic' },
                      ].map(({ label, style }) => {
                        const active = (selectedEl.fontStyle || '').includes(style);
                        return (
                          <button key={style} onClick={() => {
                            const cur = selectedEl.fontStyle || 'normal';
                            const next = active
                              ? cur.replace(style, '').trim() || 'normal'
                              : (cur === 'normal' ? style : `${cur} ${style}`);
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
                  </div>
                )}
              </div>
            )}

            {/* SHAPES */}
            {activeLeftTool === 'shapes' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Rectangle', fn: addRect },
                  { label: 'Circle', fn: addCircle },
                  { label: 'Line', fn: addLine },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    style={{ padding: '14px 0', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                    {label}
                  </button>
                ))}

                {selectedEl && selectedEl.type !== 'text' && (
                  <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>FILL COLOR</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {COLOR_PALETTE.map(hex => (
                        <button key={hex} onClick={() => handleElementChange({ ...selectedEl, fill: hex })}
                          style={{ width: 24, height: 24, borderRadius: 5, background: hex, border: `1px solid ${t.border}`, cursor: 'pointer' }} />
                      ))}
                      <input type="color" value={selectedEl.fill || '#ffffff'}
                        onChange={e => updateElement({ ...selectedEl, fill: e.target.value })}
                        onBlur={() => pushHistory()}
                        style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 1 }} />
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>OPACITY</label>
                    <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity !== undefined ? selectedEl.opacity : 1}
                      onChange={e => updateElement({ ...selectedEl, opacity: parseFloat(e.target.value) })}
                      onMouseUp={() => pushHistory()}
                      style={{ width: '100%' }} />
                    <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{Math.round((selectedEl.opacity !== undefined ? selectedEl.opacity : 1) * 100)}%</div>
                  </div>
                )}
              </div>
            )}

            {/* FILTERS */}
            {activeLeftTool === 'filters' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Filter Presets</div>
                {bgType !== 'image' && (
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background first</div>
                )}
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
                {bgType !== 'image' && (
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Select a photo background to adjust</div>
                )}
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
                if (e.target === e.target.getStage()) setSelectedId(null);
              }}
            >
              {/* Layer 1: Background */}
              <Layer>
                {bgType === 'color' ? (
                  <Rect
                    x={0} y={0}
                    width={canvasSize.w} height={canvasSize.h}
                    fill={bgColor}
                    onClick={() => setSelectedId('__bg__')}
                  />
                ) : bgImageUrl ? (
                  <BgImage
                    url={bgImageUrl}
                    filter={bgFilter}
                    brightness={bgBrightness}
                    contrast={bgContrast}
                    saturation={bgSaturation}
                    stageW={canvasSize.w}
                    stageH={canvasSize.h}
                    onClick={() => setSelectedId('__bg__')}
                    isSelected={selectedId === '__bg__'}
                  />
                ) : (
                  <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill="#1a1a22" />
                )}
              </Layer>

              {/* Layer 2: Content */}
              <Layer>
                {elements.map(el => (
                  <ContentNode
                    key={el.id}
                    el={el}
                    isSelected={selectedId === el.id}
                    onSelect={setSelectedId}
                    onChange={handleElementChange}
                    stageW={canvasSize.w}
                    stageH={canvasSize.h}
                    onDblClick={startEditText}
                  />
                ))}
              </Layer>

              {/* Layer 3: Transformer */}
              <Layer ref={trLayerRef}>
                <TransformerLayer
                  selectedId={selectedId}
                  elements={elements}
                  stageRef={stageRef}
                />
              </Layer>
            </Stage>

            {/* Inline text textarea overlay */}
            {editingTextId && (
              <textarea
                autoFocus
                value={textareaValue}
                onChange={e => setTextareaValue(e.target.value)}
                onBlur={commitTextEdit}
                onKeyDown={e => { if (e.key === 'Escape') commitTextEdit(); }}
                style={{
                  position: 'absolute',
                  left: textareaPos.x,
                  top: textareaPos.y,
                  width: textareaPos.w,
                  fontSize: textareaPos.fontSize,
                  fontFamily: elements.find(e => e.id === editingTextId)?.fontFamily || 'Inter',
                  color: elements.find(e => e.id === editingTextId)?.fill || '#ffffff',
                  background: 'rgba(0,0,0,0.4)',
                  border: `2px solid ${t.primary}`,
                  borderRadius: 4,
                  padding: 4,
                  outline: 'none',
                  resize: 'none',
                  overflow: 'hidden',
                  zIndex: 100,
                  lineHeight: 1.3,
                  minHeight: 40,
                }}
                rows={3}
              />
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ width: 220, borderLeft: `1px solid ${t.border}`, background: t.card, padding: 14, overflowY: 'auto', flexShrink: 0 }}>
          {!selectedId && (
            <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', paddingTop: 40 }}>Click an element to edit it</div>
          )}

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

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>POSITION X</label>
                <input type="number" value={Math.round(selectedEl.x)}
                  onChange={e => updateElement({ ...selectedEl, x: parseInt(e.target.value) || 0 })}
                  onBlur={() => pushHistory()}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 4 }}>POSITION Y</label>
                <input type="number" value={Math.round(selectedEl.y)}
                  onChange={e => updateElement({ ...selectedEl, y: parseInt(e.target.value) || 0 })}
                  onBlur={() => pushHistory()}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 12 }} />
              </div>

              <button onClick={() => { pushHistory(); setElements(prev => prev.filter(e => e.id !== selectedId)); setSelectedId(null); }}
                style={{ width: '100%', padding: '7px 0', marginTop: 8, borderRadius: 7, border: `1px solid rgba(239,68,68,0.3)`, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Delete Element
              </button>
            </div>
          )}
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
                <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)} rows={3}
                  placeholder="Add a caption..."
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

                {postError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {postError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPostModalOpen(false)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: t.input, color: t.text, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
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
