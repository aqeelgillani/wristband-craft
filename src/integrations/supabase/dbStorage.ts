import { supabase } from "./client"; // import your client instance

export const dbStorage = {
  async getItem(key: string) {
    const { data } = await supabase
      .from("supabase_auth_sessions")
      .select("access_token")
      .eq("id", key)
      .single();
    return data?.access_token ?? null;
  },

  async setItem(key: string, value: string) {
    const user = supabase.auth.user();
    if (!user) return;

    const { error } = await supabase.from("supabase_auth_sessions").upsert({
      id: key,
      user_id: user.id,
      access_token: value,
      refresh_token: value,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    if (error) console.error(error);
  },

  async removeItem(key: string) {
    const { error } = await supabase.from("supabase_auth_sessions").delete().eq("id", key);
    if (error) console.error(error);
  },
};

