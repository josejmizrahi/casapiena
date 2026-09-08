import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Circle, Lock, PackageX, Wallet } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import { UMBRAL_AMBAR, type Nivel } from "@/lib/calculos";
import { HOY, cn, fm, pct, plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { StackedBar } from "@/components/ui/progress";
import { Row } from "@/components/ui/misc";

const TONO: Record<Nivel, { texto: string; clase: string; punto: string }> = {
  ok: { texto: "En orden", clase: "bg-ok-bg text-ok", punto: "bg-ok" },
  ambar: { texto: "Atención", clase: "bg-warn-bg text-warn", punto: "bg-warn" },
  rojo: { texto: "Excedido", clase: "bg-bad-bg text-bad", punto: "bg-bad" },
  sinCandado: { texto: "Sin candados", clase: "bg-muted text-muted-foreground", punto: "bg-border" },
};

/** Semáforo pequeño reutilizable. */
export function Semaforo({ nivel, etiqueta }: { nivel: Nivel; etiqueta?: boolean }) {
  const t = TONO[nivel];
  return etiqueta
    ? <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold", t.clase)}><span className={cn("size-2 rounded-full", t.punto)} />{t.texto}</span>
    : <span className={cn("size-2.5 rounded-full shrink-0", t.punto)} title={t.texto} />;
}

export default function Hoy() {
  const { p, calc } = useProyecto();
  const { abrir } = useModal();
  const s = calc.salud;
  const hoy = HOY();
  const porAutorizar = p.pagos.filter((x) => x.estado === "solicitado");
  const porPagar = p.pagos.filter((x) => x.estado === "autorizado");
  const vencidas = calc.conceptos.filter((c) => c.eta && c.eta < hoy && !["recibido", "instalado"].includes(c.logistica));
  const rojas = calc.partidas.filter((x) => x.nivel === "rojo");
  const ambar = calc.partidas.filter((x) => x.nivel === "ambar");
  const adelantadas = calc.partidas.filter((x) => x.adelantada);
  const adelantados = calc.conceptos.filter((c) => c.pagadoAdelantado);
  const suma = (xs: { monto: number }[]) => xs.reduce((a, b) => a + b.monto, 0);
  const avance = pct(calc.pagadoTotal, calc.granTotal);

  // lista de arranque: se marca sola conforme el proyecto toma forma
  const pasos = [
    { ok: p.meta.presupuestoObra > 0, texto: "Definir el presupuesto general", a: "ajustes" },
    { ok: calc.partidas.length > 0, texto: "Crear las partidas de la obra", a: "obra" },
    { ok: calc.partidas.length > 0 && s.sinCandado === 0, texto: "Ponerle candado a cada partida", a: "obra" },
    { ok: calc.contingencia.hay, texto: "Marcar una partida como reserva de imprevistos", a: "obra" },
    { ok: calc.conceptos.length > 0, texto: "Capturar los conceptos con su presupuesto", a: "obra" },
    { ok: calc.conceptos.length > 0 && s.sinPresupuesto === 0, texto: "Que ningún concepto quede sin presupuesto", a: "obra" },
    { ok: p.proveedores.length > 0, texto: "Dar de alta proveedores con datos bancarios", a: "proveedores" },
    { ok: p.pagos.length > 0, texto: "Registrar el primer pago en una relación", a: "pagos" },
  ];
  const pendientes = pasos.filter((x) => !x.ok);
  const arrancando = pendientes.length >= 3;

  const acciones: { icon: React.ReactNode; titulo: string; detalle: string; a: string; tone: "warn" | "bad" | "info" }[] = [];
  if (porAutorizar.length) acciones.push({ icon: <Wallet />, titulo: `${plural(porAutorizar.length, "pago")} por autorizar`, detalle: fm(suma(porAutorizar)), a: "pagos", tone: "warn" });
  if (porPagar.length) acciones.push({ icon: <Wallet />, titulo: `${plural(porPagar.length, "pago autorizado", "pagos autorizados")} sin pagar`, detalle: fm(suma(porPagar)), a: "pagos", tone: "info" });
  if (vencidas.length) acciones.push({ icon: <PackageX />, titulo: `${plural(vencidas.length, "entrega vencida", "entregas vencidas")}`, detalle: vencidas.slice(0, 3).map((c) => c.nombre).join(", ") + (vencidas.length > 3 ? "…" : ""), a: "compras", tone: "bad" });
  if (rojas.length) acciones.push({ icon: <Lock />, titulo: `${plural(rojas.length, "partida excedida", "partidas excedidas")}`, detalle: rojas.map((x) => `${x.nombre} (+${fm(-x.comparativa)})`).join(", "), a: "obra", tone: "bad" });
  if (ambar.length) acciones.push({ icon: <AlertTriangle />, titulo: `${plural(ambar.length, "partida")} arriba del ${Math.round(UMBRAL_AMBAR * 100)} % del candado`, detalle: ambar.map((x) => `${x.nombre} (${Math.round(x.usoCandado * 100)}%)`).join(", "), a: "obra", tone: "warn" });
  if (adelantados.length) acciones.push({ icon: <AlertTriangle />, titulo: `${plural(adelantados.length, "concepto pagado", "conceptos pagados")} por delante de su avance físico`, detalle: adelantados.slice(0, 3).map((c) => `${c.nombre} (pagado ${c.pctPagado}%, hecho ${c.avance}%)`).join(", ") + (adelantados.length > 3 ? "…" : ""), a: "resumen", tone: "warn" });
  else if (adelantadas.length) acciones.push({ icon: <AlertTriangle />, titulo: "Pagos adelantados al ritmo de la obra", detalle: adelantadas.map((x) => `${x.nombre} (${x.avance}%)`).join(", "), a: "resumen", tone: "info" });
  if (calc.contingencia.hay && calc.contingencia.disponible <= 0) acciones.push({ icon: <Lock />, titulo: "Se agotó la reserva de imprevistos", detalle: `Traspasada ${fm(calc.contingencia.usada)} de ${fm(calc.contingencia.candadoOriginal)}`, a: "resumen", tone: "bad" });
  if (!arrancando && s.sinPresupuesto) acciones.push({ icon: <Circle />, titulo: `${plural(s.sinPresupuesto, "concepto")} sin presupuesto`, detalle: "No cuentan en lo comprometido; el candado se ve más libre de lo que es.", a: "obra", tone: "info" });
  if (s.candadosSobrePresupuesto) acciones.push({ icon: <Lock />, titulo: "Los candados suman más que el presupuesto general", detalle: `${fm(calc.totalCandados)} contra ${fm(p.meta.presupuestoObra)}`, a: "obra", tone: "bad" });

  return (
    <>
      <div className="rounded-2xl bg-primary text-primary-foreground p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs opacity-75">Gran total (obra + honorarios {p.meta.pctHonorarios}%)</div>
          <Semaforo nivel={s.nivel} etiqueta />
        </div>
        <div className="text-3xl font-bold num">{fm(calc.granTotal)}</div>
        <StackedBar pagado={avance} tramite={pct(calc.porPagarObra, calc.granTotal)} light />
        <div className="flex justify-between text-xs opacity-90 num"><span>Pagado {fm(calc.pagadoTotal)} ({avance}%)</span><span>En trámite {fm(calc.porPagarObra)}</span></div>
      </div>
      <StatStrip cols={4}>
        <Stat label="Presupuesto general" value={fm(p.meta.presupuestoObra)} />
        <Stat label="Comprometido" value={fm(calc.totalObra)} sub={p.meta.presupuestoObra > 0 ? `${pct(calc.totalObra, p.meta.presupuestoObra)}% del presupuesto` : undefined} tone={calc.comparativaGlobal < 0 ? "bad" : undefined} />
        <Stat label="Candados asignados" value={fm(calc.totalCandados)} sub={p.meta.presupuestoObra > 0 ? `${fm(p.meta.presupuestoObra - calc.totalCandados)} sin asignar` : undefined} tone={s.candadosSobrePresupuesto ? "bad" : undefined} />
        {calc.contingencia.hay
          ? <Stat label="Reserva de imprevistos" value={fm(calc.contingencia.disponible)} sub={`de ${fm(calc.contingencia.candadoOriginal)} · usada ${fm(calc.contingencia.usada)}`} tone={calc.contingencia.disponible <= 0 ? "bad" : "ok"} />
          : <Stat label="Partidas" value={`${calc.partidas.length}`} sub={`${rojas.length} en rojo · ${ambar.length} en ámbar · ${s.sinCandado} sin candado`} />}
      </StatStrip>

      {arrancando && (
        <Card>
          <CardHeader><div><CardTitle>Para arrancar</CardTitle><CardDescription>Se van marcando solos conforme avanzas.</CardDescription></div><Button size="sm" variant="ghost" onClick={() => abrir({ tipo: "guia" })}><BookOpen />Guía</Button></CardHeader>
          <CardContent>
            {pasos.map((x) => (
              <Row key={x.texto} leading={x.ok ? <CheckCircle2 className="size-4 text-ok shrink-0" /> : <Circle className="size-4 text-border shrink-0" />}
                left={<span className={cn("text-sm", x.ok && "line-through text-muted-foreground")}>{x.texto}</span>}
                right={!x.ok && <Button asChild size="sm" variant="ghost"><Link to={`../${x.a}`} relative="path">Ir<ArrowRight /></Link></Button>} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><div><CardTitle>Requiere tu atención</CardTitle><CardDescription>Lo que hoy necesita una decisión o un movimiento.</CardDescription></div>{!arrancando && <Button size="sm" variant="ghost" onClick={() => abrir({ tipo: "guia" })}><BookOpen />Guía</Button>}</CardHeader>
        <CardContent>
          {acciones.length === 0 && <div className="flex items-center gap-2 text-sm text-ok py-2"><CheckCircle2 className="size-4" />Nada pendiente. La obra va en orden.</div>}
          {acciones.map((a) => (
            <Row key={a.titulo} leading={<span className={cn("size-8 rounded-lg flex items-center justify-center shrink-0 [&_svg]:size-4", a.tone === "bad" ? "bg-bad-bg text-bad" : a.tone === "warn" ? "bg-warn-bg text-warn" : "bg-info-bg text-info")}>{a.icon}</span>}
              left={<><div className="text-sm font-medium">{a.titulo}</div><div className="text-xs text-muted-foreground truncate">{a.detalle}</div></>}
              right={<Button asChild size="sm" variant="ghost"><Link to={`../${a.a}`} relative="path">Ver<ArrowRight /></Link></Button>} />
          ))}
        </CardContent>
      </Card>

      {calc.partidas.length > 0 && (
        <Card>
          <CardHeader><div><CardTitle>Candados por partida</CardTitle><CardDescription>Verde bajo {Math.round(UMBRAL_AMBAR * 100)} % del candado, ámbar hasta el 100 %, rojo si se excede.</CardDescription></div></CardHeader>
          <CardContent>
            {calc.partidas.map((pa) => (
              <Row key={pa.id} leading={<Semaforo nivel={pa.nivel} />}
                left={<div className="flex items-center gap-2 min-w-0"><span className="text-sm truncate">{pa.nombre}</span><div className="hidden sm:block w-28"><StackedBar pagado={Math.min(100, pa.usoCandado * 100)} tramite={0} bad={pa.nivel === "rojo"} className="h-1.5" /></div></div>}
                right={<div className="text-xs num"><b>{fm(pa.comprometido)}</b><span className="text-muted-foreground"> / {pa.candadoEf > 0 ? fm(pa.candadoEf) : "sin candado"}</span></div>} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
