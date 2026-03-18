import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setLeaveChannel, getLeaveChannel } from '@bot/database';

const description = describeCommand(
  'left-channel',
  'Set the channel for leave messages'
);

export const leftChannelCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel for leave messages')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    await setLeaveChannel(interaction.guildId!, channel.id);

    await interaction.reply({
      content: `✅ Leave channel set to <#${channel.id}>`,
      flags: MessageFlags.Ephemeral
    });
  }
};