import { Request, Response } from 'express';
import path from 'path';
import { db } from '../config/database';
import { logAudit } from '../models/AuthAudit';
import { findById, verifyPassword } from '../models/User';
import { generateToken, sha256 } from '../services/crypto.service';
import { decryptTotpSecret, verifyTotp } from '../services/totp.service';
import { consumeKeyedLimit, clearKeyedLimit } from '../services/rateLimit.service';
import { TOTP_ENABLED } from '../config/features';
import {
  AUDIO_BUCKET_NAME,
  S3_CONFIGURED,
  S3ObjectInfo,
  listAllObjects,
  presignGet,
  readJsonObject,
  headObject,
  copyToTrash,
  deleteObject,
} from '../services/s3.service';
import { DATASET_FIELDS, DATASET_GROUPS, AUDIO_SLOTS, AUDIO_NOTE_KEY, MARKS, validateAnnotation, AnnotationValues } from '../dataset/schema';
import { buildDatasetWorkbook, ExportRow, datasetAudioName } from '../dataset/export';
import { isSuperAdmin, STEP_UP_PURPOSE } from '../middleware/dataset.middleware';

// ─── Валидация идентификаторов из запроса ────────────────────────────────────

const PATIENT_ID_RE = /^[A-Za-z0-9_-]{1,50}$/;
// Только объекты аудио-префикса, без подкаталогов и «..» — удалить что-то
// за пределами audio/ (data.json, корзину, фото) этим API нельзя.
const AUDIO_KEY_RE = /^audio\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const AUDIO_FILE_RE = /^([^_]+)_(.+)_(\d+)\.([A-Za-z0-9]+)$/;
const UNMATCHED_ID = '__unmatched__';

function clientIp(req: Request): string { return req.ip || ''; }

// ─── Инвентаризация S3 (кэш на минуту — листинг бакета не бесплатный) ────────

interface S3Inventory { audio: S3ObjectInfo[]; questionnaires: Set<string>; fetchedAt: number }
let inventoryCache: S3Inventory | null = null;
const INVENTORY_TTL_MS = 60_000;

async function getS3Inventory(force = false): Promise<S3Inventory> {
  if (!S3_CONFIGURED) return { audio: [], questionnaires: new Set(), fetchedAt: Date.now() };
  if (!force && inventoryCache && Date.now() - inventoryCache.fetchedAt < INVENTORY_TTL_MS) return inventoryCache;

  const [audio, patientObjs] = await Promise.all([
    listAllObjects(AUDIO_BUCKET_NAME, 'audio/'),
    listAllObjects(AUDIO_BUCKET_NAME, 'patients/'),
  ]);
  const questionnaires = new Set<string>();
  for (const o of patientObjs) {
    const m = /^patients\/([^/]+)\/data\.json$/.exec(o.key);
    if (m) questionnaires.add(m[1]);
  }
  inventoryCache = { audio, questionnaires, fetchedAt: Date.now() };
  return inventoryCache;
}

function invalidateInventory(): void { inventoryCache = null; }

interface AudioItem {
  key: string;
  fileName: string;
  recordingType: string;
  label: string;
  duration: number | null;
  sizeBytes: number;
  uploadedAt: string | null;
  dbId: number | string | null;
  inDb: boolean;
  inS3: boolean;
}

interface SubjectSummary {
  patientId: string;
  inDb: boolean;
  caseNumber: string | null;
  caseStatus: string | null;
  protocolType: string | null;
  createdAt: string | null;
  age: string | null;
  gender: string | null;
  doctorEmail: string | null;
  hasQuestionnaire: boolean;
  audio: AudioItem[];
  annotation: { isComplete: boolean; updatedAt: string; subjectCode: string | null } | null;
}

/** Свести аудио из S3 и из БД по кейсам. Объект без строки в БД тоже попадает в список. */
async function buildSubjects(forceRefresh = false): Promise<Map<string, SubjectSummary>> {
  const [inventory, patients, dbAudio, annotations] = await Promise.all([
    getS3Inventory(forceRefresh),
    db.manyOrNone(`
      SELECT p.id, p.case_number, p.case_status, p.protocol_type, p.created_at, p.age, p.gender,
             (p.cognitive_intake IS NOT NULL) AS has_intake, u.email AS doctor_email
      FROM patients p LEFT JOIN users u ON u.id = p.created_by`),
    db.manyOrNone(`
      SELECT id, patient_id, recording_type, recording_label, file_path, duration, file_size, uploaded_at
      FROM patient_audio`),
    db.manyOrNone(`
      SELECT patient_id, is_complete, updated_at, data->>'A' AS subject_code FROM dataset_annotations`),
  ]);

  const subjects = new Map<string, SubjectSummary>();
  const ensure = (id: string): SubjectSummary => {
    let s = subjects.get(id);
    if (!s) {
      s = {
        patientId: id, inDb: false, caseNumber: null, caseStatus: null, protocolType: null,
        createdAt: null, age: null, gender: null, doctorEmail: null,
        hasQuestionnaire: inventory.questionnaires.has(id), audio: [], annotation: null,
      };
      subjects.set(id, s);
    }
    return s;
  };

  const patientById = new Map(patients.map((p) => [p.id, p]));
  const byKey = new Map<string, AudioItem>();

  for (const a of dbAudio) {
    if (!a.file_path) continue;
    const key = `audio/${a.file_path}`;
    const item: AudioItem = {
      key, fileName: a.file_path, recordingType: a.recording_type || '', label: a.recording_label || '',
      duration: a.duration ?? null, sizeBytes: Number(a.file_size) || 0,
      uploadedAt: a.uploaded_at ? new Date(a.uploaded_at).toISOString() : null,
      dbId: a.id, inDb: true, inS3: !S3_CONFIGURED,
    };
    byKey.set(key, item);
    ensure(a.patient_id).audio.push(item);
  }

  for (const o of inventory.audio) {
    const existing = byKey.get(o.key);
    if (existing) {
      existing.inS3 = true;
      existing.sizeBytes = o.size;
      continue;
    }
    const fileName = o.key.slice('audio/'.length);
    const m = AUDIO_FILE_RE.exec(fileName);
    const item: AudioItem = {
      key: o.key, fileName, recordingType: m?.[2] ?? '', label: '',
      duration: null, sizeBytes: o.size, uploadedAt: o.lastModified,
      dbId: null, inDb: false, inS3: true,
    };
    ensure(m ? m[1] : UNMATCHED_ID).audio.push(item);
  }

  for (const id of inventory.questionnaires) ensure(id);

  for (const an of annotations) {
    ensure(an.patient_id).annotation = {
      isComplete: an.is_complete,
      updatedAt: new Date(an.updated_at).toISOString(),
      subjectCode: an.subject_code,
    };
  }

  for (const s of subjects.values()) {
    const p = patientById.get(s.patientId);
    if (p) {
      s.inDb = true;
      s.caseNumber = p.case_number;
      s.caseStatus = p.case_status;
      s.protocolType = p.protocol_type;
      s.createdAt = p.created_at ? new Date(p.created_at).toISOString() : null;
      s.age = p.age;
      s.gender = p.gender;
      s.doctorEmail = p.doctor_email;
      s.hasQuestionnaire = s.hasQuestionnaire || p.has_intake;
    }
    s.audio.sort((a, b) => (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? ''));
  }

  return subjects;
}

// ─── Подсказки для формы из уже собранных данных кейса ────────────────────────

function mapLanguage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.toLowerCase();
  const ru = v.includes('рус') || v === 'ru';
  const tat = v.includes('тат');
  if (ru && tat) return 'Русский / Татарский';
  if (tat) return 'Татарский';
  if (ru) return 'Русский';
  if (v === 'other' || v.includes('друг')) return 'Другой';
  return undefined;
}

function suggestValues(patient: Record<string, any> | null, questionnaire: any): AnnotationValues {
  const src = { ...(questionnaire && typeof questionnaire === 'object' ? questionnaire : {}), ...(patient ?? {}) };
  const out: AnnotationValues = {};
  if (src.case_number) out.A = String(src.case_number);
  out.B = '1';
  if (src.created_at) out.C = new Date(src.created_at).toISOString().slice(0, 10);
  const age = parseInt(src.age, 10);
  if (Number.isInteger(age) && age > 0) out.G = String(age);
  if (src.gender === 'male') out.H = 'МУЖ';
  else if (src.gender === 'female') out.H = 'ЖЕН';
  const lang = mapLanguage(src.native_language) ?? mapLanguage(src.cognitive_intake?.primary_language);
  if (lang) out.AX = lang;
  const moca = Number(src.moca_score);
  if (src.moca_score && Number.isFinite(moca)) { out.AD = '1 - Да'; out.AV = String(moca); }
  const edu = src.cognitive_intake?.education_years;
  if (Number.isInteger(edu)) out.AF = `${edu} лет`;
  if (src.comorbidities) out.BU = String(src.comorbidities);
  return out;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// GET /api/dataset/access — нужно ли показывать вкладку (доступно любому admin).
export async function accessHandler(req: Request, res: Response): Promise<void> {
  res.json({ success: true, allowed: isSuperAdmin(req.user) });
}

// GET /api/dataset/schema
export async function schemaHandler(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    schema: {
      groups: DATASET_GROUPS,
      fields: DATASET_FIELDS,
      audioSlots: AUDIO_SLOTS,
      audioNoteKey: AUDIO_NOTE_KEY,
      marks: MARKS,
      stepUpRequiresTotp: TOTP_ENABLED,
    },
  });
}

// GET /api/dataset/records?refresh=1
export async function listRecordsHandler(req: Request, res: Response): Promise<void> {
  const refresh = req.query.refresh === '1';
  if (refresh) {
    const rl = await consumeKeyedLimit('dataset-refresh', req.user!.id, 60_000, 6);
    if (!rl.allowed) {
      res.status(429).json({ success: false, error: 'Обновление из S3 не чаще 6 раз в минуту' });
      return;
    }
  }
  const subjects = await buildSubjects(refresh);
  const records = Array.from(subjects.values())
    .filter((s) => s.audio.length > 0 || s.annotation || s.hasQuestionnaire)
    .sort((a, b) => (b.createdAt ?? b.audio[0]?.uploadedAt ?? '').localeCompare(a.createdAt ?? a.audio[0]?.uploadedAt ?? ''));

  res.json({
    success: true,
    s3Configured: S3_CONFIGURED,
    syncedAt: new Date(inventoryCache?.fetchedAt ?? Date.now()).toISOString(),
    records,
  });
}

// GET /api/dataset/records/:patientId
export async function getRecordHandler(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  if (!PATIENT_ID_RE.test(patientId)) {
    res.status(400).json({ success: false, error: 'Некорректный идентификатор' });
    return;
  }

  const subjects = await buildSubjects(false);
  const subject = subjects.get(patientId);
  const patient = patientId === UNMATCHED_ID ? null : await db.oneOrNone(
    `SELECT p.*, u.email AS doctor_email FROM patients p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = $1`,
    [patientId]
  );
  if (!subject && !patient) {
    res.status(404).json({ success: false, error: 'Кейс не найден' });
    return;
  }

  const questionnaire = S3_CONFIGURED && patientId !== UNMATCHED_ID
    ? await readJsonObject(AUDIO_BUCKET_NAME, `patients/${patientId}/data.json`)
    : null;

  const consent = patient
    ? await db.oneOrNone(
        'SELECT text_version, check1, check2, signed_at FROM case_consents WHERE patient_id = $1',
        [patientId]
      )
    : null;

  const annotation = await db.oneOrNone(
    `SELECT a.data, a.is_complete, a.version, a.updated_at, u.email AS annotated_by_email
     FROM dataset_annotations a LEFT JOIN users u ON u.id = a.annotated_by
     WHERE a.patient_id = $1`,
    [patientId]
  );

  const audio = await Promise.all((subject?.audio ?? []).map(async (a) => ({
    ...a,
    url: S3_CONFIGURED && a.inS3 ? await presignGet(AUDIO_BUCKET_NAME, a.key).catch(() => null) : null,
    datasetName: annotation ? datasetAudioName(annotation.data, AUDIO_SLOTS.find((s) => s.taskTypes.includes(a.recordingType))?.slot ?? null) : null,
  })));

  res.json({
    success: true,
    record: {
      patientId,
      patient,
      questionnaire,
      consent,
      audio,
      annotation: annotation
        ? {
            data: annotation.data,
            isComplete: annotation.is_complete,
            version: annotation.version,
            updatedAt: annotation.updated_at,
            annotatedBy: annotation.annotated_by_email,
          }
        : null,
      suggested: suggestValues(patient, questionnaire),
    },
  });
}

// PUT /api/dataset/records/:patientId/annotation  { data, isComplete, version }
export async function saveAnnotationHandler(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  if (!PATIENT_ID_RE.test(patientId) || patientId === UNMATCHED_ID) {
    res.status(400).json({ success: false, error: 'Некорректный идентификатор' });
    return;
  }
  const { data, isComplete, version } = req.body ?? {};
  const complete = isComplete === true;
  const expectedVersion = version === null || version === undefined ? null : Number(version);
  if (expectedVersion !== null && !Number.isInteger(expectedVersion)) {
    res.status(400).json({ success: false, error: 'Некорректная версия' });
    return;
  }

  const { values, errors } = validateAnnotation(data);
  if (complete) {
    for (const key of ['A', 'B', 'C', 'D']) {
      if (!values[key] && !errors[key]) errors[key] = 'Обязательно для завершённой разметки';
    }
  }
  if (Object.keys(errors).length) {
    res.status(400).json({ success: false, error: 'Проверьте поля формы', fieldErrors: errors });
    return;
  }

  // Разметить можно только то, что реально есть в БД или S3.
  const known = await db.oneOrNone('SELECT 1 FROM patients WHERE id = $1', [patientId])
    || (await buildSubjects(false)).has(patientId);
  if (!known) {
    res.status(404).json({ success: false, error: 'Кейс не найден' });
    return;
  }

  // Оптимистичная блокировка: два супер-админа не перетрут правки друг друга молча.
  const saved = expectedVersion === null
    ? await db.oneOrNone(
        `INSERT INTO dataset_annotations (patient_id, data, is_complete, annotated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (patient_id) DO NOTHING
         RETURNING version, updated_at`,
        [patientId, JSON.stringify(values), complete, req.user!.id]
      )
    : await db.oneOrNone(
        `UPDATE dataset_annotations
         SET data = $2, is_complete = $3, annotated_by = $4, version = version + 1, updated_at = NOW()
         WHERE patient_id = $1 AND version = $5
         RETURNING version, updated_at`,
        [patientId, JSON.stringify(values), complete, req.user!.id, expectedVersion]
      );

  if (!saved) {
    res.status(409).json({ success: false, error: 'Разметку уже изменил другой пользователь — обновите карточку' });
    return;
  }

  await logAudit({
    eventType: 'dataset_annotation_saved',
    userId: req.user!.id,
    email: req.user!.email,
    ipAddress: clientIp(req),
    details: { patientId, isComplete: complete, version: saved.version },
  });

  res.json({ success: true, annotation: { data: values, isComplete: complete, version: saved.version, updatedAt: saved.updated_at } });
}

// POST /api/dataset/step-up  { password, totp? }
export async function stepUpHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const rl = await consumeKeyedLimit('dataset-step-up', userId, 15 * 60 * 1000, 5);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Слишком много попыток. Повторите через 15 минут' });
    return;
  }

  const { password, totp } = req.body ?? {};
  const user = await findById(userId);
  let ok = typeof password === 'string' && password.length <= 256 && !!user?.password_hash
    && await verifyPassword(user.password_hash, password);

  const needTotp = TOTP_ENABLED && !!user?.totp_enabled && !!user?.totp_verified && !!user?.totp_secret_encrypted;
  if (ok && needTotp) {
    ok = typeof totp === 'string' && /^\d{6}$/.test(totp.trim())
      && verifyTotp(decryptTotpSecret(user!.totp_secret_encrypted!), totp.trim());
  }

  if (!ok) {
    await logAudit({ eventType: 'dataset_step_up_failure', userId, email: req.user!.email, ipAddress: clientIp(req) });
    res.status(401).json({ success: false, error: needTotp ? 'Неверный пароль или код 2FA' : 'Неверный пароль' });
    return;
  }

  await clearKeyedLimit('dataset-step-up', userId);
  const raw = generateToken(32);
  await db.none('DELETE FROM step_up_tokens WHERE expires_at < NOW()');
  await db.none(
    `INSERT INTO step_up_tokens (token_hash, user_id, session_id, purpose, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')`,
    [sha256(raw), userId, req.sessionToken, STEP_UP_PURPOSE]
  );
  await logAudit({ eventType: 'dataset_step_up_success', userId, email: req.user!.email, ipAddress: clientIp(req) });

  res.json({ success: true, token: raw, expiresInSec: 300 });
}

// DELETE /api/dataset/audio  { key, confirmFileName }   (требует step-up)
export async function deleteAudioHandler(req: Request, res: Response): Promise<void> {
  const { key, confirmFileName } = req.body ?? {};
  if (typeof key !== 'string' || !AUDIO_KEY_RE.test(key) || key.includes('..')) {
    res.status(400).json({ success: false, error: 'Некорректный ключ объекта' });
    return;
  }
  const fileName = path.posix.basename(key);
  // Защита от случайного/подставленного ключа: клиент должен повторить имя файла.
  if (confirmFileName !== fileName) {
    res.status(400).json({ success: false, error: 'Имя файла для подтверждения не совпадает' });
    return;
  }

  const rl = await consumeKeyedLimit('dataset-delete', req.user!.id, 60 * 60 * 1000, 30);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Превышен лимит удалений (30 в час)' });
    return;
  }

  const dbRows = await db.manyOrNone('SELECT id, patient_id, recording_type FROM patient_audio WHERE file_path = $1', [fileName]);
  const head = S3_CONFIGURED ? await headObject(AUDIO_BUCKET_NAME, key) : null;
  if (!head && dbRows.length === 0) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }

  // По умолчанию объект сначала копируется в trash/ (восстановимо; срок хранения
  // задаётся lifecycle-правилом бакета). DATASET_DELETE_MODE=hard — без копии.
  let trashKey: string | null = null;
  if (head) {
    if (process.env.DATASET_DELETE_MODE !== 'hard') {
      try {
        trashKey = await copyToTrash(AUDIO_BUCKET_NAME, key);
      } catch (err: any) {
        console.error('dataset delete: trash copy failed:', err.message);
        res.status(502).json({ success: false, error: 'Не удалось сохранить копию в корзину — удаление отменено' });
        return;
      }
    }
    await deleteObject(AUDIO_BUCKET_NAME, key);
  }
  await db.none('DELETE FROM patient_audio WHERE file_path = $1', [fileName]);
  invalidateInventory();

  const m = AUDIO_FILE_RE.exec(fileName);
  await logAudit({
    eventType: 'dataset_audio_deleted',
    userId: req.user!.id,
    email: req.user!.email,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'] ?? null,
    details: {
      key,
      trashKey,
      sizeBytes: head?.size ?? null,
      patientId: dbRows[0]?.patient_id ?? m?.[1] ?? null,
      recordingType: dbRows[0]?.recording_type ?? m?.[2] ?? null,
      dbRowsDeleted: dbRows.length,
    },
  });

  res.json({ success: true, trashed: !!trashKey });
}

// GET /api/dataset/export.xlsx?scope=complete|all
export async function exportHandler(req: Request, res: Response): Promise<void> {
  const rl = await consumeKeyedLimit('dataset-export', req.user!.id, 10 * 60 * 1000, 20);
  if (!rl.allowed) {
    res.status(429).json({ success: false, error: 'Слишком много выгрузок, попробуйте позже' });
    return;
  }
  const includeDrafts = req.query.scope === 'all';

  const annotations = await db.manyOrNone(
    `SELECT patient_id, data FROM dataset_annotations ${includeDrafts ? '' : 'WHERE is_complete'}`
  );
  const subjects = await buildSubjects(false);

  const rows: ExportRow[] = annotations.map((a) => ({
    patientId: a.patient_id,
    values: a.data as AnnotationValues,
    audio: (subjects.get(a.patient_id)?.audio ?? [])
      .filter((x) => x.inS3)
      .map((x) => ({ key: x.key, recordingType: x.recordingType, duration: x.duration, sizeBytes: x.sizeBytes, uploadedAt: x.uploadedAt })),
  }));
  // Порядок как в шаблоне: по дате записи, затем по номеру субъекта.
  rows.sort((a, b) => (a.values.C ?? '').localeCompare(b.values.C ?? '') || (a.values.A ?? '').localeCompare(b.values.A ?? '', 'ru'));

  const buf = await buildDatasetWorkbook(rows);

  await logAudit({
    eventType: 'dataset_export',
    userId: req.user!.id,
    email: req.user!.email,
    ipAddress: clientIp(req),
    details: { rows: rows.length, includeDrafts },
  });

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  const name = `BRAINPHONE_датасет_разметка_${stamp}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="brainphone_dataset_${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.send(buf);
}
