import { useState } from "react";
import { Plus } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { pagoDesde, useModal } from "@/hooks/useModal";
import * as api from "@/api";
import { type EstadoPago } from "@/lib/types";
import { HOY, fecha, fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { Empty, KV, Row } from "@/components/ui/misc";
import { FlujoBadge, FormaBadge } from "@/components/Etiquetas";

export default function Pagos() {
  const { p, calc, conceptoDe, nombreProv, accion } = useProyecto();
  const { abrir } = useModal();
  const [f, setF] = useState<"todos" | EstadoPago>("todos");
  const lista0 = f === "todos" ? p.pagos : p.pagos.filter((x) => x.estado === f);
  const rels = [...p.relaciones].sort((a, b) => b.n - a.n);
  const marcar = (id: string, estado: EstadoPago) => accion(() => api.marcarPago(id, estado, HOY()), estado === "pagado" ? "Marcado como pagado" : "Autorizado");
  return (
    <>
      <StatStrip>
        <Stat label="Pagado" value={fm(calc.pagadoTotal)} tone="ok" />
        <Stat label="En trámite" value={fm(calc.porPagarObra)} tone="warn" />
        <Stat label="Sin solicitar" value={fm(Math.max(0, calc.granTotal - calc.pagadoTotal - calc.porPagarObra))} />
      </StatStrip>
      <Segmented value={f} onChange={setF} options={[["todos", "Todos"], ["solicitado", "Solicitados"], ["autorizado", "Autorizados"], ["pagado", "Pagados"]]} />
      {lista0.length === 0 && (
        <Empty>
          <p className="font-medium text-foreground">{f === "todos" ? "Todavía no hay pagos" : "No hay pagos en ese estado"}</p>
          {f === "todos" && <p className="mt-1">Un pago nace como <b>solicitado</b>, el cliente lo <b>autoriza</b> y al final se marca <b>pagado</b>. Se agrupan en relaciones numeradas, que son el documento que se imprime para liberar el dinero.</p>}
          {f === "todos" && <Button size="sm" className="mt-3" onClick={() => abrir({ tipo: "pago", d: {} })}><Plus />Registrar el primer pago</Button>}
        </Empty>
      )}
      {rels.map((r) => {
        const lista = lista0.filter((x) => x.rel === r.n).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        if (!lista.length) return null;
        return (
          <Card key={r.n}>
            <CardHeader>
              <div><CardTitle>Relación {r.n}</CardTitle><CardDescription className="num">{fecha(r.fecha)} · {fm(calc.pagosPorRel[r.n] || 0)}</CardDescription></div>
            </CardHeader>
            <CardContent>
              {lista.map((x) => (
                <div key={x.id}>
                  <Row onClick={() => abrir({ tipo: "pago", d: pagoDesde(x) })}
                    left={<>
                      <div className="text-sm font-medium truncate">{x.tipo === "honorarios" ? `Honorarios · ${x.fase}` : conceptoDe(x.conceptoId)?.nombre || "Concepto eliminado"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">{nombreProv(x.proveedorId) && <span>{nombreProv(x.proveedorId)} ·</span>}<span>{fecha(x.fecha)}</span><FormaBadge f={x.forma} /><FlujoBadge e={x.estado} />{x.deExcedente && <span>· de excedente</span>}</div>
                    </>}
                    right={<><div className="text-sm font-semibold">{fm(x.monto)}</div><div className="text-[11px] text-muted-foreground">{x.status}</div></>}
                  />
                  {x.estado !== "pagado" && (
                    <div className="flex gap-2 pb-2">
                      {x.estado === "solicitado" && <Button size="sm" variant="outline" onClick={() => marcar(x.id, "autorizado")}>Autorizar</Button>}
                      <Button size="sm" onClick={() => marcar(x.id, "pagado")}>Marcar pagado</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardHeader>
          <div><CardTitle>Excedente en efectivo</CardTitle><CardDescription>Dinero entregado de más o devoluciones. Los pagos “de excedente” lo descuentan.</CardDescription></div>
          <span className={"text-sm font-semibold num " + (calc.excedenteDiferencia < 0 ? "text-bad" : "text-ok")}>{fm(calc.excedenteDiferencia)}</span>
        </CardHeader>
        <CardContent>
          {p.excedentes.map((e) => <Row key={e.id} onClick={() => abrir({ tipo: "exc", d: e })} left={<><div className="text-sm font-medium">{e.concepto}</div><div className="text-xs text-muted-foreground">{fecha(e.fecha)}</div></>} right={<div className="text-sm font-semibold">{fm(e.monto)}</div>} />)}
          <KV k="Usado en pagos" v={fm(calc.excedenteUsado)} className="mt-1" />
          <Button variant="dashed" className="mt-2" onClick={() => abrir({ tipo: "exc", d: { concepto: "", fecha: HOY(), monto: 0 } })}><Plus />Excedente a favor</Button>
        </CardContent>
      </Card>
    </>
  );
}
