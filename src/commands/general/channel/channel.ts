import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  ChannelType,
  CategoryChannel,
  GuildChannel,
  ChatInputCommandInteraction,
  Colors
} from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import { logError } from '@utils';

const description = describeCommand('channel', 'Create and delete channels');

function parseChannelType(type: string): ChannelType {
  switch (type) {
    case 'text': return ChannelType.GuildText;
    case 'voice': return ChannelType.GuildVoice;
    case 'category': return ChannelType.GuildCategory;
    case 'announcement': return ChannelType.GuildAnnouncement;
    case 'forum': return ChannelType.GuildForum;
    case 'stage': return ChannelType.GuildStageVoice;
    default: return ChannelType.GuildText;
  }
}

function getChannelTypeName(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText: return 'Text';
    case ChannelType.GuildVoice: return 'Voice';
    case ChannelType.GuildCategory: return 'Category';
    case ChannelType.GuildAnnouncement: return 'Announcement';
    case ChannelType.GuildForum: return 'Forum';
    case ChannelType.GuildStageVoice: return 'Stage';
    default: return 'Unknown';
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = interaction.options.getString('name', true).toLowerCase().replace(/\s+/g, '-');
  const typeStr = interaction.options.getString('type') ?? 'text';
  const type = parseChannelType(typeStr);
  const categoryId = interaction.options.getString('category');
  const topic = interaction.options.getString('topic');
  const nsfw = interaction.options.getBoolean('nsfw') ?? false;
  const slowmode = interaction.options.getInteger('slowmode') ?? 0;
  const userLimit = interaction.options.getInteger('user_limit') ?? 0;
  const bitrate = interaction.options.getInteger('bitrate');
  const syncedPermissions = interaction.options.getBoolean('sync_permissions') ?? false;
  const privateChannel = interaction.options.getBoolean('private') ?? false;
  const allowedRoles = interaction.options.getString('allowed_roles')?.split(',').map(r => r.trim()) ?? [];
  const allowedUsers = interaction.options.getString('allowed_users')?.split(',').map(u => u.trim()) ?? [];

  if (!interaction.guild) {
    await interaction.editReply({ content: '❌ This command can only be used in a server.' });
    return;
  }

  const existingChannel = interaction.guild.channels.cache.find(
    c => c.name === name && c.type === type
  );
  if (existingChannel) {
    await interaction.editReply({ content: `❌ A channel named **${name}** already exists.` });
    return;
  }

  let parentCategory: CategoryChannel | null = null;
  if (categoryId) {
    const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
    if (category && category.type === ChannelType.GuildCategory) {
      parentCategory = category as CategoryChannel;
    }
  }

  const permissionOverwrites: any[] = [];

  if (privateChannel) {
    permissionOverwrites.push({
      id: interaction.guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    });

    permissionOverwrites.push({
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageWebhooks
      ]
    });

    if (interaction.guild.members.me) {
      permissionOverwrites.push({
        id: interaction.guild.members.me.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
      });
    }

    for (const roleName of allowedRoles) {
      const role = interaction.guild.roles.cache.find(r => 
        r.name.toLowerCase() === roleName.toLowerCase() || r.id === roleName
      );
      if (role) {
        permissionOverwrites.push({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
        });
      }
    }

    for (const userId of allowedUsers) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        permissionOverwrites.push({
          id: member.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
        });
      }
    }
  } else {
    permissionOverwrites.push({
      id: interaction.guild.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ],
      deny: nsfw ? [] : [PermissionFlagsBits.SendMessagesInThreads]
    });
  }

  try {
    let channel: GuildChannel;

    const baseOptions: any = {
      name,
      permissionOverwrites,
      parent: parentCategory?.id
    };

    if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) {
      channel = await interaction.guild.channels.create({
        ...baseOptions,
        type,
        topic: topic || undefined,
        nsfw,
        rateLimitPerUser: slowmode,
        defaultAutoArchiveDuration: 60
      });
    } else if (type === ChannelType.GuildVoice) {
      channel = await interaction.guild.channels.create({
        ...baseOptions,
        type,
        userLimit: userLimit > 0 ? userLimit : undefined,
        bitrate: bitrate ? bitrate * 1000 : undefined
      });
    } else if (type === ChannelType.GuildStageVoice) {
      channel = await interaction.guild.channels.create({
        ...baseOptions,
        type
      });
    } else if (type === ChannelType.GuildForum) {
      channel = await interaction.guild.channels.create({
        ...baseOptions,
        type,
        topic: topic || undefined,
        nsfw,
        defaultAutoArchiveDuration: 60,
        availableTags: []
      });
    } else if (type === ChannelType.GuildCategory) {
      channel = await interaction.guild.channels.create({
        name,
        type
      });
      
      if (syncedPermissions && parentCategory) {
        await channel.permissionOverwrites.set(parentCategory.permissionOverwrites.cache);
      }
    } else {
      channel = await interaction.guild.channels.create(baseOptions);
    }

    if (syncedPermissions && parentCategory && type !== ChannelType.GuildCategory) {
      await channel.lockPermissions();
    }

    const embed = {
      color: Colors.Green,
      title: '✅ Channel Created',
      fields: [
        { name: 'Name', value: channel.name, inline: true },
        { name: 'Type', value: getChannelTypeName(channel.type), inline: true },
        { name: 'ID', value: channel.id, inline: true },
        ...(parentCategory ? [{ name: 'Category', value: parentCategory.name, inline: true }] : []),
        ...(privateChannel ? [{ name: 'Visibility', value: 'Private', inline: true }] : []),
        ...(topic ? [{ name: 'Topic', value: topic }] : [])
      ],
      timestamp: new Date().toISOString()
    };

    await interaction.editReply({ embeds: [embed] });

  } catch (err: any) {
    logError('channel_create_error', { error: err.message, name, type: typeStr });
    await interaction.editReply({ 
      content: `❌ Failed to create channel: ${err.message || 'Unknown error'}` 
    });
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelInput = interaction.options.getString('channel', true).trim();
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const bulkDelete = interaction.options.getBoolean('bulk') ?? false;
  const pattern = interaction.options.getString('pattern');

  if (!interaction.guild) {
    await interaction.editReply({ content: '❌ This command can only be used in a server.' });
    return;
  }

  // Validate that channelInput looks like a snowflake (17-20 digit number)
  const snowflakeRegex = /^\d{17,20}$/;
  if (!snowflakeRegex.test(channelInput)) {
    await interaction.editReply({ 
      content: `❌ Invalid channel ID format. Please provide a valid channel ID (17-20 digit number), not "${channelInput}".` 
    });
    return;
  }

  try {
    if (bulkDelete && pattern) {
      const channelsToDelete = interaction.guild.channels.cache.filter(c => 
        c.name.includes(pattern) || c.id === channelInput
      );

      if (channelsToDelete.size === 0) {
        await interaction.editReply({ content: `❌ No channels found matching pattern **${pattern}**.` });
        return;
      }

      const deletedChannels: string[] = [];
      const failedChannels: string[] = [];

      for (const [, channel] of channelsToDelete) {
        try {
          await channel.delete(`${reason} (Bulk delete by ${interaction.user.tag})`);
          deletedChannels.push(channel.name);
        } catch {
          failedChannels.push(channel.name);
        }
      }

      const embed = {
        color: Colors.Red,
        title: '🗑️ Bulk Channel Delete',
        fields: [
          { name: 'Deleted', value: deletedChannels.join(', ') || 'None', inline: false },
          ...(failedChannels.length > 0 ? [{ name: 'Failed', value: failedChannels.join(', '), inline: false }] : []),
          { name: 'Reason', value: reason, inline: false }
        ],
        timestamp: new Date().toISOString()
      };

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelInput);
    if (!channel) {
      await interaction.editReply({ content: `❌ Channel with ID **${channelInput}** not found.` });
      return;
    }

    const channelName = channel.name;
    const channelType = getChannelTypeName(channel.type);

    await channel.delete(`${reason} (Deleted by ${interaction.user.tag})`);

    const embed = {
      color: Colors.Red,
      title: '🗑️ Channel Deleted',
      fields: [
        { name: 'Name', value: channelName, inline: true },
        { name: 'Type', value: channelType, inline: true },
        { name: 'ID', value: channelInput, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      timestamp: new Date().toISOString()
    };

    await interaction.editReply({ embeds: [embed] });

  } catch (err: any) {
    logError('channel_delete_error', { error: err.message, channelId: channelInput });
    
    let errorMessage = err.message || 'Unknown error';
    if (errorMessage.includes('Invalid Form Body') || errorMessage.includes('snowflake')) {
      errorMessage = `Invalid channel ID format. Make sure you're providing a valid channel ID (right-click channel → Copy Channel ID).`;
    } else if (errorMessage.includes('Unknown Channel')) {
      errorMessage = `Channel not found. The channel may have already been deleted or the ID is incorrect.`;
    }
    
    await interaction.editReply({ 
      content: `❌ Failed to delete channel: ${errorMessage}` 
    });
  }
}

export const channelCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new channel')
        .addStringOption(option => 
          option.setName('name').setDescription('Channel name (lowercase, no spaces)').setRequired(true)
        )
        .addStringOption(option => 
          option.setName('type').setDescription('Channel type')
            .addChoices(
              { name: 'Text', value: 'text' },
              { name: 'Voice', value: 'voice' },
              { name: 'Category', value: 'category' },
              { name: 'Announcement', value: 'announcement' },
              { name: 'Forum', value: 'forum' },
              { name: 'Stage', value: 'stage' }
            )
            .setRequired(false)
        )
        .addStringOption(option => 
          option.setName('category').setDescription('Parent category ID').setRequired(false)
        )
        .addStringOption(option => 
          option.setName('topic').setDescription('Channel topic/description').setRequired(false)
        )
        .addBooleanOption(option => 
          option.setName('nsfw').setDescription('Mark as NSFW').setRequired(false)
        )
        .addIntegerOption(option => 
          option.setName('slowmode').setDescription('Slowmode in seconds (0-21600)').setMinValue(0).setMaxValue(21600).setRequired(false)
        )
        .addIntegerOption(option => 
          option.setName('user_limit').setDescription('User limit for voice channels (0-99, 0 = unlimited)').setMinValue(0).setMaxValue(99).setRequired(false)
        )
        .addIntegerOption(option => 
          option.setName('bitrate').setDescription('Bitrate in kbps (8-384)').setMinValue(8).setMaxValue(384).setRequired(false)
        )
        .addBooleanOption(option => 
          option.setName('private').setDescription('Make channel private (only you and specified roles/users)').setRequired(false)
        )
        .addStringOption(option => 
          option.setName('allowed_roles').setDescription('Comma-separated role names/IDs for private channel').setRequired(false)
        )
        .addStringOption(option => 
          option.setName('allowed_users').setDescription('Comma-separated user IDs for private channel').setRequired(false)
        )
        .addBooleanOption(option => 
          option.setName('sync_permissions').setDescription('Sync permissions with category').setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a channel')
        .addStringOption(option => 
          option.setName('channel').setDescription('Channel ID to delete (right-click channel → Copy Channel ID)').setRequired(true)
        )
        .addStringOption(option => 
          option.setName('reason').setDescription('Reason for deletion').setRequired(false)
        )
        .addBooleanOption(option => 
          option.setName('bulk').setDescription('Delete multiple channels matching pattern').setRequired(false)
        )
        .addStringOption(option => 
          option.setName('pattern').setDescription('Pattern to match channel names for bulk delete').setRequired(false)
        )
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

    try {
      switch (subcommand) {
        case 'create': await handleCreate(interaction); break;
        case 'delete': await handleDelete(interaction); break;
      }
    } catch (err: any) {
      logError('channel_command_error', { subcommand, error: err.message });
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error: ${err.message || 'Command failed'}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${err.message || 'Command failed'}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};