import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, type TextChannel, MessageFlags } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setHoneypotChannel } from '@bot/database';
import { HoneypotHandler } from '@handlers/index.js';

const description = describeCommand(
  'honeypot-channel',
  'Set an existing channel as the honeypot trap'
);

export const honeypotChannelCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to set as honeypot')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const honeypotHandler = new HoneypotHandler();
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please select a text channel',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const validation = await honeypotHandler.validateChannel(channel);
    
    if (!validation.valid) {
      await interaction.reply({
        content: `❌ ${validation.reason}`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await setHoneypotChannel(interaction.guildId!, channel.id);
    await honeypotHandler.disableApplicationCommands(channel);
    await honeypotHandler.sendHoneypotWarning(channel);

    await interaction.reply({
      content: `✅ Honeypot set to ${channel.name}\n\n` +
               `🔒 Application commands disabled\n` +
               `⚠️ Anyone who types here will be **instantly kicked**`,
      flags: MessageFlags.Ephemeral
    });
  },
};