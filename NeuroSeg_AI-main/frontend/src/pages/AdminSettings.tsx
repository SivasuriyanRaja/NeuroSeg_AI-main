import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ShieldCheck, ShieldAlert, Users, UserPlus, Trash2, ArrowLeft,
  Search, RefreshCw, CheckCircle2, AlertCircle, HardDrive, Cpu,
  FolderOpen, Zap, Activity, UserCog, Stethoscope, FlaskConical, GraduationCap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAdminOverview, getAdminUsers, updateAdminUserRole,
  deleteAdminUser, createAdminUser, type AdminUser, type AdminOverview
} from '../api';

export default function AdminSettings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === 'admin';

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // New user modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPrefix, setNewPrefix] = useState('Dr.');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newProfession, setNewProfession] = useState('researcher');
  const [creating, setCreating] = useState(false);

  function notify(text: string, type: 'ok' | 'err' = 'ok') {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [ovRes, uRes] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
      ]);
      setOverview(ovRes.data);
      setUsers(uRes.data);
    } catch (err: any) {
      console.error(err);
      notify(err.response?.data?.detail || 'Failed to load administration data', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.profession.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleToggleRole(target: AdminUser) {
    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    const actionWord = nextRole === 'admin' ? 'promote' : 'demote';
    if (!window.confirm(`Are you sure you want to ${actionWord} ${target.email} to ${nextRole.toUpperCase()}?`)) {
      return;
    }
    try {
      await updateAdminUserRole(target.id, nextRole);
      notify(`Updated ${target.email} role to ${nextRole.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Role update failed', 'err');
    }
  }

  async function handleDeleteUser(target: AdminUser) {
    if (!window.confirm(`Are you sure you want to permanently delete user "${target.email}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteAdminUser(target.id);
      notify(`User ${target.email} was removed successfully`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.detail || 'User deletion failed', 'err');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createAdminUser({
        email: newEmail,
        password: newPassword,
        username: newUsername || newEmail.split('@')[0],
        prefix: newPrefix,
        profession: newProfession,
        role: newRole,
      });
      notify(`New ${newRole.toUpperCase()} user created: ${newEmail}`);
      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewUsername('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to create user', 'err');
    } finally {
      setCreating(false);
    }
  }

  // Unauthorized view
  if (!isAdmin) {
    return (
      <div className="page" style={{ maxWidth: 650, margin: '60px auto', textAlign: 'center' }}>
        <div className="card card-pad" style={{ padding: '48px 32px' }}>
          <div style={{
            width: 58, height: 58, borderRadius: 16, margin: '0 auto 18px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171'
          }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px' }}>
            Access Restricted
          </h2>
          <p style={{ color: '#8fa0b0', fontSize: 13, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px' }}>
            The Administration Control Center is reserved for verified system administrators only. Your current role is <strong>{user?.role || 'user'}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/settings" className="btn btn-secondary">
              <ArrowLeft size={14} /> Back to Settings
            </Link>
            <Link href="/dashboard" className="btn btn-primary">
              Return to Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link href="/settings" style={{ color: '#64748b', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={12} /> Settings
            </Link>
            <span style={{ color: '#334155' }}>/</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: '#0d9488', textTransform: 'uppercase' }}>
              ADMINISTRATION PORTAL
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Admin Control Center</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(13,148,136,0.2))',
              border: '1px solid rgba(13,148,136,0.35)', color: '#5eead4', letterSpacing: 1
            }}>
              MASTER ACCESS
            </span>
          </h1>
          <p style={{ color: '#64748b', marginTop: 6, fontSize: 13 }}>
            Manage platform users, roles, system health telemetries, and administrative controls.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} style={{ gap: 6 }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ gap: 6 }}>
            <UserPlus size={13} /> Add New User
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 20,
          background: statusMsg.type === 'ok' ? 'rgba(13,148,136,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${statusMsg.type === 'ok' ? 'rgba(13,148,136,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: statusMsg.type === 'ok' ? '#5eead4' : '#f87171',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5
        }}>
          {statusMsg.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="stat-grid" style={{ gap: 14, marginBottom: 24 }}>
        <div className="card card-pad" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11 }}>
            <span>Total Registered Users</span>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(13,148,136,0.12)', display: 'grid', placeItems: 'center', color: '#0d9488' }}>
              <Users size={14} />
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginTop: 10 }}>
            {overview?.total_users ?? users.length}
          </div>
          <div style={{ fontSize: 10, color: '#5eead4', marginTop: 4 }}>
            {overview?.total_admins ?? users.filter(u => u.role === 'admin').length} Administrator(s)
          </div>
        </div>

        <div className="card card-pad" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11 }}>
            <span>All Clinical Cases</span>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'grid', placeItems: 'center', color: '#6366f1' }}>
              <FolderOpen size={14} />
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginTop: 10 }}>
            {overview?.total_cases ?? 0}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
            Full system-wide scans
          </div>
        </div>

        <div className="card card-pad" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11 }}>
            <span>Active Inference Engine</span>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'grid', placeItems: 'center', color: '#f59e0b' }}>
              <Cpu size={14} />
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {overview?.active_engine || 'Fusion Engine v3.0'}
          </div>
          <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
            Online & Ready
          </div>
        </div>

        <div className="card card-pad" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11 }}>
            <span>System Storage Used</span>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(236,72,153,0.12)', display: 'grid', placeItems: 'center', color: '#ec4899' }}>
              <HardDrive size={14} />
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginTop: 10 }}>
            {overview?.storage_mb ?? 0} MB
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
            Uploads, results & models
          </div>
        </div>
      </div>

      {/* Main Users Table Section */}
      <section className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(141,164,183,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="section-title">User Accounts &amp; Permissions</div>
            <div className="section-sub">View, promote, demote, or manage workspace users</div>
          </div>

          <div className="cases-search-box" style={{ width: 280, maxWidth: '100%' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search users by name, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="control"
              style={{ width: '100%', paddingLeft: 34, height: 34, fontSize: 11.5 }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>USER / PROFILE</th>
                <th>EMAIL</th>
                <th>PROFESSION</th>
                <th>ROLE</th>
                <th>CASES</th>
                <th>DATE REGISTERED</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {loading ? 'Loading users...' : 'No matching users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isSelf = u.id === user?.id;
                  const isTargetAdmin = u.role === 'admin';
                  const initial = (u.username?.[0] || u.email[0] || 'U').toUpperCase();

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: isTargetAdmin ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'linear-gradient(135deg, #0f766e, #0d9488)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700
                          }}>
                            {initial}
                          </div>
                          <div>
                            <div className="table-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{u.display_name}</span>
                              {isSelf && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(13,148,136,0.15)', color: '#5eead4', fontWeight: 600 }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div className="activity-meta">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="table-mono" style={{ color: '#cbd5e1' }}>
                        {u.email}
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, color: '#94a3b8', textTransform: 'capitalize'
                        }}>
                          {u.profession === 'doctor' ? <Stethoscope size={13} color="#2dd4bf" /> :
                           u.profession === 'student' ? <GraduationCap size={13} color="#a78bfa" /> :
                           <FlaskConical size={13} color="#38bdf8" />}
                          {u.profession || 'Researcher'}
                        </span>
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: isTargetAdmin ? 'rgba(124,58,237,0.15)' : 'rgba(100,116,139,0.15)',
                          border: `1px solid ${isTargetAdmin ? 'rgba(124,58,237,0.3)' : 'rgba(100,116,139,0.25)'}`,
                          color: isTargetAdmin ? '#c084fc' : '#94a3b8'
                        }}>
                          {isTargetAdmin && <ShieldCheck size={11} />}
                          {u.role.toUpperCase()}
                        </span>
                      </td>

                      <td className="table-mono">
                        {u.case_count}
                      </td>

                      <td className="table-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            title={isTargetAdmin ? "Demote to standard user" : "Promote to administrator"}
                            onClick={() => handleToggleRole(u)}
                            style={{
                              padding: '5px 9px', fontSize: 10,
                              borderColor: isTargetAdmin ? 'rgba(239,68,68,0.25)' : 'rgba(13,148,136,0.3)',
                              color: isTargetAdmin ? '#f87171' : '#5eead4'
                            }}
                          >
                            <UserCog size={12} />
                            {isTargetAdmin ? 'Demote' : 'Promote'}
                          </button>

                          <button
                            className="btn btn-sm btn-danger"
                            title="Delete user account"
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(u)}
                            style={{ padding: '5px 8px', opacity: isSelf ? 0.4 : 1 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Feature Overview Section */}
      <div className="settings-grid" style={{ gap: 18 }}>
        <section className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(13,148,136,0.15)', display: 'grid', placeItems: 'center', color: '#0d9488' }}>
              <Cpu size={16} />
            </span>
            <div>
              <div className="section-title">Global AI Inference Access</div>
              <div className="section-sub">System-wide engine control and model registry</div>
            </div>
          </div>
          <p style={{ color: '#8fa0b0', fontSize: 12, lineHeight: 1.6 }}>
            As Administrator, you have unrestricted access to all backend inference endpoints, cross-tenant case records, and model thresholds.
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <Link href="/experiments" className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              <Activity size={13} /> View Model Experiments
            </Link>
            <Link href="/analyze" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
              <Zap size={13} /> Master Analysis Console
            </Link>
          </div>
        </section>

        <section className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.15)', display: 'grid', placeItems: 'center', color: '#6366f1' }}>
              <ShieldCheck size={16} />
            </span>
            <div>
              <div className="section-title">Administrative Privileges</div>
              <div className="section-sub">Security, audit, and credential information</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#8fa0b0', lineHeight: 1.6 }}>
            Default Admin: <strong>admin@neuroseg.ai</strong> (Password: <code>admin123</code>)<br />
            You can create, promote, or remove accounts at any time. All scans uploaded by users remain locally isolated and protected under HIPAA research guidelines.
          </div>
        </section>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>Provision New User</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Create a platform account with custom roles</div>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Email Address *</label>
                <input
                  type="email"
                  className="control"
                  placeholder="researcher@institution.edu"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label">Password * (min 6 characters)</label>
                <input
                  type="password"
                  className="control"
                  placeholder="Enter temporary password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Prefix</label>
                  <select
                    className="control"
                    value={newPrefix}
                    onChange={e => setNewPrefix(e.target.value)}
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="">None</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Username</label>
                  <input
                    type="text"
                    className="control"
                    placeholder="Username"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Role</label>
                  <select
                    className="control"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as any)}
                  >
                    <option value="user">User (Standard)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Profession</label>
                  <select
                    className="control"
                    value={newProfession}
                    onChange={e => setNewProfession(e.target.value)}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="researcher">Researcher</option>
                    <option value="student">Student</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
