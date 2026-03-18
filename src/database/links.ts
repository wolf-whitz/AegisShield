import { supabase } from './supabase';
import { getOrCreateServerSettings } from './servers';
import { logError } from '@utils';

let scamDomains: Set<string> | null = null;
let lastLoadTime: number = 0;
const CACHE_DURATION = 3600000;

async function loadScamDomains(): Promise<Set<string>> {
  const now = Date.now();
  
  if (scamDomains && now - lastLoadTime < CACHE_DURATION) {
    return scamDomains;
  }
  
  try {
    const response = await fetch('https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json');
    const domains = await response.json() as string[];
    scamDomains = new Set(domains);
    lastLoadTime = now;
    return scamDomains;
  } catch (error) {
    logError('loadScamDomains_failed', { error });
    return scamDomains || new Set();
  }
}

export async function isScamLink(url: string): Promise<boolean> {
  const domains = await loadScamDomains();
  
  const domain = url.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.split(':')[0] || '';
  
  if (!domain) return false;
  
  return domains.has(domain) || domains.has(`www.${domain}`);
}

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
    logError('addAllowedLink_failed', { serverId, domain, error });
    throw error;
  }
}

export async function removeAllowedLink(serverId: string, domain: string): Promise<void> {
  const settings = await getOrCreateServerSettings(serverId);
  const currentLinks = settings.allowed_links || [];
  
  const newLinks = currentLinks.filter((link: string) => link !== domain);
  
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
    logError('removeAllowedLink_failed', { serverId, domain, error });
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
  
  return allowedDomains.some((allowed: string) => {
    const normalizedAllowed = allowed.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const normalizedDomain = domain.replace(/^www\./, '');
    
    return normalizedDomain === normalizedAllowed || 
           normalizedDomain.endsWith('.' + normalizedAllowed) ||
           normalizedAllowed.endsWith('.' + normalizedDomain);
  });
}