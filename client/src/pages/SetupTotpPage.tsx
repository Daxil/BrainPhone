import { useState, useEffect, FormEvent } from 'react';
import { authApi } from '../services/authApi';

interface Props {
  onComplete: () => void;
  mandatory?: boolean;
}

type Step = 'loading' | 'scan' | 'verify' | 'backup-codes' | 'done';

export default function SetupTotpPage({ onComplete, mandatory = false }: Props) {
  const [step, setStep]         = useState<Step>('loading');
  const [qrCode, setQrCode]     = useState('');
  const [secret, setSecret]     = useState('');
  const [token, setToken]       = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    authApi.setupTotp().then((res) => {
      if (res.success && res.qrCode && res.secret) {
        setQrCode(res.qrCode);
        setSecret(res.secret);
        setStep('scan');
      } else {
        setError(res.error || 'Ошибка инициализации 2FA');
      }
    });
  }, []);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyTotp(token.trim());
      if (res.success && res.backupCodes) {
        setBackupCodes(res.backupCodes);
        setStep('backup-codes');
      } else {
        setError(res.error || 'Неверный код');
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Настройка 2FA...</div>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Настройка 2FA</h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            Отсканируйте QR-код в Google Authenticator, Aegis или другом TOTP-приложении
          </p>

          {qrCode && (
            <div className="flex justify-center mb-4">
              <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
            </div>
          )}

          <details className="mb-6">
            <summary className="text-xs text-gray-500 cursor-pointer select-none">
              Показать секрет вручную
            </summary>
            <code className="block mt-2 text-xs bg-gray-100 rounded px-2 py-1 break-all font-mono">
              {secret}
            </code>
          </details>

          <button
            onClick={() => setStep('verify')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            Далее — ввести код
          </button>

          {!mandatory && (
            <button
              onClick={onComplete}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              Настроить позже
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Подтверждение 2FA</h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            Введите 6-значный код из приложения-аутентификатора
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || token.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm"
            >
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
          </form>

          <button
            onClick={() => setStep('scan')}
            className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
          >
            ← Назад к QR-коду
          </button>
        </div>
      </div>
    );
  }

  if (step === 'backup-codes') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Резервные коды</h2>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            Сохраните эти коды в безопасном месте. Они отображаются только один раз и позволяют войти при потере доступа к приложению.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {backupCodes.map((code, i) => (
              <code key={i} className="bg-gray-100 rounded px-2 py-1.5 text-sm font-mono text-center">
                {code}
              </code>
            ))}
          </div>

          <button
            onClick={copyBackupCodes}
            className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm mb-3 hover:bg-gray-50"
          >
            {copied ? '✓ Скопировано' : 'Скопировать все коды'}
          </button>

          <button
            onClick={() => { setStep('done'); onComplete(); }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            Готово — перейти к работе
          </button>
        </div>
      </div>
    );
  }

  return null;
}
