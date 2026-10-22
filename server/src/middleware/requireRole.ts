import { Request, Response, NextFunction } from 'express';

/**
 * Иерархия ролей: superadmin ⊃ admin ⊃ doctor.
 * superadmin имеет все права admin и единственную дополнительную возможность —
 * раздел «Разметка датасета» (/api/dataset: разметка, удаление аудио, выгрузка XLSX). Выдаётся только CLI-скриптом (npm run role:superadmin),
 * не через приглашения, чтобы взломанный admin-аккаунт не мог себя повысить.
 */
export type Role = 'superadmin' | 'admin' | 'doctor';

/** admin или superadmin — всё, что раньше проверялось как role === 'admin'. */
export function hasAdminRights(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Decorator/middleware factory. Usage:
 *   router.get('/admin/users', requireRole('admin'), handler)          // admin + superadmin
 *   router.get('/api/patients', requireRole('admin', 'doctor'), handler)
 *   router.get('/api/dataset', requireRole('superadmin'), handler)     // только superadmin
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const role = req.user.role as Role;
    const allowed = roles.includes(role) || (role === 'superadmin' && roles.includes('admin'));
    if (!allowed) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
