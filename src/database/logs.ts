import { supabase } from './supabase';
import type { HoneypotLog, ProtectionLog, AIModerationLog } from '@types';


export async function logProtectionEvent(log: ProtectionLog): Promise<void> {
  const { error } = await supabase
    .from('protection_logs')
    .insert({
      ...log,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to log protection event:', error);
  }
}