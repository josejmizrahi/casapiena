import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, FileText, Paperclip, Trash2 } from "lucide-react";
import * as api from "@/api";
import type { Adjunto } from "@/lib/types";
import { fecha } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const adjuntosKey = (proyectoId: string) => ["adjuntos", proyectoId] as const;
export const useAdjuntos = (proyectoId: string) => useQuery({ queryKey: adjuntosKey(proyectoId), queryFn: () => api.listaAdjuntos(proyectoId), staleTime: 60_000 });

const tamano = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} kB`);

/** Fotos, facturas y comprobantes de un concepto o un pago. En móvil abre la cámara directo. */
export function Adjuntos({ proyectoId, conceptoId, pagoId }: { proyectoId: string; conceptoId?: string; pagoId?: string }) {
  const qc = useQueryClient();
  const { data } = useAdjuntos(proyectoId);
  const [subiendo, setSubiendo] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const lista = (data || []).filter((a) => (conceptoId ? a.conceptoId === conceptoId : a.pagoId === pagoId));
  const refrescar = () => qc.invalidateQueries({ queryKey: adjuntosKey(proyectoId) });

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 15_000_000) { toast.error(`${f.name} pesa más de 15 MB`); continue; }
        await api.subirAdjunto(proyectoId, { conceptoId, pagoId }, f);
      }
      await refrescar();
      toast.success(files.length === 1 ? "Archivo guardado" : `${files.length} archivos guardados`);
    } catch (e) { toast.error("No se pudo subir", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setSubiendo(false); }
  };
  const abrir = async (a: Adjunto) => {
    try {
      const u = urls[a.ruta] || (await api.urlsFirmadas([a.ruta]))[a.ruta];
      if (!u) throw new Error("No se pudo generar la liga");
      setUrls((x) => ({ ...x, [a.ruta]: u }));
      window.open(u, "_blank", "noopener");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const borrar = async (a: Adjunto) => {
    if (!confirm(`¿Borrar ${a.nombre}?`)) return;
    try { await api.borrarAdjunto(a); await refrescar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="space-y-2">
      <Label>Fotos y documentos</Label>
      {lista.map((a) => (
        <div key={a.id} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
          <button type="button" onClick={() => abrir(a)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
            <span className="size-9 border border-border-2 flex items-center justify-center shrink-0 text-ink-2">{a.tipo.startsWith("image/") ? <Camera className="size-4 stroke-[1.5]" /> : <FileText className="size-4 stroke-[1.5]" />}</span>
            <span className="min-w-0"><span className="block text-[14px] truncate">{a.nombre}</span><span className="block text-[11.5px] text-ink-3 num">{fecha(a.createdAt.slice(0, 10))} · {tamano(a.tamano)}</span></span>
          </button>
          <Button size="icon" variant="ghost" className="text-bad shrink-0" aria-label="Borrar adjunto" onClick={() => borrar(a)}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="md:hidden" disabled={subiendo} onClick={() => cam.current?.click()}><Camera />Foto</Button>
        <Button size="sm" variant="outline" disabled={subiendo} onClick={() => file.current?.click()}><Paperclip />{subiendo ? "Subiendo…" : "Adjuntar archivo"}</Button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
      <input ref={file} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
      <p className="text-[12px] text-ink-3">Imágenes o PDF, hasta 15 MB. Se guardan en el proyecto y los ven todos sus miembros.</p>
    </div>
  );
}
