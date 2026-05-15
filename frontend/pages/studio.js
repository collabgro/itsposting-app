import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Button, Card, Badge, EmptyState } from '../components/ui';
import { IpSparkle, IpRefresh, IpPublish, IpSchedule, IpDrafts, IpClose, IpDownload, IpCheck } from '../components/icons';
import { useTheme } from '../lib/theme';
import { studioAPI } from '../lib/api';

// Step progress indicator — shows which phase of the 3-step flow is active
function StepGuide({ step, t }) {
  const steps = [
    { n: 1, label: 'Pick a photo' },
    { n: 2, label: 'Design your overlay' },
    { n: 3, label: 'Post or save' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 20px', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: step >= s.n ? t.primary : t.border,
              color: step >= s.n ? '#fff' : t.textMuted,
              flexShrink: 0,
            }}>{s.n}</div>
            <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? t.text : step > s.n ? t.textMuted : t.textMuted }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 32, height: 2, background: step > s.n ? t.primary : t.border, margin: '0 10px', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}

const CATEGORIES = ['all', 'tips', 'job_site', 'before_after', 'seasonal', 'team', 'general'];
const STYLES = [
  { id: 'banner',       label: 'Top Banner',     desc: 'Solid bar across top' },
  { id: 'bottom_bar',   label: 'Bottom Bar',      desc: 'Solid bar at bottom' },
  { id: 'center',       label: 'Center Overlay',  desc: 'Floating box in center' },
  { id: 'full_overlay', label: 'Full Overlay',     desc: 'Tinted whole photo' },
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

export default function PhotoStudio() {
  const { t } = useTheme();
  const router = useRouter();
  const canvasRef = useRef(null);
  const sectionTwoRef = useRef(null);
  const photoImgRef = useRef(null);

  // ── Photo browser state
  const [industryFilter, setIndustryFilter] = useState('mine');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photosTotal, setPhotosTotal] = useState(0);
  const [photosOffset, setPhotosOffset] = useState(0);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [customerIndustry, setCustomerIndustry] = useState('');

  // ── Studio editor state
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [overlayStyle, setOverlayStyle] = useState('banner');
  const [overlayColor, setOverlayColor] = useState('#1a5c2a');
  const [customColor, setCustomColor] = useState('');
  const [textColor] = useState('#ffffff');
  const [opacity] = useState(0.85);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [formatting, setFormatting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [generatedId, setGeneratedId] = useState(null);
  const [error, setError] = useState('');

  // ── Post modal state
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [postPlatforms, setPostPlatforms] = useState(['facebook', 'instagram']);
  const [scheduleMode, setScheduleMode] = useState('draft');
  const [scheduledDate, setScheduledDate] = useState('');
  const [posting, setPosting] = useState(false);

  // ── Creations state
  const [creations, setCreations] = useState([]);
  const [creationsOpen, setCreationsOpen] = useState(false);
  const [creationsLoading, setCreationsLoading] = useState(false);

  // ── Load photos
  const loadPhotos = useCallback(async (offset = 0, append = false) => {
    setPhotosLoading(true);
    try {
      const params = { limit: 30, offset };
      if (industryFilter !== 'all') params.industry = industryFilter === 'mine' ? customerIndustry : undefined;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await studioAPI.getPhotos(params);
      setPhotos(prev => append ? [...prev, ...(data.photos || [])] : (data.photos || []));
      setPhotosTotal(data.total || 0);
      setPhotosOffset(offset);
    } catch (e) {
      console.error(e);
    } finally {
      setPhotosLoading(false);
    }
  }, [industryFilter, categoryFilter, search, customerIndustry]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { const u = JSON.parse(stored); setCustomerIndustry(u.industry || ''); }
      catch {}
    }
  }, []);

  useEffect(() => {
    setPhotosOffset(0);
    loadPhotos(0, false);
  }, [industryFilter, categoryFilter, customerIndustry]);

  useEffect(() => {
    const timer = setTimeout(() => { setPhotosOffset(0); loadPhotos(0, false); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Canvas preview
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

  const handleSelectPhoto = (photo) => {
    setSelectedPhoto(photo);
    setGeneratedUrl(null);
    setGeneratedId(null);
    setTitle('');
    setSubtitle('');
    setPrompt('');
    setError('');
    setTimeout(() => sectionTwoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handlePreset = (preset) => {
    setTitle(preset.title);
    setSubtitle(preset.subtitle);
    setGeneratedUrl(null);
  };

  const handleFormat = async () => {
    if (!prompt.trim()) return setError('Please describe what you want on this photo.');
    setFormatting(true); setError('');
    try {
      const { data } = await studioAPI.format({ stockPhotoId: selectedPhoto.id, prompt: prompt.trim(), style: overlayStyle });
      setTitle(data.title || '');
      setSubtitle(data.subtitle || '');
      if (data.overlayColor) setOverlayColor(data.overlayColor);
      setGeneratedUrl(null);
    } catch (e) {
      setError(e.response?.data?.error || 'PostCore could not format your text. Please try again.');
    } finally {
      setFormatting(false);
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) return setError('Please add a title before generating.');
    setGenerating(true); setError('');
    try {
      const { data } = await studioAPI.generate({
        stockPhotoId: selectedPhoto.id, title: title.trim(), subtitle: subtitle.trim(),
        style: overlayStyle, overlayColor, textColor, opacity,
      });
      setGeneratedUrl(data.creation.outputUrl);
      setGeneratedId(data.creation.id);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate image. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!generatedId) return;
    setPosting(true); setError('');
    try {
      await studioAPI.postCreation(generatedId, { caption, platforms: postPlatforms, scheduleMode, scheduledDate: scheduledDate || null });
      setPostModalOpen(false);
      setError('');
      alert(scheduleMode === 'now' ? 'Post published!' : scheduleMode === 'schedule' ? 'Post scheduled!' : 'Saved as draft!');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save post. Please try again.');
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

  const presets = PRESETS[customerIndustry] || PRESETS.general_contractor;

  // Determine which step the user is on for the progress indicator
  const activeStep = generatedUrl ? 3 : selectedPhoto ? 2 : 1;

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
      setError('');
      setTimeout(() => sectionTwoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      console.error('Failed to load photo for re-use', e);
    }
  };

  return (
    <Layout title="Photo Studio" subtitle="Pick a stock photo, add your message, post it.">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 80px' }}>

        {/* Step guide */}
        <StepGuide step={activeStep} t={t} />

        {/* ── Section 1: Photo Browser ─────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            {/* Industry toggle */}
            <div style={{ display: 'flex', background: t.cardBg, borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              {['mine', 'all'].map(v => (
                <button key={v} onClick={() => setIndustryFilter(v)}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: industryFilter === v ? t.primary : 'transparent', color: industryFilter === v ? '#fff' : t.textMuted, transition: 'all 0.15s' }}>
                  {v === 'mine' ? 'My Industry' : 'All Industries'}
                </button>
              ))}
            </div>

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search photos..."
              style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, width: 200, outline: 'none' }} />
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 20, border: `1px solid ${categoryFilter === cat ? t.primary : t.border}`, background: categoryFilter === cat ? t.primaryBg : 'transparent', color: categoryFilter === cat ? t.primary : t.textMuted, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                {cat === 'all' ? 'All' : cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Photo grid */}
          {photosLoading && photos.length === 0 ? (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: '60px 0', fontSize: 14 }}>Loading photos...</div>
          ) : photos.length === 0 ? (
            <EmptyState title="No photos found" description="Try a different category or ask your admin to upload photos for your industry." />
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

        {/* CTA when no photo selected yet */}
        {!selectedPhoto && (
          <div style={{ textAlign: 'center', padding: '10px 0 24px', color: t.textMuted, fontSize: 13 }}>
            ↑ Select a photo above to start designing your graphic
          </div>
        )}

        {/* ── Section 2: Editor ────────────────────────────────────────────── */}
        {selectedPhoto && (
          <div ref={sectionTwoRef} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 20 }}>Design Your Overlay</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

              {/* Left — Preview */}
              <div>
                <div style={{ position: 'relative', background: t.cardBg, borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}` }}>
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
                        style={{ padding: '10px 8px', borderRadius: 8, border: `2px solid ${overlayStyle === s.id ? t.primary : t.border}`, background: overlayStyle === s.id ? t.primaryBg : t.cardBg, cursor: 'pointer', textAlign: 'center' }}>
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

                  {/* Prompt */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>What do you want this post to say?</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value.slice(0, 200))} maxLength={200}
                      placeholder="e.g. 'Tip about pruning trees in spring' or 'Emergency plumbing available 24/7'"
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg || t.cardBg, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'right', marginTop: 4 }}>{prompt.length}/200</div>
                  </div>
                  <Button onClick={handleFormat} disabled={formatting || !prompt.trim()} style={{ width: '100%', marginBottom: 16 }}>
                    <IpSparkle size={15} style={{ marginRight: 6 }} />
                    {formatting ? 'PostCore is writing...' : 'Format with PostCore — 1 credit'}
                  </Button>

                  <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '16px 0' }} />

                  {/* Editable fields */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 4 }}>Title</label>
                    <input value={title} onChange={e => { setTitle(e.target.value); setGeneratedUrl(null); }}
                      maxLength={80} placeholder="Main text (8 words max)"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg || t.cardBg, color: t.text, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 4 }}>Subtitle <span style={{ fontWeight: 400, color: t.textMuted }}>(optional)</span></label>
                    <input value={subtitle} onChange={e => { setSubtitle(e.target.value); setGeneratedUrl(null); }}
                      maxLength={120} placeholder="Secondary line or soft CTA"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg || t.cardBg, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  {error && <div style={{ background: '#fee', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

                  <Button onClick={handleGenerate} disabled={generating || !title.trim()} variant="primary" style={{ width: '100%', marginBottom: 12 }}>
                    {generating ? 'Creating your graphic...' : 'Generate Image'}
                  </Button>

                  {generatedUrl && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button onClick={handleDownload} variant="ghost" style={{ flex: 1 }}>
                        <IpDownload size={14} style={{ marginRight: 4 }} /> Download
                      </Button>
                      <Button onClick={() => { setCaption(''); setScheduleMode('now'); setPostModalOpen(true); }} style={{ flex: 1 }}>
                        <IpPublish size={14} style={{ marginRight: 4 }} /> Post Now
                      </Button>
                      <Button onClick={() => { setCaption(''); setScheduleMode('schedule'); setPostModalOpen(true); }} variant="ghost" style={{ flex: 1 }}>
                        <IpSchedule size={14} style={{ marginRight: 4 }} /> Schedule
                      </Button>
                      <Button onClick={() => { setCaption(''); setScheduleMode('draft'); setPostModalOpen(true); }} variant="ghost" style={{ flex: 1 }}>
                        <IpDrafts size={14} style={{ marginRight: 4 }} /> Save Draft
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 3: My Creations ──────────────────────────────────────── */}
        <div>
          <button onClick={toggleCreations} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>My Photo Studio Creations</h2>
            <span style={{ fontSize: 13, color: t.textMuted }}>{creationsOpen ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {creationsOpen && (
            creationsLoading ? (
              <div style={{ color: t.textMuted, fontSize: 14, padding: '20px 0' }}>Loading...</div>
            ) : creations.length === 0 ? (
              <EmptyState title="No creations yet" description="Select a stock photo above and generate your first graphic." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {creations.map(c => (
                  <div key={c.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.cardBg }}>
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
            )
          )}
        </div>
      </div>

      {/* ── Post Modal ───────────────────────────────────────────────────────── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: t.bg, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
                {scheduleMode === 'now' ? 'Post Now' : scheduleMode === 'schedule' ? 'Schedule Post' : 'Save as Draft'}
              </h3>
              <button onClick={() => setPostModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={20} /></button>
            </div>

            <label style={{ fontSize: 13, fontWeight: 600, color: t.text, display: 'block', marginBottom: 6 }}>Caption (optional)</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3}
              placeholder="Add a caption for this post..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg || t.cardBg, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg || t.cardBg, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {error && <div style={{ background: '#fee', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => setPostModalOpen(false)} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handlePost} disabled={posting} style={{ flex: 2 }}>
                {posting ? 'Saving...' : scheduleMode === 'now' ? 'Post Now' : scheduleMode === 'schedule' ? 'Schedule' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function PhotoCard({ photo, selected, onSelect, t }) {
  return (
    <div onClick={() => onSelect(photo)}
      style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${selected ? t.primary : t.border}`, transition: 'border-color 0.15s', background: t.cardBg, position: 'relative' }}>
      <img
        src={photo.thumbnail_url || photo.url}
        alt={photo.title || 'Stock photo'}
        loading="lazy"
        style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }}
      />
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: t.primary, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IpCheck size={14} style={{ color: '#fff' }} /></div>
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
