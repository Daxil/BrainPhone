// E13: Баланс — счётчик, сумма к выплате, история
import { ChevronLeft, Wallet, TrendingUp, Clock } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import type { PatientRecord } from '../../types';

interface BalanceScreenProps {
  records: PatientRecord[];
  onBack: () => void;
}

export default function BalanceScreen({ records, onBack }: BalanceScreenProps) {
  const accepted = records.filter(r => r.caseStatus === 'ACCEPTED');
  // Условная оплата: реальные ставки должны приходить с сервера
  const RATE_PER_CASE = 500;
  const totalDue = accepted.length * RATE_PER_CASE;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">{STRINGS.BALANCE_TITLE}</h1>
      </div>

      <main className="flex-1 px-5 py-6 space-y-5">
        {/* Сводка */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <TrendingUp className="w-8 h-8 text-blue-500 mb-3" />
            <div className="text-3xl font-bold text-blue-700">{accepted.length}</div>
            <div className="text-sm text-blue-500 mt-1">{STRINGS.BALANCE_PAID_CASES}</div>
          </div>
          <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
            <Wallet className="w-8 h-8 text-green-500 mb-3" />
            <div className="text-3xl font-bold text-green-700">{totalDue.toLocaleString('ru-RU')}{STRINGS.BALANCE_CURRENCY}</div>
            <div className="text-sm text-green-500 mt-1">{STRINGS.BALANCE_AMOUNT_DUE}</div>
          </div>
        </div>

        {/* История */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{STRINGS.BALANCE_HISTORY}</h2>
          {accepted.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">{STRINGS.BALANCE_EMPTY}</div>
          ) : (
            <div className="space-y-2">
              {[...accepted].reverse().map(r => (
                <div key={r.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {r.caseNumber || r.id.slice(-6)} · {r.protocolType === 'phonemes' ? 'Фонемы' : r.protocolType === 'speech' ? 'Речь' : 'Полный'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('ru-RU') : '—'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    +{RATE_PER_CASE}{STRINGS.BALANCE_CURRENCY}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
