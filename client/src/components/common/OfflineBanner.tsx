// Баннер «офлайн» — показывается в верхней части любого экрана при потере сети
import { useEffect, useState } from 'react';
import { STRINGS } from '../../constants/ui';

interface OfflineBannerProps {
  initialOffline?: boolean;
}

export default function OfflineBanner({ initialOffline = false }: OfflineBannerProps) {
  const [offline, setOffline] = useState(initialOffline || !navigator.onLine);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline  = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2">
      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
      <span className="text-sm text-amber-800 text-center">{STRINGS.OFFLINE_BANNER}</span>
    </div>
  );
}
