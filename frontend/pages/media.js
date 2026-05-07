import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish, IpPhoto as ImageIcon, IpVideo, IpDelete, IpSearch,
  IpFolderOpen, IpClose, IpCheck, IpLoader, IpHardDrive, IpFolderPlus,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Badge, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const b = parseInt(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const STORAGE_KEY = 'itsposting_custom_folders';

export default function MediaLibrary() {
  const router = useRouter();
  const { t } = useTheme();
  const fileInputRef = useRef(null);
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    // Load custom (empty) folders from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setCustomFolders(Array.isArray(stored) ? stored : []);
    } catch { setCustomFolders([]); }
    loadAll();
  }, []);

  useEffect(() => { if (mounted) loadFiles(); }, [filterType, filterFolder, search]);

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
    } catch (err) {
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

  // Merge API folders + custom empty folders
  const allFolders = (() => {
    const apiNames = new Set(folders.map(f => f.folder));
    const merged = [...folders];
    for (const name of customFolders) {
      if (!apiNames.has(name)) {
        merged.push({ folder: name, count: 0, isEmpty: true });
      }
    }
    return merged;
  })();

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
      // If uploading to a custom folder, it now has files — reload all
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    try {
      await mediaAPI.delete(id);
      setMessage({ type: 'success', text: 'File deleted' });
      await loadAll();
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} file(s)?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => mediaAPI.delete(id)));
      setMessage({ type: 'success', text: `Deleted ${selectedIds.size} file(s)` });
      setSelectedIds(new Set());
      await loadAll();
    } catch (err) { setMessage({ type: 'error', text: 'Some deletions failed' }); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const msgBg = { error: 'rgba(239,68,68,0.1)', success: 'rgba(34,197,94,0.1)', info: '' };
  const msgBorder = { error: 'rgba(239,68,68,0.3)', success: 'rgba(34,197,94,0.3)', info: '' };
  const msgColor = { error: t.error, success: t.success, info: t.primary };

  if (!mounted) return null;

  return (
    <Layout
      title="Media Library"
      subtitle={quota ? `${quota.usedFormatted} / ${quota.quotaFormatted} used` : 'Loading...'}
      action={
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
            {uploading ? <IpLoader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <IpPublish size={14} strokeWidth={2.5} />}
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}
          </Button>
        </div>
      }
    >
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />

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
              <IpHardDrive size={18} style={{ color: t.primary }} />
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

      {/* FOLDERS SIDEBAR + FILTERS */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>

        {/* Folder list */}
        {allFolders.length > 1 && (
          <div style={{ width: 180, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Folders</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {allFolders.map((f) => (
                <button
                  key={f.folder}
                  onClick={() => setFilterFolder(f.folder)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    color: filterFolder === f.folder ? t.primary : t.textSecondary,
                    background: filterFolder === f.folder ? t.primaryBg : 'transparent',
                    border: filterFolder === f.folder ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { if (filterFolder !== f.folder) e.currentTarget.style.background = t.input; }}
                  onMouseLeave={e => { if (filterFolder !== f.folder) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IpFolderOpen size={13} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                      {f.folder === 'all' ? 'All Files' : f.folder}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, padding: '1px 5px', background: t.input, borderRadius: 9, color: t.textMuted, flexShrink: 0 }}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + type filter */}
        <div style={{ flex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
      </div>

      {/* FILE GRID */}
      {loading ? (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <IpLoader size={28} style={{ color: t.primary, animation: 'spin 1s linear infinite' }} />
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <EmptyState
            icon={IpFolderOpen}
            title={filterFolder !== 'all' ? `No files in "${filterFolder}"` : 'No media yet'}
            subtitle={filterFolder !== 'all' ? 'Upload files to this folder using the Upload button above' : 'Upload images and videos to use in your posts'}
            action={
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                <IpPublish size={14} strokeWidth={2.5} /> Upload files{filterFolder !== 'all' ? ` to "${filterFolder}"` : ''}
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {files.map((file) => {
            const isSelected = selectedIds.has(file.id);
            return (
              <div
                key={file.id}
                onClick={() => setPreviewFile(file)}
                style={{ background: t.card, border: `2px solid ${isSelected ? t.primary : t.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 150ms ease', position: 'relative' }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.primaryBorder; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.border; }}
              >
                {/* CHECKBOX */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                  style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 6, background: isSelected ? t.primary : 'rgba(0,0,0,0.5)', border: `1px solid ${isSelected ? t.primary : '#fff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 2 }}
                >
                  {isSelected && <IpCheck size={14} strokeWidth={3} />}
                </button>

                {/* TYPE BADGE */}
                <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 6, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, zIndex: 2 }}>
                  {file.file_type === 'video' ? <IpVideo size={10} /> : <ImageIcon size={10} />}
                  {file.file_type}
                </div>

                {/* THUMBNAIL */}
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

                {/* INFO */}
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
      )}

      {/* PREVIEW MODAL */}
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
                  onClick={() => { navigator.clipboard.writeText(previewFile.url); alert('URL copied!'); }}
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

      {/* NEW FOLDER MODAL */}
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
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
