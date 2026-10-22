// Иерархия: superadmin ⊃ admin ⊃ doctor. superadmin выдаётся только CLI на сервере.
export type UserRole = 'superadmin' | 'admin' | 'doctor';

/** Права администратора есть у admin и superadmin. */
export const hasAdminRights = (role: string | undefined | null): boolean =>
  role === 'admin' || role === 'superadmin';

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Супер-админ',
  admin: 'Администратор',
  doctor: 'Врач',
};

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
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
  role: UserRole;
}
