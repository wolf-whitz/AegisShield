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
  'voiceshield',
  'Lock voice channel - mute everyone and disable voice activity'
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

export const voiceshieldCommand: Command = {
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

    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
      await interaction.reply({
        content: '❌ This command must be used in a voice or stage channel',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const everyoneRole = interaction.guild.roles.everyone;

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        Speak: false,
        UseSoundboard: false,
        UseExternalSounds: false,
        SendVoiceMessages: false,
        Stream: false,
        UseApplicationCommands: false
      });

      await interaction.reply({
        content: `✅ **Voice Shield Activated** for <#${channel.id}>\n\n` +
                 `🔇 **Disabled:**\n` +
                 `• Speaking (voice activity)\n` +
                 `• Soundboard usage\n` +
                 `• External sound effects\n` +
                 `• Voice messages\n` +
                 `• Video streaming / Go Live\n` +
                 `• App commands in channel\n\n` +
                 `Users can still connect and listen.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to activate voice shield:', error);
      await interaction.reply({
        content: '❌ Failed to activate voice shield. Check bot permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};