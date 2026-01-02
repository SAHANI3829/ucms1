import { supabase } from "@/integrations/supabase/client";

/**
 * Prevents the app from getting stuck in a broken-auth loop (e.g. stale refresh token).
 * If the refresh token is invalid, we proactively sign out to clear local storage.
 */
export async function safeGetSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // Supabase uses this code when the client has a stale refresh token in storage.
      if ((error as any).code === "refresh_token_not_found") {
        await supabase.auth.signOut();
      }

      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (err: any) {
    // Defensive: if something throws, treat as unauthenticated.
    return { session: null, error: err };
  }
}

export async function safeGetUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if ((error as any).code === "refresh_token_not_found") {
        await supabase.auth.signOut();
      }

      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}