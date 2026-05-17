import { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { STRINGS } from '../constants/ui';

type Tab = 'users' | 'invites' | 'audit' | 'cases-phonemes' | 'cases-speech' | 'cases-full';

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  used_at: string | null;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  totpVerified: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
  createdAt: string;
}

interface AuditLog {
  id: number;
  event_type: string;
  email: string | null;
  ip_address: string | null;
  created_at: string;
  details: any;
}

interface AdminCase {
  id: string;
  case_number?: string;
  protocol_type: string;
  case_status: string;
  created_at: string;
  age: string;
  gender: string;
  rejection_code?: string;
  rejection_note?: string;
  doctor_email?: string;
}

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const { user, logout } = useAuth();
  const [tab, setTab]           = useState<Tab>('users');
  const [users, setUsers]       = useState<User[]>([]);
  const [invites, setInvites]   = useState<Invite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cases, setCases]       = useState<AdminCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<AdminCase | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'ACCEPTED'|'REJECTED'|'REVIEW'>('ACCEPTED');
  const [reviewCode, setReviewCode]     = useState('');
  const [reviewNote, setReviewNote]     = useState('');
  const [reviewing, setReviewing]       = useState(false);

  // Create invite form
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole]   = useState<'admin' | 'doctor'>('doctor');
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<{ email: string; rawToken: string; expiresAt: string } | null>(null);
  const [createError, setCreateError] = useState('');

  const protocolForTab = (): string | null => {
    if (tab === 'cases-phonemes') return 'phonemes';
    if (tab === 'cases-speech')   return 'speech';
    if (tab === 'cases-full')     return 'full';
    return null;
  };

  const loadData = async () => {
    const prot = protocolForTab();
    if (prot !== null) {
      const r = await api.getPatients();
      if (r.success && r.data?.data?.patients) {
        const all: AdminCase[] = r.data.data.patients;
        setCases(all.filter((c: AdminCase) => c.protocol_type === prot));
      }
      return;
    }
    if (tab === 'users') {
      const r = await authApi.listUsers();
      if (r.success && r.users) setUsers(r.users);
    } else if (tab === 'invites') {
      const r = await authApi.listInvites();
      if (r.success && r.invites) setInvites(r.invites);
    } else if (tab === 'audit') {
      const r = await authApi.getAuditLog({ limit: 50 });
      if (r.success && r.logs) setAuditLogs(r.logs);
    }
  };

  useEffect(() => { loadData(); }, [tab]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setNewInvite(null);
    setCreating(true);
    try {
      const res = await authApi.createInvite(newEmail, newRole);
      if (res.success && res.invite) {
        setNewInvite({ email: res.invite.email, rawToken: res.invite.rawToken, expiresAt: res.invite.expiresAt });
        setNewEmail('');
        await loadData();
      } else {
        setCreateError(res.error || 'Ошибка создания приглашения');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUnlock = async (userId: string) => {
    await authApi.unlockUser(userId);
    await loadData();
  };

  const handleDeactivate = async (userId: string) => {
    if (!window.confirm('Заблокировать пользователя и завершить все сессии?')) return;
    await authApi.deactivateUser(userId);
    await loadData();
  };

  // Build the invite link
  const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Пациенты
          </button>
          <h1 className="font-semibold text-gray-900">Администрирование</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button onClick={logout} className="text-xs text-red-600 hover:text-red-700">Выйти</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-gray-200 p-1 flex-wrap">
          {(['users', 'invites', 'audit', 'cases-phonemes', 'cases-speech', 'cases-full'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'users' ? 'Пользователи'
                : t === 'invites' ? 'Приглашения'
                : t === 'audit'   ? 'Журнал'
                : t === 'cases-phonemes' ? 'Фонемы'
                : t === 'cases-speech'   ? 'Речь'
                : 'Полный'}
            </button>
          ))}
        </div>

        {/* Create invite form */}
        {tab === 'invites' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="font-semibold text-gray-900 mb-4">Создать приглашение</h2>
            <form onSubmit={handleCreateInvite} className="flex gap-3 flex-wrap">
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@hospital.ru"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'doctor')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="doctor">Врач</option>
                <option value="admin">Администратор</option>
              </select>
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </form>

            {createError && (
              <div className="mt-3 text-sm text-red-600">{createError}</div>
            )}

            {newInvite && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-2">
                  Приглашение для {newInvite.email} создано!
                </p>
                <p className="text-xs text-green-700 mb-2">
                  Действует до: {new Date(newInvite.expiresAt).toLocaleString('ru-RU')}
                </p>
                <div className="bg-white border border-green-300 rounded p-2 font-mono text-xs break-all select-all">
                  {inviteLink(newInvite.rawToken)}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Передайте эту ссылку пользователю по защищённому каналу. Она отображается только один раз.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Users table */}
        {tab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Роль</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">2FA</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.role === 'admin' ? 'Администратор' : 'Врач'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${u.totpVerified ? 'text-green-600' : 'text-gray-400'}`}>
                          {u.totpVerified ? '✓ Активна' : '— Не настроена'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {locked
                          ? <span className="text-xs text-red-600">Заблокирован ({u.failedAttempts} попыток)</span>
                          : <span className="text-xs text-green-600">Активен</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {locked && (
                            <button
                              onClick={() => handleUnlock(u.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Разблокировать
                            </button>
                          )}
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeactivate(u.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Деактивировать
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Нет пользователей</div>
            )}
          </div>
        )}

        {/* Invites table */}
        {tab === 'invites' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Роль</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Истекает</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{inv.role === 'admin' ? 'Администратор' : 'Врач'}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(inv.expiresAt || (inv as any).expires_at).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      {inv.used_at
                        ? <span className="text-xs text-gray-400">Использовано</span>
                        : new Date(inv.expiresAt || (inv as any).expires_at) < new Date()
                          ? <span className="text-xs text-red-500">Истекло</span>
                          : <span className="text-xs text-green-600">Активно</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invites.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Нет приглашений</div>
            )}
          </div>
        )}

        {/* Audit log */}
        {tab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Время</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Событие</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        log.event_type.includes('failure') || log.event_type.includes('locked')
                          ? 'bg-red-100 text-red-700'
                          : log.event_type.includes('success')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{log.email || '—'}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditLogs.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Журнал пуст</div>
            )}
          </div>
        )}

        {/* Кейсы по протоколу */}
        {(tab === 'cases-phonemes' || tab === 'cases-speech' || tab === 'cases-full') && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">№</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Возраст/Пол</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {c.case_number || c.id.slice(-6)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.age} · {c.gender === 'male' ? 'М' : 'Ж'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.case_status === 'ACCEPTED' ? 'bg-green-100 text-green-700'
                          : c.case_status === 'REJECTED' ? 'bg-red-100 text-red-700'
                          : c.case_status === 'REVIEW'   ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.case_status === 'ACCEPTED' ? 'Принято'
                          : c.case_status === 'REJECTED' ? 'Отклонено'
                          : c.case_status === 'REVIEW'   ? 'На проверке'
                          : c.case_status === 'SUBMITTED'? 'Отправлен'
                          : c.case_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedCase(c); setReviewCode(''); setReviewNote(''); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Проверить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cases.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Кейсов нет</div>
            )}
          </div>
        )}

        {/* Модальное окно проверки кейса */}
        {selectedCase && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Проверка кейса</h2>
              <p className="text-sm text-gray-500">
                {selectedCase.case_number || selectedCase.id} · {selectedCase.protocol_type}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                <div className="flex gap-2">
                  {(['ACCEPTED', 'REJECTED', 'REVIEW'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setReviewStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        reviewStatus === s ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s === 'ACCEPTED' ? 'Принять' : s === 'REJECTED' ? 'Отклонить' : 'На проверку'}
                    </button>
                  ))}
                </div>
              </div>
              {reviewStatus === 'REJECTED' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Код отклонения</label>
                  <select
                    value={reviewCode}
                    onChange={e => setReviewCode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Выберите код...</option>
                    {Object.entries(STRINGS.REJECTION_CODES).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder="Дополнительный комментарий"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedCase(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">
                  Отмена
                </button>
                <button
                  disabled={reviewing || (reviewStatus === 'REJECTED' && !reviewCode)}
                  onClick={async () => {
                    setReviewing(true);
                    await api.reviewCase(selectedCase.id, reviewStatus, reviewCode || undefined, reviewNote || undefined);
                    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, case_status: reviewStatus, rejection_code: reviewCode } : c));
                    setSelectedCase(null);
                    setReviewing(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {reviewing ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
