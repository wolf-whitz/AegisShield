import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, EmbedBuilder, Colors } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setLogChannel } from '@bot/database';

const description = describeCommand(
  'log-channel',
  'Set the channel for protection and system logs'
);

export const logChannelCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send protection logs to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);

    try {
      await setLogChannel(interaction.guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Log Channel Set')
        .setDescription(`Protection logs will now be sent to ${channel}`)
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    } catch (error: any) {
      console.error('Failed to set log channel:', error);
      await interaction.reply({
        content: '❌ Failed to set log channel',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};