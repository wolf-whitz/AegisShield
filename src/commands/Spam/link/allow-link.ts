import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags 
} from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';
import { addAllowedLink, extractDomain } from '@bot/database';

const description = describeCommand(
  'allow-link',
  'Add a domain to the allowed links list (auto-allows subdomains)'
);

export const allowLinkCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('The URL or domain to allow (e.g., https://youtube.com or youtube.com)')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const urlInput = interaction.options.getString('url', true).trim();
    const domain = extractDomain(urlInput) || urlInput.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    if (!domain || !domain.includes('.')) {
      await interaction.reply({
        content: '❌ Invalid URL or domain. Please provide a valid domain like `youtube.com` or `https://www.youtube.com`',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await addAllowedLink(interaction.guildId!, domain);
      
      await interaction.reply({
        content: `✅ **Domain Allowed**\n\n` +
                 `🔗 **Domain:** \`${domain}\`\n` +
                 `📋 **Includes:** All subdomains (e.g., \`www.${domain}\`, \`m.${domain}\`, etc.)\n\n` +
                 `Links from this domain will now bypass Link Shield restrictions.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error: any) {
      if (error.message === 'Domain already exists in allowed list') {
        await interaction.reply({
          content: `⚠️ **Domain already allowed**\n\n` +
                   `\`${domain}\` is already in your allowed links list.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      console.error('Failed to add allowed link:', error);
      await interaction.reply({
        content: '❌ Failed to add allowed link. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};