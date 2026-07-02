const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PatientData {
  patient_name: string;
  age: string;
  gender: string;
  chief_complaint: string;
  notes?: string;
  blood_pressure?: string;
  heart_rate?: string;
  temperature?: string;
  protocol_type?: string;
  parkinsonism_stage?: string;
  comorbidities?: string;
  diagnosis?: string;
  native_language?: string;
  has_parkinsonism?: boolean;
  has_cognitive?: boolean;
  cog_motor_test?: string;
  cog_motor_score?: string;
  moca_score?: string;
  mmse_score?: string;
  trch_score?: string;
  updrs_score?: string;
}

export interface AudioUploadData {
  patient_id: string;
  recording_type: string;
  recording_label: string;
  audio: Blob;
  duration: number;
  sample_rate?: number;
  bits_per_sample?: number;
  channels?: number;
  status?: string;
}

// When any response is 401 we fire this event; App listens and redirects to login.
function on401(): void {
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { credentials: 'include', ...options });
  if (response.status === 401) on401();
  return response;
}

export const api = {
  async createPatient(data: PatientData): Promise<ApiResponse> {
    // Abort after 25s so a hung request (e.g. a dead DB socket after a
    // serverless cold start) surfaces as an error instead of freezing the UI.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      const msg = (error as any)?.name === 'AbortError'
        ? 'Сервер не ответил вовремя. Попробуйте ещё раз.'
        : (error instanceof Error ? error.message : 'Unknown error');
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  async uploadAudio(data: AudioUploadData): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('patient_id', data.patient_id);
      formData.append('recording_type', data.recording_type);
      formData.append('recording_label', data.recording_label || data.recording_type);
      formData.append('audio', data.audio, `${data.recording_type}.wav`);
      formData.append('duration', String(data.duration));
      formData.append('sample_rate', String(data.sample_rate || 48000));
      formData.append('bits_per_sample', String(data.bits_per_sample || 16));
      formData.append('channels', String(data.channels || 1));
      formData.append('status', data.status || 'completed');

      const response = await apiFetch(`${API_BASE_URL}/patients/upload-audio`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updatePatient(patientId: string, data: Partial<PatientData>): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(patientId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getPatients(): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients`);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getPatientById(id: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(id)}`);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async searchPatients(query: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deletePatient(patientId: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(patientId)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deletePhoto(photoId: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/photos/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async saveConsent(patientId: string, data: {
    consent_hash: string;
    text_version: string;
    check1: boolean;
    check2: boolean;
    signature_url?: string;
  }): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(patientId)}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async submitCase(patientId: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(patientId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getTodayStats(): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/today-stats`);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch {
      return { success: true, data: { data: { stats: { accepted: 0, rejected: 0, review: 0, total: 0 } } } };
    }
  },

  async reviewCase(patientId: string, status: 'ACCEPTED' | 'REJECTED' | 'REVIEW', rejection_code?: string, rejection_note?: string): Promise<ApiResponse> {
    try {
      const response = await apiFetch(`${API_BASE_URL}/patients/${encodeURIComponent(patientId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejection_code, rejection_note }),
      });
      const result = await response.json();
      return { success: response.ok, data: result, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};
