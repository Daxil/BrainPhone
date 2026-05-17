import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onSuccess: () => void;
}

export default function TotpPage({ onSuccess }: Props) {
  const { loginTotp } = useAuth();
  const [token, setToken]       = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginTotp(token.trim().toUpperCase(), useBackup);
      if (result.error) {
        setError(result.error);
        setToken('');
      } else {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Двухфакторная аутентификация</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {useBackup
              ? 'Введите резервный код'
              : 'Введите 6-значный код из приложения-аутентификатора'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type={useBackup ? 'text' : 'text'}
              inputMode={useBackup ? 'text' : 'numeric'}
              pattern={useBackup ? '[A-Fa-f0-9]{8}' : '[0-9]{6}'}
              maxLength={useBackup ? 8 : 6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\s/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={useBackup ? 'ABCD1234' : '000000'}
            />
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
            {loading ? 'Проверка...' : 'Подтвердить'}
          </button>
        </form>

        <button
          onClick={() => { setUseBackup(!useBackup); setToken(''); setError(''); }}
          className="mt-4 w-full text-center text-xs text-blue-600 hover:underline"
        >
          {useBackup ? '← Использовать код из приложения' : 'Использовать резервный код'}
        </button>
      </div>
    </div>
  );
}
