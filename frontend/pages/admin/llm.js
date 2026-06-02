import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpSparkle, IpAnalytics, IpDatabase, IpRefresh, IpCheck,
  IpWarning, IpTrendingUp, IpTeam, IpAdmin, IpDelete, IpDownload,
  IpClose, IpPlus,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Button, Badge, SectionHeader, Select } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const TABS = [
  { id: 'overview',  label: 'Overview',        icon: IpSparkle   },
  { id: 'training',  label: 'Training Data',    icon: IpDatabase  },
  { id: 'images',    label: 'Image Import',     icon: IpDownload  },
  { id: 'models',    label: 'Model Versions',   icon: IpAdmin     },
  { id: 'ab',        label: 'A/B Testing',      icon: IpAnalytics },
  { id: 'quality',   label: 'Quality Monitor',  icon: IpTrendingUp},
  { id: 'curated',   label: 'Curated Examples', icon: IpTeam      },
  { id: 'guide',     label: 'Training Guide',   icon: IpCheck     },
];

const THRESHOLD = 10000;
const BASE_MODELS = [
  'meta-llama/Llama-3.2-3B-Instruct',
  'meta-llama/Llama-3.1-8B-Instruct',
  'microsoft/Phi-3.5-mini-instruct',
  'google/gemma-2-9b-it',
  'mistralai/Mistral-7B-Instruct-v0.3',
];
const INDUSTRIES_18 = [
  'plumbing','hvac','roofing','electrical','landscaping','concrete',
  'painting','pest_control','general_contractor','cleaning',
  'tree_service','pressure_washing','pool_spa','handyman',
  'flooring','junk_removal','solar','gutter_cleaning',
];

export default function AdminLLM() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState('overview');

  // Data
  const [overview, setOverview]         = useState(null);
  const [trainingData, setTrainingData] = useState([]);
  const [trainingTotal, setTrainingTotal] = useState(0);
  const [trainingPage, setTrainingPage] = useState(1);
  const [trainingIndustry, setTrainingIndustry] = useState('');
  const [models, setModels]             = useState([]);
  const [experiments, setExperiments]   = useState([]);
  const [curated, setCurated]           = useState([]);
  const [qualityStats, setQualityStats] = useState(null);
  const [imageImport, setImageImport]   = useState({ urlsText: '', industry: '', contentType: '', customCaption: '' });
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]       = useState(false);
  const [imageDatasetCount, setImageDatasetCount] = useState(null);

  // Label management state
  const [imageDataset, setImageDataset]       = useState([]);
  const [imageDatasetTotal, setImageDatasetTotal] = useState(0);
  const [imagePage, setImagePage]             = useState(1);
  const [imageFilter, setImageFilter]         = useState({ industry: '', contentType: '', minQuality: '' });
  const [selectedImages, setSelectedImages]   = useState(new Set());
  const [editingImage, setEditingImage]       = useState(null);
  const [editForm, setEditForm]               = useState({ industry: '', contentType: '', caption: '', qualityScore: '' });
  const [bulkForm, setBulkForm]               = useState({ industry: '', contentType: '', qualityScore: '' });
  const [labelLoading, setLabelLoading]       = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);

  // UI state
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [exporting, setExporting]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Modals
  const [showAddExample, setShowAddExample]   = useState(false);
  const [showNewExp, setShowNewExp]           = useState(false);
  const [showRegisterModel, setShowRegisterModel] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(null); // model object

  // Forms
  const [addExForm, setAddExForm] = useState({
    industry: 'plumbing', contentType: 'job_finished',
    inputPayload: '', idealOutput: '', qualityScore: '5',
  });
  const [newExpForm, setNewExpForm]     = useState({ modelVersionId: '', trafficPct: '5', notes: '' });
  const [registerForm, setRegisterForm] = useState({
    versionName: '', baseModel: BASE_MODELS[0], modality: 'text',
    weightsUrl: '', trainingExamples: '', evalBleu: '', evalHumanScore: '', notes: '',
  });
  const [deployForm, setDeployForm]     = useState({ trafficPct: '10' });

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 16, padding: 24, marginBottom: 20,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
  };

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    try {
      const res = await adminAPI.getLLMOverview();
      setOverview(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Admin access required.');
        setTimeout(() => router.replace('/dashboard'), 2000);
      } else { setError('Failed to load LLM overview'); }
    } finally { setLoading(false); }
  }, [router]);

  const loadTraining = useCallback(async () => {
    try {
      const res = await adminAPI.getLLMTrainingData({
        page: trainingPage, limit: 20,
        industry: trainingIndustry || undefined,
      });
      setTrainingData(res.data.examples || []);
      setTrainingTotal(res.data.total || 0);
    } catch {}
  }, [trainingPage, trainingIndustry]);

  const loadModels     = async () => { try { const r = await adminAPI.getLLMModels();         setModels(r.data.models || []); } catch {} };
  const loadExperiments= async () => { try { const r = await adminAPI.getLLMExperiments();    setExperiments(r.data.experiments || []); } catch {} };
  const loadCurated    = async () => { try { const r = await adminAPI.getLLMCuratedExamples(); setCurated(r.data.examples || []); } catch {} };
  const loadQuality    = async () => {
    try { const r = await adminAPI.getLLMQualityStats({ days: 30 }); setQualityStats(r.data); } catch {}
  };

  const loadImageDatasetCount = async () => {
    try {
      const r = await adminAPI.getLLMOverview();
      setImageDatasetCount(r.data.imageExamples || 0);
    } catch {}
  };

  const loadImageDataset = useCallback(async () => {
    setLabelLoading(true);
    try {
      const r = await adminAPI.getImageDataset({
        page: imagePage, limit: 24,
        industry:    imageFilter.industry    || undefined,
        contentType: imageFilter.contentType || undefined,
        minQuality:  imageFilter.minQuality  || undefined,
      });
      setImageDataset(r.data.images || []);
      setImageDatasetTotal(r.data.total || 0);
    } catch {}
    finally { setLabelLoading(false); }
  }, [imagePage, imageFilter]);

  useEffect(() => { setMounted(true); if (!localStorage.getItem('token')) { router.replace('/login'); return; } loadOverview(); }, []);
  useEffect(() => { if (!mounted) return; if (tab === 'training') loadTraining(); }, [tab, mounted, trainingPage, trainingIndustry]);
  useEffect(() => { if (!mounted) return; if (tab === 'models') loadModels(); }, [tab, mounted]);
  useEffect(() => { if (!mounted) return; if (tab === 'ab') { loadExperiments(); loadModels(); } }, [tab, mounted]);
  useEffect(() => { if (!mounted) return; if (tab === 'curated') loadCurated(); }, [tab, mounted]);
  useEffect(() => { if (!mounted) return; if (tab === 'quality') loadQuality(); }, [tab, mounted]);
  useEffect(() => { if (!mounted) return; if (tab === 'images') loadImageDatasetCount(); }, [tab, mounted]);
  useEffect(() => { if (showLabelManager) loadImageDataset(); }, [showLabelManager, imagePage, imageFilter]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminAPI.exportLLMTrainingData({
        industry: trainingIndustry || undefined,
      });
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/jsonl' }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `postcore-training-${new Date().toISOString().split('T')[0]}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed — try again'); }
    finally { setExporting(false); }
  };

  const handleImportImages = async () => {
    const urls = imageImport.urlsText
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));
    if (urls.length === 0) { alert('No valid URLs found. Paste one URL per line starting with http/https.'); return; }
    if (urls.length > 500) { alert('Max 500 URLs per import. Split into multiple batches.'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await adminAPI.importLLMImages({
        urls,
        industry:      imageImport.industry || undefined,
        contentType:   imageImport.contentType || undefined,
        customCaption: imageImport.customCaption || undefined,
      });
      setImportResult(res.data);
      setImageDatasetCount(c => (c || 0) + res.data.imported);
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed — check console');
    } finally {
      setImporting(false);
    }
  };

  const handleExportImageDataset = async (format = 'jsonl') => {
    setExporting(true);
    try {
      const res = await adminAPI.exportImageDataset({ format, industry: imageImport.industry || undefined });
      const ext  = format === 'script' ? 'py' : 'jsonl';
      const mime = format === 'script' ? 'text/plain' : 'application/jsonl';
      const url  = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = format === 'script' ? 'download_dataset.py' : `postcore-image-dataset-${new Date().toISOString().split('T')[0]}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
    finally { setExporting(false); }
  };

  // ── Label management handlers ─────────────────────────────────────────────

  const openEditModal = (img) => {
    setEditingImage(img);
    setEditForm({
      industry:     img.industry     || '',
      contentType:  img.content_type || '',
      caption:      img.caption      || '',
      qualityScore: img.quality_score != null ? String(img.quality_score) : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingImage) return;
    try {
      const r = await adminAPI.updateImageLabel(editingImage.id, {
        industry:     editForm.industry     || undefined,
        contentType:  editForm.contentType  || undefined,
        caption:      editForm.caption      || undefined,
        qualityScore: editForm.qualityScore ? parseFloat(editForm.qualityScore) : undefined,
      });
      setImageDataset(d => d.map(img => img.id === editingImage.id ? { ...img, ...r.data.image } : img));
      setEditingImage(null);
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
  };

  const handleBulkLabel = async () => {
    if (selectedImages.size === 0) return;
    if (!bulkForm.industry && !bulkForm.contentType && !bulkForm.qualityScore) {
      alert('Set at least one field to apply in bulk.'); return;
    }
    try {
      const r = await adminAPI.bulkLabelImages({
        ids:          Array.from(selectedImages),
        industry:     bulkForm.industry     || undefined,
        contentType:  bulkForm.contentType  || undefined,
        qualityScore: bulkForm.qualityScore ? parseFloat(bulkForm.qualityScore) : undefined,
      });
      setSelectedImages(new Set());
      setBulkForm({ industry: '', contentType: '', qualityScore: '' });
      await loadImageDataset();
      alert(`Updated ${r.data.updated} images.`);
    } catch (err) { alert(err.response?.data?.error || 'Bulk update failed'); }
  };

  const handleDeleteImage = async (id) => {
    if (!confirm('Remove this image from the training set?')) return;
    try {
      await adminAPI.deleteImageDataset(id);
      setImageDataset(d => d.filter(img => img.id !== id));
      setImageDatasetTotal(n => n - 1);
      setImageDatasetCount(n => Math.max(0, (n || 1) - 1));
      selectedImages.delete(id);
      setSelectedImages(new Set(selectedImages));
    } catch {}
  };

  const handleBulkDelete = async () => {
    if (selectedImages.size === 0) return;
    if (!confirm(`Delete ${selectedImages.size} images from the training set? This cannot be undone.`)) return;
    try {
      const r = await adminAPI.bulkDeleteImages({ ids: Array.from(selectedImages) });
      setSelectedImages(new Set());
      setImageDatasetCount(n => Math.max(0, (n || 0) - r.data.deleted));
      await loadImageDataset();
    } catch (err) { alert(err.response?.data?.error || 'Delete failed'); }
  };

  const toggleSelectImage = (id) => {
    const next = new Set(selectedImages);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedImages(next);
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === imageDataset.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(imageDataset.map(i => i.id)));
    }
  };

  const handleRateExample = async (id, score) => {
    try {
      await adminAPI.rateLLMExample(id, score);
      setTrainingData(d => d.map(ex => ex.id === id ? { ...ex, quality_score: score } : ex));
    } catch {}
  };

  const handleDeleteExample = async (id) => {
    if (!confirm('Delete this training example? This cannot be undone.')) return;
    try { await adminAPI.deleteLLMExample(id); setTrainingData(d => d.filter(ex => ex.id !== id)); setTrainingTotal(n => n - 1); } catch {}
  };

  const handleAddExample = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      let ip, op;
      try { ip = JSON.parse(addExForm.inputPayload); } catch { alert('Input Payload must be valid JSON'); setSubmitting(false); return; }
      try { op = JSON.parse(addExForm.idealOutput); }  catch { alert('Ideal Output must be valid JSON'); setSubmitting(false); return; }
      await adminAPI.addLLMCuratedExample({ industry: addExForm.industry, contentType: addExForm.contentType, inputPayload: ip, idealOutput: op, qualityScore: parseFloat(addExForm.qualityScore) });
      setShowAddExample(false);
      setAddExForm({ industry: 'plumbing', contentType: 'job_finished', inputPayload: '', idealOutput: '', qualityScore: '5' });
      await loadCurated();
    } catch (err) { alert(err.response?.data?.error || 'Failed to add example'); }
    finally { setSubmitting(false); }
  };

  const handleRegisterModel = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await adminAPI.registerLLMModel({
        versionName:     registerForm.versionName,
        baseModel:       registerForm.baseModel,
        modality:        registerForm.modality,
        weightsUrl:      registerForm.weightsUrl || undefined,
        trainingExamples: parseInt(registerForm.trainingExamples) || undefined,
        evalBleu:        parseFloat(registerForm.evalBleu) || undefined,
        evalHumanScore:  parseFloat(registerForm.evalHumanScore) || undefined,
        notes:           registerForm.notes || undefined,
      });
      setShowRegisterModel(false);
      setRegisterForm({ versionName: '', baseModel: BASE_MODELS[0], modality: 'text', weightsUrl: '', trainingExamples: '', evalBleu: '', evalHumanScore: '', notes: '' });
      await loadModels();
    } catch (err) { alert(err.response?.data?.error || 'Registration failed'); }
    finally { setSubmitting(false); }
  };

  const handleDeployModel = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await adminAPI.updateLLMModel(showDeployModal.id, { action: 'deploy', trafficPct: parseInt(deployForm.trafficPct) });
      setShowDeployModal(null);
      await loadModels();
      await loadOverview();
    } catch (err) { alert(err.response?.data?.error || 'Deploy failed'); }
    finally { setSubmitting(false); }
  };

  const handleModelAction = async (model, action) => {
    const labels = { staging: 'Move to staging?', rollback: 'Roll back and retire this model?', retire: 'Retire this model?' };
    if (!confirm(labels[action] || `${action} this model?`)) return;
    try {
      await adminAPI.updateLLMModel(model.id, { action });
      await loadModels();
      await loadOverview();
    } catch (err) { alert(err.response?.data?.error || 'Action failed'); }
  };

  const handleNewExperiment = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await adminAPI.createLLMExperiment({ modelVersionId: parseInt(newExpForm.modelVersionId), trafficPct: parseInt(newExpForm.trafficPct) || 5, notes: newExpForm.notes || null });
      setShowNewExp(false); setNewExpForm({ modelVersionId: '', trafficPct: '5', notes: '' });
      await loadExperiments();
    } catch (err) { alert(err.response?.data?.error || 'Failed to create experiment'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCurated = async (id) => {
    if (!confirm('Delete this curated example?')) return;
    try { await adminAPI.deleteLLMCuratedExample(id); await loadCurated(); } catch {}
  };

  // ── Styles ───────────────────────────────────────────────────────────────────

  const tabStyle = (id) => ({
    padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: tab === id ? 'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 100%)' : 'transparent',
    color: tab === id ? '#fff' : t.textMuted,
    transition: 'all 160ms ease', display: 'flex', alignItems: 'center', gap: 6,
  });

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: t.input,
    border: `1px solid ${t.borderStrong}`, borderRadius: 8,
    color: t.text, fontSize: 13, boxSizing: 'border-box',
  };

  if (!mounted) return null;
  if (error) return (
    <Layout title="ItsPosting AI Brain — Admin">
      <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: t.error }}>{error}</div>
    </Layout>
  );

  const totalProductionTraffic = models.filter(m => m.status === 'production').reduce((s, m) => s + (m.traffic_pct || 0), 0);
  const claudeTraffic = Math.max(0, 100 - totalProductionTraffic);

  return (
    <Layout title="ItsPosting AI Brain — Admin">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>

        {/* Header */}
        <div style={{ ...gc, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #5B21B6, #7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(124,92,252,0.35)' }}>
                <IpSparkle size={26} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>ItsPosting AI Brain</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Proprietary LLM — Admin only. Collects training data from every customer generation.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: totalProductionTraffic > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: totalProductionTraffic > 0 ? '#10B981' : '#D97706', border: `1px solid ${totalProductionTraffic > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                {totalProductionTraffic > 0 ? `${totalProductionTraffic}% POSTCORE BRAIN LIVE` : 'PRE-TRAINING PHASE'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => { loadOverview(); }} style={{ gap: 6 }}>
                <IpRefresh size={13} /> Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20, padding: '6px 8px', background: t.isDark ? 'rgba(15,15,24,0.5)' : t.card, borderRadius: 14, border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}` }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>Loading...</div> : overview ? (
              <>
                {/* Progress */}
                <div style={gc}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <SectionHeader icon={IpDatabase} title="Training Data Progress" subtitle={`${overview.trainingExamples.toLocaleString()} examples across captions, images, and video`} />
                    <Button variant="ghost" size="sm" onClick={handleExport} disabled={exporting} style={{ gap: 6, whiteSpace: 'nowrap' }}>
                      <IpDownload size={13} /> {exporting ? 'Exporting…' : 'Export JSONL'}
                    </Button>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{overview.trainingExamples.toLocaleString()} / {THRESHOLD.toLocaleString()}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.primary }}>{overview.progressPct}%</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 8, background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${overview.progressPct}%`, borderRadius: 8, background: 'linear-gradient(90deg, #5B21B6, #7C5CFC, #A78BFA)', transition: 'width 600ms ease' }} />
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>
                      {overview.progressPct >= 100 ? '✅ Threshold reached — ready for first training run' : `${(THRESHOLD - overview.trainingExamples).toLocaleString()} more examples needed before first training run`}
                    </div>
                  </div>
                </div>

                {/* Stat grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total examples', value: overview.trainingExamples.toLocaleString(), color: '#7C5CFC', icon: IpDatabase },
                    { label: 'Caption examples', value: (overview.captionExamples || 0).toLocaleString(), color: '#7C5CFC', icon: IpSparkle, note: 'Claude text' },
                    { label: 'Image examples', value: (overview.imageExamples || 0).toLocaleString(), color: '#10B981', icon: IpCheck, note: 'NanoBanana / MJ' },
                    { label: 'Video examples', value: (overview.videoExamples || 0).toLocaleString(), color: '#3B82F6', icon: IpTrendingUp, note: 'All providers' },
                    { label: 'With user selection', value: overview.withSelection.toLocaleString(), color: '#10B981', icon: IpCheck },
                    { label: 'With reach data', value: overview.withReach.toLocaleString(), color: '#3B82F6', icon: IpTrendingUp },
                    { label: 'Avg quality score', value: overview.avgQuality ? `${overview.avgQuality}/5` : 'No data', color: '#F59E0B', icon: IpSparkle },
                  ].map(({ label, value, color, icon: Icon, note }) => (
                    <div key={label} style={{ ...gc, marginBottom: 0, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={17} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
                        {note && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{note}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Image + Video stats */}
                {(overview.imageStats || overview.videoStats) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {[
                      { label: 'Image Generation', stats: overview.imageStats, color: '#10B981', dl: 'regenerated' },
                      { label: 'Video Generation', stats: overview.videoStats, color: '#3B82F6', dl: 'discarded' },
                    ].map(({ label, stats, color, dl }) => stats && (
                      <div key={label} style={{ ...gc, marginBottom: 0, padding: 18 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>{label}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {[['Total', stats.total], ['Kept', stats.kept], ['Keep rate', stats.keepRate !== null ? `${stats.keepRate}%` : '—'],
                            ['w/ feedback', stats.withFeedback], [dl.charAt(0).toUpperCase()+dl.slice(1), stats.discarded ?? stats.regenerated ?? 0], ['Avg gen', stats.avgGenSecs ? `${stats.avgGenSecs}s` : '—']].map(([l, v]) => (
                            <div key={l}><div style={{ fontSize: 10, color: t.textMuted }}>{l}</div><div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{typeof v === 'number' ? v.toLocaleString() : v}</div></div>
                          ))}
                        </div>
                        {stats.providers?.length > 0 && <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted }}>Providers: {stats.providers.filter(Boolean).join(', ')}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* By industry */}
                {overview.byIndustry?.length > 0 && (
                  <div style={gc}>
                    <SectionHeader icon={IpAnalytics} title="Coverage by Industry" subtitle="All 18 industries should be represented equally" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
                      {overview.byIndustry.map(({ industry, count }) => {
                        const pct = Math.min(100, Math.round((parseInt(count) / Math.max(1, overview.captionExamples || overview.trainingExamples)) * 100));
                        return (
                          <div key={industry} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 140, fontSize: 12, fontWeight: 600, color: t.text, flexShrink: 0, textTransform: 'capitalize' }}>{industry.replace(/_/g, ' ')}</div>
                            <div style={{ flex: 1, height: 7, borderRadius: 4, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'linear-gradient(90deg, #7C5CFC, #A78BFA)' }} />
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted, width: 55, textAlign: 'right', flexShrink: 0 }}>{parseInt(count).toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Live model config */}
                <div style={gc}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <SectionHeader icon={IpAdmin} title="Live Traffic Split" subtitle="Which model is serving wizard requests right now" />
                    <Button variant="primary" size="sm" onClick={() => setTab('models')} style={{ gap: 6 }}>
                      <IpAdmin size={12} /> Manage models
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>claude-sonnet-4-6</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>Anthropic API — current primary</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge variant="success">Active</Badge>
                        <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{claudeTraffic}%</span>
                      </div>
                    </div>
                    {models.filter(m => m.status !== 'retired').map(model => (
                      <div key={model.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: model.status === 'production' ? '#10B981' : '#F59E0B' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{model.version_name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{model.base_model}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge variant={model.status === 'production' ? 'success' : 'warning'}>{model.status}</Badge>
                          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{model.traffic_pct || 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── TRAINING DATA ─────────────────────────────────────────────────── */}
        {tab === 'training' && (
          <div style={gc}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <SectionHeader icon={IpDatabase} title="Training Data" subtitle={`${trainingTotal.toLocaleString()} examples — collected automatically from all generation routes`} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={trainingIndustry} onChange={e => { setTrainingIndustry(e.target.value); setTrainingPage(1); }}
                  style={{ ...inputStyle, width: 160, padding: '7px 10px' }}>
                  <option value="">All industries</option>
                  {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                </select>
                <Button variant="ghost" size="sm" onClick={handleExport} disabled={exporting} style={{ gap: 6, whiteSpace: 'nowrap' }}>
                  <IpDownload size={13} /> {exporting ? 'Exporting…' : 'Export JSONL'}
                </Button>
              </div>
            </div>

            {trainingData.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpDatabase size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No training data yet</div>
                <div style={{ fontSize: 13, color: t.textMuted }}>Collected automatically from wizard, quick post, and refresh routes.</div>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>{['ID','Source','Industry','Type','Var','Edited','Published','Reach','Quality','Rate',''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: t.textMuted, fontWeight: 600, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {trainingData.map(ex => (
                        <tr key={ex.id} style={{ borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : t.border}` }}>
                          <td style={{ padding: '8px 10px', color: t.textMuted }}>{ex.id}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <Badge variant={ex.source === 'refresh' ? 'warning' : ex.source === 'quick_post' ? 'default' : 'success'} style={{ fontSize: 10 }}>
                              {ex.source || 'wizard'}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px 10px', color: t.text, textTransform: 'capitalize' }}>{(ex.industry || '—').replace(/_/g, ' ')}</td>
                          <td style={{ padding: '8px 10px', color: t.text }}>{ex.content_type || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{ex.variation_selected ? <Badge variant="success">{ex.variation_selected}</Badge> : <span style={{ color: t.textMuted }}>—</span>}</td>
                          <td style={{ padding: '8px 10px' }}>{ex.was_edited ? <Badge variant="warning">Yes</Badge> : <span style={{ color: t.textMuted }}>—</span>}</td>
                          <td style={{ padding: '8px 10px' }}>{ex.was_published ? <Badge variant="success">Yes</Badge> : <span style={{ color: t.textMuted }}>—</span>}</td>
                          <td style={{ padding: '8px 10px', color: t.text }}>{ex.post_reach?.toLocaleString() || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ color: ex.quality_score >= 4 ? '#10B981' : ex.quality_score ? '#F59E0B' : t.textMuted, fontWeight: 700 }}>
                              {ex.quality_score ? `${ex.quality_score}/5` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <select
                              value={ex.quality_score || ''}
                              onChange={e => e.target.value && handleRateExample(ex.id, parseFloat(e.target.value))}
                              style={{ fontSize: 11, padding: '2px 4px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 4, color: t.text, cursor: 'pointer' }}>
                              <option value="">Rate</option>
                              {['5','4.5','4','3.5','3','2','1'].map(v => <option key={v} value={v}>{v}★</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => handleDeleteExample(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4 }} title="Delete">
                              <IpDelete size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>Page {trainingPage} · {trainingTotal.toLocaleString()} total</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" disabled={trainingPage <= 1} onClick={() => setTrainingPage(p => p - 1)}>← Prev</Button>
                    <Button variant="ghost" size="sm" disabled={trainingPage * 20 >= trainingTotal} onClick={() => setTrainingPage(p => p + 1)}>Next →</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── IMAGE IMPORT ──────────────────────────────────────────────────── */}
        {tab === 'images' && (
          <div>
            {/* Header card */}
            <div style={gc}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 6 }}>Image Dataset Import</div>
                  <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 560 }}>
                    Paste image URLs from your existing social media library. Claude Vision automatically reads each image,
                    identifies the industry and content type, and generates a detailed LoRA training caption.
                    No manual labeling needed.
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: t.isDark ? 'rgba(124,92,252,0.1)' : 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.primary, letterSpacing: '-0.03em' }}>{(imageDatasetCount || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>images labeled</div>
                </div>
              </div>

              {/* How it works */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { step: '1', title: 'Paste URLs', desc: 'One URL per line. Cloudinary, Google Drive, S3, any public URL.' },
                  { step: '2', title: 'Claude Vision labels', desc: 'Identifies industry, content type, generates 50-100 word LoRA caption.' },
                  { step: '3', title: 'Stored in DB', desc: 'Added to image_training_data with quality score.' },
                  { step: '4', title: 'Export & train', desc: 'Download Python script → run on Kaggle → train FLUX.1 LoRA.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} style={{ padding: '14px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: t.primary, marginBottom: 6, letterSpacing: '0.05em' }}>STEP {step}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Import form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Image URLs — one per line, or comma-separated (max 500 per batch)
                  </div>
                  <textarea
                    value={imageImport.urlsText}
                    onChange={e => setImageImport(f => ({ ...f, urlsText: e.target.value }))}
                    placeholder={'https://res.cloudinary.com/your-cloud/image/upload/v1/plumber_job_01.jpg\nhttps://res.cloudinary.com/your-cloud/image/upload/v1/hvac_tech_02.jpg\nhttps://...'}
                    rows={8}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                    {imageImport.urlsText
                      ? `${imageImport.urlsText.split(/[\n,]+/).filter(u => u.trim().startsWith('http')).length} valid URLs detected`
                      : 'Supports any publicly accessible URL — Cloudinary, S3, Google Drive direct links, etc.'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Industry <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(leave blank = auto-detect per image)</span>
                    </div>
                    <select value={imageImport.industry} onChange={e => setImageImport(f => ({ ...f, industry: e.target.value }))} style={inputStyle}>
                      <option value="">Auto-detect (recommended)</option>
                      {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Content Type <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(leave blank = auto-detect)</span>
                    </div>
                    <select value={imageImport.contentType} onChange={e => setImageImport(f => ({ ...f, contentType: e.target.value }))} style={inputStyle}>
                      <option value="">Auto-detect (recommended)</option>
                      {['before_after','job_complete','crew_at_work','team_shot','detail_shot','equipment','seasonal','testimonial','promotional'].map(v => (
                        <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Custom Caption <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional — skips Claude Vision if provided, applies to ALL imported images)</span>
                  </div>
                  <input
                    value={imageImport.customCaption}
                    onChange={e => setImageImport(f => ({ ...f, customCaption: e.target.value }))}
                    placeholder="Leave blank to let Claude Vision generate individual captions per image (recommended)"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    onClick={handleImportImages}
                    disabled={importing || !imageImport.urlsText.trim()}
                    style={{ gap: 8, minWidth: 160 }}
                  >
                    {importing
                      ? '⏳ Labeling with Claude Vision…'
                      : `🏷️ Import & Label ${imageImport.urlsText ? imageImport.urlsText.split(/[\n,]+/).filter(u => u.trim().startsWith('http')).length : 0} images`}
                  </Button>
                  {!imageImport.customCaption && (
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      ~{Math.ceil((imageImport.urlsText.split(/[\n,]+/).filter(u => u.trim().startsWith('http')).length || 0) * 2 / 60)} min at 3 images/sec
                    </div>
                  )}
                </div>

                {importing && (
                  <div style={{ padding: '12px 16px', background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, fontSize: 13, color: t.primary }}>
                    Claude Vision is analyzing each image, identifying industry and content type, and generating training captions… this may take a few minutes for large batches.
                  </div>
                )}

                {/* Import result */}
                {importResult && (
                  <div style={{ padding: '16px 20px', background: importResult.errors > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${importResult.errors > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`, borderRadius: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>
                      ✅ Import complete — {importResult.imported} labeled, {importResult.errors} failed
                    </div>
                    {importResult.results?.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 12 }}>
                        <Badge variant="success" style={{ flexShrink: 0 }}>{r.industry}</Badge>
                        <Badge variant="default" style={{ flexShrink: 0, fontSize: 10 }}>{r.contentType}</Badge>
                        <span style={{ color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.caption}</span>
                      </div>
                    ))}
                    {importResult.results?.length > 5 && (
                      <div style={{ fontSize: 12, color: t.textMuted }}>…and {importResult.results.length - 5} more</div>
                    )}
                    {importResult.errorDetails?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#D97706', marginBottom: 4 }}>Failed URLs:</div>
                        {importResult.errorDetails.slice(0, 5).map((e, i) => (
                          <div key={i} style={{ fontSize: 11, color: t.textMuted }}>{e.url?.substring(0, 60)}… — {e.error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Label Manager ────────────────────────────────────────────── */}
            <div style={gc}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showLabelManager ? 20 : 0 }}>
                <SectionHeader icon={IpCheck} title="Manage Labels" subtitle={`Review and correct industry, content type, and captions on ${(imageDatasetCount || 0).toLocaleString()} labeled images`} />
                <Button variant={showLabelManager ? 'ghost' : 'primary'} size="sm" onClick={() => { setShowLabelManager(v => !v); setSelectedImages(new Set()); }}>
                  {showLabelManager ? 'Collapse' : 'Open Label Manager'}
                </Button>
              </div>

              {showLabelManager && (
                <>
                  {/* Filter + bulk action bar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                    <select value={imageFilter.industry} onChange={e => { setImageFilter(f => ({ ...f, industry: e.target.value })); setImagePage(1); setSelectedImages(new Set()); }}
                      style={{ ...inputStyle, width: 160, padding: '7px 10px' }}>
                      <option value="">All industries</option>
                      {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                    </select>
                    <select value={imageFilter.contentType} onChange={e => { setImageFilter(f => ({ ...f, contentType: e.target.value })); setImagePage(1); setSelectedImages(new Set()); }}
                      style={{ ...inputStyle, width: 150, padding: '7px 10px' }}>
                      <option value="">All types</option>
                      {['before_after','job_complete','crew_at_work','team_shot','detail_shot','equipment','seasonal','testimonial','promotional'].map(v => (
                        <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <select value={imageFilter.minQuality} onChange={e => { setImageFilter(f => ({ ...f, minQuality: e.target.value })); setImagePage(1); setSelectedImages(new Set()); }}
                      style={{ ...inputStyle, width: 130, padding: '7px 10px' }}>
                      <option value="">Any quality</option>
                      <option value="4">4★+ only</option>
                      <option value="3">3★+ only</option>
                    </select>
                    <div style={{ fontSize: 12, color: t.textMuted, marginLeft: 'auto' }}>
                      {imageDatasetTotal.toLocaleString()} images{selectedImages.size > 0 ? ` · ${selectedImages.size} selected` : ''}
                    </div>
                  </div>

                  {/* Bulk action bar — only shown when something is selected */}
                  {selectedImages.size > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.primary, marginRight: 4 }}>{selectedImages.size} selected</span>
                      <select value={bulkForm.industry} onChange={e => setBulkForm(f => ({ ...f, industry: e.target.value }))}
                        style={{ ...inputStyle, width: 150, padding: '6px 8px', fontSize: 12 }}>
                        <option value="">Set industry…</option>
                        {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                      </select>
                      <select value={bulkForm.contentType} onChange={e => setBulkForm(f => ({ ...f, contentType: e.target.value }))}
                        style={{ ...inputStyle, width: 140, padding: '6px 8px', fontSize: 12 }}>
                        <option value="">Set type…</option>
                        {['before_after','job_complete','crew_at_work','team_shot','detail_shot','equipment','seasonal','testimonial','promotional'].map(v => (
                          <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <select value={bulkForm.qualityScore} onChange={e => setBulkForm(f => ({ ...f, qualityScore: e.target.value }))}
                        style={{ ...inputStyle, width: 110, padding: '6px 8px', fontSize: 12 }}>
                        <option value="">Set quality…</option>
                        {['5','4.5','4','3.5','3','2','1'].map(v => <option key={v} value={v}>{v}★</option>)}
                      </select>
                      <Button variant="primary" size="sm" onClick={handleBulkLabel}>Apply to {selectedImages.size}</Button>
                      <Button variant="ghost" size="sm" onClick={handleBulkDelete} style={{ color: t.error }}>Delete {selectedImages.size}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedImages(new Set())} style={{ marginLeft: 'auto' }}>Clear</Button>
                    </div>
                  )}

                  {/* Image grid */}
                  {labelLoading ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: t.textMuted }}>Loading images…</div>
                  ) : imageDataset.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: t.textMuted }}>
                      {imageDatasetCount ? 'No images match the current filters.' : 'No images imported yet. Use the import form above.'}
                    </div>
                  ) : (
                    <>
                      {/* Select all row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: t.textMuted }}>
                        <input type="checkbox" checked={selectedImages.size === imageDataset.length && imageDataset.length > 0}
                          onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                        <span>{selectedImages.size === imageDataset.length && imageDataset.length > 0 ? 'Deselect all' : 'Select all on page'}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                        {imageDataset.map(img => {
                          const isSelected = selectedImages.has(img.id);
                          const thumbUrl = img.url?.includes('cloudinary.com')
                            ? img.url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_70/')
                            : img.url;
                          const qualColor = img.quality_score >= 4 ? '#10B981' : img.quality_score >= 3 ? '#F59E0B' : img.quality_score ? '#EF4444' : t.textMuted;
                          return (
                            <div key={img.id} style={{
                              borderRadius: 10, overflow: 'hidden',
                              border: `2px solid ${isSelected ? '#7C5CFC' : t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
                              background: t.isDark ? 'rgba(15,15,24,0.8)' : t.card,
                              transition: 'border-color 150ms ease',
                            }}>
                              {/* Thumbnail */}
                              <div style={{ position: 'relative', height: 140, background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                {img.url ? (
                                  <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: t.textMuted }}>No preview</div>
                                )}
                                {/* Select overlay */}
                                <div style={{ position: 'absolute', top: 6, left: 6 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelectImage(img.id)}
                                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#7C5CFC' }} />
                                </div>
                                {/* Quality badge */}
                                {img.quality_score != null && (
                                  <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'rgba(0,0,0,0.65)', color: qualColor }}>
                                    {img.quality_score}★
                                  </div>
                                )}
                              </div>

                              {/* Labels */}
                              <div style={{ padding: '10px 12px' }}>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                  <Badge variant={img.industry ? 'success' : 'warning'} style={{ fontSize: 9 }}>
                                    {img.industry?.replace(/_/g, ' ') || 'no industry'}
                                  </Badge>
                                  <Badge variant="default" style={{ fontSize: 9 }}>
                                    {img.content_type?.replace(/_/g, ' ') || 'no type'}
                                  </Badge>
                                  {img.has_text_overlay && (
                                    <Badge variant="error" style={{ fontSize: 9 }} title="Text overlay — may corrupt training">⚠ text</Badge>
                                  )}
                                  {img.has_person && (
                                    <span style={{ fontSize: 9, color: '#3B82F6', fontWeight: 600 }} title="Person visible">👤</span>
                                  )}
                                  {img.is_branded && (
                                    <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }} title="Branded uniform/vehicle">🏷</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4, marginBottom: 8,
                                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {img.caption || 'No caption'}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal(img)}
                                    style={{ flex: 1, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}>
                                    Edit labels
                                  </Button>
                                  <button onClick={() => handleDeleteImage(img.id)}
                                    style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 7, cursor: 'pointer', color: t.textMuted, padding: '5px 8px', fontSize: 11 }}
                                    title="Remove from training set">
                                    <IpDelete size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                        <span style={{ fontSize: 12, color: t.textMuted }}>Page {imagePage} · {imageDatasetTotal.toLocaleString()} total</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="ghost" size="sm" disabled={imagePage <= 1} onClick={() => { setImagePage(p => p - 1); setSelectedImages(new Set()); }}>← Prev</Button>
                          <Button variant="ghost" size="sm" disabled={imagePage * 24 >= imageDatasetTotal} onClick={() => { setImagePage(p => p + 1); setSelectedImages(new Set()); }}>Next →</Button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Export section */}
            <div style={gc}>
              <SectionHeader icon={IpDownload} title="Export for LoRA Training" subtitle="Download your labeled image dataset ready to use with FLUX.1-schnell or SDXL training tools" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
                {/* JSONL export */}
                <div style={{ padding: '18px 20px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>📄 JSONL Dataset</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
                    JSON Lines file with URL + caption + industry + content_type + quality score.
                    Upload to Kaggle or use with any training script.
                  </div>
                  <Button variant="ghost" onClick={() => handleExportImageDataset('jsonl')} disabled={exporting} style={{ gap: 6, width: '100%', justifyContent: 'center' }}>
                    <IpDownload size={13} /> Export JSONL
                  </Button>
                </div>

                {/* Python script */}
                <div style={{ padding: '18px 20px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>🐍 Python Download Script</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
                    Self-contained Python script that downloads all images into the correct folder structure
                    for SimpleTuner / kohya_ss LoRA training.
                  </div>
                  <Button variant="primary" onClick={() => handleExportImageDataset('script')} disabled={exporting} style={{ gap: 6, width: '100%', justifyContent: 'center' }}>
                    <IpDownload size={13} /> Download Python Script
                  </Button>
                </div>
              </div>

              {/* Training instructions */}
              <div style={{ marginTop: 20, padding: '16px 20px', background: t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)', border: '1px solid rgba(124,92,252,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>After downloading the script:</div>
                {[
                  { cmd: 'pip install requests Pillow', desc: 'Install dependencies' },
                  { cmd: 'python download_dataset.py', desc: 'Downloads all images into training_data/ folder structure' },
                  { cmd: 'Upload training_data/ to Kaggle dataset', desc: 'Kaggle → Datasets → New → upload folder' },
                  { cmd: 'Open SimpleTuner notebook, point to dataset', desc: 'Set DATASET_PATH and INDUSTRY in notebook' },
                  { cmd: 'Run training (free T4 on Kaggle, ~4hrs/LoRA)', desc: 'Produces .safetensors LoRA weight file' },
                  { cmd: 'Register model in Model Versions tab', desc: 'Paste Modal.com endpoint URL to start A/B testing' },
                ].map(({ cmd, desc }, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: t.primary, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                    <div>
                      <code style={{ fontSize: 11, background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4, color: t.text }}>{cmd}</code>
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 8 }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MODEL VERSIONS ────────────────────────────────────────────────── */}
        {tab === 'models' && (
          <div>
            <div style={{ ...gc }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SectionHeader icon={IpAdmin} title="Model Versions" subtitle="Register trained models, set traffic split, deploy or rollback" />
                <Button variant="primary" size="sm" onClick={() => setShowRegisterModel(true)} style={{ gap: 6 }}>
                  <IpPlus size={13} /> Register Model
                </Button>
              </div>

              {models.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <IpAdmin size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No models registered yet</div>
                  <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 440, margin: '0 auto 20px' }}>
                    Train a model on Kaggle (free, Llama 3.2 3B) or RunPod (~$20, Llama 3.1 8B), then register it here to start A/B testing.
                  </div>

                  {/* Training quick-start */}
                  <div style={{ padding: '16px 20px', background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 12, textAlign: 'left', maxWidth: 560, margin: '0 auto' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Quick-start training steps</div>
                    {[
                      '1. Export JSONL from Training Data tab',
                      '2. Upload to Kaggle dataset or RunPod storage',
                      '3. Run: pip install trl transformers bitsandbytes peft',
                      '4. Train with SFTTrainer (QLoRA, rank 32, 3 epochs)',
                      '5. Push weights to HuggingFace private repo',
                      '6. Deploy Modal.com serverless endpoint',
                      '7. Click "Register Model" above and paste the endpoint URL',
                    ].map(step => (
                      <div key={step} style={{ fontSize: 12, color: t.textMuted, marginBottom: 5, display: 'flex', gap: 8 }}>
                        <span style={{ color: '#7C5CFC', fontWeight: 700, flexShrink: 0 }}>→</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {models.map(model => (
                    <div key={model.id} style={{ padding: '18px 20px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `2px solid ${model.status === 'production' ? 'rgba(16,185,129,0.3)' : model.status === 'staging' ? 'rgba(245,158,11,0.3)' : t.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: model.status === 'production' ? '#10B981' : model.status === 'staging' ? '#F59E0B' : '#6B7280', flexShrink: 0 }} />
                            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{model.version_name}</div>
                            <Badge variant={model.status === 'production' ? 'success' : model.status === 'staging' ? 'warning' : 'default'}>{model.status}</Badge>
                          </div>
                          <div style={{ fontSize: 12, color: t.textMuted, marginLeft: 20 }}>{model.base_model} · {model.modality || 'text'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {model.status === 'staging' && (
                            <Button variant="primary" size="sm" onClick={() => { setShowDeployModal(model); setDeployForm({ trafficPct: '10' }); }}>
                              🚀 Deploy
                            </Button>
                          )}
                          {model.status === 'production' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setShowDeployModal(model); setDeployForm({ trafficPct: String(model.traffic_pct || 10) }); }}>
                                Adjust traffic
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleModelAction(model, 'rollback')} style={{ color: t.error }}>
                                Rollback
                              </Button>
                            </>
                          )}
                          {model.status === 'staging' && (
                            <Button variant="ghost" size="sm" onClick={() => handleModelAction(model, 'retire')} style={{ color: t.textMuted }}>
                              Retire
                            </Button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.06)' : t.border}`, flexWrap: 'wrap' }}>
                        {[
                          ['Training examples', model.training_examples?.toLocaleString() || '—'],
                          ['BLEU score', model.eval_score || '—'],
                          ['Human score', model.eval_human_score ? `${model.eval_human_score}/5` : '—'],
                          ['Traffic', `${model.traffic_pct || 0}%`],
                          ['Trained', model.trained_at ? new Date(model.trained_at).toLocaleDateString() : '—'],
                          ['Promoted', model.promoted_at ? new Date(model.promoted_at).toLocaleDateString() : '—'],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {model.notes && <div style={{ marginTop: 10, fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>{model.notes}</div>}
                      {model.weights_url && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#7C5CFC' }}>
                          Endpoint: <span style={{ fontFamily: 'monospace' }}>{model.weights_url.substring(0, 80)}{model.weights_url.length > 80 ? '…' : ''}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── A/B TESTING ───────────────────────────────────────────────────── */}
        {tab === 'ab' && (
          <div style={gc}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionHeader icon={IpAnalytics} title="A/B Experiments" subtitle="Compare ItsPosting AI Brain vs Claude on live wizard traffic" />
              {models.length > 0 && (
                <Button variant="primary" size="sm" onClick={() => { setNewExpForm(f => ({ ...f, modelVersionId: models[0]?.id?.toString() || '' })); setShowNewExp(true); }}>
                  New experiment
                </Button>
              )}
            </div>
            {experiments.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpAnalytics size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No experiments yet</div>
                <div style={{ fontSize: 13, color: t.textMuted }}>{models.length === 0 ? 'Register a trained model first.' : 'Create an experiment to test live traffic.'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {experiments.map(exp => (
                  <div key={exp.id} style={{ padding: '16px 18px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 12, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Experiment #{exp.id} — {exp.version_name || 'Unknown model'}</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{exp.traffic_pct}% traffic · Started {new Date(exp.started_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Badge variant={exp.result === 'promoted' ? 'success' : exp.result === 'rolled_back' ? 'error' : 'default'}>{exp.result || 'ongoing'}</Badge>
                        {!exp.result && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => adminAPI.updateLLMExperiment(exp.id, { result: 'promoted' }).then(loadExperiments)}>✅ Promote</Button>
                            <Button variant="ghost" size="sm" onClick={() => adminAPI.updateLLMExperiment(exp.id, { result: 'rolled_back' }).then(loadExperiments)} style={{ color: t.error }}>↩ Rollback</Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                      {[['Total calls', exp.calls_total?.toLocaleString() || '0'], ['Selection rate', exp.user_selection_rate ? `${(exp.user_selection_rate * 100).toFixed(1)}%` : '—'], ['Edit rate', exp.edit_rate ? `${(exp.edit_rate * 100).toFixed(1)}%` : '—'], ['Avg reach', exp.avg_reach ? Math.round(exp.avg_reach).toLocaleString() : '—']].map(([label, value]) => (
                        <div key={label}><div style={{ fontSize: 11, color: t.textMuted }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value}</div></div>
                      ))}
                    </div>
                    {exp.notes && <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted, fontStyle: 'italic' }}>{exp.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QUALITY MONITOR ───────────────────────────────────────────────── */}
        {tab === 'quality' && (
          <div style={gc}>
            <SectionHeader icon={IpTrendingUp} title="Quality Monitor" subtitle="Real signals from the last 30 days of customer generations" />
            {!qualityStats ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: t.textMuted }}>Loading quality stats...</div>
            ) : (
              <>
                {/* Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20, marginBottom: 20 }}>
                  {[
                    { label: 'Total generations', value: qualityStats.total.toLocaleString(), note: `last ${qualityStats.days} days` },
                    { label: 'With user selection', value: qualityStats.withSelection.toLocaleString(), note: `${Math.round(qualityStats.withSelection / Math.max(1, qualityStats.total) * 100)}% capture rate` },
                    { label: 'Edit rate', value: `${qualityStats.editRatePct || 0}%`, note: 'lower = better quality', color: qualityStats.editRatePct > 30 ? '#EF4444' : qualityStats.editRatePct > 15 ? '#F59E0B' : '#10B981' },
                    { label: 'Regen rate', value: `${qualityStats.regenRatePct || 0}%`, note: 'lower = fewer do-overs', color: qualityStats.regenRatePct > 20 ? '#EF4444' : qualityStats.regenRatePct > 10 ? '#F59E0B' : '#10B981' },
                    { label: 'Published', value: qualityStats.publishedCount.toLocaleString(), note: 'actually posted' },
                    { label: 'Avg reach', value: qualityStats.avgReach ? qualityStats.avgReach.toLocaleString() : '—', note: 'when reach data available' },
                  ].map(({ label, value, note, color }) => (
                    <div key={label} style={{ padding: 16, background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: color || t.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{note}</div>
                    </div>
                  ))}
                </div>

                {/* Variation selection balance */}
                {qualityStats.selectionBreakdown?.length > 0 && (
                  <div style={{ padding: '16px 20px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Variation selection balance</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                      {qualityStats.selectionBreakdown.map(({ variation_selected, count }) => {
                        const total = qualityStats.selectionBreakdown.reduce((s, r) => s + parseInt(r.count), 0);
                        const pct = Math.round(parseInt(count) / total * 100);
                        const color = variation_selected === 'A' ? '#7C5CFC' : variation_selected === 'B' ? '#3B82F6' : '#10B981';
                        return (
                          <div key={variation_selected} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color }}>{pct}%</div>
                            <div style={{ height: 60, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden', margin: '8px 0', display: 'flex', alignItems: 'flex-end' }}>
                              <div style={{ width: '100%', height: `${pct}%`, background: `${color}90`, borderRadius: 6 }} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color }}>Variation {variation_selected}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{parseInt(count).toLocaleString()} selections</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: t.textMuted }}>
                      {(() => {
                        const totals = qualityStats.selectionBreakdown.reduce((s, r) => s + parseInt(r.count), 0);
                        const maxPct = Math.max(...qualityStats.selectionBreakdown.map(r => parseInt(r.count) / totals * 100));
                        return maxPct > 60 ? '⚠️ Selection is skewed — customers always prefer variation A. The model may not be generating diverse enough B/C variations.' : '✅ Selection balance is healthy — model is generating good variety across A, B, and C.';
                      })()}
                    </div>
                  </div>
                )}

                {/* By source */}
                {qualityStats.bySource?.length > 0 && (
                  <div style={{ padding: '16px 20px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Generations by source</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {qualityStats.bySource.map(({ source, count }) => {
                        const total = qualityStats.total || 1;
                        const pct   = Math.round(parseInt(count) / total * 100);
                        return (
                          <div key={source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: t.text, textTransform: 'capitalize', flexShrink: 0 }}>{(source || 'wizard').replace('_', ' ')}</div>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7C5CFC, #A78BFA)', borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted, width: 70, textAlign: 'right', flexShrink: 0 }}>{parseInt(count).toLocaleString()} ({pct}%)</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: t.textMuted }}>
                      Refresh source = customer asked for a re-generation. High refresh rate means captions aren't landing on first try.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CURATED EXAMPLES ──────────────────────────────────────────────── */}
        {tab === 'curated' && (
          <div style={gc}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionHeader icon={IpTeam} title="Curated Gold Examples" subtitle={`${curated.length} hand-annotated examples — these anchor fine-tuning quality`} />
              <Button variant="primary" size="sm" onClick={() => setShowAddExample(true)} style={{ gap: 6 }}>
                <IpPlus size={13} /> Add example
              </Button>
            </div>
            {curated.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <IpTeam size={32} style={{ color: t.textMuted, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No curated examples yet</div>
                <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 420, margin: '0 auto' }}>
                  Add 200 hand-crafted "perfect" posts per industry (18 industries × 200 = 3,600 total). These are the quality anchors the fine-tuned model learns from — each is weighted 5× vs a regular generation.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {curated.map(ex => (
                  <div key={ex.id} style={{ padding: '14px 16px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 10, border: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{ex.industry?.replace(/_/g, ' ')} — {ex.content_type?.replace(/_/g, ' ')}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>{'⭐'.repeat(Math.round(ex.quality_score || 0))}</span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{ex.annotated_by}</span>
                        <button onClick={() => handleDeleteCurated(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 2 }}><IpDelete size={13} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{String(ex.ideal_output?.variation_a?.caption || '').substring(0, 140)}…</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TRAINING GUIDE ────────────────────────────────────────────────── */}
      {tab === 'guide' && (() => {
        const captionCount  = overview?.captionExamples  || 0;
        const imageCount    = overview?.imageExamples    || 0;
        const videoCount    = overview?.videoExamples    || 0;
        const captionTarget = 10000;
        const imageTarget   = 500;
        const captionPct    = Math.min(100, Math.round(captionCount / captionTarget * 100));
        const imagePct      = Math.min(100, Math.round(imageCount  / imageTarget  * 100));

        const stepBox = (num, title, desc, code) => (
          <div key={num} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#5B21B6,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#fff', marginTop: 1 }}>{num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6, marginBottom: code ? 10 : 0 }}>{desc}</div>
              {code && (
                <pre style={{ margin: 0, padding: '10px 14px', background: t.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)', borderRadius: 8, fontSize: 11, color: t.isDark ? '#A78BFA' : '#5B21B6', overflowX: 'auto', lineHeight: 1.7, border: `1px solid ${t.isDark ? 'rgba(124,92,252,0.2)' : 'rgba(124,92,252,0.15)'}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{code}</pre>
              )}
            </div>
          </div>
        );

        const progressBar = (current, target, label, color) => (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: current >= target ? '#10B981' : color }}>
                {current.toLocaleString()} / {target.toLocaleString()} {current >= target ? '✅ Ready!' : ''}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round(current / target * 100))}%`, borderRadius: 6, background: current >= target ? '#10B981' : `linear-gradient(90deg,${color},${color}bb)`, transition: 'width 600ms ease' }} />
            </div>
          </div>
        );

        return (
          <div>
            {/* Live progress */}
            <div style={{ ...gc, background: t.isDark ? 'rgba(124,92,252,0.08)' : 'rgba(124,92,252,0.04)', border: '1px solid rgba(124,92,252,0.2)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 4 }}>Your Current Progress</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 20 }}>Data is collected automatically every time a customer uses the wizard. Check back here as you grow.</div>
              {progressBar(captionCount + videoCount, captionTarget, 'Caption + Video Script examples (Path 1)', '#7C5CFC')}
              {progressBar(imageCount, imageTarget, 'Labeled images (Path 2)', '#10B981')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 4 }}>
                {[
                  { label: 'Caption examples', value: captionCount.toLocaleString(), color: '#7C5CFC' },
                  { label: 'Video script examples', value: videoCount.toLocaleString(), color: '#3B82F6' },
                  { label: 'Labeled images', value: imageCount.toLocaleString(), color: '#10B981' },
                  { label: 'Est. customers needed (Path 1)', value: '500–1,000', color: t.textMuted },
                  { label: 'Est. customers needed (Path 2)', value: '~200', color: t.textMuted },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '10px 12px', background: t.isDark ? 'rgba(255,255,255,0.03)' : t.input, borderRadius: 8, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div style={{ ...gc }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 16 }}>Timeline Estimate</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>{['Milestone', 'When (active customers)', 'Action'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: t.textMuted, fontWeight: 600, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {[
                      ['500 labeled images collected', '~200 customers', '→ Start Path 2 (Image LoRA)'],
                      ['Image LoRA trained + deployed', '~200 customers', '→ Set image traffic to 5%'],
                      ['10,000 caption + video script examples', '~500–1,000 customers', '→ Start Path 1 (Text model)'],
                      ['Caption model trained + deployed', '~500–1,000 customers', '→ Set text traffic to 5%'],
                      ['A/B test passes (edit rate < 15%)', '~1,000+ customers', '→ Increase to 25–50% traffic'],
                      ['Full rollout', 'When confident', '→ 100% on your model — Claude costs near zero'],
                    ].map(([milestone, when, action]) => (
                      <tr key={milestone} style={{ borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.04)' : t.border}` }}>
                        <td style={{ padding: '10px 12px', color: t.text, fontWeight: 600 }}>{milestone}</td>
                        <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 600 }}>{when}</td>
                        <td style={{ padding: '10px 12px', color: t.primary, fontSize: 12 }}>{action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Path 1 */}
            <div style={{ ...gc }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.25)', fontSize: 11, fontWeight: 800, color: '#7C5CFC', letterSpacing: '0.05em' }}>PATH 1</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Caption + Video Script Model (Text)</div>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>Base: Llama 3.1 8B Instruct · Fine-tune with: QLoRA (rank 32, 3 epochs) · Target: replace Claude for caption generation</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: captionCount + videoCount >= captionTarget ? '#10B981' : '#D97706', marginBottom: 20 }}>
                {captionCount + videoCount >= captionTarget ? '✅ You have enough data — start training!' : `⏳ ${(captionTarget - captionCount - videoCount).toLocaleString()} more examples needed before training`}
              </div>

              {stepBox(1, 'Export your training data',
                'Go to the Training Data tab above → click "Export JSONL". This downloads all examples with quality_score ≥ 3 in the fine-tuning format. Tip: filter by quality_score ≥ 4 only for a cleaner dataset.',
              )}
              {stepBox(2, 'Create a Kaggle account and notebook',
                'Go to kaggle.com → Sign up free → click "+ New Notebook" → Settings → Accelerator → GPU T4 x2 (free, 30hrs/week). Upload your JSONL as a Kaggle Dataset first: Datasets → New Dataset → upload the file.',
              )}
              {stepBox(3, 'Install dependencies in your notebook',
                'Paste this in the first cell and run it:',
                `!pip install -q transformers datasets trl bitsandbytes peft accelerate huggingface_hub`
              )}
              {stepBox(4, 'Run QLoRA fine-tuning',
                'Paste this training script in your notebook. It uses 4-bit quantisation so Llama 3.1 8B fits on a T4 GPU:',
                `from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from trl import SFTTrainer, SFTConfig
from peft import LoraConfig
from datasets import load_dataset
import torch

MODEL = "meta-llama/Llama-3.1-8B-Instruct"  # requires HF token
DATASET = "/kaggle/input/your-dataset/postcore-training.jsonl"

bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, quantization_config=bnb, device_map="auto")

lora = LoraConfig(r=32, lora_alpha=64, target_modules=["q_proj","v_proj"], lora_dropout=0.05)
dataset = load_dataset("json", data_files=DATASET, split="train")

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    peft_config=lora,
    args=SFTConfig(
        output_dir="./postcore-v1",
        num_train_epochs=3,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=50,
        save_steps=200,
    ),
)
trainer.train()
trainer.save_model("./postcore-v1-final")`
              )}
              {stepBox(5, 'Push weights to Hugging Face (free private repo)',
                'After training finishes (~4–6 hours), push the model to a private HF repo so Modal.com can load it:',
                `from huggingface_hub import HfApi
api = HfApi()
# First: huggingface-cli login  (paste your HF token)
api.create_repo("your-username/postcore-text-v1", private=True)
trainer.model.push_to_hub("your-username/postcore-text-v1")
tokenizer.push_to_hub("your-username/postcore-text-v1")
print("Done — model at: https://huggingface.co/your-username/postcore-text-v1")`
              )}
              {stepBox(6, 'Deploy to Modal.com (inference endpoint)',
                'Sign up at modal.com (free $30/month credits). Create a file called postcore_app.py on your local machine and deploy it:',
                `# postcore_app.py
import modal

app = modal.App("postcore-text")
image = modal.Image.debian_slim().pip_install("transformers","peft","accelerate","torch")

@app.function(gpu="T4", image=image, secrets=[modal.Secret.from_name("huggingface-secret")])
@modal.web_endpoint(method="POST")
def generate(item: dict):
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from peft import PeftModel
    import torch, os

    base = "meta-llama/Llama-3.1-8B-Instruct"
    adapter = "your-username/postcore-text-v1"  # your HF repo
    tok = AutoTokenizer.from_pretrained(base, token=os.environ["HF_TOKEN"])
    mdl = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.float16, device_map="auto", token=os.environ["HF_TOKEN"])
    mdl = PeftModel.from_pretrained(mdl, adapter, token=os.environ["HF_TOKEN"])

    prompt = item.get("prompt", "")
    inputs = tok(prompt, return_tensors="pt").to("cuda")
    out = mdl.generate(**inputs, max_new_tokens=512, temperature=0.8, do_sample=True)
    return {"text": tok.decode(out[0], skip_special_tokens=True)}

# In terminal: modal deploy postcore_app.py
# Copy the printed endpoint URL — e.g. https://your-org--postcore-text.modal.run`
              )}
              {stepBox(7, 'Register here and start A/B testing',
                'Come back to this page → Model Versions tab → click "Register Model" → paste the Modal.com endpoint URL → set modality to "text" → save. Then set traffic to 5% (meaning 5% of wizard generations use your model instead of Claude). Watch the Quality Monitor tab to compare edit rates and selection rates. If your model performs as well as Claude after 2–3 weeks → increase traffic to 25%, then 50%, then 100%.',
              )}
            </div>

            {/* Path 2 */}
            <div style={{ ...gc }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 11, fontWeight: 800, color: '#10B981', letterSpacing: '0.05em' }}>PATH 2</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Image Style LoRA (FLUX.1)</div>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>Base: FLUX.1-schnell (open source, Apache 2.0) · Fine-tune: LoRA adapter on your labeled images · Target: ItsPosting-branded visual style for local trades</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: imageCount >= imageTarget ? '#10B981' : '#D97706', marginBottom: 20 }}>
                {imageCount >= imageTarget ? '✅ You have enough images — start training!' : `⏳ ${Math.max(0, imageTarget - imageCount)} more labeled images needed. Import images in the Image Import tab.`}
              </div>

              {stepBox(1, 'Export images + captions',
                'Go to the Image Import tab above → scroll to "Export for LoRA Training" → click "Download Python Script". This gives you a download_dataset.py file that downloads all your labeled images into the correct folder structure.',
              )}
              {stepBox(2, 'Download the images locally',
                'Run the script on your local machine (not Kaggle — downloads to your disk first):',
                `pip install requests Pillow
python download_dataset.py
# Creates: training_data/plumbing/before_after/image_001.jpg etc.
# Also creates: training_data/captions.jsonl  (image path + caption pairs)`
              )}
              {stepBox(3, 'Upload to Kaggle as a Dataset',
                'Go to kaggle.com → Datasets → New Dataset → drag your training_data/ folder → name it "postcore-image-dataset" → Create. This takes 5–10 minutes. Then create a new Notebook → GPU T4 → attach your dataset.',
              )}
              {stepBox(4, 'Install and run FLUX.1 LoRA training',
                'Paste in your Kaggle notebook. Uses SimpleTuner which is the best free FLUX LoRA trainer:',
                `!git clone https://github.com/bghira/SimpleTuner
!cd SimpleTuner && pip install -q -r requirements.txt

# config.json — paste this as a file in your notebook
CONFIG = {
  "model_type": "flux",
  "pretrained_model_name_or_path": "black-forest-labs/FLUX.1-schnell",
  "output_dir": "/kaggle/working/postcore-image-lora",
  "dataset_name": "/kaggle/input/postcore-image-dataset/training_data",
  "caption_column": "caption",          # from your captions.jsonl
  "resolution": 1024,
  "train_batch_size": 1,
  "gradient_accumulation_steps": 4,
  "num_train_epochs": 3,
  "learning_rate": 1e-4,
  "rank": 16,                            # LoRA rank
  "mixed_precision": "bf16",
  "save_every_n_steps": 250
}

import json
with open("SimpleTuner/config/config.json","w") as f: json.dump(CONFIG, f)

!cd SimpleTuner && python train.py --config_path config/config.json
# Takes ~3–4 hours on T4. Output: postcore-image-lora/pytorch_lora_weights.safetensors`
              )}
              {stepBox(5, 'Deploy to Fal.ai',
                'Fal.ai is the cheapest FLUX inference host (~$0.01–0.02/image). Sign up at fal.ai → API Keys → create key. Upload your LoRA:',
                `pip install fal-client

import fal_client, os
os.environ["FAL_KEY"] = "your-fal-api-key"

# Upload your .safetensors file to Fal storage
result = fal_client.upload_file("postcore-image-lora/pytorch_lora_weights.safetensors")
lora_url = result.url
print("LoRA URL:", lora_url)

# Test it works:
out = fal_client.run(
  "fal-ai/flux-lora",
  arguments={
    "prompt": "A plumber fixing a burst pipe under a kitchen sink, professional photo",
    "loras": [{"path": lora_url, "scale": 0.9}],
    "image_size": "portrait_4_3",
    "num_inference_steps": 28,
  }
)
print("Test image:", out["images"][0]["url"])`
              )}
              {stepBox(6, 'Register here and start A/B testing',
                'Model Versions tab → Register Model → paste the Fal.ai model URL (e.g. fal-ai/flux-lora?lora=your-url) → modality: image → save. Set traffic to 5%. In the Image Import tab you\'ll start seeing "keep rate" data — if customers keep your LoRA images at the same rate as NanoBanana images, scale up.',
              )}
            </div>

            {/* Path 3 — Video */}
            <div style={{ ...gc }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 11, fontWeight: 800, color: '#3B82F6', letterSpacing: '0.05em' }}>PATH 3</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Video Model — Future</div>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>You currently have {videoCount.toLocaleString()} video script examples being collected. Video scripts feed directly into Path 1 (same text model training). Full video LoRA fine-tuning is a separate future step.</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '16px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>✅ What's already working</div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
                    Video scripts are included in Path 1 JSONL export automatically — your text model already learns the right tone and length for video narration scripts. No extra steps needed.
                  </div>
                </div>
                <div style={{ padding: '16px 18px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#D97706', marginBottom: 8 }}>⏳ Full video LoRA — when ready</div>
                  <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
                    Requires 500+ labeled video clips + A100 80GB GPU (~$200–500/run). Base model: Wan 2.1 (open source). Data is being collected now. Train this when you have paying customer budget to cover the GPU cost.
                  </div>
                </div>
              </div>
            </div>

            {/* Key reminders */}
            <div style={{ ...gc, background: t.isDark ? 'rgba(124,92,252,0.06)' : 'rgba(124,92,252,0.04)', border: '1px solid rgba(124,92,252,0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 14 }}>Important Reminders Before You Train</div>
              {[
                ['Always review before deploying', 'Never set traffic % until you\'ve manually tested 20–30 generations from the new model. Check: does it produce 3 distinct variations? Does it respect the industry and season? Does every post end with an engagement question?'],
                ['Start at 5% traffic, not more', 'Your first deployment should always be 5%. Watch Quality Monitor for 2 weeks. If edit rate and selection rate match Claude\'s, increase to 25%. Never jump straight to 100%.'],
                ['The model doesn\'t know new industries', 'Your fine-tuned model only knows what it saw in training data. If you add a new industry after training, those generations fall back to Claude automatically until you retrain.'],
                ['Path 2 comes first', 'You\'ll hit 500 labeled images (Path 2 threshold) long before 10,000 caption examples (Path 1 threshold). Do Path 2 first. Each path is independent.'],
                ['Keep your Kaggle checkpoints', 'After training, download the .safetensors file from Kaggle to your local machine before the notebook session expires. Kaggle sessions end after 9 hours of inactivity.'],
              ].map(([title, body]) => (
                <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}` }}>
                  <span style={{ color: '#7C5CFC', fontWeight: 800, fontSize: 16, flexShrink: 0, marginTop: 1 }}>→</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3 }}>{title}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── REGISTER MODEL MODAL ────────────────────────────────────────────── */}
      {showRegisterModel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...gc, maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Register Trained Model</div>
              <button onClick={() => setShowRegisterModel(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}><IpClose size={18} /></button>
            </div>
            <form onSubmit={handleRegisterModel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Version Name *</div>
                <input required value={registerForm.versionName} onChange={e => setRegisterForm(f => ({ ...f, versionName: e.target.value }))}
                  placeholder="e.g. postcore-text-v0.1-llama3.2-3b" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Model *</div>
                  <select value={registerForm.baseModel} onChange={e => setRegisterForm(f => ({ ...f, baseModel: e.target.value }))} style={inputStyle}>
                    {BASE_MODELS.map(m => <option key={m} value={m}>{m.split('/')[1]}</option>)}
                    <option value="custom">Other (custom)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modality</div>
                  <select value={registerForm.modality} onChange={e => setRegisterForm(f => ({ ...f, modality: e.target.value }))} style={inputStyle}>
                    <option value="text">Text (captions + hashtags)</option>
                    <option value="image">Image (FLUX.1 / SDXL LoRA)</option>
                    <option value="video">Video (LTX-Video / SadTalker)</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modal.com Inference Endpoint URL</div>
                <input value={registerForm.weightsUrl} onChange={e => setRegisterForm(f => ({ ...f, weightsUrl: e.target.value }))}
                  placeholder="https://your-modal-app--postcore-text.modal.run" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Training examples</div>
                  <input type="number" value={registerForm.trainingExamples} onChange={e => setRegisterForm(f => ({ ...f, trainingExamples: e.target.value }))} placeholder="e.g. 12500" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BLEU score</div>
                  <input type="number" step="0.001" value={registerForm.evalBleu} onChange={e => setRegisterForm(f => ({ ...f, evalBleu: e.target.value }))} placeholder="e.g. 0.412" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Human score (1–5)</div>
                  <input type="number" step="0.5" min="1" max="5" value={registerForm.evalHumanScore} onChange={e => setRegisterForm(f => ({ ...f, evalHumanScore: e.target.value }))} placeholder="e.g. 4.2" style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
                <textarea value={registerForm.notes} onChange={e => setRegisterForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Trained on 12,500 plumbing + HVAC + roofing examples. 3 epochs, QLoRA rank 32." rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => setShowRegisterModel(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Registering…' : 'Register Model'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DEPLOY MODAL ────────────────────────────────────────────────────── */}
      {showDeployModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...gc, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Deploy {showDeployModal.version_name}</div>
              <button onClick={() => setShowDeployModal(null)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}><IpClose size={18} /></button>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 12, color: '#D97706' }}>
              ⚠️ This routes live wizard traffic to ItsPosting AI Brain. Start low (5–10%) and monitor quality before scaling up.
            </div>
            <form onSubmit={handleDeployModel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traffic % to ItsPosting AI Brain</div>
                <select value={deployForm.trafficPct} onChange={e => setDeployForm({ trafficPct: e.target.value })} style={inputStyle}>
                  {['5','10','20','30','50','75','100'].map(v => (
                    <option key={v} value={v}>{v}% ItsPosting AI Brain · {100 - parseInt(v)}% Claude</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                Quality thresholds before scaling: edit rate {'<'} 25%, regen rate {'<'} 20%, human eval ≥ 4.0/5.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => setShowDeployModal(null)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Deploying…' : `Deploy at ${deployForm.trafficPct}%`}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD CURATED EXAMPLE MODAL ────────────────────────────────────────── */}
      {showAddExample && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...gc, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Add Curated Example</div>
              <button onClick={() => setShowAddExample(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}><IpClose size={18} /></button>
            </div>
            <form onSubmit={handleAddExample} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industry</div>
                  <select value={addExForm.industry} onChange={e => setAddExForm(f => ({ ...f, industry: e.target.value }))} style={inputStyle}>
                    {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Type</div>
                  <select value={addExForm.contentType} onChange={e => setAddExForm(f => ({ ...f, contentType: e.target.value }))} style={inputStyle}>
                    {['job_finished','tip','testimonial','seasonal','promotion','community','faq','team'].map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Score</div>
                <select value={addExForm.qualityScore} onChange={e => setAddExForm(f => ({ ...f, qualityScore: e.target.value }))} style={inputStyle}>
                  {['5','4.5','4','3.5','3'].map(v => <option key={v} value={v}>{v} ★</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input Payload (JSON)</div>
                <textarea value={addExForm.inputPayload} onChange={e => setAddExForm(f => ({ ...f, inputPayload: e.target.value }))}
                  placeholder={'{\n  "tone": "friendly",\n  "details": "Customer had burst pipe..."\n}'}
                  rows={4} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ideal Output (JSON with variation_a/b/c)</div>
                <textarea value={addExForm.idealOutput} onChange={e => setAddExForm(f => ({ ...f, idealOutput: e.target.value }))}
                  placeholder={'{\n  "variation_a": { "caption": "...", "hashtags": [], "engagementQuestion": "?" },\n  "variation_b": {...},\n  "variation_c": {...}\n}'}
                  rows={6} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => setShowAddExample(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Saving…' : 'Add Example'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT LABEL MODAL ────────────────────────────────────────────────── */}
      {editingImage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...gc, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Edit Image Labels</div>
              <button onClick={() => setEditingImage(null)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}><IpClose size={18} /></button>
            </div>

            {/* Side-by-side: image preview + form */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
              {/* Preview */}
              <div style={{ borderRadius: 10, overflow: 'hidden', background: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', aspectRatio: '1/1' }}>
                {editingImage.url ? (
                  <img src={editingImage.url?.includes('cloudinary.com')
                    ? editingImage.url.replace('/upload/', '/upload/w_400,h_400,c_fill/')
                    : editingImage.url}
                    alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: t.textMuted }}>No preview</div>
                )}
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industry</div>
                  <select value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} style={inputStyle}>
                    <option value="">— keep current ({editingImage.industry || 'none'}) —</option>
                    {INDUSTRIES_18.map(i => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Type</div>
                  <select value={editForm.contentType} onChange={e => setEditForm(f => ({ ...f, contentType: e.target.value }))} style={inputStyle}>
                    <option value="">— keep current ({editingImage.content_type || 'none'}) —</option>
                    {['before_after','job_complete','crew_at_work','team_shot','detail_shot','equipment','seasonal','testimonial','promotional'].map(v => (
                      <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Score</div>
                  <select value={editForm.qualityScore} onChange={e => setEditForm(f => ({ ...f, qualityScore: e.target.value }))} style={inputStyle}>
                    <option value="">— keep current ({editingImage.quality_score != null ? `${editingImage.quality_score}★` : 'unrated'}) —</option>
                    {['5','4.5','4','3.5','3','2','1'].map(v => <option key={v} value={v}>{v}★ — {v >= 4 ? 'Great' : v >= 3 ? 'Good' : 'Poor'}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Training Caption <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(what FLUX.1 will learn from this image)</span>
                  </div>
                  <textarea
                    value={editForm.caption}
                    onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))}
                    placeholder={editingImage.caption || 'Describe the image in 50–100 words for LoRA training…'}
                    rows={5}
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', fontSize: 12, lineHeight: 1.5 }}
                  />
                  <div style={{ fontSize: 11, color: editForm.caption.length > 80 && editForm.caption.length < 300 ? '#10B981' : editForm.caption.length > 300 ? '#F59E0B' : t.textMuted, marginTop: 3 }}>
                    {editForm.caption.length} chars · aim for 100–250 for best LoRA results
                  </div>
                  {editingImage.tags?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: t.textMuted, marginRight: 2 }}>Auto-tags:</span>
                      {editingImage.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: t.text }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {editingImage.has_text_overlay && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, fontSize: 11, color: '#EF4444' }}>
                      ⚠️ Text overlay detected — this image may corrupt LoRA training. Consider deleting it or manually cropping the overlay out before importing.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
              <Button variant="ghost" onClick={() => setEditingImage(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveEdit}>Save Labels</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW EXPERIMENT MODAL ─────────────────────────────────────────────── */}
      {showNewExp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...gc, maxWidth: 460, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>New A/B Experiment</div>
              <button onClick={() => setShowNewExp(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}><IpClose size={18} /></button>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 12, color: '#D97706' }}>
              ⚠️ Routes live wizard traffic to ItsPosting AI Brain. Set traffic % low (5–10%) to start.
            </div>
            <form onSubmit={handleNewExperiment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model Version</div>
                <select value={newExpForm.modelVersionId} onChange={e => setNewExpForm(f => ({ ...f, modelVersionId: e.target.value }))} style={inputStyle}>
                  <option value="">Select model…</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.version_name} ({m.training_examples?.toLocaleString()} examples)</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traffic %</div>
                <select value={newExpForm.trafficPct} onChange={e => setNewExpForm(f => ({ ...f, trafficPct: e.target.value }))} style={inputStyle}>
                  {['5','10','20','50'].map(v => <option key={v} value={v}>{v}% ItsPosting AI · {100 - parseInt(v)}% Claude</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes (optional)</div>
                <textarea value={newExpForm.notes} onChange={e => setNewExpForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Testing v0.1 on plumbing subset" rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => setShowNewExp(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting || !newExpForm.modelVersionId}>{submitting ? 'Creating…' : 'Start Experiment'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}
