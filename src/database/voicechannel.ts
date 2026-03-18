import { supabase } from './supabase';
import { logError } from '@utils';

export async function setVoiceLogChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ voice_log_channel: channelId })
    .eq('server_id', serverId);

  if (error) {
    logError('setVoiceLogChannel_failed', { serverId, channelId, error });
    throw error;
  }
}

export async function getVoiceLogChannel(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('voice_log_channel')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getVoiceLogChannel_failed', { serverId, error });
    return null;
  }

  return data?.voice_log_channel || null;
}