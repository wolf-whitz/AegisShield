import { SlashCommandBuilder } from 'discord.js';
import { describeCommand } from '../describer/command-describer.js';
import type { Command } from '../types/command.js';

const description = describeCommand(
  'ping',
  'Replies with Pong and bot latency'
);

export const pingCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    const latency = interaction.client.ws.ping;
    await interaction.reply(`Pong! 🏓 Latency: ${latency}ms`);
  },
};