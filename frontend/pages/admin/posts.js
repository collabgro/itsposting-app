import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  IpSearch, IpDelete, IpWarning, IpDrafts, IpArrowLeft, IpRefresh,
} from '../../components/icons';
import Layout from '../../components/Layout';
import { Card, Badge, Button, EmptyState, Spinner, SectionHeader } from '../../components/ui';
import { useTheme } from '../../lib/theme';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 25;

const PLATFORM_VARIANT = {
  facebook: 'primary',
  instagram: 'warning',
  google_business: 'success',
  tiktok: 'error',
  linkedin: 'info',
};

const STATUS_VARIANT = {
  posted: 'success',
  scheduled: 'warning',
  draft: 'default',
  failed: 'error',
  removed_by_admin: 'error',
};

const CONTENT_TYPES = [
  'text_post', 'photo_post', 'carousel', 'video',
  'before_after', 'educational_tip', 'customer_testimonial', 'seasonal', 'promotion',
];

export default function AdminPostsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (filterCustomer.trim()) params.customer_id = filterCustomer.trim();
      if (filterPlatform) params.platform = filterPlatform;
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.content_type = filterType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo + 'T23:59:59';
      const res = await adminAPI.listPosts(params);
      setPosts(res.data.posts || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      if (err.response?.status === 403) router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, filterCustomer, filterPlatform, filterStatus, filterType, dateFrom, dateTo]);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setPage(0);
    load(0);
  }, [filterPlatform, filterStatus, filterType, dateFrom, dateTo, mounted]);

  useEffect(() => {
    if (mounted) load(page);
  }, [page, mounted]);

  function handleSearch() {
    setFilterCustomer(pendingSearch);
    setPage(0);
  }

  async function handleDelete(id) {
    if (!deleteReason.trim() || deleteReason.trim().length < 5) {
      setDeleteError('Reason must be at least 5 characters');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await adminAPI.deletePost(id, deleteReason.trim());
      setDeletingId(null);
      setDeleteReason('');
      load(page);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!mounted) return null;

  const inputStyle = {
    padding: '9px 12px', background: t.input, border: `1px solid ${t.borderStrong}`,
    borderRadius: 8, color: t.text, fontSize: 13,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <Layout
      title="Post Moderation"
      subtitle="Review and remove posts across all customers"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <IpArrowLeft size={13} /> Admin
          </Button>
        </div>
      }
    >
      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Customer ID search */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <IpSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
            <input
              type="number" placeholder="Customer ID..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ ...inputStyle, paddingLeft: 30, width: 150 }}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={handleSearch}>Search</Button>
          {filterCustomer && (
            <Button size="sm" variant="ghost" onClick={() => { setFilterCustomer(''); setPendingSearch(''); setPage(0); }}>
              Clear
            </Button>
          )}
        </div>

        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} style={inputStyle}>
          <option value="">All platforms</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="google_business">Google Business</option>
          <option value="tiktok">TikTok</option>
          <option value="linkedin">LinkedIn</option>
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="failed">Failed</option>
          <option value="removed_by_admin">Removed</option>
        </select>

        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
          <option value="">All types</option>
          {CONTENT_TYPES.map(type => (
            <option key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} title="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} title="To date" />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHeader icon={IpDrafts} title="All Posts" subtitle={`${total} posts`} />
          <Button size="sm" variant="ghost" onClick={() => load(page)}>
            <IpRefresh size={12} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={32} />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState icon={IpDrafts} title="No posts found" subtitle="Try adjusting your filters" />
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Customer', 'Caption', 'Platform', 'Status', 'Type', 'Posted', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: t.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <>
                    <tr
                      key={post.id}
                      style={{
                        borderBottom: deletingId === post.id ? 'none' : `1px solid ${t.border}`,
                        background: deletingId === post.id ? t.primaryBg : 'transparent',
                        opacity: post.status === 'removed_by_admin' ? 0.5 : 1,
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{post.business_name || '—'}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>ID #{post.customer_id}</div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                        <span style={{ fontSize: 12, color: t.textSecondary, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {post.caption || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {post.platform && (
                          <Badge variant={PLATFORM_VARIANT[post.platform] || 'default'} style={{ fontSize: 11 }}>
                            {post.platform.replace('_', ' ')}
                          </Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={STATUS_VARIANT[post.status] || 'default'} style={{ fontSize: 11 }}>
                          {post.status || '—'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted }}>
                        {post.content_type ? post.content_type.replace(/_/g, ' ') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted, whiteSpace: 'nowrap' }}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {post.status !== 'removed_by_admin' && (
                          <button
                            onClick={() => { setDeletingId(post.id); setDeleteReason(''); setDeleteError(''); }}
                            style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: t.error, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <IpDelete size={11} /> Delete
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* INLINE DELETE CONFIRM */}
                    {deletingId === post.id && (
                      <tr key={`${post.id}-delete`} style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td colSpan={7} style={{ padding: '12px 16px', background: t.primaryBg }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.error }}>
                              <IpWarning size={14} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>Delete this post?</span>
                            </div>
                            <input
                              type="text"
                              placeholder="Reason for deletion (min 5 chars)..."
                              value={deleteReason}
                              onChange={(e) => { setDeleteReason(e.target.value); setDeleteError(''); }}
                              style={{ flex: 1, minWidth: 240, padding: '7px 12px', background: t.input, border: `1px solid ${deleteError ? t.error : t.border}`, borderRadius: 8, color: t.text, fontSize: 13 }}
                            />
                            {deleteError && (
                              <span style={{ fontSize: 12, color: t.error, alignSelf: 'center' }}>{deleteError}</span>
                            )}
                            <Button
                              size="sm" variant="danger"
                              onClick={() => handleDelete(post.id)}
                              disabled={deleteLoading}
                            >
                              {deleteLoading ? 'Deleting…' : 'Confirm Delete'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                Showing {from}–{to} of {total} posts
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  style={{ padding: '6px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: page === 0 ? t.textMuted : t.text, fontSize: 12, cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: 12, color: t.textMuted }}>{page + 1} / {totalPages || 1}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: page >= totalPages - 1 ? t.textMuted : t.text, fontSize: 12, cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </Layout>
  );
}

export async function getServerSideProps() { return { props: {} }; }
