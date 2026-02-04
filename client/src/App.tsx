import { useState, useRef, useEffect } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import Header from './components/layout/Header';
import HomeScreen from './components/screens/HomeScreen';
import CaptureScreen from './components/screens/CaptureScreen';
import FormScreen from './components/screens/FormScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ViewScreen from './components/screens/ViewScreen';
import AssessmentsScreen from './components/screens/AssessmentsScreen';
import MDSUPDRSScreen from './components/screens/MDSUPDRSScreen';
import MoCAScreen from './components/screens/MoCAScreen';
import { generatePatientId, validatePatientForm, formatTime, formatFileSize } from './utils/dataUtils';
import { api } from './services/api';
import type { PatientRecord, Screen, SyncStatus } from './types';
import type { MDSUPDRSForm, MoCATest } from './types/forms';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [showMandatoryPhotoWarning, setShowMandatoryPhotoWarning] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [processingStep, setProcessingStep] = useState(0);
  const [viewingRecord, setViewingRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isPaused,
    audioData,
    recordingTime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder({
    sampleRate: 48000,
    bitsPerSample: 16,
    channels: 1
  });

  useEffect(() => {
    console.log('useEffect запущен для загрузки записей');

    const loadRecords = async () => {
      setLoading(true);
      try {
        console.log('Загрузка записей с сервера...');

        const response = await fetch('http://localhost:3001/api/patients');

        console.log('Статус ответа:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        console.log('Полный ответ от сервера:', result);

        if (result.success && Array.isArray(result.data)) {
          console.log('Загружено записей:', result.data.length);

          const transformedRecords = result.data.map((patient: any) => {
            console.log('Преобразование записи:', patient.id, patient.patient_name);
            return {
              id: patient.id,
              patientName: patient.patient_name || '',
              age: patient.age || '',
              gender: patient.gender || '',
              chiefComplaint: patient.chief_complaint || '',
              notes: patient.notes || '',
              vitals: {
                bloodPressure: patient.blood_pressure || '',
                heartRate: patient.heart_rate || '',
                temperature: patient.temperature || '',
              },
              audioConfig: patient.audio_config,
              mdsUpdrs: patient.mds_updrs,
              moca: patient.moca,
              diseases: patient.diseases,
              photos: patient.photos || [],
              audioUrl: patient.audio_files?.[0]?.file_path,
            };
          });

          console.log('Преобразованные записи:', transformedRecords);
          console.log('Установка состояния записей, количество:', transformedRecords.length);
          setRecords(transformedRecords);
        } else {
          console.error('Неверный формат данных:', result);
          setRecords([]);
        }
      } catch (error) {
        console.error('Ошибка при загрузке записей:', error);
        setRecords([]);
      } finally {
        setLoading(false);
        console.log('Загрузка завершена, состояние загрузки:', false);
      }
    };

    loadRecords();
  }, []);

  useEffect(() => {
    console.log('Состояние records изменилось:', records.length, 'записей');
  }, [records]);

  useEffect(() => {
    if (audioData?.url && currentRecord) {
      console.log('Синхронизация аудио с записью:', {
        длительность: audioData.duration,
        размер: audioData.blob.size
      });

      setCurrentRecord(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          audioBlob: audioData.blob,
          audioUrl: audioData.url,
          audioDuration: audioData.duration,
          audioSize: audioData.blob.size,
        };
      });
    }
  }, [audioData]);

  useEffect(() => {
    return () => {
      if (audioData?.url) {
        URL.revokeObjectURL(audioData.url);
      }
    };
  }, [audioData]);

  const startNewRecord = () => {
    const newPatientId = generatePatientId();

    if (!newPatientId || newPatientId.trim() === '') {
      console.error('Ошибка: не удалось сгенерировать идентификатор пациента');
      alert('Ошибка создания записи: не удалось сгенерировать уникальный идентификатор');
      return;
    }

    const newRecord: PatientRecord = {
      id: newPatientId,
      photos: [],
      patientName: '',
      age: '',
      gender: '',
      chiefComplaint: '',
      notes: '',
      vitals: {
        bloodPressure: '',
        heartRate: '',
        temperature: '',
      },
      audioConfig: {
        sampleRate: 48000,
        bitsPerSample: 16,
        channels: 1,
        format: 'WAV'
      }
    };

    setCurrentRecord(newRecord);
    setScreen('capture');
    resetRecording();
    setValidationErrors([]);
    setShowMandatoryPhotoWarning(false);

    console.log('Создана новая запись с идентификатором:', newPatientId);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && currentRecord) {
      const newPhotos = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        file,
      }));
      setCurrentRecord({
        ...currentRecord,
        photos: [...currentRecord.photos, ...newPhotos],
      });
      setShowMandatoryPhotoWarning(false);
    }
  };

  const removePhoto = (index: number) => {
    if (currentRecord) {
      const newPhotos = currentRecord.photos.filter((_, i) => i !== index);
      setCurrentRecord({ ...currentRecord, photos: newPhotos });
    }
  };

  const saveAndSync = async () => {
    if (!currentRecord?.id || currentRecord.id.trim() === '') {
      console.error('Ошибка: у записи отсутствует идентификатор');
      setSyncStatus('error');
      alert('Ошибка: у записи отсутствует уникальный идентификатор. Создайте запись заново.');
      return;
    }

    const errors = validatePatientForm(currentRecord);
    setValidationErrors(errors);

    if (errors.length > 0) {
      setSyncStatus('error');
      console.error('Валидация не пройдена:', errors);
      return;
    }

    setSyncStatus('syncing');

    try {
      if (currentRecord) {
        const patientData = {
          patient_name: currentRecord.patientName,
          age: currentRecord.age,
          gender: currentRecord.gender,
          chief_complaint: currentRecord.chiefComplaint,
          notes: currentRecord.notes,
          blood_pressure: currentRecord.vitals.bloodPressure,
          heart_rate: currentRecord.vitals.heartRate,
          temperature: currentRecord.vitals.temperature,
          audio_config: currentRecord.audioConfig,
          mds_updrs: currentRecord.mdsUpdrs,
          moca: currentRecord.moca,
          diseases: currentRecord.diseases,
        };

        console.log('Отправка данных на сервер:', patientData);
        console.log('Идентификатор записи:', currentRecord.id);

        const result = await api.createPatient(patientData);

        if (result.success) {
          setSyncStatus('synced');
          setShowSuccessToast(true);

          const newRecords = [...records, currentRecord].filter(r => r !== undefined);
          console.log('Добавление новой записи, всего записей:', newRecords.length);
          setRecords(newRecords);

          setTimeout(() => {
            setShowSuccessToast(false);
            setScreen('home');
          }, 2000);

          console.log('Запись успешно сохранена в базу данных');
        } else {
          setSyncStatus('error');
          console.error('Ошибка сохранения:', result.error);
          alert('Ошибка сохранения: ' + result.error);
        }
      }
    } catch (error) {
      setSyncStatus('error');
      console.error('Критическая ошибка:', error);
      alert('Произошла ошибка при сохранении данных');
    }
  };

  const playAudio = () => {
    if (viewingRecord?.audioUrl) {
      console.log('Воспроизведение аудио (просмотр):', viewingRecord.id);
      const audio = new Audio(viewingRecord.audioUrl);
      audio.play().catch(err => console.error('Ошибка воспроизведения:', err));
      return;
    }

    if (currentRecord?.audioUrl) {
      console.log('Воспроизведение аудио (текущая запись):', currentRecord.id);
      const audio = new Audio(currentRecord.audioUrl);
      audio.play().catch(err => console.error('Ошибка воспроизведения:', err));
      return;
    }

    console.warn('Нет аудио для воспроизведения');
  };

  const handleMDSUPDRSSubmit = (data: MDSUPDRSForm) => {
    if (currentRecord) {
      setCurrentRecord({ ...currentRecord, mdsUpdrs: data });
      setScreen('form');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
    }
  };

  const handleMoCASubmit = (data: MoCATest) => {
    if (currentRecord) {
      setCurrentRecord({ ...currentRecord, moca: data });
      setScreen('form');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (currentRecord) {
      setCurrentRecord({ ...currentRecord, [field]: value });
    }
  };

  const handleVitalsChange = (field: string, value: string) => {
    if (currentRecord) {
      setCurrentRecord({
        ...currentRecord,
        vitals: { ...currentRecord.vitals, [field]: value }
      });
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            records={records}
            loading={loading}
            onViewRecord={(record) => {
              setViewingRecord(record);
              setScreen('view');
            }}
            onCreateNew={startNewRecord}
            onOpenAssessments={() => setScreen('assessments')}
          />
        );

      case 'assessments':
        return (
          <AssessmentsScreen
            records={records}
            onBack={() => setScreen('home')}
            onCreateMDSUPDRS={() => {
              startNewRecord();
              setScreen('mdsUpdrs');
            }}
            onCreateMoCA={() => {
              startNewRecord();
              setScreen('moca');
            }}
            onViewRecord={(record) => {
              setViewingRecord(record);
              setScreen('view');
            }}
          />
        );

      case 'mdsUpdrs':
        return (
          <MDSUPDRSScreen
            onSubmit={handleMDSUPDRSSubmit}
            onBack={() => setScreen('assessments')}
            patientName={currentRecord?.patientName}
          />
        );

      case 'moca':
        return (
          <MoCAScreen
            onSubmit={handleMoCASubmit}
            onBack={() => setScreen('assessments')}
            patientName={currentRecord?.patientName}
          />
        );

      case 'capture':
        return (
          <CaptureScreen
            currentRecord={currentRecord}
            isRecording={isRecording}
            isPaused={isPaused}
            audioData={audioData}
            recordingTime={recordingTime}
            showMandatoryPhotoWarning={showMandatoryPhotoWarning}
            fileInputRef={fileInputRef}
            onBack={() => setScreen('home')}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={removePhoto}
            onStartRecording={startRecording}
            onPauseRecording={pauseRecording}
            onResumeRecording={resumeRecording}
            onStopRecording={stopRecording}
            onReRecord={() => {
              resetRecording();
              if (currentRecord) {
                setCurrentRecord({ ...currentRecord, audioBlob: undefined, audioUrl: undefined, audioDuration: undefined, audioSize: undefined });
              }
            }}
            onPlayAudio={playAudio}
            onContinue={() => setScreen('form')}
            formatTime={formatTime}
            formatFileSize={formatFileSize}
          />
        );

      case 'form':
        return (
          <FormScreen
            currentRecord={currentRecord}
            validationErrors={validationErrors}
            syncStatus={syncStatus}
            showSuccessToast={showSuccessToast}
            onSave={saveAndSync}
            onBack={() => setScreen('capture')}
            onFieldChange={handleFieldChange}
            onVitalsChange={handleVitalsChange}
            onOpenMDSUPDRS={() => setScreen('mdsUpdrs')}
            onOpenMoCA={() => setScreen('moca')}
            onCloseToast={() => setShowSuccessToast(false)}
          />
        );

      case 'processing':
        return (
          <ProcessingScreen
            currentRecord={currentRecord}
            processingStep={processingStep}
            onBack={() => setScreen('home')}
            onContinue={() => {
              if (processingStep < 2) {
                setProcessingStep(processingStep + 1);
              } else {
                setScreen('results');
              }
            }}
          />
        );

      case 'results':
        return (
          <ResultsScreen
            currentRecord={currentRecord}
            onBack={() => setScreen('home')}
            onSave={() => {
              if (currentRecord) {
                const newRecords = [...records, currentRecord].filter(r => r !== undefined);
                console.log('Сохранение записи из результатов, всего:', newRecords.length);
                setRecords(newRecords);
                setShowSuccessToast(true);
                setTimeout(() => {
                  setShowSuccessToast(false);
                  setViewingRecord(currentRecord);
                  setScreen('view');
                }, 1500);
              }
            }}
            onView={() => {
              if (currentRecord) {
                setViewingRecord(currentRecord);
              }
              setScreen('view');
            }}
          />
        );

      case 'view':
        return (
          <ViewScreen
            viewingRecord={viewingRecord}
            onBack={() => setScreen('home')}
            onPlayAudio={playAudio}
            formatTime={formatTime}
            formatFileSize={formatFileSize}
          />
        );

      default:
        return null;
    }
  };

  return <div className="min-h-screen">{renderScreen()}</div>;
}
