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
import { getHoneypotChannel, logHoneypotTrigger } from '@bot/database';

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
    } catch (error) {
      console.error('Failed to kick user from honeypot:', error);
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
      .setColor(Colors.Red)
      .setTitle('🍯 HONEYPOT TRAP')
      .setDescription(
        '**⚠️ WARNING: UNAUTHORIZED ACCESS DETECTED**\n\n' +
        'This is a **security trap channel**. ' +
        'If you are seeing this, you should not be here.\n\n' +
        '**🚨 ANY MESSAGE SENT HERE WILL RESULT IN:**\n' +
        '• Immediate message deletion\n' +
        '• Automatic kick from the server\n' +
        '• Permanent record in security logs\n\n' +
        '*This channel is designed to catch raiders and unauthorized bots.*'
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