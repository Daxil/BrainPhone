// Офлайн-очередь отправки кейсов.
// Хранит patientId → отправляет при восстановлении сети.
import { OFFLINE_QUEUE_KEY } from '../constants/statuses';

interface QueueEntry {
  patientId: string;
  queuedAt: string;
  attempts: number;
}

function loadQueue(): QueueEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: QueueEntry[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

export function enqueue(patientId: string) {
  const q = loadQueue();
  if (!q.find(e => e.patientId === patientId)) {
    q.push({ patientId, queuedAt: new Date().toISOString(), attempts: 0 });
    saveQueue(q);
  }
}

export function dequeue(patientId: string) {
  saveQueue(loadQueue().filter(e => e.patientId !== patientId));
}

export function getQueue(): QueueEntry[] {
  return loadQueue();
}

export function isQueued(patientId: string): boolean {
  return loadQueue().some(e => e.patientId === patientId);
}

/** Слушает восстановление сети и вызывает submitFn для каждого кейса в очереди. */
export function startQueueProcessor(
  submitFn: (patientId: string) => Promise<boolean>,
) {
  const process = async () => {
    if (!navigator.onLine) return;
    const q = loadQueue();
    for (const entry of q) {
      try {
        const ok = await submitFn(entry.patientId);
        if (ok) dequeue(entry.patientId);
      } catch {
        /* оставляем в очереди */
      }
    }
  };

  window.addEventListener('online', process);
  // При старте тоже пробуем (если были в очереди до перезапуска)
  process();

  return () => window.removeEventListener('online', process);
}
