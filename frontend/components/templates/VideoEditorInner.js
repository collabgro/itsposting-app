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
  { id: 'none',     label: 'Original', brightness: 0,     contrast: 0,   saturation: 0    },
  { id: 'warm',     label: 'Warm',     brightness: 0.05,  contrast: 5,   saturation: 20   },
  { id: 'cool',     label: 'Cool',     brightness: 0,     contrast: 5,   saturation: -10  },
  { id: 'vivid',    label: 'Vivid',    brightness: 0,     contrast: 20,  saturation: 40   },
  { id: 'faded',    label: 'Faded',    brightness: 0.1,   contrast: -15, saturation: -20  },
  { id: 'bw',       label: 'B&W',      brightness: 0,     contrast: 10,  saturation: -100 },
  { id: 'moody',    label: 'Moody',    brightness: -0.05, contrast: 15,  saturation: -15  },
  { id: 'dramatic', label: 'Dramatic', brightness: -0.1,  contrast: 40,  saturation: -20  },
  { id: 'golden',   label: 'Golden',   brightness: 0.08,  contrast: 8,   saturation: 35   },
  { id: 'vintage',  label: 'Vintage',  brightness: 0.05,  contrast: -10, saturation: -30  },
  { id: 'sunset',   label: 'Sunset',   brightness: 0.1,   contrast: 10,  saturation: 50   },
  { id: 'arctic',   label: 'Arctic',   brightness: 0.08,  contrast: 12,  saturation: -60  },
  { id: 'retro',    label: 'Retro',    brightness: 0.12,  contrast: -5,  saturation: -40  },
  { id: 'cinema',   label: 'Cinema',   brightness: -0.08, contrast: 30,  saturation: -25  },
];

const TRANSITION_TYPES = ['none', 'fade', 'dissolve', 'slide_left', 'slide_right', 'slide_up', 'zoom_in', 'zoom_out'];
const TRANSITION_LABELS = { none: 'Cut', fade: 'Fade', dissolve: 'Dissolve', slide_left: '← Slide', slide_right: 'Slide →', slide_up: '↑ Slide', zoom_in: 'Zoom In', zoom_out: 'Zoom Out' };
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2];
const FONT_FAMILIES = ['Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Open Sans', 'Bebas Neue', 'Oswald', 'sans-serif'];
const ANIM_IN_OPTIONS = ['none','fade_in','rise','slide_up','slide_left','slide_right','scale_up','pop','typewriter','tumble','bounce','glitch','wave','roll_left','roll_right','swing','neon_pulse','zoom_bounce'];
const ANIM_OUT_OPTIONS = ['none','fade_out','slide_down','slide_left','slide_right','scale_down','bounce_out','glitch_out'];
const ANIM_LABELS = { none:'None', fade_in:'Fade In', rise:'Rise', slide_up:'Slide Up', slide_left:'Slide Left', slide_right:'Slide Right', scale_up:'Scale In', pop:'Pop', typewriter:'Typewriter', tumble:'Tumble', bounce:'Bounce', glitch:'Glitch', wave:'Wave', roll_left:'Roll Left', roll_right:'Roll Right', swing:'Swing', neon_pulse:'Neon Pulse', zoom_bounce:'Zoom Bounce', fade_out:'Fade Out', slide_down:'Slide Down', scale_down:'Scale Out', bounce_out:'Bounce Out', glitch_out:'Glitch Out' };
const KEN_BURNS_OPTIONS = ['none','zoom_in','zoom_out','pan_left','pan_right','pan_up','pan_down'];
const KEN_BURNS_LABELS = { none:'None', zoom_in:'Zoom In', zoom_out:'Zoom Out', pan_left:'Pan Left', pan_right:'Pan Right', pan_up:'Pan Up', pan_down:'Pan Down' };
const TEXT_SHADOW_PRESETS = ['none','soft','hard','glow','neon'];
const TEXT_SHADOW_LABELS = { none:'None', soft:'Soft Drop', hard:'Hard Drop', glow:'Glow', neon:'Neon' };

// ─── Empty project factory ────────────────────────────────────────────────────

function emptyProject(aspectRatio = '9:16') {
  return { aspectRatio, fps: 30, clips: [], textElements: [], audioTracks: [] };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoEditorInner() {
  const t = useTheme();
  const router = useRouter();
  const { id: editId, videoUrl } = router.query;

  // ─── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.replace('/login');
    }
  }, []);

  // ─── Load connected social accounts ──────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    fetch('/api/social/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setConnectedAccounts(data.accounts || []))
      .catch(() => {});
  }, []);

  // ─── Load AI-generated video from ?videoUrl= param ────────────────────────
  useEffect(() => {
    if (!videoUrl) return;
    const decoded = decodeURIComponent(videoUrl);
    const clip = {
      id: nanoid(), url: decoded, name: 'AI Generated Video', type: 'video',
      duration: 10, trackStart: 0, volume: 1, speed: 1,
      trimStart: 0, trimEnd: 10,
      filterPreset: 'none', brightness: 0, contrast: 0, saturation: 0,
      kenBurns: 'none', transition: 'none',
    };
    setProject(p => ({ ...p, clips: [clip] }));
  }, [videoUrl]);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [project, setProject] = useState(emptyProject());
  const [title, setTitle] = useState('Untitled Video');
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null); // 'clip' | 'text' | 'audio'
  const [activeTool, setActiveTool] = useState('clips');
  const [panelOpen, setPanelOpen] = useState(true);
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

  // ── Transition picker ──────────────────────────────────────────────────────
  const [transitionPickerClipId, setTransitionPickerClipId] = useState(null);

  // ── Upload progress ────────────────────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState(null);

  // ── Caption generation ─────────────────────────────────────────────────────
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState('');

  // ── Aspect ratio dropdown ───────────────────────────────────────────────────
  const [aspectOpen, setAspectOpen] = useState(false);

  // ── Voiceover recording ─────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // ── Export quality ──────────────────────────────────────────────────────────
  const [exportQuality, setExportQuality] = useState('1080p');

  // ── Post to social ──────────────────────────────────────────────────────────
  const [postModal, setPostModal] = useState(false);
  const [postCaption, setPostCaption] = useState('');
  const [postPlatforms, setPostPlatforms] = useState([]);
  const [postStatus, setPostStatus] = useState('idle'); // idle | posting | done | error
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  // ── Real waveform cache ─────────────────────────────────────────────────────
  const [waveformData, setWaveformData] = useState({});

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

  // ─── Dynamic preview sizing ───────────────────────────────────────────────

  const previewAreaRef2 = useRef(null);
  const [previewAreaSize, setPreviewAreaSize] = useState({ w: 900, h: 500 });

  useEffect(() => {
    const el = previewAreaRef2.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setPreviewAreaSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { w: aw, h: ah } = ASPECT_DIMS[project.aspectRatio] || ASPECT_DIMS['9:16'];
  const maxPrevH = Math.max(100, previewAreaSize.h - 80);
  const maxPrevW = Math.max(80, previewAreaSize.w - 48);
  const previewContainerW = Math.round(Math.min(maxPrevW, maxPrevH * aw / ah));
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
    studioAPI.getCreation(editId).then(r => {
      const c = r.data?.creation;
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
    mediaAPI.list({ limit: 60 }).then(d => {
      setMediaFiles(d?.data || []);
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
    vid.playbackRate = activeClip.speed || 1;
    vid.volume = activeClip.volume ?? 1;
  }, [activeClipIndex, Math.floor(playhead * 5)]);

  // ─── Video element play / pause ───────────────────────────────────────────

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeClip || activeClip.type !== 'video') return;
    if (playing) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [playing, activeClipIndex]);

  // ─── Poll export status ────────────────────────────────────────────────────

  useEffect(() => {
    if (!exportJobId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await studioAPI.getRenderStatus(exportJobId);
        if (data?.status === 'completed') {
          setExportStatus('completed');
          setExportUrl(data.outputUrl);
          setExportJobId(null);
          setExporting(false);
        } else if (data?.status === 'failed') {
          setExportStatus('failed');
          setExportJobId(null);
          setExporting(false);
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [exportJobId]);

  // ─── Compute waveforms for audio tracks ──────────────────────────────────

  useEffect(() => {
    project.audioTracks.forEach(at => {
      if (at.sourceUrl && !waveformData[at.id]) computeWaveform(at.sourceUrl, at.id);
    });
  }, [project.audioTracks]);

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
      thumbnailUrl: file.thumbnail_url || file.url,
      sourceMediaId: file.id,
      trackStart,
      trimStart: 0,
      trimEnd: duration,
      duration,
      volume: 1,
      speed: 1,
      muted: false,
      opacity: 1,
      kenBurns: isVideo ? 'none' : 'zoom_in',
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
      const { data } = await studioAPI.aiGenerateClip({
        prompt: aiPrompt,
        aspectRatio: project.aspectRatio,
        durationSeconds: 7,
      });
      const clip = {
        id: nanoid(),
        type: 'video',
        sourceUrl: data?.clip?.url,
        thumbnailUrl: data?.clip?.url,
        sourceMediaId: null,
        trackStart: totalDuration,
        trimStart: 0,
        trimEnd: data?.clip?.duration || 7,
        duration: data?.clip?.duration || 7,
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
      const { data } = await studioAPI.renderVideo({ videoJson: project, title, quality });
      setExportJobId(data?.jobId);
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

  // ─── Post to social ───────────────────────────────────────────────────────

  async function handlePostNow() {
    if (postPlatforms.length === 0 || postStatus !== 'idle') return;
    setPostStatus('posting');
    try {
      const token = localStorage.getItem('token');
      let creationId = editId;
      if (!creationId) {
        const saveRes = await fetch('/api/studio/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ videoJson: project, creationType: 'video', title }),
        });
        const saveData = await saveRes.json();
        creationId = saveData.creation?.id;
      }
      await fetch(`/api/studio/creations/${creationId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          caption: postCaption,
          platforms: connectedAccounts.filter(a => postPlatforms.includes(a.id)).map(a => a.platform),
          scheduleMode: 'now',
        }),
      });
      setPostStatus('done');
      setTimeout(() => { setPostModal(false); setPostStatus('idle'); }, 2500);
    } catch (err) {
      console.error('[VideoEditor] post error:', err);
      setPostStatus('error');
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
      let newStart = Math.max(0, origTrackStart + dx / zoom);
      // Magnetic snap — snap to other clips' edges and to t=0
      const SNAP = 8 / zoom;
      const others = projectRef.current.clips.filter(c => c.id !== clip.id);
      for (const oc of others) {
        if (Math.abs(newStart - (oc.trackStart + oc.duration)) < SNAP) { newStart = oc.trackStart + oc.duration; break; }
        if (Math.abs((newStart + clip.duration) - oc.trackStart) < SNAP) { newStart = oc.trackStart - clip.duration; break; }
      }
      if (Math.abs(newStart) < SNAP) newStart = 0;
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

  // ─── Text clip drag in timeline ──────────────────────────────────────────

  function onTextTimelineDrag(e, te) {
    e.stopPropagation();
    setSelectedId(te.id);
    setSelectedTrack('text');
    const startX = e.clientX;
    const origStart = te.startTime;
    const dur = te.endTime - te.startTime;
    const onMove = (me) => {
      const dx = (me.clientX - startX) / zoom;
      const newStart = Math.max(0, origStart + dx);
      updateText(te.id, { startTime: newStart, endTime: newStart + dur });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onTextTrimRight(e, te) {
    e.stopPropagation();
    const startX = e.clientX;
    const origEnd = te.endTime;
    const onMove = (me) => {
      const dx = (me.clientX - startX) / zoom;
      updateText(te.id, { endTime: Math.max(te.startTime + 0.5, origEnd + dx) });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ─── Audio clip drag in timeline ─────────────────────────────────────────

  function onAudioTimelineDrag(e, at) {
    e.stopPropagation();
    setSelectedId(at.id);
    setSelectedTrack('audio');
    const startX = e.clientX;
    const origStart = at.startTime;
    const dur = (at.endTime || totalDuration) - at.startTime;
    const onMove = (me) => {
      const dx = (me.clientX - startX) / zoom;
      const newStart = Math.max(0, origStart + dx);
      updateAudio(at.id, { startTime: newStart, endTime: at.endTime ? newStart + dur : null });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onAudioTrimRight(e, at) {
    e.stopPropagation();
    const startX = e.clientX;
    const origEnd = at.endTime || totalDuration;
    const onMove = (me) => {
      const dx = (me.clientX - startX) / zoom;
      updateAudio(at.id, { endTime: Math.max(at.startTime + 0.5, origEnd + dx) });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ─── Upload clips from file picker ───────────────────────────────────────

  async function handleUploadClip(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadProgress(0);
    try {
      const res = await mediaAPI.upload(files, 'all', p => setUploadProgress(p));
      const newFiles = res.data?.files || [];
      setMediaFiles(prev => [...newFiles, ...prev]);
      if (newFiles[0]) addMediaClip(newFiles[0]);
    } catch {}
    finally { setUploadProgress(null); e.target.value = ''; }
  }

  // ─── Generate captions (placeholder — calls backend transcription) ────────

  function handleGenerateCaptions() {
    setCaptionError('Auto-captions are coming soon. In the meantime, add captions manually using the Text tab — set start/end times to sync them to your video.');
  }

  // ─── Duplicate selected clip ──────────────────────────────────────────────

  function duplicateSelected() {
    if (!selectedClip) return;
    const newClip = { ...selectedClip, id: nanoid(), trackStart: selectedClip.trackStart + selectedClip.duration };
    mutate(p => ({ ...p, clips: [...p.clips, newClip] }));
    setSelectedId(newClip.id);
  }

  // ─── Voiceover recording ──────────────────────────────────────────────────

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voiceover-${Date.now()}.webm`, { type: 'audio/webm' });
        try {
          const res = await mediaAPI.upload([file], 'audio', () => {});
          if (res.data?.files?.[0]) {
            setMediaFiles(prev => [...(res.data.files || []), ...prev]);
            addAudioTrack(res.data.files[0]);
          }
        } catch {}
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert('Microphone permission denied. Please allow microphone access and try again.');
    }
  }

  function stopVoiceRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  // ─── Real waveform computation ────────────────────────────────────────────

  async function computeWaveform(audioUrl, id) {
    if (waveformData[id]) return;
    try {
      const response = await fetch(audioUrl);
      const buffer = await response.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(buffer);
      const data = decoded.getChannelData(0);
      const BARS = 80;
      const blockSize = Math.floor(data.length / BARS);
      const peaks = Array.from({ length: BARS }, (_, i) => {
        let max = 0;
        for (let j = i * blockSize; j < Math.min((i + 1) * blockSize, data.length); j++) max = Math.max(max, Math.abs(data[j]));
        return max;
      });
      audioCtx.close();
      setWaveformData(prev => ({ ...prev, [id]: peaks }));
    } catch {}
  }

  // ─── Compute live text animation style ────────────────────────────────────

  function computeTextAnimStyle(te) {
    const localTime = playhead - te.startTime;
    const dur = te.endTime - te.startTime;
    const IN_DUR = 0.5, OUT_DUR = 0.4;
    const inP  = Math.min(1, Math.max(0, localTime / IN_DUR));
    const outP = Math.min(1, Math.max(0, (localTime - (dur - OUT_DUR)) / OUT_DUR));
    const outFade = 1 - outP;

    let opacity = outFade;
    let transform = 'translate(-50%, -50%)';
    let extraStyle = {};

    if (inP < 1) {
      switch (te.animationIn) {
        case 'fade_in':    opacity = inP * outFade; break;
        case 'rise':       opacity = inP * outFade; transform = `translate(-50%, calc(-50% + ${(1-inP)*24}px))`; break;
        case 'slide_up':   opacity = inP * outFade; transform = `translate(-50%, calc(-50% + ${(1-inP)*50}px))`; break;
        case 'slide_left': opacity = inP * outFade; transform = `translate(calc(-50% + ${(1-inP)*80}px), -50%)`; break;
        case 'slide_right':opacity = inP * outFade; transform = `translate(calc(-50% - ${(1-inP)*80}px), -50%)`; break;
        case 'scale_up':   opacity = inP * outFade; transform = `translate(-50%, -50%) scale(${0.2 + 0.8*inP})`; break;
        case 'pop': {
          const s = inP < 0.6 ? 1 + 0.35*(inP/0.6) : 1 + 0.35*(1 - (inP-0.6)/0.4);
          opacity = inP * outFade; transform = `translate(-50%, -50%) scale(${s})`; break;
        }
        case 'bounce':     transform = `translate(-50%, calc(-50% + ${-Math.sin(inP*Math.PI)*30}px))`; opacity = outFade; break;
        case 'glitch': {
          const dx = (Math.random()-0.5)*10*(1-inP), dy = (Math.random()-0.5)*4*(1-inP);
          opacity = inP * outFade; transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          extraStyle = { filter: `hue-rotate(${(1-inP)*90}deg) saturate(${1+(1-inP)*3})` }; break;
        }
        case 'wave':       opacity = inP * outFade; transform = `translate(-50%, calc(-50% + ${Math.sin(localTime*12)*6*(1-inP)}px))`; break;
        case 'tumble':     opacity = inP * outFade; transform = `translate(-50%, calc(-50% + ${(1-inP)*40}px)) rotate(${(1-inP)*-20}deg) scale(${0.6+0.4*inP})`; break;
        case 'roll_left':  opacity = inP * outFade; transform = `translate(calc(-50% + ${(1-inP)*100}px), -50%) perspective(400px) rotateY(${(1-inP)*90}deg)`; break;
        case 'roll_right': opacity = inP * outFade; transform = `translate(calc(-50% - ${(1-inP)*100}px), -50%) perspective(400px) rotateY(${-(1-inP)*90}deg)`; break;
        case 'swing': {
          const ang = (1-inP)*30*Math.cos(inP*Math.PI*2.5);
          opacity = inP * outFade; transform = `translate(-50%, -50%) rotate(${ang}deg)`; break;
        }
        case 'neon_pulse': {
          const pulse = 0.5+0.5*Math.sin(localTime*20);
          opacity = inP * outFade; extraStyle = { textShadow: `0 0 ${8+pulse*16}px currentColor, 0 0 ${2+pulse*4}px currentColor` }; break;
        }
        case 'zoom_bounce': {
          const over = inP < 0.7 ? 1+0.4*(inP/0.7) : 1.4-0.4*((inP-0.7)/0.3);
          opacity = inP * outFade; transform = `translate(-50%, -50%) scale(${over})`; break;
        }
        default: opacity = inP * outFade;
      }
    } else {
      // Idle animations after in completes
      if (te.animationIn === 'wave')       transform = `translate(-50%, calc(-50% + ${Math.sin(localTime*6)*3}px))`;
      else if (te.animationIn === 'bounce') transform = `translate(-50%, calc(-50% + ${-Math.abs(Math.sin(localTime*4))*6}px))`;
      else if (te.animationIn === 'neon_pulse') {
        const p2 = 0.5+0.5*Math.sin(localTime*4);
        extraStyle = { textShadow: `0 0 ${8+p2*12}px currentColor, 0 0 2px currentColor` };
      }
    }

    // Animation out overrides once triggered
    if (inP >= 1 && outP > 0 && te.animationOut && te.animationOut !== 'none') {
      switch (te.animationOut) {
        case 'fade_out':    opacity = 1 - outP; break;
        case 'slide_down':  opacity = 1 - outP; transform = `translate(-50%, calc(-50% + ${outP*50}px))`; break;
        case 'slide_left':  opacity = 1 - outP; transform = `translate(calc(-50% - ${outP*80}px), -50%)`; break;
        case 'slide_right': opacity = 1 - outP; transform = `translate(calc(-50% + ${outP*80}px), -50%)`; break;
        case 'scale_down':  opacity = 1 - outP; transform = `translate(-50%, -50%) scale(${1 - outP*0.8})`; break;
        case 'bounce_out': {
          const y = Math.sin(outP*Math.PI)*-30 + outP*60;
          opacity = 1 - outP; transform = `translate(-50%, calc(-50% + ${y}px))`; break;
        }
        case 'glitch_out': {
          const dx = (Math.random()-0.5)*12*outP;
          opacity = 1 - outP; transform = `translate(calc(-50% + ${dx}px), -50%)`;
          extraStyle = { filter: `hue-rotate(${outP*180}deg)` }; break;
        }
      }
    }
    return { opacity, transform, ...extraStyle };
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
      height: 248, borderTop: `1px solid ${t.border}`, background: t.bg,
      display: 'flex', flexShrink: 0,
    },
    timelineLabels: {
      width: 80, flexShrink: 0, borderRight: `1px solid ${t.border}`,
      background: t.card, display: 'flex', flexDirection: 'column',
    },
    timelineTrackLabel: {
      borderBottom: `1px solid ${t.border}`, display: 'flex',
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
          {/* Upload button */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginBottom: 8, padding: '8px 0', background: t.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' }}>
            <input type="file" accept="video/*,image/*" multiple style={{ display: 'none' }} onChange={handleUploadClip} />
            + Upload Media
          </label>
          {uploadProgress !== null && (
            <div style={{ height: 4, background: t.border, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: t.primary, transition: 'width 200ms' }} />
            </div>
          )}
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
          {/* Voiceover recording */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Record Voiceover</div>
            {!recording ? (
              <button onClick={startVoiceRecording}
                style={{ width: '100%', padding: '9px 0', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                🎤 Record Voiceover
              </button>
            ) : (
              <button onClick={stopVoiceRecording}
                style={{ width: '100%', padding: '9px 0', background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ⏹ Stop Recording
              </button>
            )}
            {recording && (
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }} />
                Recording…
              </div>
            )}
          </div>

          {/* Upload audio */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginBottom: 10, padding: '8px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer', boxSizing: 'border-box' }}>
            <input type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={async e => {
              const files = Array.from(e.target.files);
              if (!files.length) return;
              try {
                const res = await mediaAPI.upload(files, 'audio', () => {});
                const newFiles = res.data?.files || [];
                setMediaFiles(prev => [...newFiles, ...prev]);
                if (newFiles[0]) addAudioTrack(newFiles[0]);
              } catch {}
              e.target.value = '';
            }} />
            + Upload Audio
          </label>

          {mediaLoading && <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>Loading...</div>}
          {audioFiles.length > 0
            ? audioFiles.map(f => (
              <div key={f.id} onClick={() => addAudioTrack(f)}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.input, cursor: 'pointer', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{f.duration_seconds ? `${Math.round(f.duration_seconds)}s` : 'audio'}</div>
              </div>
            ))
            : !mediaLoading && <div style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>No audio files yet.<br />Upload or record a voiceover.</div>
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

    if (activeTool === 'captions') {
      return (
        <div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
            Generate captions automatically from your video's spoken audio. Adds subtitle text overlays to your timeline.
          </div>
          <button
            onClick={handleGenerateCaptions}
            style={{ width: '100%', padding: '9px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ✦ Auto-Captions (Coming Soon)
          </button>
          {captionError && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8, lineHeight: 1.5 }}>{captionError}</div>}
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 12, lineHeight: 1.5 }}>
            Captions appear as text overlays. Edit timing and style from the Text tab.
          </div>
          {project.textElements.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
                Text Overlays ({project.textElements.length})
              </div>
              {project.textElements.slice(0, 8).map(te => (
                <div key={te.id}
                  onClick={() => { setSelectedId(te.id); setSelectedTrack('text'); setActiveTool('text'); }}
                  style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${selectedId === te.id ? t.primary : t.border}`, background: t.input, cursor: 'pointer', marginBottom: 5 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.text}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>{fmtTime(te.startTime)} → {fmtTime(te.endTime)}</div>
                </div>
              ))}
              {project.textElements.length > 8 && (
                <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', marginTop: 4 }}>+{project.textElements.length - 8} more</div>
              )}
            </div>
          )}
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

          {selectedClip.type === 'video' && (
            <>
              <Label>Reverse</Label>
              <button
                onClick={() => updateClip(selectedClip.id, { reverse: !selectedClip.reverse })}
                style={{ width: '100%', marginBottom: 12, padding: '6px 0', background: selectedClip.reverse ? 'rgba(0,196,204,0.1)' : t.input, border: `1px solid ${selectedClip.reverse ? t.primary : t.border}`, borderRadius: 6, color: selectedClip.reverse ? t.primary : t.text, fontSize: 12, cursor: 'pointer', fontWeight: selectedClip.reverse ? 600 : 400 }}>
                {selectedClip.reverse ? '⇐ Reversed' : '⇒ Normal'}
              </button>
            </>
          )}

          <Label>Transition In</Label>
          <select value={selectedClip.transitionIn?.type || 'none'}
            onChange={e => updateClip(selectedClip.id, { transitionIn: { ...selectedClip.transitionIn, type: e.target.value } })}
            style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {TRANSITION_TYPES.map(tt => <option key={tt} value={tt}>{TRANSITION_LABELS[tt] || tt}</option>)}
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

          {/* Ken Burns for image/video */}
          {(selectedClip.type === 'image' || selectedClip.type === 'video') && (
            <>
              <Label>Ken Burns</Label>
              <select value={selectedClip.kenBurns || 'none'}
                onChange={e => updateClip(selectedClip.id, { kenBurns: e.target.value })}
                style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
                {KEN_BURNS_OPTIONS.map(k => <option key={k} value={k}>{KEN_BURNS_LABELS[k]}</option>)}
              </select>
            </>
          )}

          {/* Opacity */}
          <Label>Opacity — {Math.round((selectedClip.opacity ?? 1) * 100)}%</Label>
          <input type="range" min={0} max={1} step={0.05} value={selectedClip.opacity ?? 1}
            onChange={e => updateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
            style={{ width: '100%', marginBottom: 12, accentColor: t.primary }} />

          {/* Mute toggle */}
          {(selectedClip.type === 'video') && (
            <button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })}
              style={{ width: '100%', marginBottom: 10, padding: '6px 0', background: selectedClip.muted ? 'rgba(239,68,68,0.1)' : t.input, border: `1px solid ${selectedClip.muted ? 'rgba(239,68,68,0.4)' : t.border}`, borderRadius: 6, color: selectedClip.muted ? '#ef4444' : t.text, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              {selectedClip.muted ? '🔇 Unmute Clip' : '🔊 Mute Clip'}
            </button>
          )}

          {/* Duplicate + Delete */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <button onClick={duplicateSelected} style={{ flex: 1, padding: '7px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              ⧉ Duplicate
            </button>
            <button onClick={deleteSelected} style={{ flex: 1, padding: '7px 0', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
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
            style={{ width: '100%', marginBottom: 10, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {ANIM_IN_OPTIONS.map(o => <option key={o} value={o}>{ANIM_LABELS[o] || o}</option>)}
          </select>

          <Label>Animation Out</Label>
          <select value={selectedText.animationOut || 'none'}
            onChange={e => updateText(selectedText.id, { animationOut: e.target.value })}
            style={{ width: '100%', marginBottom: 12, padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12 }}>
            {ANIM_OUT_OPTIONS.map(o => <option key={o} value={o}>{ANIM_LABELS[o] || o}</option>)}
          </select>

          <Label>Text Shadow</Label>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {TEXT_SHADOW_PRESETS.map(sp => (
              <button key={sp} onClick={() => updateText(selectedText.id, { shadowPreset: sp })}
                style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${(selectedText.shadowPreset||'none') === sp ? t.primary : t.border}`, background: (selectedText.shadowPreset||'none') === sp ? t.primaryBg : t.input, color: (selectedText.shadowPreset||'none') === sp ? t.primary : t.text, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>
                {TEXT_SHADOW_LABELS[sp]}
              </button>
            ))}
          </div>

          <Label>Outline Width — {selectedText.strokeWidth || 0}px</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input type="range" min={0} max={10} step={0.5} value={selectedText.strokeWidth || 0}
              onChange={e => updateText(selectedText.id, { strokeWidth: parseFloat(e.target.value) })}
              style={{ flex: 1, accentColor: t.primary }} />
            <input type="color" value={selectedText.strokeColor || '#000000'}
              onChange={e => updateText(selectedText.id, { strokeColor: e.target.value })}
              style={{ width: 32, height: 28, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', background: 'none' }} />
          </div>

          <Label>Background Color</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input type="color" value={selectedText.bgColor || '#000000'}
              onChange={e => updateText(selectedText.id, { bgColor: e.target.value })}
              style={{ width: 32, height: 28, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', background: 'none' }} />
            <input type="range" min={0} max={1} step={0.05} value={selectedText.bgOpacity ?? 0}
              onChange={e => updateText(selectedText.id, { bgOpacity: parseFloat(e.target.value), bgColor: selectedText.bgColor || '#000000' })}
              style={{ flex: 1, accentColor: t.primary }} />
            <span style={{ fontSize: 10, color: t.textMuted, width: 28 }}>{Math.round((selectedText.bgOpacity ?? 0)*100)}%</span>
            {selectedText.bgColor && (
              <button onClick={() => updateText(selectedText.id, { bgColor: null, bgOpacity: 0 })}
                style={{ padding: '3px 6px', background: 'none', border: `1px solid ${t.border}`, borderRadius: 4, color: t.textMuted, fontSize: 10, cursor: 'pointer' }}>×</button>
            )}
          </div>

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
    { id: 'clips',    label: 'Clips',    icon: <IpVideo size={14} /> },
    { id: 'text',     label: 'Text',     icon: <span style={{ fontSize: 12, fontWeight: 700 }}>T</span> },
    { id: 'audio',    label: 'Audio',    icon: <span style={{ fontSize: 14 }}>♪</span> },
    { id: 'captions', label: 'Captions', icon: <span style={{ fontSize: 10, fontWeight: 700 }}>CC</span> },
    { id: 'ai',       label: 'AI Gen',   icon: <IpSparkle size={14} /> },
    { id: 'filters',  label: 'Filters',  icon: <IpFilter size={14} /> },
  ];

  const timelineWidth = Math.max(800, (totalDuration + 2) * zoom);

  function handleToolClick(toolId) {
    if (activeTool === toolId && panelOpen) {
      setPanelOpen(false);
    } else {
      setActiveTool(toolId);
      setPanelOpen(true);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: t.bg, overflow: 'hidden' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <button onClick={() => router.push('/media?tab=studio')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <IpArrowLeft size={14} /> ItsPosting
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

        {/* Split at playhead */}
        <button onClick={splitClipAtPlayhead} disabled={!selectedClip} title="Split clip at playhead (S)"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: selectedClip ? t.text : t.textMuted, fontSize: 12, cursor: selectedClip ? 'pointer' : 'not-allowed' }}>
          ✂ Split
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

        {/* Export quality */}
        <select value={exportQuality} onChange={e => setExportQuality(e.target.value)}
          style={{ padding: '6px 8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, fontSize: 12, cursor: 'pointer' }}>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>

        {/* Post Video */}
        <button onClick={() => setPostModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: '#00C4CC', border: 'none', borderRadius: 6, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Post Video
        </button>

        {/* Export */}
        <button onClick={() => handleExport(exportQuality)} disabled={exporting || !project.clips.length}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: t.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: exporting || !project.clips.length ? 'not-allowed' : 'pointer', opacity: (!project.clips.length) ? 0.5 : 1 }}>
          <IpDownload size={14} />
          {exporting ? 'Rendering…' : 'Export MP4'}
        </button>
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

        {/* ── Left sidebar: 72px icon strip + 280px collapsible flyout ── */}

        {/* 72px icon strip — always visible */}
        <div style={{ width: 72, borderRight: `1px solid ${t.border}`, background: t.card,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 0', flexShrink: 0, gap: 2 }}>
          {[
            { id: 'clips',    icon: <IpVideo size={20} />,   label: 'Clips'    },
            { id: 'text',     icon: <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>T</span>, label: 'Text' },
            { id: 'audio',    icon: <span style={{ fontSize: 20, lineHeight: 1 }}>♪</span>, label: 'Audio' },
            { id: 'captions', icon: <span style={{ fontSize: 12, fontWeight: 700 }}>CC</span>, label: 'Captions' },
            { id: 'ai',       icon: <IpSparkle size={20} />, label: 'AI Gen'   },
            { id: 'filters',  icon: <IpFilter size={20} />,  label: 'Filters'  },
          ].map(tool => (
            <button key={tool.id} onClick={() => handleToolClick(tool.id)}
              style={{
                width: 60, padding: '10px 0 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: activeTool === tool.id && panelOpen ? t.primaryBg : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: activeTool === tool.id && panelOpen ? t.primary : t.textMuted,
                fontSize: 10, fontWeight: activeTool === tool.id && panelOpen ? 600 : 400,
                transition: 'all 150ms ease',
              }}>
              {tool.icon}
              {tool.label}
            </button>
          ))}
        </div>

        {/* 280px collapsible flyout */}
        <div style={{
          width: panelOpen ? 280 : 0,
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

          {panelOpen && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 10, minWidth: 280 }}>
              {LeftPanelContent()}
            </div>
          )}
        </div>

        {/* ── Preview ── */}
        <div ref={previewAreaRef2} style={s.previewArea} onClick={() => { setSelectedId(null); setSelectedTrack(null); }}>
          <div ref={previewRef} style={s.previewBox}>
            {/* Active clip */}
            {activeClip ? (
              (() => {
                const f = activeClip.filters || {};
                const filterStr = (f.brightness !== 0 || f.contrast !== 0 || f.saturation !== 0)
                  ? `brightness(${Math.max(0, 1 + (f.brightness||0))}) contrast(${Math.max(0, 1 + (f.contrast||0)/100)}) saturate(${Math.max(0, 1 + (f.saturation||0)/100)})`
                  : undefined;
                // Ken Burns
                let kbTransform = 'none';
                if (activeClip.kenBurns && activeClip.kenBurns !== 'none') {
                  const dur = Math.max(0.001, activeClip.duration);
                  const prog = Math.min(1, Math.max(0, (playhead - activeClip.trackStart) / dur));
                  if (activeClip.kenBurns === 'zoom_in')  kbTransform = `scale(${1 + 0.15*prog})`;
                  if (activeClip.kenBurns === 'zoom_out') kbTransform = `scale(${1.15 - 0.15*prog})`;
                  if (activeClip.kenBurns === 'pan_left')  kbTransform = `scale(1.1) translateX(${-prog*5}%)`;
                  if (activeClip.kenBurns === 'pan_right') kbTransform = `scale(1.1) translateX(${(1-prog)*5-5*0}%)`;
                  if (activeClip.kenBurns === 'pan_up')   kbTransform = `scale(1.1) translateY(${-prog*5}%)`;
                  if (activeClip.kenBurns === 'pan_down') kbTransform = `scale(1.1) translateY(${prog*5}%)`;
                }
                const mediaStyle = { width:'100%', height:'100%', objectFit:'cover', display:'block', filter: filterStr, transform: kbTransform, transformOrigin:'center center' };
                const clipOpacity = activeClip.muted ? 0.5 : 1;
                return activeClip.type === 'video'
                  ? <video ref={videoRef} src={activeClip.sourceUrl} muted={activeClip.muted} playsInline
                      style={{ ...mediaStyle, opacity: clipOpacity }} />
                  : activeClip.type === 'image'
                    ? <img src={activeClip.sourceUrl} alt="" style={{ ...mediaStyle, opacity: clipOpacity }} />
                    : <div style={{ width:'100%', height:'100%', background: activeClip.color || '#000', opacity: activeClip.opacity ?? 1 }} />;
              })()
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#444', fontSize: 13 }}>
                Add clips to get started
              </div>
            )}

            {/* Text overlays — live animated */}
            {visibleText.map(te => {
              const animStyle = computeTextAnimStyle(te);
              const localTime = playhead - te.startTime;
              const IN_DUR = 0.5;
              const inP = Math.min(1, Math.max(0, localTime / IN_DUR));
              const displayText = te.animationIn === 'typewriter' && inP < 1
                ? te.text.slice(0, Math.round(inP * te.text.length)) + '▍'
                : te.text;
              const shadowMap = {
                none: 'none', soft: '2px 2px 8px rgba(0,0,0,0.7)',
                hard: '2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000',
                glow: `0 0 20px ${te.fill},0 0 40px ${te.fill}`,
                neon: `0 0 10px #fff,0 0 20px ${te.fill},0 0 40px ${te.fill},0 0 80px ${te.fill}`,
              };
              const textShadow = shadowMap[te.shadowPreset || 'none'] || shadowMap.none;
              const strokeStyle = te.strokeWidth ? { WebkitTextStroke: `${te.strokeWidth * previewContainerW / 1080}px ${te.strokeColor || '#000'}` } : {};
              const bgRgb = te.bgColor ? (h => `rgba(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)},${te.bgOpacity ?? 0.6})`)(te.bgColor) : null;
              return (
                <div key={te.id}
                  onMouseDown={e => onTextMouseDown(e, te)}
                  style={{
                    position: 'absolute', left: `${te.xPercent}%`, top: `${te.yPercent}%`,
                    transform: animStyle.transform, opacity: animStyle.opacity,
                    cursor: 'move', userSelect: 'none',
                    fontFamily: te.fontFamily,
                    fontSize: Math.round(te.fontSize * previewContainerW / 1080),
                    fontWeight: (te.fontStyle||'').includes('bold') ? 700 : 400,
                    fontStyle: (te.fontStyle||'').includes('italic') ? 'italic' : 'normal',
                    color: te.fill, textAlign: te.align || 'center', whiteSpace: 'pre-wrap',
                    textShadow,
                    ...(bgRgb && { background: bgRgb, padding: '3px 10px', borderRadius: 4 }),
                    border: selectedId === te.id ? '2px solid #00C4CC' : '2px solid transparent',
                    padding: bgRgb ? '3px 10px' : 4, borderRadius: 4,
                    ...strokeStyle, ...(animStyle.filter ? { filter: animStyle.filter } : {}),
                  }}>
                  {displayText}
                </div>
              );
            })}
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
      <div style={s.timeline} onClick={() => setTransitionPickerClipId(null)}>
        {/* Track labels */}
        <div style={s.timelineLabels}>
          <div style={{ height: 20, borderBottom: `1px solid ${t.border}` }} />
          <div style={{ ...s.timelineTrackLabel, height: 60 }}>Video</div>
          <div style={{ ...s.timelineTrackLabel, height: 44 }}>Text</div>
          <div style={{ ...s.timelineTrackLabel, height: 44 }}>Audio</div>
        </div>

        {/* Scrollable track area */}
        <div ref={timelineRef} style={s.timelineScroll} onClick={onTimelineClick}>
          <div style={{ ...s.timelineInner, width: timelineWidth }}>
            {/* Ruler */}
            {TimelineRuler()}

            {/* ── Video track (60px) ── */}
            <div style={{ position: 'relative', height: 60, borderBottom: `1px solid ${t.border}` }}>
              {project.clips.map((clip, i) => {
                const clipW = Math.max(8, clip.duration * zoom);
                const hasThumbnail = (clip.type === 'image' || clip.type === 'video') && clip.thumbnailUrl;
                const isSelected = selectedId === clip.id;
                // transition slot between this clip and the next
                const nextClip = project.clips[i + 1];
                const hasTransition = nextClip?.transitionIn?.type && nextClip.transitionIn.type !== 'none';
                return (
                  <div key={clip.id} style={{ position: 'absolute', left: clip.trackStart * zoom, width: clipW, top: 4, height: 52, boxSizing: 'border-box' }}>
                    {/* Clip body */}
                    <div
                      onMouseDown={e => onClipMouseDown(e, clip)}
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 5,
                        backgroundImage: hasThumbnail ? `url(${clip.thumbnailUrl})` : undefined,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        background: hasThumbnail ? undefined : (clip.type === 'color' ? clip.color : clipColor(clip)),
                        cursor: 'grab', overflow: 'hidden', boxSizing: 'border-box',
                        border: isSelected ? `2px solid #00C4CC` : `1px solid rgba(255,255,255,0.15)`,
                        display: 'flex', alignItems: 'center',
                      }}>
                      {/* Dark overlay for readability on thumbnails */}
                      {hasThumbnail && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)' }} />}
                      {/* Trim left handle */}
                      <div onMouseDown={e => onTrimLeftMouseDown(e, clip)}
                        style={{ position: 'absolute', left: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.35)', borderRadius: '4px 0 0 4px', zIndex: 2 }} />
                      {/* Label */}
                      <span style={{ fontSize: 10, color: '#fff', paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, position: 'relative', zIndex: 1, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                        {clip.type === 'color' ? 'Color' : clip.sourceUrl?.split('/').pop()?.split('?')[0].slice(0, 22) || (clip.type === 'image' ? 'Image' : 'Video')}
                      </span>
                      {/* Speed badge */}
                      {clip.speed && clip.speed !== 1 && (
                        <span style={{ fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: 3, marginRight: 10, position: 'relative', zIndex: 1 }}>{clip.speed}×</span>
                      )}
                      {/* Reverse badge */}
                      {clip.reverse && (
                        <span style={{ fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: 3, marginRight: 4, position: 'relative', zIndex: 1 }}>⇐</span>
                      )}
                      {/* Trim right handle */}
                      <div onMouseDown={e => onTrimRightMouseDown(e, clip)}
                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.35)', borderRadius: '0 4px 4px 0', zIndex: 2 }} />
                    </div>

                    {/* Transition slot (between this clip and the next) */}
                    {nextClip && (
                      <div
                        onClick={e => { e.stopPropagation(); setTransitionPickerClipId(transitionPickerClipId === nextClip.id ? null : nextClip.id); setSelectedId(nextClip.id); setSelectedTrack('clip'); }}
                        title={`Transition: ${TRANSITION_LABELS[nextClip.transitionIn?.type] || 'Cut'}`}
                        style={{
                          position: 'absolute', right: -11, top: '50%', transform: 'translateY(-50%)',
                          width: 22, height: 22, borderRadius: '50%', zIndex: 8,
                          background: hasTransition ? '#00C4CC' : t.card,
                          border: `2px solid ${hasTransition ? '#00C4CC' : t.border}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: hasTransition ? '#000' : t.textMuted,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }}>
                        ↔
                        {/* Transition picker popover */}
                        {transitionPickerClipId === nextClip.id && (
                          <div onClick={e => e.stopPropagation()}
                            style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, width: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                            <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4, textAlign: 'center' }}>Transition</div>
                            {TRANSITION_TYPES.map(tt => (
                              <button key={tt}
                                onClick={() => { updateClip(nextClip.id, { transitionIn: { ...nextClip.transitionIn, type: tt } }); setTransitionPickerClipId(null); }}
                                style={{ padding: '6px 4px', borderRadius: 6, border: `1px solid ${(nextClip.transitionIn?.type || 'none') === tt ? '#00C4CC' : t.border}`, background: (nextClip.transitionIn?.type || 'none') === tt ? 'rgba(0,196,204,0.12)' : t.input, color: (nextClip.transitionIn?.type || 'none') === tt ? '#00C4CC' : t.text, fontSize: 11, cursor: 'pointer', fontWeight: (nextClip.transitionIn?.type || 'none') === tt ? 600 : 400 }}>
                                {TRANSITION_LABELS[tt]}
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

            {/* ── Text track (44px) ── */}
            <div style={{ position: 'relative', height: 44, borderBottom: `1px solid ${t.border}` }}>
              {project.textElements.map(te => {
                const isSelected = selectedId === te.id;
                return (
                  <div key={te.id}
                    onMouseDown={e => onTextTimelineDrag(e, te)}
                    style={{
                      position: 'absolute',
                      left: te.startTime * zoom,
                      width: Math.max(8, (te.endTime - te.startTime) * zoom),
                      height: 32, top: 6,
                      borderRadius: 5,
                      background: isSelected ? '#6D28D9' : '#7C3AED',
                      cursor: 'grab', display: 'flex', alignItems: 'center', overflow: 'hidden',
                      boxSizing: 'border-box',
                      border: isSelected ? `2px solid #A78BFA` : `1px solid rgba(255,255,255,0.2)`,
                    }}>
                    {/* Trim left (startTime) */}
                    <div onMouseDown={e => { e.stopPropagation(); const startX = e.clientX; const orig = te.startTime; const dur = te.endTime - te.startTime; const onMove = me => { const dx = (me.clientX - startX) / zoom; const ns = Math.max(0, Math.min(te.endTime - 0.5, orig + dx)); updateText(te.id, { startTime: ns }); }; const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }}
                      style={{ position: 'absolute', left: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '4px 0 0 4px', zIndex: 2 }} />
                    <span style={{ fontSize: 9, color: '#fff', paddingLeft: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>T {te.text}</span>
                    {/* Trim right (endTime) */}
                    <div onMouseDown={e => onTextTrimRight(e, te)}
                      style={{ position: 'absolute', right: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '0 4px 4px 0', zIndex: 2 }} />
                  </div>
                );
              })}
            </div>

            {/* ── Audio track (44px) ── */}
            <div style={{ position: 'relative', height: 44 }}>
              {project.audioTracks.map(at => {
                const endTime = at.endTime || totalDuration;
                const w = Math.max(8, (endTime - at.startTime) * zoom);
                const isSelected = selectedId === at.id;
                return (
                  <div key={at.id}
                    onMouseDown={e => onAudioTimelineDrag(e, at)}
                    style={{
                      position: 'absolute',
                      left: at.startTime * zoom,
                      width: w,
                      height: 32, top: 6,
                      borderRadius: 5,
                      background: isSelected ? '#047857' : '#065F46',
                      cursor: 'grab', overflow: 'hidden', boxSizing: 'border-box',
                      border: isSelected ? `2px solid #34D399` : `1px solid rgba(255,255,255,0.15)`,
                    }}>
                    {/* Trim left */}
                    <div onMouseDown={e => { e.stopPropagation(); const startX = e.clientX; const orig = at.startTime; const onMove = me => { const dx = (me.clientX - startX) / zoom; const ns = Math.max(0, orig + dx); updateAudio(at.id, { startTime: ns }); }; const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }}
                      style={{ position: 'absolute', left: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '4px 0 0 4px', zIndex: 2 }} />
                    {/* Waveform — real if computed, decorative fallback */}
                    <div style={{ position: 'absolute', left: 10, right: 10, bottom: 3, top: 3, display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                      {(waveformData[at.id] || Array.from({ length: 80 }, (_, i) => 0.15 + Math.abs(Math.sin(i*0.8)*0.5 + Math.sin(i*2.1+1)*0.25))).map((v, i) => (
                        <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.55)', height: `${Math.max(8, v * 90)}%`, minHeight: 2, borderRadius: 1 }} />
                      ))}
                    </div>
                    {/* Audio label */}
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)', zIndex: 1, pointerEvents: 'none' }}>
                      ♪ {at.sourceUrl?.split('/').pop()?.split('?')[0].slice(0, 16) || 'Audio'}
                    </span>
                    {/* Trim right */}
                    <div onMouseDown={e => onAudioTrimRight(e, at)}
                      style={{ position: 'absolute', right: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '0 4px 4px 0', zIndex: 2 }} />
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

      {/* ── Post Video modal ── */}
      {postModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setPostModal(false); }}>
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 28, width: 460, border: '1px solid #2a2a2a', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Post Your Video</span>
              <button onClick={() => setPostModal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {postStatus === 'done' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Your video is posting!</div>
                <div style={{ fontSize: 13, color: '#888' }}>It will appear on your social accounts shortly.</div>
              </div>
            ) : (
              <>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Caption</label>
                <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)}
                  placeholder="Write your caption here…"
                  style={{ width: '100%', minHeight: 100, padding: 10, borderRadius: 8, border: '1px solid #2a2a2a', background: '#111', color: '#fff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16, outline: 'none' }} />

                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>Post to</label>
                {connectedAccounts.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                    No social accounts connected. <a href="/settings" style={{ color: '#00C4CC' }}>Connect in Settings →</a>
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {connectedAccounts.map(acct => (
                      <label key={acct.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, background: postPlatforms.includes(acct.id) ? 'rgba(0,196,204,0.15)' : '#111', border: `1px solid ${postPlatforms.includes(acct.id) ? '#00C4CC' : '#2a2a2a'}`, cursor: 'pointer', fontSize: 13, color: '#fff', userSelect: 'none' }}>
                        <input type="checkbox" checked={postPlatforms.includes(acct.id)}
                          onChange={() => setPostPlatforms(p => p.includes(acct.id) ? p.filter(x => x !== acct.id) : [...p, acct.id])}
                          style={{ display: 'none' }} />
                        {acct.platform_name || acct.platform}
                      </label>
                    ))}
                  </div>
                )}

                {postStatus === 'error' && (
                  <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>Posting failed. Please try again.</div>
                )}

                <button onClick={handlePostNow} disabled={postPlatforms.length === 0 || postStatus === 'posting'}
                  style={{ width: '100%', height: 44, borderRadius: 8, border: 'none', background: postPlatforms.length === 0 ? '#333' : '#00C4CC', color: postPlatforms.length === 0 ? '#666' : '#000', fontWeight: 700, fontSize: 15, cursor: postPlatforms.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 150ms' }}>
                  {postStatus === 'posting' ? 'Posting…' : 'Post Now'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
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
