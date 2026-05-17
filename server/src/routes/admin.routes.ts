import { Router } from 'express';
import { requireRole } from '../middleware/requireRole';
import {
  createInviteHandler,
  listUsersHandler,
  listInvitesHandler,
  unlockUserHandler,
  deactivateUserHandler,
  auditLogHandler,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require 'admin' role
router.use(requireRole('admin'));

router.post(  '/invites',       createInviteHandler);
router.get(   '/invites',       listInvitesHandler);
router.get(   '/users',         listUsersHandler);
router.post(  '/users/:id/unlock', unlockUserHandler);
router.delete('/users/:id',     deactivateUserHandler);
router.get(   '/audit',         auditLogHandler);

export default router;
