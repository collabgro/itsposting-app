import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  IpPlus, IpDelete, IpRefresh, IpSearch, IpCheckCircle, IpCloseCircle, IpCheck,
  IpGlobe, IpFAQ, IpEdit, IpDollar, IpFolderOpen, IpCopy, IpClose,
  IpExternalLink, IpComment, IpLoader,
  IpSparkle, IpFacebook, IpInstagram, IpGoogle,
} from '../components/icons';
import Layout from '../components/Layout';
import { Card, Button, Input, Textarea, Spinner } from '../components/ui';
import { useTheme } from '../lib/theme';
import { knowledgeAPI, receptionistAPI } from '../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS = { services: 'Services', reviews: 'Reviews', differentiators: 'About', team: 'Team' };
const TYPE_COLORS = { services: '#3b82f6', reviews: '#22c55e', differentiators: '#8b5cf6', team: '#ec4899' };

// ── Root Page ────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const router = useRouter();
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) router.replace('/login');
  }, []);

  useEffect(() => {
    const valid = ['all', 'crawler', 'faq', 'tables', 'richtext', 'files', 'ai-response'];
    if (router.query.tab && valid.includes(router.query.tab)) {
      setActiveTab(router.query.tab);
    }
  }, [router.query.tab]);

  if (!mounted) return null;

  const refresh = () => setRefreshKey(k => k + 1);

  const handleTabChange = (id) => {
    setActiveTab(id);
    router.push({ query: { tab: id } }, undefined, { shallow: true });
  };

  const tabs = [
    { id: 'all',         label: 'All' },
    { id: 'crawler',     label: 'Web Crawler' },
    { id: 'faq',         label: 'FAQ' },
    { id: 'tables',      label: 'Tables' },
    { id: 'richtext',    label: 'Rich Text' },
    { id: 'files',       label: 'File Upload' },
    { id: 'ai-response', label: 'AI Response' },
  ];

  return (
    <Layout title="Knowledge Base" subtitle="Train your AI with your business information">
      {/* Tab bar — horizontal scroll on mobile */}
      <div className="kb-tabs" style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', background: t.isDark ? 'rgba(15,15,24,0.78)' : t.card, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 14, width: 'fit-content', boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? t.primary : t.textSecondary,
                background: active ? (t.isDark ? 'rgba(124,92,252,0.15)' : 'rgba(124,92,252,0.08)') : 'transparent',
                border: `1.5px solid ${active ? 'rgba(124,92,252,0.35)' : 'transparent'}`,
                borderRadius: 10, cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: active ? '0 2px 10px rgba(124,92,252,0.18), inset 0 1px 0 rgba(255,255,255,0.07)' : 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ paddingBottom: 120 }}>
        {activeTab === 'all'         && <AllTab        t={t} refreshKey={refreshKey} onSwitchTab={handleTabChange} />}
        {activeTab === 'crawler'     && <WebCrawlerTab t={t} refreshKey={refreshKey} onImportComplete={() => { refresh(); handleTabChange('all'); }} />}
        {activeTab === 'faq'         && <FaqTab        t={t} refreshKey={refreshKey} />}
        {activeTab === 'tables'      && <TablesTab     t={t} />}
        {activeTab === 'richtext'    && <RichTextTab   t={t} refreshKey={refreshKey} />}
        {activeTab === 'files'       && <FilesTab      t={t} refreshKey={refreshKey} onRefresh={refresh} />}
        {activeTab === 'ai-response' && <AiResponseTab t={t} />}
      </div>

      {/* Persistent bottom test bar */}
      <TestBar t={t} />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .kb-tabs::-webkit-scrollbar{display:none}`}</style>
    </Layout>
  );
}

// ── All Tab ──────────────────────────────────────────────────────────────────

function AllTab({ t, refreshKey, onSwitchTab }) {
  const [counts, setCounts] = useState({ crawler: 0, faq: 0, richtext: 0, tables: 0, files: 0 });

  useEffect(() => {
    Promise.all([
      knowledgeAPI.listCrawlJobs().catch(() => ({ data: { jobs: [] } })),
      knowledgeAPI.list().catch(() => ({ data: { items: [] } })),
    ]).then(([crawlRes, entryRes]) => {
      const jobs  = crawlRes.data?.jobs  || [];
      const items = entryRes.data?.items || [];
      setCounts({
        crawler:  jobs.filter(j => j.status === 'done').length,
        faq:      items.filter(e => e.knowledge_type === 'faqs').length,
        richtext: items.filter(e => !['faqs','prices','files'].includes(e.knowledge_type)).length,
        tables:   items.filter(e => e.knowledge_type === 'prices').length,
        files:    items.filter(e => e.knowledge_type === 'files').length,
      });
    });
  }, [refreshKey]);

  const cards = [
    { id: 'crawler',  Icon: IpGlobe,      label: 'Web Crawler',  sub: 'Links',        count: counts.crawler },
    { id: 'faq',      Icon: IpFAQ,        label: 'FAQ',          sub: 'FAQs',         count: counts.faq },
    { id: 'richtext', Icon: IpEdit,       label: 'Rich Text',    sub: 'Rich Text',    count: counts.richtext },
    { id: 'tables',   Icon: IpDollar,     label: 'Tables',       sub: 'Tables',       count: counts.tables },
    { id: 'files',    Icon: IpFolderOpen, label: 'File Upload',  sub: 'File Uploads', count: counts.files },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
      {cards.map(card => (
        <button
          key={card.id}
          onClick={() => onSwitchTab(card.id)}
          style={{ cursor: 'pointer', padding: 22, background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`, borderRadius: 18, textAlign: 'left', transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `${t.shadowMd}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})` }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.06' : '0.95'})`; e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `${t.shadowMd}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.9'})`; e.currentTarget.style.borderColor = t.isDark ? 'rgba(255,255,255,0.07)' : t.border; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(26,86,219,0.1)', border: '1px solid rgba(26,86,219,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(26,86,219,0.1)' }}>
                <card.Icon size={20} color="#1A56DB" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{card.label}</span>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid rgba(124,92,252,0.25)`, background: 'rgba(124,92,252,0.07)', color: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}>
              +
            </div>
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 3 }}>{card.sub}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.primary }}>{card.count}</div>
        </button>
      ))}
    </div>
  );
}

// ── Web Crawler Tab ──────────────────────────────────────────────────────────

function WebCrawlerTab({ t, refreshKey, onImportComplete }) {
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [toast,       setToast]       = useState('');
  const [page,        setPage]        = useState(1);
  const perPage = 10;
  const [viewJob,     setViewJob]     = useState(null);
  const [viewData,    setViewData]    = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [bgJobId,      setBgJobId]      = useState(null);
  const [bgPagesFound, setBgPagesFound] = useState(0);
  const [bgDoneJobId,  setBgDoneJobId]  = useState(null);
  const bgPollRef = useRef(null);

  const fetchJobs = async () => {
    try {
      const { data } = await knowledgeAPI.listCrawlJobs();
      setJobs(data.jobs || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [refreshKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(async () => {
      try {
        const { data } = await knowledgeAPI.listCrawlJobs();
        setJobs(data.jobs || []);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  useEffect(() => {
    if (!bgJobId) return;
    const poll = async () => {
      try {
        const { data } = await knowledgeAPI.getCrawlStatus(bgJobId);
        const job = data.job;
        if (job?.pages_found) setBgPagesFound(job.pages_found);
        if (job?.status === 'done') {
          setBgDoneJobId(bgJobId);
          setBgJobId(null);
          setBgPagesFound(0);
          setShowModal(true);
          setToast('Crawl complete! Select pages to import.');
          setTimeout(() => setToast(''), 4000);
        } else if (job?.status === 'error') {
          setBgJobId(null);
          setBgPagesFound(0);
          setToast('Crawl failed. Please try again.');
          setTimeout(() => setToast(''), 4000);
        } else {
          bgPollRef.current = setTimeout(poll, 3000);
        }
      } catch {
        bgPollRef.current = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => clearTimeout(bgPollRef.current);
  }, [bgJobId]);

  const handleDelete = async (jobId) => {
    if (!window.confirm('Remove this crawled website?')) return;
    try {
      await knowledgeAPI.cancelCrawl(jobId);
      await fetchJobs();
    } catch {}
  };

  const handleRecrawl = async (jobUrl, jobMode) => {
    try {
      setToast('Starting re-crawl…');
      const { data } = await knowledgeAPI.startCrawl(jobUrl, jobMode || 'domain');
      setTimeout(() => setToast(''), 2000);
      await fetchJobs();
    } catch (err) {
      setToast('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleViewData = async (jobId) => {
    setViewJob(jobId);
    setViewData(null);
    setViewLoading(true);
    try {
      const { data } = await knowledgeAPI.getCrawlStatus(jobId);
      setViewData(data.job);
    } catch {}
    setViewLoading(false);
  };

  function buildScrapedText(pages = []) {
    return pages
      .filter(p => p.status === 'ok' && p.extracted)
      .flatMap(p => {
        const e = p.extracted;
        const parts = [];
        if (e.about)                  parts.push(e.about);
        if (e.services?.length)       parts.push(e.services.join('. '));
        if (e.faqs?.length)           parts.push(e.faqs.map(f => `${f.q} ${f.a}`).join(' '));
        if (e.testimonials?.length)   parts.push(e.testimonials.join(' '));
        if (e.pricing?.length)        parts.push(e.pricing.map(i => `${i.service}: ${i.price}`).join('. '));
        if (e.certifications?.length) parts.push(e.certifications.join('. '));
        if (e.hours)                  parts.push(e.hours);
        return parts;
      })
      .join(' ');
  }

  const handleSaveEntry = async () => {
    if (!viewData) return;
    setSavingEntry(true);
    try {
      const text = buildScrapedText(viewData.result_summary?.pages || []);
      const hostname = (() => { try { return new URL(viewData.url).hostname; } catch { return viewData.url; } })();
      await knowledgeAPI.createEntry({ knowledgeType: 'richtext', title: hostname, content: text });
      setViewJob(null);
      setViewData(null);
      setToast('Saved to knowledge base');
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('Failed to save');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSavingEntry(false);
    }
  };

  const filtered = jobs.filter(j => !search || j.url.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / perPage);
  const visible = filtered.slice((page - 1) * perPage, page * perPage);

  const statusBadge = (status) => {
    const map = {
      done:    { label: 'Trained',    bg: 'rgba(5,122,85,0.12)',   color: '#057A55' },
      running: { label: 'Processing', bg: 'rgba(194,120,3,0.12)',  color: '#C27803' },
      pending: { label: 'Processing', bg: 'rgba(194,120,3,0.12)',  color: '#C27803' },
      failed:  { label: 'Failed',     bg: 'rgba(200,30,30,0.12)',  color: '#C81E1E' },
    };
    const s = map[status] || map.failed;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 12, fontWeight: 600 }}>
        {(status === 'running' || status === 'pending') && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${s.color}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
        )}
        {s.label}
      </span>
    );
  };

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 8, background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {viewJob !== null && (() => {
        const pages = viewData?.result_summary?.pages || [];
        const scrapedText = viewData ? buildScrapedText(pages) : '';
        const wordCount = scrapedText.trim() ? scrapedText.trim().split(/\s+/).filter(Boolean).length : 0;
        return (
          <div onClick={() => setViewJob(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.35)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IpEdit size={16} color="#374151" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Data scraped from website</span>
                </div>
                <button onClick={() => setViewJob(null)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <IpClose size={14} />
                </button>
              </div>
              {/* URL + timestamp row */}
              {viewData && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 22px', borderBottom: '1px solid #f3f4f6', gap: 12, flexWrap: 'wrap' }}>
                  <a href={viewData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1A56DB', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {viewData.url}
                    <IpExternalLink size={11} />
                  </a>
                  {viewData.completed_at && (
                    <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
                      Last Updated on {new Date(viewData.completed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {/* Content */}
              <div style={{ padding: '14px 22px' }}>
                {viewLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={24} /></div>
                ) : !viewData ? (
                  <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#6b7280' }}>No data available for this job.</div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '14px 16px', height: 350, overflowY: 'auto', fontSize: 13, color: '#374151', lineHeight: 1.7, background: '#fff' }}>
                    {scrapedText || <span style={{ color: '#9ca3af' }}>No content available for this crawl job.</span>}
                  </div>
                )}
              </div>
              {/* Footer */}
              <div style={{ padding: '12px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{wordCount > 0 ? `${wordCount} words used` : ''}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setViewJob(null)} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEntry}
                    disabled={savingEntry || !scrapedText}
                    style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: savingEntry || !scrapedText ? '#93c5fd' : '#1A56DB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: savingEntry || !scrapedText ? 'not-allowed' : 'pointer' }}
                  >
                    {savingEntry ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {(showModal || bgDoneJobId) && (
        <AddWebsiteModal
          t={t}
          onClose={() => { setShowModal(false); setBgDoneJobId(null); }}
          onSuccess={async () => {
            setShowModal(false);
            setBgDoneJobId(null);
            await fetchJobs();
            onImportComplete();
          }}
          onBackground={(jobId) => { setBgJobId(jobId); setShowModal(false); }}
          initialJobId={bgDoneJobId}
        />
      )}

      {bgJobId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: t.primaryBg, borderRadius: 8, border: `1px solid ${t.primaryBorder}`, marginBottom: 12 }}>
          <Spinner size={12} color={t.primary} />
          <span style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>
            Crawling in background… {bgPagesFound > 0 ? `${bgPagesFound} pages found so far` : 'starting up'}
          </span>
          <button
            onClick={() => { setBgJobId(null); clearTimeout(bgPollRef.current); setBgPagesFound(0); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 11, color: t.textMuted, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>URLs</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.input, color: t.textMuted }}>{filtered.length}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: t.textSecondary }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            style={{ accentColor: '#1A56DB' }}
          />
          Auto-Refresh
        </label>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <IpSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search URLs"
            style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 13, fontFamily: 'inherit', width: 200 }}
          />
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <IpPlus size={14} /> Add Website
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={20} /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><IpGlobe size={40} color={t.textMuted} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>No websites added yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Add your website to train PostCore with your business content</div>
            <Button variant="primary" onClick={() => setShowModal(true)}><IpPlus size={14} /> Add Website</Button>
          </div>
        </Card>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12 }}>
        <Card style={{ padding: 0, overflow: 'hidden', minWidth: 560 }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 180px 100px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.input }}>
            <div />
            {['Path', 'Status', 'Data Refreshed At', 'Action'].map(h => (
              <div key={h} style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>{h}</div>
            ))}
          </div>
          {visible.map((job, i) => (
            <div
              key={job.id}
              style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 180px 100px', gap: 0, padding: '12px 16px', borderBottom: i < visible.length - 1 ? `1px solid ${t.border}` : 'none', alignItems: 'center' }}
            >
              <input type="checkbox" style={{ accentColor: '#1A56DB' }} />
              <a href={job.url} target="_blank" rel="noopener noreferrer" onClick={e => e.preventDefault()} style={{ fontSize: 13, color: '#1A56DB', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                {job.url}
              </a>
              <div>{statusBadge(job.status)}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                {job.completed_at
                  ? new Date(job.completed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : job.created_at
                  ? new Date(job.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '—'
                }
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <ActionBtn title="View scraped data" onClick={() => handleViewData(job.id)}><IpCopy size={13} /></ActionBtn>
                <ActionBtn title="Re-crawl"  onClick={() => handleRecrawl(job.url, job.mode)}><IpRefresh size={13} /></ActionBtn>
                <ActionBtn title="Delete"    onClick={() => handleDelete(job.id)} danger><IpDelete size={13} /></ActionBtn>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textMuted }}>
              <span>Rows per page: 10</span>
              <span style={{ marginLeft: 12 }}>{(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}</span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(t, page === 1)}>Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(t, page === totalPages)}>Next</button>
            </div>
          )}
        </Card>
        </div>
      )}
    </>
  );
}

function ActionBtn({ title, onClick, danger, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', color: danger ? '#C81E1E' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
    >
      {children}
    </button>
  );
}

function pageBtnStyle(t, disabled) {
  return { padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: disabled ? t.textMuted : t.text, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, opacity: disabled ? 0.5 : 1, fontFamily: 'inherit' };
}

// ── Add Website Modal ────────────────────────────────────────────────────────

function AddWebsiteModal({ t, onClose, onSuccess, onBackground, initialJobId }) {
  const [step,         setStep]         = useState(1); // 1=form, 2=progress, 3=select
  const [url,          setUrl]          = useState('');
  const [mode,         setMode]         = useState('domain');
  const [error,        setError]        = useState('');
  const [jobId,        setJobId]        = useState(null);
  const [job,          setJob]          = useState(null);
  const [selectedUrls, setSelectedUrls] = useState([]);
  const [importing,    setImporting]    = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!initialJobId) return;
    (async () => {
      try {
        const { data } = await knowledgeAPI.getCrawlStatus(initialJobId);
        const j = data.job;
        setJobId(initialJobId);
        setJob(j);
        setUrl(j.url || '');
        const okPages = (j.result_summary?.pages || []).filter(p => p.status === 'ok').map(p => p.url);
        setSelectedUrls(okPages);
        setStep(3);
      } catch {}
    })();
  }, [initialJobId]);

  const crawlModes = [
    { id: 'exact',  label: 'Exact URL',              desc: 'Crawls only this specific page. Best for a single page (e.g. /services)' },
    { id: 'path',   label: 'All URLs with this Path', desc: 'Crawls all pages under this path. e.g. /services crawls /services/plumbing' },
    { id: 'domain', label: 'All URLs in this Domain', desc: 'Crawls every page on the website. Best for full site training.', recommended: true },
  ];

  const handleExtract = async () => {
    if (!url.trim()) return;
    setError('');
    setStep(2);
    try {
      const { data } = await knowledgeAPI.startCrawl(url.trim(), mode);
      setJobId(data.jobId);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStep(1);
    }
  };

  useEffect(() => {
    if (!jobId || (initialJobId && jobId === initialJobId)) return;
    const poll = async () => {
      try {
        const { data } = await knowledgeAPI.getCrawlStatus(jobId);
        setJob(data.job);
        if (data.job?.status === 'running' || data.job?.status === 'pending') {
          pollRef.current = setTimeout(poll, 2000);
        } else if (data.job?.status === 'done') {
          const okPages = (data.job.result_summary?.pages || []).filter(p => p.status === 'ok').map(p => p.url);
          setSelectedUrls(okPages);
          setStep(3);
        }
      } catch {}
    };
    poll();
    return () => clearTimeout(pollRef.current);
  }, [jobId]);

  const handleImport = async () => {
    if (!selectedUrls.length) return;
    setImporting(true);
    try {
      await knowledgeAPI.importCrawl(jobId, selectedUrls);
      onSuccess();
    } catch (err) {
      setError('Import failed: ' + (err.response?.data?.error || err.message));
      setImporting(false);
    }
  };

  const pages   = job?.result_summary?.pages || [];
  const pct     = job ? Math.round(((job.pages_crawled || 0) / Math.max(job.pages_found || 1, 1)) * 100) : 0;

  const pageIcon = (status) => {
    if (status === 'ok')      return <IpCheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />;
    if (status === 'running') return <IpRefresh size={14} style={{ color: t.primary, flexShrink: 0 }} />;
    if (status === 'failed')  return <IpCloseCircle size={14} style={{ color: t.error, flexShrink: 0 }} />;
    return <IpLoader size={14} style={{ color: t.textMuted, flexShrink: 0 }} />;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', padding: 28, position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: t.textMuted, cursor: 'pointer', fontSize: 20 }}>×</button>

        {/* Step 1 — URL + crawl type */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>Add Website to Knowledge Base</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Website URL *</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleExtract(); }}
                placeholder="https://yourbusiness.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 10 }}>Crawl Type *</label>
              {crawlModes.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
                  <input type="radio" name="modal_crawl_mode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} style={{ marginTop: 3, accentColor: '#1A56DB' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {m.label}{m.recommended && <span style={{ marginLeft: 6, fontSize: 11, color: '#1A56DB', fontWeight: 600 }}>(Recommended)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 20 }}>
              Pages limit based on your plan — Starter: 5 pages · Pro: 50 pages · Premium: unlimited
            </div>
            {error && <div style={{ color: '#C81E1E', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleExtract} disabled={!url.trim()}>Extract Data →</Button>
            </div>
          </>
        )}

        {/* Step 2 — Progress */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>Crawling {url}</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 8, background: t.input, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#1A56DB', borderRadius: 4, transition: 'width 400ms ease' }} />
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'right' }}>{pct}%</div>
            </div>
            {pages.length > 0 ? (
              <div style={{ maxHeight: 280, overflow: 'auto' }}>
                {pages.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                    <span>{pageIcon(p.status)}</span>
                    <span style={{ flex: 1, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</span>
                    {p.status === 'ok' && p.wordCount && <span style={{ color: t.textMuted, flexShrink: 0 }}>({p.wordCount} words)</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                <Spinner size={20} />
                <div style={{ marginTop: 10 }}>Using enhanced crawler: expanding accordions, tabs, lazy-loaded sections…</div>
              </div>
            )}
            {onBackground && jobId && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
                <Button variant="ghost" onClick={() => onBackground(jobId)}>Continue in background →</Button>
              </div>
            )}
          </>
        )}

        {/* Step 3 — Page selection */}
        {step === 3 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Select pages to add</div>
              <span style={{ fontSize: 12, color: t.textMuted }}>{pages.filter(p => p.status === 'ok').length} pages found</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1A56DB', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedUrls.length === pages.filter(p => p.status === 'ok').length}
                  onChange={e => setSelectedUrls(e.target.checked ? pages.filter(p => p.status === 'ok').map(p => p.url) : [])}
                  style={{ accentColor: '#1A56DB' }}
                />
                Select All
              </label>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}>
              {pages.filter(p => p.status === 'ok').map((p, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedUrls.includes(p.url)}
                    onChange={() => setSelectedUrls(prev => prev.includes(p.url) ? prev.filter(u => u !== p.url) : [...prev, p.url])}
                    style={{ accentColor: '#1A56DB' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</span>
                  {p.wordCount && <span style={{ fontSize: 12, color: t.textMuted, flexShrink: 0 }}>({p.wordCount} words)</span>}
                </label>
              ))}
            </div>
            {error && <div style={{ color: '#C81E1E', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleImport} disabled={importing || !selectedUrls.length}>
                {importing ? 'Adding…' : `Add to Knowledge Base`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── FAQ Tab ──────────────────────────────────────────────────────────────────

function FaqTab({ t, refreshKey }) {
  const [faqs,      setFaqs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null); // null or entry object

  const fetchFaqs = async () => {
    try {
      const { data } = await knowledgeAPI.list();
      setFaqs((data.items || []).filter(e => e.knowledge_type === 'faqs'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchFaqs(); }, [refreshKey]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await knowledgeAPI.deleteEntry(id); await fetchFaqs(); } catch {}
  };

  return (
    <>
      {(showModal || editing) && (
        <FaqModal
          t={t}
          entry={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={async ({ question, answer }) => {
            if (editing) {
              await knowledgeAPI.updateEntry(editing.id, { title: question, content: answer });
            } else {
              await knowledgeAPI.createEntry({ knowledgeType: 'faqs', title: question, content: answer });
            }
            setShowModal(false);
            setEditing(null);
            await fetchFaqs();
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>FAQs</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.input, color: t.textMuted }}>{faqs.length}</span>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}><IpPlus size={14} /> Add FAQ</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={20} /></div>
      ) : faqs.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IpComment size={48} style={{ color: t.textMuted }} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>No FAQs added yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Add FAQs to help your agent answer common questions instantly.</div>
            <Button variant="primary" onClick={() => setShowModal(true)}><IpPlus size={14} /> Add FAQ</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map(faq => (
            <Card key={faq.id} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                    Q  {faq.title}
                  </div>
                  <div style={{ fontSize: 13, color: t.textMuted }}>
                    A  {String(faq.content).substring(0, 120)}{String(faq.content).length > 120 ? '…' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <ActionBtn title="Edit" onClick={() => setEditing(faq)}><IpEdit size={14} /></ActionBtn>
                  <ActionBtn title="Delete" onClick={() => handleDelete(faq.id)} danger><IpDelete size={13} /></ActionBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function FaqModal({ t, entry, onClose, onSave }) {
  const [question, setQuestion] = useState(entry?.title   || '');
  const [answer,   setAnswer]   = useState(entry?.content || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) { setErr('Both fields are required.'); return; }
    setSaving(true);
    try { await onSave({ question: question.trim(), answer: answer.trim() }); }
    catch (e) { setErr(e.response?.data?.error || e.message); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, borderRadius: 16, width: '100%', maxWidth: 480, padding: 28, position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: t.textMuted, cursor: 'pointer', fontSize: 20 }}>×</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 20 }}>{entry ? 'Edit FAQ' : 'Add FAQ'}</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Question *</label>
          <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Do you offer emergency services?" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Answer *</label>
          <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} placeholder="Yes, we provide 24/7 emergency services…" />
        </div>
        {err && <div style={{ color: '#C81E1E', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Tables Tab (Pricing) ─────────────────────────────────────────────────────

function TablesTab({ t }) {
  const [items,  setItems]  = useState([{ service: '', priceRange: '', notes: '' }]);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  useEffect(() => {
    knowledgeAPI.list()
      .then(({ data }) => {
        const priceEntries = (data.items || []).filter(e => e.knowledge_type === 'prices');
        if (priceEntries.length > 0) {
          const parsed = priceEntries.map(e => {
            try { return JSON.parse(e.content); } catch { return { service: e.title, priceRange: '', notes: '' }; }
          });
          setItems(parsed.length ? parsed : [{ service: '', priceRange: '', notes: '' }]);
        }
      })
      .catch(() => {});
  }, []);

  const addRow    = () => setItems(i => [...i, { service: '', priceRange: '', notes: '' }]);
  const removeRow = (idx) => setItems(i => i.filter((_, n) => n !== idx));

  const handleSave = async () => {
    const valid = items.filter(i => i.service.trim());
    if (!valid.length) return;
    setSaving(true);
    setMsg('');
    try {
      await knowledgeAPI.savePrices(valid);
      setMsg('Pricing saved');
    } catch (err) {
      setMsg('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Tables</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.input, color: t.textMuted }}>{items.filter(i => i.service.trim()).length}</span>
        </div>
        <Button variant="primary" onClick={addRow}><IpPlus size={14} /> Add Row</Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IpDollar size={40} color={t.textMuted} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>No tables added yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Add your service pricing so PostCore can share price ranges with customers.</div>
            <Button variant="primary" onClick={addRow}><IpPlus size={14} /> Add Row</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 400 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            {['Service', 'Price Range', 'Notes', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>{h}</div>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <Input placeholder="e.g. Drain cleaning"   value={item.service}    onChange={e => setItems(its => { const n = [...its]; n[i] = { ...n[i], service:    e.target.value }; return n; })} />
              <Input placeholder="e.g. $200–500"         value={item.priceRange} onChange={e => setItems(its => { const n = [...its]; n[i] = { ...n[i], priceRange: e.target.value }; return n; })} />
              <Input placeholder="e.g. After site visit" value={item.notes}      onChange={e => setItems(its => { const n = [...its]; n[i] = { ...n[i], notes:      e.target.value }; return n; })} />
              <button onClick={() => removeRow(i)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: '#C81E1E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <IpDelete size={13} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={addRow}><IpPlus size={13} /> Add Row</Button>
            <Button variant="primary"   size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Pricing'}</Button>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith('Failed') ? '#C81E1E' : '#057A55' }}>{msg}</span>}
          </div>
          </div>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Rich Text Tab ────────────────────────────────────────────────────────────

function RichTextTab({ t, refreshKey }) {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);

  const fetchEntries = async () => {
    try {
      const { data } = await knowledgeAPI.list();
      setEntries((data.items || []).filter(e => !['faqs', 'prices', 'files'].includes(e.knowledge_type)));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [refreshKey]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await knowledgeAPI.deleteEntry(id); await fetchEntries(); } catch {}
  };

  const previewContent = (content) => {
    try {
      const p = JSON.parse(content);
      if (p.name) return p.name + (p.priceRange ? ` · ${p.priceRange}` : '');
      if (p.q)    return p.q;
      return JSON.stringify(p).substring(0, 80);
    } catch { return String(content).substring(0, 100); }
  };

  return (
    <>
      {(showModal || editing) && (
        <RichTextModal
          t={t}
          entry={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={async ({ title, knowledgeType, content }) => {
            if (editing) {
              await knowledgeAPI.updateEntry(editing.id, { title, content });
            } else {
              await knowledgeAPI.createEntry({ knowledgeType, title, content });
            }
            setShowModal(false);
            setEditing(null);
            await fetchEntries();
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Rich Text</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.input, color: t.textMuted }}>{entries.length}</span>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={() => setShowModal(true)}><IpPlus size={14} /> Add Rich Text</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={20} /></div>
      ) : entries.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>T</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>No rich text added yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Create rich text content to give your agent detailed instructions or context.</div>
            <Button variant="primary" onClick={() => setShowModal(true)}><IpPlus size={14} /> Add Rich Text</Button>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: idx < entries.length - 1 ? `1px solid ${t.border}` : 'none' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 6, background: `${TYPE_COLORS[entry.knowledge_type] || '#6b7280'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: TYPE_COLORS[entry.knowledge_type] || '#6b7280', flexShrink: 0 }}>
                T
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewContent(entry.content)}</div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 20, background: `${TYPE_COLORS[entry.knowledge_type] || '#6b7280'}18`, color: TYPE_COLORS[entry.knowledge_type] || '#6b7280', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                {TYPE_LABELS[entry.knowledge_type] || entry.knowledge_type}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <ActionBtn title="Edit" onClick={() => setEditing(entry)}><IpEdit size={14} /></ActionBtn>
                <ActionBtn title="Delete" onClick={() => handleDelete(entry.id)} danger><IpDelete size={13} /></ActionBtn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function RichTextModal({ t, entry, onClose, onSave }) {
  const [title,         setTitle]         = useState(entry?.title    || '');
  const [knowledgeType, setKnowledgeType] = useState(entry?.knowledge_type || 'services');
  const [content,       setContent]       = useState(entry?.content  || '');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { setErr('File name and content are required.'); return; }
    setSaving(true);
    try { await onSave({ title: title.trim(), knowledgeType, content: content.trim() }); }
    catch (e) { setErr(e.response?.data?.error || e.message); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, borderRadius: 16, width: '100%', maxWidth: 520, padding: 28, position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: t.textMuted, cursor: 'pointer', fontSize: 20 }}>×</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 20 }}>{entry ? 'Edit Rich Text' : 'Add Rich Text'}</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>File name *</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled rich text" />
        </div>
        {!entry && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Type</label>
            <select
              value={knowledgeType}
              onChange={e => setKnowledgeType(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontFamily: 'inherit' }}
            >
              <option value="services">Services</option>
              <option value="reviews">Reviews</option>
              <option value="differentiators">About</option>
              <option value="team">Team</option>
            </select>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Content *</label>
          <Textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="Start typing your content…" />
        </div>
        {err && <div style={{ color: '#C81E1E', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Files Tab ────────────────────────────────────────────────────────────────

function FilesTab({ t, refreshKey, onRefresh }) {
  const fileInputRef             = useRef(null);
  const [entries,   setEntries]  = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [uploading, setUploading]= useState(false);
  const [toast,     setToast]    = useState('');

  const fetchEntries = async () => {
    try {
      const { data } = await knowledgeAPI.list();
      setEntries((data.items || []).filter(e => e.knowledge_type === 'files'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [refreshKey]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setToast('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await knowledgeAPI.uploadFile(fd);
      await fetchEntries();
      if (onRefresh) onRefresh();
      setToast('File uploaded');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast('Upload failed: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setToast(''), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this file from the knowledge base?')) return;
    try { await knowledgeAPI.deleteEntry(id); await fetchEntries(); if (onRefresh) onRefresh(); } catch {}
  };

  const previewContent = (content) => String(content || '').replace(/\s+/g, ' ').trim().substring(0, 100);

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".txt,.pdf,.md" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Files</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.input, color: t.textMuted }}>{entries.length}</span>
        </div>
        {toast && <span style={{ fontSize: 12, color: toast.startsWith('Upload failed') ? '#C81E1E' : '#057A55' }}>{toast}</span>}
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <><Spinner size={12} /> Uploading…</> : <><IpPlus size={14} /> Upload from computer</>}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={20} /></div>
      ) : entries.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IpFolderOpen size={40} color={t.textMuted} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>No files uploaded yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Upload TXT or PDF files to give PostCore access to your documents.</div>
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <><Spinner size={12} /> Uploading…</> : <><IpPlus size={14} /> Upload from computer</>}
            </Button>
            <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted }}>Supports PDF and TXT files up to 10MB</div>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: idx < entries.length - 1 ? `1px solid ${t.border}` : 'none' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IpFolderOpen size={16} color="#14b8a6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewContent(entry.content)}</div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(20,184,166,0.1)', color: '#14b8a6', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                File
              </span>
              <ActionBtn title="Delete" onClick={() => handleDelete(entry.id)} danger><IpDelete size={13} /></ActionBtn>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

// ── Bottom Test Bar ──────────────────────────────────────────────────────────

function TestBar({ t }) {
  const [query,      setQuery]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [isOpen,     setIsOpen]     = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const [activeSrcs, setActiveSrcs] = useState(['crawler', 'faqs', 'richtext', 'tables']);
  const scrollRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sources = [
    { id: 'crawler',  label: 'Web Crawler' },
    { id: 'faqs',     label: 'FAQs' },
    { id: 'richtext', label: 'Rich Text' },
    { id: 'tables',   label: 'Tables' },
  ];

  const toggleSrc = (id) => setActiveSrcs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const handleTest = async () => {
    if (!query.trim() || sending) return;
    const q = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setIsOpen(true);
    setSending(true);
    try {
      const { data } = await receptionistAPI.test(q);
      setMessages(prev => [...prev, { role: 'ai', text: data.reply, intent: data.intent, wouldEscalate: data.wouldEscalate }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + (err.response?.data?.error || err.message) }]);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => { setIsOpen(false); setMessages([]); setQuery(''); };

  return (
    <div style={{ position: 'fixed', bottom: 0, left: isMobile ? 0 : 240, right: 0, zIndex: 100, borderTop: `1px solid ${t.border}`, background: t.card, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>

      {/* Expanded message history panel */}
      {isOpen && (
        <div style={{ borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>AI Receptionist test</span>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex' }}>
              <IpClose size={14} />
            </button>
          </div>
          <div ref={scrollRef} style={{ maxHeight: 280, overflowY: 'auto', padding: '0 24px 12px' }}>
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 2 }}>You:</div>
                  <div style={{ fontSize: 13, color: t.text }}>{msg.text}</div>
                </div>
              ) : (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: t.text, padding: '10px 14px', background: t.input, borderRadius: 10, borderLeft: '3px solid #1A56DB' }}>
                    <strong style={{ fontSize: 11, color: '#1A56DB', display: 'block', marginBottom: 4 }}>AI Receptionist:</strong>
                    {msg.text}
                    {msg.intent && (
                      <div style={{ marginTop: 6, fontSize: 11, color: t.textMuted }}>
                        Intent detected: <strong>{msg.intent}</strong>{msg.wouldEscalate ? ' · Would escalate to human' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.input, borderRadius: 10, borderLeft: '3px solid #1A56DB' }}>
                <Spinner size={12} color="#1A56DB" />
                <span style={{ fontSize: 12, color: t.textMuted }}>AI Receptionist is thinking…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input area — always visible */}
      <div style={{ padding: '12px 24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTest(); } }}
            placeholder="Ask a question your users might ask…"
            style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.input, color: t.text, fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleTest}
            disabled={sending || !query.trim()}
            style={{ width: 38, height: 38, borderRadius: 8, background: '#1A56DB', border: 'none', color: '#fff', cursor: sending || !query.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending || !query.trim() ? 0.6 : 1, flexShrink: 0 }}
          >
            {sending ? <Spinner size={14} color="#fff" /> : '▶'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>Sources:</span>
          {sources.map(s => (
            <button
              key={s.id}
              onClick={() => toggleSrc(s.id)}
              style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${activeSrcs.includes(s.id) ? '#1A56DB' : t.border}`, background: activeSrcs.includes(s.id) ? 'rgba(26,86,219,0.08)' : 'transparent', color: activeSrcs.includes(s.id) ? '#1A56DB' : t.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {s.label}
            </button>
          ))}
          <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>Enter to run · Shift+Enter new line</span>
        </div>
      </div>
    </div>
  );
}

// ── AI Response Tab ──────────────────────────────────────────────────────────

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

function ToggleRow({ label, sub, value, onChange, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? '#1A56DB' : t.border,
          position: 'relative', transition: 'background 200ms', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
          borderRadius: '50%', background: '#fff', transition: 'left 200ms',
        }} />
      </button>
    </div>
  );
}

function AiResponseTab({ t }) {
  const [form, setForm] = useState({
    enabled: false, auto_handle: false, tone: 'friendly',
    active_platforms: { facebook: false, instagram: false, google: false },
    escalate_keywords: [], business_hours_start: '09:00', business_hours_end: '17:00',
    timezone: 'America/New_York', after_hours_message: '',
  });
  const [stats, setStats] = useState({ aiHandledToday: 0, escalatedOpen: 0, pendingUnread: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    Promise.all([
      receptionistAPI.getConfig().catch(() => null),
      receptionistAPI.getStats().catch(() => null),
    ]).then(([cfgRes, statsRes]) => {
      const cfg = cfgRes?.data?.config;
      if (cfg) {
        const ap = cfg.active_platforms || {};
        setForm({
          enabled: !!cfg.enabled,
          auto_handle: !!cfg.auto_handle,
          tone: cfg.tone || 'friendly',
          active_platforms: typeof ap === 'object' && !Array.isArray(ap)
            ? { facebook: !!ap.facebook, instagram: !!ap.instagram, google: !!ap.google }
            : { facebook: false, instagram: false, google: false },
          escalate_keywords: Array.isArray(cfg.escalate_keywords) ? cfg.escalate_keywords : [],
          business_hours_start: cfg.business_hours_start || '09:00',
          business_hours_end: cfg.business_hours_end || '17:00',
          timezone: cfg.timezone || 'America/New_York',
          after_hours_message: cfg.after_hours_message || '',
        });
      }
      if (statsRes?.data) setStats(statsRes.data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await receptionistAPI.saveConfig({
        enabled: form.enabled,
        autoHandle: form.auto_handle,
        tone: form.tone,
        activePlatforms: form.active_platforms,
        escalateKeywords: form.escalate_keywords,
        businessHoursStart: form.business_hours_start,
        businessHoursEnd: form.business_hours_end,
        timezone: form.timezone,
        afterHoursMessage: form.after_hours_message,
      });
      setSaveMsg('Settings saved');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (_) {
      setSaveMsg('Failed to save');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const kw = keyword.trim().replace(/,$/, '');
    if (kw && !form.escalate_keywords.includes(kw)) {
      setForm(f => ({ ...f, escalate_keywords: [...f.escalate_keywords, kw] }));
    }
    setKeyword('');
  };

  const removeKeyword = (kw) => {
    setForm(f => ({ ...f, escalate_keywords: f.escalate_keywords.filter(k => k !== kw) }));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={24} /></div>;

  const sectionHeader = (text) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 28, marginBottom: 8 }}>{text}</div>
  );

  const TONES = [
    { id: 'friendly', label: 'Friendly' },
    { id: 'professional', label: 'Professional' },
    { id: 'casual', label: 'Casual' },
    { id: 'expert', label: 'Expert' },
  ];

  const PLATFORMS = [
    { id: 'facebook',  label: 'Facebook DMs',    Icon: IpFacebook },
    { id: 'instagram', label: 'Instagram DMs',   Icon: IpInstagram },
    { id: 'google',    label: 'Google Business', Icon: IpGoogle },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 8 }}>
        {[
          { label: 'AI Handled Today', value: stats.aiHandledToday },
          { label: 'Escalated Open',   value: stats.escalatedOpen },
          { label: 'Pending Unread',   value: stats.pendingUnread },
        ].map(s => (
          <div key={s.label} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.text }}>{s.value}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Handling */}
      {sectionHeader('AI Handling')}
      <ToggleRow label="Enable AI Handling" sub="PostCore will auto-reply to incoming DMs" value={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} t={t} />
      <ToggleRow label="Auto-Reply" sub="Send replies automatically without approval" value={form.auto_handle} onChange={v => setForm(f => ({ ...f, auto_handle: v }))} t={t} />

      {/* Tone */}
      {sectionHeader('Tone')}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TONES.map(tone => (
          <button
            key={tone.id}
            onClick={() => setForm(f => ({ ...f, tone: tone.id }))}
            style={{
              padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: form.tone === tone.id ? '#1A56DB' : t.card,
              color: form.tone === tone.id ? '#fff' : t.textSecondary,
              border: `1.5px solid ${form.tone === tone.id ? '#1A56DB' : t.border}`,
              transition: 'all 150ms',
            }}
          >
            {tone.label}
          </button>
        ))}
      </div>

      {/* Active Platforms */}
      {sectionHeader('Active Platforms')}
      {PLATFORMS.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p.Icon size={18} style={{ color: t.textSecondary }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{p.label}</span>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, active_platforms: { ...f.active_platforms, [p.id]: !f.active_platforms[p.id] } }))}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: form.active_platforms[p.id] ? '#1A56DB' : t.border,
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: form.active_platforms[p.id] ? 22 : 2, width: 20, height: 20,
              borderRadius: '50%', background: '#fff', transition: 'left 200ms',
            }} />
          </button>
        </div>
      ))}

      {/* Escalation Keywords */}
      {sectionHeader('Escalation Keywords')}
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>PostCore stops auto-replying and alerts you when these words appear in a message.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {form.escalate_keywords.map(kw => (
          <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, fontSize: 12, color: '#ef4444' }}>
            {kw}
            <button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(); } }}
          placeholder="Type keyword and press Enter..."
          style={{ flex: 1, padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={addKeyword} style={{ padding: '9px 16px', background: t.primary, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
      </div>

      {/* Business Hours */}
      {sectionHeader('Business Hours')}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Opens</label>
          <input type="time" value={form.business_hours_start} onChange={e => setForm(f => ({ ...f, business_hours_start: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Closes</label>
          <input type="time" value={form.business_hours_end} onChange={e => setForm(f => ({ ...f, business_hours_end: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Timezone</label>
          <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* After-Hours Message */}
      {sectionHeader('After-Hours Message')}
      <textarea
        value={form.after_hours_message}
        onChange={e => setForm(f => ({ ...f, after_hours_message: e.target.value }))}
        placeholder="Thanks for reaching out! We're outside business hours right now. We'll get back to you first thing tomorrow."
        rows={3}
        style={{ width: '100%', padding: '10px 12px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 28px', background: '#1A56DB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes('Failed') ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{saveMsg}</span>}
      </div>
    </div>
  );
}

