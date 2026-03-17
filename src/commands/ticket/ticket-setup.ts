import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { setTicketConfig } from '@bot/database/ticket-database';

const description = describeCommand(
  'ticket-setup',
  'Configure the ticket system'
);

export const ticketSetupCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Category where tickets will be created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('ticket_channel')
        .setDescription('Channel to post the create ticket button')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('max_tickets')
        .setDescription('Max tickets per user (default: 3)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('support_role')
        .setDescription('Role that can view all tickets')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('log_channel')
        .setDescription('Channel to send ticket transcripts')
        .addChannelTypes(ChannelType.GuildText)
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

    const category = interaction.options.getChannel('category', true);
    const ticketChannel = interaction.options.getChannel('ticket_channel', true) as TextChannel;
    const maxTickets = interaction.options.getInteger('max_tickets') || 3;
    const supportRole = interaction.options.getRole('support_role');
    const logChannel = interaction.options.getChannel('log_channel');

    try {
      await setTicketConfig({
        guild_id: interaction.guild.id,
        max_tickets_per_user: maxTickets,
        category_id: category.id,
        ticket_channel_id: ticketChannel.id,
        support_role_id: supportRole?.id,
        log_channel_id: logChannel?.id
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to create a support ticket.')
        .setFooter({ text: `Max ${maxTickets} tickets per user` });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );

      await ticketChannel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: `✅ Ticket system configured!\n\n` +
                 `• Category: ${category}\n` +
                 `• Ticket channel: ${ticketChannel}\n` +
                 `• Max tickets per user: ${maxTickets}\n` +
                 `• Support role: ${supportRole || 'None'}\n` +
                 `• Log channel: ${logChannel || 'None'}`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Failed to setup tickets:', error);
      await interaction.reply({
        content: '❌ Failed to configure ticket system',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};