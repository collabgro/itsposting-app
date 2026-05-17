import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Card, Button, SectionHeader, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { workspacesAPI, authAPI } from '../lib/api';
import {
  IpTeam, IpPlus, IpSparkle, IpDelete, IpEdit, IpClose, IpCheck, IpWarning, IpInfo,
  IpBilling, IpCheckCircle,
} from '../components/icons';

const PLAN_LABELS = { trial: 'Free Trial', starter: 'Starter', professional: 'Professional', premium: 'Premium' };
const WORKSPACE_LIMITS = { trial: 1, starter: 1, professional: 2, premium: 3 };
const NEXT_PLAN = { starter: 'Professional', professional: 'Premium', premium: null };
const INDUSTRIES = [
  'plumbing', 'hvac', 'roofing', 'concrete', 'landscaping',
  'electrical', 'painting', 'pest_control', 'general_contractor', 'cleaning',
];

function ConfirmModal({ title, message, onConfirm, onCancel, danger }) {
  const { t } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28, maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <IpWarning size={22} color={danger ? '#ef4444' : t.warning} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: t.text }}>{title}</p>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} style={{ background: danger ? '#ef4444' : undefined, borderColor: danger ? '#ef4444' : undefined }}>
            {danger ? 'Delete' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreate }) {
  const { t } = useTheme();
  const [form, setForm] = useState({ businessName: '', industry: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!form.businessName.trim()) { setError('Business name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await workspacesAPI.create({
        businessName: form.businessName,
        industry: form.industry,
        location: form.location,
      });
      onCreate(data.workspace);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28, maxWidth: 440, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Create New Workspace</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={18} /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 6, fontWeight: 600 }}>Business Name *</label>
            <input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="e.g. Mike's Plumbing — North Branch"
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 6, fontWeight: 600 }}>Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 6, fontWeight: 600 }}>Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Austin, TX"
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving} icon={<IpPlus size={15} />}>
            {saving ? 'Creating…' : 'Create Workspace'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  const { t } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([
      authAPI.verify(),
      workspacesAPI.list(),
    ]).then(([authRes, wsRes]) => {
      setCurrentUserId(authRes.data?.id || authRes.data?.customer?.id);
      setData(wsRes.data);
    }).catch(() => setError('Failed to load workspaces')).finally(() => setLoading(false));
  }, []);

  const mainAccount = data?.mainAccount;
  const workspaces = (data?.workspaces || []).filter((w) => w.status !== 'inactive');
  const planLimit = data?.planLimit || 1;
  const totalUsed = workspaces.length + 1;
  const canAddMore = totalUsed < planLimit;
  const isOnMainAccount = mainAccount?.id === currentUserId;

  async function handleSwitch(wsId) {
    setSwitching(wsId);
    try {
      const res = wsId === 'main' ? await workspacesAPI.switchToMain() : await workspacesAPI.switchTo(wsId);
      localStorage.setItem('token', res.data.token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to switch workspace. Please try again.');
      setSwitching(null);
    }
  }

  async function handleDelete(wsId) {
    try {
      await workspacesAPI.remove(wsId);
      setData((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) => w.id === wsId ? { ...w, status: 'inactive' } : w),
      }));
      setSuccessMsg('Workspace deleted.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setError('Failed to delete workspace');
    }
    setConfirmDelete(null);
  }

  async function handleRename(wsId) {
    if (!editName.trim()) return;
    try {
      const { data: res } = await workspacesAPI.rename(wsId, editName);
      setData((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) => w.id === wsId ? { ...w, ...res.workspace } : w),
      }));
      setSuccessMsg('Workspace renamed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch { setError('Failed to rename workspace'); }
    setEditingId(null);
  }

  function handleCreated(newWs) {
    setData((prev) => ({ ...prev, workspaces: [...(prev.workspaces || []), newWs] }));
    setShowCreate(false);
    setSuccessMsg('Workspace created successfully.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  if (loading) {
    return <Layout><div style={{ padding: 32, color: '#888', fontSize: 14 }}>Loading workspaces…</div></Layout>;
  }

  const nextPlan = NEXT_PLAN[mainAccount?.plan];

  return (
    <Layout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <SectionHeader
            title="Workspaces"
            subtitle={`${totalUsed} of ${planLimit} workspace${planLimit !== 1 ? 's' : ''} used on ${PLAN_LABELS[mainAccount?.plan] || 'your plan'}`}
            icon={IpTeam}
          />
          {canAddMore && isOnMainAccount && (
            <Button onClick={() => setShowCreate(true)} icon={<IpPlus size={15} />}>Add Workspace</Button>
          )}
        </div>

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${t.success}1a`, border: `1px solid ${t.success}33`, borderRadius: 8, marginBottom: 18, fontSize: 13, color: t.success }}>
            <IpCheckCircle size={16} /> {successMsg}
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${t.error}1a`, border: `1px solid ${t.error}33`, borderRadius: 8, marginBottom: 18, fontSize: 13, color: t.error }}>
            <IpWarning size={16} /> {error}
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: t.error }}><IpClose size={14} /></button>
          </div>
        )}

        {/* Credit pool info */}
        <div style={{ background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 24 }}>
          <IpInfo size={16} color={t.primary} style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            All workspaces share the same credit pool from your main account.
            Credits are always deducted from <strong style={{ color: t.text }}>{mainAccount?.business_name || 'the main account'}</strong> regardless of which workspace generates content.
          </p>
        </div>

        {/* Main account card */}
        {mainAccount && (
          <Card style={{ marginBottom: 14, borderColor: mainAccount.id === currentUserId ? t.primaryBorder : t.border, borderWidth: mainAccount.id === currentUserId ? 2 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #FB923C, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(mainAccount.business_name || 'M').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{mainAccount.business_name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,146,60,0.15)', color: '#FB923C' }}>Main account</span>
                  {mainAccount.id === currentUserId && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.primaryBg, color: t.primary }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                  {[mainAccount.industry?.replace('_', ' '), mainAccount.location].filter(Boolean).join(' · ') || 'No industry set'}
                  {' · '}
                  <span style={{ color: t.primary, fontWeight: 600 }}>{mainAccount.credits_balance ?? 0} credits</span>
                </div>
              </div>
              {mainAccount.id !== currentUserId && (
                <Button
                  variant="secondary"
                  onClick={() => handleSwitch('main')}
                  disabled={switching === 'main'}
                >
                  {switching === 'main' ? 'Switching…' : 'Switch here'}
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Workspace cards */}
        {workspaces.length === 0 && (
          <Card style={{ marginBottom: 14 }}>
            <EmptyState
              icon={IpTeam}
              title="No workspaces yet"
              subtitle={
                canAddMore && isOnMainAccount
                  ? 'Create a workspace to manage multiple businesses or locations under one account.'
                  : !canAddMore
                  ? `Upgrade to ${nextPlan || 'a higher plan'} to add workspaces.`
                  : 'Workspaces can only be created from the main account.'
              }
              action={canAddMore && isOnMainAccount ? <Button onClick={() => setShowCreate(true)} icon={<IpPlus size={15} />}>Create Workspace</Button> : null}
            />
          </Card>
        )}

        {workspaces.map((ws) => (
          <Card key={ws.id} style={{ marginBottom: 14, borderColor: ws.id === currentUserId ? t.primaryBorder : t.border, borderWidth: ws.id === currentUserId ? 2 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(ws.workspace_display_name || ws.business_name || 'W').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === ws.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(ws.id); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ background: t.input, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '6px 10px', color: t.text, fontSize: 14, outline: 'none', width: 200 }}
                    />
                    <button onClick={() => handleRename(ws.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.success }}><IpCheck size={18} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={18} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{ws.workspace_display_name || ws.business_name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,92,252,0.12)', color: t.primary }}>Workspace</span>
                    {ws.id === currentUserId && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.primaryBg, color: t.primary }}>Active</span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                  {[ws.industry?.replace('_', ' '), ws.location].filter(Boolean).join(' · ') || 'No industry set'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {ws.id !== currentUserId && (
                  <Button variant="secondary" onClick={() => handleSwitch(ws.id)} disabled={switching === ws.id}>
                    {switching === ws.id ? 'Switching…' : 'Switch'}
                  </Button>
                )}
                {isOnMainAccount && editingId !== ws.id && (
                  <>
                    <button
                      onClick={() => { setEditingId(ws.id); setEditName(ws.workspace_display_name || ws.business_name || ''); }}
                      title="Rename"
                      style={{ width: 34, height: 34, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <IpEdit size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(ws.id)}
                      title="Delete workspace"
                      style={{ width: 34, height: 34, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <IpDelete size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Upgrade prompt when at limit */}
        {!canAddMore && nextPlan && isOnMainAccount && (
          <Card style={{ background: t.primaryBg, borderColor: t.primaryBorder }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <IpSparkle size={20} color={t.primary} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: t.text }}>
                  Workspace limit reached ({totalUsed} / {planLimit})
                </p>
                <p style={{ margin: 0, fontSize: 12, color: t.textSecondary }}>
                  Upgrade to {nextPlan} to add more workspaces.
                </p>
              </div>
              <Button onClick={() => router.push('/billing')} icon={<IpBilling size={15} />}>
                Upgrade to {nextPlan}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
      {confirmDelete && (
        <ConfirmModal
          danger
          title="Delete this workspace?"
          message="All posts, social accounts, and content in this workspace will be removed. This cannot be undone."
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  );
}
