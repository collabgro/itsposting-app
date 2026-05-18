import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Card, Button, SectionHeader, EmptyState } from '../components/ui';
import { useTheme } from '../lib/theme';
import { workspacesAPI, authAPI, customerAPI } from '../lib/api';
import {
  IpTeam, IpPlus, IpSparkle, IpDelete, IpEdit, IpClose, IpCheck, IpWarning, IpInfo,
  IpBilling, IpCheckCircle, IpSettings,
} from '../components/icons';

const PLAN_LABELS = { trial: 'Free Trial', starter: 'Starter', professional: 'Professional', premium: 'Premium' };
const WORKSPACE_LIMITS = { trial: 1, starter: 1, professional: 2, premium: 3 };
const NEXT_PLAN = { starter: 'Professional', professional: 'Premium', premium: null };
const INDUSTRIES = [
  'plumbing', 'hvac', 'roofing', 'concrete', 'landscaping',
  'electrical', 'painting', 'pest_control', 'general_contractor', 'cleaning',
];

// ─── Permission model ────────────────────────────────────────────────────────

const ROLE_DEFAULTS = {
  manager: { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, reports:true, geo_audit:true, inbox:true, receptionist:true, contacts:true, knowledge_base:true, settings:true },
  editor:  { wizard:true, upload:true, calendar:true, history:true, media:true, studio:true, analytics:true, reports:false, geo_audit:false, inbox:true, receptionist:false, contacts:false, knowledge_base:false, settings:false },
  viewer:  { wizard:false, upload:false, calendar:true, history:true, media:false, studio:false, analytics:true, reports:true, geo_audit:false, inbox:false, receptionist:false, contacts:false, knowledge_base:false, settings:false },
};

const ROLE_META = {
  manager: { label: 'Manager',  color: '#7C5CFC', bg: 'rgba(124,92,252,0.12)', desc: 'Full access to all modules (billing excluded)' },
  editor:  { label: 'Editor',   color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', desc: 'Create content, manage inbox and analytics' },
  viewer:  { label: 'Viewer',   color: '#64748B', bg: 'rgba(100,116,139,0.12)', desc: 'Read-only: calendar, history, analytics, reports' },
};

const MODULES = [
  { group: 'Content',     items: [
    { id: 'wizard',        label: 'Post Wizard' },
    { id: 'upload',        label: 'Create & Upload' },
    { id: 'calendar',      label: 'Calendar' },
    { id: 'history',       label: 'History & Drafts' },
    { id: 'media',         label: 'Media Library' },
    { id: 'studio',        label: 'Photo Studio' },
  ]},
  { group: 'Insights',    items: [
    { id: 'analytics',     label: 'Analytics' },
    { id: 'reports',       label: 'Reports & ROI' },
    { id: 'geo_audit',     label: 'GEO Audit' },
  ]},
  { group: 'Engagement',  items: [
    { id: 'inbox',         label: 'Inbox & DMs' },
    { id: 'receptionist',  label: 'AI Receptionist' },
    { id: 'contacts',      label: 'Contacts' },
  ]},
  { group: 'Settings',    items: [
    { id: 'knowledge_base', label: 'Teach PostCore' },
    { id: 'settings',      label: 'Business Settings' },
  ]},
];

function effectivePermissions(member) {
  if (member.workspace_permissions) return member.workspace_permissions;
  return ROLE_DEFAULTS[member.workspace_role || 'editor'];
}

function enabledCount(member) {
  const perms = effectivePermissions(member);
  return Object.values(perms).filter(Boolean).length;
}

function isCustom(role, permissions) {
  if (!permissions) return false;
  const defaults = ROLE_DEFAULTS[role || 'editor'];
  return Object.keys(defaults).some(k => defaults[k] !== permissions[k]);
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel, danger }) {
  const { t } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28, maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <IpWarning size={22} color={danger ? '#ef4444' : '#F59E0B'} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: t.text }}>{title}</p>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} style={{ background: danger ? '#ef4444' : undefined, borderColor: danger ? '#ef4444' : undefined }}>
            {danger ? 'Remove' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Create workspace modal ──────────────────────────────────────────────────

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
            <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Mike's Plumbing — North Branch"
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 6, fontWeight: 600 }}>Industry</label>
            <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: t.textSecondary, marginBottom: 6, fontWeight: 600 }}>Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Austin, TX"
              style={{ width: '100%', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
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

// ─── Invite modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }) {
  const { t } = useTheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      await customerAPI.invite({ email: email.trim() });
      setSent(true);
      onInvited && onInvited(email.trim());
      setTimeout(onClose, 2800);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.32)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>Invite a team member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4 }}><IpClose size={18} /></button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          They'll receive a signup link. Once registered they'll appear as a team member you can manage.
        </p>
        {sent ? (
          <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#22c55e', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            Invite sent to {email}
          </div>
        ) : (
          <>
            <input type="email" placeholder="colleague@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, outline: 'none', marginBottom: 12 }} />
            {error && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#ef4444' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSend} disabled={sending || !email.trim()}
                style={{ flex: 1, padding: '11px 0', background: t.primary, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: sending || !email.trim() ? 'not-allowed' : 'pointer', opacity: sending || !email.trim() ? 0.6 : 1 }}>
                {sending ? 'Sending…' : 'Send invite'}
              </button>
              <button onClick={onClose} style={{ padding: '11px 16px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Member permission modal ─────────────────────────────────────────────────

function MemberPermissionModal({ member, onClose, onSave, onRemove }) {
  const { t } = useTheme();
  const [role, setRole] = useState(member.workspace_role || 'editor');
  const [permissions, setPermissions] = useState(member.workspace_permissions || null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');

  // Effective permissions for the checkboxes (role defaults when no custom override)
  const effectivePerms = permissions || ROLE_DEFAULTS[role];

  function handleRoleSelect(newRole) {
    setRole(newRole);
    setPermissions(null); // reset custom overrides when role changes
  }

  function toggleModule(modId) {
    const base = permissions || ROLE_DEFAULTS[role];
    const updated = { ...base, [modId]: !base[modId] };
    setPermissions(updated);
  }

  const hasCustom = isCustom(role, permissions);
  const totalEnabled = Object.values(effectivePerms).filter(Boolean).length;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await workspacesAPI.updateMember(member.id, {
        role,
        permissions: permissions || null,
      });
      onSave({ ...member, workspace_role: role, workspace_permissions: permissions });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await workspacesAPI.removeMember(member.id);
      onRemove(member.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
      setSaving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.36)' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(member.business_name || member.email || 'M').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.business_name || 'Team member'}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, flexShrink: 0 }}><IpClose size={20} /></button>
        </div>

        <div style={{ padding: '22px 24px' }}>

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Role</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {Object.entries(ROLE_META).map(([key, meta]) => {
                const active = role === key;
                return (
                  <button key={key} onClick={() => handleRoleSelect(key)}
                    style={{ padding: '12px 10px', borderRadius: 10, border: `2px solid ${active ? meta.color : t.border}`, background: active ? meta.bg : t.input, cursor: 'pointer', textAlign: 'left', transition: 'all 160ms ease' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? meta.color : t.text, marginBottom: 4 }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{meta.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module access matrix */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Module access</div>
              {hasCustom && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}>Custom</span>
              )}
              <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 'auto' }}>{totalEnabled} / 14 enabled</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              {MODULES.map(({ group, items }) => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{group}</div>
                  {items.map(({ id, label }) => {
                    const enabled = effectivePerms[id] !== false;
                    return (
                      <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer' }}>
                        <div
                          onClick={() => toggleModule(id)}
                          style={{
                            width: 18, height: 18, borderRadius: 5, border: `2px solid ${enabled ? t.primary : t.border}`,
                            background: enabled ? t.primary : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, cursor: 'pointer', transition: 'all 140ms ease',
                          }}
                        >
                          {enabled && <IpCheck size={11} color="#fff" />}
                        </div>
                        <span style={{ fontSize: 13, color: enabled ? t.text : t.textMuted, transition: 'color 140ms ease', userSelect: 'none' }}>{label}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 12px', background: t.input, borderRadius: 8, border: `1px solid ${t.border}`, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Billing is always hidden from team members regardless of role.</span>
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 14px' }}>{error}</p>}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setConfirmRemove(true)} disabled={saving}
              style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Remove member
            </button>
            <div style={{ flex: 1 }} />
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmModal
          danger
          title="Remove this team member?"
          message={`${member.business_name || member.email} will lose access to your account. Their personal account remains intact.`}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

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

  // Team Members tab state
  const [activeTab, setActiveTab] = useState('workspaces');
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    Promise.all([authAPI.verify(), workspacesAPI.list()])
      .then(([authRes, wsRes]) => {
        setCurrentUserId(authRes.data?.id || authRes.data?.customer?.id);
        setData(wsRes.data);
      })
      .catch(() => setError('Failed to load workspaces'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'team' || members.length > 0 || membersLoading) return;
    setMembersLoading(true);
    workspacesAPI.getMembers()
      .then(r => setMembers(r.data.members || []))
      .catch(() => setError('Failed to load team members'))
      .finally(() => setMembersLoading(false));
  }, [activeTab]);

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

  function handleMemberSaved(updated) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    setEditingMember(null);
    setSuccessMsg('Team member updated.');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function handleMemberRemoved(id) {
    setMembers(prev => prev.filter(m => m.id !== id));
    setEditingMember(null);
    setSuccessMsg('Team member removed.');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function handleInvited(email) {
    setPendingInvites(prev => [...prev, email]);
  }

  if (loading) {
    return <Layout><div style={{ padding: 32, color: '#888', fontSize: 14 }}>Loading…</div></Layout>;
  }

  const nextPlan = NEXT_PLAN[mainAccount?.plan];

  return (
    <Layout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <SectionHeader
            title="Workspaces & Team"
            subtitle="Manage business workspaces and control team member access"
            icon={IpTeam}
          />
          {activeTab === 'workspaces' && canAddMore && isOnMainAccount && (
            <Button onClick={() => setShowCreate(true)} icon={<IpPlus size={15} />}>Add Workspace</Button>
          )}
          {activeTab === 'team' && isOnMainAccount && (
            <Button onClick={() => setShowInvite(true)} icon={<IpPlus size={15} />}>Invite member</Button>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: t.input, borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {[
            { key: 'workspaces', label: `Workspaces (${totalUsed})` },
            { key: 'team',       label: `Team Members (${members.length + pendingInvites.length})` },
          ].map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 18px', borderRadius: 7, border: `1px solid ${active ? t.primaryBorder : 'transparent'}`, background: active ? t.primaryBg : 'transparent', color: active ? t.primary : t.textSecondary, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 160ms ease' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Global messages */}
        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, marginBottom: 18, fontSize: 13, color: '#22c55e' }}>
            <IpCheckCircle size={16} /> {successMsg}
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 18, fontSize: 13, color: '#ef4444' }}>
            <IpWarning size={16} /> {error}
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><IpClose size={14} /></button>
          </div>
        )}

        {/* ── WORKSPACES TAB ── */}
        {activeTab === 'workspaces' && (
          <>
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
                    <Button variant="secondary" onClick={() => handleSwitch('main')} disabled={switching === 'main'}>
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
                  subtitle={canAddMore && isOnMainAccount ? 'Create a workspace to manage multiple businesses or locations under one account.' : !canAddMore ? `Upgrade to ${nextPlan || 'a higher plan'} to add workspaces.` : 'Workspaces can only be created from the main account.'}
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
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(ws.id); if (e.key === 'Escape') setEditingId(null); }}
                          style={{ background: t.input, border: `1px solid ${t.primaryBorder}`, borderRadius: 6, padding: '6px 10px', color: t.text, fontSize: 14, outline: 'none', width: 200 }} />
                        <button onClick={() => handleRename(ws.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e' }}><IpCheck size={18} /></button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><IpClose size={18} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{ws.workspace_display_name || ws.business_name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,92,252,0.12)', color: t.primary }}>Workspace</span>
                        {ws.id === currentUserId && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.primaryBg, color: t.primary }}>Active</span>}
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
                        <button onClick={() => { setEditingId(ws.id); setEditName(ws.workspace_display_name || ws.business_name || ''); }} title="Rename"
                          style={{ width: 34, height: 34, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <IpEdit size={15} />
                        </button>
                        <button onClick={() => setConfirmDelete(ws.id)} title="Delete workspace"
                          style={{ width: 34, height: 34, borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: t.text }}>Workspace limit reached ({totalUsed} / {planLimit})</p>
                    <p style={{ margin: 0, fontSize: 12, color: t.textSecondary }}>Upgrade to {nextPlan} to add more workspaces.</p>
                  </div>
                  <Button onClick={() => router.push('/billing')} icon={<IpBilling size={15} />}>Upgrade to {nextPlan}</Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── TEAM MEMBERS TAB ── */}
        {activeTab === 'team' && (
          <>
            {/* Info banner */}
            <div style={{ background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 24 }}>
              <IpInfo size={16} color={t.primary} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
                Team members share access to your account. You control exactly which modules they can use. Billing is always hidden from team members.
              </p>
            </div>

            {membersLoading && (
              <div style={{ padding: '20px 0', color: t.textMuted, fontSize: 14 }}>Loading team members…</div>
            )}

            {/* Pending invites (optimistic) */}
            {pendingInvites.map(email => (
              <Card key={email} style={{ marginBottom: 12, opacity: 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: t.input, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.textMuted, flexShrink: 0 }}>?</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Invite sent — waiting for signup</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}>Pending</span>
                </div>
              </Card>
            ))}

            {/* Active members */}
            {!membersLoading && members.length === 0 && pendingInvites.length === 0 && (
              <Card>
                <EmptyState
                  icon={IpTeam}
                  title="No team members yet"
                  subtitle="Invite a colleague, employee, or VA to help manage your social media."
                  action={isOnMainAccount ? <Button onClick={() => setShowInvite(true)} icon={<IpPlus size={15} />}>Invite someone</Button> : null}
                />
              </Card>
            )}

            {members.map(member => {
              const rm = ROLE_META[member.workspace_role || 'editor'];
              const count = enabledCount(member);
              const custom = isCustom(member.workspace_role, member.workspace_permissions);
              return (
                <Card key={member.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(member.business_name || member.email || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.business_name || 'Team member'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: rm.bg, color: rm.color }}>{rm.label}</span>
                        {custom && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}>Custom</span>}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
                        {member.email}
                        {' · '}Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        {' · '}{count} / 14 modules
                      </div>
                    </div>
                    {isOnMainAccount && (
                      <button
                        onClick={() => setEditingMember(member)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.input, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 140ms ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.primaryBorder; e.currentTarget.style.color = t.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
                      >
                        <IpSettings size={13} /> Manage
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </>
        )}

      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={handleInvited} />}
      {editingMember && (
        <MemberPermissionModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleMemberSaved}
          onRemove={handleMemberRemoved}
        />
      )}
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
