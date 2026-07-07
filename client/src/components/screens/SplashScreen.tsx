// E0: Splash + синхронизация протоколов / QC-порогов
import { useEffect, useState } from 'react';
import { STRINGS } from '../../constants/ui';
import { HEALTH_URL } from '../../config';

interface SyncStep {
  label: string;
  done: boolean;
}

interface SplashScreenProps {
  onComplete: (isOffline: boolean) => void;
}

async function pingServer(): Promise<boolean> {
  // Two attempts: mobile networks + Yandex Cloud cold-start can easily exceed 4s.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(HEALTH_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return true;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [steps, setSteps] = useState<SyncStep[]>([
    { label: STRINGS.SYNC_PROTOCOLS, done: false },
    { label: STRINGS.SYNC_TEXTS,     done: false },
    { label: STRINGS.SYNC_QC,        done: false },
  ]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline  = () => setIsOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // navigator.onLine is unreliable on mobile — always do the real ping.
      const online = await pingServer();
      if (cancelled) return;

      if (!online) {
        setIsOffline(true);
        // Офлайн: помечаем всё выполненным из кэша
        setSteps(s => s.map(x => ({ ...x, done: true })));
        setTimeout(() => { if (!cancelled) onComplete(true); }, 800);
        return;
      }

      // Онлайн: последовательно «синхронизируем» каждый шаг
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        await new Promise<void>(r => setTimeout(r, 350 + Math.random() * 200));
        if (cancelled) return;
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s));
      }

      setTimeout(() => { if (!cancelled) onComplete(false); }, 250);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      {/* Логотип */}
      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{STRINGS.APP_NAME}</h1>
      <p className="text-gray-400 text-sm mb-10">{STRINGS.APP_SUBTITLE}</p>

      {/* Офлайн-баннер */}
      {isOffline && (
        <div className="mb-6 w-full max-w-xs bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm text-center">
          {STRINGS.OFFLINE_BANNER}
        </div>
      )}

      {/* Шаги синхронизации */}
      <div className="w-full max-w-xs space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {step.done ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
            )}
            <span className={`text-sm transition-colors ${step.done ? 'text-gray-700' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
