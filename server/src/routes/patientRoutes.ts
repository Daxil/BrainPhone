import { Router } from 'express';
import multer from 'multer';
import {
  createPatient,
  uploadAudio,
  getPatientById,
  getAllPatients,
  searchPatients,
  updatePatient,
  deletePatient,
  syncYandex, 
} from '../controllers/patientController';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/', createPatient);
router.post('/upload-audio', upload.single('audio'), uploadAudio);
router.post('/sync-yandex', syncYandex);  // ← НОВЫЙ МАРШРУТ
router.get('/', getAllPatients);
router.get('/search', searchPatients);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;
