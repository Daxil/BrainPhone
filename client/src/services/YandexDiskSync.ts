const API_BASE_URL = 'http://localhost:3001/api';

export interface PendingUpload {
  id: string;
  patient_id: string;
  recording_type: string;
  recording_label: string;
  file_path: string;
  duration: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retry_count: number;
}

class YandexDiskSyncService {
  private pendingQueue: PendingUpload[] = [];
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;

  constructor() {
    this.initNetworkListener();
    this.loadPendingQueue();
  }

  private initNetworkListener() {
    window.addEventListener('online', () => {
      console.log(' Сеть доступна, начинаю синхронизацию...');
      this.isOnline = true;
      this.syncPendingUploads();
    });

    window.addEventListener('offline', () => {
      console.log(' Сеть недоступна, откладываю синхронизацию');
      this.isOnline = false;
    });
  }

  private loadPendingQueue() {
    const stored = localStorage.getItem('yandex_pending_uploads');
    if (stored) {
      this.pendingQueue = JSON.parse(stored);
      console.log(' Загружено отложенных загрузок:', this.pendingQueue.length);
      if (this.isOnline) {
        this.syncPendingUploads();
      }
    }
  }

  private savePendingQueue() {
    localStorage.setItem('yandex_pending_uploads', JSON.stringify(this.pendingQueue));
  }

  public addPendingUpload(upload: PendingUpload) {
    console.log(' Добавлено в очередь:', upload);
    this.pendingQueue.push(upload);
    this.savePendingQueue();
    if (this.isOnline && !this.isSyncing) {
      this.syncPendingUploads();
    }
  }

  public async syncPendingUploads() {
    if (!this.isOnline || this.isSyncing || this.pendingQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    console.log(' Начало синхронизации:', this.pendingQueue.length, 'файлов');

    const pending = this.pendingQueue.filter(u => u.status === 'pending');

    for (const upload of pending) {
      try {
        upload.status = 'uploading';
        this.savePendingQueue();

        console.log(' Загрузка на Яндекс.Диск:', upload.recording_type);

        const response = await fetch(API_BASE_URL + '/patients/sync-yandex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: upload.patient_id,
            recording_type: upload.recording_type,
            recording_label: upload.recording_label,
            duration: upload.duration,
          }),
        });

        const result = await response.json();

        if (result.success) {
          upload.status = 'completed';
          console.log(' Загружено на Яндекс.Диск:', upload.recording_type);
        } else {
          upload.status = 'pending';
          upload.retry_count = (upload.retry_count || 0) + 1;
          console.warn(' Не удалось загрузить:', upload.recording_type, 'Попытка:', upload.retry_count);
        }

        this.savePendingQueue();
      } catch (error) {
        upload.status = 'pending';
        upload.retry_count = (upload.retry_count || 0) + 1;
        console.error(' Ошибка синхронизации:', upload.recording_type, error);
        this.savePendingQueue();
      }

      // Небольшая задержка между загрузками
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Очищаем завершённые
    this.pendingQueue = this.pendingQueue.filter(u => u.status !== 'completed');
    this.savePendingQueue();
    this.isSyncing = false;

    console.log(' Синхронизация завершена');
  }

  public getPendingCount(): number {
    return this.pendingQueue.filter(u => u.status === 'pending').length;
  }
}

export const yandexDiskSync = new YandexDiskSyncService();
