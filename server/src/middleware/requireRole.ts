import { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'doctor';

/**
 * Decorator/middleware factory. Usage:
 *   router.get('/admin/users', requireRole('admin'), handler)
 *   router.get('/api/patients', requireRole('admin', 'doctor'), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
