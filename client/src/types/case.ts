import type { CaseStatus, AudioStatus, QCResult, TaskType } from '../constants/statuses';
import type { ProtocolType } from './index';

export interface CaseTask {
  id: string;
  taskType: TaskType;
  label: string;
  fileCode: string;
  required: boolean;
  status: AudioStatus;
  skipReason?: string;
  duration?: number;
  audioBlob?: Blob;
  audioUrl?: string;
  uploadedUrl?: string;
  qcResult?: QCResult;
}

export interface ConsentData {
  textVersion: string;      // SHA-256 от текста согласия
  timestamp: string;        // ISO datetime
  caseId: string;
  doctorId: string;
  check1: boolean;
  check2: boolean;
  signatureDataUrl: string; // base64 PNG подписи
  hash: string;             // SHA-256(textVersion + timestamp + caseId + doctorId)
}

export interface CaseFlowState {
  patientId: string;
  protocol: ProtocolType;
  caseStatus: CaseStatus;
  consent: ConsentData | null;
  tasks: CaseTask[];
  activeTaskId: string | null;
}

export interface PaymentHistoryItem {
  caseId: string;
  caseNumber: string;
  amount: number;
  paidAt: string;
  protocol: string;
}
