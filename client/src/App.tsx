import { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { formatTime, formatFileSize, generatePatientId } from './utils/dataUtils';
import type { PatientRecord, ProtocolType, Screen } from './types';
import type { AudioRecording } from './types/forms';
import HomeScreen from './components/screens/HomeScreen';
import CaptureScreen from './components/screens/CaptureScreen';
import FormScreen from './components/screens/FormScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ViewScreen from './components/screens/ViewScreen';
import AssessmentsScreen from './components/screens/AssessmentsScreen';
import ProtocolSelectScreen from './components/screens/ProtocolSelectScreen';

const API_BASE_URL = 'http://localhost:3001/api';

interface PendingUpload {
  id: string;
  patient_id: string;
  recording_type: string;
  recording_label: string;
  file_path: string;
  duration: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retry_count: number;
}

class YandexDiskSyncService {
  private pendingQueue: PendingUpload[] = [];
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNetworkListener();
      this.loadPendingQueue();
    }
  }

  private initNetworkListener() {
    window.addEventListener('online', () => {
      console.log('Сеть доступна, начинаю синхронизацию...');
      this.isOnline = true;
      this.syncPendingUploads();
    });

    window.addEventListener('offline', () => {
      console.log('Сеть недоступна, откладываю синхронизацию');
      this.isOnline = false;
    });
  }

  private loadPendingQueue() {
    const stored = localStorage.getItem('yandex_pending_uploads');
    if (stored) {
      try {
        this.pendingQueue = JSON.parse(stored);
        console.log('Загружено отложенных загрузок:', this.pendingQueue.length);
        if (this.isOnline) {
          this.syncPendingUploads();
        }
      } catch (e) {
        console.error('Ошибка загрузки очереди:', e);
        this.pendingQueue = [];
      }
    }
  }

  private savePendingQueue() {
    localStorage.setItem('yandex_pending_uploads', JSON.stringify(this.pendingQueue));
  }

  public addPendingUpload(upload: PendingUpload) {
    console.log('Добавлено в очередь:', upload);
    this.pendingQueue.push(upload);
    this.savePendingQueue();
    if (this.isOnline && !this.isSyncing) {
      this.syncPendingUploads();
    }
  }

  public async syncPendingUploads() {
    if (!this.isOnline || this.isSyncing || this.pendingQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    console.log('Начало синхронизации:', this.pendingQueue.length, 'файлов');

    const pending = this.pendingQueue.filter(function(u: PendingUpload) {
      return u.status === 'pending';
    });

    for (let i = 0; i < pending.length; i++) {
      const upload = pending[i];
      try {
        upload.status = 'uploading';
        this.savePendingQueue();

        console.log('Загрузка на Яндекс.Диск:', upload.recording_type);

        const response = await fetch(API_BASE_URL + '/patients/sync-yandex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: upload.patient_id,
            recording_type: upload.recording_type,
            recording_label: upload.recording_label,
            duration: upload.duration,
          }),
        });

        const result = await response.json();

        if (result.success) {
          upload.status = 'completed';
          console.log('Загружено на Яндекс.Диск:', upload.recording_type);
        } else {
          upload.status = 'pending';
          upload.retry_count = (upload.retry_count || 0) + 1;
          console.warn('Не удалось загрузить:', upload.recording_type, 'Попытка:', upload.retry_count);
        }

        this.savePendingQueue();
      } catch (error) {
        upload.status = 'pending';
        upload.retry_count = (upload.retry_count || 0) + 1;
        console.error('Ошибка синхронизации:', upload.recording_type, error);
        this.savePendingQueue();
      }

      await new Promise(function(resolve) {
        return setTimeout(resolve, 500);
      });
    }

    this.pendingQueue = this.pendingQueue.filter(function(u: PendingUpload) {
      return u.status !== 'completed';
    });
    this.savePendingQueue();
    this.isSyncing = false;

    console.log('Синхронизация завершена');
  }

  public getPendingCount(): number {
    return this.pendingQueue.filter(function(u: PendingUpload) {
      return u.status === 'pending';
    }).length;
  }
}

const yandexDiskSync = new YandexDiskSyncService();

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
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
    channels: 1,
  });

  useEffect(() => {
    console.log('Проверка отложенных загрузок...');
    yandexDiskSync.syncPendingUploads();
  }, []);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true);
        console.log('Загрузка пациентов...');
        const result = await api.getPatients();
        console.log('Результат:', result);

        if (result.success && result.data?.data?.patients) {
          console.log('Пациенты найдены:', result.data.data.patients.length);
          const formatted = result.data.data.patients.map(function(p: any) {
            return {
              id: p.id,
              patientName: p.patient_name,
              age: p.age,
              gender: p.gender,
              chiefComplaint: p.chief_complaint,
              notes: p.notes || '',
              protocolType: p.protocol_type,
              vitals: {
                bloodPressure: p.blood_pressure || '',
                heartRate: p.heart_rate || '',
                temperature: p.temperature || '',
              },
              photos: p.photos?.map(function(ph: any) {
                return { url: ph.file_path, file: null };
              }) || [],
              audioRecordings: p.audio_files?.map(function(af: any) {
                return {
                  id: af.recording_type,
                  type: af.recording_type,
                  label: af.recording_label,
                  url: af.yandex_disk_url || ('http://localhost:3001' + af.file_path),
                  duration: af.duration,
                  status: 'completed',
                  recordedAt: af.uploaded_at,
                };
              }) || [],
              mdsUpdrs: p.mds_updrs,
              moca: p.moca,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            };
          });
          console.log('Отформатированные пациенты:', formatted);
          setPatients(formatted);
        } else {
          console.log('Пациенты не найдены или ошибка в структуре ответа');
          setPatients([]);
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  const handleBack = () => {
    if (screen === 'capture') {
      setScreen('protocolSelect');
    } else if (screen === 'form' || screen === 'capture' || screen === 'processing' || screen === 'results') {
      setScreen('home');
      setCurrentRecord(null);
      setAudioRecordings([]);
      setCurrentRecordingId(null);
    } else {
      setScreen('home');
    }
  };

  const handleNewPatient = () => {
    setScreen('protocolSelect');
  };

  const handleProtocolSelect = (protocol: ProtocolType) => {
    setSelectedProtocol(protocol);
    const newRecord: PatientRecord = {
      id: generatePatientId(),
      patientName: '',
      age: '',
      gender: 'male',
      chiefComplaint: '',
      notes: '',
      vitals: {
        bloodPressure: '',
        heartRate: '',
        temperature: '',
      },
      photos: [],
      protocolType: protocol,
    };
    setCurrentRecord(newRecord);
    setScreen('form');
  };

  const handleSelectPatient = async (id: string) => {
    const result = await api.getPatientById(id);
    if (result.success && result.data?.data) {
      const data = result.data.data;
      const patient = data.patient || data;
      const record: PatientRecord = {
        id: patient.id,
        patientName: patient.patient_name,
        age: patient.age,
        gender: patient.gender,
        chiefComplaint: patient.chief_complaint,
        notes: patient.notes || '',
        vitals: {
          bloodPressure: patient.blood_pressure || '',
          heartRate: patient.heart_rate || '',
          temperature: patient.temperature || '',
        },
        protocolType: patient.protocol_type as ProtocolType,
        parkinsonismStage: patient.parkinsonism_stage,
        comorbidities: patient.comorbidities,
        diagnosis: patient.diagnosis,
        mocaScore: patient.moca_score,
        photos: data.photos?.map(function(p: any) {
          return { url: p.file_path, file: null };
        }) || [],
        audioRecordings: data.audio_files?.map(function(af: any) {
          return {
            id: af.recording_type,
            type: af.recording_type,
            label: af.recording_label,
            url: af.yandex_disk_url || ('http://localhost:3001' + af.file_path),
            duration: af.duration,
            status: 'completed',
            recordedAt: af.uploaded_at,
          };
        }) || [],
        mdsUpdrs: patient.mds_updrs,
        moca: patient.moca,
        createdAt: patient.created_at,
        updatedAt: patient.updated_at,
      };
      setCurrentRecord(record);
      setAudioRecordings(record.audioRecordings || []);
      setScreen('view');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentRecord) return;
    const files = Array.from(e.target.files);
    const newPhotos = files.map(function(file) {
      return {
        url: URL.createObjectURL(file),
        file: file,
      };
    });
    setCurrentRecord(function(prev) {
      if (!prev) return null;
      return {
        ...prev,
        photos: [...prev.photos, ...newPhotos],
      };
    });
  };

  const handleRemovePhoto = (index: number) => {
    setCurrentRecord(function(prev) {
      if (!prev) return null;
      const photo = prev.photos[index];
      if (photo?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(photo.url);
      }
      return {
        ...prev,
        photos: prev.photos.filter(function(_: any, i: number) {
          return i !== index;
        }),
      };
    });
  };

  const handleStartRecording = () => {
    resetRecording();
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleSaveRecording = async (
    recordingId: string,
    data: { blob: Blob; url: string; duration: number }
  ) => {
    console.log('handleSaveRecording вызван:', { recordingId, duration: data.duration });

    if (!currentRecord?.id || !currentRecord.id.startsWith('PAT-') || !data?.blob) {
      console.error('Missing valid patient ID or audio data:', {
        currentRecordId: currentRecord?.id,
        hasBlob: !!data?.blob
      });
      throw new Error('Invalid patient ID or missing audio data');
    }

    const recording = audioRecordings.find(function(r) {
      return r.id === recordingId;
    });
    if (!recording) {
      console.error('Recording not found:', recordingId);
      throw new Error('Recording not found');
    }

    console.log('Вызов api.uploadAudio с patient_id:', currentRecord.id);

    const result = await api.uploadAudio({
      patient_id: currentRecord.id,
      recording_type: recording.type,
      recording_label: recording.label,
      audio: data.blob,
      duration: data.duration,
      sample_rate: 48000,
      bits_per_sample: 16,
      channels: 1,
      status: 'completed',
    });

    console.log('Ответ от api.uploadAudio:', result);

    if (result.success) {
      const audioUrl = result.data?.data?.audio?.yandex_disk_url
        ? result.data.data.audio.yandex_disk_url
        : (result.data?.data?.audio?.file_path
            ? ('http://localhost:3001' + result.data.data.audio.file_path)
            : data.url);

      const updatedRecordings = audioRecordings.map(function(r) {
        if (r.id === recordingId) {
          return {
            ...r,
            status: 'completed' as const,
            duration: data.duration,
            url: audioUrl,
          };
        }
        return r;
      });

      setAudioRecordings(updatedRecordings);

      setCurrentRecord(function(prev) {
        if (!prev) return null;
        return {
          ...prev,
          audioRecordings: updatedRecordings,
        };
      });

      const nextPending = updatedRecordings.find(function(r) {
        return r.status === 'pending';
      });
      if (nextPending) {
        console.log('Автопереход к следующей записи:', nextPending.id);
        setCurrentRecordingId(nextPending.id);
        resetRecording();
      }

      console.log('Аудио успешно сохранено в состоянии');
    } else {
      console.error('Не удалось загрузить аудио:', result.error);
      throw new Error(result.error || 'Failed to upload audio');
    }
  };

  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(function(err) {
      console.error('Ошибка воспроизведения:', err);
    });
  };

  const handleContinue = async () => {
    if (screen === 'form') {
      if (currentRecord) {
        console.log('Сохранение пациента в БД:', currentRecord.id);

        const patientData = {
          patient_name: currentRecord.patientName,
          age: currentRecord.age,
          gender: currentRecord.gender,
          chief_complaint: currentRecord.chiefComplaint,
          notes: currentRecord.notes || '',
          blood_pressure: currentRecord.vitals.bloodPressure,
          heart_rate: currentRecord.vitals.heartRate,
          temperature: currentRecord.vitals.temperature,
          protocol_type: selectedProtocol || undefined,
          parkinsonism_stage: currentRecord.parkinsonismStage,
          comorbidities: currentRecord.comorbidities,
          diagnosis: currentRecord.diagnosis,
          moca_score: currentRecord.mocaScore,
        };

        const result = await api.createPatient(patientData);

        if (result.success && result.data?.data) {
          const savedPatient = result.data.data;
          setCurrentRecord(function(prev) {
            if (!prev) return null;
            return {
              ...prev,
              id: savedPatient.id,
            };
          });
          console.log('Пациент сохранён в БД:', savedPatient.id);
        } else {
          console.error('Не удалось сохранить пациента:', result.error);
          alert('Не удалось сохранить данные пациента');
          return;
        }
      }

      const requirements: AudioRecording[] = [];
      if (selectedProtocol === 'phonemes' || selectedProtocol === 'full') {
        requirements.push(
          { id: 'phoneme_a', type: 'phoneme_a', label: 'Фонема «аааааааа»', minDuration: 9, status: 'pending' },
          { id: 'phoneme_oi', type: 'phoneme_oi', label: 'Фонемы «о-и-о-и-о-и»', minDuration: 9, status: 'pending' }
        );
      }
      if (selectedProtocol === 'speech' || selectedProtocol === 'full') {
        requirements.push(
          { id: 'picture_cookie', type: 'picture_cookie', label: 'Описание картинки «Вор печенья»', minDuration: 20, maxDuration: 90, status: 'pending' },
          { id: 'text_bear', type: 'text_bear', label: 'Чтение текста «Гималайский медведь»', maxDuration: 120, status: 'pending' }
        );
        if (selectedProtocol === 'full') {
          requirements.push(
            { id: 'picture_cat', type: 'picture_cat', label: 'Описание картинки «Кошка на дереве»', minDuration: 20, maxDuration: 90, status: 'pending' }
          );
        }
      }
      setAudioRecordings(requirements);
      setCurrentRecordingId(requirements[0]?.id || null);
      setScreen('capture');

    } else if (screen === 'capture') {
      console.log('Завершение записи, загрузка на Яндекс.Диск...');

      if (currentRecord?.id && audioRecordings.length > 0) {
        const completedRecordings = audioRecordings.filter(function(r) {
          return r.status === 'completed';
        });

        for (let i = 0; i < completedRecordings.length; i++) {
          const recording = completedRecordings[i];
          try {
            console.log('Загрузка на Яндекс.Диск:', recording.label);

            const response = await fetch(API_BASE_URL + '/patients/sync-yandex', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patient_id: currentRecord.id,
                recording_type: recording.type,
                recording_label: recording.label,
                duration: recording.duration || 0,
              }),
            });

            const result = await response.json();

            if (result.success) {
              console.log('Загружено на Яндекс.Диск:', recording.label, result.data?.yandex_disk_url);

              setAudioRecordings(function(prev) {
                return prev.map(function(r) {
                  if (r.id === recording.id) {
                    return { ...r, url: result.data?.yandex_disk_url || r.url };
                  }
                  return r;
                });
              });
            } else {
              console.warn('Не удалось загрузить:', recording.label);
              yandexDiskSync.addPendingUpload({
                id: recording.id,
                patient_id: currentRecord.id,
                recording_type: recording.type,
                recording_label: recording.label,
                file_path: recording.url || '',
                duration: recording.duration || 0,
                status: 'pending',
                retry_count: 0,
              });
            }
          } catch (error) {
            console.error('Ошибка загрузки:', recording.label, error);
            yandexDiskSync.addPendingUpload({
              id: recording.id,
              patient_id: currentRecord.id,
              recording_type: recording.type,
              recording_label: recording.label,
              file_path: recording.url || '',
              duration: recording.duration || 0,
              status: 'pending',
              retry_count: 0,
            });
          }
        }
      }

      setScreen('processing');
      setTimeout(function() {
        setScreen('results');
      }, 2000);

    } else if (screen === 'results') {
      setScreen('home');
      setCurrentRecord(null);
      setAudioRecordings([]);
      setCurrentRecordingId(null);
      setSelectedProtocol(null);
    }
  };

  const handleSelectRecording = (id: string) => {
    setCurrentRecordingId(id);
    resetRecording();
  };

  const handleUpdateRecording = (id: string, update: Partial<AudioRecording>) => {
    setAudioRecordings(function(prev) {
      return prev.map(function(r) {
        if (r.id === id) {
          return { ...r, ...update };
        }
        return r;
      });
    });
  };

  const getAllCompleted = () => {
    return audioRecordings.length > 0 && audioRecordings.every(function(r) {
      return r.status === 'completed';
    });
  };

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            records={patients}
            loading={loading}
            onViewRecord={(record) => {
              setCurrentRecord(record);
              setScreen('view');
            }}
            onCreateNew={handleNewPatient}
            onOpenAssessments={() => setScreen('assessments')}
          />
        );
      case 'protocolSelect':
        return (
          <ProtocolSelectScreen
            onSelectProtocol={handleProtocolSelect}
            onBack={handleBack}
          />
        );
      case 'form':
        return (
          <FormScreen
            record={currentRecord}
            onBack={handleBack}
            onChange={setCurrentRecord}
            onContinue={handleContinue}
          />
        );
      case 'capture':
        return (
          <CaptureScreen
            currentRecord={currentRecord}
            selectedProtocol={selectedProtocol}
            isRecording={isRecording}
            isPaused={isPaused}
            audioData={audioData}
            recordingTime={recordingTime}
            showMandatoryPhotoWarning={false}
            fileInputRef={fileInputRef}
            onBack={handleBack}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={handleRemovePhoto}
            onStartRecording={handleStartRecording}
            onPauseRecording={pauseRecording}
            onResumeRecording={resumeRecording}
            onStopRecording={handleStopRecording}
            onReRecord={resetRecording}
            onPlayAudio={handlePlayAudio}
            onContinue={handleContinue}
            onSaveRecording={handleSaveRecording}
            formatTime={formatTime}
            formatFileSize={formatFileSize}
            audioRecordings={audioRecordings}
            currentRecordingId={currentRecordingId}
            onSelectRecording={handleSelectRecording}
            onUpdateRecording={handleUpdateRecording}
            allCompleted={getAllCompleted()}
          />
        );
      case 'processing':
        return <ProcessingScreen onContinue={handleContinue} />;
      case 'results':
        return (
          <ResultsScreen
            record={currentRecord}
            audioRecordings={audioRecordings}
            onBack={() => setScreen('capture')}
            onContinue={handleContinue}
          />
        );
      case 'view':
        return (
          <ViewScreen
            record={currentRecord}
            onBack={handleBack}
            onEdit={() => setScreen('form')}
          />
        );
      case 'assessments':
        return (
          <AssessmentsScreen
            record={currentRecord}
            onBack={handleBack}
            onSave={(updates) => setCurrentRecord(function(prev) {
              if (!prev) return null;
              return { ...prev, ...updates };
            })}
          />
        );
      default:
        return (
          <HomeScreen
            records={patients}
            loading={loading}
            onViewRecord={(record) => {
              setCurrentRecord(record);
              setScreen('view');
            }}
            onCreateNew={handleNewPatient}
            onOpenAssessments={() => setScreen('assessments')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderScreen()}
    </div>
  );
}

export default App;
