import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'sudoku',
  'Generate a random Sudoku puzzle'
);

export const sudokuCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch('https://sudoku-api.vercel.app/api/dosuku?query={newboard(limit:1){grids{value,solution,difficulty}}}');
      const data = await response.json() as any;
      const grid = data.newboard.grids[0];

      const puzzleString = grid.value.map((row: number[]) => 
        row.map((cell: number) => cell === 0 ? '⬜' : cell).join(' ')
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🧩 Sudoku Puzzle')
        .setDescription(`\`\`\`\n${puzzleString}\n\`\`\``)
        .addFields(
          { name: 'Difficulty', value: grid.difficulty, inline: true }
        )
        .setFooter({ text: 'Powered by Dosuku API' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to generate Sudoku puzzle. Try again later.'
      });
    }
  },
};