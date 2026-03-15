import { CheckCircle, ChevronLeft } from 'lucide-react';
import type { PatientRecord } from '../../types';
import type { AudioRecording } from '../../types/forms';

interface ResultsScreenProps {
  record: PatientRecord | null;
  audioRecordings: AudioRecording[];
  onBack: () => void;
  onContinue: () => void;
}

export default function ResultsScreen({ record, audioRecordings, onBack, onContinue }: ResultsScreenProps) {
  const completedCount = audioRecordings.filter(r => r.status === 'completed').length;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
        </div>
      </div>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Запись завершена!</h1>
          <p className="text-gray-600 mb-8">
            Успешно записано {completedCount} из {audioRecordings.length} аудио
          </p>

          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Информация о пациенте</h3>
            <div className="space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-gray-600">Имя:</span>
                <span className="font-medium">{record?.patientName || 'Не указано'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ID:</span>
                <span className="font-medium">{record?.id || 'Не указано'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Протокол:</span>
                <span className="font-medium">{record?.protocolType || 'Не указано'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-medium transition-colors"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
