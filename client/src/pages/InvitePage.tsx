import { useState, useEffect, FormEvent } from 'react';
import { authApi } from '../services/authApi';
import type { InviteInfo } from '../types/auth';
import SetupTotpPage from './SetupTotpPage';

interface Props {
  token: string;
  onComplete: () => void;
}

type Step = 'loading' | 'set-password' | 'setup-totp' | 'done' | 'error';

export default function InvitePage({ token, onComplete }: Props) {
  const [step, setStep]       = useState<Step>('loading');
  const [invite, setInvite]   = useState<InviteInfo | null>(null);
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    authApi.getInvite(token).then((res) => {
      if (res.success && res.invite) {
        setInvite(res.invite);
        setStep('set-password');
      } else {
        setError(res.error || 'Приглашение недействительно или истекло');
        setStep('error');
      }
    });
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 12) {
      setError('Пароль должен содержать минимум 12 символов');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.setPassword(token, password);
      if (!res.success) {
        setError(res.error || 'Ошибка');
      } else if (res.requireTotpSetup) {
        setStep('setup-totp');
      } else {
        setStep('done');
        setTimeout(onComplete, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Проверка приглашения...</div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Приглашение недействительно</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'setup-totp') {
    return (
      <SetupTotpPage
        onComplete={() => { setStep('done'); setTimeout(onComplete, 1500); }}
        mandatory={invite?.role === 'admin'}
      />
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Аккаунт активирован</h2>
          <p className="text-gray-500 text-sm">Перенаправление на страницу входа...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Создание пароля</h1>
          {invite && (
            <p className="text-gray-500 mt-1 text-sm">
              Аккаунт: <span className="font-medium">{invite.email}</span>
              {' '}(<span className="capitalize">{invite.role === 'admin' ? 'Администратор' : 'Врач'}</span>)
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Новый пароль
            </label>
            <input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Минимум 12 символов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Подтвердите пароль
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">Требования к паролю:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Минимум 12 символов</li>
              <li>Не должен быть распространённым</li>
              <li>Не должен встречаться в базах утечек</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
