import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder, 
  Colors,
  ChatInputCommandInteraction
} from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { logError } from '@utils';

const MCTIERS_API_BASE = 'https://mctiers.com/api/v2';

interface GamemodeInfo {
  title: string;
  info_text?: string;
  kit_url?: string;
  discord_url?: string;
}

interface PlayerRanking {
  uuid: string;
  name: string;
  region: string | null;
  pos?: number;
  points?: number;
  rankings?: Record<string, any>;
}

interface TierList {
  "1": PlayerRanking[];
  "2": PlayerRanking[];
  "3": PlayerRanking[];
  "4": PlayerRanking[];
  "5": PlayerRanking[];
}

const description = describeCommand('mctiers', 'Check Minecraft player tiers and rankings');

async function apiFetch(endpoint: string): Promise<any> {
  const response = await fetch(`${MCTIERS_API_BASE}${endpoint}`);
  if (!response.ok) {
    if (response.status === 400) throw new Error('Invalid request parameters');
    if (response.status === 404) throw new Error('Player or gamemode not found');
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function handleGamemodes(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const gamemodes: Record<string, GamemodeInfo> = await apiFetch('/mode/list');
  
  const list = Object.entries(gamemodes)
    .map(([key, info]) => `• **${info.title}** (\`${key}\`)`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('🎮 Available Gamemodes')
    .setDescription(list || 'No gamemodes available')
    .setFooter({ text: 'MCTiers API v2' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleOverall(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const count = interaction.options.getInteger('count') ?? 10;
  const from = interaction.options.getInteger('from') ?? 0;

  const rankings: PlayerRanking[] = await apiFetch(`/mode/overall?count=${count}&from=${from}`);

  if (rankings.length === 0) {
    await interaction.editReply({ content: '❌ No rankings found.' });
    return;
  }

  const list = rankings
    .map((p, i) => `**${from + i + 1}.** ${p.name} - ${p.points} points${p.region ? ` (${p.region})` : ''}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle('🏆 Overall Rankings')
    .setDescription(list)
    .setFooter({ text: `Showing ${rankings.length} players | MCTiers API v2` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleGamemodeRankings(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const gamemode = interaction.options.getString('gamemode', true);
  const count = interaction.options.getInteger('count') ?? 10;
  const from = interaction.options.getInteger('from') ?? 0;
  const tier = interaction.options.getInteger('tier');

  const rankings: TierList = await apiFetch(`/mode/${gamemode}?count=${count}&from=${from}`);

  const gamemodes: Record<string, GamemodeInfo> = await apiFetch('/mode/list').catch(() => ({}));
  const gamemodeTitle = gamemodes[gamemode]?.title || gamemode;

  if (tier) {
    const tierKey = tier.toString() as keyof TierList;
    const tierPlayers = rankings[tierKey] || [];

    if (tierPlayers.length === 0) {
      await interaction.editReply({ content: `❌ No players found in Tier ${tier} for ${gamemodeTitle}.` });
      return;
    }

    const list = tierPlayers
      .map(p => `**${p.pos !== undefined ? p.pos + 1 : '?'}**. ${p.name}${p.region ? ` (${p.region})` : ''}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`🎯 ${gamemodeTitle} - Tier ${tier} Rankings`)
      .setDescription(list)
      .setFooter({ text: `Showing ${tierPlayers.length} players | MCTiers API v2` });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  let description = '';
  for (let t = 1; t <= 5; t++) {
    const tierKey = t.toString() as keyof TierList;
    const players = rankings[tierKey] || [];
    if (players.length > 0) {
      const topPlayers = players.slice(0, 5).map(p => p.name).join(', ');
      description += `**Tier ${t}:** ${topPlayers}${players.length > 5 ? ` +${players.length - 5} more` : ''}\n\n`;
    }
  }

  if (!description) {
    description = 'No rankings available for this gamemode.';
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🎯 ${gamemodeTitle} Rankings`)
    .setDescription(description)
    .setFooter({ text: `MCTiers API v2 | Use /mctiers gamemode with tier option for specific tiers` });

  await interaction.editReply({ embeds: [embed] });
}

async function handlePlayer(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const username = interaction.options.getString('username', true);

  try {
    const player = await apiFetch(`/profile/by-name/${encodeURIComponent(username)}`);
    
    let rankingsText = '';
    if (player.rankings && Object.keys(player.rankings).length > 0) {
      rankingsText = Object.entries(player.rankings)
        .map(([mode, rank]: [string, any]) => {
          const tier = rank.tier || '?';
          const pos = rank.pos !== undefined ? `#${rank.pos + 1}` : '';
          const retired = rank.retired ? ' (Retired)' : '';
          return `• ${mode}: **Tier ${tier}** ${pos}${retired}`;
        })
        .join('\n');
    } else {
      rankingsText = 'No rankings found.';
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Purple)
      .setTitle(`👤 ${player.name || username}`)
      .setThumbnail(`https://crafthead.net/avatar/${player.uuid || username}`)
      .addFields(
        { name: 'UUID', value: player.uuid || 'Unknown', inline: false },
        { name: 'Region', value: player.region || 'Unknown', inline: true },
        { name: 'Points', value: String(player.points || 0), inline: true },
        { name: 'Overall Rank', value: player.overall ? `#${player.overall}` : 'Unranked', inline: true },
        { name: 'Rankings', value: rankingsText, inline: false }
      )
      .setFooter({ text: 'MCTiers API v2' });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      await interaction.editReply({ content: `❌ Player **${username}** not found.` });
      return;
    }
    throw err;
  }
}

async function handlePlayerTier(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const username = interaction.options.getString('username', true);
  const gamemode = interaction.options.getString('gamemode', true);

  try {
    const player = await apiFetch(`/profile/by-name/${encodeURIComponent(username)}`);
    const rank = player.rankings?.[gamemode];

    if (!rank) {
      await interaction.editReply({ content: `❌ **${username}** has no ranking in **${gamemode}**.` });
      return;
    }

    const gamemodes: Record<string, GamemodeInfo> = await apiFetch('/mode/list').catch(() => ({}));
    const gamemodeTitle = gamemodes[gamemode]?.title || gamemode;

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(`🎯 ${player.name || username} - ${gamemodeTitle}`)
      .setThumbnail(`https://crafthead.net/avatar/${player.uuid || username}`)
      .addFields(
        { name: 'Tier', value: String(rank.tier || 'Unranked'), inline: true },
        { name: 'Position', value: rank.pos !== undefined ? `#${rank.pos + 1}` : 'N/A', inline: true },
        { name: 'Peak Tier', value: rank.peak_tier ? `Tier ${rank.peak_tier}` : 'None', inline: true },
        { name: 'Points', value: String(rank.points || player.points || 0), inline: true },
        { name: 'Status', value: rank.retired ? '🔴 Retired' : '🟢 Active', inline: true }
      )
      .setFooter({ text: 'MCTiers API v2' });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      await interaction.editReply({ content: `❌ Player **${username}** not found.` });
      return;
    }
    throw err;
  }
}

export const mctiersCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .addSubcommand(subcommand =>
      subcommand
        .setName('gamemodes')
        .setDescription('List all available gamemodes')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('overall')
        .setDescription('Show overall player rankings')
        .addIntegerOption(option => option.setName('count').setDescription('Number of results (max 50)').setMinValue(1).setMaxValue(50).setRequired(false))
        .addIntegerOption(option => option.setName('from').setDescription('Offset index').setMinValue(0).setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('gamemode')
        .setDescription('Show rankings for a specific gamemode')
        .addStringOption(option => option.setName('gamemode').setDescription('Gamemode key (use /mctiers gamemodes to list)').setRequired(true))
        .addIntegerOption(option => option.setName('count').setDescription('Number of results per tier (max 50)').setMinValue(1).setMaxValue(50).setRequired(false))
        .addIntegerOption(option => option.setName('from').setDescription('Offset index').setMinValue(0).setRequired(false))
        .addIntegerOption(option => option.setName('tier').setDescription('Specific tier (1-5)').setMinValue(1).setMaxValue(5).setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('player')
        .setDescription('Check a specific player')
        .addStringOption(option => option.setName('username').setDescription('Minecraft username').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tiers')
        .setDescription('Check a player tier in specific gamemode')
        .addStringOption(option => option.setName('username').setDescription('Minecraft username').setRequired(true))
        .addStringOption(option => option.setName('gamemode').setDescription('Gamemode key').setRequired(true))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'gamemodes': await handleGamemodes(interaction); break;
        case 'overall': await handleOverall(interaction); break;
        case 'gamemode': await handleGamemodeRankings(interaction); break;
        case 'player': await handlePlayer(interaction); break;
        case 'tiers': await handlePlayerTier(interaction); break;
      }
    } catch (err: any) {
      logError('mctiers_command_error', { subcommand, error: err.message });
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error: ${err.message || 'Failed to fetch data from MCTiers API'}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${err.message || 'Failed to fetch data from MCTiers API'}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};