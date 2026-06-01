import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish, IpPhoto as ImageIcon, IpVideo, IpDelete, IpSearch,
  IpFolderOpen, IpClose, IpCheck, IpHardDrive, IpFolderPlus,
  IpPhotoStudio, IpMediaLibrary,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, Badge, EmptyState, Spinner, useToast, ConfirmModal } from '../components/ui';
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

  // Lazy-load studio/branded fonts — only needed on this page for Photo Studio
  useEffect(() => {
    if (!document.getElementById('font-studio')) {
      const link = document.createElement('link');
      link.id = 'font-studio';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:wght@400;700&family=Lato:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Oswald:wght@400;600;700&family=Pacifico&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;700&family=Source+Sans+3:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // ── Media library refs
  const fileInputRef = useRef(null);

  // ── Core
  const [mounted, setMounted] = useState(false);

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
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgRemovedUrl, setBgRemovedUrl] = useState(null);
  // ── Drag-to-move state
  const [dragFileId, setDragFileId] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [isAdmin,              setIsAdmin]              = useState(false);

  // ── Responsive
  const [isMobile, setIsMobile] = useState(false);

  // ── Mount + auth
  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setCustomFolders(Array.isArray(stored) ? stored : []);
    } catch { setCustomFolders([]); }
    loadAll();
    customerAPI.getProfile().then(r => setIsAdmin(!!r.data?.is_admin)).catch(() => {});
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cancel drag on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && dragFileId) { setDragFileId(null); setDragOverFolder(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragFileId]);

  // ── Reload files on filter change
  useEffect(() => { if (mounted) loadFiles(); }, [filterType, filterFolder, search]);

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

  const handleRemoveBackground = async (file) => {
    setBgRemoving(true);
    setBgRemovedUrl(null);
    try {
      const res = await studioAPI.removeBackground(file.url);
      setBgRemovedUrl(res.data?.outputUrl || res.data?.url);
      showToast('Background removed!', 'success');
    } catch {
      showToast('Background removal failed', 'error');
    } finally {
      setBgRemoving(false);
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

  const handleMoveToFolder = async (fileId, targetFolder) => {
    if (!fileId) return;
    try {
      await mediaAPI.moveToFolder(fileId, targetFolder);
      showToast(targetFolder ? `Moved to "${targetFolder}"` : 'Moved to root', 'success');
      loadFiles();
    } catch {
      showToast('Failed to move file', 'error');
    } finally {
      setDragFileId(null);
      setDragOverFolder(null);
    }
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
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', file.id); setDragFileId(file.id); }}
              onDragEnd={() => { setDragFileId(null); setDragOverFolder(null); }}
              onClick={() => setPreviewFile(file)}
              style={{ background: isSelected ? (t.isDark ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.07)') : (t.isDark ? 'rgba(15,15,24,0.72)' : t.card), backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `2px solid ${isSelected ? 'rgba(124,92,252,0.5)' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: dragFileId ? 'grabbing' : 'pointer', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', position: 'relative', boxShadow: isSelected ? '0 4px 16px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.07)' : `${t.shadowSm}`, opacity: dragFileId === file.id ? 0.5 : 1 }}
              onMouseEnter={(e) => { if (!isSelected && !dragFileId) { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)'; e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(124,92,252,0.15)'; } }}
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
                {file.ai_tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                    {file.ai_tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: t.isDark ? 'rgba(124,92,252,0.15)' : 'rgba(124,92,252,0.08)', color: t.primary, fontWeight: 600, border: `1px solid rgba(124,92,252,0.2)`, cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); setSearch(tag); }}>
                        {tag}
                      </span>
                    ))}
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
      title="Media Library"
      subtitle={quota ? `${quota.usedFormatted} / ${quota.quotaFormatted} used` : 'Loading...'}
      action={(
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && (
            <Button variant="danger" onClick={handleBulkDelete}>
              <IpDelete size={14} /> {isMobile ? selectedIds.size : `Delete (${selectedIds.size})`}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowFolderModal(true)}>
            <IpFolderPlus size={14} /> {!isMobile && 'New Folder'}
          </Button>
          <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading
              ? <img src="/icon-192.png" alt="" style={{ width: 14, height: 14, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} />
              : <IpPublish size={14} strokeWidth={2.5} />}
            {uploading ? (isMobile ? `${uploadProgress}%` : `Uploading ${uploadProgress}%`) : (isMobile ? 'Upload' : 'Upload Files')}
          </Button>
        </div>
      )}
    >
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* ══════════════════════════════════════════════════════════════════════
          MY MEDIA
      ══════════════════════════════════════════════════════════════════════ */}
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20, flexDirection: isMobile ? 'column' : 'row' }}>
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
            <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : 200, maxWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : undefined }}>
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
              {dragFileId && (
                <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 10, background: t.primaryBg, border: `1px dashed ${t.primaryBorder}`, fontSize: 12, color: t.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IpFolderOpen size={14} /> Drop onto a folder to move · <span style={{ fontWeight: 400, color: t.textMuted }}>Escape to cancel</span>
                </div>
              )}
              {allFolders.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 8 }}>
                  {allFolders.map((f) => {
                    const isDropTarget = dragOverFolder === f.folder;
                    return (
                      <div
                        key={f.folder}
                        onClick={() => !dragFileId && setFilterFolder(f.folder)}
                        onDragOver={(e) => { if (dragFileId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolder(f.folder); } }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFolder(null); }}
                        onDrop={(e) => { e.preventDefault(); handleMoveToFolder(dragFileId, f.folder); }}
                        style={{ background: isDropTarget ? t.primaryBg : t.card, border: `2px solid ${isDropTarget ? t.primary : t.border}`, borderRadius: 12, cursor: dragFileId ? 'copy' : 'pointer', transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)', padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 110, transform: isDropTarget ? 'scale(1.04)' : 'none', boxShadow: isDropTarget ? `0 0 0 2px ${t.primary}, ${t.shadowMd}` : 'none' }}
                        onMouseEnter={(e) => { if (!dragFileId) { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = t.shadowMd; } }}
                        onMouseLeave={(e) => { if (!dragFileId) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.card; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } }}
                      >
                        <IpFolderOpen size={34} color={isDropTarget ? t.primary : t.primary} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{f.folder}</div>
                          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
                            {isDropTarget ? 'Drop to move here' : `${f.count} ${f.count === 1 ? 'file' : 'files'}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* ── PREVIEW MODAL (media library) ──────────────────────────────────── */}
      {previewFile && (
        <div onClick={() => { setPreviewFile(null); setBgRemovedUrl(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, maxWidth: 900, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{previewFile.file_name}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {formatBytes(previewFile.file_size_bytes)}{previewFile.width && ` · ${previewFile.width}×${previewFile.height}`}{previewFile.duration_seconds && ` · ${Math.round(previewFile.duration_seconds)}s`}
                  {previewFile.folder && previewFile.folder !== 'all' && ` · 📁 ${previewFile.folder}`}
                </div>
                {previewFile.ai_tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {previewFile.ai_tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: t.isDark ? 'rgba(124,92,252,0.15)' : 'rgba(124,92,252,0.08)', color: t.primary, fontWeight: 600, border: `1px solid rgba(124,92,252,0.2)` }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { setPreviewFile(null); setBgRemovedUrl(null); }} style={{ width: 32, height: 32, borderRadius: 8, background: t.input, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IpClose size={16} />
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, padding: 16, overflow: 'hidden', position: 'relative' }}>
              {previewFile.file_type === 'video'
                ? <video src={previewFile.url} controls style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8 }} />
                : bgRemovedUrl
                  ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original</div>
                          <img src={previewFile.url} alt="original" style={{ maxWidth: 280, maxHeight: '50vh', borderRadius: 8, objectFit: 'contain', opacity: 0.7 }} />
                        </div>
                        <div style={{ fontSize: 20, color: t.textMuted }}>→</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#22C55E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Background Removed</div>
                          <img src={bgRemovedUrl} alt="no background" style={{ maxWidth: 280, maxHeight: '50vh', borderRadius: 8, objectFit: 'contain', background: 'repeating-conic-gradient(#444 0% 25%, #333 0% 50%) 0 0 / 16px 16px' }} />
                        </div>
                      </div>
                    </div>
                  )
                  : <img src={previewFile.url} alt={previewFile.file_name} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, objectFit: 'contain' }} />
              }
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => { handleDelete(previewFile.id); setPreviewFile(null); setBgRemovedUrl(null); }}
                style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, color: t.error, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <IpDelete size={14} /> Delete
              </button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {previewFile.file_type === 'image' && !bgRemovedUrl && (
                  <button
                    onClick={() => handleRemoveBackground(previewFile)}
                    disabled={bgRemoving}
                    style={{ padding: '8px 14px', background: bgRemoving ? t.input : 'rgba(34,197,94,0.1)', border: `1px solid ${bgRemoving ? t.border : 'rgba(34,197,94,0.3)'}`, borderRadius: 8, color: bgRemoving ? t.textMuted : '#22C55E', fontSize: 13, fontWeight: 600, cursor: bgRemoving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 150ms' }}
                  >
                    {bgRemoving ? '⏳ Removing...' : '✂ Remove Background'}
                  </button>
                )}
                {bgRemovedUrl && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(bgRemovedUrl); showToast('URL copied!', 'success'); }}
                    style={{ padding: '8px 14px', background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 8, color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    Copy Result URL
                  </button>
                )}
                <button
                  onClick={() => { navigator.clipboard.writeText(previewFile.url); showToast('URL copied!', 'success'); }}
                  style={{ padding: '8px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Copy URL
                </button>
                <button
                  onClick={() => { sessionStorage.setItem('selectedMediaFile', JSON.stringify(bgRemovedUrl ? { ...previewFile, url: bgRemovedUrl } : previewFile)); router.push('/upload'); }}
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


