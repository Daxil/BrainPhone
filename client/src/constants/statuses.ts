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
export type QCFailCode = 'LQC-DUR' | 'LQC-SIL' | 'LQC-CLIP' | 'LQC-LOW';

export interface QCResult {
  passed: boolean;
  code?: QCFailCode;
  canKeep: boolean;   // разрешено ли оставить как есть (по правилам ТЗ)
  canSkip: boolean;   // разрешено ли пропустить
}

// ── Правила QC ────────────────────────────────────────────────────────────────
export const QC_RULES = {
  // Фонемы: обязательный минимум и рекомендуемая длина (секунды)
  PHONEME_MIN_SEC: 5,
  PHONEME_REC_SEC: 9,

  // Речь / чтение: минимальная длина (секунды)
  SPEECH_MIN_SEC: 20,

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
export type TaskType =
  | 'PH-A'    // Фонема «аааааааа»
  | 'PH-OI'   // Фонемы «о-и-о-и»
  | 'SP-PIC1' // Описание картинки «Вор печенья»
  | 'SP-PIC2' // Описание картинки «Кошка на дереве»
  | 'SP-READ' // Чтение текста «Гималайский медведь»;

// Правила длительности по типу задания
export const TASK_DURATION_RULES: Record<TaskType, { min?: number; rec?: number; max?: number; isPhoneme: boolean }> = {
  'PH-A':    { min: QC_RULES.PHONEME_MIN_SEC, rec: QC_RULES.PHONEME_REC_SEC, isPhoneme: true },
  'PH-OI':   { min: QC_RULES.PHONEME_MIN_SEC, rec: QC_RULES.PHONEME_REC_SEC, isPhoneme: true },
  'SP-PIC1': { min: QC_RULES.SPEECH_MIN_SEC, max: 90, isPhoneme: false },
  'SP-PIC2': { min: QC_RULES.SPEECH_MIN_SEC, max: 90, isPhoneme: false },
  'SP-READ': { min: QC_RULES.SPEECH_MIN_SEC, max: 120, isPhoneme: false },
};

// ── Определения заданий для каждого протокола ─────────────────────────────────
export interface TaskDefinition {
  taskType: TaskType;
  label: string;
  fileCode: string;   // для именования файлов: N001-PH-A, N001-SP-PIC1 и т.д.
  required: boolean;
}

export const PROTOCOL_TASKS: Record<'phonemes' | 'speech' | 'full', TaskDefinition[]> = {
  phonemes: [
    { taskType: 'PH-A',  label: 'Фонема «аааааааа»',             fileCode: 'PH-A',    required: true },
    { taskType: 'PH-OI', label: 'Фонемы «о-и-о-и-о-и»',          fileCode: 'PH-OI',   required: true },
  ],
  speech: [
    { taskType: 'SP-PIC1', label: 'Описание картинки «Вор печенья»',       fileCode: 'SP-PIC1', required: true },
    { taskType: 'SP-READ', label: 'Чтение текста «Гималайский медведь»',   fileCode: 'SP-READ', required: true },
  ],
  full: [
    { taskType: 'PH-A',    label: 'Фонема «аааааааа»',                      fileCode: 'PH-A',    required: true },
    { taskType: 'PH-OI',   label: 'Фонемы «о-и-о-и-о-и»',                  fileCode: 'PH-OI',   required: true },
    { taskType: 'SP-PIC1', label: 'Описание картинки «Вор печенья»',        fileCode: 'SP-PIC1', required: true },
    { taskType: 'SP-PIC2', label: 'Описание картинки «Кошка на дереве»',    fileCode: 'SP-PIC2', required: true },
    { taskType: 'SP-READ', label: 'Чтение текста «Гималайский медведь»',    fileCode: 'SP-READ', required: true },
  ],
};

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
