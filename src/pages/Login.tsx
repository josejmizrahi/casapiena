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
  const listo = correo.includes("@") && pass.length >= 6 && !cargando;
  const entrar = async () => {
    if (!listo) return;
    setErr(""); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: pass });
    setCargando(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
  };
  return (
    <div className="min-h-dvh flex items-end md:items-center justify-center p-6 pb-10">
      <form className="w-full max-w-sm space-y-5" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
        <div className="border-t border-border-2 pt-4">
          <div className="anno flex items-center gap-2"><Building2 className="size-3.5 stroke-[1.75]" />Control de obra</div>
          <h1 className="text-[28px] font-semibold leading-tight mt-3 fig">Presupuesto, candados y pagos, por proyecto.</h1>
        </div>
        <Field label="Correo"><Input type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus /></Field>
        <Field label="Contraseña"><Input type="password" autoComplete="current-password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
        {err && <p className="text-[13px] text-bad">{err}</p>}
        <Button type="submit" className="w-full" disabled={!listo}>{cargando ? "Entrando…" : "Entrar"}</Button>
      </form>
    </div>
  );
}
