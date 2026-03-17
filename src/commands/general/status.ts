import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { describeCommand } from '@bot/describer/command-describer';
import type { Command } from '@types';
import mc from 'minecraftstatuspinger';
import dns from 'dns/promises';

const description = describeCommand(
  'status-minecraft',
  'Check the status of a Minecraft server'
);

async function resolveSRV(hostname: string): Promise<{ host: string; port: number } | null> {
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${hostname}`);
    const record = records[0];
    if (record) {
      return { host: record.name, port: record.port };
    }
  } catch {
  }
  return null;
}

function parseMOTD(description: any): string {
  if (!description) return 'No MOTD';
  
  if (typeof description === 'string') {
    return description;
  }
  
  if (description.text) {
    return description.text;
  }
  
  if (description.extra && Array.isArray(description.extra)) {
    return description.extra.map((e: any) => e.text || '').join('');
  }
  
  return 'No MOTD';
}

function stripColorCodes(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '').replace(/&[0-9a-fk-or]/gi, '');
}

function formatPlayerList(sample: any[] | undefined, maxDisplay: number = 5): string {
  if (!sample || sample.length === 0) return '';
  
  const names = sample.slice(0, maxDisplay).map((p: any) => p.name);
  const remaining = sample.length - maxDisplay;
  
  if (remaining > 0) {
    return ` (${names.join(', ')} +${remaining} more)`;
  }
  return ` (${names.join(', ')})`;
}

function formatUptime(enforceSecureProfile: boolean | undefined): string {
  if (enforceSecureProfile === undefined) return 'Unknown';
  return enforceSecureProfile ? '✅ Online' : '⚠️ Legacy';
}

function formatGamemode(gamemode: string | undefined): string {
  if (!gamemode) return 'Survival';
  const modes: Record<string, string> = {
    'survival': 'Survival',
    'creative': 'Creative',
    'adventure': 'Adventure',
    'spectator': 'Spectator'
  };
  return modes[gamemode.toLowerCase()] || gamemode;
}

export const statusMinecraftCommand: Command = {
  description,
  data: new SlashCommandBuilder()
    .setName(description.name)
    .setDescription(description.description)
    .addStringOption(option =>
      option
        .setName('ip')
        .setDescription('Server IP address or hostname')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('port')
        .setDescription('Server port (default: auto-detect from SRV or 25565)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(65535)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    let ip = interaction.options.getString('ip', true);
    let port = interaction.options.getInteger('port');

    ip = ip.replace(/^https?:\/\//, '').replace(/\/$/, '');

    await interaction.deferReply();

    try {
      if (!port) {
        const srv = await resolveSRV(ip);
        if (srv) {
          ip = srv.host;
          port = srv.port;
        } else {
          port = 25565;
        }
      }

      const result = await mc.lookup({
        host: ip,
        port: port,
        timeout: 10000,
        ping: true
      });

      if (!result.status) {
        await interaction.editReply({
          content: '❌ Server is offline or unreachable.'
        });
        return;
      }

      const status = result.status;
      const players = status.players || { online: 0, max: 0, sample: [] };
      const version = status.version?.name || 'Unknown';
      const latency = result.latency || 'N/A';
      
      const motd = stripColorCodes(parseMOTD(status.description));
      const playerList = formatPlayerList(players.sample);
      const displayAddress = `${ip}${port !== 25565 ? `:${port}` : ''}`;
      const secureStatus = formatUptime(status.enforcesSecureChat ?? status.enforceSecureProfile);
      const gamemode = formatGamemode(status.gamemode);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('🎮 Minecraft Server Status')
        .setDescription(`**${displayAddress}**\n\`\`\`${motd}\`\`\``)
        .addFields(
          {
            name: '📊 Players',
            value: `${players.online}/${players.max}${playerList}`,
            inline: true
          },
          {
            name: '⚡ Latency',
            value: `${latency}ms`,
            inline: true
          },
          {
            name: '🔧 Version',
            value: version,
            inline: true
          },
          {
            name: '🟢 Status',
            value: secureStatus,
            inline: true
          },
          {
            name: '🎯 Gamemode',
            value: gamemode,
            inline: true
          }
        )
        .setFooter({ text: 'Powered by AegisShield' })
        .setTimestamp();

      if (status.favicon) {
        try {
          const base64Image = status.favicon.replace(/^data:image\/png;base64,/, '');
          const buffer = Buffer.from(base64Image, 'base64');
          embed.setThumbnail('attachment://icon.png');
          
          await interaction.editReply({
            embeds: [embed],
            files: [{ attachment: buffer, name: 'icon.png' }]
          });
          return;
        } catch {
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error: any) {
      let errorMessage = '❌ Failed to fetch server status.';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += '\n\n**Connection refused.** Possible causes:\n' +
          '• Server is offline\n' +
          '• Wrong IP/port\n' +
          '• Server uses TCP shield/DDoS protection\n' +
          '• Server only allows Minecraft client connections';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        errorMessage += '\n\n**Connection timed out.**';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += '\n\n**DNS lookup failed.**';
      } else {
        errorMessage += ` \nError: ${error.message || 'Unknown error'}`;
      }
      
      errorMessage += `\n\nTried: \`${ip}:${port}\``;

      await interaction.editReply({ content: errorMessage });
    }
  }
};