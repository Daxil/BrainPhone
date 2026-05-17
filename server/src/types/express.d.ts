import type { UserRow } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<UserRow, 'id' | 'email' | 'role' | 'session_version'>;
      sessionToken?: string;
      sessionScope?: string[];
      nonce?: string;
    }
  }
}
