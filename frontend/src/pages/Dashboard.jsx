import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';

const STATUSES = ['Applied', 'OA/Screening', 'Interview', 'Offer', 'Rejected'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/applications');
      setApplications(res.data);
    } catch (err) {
      setError('Could not load applications');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/applications', { company, role, jobUrl, notes });
      setCompany('');
      setRole('');
      setJobUrl('');
      setNotes('');
      setShowForm(false);
      loadApplications();
    } catch (err) {
      setError('Could not add application');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );
    try {
      await api.patch(`/applications/${id}`, { status: newStatus });
    } catch (err) {
      loadApplications();
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this application?')) return;
    setApplications((prev) => prev.filter((app) => app.id !== id));
    try {
      await api.delete(`/applications/${id}`);
    } catch (err) {
      loadApplications();
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Logbook</h1>
          <p className="dashboard-subtitle">{user?.email}</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add application'}
          </button>
          <button className="btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      {showForm && (
        <form className="add-form" onSubmit={handleAdd}>
          <div className="add-form-row">
            <div>
              <label>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div>
              <label>Role</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} required />
            </div>
          </div>
          <div className="add-form-row">
            <div>
              <label>Job URL (optional)</label>
              <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
            </div>
            <div>
              <label>Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add application'}
          </button>
        </form>
      )}

      {error && <p className="dashboard-error">{error}</p>}

      {loading ? (
        <p className="dashboard-empty">Loading...</p>
      ) : applications.length === 0 ? (
        <div className="dashboard-empty">
          <p>No applications yet.</p>
          <p>Click "+ Add application" to log your first one.</p>
        </div>
      ) : (
        <table className="app-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Date applied</th>
              <th>Link</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td>{app.company}</td>
                <td>{app.role}</td>
                <td>
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    className={`status-select status-${app.status.replace(/[^a-zA-Z]/g, '')}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>{new Date(app.dateApplied).toLocaleDateString()}</td>
                <td>
                  {app.jobUrl ? (
                    <a href={app.jobUrl} target="_blank" rel="noreferrer">View</a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <button className="btn-delete" onClick={() => handleDelete(app.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}