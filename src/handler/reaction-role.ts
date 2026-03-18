import { Events, type Client, type MessageReaction, type User, type PartialMessageReaction, type PartialUser } from 'discord.js';
import { getReactionRoleByEmoji, removeReactionRole } from '@bot/database';
import { logError } from '@utils';

export class ReactionRoleHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      await this.handleReactionAdd(reaction, user);
    });

    client.on(Events.MessageReactionRemove, async (reaction, user) => {
      await this.handleReactionRemove(reaction, user);
    });
  }

  private async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    if (user.partial) {
      try {
        await user.fetch();
      } catch {
        return;
      }
    }

    const fullReaction = reaction as MessageReaction;
    const fullUser = user as User;

    if (!fullReaction.message.guild) return;

    let member = fullReaction.message.guild.members.cache.get(fullUser.id);
    if (!member) {
      try {
        member = await fullReaction.message.guild.members.fetch(fullUser.id);
      } catch {
        return;
      }
    }

    let emoji: string;
    if (fullReaction.emoji.id) {
      emoji = `<:${fullReaction.emoji.name}:${fullReaction.emoji.id}>`;
    } else {
      emoji = fullReaction.emoji.name!;
    }

    const roleId = await getReactionRoleByEmoji(fullReaction.message.guild.id, fullReaction.message.id, emoji);
    if (!roleId) return;

    const role = fullReaction.message.guild.roles.cache.get(roleId);
    if (!role) {
      logError('reactionRole_roleNotFound', { guildId: fullReaction.message.guild.id, roleId });
      return;
    }

    const botMember = fullReaction.message.guild.members.me;
    if (!botMember) return;

    if (botMember.roles.highest.position <= role.position) return;

    if (member.roles.cache.has(roleId)) return;

    try {
      await member.roles.add(role, 'Reaction role');
    } catch (error) {
      logError('reactionRole_addFailed', { guildId: fullReaction.message.guild.id, userId: fullUser.id, roleId, error });
    }
  }

  private async handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    if (user.partial) {
      try {
        await user.fetch();
      } catch {
        return;
      }
    }

    const fullReaction = reaction as MessageReaction;
    const fullUser = user as User;

    if (!fullReaction.message.guild) return;

    let member = fullReaction.message.guild.members.cache.get(fullUser.id);
    if (!member) {
      try {
        member = await fullReaction.message.guild.members.fetch(fullUser.id);
      } catch {
        return;
      }
    }

    let emoji: string;
    if (fullReaction.emoji.id) {
      emoji = `<:${fullReaction.emoji.name}:${fullReaction.emoji.id}>`;
    } else {
      emoji = fullReaction.emoji.name!;
    }

    const roleId = await getReactionRoleByEmoji(fullReaction.message.guild.id, fullReaction.message.id, emoji);
    if (!roleId) return;

    const role = fullReaction.message.guild.roles.cache.get(roleId);
    if (!role) return;

    try {
      await member.roles.remove(role, 'Reaction role removed');
    } catch (error) {
      logError('reactionRole_removeFailed', { guildId: fullReaction.message.guild.id, userId: fullUser.id, roleId, error });
    }

    try {
      await removeReactionRole(fullReaction.message.guild.id, fullReaction.message.id, emoji);
    } catch (error) {
      logError('reactionRole_dbRemoveFailed', { guildId: fullReaction.message.guild.id, messageId: fullReaction.message.id, emoji, error });
    }

    try {
      const message = await fullReaction.message.fetch();
      const userReactions = message.reactions.cache.filter(r => {
        const rEmoji = r.emoji.id ? `<:${r.emoji.name}:${r.emoji.id}>` : r.emoji.name;
        return rEmoji === emoji;
      });
      
      for (const [, msgReaction] of userReactions) {
        const users = await msgReaction.users.fetch();
        if (users.has(fullUser.id)) {
          await msgReaction.users.remove(fullUser.id);
        }
      }
    } catch (error) {
      logError('reactionRole_reactionRemoveFailed', { guildId: fullReaction.message.guild.id, messageId: fullReaction.message.id, emoji, error });
    }
  }
}