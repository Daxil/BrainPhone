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
  audio_config?: any;
  mds_updrs?: any;
  moca?: any;
  diseases?: any[];
}

export const api = {
  async createPatient( PatientData): Promise<ApiResponse> {
    try {
      console.log('Отправка данных на сервер:', data);

      const response = await fetch(`${API_BASE_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Успешно сохранено:', result);
      return { success: true,  result.data };
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getPatients(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/patients`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true,  result.data };
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
      const response = await fetch(`${API_BASE_URL}/patients/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, data: result.data };
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
      const response = await fetch(`${API_BASE_URL}/patients/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true,  result.data };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
