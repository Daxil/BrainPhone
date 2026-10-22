import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { requireRole } from '../middleware/requireRole';
import {
  noStore,
  requireSuperAdmin,
  datasetRateLimit,
  strictCsrf,
  requireStepUp,
} from '../middleware/dataset.middleware';
import {
  accessHandler,
  schemaHandler,
  listRecordsHandler,
  getRecordHandler,
  saveAnnotationHandler,
  stepUpHandler,
  deleteAudioHandler,
  exportHandler,
} from '../controllers/dataset.controller';

const router = Router();

// Ошибки не отдаём наружу (в т.ч. сообщения S3/PG).
const safe = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, _next: NextFunction) => {
    fn(req, res).catch((err) => {
      console.error(`dataset ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Внутренняя ошибка' });
    });
  };

// То же для async-middleware: при успехе передаёт управление дальше через next.
const safeMw = (mw: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    mw(req, res, next).catch((err) => {
      console.error(`dataset middleware ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Внутренняя ошибка' });
    });
  };

router.use(noStore);
router.use(requireRole('admin'));

// Флаг для UI: показывать ли вкладку. Не раскрывает данных.
router.get('/access', safe(accessHandler));

// Всё остальное — только роль superadmin.
router.use(requireSuperAdmin);
router.use(safeMw(datasetRateLimit));
router.use(strictCsrf);

router.get(   '/schema',                          safe(schemaHandler));
router.get(   '/records',                         safe(listRecordsHandler));
router.get(   '/records/:patientId',              safe(getRecordHandler));
router.put(   '/records/:patientId/annotation',   safe(saveAnnotationHandler));
router.post(  '/step-up',                         safe(stepUpHandler));
router.delete('/audio',                           safeMw(requireStepUp), safe(deleteAudioHandler));
router.get(   '/export.xlsx',                     safe(exportHandler));

export default router;
