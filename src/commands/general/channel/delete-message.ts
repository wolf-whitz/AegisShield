import { SlashCommandBuilder, EmbedBuilder, Colors, MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';

const description = describeCommand(
  'purge',
  'Delete multiple messages from the channel'
);

const MAX_BULK_DELETE = 100;
const MAX_AGE_DAYS = 14;
const COOLDOWN_MS = 20000;

const cooldowns = new Map<string, number>();

const isOnCooldown = (userId: string): boolean => {
  const lastUsed = cooldowns.get(userId);
  if (!lastUsed) return false;
  
  const now = Date.now();
  return now - lastUsed < COOLDOWN_MS;
};

const setCooldown = (userId: string): void => {
  cooldowns.set(userId, Date.now());
};

const getRemainingCooldown = (userId: string): number => {
  const lastUsed = cooldowns.get(userId);
  if (!lastUsed) return 0;
  
  const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
  return Math.max(0, Math.ceil(remaining / 1000));
};

export const purgeCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({
        content: 'This command can only be used in a server channel',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const userId = interaction.user.id;

    if (isOnCooldown(userId)) {
      const remaining = getRemainingCooldown(userId);
      await interaction.reply({
        content: `⏳ Command on cooldown. Wait ${remaining} more second${remaining === 1 ? '' : 's'}.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const messages = await channel.messages.fetch({ limit: amount });
      
      const now = Date.now();
      const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      
      let deletableMessages = messages.filter(msg => {
        const age = now - msg.createdTimestamp;
        return age < maxAge;
      });

      if (targetUser) {
        deletableMessages = deletableMessages.filter(msg => msg.author.id === targetUser.id);
      }

      if (deletableMessages.size === 0) {
        await interaction.editReply({
          content: 'No messages found that can be deleted (messages must be under 14 days old)'
        });
        return;
      }

      const deleted = await channel.bulkDelete(deletableMessages, true);

      setCooldown(userId);

      const skipped = messages.size - deletableMessages.size;
      
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('Messages Purged')
        .setDescription(`Deleted **${deleted.size}** message${deleted.size === 1 ? '' : 's'}`)
        .addFields(
          {
            name: 'Details',
            value: [
              targetUser ? `Filter: Messages from ${targetUser.tag}` : 'Filter: All users',
              skipped > 0 ? `Skipped: ${skipped} messages (over 14 days old)` : 'All messages were deletable',
              `Cooldown: 20 seconds`
            ].join('\n'),
            inline: false
          }
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Purge error:', error);
      await interaction.editReply({
        content: 'Failed to purge messages. Make sure I have permission to manage messages in this channel.'
      });
    }
  }
};