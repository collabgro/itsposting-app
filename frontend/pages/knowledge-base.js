import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpPlus, IpDelete, IpCheck, IpWarning, IpSave, IpRefresh,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Textarea } from '../components/ui';
import { useTheme } from '../lib/theme';

export default function KnowledgeBase() {
  const router = useRouter();
  const { t }  = useTheme();

  const [mounted,            setMounted]            = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [saved,              setSaved]              = useState(false);
  const [importing,          setImporting]          = useState(false);
  const [importingWebsite,   setImportingWebsite]   = useState(false);
  const [importBanner,       setImportBanner]       = useState(null);
  const [importToast,        setImportToast]        = useState(null);
  const [importWebsiteError, setImportWebsiteError] = useState('');
  const [data, setData] = useState({
    services:        [],
    reviews:         '',
    differentiators: '',
    faqs:            [],
    team:            [],
  });

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const token = localStorage.getItem('token');

    fetch('/api/knowledge', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(kb => {
        if (!kb || kb.error) return;
        const merged = { services: [], reviews: '', differentiators: '', faqs: [], team: [] };
        (kb.items || []).forEach(item => {
          if      (item.knowledge_type === 'reviews')         merged.reviews         = item.content;
          else if (item.knowledge_type === 'differentiators') merged.differentiators = item.content;
          else if (item.knowledge_type === 'services')        merged.services.push(JSON.parse(item.content));
          else if (item.knowledge_type === 'faqs')            merged.faqs.push(item.content);
          else if (item.knowledge_type === 'team')            merged.team.push(JSON.parse(item.content));
        });
        setData(merged);
      })
      .catch(() => {});

    // Show auto-import banner if cached scrape data already exists
    fetch('/api/knowledge/scrape-preview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(preview => { if (preview?.hasData) setImportBanner(preview); })
      .catch(() => {});
  }, []);

  // Core import logic — accepts data directly so it works from both banner and header button
  const applyImportData = (importData) => {
    let reviewsAdded = 0;
    setData(prev => {
      const existingNames = new Set(prev.services.map(s => s.name.toLowerCase().trim()));
      const newServices = (importData.services || []).filter(
        s => s.name?.trim() && !existingNames.has(s.name.toLowerCase().trim())
      );
      const formattedReviews = (importData.testimonials || [])
        .filter(t => t.text && t.text.length > 20)
        .slice(0, 2)
        .map(t => `"${t.text}"${t.author ? ` — ${t.author}` : ''}`)
        .join('\n\n');
      reviewsAdded = formattedReviews ? 1 : 0;
      return {
        ...prev,
        services: [...prev.services, ...newServices],
        differentiators: prev.differentiators.trim() ? prev.differentiators : (importData.differentiators || prev.differentiators),
        reviews: prev.reviews.trim() ? prev.reviews : (formattedReviews || prev.reviews),
      };
    });
    const svcCount = (importData.services || []).length;
    const parts = [`${svcCount} service${svcCount !== 1 ? 's' : ''}`];
    if (reviewsAdded) parts.push('2 reviews');
    setImportToast(`Imported ${parts.join(' + ')} from ${importData.website || 'your website'}`);
    setTimeout(() => setImportToast(null), 3500);
  };

  // Import from the auto-detected banner (existing cached data)
  const handleImport = () => {
    if (!importBanner) return;
    setImporting(true);
    applyImportData(importBanner);
    setImportBanner(null);
    setTimeout(() => setImporting(false), 3500);
  };

  // Import triggered by the header button — uses cache or triggers a fresh scrape, then auto-saves
  const handleImportFromWebsite = async () => {
    setImportingWebsite(true);
    setImportWebsiteError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/knowledge/import-website', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const importData = await res.json();
      if (!res.ok) throw new Error(importData.error || 'Import failed');
      if (importData.noWebsite) {
        setImportWebsiteError('No website URL saved — add it in Settings first.');
        return;
      }

      // Compute merged data synchronously so we can update state + save in one shot
      const existingNames = new Set(data.services.map(s => s.name.toLowerCase().trim()));
      const newServices = (importData.services || []).filter(
        s => s.name?.trim() && !existingNames.has(s.name.toLowerCase().trim())
      );
      const formattedReviews = (importData.testimonials || [])
        .filter(t => t.text && t.text.length > 20)
        .slice(0, 2)
        .map(t => `"${t.text}"${t.author ? ` — ${t.author}` : ''}`)
        .join('\n\n');

      const mergedData = {
        ...data,
        services:        [...data.services, ...newServices],
        differentiators: data.differentiators.trim() ? data.differentiators : (importData.differentiators || data.differentiators),
        reviews:         data.reviews.trim()         ? data.reviews         : (formattedReviews            || data.reviews),
      };

      setData(mergedData);
      setImportBanner(null);

      // Auto-save immediately
      await fetch('/api/knowledge/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(mergedData),
      });

      const svcCount = newServices.length;
      const parts = [`${svcCount} service${svcCount !== 1 ? 's' : ''}`];
      if (formattedReviews) parts.push('reviews');
      setImportToast(`Imported & saved ${parts.join(' + ')} from ${importData.website || 'your website'}`);
      setTimeout(() => setImportToast(null), 3500);
    } catch (err) {
      setImportWebsiteError(err.message);
    } finally {
      setImportingWebsite(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/knowledge/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const score = [
    data.services.length > 0,
    data.reviews.trim().length > 50,
    data.differentiators.trim().length > 20,
    data.faqs.length > 0,
  ].filter(Boolean).length;
  const pct = Math.round((score / 4) * 100);

  if (!mounted) return null;

  const addService    = () => setData(d => ({ ...d, services: [...d.services, { name: '', description: '', priceRange: '' }] }));
  const addFaq        = () => setData(d => ({ ...d, faqs: [...d.faqs, ''] }));
  const addTeam       = () => setData(d => ({ ...d, team: [...d.team, { name: '', role: '' }] }));
  const removeService = i  => setData(d => ({ ...d, services: d.services.filter((_, idx) => idx !== i) }));
  const removeFaq     = i  => setData(d => ({ ...d, faqs: d.faqs.filter((_, idx) => idx !== i) }));
  const removeTeam    = i  => setData(d => ({ ...d, team: d.team.filter((_, idx) => idx !== i) }));

  const SaveIcon  = saved ? IpCheck : IpSave;
  const saveLabel = saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes';

  return (
    <Layout
      title="Teach PostCore"
      subtitle="The more PostCore knows, the better every post it creates for you"
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" onClick={handleImportFromWebsite} disabled={importingWebsite || saving}>
            {importingWebsite
              ? <><img src="/icon-192.png" alt="" style={{ width: 13, height: 13, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle', marginRight: 6 }} />Importing…</>
              : <><IpRefresh size={14} /> Import from website</>
            }
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <img src="/icon-192.png" alt="" style={{ width: 14, height: 14, borderRadius: 3, animation: 'logo-pulse 1.2s ease-in-out infinite', verticalAlign: 'middle' }} />
              : <SaveIcon size={14} />
            }
            {saveLabel}
          </Button>
        </div>
      }
    >
      {/* Import success toast */}
      {importToast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IpCheck size={15} color="#fff" /> {importToast}
        </div>
      )}

      {/* Auto-detected import banner (shown when cached scrape data found on load) */}
      {importBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px', background: 'rgba(124,92,252,0.08)', border: `1px solid rgba(124,92,252,0.25)`, borderRadius: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>
              Website Intelligence found {importBanner.services.length} service{importBanner.services.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 12, color: t.textMuted }}>
              From {importBanner.website || 'your website'} — import to pre-fill your knowledge base, then edit as needed
            </div>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            <IpRefresh size={13} color="#fff" /> Import from website
          </button>
        </div>
      )}

      {/* Import error */}
      {importWebsiteError && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#EF4444', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {importWebsiteError}
          <button onClick={() => setImportWebsiteError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Completeness bar */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Knowledge base: {pct}% complete</div>
          {pct < 100 && <div style={{ fontSize: 12, color: t.textMuted }}>Complete to unlock expert-level posts</div>}
        </div>
        <div style={{ height: 8, background: t.input, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? t.success : t.primary, borderRadius: 4, transition: 'width 400ms ease' }} />
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Services */}
        <KnowledgeCard t={t} title="Your Services" status={data.services.length > 0 ? 'done' : 'empty'} description="PostCore references these in every generated post — so captions mention your actual services, not generic ones.">
          {data.services.map((svc, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <Input placeholder="Service name" value={svc.name} onChange={e => setData(d => { const s = [...d.services]; s[i] = { ...s[i], name: e.target.value }; return { ...d, services: s }; })} />
              <Input placeholder="Short description (optional)" value={svc.description} onChange={e => setData(d => { const s = [...d.services]; s[i] = { ...s[i], description: e.target.value }; return { ...d, services: s }; })} />
              <Input placeholder="Price range e.g. $200–500" value={svc.priceRange} onChange={e => setData(d => { const s = [...d.services]; s[i] = { ...s[i], priceRange: e.target.value }; return { ...d, services: s }; })} />
              <button onClick={() => removeService(i)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <IpDelete size={13} />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addService}><IpPlus size={13} /> Add Service</Button>
        </KnowledgeCard>

        {/* Reviews */}
        <KnowledgeCard t={t} title="Your Best Google Reviews" status={data.reviews.trim().length > 50 ? 'done' : 'empty'} description="Paste 3–5 real customer reviews. PostCore learns how your customers talk about your business and mirrors that language.">
          <Textarea
            value={data.reviews}
            onChange={e => setData(d => ({ ...d, reviews: e.target.value }))}
            placeholder={"Paste your best customer reviews here...\n\n\"John and his team did an amazing job on our driveway. On time, professional, and the result exceeded expectations.\"\n\n\"Called them for an emergency — they showed up within 2 hours. Highly recommend!\""}
            rows={6}
          />
        </KnowledgeCard>

        {/* Differentiators */}
        <KnowledgeCard t={t} title="What Makes You Different" status={data.differentiators.trim().length > 20 ? 'done' : 'empty'} description="PostCore weaves this into trust signals in every post.">
          <Textarea
            value={data.differentiators}
            onChange={e => setData(d => ({ ...d, differentiators: e.target.value }))}
            placeholder="e.g. Same-day service, 25-year warranty, family owned since 1998, licensed and insured, free estimates..."
            rows={3}
          />
        </KnowledgeCard>

        {/* FAQs */}
        <KnowledgeCard t={t} title="Common Customer Questions" status={data.faqs.filter(f => f.trim()).length > 0 ? 'done' : 'empty'} description="Each FAQ becomes a ready-to-post educational suggestion on your dashboard.">
          {data.faqs.map((faq, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input placeholder="e.g. How long does a concrete driveway take to cure?" value={faq} onChange={e => setData(d => { const f = [...d.faqs]; f[i] = e.target.value; return { ...d, faqs: f }; })} />
              <button onClick={() => removeFaq(i)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <IpDelete size={13} />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addFaq}><IpPlus size={13} /> Add Question</Button>
        </KnowledgeCard>

        {/* Team */}
        <KnowledgeCard t={t} title="Your Team (Optional)" status={data.team.length > 0 ? 'done' : 'optional'} description="Used for team spotlight posts. Humanises your business.">
          {data.team.map((member, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <Input placeholder="Name" value={member.name} onChange={e => setData(d => { const tm = [...d.team]; tm[i] = { ...tm[i], name: e.target.value }; return { ...d, team: tm }; })} />
              <Input placeholder="Role e.g. Lead Technician" value={member.role} onChange={e => setData(d => { const tm = [...d.team]; tm[i] = { ...tm[i], role: e.target.value }; return { ...d, team: tm }; })} />
              <button onClick={() => removeTeam(i)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.error, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <IpDelete size={13} />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addTeam}><IpPlus size={13} /> Add Team Member</Button>
        </KnowledgeCard>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Layout>
  );
}

function KnowledgeCard({ t, title, status, description, children }) {
  const statusConfig = {
    done:     { color: t.success, icon: <IpCheck size={13} color={t.success} /> },
    empty:    { color: t.warning, icon: <IpWarning size={13} color={t.warning} /> },
    optional: { color: t.textMuted, icon: null },
  };
  const sc = statusConfig[status] || statusConfig.empty;
  return (
    <Card style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
            {title} {sc.icon}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>{description}</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </Card>
  );
}

export async function getServerSideProps() { return { props: {} }; }
