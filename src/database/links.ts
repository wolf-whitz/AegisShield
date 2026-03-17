import { supabase } from './supabase';
import { getOrCreateServerSettings } from './servers';

export async function addAllowedLink(serverId: string, domain: string): Promise<void> {
  const settings = await getOrCreateServerSettings(serverId);
  const currentLinks = settings.allowed_links || [];
  
  if (currentLinks.includes(domain)) {
    throw new Error('Domain already exists in allowed list');
  }
  
  const newLinks = [...currentLinks, domain];
  
  const { error } = await supabase
    .from('server_settings')
    .upsert(
      {
        server_id: serverId,
        allowed_links: newLinks,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'server_id' }
    );

  if (error) {
    console.error('Failed to add allowed link:', error);
    throw error;
  }
}

export async function removeAllowedLink(serverId: string, domain: string): Promise<void> {
  const settings = await getOrCreateServerSettings(serverId);
  const currentLinks = settings.allowed_links || [];
  
  const newLinks = currentLinks.filter(link => link !== domain);
  
  const { error } = await supabase
    .from('server_settings')
    .upsert(
      {
        server_id: serverId,
        allowed_links: newLinks,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'server_id' }
    );

  if (error) {
    console.error('Failed to remove allowed link:', error);
    throw error;
  }
}

export async function getAllowedLinks(serverId: string): Promise<string[]> {
  const settings = await getOrCreateServerSettings(serverId);
  return settings.allowed_links || [];
}

export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  
  return allowedDomains.some(allowed => {
    const normalizedAllowed = allowed.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const normalizedDomain = domain.replace(/^www\./, '');
    
    return normalizedDomain === normalizedAllowed || 
           normalizedDomain.endsWith('.' + normalizedAllowed) ||
           normalizedAllowed.endsWith('.' + normalizedDomain);
  });
}