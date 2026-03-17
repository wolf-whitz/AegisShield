export interface ServerRecord {
  id: string;
  server_id: string;
  server_name: string;
  owner_id: string;
  member_count: number;
  joined_at: string;
  honeypot_channel_id?: string;
  honeypot_log_channel_id?: string;
  log_channel_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServerSettings {
  id?: number;
  server_id: string;
  ping_message?: string;
  ping_title?: string;
  ping_color?: number;
  ping_updated_at?: string;
  prefix?: string;
  language?: string;
  protection_enabled?: boolean;
  channel_delete_threshold?: number;
  webhook_monitor_enabled?: boolean;
  allowed_links?: string[];
  ai_moderation_enabled?: boolean;
  ai_moderation_threshold?: number;
  created_at?: string;
  updated_at?: string;
}

export interface HoneypotLog {
  server_id: string;
  user_id: string;
  username: string;
  channel_id: string;
  message_content: string;
  action_taken: string;
}

export interface ProtectionLog {
  server_id: string;
  user_id: string;
  username: string;
  action_type: 'channel_delete' | 'webhook_create' | 'role_delete' | 'mass_ban' | 'mass_kick';
  details: string;
  action_taken: string;
  created_at?: string;
}

export interface AIModerationLog {
  server_id: string;
  user_id: string;
  username: string;
  message_content: string;
  flagged_categories: string[];
  severity_score: number;
  action_taken: 'delete' | 'warn' | 'timeout' | 'kick' | 'ban' | 'none';
  created_at?: string;
}