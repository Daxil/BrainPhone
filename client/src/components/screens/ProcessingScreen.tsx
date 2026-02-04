import { Activity, Brain, Eye, Mic } from 'lucide-react';
import Header from '../layout/Header';
import type { PatientRecord } from '../../types';

interface ProcessingScreenProps {
  currentRecord: PatientRecord | null;
  processingStep: number;
  onBack: () => void;
  onContinue: () => void;
}

export default function ProcessingScreen({ currentRecord, processingStep, onBack, onContinue }: ProcessingScreenProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="processing" onBack={onBack} patientId={currentRecord?.id} showMenu={false} />

      <main className="flex-1 px-6 py-8 flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Обработка данных</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="flex items-center justify-center h-full">
                  <Brain className="w-10 h-10 text-gray-500" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-sm font-medium px-2 py-1">
                  Анализ мозга
                </div>
              </div>
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="flex items-center justify-center h-full">
                  <Eye className="w-10 h-10 text-gray-500" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-sm font-medium px-2 py-1">
                  Анализ глаз
                </div>
              </div>
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="flex items-center justify-center h-full">
                  <Mic className="w-10 h-10 text-gray-500" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gray-50 text-gray-900 text-sm font-medium px-2 py-1">
                  Анализ голоса
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${(processingStep / 2) * 100}%` }}
              ></div>
            </div>

            <div className="text-sm text-gray-500">
              {processingStep === 0 && 'Анализ мозга'}
              {processingStep === 1 && 'Анализ глаз'}
              {processingStep === 2 && 'Анализ голоса'}
            </div>
          </div>

          <div className="flex-1 min-h-8"></div>

          <button
            onClick={onContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-medium transition-colors shadow-lg shadow-blue-600/20"
          >
            {processingStep < 2 ? 'Продолжить' : 'Показать результаты'}
          </button>
        </div>
      </main>
    </div>
  );
}
