import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { PatientModel, PatientInput } from '../models/Patient';
import { PatientPhotoModel } from '../models/PatientPhoto';
import { PatientAudioModel } from '../models/PatientAudio';
import { uploadToYandexDisk } from '../services/yandexDisk';

export const createPatient = async (req: Request, res: Response) => {
  try {
    const patientData: PatientInput = req.body;
    const patient = await PatientModel.create(patientData);
    res.status(201).json({
      success: true,
      data: patient,
      message: 'Patient created'
    });
  } catch (error: any) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create patient'
    });
  }
};

export const uploadAudio = async (req: Request, res: Response) => {
  try {
    console.log('uploadAudio вызван');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'NO FILE');

    const patient_id = req.body.patient_id;
    const recording_type = req.body.recording_type;
    const recording_label = req.body.recording_label;
    const duration = req.body.duration;
    const sample_rate = req.body.sample_rate;
    const bits_per_sample = req.body.bits_per_sample;
    const channels = req.body.channels;
    const status = req.body.status;

    if (!patient_id) {
      console.error('Missing patient_id');
      return res.status(400).json({
        success: false,
        error: 'patient_id is required'
      });
    }
    if (!recording_type) {
      console.error('Missing recording_type');
      return res.status(400).json({
        success: false,
        error: 'recording_type is required'
      });
    }
    if (!req.file) {
      console.error('Missing audio file');
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const file = req.file;

    const fileExt = '.wav';
    const safeFileName = recording_type + '-' + Date.now() + fileExt;

    const uploadDir = path.join(__dirname, '../../uploads/audio');
    console.log('Папка для загрузки:', uploadDir);

    if (!fs.existsSync(uploadDir)) {
      console.log('Создаю папку:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const localFilePath = path.join(uploadDir, safeFileName);
    console.log('Сохраняю файл локально:', localFilePath);

    fs.writeFileSync(localFilePath, file.buffer);
    console.log('Файл WAV сохранён локально');

    // ЗАГРУЗКА НА ЯНДЕКС.ДИСК
    let yandexDiskUrl: string | undefined;
    try {
      console.log('Загрузка на Яндекс.Диск...');
      const yandexResult = await uploadToYandexDisk(
        localFilePath,
        safeFileName,
        recording_type,
        'audio/wav'
      );

      if (yandexResult.success && yandexResult.publicUrl) {
        yandexDiskUrl = yandexResult.publicUrl;
        console.log('Загружено на Яндекс.Диск:', yandexDiskUrl);
      } else {
        console.warn('Не удалось загрузить на Яндекс.Диск:', yandexResult.error);
      }
    } catch (yandexError: any) {
      console.error('Ошибка Яндекс.Диск:', yandexError.message);
    }

    const audio = await PatientAudioModel.create({
      patient_id: patient_id,
      recording_type: recording_type,
      recording_label: recording_label || recording_type,
      file_name: safeFileName,
      file_path: '/uploads/audio/' + safeFileName,
      file_size: file.size,
      duration: parseInt(String(duration), 10) || 0,
      mime_type: 'audio/wav',
      sample_rate: parseInt(String(sample_rate), 10) || 48000,
      bits_per_sample: parseInt(String(bits_per_sample), 10) || 16,
      channels: parseInt(String(channels), 10) || 1,
      status: status || 'completed',
      yandex_disk_url: yandexDiskUrl,
    });

    console.log('Аудио WAV сохранено в БД:', audio.id);

    res.status(201).json({
      success: true,
      data: {
        audio: audio
      },
      message: 'Audio uploaded successfully',
      yandexDiskUrl: yandexDiskUrl
    });
  } catch (error: any) {
    console.error('Ошибка в uploadAudio:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const syncYandex = async (req: Request, res: Response) => {
  try {
    console.log('syncYandex вызван');
    console.log('req.body:', req.body);

    const patient_id = req.body.patient_id;
    const recording_type = req.body.recording_type;
    const recording_label = req.body.recording_label;
    const duration = req.body.duration;

    if (!patient_id || !recording_type) {
      console.error('Missing patient_id or recording_type');
      return res.status(400).json({
        success: false,
        error: 'patient_id and recording_type required'
      });
    }

    // Находим аудио в БД
    const audioFiles = await PatientAudioModel.findByPatientId(patient_id);
    const audio = audioFiles.find(function(a: any) {
      return a.recording_type === recording_type;
    });

    if (!audio) {
      console.error('Audio not found for patient:', patient_id, 'type:', recording_type);
      return res.status(404).json({
        success: false,
        error: 'Audio not found'
      });
    }

    // Если уже есть ссылка на Яндекс.Диск — возвращаем её
    if (audio.yandex_disk_url) {
      console.log('Уже есть ссылка на Яндекс.Диск:', audio.yandex_disk_url);
      return res.json({
        success: true,
        data: { yandex_disk_url: audio.yandex_disk_url },
      });
    }

    // 🔥 ПРАВИЛЬНОЕ построение пути к локальному файлу
    // audio.file_path = "/uploads/audio/file.wav"
    // __dirname = "C:/.../server/src/controllers"
    const relativePath = audio.file_path.replace(/^\//, ''); // убираем ведущий /
    const localFilePath = path.join(__dirname, '../../', relativePath);

    console.log('Путь к локальному файлу:', localFilePath);

    if (!fs.existsSync(localFilePath)) {
      console.error('Файл не найден:', localFilePath);
      return res.status(404).json({
        success: false,
        error: 'Local file not found: ' + localFilePath
      });
    }

    console.log('Загрузка на Яндекс.Диск:', audio.file_name);

    // Загружаем на Яндекс.Диск
    const yandexResult = await uploadToYandexDisk(
      localFilePath,
      audio.file_name,
      recording_type,
      audio.mime_type || 'audio/wav'
    );

    if (yandexResult.success && yandexResult.publicUrl) {
      // Обновляем запись в БД
      const { db } = await import('../config/database');
      const statement = `
        UPDATE patient_audio
        SET yandex_disk_url = $1, uploaded_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;

      const updated = await db.one(statement, [yandexResult.publicUrl, audio.id]);

      console.log('Загружено на Яндекс.Диск:', yandexResult.publicUrl);

      return res.json({
        success: true,
        data: { yandex_disk_url: yandexResult.publicUrl, audio: updated },
      });
    } else {
      console.error('Ошибка загрузки на Яндекс.Диск:', yandexResult.error);
      return res.status(500).json({
        success: false,
        error: yandexResult.error || 'Failed to upload to Yandex Disk',
      });
    }
  } catch (error: any) {
    console.error('❌ Ошибка в syncYandex:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync with Yandex Disk',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const patient = await PatientModel.findById(id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    const photos = await PatientPhotoModel.findByPatientId(id);
    const audioFiles = await PatientAudioModel.findByPatientId(id);
    res.json({
      success: true,
      data: {
        patient: patient,
        photos: photos,
        audio_files: audioFiles
      }
    });
  } catch (error: any) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patient'
    });
  }
};

export const getAllPatients = async (req: Request, res: Response) => {
  try {
    console.log('getAllPatients вызван');

    const limitParam = req.query.limit as string;
    const offsetParam = req.query.offset as string;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const patients = await PatientModel.findAll(limit, offset);
    console.log('Найдено пациентов:', patients.length);

    const total = await PatientModel.count();
    const patientsWithMedia = await Promise.all(
      patients.map(async (patient) => {
        const photos = await PatientPhotoModel.findByPatientId(patient.id);
        const audio_files = await PatientAudioModel.findByPatientId(patient.id);
        return {
          ...patient,
          photos: photos,
          audio_files: audio_files
        };
      })
    );

    console.log('Отправляю ответ:', { patients: patientsWithMedia.length, total: total });
    res.json({
      success: true,
      data: {
        patients: patientsWithMedia,
        total: total,
        limit: limit,
        offset: offset
      }
    });
  } catch (error: any) {
    console.error('Error fetching patients:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patients'
    });
  }
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const patient = await PatientModel.update(id, req.body);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    res.json({
      success: true,
      data: patient,
      message: 'Patient updated'
    });
  } catch (error: any) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update patient'
    });
  }
};

export const deletePatient = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await PatientPhotoModel.deleteByPatientId(id);
    await PatientAudioModel.deleteByPatientId(id);
    const deleted = await PatientModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    res.json({
      success: true,
      message: 'Patient deleted'
    });
  } catch (error: any) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete patient'
    });
  }
};

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }
    const patients = await PatientModel.search(query);
    const patientsWithMedia = await Promise.all(
      patients.map(async (patient) => {
        const photos = await PatientPhotoModel.findByPatientId(patient.id);
        const audio_files = await PatientAudioModel.findByPatientId(patient.id);
        return {
          ...patient,
          photos: photos,
          audio_files: audio_files
        };
      })
    );
    res.json({
      success: true,
      data: {
        patients: patientsWithMedia,
        count: patientsWithMedia.length
      }
    });
  } catch (error: any) {
    console.error('Error searching patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search patients'
    });
  }
};
