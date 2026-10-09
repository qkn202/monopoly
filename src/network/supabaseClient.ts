import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : (globalThis as any).process?.env || {};

export const SUPABASE_URL: string =
  env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://fxucyrofcsuqtlkukcrx.supabase.co';

export const SUPABASE_ANON_KEY: string =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_zEiG2Py5kDmGhkTgw0uWIA_We0rOCGu';

export function createSupabaseClient(): SupabaseClient {
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
