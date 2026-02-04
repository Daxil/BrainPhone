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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioData.url) {
        URL.revokeObjectURL(audioData.url);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('Начало записи аудио...');

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      audioChunksRef.current = [];
      setAudioData({ blob: null, url: null, duration: 0 });
      elapsedBeforePauseRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('Микрофон доступен');

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Аудио-чанк получен, размер:', event.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Запись остановлена');

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);

          // Создаем аудио-элемент для определения длительности
          const audio = new Audio(audioUrl);

          // Устанавливаем разумный таймаут для загрузки метаданных
          const timeoutPromise = new Promise<number>((resolve) => {
            setTimeout(() => {
              console.warn('Таймаут загрузки метаданных, используем recorded time');
              resolve(currentTimeRef.current / 1000);
            }, 1500);
          });

          // Загружаем метаданные
          const metadataPromise = new Promise<number>((resolve) => {
            audio.onloadedmetadata = () => {
              let duration = audio.duration;

              // Проверяем корректность длительности
              if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
                console.warn('Некорректная длительность из метаданных, используем recorded time');
                duration = currentTimeRef.current / 1000;
              }

              console.log('Длительность аудио:', duration);
              resolve(duration);
            };

            audio.onerror = () => {
              console.warn('Ошибка загрузки аудио, используем recorded time');
              resolve(currentTimeRef.current / 1000);
            };

            audio.load();
          });

          // Ждем либо метаданные, либо таймаут
          const duration = await Promise.race([metadataPromise, timeoutPromise]);

          console.log('Аудио записано:', {
            размер: audioBlob.size,
            длительность: duration,
            url: audioUrl
          });

          setAudioData({
            blob: audioBlob,
            url: audioUrl,
            duration: duration,
          });

          // Очищаем аудио-элемент
          audio.remove();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);

      startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        currentTimeRef.current = elapsed;
        setRecordingTime(elapsed);
      }, 100);

      console.log('Запись начата');
    } catch (error) {
      console.error('Ошибка при начале записи:', error);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('Пауза записи');
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      elapsedBeforePauseRef.current = currentTimeRef.current;
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      console.log('Возобновление записи');
      mediaRecorderRef.current.resume();
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

    if (mediaRecorderRef.current &&
        ['recording', 'paused'].includes(mediaRecorderRef.current.state)) {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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

  const currentTimeRef = useRef<number>(0);

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
