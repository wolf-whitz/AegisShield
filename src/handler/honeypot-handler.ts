import { 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder,
  Colors,
  type TextChannel, 
  type Guild,
  type GuildMember,
  type Message
} from 'discord.js';
import { getHoneypotChannel, logHoneypotTrigger, getHoneypotLogChannel } from '@bot/database';

export class HoneypotHandler {
  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.guild) return;

    const honeypotChannelId = await getHoneypotChannel(message.guild.id);
    if (!honeypotChannelId) return;
    if (message.channel.id !== honeypotChannelId) return;

    const member = message.member;
    if (!member) return;

    const botMember = message.guild.members.me;
    if (!botMember) return;

    const canModerate = this.canModerateMember(botMember, member);

    try {
      await message.delete();
    } catch (error) {
      console.error('Failed to delete honeypot message:', error);
    }

    if (!canModerate) {
      console.log(`Cannot kick ${member.user.tag} - higher or equal role hierarchy`);
      await this.sendLog(message.guild, {
        user: message.author,
        action: 'kick_failed',
        reason: 'Higher or equal role hierarchy',
        channel: message.channel as TextChannel,
        messageContent: message.content
      });
      return;
    }

    try {
      await member.kick('Honeypot trigger: Unauthorized message in honeypot channel');
      await logHoneypotTrigger({
        server_id: message.guild.id,
        user_id: message.author.id,
        username: message.author.tag,
        channel_id: message.channel.id,
        message_content: message.content.slice(0, 1000),
        action_taken: 'kick'
      });
      
      await this.sendLog(message.guild, {
        user: message.author,
        action: 'kick',
        reason: 'Unauthorized message in honeypot channel',
        channel: message.channel as TextChannel,
        messageContent: message.content
      });
    } catch (error) {
      console.error('Failed to kick user from honeypot:', error);
      await this.sendLog(message.guild, {
        user: message.author,
        action: 'kick_failed',
        reason: 'Bot permission error',
        channel: message.channel as TextChannel,
        messageContent: message.content
      });
    }
  }

  async sendLog(guild: Guild, logData: {
    user: { id: string; tag: string; displayAvatarURL?: () => string };
    action: 'kick' | 'kick_failed';
    reason: string;
    channel: TextChannel;
    messageContent: string;
  }): Promise<void> {
    const logChannelId = await getHoneypotLogChannel(guild.id);
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId) as TextChannel;
    if (!logChannel) return;

    const isSuccess = logData.action === 'kick';
    const color = isSuccess ? Colors.Red : Colors.Orange;
    const title = isSuccess ? '🍯 Honeypot Triggered - User Kicked' : '⚠️ Honeypot Kick Failed';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setThumbnail(logData.user.displayAvatarURL?.() || null)
      .addFields(
        { name: '👤 User', value: `${logData.user.tag} (\`${logData.user.id}\`)`, inline: true },
        { name: '📍 Channel', value: `<#${logData.channel.id}>`, inline: true },
        { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '📝 Message Content', value: `\`\`\`${logData.messageContent.slice(0, 1000) || 'No content'}\`\`\``, inline: false },
        { name: '🔧 Action', value: isSuccess ? 'Kicked from server' : 'Failed to kick', inline: true },
        { name: '📋 Reason', value: logData.reason, inline: true }
      )
      .setFooter({ text: 'AegisShield Honeypot System' })
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send honeypot log:', error);
    }
  }

  canModerateMember(bot: GuildMember, target: GuildMember): boolean {
    if (bot.id === target.id) return false;
    if (target.id === target.guild.ownerId) return false;
    
    const botHighest = bot.roles.highest.position;
    const targetHighest = target.roles.highest.position;
    
    return botHighest > targetHighest;
  }

  async sendHoneypotWarning(channel: TextChannel): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle('🍯 HONEYPOT TRAP')
      .setDescription(
        '**🔒 RESTRICTED AREA - AUTHORIZED PERSONNEL ONLY**\n\n' +
        'This channel is a **security honeypot** designed to detect unauthorized access.\n\n' +
        '**🚨 TRIGGERING THIS TRAP WILL RESULT IN:**\n' +
        '> • Instant message deletion\n' +
        '> • Immediate removal from the server\n' +
        '> • Permanent security log entry\n\n' +
        '*If you can read this, you should not be here. Turn back now.*'
      )
      .setFooter({ 
        text: 'AegisShield Security System • Automated Protection' 
      })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send honeypot warning:', error);
    }
  }

  async disableApplicationCommands(channel: TextChannel): Promise<void> {
    try {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        UseApplicationCommands: false
      });
    } catch (error) {
      console.error('Failed to disable application commands:', error);
    }
  }

  async validateChannel(channel: TextChannel): Promise<{ valid: boolean; reason?: string }> {
    if (channel.type !== ChannelType.GuildText) {
      return { valid: false, reason: 'Channel must be a text channel' };
    }

    const everyonePermissions = channel.permissionsFor(channel.guild.roles.everyone);
    if (!everyonePermissions) {
      return { valid: false, reason: 'Could not check permissions' };
    }

    const canSendMessages = everyonePermissions.has(PermissionFlagsBits.SendMessages);
    const canViewChannel = everyonePermissions.has(PermissionFlagsBits.ViewChannel);

    if (!canSendMessages || !canViewChannel) {
      return { 
        valid: false, 
        reason: '@everyone must have View Channel and Send Messages permissions' 
      };
    }

    return { valid: true };
  }

  async createHoneypotChannel(guild: Guild, name: string = 'honeypot'): Promise<TextChannel> {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ],
          deny: [
            PermissionFlagsBits.UseApplicationCommands
          ]
        }
      ]
    });

    await this.sendHoneypotWarning(channel as TextChannel);

    return channel as TextChannel;
  }
}