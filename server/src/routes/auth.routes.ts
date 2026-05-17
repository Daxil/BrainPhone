import { Router } from 'express';
import {
  login,
  loginTotp,
  getMe,
  logout,
  logoutAll,
  getInvite,
  setPassword,
  setupTotp,
  verifyTotpSetup,
  skipTotpSetup,
  disableTotpHandler,
} from '../controllers/auth.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Public (whitelisted in auth.middleware)
router.post('/login',         login);
router.post('/login/totp',    loginTotp);
router.get( '/invite/:token', getInvite);
router.post('/invite/:token/set-password', setPassword);

// Authenticated (full session OR totp_setup scoped session)
router.get( '/me',            requireRole('admin', 'doctor'), getMe);
router.post('/logout',        requireRole('admin', 'doctor'), logout);
router.post('/logout-all',    requireRole('admin', 'doctor'), logoutAll);

// TOTP management (full session OR totp_setup scope — scope check in authMiddleware)
router.post('/totp/setup',    requireRole('admin', 'doctor'), setupTotp);
router.post('/totp/verify',   requireRole('admin', 'doctor'), verifyTotpSetup);
router.post('/totp/skip',     requireRole('doctor'),          skipTotpSetup);
router.post('/totp/disable',  requireRole('doctor'),          disableTotpHandler);

export default router;
