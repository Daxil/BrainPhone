// E5–E6: Согласие пациента + Подпись пальцем
import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import { sha256 } from '../../services/qcAnalyzer';
import type { ConsentData } from '../../types/case';

interface ConsentScreenProps {
  caseId: string;
  doctorId: string;
  onBack: () => void;
  onConfirm: (consent: ConsentData) => void;
}

export default function ConsentScreen({ caseId, doctorId, onBack, onConfirm }: ConsentScreenProps) {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);

  // ── Canvas helpers ────────────────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function eventPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = getCtx(); if (!ctx) return;
    const { x, y } = eventPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = getCtx(); if (!ctx) return;
    const { x, y } = eventPos(e);
    ctx.lineTo(x, y); ctx.stroke();
    setHasSig(true);
  };

  const onEnd = () => { drawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  // ── Подтверждение ─────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const canvas = canvasRef.current; if (!canvas) return;
    setSaving(true);
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      const timestamp        = new Date().toISOString();
      const textVersion      = await sha256(STRINGS.CONSENT_TEXT);
      const hash             = await sha256(`${textVersion}|${timestamp}|${caseId}|${doctorId}`);
      const consent: ConsentData = {
        textVersion, timestamp, caseId, doctorId,
        check1, check2, signatureDataUrl, hash,
      };
      onConfirm(consent);
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = check1 && check2 && hasSig;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Навигация */}
      <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">{STRINGS.CONSENT_TITLE}</h1>
      </div>

      <main className="flex-1 overflow-y-auto px-5 py-5 pb-40 space-y-5">
        <p className="text-sm text-gray-500">{STRINGS.CONSENT_SUBTITLE}</p>

        {/* Текст согласия */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
          {STRINGS.CONSENT_TEXT}
        </div>

        {/* Галочки */}
        <div className="space-y-3">
          {[
            { state: check1, set: setCheck1, label: STRINGS.CONSENT_CHECK_1 },
            { state: check2, set: setCheck2, label: STRINGS.CONSENT_CHECK_2 },
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input type="checkbox" checked={item.state} onChange={e => item.set(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.state ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'
                }`}>
                  {item.state && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700 leading-snug">{item.label}</span>
            </label>
          ))}
        </div>

        {/* Поле подписи */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">{STRINGS.CONSENT_SIGN_TITLE}</p>
            <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
              <RotateCcw className="w-3.5 h-3.5" /> {STRINGS.CONSENT_SIGN_CLEAR}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">{STRINGS.CONSENT_SIGN_HINT}</p>
          <canvas
            ref={canvasRef}
            width={560}
            height={180}
            className="w-full rounded-2xl border-2 border-dashed border-gray-300 touch-none cursor-crosshair bg-gray-50"
            style={{ height: 180 }}
            onMouseDown={onStart}
            onMouseMove={onMove}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={onStart}
            onTouchMove={onMove}
            onTouchEnd={onEnd}
          />
          {!hasSig && (
            <p className="text-xs text-center text-gray-400 mt-1">{STRINGS.CONSENT_SIGN_MISSING}</p>
          )}
        </div>
      </main>

      {/* Кнопка подтверждения */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        {!check1 || !check2 ? (
          <p className="text-xs text-center text-amber-600 mb-2">{STRINGS.CONSENT_BOTH_CHECKS}</p>
        ) : !hasSig ? (
          <p className="text-xs text-center text-amber-600 mb-2">{STRINGS.CONSENT_SIGN_MISSING}</p>
        ) : null}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors"
        >
          {saving ? 'Сохранение...' : STRINGS.CONSENT_NEXT}
        </button>
      </div>
    </div>
  );
}
