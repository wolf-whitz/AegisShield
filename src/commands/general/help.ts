import { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'help',
  'Display all available commands and bot information'
);

const commandCategories = {
  moderation: {
    name: '🛡️ Moderation',
    description: 'Server protection and moderation tools',
    commands: [
      { name: 'quarantine', description: 'Lockdown a channel for a specified time' },
      { name: 'honeypot-channel', description: 'Set an existing channel as the honeypot trap' },
      { name: 'honeypot-create', description: 'Create a new honeypot channel' }
    ]
  },
  roles: {
    name: '👤 Roles',
    description: 'Automatic role management',
    commands: [
      { name: 'autorole', description: 'Manage automatic role assignment for new members' }
    ]
  },
  verification: {
    name: '✅ Verification',
    description: 'Member verification systems',
    commands: [
      { name: 'verify', description: 'Send verification message in channel' },
      { name: 'verify-config', description: 'Configure verification settings' }
    ]
  },
  tickets: {
    name: '🎫 Tickets',
    description: 'Support ticket management',
    commands: [
      { name: 'ticket-panel', description: 'Send the ticket creation panel' },
      { name: 'ticket-config', description: 'Configure ticket system settings' }
    ]
  },
  utility: {
    name: '🔧 Utility',
    description: 'General utility commands',
    commands: [
      { name: 'status-minecraft', description: 'Check the status of a Minecraft server' },
      { name: 'ping-config', description: 'Configure custom ping message' }
    ]
  },
  info: {
    name: 'ℹ️ Information',
    description: 'Bot and server information',
    commands: [
      { name: 'help', description: 'Display all available commands' },
      { name: 'invite-bot', description: 'Get the invite link for this bot' },
      { name: 'invite-server', description: 'Get an invite link for this server' }
    ]
  }
};

export const helpCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle('📚 AegisShield Command Help')
      .setDescription(
        '**Welcome to AegisShield!** 🤖\n\n' +
        'Your all-in-one Discord security and management bot.\n\n' +
        '**Select a category below** to view commands:\n\n' +
        Object.values(commandCategories).map(cat => 
          `**${cat.name}** - ${cat.description}`
        ).join('\n')
      )
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category')
      .addOptions(
        Object.entries(commandCategories).map(([key, cat]) => 
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.name.replace(/[^\w\s]/g, '').trim())
            .setValue(key)
            .setDescription(cat.description.slice(0, 100))
        )
      );

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(menu);

    const response = await interaction.reply({
      embeds: [embed],
      components: [selectMenu],
      flags: MessageFlags.Ephemeral
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: (i) => i.user.id === interaction.user.id
    });

    collector.on('collect', async (i) => {
      const categoryKey = i.values[0];
      const category = commandCategories[categoryKey as keyof typeof commandCategories];

      if (!category) return;

      const categoryEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${category.name} Commands`)
        .setDescription(category.description)
        .addFields(
          category.commands.map(cmd => ({
            name: `/${cmd.name}`,
            value: cmd.description,
            inline: false
          }))
        )
        .setFooter({ text: 'AegisShield • Select another category above' })
        .setTimestamp();

      await i.update({ embeds: [categoryEmbed] });
    });

    collector.on('end', () => {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('Select a category')
        .setDisabled(true)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Expired')
            .setValue('expired')
            .setDescription('Menu expired')
        );

      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(disabledMenu);
      
      interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
  }
};