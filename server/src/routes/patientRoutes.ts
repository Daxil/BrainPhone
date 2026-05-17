import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../middleware/requireRole';
import {
  createPatient,
  uploadAudio,
  uploadPhoto,
  deleteAudioRecording,
  deletePhoto,
  getPatientById,
  getAllPatients,
  searchPatients,
  updatePatient,
  deletePatient,
  saveConsent,
  submitCase,
  getTodayStats,
  reviewCase,
} from '../controllers/patientController';

const router = Router();

// All patient routes require authentication (already enforced by global auth middleware)
// Additionally they require at least 'doctor' or 'admin' role
const auth = requireRole('admin', 'doctor');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and image files are allowed'));
    }
  },
});

router.post(   '/',                    auth, async (req, res) => { try { await createPatient(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to create patient' }); } });
router.post(   '/upload-audio',        auth, upload.single('audio'), async (req, res) => { try { await uploadAudio(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to upload audio' }); } });
router.post(   '/upload-photo',        auth, upload.single('photo'), async (req, res) => { try { await uploadPhoto(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to upload photo' }); } });
router.delete( '/audio/:recording_id', auth, async (req, res) => { try { await deleteAudioRecording(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to delete audio' }); } });
router.delete( '/photos/:photo_id',    auth, async (req, res) => { try { await deletePhoto(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to delete photo' }); } });
router.get(    '/today-stats',         auth, async (req, res) => { try { await getTodayStats(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to get stats' }); } });
router.get(    '/',                    auth, async (req, res) => { try { await getAllPatients(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to get patients' }); } });
router.get(    '/search',              auth, async (req, res) => { try { await searchPatients(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to search patients' }); } });
router.get(    '/:id',                 auth, async (req, res) => { try { await getPatientById(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to get patient' }); } });
router.put(    '/:id',                 auth, async (req, res) => { try { await updatePatient(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to update patient' }); } });
router.delete( '/:id',                 auth, async (req, res) => { try { await deletePatient(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to delete patient' }); } });
router.post(   '/:id/consent',         auth, async (req, res) => { try { await saveConsent(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to save consent' }); } });
router.post(   '/:id/submit',          auth, async (req, res) => { try { await submitCase(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to submit case' }); } });
router.post(   '/:id/review',          auth, async (req, res) => { try { await reviewCase(req, res); } catch { res.status(500).json({ success: false, error: 'Failed to review case' }); } });

export default router;
