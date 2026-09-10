import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import FAQ from './pages/FAQ';
function DirectLoginRedirect() {
  React.useEffect(() => {
    window.location.href = 'http://localhost:3000/auth/twitch';
  }, []);
  return null;
}
import Support from './pages/Support';
import Navbar from './components/Navbar';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Navbar />
          <main className="app-layout-content">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/login" element={<DirectLoginRedirect />} />
              <Route path="/support" element={<Support />} />
              <Route path="/report" element={<Support />} />
            </Routes>
          </main>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
