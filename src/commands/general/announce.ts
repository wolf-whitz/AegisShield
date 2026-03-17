import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'announce',
  'Send an announcement message to a channel'
);

export const announceCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The announcement message')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send announcement to (default: current channel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Optional title for the announcement')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed color')
        .setRequired(false)
        .addChoices(
          { name: 'Blue', value: 'Blue' },
          { name: 'Green', value: 'Green' },
          { name: 'Red', value: 'Red' },
          { name: 'Yellow', value: 'Yellow' },
          { name: 'Purple', value: 'Purple' },
          { name: 'Black', value: 'Black' }
        )
    )
    .addBooleanOption(option =>
      option
        .setName('ping')
        .setDescription('Ping @everyone')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const message = interaction.options.getString('message', true);
    const targetChannel = interaction.options.getChannel('channel') as TextChannel | null;
    const title = interaction.options.getString('title');
    const colorChoice = interaction.options.getString('color') || 'Blue';
    const shouldPing = interaction.options.getBoolean('ping') || false;

    const channel = targetChannel || interaction.channel as TextChannel;

    if (!channel || channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      await interaction.reply({
        content: 'Invalid channel selected',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const colorMap: Record<string, number> = {
      'Blue': Colors.Blue,
      'Green': Colors.Green,
      'Red': Colors.Red,
      'Yellow': Colors.Yellow,
      'Purple': Colors.Purple,
    };

    const embed = new EmbedBuilder()
      .setColor(colorMap[colorChoice] || Colors.Blue)
      .setDescription(message)
      .setFooter({ text: `Announced by ${interaction.user.username}` })
      .setTimestamp();

    if (title) {
      embed.setTitle(title);
    }

    try {
      await channel.send({
        content: shouldPing ? '@everyone' : undefined,
        embeds: [embed],
        allowedMentions: shouldPing ? { parse: ['everyone'] } : undefined
      });

      await interaction.reply({
        content: `✅ Announcement sent to ${channel}`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Announce error:', error);
      await interaction.reply({
        content: 'Failed to send announcement. Check my permissions in that channel.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};