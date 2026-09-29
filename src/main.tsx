import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Regreso desde las ligas de correo de Supabase (recuperar contraseña, confirmar cuenta).
// Llega como #access_token=…&type=recovery (flujo implícito), ?token_hash=…&type=recovery
// (plantilla de correo propia) o #error=…&error_code=otp_expired si la liga ya no sirve.
// Hay que atenderlo antes de montar el HashRouter: si no, toma el hash como ruta y lo tira.
async function arrancar() {
  const q = new URLSearchParams(location.search);
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  const de = (k: string) => h.get(k) || q.get(k);
  const deCorreo = h.has("access_token") || q.has("token_hash") || !!de("error_code") || !!de("error_description");
  if (deCorreo) {
    const { supabase } = await import("./lib/supabase");
    if (de("error_code") || de("error_description")) {
      const codigo = de("error_code") || "";
      sessionStorage.setItem("obra:aviso", codigo === "otp_expired" || /expired|invalid/i.test(de("error_description") || "")
        ? "La liga del correo ya expiró o ya se usó. Pide una nueva con “Olvidé mi contraseña”."
        : `No se pudo abrir la liga del correo: ${de("error_description") || codigo}`);
    } else if (q.has("token_hash")) {
      const tipo = (q.get("type") || "recovery") as "recovery" | "signup" | "email" | "invite" | "magiclink";
      const { error } = await supabase.auth.verifyOtp({ token_hash: q.get("token_hash")!, type: tipo });
      if (error) sessionStorage.setItem("obra:aviso", "La liga del correo ya expiró o ya se usó. Pide una nueva con “Olvidé mi contraseña”.");
      else if (tipo === "recovery") sessionStorage.setItem("obra:recuperar", "1");
    } else {
      if (de("type") === "recovery") sessionStorage.setItem("obra:recuperar", "1");
      // el cliente lee la sesión del hash al iniciar; esperamos a que termine
      await supabase.auth.getSession();
    }
    // limpia tokens y errores de la barra de direcciones y arranca en el inicio
    history.replaceState(null, "", location.pathname + "#/");
  }
  createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
}
arrancar();
