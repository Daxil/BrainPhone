const API_BASE_URL = 'http://localhost:3001/api';

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
  moca_score?: string;
  audio_config?: any;
  audio_recordings?: any[];
  mds_updrs?: any;
  moca?: any;
  diseases?: any[];
  photos?: any[];
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

export const api = {
  async createPatient(data: PatientData): Promise<ApiResponse> {
    try {
      console.log('Отправка данных на сервер:', data);
      const response = await fetch(API_BASE_URL + '/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => {
          return { error: 'HTTP error! status: ' + response.status };
        });
        throw new Error(errorData.error || 'HTTP error! status: ' + response.status);
      }

      const result = await response.json();
      console.log('Успешно сохранено:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async uploadAudio(data: AudioUploadData): Promise<ApiResponse> {
    try {
      console.log('Загрузка аудио:', {
        patient_id: data.patient_id,
        recording_type: data.recording_type,
        duration: data.duration,
        size: data.audio instanceof Blob ? data.audio.size : 'N/A'
      });

      const formData = new FormData();
      formData.append('patient_id', data.patient_id);
      formData.append('recording_type', data.recording_type);
      formData.append('recording_label', data.recording_label || data.recording_type);
      formData.append('audio', data.audio, data.recording_type + '.wav');
      formData.append('duration', String(data.duration));
      formData.append('sample_rate', String(data.sample_rate || 48000));
      formData.append('bits_per_sample', String(data.bits_per_sample || 16));
      formData.append('channels', String(data.channels || 1));
      formData.append('status', data.status || 'completed');

      const response = await fetch(API_BASE_URL + '/patients/upload-audio', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      console.log('Ответ сервера:', response.status, responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: 'HTTP error! status: ' + response.status };
        }
        throw new Error(errorData.error || 'HTTP error! status: ' + response.status);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { success: true };
      }

      console.log('Аудио загружено:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('Ошибка загрузки аудио:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getPatients(): Promise<ApiResponse> {
    try {
      const response = await fetch(API_BASE_URL + '/patients');
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      const result = await response.json();
      console.log('Получены пациенты:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getPatientById(id: string): Promise<ApiResponse> {
    try {
      const response = await fetch(API_BASE_URL + '/patients/' + id);
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async searchPatients(query: string): Promise<ApiResponse> {
    try {
      const response = await fetch(API_BASE_URL + '/patients/search?q=' + encodeURIComponent(query));
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
};
