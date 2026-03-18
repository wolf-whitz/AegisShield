import { supabase } from './supabase';
import { logError } from '@utils';

interface GiveawayData {
  messageId: string;
  channelId: string;
  guildId: string;
  prize: string;
  winners: number;
  endTime: string;
  hostId: string;
  participants: string[];
}

export async function createGiveaway(data: GiveawayData): Promise<void> {
  const { error } = await supabase
    .from('giveaways')
    .insert({
      message_id: data.messageId,
      channel_id: data.channelId,
      guild_id: data.guildId,
      prize: data.prize,
      winners: data.winners,
      end_time: data.endTime,
      host_id: data.hostId,
      participants: data.participants,
      ended: false
    });
  if (error) {
    logError('createGiveaway_failed', { data, error });
    throw error;
  }
}

export async function getGiveaway(messageId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('giveaways')
    .select('*')
    .eq('message_id', messageId)
    .maybeSingle();
  if (error) {
    logError('getGiveaway_failed', { messageId, error });
    return null;
  }
  return data;
}

export async function addParticipant(messageId: string, userId: string): Promise<void> {
  const giveaway = await getGiveaway(messageId);
  if (!giveaway || giveaway.ended) return;
  if (giveaway.participants.includes(userId)) return;
  const { error } = await supabase
    .from('giveaways')
    .update({ participants: [...giveaway.participants, userId] })
    .eq('message_id', messageId);
  if (error) {
    logError('addParticipant_failed', { messageId, userId, error });
    throw error;
  }
}

export async function endGiveaway(messageId: string, winners: string[]): Promise<void> {
  const { error } = await supabase
    .from('giveaways')
    .update({ ended: true, winner_ids: winners })
    .eq('message_id', messageId);
  if (error) {
    logError('endGiveaway_failed', { messageId, winners, error });
    throw error;
  }
}

export async function rerollGiveaway(messageId: string, newWinners: string[]): Promise<void> {
  const { error } = await supabase
    .from('giveaways')
    .update({ winner_ids: newWinners })
    .eq('message_id', messageId);
  if (error) {
    logError('rerollGiveaway_failed', { messageId, newWinners, error });
    throw error;
  }
}

export async function getActiveGiveaways(guildId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('giveaways')
    .select('*')
    .eq('guild_id', guildId)
    .eq('ended', false)
    .order('end_time', { ascending: true });
  if (error) {
    logError('getActiveGiveaways_failed', { guildId, error });
    return [];
  }
  return data || [];
}

export async function deleteGiveaway(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('giveaways')
    .delete()
    .eq('message_id', messageId);
  if (error) {
    logError('deleteGiveaway_failed', { messageId, error });
    throw error;
  }
}