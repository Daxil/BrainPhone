import { ArrowLeft, Mic, Pause, Play, StopCircle, Trash2, Image, ChevronRight, Upload } from 'lucide-react';
import Header from '../layout/Header';
import type { PatientRecord } from '../../types';

interface CaptureScreenProps {
  currentRecord: PatientRecord | null;
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
  onPlayAudio: () => void;
  onContinue: () => void;
  formatTime: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
}

export default function CaptureScreen({
  currentRecord,
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
  formatTime,
  formatFileSize,
}: CaptureScreenProps) {
  const hasAudio = !!audioData?.url;
  const hasPhotos = currentRecord?.photos.length! > 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="capture" onBack={onBack} title="Захват данных" />

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Аудио запись */}
          <div className="mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">Запись голоса пациента</h2>

            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300">
              {!isRecording && !hasAudio && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mic className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-gray-600 mb-4">Нажмите кнопку ниже, чтобы начать запись</p>
                  <button
                    onClick={onStartRecording}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-medium flex items-center gap-2 mx-auto"
                  >
                    <Mic className="w-5 h-5" />
                    Начать запись
                  </button>
                </div>
              )}

              {isRecording && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <div className="w-8 h-8 bg-white rounded-full"></div>
                  </div>
                  <p className="text-2xl font-bold text-red-600 mb-2">
                    {formatTime(recordingTime / 1000)}
                  </p>
                  <p className="text-gray-600 mb-4">Идет запись...</p>
                  <div className="flex gap-3 justify-center">
                    {isPaused ? (
                      <button
                        onClick={onResumeRecording}
                        className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full"
                      >
                        <Play className="w-6 h-6" />
                      </button>
                    ) : (
                      <button
                        onClick={onPauseRecording}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-full"
                      >
                        <Pause className="w-6 h-6" />
                      </button>
                    )}
                    <button
                      onClick={onStopRecording}
                      className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full"
                    >
                      <StopCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {hasAudio && !isRecording && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium mb-1">Аудио записано</p>
                  <p className="text-sm text-gray-600 mb-4">
                    Длительность: {formatTime(audioData.duration)} |
                    Размер: {formatFileSize(audioData.blob.size)}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={onPlayAudio}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Воспроизвести
                    </button>
                    <button
                      onClick={onReRecord}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Перезаписать
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Фотографии */}
          <div className="mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">Фотографии пациента</h2>

            {showMandatoryPhotoWarning && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">⚠️ Добавьте хотя бы одно фото</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {currentRecord?.photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                  <img
                    src={photo.url}
                    alt={`Фото ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => onRemovePhoto(index)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPhotoUpload}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Добавить фото</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </main>

      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onContinue}
            disabled={!hasAudio || !hasPhotos}
            className={`w-full ${
              (!hasAudio || !hasPhotos)
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-xl py-4 font-medium transition-colors`}
          >
            {hasAudio && hasPhotos ? (
              <>
                Продолжить
                <ChevronRight className="w-5 h-5 inline-block ml-2" />
              </>
            ) : (
              'Добавьте аудио и фото для продолжения'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
