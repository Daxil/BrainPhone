import { ArrowLeft } from 'lucide-react';
import Header from '../layout/Header';
import MDSUPDRSForm from '../forms/MDSUPDRSForm';
import type { MDSUPDRSForm as MDSUPDRSType } from '../../types/forms';

interface MDSUPDRSScreenProps {
  onSubmit: (data: MDSUPDRSType) => void;
  onBack: () => void;
  patientName?: string;
}

export default function MDSUPDRSScreen({ onSubmit, onBack, patientName }: MDSUPDRSScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
          <h1 className="font-semibold text-gray-900">MDS-UPDRS Анкета</h1>
          <div className="w-5"></div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <MDSUPDRSForm
            onSubmit={onSubmit}
            examinerName={patientName || 'Не указан'}
          />
        </div>
      </main>
    </div>
  );
}
