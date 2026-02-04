export interface AudioConfig {
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
}

export function convertToWAV(audioBuffer: AudioBuffer, config: AudioConfig = {
  sampleRate: 48000,
  bitsPerSample: 16,
  channels: 1
}): Blob {
  const numOfChan = config.channels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channelsData: Float32Array[] = [];

  for (let i = 0; i < numOfChan; i++) {
    channelsData.push(audioBuffer.getChannelData(i));
  }

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
  view.setUint32(24, config.sampleRate, true);
  view.setUint32(28, config.sampleRate * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, config.bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length - 44, true);

  floatTo16BitPCM(view, 44, interleave(channelsData));

  return new Blob([view], { type: 'audio/wav' });
}

function interleave(input: Float32Array[]): Float32Array {
  const length = input[0].length;
  const result = new Float32Array(length * input.length);

  if (input.length === 1) {
    for (let i = 0; i < length; i++) {
      result[i] = input[0][i];
    }
  } else {
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < input.length; channel++) {
        result[i * input.length + channel] = input[channel][i];
      }
    }
  }

  return result;
}

export async function recordAudioWAV(
  stream: MediaStream,
  duration: number = 10000,
  config: AudioConfig = { sampleRate: 48000, bitsPerSample: 16, channels: 1 }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, config.channels, config.channels);

    const audioBuffers: Float32Array[] = [];
    let totalLength = 0;

    processor.onaudioprocess = (e) => {
      const inputBuffer = e.inputBuffer;
      const channelData = inputBuffer.getChannelData(0);
      const buffer = new Float32Array(channelData.length);
      buffer.set(channelData);
      audioBuffers.push(buffer);
      totalLength += buffer.length;
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    setTimeout(async () => {
      source.disconnect();
      processor.disconnect();

      const audioBuffer = audioContext.createBuffer(
        config.channels,
        totalLength,
        config.sampleRate
      );

      let offset = 0;
      for (const buffer of audioBuffers) {
        audioBuffer.copyToChannel(buffer, 0, offset);
        offset += buffer.length;
      }

      const wavBlob = convertToWAV(audioBuffer, config);
      audioContext.close();
      resolve(wavBlob);
    }, duration);
  });
}

export async function recordAudioSimple(
  config: AudioConfig = { sampleRate: 48000, bitsPerSample: 16, channels: 1 }
): Promise<{ blob: Blob; url: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = 'audio/webm;codecs=opus';
    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    const audioChunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        resolve({ blob: audioBlob, url: audioUrl });

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (error) => {
        reject(error);
      };

      mediaRecorder.start();

      return {
        stop: () => mediaRecorder.stop(),
        pause: () => mediaRecorder.pause(),
        resume: () => mediaRecorder.resume()
      };
    });
  } catch (error) {
    console.error('Error recording audio:', error);
    throw error;
  }
}

export function getAudioInfo(blob: Blob): Promise<{ duration: number; size: number }> {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.addEventListener('loadedmetadata', () => {
      resolve({
        duration: audio.duration,
        size: blob.size
      });
    });
  });
}
