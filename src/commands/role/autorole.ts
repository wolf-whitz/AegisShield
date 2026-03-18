import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, Role } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setAutoRole, getAutoRole, removeAutoRole } from '@bot/database';

const description = describeCommand(
  'autorole',
  'Manage automatic role assignment for new members'
);

export const autoroleCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a role to auto-assign to new members')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to auto-assign')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove the auto-role configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current auto-role configuration')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === 'set') {
      const role = interaction.options.getRole('role', true) as Role;
      const botMember = interaction.guild.members.me;

      if (!botMember) {
        await interaction.reply({
          content: '❌ Bot member not found.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (role.id === interaction.guild.roles.everyone.id) {
        await interaction.reply({
          content: '❌ Cannot assign the everyone role.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (role.managed) {
        await interaction.reply({
          content: '❌ Cannot assign bot/integration roles.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const botHighestRole = botMember.roles.highest.position;
      const targetRolePosition = role.position;

      if (botHighestRole <= targetRolePosition) {
        await interaction.reply({
          content: '❌ I cannot assign a role higher than or equal to my highest role.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await setAutoRole(guildId, role.id);

      await interaction.reply({
        content: `✅ Auto-role set to <@&${role.id}>\n\nNew members will automatically receive this role when they join.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'remove') {
      const existingRoleId = await getAutoRole(guildId);
      
      if (!existingRoleId) {
        await interaction.reply({
          content: '❌ No auto-role is currently configured.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await removeAutoRole(guildId);

      await interaction.reply({
        content: '✅ Auto-role has been removed. New members will no longer receive a role automatically.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'view') {
      const roleId = await getAutoRole(guildId);

      if (!roleId) {
        await interaction.reply({
          content: '❌ No auto-role is currently configured.\n\nUse `/autorole set` to configure one.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const role = await interaction.guild.roles.fetch(roleId);

      await interaction.reply({
        content: `📋 **Auto-role Configuration**\n\n` +
                 `Current auto-role: ${role ? `<@&${roleId}>` : 'Role not found'}\n` +
                 `Role ID: \`${roleId}\`\n\n` +
                 `New members will automatically receive this role when they join.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};