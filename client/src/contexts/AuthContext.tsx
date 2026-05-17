import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../types/auth';
import { authApi } from '../services/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requireTotp: boolean; error?: string }>;
  loginTotp: (token: string, isBackup?: boolean) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      setUser(res.success && res.user ? res.user : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (!res.success) return { requireTotp: false, error: res.error };
    if (res.requireTotp) return { requireTotp: true };
    if (res.user) setUser(res.user);
    return { requireTotp: false };
  }, []);

  const loginTotp = useCallback(async (token: string, isBackup = false) => {
    const res = isBackup
      ? await authApi.loginTotpBackup(token)
      : await authApi.loginTotp(token);
    if (!res.success) return { error: res.error };
    if (res.user) setUser(res.user);
    return {};
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginTotp, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
