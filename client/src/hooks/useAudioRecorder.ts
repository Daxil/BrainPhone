import { useState, useRef, useEffect } from 'react';

interface AudioRecorderOptions {
  sampleRate?: number;
  bitsPerSample?: number;
  channels?: number;
}

interface AudioData {
  blob: Blob | null;
  url: string | null;
  duration: number;
}

export const useAudioRecorder = ({
  sampleRate = 48000,
  bitsPerSample = 16,
  channels = 1,
}: AudioRecorderOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioData, setAudioData] = useState<AudioData>({
    blob: null,
    url: null,
    duration: 0,
  });
  const [recordingTime, setRecordingTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const currentTimeRef = useRef(0);
  const isPausedRef = useRef(false);

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioData.url) {
        URL.revokeObjectURL(audioData.url);
      }
    };
  }, []);

  const convertToWAV = (audioBuffer: Float32Array[], sampleRate: number, channels: number): Blob => {
    const numOfChan = channels;
    const totalLength = audioBuffer.reduce((acc, buf) => acc + buf.length, 0);
    const length = totalLength * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const floatTo16BitPCM = (view: DataView, offset: number, input: Float32Array) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length - 44, true);

    const interleaved = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of audioBuffer) {
      interleaved.set(buffer, offset);
      offset += buffer.length;
    }

    floatTo16BitPCM(view, 44, interleaved);

    return new Blob([view], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      console.log('Начало записи аудио (WAV)...');

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      audioChunksRef.current = [];
      setAudioData({ blob: null, url: null, duration: 0 });
      elapsedBeforePauseRef.current = 0;
      currentTimeRef.current = 0;
      isPausedRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      console.log('Микрофон доступен');

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const scriptProcessor = audioContext.createScriptProcessor(4096, channels, channels);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (isPausedRef.current) return;

        const inputBuffer = event.inputBuffer;
        const channelData = inputBuffer.getChannelData(0);
        const buffer = new Float32Array(channelData.length);
        buffer.set(channelData);
        audioChunksRef.current.push(buffer);
        console.log('Аудио-чанк WAV получен, размер:', buffer.length);
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      setIsRecording(true);
      setIsPaused(false);

      startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        currentTimeRef.current = elapsed;
        setRecordingTime(elapsed);
      }, 100);

      console.log('Запись WAV начата');
    } catch (error) {
      console.error('Ошибка при начале записи:', error);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  };

  const pauseRecording = () => {
    if (isRecording && !isPaused) {
      console.log('Пауза записи');
      isPausedRef.current = true;
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      elapsedBeforePauseRef.current = currentTimeRef.current;
    }
  };

  const resumeRecording = () => {
    if (isRecording && isPaused) {
      console.log('Возобновление записи');
      isPausedRef.current = false;
      setIsPaused(false);
      startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        currentTimeRef.current = elapsed;
        setRecordingTime(elapsed);
      }, 100);
    }
  };

  const stopRecording = () => {
    console.log('Остановка записи');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);

    if (audioChunksRef.current.length > 0) {
      const wavBlob = convertToWAV(audioChunksRef.current, sampleRate, channels);
      const wavUrl = URL.createObjectURL(wavBlob);

      const duration = currentTimeRef.current / 1000;

      console.log('Аудио WAV записано:', {
        размер: wavBlob.size,
        длительность: duration,
        url: wavUrl,
        тип: 'audio/wav'
      });

      setAudioData({
        blob: wavBlob,
        url: wavUrl,
        duration: duration,
      });
    }

    audioChunksRef.current = [];
  };

  const resetRecording = () => {
    console.log('Сброс записи');
    stopRecording();
    setAudioData({ blob: null, url: null, duration: 0 });
    setRecordingTime(0);
    elapsedBeforePauseRef.current = 0;
    currentTimeRef.current = 0;
    if (audioData.url) {
      URL.revokeObjectURL(audioData.url);
    }
  };

  return {
    isRecording,
    isPaused,
    audioData: audioData.blob ? audioData : null,
    recordingTime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
};
