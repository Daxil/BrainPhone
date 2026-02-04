import { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import type { MoCATest } from '../../types/forms';

interface MoCAFormProps {
  onSubmit: ( MoCATest) => void;
  initialData?: MoCATest;
  examinerName?: string;
}

const MoCAForm: React.FC<MoCAFormProps> = ({ onSubmit, initialData, examinerName }) => {
  const [errors, setErrors] = useState<string[]>([]);

  const initialVisuospatial: MoCATest['visuospatialExecutive'] = initialData?.visuospatialExecutive || {
    cube: false,
    clockContour: false,
    clockNumbers: false,
    clockHands: false,
    namingLion: false,
    namingRhino: false,
    namingCamel: false,
  };

  const initialAttention: MoCATest['attention'] = initialData?.attention || {
    digitSpanForward: 0,
    digitSpanBackward: 0,
    tappingLetters: 0,
    serialSubtraction: 0,
  };

  const initialLanguage: MoCATest['language'] = initialData?.language || {
    sentenceRepetition: false,
    verbalFluency: 0,
  };

  const initialAbstraction: MoCATest['abstraction'] = initialData?.abstraction || {
    similarityTrainBicycle: false,
    similarityWatchClock: false,
  };

  const initialMemory: MoCATest['memory'] = initialData?.memory || {
    wordListTrial1: 0,
    wordListTrial2: 0,
    wordListRecall: 0,
    wordListRecognition: 0,
  };

  const initialOrientation: MoCATest['orientation'] = initialData?.orientation || {
    date: false,
    month: false,
    year: false,
    day: false,
    place: false,
    city: false,
  };

  const [visuospatial, setVisuospatial] = useState(initialVisuospatial);
  const [attention, setAttention] = useState(initialAttention);
  const [language, setLanguage] = useState(initialLanguage);
  const [abstraction, setAbstraction] = useState(initialAbstraction);
  const [memory, setMemory] = useState(initialMemory);
  const [orientation, setOrientation] = useState(initialOrientation);
  const [educationAdjustment, setEducationAdjustment] = useState(initialData?.educationAdjustment || false);

  const calculateTotal = () => {
    const visuospatialScore =
      (visuospatial.cube ? 1 : 0) +
      (visuospatial.clockContour ? 1 : 0) +
      (visuospatial.clockNumbers ? 1 : 0) +
      (visuospatial.clockHands ? 1 : 0) +
      (visuospatial.namingLion ? 1 : 0) +
      (visuospatial.namingRhino ? 1 : 0) +
      (visuospatial.namingCamel ? 1 : 0);

    const attentionScore =
      attention.digitSpanForward +
      attention.digitSpanBackward +
      attention.tappingLetters +
      attention.serialSubtraction;

    const languageScore =
      (language.sentenceRepetition ? 1 : 0) +
      language.verbalFluency;

    const abstractionScore =
      (abstraction.similarityTrainBicycle ? 1 : 0) +
      (abstraction.similarityWatchClock ? 1 : 0);

    const memoryScore =
      memory.wordListTrial1 +
      memory.wordListTrial2 +
      memory.wordListRecall +
      memory.wordListRecognition;

    const orientationScore =
      (orientation.date ? 1 : 0) +
      (orientation.month ? 1 : 0) +
      (orientation.year ? 1 : 0) +
      (orientation.day ? 1 : 0) +
      (orientation.place ? 1 : 0) +
      (orientation.city ? 1 : 0);

    const total = visuospatialScore + attentionScore + languageScore + abstractionScore + memoryScore + orientationScore;
    const final = total + (educationAdjustment ? 1 : 0);

    return { total, final };
  };

  const handleSubmit = () => {
    const { total, final } = calculateTotal();

    if (total === 0) {
      setErrors(['Пожалуйста, заполните хотя бы часть вопросов']);
      return;
    }

    const formData: MoCATest = {
      visuospatialExecutive: visuospatial,
      attention: attention,
      language: language,
      abstraction: abstraction,
      memory: memory,
      orientation: orientation,
      totalScore: total,
      educationAdjustment: educationAdjustment,
      finalScore: final,
      date: new Date().toISOString().split('T')[0],
      examiner: examinerName || 'Не указан',
    };

    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">MoCA (Montreal Cognitive Assessment)</h2>
        <p className="text-sm text-gray-500 mt-1">Максимальный балл: 30</p>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <ul className="list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Визуально-пространственные функции и исполнительные функции (7 баллов)</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.cube}
                onChange={(e) => setVisuospatial({ ...visuospatial, cube: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Куб (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.clockContour}
                onChange={(e) => setVisuospatial({ ...visuospatial, clockContour: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Контур часов (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.clockNumbers}
                onChange={(e) => setVisuospatial({ ...visuospatial, clockNumbers: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Цифры на часах (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.clockHands}
                onChange={(e) => setVisuospatial({ ...visuospatial, clockHands: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Стрелки часов (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.namingLion}
                onChange={(e) => setVisuospatial({ ...visuospatial, namingLion: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Назвать льва (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.namingRhino}
                onChange={(e) => setVisuospatial({ ...visuospatial, namingRhino: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Назвать носорога (1 балл)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visuospatial.namingCamel}
                onChange={(e) => setVisuospatial({ ...visuospatial, namingCamel: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Назвать верблюда (1 балл)</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Внимание (6 баллов)</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Повторение цифр вперед (0-1)
              </label>
              <select
                value={attention.digitSpanForward}
                onChange={(e) => setAttention({ ...attention, digitSpanForward: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 баллов</option>
                <option value={1}>1 балл</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Повторение цифр назад (0-1)
              </label>
              <select
                value={attention.digitSpanBackward}
                onChange={(e) => setAttention({ ...attention, digitSpanBackward: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 баллов</option>
                <option value={1}>1 балл</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тактильное внимание (0-1)
              </label>
              <select
                value={attention.tappingLetters}
                onChange={(e) => setAttention({ ...attention, tappingLetters: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 баллов</option>
                <option value={1}>1 балл</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сериальное вычитание (0-3)
              </label>
              <select
                value={attention.serialSubtraction}
                onChange={(e) => setAttention({ ...attention, serialSubtraction: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 баллов</option>
                <option value={1}>1 балл</option>
                <option value={2}>2 балла</option>
                <option value={3}>3 балла</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Язык (3 балла)</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={language.sentenceRepetition}
                onChange={(e) => setLanguage({ ...language, sentenceRepetition: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Повторение предложения (1 балл)</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Вербальная флюэнтность (0-1)
              </label>
              <select
                value={language.verbalFluency}
                onChange={(e) => setLanguage({ ...language, verbalFluency: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 баллов</option>
                <option value={1}>1 балл</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Абстрактное мышление (2 балла)</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={abstraction.similarityTrainBicycle}
                onChange={(e) => setAbstraction({ ...abstraction, similarityTrainBicycle: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Поезд и велосипед (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={abstraction.similarityWatchClock}
                onChange={(e) => setAbstraction({ ...abstraction, similarityWatchClock: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Часы и календарь (1 балл)</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Память (10 баллов)</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Запоминание списка слов, попытка 1 (0-5)
              </label>
              <select
                value={memory.wordListTrial1}
                onChange={(e) => setMemory({ ...memory, wordListTrial1: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num} баллов</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Запоминание списка слов, попытка 2 (0-5)
              </label>
              <select
                value={memory.wordListTrial2}
                onChange={(e) => setMemory({ ...memory, wordListTrial2: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num} баллов</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Воспроизведение списка слов (0-5)
              </label>
              <select
                value={memory.wordListRecall}
                onChange={(e) => setMemory({ ...memory, wordListRecall: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num} баллов</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Распознавание слов (0-5)
              </label>
              <select
                value={memory.wordListRecognition}
                onChange={(e) => setMemory({ ...memory, wordListRecognition: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num} баллов</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Ориентация (6 баллов)</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.date}
                onChange={(e) => setOrientation({ ...orientation, date: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Дата (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.month}
                onChange={(e) => setOrientation({ ...orientation, month: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Месяц (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.year}
                onChange={(e) => setOrientation({ ...orientation, year: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Год (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.day}
                onChange={(e) => setOrientation({ ...orientation, day: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">День недели (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.place}
                onChange={(e) => setOrientation({ ...orientation, place: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Место (1 балл)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={orientation.city}
                onChange={(e) => setOrientation({ ...orientation, city: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700">Город (1 балл)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={educationAdjustment}
              onChange={(e) => setEducationAdjustment(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-gray-700">Коррекция на образование (&lt; 12 лет) (+1 балл)</span>
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                Общий балл: {calculateTotal().total} / 30
              </div>
              {educationAdjustment && (
                <div className="text-sm text-gray-600 mt-1">
                  С коррекцией: {calculateTotal().final} / 30
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {calculateTotal().final < 26 ? 'Возможные когнитивные нарушения' : 'В пределах нормы'}
              </div>
            </div>
            <button
              onClick={handleSubmit}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" />
              Сохранить анкету
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoCAForm;
