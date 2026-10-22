/**
 * Защита API разметки датасета (/api/dataset/*).
 *
 * Слои (поверх глобального authMiddleware + сессии):
 *  1. requireSuperAdmin — только роль superadmin (выдаётся CLI-скриптом).
 *     Остальным отвечаем 404, чтобы не раскрывать существование эндпоинтов.
 *  2. datasetRateLimit — лимит запросов на пользователя.
 *  3. strictCsrf — для изменяющих запросов Origin обязателен и должен быть из
 *     белого списка + обязателен заголовок X-Requested-With: BrainPhone. Его
 *     нет в CORS allowedHeaders, поэтому чужой сайт не пройдёт preflight даже
 *     с SameSite=None cookie. Глобальный originCheck пропускает запросы без
 *     Origin — здесь так нельзя.
 *  4. requireStepUp — для удаления: свежий (≤5 мин) step-up токен, выданный
 *     после повторного ввода пароля (и 2FA, если включена) и привязанный к
 *     текущей сессии.
 *  + Cache-Control: no-store на всё — медданные не должны оседать в кэшах.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { sha256 } from '../services/crypto.service';
import { consumeKeyedLimit } from '../services/rateLimit.service';
import { logAudit } from '../models/AuthAudit';
import { getAllowedOrigins } from './origin.middleware';

export const STEP_UP_HEADER = 'x-bp-step-up';
export const STEP_UP_PURPOSE = 'dataset_delete';
const CSRF_HEADER_VALUE = 'BrainPhone';

export function isSuperAdmin(user: Request['user']): boolean {
  return user?.role === 'superadmin';
}

export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (!isSuperAdmin(req.user)) {
    logAudit({
      eventType: 'dataset_access_denied',
      userId: req.user.id,
      email: req.user.email,
      ipAddress: req.ip,
      details: { method: req.method, path: req.path },
    });
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
}

/** Общий лимит: 600 запросов / 10 мин на пользователя. */
export async function datasetRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rl = await consumeKeyedLimit('dataset-api', req.user!.id, 10 * 60 * 1000, 600);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)));
    res.status(429).json({ success: false, error: 'Слишком много запросов, попробуйте позже' });
    return;
  }
  next();
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function strictCsrf(req: Request, res: Response, next: NextFunction): void {
  if (!STATE_CHANGING.has(req.method)) return next();

  const origin = req.headers.origin;
  const marker = req.headers['x-requested-with'];
  const allowed = getAllowedOrigins(req);

  if (!origin || !allowed.has(origin) || marker !== CSRF_HEADER_VALUE) {
    logAudit({
      eventType: 'dataset_csrf_rejected',
      userId: req.user?.id,
      ipAddress: req.ip,
      details: { method: req.method, path: req.path, origin: origin ?? null },
    });
    res.status(403).json({ success: false, error: 'Запрос отклонён' });
    return;
  }
  next();
}

/** Проверить step-up токен из заголовка: принадлежит пользователю, этой сессии и не истёк. */
export async function requireStepUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  const raw = req.headers[STEP_UP_HEADER];
  if (typeof raw !== 'string' || raw.length < 32 || raw.length > 128) {
    res.status(401).json({ success: false, error: 'Требуется подтверждение паролем', requireStepUp: true });
    return;
  }
  const row = await db.oneOrNone(
    `SELECT 1 FROM step_up_tokens
     WHERE token_hash = $1 AND user_id = $2 AND session_id = $3 AND purpose = $4 AND expires_at > NOW()`,
    [sha256(raw), req.user!.id, req.sessionToken, STEP_UP_PURPOSE]
  );
  if (!row) {
    res.status(401).json({ success: false, error: 'Подтверждение истекло, введите пароль ещё раз', requireStepUp: true });
    return;
  }
  next();
}
