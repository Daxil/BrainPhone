import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Тот же Yandex Object Storage, что и в patientController (аудио + data.json кейсов).
export const s3Client = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export const AUDIO_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'brainphone-audio';
export const S3_CONFIGURED = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: string | null;
}

/** Все объекты под префиксом (с пагинацией ListObjectsV2). */
export async function listAllObjects(bucket: string, prefix: string, limit = 50_000): Promise<S3ObjectInfo[]> {
  const out: S3ObjectInfo[] = [];
  let token: string | undefined;
  do {
    const page = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of page.Contents ?? []) {
      if (!o.Key || o.Key.endsWith('/')) continue;
      out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified?.toISOString() ?? null });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && out.length < limit);
  return out;
}

/** Presigned GET с коротким TTL — бакет приватный. */
export async function presignGet(bucket: string, key: string, ttlSeconds = 15 * 60): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttlSeconds });
}

/** Прочитать небольшой JSON-объект (анкета data.json). null, если нет или слишком большой. */
export async function readJsonObject(bucket: string, key: string, maxBytes = 1024 * 1024): Promise<unknown | null> {
  try {
    const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if ((obj.ContentLength ?? 0) > maxBytes) return null;
    const text = await obj.Body?.transformToString('utf-8');
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function headObject(bucket: string, key: string): Promise<{ size: number } | null> {
  try {
    const h = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: h.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

/** Скопировать объект в корзину (`trash/…`) перед удалением. */
export async function copyToTrash(bucket: string, key: string): Promise<string> {
  const trashKey = `trash/${key}`;
  await s3Client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: trashKey,
    CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
  }));
  return trashKey;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
