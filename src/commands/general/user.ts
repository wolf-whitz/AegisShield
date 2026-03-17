import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags, GuildMember } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'user',
  'Display user profile information'
);

function getStatusEmoji(status: string | undefined): string {
  switch (status) {
    case 'online': return '🟢';
    case 'idle': return '🌙';
    case 'dnd': return '⛔';
    case 'offline': return '⚫';
    default: return '⚪';
  }
}

export const userCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('User to show profile for (defaults to you)')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id) as GuildMember | undefined;

    try {
      const fetchedUser = await targetUser.fetch(true);
      
      const createdAt = Math.floor(targetUser.createdTimestamp / 1000);
      const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
      
      const bannerUrl = fetchedUser.bannerURL({ size: 1024 });
      const accentColor = fetchedUser.accentColor;
      const embedColor = bannerUrl ? Colors.Purple : (accentColor || Colors.Blurple);
      
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
          name: fetchedUser.globalName || fetchedUser.username,
          iconURL: targetUser.displayAvatarURL({ size: 128 })
        })
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setDescription(`**@${fetchedUser.username}**${fetchedUser.discriminator !== '0' ? `#${fetchedUser.discriminator}` : ''}`)
        .addFields(
          { 
            name: '📛 Display Name', 
            value: fetchedUser.globalName || 'None set', 
            inline: true 
          },
          { 
            name: '🆔 User ID', 
            value: `\`${targetUser.id}\``, 
            inline: true 
          },
          { 
            name: '🤖 Bot Account', 
            value: targetUser.bot ? 'Yes' : 'No', 
            inline: true 
          }
        );

      if (member) {
        const status = member.presence?.status;
        const statusText = status ? `${getStatusEmoji(status)} ${status.charAt(0).toUpperCase() + status.slice(1)}` : '⚪ Offline/Invisible';
        
        const roles = member.roles.cache
          .filter(r => r.id !== interaction.guild!.id)
          .sort((a, b) => b.position - a.position)
          .first(10)
          .map(r => `<@&${r.id}>`)
          .join(', ') || 'None';

        embed.addFields(
          { name: '📊 Status', value: statusText, inline: true },
          { name: '🎭 Nickname', value: member.nickname || 'None', inline: true },
          { name: `🏷️ Roles (${member.roles.cache.size - 1})`, value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles }
        );

        if (joinedAt) {
          embed.addFields({ name: '📅 Joined Server', value: `<t:${joinedAt}:R>`, inline: true });
        }

        if (member.premiumSince) {
          const boostDate = Math.floor(member.premiumSince.getTime() / 1000);
          embed.addFields({ name: '💎 Server Booster', value: `Since <t:${boostDate}:R>`, inline: true });
        }
      }

      embed.addFields({ name: '📅 Account Created', value: `<t:${createdAt}:R>`, inline: true });

      if (bannerUrl) {
        embed.setImage(bannerUrl);
      } else if (accentColor) {
        embed.addFields({ name: '🎨 Accent Color', value: `#${accentColor.toString(16).padStart(6, '0')}`, inline: true });
      }

      embed.setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      await interaction.editReply({ content: '❌ Failed to fetch user information.' });
    }
  },
};