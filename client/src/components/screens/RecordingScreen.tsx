// E8: Запись одного задания — VU-meter, таймер, QC-модалка (E9)
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Mic, Square, Play, RotateCcw, AlertTriangle, CheckCircle2, ZoomIn, X } from 'lucide-react';
import { STRINGS } from '../../constants/ui';
import { QC_RULES, TASK_DURATION_RULES, COUNT_IN_SECONDS, SILENCE_LEVEL } from '../../constants/statuses';
import { TASK_STIMULI } from '../../constants/stimuli';
import { analyzeAudio, getRmsLevel } from '../../services/qcAnalyzer';
import type { QCResult } from '../../constants/statuses';
import type { CaseTask } from '../../types/case';

interface RecordingScreenProps {
  task: CaseTask;
  onBack: () => void;
  onSave: (task: CaseTask, blob: Blob, duration: number, qcResult: QCResult) => Promise<void>;
}

type Phase = 'idle' | 'preparing' | 'countdown' | 'recording' | 'stopped' | 'qc' | 'saving';

const SAMPLE_RATE = 48000;

export default function RecordingScreen({ task, onBack, onSave }: RecordingScreenProps) {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [elapsed, setElapsed]   = useState(0);
  const [level, setLevel]       = useState(0);
  const [qcResult, setQcResult] = useState<QCResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob]         = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [saveErr, setSaveErr]   = useState('');
  const [zoomed, setZoomed]     = useState(false);
  const [countdown, setCountdown] = useState(COUNT_IN_SECONDS);
  const [notice, setNotice]     = useState('');

  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const gainRef           = useRef<GainNode | null>(null);
  const processorRef      = useRef<ScriptProcessorNode | null>(null);
  const sourceRef         = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const chunksRef         = useRef<Float32Array[]>([]);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRafRef       = useRef<number | null>(null);
  const startTimeRef      = useRef<number>(0);
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const collectingRef     = useRef(false);   // сэмплы пишутся только после отсчёта
  const sampleRateRef     = useRef(SAMPLE_RATE);
  const silenceStartRef   = useRef<number | null>(null);
  const abortedRef        = useRef(false);   // отмена, пока микрофон ещё открывается
  const stopRef           = useRef<(reason?: 'silence') => void>(() => {});
  const audioElRef        = useRef<HTMLAudioElement | null>(null);

  const durationRule = TASK_DURATION_RULES[task.taskType];
  const stimulus     = TASK_STIMULI[task.taskType];

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (levelRafRef.current) { cancelAnimationFrame(levelRafRef.current); levelRafRef.current = null; }
  };

  const stopHardware = useCallback(() => {
    processorRef.current?.disconnect();
    gainRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    processorRef.current = null;
    gainRef.current      = null;
    sourceRef.current    = null;
    streamRef.current    = null;
    audioCtxRef.current  = null;
    analyserRef.current  = null;
  }, []);

  useEffect(() => () => { stopTimer(); stopHardware(); audioElRef.current?.pause(); }, []);

  // VU-meter loop
  const startLevelLoop = () => {
    const loop = () => {
      if (analyserRef.current) {
        const rms = getRmsLevel(analyserRef.current);
        setLevel(rms);
        // Сторож тишины (как в brainphone-pro): долгое молчание останавливает запись,
        // чтобы не получить минуты пустого звука. Работает только во время записи.
        const timeout = durationRule.silenceTimeout;
        if (timeout && collectingRef.current) {
          const norm = Math.min(1, Math.pow(rms * 3.2, 0.8));
          if (norm < SILENCE_LEVEL) {
            if (silenceStartRef.current === null) silenceStartRef.current = performance.now();
            else if (performance.now() - silenceStartRef.current >= timeout * 1000) {
              stopRef.current('silence');
              return;
            }
          } else {
            silenceStartRef.current = null;
          }
        }
      }
      levelRafRef.current = requestAnimationFrame(loop);
    };
    levelRafRef.current = requestAnimationFrame(loop);
  };

  // WAV conversion (same as useAudioRecorder)
  const buildWav = (chunks: Float32Array[]): Blob => {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf   = new ArrayBuffer(44 + total * 2);
    const view  = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, buf.byteLength - 8, true);
    ws(8, 'WAVE'); ws(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRateRef.current, true); view.setUint32(28, sampleRateRef.current * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ws(36, 'data'); view.setUint32(40, total * 2, true);
    let off = 44;
    for (const c of chunks) {
      for (let i = 0; i < c.length; i++) {
        const s = Math.max(-1, Math.min(1, c[i]));
        view.setInt16(off, s < 0 ? s * 32768 : s * 32767, true); off += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      chunksRef.current = [];
      collectingRef.current = false;
      silenceStartRef.current = null;
      abortedRef.current = false;
      setNotice('');
      setPhase('preparing');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        },
      });
      if (abortedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;
      sampleRateRef.current = ctx.sampleRate;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Boost quiet voices so the user doesn't need to shout
      const gain = ctx.createGain();
      gain.gain.value = 2.5;
      gainRef.current = gain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      // Capture amplified signal so WAV and QC both see the boosted level.
      // Во время обратного отсчёта сэмплы отбрасываются.
      processor.onaudioprocess = e => {
        if (!collectingRef.current) return;
        const d = e.inputBuffer.getChannelData(0);
        const b = new Float32Array(d.length); b.set(d);
        chunksRef.current.push(b);
      };

      // Chain: mic → gain → analyser (VU meter)
      //                   → processor (WAV capture) → destination (required by Web Audio)
      source.connect(gain);
      gain.connect(analyser);
      gain.connect(processor);
      processor.connect(ctx.destination);

      // Микрофон уже открыт — считаем 3-2-1 на живом входе, затем начинаем запись.
      setLevel(0); setElapsed(0); setCountdown(COUNT_IN_SECONDS); setPhase('countdown');
      startLevelLoop();
      let remaining = COUNT_IN_SECONDS;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) { setCountdown(remaining); return; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        chunksRef.current = [];
        collectingRef.current = true;
        startTimeRef.current = Date.now();
        setElapsed(0); setPhase('recording');
        timerRef.current = setInterval(() => {
          const ms = Date.now() - startTimeRef.current;
          setElapsed(ms);
          // «А» останавливается само на максимуме длительности
          if (durationRule.autoStopAtMax && ms >= durationRule.max * 1000) stopRef.current();
        }, 100);
      }, 1000);
    } catch {
      setPhase('idle');
      alert(STRINGS.RECORDING_MIC_ERROR);
    }
  };

  const cancelCountdown = () => {
    abortedRef.current = true;
    stopTimer();
    stopHardware();
    collectingRef.current = false;
    setLevel(0); setPhase('idle');
  };

  const stopRecording = async (reason?: 'silence') => {
    stopTimer();
    collectingRef.current = false;
    const samples = chunksRef.current.reduce((n, c) => n + c.length, 0);
    const rawSec = samples / sampleRateRef.current;
    // На максимуме обрезаем до лимита: запись, чуть вышедшая за предел, принимается
    const dur = durationRule.autoStopAtMax ? Math.min(rawSec, durationRule.max) : rawSec;
    setDuration(dur);
    setLevel(0);
    stopHardware();
    const wavBlob = buildWav(chunksRef.current);
    const url = URL.createObjectURL(wavBlob);
    setBlob(wavBlob); setAudioUrl(url);
    if (reason === 'silence') {
      setNotice(`Запись остановлена: более ${durationRule.silenceTimeout} сек. тишины. Прослушайте и сохраните или перезапишите.`);
    }
    setPhase('qc');
    const result = await analyzeAudio(wavBlob, durationRule.min, durationRule.max);
    setQcResult(result);
  };
  stopRef.current = stopRecording;

  const handleRerecord = () => {
    audioElRef.current?.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setBlob(null); setQcResult(null);
    setElapsed(0); setLevel(0); setNotice(''); setPhase('idle');
  };

  const handleSave = async () => {
    if (!blob || !qcResult) return;
    setSaveErr('');
    setPhase('saving');
    try {
      await onSave(task, blob, duration, qcResult);
    } catch {
      setSaveErr(STRINGS.RECORDING_SAVE_ERROR);
      setPhase('qc');
    }
  };

  const handleListen = () => {
    if (!audioUrl) return;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }
    const a = new Audio(audioUrl);
    audioElRef.current = a;
    a.play();
  };

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // VU bar color
  const vuColor = level > QC_RULES.LEVEL_HIGH_MIN ? 'bg-red-500' : level > QC_RULES.LEVEL_LOW_MAX ? 'bg-green-500' : 'bg-amber-400';
  const vuLevelText = level > QC_RULES.LEVEL_HIGH_MIN
    ? STRINGS.RECORDING_LEVEL_HIGH
    : level > QC_RULES.LEVEL_LOW_MAX
    ? STRINGS.RECORDING_LEVEL_OK
    : STRINGS.RECORDING_LEVEL_LOW;

  const qcMsg = qcResult && !qcResult.passed && qcResult.code
    ? {
        'LQC-DUR':  STRINGS.QC_FAIL_DUR_MIN(durationRule.min),
        'LQC-LONG': STRINGS.QC_FAIL_DUR_MAX(durationRule.max),
        'LQC-SIL': STRINGS.QC_FAIL_SIL,
        'LQC-CLIP': STRINGS.QC_FAIL_CLIP,
        'LQC-LOW':  STRINGS.QC_FAIL_LOW,
      }[qcResult.code] ?? 'Ошибка QC'
    : '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Навигация */}
      <div className="border-b border-[#e9ebfc] bg-white px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} disabled={phase === 'recording' || phase === 'saving'} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">{task.label}</h1>
          <p className="text-xs text-gray-400">{STRINGS.RECORDING_TITLE}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 flex flex-col items-center px-5 py-6 gap-5">
        {/* Подсказка приватности */}
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{STRINGS.RECORDING_HINT_PRIVACY}</p>
        </div>

        {/* Задание: инструкция и стимульный материал (как в brainphone-pro) */}
        <div className="w-full rounded-xl border border-[#e9ebfc] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col items-center gap-4">
            {stimulus.image && (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                className="group relative flex w-full justify-center overflow-hidden rounded-lg border border-gray-200 bg-white"
                aria-label="Увеличить картинку"
              >
                <img src={stimulus.image} alt={stimulus.imageAlt} className="max-h-[45vh] w-full object-contain" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-5 w-5 text-white" />
                </span>
              </button>
            )}
            <p className="w-full text-base font-medium leading-6 text-gray-900">{stimulus.instruction}</p>
          </div>
          {stimulus.text && (
            <p className="rounded-lg bg-gray-50 p-4 text-base leading-relaxed text-gray-800">{stimulus.text}</p>
          )}
          {stimulus.rules && (
            <div className="space-y-1.5 rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-700">{stimulus.rulesTitle}</p>
              <ul className="space-y-1">
                {stimulus.rules.map(r => (
                  <li key={r} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            {stimulus.stopHint && <span>{stimulus.stopHint}</span>}
            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              Длительность: {durationRule.min}–{durationRule.max} сек.
            </span>
          </div>
        </div>

        {/* Большой таймер / обратный отсчёт */}
        <div className="text-center">
          {phase === 'preparing' ? (
            <p className="text-base font-medium text-gray-600 py-6">Открываем микрофон…</p>
          ) : phase === 'countdown' ? (
            <>
              <div className="text-7xl font-bold text-blue-500 tabular-nums">{countdown}</div>
              <p className="text-sm text-gray-600 mt-2">Приготовьтесь говорить…</p>
            </>
          ) : (
            <>
              <div className="text-6xl font-mono font-bold text-gray-900 tabular-nums">
                {phase === 'stopped' || phase === 'qc' || phase === 'saving'
                  ? fmtTime(duration * 1000)
                  : fmtTime(elapsed)}
              </div>
              {duration > 0 && (
                <p className="text-xs text-gray-400 mt-1">{duration.toFixed(1)} сек.</p>
              )}
            </>
          )}
          {phase === 'recording' && (
            <div className="mt-3 w-64 mx-auto space-y-1.5">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${elapsed / 1000 >= durationRule.min ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, (elapsed / 1000 / durationRule.max) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {elapsed / 1000 >= durationRule.min
                  ? 'Минимум набран'
                  : `Ещё ${Math.ceil(durationRule.min - elapsed / 1000)} сек. до минимума`}
                {durationRule.autoStopAtMax && ` · остановится на ${durationRule.max} сек.`}
              </p>
            </div>
          )}
        </div>

        {/* VU meter — показывается только во время записи */}
        {(phase === 'recording' || phase === 'countdown') && (
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Уровень звука</span>
              <span className={`text-xs font-medium ${
                level > QC_RULES.LEVEL_HIGH_MIN ? 'text-red-600' : level > QC_RULES.LEVEL_LOW_MAX ? 'text-green-600' : 'text-amber-500'
              }`}>{vuLevelText}</span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${vuColor}`}
                style={{ width: `${Math.min(100, level * 300)}%` }}
              />
            </div>
            {/* Пульс иконки микрофона */}
            <div className="flex justify-center mt-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
                <div className="relative w-14 h-14 bg-red-600 rounded-full flex items-center justify-center">
                  <Mic className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QC-модалка (E9) — после остановки */}
        {(phase === 'qc' || phase === 'saving') && qcResult && (
          <div className={`w-full rounded-2xl p-5 border ${qcResult.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              {qcResult.passed
                ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                : <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />}
              <div>
                <p className={`font-semibold text-sm ${qcResult.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {qcResult.passed ? STRINGS.QC_PASS : STRINGS.QC_TITLE}
                </p>
                {!qcResult.passed && <p className="text-xs text-red-600 mt-1">{qcMsg}</p>}
              </div>
            </div>
          </div>
        )}

        {notice && (phase === 'qc' || phase === 'saving') && (
          <p className="w-full rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{notice}</p>
        )}

        {saveErr && <p className="text-xs text-red-500 text-center">{saveErr}</p>}

        {/* Кнопки управления */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {phase === 'idle' && (
            <button onClick={startRecording} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Mic className="w-5 h-5" /> {STRINGS.RECORDING_BTN_START}
            </button>
          )}

          {(phase === 'preparing' || phase === 'countdown') && (
            <button onClick={cancelCountdown} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-medium text-sm">
              Отмена
            </button>
          )}

          {phase === 'recording' && (
            <button onClick={() => stopRecording()} className="w-full bg-gray-800 hover:bg-gray-900 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Square className="w-5 h-5" /> {STRINGS.RECORDING_BTN_STOP}
            </button>
          )}

          {(phase === 'qc' || phase === 'saving') && (
            <>
              <button onClick={handleListen} disabled={phase === 'saving'} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                <Play className="w-4 h-4" /> {STRINGS.RECORDING_BTN_LISTEN}
              </button>
              <button onClick={handleRerecord} disabled={phase === 'saving'} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> {STRINGS.RECORDING_BTN_RERECORD}
              </button>
              {/* Сохранить — всегда доступно (если QC провален, но разрешено оставить как есть — показываем) */}
              {(qcResult?.passed || qcResult?.canKeep) && (
                <button onClick={handleSave} disabled={phase === 'saving'} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                  {phase === 'saving'
                    ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
                    : <><CheckCircle2 className="w-5 h-5" /> {STRINGS.RECORDING_BTN_SAVE}</>}
                </button>
              )}
              {/* Перезапись обязательна */}
              {!qcResult?.passed && !qcResult?.canKeep && (
                <p className="text-xs text-center text-red-600 font-medium">
                  Эту запись нельзя сохранить — перезапишите
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {zoomed && stimulus.image && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoomed(false)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/90 p-2" aria-label="Закрыть">
            <X className="h-5 w-5 text-gray-800" />
          </button>
          <img src={stimulus.image} alt={stimulus.imageAlt} className="max-h-full max-w-full rounded-xl bg-white object-contain" />
        </div>
      )}
    </div>
  );
}
