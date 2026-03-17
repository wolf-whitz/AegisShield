import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { getOrCreateServerSettings, updateServerSettings } from '@bot/database';

const description = describeCommand(
  'ai-moderation',
  'Configure AI-powered message moderation'
);

export const aiModerationCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current AI moderation status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable AI moderation')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable AI moderation')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('threshold')
        .setDescription('Set the sensitivity threshold (0.1 - 1.0)')
        .addNumberOption(option =>
          option
            .setName('value')
            .setDescription('Threshold value (0.1 = lenient, 1.0 = strict)')
            .setRequired(true)
            .setMinValue(0.1)
            .setMaxValue(1.0)
        )
    ) as SlashCommandBuilder,
  
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const settings = await getOrCreateServerSettings(interaction.guild.id);

    switch (subcommand) {
      case 'status': {
        const embed = new EmbedBuilder()
          .setColor(settings.ai_moderation_enabled ? Colors.Green : Colors.Red)
          .setTitle('AI Moderation Status')
          .setDescription(
            `**Status:** ${settings.ai_moderation_enabled ? 'Enabled' : 'Disabled'}\n` +
            `**Threshold:** ${settings.ai_moderation_threshold || 0.8}`
          )
          .addFields(
            {
              name: 'Severity Levels',
              value: [
                `> 0.95: 24 hour mute`,
                `> 0.90: 6 hour mute`,
                `> 0.85: 1 hour mute + warning`,
                `> ${(settings.ai_moderation_threshold || 0.8).toFixed(2)}: Delete message`
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: 'Use /ai-moderation enable to turn on' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'enable': {
        await updateServerSettings(interaction.guild.id, {
          ai_moderation_enabled: true
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('AI Moderation Enabled')
          .setDescription(
            'AI moderation is now active and monitoring messages.\n\n' +
            `Current Threshold: ${settings.ai_moderation_threshold || 0.8}`
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'disable': {
        await updateServerSettings(interaction.guild.id, {
          ai_moderation_enabled: false
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('AI Moderation Disabled')
          .setDescription('AI moderation is now turned off. Messages will not be scanned.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'threshold': {
        const threshold = interaction.options.getNumber('value', true);
        
        await updateServerSettings(interaction.guild.id, {
          ai_moderation_threshold: threshold
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle('Threshold Updated')
          .setDescription(`AI moderation threshold set to ${threshold}`)
          .addFields(
            {
              name: 'Severity Levels',
              value: [
                `> 0.95: 24 hour mute`,
                `> 0.90: 6 hour mute`,
                `> 0.85: 1 hour mute + warning`,
                `> ${threshold.toFixed(2)}: Delete message`
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: 'Changes take effect immediately' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  },
};