import { useState } from "react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import * as api from "@/api";
import type { Excedente } from "@/lib/types";
import { HOY } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";

export function RelacionDialog({ d0 }: { d0: { nOriginal?: number; n: number; fecha: string; fechaLimite: string } }) {
  const { p, accion } = useProyecto();
  const { cerrar } = useModal();
  const [d, setD] = useState(d0);
  const dup = d.nOriginal !== d.n && p.relaciones.some((x) => x.n === d.n);
  const idOriginal = p.relaciones.find((x) => x.n === d.nOriginal)?.id;
  const guardar = async () => { if (await accion(() => api.guardarRel(p.id, { ...d, id: idOriginal }), "Relación guardada")) cerrar(); };
  const borrar = async () => { if (idOriginal && confirm("¿Borrar la relación y sus pagos?") && await accion(() => api.borrarRel(idOriginal), "Relación borrada")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.nOriginal != null ? `Relación ${d.nOriginal}` : "Nueva relación"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número"><Input inputMode="numeric" value={d.n} onChange={(e) => setD({ ...d, n: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Fecha"><Input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
        </div>
        <Field label="Fecha límite de pago" hint="Es la que alimenta el flujo de caja de los pagos que aún no salen."><Input type="date" value={d.fechaLimite} onChange={(e) => setD({ ...d, fechaLimite: e.target.value })} /></Field>
        {dup && <p className="text-xs text-bad">Ya existe una relación con ese número.</p>}
        <DialogActions>
          {idOriginal && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={dup || !d.n} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export function ExcedenteDialog({ d0 }: { d0: Partial<Excedente> }) {
  const { p, accion } = useProyecto();
  const { cerrar } = useModal();
  const [d, setD] = useState({ concepto: "", fecha: HOY(), monto: 0, ...d0 });
  const guardar = async () => { if (await accion(() => api.guardarExc(p.id, d), "Excedente guardado")) cerrar(); };
  const borrar = async () => { if (d.id && confirm("¿Borrar este excedente?") && await accion(() => api.borrarExc(d.id!), "Excedente borrado")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? "Excedente a favor" : "Nuevo excedente a favor"}>
        <Field label="Concepto"><Input autoFocus={!d.id} value={d.concepto} placeholder="Ej. devolución de sofá, excedente Relación 3" onChange={(e) => setD({ ...d, concepto: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto"><MoneyInput value={d.monto} onChange={(v) => setD({ ...d, monto: v })} /></Field>
          <Field label="Fecha"><Input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
        </div>
        <DialogActions>
          {d.id && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!d.concepto.trim() || !d.monto} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
