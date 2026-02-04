import { Router } from 'express';
import {
  createPatient,
  getPatientById,
  getAllPatients,
  updatePatient,
  deletePatient,
  searchPatients
} from '../controllers/patientController';

const router = Router();

router.post('/', createPatient);
router.get('/', getAllPatients);
router.get('/search', searchPatients);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;
