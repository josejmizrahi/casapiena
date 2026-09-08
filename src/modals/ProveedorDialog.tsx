import { useState } from "react";
import { useProyecto } from "@/hooks/useProyecto";
import { conceptoForm, useModal } from "@/hooks/useModal";
import * as api from "@/api";
import type { Proveedor } from "@/lib/types";
import { fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { KV, Row } from "@/components/ui/misc";

export function ProveedorDialog({ d0, onSave }: { d0: Partial<Proveedor>; onSave?: (id: string) => void }) {
  const { p, calc, accion } = useProyecto();
  const { abrir, cerrar } = useModal();
  const [d, setD] = useState<Partial<Proveedor> & { nombre: string }>({ nombre: "", razon: "", banco: "", clabe: "", tel: "", nota: "", ...d0 });
  const set = (k: keyof Proveedor, v: string) => setD((x) => ({ ...x, [k]: v }));
  const conceptos = d.id ? calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => c.proveedorId === d.id).map((c) => ({ ...c, partida: pa.nombre }))) : [];
  const pagos = d.id ? p.pagos.filter((x) => x.proveedorId === d.id) : [];
  const comprometido = conceptos.reduce((s, c) => s + c.total, 0);
  const pagado = pagos.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
  const enTramite = pagos.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0);
  const rels = [...new Set(pagos.map((x) => x.rel))].sort((a, b) => a - b);
  const dup = p.proveedores.some((x) => x.id !== d.id && x.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase());
  const guardar = async () => {
    let id = "";
    const ok = await accion(async () => { id = await api.guardarProveedor(p.id, d); }, "Proveedor guardado");
    if (ok) { onSave?.(id); cerrar(); }
  };
  const borrar = async () => { if (d.id && confirm("¿Borrar este proveedor?") && await accion(() => api.borrarProveedor(d.id!), "Proveedor borrado")) cerrar(); };
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent title={d.id ? d.nombre : "Nuevo proveedor"}>
        <Field label="Nombre corto (el que usas al hablar)"><Input autoFocus={!d.id} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="Razón social / titular de la cuenta"><Input value={d.razon} onChange={(e) => set("razon", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco"><Input value={d.banco} onChange={(e) => set("banco", e.target.value)} /></Field>
          <Field label="CLABE"><Input inputMode="numeric" value={d.clabe} onChange={(e) => set("clabe", e.target.value.replace(/\s/g, ""))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono"><Input value={d.tel} onChange={(e) => set("tel", e.target.value)} /></Field>
          <Field label="Nota"><Input value={d.nota} onChange={(e) => set("nota", e.target.value)} /></Field>
        </div>
        {dup && <p className="text-xs text-bad">Ya tienes un proveedor con ese nombre.</p>}
        {d.id && (
          <>
            <div className="rounded-xl border bg-muted/60 px-3 py-1">
              <KV k={`Contratado (${conceptos.length} concepto${conceptos.length === 1 ? "" : "s"})`} v={fm(comprometido)} />
              <KV k="Pagado" v={fm(pagado)} tone="ok" />
              {enTramite > 0 && <KV k="En trámite" v={fm(enTramite)} tone="warn" />}
              <KV k="Saldo por pagarle" v={fm(comprometido - pagado)} bold />
              {rels.length > 0 && <KV k="Aparece en" v={rels.map((r) => `Rel ${r}`).join(", ")} />}
            </div>
            <div>
              {conceptos.map((c) => (
                <Row key={c.id} onClick={() => abrir({ tipo: "concepto", d: conceptoForm(c) })}
                  left={<><div className="text-sm font-medium truncate">{c.nombre}</div><div className="text-xs text-muted-foreground">{c.partida} · pagado {c.pctPagado}%</div></>}
                  right={<><div className="text-sm font-semibold">{fm(c.total)}</div>{c.saldo > 0.005 && <div className="text-[11px] text-muted-foreground">saldo {fm(c.saldo)}</div>}</>} />
              ))}
            </div>
          </>
        )}
        <DialogActions>
          {d.id && conceptos.length === 0 && pagos.length === 0 && <Button variant="destructive" onClick={borrar}>Borrar</Button>}
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Button disabled={!d.nombre.trim() || dup} onClick={guardar}>Guardar</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
