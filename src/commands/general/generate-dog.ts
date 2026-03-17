import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'generate-dog',
  'Get a random dog picture'
);

export const generateDogCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://dog.ceo/api/breeds/image/random');
      const data = await response.json() as any;
      const dogUrl = data.message;

      const embed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('🐕 Random Dog')
        .setImage(dogUrl)
        .setFooter({ text: 'Powered by Dog CEO API' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to fetch dog picture. Try again later.'
      });
    }
  },
};