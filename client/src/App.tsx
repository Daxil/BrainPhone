import { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { formatTime, formatFileSize, generatePatientId } from './utils/dataUtils';
import type { PatientRecord, ProtocolType, Screen } from './types';
import type { AudioRecording } from './types/forms';
import type { CaseTask, CaseFlowState, ConsentData } from './types/case';

// Screens
import HomeScreen from './components/screens/HomeScreen';
import CaptureScreen from './components/screens/CaptureScreen';
import FormScreen from './components/screens/FormScreen';
import ProcessingScreen from './components/screens/ProcessingScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import ViewScreen from './components/screens/ViewScreen';
import ProtocolSelectScreen from './components/screens/ProtocolSelectScreen';
import AssessmentsScreen from './components/screens/AssessmentsScreen';
import SplashScreen from './components/screens/SplashScreen';
import OnboardingScreen from './components/screens/OnboardingScreen';
import ConsentScreen from './components/screens/ConsentScreen';
import TaskListScreen from './components/screens/TaskListScreen';
import RecordingScreen from './components/screens/RecordingScreen';
import ReadyToSubmitScreen from './components/screens/ReadyToSubmitScreen';
import CaseResultScreen from './components/screens/CaseResultScreen';
import MyCasesScreen from './components/screens/MyCasesScreen';
import SupportScreen from './components/screens/SupportScreen';
import OfflineBanner from './components/common/OfflineBanner';

// Services & constants
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import TotpPage from './pages/TotpPage';
import InvitePage from './pages/InvitePage';
import SetupTotpPage from './pages/SetupTotpPage';
import AdminPage from './pages/AdminPage';
import { ONBOARDING_KEY, PROTOCOL_TASKS } from './constants/statuses';
import { enqueue, startQueueProcessor } from './services/offlineQueue';
import { saveDraft, loadDraft, clearDraft } from './services/draftCache';

// Кейс считается черновиком, пока он не отправлен на проверку.
const SUBMITTED_STATUSES = new Set(['SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVIEW']);
const isDraftStatus = (status?: string) => !SUBMITTED_STATUSES.has(status || '');
// Экраны, на которых мы находимся «внутри» заполнения кейса — их и кэшируем.
const FLOW_SCREENS: Screen[] = ['form', 'consent', 'taskList', 'recording', 'readyToSubmit'];

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Detect special URLs handled outside the main SPA ─────────────────────────

function getInviteToken(): string | null {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
  return match ? match[1] : null;
}

function isAdminPath(): boolean {
  return window.location.pathname.startsWith('/admin');
}

// ─── Auth gate wrapper ────────────────────────────────────────────────────────

type AuthScreen = 'splash' | 'login' | 'totp' | 'setup-totp' | 'onboarding' | 'app' | 'admin' | 'invite';

function AppWithAuth() {
  const { user, loading, logout } = useAuth();
  const inviteToken = getInviteToken();

  const [authScreen, setAuthScreen] = useState<AuthScreen>('splash');
  const [splashDone, setSplashDone]   = useState(false);
  const [isOffline,  setIsOffline]    = useState(!navigator.onLine);

  const hasOnboarding = (userId: string) =>
    localStorage.getItem(ONBOARDING_KEY(userId)) === 'done';

  const markOnboarding = (userId: string) =>
    localStorage.setItem(ONBOARDING_KEY(userId), 'done');

  const resolveAuthScreen = (): AuthScreen => {
    if (inviteToken) return 'invite';
    if (!user)       return 'login';
    if (user.role === 'admin' && isAdminPath()) return 'admin';
    if (!hasOnboarding(user.id)) return 'onboarding';
    return 'app';
  };

  const handleSplashComplete = (offline: boolean) => {
    setIsOffline(offline);
    setSplashDone(true);
  };

  useEffect(() => {
    if (!splashDone || loading) return;
    setAuthScreen(resolveAuthScreen());
  }, [splashDone, loading, user]);

  // Global 401 handler: any API call that gets "authentication required"
  // fires auth:expired → we log out and redirect to login.
  useEffect(() => {
    const handle = () => {
      logout().catch(() => {});
    };
    window.addEventListener('auth:expired', handle);
    return () => window.removeEventListener('auth:expired', handle);
  }, [logout]);

  // Session keepalive: ping /api/auth/me every 10 minutes while the tab is visible
  // so the server's 30-min idle TTL never expires during active use.
  useEffect(() => {
    if (!user) return;
    const BASE = import.meta.env.VITE_API_URL || '/api';
    const ping = () => {
      if (document.visibilityState === 'visible') {
        fetch(`${BASE}/auth/me`, { credentials: 'include' }).catch(() => {});
      }
    };
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  // Экран-заставка
  if (authScreen === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Инвайт — всегда показываем независимо от авторизации
  if (authScreen === 'invite' && inviteToken) {
    return (
      <InvitePage
        token={inviteToken}
        onComplete={() => {
          window.history.replaceState(null, '', '/');
          setAuthScreen('login');
        }}
      />
    );
  }

  // Не авторизован
  if (!user) {
    if (authScreen === 'totp') {
      return (
        <TotpPage onSuccess={() => {
          setAuthScreen(isAdminPath() ? 'admin' : (user && !hasOnboarding((user as any).id) ? 'onboarding' : 'app'));
        }} />
      );
    }
    return (
      <LoginPage
        onSuccess={() => setAuthScreen(isAdminPath() ? 'admin' : 'app')}
        onRequireTotp={() => setAuthScreen('totp')}
      />
    );
  }

  // Админ: обязательная настройка TOTP
  if (user.role === 'admin' && user.totpEnabled && !user.totpVerified) {
    return (
      <SetupTotpPage
        mandatory
        onComplete={() => setAuthScreen('admin')}
      />
    );
  }

  // Онбординг (первый вход)
  if (authScreen === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={() => {
          markOnboarding(user.id);
          setAuthScreen(user.role === 'admin' && isAdminPath() ? 'admin' : 'app');
        }}
      />
    );
  }

  // Панель администратора
  if (authScreen === 'admin' || (user.role === 'admin' && isAdminPath())) {
    return (
      <AdminPage onBack={() => { window.history.pushState(null, '', '/'); setAuthScreen('app'); }} />
    );
  }

  return (
    <MainApp
      isOffline={isOffline}
      onGoAdmin={() => { window.history.pushState(null, '', '/admin'); setAuthScreen('admin'); }}
      onLogout={async () => { await logout(); setAuthScreen('login'); }}
    />
  );
}

// ─── Main application (only rendered when authenticated) ──────────────────────

function MainApp({ onGoAdmin, isOffline }: { onGoAdmin: () => void; onLogout: () => void; isOffline: boolean }) {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('home');
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Новый флоу (E4–E11) ───────────────────────────────────────────────────
  const [caseFlow, setCaseFlow] = useState<CaseFlowState | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [finalCaseStatus, setFinalCaseStatus] = useState<string>('SUBMITTED');
  const [finalCaseNumber, setFinalCaseNumber] = useState<string | undefined>(undefined);
  const [finalRejectionCode, setFinalRejectionCode] = useState<string | undefined>(undefined);

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
  } = useAudioRecorder({ sampleRate: 48000, bitsPerSample: 16, channels: 1 });

  // Старт процессора офлайн-очереди
  useEffect(() => {
    const stop = startQueueProcessor(async (patientId) => {
      const r = await api.submitCase(patientId);
      return r.success;
    });
    return stop;
  }, []);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true);
        const result = await api.getPatients();
        if (result.success && result.data?.data?.patients) {
          const formatted = result.data.data.patients.map((p: any) => ({
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
            photos: p.photos?.map((ph: any) => ({ url: ph.yandex_disk_url || ph.file_path, file: null, id: String(ph.id) })) || [],
            audioRecordings: p.audio_files?.map((af: any) => ({
              id: af.recording_type || af.id,
              type: af.recording_type || 'unknown',
              label: af.recording_label || af.recording_type || 'Без названия',
              url: af.yandex_disk_url || af.url,
              duration: af.duration || 0,
              status: 'completed' as const,
              recordedAt: af.uploaded_at || af.created_at,
            })) || [],
            mdsUpdrs: p.mds_updrs,
            moca: p.moca,
            // Поля анкеты — нужны, чтобы черновик открывался с заполненными данными
            diagnosis:        p.diagnosis || '',
            nativeLanguage:   p.native_language || '',
            hasParkinsonism:  p.has_parkinsonism === true || p.has_parkinsonism === 'true',
            hasCognitive:     p.has_cognitive === true || p.has_cognitive === 'true',
            parkinsonismStage: p.parkinsonism_stage || '',
            comorbidities:    p.comorbidities || '',
            mocaScore:        p.moca_score  ?? '',
            mmseScore:        p.mmse_score  ?? '',
            trchScore:        p.trch_score  ?? '',
            updrsScore:       p.updrs_score ?? '',
            caseStatus: p.case_status,
            caseNumber: p.case_number,
            rejectionCode: p.rejection_code,
            rejectionNote: p.rejection_note,
            submittedAt: p.submitted_at,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }));
          setPatients(formatted);
        } else {
          setPatients([]);
        }
      } catch {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Автосохранение черновика в localStorage — по одному ключу на пациента.
  // Пишем только когда находимся «внутри» заполнения кейса и известен id пациента.
  useEffect(() => {
    if (!user || !currentRecord) return;
    if (!FLOW_SCREENS.includes(screen)) return;
    const pid = caseFlow?.patientId || currentRecord.id;
    if (!pid) return;
    // Кэшируем только кейсы, уже существующие на сервере (иначе их всё равно
    // не видно в списке и нечего «продолжать»).
    const onServer = !!caseFlow?.patientId || patients.some((p) => p.id === pid);
    if (!onServer) return;
    saveDraft(user.id, pid, {
      record: currentRecord,
      caseFlow,
      protocol: selectedProtocol,
      screen,
      savedAt: new Date().toISOString(),
    });
  }, [user, screen, currentRecord, caseFlow, selectedProtocol]);

  // Открыть кейс: отправленный — на просмотр; черновик — продолжить с места остановки.
  const handleOpenCase = (record: PatientRecord) => {
    if (!isDraftStatus(record.caseStatus)) {
      setCurrentRecord(record);
      setScreen('view');
      return;
    }

    // 1) Есть локальный кэш — восстанавливаем ровно то состояние, что было.
    const cached = user ? loadDraft(user.id, record.id) : null;
    if (cached) {
      setCurrentRecord(cached.record);
      setCaseFlow(cached.caseFlow);
      setSelectedProtocol((cached.protocol as ProtocolType) || (record.protocolType as ProtocolType) || null);
      setActiveTaskId(null);
      setScreen(FLOW_SCREENS.includes(cached.screen) ? cached.screen : 'taskList');
      return;
    }

    // 2) Кэша нет (другое устройство / очищен) — восстанавливаем из серверных данных.
    const protocol = (record.protocolType as ProtocolType) || null;
    setCurrentRecord(record);
    setSelectedProtocol(protocol);
    setActiveTaskId(null);

    if (!protocol) {
      setCaseFlow(null);
      setScreen('form');
      return;
    }

    const recordedByCode = new Map((record.audioRecordings || []).map((a) => [a.type, a]));
    const tasks: CaseTask[] = PROTOCOL_TASKS[protocol].map((def) => {
      const rec = recordedByCode.get(def.fileCode);
      return {
        id:       def.fileCode,
        taskType: def.taskType,
        label:    def.label,
        fileCode: def.fileCode,
        required: def.required,
        status:   rec ? ('RECORDED_LOCAL' as const) : ('NOT_RECORDED' as const),
        duration: rec?.duration,
        uploadedUrl: rec?.url,
      };
    });
    const hasRecordings = (record.audioRecordings || []).length > 0;
    const consentDone = hasRecordings || record.caseStatus === 'RECORDING' || record.caseStatus === 'READY_TO_SUBMIT';
    setCaseFlow({
      patientId:    record.id,
      protocol,
      caseStatus:   (record.caseStatus as any) || 'DRAFT',
      consent:      null,
      tasks,
      activeTaskId: null,
    });
    // Если согласие уже давалось — сразу к списку заданий, иначе к анкете.
    setScreen(consentDone ? 'taskList' : 'form');
  };

  const handleBack = () => {
    if (screen === 'capture') {
      setScreen('protocolSelect');
    } else if (screen === 'form' || screen === 'processing' || screen === 'results') {
      setScreen('home');
      setCurrentRecord(null);
      setAudioRecordings([]);
      setCurrentRecordingId(null);
    } else {
      setScreen('home');
    }
  };

  const handleNewPatient = () => setScreen('protocolSelect');

  const handleProtocolSelect = (protocol: ProtocolType) => {
    setSelectedProtocol(protocol);
    const newRecord: PatientRecord = {
      id: generatePatientId(),
      patientName: '',
      age: '',
      gender: 'male',
      chiefComplaint: '',
      notes: '',
      vitals: { bloodPressure: '', heartRate: '', temperature: '' },
      photos: [],
      protocolType: protocol,
    };
    setCurrentRecord(newRecord);
    setCaseFlow(null);
    setScreen('form');
  };

  // ── Добавить фото локально (без API) — вызывается из FormScreen ─────────
  const handleAddPhotoLocal = (file: File, category: 'consult' | 'scale') => {
    const localUrl = URL.createObjectURL(file);
    setCurrentRecord(prev => prev ? {
      ...prev, photos: [...prev.photos, { url: localUrl, file, category }],
    } : null);
  };

  // ── Загрузить локальные фото на сервер после создания пациента ───────────
  const uploadPendingPhotos = async (patientId: string, photos: PatientRecord['photos']) => {
    for (const photo of photos) {
      if (!photo.file) continue; // уже загружено
      const formData = new FormData();
      formData.append('patient_id', patientId);
      formData.append('photo', photo.file);
      if (photo.category) formData.append('category', photo.category);
      try {
        await fetch(`${API_BASE_URL}/patients/upload-photo`, {
          method: 'POST', credentials: 'include', body: formData,
        });
      } catch { /* не блокируем флоу */ }
    }
  };

  // ── Новый флоу: форма → согласие → список заданий ────────────────────────
  const handleFormContinue = async () => {
    if (formSubmitting) return;
    if (!currentRecord) return;
    // Протокол мог не сохраниться в state (например, при заходе через «Редактировать») —
    // берём запасной из самого record, чтобы кнопка не «молчала».
    const protocol = selectedProtocol || (currentRecord.protocolType as ProtocolType | undefined);
    if (!protocol) {
      alert('Не выбран протокол исследования. Вернитесь назад и выберите протокол.');
      return;
    }
    const patientData = {
      patient_name:     currentRecord.patientName || 'Пациент',
      age:              currentRecord.age || '0',
      gender:           currentRecord.gender || 'male',
      chief_complaint:  currentRecord.diagnosis || currentRecord.chiefComplaint || '',
      notes:            currentRecord.notes || '',
      protocol_type:    protocol,
      diagnosis:        currentRecord.diagnosis,
      native_language:  currentRecord.nativeLanguage,
      has_parkinsonism: currentRecord.hasParkinsonism,
      has_cognitive:    currentRecord.hasCognitive,
      moca_score:       currentRecord.mocaScore,
      mmse_score:       currentRecord.mmseScore,
      trch_score:       currentRecord.trchScore,
      updrs_score:      currentRecord.updrsScore,
    };
    // Если кейс уже существует на сервере (продолжаем черновик) — обновляем,
    // а не создаём заново, иначе плодятся дубликаты.
    const existsOnServer = patients.some((p) => p.id === currentRecord.id);
    setFormSubmitting(true);
    const result = existsOnServer
      ? await api.updatePatient(currentRecord.id, patientData).finally(() => setFormSubmitting(false))
      : await api.createPatient(patientData).finally(() => setFormSubmitting(false));

    if (result.success && result.data?.data?.patient) {
      const saved = result.data.data.patient;
      if (currentRecord.photos.length > 0) {
        uploadPendingPhotos(saved.id, currentRecord.photos).catch(() => {});
      }
      setSelectedProtocol(protocol);
      setCurrentRecord(prev => prev ? { ...prev, id: saved.id } : null);
      setPatients(prev => prev.map(p => p.id === saved.id ? { ...p, ...currentRecord, id: saved.id, protocolType: protocol } : p));
      setCaseFlow(prev => {
        // Продолжаем существующий флоу того же пациента — сохраняем прогресс заданий/согласия.
        if (prev && prev.patientId === saved.id) {
          return { ...prev, protocol };
        }
        const tasks: CaseTask[] = PROTOCOL_TASKS[protocol].map(def => ({
          id:       def.fileCode,
          taskType: def.taskType,
          label:    def.label,
          fileCode: def.fileCode,
          required: def.required,
          status:   'NOT_RECORDED' as const,
        }));
        return { patientId: saved.id, protocol, caseStatus: 'CONSENT_PENDING', consent: null, tasks, activeTaskId: null };
      });
      // Если согласие уже есть — сразу к заданиям, иначе к экрану согласия.
      const consentDone = caseFlow?.patientId === saved.id && !!caseFlow?.consent;
      setScreen(consentDone ? 'taskList' : 'consent');
    } else {
      const errDetail = result.error || result.data?.error || 'неизвестная ошибка';
      alert(`Не удалось сохранить данные пациента\n\n${errDetail}`);
    }
  };

  const handleConsentConfirmed = async (consent: ConsentData) => {
    if (!caseFlow) return;
    // Сохраняем на сервере
    await api.saveConsent(caseFlow.patientId, {
      consent_hash:   consent.hash,
      text_version:   consent.textVersion,
      check1:         consent.check1,
      check2:         consent.check2,
      signature_url:  consent.signatureDataUrl,
    }).catch(() => {/* не блокируем, сохранено локально в caseFlow */});
    setCaseFlow(prev => prev ? { ...prev, consent, caseStatus: 'RECORDING' } : null);
    setScreen('taskList');
  };

  const handleRecordTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setScreen('recording');
  };

  const handleSkipTask = (taskId: string, reason: string) => {
    setCaseFlow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId
          ? { ...t, status: 'SKIPPED' as const, skipReason: reason }
          : t),
      };
    });
  };

  const handleTaskSaved = async (task: CaseTask, blob: Blob, duration: number, qcResult: any) => {
    if (!caseFlow) throw new Error('No case flow');
    // Загружаем аудио на сервер
    const result = await api.uploadAudio({
      patient_id:      caseFlow.patientId,
      recording_type:  task.fileCode,
      recording_label: task.label,
      audio:           blob,
      duration,
      sample_rate:     48000,
      bits_per_sample: 16,
      channels:        1,
      status:          qcResult.passed ? 'completed' : 'qc_warning',
    });
    if (!result.success) throw new Error(result.error || 'Upload failed');
    const uploadedUrl = result.data?.data?.audio?.yandex_disk_url;
    setCaseFlow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? {
          ...t,
          status:      'RECORDED_LOCAL' as const,
          duration,
          uploadedUrl,
          qcResult,
          audioBlob:   undefined, // удаляем blob после успешной загрузки
        } : t),
      };
    });
    setScreen('taskList');
  };

  const handleSubmitCase = async () => {
    if (!caseFlow) return;
    if (isOffline) {
      enqueue(caseFlow.patientId);
      if (user) clearDraft(user.id, caseFlow.patientId);
      setCaseFlow(prev => prev ? { ...prev, caseStatus: 'SUBMITTED' } : null);
      setFinalCaseStatus('SUBMITTED');
      setScreen('caseResult');
      return;
    }
    const result = await api.submitCase(caseFlow.patientId);
    if (result.success) {
      const cn  = result.data?.data?.caseNumber;
      const st  = result.data?.data?.caseStatus || 'SUBMITTED';
      if (user) clearDraft(user.id, caseFlow.patientId);
      setFinalCaseStatus(st);
      setFinalCaseNumber(cn);
      setFinalRejectionCode(undefined);
      setCaseFlow(prev => prev ? { ...prev, caseStatus: 'SUBMITTED' } : null);
      // Обновляем список пациентов
      setPatients(prev => prev.map(p => p.id === caseFlow.patientId
        ? { ...p, caseStatus: st, caseNumber: cn }
        : p));
      setScreen('caseResult');
    } else {
      throw new Error(result.error || 'Submit failed');
    }
  };

  const handleDeleteDraft = async (record: PatientRecord) => {
    const result = await api.deletePatient(record.id);
    if (result.success) {
      if (user) clearDraft(user.id, record.id);
      setPatients(prev => prev.filter(p => p.id !== record.id));
    } else {
      alert(result.error || 'Не удалось удалить черновик');
    }
  };

  const handleNewCaseFromResult = () => {
    setCaseFlow(null);
    setCurrentRecord(null);
    setSelectedProtocol(null);
    setScreen('protocolSelect');
  };

  const handleGoHomeFromResult = () => {
    setCaseFlow(null);
    setCurrentRecord(null);
    setSelectedProtocol(null);
    setScreen('home');
  };


  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentRecord) return;
    const files = Array.from(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';

    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      setCurrentRecord((prev) => prev ? { ...prev, photos: [...prev.photos, { url: localUrl, file }] } : null);

      const formData = new FormData();
      formData.append('patient_id', currentRecord.id);
      formData.append('photo', file);

      try {
        const response = await fetch(`${API_BASE_URL}/patients/upload-photo`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const result = await response.json();
        if (result.success) {
          const s3Url = result.data?.photo?.yandex_disk_url;
          const photoId = result.data?.photo?.id != null ? String(result.data.photo.id) : undefined;
          setCurrentRecord((prev) => {
            if (!prev) return null;
            if (!prev.photos.some((p) => p.url === localUrl)) {
              if (photoId) api.deletePhoto(photoId).catch(console.error);
              return prev;
            }
            return { ...prev, photos: prev.photos.map((p) => p.url === localUrl ? { url: s3Url || localUrl, file: null, id: photoId } : p) };
          });
          if (s3Url) URL.revokeObjectURL(localUrl);
        } else {
          setCurrentRecord((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => p.url !== localUrl) } : null);
          URL.revokeObjectURL(localUrl);
        }
      } catch {
        setCurrentRecord((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => p.url !== localUrl) } : null);
        URL.revokeObjectURL(localUrl);
      }
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photo = currentRecord?.photos[index];
    if (photo?.id) {
      await api.deletePhoto(photo.id).catch(() => {});
    }
    setCurrentRecord((prev) => {
      if (!prev) return null;
      if (photo?.url && photo.file) URL.revokeObjectURL(photo.url);
      return { ...prev, photos: prev.photos.filter((_, i) => i !== index) };
    });
  };

  const handleStartRecording = () => { setPendingSaveId(currentRecordingId); resetRecording(); startRecording(); };
  const handleStopRecording  = () => { setPendingSaveId(currentRecordingId); stopRecording(); };

  const handleSaveRecording = async (recordingId: string, { blob, url: _url, duration }: { blob: Blob; url: string; duration: number }) => {
    if (!currentRecord?.id?.startsWith('PAT-') || !blob) throw new Error('Invalid state');
    const recording = audioRecordings.find((r) => r.id === recordingId);
    if (!recording) throw new Error('Recording not found');

    const result = await api.uploadAudio({
      patient_id: currentRecord.id,
      recording_type: recording.type,
      recording_label: recording.label,
      audio: blob,
      duration,
      sample_rate: 48000,
      bits_per_sample: 16,
      channels: 1,
      status: 'completed',
    });

    if (result.success) {
      const s3Url = result.data?.data?.audio?.yandex_disk_url || result.data?.data?.audio?.url;
      const updated = audioRecordings.map((r) => r.id === recordingId ? { ...r, status: 'completed' as const, duration, url: s3Url } : r);
      setAudioRecordings(updated);
      setCurrentRecord((prev) => prev ? { ...prev, audioRecordings: updated } : null);
      const next = updated.find((r) => r.status === 'pending');
      if (next) setCurrentRecordingId(next.id);
      setPendingSaveId(null);
      resetRecording();
    } else {
      throw new Error(result.error || 'Failed to upload audio');
    }
  };

  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.src = ''; currentAudioRef.current = null; }
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.onended = () => { currentAudioRef.current = null; };
    audio.play().catch(() => {});
  };

  const handleContinue = async () => {
    if (screen === 'form') {
      const patientData = {
        patient_name: currentRecord?.patientName || '',
        age: currentRecord?.age || '',
        gender: currentRecord?.gender || 'male',
        chief_complaint: currentRecord?.chiefComplaint || '',
        notes: currentRecord?.notes || '',
        blood_pressure: currentRecord?.vitals?.bloodPressure || '',
        heart_rate: currentRecord?.vitals?.heartRate || '',
        temperature: currentRecord?.vitals?.temperature || '',
        protocol_type: selectedProtocol || undefined,
        parkinsonism_stage: currentRecord?.parkinsonismStage,
        comorbidities: currentRecord?.comorbidities,
        diagnosis: currentRecord?.diagnosis,
        moca_score: currentRecord?.mocaScore,
      };

      const result = await api.createPatient(patientData);
      if (result.success && result.data?.data?.patient) {
        const savedPatient = result.data.data.patient;
        setCurrentRecord((prev) => prev ? { ...prev, id: savedPatient.id } : null);
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
            requirements.push({ id: 'picture_cat', type: 'picture_cat', label: 'Описание картинки «Кошка на дереве»', minDuration: 20, maxDuration: 90, status: 'pending' });
          }
        }
        setAudioRecordings(requirements);
        setCurrentRecordingId(requirements[0]?.id || null);
        setScreen('capture');
      } else {
        alert('Не удалось сохранить пациента');
      }
    } else if (screen === 'capture') {
      setScreen('processing');
      setTimeout(() => setScreen('results'), 1500);
    } else if (screen === 'results') {
      setScreen('home');
      setCurrentRecord(null);
      setAudioRecordings([]);
      setCurrentRecordingId(null);
      setSelectedProtocol(null);
    }
  };

  const renderScreen = () => {
    switch (screen) {
      // ── E3: Главная ──────────────────────────────────────────────────────
      case 'home':
        return (
          <HomeScreen
            records={patients}
            loading={loading}
            onViewRecord={handleOpenCase}
            onCreateNew={handleNewPatient}
            onOpenSupport={() => setScreen('support')}
            onOpenMyCases={() => setScreen('myCases')}
          />
        );

      // ── E3 sub: Мои кейсы ────────────────────────────────────────────────
      case 'myCases':
        return (
          <MyCasesScreen
            records={patients}
            onBack={() => setScreen('home')}
            onViewCase={handleOpenCase}
            onDeleteDraft={handleDeleteDraft}
          />
        );

      // ── E14: Поддержка ────────────────────────────────────────────────────
      case 'support':
        return <SupportScreen onBack={() => setScreen('home')} />;

      // ── E4 шаг 1: Выбор протокола ─────────────────────────────────────────
      case 'protocolSelect':
        return <ProtocolSelectScreen onSelectProtocol={handleProtocolSelect} onBack={handleBack} />;

      // ── E4 шаг 2: Данные пациента ─────────────────────────────────────────
      case 'form':
        return (
          <FormScreen
            record={currentRecord}
            onBack={handleBack}
            onChange={setCurrentRecord}
            onContinue={handleFormContinue}
            submitting={formSubmitting}
            onAddPhotoLocal={handleAddPhotoLocal}
            onRemovePhoto={handleRemovePhoto}
          />
        );

      // ── E5–E6: Согласие + Подпись ─────────────────────────────────────────
      case 'consent':
        if (!caseFlow || !user) return null;
        return (
          <ConsentScreen
            caseId={caseFlow.patientId}
            doctorId={user.id}
            onBack={() => setScreen('form')}
            onConfirm={handleConsentConfirmed}
          />
        );

      // ── E7: Список заданий ────────────────────────────────────────────────
      case 'taskList':
        if (!caseFlow) return null;
        return (
          <TaskListScreen
            tasks={caseFlow.tasks}
            protocol={caseFlow.protocol}
            caseNumber={currentRecord?.caseNumber}
            onBack={() => setScreen('consent')}
            onRecordTask={handleRecordTask}
            onSkipTask={handleSkipTask}
            onProceedToSubmit={() => setScreen('readyToSubmit')}
          />
        );

      // ── E8 + E9: Запись + QC ──────────────────────────────────────────────
      case 'recording': {
        if (!caseFlow || !activeTaskId) return null;
        const activeTask = caseFlow.tasks.find(t => t.id === activeTaskId);
        if (!activeTask) return null;
        return (
          <RecordingScreen
            task={activeTask}
            onBack={() => setScreen('taskList')}
            onSave={handleTaskSaved}
          />
        );
      }

      // ── E10: Проверка и отправка ──────────────────────────────────────────
      case 'readyToSubmit':
        if (!caseFlow) return null;
        return (
          <ReadyToSubmitScreen
            tasks={caseFlow.tasks}
            consent={caseFlow.consent}
            hasRequiredFields={!!(currentRecord?.age && currentRecord?.gender)}
            hasAttachments={true}
            isOffline={isOffline}
            onSubmit={handleSubmitCase}
            onBack={() => setScreen('taskList')}
          />
        );

      // ── E11: Итоговый статус ──────────────────────────────────────────────
      case 'caseResult':
        return (
          <CaseResultScreen
            caseNumber={finalCaseNumber}
            caseStatus={finalCaseStatus}
            rejectionCode={finalRejectionCode}
            onGoHome={handleGoHomeFromResult}
            onNewCase={handleNewCaseFromResult}
          />
        );

      // ── Legacy: старый экран записи ───────────────────────────────────────
      case 'capture':
        return (
          <CaptureScreen
            currentRecord={currentRecord}
            selectedProtocol={selectedProtocol}
            isRecording={isRecording}
            isPaused={isPaused}
            audioData={audioData as any}
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
            onReRecord={() => { setPendingSaveId(null); resetRecording(); }}
            onPlayAudio={handlePlayAudio}
            onContinue={handleContinue}
            onSaveRecording={handleSaveRecording}
            formatTime={formatTime}
            formatFileSize={formatFileSize}
            audioRecordings={audioRecordings}
            currentRecordingId={currentRecordingId}
            pendingSaveId={pendingSaveId}
            onSelectRecording={(id) => setCurrentRecordingId(id)}
            onUpdateRecording={(id, update) => setAudioRecordings((prev) => prev.map((r) => r.id === id ? { ...r, ...update } : r))}
            allCompleted={audioRecordings.length > 0 && audioRecordings.every((r) => r.status === 'completed')}
          />
        );

      case 'processing':
        return <ProcessingScreen currentRecord={currentRecord} onBack={handleBack} onContinue={handleContinue} />;

      case 'results':
        return <ResultsScreen record={currentRecord} audioRecordings={audioRecordings} onBack={handleBack} onContinue={handleContinue} />;

      case 'view':
        return <ViewScreen record={currentRecord} onBack={handleBack} onEdit={() => setScreen('form')} />;

      case 'assessments':
        return (
          <AssessmentsScreen
            records={patients}
            onBack={handleBack}
            onCreateMDSUPDRS={() => {}}
            onCreateMoCA={() => {}}
            onViewRecord={handleOpenCase}
          />
        );

      default:
        return (
          <HomeScreen
            records={patients}
            loading={loading}
            onViewRecord={handleOpenCase}
            onCreateNew={handleNewPatient}
            onOpenSupport={() => setScreen('support')}
            onOpenMyCases={() => setScreen('myCases')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Офлайн-баннер */}
      <OfflineBanner initialOffline={isOffline} />
      {/* Кнопка перехода в панель администратора */}
      {user?.role === 'admin' && screen === 'home' && (
        <div className="fixed top-2 right-2 z-50">
          <button
            onClick={onGoAdmin}
            className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg shadow hover:bg-purple-700"
          >
            Управление
          </button>
        </div>
      )}
      {renderScreen()}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

export default App;
