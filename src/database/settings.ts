import { supabase } from './supabase';
import type { ServerSettings } from '@types';

export async function setPingMessage(config: {
  server_id: string;
  message: string;
  title: string;
  color: number;
}): Promise<void> {
  console.log(`[DB] Setting ping message for server ${config.server_id}`);
  
  const { error } = await supabase
    .from('server_settings')
    .upsert(
      {
        server_id: config.server_id,
        ping_message: config.message,
        ping_title: config.title,
        ping_color: config.color,
        ping_updated_at: new Date().toISOString()
      },
      { onConflict: 'server_id' }
    );

  if (error) {
    console.error('[DB] Failed to set ping message:', error);
    throw error;
  }
  console.log('[DB] Ping message saved successfully');
}

export async function getPingMessage(serverId: string): Promise<ServerSettings | null> {
  console.log(`[DB] Fetching ping message for server ${serverId}`);
  
  const { data, error } = await supabase
    .from('server_settings')
    .select('ping_message, ping_title, ping_color, ping_updated_at')
    .eq('server_id', serverId)
    .single();

  if (error) {
    console.error('[DB] Error fetching ping message:', error);
    return null;
  }
  
  console.log('[DB] Raw data from DB:', data);
  
  if (!data?.ping_message) {
    console.log('[DB] No ping_message found in data');
    return null;
  }
  
  const result = {
    server_id: serverId,
    ping_message: data.ping_message,
    ping_title: data.ping_title || '👋 Hello there!',
    ping_color: data.ping_color || 3447003,
    ping_updated_at: data.ping_updated_at
  };
  
  console.log('[DB] Returning ping config:', result);
  return result;
}

export async function updateProtectionSettings(serverId: string, settings: {
  protection_enabled?: boolean;
  channel_delete_threshold?: number;
  webhook_monitor_enabled?: boolean;
}): Promise<void> {
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
    console.error('Failed to update protection settings:', error);
    throw error;
  }
}

export async function updateAIModerationSettings(serverId: string, settings: {
  ai_moderation_enabled?: boolean;
  ai_moderation_threshold?: number;
}): Promise<void> {
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
    console.error('Failed to update AI moderation settings:', error);
    throw error;
  }
}