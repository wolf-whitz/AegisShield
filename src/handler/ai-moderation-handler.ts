import { Client, Message, TextChannel } from 'discord.js';
import { redis, queueMessageForModeration, processModerationBatch, getQueueLength } from '@utils';
import { getOrCreateServerSettings, logAIModeration } from '@bot/database';
import { moderateContent } from '@utils';

interface QueuedMessage {
  messageId: string;
  userId: string;
  username: string;
  content: string;
  serverId: string;
  channelId: string;
  timestamp: number;
}

const QUEUE_THRESHOLD = 5;
const BATCH_SIZE = 10;
const PROCESS_INTERVAL = 2000;

export class AIModerationHandler {
  private isProcessing: boolean = false;

  constructor(client: Client) {
    this.setupListener(client);
    this.setupActionSubscriber(client);
    this.startBatchProcessor(client);
  }

  private setupListener(client: Client): void {
    client.on('messageCreate', async (message: Message) => {
      if (message.author.bot || !message.guild) return;

      const settings = await getOrCreateServerSettings(message.guild.id);
      if (!settings.ai_moderation_enabled) return;

      const queueLength = await getQueueLength();

      if (queueLength >= QUEUE_THRESHOLD) {
        const queueItem: QueuedMessage = {
          messageId: message.id,
          userId: message.author.id,
          username: message.author.tag,
          content: message.content,
          serverId: message.guild.id,
          channelId: message.channel.id,
          timestamp: Date.now(),
        };
        await queueMessageForModeration(queueItem);
      } else {
        const result = await moderateContent(message.content);
        
        if (result.severity >= (settings.ai_moderation_threshold || 0.8)) {
          await this.handleViolation(message, result, settings);
        }
      }
    });
  }

  private async handleViolation(
    message: Message, 
    result: any, 
    settings: any
  ): Promise<void> {
    let action: 'delete' | 'warn' | 'timeout' = 'delete';
    if (result.severity > 0.95) action = 'timeout';
    else if (result.severity > 0.9) action = 'timeout';
    else if (result.severity > 0.85) action = 'warn';

    await logAIModeration({
      server_id: message.guild!.id,
      user_id: message.author.id,
      username: message.author.tag,
      message_content: message.content.slice(0, 1000),
      flagged_categories: result.categories,
      severity_score: result.severity,
      action_taken: action,
    });

    await redis.publish('moderation:actions', JSON.stringify({
      messageId: message.id,
      channelId: message.channel.id,
      userId: message.author.id,
      action,
      reason: result.categories.join(', '),
      severity: result.severity,
    }));
  }

  private setupActionSubscriber(client: Client): void {
    const subscriber = redis.duplicate();
    
    subscriber.subscribe('moderation:actions', (err) => {
      if (err) console.error('Failed to subscribe to moderation actions:', err);
    });

    subscriber.on('message', async (channel, message) => {
      if (channel !== 'moderation:actions') return;
      
      const action = JSON.parse(message);
      await this.executeAction(client, action);
    });
  }

  private startBatchProcessor(client: Client): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      
      const queueLength = await getQueueLength();
      if (queueLength === 0) return;

      this.isProcessing = true;
      await processModerationBatch();
      this.isProcessing = false;
    }, PROCESS_INTERVAL);
  }

  private async executeAction(
    client: Client,
    action: {
      messageId: string;
      channelId: string;
      userId: string;
      action: 'delete' | 'warn' | 'mute';
      reason: string;
      severity: number;
    }
  ): Promise<void> {
    const channel = await client.channels.fetch(action.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;

    switch (action.action) {
      case 'delete': {
        const message = await textChannel.messages.fetch(action.messageId).catch(() => null);
        if (message) {
          await message.delete().catch(() => null);
        }
        break;
      }
      case 'warn': {
        const message = await textChannel.messages.fetch(action.messageId).catch(() => null);
        if (message) {
          await message.reply({
            content: `⚠️ <@${action.userId}> Your message was flagged for: ${action.reason}`,
            allowedMentions: { users: [action.userId] }
          }).catch(() => null);
          await message.delete().catch(() => null);
        }
        break;
      }
      case 'mute': {
        const member = await textChannel.guild.members.fetch(action.userId).catch(() => null);
        if (member) {
          const duration = this.getMuteDuration(action.severity);
          await member.timeout(duration, `AI Moderation: ${action.reason}`).catch(() => null);
          
          await textChannel.send(
            `🔇 <@${action.userId}> has been muted for ${this.formatDuration(duration)}. (${action.reason})`
          ).catch(() => null);
        }
        
        const message = await textChannel.messages.fetch(action.messageId).catch(() => null);
        if (message) await message.delete().catch(() => null);
        break;
      }
    }
  }

  private getMuteDuration(severity: number): number {
    if (severity > 0.95) return 24 * 60 * 60 * 1000; 
    if (severity > 0.9) return 6 * 60 * 60 * 1000;  
    if (severity > 0.85) return 60 * 60 * 1000;    
    return 10 * 60 * 1000;                            
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}