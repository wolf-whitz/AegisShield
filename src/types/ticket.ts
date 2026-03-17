export interface Ticket {
  id: string;
  guild_id: string;
  channel_id: string;
  user_id: string;
  username: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string;
  closed_by?: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  username: string;
  content: string;
  attachments: string[];
  created_at: string;
}

export interface TicketConfig {
  guild_id: string;
  max_tickets_per_user: number;
  category_id: string;
  ticket_channel_id?: string;
  support_role_id?: string;
  log_channel_id?: string;
}