import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../../lib/theme';
import { studioAPI, mediaAPI } from '../../lib/api';
import {
  IpArrowLeft, IpSave, IpDownload, IpDelete, IpClose,
  IpSparkle, IpVideo, IpPhoto, IpFilter, IpLoader, IpWarning,
  IpPlay,
} from '../icons';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
}

const ASPECT_DIMS = {
  '9:16': { label: '9:16 (Stories)', w: 9, h: 16 },
  '16:9': { label: '16:9 (YouTube)', w: 16, h: 9 },
  '1:1':  { label: '1:1 (Square)',   w: 1,  h: 1 },
  '4:5':  { label: '4:5 (Feed)',     w: 4,  h: 5 },
};

const FILTER_PRESETS = [
  { id: 'none',   label: 'Original', brightness: 0, contrast: 0, saturation: 0 },
  { id: 'warm',   label: 'Warm',     brightness: 0.05, contrast: 5, saturation: 20 },
  { id: 'cool',   label: 'Cool',     brightness: 0, contrast: 5, saturation: -10 },
  { id: 'vivid',  label: 'Vivid',    brightness: 0, contrast: 20, saturation: 40 },
  { id: 'faded',  label: 'Faded',    brightness: 0.1, contrast: -15, saturation: -20 },
  { id: 'bw',     label: 'B&W',      brightness: 0, contrast: 10, saturation: -100 },
  { id: 'moody',  label: 'Moody',    brightness: -0.05, contrast: 15, saturation: -15 },
];

const TRANSITION_TYPES = ['none', 'fade', 'dissolve', 'slide_left'];
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2];
const FONT_FAMILIES = ['Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Open Sans', 'sans-serif'];
const ANIM_IN_OPTIONS = ['none', 'fade_in', 'slide_up', 'slide_left', 'scale_up'];

// ─── Empty project factory ────────────────────────────────────────────────────

function emptyProject(aspectRatio = '9:16') {
  return { aspectRatio, fps: 30, clips: [], textElements: [], audioTracks: [] };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoEditorInner() {
  const t = useTheme();
  const router = useRouter();
  const { id: editId } = router.query;

  // ── Core state ──────────────────────────────────────────────────────────────
  const [project, setProject] = useState(emptyProject());
  const [title, setTitle] = useState('Untitled Video');
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null); // 'clip' | 'text' | 'audio'
  const [activeTool, setActiveTool] = useState('clips');
  const [zoom, setZoom] = useState(60); // px/sec
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportJobId, setExportJobId] = useState(null);
  const [exportStatus, setExportStatus] = useState(null); // 'rendering' | 'completed' | 'failed'
  const [exportUrl, setExportUrl] = useState(null);

  // ── Media library ───────────────────────────────────────────────────────────
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  // ── AI gen ──────────────────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Aspect ratio dropdown ───────────────────────────────────────────────────
  const [aspectOpen, setAspectOpen] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const animFrameRef = useRef(null);
  const playStartWallRef = useRef(0);
  const playStartHeadRef = useRef(0);
  const timelineRef = useRef(null);
  const previewRef = useRef(null);

  // ─── Computed ────────────────────────────────────────────────────────────────

  const totalDuration = useMemo(() => {
    if (!project.clips.length) return 0;
    const last = project.clips[project.clips.length - 1];
    return last.trackStart + last.duration;
  }, [project.clips]);

  const activeClipIndex = project.clips.findIndex(
    c => playhead >= c.trackStart && playhead < c.trackStart + c.duration
  );
  const activeClip = project.clips[activeClipIndex] || null;

  const visibleText = project.textElements.filter(
    te => playhead >= te.startTime && playhead <= te.endTime
  );

  const selectedClip = selectedTrack === 'clip'
    ? project.clips.find(c => c.id === selectedId) : null;
  const selectedText = selectedTrack === 'text'
    ? project.textElements.find(te => te.id === selectedId) : null;
  const selectedAudio = selectedTrack === 'audio'
    ? project.audioTracks.find(a => a.id === selectedId) : null;

  // ─── Aspect preview dimensions ────────────────────────────────────────────

  const previewContainerW = 260;
  const { w: aw, h: ah } = ASPECT_DIMS[project.aspectRatio] || ASPECT_DIMS['9:16'];
  const previewH = Math.round(previewContainerW * ah / aw);

  // ─── History ─────────────────────────────────────────────────────────────────

  // Refs keep mutate stable without stale-closure issues (React 18 safe)
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  const historyIndexRef = useRef(historyIndex);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const mutate = useCallback((updater) => {
    const prev = projectRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setProject(next);
    // History updates happen outside the setState updater — React 18 compliant
    setHistory(h => {
      const trimmed = h.slice(0, historyIndexRef.current + 1);
      return [...trimmed, JSON.stringify(next)].slice(-50);
    });
    setHistoryIndex(i => Math.min(i + 1, 49));
  }, []);

  // ─── Load existing project ────────────────────────────────────────────────

  useEffect(() => {
    if (!editId) return;
    studioAPI.getCreation(editId).then(data => {
      const c = data?.creation;
      if (c?.video_json) {
        setProject(c.video_json);
        setTitle(c.overlay_title || 'Untitled Video');
        if (c.output_url) setExportUrl(c.output_url);
        if (c.render_status === 'completed') setExportStatus('completed');
      }
    }).catch(() => {});
  }, [editId]);

  // ─── Load media library ───────────────────────────────────────────────────

  useEffect(() => {
    if (activeTool !== 'clips' && activeTool !== 'audio') return;
    if (mediaFiles.length) return;
    setMediaLoading(true);
    mediaAPI.getFiles({ limit: 60 }).then(d => {
      setMediaFiles(d?.files || []);
    }).catch(() => {}).finally(() => setMediaLoading(false));
  }, [activeTool]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
        splitClipAtPlayhead();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'ArrowLeft') {
        setPlayhead(p => Math.max(0, p - 0.1));
      } else if (e.key === 'ArrowRight') {
        setPlayhead(p => Math.min(totalDuration, p + 0.1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedTrack, totalDuration, historyIndex]);

  // ─── Playback loop ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    playStartWallRef.current = performance.now();
    playStartHeadRef.current = playhead;

    const tick = () => {
      const elapsed = (performance.now() - playStartWallRef.current) / 1000;
      const newHead = Math.min(playStartHeadRef.current + elapsed, totalDuration || 0.01);
      setPlayhead(newHead);
      if (newHead < (totalDuration || 0.01)) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        setPlayhead(0);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  // ─── Video element sync ────────────────────────────────────────────────────

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeClip || activeClip.type !== 'video') return;
    const clipLocalTime = playhead - activeClip.trackStart + (activeClip.trimStart || 0);
    if (Math.abs(vid.currentTime - clipLocalTime) > 0.25) {
      vid.currentTime = clipLocalTime;
    }
  }, [activeClipIndex, Math.floor(playhead * 5)]);

  // ─── Poll export status ────────────────────────────────────────────────────

  useEffect(() => {
    if (!exportJobId) return;
    const interval = setInterval(async () => {
      try {
        const data = await studioAPI.getRenderStatus(exportJobId);
        if (data.status === 'completed') {
          setExportStatus('completed');
          setExportUrl(data.outputUrl);
          setExportJobId(null);
          setExporting(false);
        } else if (data.status === 'failed') {
          setExportStatus('failed');
          setExportJobId(null);
          setExporting(false);
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [exportJobId]);

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  function handleUndo() {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setProject(JSON.parse(history[newIndex]));
  }

  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setProject(JSON.parse(history[newIndex]));
  }

  // ─── Add clip from media library ──────────────────────────────────────────

  function addMediaClip(file) {
    const isVideo = file.file_type === 'video';
    const duration = isVideo ? (file.duration_seconds || 5) : 4;
    const trackStart = totalDuration;
    const clip = {
      id: nanoid(),
      type: isVideo ? 'video' : 'image',
      sourceUrl: file.url,
      thumbnailUrl: file.url,
      sourceMediaId: file.id,
      trackStart,
      trimStart: 0,
      trimEnd: duration,
      duration,
      volume: 1,
      speed: 1,
      filters: { brightness: 0, contrast: 0, saturation: 0 },
      transitionIn: { type: 'none', duration: 0.5 },
    };
    mutate(p => ({ ...p, clips: [...p.clips, clip] }));
    setSelectedId(clip.id);
    setSelectedTrack('clip');
  }

  // ─── Add color clip ───────────────────────────────────────────────────────

  function addColorClip() {
    const clip = {
      id: nanoid(), type: 'color', color: '#1a1a2e',
      trackStart: totalDuration, duration: 3,
      volume: 0, speed: 1,
      filters: { brightness: 0, contrast: 0, saturation: 0 },
      transitionIn: { type: 'none', duration: 0.5 },
    };
    mutate(p => ({ ...p, clips: [...p.clips, clip] }));
    setSelectedId(clip.id);
    setSelectedTrack('clip');
  }

  // ─── Delete selected item ─────────────────────────────────────────────────

  function deleteSelected() {
    if (!selectedId) return;
    if (selectedTrack === 'clip') {
      mutate(p => ({ ...p, clips: p.clips.filter(c => c.id !== selectedId) }));
    } else if (selectedTrack === 'text') {
      mutate(p => ({ ...p, textElements: p.textElements.filter(te => te.id !== selectedId) }));
    } else if (selectedTrack === 'audio') {
      mutate(p => ({ ...p, audioTracks: p.audioTracks.filter(a => a.id !== selectedId) }));
    }
    setSelectedId(null);
    setSelectedTrack(null);
  }

  // ─── Split clip at playhead ───────────────────────────────────────────────

  function splitClipAtPlayhead() {
    if (!selectedClip) return;
    const c = selectedClip;
    const localTime = playhead - c.trackStart;
    if (localTime <= 0 || localTime >= c.duration) return;

    const first = { ...c, duration: localTime, trimEnd: (c.trimStart || 0) + localTime };
    const second = {
      ...c, id: nanoid(),
      trackStart: c.trackStart + localTime,
      trimStart: (c.trimStart || 0) + localTime,
      duration: c.duration - localTime,
    };
    mutate(p => ({
      ...p,
      clips: p.clips.map(cl => cl.id === c.id ? first : cl)
        .reduce((acc, cl) => {
          acc.push(cl);
          if (cl.id === c.id) acc.push(second);
          return acc;
        }, []).filter((cl, i, arr) => arr.indexOf(cl) === i),
    }));
  }

  // ─── Update selected clip property ───────────────────────────────────────

  function updateClip(id, patch) {
    mutate(p => ({ ...p, clips: p.clips.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }

  function updateText(id, patch) {
    mutate(p => ({ ...p, textElements: p.textElements.map(te => te.id === id ? { ...te, ...patch } : te) }));
  }

  function updateAudio(id, patch) {
    mutate(p => ({ ...p, audioTracks: p.audioTracks.map(a => a.id === id ? { ...a, ...patch } : a) }));
  }

  // ─── Add text overlay ─────────────────────────────────────────────────────

  function addText() {
    const te = {
      id: nanoid(), text: 'Your Text Here',
      startTime: playhead, endTime: Math.min(playhead + 3, totalDuration || playhead + 3),
      xPercent: 50, yPercent: 80, fontSize: 40,
      fontFamily: 'Inter', fill: '#ffffff', fontStyle: 'bold',
      align: 'center', bgColor: null, bgOpacity: 0.6,
      animationIn: 'fade_in', animationOut: 'none',
    };
    mutate(p => ({ ...p, textElements: [...p.textElements, te] }));
    setSelectedId(te.id);
    setSelectedTrack('text');
    setActiveTool('text');
  }

  // ─── Add audio track ──────────────────────────────────────────────────────

  function addAudioTrack(file) {
    const at = {
      id: nanoid(), type: 'music',
      sourceUrl: file.url, sourceMediaId: file.id,
      volume: 0.5, startTime: 0, endTime: null, loop: false,
    };
    mutate(p => ({ ...p, audioTracks: [...p.audioTracks, at] }));
    setSelectedId(at.id);
    setSelectedTrack('audio');
  }

  // ─── AI generate clip ─────────────────────────────────────────────────────

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const data = await studioAPI.aiGenerateClip({
        prompt: aiPrompt,
        aspectRatio: project.aspectRatio,
        durationSeconds: 7,
      });
      const clip = {
        id: nanoid(),
        type: 'video',
        sourceUrl: data.clip.url,
        thumbnailUrl: data.clip.url,
        sourceMediaId: null,
        trackStart: totalDuration,
        trimStart: 0,
        trimEnd: data.clip.duration || 7,
        duration: data.clip.duration || 7,
        volume: 1, speed: 1,
        filters: { brightness: 0, contrast: 0, saturation: 0 },
        transitionIn: { type: 'fade', duration: 0.5 },
      };
      mutate(p => ({ ...p, clips: [...p.clips, clip] }));
      setSelectedId(clip.id);
      setSelectedTrack('clip');
      setAiPrompt('');
    } catch (err) {
      setAiError(err?.response?.data?.error || 'Generation failed. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function handleExport(quality = '720p') {
    if (!project.clips.length) return;
    setExporting(true);
    setExportStatus('rendering');
    setExportUrl(null);
    try {
      const data = await studioAPI.renderVideo({ videoJson: project, title, quality });
      setExportJobId(data.jobId);
    } catch (err) {
      setExportStatus('failed');
      setExporting(false);
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      await studioAPI.save({
        id: editId || undefined,
        title,
        creationType: 'video',
        videoJson: project,
      });
    } catch (err) {
      setSaveError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ─── Timeline drag (clip move) ────────────────────────────────────────────

  function onClipMouseDown(e, clip) {
    e.stopPropagation();
    setSelectedId(clip.id);
    setSelectedTrack('clip');

    const startX = e.clientX;
    const origTrackStart = clip.trackStart;

    const onMove = (me) => {
      const dx = me.clientX - startX;
      const newStart = Math.max(0, origTrackStart + dx / zoom);
      mutate(p => ({ ...p, clips: p.clips.map(c => c.id === clip.id ? { ...c, trackStart: newStart } : c) }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ─── Timeline drag (trim handles) ────────────────────────────────────────

  function onTrimLeftMouseDown(e, clip) {
    e.stopPropagation();
    const startX = e.clientX;
    const origTrackStart = clip.trackStart;
    const origTrimStart = clip.trimStart || 0;
    const origDuration = clip.duration;

    const onMove = (me) => {
      const dx = me.clientX - startX;
      const dSec = dx / zoom;
      const newTrimStart = Math.max(0, origTrimStart + dSec);
      const newTrackStart = origTrackStart + dSec;
      const newDuration = origDuration - dSec;
      if (newDuration < 0.5) return;
      mutate(p => ({
        ...p, clips: p.clips.map(c => c.id === clip.id
          ? { ...c, trackStart: newTrackStart, trimStart: newTrimStart, duration: newDuration }
          : c),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onTrimRightMouseDown(e, clip) {
    e.stopPropagation();
    const startX = e.clientX;
    const origTrimEnd = clip.trimEnd;
    const origDuration = clip.duration;

    const onMove = (me) => {
      const dx = me.clientX - startX;
      const dSec = dx / zoom;
      const newDuration = Math.max(0.5, origDuration + dSec);
      const newTrimEnd = origTrimEnd + dSec;
      mutate(p => ({
        ...p, clips: p.clips.map(c => c.id === clip.id
          ? { ...c, trimEnd: newTrimEnd, duration: newDuration }
          : c),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ─── Timeline seek on click ───────────────────────────────────────────────

  function onTimelineClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = timelineRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft - 80; // 80px label area
    const t2 = Math.max(0, x / zoom);
    setPlayhead(Math.min(t2, totalDuration));
    setPlaying(false);
  }

  // ─── Text overlay drag on preview ─────────────────────────────────────────

  function onTextMouseDown(e, te) {
    e.stopPropagation();
    setSelectedId(te.id);
    setSelectedTrack('text');
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = te.xPercent;
    const origY = te.yPercent;

    const onMove = (me) => {
      const dx = ((me.clientX - startX) / rect.width) * 100;
      const dy = ((me.clientY - startY) / rect.height) * 100;
      updateText(te.id, {
        xPercent: Math.max(0, Math.min(100, origX + dx)),
        yPercent: Math.max(0, Math.min(100, origY + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  const s = {
    toolbar: {
      height: 52, display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 16px', borderBottom: `1px solid ${t.border}`,
      background: t.card, flexShrink: 0,
    },
    body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
    leftPanel: {
      width: 220, borderRight: `1px solid ${t.border}`, background: t.card,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    },
    leftTabs: { display: 'flex', borderBottom: `1px solid ${t.border}`, flexShrink: 0 },
    leftTab: (active) => ({
      flex: 1, padding: '8px 2px', fontSize: 10, fontWeight: 600,
      color: active ? t.primary : t.textMuted,
      background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: `2px solid ${active ? t.primary : 'transparent'}`,
    }),
    leftContent: { flex: 1, overflowY: 'auto', padding: 10 },
    previewArea: {
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: t.bg, gap: 12, padding: '12px 0',
    },
    previewBox: {
      width: previewContainerW, height: previewH,
      background: '#000', borderRadius: 8, overflow: 'hidden',
      position: 'relative', flexShrink: 0,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    },
    rightPanel: {
      width: 220, borderLeft: `1px solid ${t.border}`, background: t.card,
      overflowY: 'auto', flexShrink: 0, padding: '12px 12px 60px',
    },
    timeline: {
      height: 160, borderTop: `1px solid ${t.border}`, background: t.bg,
      display: 'flex', flexShrink: 0,
    },
    timelineLabels: {
      width: 80, flexShrink: 0, borderRight: `1px solid ${t.border}`,
      background: t.card, display: 'flex', flexDirection: 'column',
    },
    timelineTrackLabel: {
      height: 44, borderBottom: `1px solid ${t.border}`, display: 'flex',
      alignItems: 'center', paddingLeft: 10, fontSize: 11,
      fontWeight: 600, color: t.textMuted,
    },
    timelineScroll: { flex: 1, overflowX: 'auto', position: 'relative' },
    timelineInner: { position: 'relative', height: '100%' },
  };

  // ─── Left panel content ───────────────────────────────────────────────────

  const videoFiles = mediaFiles.filter(f => f.file_type === 'video');
  const imageFiles = mediaFiles.filter(f => f.file_type === 'image');
  const audioFiles = mediaFiles.filter(f => f.file_type === 'audio');

  function LeftPanelContent() {
    if (activeTool === 'clips') {
      return (
        <div>
          <button onClick={addColorClip} style={{ width: '100%', marginBottom: 10, padding: '7px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            + Solid Color Clip
          </button>
          {mediaLoading && <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>Loading...</div>}
          {videoFiles.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Videos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {videoFiles.map(f => (
                  <div key={f.id} onClick={() => addMediaClip(f)}
                    title={f.file_name}
                    style={{ aspectRatio: '1', background: '#111', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${t.border}`, position: 'relative' }}>
                    <video src={f.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>
                      {f.duration_seconds ? `${Math.round(f.duration_seconds)}s` : 'vid'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {imageFiles.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Images</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {imageFiles.map(f => (
                  <div key={f.id} onClick={() => addMediaClip(f)}
                    title={f.file_name}
                    style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${t.border}` }}>
                    <img src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  </div>
                ))}
              </div>
            </>
          )}
          {!mediaLoading && videoFiles.length === 0 && imageFiles.length === 0 && (
            <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>
              No media yet.<br />Upload files in My Media.
            </div>
          )}
        </div>
      );
    }

    if (activeTool === 'text') {
      return (
        <div>
          <button onClick={addText} style={{ width: '100%', marginBottom: 12, padding: '9px 0', background: t.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Add Text
          </button>
          {project.textElements.length === 0
            ? <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>No text overlays yet.</div>
            : project.textElements.map(te => (
              <div key={te.id} onClick={() => { setSelectedId(te.id); setSelectedTrack('text'); }}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${selectedId === te.id ? t.primary : t.border}`, background: t.input, cursor: 'pointer', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.text}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{fmtTime(te.startTime)} → {fmtTime(te.endTime)}</div>
              </div>
            ))
          }
        </div>
      );
    }

    if (activeTool === 'audio') {
      return (
        <div>
          {mediaLoading && <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>Loading...</div>}
          {audioFiles.length > 0
            ? audioFiles.map(f => (
              <div key={f.id} onClick={() => addAudioTrack(f)}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, cursor: 'pointer', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{f.duration_seconds ? `${Math.round(f.duration_seconds)}s` : 'audio'}</div>
              </div>
            ))
            : !mediaLoading && <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>No audio files yet.<br />Upload in My Media.</div>
          }
        </div>
      );
    }

    if (activeTool === 'ai') {
      return (
        <div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
            Describe the clip you want to generate. Uses <strong>5 credits</strong>.
          </div>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g. A plumber fixing a burst pipe, dramatic lighting, close-up"
            rows={4}
            style={{ width: '100%', padding: '8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, resize: 'none', boxSizing: 'border-box' }}
          />
          {aiError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{aiError}</div>}
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating || !aiPrompt.trim()}
            style={{ width: '100%', marginTop: 8, padding: '9px 0', background: t.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: aiGenerating ? 'wait' : 'pointer', opacity: aiGenerating ? 0.7 : 1 }}>
            {aiGenerating ? 'Generating…' : 'Generate (5 credits)'}
          </button>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, textAlign: 'center' }}>
            Powered by Veo · Runway · Pika
          </div>
        </div>
      );
    }

    if (activeTool === 'filters') {
      return (
        <div>
          {!selectedClip
            ? <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>Select a clip to apply filters.</div>
            : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Filter Presets</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {FILTER_PRESETS.map(fp => {
                    const active = selectedClip.filters.brightness === fp.brightness && selectedClip.filters.saturation === fp.saturation;
                    return (
                      <button key={fp.id} onClick={() => updateClip(selectedClip.id, { filters: { brightness: fp.brightness, contrast: fp.contrast, saturation: fp.saturation } })}
                        style={{ padding: '7px 4px', borderRadius: 6, border: `1px solid ${active ? t.primary : t.border}`, background: active ? t.primaryBg : t.input, color: active ? t.primary : t.text, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {fp.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Manual Adjust</div>
                {[
                  { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01 },
                  { key: 'contrast',   label: 'Contrast',   min: -100, max: 100, step: 1 },
                  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                      <span style={{ fontSize: 11, color: t.text }}>{selectedClip.filters[key]}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={selectedClip.filters[key]}
                      onChange={e => updateClip(selectedClip.id, { filters: { ...selectedClip.filters, [key]: parseFloat(e.target.value) } })}
                      style={{ width: '100%' }} />
                  </div>
                ))}
              </>
            )
          }
        </div>
      );
    }

    return null;
  }

  // ─── Right panel ──────────────────────────────────────────────────────────

  function RightPanelContent() {
    if (selectedClip) {
      return (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>Clip Settings</div>

          <Label>Speed</Label>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {SPEED_OPTIONS.map(sp => (
              <button key={sp} onClick={() => updateClip(selectedClip.id, { speed: sp })}
                style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${selectedClip.speed === sp ? t.primary : t.border}`, background: selectedClip.speed === sp ? t.primaryBg : t.input, color: selectedClip.speed === sp ? t.primary : t.text, fontSize: 11, cursor: 'pointer' }}>
                {sp}×
              </button>
            ))}
          </div>

          {selectedClip.type === 'video' && (
            <>
              <Label>Volume</Label>
              <input type="range" min={0} max={1} step={0.05} value={selectedClip.volume}
                onChange={e => updateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                style={{ width: '100%', marginBottom: 12 }} />
            </>
          )}

          <Label>Transition In</Label>
          <select value={selectedClip.transitionIn?.type || 'none'}
            onChange={e => updateClip(selectedClip.id, { transitionIn: { ...selectedClip.transitionIn, type: e.target.value } })}
            style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {TRANSITION_TYPES.map(tt => <option key={tt} value={tt}>{tt}</option>)}
          </select>

          {selectedClip.transitionIn?.type !== 'none' && (
            <>
              <Label>Transition Duration (s)</Label>
              <input type="number" min={0.1} max={2} step={0.1} value={selectedClip.transitionIn?.duration || 0.5}
                onChange={e => updateClip(selectedClip.id, { transitionIn: { ...selectedClip.transitionIn, duration: parseFloat(e.target.value) } })}
                style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />
            </>
          )}

          {selectedClip.type === 'color' && (
            <>
              <Label>Color</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input type="color" value={selectedClip.color || '#000000'}
                  onChange={e => updateClip(selectedClip.id, { color: e.target.value })}
                  style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: t.text }}>{selectedClip.color || '#000000'}</span>
              </div>
              <Label>Duration (s)</Label>
              <input type="number" min={0.5} max={60} step={0.5} value={selectedClip.duration}
                onChange={e => updateClip(selectedClip.id, { duration: parseFloat(e.target.value) })}
                style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />
            </>
          )}

          <button onClick={deleteSelected} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IpDelete size={14} /> Delete Clip
          </button>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, textAlign: 'center' }}>
            Press S to split at playhead
          </div>
        </div>
      );
    }

    if (selectedText) {
      return (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>Text Settings</div>

          <Label>Content</Label>
          <textarea rows={3} value={selectedText.text}
            onChange={e => updateText(selectedText.id, { text: e.target.value })}
            style={{ width: '100%', marginBottom: 10, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, resize: 'none', boxSizing: 'border-box' }} />

          <Label>Font</Label>
          <select value={selectedText.fontFamily}
            onChange={e => updateText(selectedText.id, { fontFamily: e.target.value })}
            style={{ width: '100%', marginBottom: 10, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <Label>Size</Label>
              <input type="number" min={12} max={200} value={selectedText.fontSize}
                onChange={e => updateText(selectedText.id, { fontSize: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />
            </div>
            <div>
              <Label>Color</Label>
              <input type="color" value={selectedText.fill}
                onChange={e => updateText(selectedText.id, { fill: e.target.value })}
                style={{ width: '100%', height: 32, border: `1px solid ${t.border}`, borderRadius: 6, background: t.input, cursor: 'pointer' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {['normal', 'bold', 'italic', 'bold italic'].map(style => (
              <button key={style} onClick={() => updateText(selectedText.id, { fontStyle: style })}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: `1px solid ${selectedText.fontStyle === style ? t.primary : t.border}`, background: selectedText.fontStyle === style ? t.primaryBg : t.input, color: selectedText.fontStyle === style ? t.primary : t.text, fontSize: 9, cursor: 'pointer', fontWeight: style.includes('bold') ? 700 : 400, fontStyle: style.includes('italic') ? 'italic' : 'normal' }}>
                {style === 'normal' ? 'Aa' : style === 'bold' ? 'B' : style === 'italic' ? 'I' : 'BI'}
              </button>
            ))}
          </div>

          <Label>Start Time (s)</Label>
          <input type="number" min={0} step={0.1} value={selectedText.startTime.toFixed(1)}
            onChange={e => updateText(selectedText.id, { startTime: parseFloat(e.target.value) })}
            style={{ width: '100%', marginBottom: 8, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />

          <Label>End Time (s)</Label>
          <input type="number" min={0} step={0.1} value={selectedText.endTime.toFixed(1)}
            onChange={e => updateText(selectedText.id, { endTime: parseFloat(e.target.value) })}
            style={{ width: '100%', marginBottom: 10, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />

          <Label>Animation In</Label>
          <select value={selectedText.animationIn}
            onChange={e => updateText(selectedText.id, { animationIn: e.target.value })}
            style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {ANIM_IN_OPTIONS.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
          </select>

          <button onClick={deleteSelected} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IpDelete size={14} /> Delete Text
          </button>
        </div>
      );
    }

    if (selectedAudio) {
      return (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>Audio Settings</div>

          <Label>Volume</Label>
          <input type="range" min={0} max={1} step={0.05} value={selectedAudio.volume}
            onChange={e => updateAudio(selectedAudio.id, { volume: parseFloat(e.target.value) })}
            style={{ width: '100%', marginBottom: 12 }} />
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 12, textAlign: 'right' }}>{Math.round(selectedAudio.volume * 100)}%</div>

          <Label>Start Time (s)</Label>
          <input type="number" min={0} step={0.1} value={selectedAudio.startTime}
            onChange={e => updateAudio(selectedAudio.id, { startTime: parseFloat(e.target.value) })}
            style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }} />

          <button onClick={deleteSelected} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IpDelete size={14} /> Remove Audio
          </button>
        </div>
      );
    }

    return (
      <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 30 }}>
        Select a clip, text, or audio track to edit its properties.
      </div>
    );
  }

  // ─── Timeline ruler ───────────────────────────────────────────────────────

  function TimelineRuler() {
    const width = Math.max(800, (totalDuration + 2) * zoom);
    const ticks = [];
    const step = zoom >= 80 ? 1 : zoom >= 40 ? 2 : 5;
    for (let i = 0; i <= totalDuration + 2; i += step) {
      ticks.push(
        <div key={i} style={{ position: 'absolute', left: i * zoom, top: 0, height: '100%', borderLeft: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 9, color: t.textMuted, paddingLeft: 3 }}>{fmtTime(i)}</span>
        </div>
      );
    }
    return (
      <div style={{ position: 'relative', height: 18, width, flexShrink: 0, borderBottom: `1px solid ${t.border}` }}>
        {ticks}
      </div>
    );
  }

  // ─── Clip color by type ───────────────────────────────────────────────────

  function clipColor(clip) {
    if (clip.type === 'video') return '#4F46E5';
    if (clip.type === 'image') return '#0EA5E9';
    return '#6B7280';
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const leftToolButtons = [
    { id: 'clips',   label: 'Clips',   icon: <IpVideo size={14} /> },
    { id: 'text',    label: 'Text',    icon: <span style={{ fontSize: 12, fontWeight: 700 }}>T</span> },
    { id: 'audio',   label: 'Audio',   icon: <span style={{ fontSize: 14 }}>♪</span> },
    { id: 'ai',      label: 'AI Gen',  icon: <IpSparkle size={14} /> },
    { id: 'filters', label: 'Filters', icon: <IpFilter size={14} /> },
  ];

  const timelineWidth = Math.max(800, (totalDuration + 2) * zoom);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', background: t.bg, overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <button onClick={() => router.push('/media?tab=templates')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer' }}>
          <IpArrowLeft size={14} /> Back
        </button>

        {/* Aspect ratio */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setAspectOpen(o => !o)}
            style={{ padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer' }}>
            {project.aspectRatio} ▾
          </button>
          {aspectOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 50, minWidth: 160, marginTop: 4 }}>
              {Object.entries(ASPECT_DIMS).map(([key, val]) => (
                <button key={key} onClick={() => { mutate(p => ({ ...p, aspectRatio: key })); setAspectOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: t.text, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                  {val.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Undo/Redo */}
        <button onClick={handleUndo} disabled={historyIndex <= 0}
          style={{ padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: historyIndex <= 0 ? t.textMuted : t.text, fontSize: 12, cursor: 'pointer' }}>
          ⟲
        </button>
        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}
          style={{ padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: historyIndex >= history.length - 1 ? t.textMuted : t.text, fontSize: 12, cursor: 'pointer' }}>
          ⟳
        </button>

        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, maxWidth: 200, padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 13, fontWeight: 600 }} />

        <div style={{ flex: 1 }} />

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer' }}>
          <IpSave size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => handleExport('720p')} disabled={exporting || !project.clips.length}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: t.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: exporting || !project.clips.length ? 'not-allowed' : 'pointer', opacity: (!project.clips.length) ? 0.5 : 1 }}>
            <IpDownload size={14} />
            {exporting ? 'Rendering…' : 'Export MP4'}
          </button>
        </div>
      </div>

      {/* ── Export status banner ── */}
      {exportStatus && (
        <div style={{ padding: '8px 16px', background: exportStatus === 'completed' ? '#052e16' : exportStatus === 'failed' ? '#450a0a' : '#1e1b4b', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          {exportStatus === 'rendering' && <><IpLoader size={14} color="#818cf8" /><span style={{ color: '#a5b4fc' }}>Rendering your video… this may take a few minutes.</span></>}
          {exportStatus === 'completed' && exportUrl && (
            <>
              <span style={{ color: '#4ade80' }}>✓ Export complete!</span>
              <a href={exportUrl} target="_blank" rel="noreferrer"
                style={{ padding: '4px 12px', background: '#16a34a', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                Download MP4
              </a>
            </>
          )}
          {exportStatus === 'failed' && <><IpWarning size={14} color="#f87171" /><span style={{ color: '#fca5a5' }}>Export failed. Please try again.</span></>}
          <button onClick={() => setExportStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <IpClose size={14} />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div style={s.body}>

        {/* ── Left panel ── */}
        <div style={s.leftPanel}>
          <div style={s.leftTabs}>
            {leftToolButtons.map(btn => (
              <button key={btn.id} onClick={() => setActiveTool(btn.id)} style={s.leftTab(activeTool === btn.id)} title={btn.label}>
                {btn.icon}<br />{btn.label}
              </button>
            ))}
          </div>
          <div style={s.leftContent}>
            {LeftPanelContent()}
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={s.previewArea} onClick={() => { setSelectedId(null); setSelectedTrack(null); }}>
          <div ref={previewRef} style={s.previewBox}>
            {/* Active clip */}
            {activeClip ? (
              activeClip.type === 'video'
                ? <video ref={videoRef} src={activeClip.sourceUrl} muted={false} playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : activeClip.type === 'image'
                  ? <img src={activeClip.sourceUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', background: activeClip.color || '#000' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13 }}>
                Add clips to get started
              </div>
            )}

            {/* Text overlays */}
            {visibleText.map(te => (
              <div key={te.id}
                onMouseDown={e => onTextMouseDown(e, te)}
                style={{
                  position: 'absolute',
                  left: `${te.xPercent}%`,
                  top: `${te.yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'move',
                  userSelect: 'none',
                  fontFamily: te.fontFamily,
                  fontSize: Math.round(te.fontSize * previewContainerW / 1080),
                  fontWeight: (te.fontStyle || '').includes('bold') ? 700 : 400,
                  fontStyle: (te.fontStyle || '').includes('italic') ? 'italic' : 'normal',
                  color: te.fill,
                  textAlign: te.align || 'center',
                  whiteSpace: 'pre-wrap',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  border: selectedId === te.id ? '1px dashed rgba(155,79,212,0.8)' : '1px dashed transparent',
                  padding: 4,
                  borderRadius: 4,
                }}>
                {te.text}
              </div>
            ))}
          </div>

          {/* Playback controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setPlaying(p => !p)}
              style={{ width: 36, height: 36, borderRadius: '50%', background: t.primary, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playing
                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10"/><rect x="8" y="2" width="4" height="10"/></svg>
                : <IpPlay size={14} />
              }
            </button>
            <span style={{ fontSize: 12, color: t.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {fmtTime(playhead)} / {fmtTime(totalDuration)}
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setZoom(z => Math.max(20, z - 20))} style={{ width: 24, height: 24, borderRadius: 4, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ fontSize: 10, color: t.textMuted, minWidth: 28, textAlign: 'center' }}>{zoom}px</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 20))} style={{ width: 24, height: 24, borderRadius: 4, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={s.rightPanel}>
          {RightPanelContent()}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={s.timeline}>
        {/* Track labels */}
        <div style={s.timelineLabels}>
          <div style={{ height: 18, borderBottom: `1px solid ${t.border}` }} />
          <div style={{ ...s.timelineTrackLabel, height: 44 }}>Video</div>
          <div style={{ ...s.timelineTrackLabel, height: 32 }}>Text</div>
          <div style={{ ...s.timelineTrackLabel, height: 32 }}>Audio</div>
        </div>

        {/* Scrollable track area */}
        <div ref={timelineRef} style={s.timelineScroll} onClick={onTimelineClick}>
          <div style={{ ...s.timelineInner, width: timelineWidth }}>
            {/* Ruler */}
            {TimelineRuler()}

            {/* Video track */}
            <div style={{ position: 'relative', height: 44, borderBottom: `1px solid ${t.border}` }}>
              {project.clips.map(clip => (
                <div key={clip.id}
                  onMouseDown={e => onClipMouseDown(e, clip)}
                  style={{
                    position: 'absolute',
                    left: clip.trackStart * zoom,
                    width: Math.max(4, clip.duration * zoom),
                    height: 36,
                    top: 4,
                    borderRadius: 4,
                    background: selectedId === clip.id ? t.primary : clipColor(clip),
                    opacity: 0.85,
                    cursor: 'grab',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    border: selectedId === clip.id ? `2px solid ${t.primaryLight}` : `1px solid rgba(255,255,255,0.2)`,
                    display: 'flex', alignItems: 'center',
                  }}>
                  {/* Trim left handle */}
                  <div onMouseDown={e => onTrimLeftMouseDown(e, clip)}
                    style={{ position: 'absolute', left: 0, top: 0, width: 6, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '3px 0 0 3px' }} />
                  <span style={{ fontSize: 10, color: '#fff', paddingLeft: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {clip.type === 'color' ? 'Color' : clip.type === 'image' ? 'Image' : 'Video'}
                  </span>
                  {/* Trim right handle */}
                  <div onMouseDown={e => onTrimRightMouseDown(e, clip)}
                    style={{ position: 'absolute', right: 0, top: 0, width: 6, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '0 3px 3px 0' }} />
                </div>
              ))}
            </div>

            {/* Text track */}
            <div style={{ position: 'relative', height: 32, borderBottom: `1px solid ${t.border}` }}>
              {project.textElements.map(te => (
                <div key={te.id}
                  onClick={e => { e.stopPropagation(); setSelectedId(te.id); setSelectedTrack('text'); }}
                  style={{
                    position: 'absolute',
                    left: te.startTime * zoom,
                    width: Math.max(4, (te.endTime - te.startTime) * zoom),
                    height: 22, top: 5,
                    borderRadius: 4,
                    background: selectedId === te.id ? t.primary : '#7C3AED',
                    opacity: 0.8,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    overflow: 'hidden',
                  }}>
                  <span style={{ fontSize: 9, color: '#fff', paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.text}</span>
                </div>
              ))}
            </div>

            {/* Audio track */}
            <div style={{ position: 'relative', height: 32 }}>
              {project.audioTracks.map(at => {
                const endTime = at.endTime || totalDuration;
                return (
                  <div key={at.id}
                    onClick={e => { e.stopPropagation(); setSelectedId(at.id); setSelectedTrack('audio'); }}
                    style={{
                      position: 'absolute',
                      left: at.startTime * zoom,
                      width: Math.max(4, (endTime - at.startTime) * zoom),
                      height: 22, top: 5,
                      borderRadius: 4,
                      background: selectedId === at.id ? t.primary : '#065F46',
                      opacity: 0.85,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', overflow: 'hidden',
                    }}>
                    <span style={{ fontSize: 9, color: '#fff', paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>♪ audio</span>
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div style={{
              position: 'absolute',
              left: playhead * zoom,
              top: 0, bottom: 0, width: 2,
              background: '#EF4444',
              pointerEvents: 'none',
              zIndex: 10,
            }}>
              <div style={{ width: 10, height: 10, background: '#EF4444', borderRadius: '50%', marginLeft: -4, marginTop: 0 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}
