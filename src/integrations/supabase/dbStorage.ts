import { supabase } from "./client";

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export const dbStorage = {
  // Get session from DB by key
  async getItem(key: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("supabase_auth_sessions")
        .select("access_token, refresh_token, expires_at")
        .eq("id", key)
        .single();

      if (error || !data) return null;

      // Supabase expects the session as a JSON string
      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      };

      return JSON.stringify(session);
    } catch (err) {
      console.error("dbStorage.getItem error:", err);
      return null;
    }
  },

  // Save session to DB
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Supabase sends session as JSON string
      const session: AuthSession = JSON.parse(value);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // Upsert into DB
      const { error } = await supabase.from("supabase_auth_sessions").upsert({
        id: key,
        user_id: user.id,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      });

      if (error) console.error("dbStorage.setItem error:", error);
    } catch (err) {
      console.error("dbStorage.setItem parse/save error:", err);
    }
  },

  // Remove session from DB
  async removeItem(key: string): Promise<void> {
    try {
      const { error } = await supabase.from("supabase_auth_sessions").delete().eq("id", key);
      if (error) console.error("dbStorage.removeItem error:", error);
    } catch (err) {
      console.error("dbStorage.removeItem exception:", err);
    }
  },
};
