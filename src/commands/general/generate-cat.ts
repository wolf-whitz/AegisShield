import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'generate-cat',
  'Get a random cat picture'
);

export const generateCatCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await response.json() as any;
      const catUrl = data[0].url;

      const embed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('🐱 Random Cat')
        .setImage(catUrl)
        .setFooter({ text: 'Powered by TheCatAPI' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to fetch cat picture. Try again later.'
      });
    }
  },
};