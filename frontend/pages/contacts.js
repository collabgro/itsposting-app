import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../lib/theme';
import { contactsAPI, dmsAPI } from '../lib/api';
import {
  IpTeam, IpPlus, IpSearch, IpEdit, IpDelete, IpFacebook,
  IpInstagram, IpClose, IpCheck, IpUser,
} from '../components/icons';

// ── Helpers ──────────────────────────────────────────────────────────────────

const LEAD_STATUSES = [
  { key: 'new', label: 'New', color: '#3B82F6' },
  { key: 'contacted', label: 'Contacted', color: '#8B5CF6' },
  { key: 'quoted', label: 'Quoted', color: '#F59E0B' },
  { key: 'customer', label: 'Customer', color: '#10B981' },
  { key: 'lost', label: 'Lost', color: '#6B7280' },
];

function LeadBadge({ status, t }) {
  const s = LEAD_STATUSES.find(x => x.key === status) || LEAD_STATUSES[0];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600,
      background: `${s.color}18`, color: s.color,
      border: `1px solid ${s.color}33`,
    }}>
      {s.label}
    </span>
  );
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

// ── Add/Edit Contact Modal ────────────────────────────────────────────────────

function ContactModal({ contact, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    notes: contact?.notes || '',
    leadStatus: contact?.lead_status || 'new',
    jobType: contact?.job_type || '',
    estimatedJobValue: contact?.estimated_job_value || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      if (contact?.id) {
        const res = await contactsAPI.update(contact.id, { ...form, estimatedJobValue: form.estimatedJobValue ? parseFloat(form.estimatedJobValue) : null });
        onSave(res.data.contact);
      } else {
        const res = await contactsAPI.create({ ...form, estimatedJobValue: form.estimatedJobValue ? parseFloat(form.estimatedJobValue) : null });
        onSave(res.data.contact);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  const field = (label, key, type = 'text', opts = {}) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 5 }}>{label}</label>
      {opts.textarea ? (
        <textarea
          value={form[key]}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          rows={3}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      ) : opts.select ? (
        <select
          value={form[key]}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        >
          {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: t.input, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>{contact?.id ? 'Edit Contact' : 'Add Contact'}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 20 }}>×</button>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 12 }}>
            {error}
          </div>
        )}

        {field('Name *', 'name')}
        {field('Phone', 'phone', 'tel')}
        {field('Email', 'email', 'email')}
        {field('Lead Status', 'leadStatus', 'text', { select: true })}
        {field('Job Type (e.g. Driveway seal coat)', 'jobType')}
        {field('Estimated Job Value ($)', 'estimatedJobValue', 'number')}
        {field('Notes', 'notes', 'text', { textarea: true })}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 6, background: t.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Detail Drawer ─────────────────────────────────────────────────────

function ContactDrawer({ contact, onClose, onUpdate, onDelete, t }) {
  const [conversations, setConversations] = useState([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (contact) {
      contactsAPI.get(contact.id).then(res => {
        setConversations(res.data.conversations || []);
      }).catch(() => {});
    }
  }, [contact?.id]);

  if (!contact) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ width: 380, background: t.card, borderLeft: `1px solid ${t.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: '#fff' }}>
                {(contact.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{contact.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <LeadBadge status={contact.lead_status} t={t} />
                  {contact.is_customer && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,0.12)', padding: '2px 6px', borderRadius: 4 }}>Customer</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 18 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(true)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, background: t.primaryBg, border: `1px solid ${t.primaryBorder}`, color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Edit
            </button>
            <button onClick={() => onDelete(contact.id)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
          {[
            { label: 'Phone', value: contact.phone },
            { label: 'Email', value: contact.email },
            { label: 'Job Type', value: contact.job_type },
            { label: 'Est. Value', value: contact.estimated_job_value ? `$${parseFloat(contact.estimated_job_value).toLocaleString()}` : null },
            { label: 'Source', value: contact.source_platform || contact.source },
            { label: 'First Contact', value: contact.first_contact_at ? new Date(contact.first_contact_at).toLocaleDateString() : null },
          ].filter(r => r.value).map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>{row.label}</span>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}

          {contact.facebook_psid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1877F2', marginTop: 4 }}>
              <IpFacebook size={12} /> Facebook connected
            </div>
          )}
          {contact.instagram_igsid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#E1306C', marginTop: 4 }}>
              <IpInstagram size={12} /> Instagram connected
            </div>
          )}
        </div>

        {/* Notes */}
        {contact.notes && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>NOTES</div>
            <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{contact.notes}</div>
          </div>
        )}

        {/* Conversations */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>
            CONVERSATIONS ({conversations.length})
          </div>
          {conversations.length === 0 ? (
            <div style={{ fontSize: 12, color: t.textMuted }}>No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div key={conv.id} style={{ padding: '8px 10px', borderRadius: 6, background: t.input, marginBottom: 6, border: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{conv.platform}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{timeAgo(conv.last_message_at)}</span>
                </div>
                {conv.last_message_preview && (
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message_preview}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <ContactModal
          contact={contact}
          t={t}
          onClose={() => setEditing(false)}
          onSave={updated => { setEditing(false); onUpdate(updated); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { t } = useTheme();

  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => { load(); }, [page, search, leadFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (leadFilter) params.leadStatus = leadFilter;
      const res = await contactsAPI.list(params);
      setContacts(res.data.contacts || []);
      setTotal(res.data.total || 0);
    } catch (_) {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(newContact) {
    setContacts(prev => [newContact, ...prev]);
    setTotal(prev => prev + 1);
    setShowAdd(false);
  }

  function handleUpdate(updated) {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedContact(updated);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    try {
      await contactsAPI.delete(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      setTotal(prev => prev - 1);
      setSelectedContact(null);
    } catch (_) {}
  }

  async function handleStatusChange(id, newStatus) {
    try {
      const res = await contactsAPI.update(id, { leadStatus: newStatus });
      setContacts(prev => prev.map(c => c.id === id ? res.data.contact : c));
    } catch (_) {}
  }

  return (
    <Layout
      title="Contacts"
      subtitle={`${total} contact${total !== 1 ? 's' : ''} from DMs and manual adds`}
      action={
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <IpPlus size={14} /> Add Contact
        </button>
      }
    >
      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <IpSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = t.primary}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>Status:</span>
          {[{ key: '', label: 'All' }, ...LEAD_STATUSES].map(s => (
            <button
              key={s.key}
              onClick={() => { setLeadFilter(s.key); setPage(1); }}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: leadFilter === s.key ? 600 : 400,
                background: leadFilter === s.key ? t.primaryBg : 'transparent',
                color: leadFilter === s.key ? t.primary : t.textMuted,
                border: leadFilter === s.key ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 110px 90px 80px', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.sidebar }}>
          {['Contact', 'Platform', 'Phone', 'Job Type', 'Value', 'Status'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>Loading…</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <IpTeam size={48} style={{ color: t.textMuted, margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>No contacts yet</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
              Contacts are created automatically from DMs, or you can add them manually.
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{ padding: '8px 18px', borderRadius: 8, background: t.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Add your first contact
            </button>
          </div>
        ) : (
          contacts.map((contact, i) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 110px 110px 90px 80px',
                gap: 0,
                padding: '12px 16px',
                borderBottom: i < contacts.length - 1 ? `1px solid ${t.border}` : 'none',
                cursor: 'pointer',
                transition: 'background 100ms',
                alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.cardHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Contact name + meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #5B3FF0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                  {(contact.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {contact.total_conversations > 0 ? `${contact.total_conversations} conv` : 'No conversations'} · {timeAgo(contact.last_contact_at)}
                  </div>
                </div>
              </div>

              {/* Platform */}
              <div style={{ display: 'flex', gap: 4 }}>
                {contact.facebook_psid && <IpFacebook size={14} style={{ color: '#1877F2' }} />}
                {contact.instagram_igsid && <IpInstagram size={14} style={{ color: '#E1306C' }} />}
                {!contact.facebook_psid && !contact.instagram_igsid && (
                  <span style={{ fontSize: 11, color: t.textMuted }}>Manual</span>
                )}
              </div>

              {/* Phone */}
              <div style={{ fontSize: 12, color: t.text }}>{contact.phone || '—'}</div>

              {/* Job Type */}
              <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {contact.job_type || '—'}
              </div>

              {/* Value */}
              <div style={{ fontSize: 12, color: t.text, fontWeight: contact.estimated_job_value ? 600 : 400 }}>
                {contact.estimated_job_value ? `$${parseFloat(contact.estimated_job_value).toLocaleString()}` : '—'}
              </div>

              {/* Status */}
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={contact.lead_status}
                  onChange={e => handleStatusChange(contact.id, e.target.value)}
                  style={{
                    padding: '3px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: 'transparent', border: 'none', cursor: 'pointer', color: LEAD_STATUSES.find(s => s.key === contact.lead_status)?.color || t.text,
                    outline: 'none',
                  }}
                >
                  {LEAD_STATUSES.map(s => (
                    <option key={s.key} value={s.key} style={{ color: t.text, background: t.card }}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total} contacts
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '6px 12px', borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: page === 1 ? t.textMuted : t.text, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * 25 >= total}
              style={{ padding: '6px 12px', borderRadius: 6, background: t.card, border: `1px solid ${t.border}`, color: page * 25 >= total ? t.textMuted : t.text, fontSize: 12, cursor: page * 25 >= total ? 'not-allowed' : 'pointer' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <ContactModal
          t={t}
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
        />
      )}

      {selectedContact && (
        <ContactDrawer
          contact={selectedContact}
          t={t}
          onClose={() => setSelectedContact(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </Layout>
  );
}
