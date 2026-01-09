import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { bots as botsAPI } from '../services/api';
import { Bot, Activity, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

function Dashboard() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0, error: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const response = await botsAPI.getAll();
      setBots(response.data.bots);

      const statsCalc = response.data.bots.reduce((acc, bot) => {
        acc.total++;
        if (bot.status === 'running') acc.running++;
        else if (bot.status === 'stopped') acc.stopped++;
        else if (bot.status === 'error') acc.error++;
        return acc;
      }, { total: 0, running: 0, stopped: 0, error: 0 });

      setStats(statsCalc);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoading(false);
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
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <button className="btn-primary" onClick={() => navigate('/bots')}>
            <Plus size={20} />
            New Bot
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#667eea33', color: '#667eea' }}>
              <Bot size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Bots</div>
              <div className="stat-value">{stats.total}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#10b98133', color: '#10b981' }}>
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Running</div>
              <div className="stat-value">{stats.running}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#f59e0b33', color: '#f59e0b' }}>
              <Bot size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Stopped</div>
              <div className="stat-value">{stats.stopped}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ef444433', color: '#ef4444' }}>
              <AlertCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Errors</div>
              <div className="stat-value">{stats.error}</div>
            </div>
          </div>
        </div>

        <div className="recent-bots">
          <h2>Recent Bots</h2>

          {bots.length === 0 ? (
            <div className="empty-state">
              <Bot size={48} />
              <p>No bots yet</p>
              <button className="btn-primary" onClick={() => navigate('/bots')}>
                <Plus size={20} />
                Create Your First Bot
              </button>
            </div>
          ) : (
            <div className="bots-list">
              {bots.slice(0, 5).map(bot => (
                <div
                  key={bot.id}
                  className="bot-card"
                  onClick={() => navigate(`/bots/${bot.id}`)}
                >
                  <div className="bot-info">
                    <div className="bot-name">{bot.name}</div>
                    <div className="bot-owner">by {bot.owner_username}</div>
                  </div>
                  <div className={`bot-status status-${bot.status}`}>
                    {bot.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;
