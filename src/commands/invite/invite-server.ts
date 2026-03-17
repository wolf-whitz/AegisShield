import { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'invite-server',
  'Get an invite link for this server'
);

export const inviteServerCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const invite = await interaction.guild.invites.create(interaction.channelId, {
      maxAge: 86400,
      maxUses: 0
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle('🔗 Server Invite')
      .setDescription(`Invite link for **${interaction.guild.name}**`)
      .addFields(
        { name: '⏰ Expires', value: '24 hours', inline: true },
        { name: '👤 Max Uses', value: 'Unlimited', inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Join Server')
          .setStyle(ButtonStyle.Link)
          .setURL(invite.url)
          .setEmoji('🚀')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};