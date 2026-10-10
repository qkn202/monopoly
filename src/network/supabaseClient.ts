import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : (globalThis as any).process?.env || {};

// Validate required environment variables
const rawUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fallback values for development - in production these should be set via environment variables
const FALLBACK_URL = 'https://fxucyrofcsuqtlkukcrx.supabase.co';
const FALLBACK_KEY = 'sb_publishable_zEiG2Py5kDmGhkTgw0uWIA_We0rOCGu';

export const SUPABASE_URL: string = rawUrl || FALLBACK_URL;
export const SUPABASE_ANON_KEY: string = rawKey || FALLBACK_KEY;

// Log warning if using fallback values (production should always set these)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Warning: Using fallback credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for production.');
}

// Validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export function createSupabaseClient(): SupabaseClient {
  if (!isValidUrl(SUPABASE_URL)) {
    throw new Error(`[Supabase] Invalid URL: ${SUPABASE_URL}. Please set a valid VITE_SUPABASE_URL.`);
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 10) {
    throw new Error('[Supabase] Invalid anon key. Please set a valid VITE_SUPABASE_ANON_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 25,
      },
    },
  });
}

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    clientInstance = createSupabaseClient();
  }
  return clientInstance;
}

/**
 * Health check helper to test connection to Supabase Realtime
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const sb = getSupabase();
    const testChannel = sb.channel('healthcheck-' + Date.now());
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        sb.removeChannel(testChannel);
        resolve(false);
      }, 5000);

      testChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          sb.removeChannel(testChannel);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          sb.removeChannel(testChannel);
          resolve(false);
        }
      });
    });
  } catch {
    return false;
  }
}
