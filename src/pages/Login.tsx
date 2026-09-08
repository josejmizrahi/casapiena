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
    <div className="min-h-dvh flex items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Building2 className="size-5" /></div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Control de obra</h1>
            <p className="text-xs text-muted-foreground">Presupuesto, compras y pagos por proyecto</p>
          </div>
        </div>
        <Field label="Correo"><Input type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus /></Field>
        <Field label="Contraseña"><Input type="password" autoComplete="current-password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
        {err && <p className="text-sm text-bad">{err}</p>}
        <Button type="submit" className="w-full" disabled={!listo}>{cargando ? "Entrando…" : "Entrar"}</Button>
      </form>
    </div>
  );
}
