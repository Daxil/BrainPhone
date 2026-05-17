// E10: Проверка готовности и отправка кейса
import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, WifiOff } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import type { CaseTask, ConsentData } from '../../types/case';

interface ReadyToSubmitScreenProps {
  tasks: CaseTask[];
  consent: ConsentData | null;
  hasRequiredFields: boolean;
  hasAttachments: boolean;
  isOffline: boolean;
  onSubmit: () => Promise<void>;
  onBack: () => void;
}

interface CheckItem { label: string; ok: boolean }

export default function ReadyToSubmitScreen({
  tasks, consent, hasRequiredFields, hasAttachments, isOffline, onSubmit, onBack,
}: ReadyToSubmitScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  const requiredDone = tasks
    .filter(t => t.required)
    .every(t => t.status === 'RECORDED_LOCAL' || t.status === 'UPLOADED' || t.status === 'PASSED_SERVER_QC' || t.status === 'SKIPPED');

  const qcOk = tasks
    .filter(t => t.status === 'RECORDED_LOCAL' || t.status === 'UPLOADED')
    .every(t => !t.qcResult || t.qcResult.passed || t.qcResult.canKeep);

  const checks: CheckItem[] = [
    { label: STRINGS.SUBMIT_CHECK_CONSENT,     ok: !!consent },
    { label: STRINGS.SUBMIT_CHECK_FIELDS,      ok: hasRequiredFields },
    { label: STRINGS.SUBMIT_CHECK_ATTACHMENTS, ok: hasAttachments },
    { label: STRINGS.SUBMIT_CHECK_AUDIO,       ok: requiredDone },
    { label: STRINGS.SUBMIT_CHECK_QC,          ok: qcOk },
  ];

  const allOk = checks.every(c => c.ok);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await onSubmit();
      setSubmitted(true);
    } catch {
      setError(STRINGS.SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && isOffline) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <WifiOff className="w-16 h-16 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Сохранено в очередь</h2>
        <p className="text-gray-500 text-sm">{STRINGS.SUBMIT_OFFLINE_MSG}</p>
        <button onClick={onBack} className="mt-8 text-blue-600 hover:underline text-sm">{STRINGS.BACK}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Заголовок */}
      <div className="border-b border-gray-100 px-5 py-4">
        <button onClick={onBack} className="text-gray-500 text-sm hover:underline mb-1">{STRINGS.BACK}</button>
        <h1 className="text-xl font-bold text-gray-900">{STRINGS.SUBMIT_TITLE}</h1>
        <p className="text-sm text-gray-500 mt-1">{STRINGS.SUBMIT_CHECKLIST_HEADER}</p>
      </div>

      <main className="flex-1 px-5 py-6 pb-32 space-y-3">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 p-4 rounded-xl border ${c.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {c.ok
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <XCircle      className="w-5 h-5 text-red-400  flex-shrink-0" />}
            <span className={`text-sm font-medium ${c.ok ? 'text-green-700' : 'text-red-700'}`}>{c.label}</span>
          </div>
        ))}

        {isOffline && (
          <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <WifiOff className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{STRINGS.SUBMIT_OFFLINE_MSG}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        <button
          onClick={handleSubmit}
          disabled={!allOk || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-5 h-5 animate-spin" /> {STRINGS.SUBMIT_IN_PROGRESS}</>
            : STRINGS.SUBMIT_BTN}
        </button>
      </div>
    </div>
  );
}
