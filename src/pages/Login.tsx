import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Building2 } from "lucide-react";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<"entrar" | "crear" | "olvide">("entrar");
  const [aviso, setAviso] = useState("");
  const listo = correo.includes("@") && (modo === "olvide" || pass.length >= 6) && !cargando;
  const entrar = async () => {
    if (!listo) return;
    setErr(""); setCargando(true);
    if (modo === "olvide") {
      const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin + location.pathname });
      setCargando(false);
      if (error) return setErr(error.message);
      return setAviso("Te enviamos un correo con una liga para poner contraseña nueva. Ábrela desde este mismo teléfono o computadora.");
    }
    if (modo === "crear") {
      // Cuenta nueva. Si el proyecto de Supabase pide confirmar el correo, no hay sesión todavía.
      const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: pass });
      if (error) { setCargando(false); return setErr(error.message.includes("already registered") ? "Ese correo ya tiene cuenta. Entra con tu contraseña." : error.message); }
      if (!data.session) {
        // La base confirma la cuenta al crearse; intentamos entrar de inmediato.
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: pass });
        if (e2) setAviso("Te enviamos un correo para confirmar la cuenta. Ábrelo y después entra aquí con tu contraseña.");
      }
      setCargando(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: pass });
    setCargando(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message.includes("not confirmed") ? "Falta confirmar el correo. Revisa tu bandeja." : error.message);
  };
  return (
    <div className="min-h-dvh flex items-end md:items-center justify-center p-6 pb-10">
      <form className="w-full max-w-sm space-y-5" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
        <div className="border-t border-border-2 pt-4">
          <div className="anno flex items-center gap-2"><Building2 className="size-3.5 stroke-[1.75]" />Control de obra</div>
          <h1 className="text-[28px] font-semibold leading-tight mt-3 fig">Presupuesto, candados y pagos, por proyecto.</h1>
        </div>
        {aviso ? (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed">{aviso}</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => { setAviso(""); setModo("entrar"); }}>Ya confirmé, entrar</Button>
          </div>
        ) : (
          <>
            <Field label="Correo"><Input type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus /></Field>
            {modo !== "olvide" && (
              <Field label={modo === "crear" ? "Elige una contraseña" : "Contraseña"} hint={modo === "crear" ? "Mínimo 6 caracteres. Si alguien te invitó a un proyecto, usa el mismo correo al que te invitaron." : undefined}>
                <Input type="password" autoComplete={modo === "crear" ? "new-password" : "current-password"} placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
              </Field>
            )}
            {err && <p className="text-[13px] text-bad">{err}</p>}
            <Button type="submit" className="w-full" disabled={!listo}>{cargando ? "Un momento…" : modo === "crear" ? "Crear cuenta" : modo === "olvide" ? "Enviarme la liga" : "Entrar"}</Button>
            <div className="flex justify-between text-[13px]">
              <button type="button" className="text-ink-2 underline underline-offset-4 decoration-border-2 hover:text-foreground py-1" onClick={() => { setModo(modo === "entrar" ? "crear" : "entrar"); setErr(""); }}>
                {modo === "entrar" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta, entrar"}
              </button>
              {modo === "entrar" && <button type="button" className="text-ink-2 underline underline-offset-4 decoration-border-2 hover:text-foreground py-1" onClick={() => { setModo("olvide"); setErr(""); }}>Olvidé mi contraseña</button>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
