import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://hbshsolmbekqrixumvue.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ic9DgQY5qf7amv8CFyevBw_I5pikwQ-";
if (!url || !key) console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
