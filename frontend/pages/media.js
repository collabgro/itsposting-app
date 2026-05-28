import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish, IpPhoto as ImageIcon, IpVideo, IpDelete, IpSearch,
  IpFolderOpen, IpClose, IpCheck, IpHardDrive, IpFolderPlus,
  IpPhotoStudio, IpMediaLibrary,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Badge, EmptyState, Spinner, useToast, ConfirmModal } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI, studioAPI, customerAPI } from '../lib/api';

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

// ─── Main component ─────────────────────────────────────────────────────────

export default function MediaLibrary() {
  const router = useRouter();
  const { t } = useTheme();
  const { showToast } = useToast();

  // ── Media library refs
  const fileInputRef = useRef(null);

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

  // ── Templates: creations + curated templates
  const [creations,        setCreations]        = useState([]);
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [curatedTemplates, setCuratedTemplates] = useState([]);
  const [curatedLoading,   setCuratedLoading]   = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [showSizePicker,   setShowSizePicker]   = useState(false);
  const [pickerSizeId,     setPickerSizeId]      = useState('ig_portrait');
  const [templateThumbs,       setTemplateThumbs]       = useState({});
  const [templatePexelsThumbs, setTemplatePexelsThumbs] = useState({});
  const [isAdmin,              setIsAdmin]              = useState(false);

  // ── Mount + auth
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setCustomFolders(Array.isArray(stored) ? stored : []);
    } catch { setCustomFolders([]); }
    loadAll();
    customerAPI.getProfile().then(r => setIsAdmin(!!r.data?.is_admin)).catch(() => {});
  }, []);

  // ── Read ?tab= query param
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.tab === 'templates') setActiveTab('templates');
  }, [router.isReady]);

  // ── Reload files on filter change
  useEffect(() => { if (mounted) loadFiles(); }, [filterType, filterFolder, search]);

  // ── Templates: auto-load when tab activates
  useEffect(() => {
    if (activeTab !== 'templates') return;
    if (creations.length === 0) loadCreations();
    if (curatedTemplates.length === 0) loadCurated();
  }, [activeTab]);

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

  // ─── Templates handlers ───────────────────────────────────────────────────

  const loadCreations = async () => {
    setCreationsLoading(true);
    try {
      const { data } = await studioAPI.getCreations({ limit: 50 });
      setCreations(data.creations || []);
    } catch {}
    finally { setCreationsLoading(false); }
  };

  const loadCurated = async (industry = 'all') => {
    setCuratedLoading(true);
    try {
      const { data } = await studioAPI.getTemplates(industry !== 'all' ? { industry, limit: 30 } : { limit: 30 });
      setCuratedTemplates(data?.templates || []);
    } catch {}
    finally { setCuratedLoading(false); }
  };

  // ── Pexels photo thumbnails for templates that have a known query ────────────
  const TEMPLATE_PEXELS_QUERIES = {
    'Roofing — Storm Damage Alert':      'dark storm clouds dramatic sky',
    'Roofing — Before & After Showcase': 'new roof installation shingles',
    'Roofing — 5-Star Review Spotlight': 'happy homeowner house exterior',
    'Roofing — 5 Warning Signs':         'old damaged roof shingles',
    'Roofing — Free Estimate Offer':     'beautiful new roof sunny day',
    'Roofing — Meet the Crew':           'construction workers hard hats job site',
    'Roofing — Insurance Claim Help':    'homeowner insurance paperwork storm damage',
    'Roofing — Reel Hook':               'roofer installing shingles residential home',
    'Roofing — Financing Available':     'white house maple trees suburban',
    'Roofing — Google Review Ask':       'happy people smiling satisfied customers',
  };

  useEffect(() => {
    if (curatedTemplates.length === 0) return;
    const needsPexels = curatedTemplates.filter(
      t => !t.thumbnail_url && TEMPLATE_PEXELS_QUERIES[t.name] && !templatePexelsThumbs[t.id]
    );
    if (!needsPexels.length) return;
    (async () => {
      const fetched = {};
      for (const tmpl of needsPexels) {
        try {
          const { data } = await studioAPI.searchStockPhotos(TEMPLATE_PEXELS_QUERIES[tmpl.name], 1);
          const thumb = data?.photos?.[0]?.thumbUrl;
          if (thumb) fetched[tmpl.id] = thumb;
        } catch {} // Pexels may not be configured — fail silently
        await new Promise(r => setTimeout(r, 80)); // avoid hammering the backend
      }
      if (Object.keys(fetched).length) setTemplatePexelsThumbs(prev => ({ ...prev, ...fetched }));
    })();
  }, [curatedTemplates]);

  // ── Client-side thumbnail generation for templates without a stored thumbnail_url ──
  useEffect(() => {
    if (curatedTemplates.length === 0) return;
    const needsThumbs = curatedTemplates.filter(t => !t.thumbnail_url && !templateThumbs[t.id]);
    if (needsThumbs.length === 0) return;
    (async () => {
      const THUMB_W = 270, THUMB_H = 338;
      const results = {};
      for (const tmpl of needsThumbs) {
        const pageData = tmpl.canvas_json?.pages?.[0];
        if (!pageData) continue;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = THUMB_W; canvas.height = THUMB_H;
          const ctx = canvas.getContext('2d');
          const scale = THUMB_W / 1080;
          ctx.fillStyle = pageData.bgColor || '#1a1a2e';
          ctx.fillRect(0, 0, THUMB_W, THUMB_H);
          for (const el of (pageData.elements || [])) {
            ctx.save();
            ctx.globalAlpha = el.opacity ?? 1;
            if (el.type === 'rect' && el.fill) {
              ctx.fillStyle = el.fill;
              const x = (el.x || 0) * scale, y = (el.y || 0) * scale;
              const w = (el.width || 100) * scale, h = (el.height || 20) * scale;
              const r = (el.cornerRadius || 0) * scale;
              if (r > 0) {
                ctx.beginPath();
                ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r);
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath(); ctx.fill();
              } else {
                ctx.fillRect(x, y, w, h);
              }
            } else if (el.type === 'text' && el.text) {
              const fw = parseInt(el.fontWeight) || 400;
              const isBold = fw >= 600;
              const isItalic = (el.fontStyle || '').includes('italic');
              const fontSize = Math.max(5, (el.fontSize || 16) * scale);
              ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${el.fontFamily || 'Inter'}, sans-serif`;
              ctx.fillStyle = el.fill || '#fff';
              ctx.textAlign = el.align || 'left';
              const x = (el.x || 0) * scale;
              const maxW = el.width ? el.width * scale : THUMB_W - x;
              const lineH = fontSize * (el.lineHeight || 1.2);
              const words = String(el.text).split(' ');
              let line = '', lineY = (el.y || 0) * scale + fontSize;
              for (const word of words) {
                const test = line ? line + ' ' + word : word;
                if (ctx.measureText(test).width > maxW && line) {
                  ctx.fillText(line, x, lineY, maxW); line = word; lineY += lineH;
                  if (lineY > THUMB_H) break;
                } else { line = test; }
              }
              if (line && lineY <= THUMB_H) ctx.fillText(line, x, lineY, maxW);
            }
            ctx.restore();
          }
          results[tmpl.id] = canvas.toDataURL('image/jpeg', 0.85);
        } catch (_) {}
        await new Promise(r => setTimeout(r, 10));
      }
      if (Object.keys(results).length > 0) setTemplateThumbs(prev => ({ ...prev, ...results }));
    })();
  }, [curatedTemplates]);

  // ─── Tab switch ───────────────────────────────────────────────────────────

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    router.push({ pathname: '/media', query: tab === 'templates' ? { tab: 'templates' } : {} }, undefined, { shallow: true });
  };

  // ─── Derived values ────────────────────────────────────────────────────────

  const msgBg     = { error: 'rgba(239,68,68,0.1)', success: 'rgba(34,197,94,0.1)', info: '' };
  const msgBorder = { error: 'rgba(239,68,68,0.3)', success: 'rgba(34,197,94,0.3)', info: '' };
  const msgColor  = { error: t.error, success: t.success, info: t.primary };

  if (!mounted) return null;

  // ─── Reusable file card renderer ─────────────────────────────────────────

  const renderFileGrid = (fileList, emptyTitle, emptySubtitle) => {
    if (fileList.length === 0) {
      return (
        <div style={{ padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
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
        </div>
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
              style={{ background: isSelected ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : (t.isDark ? 'rgba(15,15,24,0.72)' : t.card), backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `2px solid ${isSelected ? 'rgba(124,92,252,0.5)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', position: 'relative', boxShadow: isSelected ? '0 4px 16px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.07)' : `${t.shadowSm}` }}
              onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)'; e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(124,92,252,0.15)'; } }}
              onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = t.shadowSm; } }}
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
      title={activeTab === 'library' ? 'Media Library' : 'Templates'}
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 36, background: t.isDark ? 'rgba(15,15,24,0.78)' : t.input, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, padding: 4, width: 'fit-content', boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}>
        {[
          { id: 'library', label: 'My Media',   Icon: IpMediaLibrary },
          { id: 'templates', label: 'Templates', Icon: IpPhotoStudio },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => handleTabSwitch(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: activeTab === id ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
              cursor: 'pointer',
              background: activeTab === id ? t.primaryBg : 'transparent',
              color: activeTab === id ? t.primary : t.textMuted,
              boxShadow: activeTab === id ? `0 2px 10px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.08)` : 'none',
              transition: 'all 150ms ease',
              letterSpacing: '-0.01em',
            }}>
            <Icon size={14} color={activeTab === id ? t.primary : t.textMuted} /> {label}
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
            <div style={{ marginBottom: 20, padding: '20px', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16, boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})` }}>
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
            </div>
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
            <div style={{ padding: '60px 20px', display: 'flex', justifyContent: 'center', background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 16 }}>
              <Spinner size={48} />
            </div>
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
                      style={{ background: t.card, border: `2px solid ${t.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 110 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = t.shadowMd; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
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
          TEMPLATES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'templates' && (() => {
        const INDUSTRIES = ['all', 'plumbing', 'hvac', 'roofing', 'concrete', 'landscaping', 'electrical', 'painting', 'pest_control', 'cleaning', 'general_contractor'];
        const INDUSTRY_LABELS = { all: 'All', plumbing: 'Plumbing', hvac: 'HVAC', roofing: 'Roofing', concrete: 'Concrete', landscaping: 'Landscaping', electrical: 'Electrical', painting: 'Painting', pest_control: 'Pest Control', cleaning: 'Cleaning', general_contractor: 'General' };
        const CANVAS_SIZES = [
          { id: 'ig_portrait', label: 'Instagram Portrait', desc: '1080 × 1350 px — best for feed posts', w: 1080, h: 1350 },
          { id: 'ig_square',   label: 'Instagram Square',   desc: '1080 × 1080 px — grid-friendly',    w: 1080, h: 1080 },
          { id: 'ig_story',    label: 'Instagram Story',    desc: '1080 × 1920 px — full screen',      w: 1080, h: 1920 },
          { id: 'fb_post',     label: 'Facebook Post',      desc: '1200 × 630 px — landscape',         w: 1200, h: 630  },
          { id: 'google_biz',  label: 'Google Business',    desc: '720 × 720 px — square',             w: 720,  h: 720  },
        ];

        return (
          <div style={{ paddingBottom: 80 }}>
            {/* ── Action bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
              <div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10 }}>Start from scratch or pick a template below</div>
                <button
                  onClick={() => setShowSizePicker(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.35)', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', letterSpacing: '-0.01em' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,92,252,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,92,252,0.35)'; }}
                >
                  <IpPhotoStudio size={15} /> New Design
                </button>
              </div>
            </div>

            {/* ── ItsPosting Templates section ── */}
            <div style={{ marginBottom: 64 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: 0, letterSpacing: '-0.02em' }}>ItsPosting Templates</h2>
                  <p style={{ fontSize: 13, color: t.textMuted, margin: '5px 0 0' }}>Ready-made designs for every industry — click to customise</p>
                </div>
              </div>

              {/* Industry filter chips */}
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 24 }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind}
                    onClick={() => {
                      setSelectedIndustry(ind);
                      setCuratedTemplates([]);
                      loadCurated(ind);
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: selectedIndustry === ind ? t.primary : t.input,
                      color: selectedIndustry === ind ? '#fff' : t.textMuted,
                      border: `1px solid ${selectedIndustry === ind ? t.primary : t.border}`,
                      cursor: 'pointer', transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.text; } }}
                    onMouseLeave={e => { if (selectedIndustry !== ind) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; } }}>
                    {INDUSTRY_LABELS[ind]}
                  </button>
                ))}
              </div>

              {/* Curated grid */}
              {curatedLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.07}s ease-in-out infinite` }} />
                  ))}
                </div>
              ) : curatedTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🎨</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8, letterSpacing: '-0.01em' }}>Templates coming soon</div>
                  <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>ItsPosting is building industry-specific templates for your business. Check back soon!</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {curatedTemplates.map(tmpl => (
                    <div key={tmpl.id}
                      style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', position: 'relative', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.tmpl-hover').style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.querySelector('.tmpl-hover').style.opacity = '0'; }}>
                      <div style={{ aspectRatio: '4/5', background: t.input, position: 'relative', overflow: 'hidden' }}>
                        {(() => {
                          const CAT_ICONS = { 'before-after': '◑', 'social-proof': '⭐', 'seasonal': '❄', 'educational': '💡', 'promotional': '📣', 'team': '👥' };
                          const bgColor = tmpl.canvas_json?.pages?.[0]?.bgColor || '#1a1a2e';
                          const thumbSrc = tmpl.thumbnail_url || templatePexelsThumbs[tmpl.id] || templateThumbs[tmpl.id];
                          return thumbSrc
                            ? <img src={thumbSrc} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: '100%', background: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                                <span style={{ fontSize: 28 }}>{CAT_ICONS[tmpl.category] || '✦'}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.02em' }}>{tmpl.name}</span>
                              </div>;
                        })()}
                        <div className="tmpl-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', gap: 10, flexDirection: 'column', backdropFilter: 'blur(2px)' }}>
                          <button
                            onClick={() => router.push(`/templates/editor?template=${tmpl.id}`)}
                            style={{ padding: '9px 22px', background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.5)' }}>
                            Use Template
                          </button>
                          {isAdmin && (
                            <button
                              onClick={e => { e.stopPropagation(); router.push(`/templates/editor?template=${tmpl.id}`); }}
                              style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 22, fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                              ✏ Edit Template
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{tmpl.name}</div>
                        {tmpl.category && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, textTransform: 'capitalize' }}>{tmpl.category.replace(/-/g, ' ')}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── My Designs section ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: 0, letterSpacing: '-0.02em' }}>My Designs</h2>
                  {creations.length > 0 && <p style={{ fontSize: 13, color: t.textMuted, margin: '5px 0 0' }}>{creations.length} design{creations.length !== 1 ? 's' : ''} saved</p>}
                </div>
              </div>
              {creationsLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.input, aspectRatio: '4/5', animation: `shimmer 1.4s ${i * 0.1}s ease-in-out infinite` }} />
                  ))}
                </div>
              ) : creations.length === 0 ? (
                <EmptyState icon={IpPhotoStudio} title="No designs yet" subtitle="Click 'New Design' above to create your first branded graphic" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {creations.map(c => (
                    <div key={c.id}
                      style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', position: 'relative', transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = t.shadowLg; e.currentTarget.querySelector('.design-hover').style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.querySelector('.design-hover').style.opacity = '0'; }}>
                      {c.creation_type === 'video' ? (
                        <div style={{ position: 'relative', aspectRatio: '9/16', background: '#000', overflow: 'hidden' }}>
                          {c.output_url
                            ? <video src={c.output_url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 11 }}>{c.render_status === 'rendering' ? 'Rendering…' : 'Processing'}</div>
                          }
                          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                            <IpVideo size={10} /> Video
                          </div>
                        </div>
                      ) : (
                        <div style={{ aspectRatio: '4/5', overflow: 'hidden', position: 'relative' }}>
                          {c.output_url
                            ? <img src={c.output_url} alt={c.overlay_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.input, fontSize: 11, color: t.textMuted }}>No preview</div>
                          }
                        </div>
                      )}
                      <div className="design-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', padding: 12, gap: 6, backdropFilter: 'blur(2px)' }}>
                        <button
                          onClick={() => router.push(c.creation_type === 'video' ? `/templates/editor?id=${c.id}&mode=video` : `/templates/editor?id=${c.id}`)}
                          style={{ flex: 1, padding: '8px 0', background: '#fff', color: '#111', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Edit
                        </button>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{c.overlay_title || 'Untitled'}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Size Picker Modal ── */}
      {showSizePicker && (
        <div onClick={() => setShowSizePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Choose a canvas size</h3>
              <button onClick={() => setShowSizePicker(false)} style={{ width: 30, height: 30, borderRadius: 7, background: t.input, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
                <IpClose size={15} />
              </button>
            </div>
            <div style={{ padding: 22 }}>
              {[
                { id: 'ig_portrait', label: 'Instagram Portrait', desc: '1080 × 1350 px', icon: '📷' },
                { id: 'ig_square',   label: 'Instagram Square',   desc: '1080 × 1080 px', icon: '⬛' },
                { id: 'ig_story',    label: 'Instagram Story',    desc: '1080 × 1920 px', icon: '📱' },
                { id: 'fb_post',     label: 'Facebook Post',      desc: '1200 × 630 px',  icon: '🖼️' },
                { id: 'google_biz',  label: 'Google Business',    desc: '720 × 720 px',   icon: '🔍' },
              ].map(size => (
                <label key={size.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: pickerSizeId === size.id ? t.primaryBg : 'transparent', border: `1px solid ${pickerSizeId === size.id ? t.primary : 'transparent'}`, transition: 'all 100ms' }}>
                  <input type="radio" name="canvasSize" value={size.id} checked={pickerSizeId === size.id} onChange={() => setPickerSizeId(size.id)} style={{ accentColor: t.primary }} />
                  <span style={{ fontSize: 18 }}>{size.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{size.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{size.desc}</div>
                  </div>
                </label>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={() => setShowSizePicker(false)} style={{ flex: 1, padding: '10px 0', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={() => { setShowSizePicker(false); router.push(`/templates/editor?size=${pickerSizeId}`); }}
                  style={{ flex: 2, padding: '10px 0', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <IpPhotoStudio size={13} /> Create Design →
                </button>
              </div>
            </div>
          </div>
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

      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </Layout>
  );
}


