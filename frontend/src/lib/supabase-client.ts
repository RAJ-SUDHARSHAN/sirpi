/**
 * Supabase client configured with Clerk authentication.
 * Uses Clerk JWT tokens for RLS policies.
 */

import { useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create Supabase client with Clerk authentication.
 * This client automatically includes Clerk user ID in all queries.
 */
export function useSupabaseClient() {
  const { session } = useSession();

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: async (url, options = {}) => {
        // Get Clerk token with Supabase template
        const clerkToken = await session?.getToken({
          template: 'supabase', // Name of JWT template in Clerk
        });

        // Add Clerk token to request headers
        const headers = new Headers(options?.headers);
        if (clerkToken) {
          headers.set('Authorization', `Bearer ${clerkToken}`);
        }

        // Call fetch with Clerk token
        return fetch(url, {
          ...options,
          headers,
        });
      },
    },
  });

  return client;
}

/**
 * Server-side Supabase client (for API routes).
 */
export async function createServerSupabaseClient(clerkToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
  });
}
