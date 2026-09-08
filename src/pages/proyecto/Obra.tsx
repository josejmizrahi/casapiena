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
        <Stat label="Presupuesto obra" value={fm(p.meta.presupuestoObra)} />
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
          <Card key={pa.id} className={cn(pa.excedido && "border-bad/40")}>
            <CardHeader className="pb-2">
              <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left" onClick={() => setAbiertas((a) => ({ ...a, [pa.id]: !open }))}>
                {open ? <ChevronDown className="size-4 text-muted-foreground shrink-0" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                <Semaforo nivel={pa.nivel} />
                <h2 className="font-semibold truncate">{pa.nombre}</h2>
                <span className="text-xs text-muted-foreground shrink-0">{pa.conceptos.length}</span>
                {pa.contingencia && <Badge variant="gold">Reserva</Badge>}
              </button>
              <button type="button" onClick={() => abrir({ tipo: "partida", d: { id: pa.id, nombre: pa.nombre, candado: pa.candado } })}
                className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold num shrink-0", pa.excedido ? "bg-bad-bg text-bad" : "bg-gold-bg text-gold")}>
                <Lock className="size-3" />{pa.candadoEf ? fm(pa.candadoEf) : "Sin candado"}{pa.recibido || pa.cedido ? " ⇄" : ""}
              </button>
            </CardHeader>
            <CardContent className="pt-0">
              <StackedBar pagado={(pa.pagado / base) * 100} tramite={((pa.comprometido - pa.pagado) / base) * 100} bad={pa.excedido} />
              <div className="flex justify-between gap-2 text-xs text-muted-foreground mt-1.5 num">
                <span>Comprometido <b className="text-foreground">{fm(pa.comprometido)}</b> · pagado {pa.avance}%{pa.conAvance ? ` · avance físico ${pa.avanceFisico}%` : ""}{Math.abs(pa.desviacion) > 0.005 ? <span className={pa.desviacion > 0 ? " text-bad" : " text-ok"}> · {pa.desviacion > 0 ? "+" : "−"}{fm(Math.abs(pa.desviacion))} vs base</span> : ""}</span>
                {pa.candadoEf > 0 && <span className={pa.excedido ? "text-bad" : "text-ok"}>{pa.excedido ? "Excedido " : "Libre "}<b>{fm(Math.abs(pa.comparativa))}</b></span>}
              </div>
              {pa.adelantada && <p className="text-xs text-warn mt-1">Va {pa.avance - calc.avanceGlobal} puntos adelante del avance general ({calc.avanceGlobal}%): ya le pagaste más de lo que corresponde al ritmo de la obra.</p>}
              {open && (
                <div className="mt-2">
                  {pa.conceptos.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin conceptos. Agrega cada cosa que se compra o contrata aquí, con su presupuesto sin IVA.</p>}
                  {pa.conceptos.map((c) => (
                    <Row key={c.id} onClick={() => abrir({ tipo: "concepto", d: conceptoForm(c) })} leading={<Dot estado={c.estado} />}
                      left={<>
                        <div className="text-sm font-medium truncate flex items-center gap-1">{c.links.length > 0 && <Link2 className="size-3.5 text-info shrink-0" />}{c.nombre}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {nombreProv(c.proveedorId) || "Sin proveedor"}{c.precioUnitario > 0 ? ` · ${c.cantidad} ${c.unidad || "u"} × ${fm(c.precioUnitario)}` : ""}{c.total > 0 ? ` · pagado ${c.pctPagado}%` : ""}{c.avance > 0 ? ` · ${c.avance}% hecho` : ""}{c.logistica !== "porComprar" ? ` · ${LOG[c.logistica]}` : ""}{c.ajustes.length ? " · ajustado" : ""}
                        </div>
                      </>}
                      right={<div className="flex items-center gap-2">
                        {c.pagadoAdelantado && <Badge variant="warn">Adelantado</Badge>}
                        <PrioBadge p={c.prioridad} corto />
                        <div><div className="text-sm font-semibold">{c.total ? fm(c.total) : "—"}</div>{c.saldo > 0.005 && c.total > 0 && <div className="text-[11px] text-muted-foreground">saldo {fm(c.saldo)}</div>}</div>
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
