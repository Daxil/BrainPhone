import { Menu } from 'lucide-react';
import type { Screen } from '../../types';

interface HeaderProps {
  screen: Screen;
  onBack?: () => void;
  title?: string;
  patientId?: string;
  syncStatus?: 'synced' | 'syncing';
  showMenu?: boolean;
}

export default function Header({ screen, onBack, title, patientId, syncStatus, showMenu = true }: HeaderProps) {
  const showBackButton = screen !== 'home' && screen !== 'assessments';

  return (
    <header className="border-b border-gray-200 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {showBackButton ? (
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center gap-2"
          >
            ← Назад
          </button>
        ) : (
          <div>
            <h1 className="font-semibold text-gray-900">{title || 'Сбор клинических данных'}</h1>
            <p className="text-gray-500 text-sm mt-1">Упрощенная документация пациентов</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {syncStatus === 'synced' && (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs">Онлайн</span>
            </div>
          )}
          {syncStatus === 'syncing' && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-xs">Синхронизация...</span>
            </div>
          )}
          {showMenu && (
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {patientId && (
        <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3 inline-block">
          <div className="text-xs text-gray-500 mb-1">ID пациента</div>
          <div className="font-mono font-semibold text-gray-900">{patientId}</div>
        </div>
      )}
    </header>
  );
}
