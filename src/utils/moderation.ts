import OpenAI from 'openai';
import { redis } from './redis';
import { 
  getCachedModerationResult, 
  cacheModerationResult, 
  generateMessageHash,
  getBatchForModeration, 
  queueMessageForModeration,
  getQueueLength
} from './ai';
import { getOrCreateServerSettings, logAIModeration } from '@bot/database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  severity: number;
}

interface QueuedMessage {
  messageId: string;
  userId: string;
  username: string;
  content: string;
  serverId: string;
  channelId: string;
  timestamp: number;
}

export async function moderateContent(content: string): Promise<ModerationResult> {
  const hash = generateMessageHash(content);
  const cached = await getCachedModerationResult(hash);

  if (cached) {
    return cached;
  }

  try {
    const response = await openai.moderations.create({
      input: content,
    });

    const result = response.results[0];
    if (!result) {
      return {
        flagged: false,
        categories: [],
        scores: {},
        severity: 0,
      };
    }

    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(result.category_scores)) {
      scores[key] = value;
    }

    const severity = Math.max(...Object.values(scores));
    const flaggedCategories = Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);

    const moderationResult: ModerationResult = {
      flagged: result.flagged,
      categories: flaggedCategories,
      scores,
      severity,
    };

    await cacheModerationResult(hash, moderationResult);
    return moderationResult;
  } catch (error) {
    console.error('OpenAI moderation error:', error);
    return {
      flagged: false,
      categories: [],
      scores: {},
      severity: 0,
    };
  }
}

export async function processModerationBatch(): Promise<void> {
  const queueLength = await getQueueLength();
  
  if (queueLength === 0) {
    return;
  }

  
  const batch = await getBatchForModeration();
  
  if (batch.length === 0) {
    return;
  }

  const contents = batch.map((item: QueuedMessage) => item.content);

  try {
    const response = await openai.moderations.create({
      input: contents,
    });

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (!item) continue;

      const result = response.results[i];
      if (!result) {
        console.error(`[Batch] No moderation result for batch item ${i}`);
        continue;
      }

      const hash = generateMessageHash(item.content);
      
      const scores: Record<string, number> = {};
      for (const [key, value] of Object.entries(result.category_scores)) {
        scores[key] = value;
      }
      
      const severity = Math.max(...Object.values(scores));

      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);

      const moderationResult: ModerationResult = {
        flagged: result.flagged,
        categories: flaggedCategories,
        scores,
        severity,
      };

      await cacheModerationResult(hash, moderationResult);
      await handleModerationResult(item, moderationResult);
    }
    
  } catch (error) {
    console.error('[Batch] Batch moderation error:', error);
    for (const item of batch) {
      if (item) {
        await queueMessageForModeration(item);
      }
    }
  }
}

async function handleModerationResult(
  item: QueuedMessage,
  result: ModerationResult
): Promise<void> {
  const settings = await getOrCreateServerSettings(item.serverId);

  if (!settings.ai_moderation_enabled) {
    return;
  }

  const threshold = settings.ai_moderation_threshold || 0.8;

  if (result.severity < threshold) {
    return;
  }

  let action: 'delete' | 'warn' | 'timeout' = 'delete';

  if (result.severity > 0.95) action = 'timeout';
  else if (result.severity > 0.9) action = 'timeout';
  else if (result.severity > 0.85) action = 'warn';
  else action = 'delete';

  await logAIModeration({
    server_id: item.serverId,
    user_id: item.userId,
    username: item.username,
    message_content: item.content.slice(0, 1000),
    flagged_categories: result.categories,
    severity_score: result.severity,
    action_taken: action,
  });

  await redis.publish('moderation:actions', JSON.stringify({
    messageId: item.messageId,
    channelId: item.channelId,
    userId: item.userId,
    action,
    reason: result.categories.join(', '),
    severity: result.severity,
  }));
}