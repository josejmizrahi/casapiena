import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileJson, LayoutTemplate, LogOut, Trash2, UserPlus } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useSesion } from "@/hooks/useSesion";
import * as api from "@/api";
import { supabase } from "@/lib/supabase";
import { exportarExcel, exportarJSON } from "@/lib/exportar";
import type { Meta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { Row } from "@/components/ui/misc";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import type { PlantillaPartida } from "@/lib/types";

/** Campos de meta con guardado al salir del campo. */
function useMetaForm() {
  const { p, accion } = useProyecto();
  const [m, setM] = useState<Meta>(p.meta);
  useEffect(() => setM(p.meta), [p.meta]);
  const guardar = (nuevo: Meta) => { setM(nuevo); if (JSON.stringify(nuevo) !== JSON.stringify(p.meta)) accion(() => api.guardarMeta(p.id, nuevo)); };
  return { m, setM, guardar };
}

export default function Ajustes() {
  const { p, calc } = useProyecto();
  const { m, setM, guardar } = useMetaForm();
  const set = (k: keyof Meta, v: string) => setM({ ...m, [k]: v });
  const [plantilla, setPlantilla] = useState(false);
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Nombre del proyecto"><Input value={m.nombre} onChange={(e) => set("nombre", e.target.value)} onBlur={() => guardar(m)} /></Field>
          <Field label="Clientes"><Input value={m.clientes} placeholder="Ej. José y Lynda" onChange={(e) => set("clientes", e.target.value)} onBlur={() => guardar(m)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Presupuesto de obra"><MoneyInput value={m.presupuestoObra} onChange={(v) => guardar({ ...m, presupuestoObra: v })} /></Field>
            <Field label="Honorarios %"><MoneyInput value={m.pctHonorarios} onChange={(v) => guardar({ ...m, pctHonorarios: v })} /></Field>
          </div>
        </CardContent>
      </Card>
      <Miembros />
      <Card>
        <CardHeader><div><CardTitle>Respaldo y exportación</CardTitle><CardDescription>El Excel sale con General, Registro de Pagos, Compras, Proveedores, Flujo de Caja, Traspasos, Bitácora y una hoja por relación.</CardDescription></div></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => exportarExcel(p, calc).catch((e) => toast.error(e.message))}><Download />Exportar Excel</Button>
          <Button variant="outline" onClick={() => exportarJSON(p)}><FileJson />Respaldo JSON</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Plantilla</CardTitle><CardDescription>Guarda la estructura de esta obra (partidas, reparto de candados y nombres de conceptos, sin montos) para arrancar el siguiente proyecto desde ahí.</CardDescription></div></CardHeader>
        <CardContent><Button variant="outline" onClick={() => setPlantilla(true)}><LayoutTemplate />Guardar como plantilla</Button></CardContent>
      </Card>
      <GuardarPlantilla open={plantilla} onClose={() => setPlantilla(false)} />
      <Card>
        <CardHeader><CardTitle>Sesión</CardTitle></CardHeader>
        <CardContent><Button variant="destructive" onClick={() => supabase.auth.signOut()}><LogOut />Cerrar sesión</Button></CardContent>
      </Card>
    </>
  );
}

/** Datos que se imprimen al pie de cada relación para pagos en efectivo. Se usa en Relaciones. */
export function DatosEfectivo() {
  const { m, setM, guardar } = useMetaForm();
  const set = (k: keyof Meta, v: string) => setM({ ...m, [k]: v });
  return (
    <Card>
      <CardHeader><div><CardTitle>Datos para pagos en efectivo</CardTitle><CardDescription>Se imprimen al pie de cada relación.</CardDescription></div></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Dirección de entrega"><Input value={m.direccionEfectivo} onChange={(e) => set("direccionEfectivo", e.target.value)} onBlur={() => guardar(m)} /></Field>
        <Field label="Contacto / celular"><Input value={m.contactoEfectivo} onChange={(e) => set("contactoEfectivo", e.target.value)} onBlur={() => guardar(m)} /></Field>
        <Field label="Instrucciones"><Textarea rows={2} value={m.instruccionesEfectivo} onChange={(e) => set("instruccionesEfectivo", e.target.value)} onBlur={() => guardar(m)} /></Field>
      </CardContent>
    </Card>
  );
}

function Miembros() {
  const { p } = useProyecto();
  const sesion = useSesion();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["miembros", p.id], queryFn: () => api.listaMiembros(p.id) });
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState("editor");
  const [cargando, setCargando] = useState(false);
  const refrescar = () => qc.invalidateQueries({ queryKey: ["miembros", p.id] });
  const agregar = async () => {
    setCargando(true);
    try { await api.agregarMiembro(p.id, correo.trim(), rol); setCorreo(""); refrescar(); toast.success("Miembro agregado"); }
    catch (e) { toast.error("No se pudo agregar", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCargando(false); }
  };
  const quitar = async (userId: string) => {
    try { await api.quitarMiembro(p.id, userId); refrescar(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Card>
      <CardHeader><div><CardTitle>Quién puede ver este proyecto</CardTitle><CardDescription>Editor captura y modifica; lector solo consulta. La persona debe haber entrado a la app al menos una vez.</CardDescription></div></CardHeader>
      <CardContent className="space-y-3">
        <Row left={<div className="text-sm">{sesion?.user.email}</div>} right={<Badge>Tú</Badge>} />
        {data?.map((mi) => (
          <Row key={mi.user_id} left={<div className="text-sm truncate">{mi.email}</div>}
            right={<div className="flex items-center gap-2"><Badge variant={mi.rol === "lector" ? "neutral" : "info"}>{mi.rol}</Badge><Button size="icon" variant="ghost" className="size-7 text-bad" aria-label="Quitar" onClick={() => confirm(`¿Quitar a ${mi.email}?`) && quitar(mi.user_id)}><Trash2 /></Button></div>} />
        ))}
        {error && <p className="text-xs text-bad">{(error as Error).message}</p>}
        <div className="flex flex-wrap gap-2">
          <Input type="email" placeholder="correo@ejemplo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} className="flex-1 min-w-[200px]" />
          <div className="flex gap-2 flex-1 sm:flex-none">
            <NativeSelect value={rol} onChange={(e) => setRol(e.target.value)} className="w-28"><option value="editor">Editor</option><option value="lector">Lector</option></NativeSelect>
            <Button disabled={!correo.includes("@") || cargando} onClick={agregar}><UserPlus />Agregar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GuardarPlantilla({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { p, calc } = useProyecto();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(p.meta.nombre);
  const [desc, setDesc] = useState("");
  const [cargando, setCargando] = useState(false);
  const base = calc.totalCandados > 0 ? calc.totalCandados : p.meta.presupuestoObra;
  const cuerpo: PlantillaPartida[] = p.partidas.map((pa) => ({
    nombre: pa.nombre, contingencia: pa.contingencia,
    pct: base > 0 ? Math.round((pa.candado / base) * 1000) / 10 : 0,
    conceptos: pa.conceptos.map((c) => ({ nombre: c.nombre, unidad: c.unidad || undefined, prioridad: c.prioridad })),
  }));
  const guardar = async () => {
    setCargando(true);
    try { await api.guardarPlantilla(nombre.trim(), desc.trim(), cuerpo); qc.invalidateQueries({ queryKey: ["plantillas"] }); toast.success("Plantilla guardada"); onClose(); }
    catch (e) { toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCargando(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Guardar como plantilla">
        <Field label="Nombre de la plantilla"><Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label="Descripción"><Input value={desc} placeholder="Ej. casa de 3 recámaras, mobiliario completo" onChange={(e) => setDesc(e.target.value)} /></Field>
        <p className="text-[13px] text-ink-2">Se guardan {p.partidas.length} partidas con su porcentaje de candado y {calc.conceptos.length} nombres de conceptos. Los montos no se guardan.</p>
        <DialogActions>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nombre.trim() || cargando} onClick={guardar}>{cargando ? "Guardando…" : "Guardar"}</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
