import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { FLUJO, LOG, PRIO, type EstadoPago, type FormaPago, type Logistica, type Prioridad } from "@/lib/types";

const TONO_PRIO: Record<Prioridad, BadgeVariant> = { indispensable: "bad", flexible: "warn", opcional: "info", exhibicion: "purple", sinClasificar: "neutral" };
const TONO_LOG: Record<Logistica, BadgeVariant> = { porComprar: "neutral", cotizado: "info", comprado: "warn", transito: "warn", recibido: "ok", instalado: "ok" };
const TONO_FLUJO: Record<EstadoPago, BadgeVariant> = { solicitado: "warn", autorizado: "info", pagado: "ok" };

export const PrioBadge = ({ p, corto }: { p: Prioridad; corto?: boolean }) => p && p !== "sinClasificar" ? <Badge variant={TONO_PRIO[p]}>{corto ? PRIO[p].slice(0, 4) : PRIO[p]}</Badge> : null;
export const LogBadge = ({ l }: { l: Logistica }) => <Badge variant={TONO_LOG[l || "porComprar"]}>{LOG[l || "porComprar"]}</Badge>;
export const FlujoBadge = ({ e }: { e: EstadoPago }) => <Badge variant={TONO_FLUJO[e]}>{FLUJO[e]}</Badge>;
export const FormaBadge = ({ f }: { f: FormaPago }) => <Badge variant={f === "Efectivo" ? "ok" : "info"}>{f}</Badge>;
export const Dot = ({ estado }: { estado: string }) => (
  <span className={"size-2 shrink-0 " + (estado === "cerrado" ? "bg-ok" : estado === "porCerrar" ? "bg-warn" : "bg-border-2")} title={estado === "cerrado" ? "Presupuesto cerrado" : estado === "porCerrar" ? "Próximo a cerrar" : "Faltan presupuestos"} />
);
