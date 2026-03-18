import { Events, type Client, type GuildMember, type PartialGuildMember } from 'discord.js';
import { getWelcomeChannel, getWelcomeMessage, getLeaveChannel, getLeaveMessage } from '@bot/database';
import { logError } from '@utils';

export class WelcomeLeaveHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleMemberJoin(member);
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      await this.handleMemberLeave(member);
    });
  }

  private async handleMemberJoin(member: GuildMember | PartialGuildMember): Promise<void> {
    if (member.user?.bot) return;

    const fullMember = member as GuildMember;
    const guild = fullMember.guild;

    const channelId = await getWelcomeChannel(guild.id);
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const messageTemplate = await getWelcomeMessage(guild.id);
    const message = messageTemplate
      ? messageTemplate
          .replace(/{user}/g, `<@${fullMember.id}>`)
          .replace(/{username}/g, fullMember.user.username)
          .replace(/{server}/g, guild.name)
      : `Welcome to ${guild.name}, <@${fullMember.id}>!`;

    try {
      await (channel as any).send({
        content: message,
        allowedMentions: { users: [fullMember.id] }
      });
    } catch (error) {
      logError('welcomeMessage_sendFailed', { guildId: guild.id, userId: fullMember.id, error });
    }
  }

  private async handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    const guild = member.guild;
    const user = member.user;

    const channelId = await getLeaveChannel(guild.id);
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const messageTemplate = await getLeaveMessage(guild.id);
    const message = messageTemplate
      ? messageTemplate
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, user?.username || 'Unknown')
          .replace(/{server}/g, guild.name)
      : `${user?.username || 'Unknown'} has left ${guild.name}.`;

    try {
      await (channel as any).send({ content: message });
    } catch (error) {
      logError('leaveMessage_sendFailed', { guildId: guild.id, userId: member.id, error });
    }
  }
}