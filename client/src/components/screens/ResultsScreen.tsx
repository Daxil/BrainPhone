import { Brain, Cloud } from 'lucide-react';
import Header from '../layout/Header';
import type { PatientRecord } from '../../types';

interface ResultsScreenProps {
  currentRecord: PatientRecord | null;
  onBack: () => void;
  onSave: () => void;
  onView: () => void;
}

export default function ResultsScreen({ currentRecord, onBack, onSave, onView }: ResultsScreenProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="results" onBack={onBack} patientId={currentRecord?.id} showMenu={false} />

      <main className="flex-1 px-6 py-8 flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Результаты анализа</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {currentRecord?.diseases?.slice(0, 6).map((disease, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                  <div className="flex items-center justify-center h-full">
                    <Brain className="w-10 h-10 text-gray-500" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-sm font-medium px-2 py-1">
                    {disease.name}
                  </div>
                  <div className="absolute top-0 left-0 right-0 bg-blue-50 text-blue-900 text-sm font-semibold px-2 py-1">
                    {disease.percentage}%
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 space-y-2">
              {currentRecord?.diseases?.map((disease, index) => (
                <div key={index} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-medium">{disease.name}:</span>
                  <span className="text-blue-600 font-semibold">{disease.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-8"></div>

          <div className="space-y-3">
            <button
              onClick={onSave}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-4 font-medium transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
            >
              <Cloud className="w-5 h-5" />
              <span>Сохранить запись</span>
            </button>
            <button
              onClick={onView}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-medium transition-colors shadow-lg shadow-blue-600/20"
            >
              Просмотреть без сохранения
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
