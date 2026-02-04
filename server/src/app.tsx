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
import { generatePatientId, generateDiseaseAnalysis, validatePatientForm, formatTime, formatFileSize } from './utils/dataUtils';
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
    return () => {
      if (audioData?.url) {
        URL.revokeObjectURL(audioData.url);
      }
    };
  }, [audioData]);

  const startNewRecord = () => {
    const newRecord: PatientRecord = {
      id: generatePatientId(records.length),
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


  const API_BASE_URL = 'http://localhost:3001/api';

  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
  }

  export interface PatientData {
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

  export const api = {
    async createPatient( PatientData): Promise<ApiResponse> {
      try {
        console.log('Отправка данных на сервер:', data);

        const response = await fetch(`${API_BASE_URL}/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Успешно сохранено:', result);
        return { success: true,  result.data };
      } catch (error) {
        console.error(' Ошибка сохранения:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    async getPatients(): Promise<ApiResponse> {
      try {
        const response = await fetch(`${API_BASE_URL}/patients`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return { success: true,  result.data };
      } catch (error) {
        console.error('API Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    async getPatientById(id: string): Promise<ApiResponse> {
      try {
        const response = await fetch(`${API_BASE_URL}/patients/${id}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return { success: true, data: result.data };
      } catch (error) {
        console.error('API Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    async searchPatients(query: string): Promise<ApiResponse> {
      try {
        const response = await fetch(`${API_BASE_URL}/patients/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return { success: true,  result.data };
      } catch (error) {
        console.error('API Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };

  const playAudio = () => {
    const audioUrl = viewingRecord?.audioUrl || currentRecord?.audioUrl;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const handleMDSUPDRSSubmit = ( MDSUPDRSForm) => {
    if (currentRecord) {
      setCurrentRecord({ ...currentRecord, mdsUpdrs: data });
      setScreen('form');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
    }
  };

  const handleMoCASubmit = ( MoCATest) => {
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
                setCurrentRecord({ ...currentRecord, audioBlob: undefined, audioUrl: undefined });
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
                setRecords([...records, currentRecord]);
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
