import { ArrowRight, Plus } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import { useGastos } from "@/hooks/useGastos";
import { HOY, cn, fecha, fm, fm2, plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Empty, Row } from "@/components/ui/misc";

/** Gastos compartidos entre los miembros del proyecto: quién pagó, cuánto le toca a cada quien y cómo quedar a mano. */
export default function Gastos() {
  const { p } = useProyecto();
  const { abrir } = useModal();
  const { data, isLoading, error, nombre, saldos, transferencias, yo } = useGastos(p.id);

  if (isLoading) return <p className="text-sm text-ink-3">Cargando gastos…</p>;
  if (error || !data) return <Empty><p className="text-bad">{error ? (error as Error).message : "No se pudieron cargar los gastos."}</p></Empty>;

  const total = data.gastos.reduce((s, x) => s + x.monto, 0);
  const mio = saldos.find((x) => x.userId === yo);
  const neto = mio?.neto || 0;
  const movimientos = [
    ...data.gastos.map((x) => ({ tipo: "gasto" as const, fecha: x.fecha, x })),
    ...data.liquidaciones.map((x) => ({ tipo: "liq" as const, fecha: x.fecha, x })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <StatStrip>
        <Stat label="Gastos del grupo" value={fm(total)} sub={plural(data.gastos.length, "gasto")} />
        <Stat label="Tú pagaste" value={fm(mio?.pagado || 0)} sub={`Te toca ${fm(mio?.consumo || 0)}`} />
        <Stat label={neto > 0.004 ? "Te deben" : neto < -0.004 ? "Debes" : "Tu saldo"} value={Math.abs(neto) < 0.005 ? "A mano" : fm(Math.abs(neto))} tone={neto > 0.004 ? "ok" : neto < -0.004 ? "bad" : undefined} />
      </StatStrip>

      {movimientos.length === 0 ? (
        <Empty>
          <p className="font-medium text-foreground">Todavía no hay gastos compartidos</p>
          <p className="mt-1">Registra lo que cada quien paga de su bolsa (comidas, fletes, material de urgencia…), repártelo entre los miembros del proyecto y aquí verás quién le debe a quién. No afecta el presupuesto de la obra.</p>
          <Button size="sm" className="mt-3" onClick={() => abrir({ tipo: "gasto", d: {} })}><Plus />Registrar el primer gasto</Button>
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader><div><CardTitle>Para quedar a mano</CardTitle><CardDescription>La menor cantidad de pagos para saldar todo. Cuando alguien pague, regístralo.</CardDescription></div></CardHeader>
            <CardContent>
              {transferencias.length === 0 && <p className="py-3 text-[14px] text-ink-2">Todos están a mano.</p>}
              {transferencias.map((t) => (
                <Row key={t.deId + t.aId}
                  left={<div className="text-sm font-medium flex items-center gap-1.5 flex-wrap"><span className={cn(t.deId === yo && "text-bad")}>{nombre(t.deId)}</span><ArrowRight className="size-3.5 text-ink-3" /><span className={cn(t.aId === yo && "text-ok")}>{nombre(t.aId)}</span></div>}
                  right={<div className="flex items-center gap-3"><span className="text-sm font-semibold">{fm2(t.monto)}</span><Button size="sm" variant="outline" onClick={() => abrir({ tipo: "liquidacion", d: { deId: t.deId, aId: t.aId, monto: t.monto, fecha: HOY(), nota: "" } })}>Registrar</Button></div>}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Saldos</CardTitle></CardHeader>
            <CardContent>
              {[...saldos].sort((a, b) => b.neto - a.neto).map((s) => (
                <Row key={s.userId}
                  left={<><div className="text-sm font-medium truncate">{nombre(s.userId)}</div><div className="text-xs text-ink-3 num">Pagó {fm(s.pagado)} · le toca {fm(s.consumo)}</div></>}
                  right={Math.abs(s.neto) < 0.005 ? <span className="text-sm text-ink-3">A mano</span>
                    : <><div className={cn("text-sm font-semibold", s.neto > 0 ? "text-ok" : "text-bad")}>{fm2(Math.abs(s.neto))}</div><div className="text-[11px] text-ink-3">{s.neto > 0 ? "le deben" : "debe"}</div></>}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
              <Button size="sm" variant="outline" onClick={() => abrir({ tipo: "liquidacion", d: {} })}>Registrar pago</Button>
            </CardHeader>
            <CardContent>
              {movimientos.map((m) => m.tipo === "gasto" ? (
                <Row key={m.x.id} onClick={() => abrir({ tipo: "gasto", d: { ...m.x } })}
                  left={<>
                    <div className="text-sm font-medium truncate">{m.x.descripcion}</div>
                    <div className="text-xs text-ink-3 truncate">{m.x.pagadoPor === yo ? "Pagaste" : `Pagó ${nombre(m.x.pagadoPor)}`} · {fecha(m.x.fecha)} · entre {m.x.partes.length}{m.x.reparto === "montos" ? " (montos exactos)" : ""}</div>
                  </>}
                  right={<><div className="text-sm font-semibold">{fm2(m.x.monto)}</div><div className="text-[11px] text-ink-3">{(() => { const t = m.x.partes.find((x) => x.userId === yo)?.monto || 0; return t ? `tu parte ${fm2(t)}` : "no participas"; })()}</div></>}
                />
              ) : (
                <Row key={m.x.id} onClick={() => abrir({ tipo: "liquidacion", d: { ...m.x } })}
                  left={<>
                    <div className="text-sm font-medium truncate">{nombre(m.x.deId)} le pagó a {nombre(m.x.aId)}</div>
                    <div className="text-xs text-ink-3 truncate">Pago entre miembros · {fecha(m.x.fecha)}{m.x.nota ? ` · ${m.x.nota}` : ""}</div>
                  </>}
                  right={<div className="text-sm font-semibold text-ink-2">{fm2(m.x.monto)}</div>}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
