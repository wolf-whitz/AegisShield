import { supabase } from './supabase';
import { logError } from '@utils';

export async function setReactionRoleChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ reaction_role_channel: channelId })
    .eq('server_id', serverId);

  if (error) {
    logError('setReactionRoleChannel_failed', { serverId, channelId, error });
    throw error;
  }
}

export async function getReactionRoleChannel(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('reaction_role_channel')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getReactionRoleChannel_failed', { serverId, error });
    return null;
  }

  return data?.reaction_role_channel || null;
}

export async function addReactionRole(serverId: string, messageId: string, emoji: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('reaction_roles')
    .insert({
      server_id: serverId,
      message_id: messageId,
      emoji: emoji,
      role_id: roleId
    });

  if (error) {
    logError('addReactionRole_failed', { serverId, messageId, emoji, roleId, error });
    throw error;
  }
}

export async function getReactionRoles(serverId: string): Promise<Array<{ message_id: string; emoji: string; role_id: string }> | null> {
  const { data, error } = await supabase
    .from('reaction_roles')
    .select('message_id, emoji, role_id')
    .eq('server_id', serverId);

  if (error) {
    logError('getReactionRoles_failed', { serverId, error });
    return null;
  }

  return data;
}

export async function removeReactionRole(serverId: string, messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase
    .from('reaction_roles')
    .delete()
    .eq('server_id', serverId)
    .eq('message_id', messageId)
    .eq('emoji', emoji);

  if (error) {
    logError('removeReactionRole_failed', { serverId, messageId, emoji, error });
    throw error;
  }
}

export async function getReactionRoleByEmoji(serverId: string, messageId: string, emoji: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('reaction_roles')
    .select('role_id')
    .eq('server_id', serverId)
    .eq('message_id', messageId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (error) {
    logError('getReactionRoleByEmoji_failed', { serverId, messageId, emoji, error });
    return null;
  }

  return data?.role_id || null;
}