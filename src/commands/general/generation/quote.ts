import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'quote',
  'Get a random inspirational quote'
);

export const quoteCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://dummyjson.com/quotes/random');
      const quote = await response.json() as any;

      const embed = new EmbedBuilder()
        .setColor(Colors.Purple)
        .setDescription(`"${quote.quote}"`)
        .setAuthor({ name: quote.author })
        .setFooter({ text: 'Powered by DummyJSON' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to fetch quote. Try again later.'
      });
    }
  },
};