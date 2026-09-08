import { lazy, Suspense } from "react";
import { X } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import * as api from "@/api";
import { fecha, fm, pct } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StackedBar } from "@/components/ui/progress";
import { Alert, KV, Row } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { PrioBadge } from "@/components/Etiquetas";

const Graficas = lazy(() => import("@/components/Graficas"));

export default function Resumen() {
  const { p, calc, accion } = useProyecto();
  const excedidas = calc.partidas.filter((x) => x.excedido);
  const adelantadas = calc.partidas.filter((x) => x.adelantada);
  const avance = pct(calc.pagadoTotal, calc.granTotal);
  const suma = (f: (x: typeof p.pagos[number]) => boolean) => p.pagos.filter((x) => x.estado === "pagado" && f(x)).reduce((s, x) => s + x.monto, 0);
  const nombrePa = (id: string) => p.partidas.find((x) => x.id === id)?.nombre || "—";
  const recortable = calc.porPrioridad.filter((x) => x.k === "opcional" || x.k === "exhibicion").reduce((s, x) => s + x.monto - x.pagado, 0);
  return (
    <>
      <div className="rounded-2xl bg-primary text-primary-foreground p-5 space-y-2">
        <div className="text-xs opacity-75">Gran total (obra + honorarios {p.meta.pctHonorarios}%)</div>
        <div className="text-3xl font-bold num">{fm(calc.granTotal)}</div>
        <StackedBar pagado={avance} tramite={pct(calc.porPagarObra, calc.granTotal)} light />
        <div className="flex justify-between text-xs opacity-90 num"><span>Pagado {fm(calc.pagadoTotal)} ({avance}%)</span><span>En trámite {fm(calc.porPagarObra)}</span></div>
      </div>
      {calc.comparativaGlobal < 0 && p.meta.presupuestoObra > 0 && <Alert tone="bad"><b>Te pasas del presupuesto de obra por {fm(-calc.comparativaGlobal)}.</b></Alert>}
      {excedidas.length > 0 && <Alert><b>{excedidas.length} partida{excedidas.length > 1 ? "s" : ""} sobre su candado:</b> {excedidas.map((x) => `${x.nombre} (+${fm(-x.comparativa)})`).join(", ")}</Alert>}
      {adelantadas.length > 0 && <Alert tone="info"><b>Pagos adelantados al avance:</b> {adelantadas.map((x) => `${x.nombre} (${x.avance}%)`).join(", ")} · avance general {calc.avanceGlobal}%</Alert>}

      {calc.porPrioridad.length > 1 && (
        <Card>
          <CardHeader><div><CardTitle>Qué tanto pesa lo prescindible</CardTitle><CardDescription>Si tienes que recortar, esto es lo que hay sobre la mesa.</CardDescription></div></CardHeader>
          <CardContent>
            {calc.porPrioridad.map((x) => <KV key={x.k} k={<span className="flex items-center gap-2"><PrioBadge p={x.k} />{x.k === "sinClasificar" && <span>Sin clasificar</span>}<span className="text-xs">{x.conceptos} concepto{x.conceptos === 1 ? "" : "s"}</span></span>} v={<>{fm(x.monto)}{calc.totalObra > 0 && <span className="text-muted-foreground font-normal"> · {pct(x.monto, calc.totalObra)}%</span>}</>} />)}
            {recortable > 0 && <p className="text-xs text-muted-foreground mt-2 num">Sin pagar en opcionales y exhibiciones: {fm(recortable)}.</p>}
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Card><CardContent className="text-sm text-muted-foreground">Cargando gráficas…</CardContent></Card>}>
        <Graficas />
      </Suspense>

      <Card>
        <CardContent className="pt-4">
          <KV k="Presupuesto de obra" v={fm(p.meta.presupuestoObra)} />
          <KV k="Suma de candados vigentes" v={fm(calc.totalCandados)} />
          <KV k="Total obra comprometido" v={fm(calc.totalObra)} />
          <KV k="Comparativa vs presupuesto" v={fm(calc.comparativaGlobal)} tone={calc.comparativaGlobal < 0 ? "bad" : "ok"} />
          <KV k={`Honorarios (${p.meta.pctHonorarios}%)`} v={fm(calc.honorarios)} />
          <KV k="Gran total" v={fm(calc.granTotal)} bold />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <KV k="Pagado obra" v={<>{fm(calc.pagadoObra)} <span className="text-muted-foreground font-normal">({pct(calc.pagadoObra, calc.totalObra)}%)</span></>} />
          <KV k="Pagado honorarios" v={<>{fm(calc.pagadoHonorarios)} <span className="text-muted-foreground font-normal">({pct(calc.pagadoHonorarios, calc.honorarios)}%)</span></>} />
          <KV k="Efectivo" v={fm(suma((x) => x.forma === "Efectivo"))} />
          <KV k="Transferencia" v={fm(suma((x) => x.forma === "Transferencia"))} />
          <KV k="Excedente en efectivo a favor" v={fm(calc.excedenteDiferencia)} />
        </CardContent>
      </Card>
      {p.traspasos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Traspasos de candado</CardTitle></CardHeader>
          <CardContent>
            {p.traspasos.map((t) => (
              <Row key={t.id} left={<><div className="text-sm font-medium">{nombrePa(t.deId)} → {nombrePa(t.aId)}</div><div className="text-xs text-muted-foreground">{fecha(t.fecha)}{t.motivo ? ` · ${t.motivo}` : ""}</div></>}
                right={<div className="flex items-center gap-2"><span className="text-sm font-semibold">{fm(t.monto)}</span><Button size="icon" variant="ghost" className="size-7 text-bad" aria-label="Borrar traspaso" onClick={() => confirm("¿Borrar este traspaso?") && accion(() => api.borrarTraspaso(t.id))}><X /></Button></div>} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
