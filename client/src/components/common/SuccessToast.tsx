import { CheckCircle, X } from 'lucide-react';
import PatientCard from './PatientCard';
import type { PatientRecord } from '../../types';

interface SuccessToastProps {
  show: boolean;
  onClose: () => void;
  record?: PatientRecord; // Сделаем опциональным
}

export default function SuccessToast({ show, onClose, record }: SuccessToastProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-slide-down">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Успех!</h2>
          <p className="text-gray-600 mb-6">Данные успешно сохранены</p>

          {record && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <PatientCard record={record} onClick={onClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
