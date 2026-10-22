// Базовые элементы форм в стиле основного сайта BrainPhone:
// белые карточки с тонкой рамкой, скругление 12px, синий #3d7ef5.
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#e9ebfc] bg-white p-5 shadow-sm md:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold leading-7 text-gray-900">{children}</h2>
      {hint && <p className="text-sm leading-5 text-gray-600">{hint}</p>}
    </div>
  );
}

export function TextField({
  label, value, onChange, placeholder, inputMode, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
}

/** Группа взаимоисключающих кнопок в один ряд (Да / Нет, Русский / Другой, ответы GPCOG). */
export function Segmented<T extends string | boolean>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      <div className="flex" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const selected = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={[
                'h-12 flex-1 border px-3 text-sm font-medium transition-colors',
                i === 0 ? 'rounded-l-xl' : '-ml-px',
                i === options.length - 1 ? 'rounded-r-xl' : '',
                selected
                  ? 'relative z-10 border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-white text-gray-900 hover:border-blue-300',
              ].join(' ')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CheckCard({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
        checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
        checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 bg-white'
      }`}>
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
      <span className="text-sm leading-5 text-gray-700">{label}</span>
    </button>
  );
}

/** Индикатор шагов: пройденные закрашены, текущий подсвечен. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              done || active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden text-sm font-medium sm:block ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${done ? 'bg-blue-500' : 'bg-gray-100'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Notice({ tone, children }: { tone: 'success' | 'warning'; children: ReactNode }) {
  const cls = tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700';
  return <p className={`rounded-xl px-4 py-3 text-sm leading-5 ${cls}`}>{children}</p>;
}
