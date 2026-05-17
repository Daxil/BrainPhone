export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'doctor';
  totpEnabled: boolean;
  totpVerified: boolean;
}

export interface LoginResponse {
  success: boolean;
  requireTotp?: boolean;
  user?: AuthUser;
  error?: string;
}

export interface InviteInfo {
  email: string;
  role: 'admin' | 'doctor';
}
