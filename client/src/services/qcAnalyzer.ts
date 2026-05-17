// Локальный контроль качества аудио (E9).
// Анализирует WAV-блоб через Web Audio API.
import { QC_RULES } from '../constants/statuses';
import type { QCResult } from '../constants/statuses';

export type { QCResult };

export async function analyzeAudio(
  blob: Blob,
  minDurationSec?: number,
  isPhoneme = false,
): Promise<QCResult> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      await audioCtx.close();
    }

    const samples = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;

    // LQC-DUR: слишком короткая запись
    const minSec = minDurationSec ?? (isPhoneme ? QC_RULES.PHONEME_MIN_SEC : QC_RULES.SPEECH_MIN_SEC);
    if (duration < minSec) {
      return { passed: false, code: 'LQC-DUR', canKeep: false, canSkip: true };
    }

    // LQC-CLIP: суммарная длина клиппированных участков > 3 с
    let clippedSamples = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) >= QC_RULES.CLIP_SAMPLE_THRESHOLD) clippedSamples++;
    }
    const clippedSec = clippedSamples / sampleRate;
    if (clippedSec > QC_RULES.CLIP_MAX_SEC) {
      return { passed: false, code: 'LQC-CLIP', canKeep: false, canSkip: false };
    }

    // LQC-SIL: доля тишины > 30%
    let silentSamples = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) < QC_RULES.SILENCE_SAMPLE_THRESHOLD) silentSamples++;
    }
    if (silentSamples / samples.length > QC_RULES.SILENCE_MAX_RATIO) {
      return { passed: false, code: 'LQC-SIL', canKeep: false, canSkip: true };
    }

    // LQC-LOW: средний RMS слишком мал
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
    const rms = Math.sqrt(sumSq / samples.length);
    if (rms < QC_RULES.LOW_RMS_THRESHOLD) {
      return { passed: false, code: 'LQC-LOW', canKeep: false, canSkip: false };
    }

    return { passed: true, canKeep: true, canSkip: true };
  } catch {
    // Не блокируем пользователя при сбое анализа
    return { passed: true, canKeep: true, canSkip: true };
  }
}

/** Реального времени: уровень сигнала 0..1 из AnalyserNode. */
export function getRmsLevel(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return Math.sqrt(sumSq / buf.length);
}

/** Хеш SHA-256 строки → hex. */
export async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
