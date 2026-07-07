// E14: Поддержка — FAQ, форма обращения
import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Mail, CheckCircle2 } from 'lucide-react';
import { STRINGS } from '../../constants/ui';

interface SupportScreenProps {
  onBack: () => void;
}

export default function SupportScreen({ onBack }: SupportScreenProps) {
  const [openFaq, setOpenFaq]  = useState<number | null>(null);
  const [message, setMessage]  = useState('');
  const [sent, setSent]        = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // TODO: API-вызов отправки обращения
    setSent(true);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">{STRINGS.SUPPORT_TITLE}</h1>
      </div>

      <main className="flex-1 overflow-y-auto px-5 py-6 space-y-8">

        {/* FAQ */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">{STRINGS.SUPPORT_FAQ_TITLE}</h2>
          <div className="space-y-2">
            {STRINGS.FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800 pr-3">{item.q}</span>
                  {openFaq === i
                    ? <ChevronUp   className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 bg-gray-50 border-t border-gray-100">
                    <p className="pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Форма обращения */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">{STRINGS.SUPPORT_CONTACT_TITLE}</h2>
          {sent ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700">{STRINGS.SUPPORT_SEND_SUCCESS}</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Опишите проблему или задайте вопрос..."
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-xl font-medium text-sm transition-colors"
              >
                <Mail className="w-4 h-4" /> {STRINGS.SUPPORT_CONTACT_BTN}
              </button>
            </form>
          )}
        </section>

      </main>
    </div>
  );
}
