/**
 * API Client Helper - Gets Clerk Supabase token for all API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "/api/v1";

/**
 * Get Clerk Supabase JWT token for authentication
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  // Client-side only
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clerk = (window as any).Clerk;
  if (clerk?.session) {
    try {
      return await clerk.session.getToken({ template: "supabase" });
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Authenticated API call helper
 */
export async function apiCall(endpoint: string, options?: RequestInit) {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });
}
