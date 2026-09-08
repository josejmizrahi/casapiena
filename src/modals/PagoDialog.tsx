import { useState } from "react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import * as api from "@/api";
import { FLUJO, STATUS_PAGO, type EstadoPago, type FormaPago } from "@/lib/types";
import { HOY, cn, fm2 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KV } from "@/components/ui/misc";
import { SelectProveedor } from "@/components/SelectProveedor";
import { Adjuntos } from "@/components/Adjuntos";

export function PagoDialog({ d0 }: { d0: Partial<api.PagoForm> }) {
  const { p, accion, conceptoDe, nextRel } = useProyecto();
  const { cerrar } = useModal();
  const [d, setD] = useState<api.PagoForm>({ tipo: "obra", conceptoId: "", proveedorId: "", fecha: HOY(), forma: "Transferencia", monto: 0, rel: nextRel(), status: "Anticipo", nota: "", estado: "solicitado", deExcedente: false, fase: "", ...d0 });
  const set = <K extends keyof api.PagoForm>(k: K, v: api.PagoForm[K]) => setD((x) => ({ ...x, [k]: v }));
  const con = d.tipo === "obra" ? conceptoDe(d.conceptoId) : undefined;
  const previo = p.pagos.find((x) => x.id === d.id);
  const yaPagado = con ? con.pagado - (previo && previo.estado === "pagado" ? previo.monto : 0) : 0;
  const sobrepasa = !!con && con.total > 0 && yaPagado + d.monto > con.total + 0.005;
  const valido = d.monto > 0 && (d.tipo === "honorarios" || !!d.conceptoId);
  const opciones = [...new Set([...p.relaciones.map((r) => r.n), nextRel()])].sort((a, b) => a - b);
  const guardar = async () => { if (await accion(() => api.guardarPago(p.id, d), d.id ? "Pago actualizado" : "Pago registrado")) cerrar(); };
  const borrar = async () => { if (d.id && confirm("¿Borrar este pago?") && await accion(() => api.borrarPago(d.id!), "Pago borrado")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? "Pago" : "Registrar pago"}>
        <Tabs value={d.tipo} onValueChange={(v) => set("tipo", v as api.PagoForm["tipo"])}>
          <TabsList><TabsTrigger value="obra">Obra</TabsTrigger><TabsTrigger value="honorarios">Honorarios</TabsTrigger></TabsList>
        </Tabs>
        {d.tipo === "obra" ? (
          <Field label="Concepto">
            <NativeSelect value={d.conceptoId} onChange={(e) => { const c = conceptoDe(e.target.value); set("conceptoId", e.target.value); if (c && !d.proveedorId) set("proveedorId", c.proveedorId); }}>
              <option value="">Elige un concepto…</option>
              {p.partidas.map((pa) => <optgroup key={pa.id} label={pa.nombre}>{pa.conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>)}
            </NativeSelect>
          </Field>
        ) : <Field label="Fase"><Input value={d.fase} placeholder="Ej. Anticipo 50%, Término fase 2, Cierre" onChange={(e) => set("fase", e.target.value)} /></Field>}
        <Field label="Proveedor"><SelectProveedor value={d.proveedorId} onChange={(v) => set("proveedorId", v)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto"><MoneyInput value={d.monto} onChange={(v) => set("monto", v)} autoFocus={!d.id} /></Field>
          <Field label={d.estado === "pagado" ? "Fecha de pago" : "Fecha de solicitud"}><Input type="date" value={d.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Forma de pago"><NativeSelect value={d.forma} onChange={(e) => set("forma", e.target.value as FormaPago)}><option>Transferencia</option><option>Efectivo</option></NativeSelect></Field>
          <Field label="Relación"><NativeSelect value={d.rel} onChange={(e) => set("rel", parseInt(e.target.value))}>{opciones.map((r) => <option key={r} value={r}>Rel {r}{!p.relaciones.some((x) => x.n === r) ? " (nueva)" : ""}</option>)}</NativeSelect></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><NativeSelect value={d.status} onChange={(e) => set("status", e.target.value)}>{STATUS_PAGO.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
          <Field label="Estado"><NativeSelect value={d.estado} onChange={(e) => set("estado", e.target.value as EstadoPago)}>{(Object.keys(FLUJO) as EstadoPago[]).map((k) => <option key={k} value={k}>{FLUJO[k]}</option>)}</NativeSelect></Field>
        </div>
        {d.forma === "Efectivo" && <Checkbox label="Se toma del excedente en efectivo a favor" checked={!!d.deExcedente} onCheckedChange={(v) => set("deExcedente", !!v)} />}
        <Field label="Nota"><Input value={d.nota} onChange={(e) => set("nota", e.target.value)} /></Field>
        {con && con.total > 0 && (
          <div className={cn("rounded-md border px-3 py-1", sobrepasa ? "bg-bad-bg border-bad/30" : "bg-panel border-border")}>
            <KV k="Total del concepto" v={fm2(con.total)} />
            <KV k="Pagado antes de este" v={fm2(yaPagado)} />
            <KV k={sobrepasa ? "Se pasa del total por" : "Quedaría por pagar"} v={fm2(Math.abs(con.total - yaPagado - d.monto))} tone={sobrepasa ? "bad" : undefined} />
          </div>
        )}
        {d.id && <Adjuntos proyectoId={p.id} pagoId={d.id} />}
        {con && con.total === 0 && <p className="text-xs text-ink-3">Este concepto no tiene presupuesto capturado; el pago se registra pero no se puede comparar.</p>}
        <DialogActions>
          {d.id && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!valido} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
