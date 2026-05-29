import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  IpCheck, IpClose, IpEdit, IpSparkle, IpWarning,
  IpFacebook, IpInstagram, IpGoogle, IpLinkedIn, IpTikTok,
} from '../components/icons';
import Layout from '../components/Layout';
import { Button, EmptyState, Spinner, SkeletonPage, useToast } from '../components/ui';
import { useTheme } from '../lib/theme';
import { postsAPI } from '../lib/api';

const PLATFORM_ICONS = {
  facebook:       { icon: IpFacebook, color: '#1877F2' },
  instagram:      { icon: IpInstagram, color: '#E1306C' },
  google_business:{ icon: IpGoogle,   color: '#34A853' },
  linkedin:       { icon: IpLinkedIn, color: '#0A66C2' },
  tiktok:         { icon: IpTikTok,   color: '#000000' },
};

function parsePlatforms(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { t } = useTheme();
  const { showToast } = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // postId
  const [changesModal, setChangesModal] = useState(null); // { postId, mode: 'changes'|'reject' }
  const [changesNote, setChangesNote] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await postsAPI.getPendingApproval();
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch { showToast('Failed to load pending posts', 'error'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (postId) => {
    setProcessing(postId);
    try {
      await postsAPI.approve(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showToast('Post approved', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Failed to approve', 'error'); }
    finally { setProcessing(null); }
  };

  const handleSubmitNote = async () => {
    if (!changesModal) return;
    const { postId, mode } = changesModal;
    setProcessing(postId);
    try {
      if (mode === 'reject') {
        await postsAPI.rejectApproval(postId, changesNote);
        showToast('Post rejected', 'error');
      } else {
        await postsAPI.requestChanges(postId, changesNote);
        showToast('Changes requested', 'success');
      }
      setPosts(prev => prev.filter(p => p.id !== postId));
      setChangesModal(null);
      setChangesNote('');
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setProcessing(null); }
  };

  const gc = {
    background: t.isDark ? 'rgba(15,15,24,0.72)' : t.card,
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : t.border}`,
    borderRadius: 18, padding: 24,
    boxShadow: `${t.shadowSm}, inset 0 1px 0 rgba(255,255,255,${t.isDark ? '0.04' : '0.8'})`,
    marginBottom: 16,
  };

  return (
    <Layout title="Approvals" subtitle="Review posts submitted by your workspace members">
      {loading ? (
        <SkeletonPage rows={4} cards={3} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={IpCheck}
          title="All caught up!"
          subtitle="No posts pending review. When workspace members submit posts, they'll appear here."
          action={{ label: 'View all posts', onClick: () => router.push('/history') }}
        />
      ) : (
        <div>
          <div style={{ marginBottom: 20, fontSize: 13, color: t.textMuted }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} waiting for your review
          </div>

          {posts.map(post => {
            const platforms = parsePlatforms(post.platforms);
            const isWorking = processing === post.id;
            return (
              <div key={post.id} style={gc}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: 6 }}>
                        Pending Review
                      </span>
                      {platforms.map(pid => {
                        const pm = PLATFORM_ICONS[pid];
                        if (!pm) return null;
                        const PI = pm.icon;
                        return <PI key={pid} size={14} style={{ color: pm.color }} title={pid} />;
                      })}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>
                      {post.business_name || post.workspace_display_name || 'Workspace member'}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  {post.media_url && (
                    <img
                      src={post.media_url}
                      alt=""
                      style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${t.border}` }}
                      onError={e => (e.target.style.display = 'none')}
                    />
                  )}
                </div>

                {post.caption && (
                  <div style={{
                    fontSize: 13, color: t.text, lineHeight: 1.6,
                    background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.05)' : t.border}`,
                    borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                    maxHeight: 120, overflow: 'hidden', WebkitLineClamp: 5,
                    display: '-webkit-box', WebkitBoxOrient: 'vertical',
                  }}>
                    {post.caption}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(post.id)}
                    disabled={isWorking}
                    style={{ background: '#22C55E', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}
                  >
                    <IpCheck size={13} strokeWidth={3} />
                    {isWorking ? 'Approving…' : 'Approve'}
                  </Button>
                  <button
                    onClick={() => { setChangesModal({ postId: post.id, mode: 'changes' }); setChangesNote(''); }}
                    disabled={isWorking}
                    style={{ padding: '7px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: '#F59E0B', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <IpEdit size={12} /> Request Changes
                  </button>
                  <button
                    onClick={() => { setChangesModal({ postId: post.id, mode: 'reject' }); setChangesNote(''); }}
                    disabled={isWorking}
                    style={{ padding: '7px 14px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 8, color: '#FF453A', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <IpClose size={12} strokeWidth={2.5} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Changes / Reject note modal */}
      {changesModal && (
        <div
          onClick={() => setChangesModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: t.isDark ? 'rgba(12,12,20,0.97)' : t.card, border: `1px solid ${t.border}`, borderRadius: 18, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'scaleIn 200ms cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 6 }}>
              {changesModal.mode === 'reject' ? 'Reject Post' : 'Request Changes'}
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
              {changesModal.mode === 'reject'
                ? 'This will permanently reject the post. Add an optional note to explain why.'
                : 'Explain what changes are needed so the team member can update and resubmit.'}
            </div>
            <textarea
              value={changesNote}
              onChange={e => setChangesNote(e.target.value)}
              rows={4}
              placeholder={changesModal.mode === 'reject' ? 'Reason for rejection (optional)…' : 'What needs to change?…'}
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: t.text, lineHeight: 1.5, resize: 'vertical', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = t.primary)}
              onBlur={e => (e.target.style.borderColor = t.border)}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setChangesModal(null)}>Cancel</Button>
              <button
                onClick={handleSubmitNote}
                disabled={processing === changesModal.postId}
                style={{
                  padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: changesModal.mode === 'reject' ? '#FF453A' : '#F59E0B',
                  color: '#fff', opacity: processing === changesModal.postId ? 0.6 : 1,
                }}
              >
                {processing === changesModal.postId ? 'Submitting…' : (changesModal.mode === 'reject' ? 'Reject Post' : 'Request Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
