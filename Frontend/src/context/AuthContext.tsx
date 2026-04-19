'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface UserData {
  user_id?: number;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role?: string;
  service_area?: string;
}

interface AuthContextValue {
  loggedIn: boolean;
  initialized: boolean;
  accessToken: string | null;
  user: UserData | null;
  login: (payload: {
    access_token: string;
    refresh_token: string;
    user: UserData;
  }) => void;
  updateUser: (user: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const token = sessionStorage.getItem('access_token');
    const userData = sessionStorage.getItem('user_data');

    console.log('[AuthProvider] Initialize: token=%s, userData=%s', !!token, !!userData);

    if (token && token.trim()) {
      console.log('[AuthProvider] Found token, setting loggedIn=true');
      setLoggedIn(true);
      setAccessToken(token);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          console.log('[AuthProvider] Parsed user:', parsed);
          setUser(parsed);
        } catch (error) {
          console.error('AuthProvider: Invalid user_data in localStorage', error);
          setUser(null);
        }
      }
    } else {
      console.log('[AuthProvider] No token, setting loggedIn=false');
      setLoggedIn(false);
      setAccessToken(null);
      setUser(null);
    }
    setInitialized(true);
  }, []);

  const login = useCallback(({ access_token, refresh_token, user }: {
    access_token: string;
    refresh_token: string;
    user: UserData;
  }) => {
    console.log('[AuthProvider] Login called with user:', user);
    sessionStorage.setItem('access_token', access_token);
    sessionStorage.setItem('refresh_token', refresh_token);
    sessionStorage.setItem('user_data', JSON.stringify(user));
    console.log('[AuthProvider] Tokens stored, setting loggedIn=true');
    setLoggedIn(true);
    setAccessToken(access_token);
    setUser(user);
  }, []);

  const updateUser = useCallback((user: UserData) => {
    console.log('[AuthProvider] updateUser called with', user);
    sessionStorage.setItem('user_data', JSON.stringify(user));
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    console.log('[AuthProvider] Logout called');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_data');
    console.log('[AuthProvider] Tokens cleared, setting loggedIn=false');
    setLoggedIn(false);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ loggedIn, initialized, accessToken, user, login, updateUser, logout }),
    [loggedIn, initialized, accessToken, user, login, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
