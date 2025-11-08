import { supabase } from "./client";

export const dbStorage = {
  async getItem(key: string) {
    const { data, error } = await supabase
      .from("supabase_auth_sessions")
      .select("access_token")
      .eq("id", key)
      .single();

    if (error) {
      console.error("dbStorage.getItem error:", error);
      return null;
    }

    return data?.access_token ?? null;
  },

  async setItem(key: string, value: string) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const { error } = await supabase
      .from("supabase_auth_sessions")
      .upsert({
        id: key,
        user_id: user.id,
        access_token: value,
        refresh_token: value, // ideally, store actual refresh_token from session
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // or use token expiry
      });

    if (error) console.error("dbStorage.setItem error:", error);
  },

  async removeItem(key: string) {
    const { error } = await supabase.from("supabase_auth_sessions").delete().eq("id", key);
    if (error) console.error("dbStorage.removeItem error:", error);
  },
};
