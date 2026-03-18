import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';

const description = describeCommand(
 'member',
 'Get the server total member count'
);

export const memberCommand: Command = {
 description,
 data: new SlashCommandBuilder()
   .setName(description.name)
   .setDescription(description.description),

 async execute(interaction) {
   if (!interaction.guild) {
     await interaction.reply({
       content: '❌ This command can only be used in a server.',
       flags: MessageFlags.Ephemeral
     });
     return;
   }

   const memberCount = interaction.guild.memberCount;

   await interaction.reply({
     content: `👥 **Member Count**\n\nThis server has **${memberCount}** members.`,
     flags: MessageFlags.Ephemeral
   });
 }
};