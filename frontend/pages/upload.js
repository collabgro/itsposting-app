import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish as UploadIcon, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpCalendar as CalendarIcon, IpSave, IpFacebook, IpInstagram, IpGoogle,
  IpLinkedIn, IpTikTok, IpFolderOpen, IpClose, IpSparkle, IpCheck, IpPlay,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Textarea, SectionHeader, Skeleton, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI, uploadAPI } from '../lib/api';
import {
  CHAR_LIMITS, PLATFORM_META, MOCKUP_MAP, PlatformTab,
} from '../components/PostMockups';

const CONTENT_TYPES = [
  { id: 'photo',    label: 'Photo',    icon: ImageIcon },
  { id: 'carousel', label: 'Carousel', icon: IpCarousel },
  { id: 'video',    label: 'Video',    icon: IpVideo },
];

const PLATFORMS = [
  { id: 'facebook',        name: 'Facebook',         icon: IpFacebook },
  { id: 'instagram',       name: 'Instagram',        icon: IpInstagram },
  { id: 'linkedin',        name: 'LinkedIn',         icon: IpLinkedIn },
  { id: 'tiktok',          name: 'TikTok',           icon: IpTikTok },
  { id: 'google_business', name: 'Google Business',  icon: IpGoogle },
];
const ALL_PLATFORM_IDS = PLATFORMS.map(p => p.id);

const TIME_SLOTS = [
  { label: '8 AM',  value: '08:00' },
  { label: '9 AM',  value: '09:00' },
  { label: '10 AM', value: '10:00' },
  { label: '12 PM', value: '12:00' },
  { label: '1 PM',  value: '13:00' },
  { label: '3 PM',  value: '15:00' },
  { label: '5 PM',  value: '17:00' },
  { label: '6 PM',  value: '18:00' },
];

export default function Upload() {
  const router = useRouter();
  const { t } = useTheme();
  const fileInputRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [contentType, setContentType] = useState('photo');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);
  const [previewPlatform, setPreviewPlatform] = useState('facebook');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleMode, setScheduleMode] = useState('draft');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryFolder, setLibraryFolder] = useState(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const { scheduleDate: qDate } = router.query;
    if (qDate) {
      setScheduleDate(qDate);
      setScheduleMode('scheduled');
    }
  }, [router.isReady]);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (!localStorage.getItem('token')) { router.replace('/login'); return; }

    const preSelected = sessionStorage.getItem('selectedMediaFile');
    if (preSelected) {
      try {
        const file = JSON.parse(preSelected);
        setContentType(file.file_type === 'video' ? 'video' : 'photo');
        setPreviews([file.url]);
        setFiles([{ libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
        sessionStorage.removeItem('selectedMediaFile');
      } catch {}
    }
    const quickPostData = sessionStorage.getItem('quickPostData');
    if (quickPostData) {
      try {
        const data = JSON.parse(quickPostData);
        if (data.caption) setCaption(data.caption);
        if (data.hashtags?.length) setHashtags(data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '));
        if (data.platforms?.length) setPlatforms(data.platforms.filter(p => p !== 'all'));
        sessionStorage.removeItem('quickPostData');
      } catch {}
    }
    const wizardPost = sessionStorage.getItem('wizardPost');
    if (wizardPost) {
      try {
        const data = JSON.parse(wizardPost);
        if (data.caption) setCaption(data.caption);
        if (data.hashtags?.length) setHashtags(data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '));
        if (data.platform) setPlatforms([data.platform]);
        sessionStorage.removeItem('wizardPost');
      } catch {}
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keep previewPlatform in sync with selected platforms
  useEffect(() => {
    if (!platforms.includes(previewPlatform)) {
      setPreviewPlatform(platforms[0] || 'facebook');
    }
  }, [platforms]);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    if (contentType === 'photo' && selected.length > 1) { setMessage({ type: 'error', text: 'Photo posts allow only 1 image' }); return; }
    if (contentType === 'video' && selected.length > 1) { setMessage({ type: 'error', text: 'Video posts allow only 1 video' }); return; }
    if (contentType === 'carousel' && selected.length > 10) { setMessage({ type: 'error', text: 'Carousel max is 10 images' }); return; }
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
    setMessage({ type: '', text: '' });
  };

  const removeFile = (idx) => {
    const url = previews[idx];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const openLibrary = async () => {
    setShowLibrary(true);
    setLibraryLoading(true);
    setLibraryFolder(null);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        mediaAPI.list({ type: contentType === 'video' ? 'video' : 'image' }),
        mediaAPI.getFolders(),
      ]);
      setLibraryFiles(filesRes.data);
      setLibraryFolders(foldersRes.data);
    } catch {}
    finally { setLibraryLoading(false); }
  };

  const selectFromLibrary = (file) => {
    if (contentType === 'carousel') {
      if (files.length >= 10) { setMessage({ type: 'error', text: 'Carousel max is 10 files' }); return; }
      setFiles(prev => [...prev, { libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
      setPreviews(prev => [...prev, file.url]);
    } else {
      setFiles([{ libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
      setPreviews([file.url]);
      setShowLibrary(false);
    }
  };

  const togglePlatform = (id) => {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleAllPlatforms = () => {
    setPlatforms(platforms.length === ALL_PLATFORM_IDS.length ? [] : [...ALL_PLATFORM_IDS]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) { setMessage({ type: 'error', text: 'Please select at least one file' }); return; }
    if (contentType === 'carousel' && files.length < 2) { setMessage({ type: 'error', text: 'Carousel needs at least 2 images' }); return; }
    if (!caption.trim()) { setMessage({ type: 'error', text: 'Caption is required' }); return; }
    if (platforms.length === 0) { setMessage({ type: 'error', text: 'Select at least one platform' }); return; }
    if (scheduleMode === 'later' && !scheduleDate) { setMessage({ type: 'error', text: 'Pick a date to schedule' }); return; }

    const scheduledDateTime = scheduleMode === 'later' && scheduleDate
      ? `${scheduleDate}T${scheduleTime}:00` : null;

    setUploading(true);
    setMessage({ type: 'info', text: 'Uploading files...' });

    try {
      let mediaUrl = null;
      let mediaUrls = null;
      const isLibraryFile = files[0]?.libraryFileId !== undefined;

      if (isLibraryFile) {
        if (contentType === 'carousel') mediaUrls = files.map(f => f.url);
        else mediaUrl = files[0].url;
        await Promise.all(files.filter(f => f.libraryFileId).map(f => mediaAPI.markUsed(f.libraryFileId)));
      } else if (contentType === 'carousel') {
        const { data: carouselData } = await uploadAPI.uploadCarousel(files);
        mediaUrls = carouselData.slides.map(s => s.url);
      } else {
        const { data: mediaData } = await uploadAPI.uploadMedia(files[0]);
        mediaUrl = mediaData.url;
      }

      setMessage({ type: 'info', text: 'Creating post...' });
      const hashtagArr = hashtags.split(/[\s,]+/).map(h => h.trim().replace(/^#/, '')).filter(Boolean);
      const { data: postData } = await uploadAPI.createPost({
        contentType, mediaUrl, mediaUrls, caption, hashtags: hashtagArr,
        platforms, scheduledDate: scheduledDateTime,
        publishNow: scheduleMode === 'now',
      });
      let successMsg, msgType = 'success';
      if (scheduleMode === 'now') {
        const r = postData.publishResult;
        const succeeded = Object.keys(r?.platformPostIds || {});
        const failed = r?.errors || [];
        if (succeeded.length === 0 && failed.length > 0) {
          msgType = 'error';
          successMsg = 'Publish failed: ' + failed.map(e => `${e.platform}: ${e.message}`).join('; ');
        } else if (succeeded.length > 0 && failed.length > 0) {
          successMsg = `Published to ${succeeded.join(', ')}. Failed: ${failed.map(e => e.platform).join(', ')}.`;
        } else if (succeeded.length > 0) {
          successMsg = `Published to ${succeeded.join(', ')}!`;
        } else {
          successMsg = 'Published successfully!';
        }
      } else {
        successMsg = 'Scheduled! · 0 credits used';
      }
      setMessage({ type: msgType, text: successMsg });
      setTimeout(() => {
        setFiles([]); setPreviews([]); setCaption(''); setHashtags('');
        setScheduleDate(''); setMessage({ type: '', text: '' });
        router.push('/calendar');
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  if (!mounted) return null;

  // ── computed ──────────────────────────────────────────────────────────────
  const allSelected = platforms.length === ALL_PLATFORM_IDS.length;
  const charLimit = CHAR_LIMITS[previewPlatform] || 63206;

  const scheduledPreview = scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      + ' at ' + new Date(`${scheduleDate}T${scheduleTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  const quickDates = (() => {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const result = [
      { label: 'Today',    value: fmt(today) },
      { label: 'Tomorrow', value: (() => { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); })() },
    ];
    for (let i = 2; i <= 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      result.push({ label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), value: fmt(d) });
    }
    return result;
  })();

  const libFolderNamesSet = new Set(libraryFolders.map(f => f.folder));
  const looseLibraryFiles = libraryFiles.filter(f => !f.folder || !libFolderNamesSet.has(f.folder));
  const folderLibraryFiles = libraryFolder ? libraryFiles.filter(f => f.folder === libraryFolder) : [];

  const msgStyle = {
    error:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  color: t.error },
    success: { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  color: t.success },
    info:    { bg: t.primaryBg,            border: t.primaryBorder,        color: t.primary },
  };

  const chipStyle = (active) => ({
    padding: '6px 13px', borderRadius: 8,
    border: `1.5px solid ${active ? t.primary : t.border}`,
    background: active ? t.primaryBg : t.input,
    color: active ? t.text : t.textMuted,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  // Live preview post object (synthetic — drives mockup)
  const hashtagArr = hashtags.split(/[\s,]+/).map(h => h.trim().replace(/^#/, '')).filter(Boolean);
  const previewPost = {
    content_type: contentType,
    media_url: previews[0] || null,
    media_urls: previews,
    hashtags: hashtagArr,
    platforms,
    caption,
  };

  const ActiveMockup = MOCKUP_MAP[previewPlatform];

  const submitLabel = uploading ? 'Saving…'
    : scheduleMode === 'later' ? 'Schedule Post'
    : scheduleMode === 'now'   ? 'Publish Now'
    : 'Save Draft';

  const renderLibraryGrid = (fileList) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {fileList.map(file => (
        <button
          key={file.id} type="button"
          onClick={() => selectFromLibrary(file)}
          style={{ background: t.input, border: `2px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, position: 'relative', transition: 'border-color 150ms' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = t.primary}
          onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
        >
          <div style={{ aspectRatio: '1/1', overflow: 'hidden', position: 'relative' }}>
            {file.file_type === 'video' ? (
              <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={file.url} alt={file.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {file.file_type === 'video' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                <IpPlay size={26} color="white" />
              </div>
            )}
          </div>
          <div style={{ padding: '7px 8px', borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</div>
            {file.file_size_bytes > 0 && (
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>
                {(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <Layout
      title="Upload"
      subtitle="Upload your own content"
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => router.push('/wizard')}>
            <IpSparkle size={14} color="url(#brand-gradient)" /> Post Wizard
          </Button>
          <Button variant="secondary" onClick={() => router.push('/calendar')}>View Calendar</Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>

        {message.text && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgStyle[message.type]?.bg, border: `1px solid ${msgStyle[message.type]?.border}`, color: msgStyle[message.type]?.color }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

            {/* ══ LEFT — Compose ══════════════════════════════════════════════ */}
            <div style={{ flex: '0 0 46%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Post to — platform selector */}
              <Card>
                <SectionHeader icon={IpFacebook} title="Post to" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PLATFORMS.map(({ id, name, icon: PlatIcon }) => {
                    const sel = platforms.includes(id);
                    const meta = PLATFORM_META[id];
                    return (
                      <button
                        key={id} type="button" onClick={() => togglePlatform(id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                          border: `1.5px solid ${sel ? meta.color : t.border}`,
                          background: sel ? `${meta.color}15` : t.input,
                          transition: 'all 150ms',
                        }}
                      >
                        <PlatIcon size={14} style={{ color: sel ? meta.color : t.textMuted, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: sel ? t.text : t.textMuted }}>{name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button" onClick={toggleAllPlatforms}
                    style={{
                      padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${allSelected ? t.primary : t.border}`,
                      background: allSelected ? t.primaryBg : t.input,
                      fontSize: 12, fontWeight: 700,
                      color: allSelected ? t.primary : t.textMuted,
                      transition: 'all 150ms',
                    }}
                  >
                    All
                  </button>
                </div>
                {platforms.length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: t.error }}>Select at least one platform</div>
                )}
              </Card>

              {/* Caption + Hashtags */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caption</label>
                  <span style={{ fontSize: 11, color: caption.length > charLimit ? t.error : t.textMuted, fontWeight: caption.length > charLimit ? 700 : 400 }}>
                    {caption.length.toLocaleString()} / {charLimit.toLocaleString()}
                  </span>
                </div>
                <Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption…" rows={7} />
                <div style={{ marginTop: 10 }}>
                  <Input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#social #marketing #yourcity" />
                </div>
              </Card>

              {/* Media */}
              <Card>
                <SectionHeader icon={UploadIcon} title="Media" />

                {/* Content type compact buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {CONTENT_TYPES.map(opt => (
                    <button
                      key={opt.id} type="button"
                      onClick={() => { setContentType(opt.id); setFiles([]); setPreviews([]); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${contentType === opt.id ? t.primary : t.border}`,
                        background: contentType === opt.id ? t.primaryBg : t.input,
                        transition: 'all 150ms',
                      }}
                    >
                      <opt.icon size={15} color={contentType === opt.id ? 'url(#brand-gradient)' : t.textMuted} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: contentType === opt.id ? t.text : t.textMuted }}>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Upload buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: previews.length > 0 ? 14 : 0, flexWrap: 'wrap' }}>
                  <button
                    type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ flex: '1 1 160px', padding: 12, background: t.input, border: `2px dashed ${t.borderStrong}`, borderRadius: 8, color: t.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <UploadIcon size={15} /> Upload from device
                  </button>
                  <button
                    type="button" onClick={openLibrary}
                    style={{ flex: '1 1 160px', padding: 12, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <IpFolderOpen size={15} /> Choose from library
                  </button>
                </div>
                <input
                  ref={fileInputRef} type="file"
                  accept={contentType === 'video' ? 'video/*' : 'image/*'}
                  multiple={contentType === 'carousel'}
                  onChange={handleFileSelect} style={{ display: 'none' }}
                />

                {/* Preview grid */}
                {previews.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                    {previews.map((url, idx) => (
                      <div key={idx} style={{ aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, position: 'relative' }}>
                        {contentType === 'video'
                          ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                          : <img src={url} alt={`preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        }
                        {files[idx]?.libraryFileId && (
                          <div style={{ position: 'absolute', bottom: 4, left: 4, padding: '2px 6px', background: 'rgba(124,92,252,0.9)', borderRadius: 4, fontSize: 9, color: '#fff', fontWeight: 600 }}>LIB</div>
                        )}
                        <button
                          type="button" onClick={() => removeFile(idx)}
                          style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, padding: 0 }}
                        >
                          <IpClose size={9} />
                        </button>
                      </div>
                    ))}
                    {contentType === 'carousel' && files.length < 10 && (
                      <button
                        type="button" onClick={openLibrary}
                        style={{ aspectRatio: '1/1', borderRadius: 8, background: t.input, border: `2px dashed ${t.border}`, color: t.textMuted, fontSize: 24, fontWeight: 300, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    )}
                  </div>
                )}
                {contentType === 'carousel' && files.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{files.length} / 10 images</span>
                    {files.length < 2 && <span style={{ color: t.warning }}>— need at least 2</span>}
                  </div>
                )}
              </Card>

              {/* Schedule */}
              <Card>
                <SectionHeader icon={CalendarIcon} title="When to Post" />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: scheduleMode === 'later' ? 18 : 0 }}>
                  <Button type="button" variant={scheduleMode === 'draft' ? 'primary' : 'secondary'} onClick={() => setScheduleMode('draft')}>
                    Save as Draft
                  </Button>
                  <Button type="button" variant={scheduleMode === 'now' ? 'primary' : 'secondary'} onClick={() => setScheduleMode('now')}>
                    Publish Now
                  </Button>
                  <Button type="button" variant={scheduleMode === 'later' ? 'primary' : 'secondary'} onClick={() => setScheduleMode('later')}>
                    Schedule for Later
                  </Button>
                </div>

                {scheduleMode === 'later' && (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Date</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {quickDates.map(qd => (
                          <button key={qd.value} type="button" onClick={() => setScheduleDate(qd.value)} style={chipStyle(scheduleDate === qd.value)}>
                            {qd.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: scheduledPreview ? 12 : 0 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Time</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {TIME_SLOTS.map(ts => (
                          <button key={ts.value} type="button" onClick={() => setScheduleTime(ts.value)} style={chipStyle(scheduleTime === ts.value)}>
                            {ts.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                        style={{ padding: '8px 12px', background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: 8, color: t.text, fontSize: 13 }}
                      />
                    </div>
                    {scheduledPreview && (
                      <div style={{ padding: '10px 14px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, fontSize: 13, color: t.primary, fontWeight: 600 }}>
                        📅 Scheduled for {scheduledPreview}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={uploading || platforms.length === 0}>
                  {submitLabel}
                </Button>
              </div>
            </div>

            {/* ══ RIGHT — Live Preview ════════════════════════════════════════ */}
            <div style={{ flex: 1, minWidth: 0, position: isMobile ? 'static' : 'sticky', top: 20 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Post Preview</div>

                {/* Platform tabs — only selected platforms */}
                {platforms.length > 0 ? (
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
                    {platforms.filter(pid => MOCKUP_MAP[pid]).map(pid => (
                      <PlatformTab key={pid} pid={pid} isActive={previewPlatform === pid} onClick={setPreviewPlatform} t={t} />
                    ))}
                  </div>
                ) : (
                  <div style={{ marginBottom: 16, fontSize: 12, color: t.textMuted }}>Select platforms on the left to preview</div>
                )}

                {/* Mockup area */}
                <div style={{ background: t.bg || '#0A0A0F', borderRadius: 10, padding: 20, minHeight: 280 }}>
                  {ActiveMockup && (caption || previews.length > 0) ? (
                    <ActiveMockup post={previewPost} caption={caption} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 12, textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: t.input, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IpSave size={20} color={t.textMuted} />
                      </div>
                      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
                        Start typing your caption or<br />upload media to see a preview
                      </div>
                    </div>
                  )}
                </div>

                {/* Char limit note for active preview platform */}
                {platforms.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted, textAlign: 'right' }}>
                    {PLATFORM_META[previewPlatform]?.label} · {charLimit.toLocaleString()} char limit
                  </div>
                )}
              </Card>
            </div>

          </div>
        </form>
      </div>

      {/* ─── Media Library Modal ─── */}
      {showLibrary && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowLibrary(false)}
        >
          <div
            style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Choose from Library</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {contentType === 'carousel'
                    ? `Click files to add them — ${files.length} / 10 selected`
                    : 'Click a file to select it'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {contentType === 'carousel' && files.length > 0 && (
                  <Button variant="primary" size="sm" onClick={() => setShowLibrary(false)}>
                    Done ({files.length} selected)
                  </Button>
                )}
                <button
                  onClick={() => setShowLibrary(false)}
                  style={{ width: 30, height: 30, background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IpClose size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {libraryLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={130} borderRadius={10} />)}
                </div>
              ) : libraryFolder !== null ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <button
                      type="button" onClick={() => setLibraryFolder(null)}
                      style={{ padding: '5px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 7, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >← All Files</button>
                    <IpFolderOpen size={15} color={t.primary} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{libraryFolder}</span>
                    <span style={{ fontSize: 12, color: t.textMuted }}>· {folderLibraryFiles.length} {folderLibraryFiles.length === 1 ? 'file' : 'files'}</span>
                  </div>
                  {folderLibraryFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: t.textMuted, fontSize: 13 }}>No files in this folder</div>
                  ) : renderLibraryGrid(folderLibraryFiles)}
                </>
              ) : (
                <>
                  {libraryFolders.length > 0 && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 8 }}>
                        {libraryFolders.map(f => (
                          <div
                            key={f.folder}
                            onClick={() => setLibraryFolder(f.folder)}
                            style={{ background: t.input, border: `2px solid ${t.border}`, borderRadius: 10, cursor: 'pointer', padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 90, transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.background = t.primaryBg; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.input; }}
                          >
                            <IpFolderOpen size={28} color={t.primary} />
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{f.folder}</div>
                              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{f.count} {f.count === 1 ? 'file' : 'files'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                        <div style={{ flex: 1, height: 1, background: t.border }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Files{looseLibraryFiles.length > 0 ? ` · ${looseLibraryFiles.length}` : ''}
                        </span>
                        <div style={{ flex: 1, height: 1, background: t.border }} />
                      </div>
                    </>
                  )}
                  {looseLibraryFiles.length === 0 && libraryFolders.length === 0 ? (
                    <EmptyState
                      icon={IpFolderOpen}
                      title="Your media library is empty"
                      subtitle="Upload files to your library first, then you can reuse them here."
                    />
                  ) : looseLibraryFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: t.textMuted, fontSize: 13 }}>
                      All files are organised into folders above
                    </div>
                  ) : renderLibraryGrid(looseLibraryFiles)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

