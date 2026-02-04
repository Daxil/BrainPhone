import { Camera, Mic, Play, Brain, Cloud, Check } from 'lucide-react';
import Header from '../layout/Header';
import type { PatientRecord } from '../../types';

interface ViewScreenProps {
  viewingRecord: PatientRecord | null;
  onBack: () => void;
  onPlayAudio: () => void;
  formatTime: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
}

export default function ViewScreen({ viewingRecord, onBack, onPlayAudio, formatTime, formatFileSize }: ViewScreenProps) {
  if (!viewingRecord) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="view" onBack={onBack} patientId={viewingRecord.id} showMenu={false} />

      <main className="flex-1 px-6 py-8 flex flex-col overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Фотографии пациента</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {viewingRecord.photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                  <img src={photo.url} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-8"></div>

          <div className="pb-8">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Аудиозаметки (48 кГц, 16 бит)</h2>
            </div>

            {viewingRecord.audioUrl && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onPlayAudio}
                      className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="font-medium text-gray-900">Запись завершена</div>
                      <div className="text-sm text-gray-600">{viewingRecord.audioDuration ? formatTime(viewingRecord.audioDuration) : 'N/A'}</div>
                      <div className="text-xs text-gray-500">{viewingRecord.audioSize ? formatFileSize(viewingRecord.audioSize) : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <section className="mb-8">
            <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Информация о пациенте
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={viewingRecord.patientName}
                  className="w-full px-4 py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Возраст <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={viewingRecord.age}
                    className="w-full px-4 py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пол <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={viewingRecord.gender === 'male' ? 'Мужской' : viewingRecord.gender === 'female' ? 'Женский' : 'Другое'}
                    className="w-full px-4 py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Жизненные показатели
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артериальное давление
                </label>
                <input
                  type="text"
                  value={viewingRecord.vitals.bloodPressure}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Пульс
                </label>
                <input
                  type="text"
                  value={viewingRecord.vitals.heartRate}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Температура
                </label>
                <input
                  type="text"
                  value={viewingRecord.vitals.temperature}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Клиническая информация
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Основная жалоба <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={viewingRecord.chiefComplaint}
                  className="w-full px-4 py-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 resize-none focus:ring-blue-500"
                  readOnly
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дополнительные заметки
                </label>
                <textarea
                  value={viewingRecord.notes}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  readOnly
                  rows={3}
                />
              </div>
            </div>
          </section>

          {viewingRecord.mdsUpdrs && (
            <section className="mb-8">
              <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                MDS-UPDRS Анкета
              </h2>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">Общий балл:</span>
                  <span className="text-blue-700 font-semibold text-lg">
                    {viewingRecord.mdsUpdrs.totalScore} / 260
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Дата: {viewingRecord.mdsUpdrs.date} | Эксперт: {viewingRecord.mdsUpdrs.examiner}
                </div>
              </div>
            </section>
          )}

          {viewingRecord.moca && (
            <section className="mb-8">
              <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                MoCA Анкета
              </h2>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">Общий балл:</span>
                  <span className="text-green-700 font-semibold text-lg">
                    {viewingRecord.moca.finalScore} / 30
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Дата: {viewingRecord.moca.date} | Эксперт: {viewingRecord.moca.examiner}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {viewingRecord.moca.finalScore < 26 ? 'Возможные когнитивные нарушения' : 'В пределах нормы'}
                </div>
              </div>
            </section>
          )}

          {viewingRecord.diseases && viewingRecord.diseases.length > 0 && (
            <section>
              <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Анализ заболеваний
              </h2>
              <div className="space-y-3">
                {viewingRecord.diseases.map((disease, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{disease.name}</div>
                      <div className={`text-sm font-semibold ${
                        disease.percentage > 50 ? 'text-red-600' :
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
