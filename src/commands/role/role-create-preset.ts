import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, Colors } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'role-create-preset',
  'Create preset staff role hierarchy'
);

interface RolePreset {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: bigint[];
}

const roleHierarchy: RolePreset[] = [
  {
    name: 'Owner',
    color: 0xFF0000,
    hoist: true,
    mentionable: false,
    permissions: [PermissionFlagsBits.Administrator]
  },
  {
    name: 'Co-Owner',
    color: 0xFF4500,
    hoist: true,
    mentionable: false,
    permissions: [PermissionFlagsBits.Administrator]
  },
  {
    name: 'Head Admin',
    color: 0xFF8C00,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.Administrator
    ]
  },
  {
    name: 'Admin',
    color: 0xFFA500,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.MentionEveryone,
      PermissionFlagsBits.ManageWebhooks,
      PermissionFlagsBits.ManageGuildExpressions,
      PermissionFlagsBits.ManageEvents
    ]
  },
  {
    name: 'Head Moderator',
    color: 0xFFD700,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.MentionEveryone,
      PermissionFlagsBits.ManageEvents
    ]
  },
  {
    name: 'Senior Moderator',
    color: 0x32CD32,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.MentionEveryone,
      PermissionFlagsBits.ManageEvents
    ]
  },
  {
    name: 'Moderator',
    color: 0x00FF00,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.ManageEvents
    ]
  },
  {
    name: 'Helper',
    color: 0x00CED1,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageEvents
    ]
  },
  {
    name: 'Trial Staff',
    color: 0x87CEEB,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages
    ]
  },
  {
    name: 'Bots',
    color: 0x7289DA,
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions
    ]
  },
  {
    name: 'Muted',
    color: 0x808080,
    hoist: false,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory
    ]
  }
];

export const roleCreatePresetCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const createdRoles: string[] = [];
    const failedRoles: string[] = [];

    for (const preset of roleHierarchy) {
      try {
        const existingRole = interaction.guild.roles.cache.find(r => r.name === preset.name);
        if (existingRole) {
          failedRoles.push(`${preset.name} (already exists)`);
          continue;
        }

        const role = await interaction.guild.roles.create({
          name: preset.name,
          color: preset.color,
          hoist: preset.hoist,
          mentionable: preset.mentionable,
          permissions: preset.permissions,
          reason: `Preset created by ${interaction.user.tag}`
        });

        createdRoles.push(role.name);
      } catch (error) {
        console.error(`Failed to create role ${preset.name}:`, error);
        failedRoles.push(preset.name);
      }
    }

    let content = `**Role Hierarchy Created**\n\n`;
    
    if (createdRoles.length > 0) {
      content += `✅ Created (${createdRoles.length}):\n${createdRoles.map(r => `• ${r}`).join('\n')}\n\n`;
    }
    
    if (failedRoles.length > 0) {
      content += `❌ Failed/Skipped (${failedRoles.length}):\n${failedRoles.map(r => `• ${r}`).join('\n')}`;
    }

    await interaction.editReply({ content });
  },
};