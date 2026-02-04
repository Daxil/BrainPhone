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
}

export class PatientPhotoModel {
  static async create(photo: PhotoInput): Promise<PatientPhoto> {
    const statement = `
      INSERT INTO patient_photos (
        id, patient_id, file_name, file_path, file_size, mime_type, uploaded_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW()
      ) RETURNING *;
    `;

    const id = `PHOTO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.one(statement, [
      id,
      photo.patient_id,
      photo.file_name,
      photo.file_path,
      photo.file_size,
      photo.mime_type,
    ]);

    return result;
  }

  static async findByPatientId(patient_id: string): Promise<PatientPhoto[]> {
    const statement = 'SELECT * FROM patient_photos WHERE patient_id = $1 ORDER BY uploaded_at DESC;';
    const result = await db.manyOrNone(statement, [patient_id]);
    return result;
  }

  static async findById(id: string): Promise<PatientPhoto | null> {
    const statement = 'SELECT * FROM patient_photos WHERE id = $1;';
    try {
      const result = await db.one(statement, [id]);
      return result;
    } catch {
      return null;
    }
  }

  static async updateYandexUrl(id: string, url: string): Promise<boolean> {
    const statement = 'UPDATE patient_photos SET yandex_disk_url = $1 WHERE id = $2;';
    try {
      await db.none(statement, [url, id]);
      return true;
    } catch {
      return false;
    }
  }

  static async delete(id: string): Promise<boolean> {
    const statement = 'DELETE FROM patient_photos WHERE id = $1;';
    try {
      await db.none(statement, [id]);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteByPatientId(patient_id: string): Promise<boolean> {
    const statement = 'DELETE FROM patient_photos WHERE patient_id = $1;';
    try {
      await db.none(statement, [patient_id]);
      return true;
    } catch {
      return false;
    }
  }
}
