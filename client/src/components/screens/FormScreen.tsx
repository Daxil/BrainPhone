import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PatientRecord } from '../../types';

interface FormScreenProps {
  record: PatientRecord | null;
  onBack: () => void;
  onChange: (record: PatientRecord) => void;
  onContinue: () => void;
}

export default function FormScreen({ record, onBack, onChange, onContinue }: FormScreenProps) {
  if (!record) return null;

  const handleChange = (field: keyof PatientRecord, value: string) => {
    onChange({ ...record, [field]: value });
  };

  const handleVitalsChange = (field: keyof typeof record.vitals, value: string) => {
    onChange({
      ...record,
      vitals: { ...record.vitals, [field]: value },
    });
  };

  const isFormValid = () => {
    return record.patientName.trim() && record.age.trim() && record.gender && record.chiefComplaint.trim();
  };

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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Данные пациента</h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ФИО пациента *</label>
              <input
                type="text"
                value={record.patientName}
                onChange={(e) => handleChange('patientName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Возраст *</label>
                <input
                  type="text"
                  value={record.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="65"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Пол *</label>
                <select
                  value={record.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Основная жалоба *</label>
              <textarea
                value={record.chiefComplaint}
                onChange={(e) => handleChange('chiefComplaint', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Опишите основную жалобу пациента"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Заметки</label>
              <textarea
                value={record.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Дополнительные заметки"
              />
            </div>
          </div>
        </div>
      </main>

      <div className="border-t border-gray-200 px-6 py-4">
        <button
          onClick={onContinue}
          disabled={!isFormValid()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <span>Продолжить</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
