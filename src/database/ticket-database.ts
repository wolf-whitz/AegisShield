import { supabase } from './supabase.js';
import type { Ticket, TicketMessage, TicketConfig } from '../types/ticket.js';

export async function getTicketConfig(guildId: string): Promise<TicketConfig | null> {
  const { data, error } = await supabase
    .from('ticket_configs')
    .select('*')
    .eq('guild_id', guildId)
    .single();
  
  if (error) return null;
  return data;
}

export async function setTicketConfig(config: TicketConfig): Promise<void> {
  const { error } = await supabase
    .from('ticket_configs')
    .upsert(config, { onConflict: 'guild_id' });
  
  if (error) throw error;
}

export async function getUserOpenTickets(guildId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('status', 'open');
  
  if (error) return 0;
  return count || 0;
}

export async function createTicket(ticket: Omit<Ticket, 'id' | 'created_at'>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      guild_id: ticket.guild_id,
      channel_id: ticket.channel_id,
      user_id: ticket.user_id,
      username: ticket.username,
      status: 'open'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function closeTicket(ticketId: string, closedBy: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: closedBy
    })
    .eq('id', ticketId);
  
  if (error) throw error;
}

export async function getTicketByChannel(channelId: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .eq('status', 'open')
    .single();
  
  if (error) return null;
  return data;
}

export async function logTicketMessage(message: Omit<TicketMessage, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: message.ticket_id,
      user_id: message.user_id,
      username: message.username,
      content: message.content,
      attachments: message.attachments
    });
  
  if (error) console.error('Failed to log message:', error);
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  
  if (error) return [];
  return data || [];
}