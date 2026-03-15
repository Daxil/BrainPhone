import { Mic, ChevronLeft } from 'lucide-react';
import type { ProtocolType } from '../../types';

interface ProtocolSelectScreenProps {
  onSelectProtocol: (protocol: ProtocolType) => void;
  onBack: () => void;
}

export default function ProtocolSelectScreen({ onSelectProtocol, onBack }: ProtocolSelectScreenProps) {
  const protocols: { type: ProtocolType; title: string; description: string; duration: string }[] = [
    {
      type: 'phonemes',
      title: 'Фонемы',
      description: 'Запись отдельных звуков для анализа артикуляции',
      duration: '~2 минуты',
    },
    {
      type: 'speech',
      title: 'Речь',
      description: 'Описание картинок и чтение текста',
      duration: '~5 минут',
    },
    {
      type: 'full',
      title: 'Полный протокол',
      description: 'Комплексная запись всех тестов',
      duration: '~10 минут',
    },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
        </div>
      </div>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Выберите протокол записи</h1>
          <p className="text-gray-600 mb-8">Выберите подходящий протокол для записи аудио пациента</p>

          <div className="space-y-4">
            {protocols.map((protocol) => (
              <button
                key={protocol.type}
                onClick={() => onSelectProtocol(protocol.type)}
                className="w-full border border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-full p-3 group-hover:bg-blue-200 transition-colors">
                    <Mic className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{protocol.title}</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {protocol.duration}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-2">{protocol.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
