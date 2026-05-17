import type { MDSUPDRSForm, MoCATest, AudioRecording } from './forms';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'completed';
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'pending';
export type Screen =
  | 'home'
  | 'protocolSelect'
  | 'form'
  | 'consent'
  | 'taskList'
  | 'recording'
  | 'readyToSubmit'
  | 'caseResult'
  | 'myCases'
  | 'support'
  | 'capture'       // legacy
  | 'processing'    // legacy
  | 'results'       // legacy
  | 'view'
  | 'mdsUpdrs'
  | 'moca'
  | 'assessments';
export type ProtocolType = 'phonemes' | 'speech' | 'full';

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
  photos: { url: string; file: File | null; id?: string; category?: 'consult' | 'scale' }[];
  audioRecordings?: AudioRecording[];
  patientName: string;
  age: string;
  gender: string;
  chiefComplaint: string;
  notes: string;
  protocolType?: string;
  // v2 fields
  hasParkinsonism?: boolean;
  hasCognitive?: boolean;
  diagnosis?: string;
  nativeLanguage?: string;
  cogMotorTest?: string;
  cogMotorScore?: string;
  caseStatus?: string;
  caseNumber?: string;
  rejectionCode?: string;
  rejectionNote?: string;
  submittedAt?: string;
  // assessment scores (one field per instrument)
  mocaScore?: string;
  mmseScore?: string;
  trchScore?: string;
  updrsScore?: string;
  // legacy
  parkinsonismStage?: string;
  comorbidities?: string;
  vitals: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
  };
  mdsUpdrs?: MDSUPDRSForm;
  moca?: MoCATest;
  diseases?: Disease[];
  createdAt?: string;
  updatedAt?: string;
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
