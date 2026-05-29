import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader, EmptyState } from '../../components/ui';
import { IpPhotoStudio, IpClose, IpEdit, IpDelete, IpPlus, IpCheckCircle, IpWarning } from '../../components/icons';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const INDUSTRIES = [
  { value: 'plumbing',           label: 'Plumbing' },
  { value: 'hvac',               label: 'HVAC' },
  { value: 'roofing',            label: 'Roofing' },
  { value: 'concrete',           label: 'Concrete' },
  { value: 'landscaping',        label: 'Landscaping' },
  { value: 'electrical',         label: 'Electrical' },
  { value: 'painting',           label: 'Painting' },
  { value: 'pest_control',       label: 'Pest Control' },
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'cleaning',           label: 'Cleaning' },
  { value: 'general',            label: 'General (all industries)' },
];

const CATEGORIES = [
  { value: 'tips',         label: 'Tips' },
  { value: 'job_site',     label: 'Job Site' },
  { value: 'before_after', label: 'Before & After' },
  { value: 'seasonal',     label: 'Seasonal' },
  { value: 'team',         label: 'Team' },
  { value: 'general',      label: 'General' },
];

const industryLabel = (v) => INDUSTRIES.find(i => i.value === v)?.label || v;
const categoryLabel = (v) => CATEGORIES.find(c => c.value === v)?.label || v;

export default function AdminStockPhotos() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };
  const fileInputRef = useRef(null);

  const [mounted, setMounted] = useState(false);

  // ── Upload form state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadIndustry, setUploadIndustry] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Library state
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [libLoading, setLibLoading] = useState(true);
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState('active');
  const [libSearch, setLibSearch] = useState('');

  // ── Edit modal state
  const [editPhoto, setEditPhoto] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadLibrary(0, false);
  }, []);

  // ── Load library
  const loadLibrary = useCallback(async (off = 0, append = false) => {
    setLibLoading(true);
    try {
      const params = { limit: 40, offset: off };
      if (filterIndustry !== 'all') params.industry = filterIndustry;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (filterActive === 'active') params.active = 'true';
      if (libSearch.trim()) params.search = libSearch.trim();
      const { data } = await adminAPI.listStockPhotos(params);
      const list = data.photos || [];
      setPhotos(prev => append ? [...prev, ...list] : list);
      setTotal(data.total || 0);
      setOffset(off);
    } catch (e) {
      if (e.response?.status === 403) { router.replace('/dashboard'); return; }
      console.error(e);
    } finally {
      setLibLoading(false);
    }
  }, [filterIndustry, filterCategory, filterActive, libSearch]);

  useEffect(() => {
    loadLibrary(0, false);
  }, [filterIndustry, filterCategory, filterActive]);

  useEffect(() => {
    const t = setTimeout(() => loadLibrary(0, false), 400);
    return () => clearTimeout(t);
  }, [libSearch]);

  // ── File selection
  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    ).slice(0, 20);
    setUploadFiles(valid);
    setUploadResult(null);
    setUploadError('');
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Upload
  const handleUpload = async () => {
    if (!uploadFiles.length) return setUploadError('Please select at least one photo.');
    if (!uploadIndustry) return setUploadError('Please select an industry.');
    if (!uploadCategory) return setUploadError('Please select a category.');
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const fd = new FormData();
      uploadFiles.forEach(f => fd.append('files', f));
      fd.append('industry', uploadIndustry);
      fd.append('category', uploadCategory);
      if (uploadTags.trim()) fd.append('tags', uploadTags.trim());
      if (uploadTitle.trim()) fd.append('title', uploadTitle.trim());
      const { data } = await adminAPI.uploadStockPhotos(fd);
      setUploadResult(data.count || data.photos?.length || uploadFiles.length);
      setUploadFiles([]); setUploadTags(''); setUploadTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadLibrary(0, false);
    } catch (e) {
      setUploadError(e.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Edit
  const openEdit = (photo) => {
    setEditPhoto(photo);
    setEditForm({
      industry: photo.industry,
      category: photo.category,
      tags: (photo.tags || []).join(', '),
      title: photo.title || '',
      description: photo.description || '',
      is_active: photo.is_active !== false,
    });
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      const payload = {
        industry: editForm.industry,
        category: editForm.category,
        tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        title: editForm.title,
        description: editForm.description,
        is_active: editForm.is_active,
      };
      await adminAPI.updateStockPhoto(editPhoto.id, payload);
      setPhotos(prev => prev.map(p => p.id === editPhoto.id ? { ...p, ...payload } : p));
      setEditPhoto(null);
    } catch (e) {
      setSaveError(e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete
  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await adminAPI.deleteStockPhoto(id);
      setPhotos(prev => prev.filter(p => p.id !== id));
      setTotal(n => n - 1);
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`,
    background: t.inputBg || t.cardBg, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer', colorScheme: theme };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

  if (!mounted) return null;

  return (
    <Layout title="Stock Photos" subtitle="Upload and manage the photo library for Photo Studio.">
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 80 }}>

        {/* ── Upload Panel ──────────────────────────────────────────── */}
        <div style={{ ...gc, padding: 28, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <IpPhotoStudio size={20} color={t.primary} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>Upload Stock Photos</h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? t.primary : t.border}`,
              borderRadius: 12,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? t.primaryBg : 'transparent',
              transition: 'all 0.15s',
              marginBottom: 20,
            }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            <IpPhotoStudio size={32} color={dragOver ? t.primary : t.textMuted} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: dragOver ? t.primary : t.text, marginBottom: 4 }}>
              {uploadFiles.length > 0 ? `${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''} selected` : 'Drag photos here or click to browse'}
            </div>
            <div style={{ fontSize: 12, color: t.textMuted }}>Accepts JPG, PNG, WEBP · Up to 20 files at once · Max 50MB each</div>
          </div>

          {/* Selected file pills */}
          {uploadFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {uploadFiles.map((f, i) => (
                <span key={i} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, background: t.primaryBg, color: t.primary, border: `1px solid ${t.primary}30` }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}

          {/* Form fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Industry <span style={{ color: '#e53e3e' }}>*</span></label>
              <select value={uploadIndustry} onChange={e => setUploadIndustry(e.target.value)} style={selectStyle} className="sp-select">
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category <span style={{ color: '#e53e3e' }}>*</span></label>
              <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={selectStyle} className="sp-select">
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Tags (comma-separated, optional)</label>
              <input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="e.g. trees, trimming, summer" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Title (optional — applies to all files in batch)</label>
              <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Landscaping job site" style={inputStyle} />
            </div>
          </div>

          {uploadError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(239,68,68,0.12)' : '#fff5f5', color: t.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: `1px solid ${theme === 'dark' ? 'rgba(239,68,68,0.25)' : '#fed7d7'}` }}>
              <IpWarning size={15} /> {uploadError}
            </div>
          )}
          {uploadResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(34,197,94,0.12)' : '#f0fff4', color: t.success, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: `1px solid ${theme === 'dark' ? 'rgba(34,197,94,0.25)' : '#c6f6d5'}` }}>
              <IpCheckCircle size={15} /> {uploadResult} photo{uploadResult > 1 ? 's' : ''} uploaded successfully.
            </div>
          )}

          <Button onClick={handleUpload} disabled={uploading || !uploadFiles.length} style={{ minWidth: 180 }}>
            <IpPlus size={15} style={{ marginRight: 6 }} />
            {uploading ? 'Uploading...' : `Upload ${uploadFiles.length > 0 ? uploadFiles.length + ' ' : ''}Photo${uploadFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </div>

        {/* ── Photo Library ─────────────────────────────────────────── */}
        <SectionHeader title={`Photo Library${total ? ` (${total})` : ''}`} />

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
          {/* Status toggle */}
          <div style={{ display: 'flex', background: t.cardBg, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            {[['active', 'Active Only'], ['all', 'All']].map(([v, label]) => (
              <button key={v} onClick={() => setFilterActive(v)}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: filterActive === v ? t.primary : 'transparent', color: filterActive === v ? '#fff' : t.textMuted, transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Industry filter */}
          <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} className="sp-select"
            style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, cursor: 'pointer', outline: 'none', colorScheme: theme }}>
            <option value="all">All Industries</option>
            {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>

          {/* Category filter */}
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sp-select"
            style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, cursor: 'pointer', outline: 'none', colorScheme: theme }}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          {/* Search */}
          <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search title or tags..."
            style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, width: 200, outline: 'none' }} />
        </div>

        {/* Grid */}
        {libLoading && photos.length === 0 ? (
          <div style={{ textAlign: 'center', color: t.textMuted, padding: '60px 0', fontSize: 14 }}>Loading library...</div>
        ) : photos.length === 0 ? (
          <EmptyState title="No photos yet" description="Upload your first batch of stock photos using the panel above." />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
              {photos.map(photo => (
                <AdminPhotoCard
                  key={photo.id}
                  photo={photo}
                  t={t}
                  onEdit={openEdit}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  onDelete={handleDelete}
                  deleting={deleting}
                />
              ))}
            </div>
            {photos.length < total && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Button variant="ghost" onClick={() => loadLibrary(offset + 40, true)} disabled={libLoading}>
                  {libLoading ? 'Loading...' : `Load more (${total - photos.length} remaining)`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .sp-select option { background-color: ${t.input}; color: ${t.text}; }
      `}</style>

      {/* ── Edit Modal ───────────────────────────────────────────────── */}
      {editPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: t.bg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, border: `1px solid ${t.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>Edit Photo</h3>
              <button onClick={() => setEditPhoto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
            </div>

            {/* Thumbnail */}
            <img src={editPhoto.thumbnail_url || editPhoto.url} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} style={selectStyle} className="sp-select">
                  {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={selectStyle} className="sp-select">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. trees, residential, spring" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Title</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Description</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {/* Active toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Active</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Inactive photos are hidden from customers</div>
              </div>
              <button onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: editForm.is_active ? t.primary : t.border, position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: editForm.is_active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>

            {saveError && (
              <div style={{ background: theme === 'dark' ? 'rgba(239,68,68,0.12)' : '#fff5f5', color: t.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: `1px solid ${theme === 'dark' ? 'rgba(239,68,68,0.25)' : '#fed7d7'}` }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => setEditPhoto(null)} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function AdminPhotoCard({ photo, t, onEdit, confirmDeleteId, setConfirmDeleteId, onDelete, deleting }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.cardBg, position: 'relative' }}>

      {/* Thumbnail */}
      <div style={{ position: 'relative' }}>
        <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} loading="lazy"
          style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
        {!photo.is_active && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>INACTIVE</span>
          </div>
        )}
        {/* Hover action buttons */}
        {hovered && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
            <button onClick={() => onEdit(photo)}
              title="Edit"
              style={{ background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <IpEdit size={13} />
            </button>
            <button onClick={() => setConfirmDeleteId(photo.id)}
              title="Delete"
              style={{ background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <IpDelete size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {photo.title || `${industryLabel(photo.industry)}`}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.primaryBg, color: t.primary, fontWeight: 500 }}>{categoryLabel(photo.category)}</span>
          {photo.usage_count > 0 && (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.cardBg, color: t.textMuted, border: `1px solid ${t.border}` }}>{photo.usage_count} uses</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: photo.is_active !== false ? '#38a169' : '#e53e3e', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: photo.is_active !== false ? '#38a169' : '#e53e3e' }}>{photo.is_active !== false ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      {/* Inline delete confirm */}
      {confirmDeleteId === photo.id && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#fff', textAlign: 'center', fontWeight: 600, lineHeight: 1.4 }}>Deactivate this photo?</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>It won't show to customers.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmDeleteId(null)}
              style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => onDelete(photo.id)} disabled={deleting}
              style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {deleting ? '...' : 'Yes, hide it'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
