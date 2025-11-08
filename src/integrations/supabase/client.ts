import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { dbStorage } from './dbStorage';  // new import

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: dbStorage, // use database instead of localStorage
    persistSession: true,
    autoRefreshToken: true,
  }
});
