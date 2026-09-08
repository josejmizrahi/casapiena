import { useState } from "react";
import { Pencil, Plus, Printer } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import * as api from "@/api";
import { HOY, fecha, fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, KV } from "@/components/ui/misc";
import { RelacionPrint } from "@/print/RelacionPrint";
import { DatosEfectivo } from "./Ajustes";

export default function Relaciones() {
  const { p, accion, nextRel } = useProyecto();
  const { abrir } = useModal();
  const [imprimir, setImprimir] = useState<number | null>(null);
  const rels = [...p.relaciones].sort((a, b) => b.n - a.n);
  const marcarRel = (relId: string, estado: string) => accion(() => api.marcarRelacion(relId, estado, HOY()), estado === "pagado" ? "Relación pagada" : "Pagos autorizados");
  return (
    <>
      {rels.length === 0 && <Empty>Las relaciones se crean al registrar pagos o con “+ Relación”. Imprímelas antes de pagar: los pagos en estado Solicitado ya salen en el documento.</Empty>}
      {rels.map((r) => {
        const lista = p.pagos.filter((x) => x.rel === r.n);
        const tot = lista.reduce((s, x) => s + x.monto, 0);
        const pend = lista.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0);
        const porAutorizar = lista.filter((x) => x.estado === "solicitado").length;
        return (
          <Card key={r.n}>
            <CardHeader>
              <CardTitle className="text-base">Relación {r.n}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => abrir({ tipo: "rel", d: { nOriginal: r.n, n: r.n, fecha: r.fecha, fechaLimite: r.fechaLimite } })}><Pencil />Editar</Button>
            </CardHeader>
            <CardContent>
              <KV k="Fecha" v={fecha(r.fecha)} />
              <KV k="Fecha límite de pago" v={fecha(r.fechaLimite)} />
              <KV k={`${lista.length} pago${lista.length === 1 ? "" : "s"} · total`} v={fm(tot)} />
              <KV k="Saldo a pagar" v={fm(pend)} tone={pend > 0 ? "warn" : "ok"} />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => abrir({ tipo: "pago", d: { rel: r.n } })}><Plus />Pago aquí</Button>
                <Button size="sm" variant="outline" onClick={() => { setImprimir(r.n); setTimeout(() => window.print(), 150); }}><Printer />Imprimir</Button>
                {porAutorizar > 0 && <Button size="sm" variant="outline" onClick={() => marcarRel(r.id, "autorizado")}>Autorizar {porAutorizar}</Button>}
                {pend > 0 && <Button size="sm" onClick={() => { if (confirm(`¿Marcar como pagados los ${fm(pend)} pendientes de la Relación ${r.n}?`)) marcarRel(r.id, "pagado"); }}>Pagar todo</Button>}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="dashed" onClick={() => abrir({ tipo: "rel", d: { n: nextRel(), fecha: HOY(), fechaLimite: "" } })}><Plus />Relación</Button>
      <DatosEfectivo />
      <RelacionPrint n={imprimir} />
    </>
  );
}
