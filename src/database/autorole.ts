import { supabase } from './supabase';

export async function setAutoRole(serverId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ autorole_id: roleId })
    .eq('server_id', serverId);

  if (error) {
    console.error('Failed to set auto-role:', error);
    throw error;
  }
}

export async function getAutoRole(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('autorole_id')
    .eq('server_id', serverId)
    .single();

  if (error) {
    console.error('Failed to get auto-role:', error);
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
    console.error('Failed to remove auto-role:', error);
    throw error;
  }
}