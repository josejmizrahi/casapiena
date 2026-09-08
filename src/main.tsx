import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Si venimos del correo de recuperación, Supabase toma la sesión del hash antes de que
// el router lo reemplace, y dejamos marcado que hay que pedir contraseña nueva.
async function arrancar() {
  if (/access_token=/.test(location.hash)) {
    if (/type=recovery/.test(location.hash)) sessionStorage.setItem("obra:recuperar", "1");
    const { supabase } = await import("./lib/supabase");
    await supabase.auth.getSession();
  }
  createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
}
arrancar();
