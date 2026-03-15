import { ChevronRight } from 'lucide-react';
import type { PatientRecord } from '../../types';

interface PatientCardProps {
  record: PatientRecord | undefined;
  onClick: () => void;
}

export default function PatientCard({ record, onClick }: PatientCardProps) {
  if (!record) {
    return null;
  }

  const audioCount = record.audioRecordings?.length || 0;

  return (
    <button
      onClick={onClick}
      className="w-full border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
    >
      <div className="flex-1">
        <div className="font-semibold text-gray-900">{record.patientName || 'Без имени'}</div>
        <div className="text-sm text-gray-500">{record.age} лет, {record.gender === 'male' ? 'М' : 'Ж'}</div>
        <div className="text-xs text-gray-400 mt-1">{record.id}</div>
        {audioCount > 0 && (
          <div className="text-xs text-blue-600 mt-1">{audioCount} аудио записей</div>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}
