import { Request, Response } from 'express';
import { db } from '../config/database';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const s3Client = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const AUDIO_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'brainphone-audio';
const PHOTO_BUCKET_NAME = process.env.S3_PHOTO_BUCKET_NAME || 'brainphone-photos';

// Медданные пациентов хранятся в приватных бакетах. Прямые ссылки не работают —
// на чтение отдаём presigned URL с коротким TTL, чтобы запись/фото не были
// доступны публично по угадываемому адресу.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 час
const S3_CONFIGURED = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

/** Presigned GET URL для приватного объекта. */
async function presignGet(bucket: string, key: string): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}

/**
 * Подписать ссылку на аудио/фото по имени файла (file_path).
 * Ключ в S3: `${prefix}/${fileName}` (audio|photos).
 * Если S3 не сконфигурирован (dev) — возвращаем исходный fallback без подписи.
 */
async function signedMediaUrl(
  bucket: string,
  prefix: 'audio' | 'photos',
  fileName: string | null | undefined,
  fallback?: string | null
): Promise<string | null> {
  if (!fileName) return fallback ?? null;
  if (!S3_CONFIGURED) return fallback ?? null;
  try {
    return await presignGet(bucket, `${prefix}/${fileName}`);
  } catch {
    return fallback ?? null;
  }
}

// Allowed sort columns whitelist (prevents SQL injection via dynamic sort)
const ALLOWED_SORT_COLS = new Set(['created_at', 'patient_name', 'updated_at']);

// Helper: IDOR ownership filter.
// Admin sees everything; doctor sees only their own patients.
function ownerFilter(req: Request): { clause: string; params: unknown[] } {
  if (req.user?.role === 'admin') return { clause: '', params: [] };
  return { clause: 'AND p.created_by = $', params: [req.user!.id] };
}

// Same but for single-table queries
function ownerFilterSimple(req: Request, alias = ''): {
  clause: string;
  value: string | undefined;
} {
  const col = alias ? `${alias}.created_by` : 'created_by';
  if (req.user?.role === 'admin') return { clause: '', value: undefined };
  return { clause: `AND ${col} = `, value: req.user!.id };
}

export const createPatient = async (req: Request, res: Response) => {
  try {
    const {
      patient_name, age, gender, chief_complaint, notes,
      blood_pressure, heart_rate, temperature,
      protocol_type, parkinsonism_stage, comorbidities, diagnosis,
      native_language, has_parkinsonism, has_cognitive,
      cog_motor_test, cog_motor_score,
      moca_score, mmse_score, trch_score, updrs_score,
    } = req.body;

    const patientId = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const createdBy = req.user!.id;

    const result = await db.one(
      `INSERT INTO patients (
        id, patient_name, age, gender, chief_complaint, notes,
        blood_pressure, heart_rate, temperature,
        protocol_type, parkinsonism_stage, comorbidities, diagnosis,
        native_language, has_parkinsonism, has_cognitive,
        cog_motor_test, cog_motor_score,
        moca_score, mmse_score, trch_score, updrs_score,
        created_by, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW()
      ) RETURNING *`,
      [
        patientId,
        patient_name || 'Пациент',
        age           || '0',
        gender        || 'male',
        chief_complaint || '',
        notes         || '',
        blood_pressure  || '',
        heart_rate      || '',
        temperature     || '',
        protocol_type   || null,
        parkinsonism_stage || null,
        comorbidities   || null,
        diagnosis       || null,
        native_language || null,
        has_parkinsonism === true || has_parkinsonism === 'true' ? true : false,
        has_cognitive    === true || has_cognitive    === 'true' ? true : false,
        cog_motor_test  || null,
        cog_motor_score || null,
        moca_score      || null,
        mmse_score      || null,
        trch_score      || null,
        updrs_score     || null,
        createdBy,
      ]
    );

    // Save patient questionnaire JSON to S3 (non-blocking)
    savePatientJsonToS3(result).catch((err) =>
      console.warn('S3 patient JSON upload skipped:', err.message)
    );

    res.status(201).json({
      success: true,
      data: { patient: result },
      message: 'Patient created successfully',
    });
  } catch (error: any) {
    console.error('Error creating patient:', error.message);
    res.status(500).json({ success: false, error: `Failed to create patient: ${error.message}` });
  }
};

async function savePatientJsonToS3(patient: Record<string, any>): Promise<void> {
  const keyId = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!keyId || !secret) return; // S3 not configured — skip silently

  const bucket = process.env.S3_BUCKET_NAME || 'brainphone-audio';
  const key = `patients/${patient.id}/data.json`;
  const body = JSON.stringify(patient, null, 2);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
  }));
}

async function convertWavToFlac(wavBuffer: Buffer): Promise<Buffer> {
  const id = `bp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const wavPath = path.join(os.tmpdir(), `${id}.wav`);
  const flacPath = path.join(os.tmpdir(), `${id}.flac`);

  try {
    await fs.promises.writeFile(wavPath, wavBuffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(wavPath)
        .audioCodec('flac')
        .format('flac')
        .save(flacPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
    return await fs.promises.readFile(flacPath);
  } finally {
    fs.promises.unlink(wavPath).catch(() => {});
    fs.promises.unlink(flacPath).catch(() => {});
  }
}

export const uploadAudio = async (req: Request, res: Response) => {
  try {
    const { patient_id, recording_type, recording_label, duration, sample_rate, bits_per_sample, channels } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    // Verify WAV magic bytes: RIFF....WAVE
    const buf = req.file.buffer;
    if (buf.length < 12
        || buf.toString('ascii', 0, 4) !== 'RIFF'
        || buf.toString('ascii', 8, 12) !== 'WAVE') {
      return res.status(400).json({ success: false, error: 'Invalid audio file format — WAV required' });
    }

    // IDOR: verify patient belongs to current user
    const patient = await db.oneOrNone(
      'SELECT id, created_by FROM patients WHERE id = $1',
      [patient_id]
    );
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    if (req.user!.role !== 'admin' && patient.created_by !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const oldRecord = await db.oneOrNone(
      'SELECT file_path FROM patient_audio WHERE patient_id = $1 AND recording_type = $2 ORDER BY uploaded_at DESC LIMIT 1',
      [patient_id, recording_type]
    );

    if (oldRecord?.file_path) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: AUDIO_BUCKET_NAME, Key: `audio/${oldRecord.file_path}` }));
      } catch (err) {
        console.warn('Failed to delete old file from S3');
      }
      await db.none('DELETE FROM patient_audio WHERE patient_id = $1 AND recording_type = $2', [patient_id, recording_type]);
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = await convertWavToFlac(buf);
    } catch (convErr: any) {
      console.error('FLAC conversion failed:', convErr.message);
      return res.status(500).json({ success: false, error: 'Audio conversion to FLAC failed' });
    }

    const fileName = `${patient_id}_${recording_type}_${Date.now()}.flac`;
    const s3Key = `audio/${fileName}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: AUDIO_BUCKET_NAME,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/flac',
    }));

    // Храним только ключ объекта; читателям выдаём presigned URL на лету.
    const result = await db.one(
      `INSERT INTO patient_audio (
        patient_id, recording_type, recording_label, file_path,
        duration, sample_rate, bits_per_sample, channels,
        file_size, status, uploaded_at, yandex_disk_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11) RETURNING *`,
      [
        patient_id, recording_type, recording_label || '', fileName,
        parseFloat(duration) || 0, parseInt(sample_rate) || 48000,
        parseInt(bits_per_sample) || 16, parseInt(channels) || 1,
        audioBuffer.length, 'completed', s3Key,
      ]
    );

    // Для немедленного воспроизведения после загрузки отдаём подписанную ссылку.
    result.yandex_disk_url = await signedMediaUrl(AUDIO_BUCKET_NAME, 'audio', fileName, null);

    res.json({ success: true, data: { audio: result } });
  } catch (error: any) {
    console.error('Error uploading audio:', error.message);
    res.status(500).json({ success: false, error: 'Failed to upload audio' });
  }
};

export const uploadPhoto = async (req: Request, res: Response) => {
  try {
    const { patient_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo file provided' });
    }

    // Verify magic bytes for JPEG (FF D8 FF) or PNG (89 50 4E 47 0D 0A 1A 0A)
    const buf = req.file.buffer;
    if (buf.length < 8) {
      return res.status(400).json({ success: false, error: 'File too small' });
    }
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
                && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
    if (!isJpeg && !isPng) {
      return res.status(400).json({ success: false, error: 'Only JPEG and PNG images are allowed' });
    }

    // IDOR: verify patient belongs to current user
    const patient = await db.oneOrNone('SELECT id, created_by FROM patients WHERE id = $1', [patient_id]);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
    if (req.user!.role !== 'admin' && patient.created_by !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const ext = isJpeg ? 'jpg' : 'png';
    // Use server-detected MIME, never trust client-supplied mimetype
    const detectedMime = isJpeg ? 'image/jpeg' : 'image/png';
    const fileName = `${patient_id}_photo_${Date.now()}.${ext}`;
    const s3Key = `photos/${fileName}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: PHOTO_BUCKET_NAME,
      Key: s3Key,
      Body: buf,
      ContentType: detectedMime,
      ContentDisposition: 'attachment',
    }));

    // Храним ключ объекта; читателям выдаём presigned URL на лету.
    const result = await db.one(
      `INSERT INTO patient_photos (patient_id, file_path, uploaded_at, yandex_disk_url) VALUES ($1, $2, NOW(), $3) RETURNING *`,
      [patient_id, fileName, s3Key]
    );

    result.yandex_disk_url = await signedMediaUrl(PHOTO_BUCKET_NAME, 'photos', fileName, null);

    res.json({ success: true, data: { photo: result } });
  } catch (error: any) {
    console.error('Error uploading photo:', error.message);
    res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
};

export const deleteAudioRecording = async (req: Request, res: Response) => {
  try {
    const { recording_id } = req.params;
    const recording = await db.oneOrNone(
      `SELECT pa.*, p.created_by AS patient_owner
       FROM patient_audio pa JOIN patients p ON p.id = pa.patient_id
       WHERE pa.id = $1`,
      [recording_id]
    );

    if (!recording) return res.status(404).json({ success: false, error: 'Recording not found' });
    if (req.user!.role !== 'admin' && recording.patient_owner !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (recording.yandex_disk_url) {
      const key = recording.yandex_disk_url.split('/').pop();
      if (key) {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: AUDIO_BUCKET_NAME, Key: `audio/${key}` }));
        } catch { /* ignore S3 errors */ }
      }
    }

    await db.none('DELETE FROM patient_audio WHERE id = $1', [recording_id]);
    res.json({ success: true, message: 'Audio recording deleted' });
  } catch (error: any) {
    console.error('Error deleting audio:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete audio' });
  }
};

export const deletePhoto = async (req: Request, res: Response) => {
  try {
    const { photo_id } = req.params;
    const photo = await db.oneOrNone(
      `SELECT pp.*, p.created_by AS patient_owner
       FROM patient_photos pp JOIN patients p ON p.id = pp.patient_id
       WHERE pp.id = $1`,
      [photo_id]
    );

    if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });
    if (req.user!.role !== 'admin' && photo.patient_owner !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (photo.file_path) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: PHOTO_BUCKET_NAME, Key: `photos/${photo.file_path}` }));
      } catch { /* ignore S3 errors */ }
    }

    await db.none('DELETE FROM patient_photos WHERE id = $1', [photo_id]);
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error: any) {
    console.error('Error deleting photo:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
};

export const getAllPatients = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const isAdmin = req.user!.role === 'admin';

    const baseQuery = `
      SELECT p.*,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', pa.id, 'recording_type', pa.recording_type, 'recording_label', pa.recording_label,
            'file_path', pa.file_path, 'yandex_disk_url', pa.yandex_disk_url, 'duration', pa.duration,
            'status', pa.status, 'uploaded_at', pa.uploaded_at
          ) ORDER BY pa.uploaded_at DESC)
          FROM patient_audio pa WHERE pa.patient_id = p.id
        ), '[]'::json) AS audio_files,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', ph.id, 'file_path', ph.file_path, 'yandex_disk_url', ph.yandex_disk_url,
            'uploaded_at', ph.uploaded_at
          ) ORDER BY ph.uploaded_at DESC)
          FROM patient_photos ph WHERE ph.patient_id = p.id
        ), '[]'::json) AS photos
      FROM patients p`;

    const patients = isAdmin
      ? await db.manyOrNone(`${baseQuery} ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
          [parseInt(limit as string), parseInt(offset as string)])
      : await db.manyOrNone(`${baseQuery} WHERE p.created_by = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
          [req.user!.id, parseInt(limit as string), parseInt(offset as string)]);

    const total = isAdmin
      ? await db.one('SELECT COUNT(*) FROM patients')
      : await db.one('SELECT COUNT(*) FROM patients WHERE created_by = $1', [req.user!.id]);

    // Подписываем ссылки на медиа во вложенных массивах (объекты приватные).
    await Promise.all(patients.flatMap((p) => [
      ...(Array.isArray(p.audio_files) ? p.audio_files : []).map(async (a: any) => {
        a.yandex_disk_url = await signedMediaUrl(AUDIO_BUCKET_NAME, 'audio', a.file_path, a.yandex_disk_url);
      }),
      ...(Array.isArray(p.photos) ? p.photos : []).map(async (ph: any) => {
        ph.yandex_disk_url = await signedMediaUrl(PHOTO_BUCKET_NAME, 'photos', ph.file_path, ph.yandex_disk_url);
      }),
    ]));

    res.json({ success: true, data: { patients, total: parseInt(total.count), limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error: any) {
    console.error('Error fetching patients:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch patients' });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user!.role === 'admin';

    const patient = isAdmin
      ? await db.oneOrNone('SELECT * FROM patients WHERE id = $1', [id])
      : await db.oneOrNone('SELECT * FROM patients WHERE id = $1 AND created_by = $2', [id, req.user!.id]);

    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const audioFiles = await db.manyOrNone('SELECT * FROM patient_audio WHERE patient_id = $1 ORDER BY uploaded_at DESC', [id]);
    const photos     = await db.manyOrNone('SELECT * FROM patient_photos WHERE patient_id = $1 ORDER BY uploaded_at DESC', [id]);

    await Promise.all([
      ...audioFiles.map(async (a) => {
        a.yandex_disk_url = await signedMediaUrl(AUDIO_BUCKET_NAME, 'audio', a.file_path, a.yandex_disk_url);
      }),
      ...photos.map(async (p) => {
        p.yandex_disk_url = await signedMediaUrl(PHOTO_BUCKET_NAME, 'photos', p.file_path, p.yandex_disk_url);
      }),
    ]);

    res.json({ success: true, data: { patient, audio_files: audioFiles, photos } });
  } catch (error: any) {
    console.error('Error fetching patient:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch patient' });
  }
};

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const isAdmin = req.user!.role === 'admin';
    const like = `%${query}%`;

    const patients = isAdmin
      ? await db.manyOrNone(
          'SELECT * FROM patients WHERE patient_name ILIKE $1 OR chief_complaint ILIKE $1 OR diagnosis ILIKE $1 ORDER BY created_at DESC',
          [like]
        )
      : await db.manyOrNone(
          'SELECT * FROM patients WHERE created_by = $2 AND (patient_name ILIKE $1 OR chief_complaint ILIKE $1 OR diagnosis ILIKE $1) ORDER BY created_at DESC',
          [like, req.user!.id]
        );

    res.json({ success: true, data: { patients } });
  } catch (error: any) {
    console.error('Error searching patients:', error.message);
    res.status(500).json({ success: false, error: 'Failed to search patients' });
  }
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const isAdmin = req.user!.role === 'admin';

    const patient = isAdmin
      ? await db.oneOrNone('SELECT id FROM patients WHERE id = $1', [id])
      : await db.oneOrNone('SELECT id FROM patients WHERE id = $1 AND created_by = $2', [id, req.user!.id]);

    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const updated = await db.one(
      `UPDATE patients SET
        patient_name       = COALESCE($2,  patient_name),
        age                = COALESCE($3,  age),
        gender             = COALESCE($4,  gender),
        chief_complaint    = COALESCE($5,  chief_complaint),
        notes              = COALESCE($6,  notes),
        blood_pressure     = COALESCE($7,  blood_pressure),
        heart_rate         = COALESCE($8,  heart_rate),
        temperature        = COALESCE($9,  temperature),
        protocol_type      = COALESCE($10, protocol_type),
        parkinsonism_stage = COALESCE($11, parkinsonism_stage),
        comorbidities      = COALESCE($12, comorbidities),
        diagnosis          = COALESCE($13, diagnosis),
        moca_score         = COALESCE($14, moca_score),
        native_language    = COALESCE($15, native_language),
        has_parkinsonism   = COALESCE($16, has_parkinsonism),
        has_cognitive      = COALESCE($17, has_cognitive),
        mmse_score         = COALESCE($18, mmse_score),
        trch_score         = COALESCE($19, trch_score),
        updrs_score        = COALESCE($20, updrs_score),
        updated_at         = NOW()
       WHERE id = $1 RETURNING *`,
      [id, updates.patient_name, updates.age, updates.gender, updates.chief_complaint,
       updates.notes, updates.blood_pressure, updates.heart_rate, updates.temperature,
       updates.protocol_type, updates.parkinsonism_stage, updates.comorbidities,
       updates.diagnosis, updates.moca_score,
       updates.native_language,
       updates.has_parkinsonism === undefined ? null : (updates.has_parkinsonism === true || updates.has_parkinsonism === 'true'),
       updates.has_cognitive === undefined ? null : (updates.has_cognitive === true || updates.has_cognitive === 'true'),
       updates.mmse_score, updates.trch_score, updates.updrs_score]
    );

    res.json({ success: true, data: { patient: updated } });
  } catch (error: any) {
    console.error('Error updating patient:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user!.role === 'admin';

    const patient = isAdmin
      ? await db.oneOrNone('SELECT id FROM patients WHERE id = $1', [id])
      : await db.oneOrNone('SELECT id FROM patients WHERE id = $1 AND created_by = $2', [id, req.user!.id]);

    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    // Remove child rows first — patient_photos has no guaranteed ON DELETE CASCADE,
    // so a plain DELETE on patients could fail on the FK for cases with photos.
    await db.none('DELETE FROM patient_photos WHERE patient_id = $1', [id]);
    await db.none('DELETE FROM patient_audio  WHERE patient_id = $1', [id]);
    await db.none('DELETE FROM patients WHERE id = $1', [id]);
    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting patient:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete patient' });
  }
};

// ─── Согласие пациента ────────────────────────────────────────────────────────

export const saveConsent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { consent_hash, text_version, check1, check2, signature_url } = req.body;

    const patient = await db.oneOrNone(
      'SELECT id, created_by FROM patients WHERE id = $1',
      [id]
    );
    if (!patient) return res.status(404).json({ success: false, error: 'Кейс не найден' });
    if (req.user!.role !== 'admin' && patient.created_by !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Нет доступа' });
    }

    await db.none(`
      INSERT INTO case_consents (patient_id, doctor_id, consent_hash, text_version, check1, check2, signature_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (patient_id) DO UPDATE SET
        consent_hash  = EXCLUDED.consent_hash,
        text_version  = EXCLUDED.text_version,
        check1        = EXCLUDED.check1,
        check2        = EXCLUDED.check2,
        signature_url = EXCLUDED.signature_url,
        signed_at     = NOW()
    `, [id, req.user!.id, consent_hash, text_version, !!check1, !!check2, signature_url || null]);

    await db.none(
      `UPDATE patients SET case_status = 'RECORDING', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Согласие сохранено' });
  } catch (error: any) {
    console.error('saveConsent error:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сохранения согласия' });
  }
};

// ─── Отправка кейса ───────────────────────────────────────────────────────────

export const submitCase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await db.oneOrNone(
      'SELECT id, created_by, case_status FROM patients WHERE id = $1',
      [id]
    );
    if (!patient) return res.status(404).json({ success: false, error: 'Кейс не найден' });
    if (req.user!.role !== 'admin' && patient.created_by !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Нет доступа' });
    }

    // Назначаем номер кейса если ещё нет
    const existing = await db.oneOrNone(
      'SELECT case_number FROM patients WHERE id = $1',
      [id]
    );
    let caseNumber = existing?.case_number;
    if (!caseNumber) {
      const seq = await db.one(`SELECT 'N' || LPAD(nextval('case_number_seq')::text, 3, '0') AS num`);
      caseNumber = seq.num;
    }

    await db.none(
      `UPDATE patients
       SET case_status = 'SUBMITTED', case_number = $2, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, caseNumber]
    );

    res.json({ success: true, data: { caseNumber, caseStatus: 'SUBMITTED' } });
  } catch (error: any) {
    console.error('submitCase error:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка отправки кейса' });
  }
};

// ─── Статистика «сегодня» для главного экрана ─────────────────────────────────

export const getTodayStats = async (req: Request, res: Response) => {
  try {
    const doctorId = req.user!.id;
    const isAdmin  = req.user!.role === 'admin';

    const ownerClause = isAdmin ? '' : 'AND created_by = $1';
    const params: any[] = isAdmin ? [] : [doctorId];

    const rows = await db.manyOrNone(`
      SELECT case_status, COUNT(*) AS cnt
      FROM patients
      WHERE created_at::date = CURRENT_DATE ${ownerClause}
      GROUP BY case_status
    `, params);

    const stats = { accepted: 0, rejected: 0, review: 0, total: 0 };
    for (const r of rows) {
      const n = parseInt(r.cnt, 10);
      stats.total += n;
      if (r.case_status === 'ACCEPTED') stats.accepted = n;
      else if (r.case_status === 'REJECTED') stats.rejected = n;
      else if (r.case_status === 'REVIEW') stats.review = n;
    }

    res.json({ success: true, data: { stats } });
  } catch (error: any) {
    console.error('getTodayStats error:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка загрузки статистики' });
  }
};

// ─── Пометить кейс как ACCEPTED / REJECTED / REVIEW (только admin) ──────────

export const reviewCase = async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Только администратор' });
    }
    const { id } = req.params;
    const { status, rejection_code, rejection_note } = req.body;

    const allowed = ['ACCEPTED', 'REJECTED', 'REVIEW'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Недопустимый статус' });
    }

    await db.none(
      `UPDATE patients
       SET case_status = $2, rejection_code = $3, rejection_note = $4,
           reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, status, rejection_code || null, rejection_note || null]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('reviewCase error:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка обновления статуса' });
  }
};
