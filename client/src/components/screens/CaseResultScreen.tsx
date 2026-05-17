// E11: Итоговый статус кейса после отправки
import { CheckCircle2, XCircle, Clock, Home, Plus } from 'lucide-react';
import { STRINGS } from '../../constants/ui';

interface CaseResultScreenProps {
  caseNumber?: string;
  caseStatus: string;
  rejectionCode?: string;
  onGoHome: () => void;
  onNewCase: () => void;
}

export default function CaseResultScreen({
  caseNumber, caseStatus, rejectionCode, onGoHome, onNewCase,
}: CaseResultScreenProps) {
  const isAccepted = caseStatus === 'ACCEPTED';
  const isRejected = caseStatus === 'REJECTED';
  const isReview   = caseStatus === 'REVIEW';

  const icon = isAccepted ? (
    <CheckCircle2 className="w-16 h-16 text-green-500" />
  ) : isRejected ? (
    <XCircle className="w-16 h-16 text-red-500" />
  ) : (
    <Clock className="w-16 h-16 text-amber-400" />
  );

  const title = isAccepted ? STRINGS.CASE_STATUS_ACCEPTED
    : isRejected           ? STRINGS.CASE_STATUS_REJECTED
    : isReview             ? STRINGS.CASE_STATUS_REVIEW
    :                        STRINGS.CASE_STATUS_SUBMITTED;

  const subtitle = isAccepted
    ? 'Кейс успешно принят и будет учтён в выплатах.'
    : isRejected
    ? 'Кейс отклонён. Ознакомьтесь с причиной и при необходимости создайте новый.'
    : isReview
    ? STRINGS.CASE_REVIEW_NOTE
    : 'Кейс отправлен и ожидает проверки.';

  const rejectionMsg = rejectionCode
    ? STRINGS.REJECTION_CODES[rejectionCode] ?? rejectionCode
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className={`mb-6 p-6 rounded-full ${
        isAccepted ? 'bg-green-50' : isRejected ? 'bg-red-50' : 'bg-amber-50'
      }`}>
        {icon}
      </div>

      {caseNumber && (
        <p className="text-xs font-mono text-gray-400 mb-1">{caseNumber}</p>
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-500 text-sm mb-4 max-w-xs">{subtitle}</p>

      {rejectionMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 max-w-xs">
          <span className="font-semibold">{STRINGS.CASE_REJECTION_PREFIX}</span>{rejectionMsg}
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onNewCase}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> {STRINGS.CASE_NEW}
        </button>
        <button
          onClick={onGoHome}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" /> {STRINGS.CASE_BACK_HOME}
        </button>
      </div>
    </div>
  );
}
