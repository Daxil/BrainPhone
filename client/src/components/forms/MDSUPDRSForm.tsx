import { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import type { MDSUPDRSForm, MDSUPDRSPart1, MDSUPDRSPart2, MDSUPDRSPart3, MDSUPDRSPart4 } from '../../types/forms';

interface MDSUPDRSFormProps {
  onSubmit: (data: MDSUPDRSForm) => void;
  initialData?: MDSUPDRSForm;
  examinerName?: string;
}

const MDSUPDRSForm: React.FC<MDSUPDRSFormProps> = ({ onSubmit, initialData, examinerName }) => {
  const [currentPart, setCurrentPart] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);

  const initialPart1: MDSUPDRSPart1 = initialData?.part1 || {
    cognitiveImpairment: 0,
    hallucinations: 0,
    depression: 0,
    anxiety: 0,
    apathy: 0,
    dopamineDysregulation: 0,
    sleepProblems: 0,
    pain: 0,
    urinaryProblems: 0,
    constipation: 0,
    lightheadedness: 0,
    fatigue: 0,
  };

  const initialPart2: MDSUPDRSPart2 = initialData?.part2 || {
    speech: 0,
    salivation: 0,
    swallowing: 0,
    eating: 0,
    dressing: 0,
    hygiene: 0,
    handwriting: 0,
    doingHobbies: 0,
    turningInBed: 0,
    tremor: 0,
    gettingOutOfBed: 0,
    walking: 0,
    freezing: 0,
  };

  const initialPart3: MDSUPDRSPart3 = initialData?.part3 || {
    speech: 0,
    facialExpression: 0,
    rigidityNeck: 0,
    rigidityRightArm: 0,
    rigidityLeftArm: 0,
    rigidityRightLeg: 0,
    rigidityLeftLeg: 0,
    fingerTappingRight: 0,
    fingerTappingLeft: 0,
    handMovementsRight: 0,
    handMovementsLeft: 0,
    pronationSupinationRight: 0,
    pronationSupinationLeft: 0,
    toeTappingRight: 0,
    toeTappingLeft: 0,
    legAgilityRight: 0,
    legAgilityLeft: 0,
    arisingFromChair: 0,
    gait: 0,
    freezingGait: 0,
    posturalStability: 0,
    posturalTremorRightHand: 0,
    posturalTremorLeftHand: 0,
    kineticTremorRightHand: 0,
    kineticTremorLeftHand: 0,
    restTremorRightHand: 0,
    restTremorLeftHand: 0,
    restTremorLips: 0,
    constancyRestTremor: 0,
  };

  const initialPart4: MDSUPDRSPart4 = initialData?.part4 || {
    timeDyskinesias: 0,
    functionalImpactDyskinesias: 0,
    painfulDyskinesias: 0,
    timeOff: 0,
    functionalImpactOff: 0,
    complexityMedication: 0,
  };

  const [part1, setPart1] = useState<MDSUPDRSPart1>(initialPart1);
  const [part2, setPart2] = useState<MDSUPDRSPart2>(initialPart2);
  const [part3, setPart3] = useState<MDSUPDRSPart3>(initialPart3);
  const [part4, setPart4] = useState<MDSUPDRSPart4>(initialPart4);

  const calculateTotal = () => {
    const totalPart1 = Object.values(part1).reduce((sum, val) => sum + val, 0);
    const totalPart2 = Object.values(part2).reduce((sum, val) => sum + val, 0);
    const totalPart3 = Object.values(part3).reduce((sum, val) => sum + val, 0);
    const totalPart4 = Object.values(part4).reduce((sum, val) => sum + val, 0);
    return totalPart1 + totalPart2 + totalPart3 + totalPart4;
  };

  const handleSubmit = () => {
    const totalScore = calculateTotal();

    if (totalScore === 0) {
      setErrors(['Пожалуйста, заполните хотя бы часть вопросов']);
      return;
    }

    const formData: MDSUPDRSForm = {
      part1,
      part2,
      part3,
      part4,
      totalScore,
      date: new Date().toISOString().split('T')[0],
      examiner: examinerName || 'Не указан',
    };

    onSubmit(formData);
  };

  const renderPart1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Когнитивные нарушения (0-4)
        </label>
        <select
          value={part1.cognitiveImpairment}
          onChange={(e) => setPart1({ ...part1, cognitiveImpairment: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная функция</option>
          <option value={1}>1 - Слегка затронут</option>
          <option value={2}>2 - Умеренно затронут</option>
          <option value={3}>3 - Затронут</option>
          <option value={4}>4 - Тяжело затронут</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Галлюцинации и психоз (0-4)
        </label>
        <select
          value={part1.hallucinations}
          onChange={(e) => setPart1({ ...part1, hallucinations: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствуют</option>
          <option value={1}>1 - Слегка выражены</option>
          <option value={2}>2 - Умеренно выражены</option>
          <option value={3}>3 - Выражены</option>
          <option value={4}>4 - Тяжело выражены</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Депрессия (0-4)
        </label>
        <select
          value={part1.depression}
          onChange={(e) => setPart1({ ...part1, depression: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражена</option>
          <option value={2}>2 - Умеренно выражена</option>
          <option value={3}>3 - Выражена</option>
          <option value={4}>4 - Тяжело выражена</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Тревожность (0-4)
        </label>
        <select
          value={part1.anxiety}
          onChange={(e) => setPart1({ ...part1, anxiety: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражена</option>
          <option value={2}>2 - Умеренно выражена</option>
          <option value={3}>3 - Выражена</option>
          <option value={4}>4 - Тяжело выражена</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Апатия (0-4)
        </label>
        <select
          value={part1.apathy}
          onChange={(e) => setPart1({ ...part1, apathy: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражена</option>
          <option value={2}>2 - Умеренно выражена</option>
          <option value={3}>3 - Выражена</option>
          <option value={4}>4 - Тяжело выражена</option>
        </select>
      </div>
    </div>
  );

  const renderPart2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Речь (0-4)
        </label>
        <select
          value={part2.speech}
          onChange={(e) => setPart2({ ...part2, speech: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная</option>
          <option value={1}>1 - Слегка затронута</option>
          <option value={2}>2 - Умеренно затронута</option>
          <option value={3}>3 - Затронута</option>
          <option value={4}>4 - Тяжело затронута</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Глотание (0-4)
        </label>
        <select
          value={part2.swallowing}
          onChange={(e) => setPart2({ ...part2, swallowing: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальное</option>
          <option value={1}>1 - Слегка затронуто</option>
          <option value={2}>2 - Умеренно затронуто</option>
          <option value={3}>3 - Затронуто</option>
          <option value={4}>4 - Тяжело затронуто</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ходьба (0-4)
        </label>
        <select
          value={part2.walking}
          onChange={(e) => setPart2({ ...part2, walking: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная</option>
          <option value={1}>1 - Слегка затронута</option>
          <option value={2}>2 - Умеренно затронута</option>
          <option value={3}>3 - Затронута</option>
          <option value={4}>4 - Тяжело затронута</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Тремор (0-4)
        </label>
        <select
          value={part2.tremor}
          onChange={(e) => setPart2({ ...part2, tremor: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражен</option>
          <option value={2}>2 - Умеренно выражен</option>
          <option value={3}>3 - Выражен</option>
          <option value={4}>4 - Тяжело выражен</option>
        </select>
      </div>
    </div>
  );

  const renderPart3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Речь (0-4)
        </label>
        <select
          value={part3.speech}
          onChange={(e) => setPart3({ ...part3, speech: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная</option>
          <option value={1}>1 - Слегка затронута</option>
          <option value={2}>2 - Умеренно затронута</option>
          <option value={3}>3 - Затронута</option>
          <option value={4}>4 - Тяжело затронута</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Лицевая экспрессия (0-4)
        </label>
        <select
          value={part3.facialExpression}
          onChange={(e) => setPart3({ ...part3, facialExpression: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная</option>
          <option value={1}>1 - Слегка снижена</option>
          <option value={2}>2 - Умеренно снижена</option>
          <option value={3}>3 - Снижена</option>
          <option value={4}>4 - Тяжело снижена</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ригидность шеи (0-4)
        </label>
        <select
          value={part3.rigidityNeck}
          onChange={(e) => setPart3({ ...part3, rigidityNeck: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражена</option>
          <option value={2}>2 - Умеренно выражена</option>
          <option value={3}>3 - Выражена</option>
          <option value={4}>4 - Тяжело выражена</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ходьба (0-4)
        </label>
        <select
          value={part3.gait}
          onChange={(e) => setPart3({ ...part3, gait: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Нормальная</option>
          <option value={1}>1 - Слегка нарушена</option>
          <option value={2}>2 - Умеренно нарушена</option>
          <option value={3}>3 - Нарушена</option>
          <option value={4}>4 - Тяжело нарушена</option>
        </select>
      </div>
    </div>
  );

  const renderPart4 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Время дискинезий (0-4)
        </label>
        <select
          value={part4.timeDyskinesias}
          onChange={(e) => setPart4({ ...part4, timeDyskinesias: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствуют</option>
          <option value={1}>1 - &lt; 25% времени</option>
          <option value={2}>2 - 25-50% времени</option>
          <option value={3}>3 - 50-75% времени</option>
          <option value={4}>4 - &gt; 75% времени</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Функциональное влияние дискинезий (0-4)
        </label>
        <select
          value={part4.functionalImpactDyskinesias}
          onChange={(e) => setPart4({ ...part4, functionalImpactDyskinesias: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Отсутствует</option>
          <option value={1}>1 - Слегка выражено</option>
          <option value={2}>2 - Умеренно выражено</option>
          <option value={3}>3 - Выражено</option>
          <option value={4}>4 - Тяжело выражено</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Сложность медикаментозной терапии (0-4)
        </label>
        <select
          value={part4.complexityMedication}
          onChange={(e) => setPart4({ ...part4, complexityMedication: Number(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>0 - Не сложная</option>
          <option value={1}>1 - Минимальная сложность</option>
          <option value={2}>2 - Умеренная сложность</option>
          <option value={3}>3 - Сложная</option>
          <option value={4}>4 - Очень сложная</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">MDS-UPDRS Анкета</h2>
        <div className="text-sm text-gray-500">
          Часть {currentPart} из 4
        </div>
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

      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((part) => (
            <button
              key={part}
              onClick={() => setCurrentPart(part)}
              className={`px-4 py-2 rounded-lg font-medium ${
                currentPart === part
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Часть {part}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {currentPart === 1 && renderPart1()}
        {currentPart === 2 && renderPart2()}
        {currentPart === 3 && renderPart3()}
        {currentPart === 4 && renderPart4()}

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-900">
              Общий балл: {calculateTotal()} / 260
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

export default MDSUPDRSForm;
