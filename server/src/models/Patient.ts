import { db } from '../config/database';

export interface Patient {
  id: string;
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
  protocol_type?: string;
  parkinsonism_stage?: string;
  comorbidities?: string;
  diagnosis?: string;
  moca_score?: string;
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
        blood_pressure, heart_rate, temperature, protocol_type,
        parkinsonism_stage, comorbidities, diagnosis, moca_score,
        audio_config, mds_updrs, moca, diseases, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *;
    `;

    const id = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    const result = await db.one(statement, [
      id, patient.patient_name, patient.age, patient.gender, patient.chief_complaint, patient.notes || null,
      patient.blood_pressure || null, patient.heart_rate || null, patient.temperature || null, patient.protocol_type || null,
      patient.parkinsonism_stage || null, patient.comorbidities || null, patient.diagnosis || null, patient.moca_score || null,
      patient.audio_config || null, patient.mds_updrs || null, patient.moca || null, patient.diseases || null,
    ]);

    return result;
  }

  static async findById(id: string): Promise<Patient | null> {
    const statement = 'SELECT * FROM patients WHERE id = $1;';
    return await db.oneOrNone(statement, [id]);
  }

  static async findAll(limit: number, offset: number): Promise<Patient[]> {
    const statement = 'SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2;';
    return await db.manyOrNone(statement, [limit, offset]);
  }

  static async count(): Promise<number> {
    const result = await db.one('SELECT COUNT(*) FROM patients;');
    return parseInt(result.count, 10);
  }

  static async update(id: string, updates: Partial<PatientInput>): Promise<Patient | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (sets.length === 0) return await this.findById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const statement = `UPDATE patients SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *;`;
    return await db.oneOrNone(statement, values);
  }

  static async delete(id: string): Promise<boolean> {
    await db.none('DELETE FROM patients WHERE id = $1;', [id]);
    return true;
  }

  static async search(query: string): Promise<Patient[]> {
    const statement = `
      SELECT * FROM patients
      WHERE patient_name ILIKE $1 OR chief_complaint ILIKE $1 OR id ILIKE $1
      ORDER BY created_at DESC;
    `;
    return await db.manyOrNone(statement, [`%${query}%`]);
  }
}
