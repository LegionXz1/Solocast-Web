import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  token: '',
  user: null,
  loading: true,
  checkSession: () => {},
  logout: () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('solocast_user_token') || '';
    } catch (e) {
      return '';
    }
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth_token in URL params from Twitch OAuth redirect
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('auth_token');
      if (urlToken) {
        localStorage.setItem('solocast_user_token', urlToken);
        setToken(urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const checkSession = async (currentToken) => {
    const activeToken = currentToken !== undefined ? currentToken : (token || localStorage.getItem('solocast_user_token'));
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (data.loggedIn && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('solocast_user_token');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, [token]);

  const logout = async () => {
    try {
      const activeToken = token || localStorage.getItem('solocast_user_token');
      if (activeToken) {
        await fetch('http://localhost:3000/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
      }
    } catch (e) {
      // ignore
    }
    try {
      localStorage.removeItem('solocast_user_token');
    } catch (e) {}
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, checkSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
