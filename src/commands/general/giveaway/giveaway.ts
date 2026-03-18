import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder, 
  Colors,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  Client
} from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { 
  createGiveaway, 
  getGiveaway, 
  endGiveaway as endGiveawayDb, 
  rerollGiveaway, 
  getActiveGiveaways,
  deleteGiveaway,
  addParticipant
} from '@bot/database';
import { logError } from '@utils';

const description = describeCommand('giveaway', 'Create and manage giveaways');

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await interaction.reply({
      content: '❌ Invalid duration format. Use: `1h`, `30m`, `2d`, `1d12h`',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const endTime = Date.now() + durationMs;

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle('🎉 Giveaway')
    .setDescription(`**Prize:** ${prize}\n\nClick the button below to enter!`)
    .addFields(
      { name: 'Winners', value: `${winners}`, inline: true },
      { name: 'Ends', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
      { name: 'Hosted by', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: `${winners} winner${winners > 1 ? 's' : ''} • Ends` })
    .setTimestamp(endTime);

  const enterButton = new ButtonBuilder()
    .setCustomId('giveaway_enter')
    .setLabel('🎉 Enter')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton);

  const message = await channel.send({ embeds: [embed], components: [row] });

  await createGiveaway({
    messageId: message.id,
    channelId: channel.id,
    guildId: interaction.guildId!,
    prize,
    winners,
    endTime: new Date(endTime).toISOString(),
    hostId: interaction.user.id,
    participants: []
  });

  await interaction.reply({
    content: `✅ Giveaway started in <#${channel.id}>!`,
    flags: MessageFlags.Ephemeral
  });

  setTimeout(() => endGiveaway(message.id, interaction.guildId!, interaction.client), durationMs);
}

async function handleEnd(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString('message_id', true);
  const giveaway = await getGiveaway(messageId);
  
  if (!giveaway) {
    await interaction.reply({
      content: '❌ Giveaway not found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (giveaway.guild_id !== interaction.guildId) {
    await interaction.reply({
      content: '❌ This giveaway is not in this server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (giveaway.ended) {
    await interaction.reply({
      content: '❌ This giveaway has already ended.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await endGiveaway(messageId, interaction.guildId!, interaction.client);

  await interaction.reply({
    content: '✅ Giveaway ended!',
    flags: MessageFlags.Ephemeral
  });
}

async function handleReroll(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString('message_id', true);
  const giveaway = await getGiveaway(messageId);
  
  if (!giveaway) {
    await interaction.reply({
      content: '❌ Giveaway not found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!giveaway.ended) {
    await interaction.reply({
      content: '❌ This giveaway has not ended yet.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!giveaway.participants || giveaway.participants.length === 0) {
    await interaction.reply({
      content: '❌ No participants to reroll.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const newWinners = selectWinners(giveaway.participants, giveaway.winners);
  await rerollGiveaway(messageId, newWinners);

  const channel = await interaction.guild!.channels.fetch(giveaway.channel_id) as TextChannel;
  if (channel) {
    await channel.send({
      content: `🎉 **New Winners:** ${newWinners.map((id: string) => `<@${id}>`).join(', ')}\nPrize: **${giveaway.prize}**`
    });
  }

  await interaction.reply({
    content: `✅ Rerolled! New winners: ${newWinners.map((id: string) => `<@${id}>`).join(', ')}`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const giveaways = await getActiveGiveaways(interaction.guildId!);

  if (giveaways.length === 0) {
    await interaction.reply({
      content: '❌ No active giveaways.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const list = giveaways.map((g: any) => {
    const endTimeMs = new Date(g.end_time).getTime();
    const timestamp = Math.floor(endTimeMs / 1000);
    return `• **${g.prize}** - <t:${timestamp}:R> - [Jump to message](https://discord.com/channels/${g.guild_id}/${g.channel_id}/${g.message_id})`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle('🎉 Active Giveaways')
    .setDescription(list);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString('message_id', true);
  const giveaway = await getGiveaway(messageId);
  
  if (!giveaway) {
    await interaction.reply({
      content: '❌ Giveaway not found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (giveaway.guild_id !== interaction.guildId) {
    await interaction.reply({
      content: '❌ This giveaway is not in this server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    const channel = await interaction.guild!.channels.fetch(giveaway.channel_id) as TextChannel;
    if (channel) {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) await message.delete();
    }
  } catch {}

  await deleteGiveaway(messageId);

  await interaction.reply({
    content: '✅ Giveaway deleted!',
    flags: MessageFlags.Ephemeral
  });
}

export const giveawayCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption(option => option.setName('prize').setDescription('What is the prize?').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('Duration (e.g., 1h, 30m, 2d)').setRequired(true))
        .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10))
        .addChannelOption(option => option.setName('channel').setDescription('Channel to post giveaway in').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(option => option.setName('message_id').setDescription('The giveaway message ID').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption(option => option.setName('message_id').setDescription('The giveaway message ID').setRequired(true))
    )
    .addSubcommand(subcommand => subcommand.setName('list').setDescription('List active giveaways'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a giveaway')
        .addStringOption(option => option.setName('message_id').setDescription('The giveaway message ID').setRequired(true))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start': await handleStart(interaction); break;
      case 'end': await handleEnd(interaction); break;
      case 'reroll': await handleReroll(interaction); break;
      case 'list': await handleList(interaction); break;
      case 'delete': await handleDelete(interaction); break;
    }
  }
};

async function endGiveaway(messageId: string, guildId: string, client: Client): Promise<void> {
  const giveaway = await getGiveaway(messageId);
  if (!giveaway || giveaway.ended) return;

  const winners = selectWinners(giveaway.participants || [], giveaway.winners);
  await endGiveawayDb(messageId, winners);

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(Colors.Grey)
    .setTitle('🎉 Giveaway Ended')
    .setDescription(`**Prize:** ${giveaway.prize}\n\n**Winners:** ${winners.length > 0 ? winners.map((id: string) => `<@${id}>`).join(', ') : 'No valid participants'}`)
    .setFooter({ text: 'Ended' })
    .setTimestamp();

  const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
  if (message) await message.edit({ embeds: [embed], components: [] });

  if (winners.length > 0) {
    await (channel as TextChannel).send({
      content: `🎉 **Congratulations** ${winners.map((id: string) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
    });
  }
}

function parseDuration(input: string): number | null {
  const regex = /^(\d+d)?(\d+h)?(\d+m)?$/i;
  const match = input.match(regex);
  if (!match) return null;
  
  let ms = 0;
  if (match[1]) ms += parseInt(match[1]) * 24 * 60 * 60 * 1000;
  if (match[2]) ms += parseInt(match[2]) * 60 * 60 * 1000;
  if (match[3]) ms += parseInt(match[3]) * 60 * 1000;
  
  return ms > 0 ? ms : null;
}

function selectWinners(participants: string[], count: number): string[] {
  if (participants.length === 0) return [];
  if (participants.length <= count) return [...participants];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}