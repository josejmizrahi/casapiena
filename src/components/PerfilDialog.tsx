import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import * as api from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";

export const usePerfil = () => useQuery({ queryKey: ["perfil"], queryFn: api.miPerfil, staleTime: 300_000 });

/** Nombre, despacho, teléfono y logo. Salen en el reporte al cliente y en el Excel. */
export function PerfilDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = usePerfil();
  const [d, setD] = useState({ nombre: "", despacho: "", telefono: "" });
  const [logo, setLogo] = useState("");
  const [cargando, setCargando] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) { setD({ nombre: data.nombre, despacho: data.despacho, telefono: data.telefono }); setLogo(data.logoUrl); } }, [data]);
  const guardar = async () => {
    setCargando(true);
    try { await api.guardarPerfil(d); qc.invalidateQueries({ queryKey: ["perfil"] }); toast.success("Perfil guardado"); onClose(); }
    catch (e) { toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCargando(false); }
  };
  const subir = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast.error("El logo debe pesar menos de 2 MB");
    setCargando(true);
    try { const u = await api.subirLogo(f); setLogo(u); qc.invalidateQueries({ queryKey: ["perfil"] }); toast.success("Logo actualizado"); }
    catch (e) { toast.error("No se pudo subir", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCargando(false); }
  };
  const quitar = async () => { try { await api.quitarLogo(); setLogo(""); qc.invalidateQueries({ queryKey: ["perfil"] }); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Mi perfil" description="Sale en el reporte al cliente">
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="size-20 border border-border-2 rounded-[10px] flex items-center justify-center overflow-hidden bg-panel">
              {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-6 text-ink-3 stroke-[1.5]" />}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" disabled={cargando} onClick={() => file.current?.click()}><ImagePlus />{logo ? "Cambiar logo" : "Subir logo"}</Button>
              {logo && <Button size="sm" variant="ghost" className="text-bad justify-start" onClick={quitar}><Trash2 />Quitar</Button>}
            </div>
          </div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
          <p className="text-[12px] text-ink-3">PNG, JPG, WebP o SVG, hasta 2 MB. Se ve mejor con fondo transparente.</p>
        </div>
        <Field label="Tu nombre"><Input value={d.nombre} placeholder="Ej. Arq. Fernanda Ochoa" onChange={(e) => setD({ ...d, nombre: e.target.value })} /></Field>
        <Field label="Despacho"><Input value={d.despacho} placeholder="Ej. Ochoa Interiores" onChange={(e) => setD({ ...d, despacho: e.target.value })} /></Field>
        <Field label="Teléfono"><Input inputMode="tel" value={d.telefono} placeholder="55 0000 0000" onChange={(e) => setD({ ...d, telefono: e.target.value })} /></Field>
        <DialogActions>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={cargando} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
