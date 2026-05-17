// E12: Мои кейсы — фильтры, статусы, без доступа к аудио
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import type { PatientRecord } from '../../types';

type FilterKey = 'all' | 'ACCEPTED' | 'REJECTED' | 'REVIEW';

interface MyCasesScreenProps {
  records: PatientRecord[];
  onBack: () => void;
  onViewCase: (record: PatientRecord) => void;
}

function statusBadge(status?: string) {
  switch (status) {
    case 'ACCEPTED': return { icon: <CheckCircle2 className="w-4 h-4" />, label: STRINGS.CASE_STATUS_ACCEPTED, cls: 'text-green-600 bg-green-50' };
    case 'REJECTED': return { icon: <XCircle      className="w-4 h-4" />, label: STRINGS.CASE_STATUS_REJECTED,  cls: 'text-red-600 bg-red-50' };
    case 'REVIEW':   return { icon: <Clock        className="w-4 h-4" />, label: STRINGS.CASE_STATUS_REVIEW,    cls: 'text-amber-600 bg-amber-50' };
    case 'SUBMITTED':return { icon: <FileText     className="w-4 h-4" />, label: STRINGS.CASE_STATUS_SUBMITTED, cls: 'text-blue-600 bg-blue-50' };
    default:         return { icon: <FileText     className="w-4 h-4" />, label: STRINGS.CASE_STATUS_DRAFT,     cls: 'text-gray-500 bg-gray-100' };
  }
}

function protLabel(p?: string) {
  if (p === 'phonemes') return 'Фонемы';
  if (p === 'speech')   return 'Речь';
  if (p === 'full')     return 'Полный';
  return p || '—';
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: STRINGS.CASES_FILTER_ALL },
  { key: 'ACCEPTED', label: STRINGS.CASES_FILTER_ACCEPTED },
  { key: 'REJECTED', label: STRINGS.CASES_FILTER_REJECTED },
  { key: 'REVIEW',   label: STRINGS.CASES_FILTER_REVIEW },
];

export default function MyCasesScreen({ records, onBack, onViewCase }: MyCasesScreenProps) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = [...records]
    .reverse()
    .filter(r => filter === 'all' || r.caseStatus === filter);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Мои кейсы</h1>
      </div>

      {/* Фильтры */}
      <div className="px-4 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">{STRINGS.CASES_EMPTY}</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(rec => {
              const badge = statusBadge(rec.caseStatus);
              const rejCode = rec.rejectionCode;
              return (
                <button
                  key={rec.id}
                  onClick={() => onViewCase(rec)}
                  className="w-full bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors text-left flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {rec.caseNumber && <span className="text-xs font-mono text-gray-400">{rec.caseNumber}</span>}
                      <span className="text-sm font-medium text-gray-800">{protLabel(rec.protocolType)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('ru-RU') : '—'}
                      {rec.age ? ` · ${rec.age} лет` : ''}
                    </div>
                    {rejCode && (
                      <div className="text-xs text-red-500 mt-0.5">
                        {STRINGS.CASE_REJECTION_PREFIX}{STRINGS.REJECTION_CODES[rejCode] ?? rejCode}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${badge.cls}`}>
                    {badge.icon}<span>{badge.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
