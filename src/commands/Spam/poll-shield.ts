import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  ChannelType,
  type TextChannel,
  type NewsChannel,
  type VoiceChannel,
  type StageChannel,
  type ForumChannel,
  type MediaChannel
} from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';

const description = describeCommand(
  'pollshield',
  'Block all polls and poll creation in the current channel'
);

type PermissionOverwritableChannel = TextChannel | NewsChannel | VoiceChannel | StageChannel | ForumChannel | MediaChannel;

function isPermissionOverwritableChannel(channel: any): channel is PermissionOverwritableChannel {
  return channel && 
    typeof channel === 'object' && 
    'permissionOverwrites' in channel &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.AnnouncementThread;
}

export const pollshieldCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !isPermissionOverwritableChannel(channel)) {
      await interaction.reply({
        content: '❌ This command can only be used in regular guild channels',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const everyoneRole = interaction.guild.roles.everyone;

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendPolls: false
      });

      await interaction.reply({
        content: `✅ **Poll Shield Activated** for <#${channel.id}>\n\n` +
                 `📊 **Blocked:**\n` +
                 `• Creating new polls\n` +
                 `• Poll attachments\n\n` +
                 `Existing polls remain visible but users cannot create new ones.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to activate poll shield:', error);
      await interaction.reply({
        content: '❌ Failed to activate poll shield. Check bot permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};