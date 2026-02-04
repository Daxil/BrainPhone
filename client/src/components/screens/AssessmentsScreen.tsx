import { ArrowLeft, ClipboardList, Brain, ChevronRight } from 'lucide-react';
import Header from '../layout/Header';
import PatientCard from '../common/PatientCard';
import type { PatientRecord } from '../../types';

interface AssessmentsScreenProps {
  records: PatientRecord[];
  onBack: () => void;
  onCreateMDSUPDRS: () => void;
  onCreateMoCA: () => void;
  onViewRecord: (record: PatientRecord) => void;
}

export default function AssessmentsScreen({ records, onBack, onCreateMDSUPDRS, onCreateMoCA, onViewRecord }: AssessmentsScreenProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
          <h1 className="font-semibold text-gray-900">Анкеты пациентов</h1>
          <div className="w-5"></div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={onCreateMDSUPDRS}
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:bg-blue-100 transition-colors"
            >
              <ClipboardList className="w-12 h-12 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold text-gray-900">MDS-UPDRS</div>
                <div className="text-sm text-gray-600 mt-1">Оценка болезни Паркинсона</div>
              </div>
            </button>

            <button
              onClick={onCreateMoCA}
              className="bg-green-50 border-2 border-green-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:bg-green-100 transition-colors"
            >
              <Brain className="w-12 h-12 text-green-600" />
              <div className="text-center">
                <div className="font-semibold text-gray-900">MoCA</div>
                <div className="text-sm text-gray-600 mt-1">Когнитивная оценка</div>
              </div>
            </button>
          </div>

          {records.filter(r => r !== undefined && (r.mdsUpdrs || r.moca)).length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">Заполненные анкеты</h2>
              <div className="space-y-3">
                {records
                  .filter(r => r !== undefined && (r.mdsUpdrs || r.moca))
                  .slice(-10)
                  .reverse()
                  .map((record, index) => (
                    <PatientCard key={index} record={record} onClick={() => onViewRecord(record)} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
