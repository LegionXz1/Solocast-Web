import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { API_BASE } from './config';
import './index.css';

// ⚡ Lazy Loaded Route Chunks (Code-Splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Support = lazy(() => import('./pages/Support'));

function DirectLoginRedirect() {
  React.useEffect(() => {
    window.location.href = `${API_BASE}/auth/twitch`;
  }, []);
  return null;
}

function PageLoadingFallback() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.85rem',
      color: '#94a3b8'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>กำลังโหลด...</span>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Navbar />
          <main className="app-layout-content">
            <ErrorBoundary>
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/login" element={<DirectLoginRedirect />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/report" element={<Support />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
