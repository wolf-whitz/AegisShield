import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  ChannelType, 
  EmbedBuilder, 
  Colors, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  type TextChannel 
} from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setVerificationConfig } from '@bot/database/verification-database';

const description = describeCommand(
  'verification-channel',
  'Set verification channel and mode'
);

export const verificationChannelCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel for verification')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('mode')
        .setDescription('Verification mode')
        .addChoices(
          { name: 'Simple Button', value: 1 },
          { name: 'Math Problem', value: 2 }
        )
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to assign after verification')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('secondary_role')
        .setDescription('Optional second role to assign after verification')
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

    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const mode = interaction.options.getInteger('mode', true) as 1 | 2;
    const role = interaction.options.getRole('role', true);
    const secondaryRole = interaction.options.getRole('secondary_role');

    try {
      await setVerificationConfig({
        guild_id: interaction.guild.id,
        channel_id: channel.id,
        mode,
        role_id: role.id,
        secondary_role_id: secondaryRole?.id || null
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Server Verification')
        .setDescription(
          mode === 1 
            ? 'Click the button below to verify and gain access to the server.'
            : 'Click the button below and solve the math problem to verify.'
        )
        .setFooter({ text: 'AegisShield Verification System' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(mode === 1 ? 'verify_simple' : 'verify_custom')
            .setLabel(mode === 1 ? '✅ Verify' : '🧮 Solve to Verify')
            .setStyle(ButtonStyle.Success)
        );

      await channel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: `✅ Verification set to ${channel.name} with ${mode === 1 ? 'Simple Button' : 'Math Problem'}${secondaryRole ? ` + ${secondaryRole.name}` : ''}`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to setup verification:', error);
      await interaction.reply({
        content: '❌ Failed to setup verification system',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};