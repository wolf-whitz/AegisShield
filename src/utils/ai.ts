import {redis} from './redis';

const CACHE_TTL = 3600;

export async function getCachedSwearWords(): Promise<string[]> {
  const cached = await redis.get('swear_words');
  if (cached) {
    return JSON.parse(cached);
  }
  return [];
}

export async function cacheSwearWords(words: string[]): Promise<void> {
  await redis.setex('swear_words', CACHE_TTL, JSON.stringify(words));
}

export async function getCachedModerationResult(messageHash: string): Promise<any | null> {
  const cached = await redis.get(`mod:${messageHash}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function cacheModerationResult(messageHash: string, result: any): Promise<void> {
  await redis.setex(`mod:${messageHash}`, CACHE_TTL, JSON.stringify(result));
}

export function generateMessageHash(content: string): string {
  return require('crypto').createHash('md5').update(content.toLowerCase().trim()).digest('hex');
}

interface ModerationQueueItem {
  messageId: string;
  userId: string;
  username: string;
  content: string;
  serverId: string;
  channelId: string;
  timestamp: number;
}

const QUEUE_KEY = 'moderation_queue';
const BATCH_SIZE = 10;

export async function queueMessageForModeration(item: ModerationQueueItem): Promise<void> {
  await redis.lpush(QUEUE_KEY, JSON.stringify(item));
}

export async function getBatchForModeration(): Promise<ModerationQueueItem[]> {
  const batch: ModerationQueueItem[] = [];
  
  for (let i = 0; i < BATCH_SIZE; i++) {
    const item = await redis.rpop(QUEUE_KEY);
    if (!item) break;
    batch.push(JSON.parse(item));
  }
  
  return batch;
}

export async function getQueueLength(): Promise<number> {
  return await redis.llen(QUEUE_KEY);
}