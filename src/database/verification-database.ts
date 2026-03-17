import { supabase } from './supabase.js';
import type { VerificationConfig, VerificationSession } from '../types/verification.js';

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

export async function createVerificationSession(session: Omit<VerificationSession, 'created_at'>): Promise<void> {
  const { error } = await supabase
    .from('verification_sessions')
    .insert({
      user_id: session.user_id,
      guild_id: session.guild_id,
      mode: session.mode,
      token: session.token,
      verified: false
    });
  
  if (error) {
    console.error('[DB] createVerificationSession error:', error);
    throw error;
  }
}

export async function verifyUser(userId: string, guildId: string): Promise<void> {
  console.log(`[DB] Attempting to verify user ${userId} in guild ${guildId}`);
  
  const { data: existing } = await supabase
    .from('verification_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();
  
  if (!existing) {
    console.log(`[DB] No existing session, creating new verified session`);
    const { error: insertError } = await supabase
      .from('verification_sessions')
      .insert({
        user_id: userId,
        guild_id: guildId,
        mode: 1,
        token: 'manual',
        verified: true
      });
    
    if (insertError) {
      console.error('[DB] verifyUser insert error:', insertError);
      throw insertError;
    }
    return;
  }
  
  console.log(`[DB] Existing session found, updating to verified`);
  const { error } = await supabase
    .from('verification_sessions')
    .update({ verified: true })
    .eq('user_id', userId)
    .eq('guild_id', guildId);
  
  if (error) {
    console.error('[DB] verifyUser update error:', error);
    throw error;
  }
}

export async function isVerified(userId: string, guildId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verification_sessions')
    .select('verified')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('verified', true)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] isVerified error:', error);
  }
  
  return data?.verified || false;
}