import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags 
} from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';
import { getAllowedLinks, removeAllowedLink } from '@bot/database';

const description = describeCommand(
  'allow-link-list',
  'View or manage allowed link domains'
);

export const allowLinkListCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .setRequired(false)
        .addChoices(
          { name: 'View list', value: 'view' },
          { name: 'Remove domain', value: 'remove' }
        )
    )
    .addStringOption(option =>
      option
        .setName('domain')
        .setDescription('Domain to remove (only used with remove action)')
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

    const action = interaction.options.getString('action') || 'view';
    const domainToRemove = interaction.options.getString('domain');

    try {
      const allowedLinks = await getAllowedLinks(interaction.guildId!);

      if (action === 'remove') {
        if (!domainToRemove) {
          await interaction.reply({
            content: '❌ Please specify a domain to remove using the `domain` option.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (!allowedLinks.includes(domainToRemove)) {
          await interaction.reply({
            content: `❌ \`${domainToRemove}\` is not in the allowed links list.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await removeAllowedLink(interaction.guildId!, domainToRemove);
        
        await interaction.reply({
          content: `✅ **Domain Removed**\n\n` +
                   `\`${domainToRemove}\` has been removed from the allowed links list.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (allowedLinks.length === 0) {
        await interaction.reply({
          content: `📋 **Allowed Links List**\n\n` +
                   `No domains are currently allowed.\n\n` +
                   `Use \`/allow-link\` to add domains that bypass Link Shield.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const formattedList = allowedLinks.map((link, index) => `${index + 1}. \`${link}\``).join('\n');

      await interaction.reply({
        content: `📋 **Allowed Links List** (${allowedLinks.length} domains)\n\n` +
                 `${formattedList}\n\n` +
                 `**To remove a domain:**\n` +
                 `Use \`/allow-link-list action:remove domain:example.com\``,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to manage allowed links:', error);
      await interaction.reply({
        content: '❌ Failed to retrieve allowed links. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};