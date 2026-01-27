import { useState, useRef, useEffect } from 'react';
import { Mic, Camera, Cloud, Check, AlertCircle, Lock, Play, Pause, RotateCcw, X, Menu, ChevronRight, Brain, Activity, Eye } from 'lucide-react';

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'pending';
type Screen = 'home' | 'capture' | 'form' | 'processing' | 'results' | 'view';

interface Disease {
    name: string;
    percentage: number;
}

interface PatientRecord {
    id: string;
    audioBlob?: Blob;
    audioUrl?: string;
    photos: { url: string; file: File | null }[];
    patientName: string;
    age: string;
    gender: string;
    chiefComplaint: string;
    notes: string;
    vitals: {
        bloodPressure: string;
        heartRate: string;
        temperature: string;
    };
    diseases?: Disease[];
}

export default function App() {
    const [screen, setScreen] = useState<Screen>('home');
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [recordingTime, setRecordingTime] = useState(0);
    const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
    const [records, setRecords] = useState<PatientRecord[]>([]);
    const [showMandatoryPhotoWarning, setShowMandatoryPhotoWarning] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [processingStep, setProcessingStep] = useState(0);
    const [viewingRecord, setViewingRecord] = useState<PatientRecord | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

   
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

  
    const generatePatientId = () => {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const count = String(records.length + 1).padStart(3, '0');
        return `PAT-${dateStr}-${count}`;
    };

 
    const generateDiseaseAnalysis = (): Disease[] => {
        const diseases = [
            { name: 'Деменция', percentage: Math.floor(Math.random() * 30) + 70 },
            { name: 'Болезнь Альцгеймера', percentage: Math.floor(Math.random() * 20) + 5 },
            { name: 'Болезнь Паркинсона', percentage: Math.floor(Math.random() * 15) + 2 },
            { name: 'Синдром Дауна', percentage: Math.floor(Math.random() * 5) },
            { name: 'Сосудистая деменция', percentage: Math.floor(Math.random() * 10) + 3 },
            { name: 'Лобно-височная деменция', percentage: Math.floor(Math.random() * 8) + 1 },
        ];
        return diseases.sort((a, b) => b.percentage - a.percentage);
    };

    
    const startNewRecord = () => {
        const newRecord: PatientRecord = {
            id: generatePatientId(),
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
        };
        setCurrentRecord(newRecord);
        setScreen('capture');
        setRecordingState('idle');
        setRecordingTime(0);
        setValidationErrors([]);
        setShowMandatoryPhotoWarning(false);
    };

    
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                if (currentRecord) {
                    setCurrentRecord({ ...currentRecord, audioBlob, audioUrl });
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingState('recording');

            
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ.');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && recordingState === 'recording') {
            mediaRecorderRef.current.pause();
            setRecordingState('paused');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && recordingState === 'paused') {
            mediaRecorderRef.current.resume();
            setRecordingState('recording');
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setRecordingState('completed');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const reRecord = () => {
        setRecordingState('idle');
        setRecordingTime(0);
        if (currentRecord) {
            setCurrentRecord({ ...currentRecord, audioBlob: undefined, audioUrl: undefined });
        }
    };

    const playAudio = () => {
        const audioUrl = viewingRecord?.audioUrl || currentRecord?.audioUrl;
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(err => console.error('Error playing audio:', err));
        }
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

    
    const validateForm = () => {
        const errors: string[] = [];
        if (!currentRecord) return errors;

        if (!currentRecord.patientName.trim()) errors.push('patientName');
        if (!currentRecord.age.trim()) errors.push('age');
        if (!currentRecord.gender) errors.push('gender');
        if (!currentRecord.chiefComplaint.trim()) errors.push('chiefComplaint');
        if (currentRecord.photos.length === 0) {
            errors.push('photos');
            setShowMandatoryPhotoWarning(true);
        }
        return errors;
    };

 
    const saveAndSync = () => {
        const errors = validateForm();
        setValidationErrors(errors);
        if (errors.length > 0) {
            return;
        }

        
        setProcessingStep(0);
        setScreen('processing');

        
        setTimeout(() => setProcessingStep(1), 1500);
        setTimeout(() => setProcessingStep(2), 3000);
        setTimeout(() => {
            const diseases = generateDiseaseAnalysis();
            if (currentRecord) {
                setCurrentRecord({ ...currentRecord, diseases });
            }
            setScreen('results');
        }, 4500);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

   
    if (screen === 'home') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="font-semibold text-gray-900 text-lg">Сбор клинических данных</h1>
                            <p className="text-gray-500 text-sm mt-1">Упрощенная документация пациентов</p>
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                            <Menu className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </header>

                
                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
                    <div className="max-w-4xl mx-auto">
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="bg-blue-50 rounded-xl p-4 sm:p-6">
                                <div className="text-2xl sm:text-3xl font-semibold text-blue-900">{records.length}</div>
                                <div className="text-blue-700 mt-1 text-sm">Всего записей</div>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 sm:p-6">
                                <div className="flex items-center gap-2">
                                    <Cloud className="w-5 h-5 text-green-700" />
                                    <div className="text-green-900 font-medium text-sm">Синхронизировано</div>
                                </div>
                                <div className="text-green-700 text-xs sm:text-sm mt-1">Облачное резервирование активно</div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-gray-600" />
                                    <div className="text-gray-900 font-medium text-sm">Безопасно</div>
                                </div>
                                <div className="text-gray-600 text-xs sm:text-sm mt-1">Сквозное шифрование</div>
                            </div>
                        </div>

                       
                        <button
                            onClick={startNewRecord}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 sm:p-6 flex items-center justify-between transition-colors shadow-lg shadow-blue-600/20"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="bg-blue-500 rounded-full p-2 sm:p-3">
                                    <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold text-sm sm:text-base">Создать новую карту пациента</div>
                                    <div className="text-blue-100 text-xs sm:text-sm mt-1">Запись аудио, добавление фото и сбор данных</div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                       
                        {records.length > 0 && (
                            <div className="mt-6 sm:mt-8">
                                <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Последние записи</h2>
                                <div className="space-y-2 sm:space-y-3">
                                    {records.slice(-5).reverse().map((record, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setViewingRecord(record);
                                                setScreen('view');
                                            }}
                                            className="w-full border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900 text-sm">{record.id}</div>
                                                    <div className="text-xs sm:text-sm text-gray-600 mt-1">{record.patientName || 'Без имени'}</div>
                                                </div>
                                                <div className="flex items-center gap-1 sm:gap-2 text-green-600">
                                                    <Cloud className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    
    if (screen === 'capture') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => setScreen('home')}
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                            >
                                ← Назад
                            </button>
                            <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Защищено</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3 inline-block">
                            <div className="text-xs text-gray-500 mb-1">ID пациента</div>
                            <div className="font-mono font-semibold text-gray-900 text-xs sm:text-sm">{currentRecord?.id}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
                       
                        <div className="mb-6 sm:mb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Camera className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Фотографии пациента</h2>
                                <span className="text-red-500">*</span>
                            </div>

                           
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                                {currentRecord?.photos.map((photo, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                        <img src={photo.url} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removePhoto(index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                        
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full border-2 border-dashed rounded-lg p-4 sm:p-6 flex flex-col items-center gap-2 transition-colors ${showMandatoryPhotoWarning
                                        ? 'border-red-300 bg-red-50 hover:bg-red-100'
                                        : 'border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`rounded-full p-2 sm:p-3 ${showMandatoryPhotoWarning ? 'bg-red-100' : 'bg-gray-100'}`}>
                                    {showMandatoryPhotoWarning ? (
                                        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                                    ) : (
                                        <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                                    )}
                                </div>
                                <div className={`font-medium text-sm sm:text-base ${showMandatoryPhotoWarning ? 'text-red-900' : 'text-gray-900'}`}>
                                    Добавить фото
                                </div>
                                {showMandatoryPhotoWarning && (
                                    <div className="text-xs sm:text-sm text-red-700">Требуется хотя бы одно фото</div>
                                )}
                            </button>
                        </div>

                        <div className="flex-1 min-h-8"></div>

                      
                        <div className="pb-6 sm:pb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Mic className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Аудиозаметки</h2>
                            </div>

                            
                            {recordingState === 'completed' && currentRecord?.audioUrl && (
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <button
                                                onClick={playAudio}
                                                className="bg-blue-600 text-white rounded-full p-2 sm:p-3 hover:bg-blue-700"
                                            >
                                                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">Запись завершена</div>
                                                <div className="text-xs sm:text-sm text-gray-600">{formatTime(recordingTime)}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={reRecord}
                                            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span className="text-xs sm:text-sm font-medium">Перезаписать</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                         
                            {(recordingState === 'recording' || recordingState === 'paused') && (
                                <div className="text-center mb-4 sm:mb-6">
                                    <div className="text-3xl sm:text-4xl font-mono font-semibold text-gray-900 mb-2">
                                        {formatTime(recordingTime)}
                                    </div>
                                    <div className={`text-sm font-medium ${recordingState === 'recording' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {recordingState === 'recording' ? 'Запись...' : 'Пауза'}
                                    </div>
                                </div>
                            )}

                       
                            <div className="flex items-center justify-center gap-3 sm:gap-4">
                                {recordingState === 'idle' && (
                                    <button
                                        onClick={startRecording}
                                        className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 sm:p-8 shadow-lg shadow-red-500/30 transition-all hover:scale-105"
                                    >
                                        <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
                                    </button>
                                )}
                                {recordingState === 'recording' && (
                                    <>
                                        <button
                                            onClick={pauseRecording}
                                            className="bg-amber-500 hover:bg-amber-600 text-white rounded-full p-4 sm:p-6 shadow-lg transition-all"
                                        >
                                            <Pause className="w-6 h-6 sm:w-8 sm:h-8" />
                                        </button>
                                        <button
                                            onClick={stopRecording}
                                            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 sm:p-8 shadow-lg shadow-red-500/30 transition-all animate-pulse"
                                        >
                                            <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
                                        </button>
                                    </>
                                )}
                                {recordingState === 'paused' && (
                                    <>
                                        <button
                                            onClick={resumeRecording}
                                            className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 sm:p-6 shadow-lg transition-all"
                                        >
                                            <Play className="w-6 h-6 sm:w-8 sm:h-8" />
                                        </button>
                                        <button
                                            onClick={stopRecording}
                                            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 sm:p-6 shadow-lg transition-all"
                                        >
                                            <Check className="w-6 h-6 sm:w-8 sm:h-8" />
                                        </button>
                                    </>
                                )}
                            </div>
                            {recordingState === 'idle' && (
                                <p className="text-center text-gray-500 text-xs sm:text-sm mt-3 sm:mt-4">Нажмите для начала записи</p>
                            )}
                        </div>

                       
                        <button
                            onClick={() => setScreen('form')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 sm:py-4 font-medium transition-colors shadow-lg shadow-blue-600/20"
                        >
                            Продолжить к данным пациента
                        </button>
                    </div>
                </main>
            </div>
        );
    }

  
    if (screen === 'form') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => setScreen('capture')}
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                            >
                                ← Назад
                            </button>
                            <div className="flex items-center gap-2 sm:gap-3">
                                {syncStatus === 'synced' && (
                                    <div className="flex items-center gap-1 text-green-600">
                                        <Cloud className="w-4 h-4" />
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                                {syncStatus === 'syncing' && (
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <Cloud className="w-4 h-4 animate-pulse" />
                                        <span className="text-xs">Синхронизация...</span>
                                    </div>
                                )}
                                <Lock className="w-3 h-3 text-gray-400" />
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3 inline-block">
                            <div className="text-xs text-gray-500 mb-1">ID пациента</div>
                            <div className="font-mono font-semibold text-gray-900 text-xs sm:text-sm">{currentRecord?.id}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 sm:space-y-8">
                            
                            <section>
                                <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                    Информация о пациенте
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            ФИО <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Введите ФИО пациента"
                                            value={currentRecord?.patientName || ''}
                                            onChange={(e) => setCurrentRecord(prev => prev ? { ...prev, patientName: e.target.value } : null)}
                                            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 ${validationErrors.includes('patientName')
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-500'
                                                    : 'border-gray-300 focus:ring-blue-500'
                                                }`}
                                        />
                                        {validationErrors.includes('patientName') && (
                                            <p className="text-red-600 text-xs sm:text-sm mt-1">ФИО обязательно для заполнения</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                                Возраст <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Возраст"
                                                value={currentRecord?.age || ''}
                                                onChange={(e) => setCurrentRecord(prev => prev ? { ...prev, age: e.target.value } : null)}
                                                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 ${validationErrors.includes('age')
                                                        ? 'border-red-300 bg-red-50 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500'
                                                    }`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                                Пол <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={currentRecord?.gender || ''}
                                                onChange={(e) => setCurrentRecord(prev => prev ? { ...prev, gender: e.target.value } : null)}
                                                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 ${validationErrors.includes('gender')
                                                        ? 'border-red-300 bg-red-50 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500'
                                                    }`}
                                            >
                                                <option value="">Выбрать</option>
                                                <option value="male">Мужской</option>
                                                <option value="female">Женский</option>
                                                <option value="other">Другое</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        
                            <section>
                                <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                    Жизненные показатели
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Артериальное давление
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="напр., 120/80"
                                            value={currentRecord?.vitals.bloodPressure || ''}
                                            onChange={(e) =>
                                                setCurrentRecord(prev => prev ? {
                                                    ...prev,
                                                    vitals: { ...prev.vitals, bloodPressure: e.target.value }
                                                } : null)
                                            }
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Пульс
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="уд/мин"
                                            value={currentRecord?.vitals.heartRate || ''}
                                            onChange={(e) =>
                                                setCurrentRecord(prev => prev ? {
                                                    ...prev,
                                                    vitals: { ...prev.vitals, heartRate: e.target.value }
                                                } : null)
                                            }
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Температура
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="°C"
                                            value={currentRecord?.vitals.temperature || ''}
                                            onChange={(e) =>
                                                setCurrentRecord(prev => prev ? {
                                                    ...prev,
                                                    vitals: { ...prev.vitals, temperature: e.target.value }
                                                } : null)
                                            }
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </section>

                         
                            <section>
                                <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                    Клиническая информация
                                </h2>
                                <div className="space-y-3 sm:space-y-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Основная жалоба <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            placeholder="Основная причина обращения"
                                            value={currentRecord?.chiefComplaint || ''}
                                            onChange={(e) => setCurrentRecord(prev => prev ? { ...prev, chiefComplaint: e.target.value } : null)}
                                            rows={2}
                                            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 resize-none ${validationErrors.includes('chiefComplaint')
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-500'
                                                    : 'border-gray-300 focus:ring-blue-500'
                                                }`}
                                        />
                                        {validationErrors.includes('chiefComplaint') && (
                                            <p className="text-red-600 text-xs sm:text-sm mt-1">Основная жалоба обязательна для заполнения</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Дополнительные заметки
                                        </label>
                                        <textarea
                                            placeholder="Любые дополнительные наблюдения или заметки"
                                            value={currentRecord?.notes || ''}
                                            onChange={(e) => setCurrentRecord(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                            rows={3}
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        />
                                    </div>
                                </div>
                            </section>
                        </form>
                    </div>
                </main>

              
                <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3 sm:py-4 sticky bottom-0">
                    <div className="max-w-4xl mx-auto">
                        <button
                            onClick={saveAndSync}
                            disabled={syncStatus === 'syncing'}
                            className={`w-full py-3 sm:py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg ${syncStatus === 'syncing'
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                                }`}
                        >
                            {syncStatus === 'syncing' ? (
                                <>
                                    <Cloud className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                                    <span className="text-sm sm:text-base">Синхронизация...</span>
                                </>
                            ) : (
                                <>
                                    <Cloud className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-sm sm:text-base">Сохранить и синхронизировать</span>
                                    <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

               
                {showSuccessToast && (
                    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg flex items-center gap-2 sm:gap-3 animate-slide-down z-50">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-xs sm:text-sm">Запись успешно сохранена и синхронизирована!</span>
                    </div>
                )}
            </div>
        );
    }

    
    if (screen === 'processing') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
               
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => setScreen('home')}
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                            >
                                ← Назад
                            </button>
                            <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Защищено</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3 inline-block">
                            <div className="text-xs text-gray-500 mb-1">ID пациента</div>
                            <div className="font-mono font-semibold text-gray-900 text-xs sm:text-sm">{currentRecord?.id}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
                      
                        <div className="mb-6 sm:mb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Activity className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Обработка данных</h2>
                            </div>

                          
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                                <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                    <div className="flex items-center justify-center h-full">
                                        <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-xs sm:text-sm font-medium px-2 py-1">
                                        Анализ мозга
                                    </div>
                                </div>
                                <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                    <div className="flex items-center justify-center h-full">
                                        <Eye className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-xs sm:text-sm font-medium px-2 py-1">
                                        Анализ глаз
                                    </div>
                                </div>
                                <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                    <div className="flex items-center justify-center h-full">
                                        <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-xs sm:text-sm font-medium px-2 py-1">
                                        Анализ голоса
                                    </div>
                                </div>
                            </div>

                            
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-3 sm:mb-4">
                                <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(processingStep / 2) * 100}%` }}
                                ></div>
                            </div>

                           
                            <div className="text-xs sm:text-sm text-gray-500">
                                {processingStep === 0 && 'Анализ мозга'}
                                {processingStep === 1 && 'Анализ глаз'}
                                {processingStep === 2 && 'Анализ голоса'}
                            </div>
                        </div>

                        
                        <div className="flex-1 min-h-8"></div>

                       
                        <button
                            onClick={() => {
                                if (processingStep < 2) {
                                    setProcessingStep(processingStep + 1);
                                } else {
                                    const diseases = generateDiseaseAnalysis();
                                    if (currentRecord) {
                                        setCurrentRecord({ ...currentRecord, diseases });
                                    }
                                    setScreen('results');
                                }
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 sm:py-4 font-medium transition-colors shadow-lg shadow-blue-600/20"
                        >
                            {processingStep < 2 ? 'Продолжить' : 'Показать результаты'}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    
    if (screen === 'results') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => setScreen('home')}
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                            >
                                ← Назад
                            </button>
                            <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Защищено</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3 inline-block">
                            <div className="text-xs text-gray-500 mb-1">ID пациента</div>
                            <div className="font-mono font-semibold text-gray-900 text-xs sm:text-sm">{currentRecord?.id}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
                     
                        <div className="mb-6 sm:mb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Brain className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Результаты анализа</h2>
                            </div>

                            
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                                {currentRecord?.diseases?.slice(0, 6).map((disease, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                        <div className="flex items-center justify-center h-full">
                                            <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-xs sm:text-sm font-medium px-2 py-1">
                                            {disease.name}
                                        </div>
                                        <div className="absolute top-0 left-0 right-0 bg-blue-50 text-blue-900 text-xs sm:text-sm font-semibold px-2 py-1">
                                            {disease.percentage}%
                                        </div>
                                    </div>
                                ))}
                            </div>

                            
                            <div className="text-xs sm:text-sm text-gray-500 space-y-2">
                                {currentRecord?.diseases?.map((disease, index) => (
                                    <div key={index} className="flex justify-between py-1 border-b border-gray-100">
                                        <span className="font-medium">{disease.name}:</span>
                                        <span className="text-blue-600 font-semibold">{disease.percentage}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        
                        <div className="flex-1 min-h-8"></div>

                        <div className="space-y-2 sm:space-y-3">
                            <button
                                onClick={() => {
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
                                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 sm:py-4 font-medium transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                            >
                                <Cloud className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>Сохранить запись</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (currentRecord) {
                                        setViewingRecord(currentRecord);
                                    }
                                    setScreen('view');
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 sm:py-4 font-medium transition-colors shadow-lg shadow-blue-600/20"
                            >
                                Просмотреть без сохранения
                            </button>
                        </div>
                    </div>
                </main>

                {showSuccessToast && (
                    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg flex items-center gap-2 sm:gap-3 animate-slide-down z-50">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-xs sm:text-sm">Запись успешно сохранена!</span>
                    </div>
                )}
            </div>
        );
    }

 
    if (screen === 'view') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                
                <header className="border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => setScreen('home')}
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                            >
                                ← Назад
                            </button>
                            <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Защищено</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3 inline-block">
                            <div className="text-xs text-gray-500 mb-1">ID пациента</div>
                            <div className="font-mono font-semibold text-gray-900 text-xs sm:text-sm">{viewingRecord?.id}</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col overflow-y-auto">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
                        
                        <div className="mb-6 sm:mb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Camera className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Фотографии пациента</h2>
                            </div>

                         
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                                {viewingRecord?.photos.map((photo, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                        <img src={photo.url} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 min-h-8"></div>

                        <div className="pb-6 sm:pb-8">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Mic className="w-5 h-5 text-gray-700" />
                                <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Аудиозаметки</h2>
                            </div>

                            {viewingRecord?.audioUrl && (
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <button
                                                onClick={playAudio}
                                                className="bg-blue-600 text-white rounded-full p-2 sm:p-3 hover:bg-blue-700"
                                            >
                                                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">Запись завершена</div>
                                                <div className="text-xs sm:text-sm text-gray-600">{formatTime(recordingTime)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <section className="mb-6 sm:mb-8">
                            <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                Информация о пациенте
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        ФИО <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={viewingRecord?.patientName || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        readOnly
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Возраст <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={viewingRecord?.age || ''}
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            readOnly
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                            Пол <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={viewingRecord?.gender === 'male' ? 'Мужской' : viewingRecord?.gender === 'female' ? 'Женский' : 'Другое'}
                                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            readOnly
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="mb-6 sm:mb-8">
                            <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                Жизненные показатели
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        Артериальное давление
                                    </label>
                                    <input
                                        type="text"
                                        value={viewingRecord?.vitals.bloodPressure || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        Пульс
                                    </label>
                                    <input
                                        type="text"
                                        value={viewingRecord?.vitals.heartRate || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        Температура
                                    </label>
                                    <input
                                        type="text"
                                        value={viewingRecord?.vitals.temperature || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        readOnly
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="mb-6 sm:mb-8">
                            <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                Клиническая информация
                            </h2>
                            <div className="space-y-3 sm:space-y-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        Основная жалоба <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={viewingRecord?.chiefComplaint || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 resize-none focus:ring-blue-500"
                                        readOnly
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                        Дополнительные заметки
                                    </label>
                                    <textarea
                                        value={viewingRecord?.notes || ''}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        readOnly
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </section>

                        {viewingRecord?.diseases && viewingRecord.diseases.length > 0 && (
                            <section>
                                <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200 text-sm sm:text-base">
                                    Анализ заболеваний
                                </h2>
                                <div className="space-y-2 sm:space-y-3">
                                    {viewingRecord.diseases.map((disease, index) => (
                                        <div key={index} className="bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-medium text-gray-900 text-sm">{disease.name}</div>
                                                <div className={`text-sm font-semibold ${disease.percentage > 50 ? 'text-red-600' :
                                                        disease.percentage > 20 ? 'text-amber-600' : 'text-green-600'
                                                    }`}>
                                                    {disease.percentage}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    return null;
}