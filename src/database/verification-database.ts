import { supabase } from './supabase.js';
import type { VerificationConfig } from '../types/verification.js';

export async function getVerificationConfig(guildId: string): Promise<VerificationConfig | null> {
  const { data, error } = await supabase
    .from('verification_configs')
    .select('*')
    .eq('guild_id', guildId)
    .single();
  
  if (error) {
    console.error('[DB] getVerificationConfig error:', error);
    return null;
  }
  return data;
}

export async function setVerificationConfig(config: VerificationConfig): Promise<void> {
  const { error } = await supabase
    .from('verification_configs')
    .upsert(config, { onConflict: 'guild_id' });
  
  if (error) {
    console.error('[DB] setVerificationConfig error:', error);
    throw error;
  }
}