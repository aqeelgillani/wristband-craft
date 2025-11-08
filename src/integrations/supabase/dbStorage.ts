// dbStorage.ts
import { supabase } from "./client";

interface AuthSessionRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export const dbStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from<AuthSessionRow>("supabase_auth_sessions")
        .select("access_token")
        .eq("id", key)
        .single();

      return data?.access_token ?? null;
    } catch (error) {
      console.error("Error getting item from dbStorage:", error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        console.warn("No user logged in. Cannot save session to dbStorage.");
        return;
      }

      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour expiry

      const { error } = await supabase
        .from<AuthSessionRow>("supabase_auth_sessions")
        .upsert({
          id: key,
          user_id: user.id,
          access_token: value,
          refresh_token: value, // For simplicity, store same value; can be updated to actual refresh token
          expires_at: expiresAt,
        });

      if (error) console.error("Error saving session in dbStorage:", error);
    } catch (error) {
      console.error("dbStorage setItem error:", error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const { error } = await supabase
        .from<AuthSessionRow>("supabase_auth_sessions")
        .delete()
        .eq("id", key);

      if (error) console.error("Error removing session from dbStorage:", error);
    } catch (error) {
      console.error("dbStorage removeItem error:", error);
    }
  },
};
