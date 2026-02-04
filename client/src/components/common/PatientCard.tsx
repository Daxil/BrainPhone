import { Cloud, Check, ChevronRight } from 'lucide-react';
import type { PatientRecord } from '../../types';

interface PatientCardProps {
  record: PatientRecord | undefined;
  onClick: () => void;
}

export default function PatientCard({ record, onClick }: PatientCardProps) {
  if (!record) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="w-full border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-gray-900">{record.id}</div>
          <div className="text-sm text-gray-600 mt-1">{record.patientName || 'Без имени'}</div>
          {(record.mdsUpdrs || record.moca) && (
            <div className="text-xs text-gray-500 mt-1">
              {record.mdsUpdrs && `MDS-UPDRS: ${record.mdsUpdrs.totalScore}/260`}
              {record.moca && ` MoCA: ${record.moca.finalScore}/30`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <Cloud className="w-4 h-4" />
          <Check className="w-4 h-4" />
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </button>
  );
}
