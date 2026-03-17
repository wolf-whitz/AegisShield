export interface VerificationConfig {
  guild_id: string;
  channel_id: string;
  mode: 1 | 2;
  role_id: string;
  secondary_role_id?: string | null;
}

export interface VerificationSession {
  user_id: string;
  guild_id: string;
  mode: number;
  token: string;
  verified: boolean;
  created_at?: string;
}