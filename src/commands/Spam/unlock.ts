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
  'unlock',
  'Remove all shield restrictions from the current channel'
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

export const unlockCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('slowmode')
        .setDescription('Also disable slowmode')
        .setRequired(false)
    ),
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

    const disableSlowmode = interaction.options.getBoolean('slowmode') ?? false;
    const everyoneRole = interaction.guild.roles.everyone;

    try {
      await channel.permissionOverwrites.delete(everyoneRole);

      if (disableSlowmode && 'setRateLimitPerUser' in channel) {
        await (channel as TextChannel | NewsChannel | ForumChannel | MediaChannel).setRateLimitPerUser(0);
      }

      await interaction.reply({
        content: `✅ **Channel Unlocked** <#${channel.id}>\n\n` +
                 `🔓 **Removed:**\n` +
                 `• All permission overwrites for @everyone\n` +
                 `• All shield restrictions cleared\n` +
                 `${disableSlowmode ? '\\n🐌 **Slowmode:** Disabled' : ''}\n\n` +
                 `Channel is back to default permissions.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to unlock channel:', error);
      await interaction.reply({
        content: '❌ Failed to unlock channel. Check bot permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};