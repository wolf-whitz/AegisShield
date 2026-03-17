import { supabase } from './supabase';
import type { ServerRecord, ServerSettings, AIModerationLog } from '@types';

export async function storeServer(serverData: Omit<ServerRecord, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .upsert(
      { 
        server_id: serverData.server_id,
        server_name: serverData.server_name,
        owner_id: serverData.owner_id,
        member_count: serverData.member_count,
        joined_at: serverData.joined_at,
        honeypot_channel_id: serverData.honeypot_channel_id,
        log_channel_id: serverData.log_channel_id
      },
      { onConflict: 'server_id' }
    );

  if (error) {
    console.error('Failed to store server:', error);
    throw error;
  }
}

export async function getServer(serverId: string): Promise<ServerRecord | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('*')
    .eq('server_id', serverId)
    .single();

  if (error) return null;
  return data;
}

export async function setHoneypotChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ honeypot_channel_id: channelId })
    .eq('server_id', serverId);

  if (error) {
    console.error('Failed to set honeypot channel:', error);
    throw error;
  }
}

export async function getHoneypotChannel(serverId: string): Promise<string | null> {
  const server = await getServer(serverId);
  return server?.honeypot_channel_id || null;
}

export async function setLogChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ log_channel_id: channelId })
    .eq('server_id', serverId);

  if (error) {
    console.error('Failed to set log channel:', error);
    throw error;
  }
}

export async function getLogChannel(serverId: string): Promise<string | null> {
  const server = await getServer(serverId);
  return server?.log_channel_id || null;
}

export async function getOrCreateServerSettings(serverId: string): Promise<ServerSettings> {
  const { data, error } = await supabase
    .from('server_settings')
    .select('*')
    .eq('server_id', serverId)
    .single();

  if (error || !data) {
    const { data: newData, error: insertError } = await supabase
      .from('server_settings')
      .insert({
        server_id: serverId,
        ai_moderation_enabled: false,
        ai_moderation_threshold: 0.8
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create server settings:', insertError);
      throw insertError;
    }

    return {
      server_id: serverId,
      ai_moderation_enabled: false,
      ai_moderation_threshold: 0.8,
      ...newData
    };
  }

  return {
    ai_moderation_enabled: data.ai_moderation_enabled ?? false,
    ai_moderation_threshold: data.ai_moderation_threshold ?? 0.8,
    ...data
  };
}

export async function updateServerSettings(serverId: string, settings: Partial<ServerSettings>): Promise<void> {
  const { error } = await supabase
    .from('server_settings')
    .upsert(
      {
        server_id: serverId,
        ...settings,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'server_id' }
    );

  if (error) {
    console.error('Failed to update server settings:', error);
    throw error;
  }
}

export async function logAIModeration(log: AIModerationLog): Promise<void> {
  const { error } = await supabase
    .from('ai_moderation_logs')
    .insert({
      ...log,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to log AI moderation:', error);
    throw error;
  }
}