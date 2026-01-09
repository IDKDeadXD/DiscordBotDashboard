import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { bots as botsAPI } from '../services/api';
import { Plus, X, Bot as BotIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Bots.css';

function Bots() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    bot_id: '',
    description: '',
    auto_restart: true
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const response = await botsAPI.getAll();
      setBots(response.data.bots);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await botsAPI.create(formData);
      setShowModal(false);
      setFormData({ name: '', token: '', bot_id: '', description: '', auto_restart: true });
      loadBots();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bots-page">
        <div className="page-header">
          <h1>My Discord Bots</h1>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            Add New Bot
          </button>
        </div>

        {bots.length === 0 ? (
          <div className="empty-state">
            <BotIcon size={48} />
            <p>No bots yet</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={20} />
              Create Your First Bot
            </button>
          </div>
        ) : (
          <div className="bots-grid">
            {bots.map(bot => (
              <div
                key={bot.id}
                className="bot-item"
                onClick={() => navigate(`/bots/${bot.id}`)}
              >
                <div className="bot-item-header">
                  <div className="bot-item-icon">
                    <BotIcon size={24} />
                  </div>
                  <div className={`bot-status status-${bot.status}`}>
                    {bot.status}
                  </div>
                </div>
                <div className="bot-item-body">
                  <h3>{bot.name}</h3>
                  <p>{bot.description || 'No description'}</p>
                  <div className="bot-meta">
                    <span>by {bot.owner_username}</span>
                    <span>ID: {bot.bot_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add New Discord Bot</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                  <label>Bot Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="My Awesome Bot"
                  />
                </div>

                <div className="form-group">
                  <label>Discord Bot Token *</label>
                  <input
                    type="password"
                    value={formData.token}
                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    required
                    placeholder="Your bot token from Discord Developer Portal"
                  />
                  <small>Get your token from <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Discord Developer Portal</a></small>
                </div>

                <div className="form-group">
                  <label>Bot Application ID *</label>
                  <input
                    type="text"
                    value={formData.bot_id}
                    onChange={(e) => setFormData({ ...formData, bot_id: e.target.value })}
                    required
                    placeholder="1234567890123456789"
                  />
                  <small>Application ID from Discord Developer Portal</small>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does your bot do?"
                    rows={3}
                  />
                </div>

                <div className="form-group-checkbox">
                  <input
                    type="checkbox"
                    id="auto_restart"
                    checked={formData.auto_restart}
                    onChange={(e) => setFormData({ ...formData, auto_restart: e.target.checked })}
                  />
                  <label htmlFor="auto_restart">Auto-restart on failure</label>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Bot'}
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

export default Bots;
