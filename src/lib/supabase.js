import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://hbshsolmbekqrixumvue.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ic9DgQY5qf7amv8CFyevBw_I5pikwQ-";
if (!url || !key) console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");

// URL de la app incluyendo la carpeta (en GitHub Pages es usuario.github.io/repo/).
// window.location.origin sola pierde la carpeta y el magic link no regresa a la app.
export const APP_URL = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // implicit: el link funciona aunque se abra en otro navegador (p. ej. el del app de Gmail).
    // Con PKCE el link solo sirve en el mismo navegador que lo pidió.
    flowType: "implicit",
  },
});
