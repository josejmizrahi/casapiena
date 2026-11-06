import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import { useGastos } from "@/hooks/useGastos";
import * as api from "@/api";
import type { GastoForm } from "@/api";
import type { Reparto } from "@/lib/types";
import { repartirIgual } from "@/lib/gastos";
import { HOY, cn, fecha, fm2 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { Alert } from "@/components/ui/misc";

export function GastoDialog({ d0 }: { d0: Partial<GastoForm> }) {
  const { p } = useProyecto();
  const { cerrar } = useModal();
  const { data, activos, nombre, yo, accion, isLoading } = useGastos(p.id);
  const ids = activos.map((x) => x.userId);
  const [d, setD] = useState({ descripcion: "", monto: 0, fecha: HOY(), nota: "", reparto: "igual" as Reparto, conceptoId: "", ...d0, pagadoPor: d0.pagadoPor || "" });
  // la sesión puede resolverse después del primer render: por omisión pagó quien captura
  const pagador = d.pagadoPor || yo;
  const [sel, setSel] = useState<Set<string>>(() => new Set(d0.partes ? d0.partes.filter((x) => d0.reparto !== "igual" || x.monto > 0).map((x) => x.userId) : ids));
  const [montos, setMontos] = useState<Record<string, number>>(() => Object.fromEntries((d0.partes || []).map((x) => [x.userId, x.monto])));
  // la lista de participantes puede llegar después de abrir el diálogo
  const [listos, setListos] = useState(ids.length > 0);
  if (!listos && ids.length) { setListos(true); if (!d0.partes) setSel(new Set(ids)); }

  const idsSel = ids.filter((u) => sel.has(u));
  const partes = d.reparto === "igual" ? repartirIgual(d.monto, idsSel) : ids.map((u) => ({ userId: u, monto: montos[u] || 0 })).filter((x) => x.monto > 0);
  const suma = partes.reduce((s, x) => s + Math.round(x.monto * 100), 0) / 100;
  const falta = Math.round((d.monto - suma) * 100) / 100;
  const fueraDelProyecto = (d0.partes || []).some((x) => !ids.includes(x.userId)) || (!!d0.pagadoPor && !ids.includes(d0.pagadoPor));
  const valido = d.descripcion.trim() && d.monto > 0 && ids.includes(pagador) && partes.length > 0 && Math.abs(falta) < 0.005;

  const guardar = async () => { if (await accion(() => api.guardarGasto(p.id, { ...d, pagadoPor: pagador, partes }), d.id ? "Gasto actualizado" : "Gasto registrado")) cerrar(); };
  const borrar = async () => { if (d.id && confirm("¿Borrar este gasto?") && await accion(() => api.borrarGasto(d.id!), "Gasto borrado")) cerrar(); };
  // otro gasto con el mismo monto: lo más común es capturar dos veces lo mismo
  const mismoMonto = d.monto > 0 ? (data?.gastos || []).filter((x) => x.id !== d.id && Math.round(x.monto * 100) === Math.round(d.monto * 100)) : [];
  // en palabras: quién le debe cuánto a quien pagó por este gasto
  const deudas = partes.filter((x) => x.userId !== pagador && x.monto > 0);
  const soloA = (u: string | null) => { setSel(new Set(u ? [u] : ids)); setD({ ...d, reparto: "igual" }); };
  const toggle = (u: string, on: boolean) => setSel((s) => { const n = new Set(s); if (on) n.add(u); else n.delete(u); return n; });

  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? "Gasto" : "Nuevo gasto"} description="Gasto compartido">
        <Field label="Descripción"><Input autoFocus={!d.id} value={d.descripcion} placeholder="Ej. comida de la cuadrilla, gasolina, material de urgencia" onChange={(e) => setD({ ...d, descripcion: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto"><MoneyInput value={d.monto} onChange={(v) => setD({ ...d, monto: v })} /></Field>
          <Field label="Fecha"><Input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
        </div>
        <Field label="¿Quién lo pagó de su bolsa?">
          <NativeSelect value={pagador} onChange={(e) => setD({ ...d, pagadoPor: e.target.value })}>
            {!ids.includes(pagador) && <option value={pagador}>{isLoading ? "Cargando…" : "Elige quién pagó"}</option>}
            {activos.map((x) => <option key={x.userId} value={x.userId}>{nombre(x.userId)}{x.userId !== yo && x.nombre ? ` · ${x.email}` : ""}</option>)}
          </NativeSelect>
        </Field>
        <div className="space-y-2">
          <Segmented value={d.reparto} onChange={(v) => { if (v === "montos" && d.reparto === "igual") setMontos(Object.fromEntries(partes.map((x) => [x.userId, x.monto]))); setD({ ...d, reparto: v }); }}
            options={[["igual", "Partes iguales"], ["montos", "Montos exactos"]]} />
          {d.reparto === "igual" && activos.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button type="button" size="sm" variant={idsSel.length === ids.length ? "default" : "outline"} onClick={() => soloA(null)}>Entre todos</Button>
              {activos.filter((x) => x.userId !== pagador).map((x) => (
                <Button key={x.userId} type="button" size="sm" variant={idsSel.length === 1 && idsSel[0] === x.userId ? "default" : "outline"} onClick={() => soloA(x.userId)}>Le toca todo a {nombre(x.userId)}</Button>
              ))}
            </div>
          )}
          {activos.length === 0 && !isLoading && <p className="text-[13px] text-ink-2">No hay miembros con cuenta en este proyecto. Invítalos desde Ajustes.</p>}
          {activos.map((x) => d.reparto === "igual" ? (
            <div key={x.userId} className="flex items-center justify-between gap-3 border-t border-border first:border-t-0">
              <Checkbox label={nombre(x.userId)} checked={sel.has(x.userId)} onCheckedChange={(v) => toggle(x.userId, v === true)} />
              <span className={cn("num text-[13px]", sel.has(x.userId) ? "text-foreground" : "text-ink-3")}>{fm2(partes.find((pt) => pt.userId === x.userId)?.monto || 0)}</span>
            </div>
          ) : (
            <div key={x.userId} className="grid grid-cols-[1fr_9rem] items-center gap-3">
              <span className="text-[14px] truncate">{nombre(x.userId)}</span>
              <MoneyInput value={montos[x.userId] || 0} onChange={(v) => setMontos((m) => ({ ...m, [x.userId]: v }))} />
            </div>
          ))}
          {d.reparto === "montos" && d.monto > 0 && Math.abs(falta) >= 0.005 && (
            <p className="text-[13px] text-bad num">{falta > 0 ? `Faltan ${fm2(falta)} por repartir` : `Te pasas por ${fm2(-falta)}`}</p>
          )}
        </div>
        {d.monto > 0 && Math.abs(falta) < 0.005 && ids.includes(pagador) && (
          <p className="text-[13px] text-ink-2">
            {deudas.length === 0 ? `Nadie le debe nada a ${nombre(pagador) === "Tú" ? "ti" : nombre(pagador)} por este gasto.`
              : deudas.map((x) => `${nombre(x.userId)} ${x.userId === yo ? "le debes" : "le debe"} ${fm2(x.monto)} a ${pagador === yo ? "ti" : nombre(pagador)}`).join(" · ") + " por este gasto."}
          </p>
        )}
        {mismoMonto.length > 0 && <Alert>Ya hay {mismoMonto.length === 1 ? "un gasto" : `${mismoMonto.length} gastos`} de {fm2(d.monto)}: {mismoMonto.map((x) => `"${x.descripcion}" (pagó ${nombre(x.pagadoPor)}, ${fecha(x.fecha)})`).join(", ")}. Si es el mismo, no lo registres dos veces.</Alert>}
        {p.partidas.some((pa) => pa.conceptos.length > 0) && (
          <Field label="¿De qué parte de la obra es? (opcional)" hint="Si lo eliges, cuenta como pagado de ese concepto en Obra y Resumen.">
            <NativeSelect value={d.conceptoId} onChange={(e) => setD({ ...d, conceptoId: e.target.value })}>
              <option value="">No es de la obra / sin ligar</option>
              {p.partidas.filter((pa) => pa.conceptos.length).map((pa) => <optgroup key={pa.id} label={pa.nombre}>{pa.conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>)}
            </NativeSelect>
          </Field>
        )}
        {fueraDelProyecto && <Alert>Este gasto incluye a alguien que ya no es miembro del proyecto. Al guardar, sale del reparto.</Alert>}
        <Field label="Nota"><Textarea rows={2} value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} /></Field>
        <DialogActions>
          {d.id && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!valido} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export interface LiquidacionForm { id?: string; deId: string; aId: string; monto: number; fecha: string; nota: string }

/** Transferencia entre miembros para saldar la deuda. Se registra o se borra; no se edita. */
export function LiquidacionDialog({ d0 }: { d0: Partial<LiquidacionForm> }) {
  const { p } = useProyecto();
  const { cerrar } = useModal();
  const { activos, nombre, yo, accion } = useGastos(p.id);
  const [d, setD] = useState({ monto: 0, fecha: HOY(), nota: "", ...d0, deId: d0.deId || "", aId: d0.aId || "" });
  const de = d.deId || yo;
  const solo = !!d.id;
  const valido = de && d.aId && de !== d.aId && d.monto > 0;
  const guardar = async () => { if (await accion(() => api.guardarLiquidacion(p.id, { ...d, deId: de }), "Transferencia registrada")) cerrar(); };
  const borrar = async () => { if (d.id && confirm("¿Borrar esta transferencia?") && await accion(() => api.borrarLiquidacion(d.id!), "Transferencia borrada")) cerrar(); };
  const opciones = (actual: string) => (
    <>
      {!activos.some((x) => x.userId === actual) && <option value={actual}>{actual ? nombre(actual) : "Elige"}</option>}
      {activos.map((x) => <option key={x.userId} value={x.userId}>{nombre(x.userId)}</option>)}
    </>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={solo ? "Transferencia para saldar" : "Saldar deuda"} description="Para quedar a mano">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="Transfiere"><NativeSelect disabled={solo} value={de} onChange={(e) => setD({ ...d, deId: e.target.value })}>{opciones(de)}</NativeSelect></Field>
          <ArrowRight className="size-4 text-ink-3 mb-3.5" />
          <Field label="Recibe"><NativeSelect disabled={solo} value={d.aId} onChange={(e) => setD({ ...d, aId: e.target.value })}>{opciones(d.aId)}</NativeSelect></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">{solo ? <Input readOnly value={fm2(d.monto)} /> : <MoneyInput value={d.monto} onChange={(v) => setD({ ...d, monto: v })} />}</Field>
          <Field label="Fecha"><Input type="date" readOnly={solo} value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
        </div>
        <Field label="Nota"><Input readOnly={solo} value={d.nota} placeholder="Ej. transferencia, efectivo" onChange={(e) => setD({ ...d, nota: e.target.value })} /></Field>
        {de && de === d.aId && <p className="text-xs text-bad">Quien paga y quien recibe deben ser distintos.</p>}
        <DialogActions>
          {solo && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>{solo ? "Cerrar" : "Cancelar"}</Button>
          {!solo && <Button disabled={!valido} onClick={guardar}>Guardar</Button>}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
