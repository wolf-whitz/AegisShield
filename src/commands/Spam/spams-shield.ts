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
  'spamshield',
  'Lock down a channel by disabling app commands, restricting permissions, and enabling slowmode'
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

export const spamshieldCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('slowmode')
        .setDescription('Enable slowmode on the channel')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Slowmode duration in seconds (default: 5, max: 21600)')
        .setMinValue(0)
        .setMaxValue(21600)
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
        content: '❌ This command can only be used in regular guild channels (not threads, DMs, or unsupported channel types)',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const enableSlowmode = interaction.options.getBoolean('slowmode', true);
    const slowmodeDuration = interaction.options.getInteger('duration') ?? 5;
    const everyoneRole = interaction.guild.roles.everyone;

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        UseApplicationCommands: false,
        EmbedLinks: false,
        AttachFiles: false,
        AddReactions: false,
        UseExternalEmojis: false,
        UseExternalStickers: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
        MentionEveryone: false,
        UseSoundboard: false,
        UseExternalSounds: false,
        SendVoiceMessages: false,
        SendPolls: false
      });

      if (enableSlowmode && 'setRateLimitPerUser' in channel) {
        await (channel as TextChannel | NewsChannel | ForumChannel | MediaChannel).setRateLimitPerUser(slowmodeDuration);
      }

      await interaction.reply({
        content: `✅ **Spam Shield Activated** for <#${channel.id}>\n\n` +
                 `🔒 **Disabled for @everyone:**\n` +
                 `• Application commands\n` +
                 `• Embed links & file attachments\n` +
                 `• Reactions & external emojis/stickers\n` +
                 `• Thread creation & thread messaging\n` +
                 `• @everyone & @here mentions\n` +
                 `• Voice messages, polls, soundboard\n` +
                 `${enableSlowmode ? `\\n🐌 **Slowmode:** ${slowmodeDuration} seconds enabled` : ''}`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to activate spam shield:', error);
      await interaction.reply({
        content: '❌ Failed to activate spam shield. Check bot permissions (requires Manage Channels).',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};