import { db } from '../config/database';

export interface PatientAudio {
  id: string;
  patient_id: string;
  recording_type: string;
  recording_label: string;
  file_name: string;
  file_path: string;
  file_size: number;
  duration: number;
  mime_type: string;
  sample_rate: number;
  bits_per_sample: number;
  channels: number;
  status: string;
  yandex_disk_url?: string;
  uploaded_at: Date;
}

export interface AudioInput {
  patient_id: string;
  recording_type: string;
  recording_label: string;
  file_name: string;
  file_path: string;
  file_size: number;
  duration: number;
  mime_type: string;
  sample_rate: number;
  bits_per_sample: number;
  channels: number;
  status?: string;
  yandex_disk_url?: string;
}

export class PatientAudioModel {
  static async create(audio: AudioInput): Promise<PatientAudio> {
    const statement = `
      INSERT INTO patient_audio (
        id, patient_id, recording_type, recording_label, file_name, file_path,
        file_size, duration, mime_type, sample_rate, bits_per_sample, channels,
        status, yandex_disk_url, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (patient_id, recording_type)
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        file_size = EXCLUDED.file_size,
        duration = EXCLUDED.duration,
        mime_type = EXCLUDED.mime_type,
        status = EXCLUDED.status,
        yandex_disk_url = EXCLUDED.yandex_disk_url,
        uploaded_at = NOW()
      RETURNING *;
    `;

    const id = `AUDIO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.one(statement, [
      id, audio.patient_id, audio.recording_type, audio.recording_label,
      audio.file_name, audio.file_path, audio.file_size, audio.duration,
      audio.mime_type, audio.sample_rate, audio.bits_per_sample, audio.channels,
      audio.status || 'completed',
      audio.yandex_disk_url || null,
    ]);

    return result;
  }

  static async findByPatientId(patient_id: string): Promise<PatientAudio[]> {
    const statement = 'SELECT * FROM patient_audio WHERE patient_id = $1 ORDER BY uploaded_at ASC;';
    return await db.manyOrNone(statement, [patient_id]);
  }

  static async deleteByPatientId(patient_id: string): Promise<boolean> {
    await db.none('DELETE FROM patient_audio WHERE patient_id = $1;', [patient_id]);
    return true;
  }
}
