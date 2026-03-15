import { useState } from 'react';
import { Mic, Play, Pause, Upload, X, AlertCircle, CheckCircle, RotateCcw, Headphones, SkipForward } from 'lucide-react';
import type { PatientRecord, ProtocolType } from '../../types';
import type { AudioRecording } from '../../types/forms';

interface CaptureScreenProps {
  currentRecord: PatientRecord | null;
  selectedProtocol: ProtocolType | null;
  isRecording: boolean;
  isPaused: boolean;
  audioData: { blob: Blob; url: string; duration: number } | null;
  recordingTime: number;
  showMandatoryPhotoWarning: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onBack: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onReRecord: () => void;
  onPlayAudio: (url?: string) => void;
  onContinue: () => void;
  onSaveRecording: (recordingId: string, data: { blob: Blob; url: string; duration: number }) => Promise<void>;
  formatTime: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
  audioRecordings: AudioRecording[];
  currentRecordingId: string | null;
  onSelectRecording: (id: string) => void;
  onUpdateRecording: (id: string, data: Partial<AudioRecording>) => void;
  allCompleted: boolean;
}

export default function CaptureScreen({
  currentRecord,
  selectedProtocol,
  isRecording,
  isPaused,
  audioData,
  recordingTime,
  showMandatoryPhotoWarning,
  fileInputRef,
  onBack,
  onPhotoUpload,
  onRemovePhoto,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onReRecord,
  onPlayAudio,
  onContinue,
  onSaveRecording,
  formatTime,
  formatFileSize,
  audioRecordings,
  currentRecordingId,
  onSelectRecording,
  onUpdateRecording,
  allCompleted,
}: CaptureScreenProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getRecordingRequirements = (): AudioRecording[] => {
    switch (selectedProtocol) {
      case 'phonemes':
        return [
          { id: 'phoneme_a', type: 'phoneme_a', label: 'Фонема «аааааааа»', minDuration: 9, status: 'pending' },
          { id: 'phoneme_oi', type: 'phoneme_oi', label: 'Фонемы «о-и-о-и-о-и»', minDuration: 9, status: 'pending' },
        ];
      case 'speech':
        return [
          { id: 'picture_cookie', type: 'picture_cookie', label: 'Описание картинки «Вор печенья»', minDuration: 20, maxDuration: 90, status: 'pending' },
          { id: 'text_bear', type: 'text_bear', label: 'Чтение текста «Гималайский медведь»', maxDuration: 120, status: 'pending' },
        ];
      case 'full':
        return [
          { id: 'phoneme_a', type: 'phoneme_a', label: 'Фонема «аааааааа»', minDuration: 9, status: 'pending' },
          { id: 'phoneme_oi', type: 'phoneme_oi', label: 'Фонемы «о-и-о-и-о-и»', minDuration: 9, status: 'pending' },
          { id: 'picture_cookie', type: 'picture_cookie', label: 'Описание картинки «Вор печенья»', minDuration: 20, maxDuration: 90, status: 'pending' },
          { id: 'picture_cat', type: 'picture_cat', label: 'Описание картинки «Кошка на дереве»', minDuration: 20, maxDuration: 90, status: 'pending' },
          { id: 'text_bear', type: 'text_bear', label: 'Чтение текста «Гималайский медведь»', maxDuration: 120, status: 'pending' },
        ];
      default:
        return [];
    }
  };

  const requirements = getRecordingRequirements();
  const mergedRecordings = requirements.map(req => {
    const existing = audioRecordings.find(r => r.id === req.id);
    return existing ? { ...req, ...existing } : req;
  });

  const currentRecording = mergedRecordings.find(r => r.id === currentRecordingId);
  const completedCount = mergedRecordings.filter(r => r.status === 'completed').length;
  const totalCount = mergedRecordings.length;

  const validateDuration = (duration: number, minDuration?: number, maxDuration?: number): 'success' | 'warning' => {
    if (minDuration && duration < minDuration) return 'warning';
    if (maxDuration && duration > maxDuration) return 'warning';
    return 'success';
  };

  const handleSelectRecording = (id: string) => {
    const recording = mergedRecordings.find(r => r.id === id);
    if (!recording) return;
    onSelectRecording(id);
    if (recording.status === 'completed' && recording.url && !isRecording) {
      setPlayingId(id);
      onPlayAudio(recording.url);
      setTimeout(() => setPlayingId(null), 3000);
    }
  };

  const handleReRecord = (id: string) => {
    onUpdateRecording(id, { status: 'pending', blob: undefined, url: undefined, duration: undefined });
    onSelectRecording(id);
    onReRecord();
  };

  const handleSaveCurrentRecording = async () => {
    if (audioData?.blob && !isRecording && currentRecordingId) {
      setIsSaving(true);
      try {
        console.log('Сохранение аудио:', currentRecordingId);
        await onSaveRecording(currentRecordingId, audioData);
        console.log('Аудио сохранено');
        
      } catch (err) {
        console.error('Ошибка сохранения:', err);
        alert('Не удалось сохранить аудио. Попробуйте ещё раз.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Запись аудио</h1>
          <p className="text-gray-600">
            Протокол: {selectedProtocol === 'phonemes' ? 'Фонемы' : selectedProtocol === 'speech' ? 'Речь' : 'Полный'}
          </p>
          <p className="text-sm text-gray-500">Записано: {completedCount} из {totalCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Фотографии (обезличенные)</h2>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPhotoUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50">
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Нажмите для загрузки фотографий</p>
        </button>
        {currentRecord?.photos && currentRecord.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {currentRecord.photos.map((photo, index) => (
              <div key={index} className="relative">
                <img src={photo.url} alt={`Фото ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                <button onClick={() => onRemovePhoto(index)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Требования к записи</h2>
        <div className="space-y-3">
          {mergedRecordings.map((recording) => (
            <button
              key={recording.id}
              onClick={() => handleSelectRecording(recording.id)}
              disabled={isRecording && recording.id !== currentRecordingId}
              className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                currentRecordingId === recording.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : recording.status === 'completed'
                  ? 'border-green-300 bg-green-50 hover:border-green-400'
                  : recording.status === 'warning'
                  ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {recording.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : recording.status === 'warning' ? (
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                ) : recording.status === 'recording' ? (
                  <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                )}
                <span className={recording.status === 'completed' ? 'text-green-700 font-medium' : 'text-gray-700'}>
                  {recording.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {recording.minDuration ? `≥ ${recording.minDuration} сек.` : ''}
                  {recording.maxDuration && !recording.minDuration ? `≤ ${recording.maxDuration} сек.` : ''}
                  {recording.maxDuration && recording.minDuration ? `${recording.minDuration}-${recording.maxDuration} сек.` : ''}
                </span>
                {recording.duration && <span className="text-sm font-medium text-green-600">{formatTime(recording.duration)}</span>}
                {playingId === recording.id && <Headphones className="w-4 h-4 text-blue-500 animate-pulse" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        {currentRecording && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">Сейчас: {currentRecording.label}</p>
          </div>
        )}

        <div className="text-center mb-6">
          <div className="text-4xl font-mono font-bold">{formatTime(recordingTime / 1000)}</div>
          {audioData && <div className="text-sm text-gray-600 mt-2">{formatFileSize(audioData.blob.size)} • {formatTime(audioData.duration)}</div>}
        </div>

        <div className="flex justify-center gap-4 flex-wrap mb-6">
          {!isRecording && !audioData && currentRecording && currentRecording.status !== 'completed' && (
            <button onClick={onStartRecording} className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-medium flex items-center gap-2">
              <Mic className="w-6 h-6" /> Начать запись
            </button>
          )}
          {isRecording && !isPaused && (
            <>
              <button onClick={onPauseRecording} className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-4 rounded-full flex items-center gap-2">
                <Pause className="w-6 h-6" /> Пауза
              </button>
              <button onClick={onStopRecording} className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-full flex items-center gap-2">
                <CheckCircle className="w-6 h-6" /> Закончить
              </button>
            </>
          )}
          {isRecording && isPaused && (
            <button onClick={onResumeRecording} className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full flex items-center gap-2">
              <Play className="w-6 h-6" /> Продолжить
            </button>
          )}
        </div>

        {audioData && !isRecording && currentRecordingId && (
          <div className="border-t pt-6">
            <p className="text-center text-gray-700 font-medium mb-4">Запись завершена:</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <button onClick={() => onPlayAudio(audioData.url)} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-full flex items-center gap-2">
                <Headphones className="w-6 h-6" /> Прослушать
              </button>
              <button onClick={() => handleReRecord(currentRecordingId)} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-4 rounded-full flex items-center gap-2">
                <RotateCcw className="w-6 h-6" /> Перезаписать
              </button>
              <button
                onClick={handleSaveCurrentRecording}
                disabled={isSaving}
                className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-6 py-4 rounded-full flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" /> Сохранить
                  </>
                )}
              </button>
            </div>
            {currentRecording && audioData && (
              <div className={`mt-4 flex justify-center gap-2 ${
                validateDuration(audioData.duration, currentRecording.minDuration, currentRecording.maxDuration) === 'warning'
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {validateDuration(audioData.duration, currentRecording.minDuration, currentRecording.maxDuration) === 'warning'
                  ? <AlertCircle className="w-5 h-5"/>
                  : <CheckCircle className="w-5 h-5"/>
                }
                <span>
                  {validateDuration(audioData.duration, currentRecording.minDuration, currentRecording.maxDuration) === 'warning'
                    ? 'Длительность не соответствует'
                    : 'Длительность в норме'
                  }
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Прогресс</span>
          <span className="text-sm text-gray-500">{completedCount}/{totalCount}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
        </div>
      </div>

      <button
        onClick={() => {
          if (allCompleted) {
            onContinue();
          }
        }}
        disabled={!allCompleted}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2"
      >
        {allCompleted ? (
          <>
            <CheckCircle className="w-5 h-5" /> Все записи выполнены — Завершить
          </>
        ) : (
          `Запишите все ${totalCount} аудио для продолжения`
        )}
      </button>
    </div>
  );
}
