import { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'invite-bot',
  'Get the invite link for this bot'
);

export const inviteBotCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),

  async execute(interaction: ChatInputCommandInteraction) {
    const clientId = interaction.client.user?.id;
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle('🤖 Invite Bot')
      .setDescription('Click the button below to invite me to your server!')
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite Bot')
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl)
          .setEmoji('🚀')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};