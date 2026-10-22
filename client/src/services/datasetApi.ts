import { API_BASE_URL as BASE } from '../config';

// Разметка датасета (только супер-админы). Сервер для изменяющих запросов
// требует X-Requested-With — без него запрос отклоняется как возможный CSRF.

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect';

export interface DatasetField {
  key: string;
  header: string;
  label: string;
  group: string;
  type: FieldType;
  options?: string[];
  allowMarks?: boolean;
  min?: number;
  max?: number;
}

export interface DatasetSchema {
  groups: string[];
  fields: DatasetField[];
  audioSlots: { key: string; slot: number; label: string; taskTypes: string[] }[];
  audioNoteKey: string;
  marks: string[];
  stepUpRequiresTotp: boolean;
}

export interface DatasetAudio {
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
  url?: string | null;
  datasetName?: string | null;
}

export interface DatasetSubject {
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
  audio: DatasetAudio[];
  annotation: { isComplete: boolean; updatedAt: string; subjectCode: string | null } | null;
}

export type AnnotationValues = Record<string, string>;

export interface DatasetRecord {
  patientId: string;
  patient: Record<string, unknown> | null;
  questionnaire: unknown;
  consent: Record<string, unknown> | null;
  audio: DatasetAudio[];
  annotation: { data: AnnotationValues; isComplete: boolean; version: number; updatedAt: string; annotatedBy: string | null } | null;
  suggested: AnnotationValues;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  requireStepUp?: boolean;
}

async function call<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}/dataset${path}`, {
      method,
      credentials: 'include',
      headers: {
        'X-Requested-With': 'BrainPhone',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      return { ok: false, status: res.status, error: json.error || `Ошибка ${res.status}`, fieldErrors: json.fieldErrors, requireStepUp: json.requireStepUp };
    }
    return { ok: true, status: res.status, data: json as T };
  } catch {
    return { ok: false, status: 0, error: 'Нет связи с сервером' };
  }
}

export const datasetApi = {
  access: () => call<{ allowed: boolean }>('GET', '/access'),
  schema: () => call<{ schema: DatasetSchema }>('GET', '/schema'),
  records: (refresh = false) =>
    call<{ records: DatasetSubject[]; s3Configured: boolean; syncedAt: string }>('GET', `/records${refresh ? '?refresh=1' : ''}`),
  record: (patientId: string) => call<{ record: DatasetRecord }>('GET', `/records/${encodeURIComponent(patientId)}`),
  saveAnnotation: (patientId: string, data: AnnotationValues, isComplete: boolean, version: number | null) =>
    call<{ annotation: { data: AnnotationValues; isComplete: boolean; version: number; updatedAt: string } }>(
      'PUT', `/records/${encodeURIComponent(patientId)}/annotation`, { data, isComplete, version }),
  stepUp: (password: string, totp?: string) =>
    call<{ token: string; expiresInSec: number }>('POST', '/step-up', { password, totp }),
  deleteAudio: (key: string, confirmFileName: string, stepUpToken: string) =>
    call<{ trashed: boolean }>('DELETE', '/audio', { key, confirmFileName }, { 'X-BP-Step-Up': stepUpToken }),

  async downloadExport(includeDrafts: boolean): Promise<ApiResult<null>> {
    try {
      const res = await fetch(`${BASE}/dataset/export.xlsx${includeDrafts ? '?scope=all' : ''}`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'BrainPhone' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { ok: false, status: res.status, error: json.error || `Ошибка ${res.status}` };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BRAINPHONE_датасет_разметка_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return { ok: true, status: res.status };
    } catch {
      return { ok: false, status: 0, error: 'Нет связи с сервером' };
    }
  },
};
