import { supabase } from './supabase';
import { logError } from '@utils';

export async function setWelcomeChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ welcome_channel: channelId })
    .eq('server_id', serverId);

  if (error) {
    logError('setWelcomeChannel_failed', { serverId, channelId, error });
    throw error;
  }
}

export async function getWelcomeChannel(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('welcome_channel')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getWelcomeChannel_failed', { serverId, error });
    return null;
  }

  return data?.welcome_channel || null;
}

export async function setWelcomeMessage(serverId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ welcome_message: message })
    .eq('server_id', serverId);

  if (error) {
    logError('setWelcomeMessage_failed', { serverId, message, error });
    throw error;
  }
}

export async function getWelcomeMessage(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('welcome_message')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getWelcomeMessage_failed', { serverId, error });
    return null;
  }

  return data?.welcome_message || null;
}

export async function setLeaveChannel(serverId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ leave_channel: channelId })
    .eq('server_id', serverId);

  if (error) {
    logError('setLeaveChannel_failed', { serverId, channelId, error });
    throw error;
  }
}

export async function getLeaveChannel(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('leave_channel')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getLeaveChannel_failed', { serverId, error });
    return null;
  }

  return data?.leave_channel || null;
}

export async function setLeaveMessage(serverId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('servers')
    .update({ leave_message: message })
    .eq('server_id', serverId);

  if (error) {
    logError('setLeaveMessage_failed', { serverId, message, error });
    throw error;
  }
}

export async function getLeaveMessage(serverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('leave_message')
    .eq('server_id', serverId)
    .maybeSingle();

  if (error) {
    logError('getLeaveMessage_failed', { serverId, error });
    return null;
  }

  return data?.leave_message || null;
}