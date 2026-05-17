import type { AuthUser, LoginResponse, InviteInfo } from '../types/auth';

const BASE = import.meta.env.VITE_API_URL || 'https://bba8vah5ofa4lbqtm3sb.containers.yandexcloud.net/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return data as T;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return req('POST', '/auth/login', { email, password });
  },

  async loginTotp(token: string): Promise<LoginResponse> {
    return req('POST', '/auth/login/totp', { token });
  },

  async loginTotpBackup(backupCode: string): Promise<LoginResponse> {
    return req('POST', '/auth/login/totp', { backupCode });
  },

  async getMe(): Promise<{ success: boolean; user?: AuthUser }> {
    return req('GET', '/auth/me');
  },

  async logout(): Promise<void> {
    await req('POST', '/auth/logout');
  },

  async logoutAll(): Promise<void> {
    await req('POST', '/auth/logout-all');
  },

  async getInvite(token: string): Promise<{ success: boolean; invite?: InviteInfo; error?: string }> {
    return req('GET', `/auth/invite/${token}`);
  },

  async setPassword(token: string, password: string): Promise<{
    success: boolean;
    requireTotpSetup?: boolean;
    userId?: string;
    error?: string;
  }> {
    return req('POST', `/auth/invite/${token}/set-password`, { password });
  },

  async setupTotp(): Promise<{ success: boolean; secret?: string; qrCode?: string; error?: string }> {
    return req('POST', '/auth/totp/setup');
  },

  async verifyTotp(token: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    return req('POST', '/auth/totp/verify', { token });
  },

  async disableTotp(password: string): Promise<{ success: boolean; error?: string }> {
    return req('POST', '/auth/totp/disable', { password });
  },

  // Admin endpoints
  async createInvite(email: string, role: 'admin' | 'doctor'): Promise<{
    success: boolean;
    invite?: { id: string; email: string; role: string; expiresAt: string; rawToken: string };
    error?: string;
  }> {
    return req('POST', '/admin/invites', { email, role });
  },

  async listUsers(): Promise<{ success: boolean; users?: any[]; error?: string }> {
    return req('GET', '/admin/users');
  },

  async listInvites(): Promise<{ success: boolean; invites?: any[]; error?: string }> {
    return req('GET', '/admin/invites');
  },

  async unlockUser(userId: string): Promise<{ success: boolean }> {
    return req('POST', `/admin/users/${userId}/unlock`);
  },

  async deactivateUser(userId: string): Promise<{ success: boolean }> {
    return req('DELETE', `/admin/users/${userId}`);
  },

  async getAuditLog(params?: { userId?: string; limit?: number }): Promise<{ success: boolean; logs?: any[] }> {
    const q = new URLSearchParams();
    if (params?.userId) q.set('userId', params.userId);
    if (params?.limit)  q.set('limit', String(params.limit));
    return req('GET', `/admin/audit${q.toString() ? '?' + q.toString() : ''}`);
  },
};
