// Бизнес-логика: статусы, правила QC, причины пропуска.
// Все пороги — числовые константы, не хардкодятся в UI.

// ── Статусы кейса ─────────────────────────────────────────────────────────────
export type CaseStatus =
  | 'DRAFT'
  | 'CONSENT_PENDING'
  | 'RECORDING'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'REVIEW'
  | 'ACCEPTED'
  | 'REJECTED';

export const CASE_STATUS_ORDER: CaseStatus[] = [
  'DRAFT',
  'CONSENT_PENDING',
  'RECORDING',
  'READY_TO_SUBMIT',
  'SUBMITTING',
  'SUBMITTED',
  'REVIEW',
  'ACCEPTED',
  'REJECTED',
];

// ── Статусы аудиозаписи ───────────────────────────────────────────────────────
export type AudioStatus =
  | 'NOT_RECORDED'
  | 'RECORDED_LOCAL'
  | 'FAILED_LOCAL_QC'
  | 'UPLOADED'
  | 'FAILED_SERVER_QC'
  | 'PASSED_SERVER_QC'
  | 'SKIPPED';

// ── Коды ошибок локального QC ─────────────────────────────────────────────────
export type QCFailCode = 'LQC-DUR' | 'LQC-LONG' | 'LQC-SIL' | 'LQC-CLIP' | 'LQC-LOW';

export interface QCResult {
  passed: boolean;
  code?: QCFailCode;
  canKeep: boolean;   // разрешено ли оставить как есть (по правилам ТЗ)
  canSkip: boolean;   // разрешено ли пропустить
}

// ── Правила QC ────────────────────────────────────────────────────────────────
export const QC_RULES = {
  // Клиппинг: если суммарно >3с клиппинга → обязательна перезапись
  CLIP_MAX_SEC: 3,
  // Порог клиппинга: сэмпл считается клиппированным при |x| >= этого значения
  // Немного снижен с учётом усиления gain=2.5 — чтобы не ложно срабатывало
  CLIP_SAMPLE_THRESHOLD: 0.97,

  // Тишина: доля тихих сэмплов; если >40% → перезапись
  // Порог снижен: gain 2.5× поднимает даже тихие сэмплы выше 0.01
  SILENCE_SAMPLE_THRESHOLD: 0.02,   // сэмпл тихий если |x| < 0.02
  SILENCE_MAX_RATIO: 0.40,          // максимальная доля тишины

  // Уровень сигнала: средний RMS ниже этого → запись слишком тихая
  // Снижен с 0.005 → 0.003: gain компенсирует, но порог страхует от полной тишины
  LOW_RMS_THRESHOLD: 0.003,

  // Уровень индикатора для UI (0..1) — с учётом gain=2.5
  LEVEL_LOW_MAX: 0.10,   // ниже — тихо (жёлтый)
  LEVEL_HIGH_MIN: 0.75,  // выше — перегрузка (красный)
} as const;

// ── Типы заданий по протоколам ────────────────────────────────────────────────
// Задания и границы длительности совпадают с brainphone-pro, чтобы записи
// датасета были сопоставимы с тем, что получают модели в продукте.
export type TaskType =
  | 'PH-A'    // Протяжный звук «А»
  | 'SP-READ' // Чтение текста «Гималайский медведь»
  | 'SP-PIC'; // Описание сюжетной картинки (из когнитивного скрининга brainphone-pro)

// Правила длительности по типу задания (секунды). Вне диапазона — перезапись.
// Поведение записи, как в brainphone-pro: «А» останавливается само на максимуме,
// при чтении 15 с тишины останавливают запись, картинку останавливает врач.
export const TASK_DURATION_RULES: Record<TaskType, {
  min: number;
  max: number;
  autoStopAtMax?: boolean;
  silenceTimeout?: number;
}> = {
  'PH-A':    { min: 7,  max: 15,  autoStopAtMax: true },
  'SP-READ': { min: 25, max: 180, silenceTimeout: 15 },
  'SP-PIC':  { min: 15, max: 180 },
};

// Обратный отсчёт перед записью: микрофон уже открыт, отсчёт идёт на живом входе.
export const COUNT_IN_SECONDS = 3;
// Нормированный уровень (0–1), ниже которого вход считается тишиной.
export const SILENCE_LEVEL = 0.12;

// ── Определения заданий для каждого протокола ─────────────────────────────────
export interface TaskDefinition {
  taskType: TaskType;
  label: string;
  fileCode: string;   // для именования файлов: N001-PH-A, N001-SP-PIC и т.д.
  required: boolean;
}

const TASK_A:       TaskDefinition = { taskType: 'PH-A',    label: 'Протяжный звук «А»',                  fileCode: 'PH-A',    required: true };
// Чтение в brainphone-pro необязательно — так же и здесь.
const TASK_READING: TaskDefinition = { taskType: 'SP-READ', label: 'Чтение текста «Гималайский медведь»', fileCode: 'SP-READ', required: false };
const TASK_PICTURE: TaskDefinition = { taskType: 'SP-PIC',  label: 'Описание сюжетной картинки',          fileCode: 'SP-PIC',  required: true };

export const PROTOCOL_TASKS: Record<'phonemes' | 'speech' | 'full', TaskDefinition[]> = {
  phonemes: [TASK_A],
  speech:   [TASK_PICTURE, TASK_READING],
  full:     [TASK_A, TASK_READING, TASK_PICTURE],
};

/** Задания кейса: при когнитивном профиле всегда есть описание картинки. */
export function tasksForCase(protocol: 'phonemes' | 'speech' | 'full', hasCognitive?: boolean): TaskDefinition[] {
  const base = PROTOCOL_TASKS[protocol];
  return hasCognitive && !base.some(t => t.taskType === 'SP-PIC') ? [...base, TASK_PICTURE] : base;
}

// ── Правила оплаты ────────────────────────────────────────────────────────────
export interface PaymentEligibility {
  eligible: boolean;
  reason?: string;
}

export function checkPaymentEligibility(params: {
  consentOk: boolean;
  fieldsOk: boolean;
  requiredAudioOk: boolean;
  qcRequiredOk: boolean;
  fraudOk: boolean;
}): PaymentEligibility {
  if (!params.consentOk) return { eligible: false, reason: 'CONSENT-01' };
  if (!params.fieldsOk) return { eligible: false, reason: 'CLIN-01' };
  if (!params.requiredAudioOk) return { eligible: false, reason: 'AUD-01' };
  if (!params.qcRequiredOk) return { eligible: false, reason: 'QC-10' };
  if (!params.fraudOk) return { eligible: false, reason: 'SAFE-01' };
  return { eligible: true };
}

// ── Офлайн-очередь ────────────────────────────────────────────────────────────
export const OFFLINE_QUEUE_KEY = 'pv_offline_queue';
export const ONBOARDING_KEY = (userId: string) => `pv_onboarding_${userId}`;
