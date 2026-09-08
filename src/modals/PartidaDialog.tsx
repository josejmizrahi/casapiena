import { useState } from "react";
import { ArrowLeftRight, BookOpen } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import * as api from "@/api";
import { HOY, cn, fecha, fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { KV } from "@/components/ui/misc";
import { Checkbox } from "@/components/ui/checkbox";

export function PartidaDialog({ d0 }: { d0: { id?: string; nombre: string; candado: number; contingencia?: boolean } }) {
  const { p, calc, accion } = useProyecto();
  const { abrir, cerrar } = useModal();
  const [d, setD] = useState(d0);
  const pa = d.id ? calc.partidas.find((x) => x.id === d.id) : undefined;
  const traspasos = d.id ? p.traspasos.filter((t) => t.deId === d.id || t.aId === d.id) : [];
  const nombreP = (id: string) => p.partidas.find((x) => x.id === id)?.nombre || "—";
  const guardar = async () => { if (await accion(() => api.guardarPartida(p.id, d, p.partidas.length), "Partida guardada")) cerrar(); };
  const borrar = async () => { if (d.id && confirm("¿Borrar la partida con sus conceptos y pagos?") && await accion(() => api.borrarPartida(d.id!), "Partida borrada")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? "Partida y candado" : "Nueva partida"}>
        <Field label="Nombre de la partida"><Input autoFocus={!d.id} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></Field>
        <Field label="Candado original" hint="El máximo que quieres gastar aquí. Si una partida se pasa, traspásale candado de otra en vez de subirlo: así queda registrado de dónde salió."><MoneyInput value={d.candado} onChange={(v) => setD({ ...d, candado: v })} /></Field>
        <button type="button" className="text-xs text-info inline-flex items-center gap-1 hover:underline" onClick={() => abrir({ tipo: "guia", seccion: "candados" })}><BookOpen className="size-3.5" />¿Qué es un candado y cómo se reparte?</button>
        <div className="rounded-md border bg-panel border-border px-3 py-2.5">
          <Checkbox label="Esta partida es la reserva de imprevistos" checked={!!d.contingencia} onCheckedChange={(v) => setD({ ...d, contingencia: !!v })} />
          <p className="text-xs text-ink-3 mt-1.5 pl-7">Su candado no se gasta directo: se traspasa a la partida que creció. Así ves cuánto colchón te queda y en qué se fue.</p>
        </div>
        {pa && (pa.recibido > 0 || pa.cedido > 0) && (
          <div className="rounded-md border bg-panel border-border px-3 py-1">
            <KV k="Candado original" v={fm(pa.candado)} />
            {pa.recibido > 0 && <KV k="Recibido en traspasos" v={`+${fm(pa.recibido)}`} tone="ok" />}
            {pa.cedido > 0 && <KV k="Cedido a otras partidas" v={`−${fm(pa.cedido)}`} tone="bad" />}
            <KV k="Candado vigente" v={fm(pa.candadoEf)} bold />
          </div>
        )}
        {traspasos.length > 0 && <div className="space-y-1 border-l-2 border-border pl-3 text-xs text-ink-3 num">{traspasos.map((t) => <div key={t.id}>{fecha(t.fecha)}: {fm(t.monto)} {t.deId === d.id ? `→ ${nombreP(t.aId)}` : `← ${nombreP(t.deId)}`}{t.motivo ? ` · ${t.motivo}` : ""}</div>)}</div>}
        {d.id && <Button variant="dashed" onClick={() => abrir({ tipo: "traspaso", d: { aId: d.id!, deId: "", monto: 0, motivo: "", fecha: HOY() } })}><ArrowLeftRight />Traspasar candado de otra partida</Button>}
        <DialogActions>
          {d.id && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!d.nombre.trim()} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export function TraspasoDialog({ d0 }: { d0: { deId: string; aId: string; monto: number; fecha: string; motivo: string } }) {
  const { p, calc, accion } = useProyecto();
  const { cerrar } = useModal();
  const [d, setD] = useState(d0);
  const origen = calc.partidas.find((x) => x.id === d.deId);
  const destino = calc.partidas.find((x) => x.id === d.aId);
  const dejaCorto = !!origen && origen.candadoEf - d.monto < origen.comprometido - 0.005;
  const guardar = async () => { if (await accion(() => api.guardarTraspaso(p.id, d), "Candado traspasado")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title="Traspaso de candado">
        <Field label="Sale de la partida">
          <NativeSelect value={d.deId} onChange={(e) => setD({ ...d, deId: e.target.value })}>
            <option value="">Elige la partida origen…</option>
            {calc.partidas.filter((x) => x.id !== d.aId && x.candadoEf > 0).map((x) => <option key={x.id} value={x.id}>{x.nombre} · disponible {fm(x.disponible)}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Entra a"><Input value={destino?.nombre || ""} readOnly /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto"><MoneyInput value={d.monto} onChange={(v) => setD({ ...d, monto: v })} /></Field>
          <Field label="Fecha"><Input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
        </div>
        <Field label="Motivo"><Input value={d.motivo} placeholder="Ej. carpintería creció, jardinería no se ejecutó" onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Field>
        {origen && (
          <div className={cn("rounded-md border px-3 py-1", dejaCorto ? "bg-bad-bg border-bad/30" : "bg-panel border-border")}>
            <KV k={`${origen.nombre} quedaría en`} v={fm(origen.candadoEf - d.monto)} />
            <KV k="y tiene comprometido" v={fm(origen.comprometido)} tone={dejaCorto ? "bad" : undefined} />
            {destino && <KV k={`${destino.nombre} quedaría en`} v={fm(destino.candadoEf + d.monto)} />}
          </div>
        )}
        <DialogActions>
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!d.deId || !d.monto} onClick={guardar}>Traspasar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
