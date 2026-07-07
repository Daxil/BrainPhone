// E3: Главный экран — новый кейс, статистика, список кейсов
import { useEffect, useState } from 'react';
import { Mic, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, HeadphonesIcon } from 'lucide-react';
import type { PatientRecord } from '../../types';
import { STRINGS } from '../../constants/ui';
import { api } from '../../services/api';

interface TodayStats { accepted: number; rejected: number; review: number }

interface HomeScreenProps {
  records: PatientRecord[];
  loading: boolean;
  onViewRecord: (record: PatientRecord) => void;
  onCreateNew: () => void;
  onOpenSupport?: () => void;
  onOpenMyCases?: () => void;
}

function statusLabel(status?: string): { text: string; color: string } {
  switch (status) {
    case 'ACCEPTED':        return { text: STRINGS.CASE_STATUS_ACCEPTED, color: 'text-green-600 bg-green-50' };
    case 'REJECTED':        return { text: STRINGS.CASE_STATUS_REJECTED,  color: 'text-red-600 bg-red-50' };
    case 'REVIEW':          return { text: STRINGS.CASE_STATUS_REVIEW,    color: 'text-amber-600 bg-amber-50' };
    case 'SUBMITTED':       return { text: STRINGS.CASE_STATUS_SUBMITTED, color: 'text-blue-600 bg-blue-50' };
    case 'SUBMITTING':      return { text: 'Отправка...', color: 'text-blue-400 bg-blue-50' };
    case 'READY_TO_SUBMIT': return { text: 'Готов к отправке', color: 'text-indigo-600 bg-indigo-50' };
    case 'RECORDING':       return { text: 'Запись', color: 'text-purple-600 bg-purple-50' };
    case 'CONSENT_PENDING': return { text: 'Ожидает согласия', color: 'text-orange-600 bg-orange-50' };
    case 'QUEUED':          return { text: STRINGS.CASE_STATUS_QUEUED, color: 'text-slate-600 bg-slate-100' };
    default:                return { text: STRINGS.CASE_STATUS_DRAFT, color: 'text-gray-500 bg-gray-100' };
  }
}

function protocolLabel(p?: string) {
  if (p === 'phonemes') return 'Фонемы';
  if (p === 'speech')   return 'Речь';
  if (p === 'full')     return 'Полный';
  return p || '—';
}

export default function HomeScreen({
  records,
  loading,
  onViewRecord,
  onCreateNew,
  onOpenSupport,
  onOpenMyCases,
}: HomeScreenProps) {
  const [todayStats, setTodayStats] = useState<TodayStats>({ accepted: 0, rejected: 0, review: 0 });

  useEffect(() => {
    api.getTodayStats().then(r => {
      if (r.success && r.data?.data?.stats) setTodayStats(r.data.data.stats);
    });
  }, []);

  // Новые сверху, старые снизу.
  const recent = [...(records || [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{STRINGS.APP_NAME}</h1>
          <p className="text-xs text-gray-400">{STRINGS.APP_SUBTITLE}</p>
        </div>
        <div className="flex gap-2">
          {onOpenSupport && (
            <button onClick={onOpenSupport} className="p-2 rounded-lg hover:bg-gray-100" title={STRINGS.SUPPORT_TITLE}>
              <HeadphonesIcon className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full space-y-5">

        {/* Статистика «Сегодня» */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{STRINGS.HOME_TODAY_HEADER}</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-600">{todayStats.accepted}</div>
              <div className="text-xs text-gray-500 mt-0.5">{STRINGS.HOME_STAT_ACCEPTED}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
              <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-red-500">{todayStats.rejected}</div>
              <div className="text-xs text-gray-500 mt-0.5">{STRINGS.HOME_STAT_REJECTED}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-amber-500">{todayStats.review}</div>
              <div className="text-xs text-gray-500 mt-0.5">{STRINGS.HOME_STAT_REVIEW}</div>
            </div>
          </div>
        </section>

        {/* Кнопка «Новый кейс» */}
        <button
          onClick={onCreateNew}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl p-5 flex items-center justify-between transition-colors shadow-lg shadow-blue-600/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-500 rounded-xl p-3">
              <Mic className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-base">{STRINGS.HOME_NEW_CASE}</div>
              <div className="text-blue-200 text-xs mt-0.5">{STRINGS.HOME_NEW_CASE_SUBTITLE}</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-70" />
        </button>

        {/* Список последних кейсов */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{STRINGS.HOME_RECENT_CASES}</h2>
            {onOpenMyCases && (
              <button onClick={onOpenMyCases} className="text-xs text-blue-600 hover:underline">
                {STRINGS.CASES_FILTER_ALL} →
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-gray-400">{STRINGS.HOME_LOADING}</p>
            </div>
          ) : recent.length > 0 ? (
            <div className="space-y-2">
              {recent.map((rec) => {
                const sl = statusLabel(rec.caseStatus);
                return (
                  <button
                    key={rec.id}
                    onClick={() => onViewRecord(rec)}
                    className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:border-blue-300 transition-colors text-left flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {rec.caseNumber && (
                          <span className="text-xs font-mono font-bold text-gray-400">{rec.caseNumber}</span>
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {protocolLabel(rec.protocolType)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('ru-RU') : '—'}
                        {rec.age ? ` · ${rec.age} лет` : ''}
                        {rec.gender === 'male' ? ' · М' : rec.gender === 'female' ? ' · Ж' : ''}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${sl.color}`}>
                      {sl.text}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-gray-400 text-sm mb-3">{STRINGS.HOME_NO_CASES}</div>
              <button onClick={onCreateNew} className="text-blue-600 text-sm hover:underline font-medium">
                {STRINGS.HOME_CREATE_FIRST}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
