import { supabase } from "./client"; // your Supabase client

export const dbStorage = {
  async getItem(key: string) {
    try {
      const { data, error } = await supabase
        .from("supabase_auth_sessions")
        .select("*")
        .eq("id", key)
        .single();

      if (error) {
        console.error("dbStorage getItem error:", error);
        return null;
      }

      if (!data) return null;

      // Supabase expects the **full session JSON**
      return JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      });
    } catch (err) {
      console.error("dbStorage getItem exception:", err);
      return null;
    }
  },

  async setItem(key: string, value: string) {
    try {
      // Supabase v2: get user async
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const session = JSON.parse(value);

      const { error } = await supabase.from("supabase_auth_sessions").upsert({
        id: key,
        user_id: user.id,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      });

      if (error) console.error("dbStorage setItem error:", error);
    } catch (err) {
      console.error("dbStorage setItem exception:", err);
    }
  },

  async removeItem(key: string) {
    try {
      const { error } = await supabase.from("supabase_auth_sessions").delete().eq("id", key);
      if (error) console.error("dbStorage removeItem error:", error);
    } catch (err) {
      console.error("dbStorage removeItem exception:", err);
    }
  },
};
