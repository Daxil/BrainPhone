// E7: Список заданий — статусы, «Записать», «Пропустить» с причиной
import { useState } from 'react';
import { ChevronLeft, CheckCircle2, XCircle, AlertCircle, Mic, SkipForward, Clock } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import type { CaseTask } from '../../types/case';

interface TaskListScreenProps {
  tasks: CaseTask[];
  protocol: string;
  caseNumber?: string;
  onBack: () => void;
  onRecordTask: (taskId: string) => void;
  onSkipTask: (taskId: string, reason: string) => void;
  onProceedToSubmit: () => void;
}

function taskStatusIcon(status: string) {
  switch (status) {
    case 'RECORDED_LOCAL':    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'UPLOADED':          return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case 'PASSED_SERVER_QC':  return <CheckCircle2 className="w-5 h-5 text-green-700" />;
    case 'FAILED_LOCAL_QC':   return <AlertCircle  className="w-5 h-5 text-red-500" />;
    case 'FAILED_SERVER_QC':  return <XCircle      className="w-5 h-5 text-red-600" />;
    case 'SKIPPED':           return <SkipForward  className="w-5 h-5 text-gray-400" />;
    default:                  return <Clock        className="w-5 h-5 text-gray-300" />;
  }
}

function taskStatusText(status: string): string {
  switch (status) {
    case 'RECORDED_LOCAL':   return STRINGS.TASK_STATUS_RECORDED;
    case 'UPLOADED':         return STRINGS.TASK_STATUS_ACCEPTED;
    case 'PASSED_SERVER_QC': return STRINGS.TASK_STATUS_ACCEPTED;
    case 'FAILED_LOCAL_QC':  return STRINGS.TASK_STATUS_QC_FAIL;
    case 'FAILED_SERVER_QC': return STRINGS.TASK_STATUS_QC_FAIL;
    case 'SKIPPED':          return STRINGS.TASK_STATUS_SKIPPED;
    default:                 return STRINGS.TASK_STATUS_NOT_RECORDED;
  }
}

export default function TaskListScreen({
  tasks, protocol, caseNumber, onBack, onRecordTask, onSkipTask, onProceedToSubmit,
}: TaskListScreenProps) {
  const [skipModalId, setSkipModalId] = useState<string | null>(null);
  const [skipReason, setSkipReason]   = useState('');

  const requiredDone = tasks
    .filter(t => t.required)
    .every(t => t.status === 'RECORDED_LOCAL' || t.status === 'UPLOADED' || t.status === 'PASSED_SERVER_QC' || t.status === 'SKIPPED');

  const handleSkipConfirm = () => {
    if (!skipModalId || !skipReason) return;
    onSkipTask(skipModalId, skipReason);
    setSkipModalId(null);
    setSkipReason('');
  };

  const protLabel = protocol === 'phonemes' ? 'Фонемы' : protocol === 'speech' ? 'Речь' : 'Полный';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Навигация */}
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">{STRINGS.TASKS_TITLE}</h1>
          <p className="text-xs text-gray-400">{protLabel}{caseNumber ? ` · ${caseNumber}` : ''}</p>
        </div>
      </div>

      <main className="flex-1 px-5 py-5 pb-32 space-y-3 overflow-y-auto">
        {tasks.map((task, idx) => {
          const isDone   = task.status === 'RECORDED_LOCAL' || task.status === 'UPLOADED' || task.status === 'PASSED_SERVER_QC';
          const isSkipped = task.status === 'SKIPPED';
          const isQcFail  = task.status === 'FAILED_LOCAL_QC' || task.status === 'FAILED_SERVER_QC';
          return (
            <div
              key={task.id}
              className={`rounded-2xl border p-4 ${
                isDone   ? 'border-green-200 bg-green-50' :
                isQcFail ? 'border-red-200 bg-red-50' :
                isSkipped? 'border-gray-200 bg-gray-50' :
                           'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{taskStatusIcon(task.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{String(idx + 1).padStart(2, '0')}</span>
                    <p className="text-sm font-medium text-gray-800 truncate">{task.label}</p>
                    {task.required && (
                      <span className="text-xs text-red-500 font-medium flex-shrink-0">*</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-6">{taskStatusText(task.status)}</p>
                  {task.duration && (
                    <p className="text-xs text-green-600 mt-0.5 ml-6">{task.duration.toFixed(1)} сек.</p>
                  )}
                  {isSkipped && task.skipReason && (
                    <p className="text-xs text-gray-500 mt-0.5 ml-6 italic">{task.skipReason}</p>
                  )}
                </div>
              </div>

              {!isSkipped && (
                <div className="flex gap-2 mt-3 ml-8">
                  <button
                    onClick={() => onRecordTask(task.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDone
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : isQcFail
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {isDone ? 'Перезаписать' : isQcFail ? 'Перезаписать' : STRINGS.TASK_BTN_RECORD}
                  </button>
                  <button
                    onClick={() => { setSkipModalId(task.id); setSkipReason(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                    {STRINGS.TASK_BTN_SKIP}
                  </button>
                </div>
              )}
              {isSkipped && (
                <button
                  onClick={() => onRecordTask(task.id)}
                  className="mt-3 ml-8 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <Mic className="w-4 h-4" /> Записать всё же
                </button>
              )}
            </div>
          );
        })}
      </main>

      {/* Кнопка «Далее» */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        <button
          onClick={onProceedToSubmit}
          disabled={!requiredDone}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors"
        >
          {requiredDone ? 'Далее: проверка и отправка' : 'Запишите или пропустите все задания *'}
        </button>
      </div>

      {/* Модальное окно причины пропуска */}
      {skipModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setSkipModalId(null)}>
          <div
            className="bg-white w-full rounded-t-3xl px-5 py-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">{STRINGS.TASK_SKIP_REASON_TITLE}</h2>
            <div className="space-y-2">
              {STRINGS.TASK_SKIP_REASONS.map(r => (
                <label key={r} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="skipReason"
                    value={r}
                    checked={skipReason === r}
                    onChange={() => setSkipReason(r)}
                    className="mt-0.5 w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSkipModalId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">
                {STRINGS.CANCEL}
              </button>
              <button
                onClick={handleSkipConfirm}
                disabled={!skipReason}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400"
              >
                {STRINGS.SKIP}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
