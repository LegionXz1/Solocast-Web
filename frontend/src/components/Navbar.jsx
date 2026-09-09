import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  AlertCircle,
  LayoutDashboard,
  Home,
  ShieldCheck,
  LogOut,
  LogIn,
  Menu,
  X,
  User,
  ExternalLink
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'หน้าแรก', path: '/', icon: Home },
    { label: 'แผงควบคุม', path: '/dashboard', icon: LayoutDashboard },
    { label: 'คำถามที่พบบ่อย (FAQ)', path: '/faq', icon: HelpCircle },
    { label: 'แจ้งปัญหา', path: '/support', icon: AlertCircle },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="global-navbar-wrap animate-fade-up">
      <div className="global-navbar">
        {/* Brand */}
        <div className="navbar-brand-group">
          <Link to="/" className="navbar-logo" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="navbar-logo-text">SoloCast</span>
            <span className="navbar-logo-badge">by LegionX</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="navbar-desktop-nav" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`navbar-link ${active ? 'active' : ''}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: ThemeToggle & User Profile / Login */}
        <div className="navbar-actions-group">
          <ThemeToggle />

          {loading ? null : user ? (
            <div className="navbar-user-profile">
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className={`navbar-admin-btn ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                  title="เข้าสู่แผงควบคุมผู้ดูแลระบบ"
                >
                  <ShieldCheck size={14} />
                  <span>Admin</span>
                </Link>
              )}

              <div className="navbar-user-badge" title={`เข้าสู่ระบบด้วย @${user.username}`}>
                <img
                  src={`http://localhost:3000/api/twitch/avatar/${encodeURIComponent(user.username)}`}
                  alt={user.displayName || user.username}
                  className="navbar-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="navbar-username">@{user.displayName || user.username}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="navbar-logout-btn"
                title="ออกจากระบบ"
              >
                <LogOut size={14} />
                <span className="navbar-logout-text">ออก</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-island accent navbar-login-cta">
              <LogIn size={14} />
              <span>เข้าสู่ระบบ</span>
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="navbar-mobile-drawer">
          <div className="navbar-mobile-links">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`navbar-mobile-link ${active ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {user?.isAdmin && (
              <Link
                to="/admin"
                className={`navbar-mobile-link admin ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <ShieldCheck size={16} />
                <span>แผงผู้ดูแลระบบ (Admin)</span>
              </Link>
            )}

            <div className="navbar-mobile-divider" />

            {user ? (
              <div className="navbar-mobile-user-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <img
                    src={`http://localhost:3000/api/twitch/avatar/${encodeURIComponent(user.username)}`}
                    alt={user.username}
                    className="navbar-avatar-img"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    @{user.displayName || user.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="navbar-logout-btn"
                  style={{ padding: '0.45rem 0.85rem' }}
                >
                  <LogOut size={14} />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-island accent"
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem 1rem' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LogIn size={15} />
                <span>เข้าสู่ระบบด้วย Twitch</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
