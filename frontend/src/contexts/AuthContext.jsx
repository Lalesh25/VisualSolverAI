import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiUrl } from '../config/api';

function mapMe(me) {
  return {
    id: me.id,
    email: me.email,
    name: me.name || '',
    is_pro: !!me.is_pro,
    profile_photo: me.profile_photo || null,
    password_user: me.password_user !== false,
    subscription_current_period_end: me.subscription_current_period_end || null,
    subscription_plan: me.subscription_plan || null,
  };
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem('token');
    if (!t) return;
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const me = await res.json();
        setUser(mapMe(me));
      } else if (res.status === 401) {
        logout();
      }
    } catch {
      /* ignore */
    }
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('token');
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const decoded = jwtDecode(stored);
        if (decoded.exp * 1000 < Date.now()) {
          logout();
          setLoading(false);
          return;
        }
        setToken(stored);
        const res = await fetch(apiUrl('/auth/me'), {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (res.status === 401) {
          logout();
          setLoading(false);
          return;
        }
        if (res.ok) {
          const me = await res.json();
          setUser(mapMe(me));
        } else {
          setUser({
            id: decoded.sub,
            email: decoded.email,
            name: '',
            is_pro: false,
            profile_photo: null,
            password_user: true,
            subscription_current_period_end: null,
            subscription_plan: null,
          });
        }
      } catch {
        logout();
      }
      setLoading(false);
    };
    init();
  }, [logout]);

  const login = async (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (res.ok) {
        const me = await res.json();
        setUser(mapMe(me));
        return;
      }
    } catch {
      /* fallback below */
    }
    const decoded = jwtDecode(newToken);
    setUser({
      id: decoded.sub,
      email: decoded.email,
      name: (userData && userData.name) || '',
      is_pro: false,
      profile_photo: null,
      password_user: true,
      subscription_current_period_end: null,
      subscription_plan: null,
    });
  };

  const value = {
    user,
    token,
    login,
    logout,
    refreshUser,
    loading,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
