import { ChevronLeft, Edit, Play, Pause, Headphones } from 'lucide-react';
import { useState, useRef } from 'react';
import type { PatientRecord } from '../../types';

interface ViewScreenProps {
  record: PatientRecord | null;
  onBack: () => void;
  onEdit: () => void;
}

export default function ViewScreen({ record, onBack, onEdit }: ViewScreenProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!record) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <p className="text-gray-600">Запись не найдена</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">Назад</button>
      </div>
    );
  }

  const handlePlayAudio = (url: string, recordingId: string) => {
    // Если это Яндекс.Диск — добавляем ?download=1 для прямого воспроизведения
    const playUrl = url.includes('yandex.net')
      ? `${url}?download=1`
      : url;

    // Останавливаем текущее воспроизведение
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Если кликнули на то же аудио — останавливаем
    if (playingId === recordingId) {
      setPlayingId(null);
      return;
    }

    // Создаём новый Audio с правильными настройками
    const audio = new Audio();
    audio.src = playUrl;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    audio.onloadedmetadata = () => {
      console.log('Аудио загружено, длительность:', audio.duration);
    };

    audio.onerror = (err) => {
      console.error('Ошибка загрузки аудио:', err);
      // Пробуем локальную ссылку если Яндекс.Диск не работает
      if (url.includes('yandex.net')) {
        console.log('Пробуем локальную ссылку...');
      }
      setPlayingId(null);
    };

    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    audio.play().then(() => {
      setPlayingId(recordingId);
      audioRef.current = audio;
    }).catch((err) => {
      console.error('Ошибка воспроизведения:', err);
      setPlayingId(null);
    });
  };

  const audioCount = record.audioRecordings?.length || 0;
  const photoCount = record.photos?.length || 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Edit className="w-5 h-5" />
            <span>Редактировать</span>
          </button>
        </div>
      </div>

      <main className="flex-1 px-6 py-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{record.patientName || 'Без имени'}</h1>

          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Основная информация</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium">{record.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Возраст:</span>
                  <span className="font-medium">{record.age} лет</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Пол:</span>
                  <span className="font-medium">{record.gender === 'male' ? 'Мужской' : 'Женский'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Протокол:</span>
                  <span className="font-medium">{record.protocolType || 'Не указан'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Жалоба:</span>
                  <span className="font-medium text-right max-w-xs">{record.chiefComplaint || 'Не указана'}</span>
                </div>
              </div>
            </div>

            {record.notes && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Заметки</h3>
                <p className="text-gray-700">{record.notes}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Медиа</h3>
              <div className="flex gap-4">
                <div className="bg-white border rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold text-blue-600">{audioCount}</span>
                  <span className="text-gray-600 ml-2">аудио</span>
                </div>
                <div className="bg-white border rounded-lg px-4 py-2">
                  <span className="text-2xl font-bold text-green-600">{photoCount}</span>
                  <span className="text-gray-600 ml-2">фото</span>
                </div>
              </div>
            </div>

            {record.audioRecordings && record.audioRecordings.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Аудиозаписи</h3>
                <div className="space-y-3">
                  {record.audioRecordings.map((rec) => (
                    <div key={rec.id} className="bg-white border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{rec.label}</span>
                        <span className="text-sm text-gray-500">{rec.duration?.toFixed(1)} сек.</span>
                      </div>
                      {rec.url && (
                        <button
                          onClick={() => handlePlayAudio(rec.url, rec.id)}
                          className={`flex items-center gap-2 text-sm ${
                            playingId === rec.id
                              ? 'text-red-600 hover:text-red-800'
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                        >
                          {playingId === rec.id ? (
                            <>
                              <Pause className="w-4 h-4" /> Остановить
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" /> Прослушать
                            </>
                          )}
                        </button>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        Статус: <span className={rec.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}>
                          {rec.status === 'completed' ? 'Завершено' : 'В процессе'}
                        </span>
                      </div>
                      {rec.url?.includes('yandex.net') && (
                        <div className="text-xs text-green-600 mt-1">
                          <Cloud className="w-3 h-3 inline mr-1" />
                          В облаке Яндекс.Диск
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {record.photos && record.photos.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Фотографии</h3>
                <div className="grid grid-cols-3 gap-3">
                  {record.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo.url}
                      alt={`Фото ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Cloud({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  );
}
