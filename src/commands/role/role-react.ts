import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, TextChannel, Role, Message } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setReactionRoleChannel, getReactionRoleChannel, addReactionRole, getReactionRoles, removeReactionRole } from '@bot/database';

const description = describeCommand(
  'role-react',
  'Manage reaction roles'
);

export const roleReactCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the channel for reaction roles')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel for reaction roles')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a reaction role to a message')
        .addStringOption(option =>
          option
            .setName('message_id')
            .setDescription('The message ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('The emoji to react with')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to assign')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a reaction role')
        .addStringOption(option =>
          option
            .setName('message_id')
            .setDescription('The message ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('The emoji')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all reaction roles')
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

    if (subcommand === 'channel') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;

      await setReactionRoleChannel(guildId, channel.id);

      await interaction.reply({
        content: `✅ Reaction role channel set to <#${channel.id}>`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === 'add') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);
      const role = interaction.options.getRole('role', true) as Role;

      const channelId = await getReactionRoleChannel(guildId);
      if (!channelId) {
        await interaction.reply({
          content: '❌ No reaction role channel set. Use `/role-react channel` first.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const channel = await interaction.guild.channels.fetch(channelId) as TextChannel;
      if (!channel) {
        await interaction.reply({
          content: '❌ Reaction role channel not found.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      let message: Message;
      try {
        message = await channel.messages.fetch(messageId);
      } catch {
        await interaction.reply({
          content: '❌ Message not found in the reaction role channel.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      try {
        await message.react(emoji);
      } catch {
        await interaction.reply({
          content: '❌ Invalid emoji or missing permissions to react.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await addReactionRole(guildId, messageId, emoji, role.id);

      await interaction.reply({
        content: `✅ Reaction role added!\nMessage: ${messageId}\nEmoji: ${emoji}\nRole: <@&${role.id}>`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);

      await removeReactionRole(guildId, messageId, emoji);

      await interaction.reply({
        content: `✅ Reaction role removed for emoji ${emoji} on message ${messageId}`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === 'list') {
      const roles = await getReactionRoles(guildId);

      if (!roles || roles.length === 0) {
        await interaction.reply({
          content: '❌ No reaction roles configured.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const list = roles.map(r => `Message: \`${r.message_id}\` | Emoji: ${r.emoji} | Role: <@&${r.role_id}>`).join('\n');

      await interaction.reply({
        content: `📋 **Reaction Roles**\n\n${list}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};