import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  MessageFlags, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  Partials,
  AttachmentBuilder 
} from 'discord.js';
import type { Guild, GuildMember } from 'discord.js';
import { VerificationHandler, ProtectionHandler, AIModerationHandler, ReactionRoleHandler, TicketHandler, CommandHandler, HoneypotHandler, AutoRoleHandler } from '@bot/handler';
import { storeServer, getHoneypotChannel, getPingMessage } from '@bot/database';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences 
  ],
    partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

const commandHandler = new CommandHandler(TOKEN);
const honeypotHandler = new HoneypotHandler();

new TicketHandler(client);
new VerificationHandler(client);
new ProtectionHandler(client);
new AIModerationHandler(client);
new AutoRoleHandler(client);
new ReactionRoleHandler(client)

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await commandHandler.registerCommands(CLIENT_ID);
  console.log('Commands registered successfully');
});

client.on(Events.GuildCreate, async (guild) => {
  console.log(`Joined new server: ${guild.name} (${guild.id})`);
  
  const botMember = guild.members.me;
  if (!botMember) return;
  
  const hasAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);
  
  if (!hasAdmin) {
    console.warn(`⚠️  Bot lacks Administrator permission in ${guild.name}`);
    
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0xF39C12)
          .setTitle('⚠️ Missing Permissions')
          .setDescription(
            `**AegisShield** requires **Administrator** permission to function properly in **${guild.name}**.\n\n` +
            '**Required for:**\n' +
            '• Honeypot auto-kick system\n' +
            '• Ticket management\n' +
            '• Role creation\n' +
            '• Message moderation\n' +
            '• Admin abuse protection\n' +
            '• AI content moderation\n\n' +
            'Please grant Administrator permission to the bot.'
          );
        
        await owner.send({ embeds: [embed] });
      } catch (error: any) {
        console.error('Failed to DM owner:', error);
      }
    }
  }
  
  try {
    await storeServer({
      server_id: guild.id,
      server_name: guild.name,
      owner_id: guild.ownerId,
      member_count: guild.memberCount,
      joined_at: new Date().toISOString(),
    });
    console.log(`Stored server ${guild.id} to database`);
  } catch (error: any) {
    console.error('Failed to store server:', error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  if (message.mentions.users.has(client.user!.id)) {
    console.log(`[Ping] Bot mentioned in guild ${message.guild?.id || 'DM'} by ${message.author.username}`);
    
    const guildId = message.guild?.id;
    if (!guildId) {
      console.log('[Ping] No guild ID, using default message');
      await sendDefaultPingMessage(message);
      return;
    }
    
    const customConfig = await getPingMessage(guildId);
    console.log(`[Ping] Custom config result:`, customConfig);
    
    if (customConfig && customConfig.ping_message) {
      console.log('[Ping] Using custom message');
      const colorValue = customConfig.ping_color || 3447003;
      
      const customEmbed = new EmbedBuilder()
        .setColor(colorValue)
        .setTitle(customConfig.ping_title || '👋 Hello there!')
        .setDescription(
          customConfig.ping_message
            .replace(/{user}/g, message.author.username)
            .replace(/{bot}/g, client.user!.username)
            .replace(/{server}/g, message.guild!.name)
        )
        .setImage('attachment://ping-image.png')
        .setFooter({ text: 'Support The Creator: https://ko-fi.com/whitzscott1' })
        .setTimestamp();
      
      const attachment = new AttachmentBuilder(client.user!.displayAvatarURL({ size: 256 }), { name: 'ping-image.png' });
      
      await message.reply({ embeds: [customEmbed], files: [attachment] }).catch((err: any) => {
        console.error('[Ping] Failed to send custom reply:', err);
      });
    } else {
      console.log('[Ping] No custom config found, using default');
      await sendDefaultPingMessage(message);
    }
    return;
  }
  
  await honeypotHandler.handleMessage(message);
});

async function sendDefaultPingMessage(message: any) {
  const defaultEmbed = new EmbedBuilder()
    .setColor(3447003)
    .setTitle('👋 Hello there!')
    .setDescription(
      `Hey **${message.author.username}**, I'm **${message.client.user.username}**! 🤖\n\n` +
      `I'm here to help protect and manage your server.\n\n` +
      `Need help? Just use \`/help\` or check out my commands with \`/\`!`
    )
    .setImage('attachment://ping-image.png')
    .setFooter({ text: 'Support The Creator: https://ko-fi.com/whitzscott1' })
    .setTimestamp();
  
  const attachment = new AttachmentBuilder(message.client.user.displayAvatarURL({ size: 256 }), { name: 'ping-image.png' });
  
  await message.reply({ embeds: [defaultEmbed], files: [attachment] }).catch((err: any) => {
    console.error('[Ping] Failed to send default reply:', err);
  });
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild) return;
  
  const honeypotChannelId = await getHoneypotChannel(interaction.guild.id);
  
  if (interaction.channelId === honeypotChannelId && interaction.isCommand()) {
    const member = interaction.member;
    if (!member) return;
    
    const botMember = interaction.guild.members.me;
    if (!botMember) return;
    
    if (honeypotHandler.canModerateMember(botMember, member as GuildMember)) {
      try {
        await (member as GuildMember).kick('Honeypot: Triggered application command in trap channel');
      } catch (error: any) {
        console.error('Failed to kick command user:', error);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandHandler.getCommand(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error: any) {
    console.error(error);
    const reply = interaction.replied || interaction.deferred
      ? interaction.followUp
      : interaction.reply;
    await reply.call(interaction, {
      content: 'There was an error executing this command!',
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.login(TOKEN);