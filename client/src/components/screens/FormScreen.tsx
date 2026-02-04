import { ArrowLeft, Save, AlertCircle, FileText, Brain } from 'lucide-react';
import Header from '../layout/Header';
import SuccessToast from '../common/SuccessToast';
import type { PatientRecord, SyncStatus } from '../../types';

interface FormScreenProps {
  currentRecord: PatientRecord | null;
  validationErrors: string[];
  syncStatus: SyncStatus;
  showSuccessToast: boolean;
  onSave: () => void;
  onBack: () => void;
  onFieldChange: (field: string, value: string) => void;
  onVitalsChange: (field: string, value: string) => void;
  onOpenMDSUPDRS: () => void;
  onOpenMoCA: () => void;
  onCloseToast: () => void;
}

export default function FormScreen({
  currentRecord,
  validationErrors,
  syncStatus,
  showSuccessToast,
  onSave,
  onBack,
  onFieldChange,
  onVitalsChange,
  onOpenMDSUPDRS,
  onOpenMoCA,
  onCloseToast,
}: FormScreenProps) {
  if (!currentRecord) return null;

  const isSyncing = syncStatus === 'syncing';
  const hasError = syncStatus === 'error';

  const getErrorMessage = (field: string): string => {
    if (!validationErrors.includes(field)) return '';

    switch (field) {
      case 'patientName':
        return 'Введите ФИО пациента';
      case 'age':
        return 'Введите возраст';
      case 'gender':
        return 'Выберите пол';
      case 'chiefComplaint':
        return 'Введите основную жалобу';
      default:
        return 'Обязательное поле';
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header screen="form" onBack={onBack} title="Форма пациента" />

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ФИО пациента *
              </label>
              <input
                type="text"
                value={currentRecord.patientName}
                onChange={(e) => onFieldChange('patientName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.includes('patientName') ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Иванов Иван Иванович"
              />
              {getErrorMessage('patientName') && (
                <p className="mt-1 text-sm text-red-600">{getErrorMessage('patientName')}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Возраст *
                </label>
                <input
                  type="text"
                  value={currentRecord.age}
                  onChange={(e) => onFieldChange('age', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.includes('age') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="45"
                />
                {getErrorMessage('age') && (
                  <p className="mt-1 text-sm text-red-600">{getErrorMessage('age')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Пол *
                </label>
                <select
                  value={currentRecord.gender}
                  onChange={(e) => onFieldChange('gender', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.includes('gender') ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Выберите пол</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Другое</option>
                </select>
                {getErrorMessage('gender') && (
                  <p className="mt-1 text-sm text-red-600">{getErrorMessage('gender')}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Основная жалоба *
              </label>
              <textarea
                value={currentRecord.chiefComplaint}
                onChange={(e) => onFieldChange('chiefComplaint', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.includes('chiefComplaint') ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Опишите основную жалобу пациента"
              />
              {getErrorMessage('chiefComplaint') && (
                <p className="mt-1 text-sm text-red-600">{getErrorMessage('chiefComplaint')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Дополнительные заметки
              </label>
              <textarea
                value={currentRecord.notes}
                onChange={(e) => onFieldChange('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Дополнительная информация о пациенте"
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Жизненные показатели</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Артериальное давление
                  </label>
                  <input
                    type="text"
                    value={currentRecord.vitals.bloodPressure}
                    onChange={(e) => onVitalsChange('bloodPressure', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="120/80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пульс
                  </label>
                  <input
                    type="text"
                    value={currentRecord.vitals.heartRate}
                    onChange={(e) => onVitalsChange('heartRate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="72"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Температура
                  </label>
                  <input
                    type="text"
                    value={currentRecord.vitals.temperature}
                    onChange={(e) => onVitalsChange('temperature', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="36.6"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Анкеты</h3>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onOpenMDSUPDRS}
                  className="w-full bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 rounded-lg p-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {currentRecord.mdsUpdrs ? 'MDS-UPDRS (заполнено)' : 'Заполнить анкету MDS-UPDRS'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {currentRecord.mdsUpdrs ? `Балл: ${currentRecord.mdsUpdrs.totalScore}/260` : 'Оценка болезни Паркинсона'}
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={onOpenMoCA}
                  className="w-full bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center justify-between hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 rounded-lg p-2">
                      <Brain className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {currentRecord.moca ? 'MoCA (заполнено)' : 'Заполнить анкету MoCA'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {currentRecord.moca ? `Балл: ${currentRecord.moca.finalScore}/30` : 'Когнитивная оценка'}
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {hasError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>Ошибка при сохранении. Проверьте подключение к серверу.</span>
            </div>
          )}

          <button
            onClick={onSave}
            disabled={isSyncing}
            className={`w-full ${
              isSyncing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-xl py-4 font-medium transition-colors flex items-center justify-center gap-2`}
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Сохранение...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Сохранить и синхронизировать</span>
              </>
            )}
          </button>
        </div>
      </div>

      <SuccessToast
        show={showSuccessToast}
        onClose={onCloseToast}
        record={currentRecord} 
      />
    </div>
  );
}
