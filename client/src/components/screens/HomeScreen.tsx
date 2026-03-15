import { Mic, ChevronRight, Loader2 } from 'lucide-react';
import Header from '../layout/Header';
import StatsCard from '../common/StatsCard';
import PatientCard from '../common/PatientCard';
import type { PatientRecord } from '../../types';

interface HomeScreenProps {
  records: PatientRecord[] | undefined;
  loading: boolean;
  onViewRecord: (record: PatientRecord) => void;
  onCreateNew: () => void;
  onOpenAssessments: () => void;
}

export default function HomeScreen({
  records,
  loading,
  onViewRecord,
  onCreateNew,
  onOpenAssessments
}: HomeScreenProps) {
  const recordsArray = records || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="home" />

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatsCard type="records" value={recordsArray.length} label="Всего записей" />
            <StatsCard type="synced" value="Синхронизировано" label="Облачное резервирование" sublabel="Активно" />
            <StatsCard type="secure" value="Безопасно" label="Сквозное шифрование" sublabel="Включено" />
          </div>

          <button
            onClick={onCreateNew}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-6 flex items-center justify-between transition-colors shadow-lg shadow-blue-600/20 mb-4"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 rounded-full p-3">
                <Mic className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Создать новую карту пациента</div>
                <div className="text-blue-100 text-sm mt-1">Запись аудио, добавление фото и сбор данных</div>
              </div>
            </div>
            <ChevronRight className="w-6 h-6" />
          </button>

          <button
            onClick={onOpenAssessments}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl p-6 flex items-center justify-between transition-colors shadow-lg shadow-purple-600/20 mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="bg-purple-500 rounded-full p-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-semibold">Просмотр анкет</div>
                <div className="text-purple-100 text-sm mt-1">MDS-UPDRS, MoCA и другие</div>
              </div>
            </div>
            <ChevronRight className="w-6 h-6" />
          </button>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Загрузка записей...</p>
            </div>
          ) : recordsArray.length > 0 ? (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">Последние записи ({recordsArray.length})</h2>
              <div className="space-y-3">
                {recordsArray
                  .filter((record): record is PatientRecord => record !== undefined && record !== null && !!record.id)
                  .slice(-5)
                  .reverse()
                  .map((record, index) => (
                    <PatientCard
                      key={record.id || `record-${index}`}
                      record={record}
                      onClick={() => onViewRecord(record)}
                    />
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-4xl mb-4">📋</div>
              <div className="text-gray-600 mb-4">Нет записей</div>
              <button
                onClick={onCreateNew}
                className="text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Создать первую запись
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
