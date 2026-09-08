import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, Plus, Link2 } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { conceptoForm, conceptoNuevo, useModal } from "@/hooks/useModal";
import { LOG } from "@/lib/types";
import { cn, fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { StackedBar } from "@/components/ui/progress";
import { Empty, Row } from "@/components/ui/misc";
import { Dot, PrioBadge } from "@/components/Etiquetas";
import { Semaforo } from "./Hoy";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function Obra() {
  const { p, calc, nombreProv } = useProyecto();
  const { abrir } = useModal();
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  return (
    <>
      <StatStrip>
        <Stat label="Comprometido" value={fm(calc.totalObra)} />
        <Stat label="Presupuesto" value={fm(p.meta.presupuestoObra)} />
        <Stat label="Diferencia" value={fm(calc.comparativaGlobal)} tone={calc.comparativaGlobal < 0 ? "bad" : "ok"} />
      </StatStrip>
      {calc.partidas.length === 0 && (
        <Empty>
          <p className="font-medium text-foreground">Aún no hay partidas</p>
          <p className="mt-1">Una partida agrupa conceptos: un cuarto, la carpintería, las instalaciones. Cada una lleva un candado, el tope que decides no rebasar.</p>
          <div className="flex justify-center gap-2 mt-3">
            <Button size="sm" onClick={() => abrir({ tipo: "partida", d: { nombre: "", candado: 0 } })}><Plus />Primera partida</Button>
            <Button size="sm" variant="outline" onClick={() => abrir({ tipo: "guia", seccion: "candados" })}><BookOpen />Qué es un candado</Button>
          </div>
        </Empty>
      )}
      {calc.partidas.map((pa) => {
        const open = !!abiertas[pa.id];
        const base = Math.max(pa.candadoEf, pa.comprometido) || 1;
        return (
          <Card key={pa.id} className={cn(pa.excedido && "border-t-bad")}>
            <CardHeader className="pb-2 items-center">
              <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left" onClick={() => setAbiertas((a) => ({ ...a, [pa.id]: !open }))}>
                {open ? <ChevronDown className="size-4 text-ink-3 shrink-0" /> : <ChevronRight className="size-4 text-ink-3 shrink-0" />}
                <Semaforo nivel={pa.nivel} />
                <h2 className="text-[16px] font-semibold truncate">{pa.nombre}</h2>
                <span className="anno shrink-0">{pa.conceptos.length}</span>
                {pa.contingencia && <Badge variant="gold">Reserva</Badge>}
              </button>
              <button type="button" onClick={() => abrir({ tipo: "partida", d: { id: pa.id, nombre: pa.nombre, candado: pa.candado } })}
                className={cn("inline-flex items-center gap-1.5 border px-2 h-8 text-[12px] font-medium num shrink-0 rounded-[8px]", pa.excedido ? "border-bad/50 text-bad" : pa.candadoEf ? "border-border-2 text-foreground" : "border-dashed border-border-2 text-ink-3")}>
                <Lock className="size-3 stroke-[1.75]" />{pa.candadoEf ? fm(pa.candadoEf) : "Sin candado"}{pa.recibido || pa.cedido ? " ⇄" : ""}
              </button>
            </CardHeader>
            <CardContent className="pt-0">
              <StackedBar pagado={(pa.pagado / base) * 100} tramite={((pa.comprometido - pa.pagado) / base) * 100} bad={pa.excedido} />
              <div className="flex justify-between gap-3 text-[12px] text-ink-2 mt-2 num">
                <span className="truncate">Comprometido <b className="text-foreground">{fm(pa.comprometido)}</b> · pagado {pa.avance}%</span>
                {pa.candadoEf > 0 && <span className={cn("shrink-0", pa.excedido ? "text-bad" : "text-ok")}>{pa.excedido ? "Excedido " : "Libre "}<b>{fm(Math.abs(pa.comparativa))}</b></span>}
              </div>
              {(pa.conAvance || Math.abs(pa.desviacion) > 0.005) && (
                <div className="text-[12px] text-ink-3 mt-0.5 num truncate">
                  {pa.conAvance ? `Avance físico ${pa.avanceFisico}%` : ""}{pa.conAvance && Math.abs(pa.desviacion) > 0.005 ? " · " : ""}{Math.abs(pa.desviacion) > 0.005 ? <span className={pa.desviacion > 0 ? "text-bad" : "text-ok"}>{pa.desviacion > 0 ? "+" : "−"}{fm(Math.abs(pa.desviacion))} vs línea base</span> : null}
                </div>
              )}
              {pa.adelantada && <p className="text-[12px] text-warn mt-1.5">Va {pa.avance - calc.avanceGlobal} puntos adelante del avance general ({calc.avanceGlobal}%): ya le pagaste más de lo que corresponde al ritmo de la obra.</p>}
              {open && (
                <div className="mt-2">
                  {pa.conceptos.length === 0 && <p className="text-xs text-ink-3 py-2">Sin conceptos. Agrega cada cosa que se compra o contrata aquí, con su presupuesto sin IVA.</p>}
                  {pa.conceptos.map((c) => (
                    <Row key={c.id} onClick={() => abrir({ tipo: "concepto", d: conceptoForm(c) })} leading={<Dot estado={c.estado} />}
                      left={<>
                        <div className="text-[14px] font-medium truncate flex items-center gap-1.5">{c.links.length > 0 && <Link2 className="size-3.5 text-ink-3 shrink-0 stroke-[1.75]" />}{c.nombre}</div>
                        <div className="text-[12px] text-ink-3 truncate mt-0.5">
                          {nombreProv(c.proveedorId) || "Sin proveedor"}{c.precioUnitario > 0 ? ` · ${c.cantidad} ${c.unidad || "u"} × ${fm(c.precioUnitario)}` : ""}{c.total > 0 ? ` · pagado ${c.pctPagado}%` : ""}{c.avance > 0 ? ` · ${c.avance}% hecho` : ""}{c.logistica !== "porComprar" ? ` · ${LOG[c.logistica]}` : ""}{c.ajustes.length ? " · ajustado" : ""}
                        </div>
                      </>}
                      right={<div className="flex items-center gap-2">
                        {c.pagadoAdelantado && <Badge variant="warn">Adelantado</Badge>}
                        <PrioBadge p={c.prioridad} corto />
                        <div><div className="text-[14px] font-medium">{c.total ? fm(c.total) : "—"}</div>{c.saldo > 0.005 && c.total > 0 && <div className="text-[11px] text-ink-3">saldo {fm(c.saldo)}</div>}</div>
                      </div>}
                    />
                  ))}
                  <Button variant="dashed" className="mt-2" onClick={() => abrir({ tipo: "concepto", d: conceptoNuevo(pa.id) })}><Plus />Concepto</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Button variant="dashed" onClick={() => abrir({ tipo: "partida", d: { nombre: "", candado: 0 } })}><Plus />Partida</Button>
    </>
  );
}
