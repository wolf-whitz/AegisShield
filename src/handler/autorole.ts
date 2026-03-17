import { Events, EmbedBuilder, Colors, MessageFlags, Role, type Client, type GuildMember } from 'discord.js';
import { getAutoRole } from '@bot/database';

export class AutoRoleHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleMemberJoin(member);
    });
  }

  private async handleMemberJoin(member: GuildMember): Promise<void> {
    if (member.user.bot) return;

    const autoRoleId = await getAutoRole(member.guild.id);
    if (!autoRoleId) return;

    let role: Role | undefined = member.guild.roles.cache.get(autoRoleId);
    
    if (!role) {
      try {
        const fetchedRoles = await member.guild.roles.fetch();
        role = fetchedRoles.get(autoRoleId);
      } catch {
        role = undefined;
      }
    }

    if (!role) {
      console.log(`[AutoRole] Role ${autoRoleId} not found in guild ${member.guild.id}`);
      return;
    }

    const botMember = member.guild.members.me;
    if (!botMember) return;

    const botHighestRole = botMember.roles.highest.position;
    if (botHighestRole <= role.position) {
      console.log(`[AutoRole] Cannot assign role ${role.name} - higher than bot role`);
      return;
    }

    try {
      await member.roles.add(role, 'Auto-role assignment');
      
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(`👋 Welcome to ${member.guild.name}`)
        .setDescription(`You have been automatically assigned the **${role.name}** role.`)
        .setFooter({ text: 'AegisShield Auto-Role System' })
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] }).catch(() => null);
      
      console.log(`[AutoRole] Assigned ${role.name} to ${member.user.tag}`);
    } catch (error) {
      console.error(`[AutoRole] Failed to assign role to ${member.user.tag}:`, error);
    }
  }
}