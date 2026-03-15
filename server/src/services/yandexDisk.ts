import axios from 'axios';
import * as fs from 'fs';

const YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk/resources';
const TOKEN = process.env.YANDEX_DISK_TOKEN || '';
const BASE_FOLDER = process.env.YANDEX_DISK_FOLDER || '/BrainPhone/Audio';

export interface YandexDiskUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export async function uploadToYandexDisk(
  filePath: string,
  fileName: string,
  recordingType: string,
  mimeType: string = 'audio/wav'
): Promise<YandexDiskUploadResult> {
  try {
    if (!TOKEN) {
      console.error('YANDEX_DISK_TOKEN не настроен');
      return { success: false, error: 'Yandex Disk token not configured' };
    }

    const folderPath = BASE_FOLDER + '/' + recordingType;
    const diskPath = folderPath + '/' + fileName;

    console.log('Загрузка на Яндекс.Диск:', diskPath);

    // Шаг 1: Получаем URL для загрузки
    const getUploadUrl = await axios.get(YANDEX_DISK_API + '/upload', {
      headers: {
        'Authorization': 'OAuth ' + TOKEN,
      },
      params: {
        path: diskPath,
        overwrite: 'true',
      },
    });

    const uploadUrl = getUploadUrl.data.href;
    console.log('URL для загрузки:', uploadUrl);

    // Шаг 2: Загружаем файл
    const fileBuffer = fs.readFileSync(filePath);
    console.log('Размер файла:', fileBuffer.length);

    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        'Content-Type': mimeType,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('Файл загружен на Яндекс.Диск');

    const getPublicLink = await axios.post(
      YANDEX_DISK_API + '/publish',
      {},
      {
        headers: {
          'Authorization': 'OAuth ' + TOKEN,
        },
        params: {
          path: diskPath,
        },
      }
    );

    const publicUrl = getPublicLink.data.public_url;
    console.log('Публичная ссылка:', publicUrl);

    return { success: true, publicUrl: publicUrl };

  } catch (error: any) {
    console.error('Ошибка загрузки на Яндекс.Диск:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
    };
  }
}
