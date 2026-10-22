// Когнитивная анкета (как в brainphone-pro): пациент → информант → GPCOG.
// Три коротких шага вместо одной длинной формы.
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  GPCOG_QUESTIONS, GPCOG_ANSWER_LABELS, INTAKE_CHECKS, gpcogAnswerScore,
  type CognitiveIntake, type GpcogAnswer,
} from '../../types/forms';
import { Card, CheckCard, Notice, Segmented, SectionTitle, Stepper, TextField } from '../ui/form';

interface CognitiveIntakeScreenProps {
  value: CognitiveIntake;
  onChange: (value: CognitiveIntake) => void;
  onBack: () => void;
  onSave: (value: CognitiveIntake) => Promise<void>;
}

const ANSWERS = Object.keys(GPCOG_ANSWER_LABELS) as GpcogAnswer[];
const YES_NO = [{ value: true, label: 'Да' }, { value: false, label: 'Нет' }];

export default function CognitiveIntakeScreen({ value, onChange, onBack, onSave }: CognitiveIntakeScreenProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<CognitiveIntake>) => onChange({ ...value, ...patch });
  const setInformant = (patch: Partial<CognitiveIntake['informant']>) =>
    onChange({ ...value, informant: { ...value.informant, ...patch } });

  const inf = value.informant;
  // GPCOG нужен только если информант может сравнить пациента с прошлым.
  const hasGpcog = inf.canCompare === true;
  const steps = hasGpcog ? ['Пациент', 'Информант', 'GPCOG'] : ['Пациент', 'Информант'];
  const lastStep = steps.length - 1;

  const patientOk =
    value.educationYears !== '' && Number(value.educationYears) <= 40
    && (value.primaryLanguage === 'ru' || value.russianSufficient !== null)
    && INTAKE_CHECKS.every(c => value.checks[c.id]);
  const informantOk = !!inf.name.trim() && !!inf.relation.trim() && !!inf.contactFrequency.trim()
    && !!inf.knownFor.trim() && inf.canCompare !== null;
  const gpcogOk = value.gpcogSkipped || GPCOG_QUESTIONS.every(q => value.gpcog[q.id]);
  const stepOk = [patientOk, informantOk, gpcogOk][step];

  const gpcogScore = GPCOG_QUESTIONS.reduce(
    (sum, q) => sum + (value.gpcog[q.id] ? gpcogAnswerScore(value.gpcog[q.id]) : 0), 0,
  );
  const answered = GPCOG_QUESTIONS.filter(q => value.gpcog[q.id]).length;

  const handleNext = async () => {
    if (step < lastStep) { setStep(step + 1); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ ...value, gpcogSkipped: value.gpcogSkipped || !hasGpcog });
    } catch {
      setError('Не удалось сохранить анкету. Попробуйте ещё раз.');
      setSaving(false);
    }
  };

  const handleBack = () => (step === 0 ? onBack() : setStep(step - 1));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-[#e9ebfc] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button onClick={handleBack} disabled={saving} aria-label="Назад" className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-40">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Когнитивная анкета</h1>
            <p className="text-xs text-gray-600">Шаг {step + 1} из {steps.length}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-6 pb-32">
        <Stepper steps={steps} current={step} />

        {step === 0 && (
          <>
            <Card className="space-y-6">
              <SectionTitle hint="Нужны, чтобы нормировать результат речевого анализа">Сведения о пациенте</SectionTitle>
              <div className="grid gap-6 md:grid-cols-2">
                <TextField
                  label="Образование, полных лет"
                  placeholder="Например, 11"
                  inputMode="numeric"
                  maxLength={2}
                  value={value.educationYears}
                  onChange={v => set({ educationYears: v.replace(/\D/g, '').slice(0, 2) })}
                />
                <Segmented
                  label="Основной язык"
                  options={[{ value: 'ru' as const, label: 'Русский' }, { value: 'other' as const, label: 'Другой' }]}
                  value={value.primaryLanguage}
                  onChange={v => set({ primaryLanguage: v, russianSufficient: v === 'ru' ? null : value.russianSufficient })}
                />
              </div>
              {value.primaryLanguage === 'other' && (
                <Segmented
                  label="Достаточно ли пациент владеет русским для самостоятельного описания картинки?"
                  options={YES_NO}
                  value={value.russianSufficient}
                  onChange={v => set({ russianSufficient: v })}
                />
              )}
            </Card>

            <Card className="space-y-4">
              <SectionTitle hint="Отметьте всё, что подтверждается">Применимость методики</SectionTitle>
              <div className="space-y-3">
                {INTAKE_CHECKS.map(c => (
                  <CheckCard
                    key={c.id}
                    label={c.text}
                    checked={!!value.checks[c.id]}
                    onToggle={() => set({ checks: { ...value.checks, [c.id]: !value.checks[c.id] } })}
                  />
                ))}
              </div>
            </Card>
          </>
        )}

        {step === 1 && (
          <Card className="space-y-6">
            <SectionTitle hint="Человек, который хорошо знает пациента: родственник, опекун, близкий друг">Информант</SectionTitle>
            <TextField label="ФИО" placeholder="Фамилия, имя, отчество" value={inf.name} onChange={v => setInformant({ name: v })} />
            <div className="grid gap-6 md:grid-cols-2">
              <TextField label="Кем приходится пациенту" placeholder="Например, супруг(а)" value={inf.relation} onChange={v => setInformant({ relation: v })} />
              <TextField label="Как часто общаются" placeholder="Например, ежедневно" value={inf.contactFrequency} onChange={v => setInformant({ contactFrequency: v })} />
            </div>
            <TextField label="Как давно знает пациента" placeholder="Например, более 5 лет" value={inf.knownFor} onChange={v => setInformant({ knownFor: v })} />
            <Segmented
              label="Может сравнить состояние пациента с тем, что было 5–10 лет назад?"
              options={YES_NO}
              value={inf.canCompare}
              onChange={v => setInformant({ canCompare: v })}
            />
            {inf.canCompare === true && <Notice tone="success">Информант подходит — следующим шагом заполним опросник GPCOG.</Notice>}
            {inf.canCompare === false && <Notice tone="warning">Информант не может сравнить пациента с прошлым — GPCOG будет пропущен.</Notice>}
          </Card>
        )}

        {step === 2 && (
          <>
            <Card className="space-y-2">
              <SectionTitle hint="Как этот пациент сопоставим с тем, что было 5–10 лет назад?">Опросник GPCOG</SectionTitle>
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-gray-600">
                  {value.gpcogSkipped ? 'Опросник будет пропущен' : `Отвечено ${answered} из ${GPCOG_QUESTIONS.length}`}
                </p>
                <button
                  type="button"
                  onClick={() => set({ gpcogSkipped: !value.gpcogSkipped })}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {value.gpcogSkipped ? 'Заполнить GPCOG' : 'Пропустить GPCOG'}
                </button>
              </div>
              {!value.gpcogSkipped && (
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(answered / GPCOG_QUESTIONS.length) * 100}%` }} />
                </div>
              )}
            </Card>

            {!value.gpcogSkipped && GPCOG_QUESTIONS.map((q, i) => (
              <Card key={q.id} className="space-y-4 !p-5">
                <p className="text-base leading-6 text-gray-900">
                  <span className="mr-2 text-gray-400">{i + 1}.</span>{q.text}
                </p>
                <Segmented
                  options={ANSWERS.map(a => ({ value: a, label: GPCOG_ANSWER_LABELS[a] }))}
                  value={value.gpcog[q.id] ?? null}
                  onChange={a => set({ gpcog: { ...value.gpcog, [q.id]: a } })}
                />
              </Card>
            ))}
            {!value.gpcogSkipped && answered === GPCOG_QUESTIONS.length && (
              <Notice tone="success">Сумма баллов GPCOG: {gpcogScore} из {GPCOG_QUESTIONS.length}</Notice>
            )}
          </>
        )}

        {error && <Notice tone="warning">{error}</Notice>}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#e9ebfc] bg-white">
        <div className="mx-auto flex max-w-3xl gap-3 px-5 py-4">
          {step > 0 && (
            <button
              onClick={handleBack}
              disabled={saving}
              className="h-12 rounded-xl border border-gray-300 bg-white px-6 text-base font-medium text-gray-900 hover:border-blue-300 disabled:opacity-50"
            >
              Назад
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!stepOk || saving}
            className="h-12 flex-1 rounded-xl bg-blue-500 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? 'Сохранение...' : step < lastStep ? 'Далее' : 'Сохранить и перейти к заданиям'}
          </button>
        </div>
      </div>
    </div>
  );
}
