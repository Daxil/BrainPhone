import type { MDSUPDRSForm, MoCATest } from './forms';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'completed';
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'pending';
export type Screen = 'home' | 'capture' | 'form' | 'processing' | 'results' | 'view' | 'mdsUpdrs' | 'moca' | 'assessments';

export interface AudioConfig {
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
  format: string;
}

export interface Disease {
  name: string;
  percentage: number;
}

export interface PatientRecord {
  id: string;
  audioBlob?: Blob;
  audioUrl?: string;
  audioDuration?: number;
  audioSize?: number;
  audioConfig?: AudioConfig;
  photos: { url: string; file: File | null }[];
  patientName: string;
  age: string;
  gender: string;
  chiefComplaint: string;
  notes: string;
  vitals: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
  };
  mdsUpdrs?: MDSUPDRSForm;
  moca?: MoCATest;
  diseases?: Disease[];
}

export const validatePatientRecord = (record: PatientRecord | null): string[] => {
  const errors: string[] = [];

  if (!record) {
    errors.push('Запись не существует');
    return errors;
  }

  if (!record.id || record.id.trim() === '') {
    errors.push('Отсутствует уникальный идентификатор');
  }

  if (!record.patientName || record.patientName.trim() === '') {
    errors.push('patientName');
  }

  if (!record.age || record.age.trim() === '') {
    errors.push('age');
  }

  if (!record.gender) {
    errors.push('gender');
  }

  if (!record.chiefComplaint || record.chiefComplaint.trim() === '') {
    errors.push('chiefComplaint');
  }

  return errors;
};
