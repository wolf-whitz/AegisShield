import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  ChannelType,
  type TextChannel,
  type NewsChannel,
  type VoiceChannel,
  type StageChannel,
  type ForumChannel,
  type MediaChannel
} from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';
import { getAllowedLinks, isDomainAllowed } from '@bot/database';

const description = describeCommand(
  'linkshield',
  'Block all links and invites in the current channel (except allowed domains)'
);

type PermissionOverwritableChannel = TextChannel | NewsChannel | VoiceChannel | StageChannel | ForumChannel | MediaChannel;

function isPermissionOverwritableChannel(channel: any): channel is PermissionOverwritableChannel {
  return channel && 
    typeof channel === 'object' && 
    'permissionOverwrites' in channel &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.AnnouncementThread;
}

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;
const DISCORD_INVITE_REGEX = /(discord\.gg\/[a-zA-Z0-9-]+)|(discord\.com\/invite\/[a-zA-Z0-9-]+)/gi;

export const linkshieldCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('delete_messages')
        .setDescription('Delete messages containing blocked links (default: true)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('notify_user')
        .setDescription('Send warning DM to users who post blocked links (default: false)')
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

    const channel = interaction.channel;
    if (!channel || !isPermissionOverwritableChannel(channel)) {
      await interaction.reply({
        content: '❌ This command can only be used in regular guild channels',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const deleteMessages = interaction.options.getBoolean('delete_messages') ?? true;
    const notifyUser = interaction.options.getBoolean('notify_user') ?? false;
    const allowedLinks = await getAllowedLinks(interaction.guildId!);

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        EmbedLinks: false
      });

      let configText = '';
      if (deleteMessages) {
        configText += `\n🗑️ **Auto-delete:** Messages with blocked links will be removed`;
      }
      if (notifyUser) {
        configText += `\n📩 **User DM:** Offenders will be notified`;
      }

      let allowedListText = '';
      if (allowedLinks.length > 0) {
        allowedListText = `\n\n✅ **Allowed Domains:**\n` +
          allowedLinks.map(link => `• \`${link}\``).join('\n');
      } else {
        allowedListText = `\n\n⚠️ **No allowed domains set.** Use \`/allow-link\` to whitelist domains.`;
      }

      await interaction.reply({
        content: `✅ **Link Shield Activated** for <#${channel.id}>\n\n` +
                 `🔗 **Blocked:** All links and Discord invites${configText}` +
                 allowedListText,
        flags: MessageFlags.Ephemeral
      });

      if (deleteMessages) {
        const client = interaction.client;
        
        const messageHandler = async (message: any) => {
          if (message.author.bot) return;
          if (message.channel.id !== channel.id) return;

          const content = message.content;
          const urls = content.match(URL_REGEX) || [];
          const invites = content.match(DISCORD_INVITE_REGEX) || [];
          const allLinks = [...urls, ...invites];

          if (allLinks.length === 0) return;

          const currentAllowed = await getAllowedLinks(message.guild!.id);
          const hasBlockedLink = allLinks.some(link => !isDomainAllowed(link, currentAllowed));

          if (hasBlockedLink) {
            try {
              await message.delete();
              
              if (notifyUser) {
                await message.author.send({
                  content: `⚠️ Your message in **${message.guild!.name}** was deleted because it contained a blocked link.\n\n` +
                           `Allowed domains: ${currentAllowed.length > 0 ? currentAllowed.join(', ') : 'None configured'}`
                }).catch(() => null);
              }
            } catch (error) {
              console.error('Failed to delete link message:', error);
            }
          }
        };

        client.on('messageCreate', messageHandler);
      }
    } catch (error) {
      console.error('Failed to activate link shield:', error);
      await interaction.reply({
        content: '❌ Failed to activate link shield. Check bot permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};