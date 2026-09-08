import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/** Se muestra al llegar desde la liga de recuperación: la sesión ya existe, falta la contraseña nueva. */
export default function NuevaContrasena({ onListo }: { onListo: () => void }) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [cargando, setCargando] = useState(false);
  const listo = pass.length >= 6 && pass === pass2 && !cargando;
  const guardar = async () => {
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setCargando(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    location.hash = "#/";
    onListo();
  };
  return (
    <div className="min-h-dvh flex items-end md:items-center justify-center p-6 pb-10">
      <form className="w-full max-w-sm space-y-5" onSubmit={(e) => { e.preventDefault(); if (listo) guardar(); }}>
        <div className="border-t border-border-2 pt-4">
          <div className="anno">Recuperar acceso</div>
          <h1 className="text-[28px] font-semibold leading-tight mt-3 fig">Pon tu contraseña nueva.</h1>
        </div>
        <Field label="Contraseña nueva" hint="Mínimo 6 caracteres."><Input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus /></Field>
        <Field label="Repítela"><Input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></Field>
        {pass2 && pass !== pass2 && <p className="text-[13px] text-bad">No coinciden.</p>}
        <Button type="submit" className="w-full" disabled={!listo}>{cargando ? "Guardando…" : "Guardar y entrar"}</Button>
      </form>
    </div>
  );
}
