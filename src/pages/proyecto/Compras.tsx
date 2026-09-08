import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useProyecto } from "@/hooks/useProyecto";
import { conceptoForm, useModal } from "@/hooks/useModal";
import * as api from "@/api";
import { LOG, SIGUIENTE, type Logistica } from "@/lib/types";
import { HOY, fecha, fm, hostDe } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { Alert, Empty } from "@/components/ui/misc";
import { LogBadge } from "@/components/Etiquetas";

type Filtro = "pendientes" | "links" | "todos" | Logistica;
const ORDEN: Record<Logistica, number> = { porComprar: 0, cotizado: 1, comprado: 2, transito: 3, recibido: 4, instalado: 5 };

export default function Compras() {
  const { calc, nombreProv, accion } = useProyecto();
  const { abrir } = useModal();
  const [f, setF] = useState<Filtro>("pendientes");
  const items = calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => c.links.length > 0 || c.logistica !== "porComprar" || c.total > 0).map((c) => ({ ...c, partidaNombre: pa.nombre })));
  const cuenta = (k: Logistica) => items.filter((x) => x.logistica === k).length;
  const vista = (f === "pendientes" ? items.filter((x) => !["recibido", "instalado"].includes(x.logistica))
    : f === "links" ? items.filter((x) => x.links.length > 0)
    : f === "todos" ? items : items.filter((x) => x.logistica === f))
    .sort((a, b) => (a.eta || "9999").localeCompare(b.eta || "9999") || ORDEN[a.logistica] - ORDEN[b.logistica] || a.nombre.localeCompare(b.nombre));
  const hoy = HOY();
  const atrasados = items.filter((x) => x.eta && x.eta < hoy && !["recibido", "instalado"].includes(x.logistica));
  return (
    <>
      <StatStrip>
        <Stat label="Por comprar" value={cuenta("porComprar") + cuenta("cotizado")} />
        <Stat label="En camino" value={cuenta("comprado") + cuenta("transito")} tone="warn" />
        <Stat label="Recibido" value={cuenta("recibido") + cuenta("instalado")} tone="ok" />
      </StatStrip>
      {atrasados.length > 0 && <Alert><b>{atrasados.length} con fecha de entrega vencida:</b> {atrasados.map((x) => x.nombre).join(", ")}</Alert>}
      <Segmented value={f} onChange={setF} options={[["pendientes", "Pendientes"], ["links", "Con link"], ["porComprar", "Por comprar"], ["comprado", "Comprado"], ["transito", "En camino"], ["recibido", "Recibido"], ["instalado", "Instalado"], ["todos", "Todos"]]} />
      {vista.length === 0 && (
        <Empty>
          <p className="font-medium text-foreground">{items.length === 0 ? "Todavía no hay nada que comprar" : "Nada en este filtro"}</p>
          <p className="mt-1">Aquí aparece cada concepto con presupuesto, link o estatus de compra. Abre un concepto en Obra, pega el link de la tienda o cotización, pon la fecha estimada de llegada y ve avanzando su estatus.</p>
          {items.length === 0 && <Button asChild size="sm" variant="outline" className="mt-3"><Link to="../obra" relative="path">Ir a Obra</Link></Button>}
        </Empty>
      )}
      {vista.map((c) => {
        const sig = SIGUIENTE[c.logistica];
        const tarde = !!c.eta && c.eta < hoy && !["recibido", "instalado"].includes(c.logistica);
        return (
          <Card key={c.id}>
            <CardContent className="pt-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => abrir({ tipo: "concepto", d: conceptoForm(c) })}>
                  <div className="font-medium truncate">{c.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.partidaNombre}{nombreProv(c.proveedorId) ? ` · ${nombreProv(c.proveedorId)}` : ""}</div>
                </button>
                <LogBadge l={c.logistica} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground num">
                <span>{c.total ? fm(c.total) : "Sin presupuesto"}{c.total > 0 ? ` · pagado ${c.pctPagado}%` : ""}</span>
                {c.eta && <span className={tarde ? "text-bad font-medium" : ""}>{tarde ? "Debió llegar " : "Llega "}{fecha(c.eta)}</span>}
              </div>
              {c.pedido && <div className="text-xs text-muted-foreground num">Pedido / guía: {c.pedido}</div>}
              {c.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.links.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-md bg-info-bg text-info px-2 py-1 text-xs font-semibold max-w-full truncate"><ExternalLink className="size-3 shrink-0" />{l.titulo || hostDe(l.url)}</a>)}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                {sig && <Button size="sm" onClick={() => accion(() => api.setLogistica(c.id, sig), `Marcado como ${LOG[sig].toLowerCase()}`)}>Marcar {LOG[sig].toLowerCase()}</Button>}
                <Button size="sm" variant="outline" onClick={() => abrir({ tipo: "concepto", d: conceptoForm(c) })}>{c.links.length ? "Editar" : "+ Link"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
