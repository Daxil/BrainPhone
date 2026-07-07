// Локальный кэш незавершённого кейса (черновика) — по одному ключу на пациента.
// Позволяет продолжить заполнение с того места, где остановились: сохраняются
// поля анкеты, прогресс согласия и записанные задания. Хранится в localStorage,
// поэтому кэш живёт в рамках одного браузера/устройства.
import type { PatientRecord, Screen } from '../types';
import type { CaseFlowState } from '../types/case';

const KEY = (userId: string, patientId: string) => `bp_draft_${userId}_${patientId}`;

export interface DraftSnapshot {
  record: PatientRecord;
  caseFlow: CaseFlowState | null;
  protocol: string | null;
  screen: Screen;
  savedAt: string;
}

// Убираем то, что нельзя (или бессмысленно) сериализовать: Blob-объекты записей
// и File-объекты фото. Ссылки на уже загруженные в облако файлы сохраняем.
function sanitize(snap: DraftSnapshot): DraftSnapshot {
  const record: PatientRecord = {
    ...snap.record,
    audioBlob: undefined,
    photos: (snap.record.photos || []).map((p) => ({
      url: p.file ? '' : p.url, // локальные object-URL после перезагрузки не работают
      file: null,
      id: p.id,
      category: p.category,
    })).filter((p) => p.url),
  };
  const caseFlow = snap.caseFlow
    ? { ...snap.caseFlow, tasks: snap.caseFlow.tasks.map((t) => ({ ...t, audioBlob: undefined })) }
    : null;
  return { ...snap, record, caseFlow };
}

export function saveDraft(userId: string, patientId: string, snap: DraftSnapshot): void {
  if (!userId || !patientId) return;
  try {
    localStorage.setItem(KEY(userId, patientId), JSON.stringify(sanitize(snap)));
  } catch {
    /* переполнение квоты / приватный режим — не критично */
  }
}

export function loadDraft(userId: string, patientId: string): DraftSnapshot | null {
  if (!userId || !patientId) return null;
  try {
    const raw = localStorage.getItem(KEY(userId, patientId));
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string, patientId: string): void {
  if (!userId || !patientId) return;
  try {
    localStorage.removeItem(KEY(userId, patientId));
  } catch {
    /* игнорируем */
  }
}
