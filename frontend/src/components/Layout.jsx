import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Users, LayoutDashboard, LogOut } from 'lucide-react';
import '../styles/Layout.css';

function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Bot size={32} />
          <h2>Bot Dashboard</h2>
        </div>

        <div className="sidebar-menu">
          <Link
            to="/"
            className={`menu-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/bots"
            className={`menu-item ${location.pathname.startsWith('/bots') ? 'active' : ''}`}
          >
            <Bot size={20} />
            <span>My Bots</span>
          </Link>

          {isAdmin() && (
            <Link
              to="/users"
              className={`menu-item ${location.pathname === '/users' ? 'active' : ''}`}
            >
              <Users size={20} />
              <span>Users</span>
            </Link>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
