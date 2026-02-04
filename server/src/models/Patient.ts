import { db } from '../config/database';

export interface Patient {
  id: string;
  patient_name: string;
  age: string;
  gender: string;
  chief_complaint: string;
  notes: string;
  blood_pressure: string;
  heart_rate: string;
  temperature: string;
  audio_config?: any;
  mds_updrs?: any;
  moca?: any;
  diseases?: any[];
  created_at: Date;
  updated_at: Date;
}

export interface PatientInput {
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

export class PatientModel {
  static async create(patient: PatientInput): Promise<Patient> {
    const statement = `
      INSERT INTO patients (
        id, patient_name, age, gender, chief_complaint, notes,
        blood_pressure, heart_rate, temperature, audio_config,
        mds_updrs, moca, diseases, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING *;
    `;

    const id = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const result = await db.one(statement, [
      id,
      patient.patient_name,
      patient.age,
      patient.gender,
      patient.chief_complaint,
      patient.notes || '',
      patient.blood_pressure || '',
      patient.heart_rate || '',
      patient.temperature || '',
      patient.audio_config || null,
      patient.mds_updrs || null,
      patient.moca || null,
      patient.diseases || null,
    ]);

    return result;
  }

  static async findById(id: string): Promise<Patient | null> {
    const statement = 'SELECT * FROM patients WHERE id = $1;';
    try {
      const result = await db.one(statement, [id]);
      return result;
    } catch {
      return null;
    }
  }

  static async findAll(limit: number = 100, offset: number = 0): Promise<Patient[]> {
    const statement = `
      SELECT * FROM patients
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await db.manyOrNone(statement, [limit, offset]);
    return result;
  }

  static async update(id: string, updates: Partial<PatientInput>): Promise<Patient | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 2;

    if (updates.patient_name !== undefined) {
      fields.push(`patient_name = $${paramIndex++}`);
      values.push(updates.patient_name);
    }
    if (updates.age !== undefined) {
      fields.push(`age = $${paramIndex++}`);
      values.push(updates.age);
    }
    if (updates.gender !== undefined) {
      fields.push(`gender = $${paramIndex++}`);
      values.push(updates.gender);
    }
    if (updates.chief_complaint !== undefined) {
      fields.push(`chief_complaint = $${paramIndex++}`);
      values.push(updates.chief_complaint);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }
    if (updates.blood_pressure !== undefined) {
      fields.push(`blood_pressure = $${paramIndex++}`);
      values.push(updates.blood_pressure);
    }
    if (updates.heart_rate !== undefined) {
      fields.push(`heart_rate = $${paramIndex++}`);
      values.push(updates.heart_rate);
    }
    if (updates.temperature !== undefined) {
      fields.push(`temperature = $${paramIndex++}`);
      values.push(updates.temperature);
    }
    if (updates.audio_config !== undefined) {
      fields.push(`audio_config = $${paramIndex++}`);
      values.push(updates.audio_config);
    }
    if (updates.mds_updrs !== undefined) {
      fields.push(`mds_updrs = $${paramIndex++}`);
      values.push(updates.mds_updrs);
    }
    if (updates.moca !== undefined) {
      fields.push(`moca = $${paramIndex++}`);
      values.push(updates.moca);
    }
    if (updates.diseases !== undefined) {
      fields.push(`diseases = $${paramIndex++}`);
      values.push(updates.diseases);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const statement = `
      UPDATE patients
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const result = await db.one(statement, values);
      return result;
    } catch {
      return null;
    }
  }

  static async delete(id: string): Promise<boolean> {
    const statement = 'DELETE FROM patients WHERE id = $1;';
    try {
      await db.none(statement, [id]);
      return true;
    } catch {
      return false;
    }
  }

  static async search(query: string): Promise<Patient[]> {
    const statement = `
      SELECT * FROM patients
      WHERE patient_name ILIKE $1
      OR chief_complaint ILIKE $1
      ORDER BY created_at DESC;
    `;
    const result = await db.manyOrNone(statement, [`%${query}%`]);
    return result;
  }

  static async count(): Promise<number> {
    const statement = 'SELECT COUNT(*) as count FROM patients;';
    const result = await db.one(statement);
    return parseInt(result.count);
  }
}
