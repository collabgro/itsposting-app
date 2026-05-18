import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish, IpPhoto as ImageIcon, IpVideo, IpDelete, IpSearch,
  IpFolderOpen, IpClose, IpCheck, IpHardDrive, IpFolderPlus,
  IpPhotoStudio, IpMediaLibrary, IpSparkle, IpDownload, IpSchedule, IpDrafts,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Badge, EmptyState, Spinner, useToast, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI, studioAPI } from '../lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const b = parseInt(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const STORAGE_KEY = 'itsposting_custom_folders';

// ─── Studio constants ────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'tips', 'job_site', 'before_after', 'seasonal', 'team', 'general'];
const STYLES = [
  { id: 'banner',       label: 'Top Banner',    desc: 'Solid bar across top' },
  { id: 'bottom_bar',   label: 'Bottom Bar',     desc: 'Solid bar at bottom' },
  { id: 'center',       label: 'Center Overlay', desc: 'Floating box in center' },
  { id: 'full_overlay', label: 'Full Overlay',   desc: 'Tinted whole photo' },
];
const COLOR_PRESETS = [
  { hex: '#1a5c2a', label: 'Forest Green' },
  { hex: '#1a3a5c', label: 'Navy Blue' },
  { hex: '#5c1a1a', label: 'Deep Red' },
  { hex: '#2a2a2a', label: 'Charcoal' },
  { hex: '#3b2a5c', label: 'Purple' },
];
const PRESETS = {
  plumbing:           [{ title: 'Emergency Plumbing', subtitle: 'Available 24/7 in your area' }, { title: 'Leak Repair Tips', subtitle: 'Save water and money this season' }, { title: 'Frozen Pipe Alert', subtitle: 'Winter preparation checklist for homeowners' }, { title: 'Drain Cleaning Special', subtitle: 'Book today — limited spots available' }],
  hvac:               [{ title: 'AC Tune-Up Time', subtitle: 'Beat the summer heat before it arrives' }, { title: 'Furnace Not Working?', subtitle: 'Same-day emergency service available' }, { title: 'Energy Saving Tips', subtitle: 'Cut your heating bill this winter' }, { title: 'New System Installation', subtitle: 'Financing available — ask us today' }],
  roofing:            [{ title: 'Storm Damage?', subtitle: 'Free inspection for local homeowners' }, { title: 'Roof Replacement Tips', subtitle: 'What every homeowner should know' }, { title: 'Spring Roof Check', subtitle: 'Catch problems before they cost you' }, { title: 'We Work Year Round', subtitle: 'No job too big or too small' }],
  concrete:           [{ title: 'Driveway Upgrade', subtitle: 'Transform your curb appeal this season' }, { title: 'Concrete Repair 101', subtitle: 'Catch cracks before they spread' }, { title: 'Free Estimate Today', subtitle: 'No obligation — honest pricing' }, { title: 'Built to Last', subtitle: 'Quality concrete work, guaranteed' }],
  landscaping:        [{ title: 'Tree Care Tip', subtitle: 'Protect your property value today' }, { title: 'Spring Lawn Prep', subtitle: 'Start the season the right way' }, { title: 'Storm Damage?', subtitle: 'We respond within 24 hours' }, { title: 'Free Consultation', subtitle: 'Design your dream outdoor space' }],
  electrical:         [{ title: 'Safety Check Time', subtitle: 'Is your panel up to current code?' }, { title: 'Power Outage Ready?', subtitle: 'Generator installation and maintenance' }, { title: 'EV Charger Install', subtitle: 'Home charging for your electric vehicle' }, { title: 'Call Before You DIY', subtitle: 'Electrical work done right the first time' }],
  painting:           [{ title: 'Fresh Coat Season', subtitle: 'Book now before the summer rush' }, { title: 'Colour Consultation', subtitle: 'We help you choose the perfect palette' }, { title: 'Interior Refresh', subtitle: 'Transform your home in a weekend' }, { title: 'Exterior Protection', subtitle: 'Weather-proof paint that lasts for years' }],
  pest_control:       [{ title: 'Pest Season Alert', subtitle: 'Protect your home before they move in' }, { title: 'Ant Season Is Here', subtitle: 'Prevention tips for homeowners' }, { title: 'Safe For Families', subtitle: 'Effective treatment, pet and kid friendly' }, { title: 'Free Inspection', subtitle: 'Know what you are dealing with first' }],
  general_contractor: [{ title: 'Home Reno Tips', subtitle: 'Plan your project the right way' }, { title: 'Free Estimate', subtitle: 'No hidden fees, honest pricing' }, { title: 'Licensed and Insured', subtitle: 'Peace of mind on every project' }, { title: 'Built Right', subtitle: 'Quality craftsmanship, guaranteed' }],
  cleaning:           [{ title: 'Deep Clean Season', subtitle: 'Your home deserves a fresh start' }, { title: 'Move In Ready', subtitle: 'Professional cleaning before you settle in' }, { title: 'Weekly Service', subtitle: 'Consistent clean home, every week' }, { title: 'Satisfaction Guaranteed', subtitle: 'We are not happy until you are' }],
};

// Canvas overlay renderer for the studio preview
function drawOverlay(ctx, title, subtitle, style, width, height, color, textColor, opacity) {
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  };
  const rgb = hexToRgb(color);
  const wrapLines = (text, maxW) => {
    const words = text.split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  ctx.font = `bold 36px Arial, sans-serif`;
  const titleLines = wrapLines(title || '', width * 0.85);
  ctx.font = `20px Arial, sans-serif`;
  const subLines = subtitle ? wrapLines(subtitle, width * 0.85) : [];
  const lineH = 42; const subH = 28;
  const contentH = titleLines.length * lineH + (subLines.length ? 12 + subLines.length * subH : 0);
  const barH = contentH + 48;

  if (style === 'banner') {
    ctx.fillStyle = `rgba(${rgb},${opacity})`;
    ctx.fillRect(0, 0, width, barH);
    const startY = 24;
    ctx.font = `bold 36px Arial, sans-serif`;
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    titleLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + i * lineH + 30));
    if (subLines.length) {
      ctx.font = `20px Arial, sans-serif`; ctx.globalAlpha = 0.9;
      subLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + titleLines.length * lineH + 12 + i * subH + 20));
      ctx.globalAlpha = 1;
    }
  } else if (style === 'bottom_bar') {
    const barY = height - barH;
    ctx.fillStyle = `rgba(${rgb},${opacity})`;
    ctx.fillRect(0, barY, width, barH);
    const startY = barY + 24;
    ctx.font = `bold 36px Arial, sans-serif`;
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    titleLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + i * lineH + 30));
    if (subLines.length) {
      ctx.font = `20px Arial, sans-serif`; ctx.globalAlpha = 0.9;
      subLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + titleLines.length * lineH + 12 + i * subH + 20));
      ctx.globalAlpha = 1;
    }
  } else if (style === 'center') {
    const boxW = width * 0.85; const boxX = (width - boxW) / 2;
    const boxY = (height - barH) / 2;
    ctx.fillStyle = `rgba(${rgb},${opacity})`;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, barH, 12);
    ctx.fill();
    const startY = boxY + 24;
    ctx.font = `bold 36px Arial, sans-serif`;
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    titleLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + i * lineH + 30));
    if (subLines.length) {
      ctx.font = `20px Arial, sans-serif`; ctx.globalAlpha = 0.9;
      subLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + titleLines.length * lineH + 12 + i * subH + 20));
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = `rgba(${rgb},${Math.min(opacity * 0.65, 0.75)})`;
    ctx.fillRect(0, 0, width, height);
    const startY = (height - contentH) / 2;
    ctx.font = `bold 40px Arial, sans-serif`;
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    titleLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + i * lineH + 30));
    if (subLines.length) {
      ctx.font = `22px Arial, sans-serif`; ctx.globalAlpha = 0.9;
      subLines.forEach((l, i) => ctx.fillText(l, width / 2, startY + titleLines.length * lineH + 12 + i * subH + 20));
      ctx.globalAlpha = 1;
    }
  }
}

function StepGuide({ step, t }) {
  const steps = [
    { n: 1, label: 'Pick a photo' },
    { n: 2, label: 'Design your overlay' },
    { n: 3, label: 'Post or save' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 20px', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: step >= s.n ? t.primary : t.border, color: step >= s.n ? '#fff' : t.textMuted, flexShrink: 0 }}>{s.n}</div>
            <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? t.text : t.textMuted }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 32, height: 2, background: step > s.n ? t.primary : t.border, margin: '0 10px', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function MediaLibrary() {
  const router = useRouter();
  const { t } = useTheme();
  const { showToast } = useToast();

  // ── Media library refs
  const fileInputRef = useRef(null);

  // ── Studio refs
  const canvasRef     = useRef(null);
  const sectionTwoRef = useRef(null);
  const photoImgRef   = useRef(null);

  // ── Core
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('library');

  // ── Media library state
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [customFolders, setCustomFolders] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterFolder, setFilterFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewFile, setPreviewFile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);

  // ── Studio: photo browser
  const [industryFilter,   setIndustryFilter]   = useState('mine');
  const [categoryFilter,   setCategoryFilter]   = useState('all');
  const [studioSearch,     setStudioSearch]     = useState('');
  const [photos,           setPhotos]           = useState([]);
  const [photosTotal,      setPhotosTotal]      = useState(0);
  const [photosOffset,     setPhotosOffset]     = useState(0);
  const [photosLoading,    setPhotosLoading]    = useState(false);
  const [customerIndustry, setCustomerIndustry] = useState('');

  // ── Studio: editor
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [overlayStyle,  setOverlayStyle]  = useState('banner');
  const [overlayColor,  setOverlayColor]  = useState('#1a5c2a');
  const [customColor,   setCustomColor]   = useState('');
  const [textColor]                       = useState('#ffffff');
  const [opacity]                         = useState(0.85);
  const [title,         setTitle]         = useState('');
  const [subtitle,      setSubtitle]      = useState('');
  const [prompt,        setPrompt]        = useState('');
  const [formatting,    setFormatting]    = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [generatedUrl,  setGeneratedUrl]  = useState(null);
  const [generatedId,   setGeneratedId]   = useState(null);
  const [studioError,   setStudioError]   = useState('');

  // ── Studio: post modal
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [studioCaption, setStudioCaption] = useState('');
  const [hashtags,      setHashtags]      = useState('');
  const [postPlatforms, setPostPlatforms] = useState(['facebook', 'instagram']);
  const [scheduleMode,  setScheduleMode]  = useState('draft');
  const [scheduledDate, setScheduledDate] = useState('');
  const [posting,       setPosting]       = useState(false);

  // ── Studio: creations
  const [creations,        setCreations]        = useState([]);
  const [creationsOpen,    setCreationsOpen]    = useState(false);
  const [creationsLoading, setCreationsLoading] = useState(false);

  // ── Mount + auth
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setCustomFolders(Array.isArray(stored) ? stored : []);
    } catch { setCustomFolders([]); }
    loadAll();
  }, []);

  // ── Read ?tab= query param
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.tab === 'studio') setActiveTab('studio');
  }, [router.isReady]);

  // ── Reload files on filter change
  useEffect(() => { if (mounted) loadFiles(); }, [filterType, filterFolder, search]);

  // ── Load customerIndustry from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { const u = JSON.parse(stored); setCustomerIndustry(u.industry || ''); } catch {}
    }
  }, []);

  // ── Studio: auto-load creations when tab activates
  useEffect(() => {
    if (activeTab === 'studio' && creations.length === 0) loadCreations();
  }, [activeTab]);

  // ── Studio: reload photos on filter change
  useEffect(() => {
    setPhotosOffset(0);
    loadPhotos(0, false);
  }, [industryFilter, categoryFilter, customerIndustry]);

  // ── Studio: debounced photo search
  useEffect(() => {
    const timer = setTimeout(() => { setPhotosOffset(0); loadPhotos(0, false); }, 400);
    return () => clearTimeout(timer);
  }, [studioSearch]);

  // ── Studio: canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedPhoto) return;
    const ctx = canvas.getContext('2d');
    const img = photoImgRef.current;
    if (!img || !img.complete) return;
    const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    if (title.trim()) drawOverlay(ctx, title, subtitle, overlayStyle, W, H, overlayColor, textColor, opacity);
  }, [title, subtitle, overlayStyle, overlayColor, selectedPhoto, generatedUrl]);

  // ─── Media library handlers ───────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    try {
      const [filesRes, foldersRes, quotaRes] = await Promise.all([
        mediaAPI.list({ type: filterType, folder: filterFolder }),
        mediaAPI.getFolders(),
        mediaAPI.getQuota(),
      ]);
      setFiles(filesRes.data);
      setFolders(foldersRes.data);
      setQuota(quotaRes.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load media library' });
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterFolder !== 'all') params.folder = filterFolder;
      if (search) params.search = search;
      const res = await mediaAPI.list(params);
      setFiles(res.data);
    } catch (err) { console.error(err); }
  };

  const allFolders = (() => {
    const apiNames = new Set(folders.map(f => f.folder));
    const merged = [...folders];
    for (const name of customFolders) {
      if (!apiNames.has(name)) merged.push({ folder: name, count: 0, isEmpty: true });
    }
    return merged;
  })();

  const folderNamesSet = new Set(allFolders.map(f => f.folder));
  const looseFiles = filterFolder === 'all'
    ? files.filter(f => !f.folder || !folderNamesSet.has(f.folder))
    : files;
  const displayFiles = filterFolder === 'all' ? looseFiles : files;

  const handleCreateFolder = () => {
    const name = newFolderName.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    if (!name) return;
    if (allFolders.find(f => f.folder === name)) {
      setMessage({ type: 'error', text: `Folder "${name}" already exists` });
      setShowFolderModal(false);
      setNewFolderName('');
      return;
    }
    const updated = [...customFolders, name];
    setCustomFolders(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFilterFolder(name);
    setShowFolderModal(false);
    setNewFolderName('');
    setMessage({ type: 'success', text: `Folder "${name}" created. Upload files to add content.` });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setMessage({ type: 'info', text: `Uploading ${selected.length} file(s)...` });
    try {
      const res = await mediaAPI.upload(selected, filterFolder, setUploadProgress);
      setMessage({ type: 'success', text: `Uploaded ${res.data.uploaded} file(s) (${res.data.totalSizeUploaded})` });
      await loadAll();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      const available = err.response?.data?.available;
      setMessage({ type: 'error', text: available ? `${msg}. Available: ${available}` : msg });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      title: 'Delete File',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await mediaAPI.delete(id);
          showToast('File deleted', 'success');
          await loadAll();
        } catch {
          showToast('Delete failed', 'error');
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      title: 'Delete Files',
      message: `Delete ${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete All',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(Array.from(selectedIds).map((id) => mediaAPI.delete(id)));
          showToast(`Deleted ${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''}`, 'success');
          setSelectedIds(new Set());
          await loadAll();
        } catch {
          showToast('Some deletions failed', 'error');
        }
      },
    });
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // ─── Studio handlers ──────────────────────────────────────────────────────

  const loadPhotos = useCallback(async (offset = 0, append = false) => {
    setPhotosLoading(true);
    try {
      const params = { limit: 30, offset };
      if (industryFilter !== 'all') params.industry = industryFilter === 'mine' ? customerIndustry : undefined;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (studioSearch.trim()) params.search = studioSearch.trim();
      const { data } = await studioAPI.getPhotos(params);
      setPhotos(prev => append ? [...prev, ...(data.photos || [])] : (data.photos || []));
      setPhotosTotal(data.total || 0);
      setPhotosOffset(offset);
    } catch (e) {
      console.error(e);
    } finally {
      setPhotosLoading(false);
    }
  }, [industryFilter, categoryFilter, studioSearch, customerIndustry]);

  const handleSelectPhoto = (photo) => {
    setSelectedPhoto(photo);
    setGeneratedUrl(null);
    setGeneratedId(null);
    setTitle('');
    setSubtitle('');
    setPrompt('');
    setStudioError('');
    setTimeout(() => sectionTwoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handlePreset = (preset) => {
    setTitle(preset.title);
    setSubtitle(preset.subtitle);
    setGeneratedUrl(null);
  };

  const handleFormat = async () => {
    if (!prompt.trim()) return setStudioError('Please describe what you want on this photo.');
    setFormatting(true); setStudioError('');
    try {
      const { data } = await studioAPI.format({ stockPhotoId: selectedPhoto.id, prompt: prompt.trim(), style: overlayStyle });
      setTitle(data.title || '');
      setSubtitle(data.subtitle || '');
      if (data.overlayColor) setOverlayColor(data.overlayColor);
      setGeneratedUrl(null);
    } catch (e) {
      setStudioError(e.response?.data?.error || 'PostCore could not format your text. Please try again.');
    } finally {
      setFormatting(false);
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) return setStudioError('Please add a title before generating.');
    setGenerating(true); setStudioError('');
    try {
      const { data } = await studioAPI.generate({
        stockPhotoId: selectedPhoto.id, title: title.trim(), subtitle: subtitle.trim(),
        style: overlayStyle, overlayColor, textColor, opacity,
      });
      setGeneratedUrl(data.creation.outputUrl);
      setGeneratedId(data.creation.id);
      // Refresh creations strip
      loadCreations();
    } catch (e) {
      setStudioError(e.response?.data?.error || 'Failed to generate image. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!generatedId) return;
    setPosting(true); setStudioError('');
    try {
      const hashtagArr = hashtags.trim() ? hashtags.trim().split(/\s+/).map(h => h.startsWith('#') ? h : `#${h}`) : [];
      await studioAPI.postCreation(generatedId, { caption: studioCaption, hashtags: hashtagArr, platforms: postPlatforms, scheduleMode, scheduledDate: scheduledDate || null });
      setPostModalOpen(false);
      const msg = scheduleMode === 'now' ? 'Post published!' : scheduleMode === 'schedule' ? 'Post scheduled!' : 'Saved as draft!';
      showToast(msg, 'success');
    } catch (e) {
      setStudioError(e.response?.data?.error || 'Failed to save post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const loadCreations = async () => {
    setCreationsLoading(true);
    try {
      const { data } = await studioAPI.getCreations({ limit: 20 });
      setCreations(data.creations || []);
    } catch {}
    finally { setCreationsLoading(false); }
  };

  const toggleCreations = () => {
    if (!creationsOpen) loadCreations();
    setCreationsOpen(o => !o);
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(generatedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'studio-graphic.jpg'; a.click();
      URL.revokeObjectURL(url);
    } catch { window.open(generatedUrl, '_blank'); }
  };

  const handleReuseCreation = async (creation) => {
    try {
      const { data } = await studioAPI.getPhoto(creation.stock_photo_id);
      setSelectedPhoto(data.photo);
      setTitle(creation.overlay_title || '');
      setSubtitle(creation.overlay_subtitle || '');
      setOverlayStyle(creation.overlay_style || 'banner');
      setOverlayColor(creation.overlay_color || '#1a5c2a');
      setGeneratedUrl(null);
      setGeneratedId(null);
      setStudioError('');
      setTimeout(() => sectionTwoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      console.error('Failed to load photo for re-use', e);
    }
  };

  // ─── Tab switch ───────────────────────────────────────────────────────────

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    router.push({ pathname: '/media', query: tab === 'studio' ? { tab: 'studio' } : {} }, undefined, { shallow: true });
  };

  // ─── Derived values ────────────────────────────────────────────────────────

  const msgBg     = { error: 'rgba(239,68,68,0.1)', success: 'rgba(34,197,94,0.1)', info: '' };
  const msgBorder = { error: 'rgba(239,68,68,0.3)', success: 'rgba(34,197,94,0.3)', info: '' };
  const msgColor  = { error: t.error, success: t.success, info: t.primary };
  const presets   = PRESETS[customerIndustry] || PRESETS.general_contractor;
  const activeStep = generatedUrl ? 3 : selectedPhoto ? 2 : 1;
  const recentCreations = creations.slice(0, 5);

  if (!mounted) return null;

  // ─── Reusable file card renderer ─────────────────────────────────────────

  const renderFileGrid = (fileList, emptyTitle, emptySubtitle) => {
    if (fileList.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={IpFolderOpen}
            title={emptyTitle}
            subtitle={emptySubtitle}
            action={
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                <IpPublish size={14} strokeWidth={2.5} /> Upload files{filterFolder !== 'all' ? ` to "${filterFolder}"` : ''}
              </Button>
            }
          />
        </Card>
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {fileList.map((file) => {
          const isSelected = selectedIds.has(file.id);
          return (
            <div
              key={file.id}
              onClick={() => setPreviewFile(file)}
              style={{ background: t.card, border: `2px solid ${isSelected ? t.primary : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 150ms ease', position: 'relative' }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.primaryBorder; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.border; }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 6, background: isSelected ? t.primary : 'rgba(0,0,0,0.5)', border: `1px solid ${isSelected ? t.primary : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 2 }}
              >
                {isSelected && <IpCheck size={14} strokeWidth={3} />}
              </button>
              <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 6, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, zIndex: 2 }}>
                {file.file_type === 'video' ? <IpVideo size={10} /> : <ImageIcon size={10} />}
                {file.file_type}
              </div>
              <div style={{ aspectRatio: '1/1', background: t.input, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {file.file_type === 'video' ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img src={file.thumbnail_url} alt={file.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }}>▶</div>
                    </div>
                  </div>
                ) : (
                  <img src={file.url} alt={file.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.file_name}>
                  {file.file_name}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  {formatBytes(file.file_size_bytes)}{file.used_in_posts > 0 && ` · Used ${file.used_in_posts}x`}
                </div>
                {file.folder && file.folder !== 'all' && (
                  <div style={{ fontSize: 10, color: t.primary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IpFolderOpen size={9} /> {file.folder}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout
      title={activeTab === 'library' ? 'Media Library' : 'Photo Studio'}
      subtitle={activeTab === 'library'
        ? (quota ? `${quota.usedFormatted} / ${quota.quotaFormatted} used` : 'Loading...')
        : 'Pick a stock photo, add your message, post it.'}
      action={activeTab === 'library' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedIds.size > 0 && (
            <Button variant="danger" onClick={handleBulkDelete}>
              <IpDelete size={14} /> Delete ({selectedIds.size})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowFolderModal(true)}>
            <IpFolderPlus size={14} /> New Folder
          </Button>
          <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading
              ? <img src="/icon-192.png" alt="" style={{ width: 14, height: 14, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} />
              : <IpPublish size={14} strokeWidth={2.5} />}
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}
          </Button>
        </div>
      ) : null}
    >
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* ── TAB SWITCHER ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: t.input, borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {[
          { id: 'library', label: 'My Media',     Icon: IpMediaLibrary },
          { id: 'studio',  label: 'Photo Studio', Icon: IpPhotoStudio  },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => handleTabSwitch(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: activeTab === id ? t.card : 'transparent',
              color: activeTab === id ? t.text : t.textMuted,
              boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 150ms ease',
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MY MEDIA TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'library' && (
        <>
          {message.text && (
            <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgBg[message.type] || t.primaryBg, border: `1px solid ${msgBorder[message.type] || t.primaryBorder}`, color: msgColor[message.type] }}>
              {message.text}
            </div>
          )}

          {/* QUOTA BAR */}
          {quota && (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IpHardDrive size={18} color="url(#brand-gradient)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Storage</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      {quota.fileCount} {quota.fileCount === 1 ? 'file' : 'files'} · {quota.usedFormatted} of {quota.quotaFormatted}
                    </div>
                  </div>
                </div>
                <Badge variant={parseFloat(quota.percentUsed) > 90 ? 'error' : parseFloat(quota.percentUsed) > 70 ? 'warning' : 'primary'}>
                  {quota.percentUsed}%
                </Badge>
              </div>
              <div style={{ height: 6, background: t.input, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, parseFloat(quota.percentUsed))}%`, background: parseFloat(quota.percentUsed) > 90 ? t.error : parseFloat(quota.percentUsed) > 70 ? t.warning : t.primary, borderRadius: 3, transition: 'width 300ms ease' }} />
              </div>
            </Card>
          )}

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            {filterFolder !== 'all' && (
              <button
                onClick={() => setFilterFolder('all')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'color 150ms' }}
                onMouseEnter={e => e.currentTarget.style.color = t.text}
                onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
              >
                ← All Files
              </button>
            )}
            {displayFiles.length > 0 && (
              <button
                onClick={() => setSelectedIds(selectedIds.size === displayFiles.length ? new Set() : new Set(displayFiles.map(f => f.id)))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: selectedIds.size > 0 ? t.primaryBg : t.input, border: `1px solid ${selectedIds.size > 0 ? t.primaryBorder : t.border}`, borderRadius: 8, color: selectedIds.size > 0 ? t.primary : t.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${selectedIds.size > 0 ? t.primary : t.border}`, background: selectedIds.size === displayFiles.length ? t.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedIds.size === displayFiles.length && <IpCheck size={9} color="#fff" strokeWidth={3} />}
                  {selectedIds.size > 0 && selectedIds.size < displayFiles.length && <div style={{ width: 6, height: 1.5, background: t.primary }} />}
                </div>
                {selectedIds.size === displayFiles.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
              <IpSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
              <input
                type="text" placeholder="Search files..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 34px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, background: t.input, padding: 3, borderRadius: 8 }}>
              {[{ id: 'all', label: 'All' }, { id: 'image', label: 'Images' }, { id: 'video', label: 'Videos' }].map((opt) => (
                <button key={opt.id} onClick={() => setFilterType(opt.id)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: filterType === opt.id ? t.text : t.textMuted, background: filterType === opt.id ? t.card : 'transparent', cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT */}
          {loading ? (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <Spinner size={48} />
              </div>
            </Card>
          ) : filterFolder !== 'all' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <IpFolderOpen size={18} color={t.primary} />
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{filterFolder}</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>· {files.length} {files.length === 1 ? 'file' : 'files'}</span>
              </div>
              {renderFileGrid(files, `No files in "${filterFolder}"`, 'Upload files to this folder using the Upload button above')}
            </>
          ) : (
            <>
              {allFolders.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 8 }}>
                  {allFolders.map((f) => (
                    <div
                      key={f.folder}
                      onClick={() => setFilterFolder(f.folder)}
                      style={{ background: t.card, border: `2px solid ${t.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 150ms ease', padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 110 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; }}
                    >
                      <IpFolderOpen size={34} color={t.primary} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{f.folder}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{f.count} {f.count === 1 ? 'file' : 'files'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {allFolders.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
                  <div style={{ flex: 1, height: 1, background: t.border }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Files{looseFiles.length > 0 ? ` · ${looseFiles.length}` : ''}
                  </span>
                  <div style={{ flex: 1, height: 1, background: t.border }} />
                </div>
              )}
              {renderFileGrid(
                looseFiles,
                allFolders.length > 0 ? 'No loose files' : 'No media yet',
                allFolders.length > 0 ? 'All your files are organised into folders above' : 'Upload images and videos to use in your posts'
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PHOTO STUDIO TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'studio' && (
        <div style={{ maxWidth: 1200, paddingBottom: 80 }}>

          {/* Recent Creations strip — always visible, auto-loaded */}
          {(creationsLoading || recentCreations.length > 0) && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Creations</span>
                <button onClick={() => { setCreationsOpen(o => !o); if (!creationsOpen) loadCreations(); }}
                  style={{ fontSize: 12, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {creationsOpen ? 'Hide all' : `See all (${creations.length})`}
                </button>
              </div>
              {creationsLoading ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ width: 120, height: 150, borderRadius: 10, background: t.input, flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                  {recentCreations.map(c => (
                    <div key={c.id} style={{ flexShrink: 0, width: 120, borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', transition: 'border-color 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = t.primaryBorder}
                      onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                      <img src={c.output_url} alt={c.overlay_title} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{c.overlay_title}</div>
                        {c.stock_photo_id && (
                          <button onClick={() => handleReuseCreation(c)}
                            style={{ width: '100%', padding: '3px 0', fontSize: 10, fontWeight: 600, borderRadius: 5, border: `1px solid ${t.primaryBorder}`, background: t.primaryBg, color: t.primary, cursor: 'pointer' }}>
                            Re-use style
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full creations grid toggle */}
              {creationsOpen && (
                <div style={{ marginTop: 16 }}>
                  {creations.length === 0 ? (
                    <p style={{ fontSize: 13, color: t.textMuted }}>No creations yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {creations.map(c => (
                        <div key={c.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card }}>
                          <img src={c.output_url} alt={c.overlay_title} style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '4/5' }} />
                          <div style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.overlay_title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <Badge style={{ fontSize: 10 }}>{c.status}</Badge>
                              <span style={{ fontSize: 11, color: t.textMuted }}>{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            {c.stock_photo_id && (
                              <button onClick={() => handleReuseCreation(c)}
                                style={{ width: '100%', padding: '5px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.primary, cursor: 'pointer' }}>
                                Re-use this style
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step progress */}
          <StepGuide step={activeStep} t={t} />

          {/* ── Section 1: Photo browser ───────────────────────────────────── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', background: t.card, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                {['mine', 'all'].map(v => (
                  <button key={v} onClick={() => setIndustryFilter(v)}
                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: industryFilter === v ? t.primary : 'transparent', color: industryFilter === v ? '#fff' : t.textMuted, transition: 'all 0.15s' }}>
                    {v === 'mine' ? 'My Industry' : 'All Industries'}
                  </button>
                ))}
              </div>
              <input value={studioSearch} onChange={e => setStudioSearch(e.target.value)}
                placeholder="Search photos..."
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, width: 200, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 20, border: `1px solid ${categoryFilter === cat ? t.primary : t.border}`, background: categoryFilter === cat ? t.primaryBg : 'transparent', color: categoryFilter === cat ? t.primary : t.textMuted, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                  {cat === 'all' ? 'All' : cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>

            {photosLoading && photos.length === 0 ? (
              <div style={{ textAlign: 'center', color: t.textMuted, padding: '60px 0', fontSize: 14 }}>Loading photos...</div>
            ) : photos.length === 0 ? (
              <EmptyState title="No photos found" subtitle="Try a different category or search term." />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {photos.map(photo => (
                    <PhotoCard key={photo.id} photo={photo} selected={selectedPhoto?.id === photo.id} onSelect={handleSelectPhoto} t={t} />
                  ))}
                </div>
                {photos.length < photosTotal && (
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <Button variant="ghost" onClick={() => loadPhotos(photosOffset + 30, true)} disabled={photosLoading}>
                      {photosLoading ? 'Loading...' : `Load more (${photosTotal - photos.length} remaining)`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {!selectedPhoto && (
            <div style={{ textAlign: 'center', padding: '10px 0 24px', color: t.textMuted, fontSize: 13 }}>
              ↑ Select a photo above to start designing your graphic
            </div>
          )}

          {/* ── Section 2: Editor ──────────────────────────────────────────── */}
          {selectedPhoto && (
            <div ref={sectionTwoRef} style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 20 }}>Design Your Overlay</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

                {/* Left — Preview */}
                <div>
                  <div style={{ position: 'relative', background: t.card, borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                    {generatedUrl ? (
                      <img src={generatedUrl} alt="Generated" style={{ width: '100%', display: 'block', borderRadius: 12 }} />
                    ) : (
                      <>
                        <img
                          ref={photoImgRef}
                          src={selectedPhoto.url}
                          alt={selectedPhoto.title}
                          crossOrigin="anonymous"
                          style={{ display: 'none' }}
                          onLoad={() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const img = photoImgRef.current;
                            const aspectH = Math.round(canvas.width * (img.naturalHeight / img.naturalWidth));
                            canvas.height = aspectH || Math.round(canvas.width * 1.25);
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            if (title.trim()) drawOverlay(ctx, title, subtitle, overlayStyle, canvas.width, canvas.height, overlayColor, textColor, opacity);
                          }}
                        />
                        <canvas ref={canvasRef} width={540} style={{ width: '100%', display: 'block', borderRadius: 12 }} />
                        {!title && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13 }}>Type your message to preview the overlay</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Style selector */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Overlay Style</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {STYLES.map(s => (
                        <button key={s.id} onClick={() => { setOverlayStyle(s.id); setGeneratedUrl(null); }}
                          style={{ padding: '10px 8px', borderRadius: 8, border: `2px solid ${overlayStyle === s.id ? t.primary : t.border}`, background: overlayStyle === s.id ? t.primaryBg : t.card, cursor: 'pointer', textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: overlayStyle === s.id ? t.primary : t.text }}>{s.label}</div>
                          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color presets */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Overlay Color</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map(c => (
                        <button key={c.hex} onClick={() => { setOverlayColor(c.hex); setCustomColor(''); setGeneratedUrl(null); }}
                          title={c.label}
                          style={{ width: 32, height: 32, borderRadius: '50%', background: c.hex, border: `3px solid ${overlayColor === c.hex ? '#fff' : 'transparent'}`, outline: overlayColor === c.hex ? `2px solid ${t.primary}` : 'none', cursor: 'pointer' }} />
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" value={customColor || overlayColor}
                          onChange={e => { setCustomColor(e.target.value); setOverlayColor(e.target.value); setGeneratedUrl(null); }}
                          style={{ width: 32, height: 32, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', padding: 2, background: 'none' }} />
                        <span style={{ fontSize: 12, color: t.textMuted }}>Custom</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right — Controls */}
                <div>
                  <Card style={{ padding: 24 }}>
                    {/* Quick Presets */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quick Presets — 0 credits</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {presets.map((p, i) => (
                          <button key={i} onClick={() => handlePreset(p)}
                            style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {p.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '16px 0' }} />

                    {/* PostCore prompt */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>What do you want this post to say?</label>
                      <textarea value={prompt} onChange={e => setPrompt(e.target.value.slice(0, 200))} maxLength={200}
                        placeholder="e.g. 'Tip about pruning trees in spring' or 'Emergency plumbing available 24/7'"
                        rows={3}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'right', marginTop: 4 }}>{prompt.length}/200</div>
                    </div>
                    <Button onClick={handleFormat} disabled={formatting || !prompt.trim()} style={{ width: '100%', marginBottom: 16 }}>
                      <IpSparkle size={15} style={{ marginRight: 6 }} />
                      {formatting ? 'PostCore is writing...' : 'Format with PostCore — 1 credit'}
                    </Button>

                    <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '16px 0' }} />

                    {/* Title + subtitle */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 4 }}>Title</label>
                      <input value={title} onChange={e => { setTitle(e.target.value); setGeneratedUrl(null); }}
                        maxLength={80} placeholder="Main text (8 words max)"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 4 }}>Subtitle <span style={{ fontWeight: 400, color: t.textMuted }}>(optional)</span></label>
                      <input value={subtitle} onChange={e => { setSubtitle(e.target.value); setGeneratedUrl(null); }}
                        maxLength={120} placeholder="Secondary line or soft CTA"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    {studioError && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', color: t.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: `1px solid rgba(239,68,68,0.2)` }}>
                        {studioError}
                      </div>
                    )}

                    <Button onClick={handleGenerate} disabled={generating || !title.trim()} variant="primary" style={{ width: '100%', marginBottom: 12 }}>
                      {generating ? 'Creating your graphic...' : 'Generate Image — 0 credits'}
                    </Button>

                    {generatedUrl && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button onClick={handleDownload} variant="ghost" style={{ flex: 1 }}>
                          <IpDownload size={14} style={{ marginRight: 4 }} /> Download
                        </Button>
                        <Button onClick={() => { setStudioCaption(''); setScheduleMode('now'); setPostModalOpen(true); }} style={{ flex: 1 }}>
                          <IpPublish size={14} style={{ marginRight: 4 }} /> Post Now
                        </Button>
                        <Button onClick={() => { setStudioCaption(''); setScheduleMode('schedule'); setPostModalOpen(true); }} variant="ghost" style={{ flex: 1 }}>
                          <IpSchedule size={14} style={{ marginRight: 4 }} /> Schedule
                        </Button>
                        <Button onClick={() => { setStudioCaption(''); setScheduleMode('draft'); setPostModalOpen(true); }} variant="ghost" style={{ flex: 1 }}>
                          <IpDrafts size={14} style={{ marginRight: 4 }} /> Save Draft
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW MODAL (media library) ──────────────────────────────────── */}
      {previewFile && (
        <div onClick={() => setPreviewFile(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, maxWidth: 900, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{previewFile.file_name}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {formatBytes(previewFile.file_size_bytes)}{previewFile.width && ` · ${previewFile.width}×${previewFile.height}`}{previewFile.duration_seconds && ` · ${Math.round(previewFile.duration_seconds)}s`}
                  {previewFile.folder && previewFile.folder !== 'all' && ` · 📁 ${previewFile.folder}`}
                </div>
              </div>
              <button onClick={() => setPreviewFile(null)} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IpClose size={16} />
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: 16, overflow: 'hidden' }}>
              {previewFile.file_type === 'video'
                ? <video src={previewFile.url} controls style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8 }} />
                : <img src={previewFile.url} alt={previewFile.file_name} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, objectFit: 'contain' }} />
              }
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={() => { handleDelete(previewFile.id); setPreviewFile(null); }}
                style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.error, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <IpDelete size={14} /> Delete
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(previewFile.url); showToast('URL copied!', 'success'); }}
                  style={{ padding: '8px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Copy URL
                </button>
                <button
                  onClick={() => { sessionStorage.setItem('selectedMediaFile', JSON.stringify(previewFile)); router.push('/upload'); }}
                  style={{ padding: '8px 16px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Use in Post →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW FOLDER MODAL ───────────────────────────────────────────────── */}
      {showFolderModal && (
        <div onClick={() => { setShowFolderModal(false); setNewFolderName(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Create New Folder</h3>
              <button onClick={() => { setShowFolderModal(false); setNewFolderName(''); }} style={{ width: 30, height: 30, borderRadius: 7, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
                <IpClose size={15} />
              </button>
            </div>
            <div style={{ padding: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                placeholder="e.g. Campaigns, Logos, Spring 2025"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13, marginBottom: 18 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowFolderModal(false); setNewFolderName(''); }} style={{ flex: 1, padding: '10px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  style={{ flex: 2, padding: '10px 0', background: !newFolderName.trim() ? t.textDisabled : t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !newFolderName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <IpFolderPlus size={13} /> Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDIO POST MODAL ─────────────────────────────────────────────── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: t.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
                {scheduleMode === 'now' ? 'Post Now' : scheduleMode === 'schedule' ? 'Schedule Post' : 'Save as Draft'}
              </h3>
              <button onClick={() => setPostModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}>
                <IpClose size={20} />
              </button>
            </div>

            <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Caption (optional)</label>
            <textarea value={studioCaption} onChange={e => setStudioCaption(e.target.value)} rows={3}
              placeholder="Add a caption for this post..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

            <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Hashtags (optional)</label>
            <input type="text" value={hashtags} onChange={e => setHashtags(e.target.value)}
              placeholder="#plumbing #local #austintx"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

            <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 8 }}>Platforms</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
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

            {scheduleMode === 'schedule' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Schedule Date & Time</label>
                <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {studioError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', color: t.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: `1px solid rgba(239,68,68,0.2)` }}>
                {studioError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => setPostModalOpen(false)} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handlePost} disabled={posting} style={{ flex: 2 }}>
                {posting ? 'Saving...' : scheduleMode === 'now' ? 'Post Now' : scheduleMode === 'schedule' ? 'Schedule' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </Layout>
  );
}

function PhotoCard({ photo, selected, onSelect, t }) {
  return (
    <div onClick={() => onSelect(photo)}
      style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${selected ? t.primary : t.border}`, transition: 'border-color 0.15s', background: t.card, position: 'relative' }}>
      <img
        src={photo.thumbnail_url || photo.url}
        alt={photo.title || 'Stock photo'}
        loading="lazy"
        style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }}
      />
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: t.primary, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IpCheck size={14} style={{ color: '#fff' }} />
        </div>
      )}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {photo.title || `${photo.industry} — ${photo.category}`}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'} />
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
