// E2: Онбординг — показывается один раз после первого входа
import { useState } from 'react';
import { STRINGS } from '../../constants/ui';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 px-6 py-8 flex flex-col max-w-lg mx-auto w-full">

        {/* Иконка */}
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 self-start">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{STRINGS.ONBOARDING_TITLE}</h1>
        <p className="text-gray-500 text-sm mb-6">{STRINGS.ONBOARDING_SUBTITLE}</p>

        {/* Правила */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4">
          {STRINGS.ONBOARDING_POINTS.map((point, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
            </div>
          ))}
        </div>

        {/* Чекбокс согласия */}
        <label className="flex items-start gap-3 mb-8 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'
            }`}>
              {checked && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-700 leading-relaxed">{STRINGS.ONBOARDING_CONSENT_CHECK}</span>
        </label>

        <div className="mt-auto space-y-3">
          {/* Кнопка «Начать» */}
          <button
            onClick={onComplete}
            disabled={!checked}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors"
          >
            {STRINGS.ONBOARDING_START}
          </button>

          {/* Ссылка на поддержку */}
          <a
            href={`mailto:${STRINGS.SUPPORT_EMAIL}`}
            className="block text-center text-sm text-blue-600 hover:text-blue-800 hover:underline py-1"
          >
            {STRINGS.SUPPORT_LINK}
          </a>
        </div>
      </main>
    </div>
  );
}
