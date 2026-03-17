import { 
  Events, 
  EmbedBuilder, 
  Colors, 
  AttachmentBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  ButtonBuilder,        // Added
  ButtonStyle           // Added
} from 'discord.js';
import type { Client, TextChannel, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { 
  getTicketByChannel, 
  closeTicket, 
  getTicketMessages, 
  logTicketMessage,
  getTicketConfig,
  getUserOpenTickets,
  createTicket
} from '../database/ticket-database.js';

export class TicketHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (!message.guild) return;

      const ticket = await getTicketByChannel(message.channel.id);
      if (!ticket) return;

      const attachments = message.attachments.map(a => a.url);
      
      await logTicketMessage({
        ticket_id: ticket.id,
        user_id: message.author.id,
        username: message.author.tag,
        content: message.content,
        attachments
      });
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
          await this.handleCreateTicketButton(interaction);
        } else if (interaction.customId === 'close_ticket') {
          await this.handleCloseTicket(interaction);
        }
      } else if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason_modal') {
        await this.handleTicketReasonSubmit(interaction);
      }
    });
  }

  private async handleCreateTicketButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;

    const config = await getTicketConfig(interaction.guild.id);
    if (!config) {
      await interaction.reply({
        content: '❌ Ticket system not configured',
        ephemeral: true
      });
      return;
    }

    const maxTickets = config.max_tickets_per_user || 3;
    const currentTickets = await getUserOpenTickets(interaction.guild.id, interaction.user.id);

    if (currentTickets >= maxTickets) {
      await interaction.reply({
        content: `❌ You already have ${currentTickets} open tickets (max: ${maxTickets}). Please close existing tickets first.`,
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('ticket_reason_modal')
      .setTitle('Create Support Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('ticket_reason')
      .setLabel('What do you need help with?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe your issue...')
      .setMaxLength(1000)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  private async handleTicketReasonSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const config = await getTicketConfig(interaction.guild.id);
    if (!config) {
      await interaction.editReply({
        content: '❌ Ticket system not configured'
      });
      return;
    }

    const reason = interaction.fields.getTextInputValue('ticket_reason');
    const category = config.category_id ? interaction.guild.channels.cache.get(config.category_id) : null;

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category?.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      if (config.support_role_id) {
        await channel.permissionOverwrites.create(config.support_role_id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }

      const ticket = await createTicket({
        guild_id: interaction.guild.id,
        channel_id: channel.id,
        user_id: interaction.user.id,
        username: interaction.user.tag,
        status: 'open'
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🎫 Support Ticket')
        .setDescription(`**Reason:** ${reason}`)
        .addFields(
          { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Ticket ID', value: ticket.id, inline: true },
          { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        );

      // Fixed: Use imported ButtonBuilder and ButtonStyle directly
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

      await channel.send({
        content: `<@${interaction.user.id}>${config.support_role_id ? ` <@&${config.support_role_id}>` : ''}`,
        embeds: [embed],
        components: [row]
      });

      await interaction.editReply({
        content: `✅ Ticket created: ${channel}`
      });
    } catch (error) {
      console.error('Failed to create ticket:', error);
      await interaction.editReply({
        content: '❌ Failed to create ticket'
      });
    }
  }

  private async handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        content: '❌ This ticket is already closed',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      const messages = await getTicketMessages(ticket.id);
      const transcript = this.generateTranscript(messages, ticket.id);
      
      await closeTicket(ticket.id, interaction.user.id);
      
      const config = await getTicketConfig(interaction.guild!.id);
      
      if (config?.log_channel_id) {
        const logChannel = interaction.guild?.channels.cache.get(config.log_channel_id) as TextChannel;
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('🔒 Ticket Closed')
            .addFields(
              { name: 'Ticket ID', value: ticket.id, inline: true },
              { name: 'User', value: ticket.username, inline: true },
              { name: 'Closed By', value: interaction.user.tag, inline: true },
              { name: 'Messages', value: messages.length.toString(), inline: true }
            )
            .setTimestamp();

          const buffer = Buffer.from(transcript, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticket.id}.txt` });

          await logChannel.send({ embeds: [embed], files: [attachment] });
        }
      }

      await interaction.editReply({
        content: `🔒 Ticket closed by ${interaction.user.tag}\nTranscript saved.`
      });

      setTimeout(async () => {
        await interaction.channel?.delete();
      }, 5000);
    } catch (error) {
      console.error('Failed to close ticket:', error);
      await interaction.editReply({
        content: '❌ Failed to close ticket'
      });
    }
  }

  private generateTranscript(messages: any[], ticketId: string): string {
    let transcript = `=== TICKET TRANSCRIPT ===\n`;
    transcript += `Ticket ID: ${ticketId}\n`;
    transcript += `Generated: ${new Date().toISOString()}\n`;
    transcript += `========================\n\n`;

    for (const msg of messages) {
      const date = new Date(msg.created_at).toLocaleString();
      transcript += `[${date}] ${msg.username}: ${msg.content}\n`;
      if (msg.attachments?.length > 0) {
        transcript += `  Attachments: ${msg.attachments.join(', ')}\n`;
      }
      transcript += '\n';
    }

    return transcript;
  }
}