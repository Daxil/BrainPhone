import { Request, Response } from 'express';
import { PatientModel, PatientInput } from '../models/Patient';
import { PatientPhotoModel } from '../models/PatientPhoto';
import { PatientAudioModel } from '../models/PatientAudio';

export const createPatient = async (req: Request, res: Response) => {
  try {
    const patientData: PatientInput = req.body;
    const patient = await PatientModel.create(patientData);
    res.status(201).json({ success: true, data: patient, message: 'Patient created' });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ success: false, error: 'Failed to create patient' });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await PatientModel.findById(id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const photos = await PatientPhotoModel.findByPatientId(id);
    const audioFiles = await PatientAudioModel.findByPatientId(id);

    res.json({ success: true, data: { ...patient, photos, audio_files: audioFiles } });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patient' });
  }
};

export const getAllPatients = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const patients = await PatientModel.findAll(Number(limit), Number(offset));
    const total = await PatientModel.count();

    const patientsWithMedia = await Promise.all(
      patients.map(async (patient) => ({
        ...patient,
        photos: await PatientPhotoModel.findByPatientId(patient.id),
        audio_files: await PatientAudioModel.findByPatientId(patient.id)
      }))
    );

    res.json({ success: true, data: patientsWithMedia, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patients' });
  }
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await PatientModel.update(id, req.body);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
    res.json({ success: true, data: patient, message: 'Patient updated' });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ success: false, error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await PatientPhotoModel.deleteByPatientId(id);
    await PatientAudioModel.deleteByPatientId(id);
    const deleted = await PatientModel.delete(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Patient not found' });
    res.json({ success: true, message: 'Patient deleted' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ success: false, error: 'Failed to delete patient' });
  }
};

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }
    const patients = await PatientModel.search(q);
    const patientsWithMedia = await Promise.all(
      patients.map(async (patient) => ({
        ...patient,
        photos: await PatientPhotoModel.findByPatientId(patient.id),
        audio_files: await PatientAudioModel.findByPatientId(patient.id)
      }))
    );
    res.json({ success: true, data: patientsWithMedia, count: patientsWithMedia.length });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ success: false, error: 'Failed to search patients' });
  }
};
