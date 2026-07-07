// E4: Данные пациента — все поля по ТЗ.
// Фото хранятся ТОЛЬКО локально (File-объект), загрузка на сервер — после создания пациента.
import { useRef } from 'react';
import { ChevronLeft, Camera, X, Plus } from 'lucide-react';
import type { PatientRecord } from '../../types';
import { STRINGS } from '../../constants/ui';

const ASSESSMENT_TESTS: { key: keyof PatientRecord; label: string; max: string }[] = [
  { key: 'mocaScore',  label: 'MoCA',  max: '/30' },
  { key: 'mmseScore',  label: 'MMSE',  max: '/30' },
  { key: 'trchScore',  label: 'ТРЧ',   max: '/5'  },
  { key: 'updrsScore', label: 'UPDRS', max: ''    },
];

interface FormScreenProps {
  record: PatientRecord | null;
  onBack: () => void;
  onChange: (record: PatientRecord) => void;
  onContinue: () => void;
  submitting?: boolean;
  // Вместо API-upload: просто добавить файл в локальный record
  onAddPhotoLocal?: (file: File, category: 'consult' | 'scale') => void;
  onRemovePhoto?: (index: number) => void;
}

export default function FormScreen({ record, onBack, onChange, onContinue, submitting, onAddPhotoLocal, onRemovePhoto }: FormScreenProps) {
  const consultRef = useRef<HTMLInputElement>(null);
  const scaleRef   = useRef<HTMLInputElement>(null);

  if (!record) return null;

  const set = (field: keyof PatientRecord, value: any) => onChange({ ...record, [field]: value });

  const requireDiagnosis = !record.hasParkinsonism && !record.hasCognitive;

  const isValid = () => {
    if (!record.age?.trim())    return false;
    if (!record.gender)         return false;
    if (requireDiagnosis && !record.diagnosis?.trim()) return false;
    return true;
  };

  const consultPhotos = (record.photos || []).filter(p => !p.category || p.category === 'consult');
  const scalePhotos   = (record.photos || []).filter(p => p.category === 'scale');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Навигация */}
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">{STRINGS.FORM_TITLE}</h1>
      </div>

      <main className="flex-1 px-5 py-6 space-y-6 overflow-y-auto pb-32">

        {/* Пол */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_GENDER} *</label>
          <div className="flex gap-3">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => set('gender', g)}
                className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
                  record.gender === g
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {g === 'male' ? STRINGS.FORM_GENDER_MALE : STRINGS.FORM_GENDER_FEMALE}
              </button>
            ))}
          </div>
        </div>

        {/* Возраст */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_AGE} *</label>
          <input
            type="number"
            inputMode="numeric"
            value={record.age}
            onChange={e => set('age', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={STRINGS.FORM_AGE_PLACEHOLDER}
            min="0" max="120"
          />
        </div>

        {/* Паркинсонизм? / Когнитивные нарушения? */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!record.hasParkinsonism}
              onChange={e => set('hasParkinsonism', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">{STRINGS.FORM_PARKINSONISM}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!record.hasCognitive}
              onChange={e => set('hasCognitive', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">{STRINGS.FORM_COGNITIVE}</span>
          </label>
        </div>

        {/* Основной диагноз — обязателен если нет Паркинсонизма и КН */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {STRINGS.FORM_DIAGNOSIS} {requireDiagnosis && '*'}
          </label>
          {requireDiagnosis && (
            <p className="text-xs text-amber-600 mb-2">{STRINGS.FORM_DIAGNOSIS_REQUIRED}</p>
          )}
          <textarea
            value={record.diagnosis || ''}
            onChange={e => set('diagnosis', e.target.value)}
            className={`w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none ${
              requireDiagnosis && !record.diagnosis?.trim() ? 'border-amber-400' : 'border-gray-300'
            }`}
            placeholder={STRINGS.FORM_DIAGNOSIS_PLACEHOLDER}
            rows={2}
          />
        </div>

        {/* Родной язык */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_LANGUAGE}</label>
          <input
            type="text"
            value={record.nativeLanguage || ''}
            onChange={e => set('nativeLanguage', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={STRINGS.FORM_LANGUAGE_PLACEHOLDER}
          />
        </div>

        {/* Оценочные шкалы — отдельное поле на каждую */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Оценочные шкалы</label>
          <div className="grid grid-cols-2 gap-3">
            {ASSESSMENT_TESTS.map(({ key, label, max }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}{max && <span className="text-gray-400"> {max}</span>}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={(record[key] as string) || ''}
                  onChange={e => set(key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="—"
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_COMMENT}</label>
          <textarea
            value={record.notes || ''}
            onChange={e => set('notes', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            rows={3}
            placeholder={STRINGS.FORM_COMMENT_PLACEHOLDER}
          />
        </div>

        {/* Фото консультации / диагноза — хранятся локально, загружаются после создания пациента */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_PHOTOS_CONSULT}</label>
          <input ref={consultRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              files.forEach(f => onAddPhotoLocal?.(f, 'consult'));
              if (consultRef.current) consultRef.current.value = '';
            }} />
          <div className="flex gap-2 flex-wrap">
            {consultPhotos.map((p, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                {onRemovePhoto && (
                  <button
                    onClick={() => onRemovePhoto(record.photos.indexOf(p))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => consultRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Camera className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-400">{STRINGS.FORM_PHOTO_ADD}</span>
            </button>
          </div>
        </div>

        {/* Фото шкал (MoCA/MMSE/ТРЧ) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{STRINGS.FORM_PHOTOS_SCALES}</label>
          <input ref={scaleRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              files.forEach(f => onAddPhotoLocal?.(f, 'scale'));
              if (scaleRef.current) scaleRef.current.value = '';
            }} />
          <div className="flex gap-2 flex-wrap">
            {scalePhotos.map((p, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                {onRemovePhoto && (
                  <button
                    onClick={() => onRemovePhoto(record.photos.indexOf(p))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => scaleRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-400">{STRINGS.FORM_PHOTO_ADD}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Кнопка «Далее: согласие» */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        {!isValid() && requireDiagnosis && (
          <p className="text-xs text-red-500 mb-2 text-center">{STRINGS.FORM_ERROR_REQUIRED}</p>
        )}
        <button
          onClick={onContinue}
          disabled={!isValid() || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors"
        >
          {submitting ? 'Сохранение…' : STRINGS.FORM_NEXT}
        </button>
      </div>
    </div>
  );
}
