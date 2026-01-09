import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { users as usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, UserCheck, UserX, Trash2 } from 'lucide-react';
import '../styles/Users.css';

function Users() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await usersAPI.create(formData);
      setShowModal(false);
      setFormData({ username: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await usersAPI.update(userId, { is_active: !currentStatus });
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will also delete all their bots.`)) {
      return;
    }

    try {
      await usersAPI.delete(userId);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  if (!isAdmin()) {
    return (
      <Layout>
        <div className="error-state">
          <p>Access denied. This page is only accessible to administrators.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="users-page">
        <div className="page-header">
          <h1>User Management</h1>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            Add New User
          </button>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className={`btn-table ${user.is_active ? 'btn-disable' : 'btn-enable'}`}
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        title={user.is_active ? 'Disable user' : 'Enable user'}
                      >
                        {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      {isSuperAdmin() && user.role !== 'super_admin' && (
                        <button
                          className="btn-table btn-delete-small"
                          onClick={() => deleteUser(user.id, user.username)}
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add New User</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    minLength={3}
                    maxLength={50}
                    placeholder="johndoe"
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="john@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="user">User</option>
                    {isSuperAdmin() && <option value="admin">Admin</option>}
                  </select>
                  <small>
                    User: Can manage their own bots<br/>
                    Admin: Can manage users and all bots
                  </small>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Users;
