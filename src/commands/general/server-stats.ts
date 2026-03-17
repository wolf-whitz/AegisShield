import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags, ChannelType } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'server-stats',
  'Display detailed server statistics'
);

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function getBoostTier(level: number): string {
  switch (level) {
    case 0: return 'None';
    case 1: return 'Tier 1';
    case 2: return 'Tier 2';
    case 3: return 'Tier 3';
    default: return 'Unknown';
  }
}

export const serverStatsCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();
    await interaction.guild.members.fetch();

    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const forumChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size;
    
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const idleMembers = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
    const dndMembers = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
    const offlineMembers = totalMembers - onlineMembers - idleMembers - dndMembers;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;
    
    const admins = guild.members.cache.filter(m => m.permissions.has('Administrator')).size;
    
    const createdAt = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL({ size: 128 }) || undefined
      })
      .setThumbnail(guild.iconURL({ size: 1024 }) || null)
      .setDescription(`**${guild.description || 'No server description set'}**`)
      .addFields(
        {
          name: '👤 Members',
          value: [
            `**Total:** ${formatNumber(totalMembers)}`,
            `**Humans:** ${formatNumber(humans)} 👤`,
            `**Bots:** ${formatNumber(bots)} 🤖`,
            ``,
            `**Online:** ${formatNumber(onlineMembers)} 🟢`,
            `**Idle:** ${formatNumber(idleMembers)} 🌙`,
            `**DND:** ${formatNumber(dndMembers)} ⛔`,
            `**Offline:** ${formatNumber(offlineMembers)} ⚫`
          ].join('\n'),
          inline: true
        },
        {
          name: '💬 Channels',
          value: [
            `**Text:** ${formatNumber(textChannels)}`,
            `**Voice:** ${formatNumber(voiceChannels)}`,
            `**Categories:** ${formatNumber(categories)}`,
            `**Forums:** ${formatNumber(forumChannels)}`,
            ``,
            `**Total:** ${formatNumber(guild.channels.cache.size)}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🏷️ Server Info',
          value: [
            `**Owner:** ${owner ? `<@${owner.id}>` : 'Unknown'}`,
            `**Admins:** ${formatNumber(admins)}`,
            `**Roles:** ${formatNumber(guild.roles.cache.size)}`,
            `**Emojis:** ${formatNumber(guild.emojis.cache.size)}`,
            `**Stickers:** ${formatNumber(guild.stickers.cache.size)}`
          ].join('\n'),
          inline: true
        }
      )
      .addFields(
        {
          name: '💎 Nitro Boost',
          value: [
            `**Level:** ${getBoostTier(guild.premiumTier)}`,
            `**Boosts:** ${formatNumber(guild.premiumSubscriptionCount || 0)}`,
            `**Boosters:** ${formatNumber(guild.members.cache.filter(m => m.premiumSince).size)}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🔒 Security',
          value: [
            `**Verification:** ${guild.verificationLevel}`,
            `**2FA Required:** ${guild.mfaLevel === 1 ? 'Yes' : 'No'}`,
            `**Explicit Filter:** ${guild.explicitContentFilter}`
          ].join('\n'),
          inline: true
        },
        {
          name: '📅 Created',
          value: `<t:${createdAt}:F>\n(<t:${createdAt}:R>)`,
          inline: true
        }
      )
      .setImage(guild.bannerURL({ size: 1024 }) || guild.splashURL({ size: 1024 }) || null)
      .setFooter({ text: `Server ID: ${guild.id} • Requested by ${interaction.user.username}` })
      .setTimestamp();

    if (guild.vanityURLCode) {
      embed.addFields({ name: '🔗 Vanity URL', value: `discord.gg/${guild.vanityURLCode}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};