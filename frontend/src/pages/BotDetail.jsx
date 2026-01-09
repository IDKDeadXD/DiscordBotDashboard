import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { bots as botsAPI } from '../services/api';
import { Play, Square, RotateCw, Trash2, Activity, ArrowLeft, Rocket } from 'lucide-react';
import '../styles/BotDetail.css';

function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBot();
    const interval = setInterval(loadBot, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const loadBot = async () => {
    try {
      const response = await botsAPI.getOne(id);
      setBot(response.data.bot);
      setError('');
    } catch (error) {
      setError('Failed to load bot');
      console.error('Failed to load bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await botsAPI.getLogs(id, 100);
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleAction = async (action, apiCall) => {
    setActionLoading(action);
    try {
      await apiCall();
      await loadBot();
      if (action === 'deploy') {
        setTimeout(loadBot, 2000);
      }
    } catch (error) {
      alert(error.response?.data?.error || `Failed to ${action} bot`);
    } finally {
      setActionLoading('');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return;
    }

    setActionLoading('delete');
    try {
      await botsAPI.delete(id);
      navigate('/bots');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete bot');
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  if (error || !bot) {
    return (
      <Layout>
        <div className="error-state">
          <p>{error || 'Bot not found'}</p>
          <button className="btn-primary" onClick={() => navigate('/bots')}>
            <ArrowLeft size={20} />
            Back to Bots
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bot-detail">
        <button className="btn-back" onClick={() => navigate('/bots')}>
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="bot-header">
          <div className="bot-header-info">
            <h1>{bot.name}</h1>
            <p>{bot.description || 'No description'}</p>
            <div className="bot-meta-info">
              <span>Owner: {bot.owner_username}</span>
              <span>Bot ID: {bot.bot_id}</span>
              <span>Created: {new Date(bot.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className={`bot-status-large status-${bot.status}`}>
            {bot.status}
          </div>
        </div>

        <div className="bot-actions">
          {!bot.container_id && (
            <button
              className="btn-action btn-deploy"
              onClick={() => handleAction('deploy', () => botsAPI.deploy(id))}
              disabled={actionLoading}
            >
              <Rocket size={20} />
              {actionLoading === 'deploy' ? 'Deploying...' : 'Deploy Bot'}
            </button>
          )}

          {bot.container_id && bot.status !== 'running' && (
            <button
              className="btn-action btn-start"
              onClick={() => handleAction('start', () => botsAPI.start(id))}
              disabled={actionLoading}
            >
              <Play size={20} />
              {actionLoading === 'start' ? 'Starting...' : 'Start'}
            </button>
          )}

          {bot.status === 'running' && (
            <button
              className="btn-action btn-stop"
              onClick={() => handleAction('stop', () => botsAPI.stop(id))}
              disabled={actionLoading}
            >
              <Square size={20} />
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
          )}

          {bot.container_id && (
            <button
              className="btn-action btn-restart"
              onClick={() => handleAction('restart', () => botsAPI.restart(id))}
              disabled={actionLoading}
            >
              <RotateCw size={20} />
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </button>
          )}

          <button
            className="btn-action btn-delete"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            <Trash2 size={20} />
            {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {bot.container_id && (
          <div className="bot-logs-section">
            <div className="logs-header">
              <h2>Logs</h2>
              <button className="btn-secondary" onClick={loadLogs}>
                <Activity size={16} />
                Refresh Logs
              </button>
            </div>

            <div className="logs-container">
              {logs ? (
                <pre>{logs}</pre>
              ) : (
                <div className="logs-empty">
                  <p>No logs yet. Click "Refresh Logs" to load.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {bot.container_status && (
          <div className="bot-info-section">
            <h2>Container Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Container Name:</span>
                <span className="info-value">{bot.container_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Container ID:</span>
                <span className="info-value">{bot.container_id.substring(0, 12)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Auto Restart:</span>
                <span className="info-value">{bot.auto_restart ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default BotDetail;
