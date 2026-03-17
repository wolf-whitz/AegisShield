import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setHoneypotChannel } from '@bot/database';
import { HoneypotHandler } from '@handlers/honeypot-handler';

const description = describeCommand(
  'honeypot-create',
  'Create a new honeypot channel'
);

export const honeypotCreateCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name for the honeypot channel')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const name = interaction.options.getString('name') || 'honeypot';
    const honeypotHandler = new HoneypotHandler();
    
    const channel = await honeypotHandler.createHoneypotChannel(interaction.guild, name);
    await setHoneypotChannel(interaction.guildId!, channel.id);

    await interaction.reply({
      content: `✅ Honeypot channel created: ${channel}\n\n` +
               `⚠️ **Warning**: Anyone who types in this channel will be **instantly kicked** and their messages deleted.\n` +
               `Channel ID: \`${channel.id}\`\n\n` +
               `**Next steps**:\n` +
               `1. Move this channel to a hidden category\n` +
               `2. Ensure @everyone can see it (this is the trap)\n` +
               `3. Deny access for your real member roles`,
      flags: MessageFlags.Ephemeral
    });
  },
};