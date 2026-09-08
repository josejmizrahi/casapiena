import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal, pagoDesde } from "@/hooks/useModal";
import * as api from "@/api";
import { ESTADOS, LOG, LOG_ORDEN, PRIO, PRIO_ORDEN, UNIDADES, DESFASE_AVISO, type EstadoPresupuesto, type Logistica, type Prioridad } from "@/lib/types";
import { HOY, fecha, fm, fm2, num, pct, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { KV, Row } from "@/components/ui/misc";
import { SelectProveedor } from "@/components/SelectProveedor";
import { FlujoBadge, FormaBadge } from "@/components/Etiquetas";
import { cn } from "@/lib/utils";

export function ConceptoDialog({ d0 }: { d0: api.ConceptoForm }) {
  const { p, calc, accion, conceptoDe } = useProyecto();
  const { abrir, cerrar } = useModal();
  const [d, setD] = useState(d0);
  const [ivaAuto, setIvaAuto] = useState(false);
  const [porUnitario, setPorUnitario] = useState(d0.precioUnitario > 0);
  const ponPresupuesto = (v: number) => { set("presupuesto", v); if (ivaAuto) set("iva", Math.round(v * 16) / 100); };
  const setUnitario = (cantidad: number, precioUnitario: number) => {
    setD((x) => ({ ...x, cantidad, precioUnitario }));
    ponPresupuesto(Math.round(cantidad * precioUnitario * 100) / 100);
  };
  const [motivo, setMotivo] = useState("");
  const set = <K extends keyof api.ConceptoForm>(k: K, v: api.ConceptoForm[K]) => setD((x) => ({ ...x, [k]: v }));

  const c = d.id ? conceptoDe(d.id) : undefined;
  const total = d.presupuesto + d.iva;
  const cambio = c ? Math.abs(total - c.total) > 0.005 : false;
  const pagosC = d.id ? p.pagos.filter((x) => x.conceptoId === d.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")) : [];
  const pagado = c?.pagado || 0;
  const pa = calc.partidas.find((x) => x.id === d.partidaId);
  const otros = pa ? pa.comprometido - (c ? c.total : 0) : 0;
  const excede = !!pa && pa.candadoEf > 0 && otros + total > pa.candadoEf + 0.005;
  const base = d.base || { presupuesto: 0, iva: 0 };
  const ajustes = d.ajustes || [];
  const rels = [...p.relaciones].sort((a, b) => a.n - b.n);

  const guardar = async () => {
    const ok = await accion(() => api.guardarConcepto(d, motivo, pa ? pa.conceptos.length : 0), d.id ? "Concepto guardado" : "Concepto creado");
    if (ok) cerrar();
  };
  const borrar = async () => {
    if (!d.id || !confirm("¿Borrar el concepto y sus pagos?")) return;
    if (await accion(() => api.borrarConcepto(d.id!), "Concepto borrado")) cerrar();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? "Concepto" : "Nuevo concepto"} description={pa?.nombre}>
        <Field label="Concepto"><Input autoFocus={!d.id} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="Proveedor"><SelectProveedor value={d.proveedorId} onChange={(v) => set("proveedorId", v)} /></Field>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Checkbox label="Por cantidad × precio unitario" checked={porUnitario} onCheckedChange={(v) => { setPorUnitario(!!v); if (!v) setD((x) => ({ ...x, precioUnitario: 0 })); }} />
          <Checkbox label="IVA 16% automático" checked={ivaAuto} onCheckedChange={(v) => { setIvaAuto(!!v); if (v) set("iva", Math.round(d.presupuesto * 16) / 100); }} />
        </div>
        {porUnitario ? (
          <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
            <Field label="Cantidad"><Input inputMode="decimal" className="num" value={d.cantidad} onChange={(e) => setUnitario(num(e.target.value), d.precioUnitario)} /></Field>
            <Field label="Unidad"><NativeSelect value={d.unidad} onChange={(e) => set("unidad", e.target.value)}><option value="">—</option>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</NativeSelect></Field>
            <Field label="Precio unitario (sin IVA)"><MoneyInput value={d.precioUnitario} onChange={(v) => setUnitario(d.cantidad || 1, v)} /></Field>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={porUnitario ? "Subtotal (cantidad × PU)" : "Presupuesto (sin IVA)"}>{porUnitario ? <Input readOnly className="num" value={fm2(d.presupuesto)} /> : <MoneyInput value={d.presupuesto} onChange={ponPresupuesto} />}</Field>
          <Field label="IVA"><MoneyInput value={d.iva} onChange={(v) => set("iva", v)} /></Field>
        </div>
        {cambio && <Field label="Motivo del cambio (queda en la bitácora)"><Input autoFocus value={motivo} placeholder="Ej. aditiva por cambio de acabado" onChange={(e) => setMotivo(e.target.value)} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridad"><NativeSelect value={d.prioridad} onChange={(e) => set("prioridad", e.target.value as Prioridad)}>{PRIO_ORDEN.map((k) => <option key={k} value={k}>{PRIO[k]}</option>)}</NativeSelect></Field>
          <Field label="Estado del presupuesto"><NativeSelect value={d.estado} onChange={(e) => set("estado", e.target.value as EstadoPresupuesto)}>{(Object.keys(ESTADOS) as EstadoPresupuesto[]).map((k) => <option key={k} value={k}>{ESTADOS[k]}</option>)}</NativeSelect></Field>
        </div>
        <Field label="Nota"><Input value={d.nota} onChange={(e) => set("nota", e.target.value)} /></Field>

        <Label className="block pt-1">Compra y entrega</Label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estatus"><NativeSelect value={d.logistica} onChange={(e) => set("logistica", e.target.value as Logistica)}>{LOG_ORDEN.map((k) => <option key={k} value={k}>{LOG[k]}</option>)}</NativeSelect></Field>
          <Field label="Llega el"><Input type="date" value={d.eta || ""} onChange={(e) => set("eta", e.target.value)} /></Field>
        </div>
        <Field label="No. de pedido / guía"><Input value={d.pedido} onChange={(e) => set("pedido", e.target.value)} /></Field>
        <Field label="Avance físico real" hint="Lo que de verdad está hecho o instalado. Se compara contra lo pagado para avisarte si vas pagando por adelantado.">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">{[0, 25, 50, 75, 100].map((v) => <Button key={v} type="button" size="sm" variant={d.avance === v ? "default" : "outline"} className="px-2.5" onClick={() => set("avance", v)}>{v}%</Button>)}</div>
            <div className="relative w-20 ml-auto"><Input inputMode="numeric" className="num pr-6 text-right" value={d.avance} onChange={(e) => set("avance", Math.max(0, Math.min(100, num(e.target.value))))} /><span className="absolute right-2 top-2.5 text-xs text-ink-3">%</span></div>
          </div>
        </Field>
        <Field label="Links (tienda, cotización, seguimiento)">
          <div className="space-y-2">
            {d.links.map((l) => (
              <div key={l.id} className="flex gap-2">
                <Input className="flex-[2]" placeholder="Título" value={l.titulo} onChange={(e) => set("links", d.links.map((x) => (x.id === l.id ? { ...x, titulo: e.target.value } : x)))} />
                <Input className="flex-[3]" inputMode="url" placeholder="https://…" value={l.url} onChange={(e) => set("links", d.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" className="text-bad shrink-0" aria-label="Quitar link" onClick={() => set("links", d.links.filter((x) => x.id !== l.id))}><X /></Button>
              </div>
            ))}
            <Button variant="dashed" size="sm" onClick={() => set("links", [...d.links, { id: uid("lk"), titulo: "", url: "" }])}><Plus />Pegar un link</Button>
          </div>
        </Field>

        <div className={cn("rounded-md border px-3 py-1", excede ? "bg-bad-bg border-bad/30" : "bg-panel border-border")}>
          <KV k="Total con IVA" v={fm2(total)} />
          {pa && pa.candadoEf > 0 && <KV k="Candado de la partida" v={fm(pa.candadoEf)} />}
          {pa && pa.candadoEf > 0 && <KV k={excede ? "Excede el candado por" : "Quedaría disponible"} v={fm(Math.abs(pa.candadoEf - otros - total))} tone={excede ? "bad" : "ok"} />}
          {d.id && <KV k="Pagado" v={<>{fm2(pagado)} <span className="text-ink-3 font-normal">({pct(pagado, total)}%)</span></>} />}
          {d.id && <KV k="Saldo a ejercer" v={fm2(total - pagado)} />}
          {d.id && c && Math.abs(c.desviacion) > 0.005 && <KV k={`Línea base ${fm2(c.baseTotal)} · desviación`} v={`${c.desviacion > 0 ? "+" : ""}${fm2(c.desviacion)}`} tone={c.desviacion > 0 ? "bad" : "ok"} />}
          {d.id && d.avance > 0 && total > 0 && <KV k={`Avance físico ${d.avance}% · pagado ${pct(pagado, total)}%`} v={pct(pagado, total) - d.avance >= DESFASE_AVISO ? "Pagado por adelantado" : "En ritmo"} tone={pct(pagado, total) - d.avance >= DESFASE_AVISO ? "warn" : "ok"} />}
        </div>
        {d.id && ajustes.length > 0 && (
          <div>
            <Label>Bitácora del presupuesto</Label>
            <div className="mt-1 space-y-1 border-l-2 border-border pl-3 text-xs text-ink-3 num">
              <div>Original: {fm2(base.presupuesto + base.iva)}</div>
              {ajustes.map((a) => <div key={a.id}>{fecha(a.fecha)}: {fm2(a.anterior)} → {fm2(a.nuevo)} <b className={a.nuevo > a.anterior ? "text-bad" : "text-ok"}>({a.nuevo > a.anterior ? "+" : ""}{fm(a.nuevo - a.anterior)})</b>{a.motivo ? ` · ${a.motivo}` : ""}</div>)}
            </div>
          </div>
        )}
        {d.id && (
          <div>
            {pagosC.map((x) => (
              <Row key={x.id} onClick={() => abrir({ tipo: "pago", d: pagoDesde(x) })}
                left={<><div className="text-sm font-medium">Rel {x.rel} · {x.status}</div><div className="text-xs text-ink-3 flex items-center gap-1.5">{fecha(x.fecha)} <FormaBadge f={x.forma} /><FlujoBadge e={x.estado} /></div></>}
                right={<div className="text-sm font-semibold">{fm(x.monto)}</div>} />
            ))}
            <Button variant="dashed" size="sm" className="mt-2" onClick={() => abrir({ tipo: "pago", d: { tipo: "obra", conceptoId: d.id, proveedorId: d.proveedorId, fecha: HOY(), forma: "Transferencia", monto: Math.max(0, total - pagado), rel: rels.length ? rels[rels.length - 1].n : 1, status: pagado > 0 ? "Finiquito" : "Anticipo", estado: "solicitado" } })}><Plus />Pago a este concepto</Button>
          </div>
        )}
        <DialogActions>
          {d.id && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!d.nombre.trim()} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
