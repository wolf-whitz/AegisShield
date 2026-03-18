import { supabase } from './supabase';
import { logError } from '@utils';

export async function setAutoRole(serverId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ autorole_id: roleId })
    .eq('server_id', serverId);

  if (error) {
    logError('setAutoRole_failed', { serverId, roleId, error });
    throw error;
  }
}

export async function getAutoRole(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('autorole_id')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getAutoRole_failed', { serverId, error });
    return null;
  }

  return data?.autorole_id || null;
}

export async function removeAutoRole(serverId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ autorole_id: null })
    .eq('server_id', serverId);

  if (error) {
    logError('removeAutoRole_failed', { serverId, error });
    throw error;
  }
}