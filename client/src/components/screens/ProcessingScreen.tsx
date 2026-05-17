import { Loader2 } from 'lucide-react';
import type { PatientRecord } from '../../types';

interface ProcessingScreenProps {
  currentRecord: PatientRecord | null;
  onBack: () => void;
  onContinue: () => void;
}

export default function ProcessingScreen({ currentRecord, onBack, onContinue }: ProcessingScreenProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
    <div className="border-b border-gray-200">
    <div className="px-6 py-4">
    <button
    onClick={onBack}
    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
    >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    <span>Назад</span>
    </button>
    </div>
    </div>

    <main className="flex-1 px-6 py-8 flex flex-col items-center justify-center">
    <div className="max-w-md mx-auto text-center">
    <div className="mb-8">
    <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Обработка данных</h2>
    <p className="text-gray-600">Пожалуйста, подождите...</p>
    </div>

    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
    </div>

    <p className="text-sm text-gray-500">Сохранение аудиозаписей и синхронизация...</p>
    </div>
    </main>
    </div>
  );
}
