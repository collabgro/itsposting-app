import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPublish as UploadIcon, IpPhoto as ImageIcon, IpCarousel, IpVideo,
  IpCalendar as CalendarIcon, IpSave, IpFacebook, IpInstagram, IpGoogle,
  IpCredits, IpFolderOpen, IpClose, IpLoader, IpSparkle,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Textarea, SectionHeader, Badge } from '../components/ui';
import { useTheme } from '../lib/theme';
import { mediaAPI } from '../lib/api';
import ContentCreatorModal from '../components/ContentCreatorModal';

const CONTENT_TYPES = [
  { id: 'photo', label: 'Photo', icon: ImageIcon, desc: '1 image' },
  { id: 'carousel', label: 'Carousel', icon: IpCarousel, desc: '2-10 images' },
  { id: 'video', label: 'Video', icon: IpVideo, desc: '1 video' },
];

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: IpFacebook },
  { id: 'instagram', name: 'Instagram', icon: IpInstagram },
  { id: 'google_business', name: 'Business Profile', icon: IpGoogle },
];

export default function Upload() {
  const router = useRouter();
  const { t } = useTheme();
  const fileInputRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [contentType, setContentType] = useState('photo');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [platforms, setPlatforms] = useState(['facebook', 'instagram']);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  useEffect(() => {
    setMounted(true);
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
  }, []);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    if (contentType === 'photo' && selected.length > 1) { setMessage({ type: 'error', text: 'Photo posts allow only 1 image' }); return; }
    if (contentType === 'video' && selected.length > 1) { setMessage({ type: 'error', text: 'Video posts allow only 1 video' }); return; }
    if (contentType === 'carousel' && (selected.length < 2 || selected.length > 10)) { setMessage({ type: 'error', text: 'Carousel needs 2-10 images' }); return; }
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
    setMessage({ type: '', text: '' });
  };

  const openLibrary = async () => {
    setShowLibrary(true);
    setLibraryLoading(true);
    try {
      const res = await mediaAPI.list({ type: contentType === 'video' ? 'video' : 'image' });
      setLibraryFiles(res.data);
    } catch {}
    finally { setLibraryLoading(false); }
  };

  const selectFromLibrary = (file) => {
    if (contentType === 'carousel') {
      if (files.length >= 10) { setMessage({ type: 'error', text: 'Carousel max is 10 files' }); return; }
      setFiles([...files, { libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
      setPreviews([...previews, file.url]);
    } else {
      setFiles([{ libraryFileId: file.id, url: file.url, type: file.file_type, name: file.file_name }]);
      setPreviews([file.url]);
    }
    setShowLibrary(false);
  };

  const togglePlatform = (id) => {
    setPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) { setMessage({ type: 'error', text: 'Please select at least one file' }); return; }
    if (!caption.trim()) { setMessage({ type: 'error', text: 'Caption is required' }); return; }
    if (platforms.length === 0) { setMessage({ type: 'error', text: 'Select at least one platform' }); return; }
    if (scheduleMode === 'later' && !scheduledDate) { setMessage({ type: 'error', text: 'Pick a date and time to schedule' }); return; }

    setUploading(true);
    setMessage({ type: 'info', text: 'Uploading files...' });
    const token = localStorage.getItem('token');

    try {
      let mediaUrl = null;
      let mediaUrls = null;
      const isLibraryFile = files[0]?.libraryFileId !== undefined;

      if (isLibraryFile) {
        if (contentType === 'carousel') mediaUrls = files.map((f) => f.url);
        else mediaUrl = files[0].url;
        await Promise.all(files.filter((f) => f.libraryFileId).map((f) => mediaAPI.markUsed(f.libraryFileId)));
      } else if (contentType === 'carousel') {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        const res = await fetch('/api/upload/carousel', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
        mediaUrls = (await res.json()).slides.map((s) => s.url);
      } else {
        const formData = new FormData();
        formData.append('file', files[0]);
        const res = await fetch('/api/upload/media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
        mediaUrl = (await res.json()).url;
      }

      setMessage({ type: 'info', text: 'Creating post...' });
      const hashtagArr = hashtags.split(/[\s,]+/).map((h) => h.trim().replace(/^#/, '')).filter(Boolean);
      const postRes = await fetch('/api/upload/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType, mediaUrl, mediaUrls, caption, hashtags: hashtagArr, platforms, scheduledDate: scheduleMode === 'later' ? scheduledDate : null }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Post creation failed');
      setMessage({ type: 'success', text: postData.message + ' · 0 credits used' });
      setTimeout(() => {
        setFiles([]); setPreviews([]); setCaption(''); setHashtags(''); setScheduledDate(''); setMessage({ type: '', text: '' });
        router.push('/calendar');
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  if (!mounted) return null;

  const msgStyle = {
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: t.error },
    success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: t.success },
    info: { bg: t.primaryBg, border: t.primaryBorder, color: t.primary },
  };

  return (
    <Layout title="Create Post" subtitle="Upload your own content" action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => setShowAIModal(true)}><IpSparkle size={14} style={{ color: t.primary }} /> Create</Button><Button variant="secondary" onClick={() => router.push('/calendar')}>View Calendar</Button></div>}>
      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div style={{ padding: '14px 18px', background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <IpSparkle size={18} style={{ color: t.primary }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Generate content instead</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Use credits to auto-generate captions, images, carousels, or videos</div>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAIModal(true)}><IpSparkle size={14} /> Open Creator</Button>
        </div>
        {message.text && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msgStyle[message.type]?.bg, border: `1px solid ${msgStyle[message.type]?.border}`, color: msgStyle[message.type]?.color }}>{message.text}</div>}
        <form onSubmit={handleSubmit}>
          <Card style={{ marginBottom: 16 }}><SectionHeader icon={UploadIcon} title="Content Type" /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>{CONTENT_TYPES.map((opt) => <button key={opt.id} type="button" onClick={() => { setContentType(opt.id); setFiles([]); setPreviews([]); }} style={{ padding: 16, border: `2px solid ${contentType === opt.id ? t.primary : t.border}`, background: contentType === opt.id ? t.primaryBg : t.input, borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}><opt.icon size={20} strokeWidth={2} style={{ color: contentType === opt.id ? t.primary : t.textMuted, margin: '0 auto 6px' }} /><div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{opt.label}</div><div style={{ fontSize: 11, color: t.textMuted }}>{opt.desc}</div></button>)}</div></Card>
          <Card style={{ marginBottom: 16 }}><SectionHeader icon={ImageIcon} title={`Upload ${contentType === 'carousel' ? 'Files (2-10)' : 'File'}`} /><div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}><button type="button" onClick={() => fileInputRef.current?.click()} style={{ flex: '1 1 220px', padding: 14, background: t.input, border: `2px dashed ${t.borderStrong}`, borderRadius: 8, color: t.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><UploadIcon size={16} strokeWidth={2} /> Upload from device</button><button type="button" onClick={openLibrary} style={{ flex: '1 1 220px', padding: 14, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 8, color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IpFolderOpen size={16} strokeWidth={2} /> Choose from library</button></div><input ref={fileInputRef} type="file" accept={contentType === 'video' ? 'video/*' : 'image/*'} multiple={contentType === 'carousel'} onChange={handleFileSelect} style={{ display: 'none' }} />{previews.length > 0 && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>{previews.map((url, idx) => <div key={idx} style={{ aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: t.input, border: `1px solid ${t.border}`, position: 'relative' }}>{contentType === 'video' ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls /> : <img src={url} alt={`preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}{files[idx]?.libraryFileId && <div style={{ position: 'absolute', bottom: 4, right: 4, padding: '2px 6px', background: 'rgba(124,92,252,0.9)', borderRadius: 4, fontSize: 9, color: '#fff', fontWeight: 600 }}>LIB</div>}</div>)}</div>}</Card>
          <Card style={{ marginBottom: 16 }}><SectionHeader icon={IpSave} title="Caption & Hashtags" /><div style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}><label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caption</label></div><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." rows={5} /></div><div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Hashtags</label><Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#social #marketing" /></div></Card>
          <Card style={{ marginBottom: 16 }}><SectionHeader icon={CalendarIcon} title="Schedule" /><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Button type="button" variant={scheduleMode === 'now' ? 'primary' : 'secondary'} onClick={() => setScheduleMode('now')}>Save as draft</Button><Button type="button" variant={scheduleMode === 'later' ? 'primary' : 'secondary'} onClick={() => setScheduleMode('later')}>Schedule</Button></div>{scheduleMode === 'later' && <div style={{ marginTop: 12 }}><Input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>}</Card>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}><Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>Cancel</Button><Button type="submit" variant="primary" disabled={uploading}>{uploading ? 'Publishing...' : 'Publish'}</Button></div>
        </form>
      </div>
      {showAIModal && <ContentCreatorModal onClose={() => setShowAIModal(false)} onSuccess={() => { setShowAIModal(false); router.push('/history'); }} />}
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
