import { 
  Events, 
  EmbedBuilder, 
  Colors, 
  GuildChannel, 
  Webhook,
  GuildMember,
  Role,
  TextChannel,
  PermissionFlagsBits,
  AuditLogEvent
} from 'discord.js';
import type { Client, Guild, User, GuildBan, PartialGuildMember } from 'discord.js';
import { 
  getServer, 
  getLogChannel, 
  logProtectionEvent, 
  getOrCreateServerSettings 
} from '@bot/database';

interface ActionTracker {
  userId: string;
  targetIds: string[];
  timestamps: number[];
}

const channelDeleteMap = new Map<string, ActionTracker>();
const banMap = new Map<string, ActionTracker>();
const kickMap = new Map<string, ActionTracker>();

export class ProtectionHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.ChannelDelete, async (channel) => {
      if (!channel.isDMBased() && 'guild' in channel) {
        await this.handleChannelDelete(channel as GuildChannel);
      }
    });

    client.on(Events.WebhooksUpdate, async (channel) => {
      const webhooks = await (channel as TextChannel).fetchWebhooks().catch(() => null);
      if (webhooks) {
        for (const webhook of webhooks.values()) {
          await this.handleWebhookCreate(webhook);
        }
      }
    });

    client.on(Events.GuildBanAdd, async (ban) => {
      await this.handleGuildBanAdd(ban);
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      if (member instanceof GuildMember) {
        await this.handleGuildMemberRemove(member);
      }
    });
  }

  private async handleChannelDelete(channel: GuildChannel): Promise<void> {
    const guild = channel.guild;
    
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1
    });

    const entry = auditLogs.entries.first();
    if (!entry) return;

    const executor = entry.executor;
    const target = entry.target;
    
    if (!executor || executor.id === guild.members.me?.id) return;
    if (target?.id !== channel.id) return;

    const settings = await getOrCreateServerSettings(guild.id);
    if (!settings.protection_enabled) return;

    const threshold = settings.channel_delete_threshold || 3;
    const key = `${guild.id}-${executor.id}`;
    
    const now = Date.now();
    let tracker = channelDeleteMap.get(key);
    
    if (!tracker) {
      tracker = { userId: executor.id, targetIds: [], timestamps: [] };
      channelDeleteMap.set(key, tracker);
    }

    tracker.targetIds.push(channel.id);
    tracker.timestamps.push(now);

    const oneMinuteAgo = now - 60000;
    const validEntries = tracker.timestamps
      .map((timestamp, index) => ({ timestamp, index }))
      .filter(({ timestamp }) => timestamp > oneMinuteAgo);
    
    tracker.timestamps = validEntries.map(e => e.timestamp);
    tracker.targetIds = validEntries.map(e => tracker.targetIds[e.index]).filter((id): id is string => id !== undefined);

    if (tracker.targetIds.length >= threshold) {
      await this.takeAction(guild, executor.id, 'channel_delete', 
        `Deleted ${tracker.targetIds.length} channels in 1 minute`, 
        settings);
      
      channelDeleteMap.delete(key);
    }
  }

  private async handleWebhookCreate(webhook: Webhook): Promise<void> {
    if (!webhook.guildId) return;
    
    const guild = webhook.client.guilds.cache.get(webhook.guildId);
    if (!guild) return;
    
    const settings = await getOrCreateServerSettings(webhook.guildId);
    if (!settings.webhook_monitor_enabled) return;

    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.WebhookCreate,
      limit: 1
    });

    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor) return;

    await this.logEvent(guild, {
      userId: entry.executor.id,
      username: entry.executor.tag ?? 'Unknown',
      actionType: 'webhook_create',
      details: `Created webhook "${webhook.name}" in ${(webhook.channel as TextChannel)?.name || 'unknown channel'}`,
      actionTaken: 'Logged for monitoring'
    });
  }

  private async handleGuildBanAdd(ban: GuildBan): Promise<void> {
    const guild = ban.guild;
    
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 5
    });

    const entry = auditLogs.entries.find(e => e.target?.id === ban.user.id);
    if (!entry || !entry.executor) return;
    if (entry.executor.id === guild.members.me?.id) return;

    const settings = await getOrCreateServerSettings(guild.id);
    if (!settings.protection_enabled) return;

    const threshold = 3;
    const timeWindow = 60000;
    const key = `${guild.id}-${entry.executor.id}`;
    
    const now = Date.now();
    let tracker = banMap.get(key);
    
    if (!tracker) {
      tracker = { userId: entry.executor.id, targetIds: [], timestamps: [] };
      banMap.set(key, tracker);
    }

    if (!tracker.targetIds.includes(ban.user.id)) {
      tracker.targetIds.push(ban.user.id);
      tracker.timestamps.push(now);
    }

    const timeAgo = now - timeWindow;
    const validEntries = tracker.timestamps
      .map((timestamp, index) => ({ timestamp, index }))
      .filter(({ timestamp }) => timestamp > timeAgo);
    
    tracker.timestamps = validEntries.map(e => e.timestamp);
    tracker.targetIds = validEntries.map(e => tracker.targetIds[e.index]).filter((id): id is string => id !== undefined);

    if (tracker.targetIds.length >= threshold) {
      await this.takeAction(guild, entry.executor.id, 'mass_ban', 
        `Banned ${tracker.targetIds.length} users in 1 minute`, 
        settings);
      
      banMap.delete(key);
    }
  }

  private async handleGuildMemberRemove(member: GuildMember): Promise<void> {
    const guild = member.guild;
    
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 5
    });

    const entry = auditLogs.entries.find(e => e.target?.id === member.id);
    if (!entry || !entry.executor) return;
    if (entry.executor.id === guild.members.me?.id) return;

    const settings = await getOrCreateServerSettings(guild.id);
    if (!settings.protection_enabled) return;

    const threshold = 3;
    const timeWindow = 60000;
    const key = `${guild.id}-${entry.executor.id}`;
    
    const now = Date.now();
    let tracker = kickMap.get(key);
    
    if (!tracker) {
      tracker = { userId: entry.executor.id, targetIds: [], timestamps: [] };
      kickMap.set(key, tracker);
    }

    if (!tracker.targetIds.includes(member.id)) {
      tracker.targetIds.push(member.id);
      tracker.timestamps.push(now);
    }

    const timeAgo = now - timeWindow;
    const validEntries = tracker.timestamps
      .map((timestamp, index) => ({ timestamp, index }))
      .filter(({ timestamp }) => timestamp > timeAgo);
    
    tracker.timestamps = validEntries.map(e => e.timestamp);
    tracker.targetIds = validEntries.map(e => tracker.targetIds[e.index]).filter((id): id is string => id !== undefined);

    if (tracker.targetIds.length >= threshold) {
      await this.takeAction(guild, entry.executor.id, 'mass_kick', 
        `Kicked ${tracker.targetIds.length} users in 1 minute`, 
        settings);
      
      kickMap.delete(key);
    }
  }

  private async takeAction(
    guild: Guild, 
    userId: string, 
    actionType: 'channel_delete' | 'webhook_create' | 'role_delete' | 'mass_ban' | 'mass_kick',
    details: string,
    settings: any
  ): Promise<void> {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const rolesToRemove = member.roles.cache.filter(r => 
      r.permissions.has(PermissionFlagsBits.Administrator) ||
      r.permissions.has(PermissionFlagsBits.ManageChannels) ||
      r.permissions.has(PermissionFlagsBits.ManageGuild) ||
      r.permissions.has(PermissionFlagsBits.BanMembers) ||
      r.permissions.has(PermissionFlagsBits.KickMembers)
    );

    const removedRoles: string[] = [];
    
    for (const [roleId, role] of rolesToRemove) {
      try {
        await member.roles.remove(role);
        removedRoles.push(role.name);
      } catch (error: any) {
        console.error(`Failed to remove role ${role.name}:`, error);
      }
    }

    try {
      await member.timeout(3600000, 'AegisShield: Anti-abuse protection triggered');
    } catch (error: any) {
      console.error('Failed to timeout member:', error);
    }

    const actionTaken = removedRoles.length > 0 
      ? `Removed roles: ${removedRoles.join(', ')} + 1h timeout`
      : '1 hour timeout applied';

    await this.logEvent(guild, {
      userId,
      username: member.user.tag,
      actionType,
      details,
      actionTaken
    });

    await this.notifyAdmins(guild, member, actionType, details, actionTaken);
  }

  private async logEvent(guild: Guild, log: {
    userId: string;
    username: string;
    actionType: 'channel_delete' | 'webhook_create' | 'role_delete' | 'mass_ban' | 'mass_kick';
    details: string;
    actionTaken: string;
  }): Promise<void> {
    await logProtectionEvent({
      server_id: guild.id,
      user_id: log.userId,
      username: log.username,
      action_type: log.actionType,
      details: log.details,
      action_taken: log.actionTaken
    });

    const logChannelId = await getLogChannel(guild.id);
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId) as TextChannel;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🛡️ Protection Alert')
      .addFields(
        { name: 'User', value: `<@${log.userId}> (${log.username})`, inline: true },
        { name: 'Action Type', value: log.actionType, inline: true },
        { name: 'Details', value: log.details },
        { name: 'Action Taken', value: log.actionTaken }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  private async notifyAdmins(
    guild: Guild, 
    member: GuildMember, 
    actionType: string, 
    details: string,
    actionTaken: string
  ): Promise<void> {
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner) return;

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🚨 Admin Abuse Detected')
      .setDescription(`User ${member.user.tag} has triggered anti-abuse protection`)
      .addFields(
        { name: 'Action Type', value: actionType, inline: true },
        { name: 'Details', value: details, inline: true },
        { name: 'Action Taken', value: actionTaken }
      )
      .setTimestamp();

    try {
      await owner.send({ embeds: [embed] });
    } catch (error: any) {
      console.error('Failed to DM owner:', error);
    }

    const logChannelId = await getLogChannel(guild.id);
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId) as TextChannel;
      if (logChannel) {
        await logChannel.send({ content: `<@${owner.id}>`, embeds: [embed] }).catch(() => null);
      }
    }
  }
}