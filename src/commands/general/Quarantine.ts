import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction, EmbedBuilder, Colors, OverwriteType } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'quarantine',
  'Lockdown a channel for a specified time'
);

export const quarantineCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for quarantine')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '❌ This command can only be used in text channels.',
        ephemeral: true
      });
      return;
    }

    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const everyoneRole = interaction.guild.roles.everyone;

    await interaction.deferReply();

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: false,
        AddReactions: false
      }, { reason: `Quarantine: ${reason}` });

      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🔒 Channel Quarantined')
        .setDescription(`This channel has been locked down for **${minutes} minutes**`)
        .addFields(
          { name: '🛡️ Reason', value: reason, inline: false },
          { name: '⏰ Expires', value: `<t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:R>`, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      setTimeout(async () => {
        try {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
            ViewChannel: null,
            AddReactions: null
          }, { reason: 'Quarantine expired' });

          const unlockEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('🔓 Quarantine Lifted')
            .setDescription('This channel is now accessible again.')
            .setTimestamp();

          await channel.send({ embeds: [unlockEmbed] });
        } catch {
        }
      }, minutes * 60000);

    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to quarantine channel. Check bot permissions.'
      });
    }
  }
};