import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/api';
import { apiFetch } from '../lib/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('recipe_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await apiFetch('/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        localStorage.setItem('recipe_is_admin', data.is_admin ? 'true' : 'false');
      } else {
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('recipe_token', token);
      refreshUser();
    } else {
      localStorage.removeItem('recipe_token');
      localStorage.removeItem('recipe_is_admin');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('recipe_is_admin');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

