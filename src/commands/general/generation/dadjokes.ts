import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'dadjoke',
  'Get a random dad joke'
);

export const dadJokeCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://icanhazdadjoke.com/', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Discord Bot (https://github.com/username/repo)'
        }
      });
      
      const data = await response.json() as any;

      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('😂 Dad Joke')
        .setDescription(data.joke)
        .setFooter({ text: 'Powered by icanhazdadjoke.com' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to fetch dad joke. Try again later.'
      });
    }
  },
};