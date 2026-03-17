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
  'appshield',
  'Block all application commands (slash commands, context menus) in the current channel'
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

export const appshieldCommand: Command = {
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
        UseApplicationCommands: false
      });

      await interaction.reply({
        content: `✅ **App Shield Activated** for <#${channel.id}>\n\n` +
                 `🤖 **Blocked:**\n` +
                 `• All slash commands (/)\n` +
                 `• Context menu commands (right-click)\n` +
                 `• Bot interactions\n\n` +
                 `⚠️ **Note:** Users with Administrator permission bypass this restriction.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to activate app shield:', error);
      await interaction.reply({
        content: '❌ Failed to activate app shield. Check bot permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};