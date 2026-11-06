import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import { useGastos } from "@/hooks/useGastos";
import { efecto, posiblesDuplicados } from "@/lib/gastos";
import type { Gasto } from "@/lib/types";
import { HOY, cn, fecha, fm, fm2, mesLabel, pct, plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { StackedBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Empty, Row } from "@/components/ui/misc";

/** Gastos compartidos entre los miembros del proyecto: quién pagó, cuánto le toca a cada quien y cómo quedar a mano. */
export default function Gastos() {
  const { p, conceptoDe } = useProyecto();
  const { abrir } = useModal();
  const { data, isLoading, error, nombre, saldos, transferencias, yo } = useGastos(p.id);
  const [filtro, setFiltro] = useState("todos");

  if (isLoading) return <p className="text-sm text-ink-3">Cargando gastos…</p>;
  if (error || !data) return <Empty><p className="text-bad">{error ? (error as Error).message : "No se pudieron cargar los gastos."}</p></Empty>;

  const total = data.gastos.reduce((s, x) => s + x.monto, 0);
  const mio = saldos.find((x) => x.userId === yo);
  const neto = mio?.neto || 0;
  const dup = posiblesDuplicados(data.gastos);
  const hayObra = p.partidas.some((pa) => pa.conceptos.length > 0);
  const sinLigar = hayObra ? data.gastos.filter((x) => !x.conceptoId).length : 0;
  const pagadores = [...new Set(data.gastos.map((x) => x.pagadoPor))];
  const personas = [...saldos].filter((s) => s.pagado || s.consumo || Math.abs(s.neto) > 0.004).sort((a, b) => b.pagado - a.pagado);

  // cómo se repartió un gasto, en palabras
  const reparto = (x: Gasto) => {
    if (x.partes.length === 1) return x.partes[0].userId === x.pagadoPor ? "solo de quien pagó" : `le toca todo a ${nombre(x.partes[0].userId)}`;
    if (x.reparto === "montos") return "montos exactos";
    return x.partes.length === 2 ? "mitad y mitad" : `entre ${x.partes.length}`;
  };

  const movimientos = [
    ...data.gastos.map((x) => ({ tipo: "gasto" as const, fecha: x.fecha, x })),
    ...data.liquidaciones.map((x) => ({ tipo: "liq" as const, fecha: x.fecha, x })),
  ]
    .filter((m) => filtro === "todos" ? true : filtro === "sinLigar" ? m.tipo === "gasto" && !m.x.conceptoId : filtro === "dup" ? m.tipo === "gasto" && dup.has(m.x.id) : m.tipo === "gasto" ? m.x.pagadoPor === filtro : m.x.deId === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const meses = [...new Set(movimientos.map((m) => m.fecha.slice(0, 7)))];

  return (
    <>
      <p className="text-[13px] text-ink-2 leading-snug">Lo que cada quien pagó de su bolsa, cómo se reparte y quién le debe a quién. Si ligas un gasto a una parte de la obra, cuenta como pagado en el presupuesto. Los pagos que se tramitan con relaciones van en <Link to="../pagos" className="underline underline-offset-2 text-foreground">Pagos a proveedores</Link>.</p>
      <StatStrip>
        <Stat label="Gastos del grupo" value={fm(total)} sub={plural(data.gastos.length, "gasto")} />
        <Stat label="Tú pagaste" value={fm(mio?.pagado || 0)} sub={`${pct(mio?.pagado || 0, total)}% del total`} />
        <Stat label={neto > 0.004 ? "Te deben" : neto < -0.004 ? "Debes" : "Tu saldo"} value={Math.abs(neto) < 0.005 ? "A mano" : fm(Math.abs(neto))} tone={neto > 0.004 ? "ok" : neto < -0.004 ? "bad" : undefined} />
      </StatStrip>

      {movimientos.length === 0 && filtro === "todos" ? (
        <Empty>
          <p className="font-medium text-foreground">Todavía no hay gastos compartidos</p>
          <p className="mt-1">Registra lo que cada quien paga de su bolsa (comidas, fletes, material de urgencia…), repártelo entre los miembros del proyecto y aquí verás quién le debe a quién. Si lo ligas a una parte de la obra, también cuenta como pagado en el presupuesto.</p>
          <Button size="sm" className="mt-3" onClick={() => abrir({ tipo: "gasto", d: {} })}><Plus />Registrar el primer gasto</Button>
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader><div><CardTitle>Para quedar a mano</CardTitle><CardDescription>Lo que falta transferir para quedar a mano. Cuando alguien transfiera, toca "Saldar" para registrarlo.</CardDescription></div></CardHeader>
            <CardContent>
              {transferencias.length === 0 && <p className="py-3 text-[14px] text-ink-2">Todos están a mano.</p>}
              {transferencias.map((t) => (
                <Row key={t.deId + t.aId}
                  left={<>
                    <div className="text-[15px] font-medium flex items-center gap-1.5 flex-wrap"><span className={cn(t.deId === yo && "text-bad")}>{nombre(t.deId)}</span><ArrowRight className="size-3.5 text-ink-3" /><span className={cn(t.aId === yo && "text-ok")}>{nombre(t.aId)}</span></div>
                    <div className="text-xs text-ink-3">{t.deId === yo ? "Le debes" : t.aId === yo ? "Te debe" : "Le debe"} {fm2(t.monto)}</div>
                  </>}
                  right={<div className="flex items-center gap-3"><span className="text-[17px] font-semibold">{fm2(t.monto)}</span><Button size="sm" variant="outline" onClick={() => abrir({ tipo: "liquidacion", d: { deId: t.deId, aId: t.aId, monto: t.monto, fecha: HOY(), nota: "" } })}>Saldar</Button></div>}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Cuánto lleva cada quien</CardTitle><CardDescription>Lo que pagó cada quien contra lo que le toca según el reparto de cada gasto. La diferencia es lo que le deben o lo que debe.</CardDescription></div></CardHeader>
            <CardContent>
              {personas.map((s) => {
                const pagos = Math.round((s.neto - (s.pagado - s.consumo)) * 100) / 100; // pagos entre miembros ya registrados
                return (
                  <div key={s.userId} className="py-3 border-t border-border first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium truncate">{nombre(s.userId)}</span>
                      {Math.abs(s.neto) < 0.005 ? <span className="text-sm text-ink-3">A mano</span>
                        : <span className={cn("num text-[15px] font-semibold", s.neto > 0 ? "text-ok" : "text-bad")}>{s.neto > 0 ? "Le deben " : "Debe "}{fm2(Math.abs(s.neto))}</span>}
                    </div>
                    <StackedBar className="mt-2" pagado={pct(s.pagado, total)} tramite={0} />
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[12.5px] num">
                      <div><div className="text-ink-3">Pagó</div><div className="font-medium">{fm2(s.pagado)}</div><div className="text-[11px] text-ink-3">{pct(s.pagado, total)}% del total</div></div>
                      <div><div className="text-ink-3">Le toca</div><div className="font-medium">{fm2(s.consumo)}</div></div>
                      <div><div className="text-ink-3">{s.pagado >= s.consumo ? "Puso de más" : "Puso de menos"}</div><div className="font-medium">{fm2(Math.abs(s.pagado - s.consumo))}</div>
                        {Math.abs(pagos) > 0.004 && <div className="text-[11px] text-ink-3">{pagos > 0 ? `ya transfirió ${fm2(pagos)}` : `ya recibió ${fm2(-pagos)}`}</div>}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
              <Button size="sm" variant="outline" onClick={() => abrir({ tipo: "liquidacion", d: {} })}>Saldar deuda</Button>
            </CardHeader>
            <CardContent>
              <Segmented className="mb-1" value={filtro} onChange={setFiltro}
                options={[["todos", "Todos"], ...pagadores.map((u): [string, string] => [u, u === yo ? "Pagaste tú" : `Pagó ${nombre(u)}`]), ...(dup.size ? [["dup", `¿Duplicados? (${dup.size})`] as [string, string]] : []), ...(sinLigar ? [["sinLigar", `Sin ligar a la obra (${sinLigar})`] as [string, string]] : [])]} />
              {filtro === "sinLigar" && <p className="py-2 text-[13px] text-ink-2">Gastos que no cuentan contra el presupuesto. Ábrelos y elige de qué parte de la obra son.</p>}
              {filtro === "dup" && <p className="py-2 text-[13px] text-ink-2">Gastos con el mismo monto que otro. Si son el mismo gasto capturado dos veces, borra uno.</p>}
              {movimientos.length === 0 && <p className="py-3 text-[14px] text-ink-2">No hay movimientos con este filtro.</p>}
              {meses.map((mes) => {
                const delMes = movimientos.filter((m) => m.fecha.startsWith(mes));
                const sumaMes = delMes.reduce((s, m) => s + (m.tipo === "gasto" ? m.x.monto : 0), 0);
                return (
                  <div key={mes}>
                    <div className="flex items-baseline justify-between pt-4 pb-1 anno"><span>{mesLabel(mes)}</span><span className="num">{fm2(sumaMes)}</span></div>
                    {delMes.map((m) => {
                      if (m.tipo === "liq") return (
                        <Row key={m.x.id} onClick={() => abrir({ tipo: "liquidacion", d: { ...m.x } })}
                          left={<>
                            <div className="text-sm font-medium truncate">{nombre(m.x.deId)} le transfirió a {nombre(m.x.aId)}</div>
                            <div className="text-xs text-ink-3 truncate">Para saldar la deuda · {fecha(m.x.fecha)}{m.x.nota ? ` · ${m.x.nota}` : ""}</div>
                          </>}
                          right={<div className="text-sm font-semibold text-ink-2">{fm2(m.x.monto)}</div>}
                        />
                      );
                      const e = efecto(m.x, yo), otros = dup.get(m.x.id);
                      return (
                        <Row key={m.x.id} onClick={() => abrir({ tipo: "gasto", d: { ...m.x } })}
                          left={<>
                            <div className="text-sm font-medium truncate flex items-center gap-1.5">{otros && <Badge variant="warn" title={`Mismo monto que: ${otros.map((o) => o.descripcion).join(", ")}`}>¿Duplicado?</Badge>}<span className="truncate">{m.x.descripcion}</span></div>
                            <div className="text-xs text-ink-3 truncate">{m.x.pagadoPor === yo ? "Pagaste" : `Pagó ${nombre(m.x.pagadoPor)}`} · {fecha(m.x.fecha)} · {reparto(m.x)}{m.x.conceptoId && conceptoDe(m.x.conceptoId) ? ` · ${conceptoDe(m.x.conceptoId)!.nombre}` : ""}</div>
                          </>}
                          right={<><div className="text-sm font-semibold">{fm2(m.x.monto)}</div>
                            <div className={cn("text-[11px]", e > 0.004 ? "text-ok" : e < -0.004 ? "text-bad" : "text-ink-3")}>{e > 0.004 ? `+${fm2(e)} a tu favor` : e < -0.004 ? `−${fm2(-e)} a tu cargo` : "no te mueve"}</div></>}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
