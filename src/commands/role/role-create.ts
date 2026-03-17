import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, Colors } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'role-create',
  'Create a custom role'
);

export const roleCreateCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the role')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Hex color code (e.g., #FF0000)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('hoist')
        .setDescription('Display role separately in member list')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('mentionable')
        .setDescription('Allow anyone to @mention this role')
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

    const name = interaction.options.getString('name', true);
    const colorHex = interaction.options.getString('color') || '#99AAB5';
    const hoist = interaction.options.getBoolean('hoist') ?? false;
    const mentionable = interaction.options.getBoolean('mentionable') ?? false;

    const color = parseInt(colorHex.replace('#', ''), 16);

    try {
      const role = await interaction.guild.roles.create({
        name,
        color,
        hoist,
        mentionable,
        reason: `Created by ${interaction.user.tag}`
      });

      await interaction.reply({
        content: `✅ Role ${role} created successfully`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to create role:', error);
      await interaction.reply({
        content: '❌ Failed to create role',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};