import { db } from '../config/database';

export interface PatientPhoto {
  id: string;
  patient_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  yandex_disk_url?: string;
  uploaded_at: Date;
}

export interface PhotoInput {
  patient_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  yandex_disk_url?: string;
}

export class PatientPhotoModel {
  static async create(photo: PhotoInput): Promise<PatientPhoto> {
    const statement = `
      INSERT INTO patient_photos (
        id, patient_id, file_name, file_path, file_size, mime_type, yandex_disk_url, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *;
    `;

    const id = `PHOTO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.one(statement, [
      id, photo.patient_id, photo.file_name, photo.file_path,
      photo.file_size, photo.mime_type, photo.yandex_disk_url || null,
    ]);

    return result;
  }

  static async findByPatientId(patient_id: string): Promise<PatientPhoto[]> {
    const statement = 'SELECT * FROM patient_photos WHERE patient_id = $1 ORDER BY uploaded_at ASC;';
    return await db.manyOrNone(statement, [patient_id]);
  }

  static async deleteByPatientId(patient_id: string): Promise<boolean> {
    await db.none('DELETE FROM patient_photos WHERE patient_id = $1;', [patient_id]);
    return true;
  }
}
