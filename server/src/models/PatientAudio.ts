import { db } from '../config/database';

export interface PatientAudio {
  id: string;
  patient_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  duration: number;
  mime_type: string;
  sample_rate: number;
  bits_per_sample: number;
  channels: number;
  yandex_disk_url?: string;
  uploaded_at: Date;
}

export interface AudioInput {
  patient_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  duration: number;
  mime_type: string;
  sample_rate: number;
  bits_per_sample: number;
  channels: number;
}

export class PatientAudioModel {
  static async create(audio: AudioInput): Promise<PatientAudio> {
    const statement = `
      INSERT INTO patient_audio (
        id, patient_id, file_name, file_path, file_size, duration,
        mime_type, sample_rate, bits_per_sample, channels, uploaded_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
      ) RETURNING *;
    `;

    const id = `AUDIO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.one(statement, [
      id,
      audio.patient_id,
      audio.file_name,
      audio.file_path,
      audio.file_size,
      audio.duration,
      audio.mime_type,
      audio.sample_rate,
      audio.bits_per_sample,
      audio.channels,
    ]);

    return result;
  }

  static async findByPatientId(patient_id: string): Promise<PatientAudio[]> {
    const statement = 'SELECT * FROM patient_audio WHERE patient_id = $1 ORDER BY uploaded_at DESC;';
    const result = await db.manyOrNone(statement, [patient_id]);
    return result;
  }

  static async findById(id: string): Promise<PatientAudio | null> {
    const statement = 'SELECT * FROM patient_audio WHERE id = $1;';
    try {
      const result = await db.one(statement, [id]);
      return result;
    } catch {
      return null;
    }
  }

  static async updateYandexUrl(id: string, url: string): Promise<boolean> {
    const statement = 'UPDATE patient_audio SET yandex_disk_url = $1 WHERE id = $2;';
    try {
      await db.none(statement, [url, id]);
      return true;
    } catch {
      return false;
    }
  }

  static async delete(id: string): Promise<boolean> {
    const statement = 'DELETE FROM patient_audio WHERE id = $1;';
    try {
      await db.none(statement, [id]);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteByPatientId(patient_id: string): Promise<boolean> {
    const statement = 'DELETE FROM patient_audio WHERE patient_id = $1;';
    try {
      await db.none(statement, [patient_id]);
      return true;
    } catch {
      return false;
    }
  }
}
