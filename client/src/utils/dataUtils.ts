import { v4 as uuidv4 } from 'uuid';
import type { PatientRecord } from '../types';

export const generatePatientId = (): string => {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAT-${timestamp}-${randomPart}`;
};

export const generatePatientIdSecure = (): string => {
  const uuid = uuidv4();
  const timestamp = Date.now();
  return `PAT-${timestamp}-${uuid.substring(0, 8).toUpperCase()}`;
};

export const generateDiseaseAnalysis = (): { name: string; percentage: number }[] => {
  const diseases = [
    { name: 'Деменция', percentage: Math.floor(Math.random() * 30) + 70 },
    { name: 'Болезнь Альцгеймера', percentage: Math.floor(Math.random() * 20) + 5 },
    { name: 'Болезнь Паркинсона', percentage: Math.floor(Math.random() * 15) + 2 },
    { name: 'Синдром Дауна', percentage: Math.floor(Math.random() * 5) },
    { name: 'Сосудистая деменция', percentage: Math.floor(Math.random() * 10) + 3 },
    { name: 'Лобно-височная деменция', percentage: Math.floor(Math.random() * 8) + 1 },
  ];
  return diseases.sort((a, b) => b.percentage - a.percentage);
};

export const validatePatientForm = (record: PatientRecord | null): string[] => {
  const errors: string[] = [];
  if (!record) return errors;

  if (!record.patientName.trim()) errors.push('patientName');
  if (!record.age.trim()) errors.push('age');
  if (!record.gender) errors.push('gender');
  if (!record.chiefComplaint.trim()) errors.push('chiefComplaint');

  return errors;
};

export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
