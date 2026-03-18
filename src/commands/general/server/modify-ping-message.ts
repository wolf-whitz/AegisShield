import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, Colors } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setPingMessage, getPingMessage } from '@bot/database';

const description = describeCommand(
  'modify-ping-message',
  'Customize the bot response message when pinged'
);

export const modifyPingMessageCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message shown when bot is pinged. Use {user}, {bot}, {server} as placeholders')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Custom title for the ping response embed')
        .setRequired(false)
        .setMaxLength(256)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed color hex code (e.g. #FF0000)')
        .setRequired(false)
        .setMaxLength(7)
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const customMessage = interaction.options.getString('message', true);
    const customTitle = interaction.options.getString('title') || '👋 Hello there!';
    const customColor = interaction.options.getString('color') || '#5865F2';

    const colorInt = parseInt(customColor.replace('#', ''), 16);
    const validColor = isNaN(colorInt) ? 3447003 : colorInt;

    try {
      await setPingMessage({
        server_id: interaction.guild.id,
        message: customMessage,
        title: customTitle,
        color: validColor
      });

      const previewEmbed = new EmbedBuilder()
        .setColor(validColor)
        .setTitle(customTitle)
        .setDescription(
          customMessage
            .replace(/{user}/g, interaction.user.username)
            .replace(/{bot}/g, interaction.client.user.username)
            .replace(/{server}/g, interaction.guild.name)
        )
        .setFooter({ text: 'Preview of your custom ping message' })
        .setTimestamp();

      await interaction.reply({
        content: '✅ Custom ping message saved! Here is a preview:',
        embeds: [previewEmbed],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to save ping message:', error);
      await interaction.reply({
        content: '❌ Failed to save custom ping message',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};