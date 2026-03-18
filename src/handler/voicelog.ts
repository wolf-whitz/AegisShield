import { Events, EmbedBuilder, Colors, type Client, type VoiceState, type GuildMember, type TextChannel } from 'discord.js';
import { getVoiceLogChannel } from '@bot/database';
import { logError } from '@utils';

export class VoiceLogHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const logChannelId = await getVoiceLogChannel(guildId);
    if (!logChannelId) return;

    const logChannel = await newState.guild.channels.fetch(logChannelId) as TextChannel;
    if (!logChannel) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      await this.sendJoinLog(logChannel, member, newState.channel!.name, newChannelId);
    } else if (oldChannelId && !newChannelId) {
      await this.sendLeaveLog(logChannel, member, oldState.channel!.name, oldChannelId);
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      await this.sendSwitchLog(logChannel, member, oldState.channel!.name, newState.channel!.name, oldChannelId, newChannelId);
    }
  }

  private async sendJoinLog(channel: TextChannel, member: GuildMember, channelName: string, channelId: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setDescription(`<@${member.id}> joined voice channel <#${channelId}>`)
      .addFields({ name: 'Channel', value: `\`${channelName}\``, inline: true })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logError('voiceLog_joinFailed', { memberId: member.id, channelId, error });
    }
  }

  private async sendLeaveLog(channel: TextChannel, member: GuildMember, channelName: string, channelId: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setDescription(`<@${member.id}> left voice channel <#${channelId}>`)
      .addFields({ name: 'Channel', value: `\`${channelName}\``, inline: true })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logError('voiceLog_leaveFailed', { memberId: member.id, channelId, error });
    }
  }

  private async sendSwitchLog(channel: TextChannel, member: GuildMember, oldName: string, newName: string, oldId: string, newId: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setDescription(`<@${member.id}> switched voice channels`)
      .addFields(
        { name: 'From', value: `<#${oldId}> (\`${oldName}\`)`, inline: true },
        { name: 'To', value: `<#${newId}> (\`${newName}\`)`, inline: true }
      )
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logError('voiceLog_switchFailed', { memberId: member.id, oldId, newId, error });
    }
  }
}