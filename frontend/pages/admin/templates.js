import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader } from '../../components/ui';
import {
  IpPhotoStudio, IpClose, IpEdit, IpDelete, IpPlus,
  IpCheckCircle, IpWarning, IpRefresh, IpPalette, IpSearch,
  IpChevronDown, IpChevronRight,
} from '../../components/icons';
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

// Industry color accents for grouped view
const INDUSTRY_COLORS = {
  plumbing: '#3B82F6', hvac: '#F59E0B', roofing: '#EF4444', concrete: '#6B7280',
  landscaping: '#22C55E', electrical: '#EAB308', painting: '#EC4899',
  pest_control: '#F97316', general_contractor: '#8B5CF6', cleaning: '#06B6D4', general: '#7C5CFC',
};

export default function AdminTemplates() {
  const router = useRouter();
  const { t, theme } = useTheme();
  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('photos');

  // ── Stock Photos state ──
  const fileInputRef = useRef(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadIndustry, setUploadIndustry] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [photoOffset, setPhotoOffset] = useState(0);
  const [libLoading, setLibLoading] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState('active');
  const [libSearch, setLibSearch] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoForm, setEditPhotoForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Canvas Templates state ──
  const [canvasTemplates, setCanvasTemplates] = useState([]);
  const [canvasTotal, setCanvasTotal] = useState(0);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasFilterIndustry, setCanvasFilterIndustry] = useState('all');
  const [canvasFilterCategory, setCanvasFilterCategory] = useState('all');
  const [canvasShowInactive, setCanvasShowInactive] = useState(false);
  const [canvasSearch, setCanvasSearch] = useState('');
  const [canvasViewMode, setCanvasViewMode] = useState('grid'); // 'grid' | 'grouped'
  const [editCanvasTemplate, setEditCanvasTemplate] = useState(null);
  const [editCanvasForm, setEditCanvasForm] = useState({});
  const [canvasSaving, setCanvasSaving] = useState(false);
  const [canvasSaveError, setCanvasSaveError] = useState('');
  const [confirmDeleteCanvasId, setConfirmDeleteCanvasId] = useState(null);
  const [canvasDeleting, setCanvasDeleting] = useState(false);
  const [newTemplateModal, setNewTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({ name: '', industry: 'general', category: 'general', sort_order: 0 });
  const [newTemplateCreating, setNewTemplateCreating] = useState(false);
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkIndustry, setBulkIndustry] = useState('general');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkResult, setBulkResult] = useState('');
  // Inline toggle working tracker
  const [togglingId, setTogglingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  // Grouped view collapsed sections
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    loadPhotos(0, false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (activeTab === 'photos') loadPhotos(0, false);
    if (activeTab === 'canvas') loadCanvasTemplates();
  }, [activeTab]);

  // ── Stock photo load ──
  const loadPhotos = useCallback(async (off = 0, append = false) => {
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
      setPhotoTotal(data.total || 0);
      setPhotoOffset(off);
    } catch (e) {
      if (e.response?.status === 403) { router.replace('/dashboard'); return; }
    } finally {
      setLibLoading(false);
    }
  }, [filterIndustry, filterCategory, filterActive, libSearch]);

  useEffect(() => { loadPhotos(0, false); }, [filterIndustry, filterCategory, filterActive]);
  useEffect(() => {
    const timer = setTimeout(() => loadPhotos(0, false), 400);
    return () => clearTimeout(timer);
  }, [libSearch]);

  // ── Canvas template load ──
  const loadCanvasTemplates = useCallback(async () => {
    setCanvasLoading(true);
    setSelectedIds(new Set());
    setBulkResult('');
    try {
      const params = { limit: 200 };
      if (canvasFilterIndustry !== 'all') params.industry = canvasFilterIndustry;
      if (canvasFilterCategory !== 'all') params.category = canvasFilterCategory;
      if (canvasShowInactive) params.show_inactive = 'true';
      if (canvasSearch.trim()) params.search = canvasSearch.trim();
      const { data } = await adminAPI.listCanvasTemplates(params);
      setCanvasTemplates(data.templates || []);
      setCanvasTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setCanvasLoading(false);
    }
  }, [canvasFilterIndustry, canvasFilterCategory, canvasShowInactive, canvasSearch]);

  useEffect(() => {
    if (activeTab === 'canvas') loadCanvasTemplates();
  }, [canvasFilterIndustry, canvasFilterCategory, canvasShowInactive]);

  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const timer = setTimeout(() => loadCanvasTemplates(), 400);
    return () => clearTimeout(timer);
  }, [canvasSearch]);

  // ── Photo upload ──
  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    ).slice(0, 20);
    setUploadFiles(valid);
    setUploadResult(null);
    setUploadError('');
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return setUploadError('Select at least one photo.');
    if (!uploadIndustry) return setUploadError('Select an industry.');
    if (!uploadCategory) return setUploadError('Select a category.');
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
      loadPhotos(0, false);
    } catch (e) {
      setUploadError(e.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSavePhoto = async () => {
    setSaving(true); setSaveError('');
    try {
      const payload = {
        industry: editPhotoForm.industry,
        category: editPhotoForm.category,
        tags: editPhotoForm.tags.split(',').map(x => x.trim()).filter(Boolean),
        title: editPhotoForm.title,
        description: editPhotoForm.description,
        is_active: editPhotoForm.is_active,
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

  const handleDeletePhoto = async (id) => {
    setDeleting(true);
    try {
      await adminAPI.deleteStockPhoto(id);
      setPhotos(prev => prev.filter(p => p.id !== id));
      setPhotoTotal(n => n - 1);
      setConfirmDeletePhotoId(null);
    } catch {}
    finally { setDeleting(false); }
  };

  // ── Canvas template operations ──
  const openEditCanvas = (tmpl) => {
    setEditCanvasTemplate(tmpl);
    setEditCanvasForm({ name: tmpl.name, industry: tmpl.industry, category: tmpl.category, sort_order: tmpl.sort_order || 0, is_active: tmpl.is_active !== false });
    setCanvasSaveError('');
  };

  const handleSaveCanvas = async () => {
    setCanvasSaving(true); setCanvasSaveError('');
    try {
      await adminAPI.updateCanvasTemplate(editCanvasTemplate.id, editCanvasForm);
      setCanvasTemplates(prev => prev.map(t => t.id === editCanvasTemplate.id ? { ...t, ...editCanvasForm } : t));
      setEditCanvasTemplate(null);
    } catch (e) {
      setCanvasSaveError(e.response?.data?.error || 'Save failed.');
    } finally { setCanvasSaving(false); }
  };

  const handleDeleteCanvas = async (id) => {
    setCanvasDeleting(true);
    try {
      await adminAPI.deleteCanvasTemplate(id);
      setCanvasTemplates(prev => prev.filter(t => t.id !== id));
      setCanvasTotal(n => n - 1);
      setConfirmDeleteCanvasId(null);
    } catch {} finally { setCanvasDeleting(false); }
  };

  const handleCreateCanvas = async () => {
    if (!newTemplateForm.name.trim()) return;
    setNewTemplateCreating(true);
    try {
      const { data } = await adminAPI.createCanvasTemplate(newTemplateForm);
      setCanvasTemplates(prev => [data.template, ...prev]);
      setCanvasTotal(n => n + 1);
      setNewTemplateModal(false);
      setNewTemplateForm({ name: '', industry: 'general', category: 'general', sort_order: 0 });
    } catch {} finally { setNewTemplateCreating(false); }
  };

  const handleToggleActive = async (tmpl) => {
    setTogglingId(tmpl.id);
    try {
      await adminAPI.updateCanvasTemplate(tmpl.id, { is_active: !tmpl.is_active });
      setCanvasTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, is_active: !t.is_active } : t));
    } catch {} finally { setTogglingId(null); }
  };

  const handleDuplicate = async (tmpl) => {
    setDuplicatingId(tmpl.id);
    try {
      const { data } = await adminAPI.duplicateCanvasTemplate(tmpl.id);
      setCanvasTemplates(prev => {
        const idx = prev.findIndex(t => t.id === tmpl.id);
        const next = [...prev];
        next.splice(idx + 1, 0, { ...data.template, usage_count: 0 });
        return next;
      });
      setCanvasTotal(n => n + 1);
    } catch {} finally { setDuplicatingId(null); }
  };

  // ── Bulk operations ──
  const toggleSelectAll = () => {
    if (selectedIds.size === canvasTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(canvasTemplates.map(t => t.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkWorking(true); setBulkResult('');
    try {
      const payload = { ids: [...selectedIds], action: bulkAction };
      if (bulkAction === 'set_industry') payload.industry = bulkIndustry;
      const { data } = await adminAPI.bulkCanvasTemplates(payload);
      setBulkResult(`${data.updated} template${data.updated !== 1 ? 's' : ''} updated.`);
      setSelectedIds(new Set());
      setBulkAction('');
      await loadCanvasTemplates();
    } catch (e) {
      setBulkResult(e.response?.data?.error || 'Bulk operation failed.');
    } finally { setBulkWorking(false); }
  };

  const toggleGroup = (industry) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(industry) ? next.delete(industry) : next.add(industry);
      return next;
    });
  };

  // Build grouped structure
  const groupedTemplates = canvasTemplates.reduce((acc, tmpl) => {
    const key = tmpl.industry || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tmpl);
    return acc;
  }, {});

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`,
    background: t.input, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer', colorScheme: theme };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: t.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

  const tabStyle = (id) => ({
    padding: '9px 20px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: activeTab === id ? 'linear-gradient(135deg, #7C5CFC, #9B7FFF)' : 'transparent',
    color: activeTab === id ? '#fff' : t.textMuted,
    transition: 'all 160ms',
    display: 'flex', alignItems: 'center', gap: 7,
  });

  if (!mounted) return null;

  // ── Canvas template card component (inlined) ──
  const CanvasCard = ({ tmpl }) => {
    const isSelected = selectedIds.has(tmpl.id);
    const accentColor = INDUSTRY_COLORS[tmpl.industry] || t.primary;
    return (
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: `1.5px solid ${isSelected ? accentColor : (tmpl.is_active ? t.border : 'rgba(239,68,68,0.25)')}`,
        background: isSelected ? `${accentColor}08` : (tmpl.is_active ? t.input : (t.isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)')),
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative',
      }}>
        {/* Selection checkbox */}
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(tmpl.id)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor }}
          />
        </div>

        {/* Inactive badge */}
        {!tmpl.is_active && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, fontSize: 9, fontWeight: 800, padding: '2px 6px', background: 'rgba(239,68,68,0.85)', color: '#fff', borderRadius: 4, letterSpacing: '0.05em' }}>INACTIVE</div>
        )}

        {/* Thumbnail */}
        <div style={{ aspectRatio: '4/5', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }} onClick={() => toggleSelect(tmpl.id)}>
          {tmpl.thumbnail_url
            ? <img src={tmpl.thumbnail_url} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <div style={{ textAlign: 'center', padding: 20 }}><IpPalette size={32} style={{ color: t.textMuted }} /><div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>No preview</div></div>
          }
        </div>

        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${accentColor}18`, color: accentColor, fontWeight: 600 }}>{industryLabel(tmpl.industry)}</span>
            <span style={{ fontSize: 10, color: t.textMuted }}>{categoryLabel(tmpl.category)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: t.textMuted, marginBottom: 8 }}>
            <span>#{tmpl.sort_order} · {tmpl.canvas_width}×{tmpl.canvas_height}</span>
            {tmpl.usage_count > 0 && (
              <span style={{ padding: '1px 6px', borderRadius: 10, background: `${t.primary}15`, color: t.primary, fontWeight: 600 }}>
                {tmpl.usage_count} use{tmpl.usage_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Action row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 5 }}>
            <button onClick={() => openEditCanvas(tmpl)} style={{ padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IpEdit size={11} /> Edit
            </button>
            <button
              onClick={() => handleDuplicate(tmpl)}
              disabled={duplicatingId === tmpl.id}
              title="Duplicate"
              style={{ padding: '5px 7px', fontSize: 11, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer' }}
            >
              {duplicatingId === tmpl.id ? '...' : '⧉'}
            </button>
            <button
              onClick={() => setConfirmDeleteCanvasId(tmpl.id)}
              title="Delete"
              style={{ padding: '5px 7px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: t.error, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Active toggle */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: t.textMuted }}>
              <div
                onClick={() => !togglingId && handleToggleActive(tmpl)}
                style={{
                  width: 30, height: 16, borderRadius: 8, position: 'relative', cursor: togglingId === tmpl.id ? 'wait' : 'pointer',
                  background: tmpl.is_active ? '#22C55E' : t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: tmpl.is_active ? 16 : 2,
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
              {togglingId === tmpl.id ? 'Saving...' : (tmpl.is_active ? 'Visible' : 'Hidden')}
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout title="Templates" subtitle="Manage stock photos and canvas templates used in Photo Studio">
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 80 }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: '6px 8px', background: t.isDark ? 'rgba(15,15,24,0.5)' : t.card, borderRadius: 14, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}`, width: 'fit-content' }}>
          <button onClick={() => setActiveTab('photos')} style={tabStyle('photos')}>
            <IpPhotoStudio size={14} /> Stock Photos {photoTotal > 0 && <span style={{ fontSize: 11, opacity: 0.8 }}>({photoTotal})</span>}
          </button>
          <button onClick={() => setActiveTab('canvas')} style={tabStyle('canvas')}>
            <IpPalette size={14} /> Canvas Templates {canvasTotal > 0 && <span style={{ fontSize: 11, opacity: 0.8 }}>({canvasTotal})</span>}
          </button>
        </div>

        {/* ═══════════════════ STOCK PHOTOS TAB ═══════════════════ */}
        {activeTab === 'photos' && (
          <>
            {/* Upload panel */}
            <div style={{ ...gc }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <IpPhotoStudio size={20} style={{ color: t.primary }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Upload Stock Photos</div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? t.primary : t.border}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? `${t.primary}08` : 'transparent', transition: 'all 0.15s', marginBottom: 20 }}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                <IpPhotoStudio size={28} style={{ color: dragOver ? t.primary : t.textMuted, marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: dragOver ? t.primary : t.text, marginBottom: 4 }}>
                  {uploadFiles.length > 0 ? `${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''} selected` : 'Drag photos here or click to browse'}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>JPG, PNG, WEBP · up to 20 files · max 50MB each</div>
              </div>

              {uploadFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {uploadFiles.map((f, i) => (
                    <span key={i} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, background: `${t.primary}15`, color: t.primary, border: `1px solid ${t.primary}30` }}>{f.name}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Industry *</label>
                  <select value={uploadIndustry} onChange={e => setUploadIndustry(e.target.value)} style={selectStyle}>
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={selectStyle}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tags (comma-separated)</label>
                  <input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="e.g. trees, trimming, summer" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Title (optional)</label>
                  <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Landscaping job site" style={inputStyle} />
                </div>
              </div>

              {uploadError && <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: t.error, fontSize: 13, marginBottom: 12 }}><IpWarning size={14} />{uploadError}</div>}
              {uploadResult && <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: t.success, fontSize: 13, marginBottom: 12 }}><IpCheckCircle size={14} />{uploadResult} photo{uploadResult > 1 ? 's' : ''} uploaded.</div>}

              <Button onClick={handleUpload} disabled={uploading || !uploadFiles.length} style={{ minWidth: 180 }}>
                <IpPlus size={14} style={{ marginRight: 6 }} />
                {uploading ? 'Uploading...' : `Upload ${uploadFiles.length || ''} Photo${uploadFiles.length !== 1 ? 's' : ''}`}
              </Button>
            </div>

            {/* Photo library */}
            <div style={gc}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <SectionHeader icon={IpPhotoStudio} title={`Photo Library (${photoTotal})`} subtitle="" />
                <Button variant="ghost" size="sm" onClick={() => loadPhotos(0, false)} style={{ gap: 6 }}>
                  <IpRefresh size={13} /> Refresh
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                  <option value="all">All industries</option>
                  {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                  <option value="all">All categories</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <div style={{ display: 'flex', background: t.input, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                  {[['active','Active'],['all','All']].map(([v, label]) => (
                    <button key={v} onClick={() => setFilterActive(v)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: filterActive === v ? t.primary : 'transparent', color: filterActive === v ? '#fff' : t.textMuted, transition: 'all 0.15s' }}>{label}</button>
                  ))}
                </div>
                <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search..." style={{ ...inputStyle, width: 180 }} />
              </div>

              {libLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading photos...</div>
              ) : photos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>No photos found.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {photos.map(photo => (
                      <div key={photo.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.input, position: 'relative' }}>
                        <img src={photo.thumbnail_url || photo.url} alt={photo.title || ''} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} loading="lazy" />
                        {!photo.is_active && (
                          <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 10, fontWeight: 700, padding: '2px 6px', background: 'rgba(0,0,0,0.7)', color: '#f97316', borderRadius: 4 }}>INACTIVE</div>
                        )}
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.title || '—'}</div>
                          <div style={{ fontSize: 10, color: t.textMuted }}>{industryLabel(photo.industry)} · {categoryLabel(photo.category)}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button onClick={() => { setEditPhoto(photo); setEditPhotoForm({ industry: photo.industry, category: photo.category, tags: (photo.tags || []).join(', '), title: photo.title || '', description: photo.description || '', is_active: photo.is_active !== false }); setSaveError(''); }} style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => setConfirmDeletePhotoId(photo.id)} style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: t.error, cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {photos.length < photoTotal && (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                      <Button variant="secondary" onClick={() => loadPhotos(photoOffset + 40, true)}>Load more</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════ CANVAS TEMPLATES TAB ═══════════════════ */}
        {activeTab === 'canvas' && (
          <div style={gc}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <SectionHeader icon={IpPalette} title={`Canvas Templates (${canvasTotal})`} subtitle="Templates available in Photo Studio for all customers" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="ghost" size="sm" onClick={loadCanvasTemplates} style={{ gap: 6 }}>
                  <IpRefresh size={13} /> Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => setNewTemplateModal(true)}>
                  <IpPlus size={13} style={{ marginRight: 5 }} /> New Template
                </Button>
              </div>
            </div>

            {/* Filter / toolbar row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <div style={{ position: 'relative', flexGrow: 1, minWidth: 160, maxWidth: 260 }}>
                <IpSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }} />
                <input value={canvasSearch} onChange={e => setCanvasSearch(e.target.value)} placeholder="Search templates..." style={{ ...inputStyle, paddingLeft: 30 }} />
              </div>
              <select value={canvasFilterIndustry} onChange={e => setCanvasFilterIndustry(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                <option value="all">All industries</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <select value={canvasFilterCategory} onChange={e => setCanvasFilterCategory(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
                <option value="all">All categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              {/* Show inactive toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={canvasShowInactive} onChange={e => setCanvasShowInactive(e.target.checked)} style={{ accentColor: t.primary }} />
                Show inactive
              </label>

              {/* View mode toggle */}
              <div style={{ display: 'flex', background: t.input, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden', marginLeft: 'auto' }}>
                {[['grid', 'Grid'], ['grouped', 'By Industry']].map(([v, label]) => (
                  <button key={v} onClick={() => setCanvasViewMode(v)} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', background: canvasViewMode === v ? t.primary : 'transparent', color: canvasViewMode === v ? '#fff' : t.textMuted, transition: 'all 0.15s' }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Bulk actions toolbar */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: `${t.primary}10`, border: `1px solid ${t.primary}25`, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.primary }}>{selectedIds.size} selected</div>
                <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 11, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{ ...selectStyle, width: 'auto', fontSize: 12 }}>
                    <option value="">Choose action...</option>
                    <option value="activate">Activate (make visible)</option>
                    <option value="deactivate">Deactivate (hide from customers)</option>
                    <option value="set_industry">Change industry</option>
                  </select>
                  {bulkAction === 'set_industry' && (
                    <select value={bulkIndustry} onChange={e => setBulkIndustry(e.target.value)} style={{ ...selectStyle, width: 'auto', fontSize: 12 }}>
                      {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  )}
                  <Button size="sm" onClick={handleBulkAction} disabled={bulkWorking || !bulkAction}>
                    {bulkWorking ? 'Working...' : 'Apply'}
                  </Button>
                </div>
              </div>
            )}

            {bulkResult && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: t.success, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IpCheckCircle size={14} />{bulkResult}
              </div>
            )}

            {/* Select-all row */}
            {canvasTemplates.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === canvasTemplates.length && canvasTemplates.length > 0}
                  onChange={toggleSelectAll}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: t.primary }}
                />
                <span style={{ fontSize: 12, color: t.textMuted }}>
                  {selectedIds.size === canvasTemplates.length ? 'Deselect all' : `Select all ${canvasTemplates.length}`}
                </span>
              </div>
            )}

            {canvasLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading templates...</div>
            ) : canvasTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <IpPalette size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No canvas templates found</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Create templates for customers to use in Photo Studio.</div>
                <Button variant="primary" onClick={() => setNewTemplateModal(true)}>
                  <IpPlus size={14} style={{ marginRight: 6 }} /> Create first template
                </Button>
              </div>
            ) : canvasViewMode === 'grouped' ? (
              /* ── Grouped by industry ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(groupedTemplates).sort(([a], [b]) => a.localeCompare(b)).map(([industry, tmpls]) => {
                  const color = INDUSTRY_COLORS[industry] || t.primary;
                  const collapsed = collapsedGroups.has(industry);
                  return (
                    <div key={industry} style={{ border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleGroup(industry)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text, flex: 1 }}>{industryLabel(industry)}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, marginRight: 8 }}>{tmpls.length} template{tmpls.length !== 1 ? 's' : ''}</span>
                        {collapsed ? <IpChevronRight size={14} style={{ color: t.textMuted }} /> : <IpChevronDown size={14} style={{ color: t.textMuted }} />}
                      </button>
                      {!collapsed && (
                        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                          {tmpls.map(tmpl => <CanvasCard key={tmpl.id} tmpl={tmpl} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Flat grid ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                {canvasTemplates.map(tmpl => <CanvasCard key={tmpl.id} tmpl={tmpl} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Edit Photo modal ── */}
        {editPhoto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...gc, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Edit Stock Photo</div>
                <button onClick={() => setEditPhoto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IpClose size={18} style={{ color: t.textMuted }} /></button>
              </div>
              {editPhoto.thumbnail_url && <img src={editPhoto.thumbnail_url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 20, maxHeight: 200, objectFit: 'cover' }} />}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div><label style={labelStyle}>Industry</label>
                  <select value={editPhotoForm.industry} onChange={e => setEditPhotoForm(p => ({ ...p, industry: e.target.value }))} style={selectStyle}>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Category</label>
                  <select value={editPhotoForm.category} onChange={e => setEditPhotoForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Title</label><input value={editPhotoForm.title} onChange={e => setEditPhotoForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} /></div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Tags (comma-separated)</label><input value={editPhotoForm.tags} onChange={e => setEditPhotoForm(p => ({ ...p, tags: e.target.value }))} style={inputStyle} /></div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Description</label><textarea value={editPhotoForm.description} onChange={e => setEditPhotoForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: t.text }}>
                <input type="checkbox" checked={editPhotoForm.is_active} onChange={e => setEditPhotoForm(p => ({ ...p, is_active: e.target.checked }))} />
                Active (visible to customers)
              </label>
              {saveError && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: t.error, fontSize: 13, marginBottom: 14 }}>{saveError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setEditPhoto(null)}>Cancel</Button>
                <Button onClick={handleSavePhoto} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Canvas Template modal ── */}
        {editCanvasTemplate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...gc, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Edit Canvas Template</div>
                <button onClick={() => setEditCanvasTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IpClose size={18} style={{ color: t.textMuted }} /></button>
              </div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Name</label><input value={editCanvasForm.name} onChange={e => setEditCanvasForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div><label style={labelStyle}>Industry</label>
                  <select value={editCanvasForm.industry} onChange={e => setEditCanvasForm(p => ({ ...p, industry: e.target.value }))} style={selectStyle}>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Category</label>
                  <select value={editCanvasForm.category} onChange={e => setEditCanvasForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div><label style={labelStyle}>Sort Order</label><input type="number" value={editCanvasForm.sort_order} onChange={e => setEditCanvasForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: t.text }}>
                <input type="checkbox" checked={editCanvasForm.is_active !== false} onChange={e => setEditCanvasForm(p => ({ ...p, is_active: e.target.checked }))} />
                Active (visible to customers in Photo Studio)
              </label>
              {canvasSaveError && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: t.error, fontSize: 13, marginBottom: 14 }}>{canvasSaveError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setEditCanvasTemplate(null)}>Cancel</Button>
                <Button onClick={handleSaveCanvas} disabled={canvasSaving}>{canvasSaving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── New Canvas Template modal ── */}
        {newTemplateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...gc, width: '100%', maxWidth: 460, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>New Canvas Template</div>
                <button onClick={() => setNewTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IpClose size={18} style={{ color: t.textMuted }} /></button>
              </div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Template Name *</label><input value={newTemplateForm.name} onChange={e => setNewTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Plumbing — Before & After Dark" style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div><label style={labelStyle}>Industry</label>
                  <select value={newTemplateForm.industry} onChange={e => setNewTemplateForm(p => ({ ...p, industry: e.target.value }))} style={selectStyle}>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Category</label>
                  <select value={newTemplateForm.category} onChange={e => setNewTemplateForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Sort Order</label>
                <input type="number" value={newTemplateForm.sort_order} onChange={e => setNewTemplateForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} style={{ ...inputStyle, width: 100 }} />
              </div>
              <div style={{ padding: '12px 16px', background: `${t.primary}10`, border: `1px solid ${t.primary}25`, borderRadius: 10, fontSize: 12, color: t.textMuted, marginBottom: 20 }}>
                After creating, edit the canvas JSON directly through the Photo Studio editor or the studio API.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setNewTemplateModal(false)}>Cancel</Button>
                <Button onClick={handleCreateCanvas} disabled={newTemplateCreating || !newTemplateForm.name.trim()}>
                  {newTemplateCreating ? 'Creating...' : 'Create Template'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm delete photo ── */}
        {confirmDeletePhotoId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...gc, maxWidth: 380, width: '90%', marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 10 }}>Delete photo?</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>This photo will be removed from the library and will no longer appear in Photo Studio.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setConfirmDeletePhotoId(null)}>Cancel</Button>
                <Button onClick={() => handleDeletePhoto(confirmDeletePhotoId)} disabled={deleting} style={{ background: t.error }}>{deleting ? 'Deleting...' : 'Delete'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm delete canvas template ── */}
        {confirmDeleteCanvasId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...gc, maxWidth: 380, width: '90%', marginBottom: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 10 }}>Delete template?</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>This template will be soft-deleted and hidden from customers. The canvas data is preserved.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setConfirmDeleteCanvasId(null)}>Cancel</Button>
                <Button onClick={() => handleDeleteCanvas(confirmDeleteCanvasId)} disabled={canvasDeleting} style={{ background: t.error }}>{canvasDeleting ? 'Deleting...' : 'Delete'}</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
