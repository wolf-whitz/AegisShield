import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setLeaveMessage, getLeaveMessage } from '@bot/database';

const description = describeCommand(
  'left-message',
  'Set the leave message template'
);

export const leftMessageCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The leave message template. Use {user} for mention, {username} for name, {server} for server name')
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

    const message = interaction.options.getString('message', true);
    await setLeaveMessage(interaction.guildId!, message);

    await interaction.reply({
      content: `✅ Leave message set to:\n\`\`\`${message}\`\`\``,
      flags: MessageFlags.Ephemeral
    });
  }
};