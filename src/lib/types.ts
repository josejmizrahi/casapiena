// Tipos de dominio: la forma en que la interfaz ve un proyecto (no la de la base).

export type EstadoPresupuesto = "pendiente" | "porCerrar" | "cerrado";
export type EstadoPago = "solicitado" | "autorizado" | "pagado";
export type Logistica = "porComprar" | "cotizado" | "comprado" | "transito" | "recibido" | "instalado";
export type Prioridad = "indispensable" | "flexible" | "opcional" | "exhibicion" | "sinClasificar";
export type FormaPago = "Transferencia" | "Efectivo";
export type TipoPago = "obra" | "honorarios";

export interface Link { id: string; titulo: string; url: string }
export interface Ajuste { id: string; fecha: string; anterior: number; nuevo: number; motivo: string }

export interface Concepto {
  id: string; partidaId: string; nombre: string; proveedorId: string;
  /** Total sin IVA. Si hay precio unitario, es cantidad × precioUnitario. */
  presupuesto: number; iva: number; base: { presupuesto: number; iva: number };
  cantidad: number; unidad: string; precioUnitario: number;
  /** Avance físico real, 0 a 100. */
  avance: number;
  estado: EstadoPresupuesto; prioridad: Prioridad; logistica: Logistica;
  pedido: string; eta: string; nota: string; links: Link[]; ajustes: Ajuste[];
}
export interface Partida { id: string; nombre: string; candado: number; orden: number; contingencia: boolean; conceptos: Concepto[] }
export interface Proveedor { id: string; nombre: string; razon: string; banco: string; clabe: string; tel: string; nota: string }
export interface Relacion { id: string; n: number; fecha: string; fechaLimite: string }
export interface Pago {
  id: string; tipo: TipoPago; conceptoId: string; proveedorId: string; rel: number; relacionId: string | null;
  monto: number; fecha: string; forma: FormaPago; status: string; estado: EstadoPago;
  deExcedente: boolean; nota: string; fase: string;
}
export interface Excedente { id: string; concepto: string; monto: number; fecha: string }
export interface Traspaso { id: string; deId: string; aId: string; monto: number; fecha: string; motivo: string }
export interface Meta {
  nombre: string; clientes: string; presupuestoObra: number; pctHonorarios: number;
  direccionEfectivo: string; contactoEfectivo: string; instruccionesEfectivo: string;
}
export interface Proyecto {
  id: string; meta: Meta; proveedores: Proveedor[]; partidas: Partida[]; relaciones: Relacion[];
  pagos: Pago[]; excedentes: Excedente[]; traspasos: Traspaso[];
}
export interface ProyectoResumen {
  id: string; nombre: string; clientes: string; archivado: boolean; created_at: string;
  presupuesto_obra: number; owner_id: string;
}
export interface Miembro { user_id: string | null; email: string; rol: "propietario" | "editor" | "lector"; pendiente: boolean }

// Etiquetas y órdenes de los catálogos
export const ESTADOS: Record<EstadoPresupuesto, string> = { pendiente: "Faltan presupuestos", porCerrar: "Próximo a cerrar", cerrado: "Cerrado" };
export const FLUJO: Record<EstadoPago, string> = { solicitado: "Solicitado", autorizado: "Autorizado", pagado: "Pagado" };
export const LOG: Record<Logistica, string> = { porComprar: "Por comprar", cotizado: "Cotizado", comprado: "Comprado", transito: "En camino", recibido: "Recibido", instalado: "Instalado" };
export const LOG_ORDEN: Logistica[] = ["porComprar", "cotizado", "comprado", "transito", "recibido", "instalado"];
export const SIGUIENTE: Partial<Record<Logistica, Logistica>> = { porComprar: "comprado", cotizado: "comprado", comprado: "transito", transito: "recibido", recibido: "instalado" };
export const PRIO: Record<Prioridad, string> = { indispensable: "Indispensable", flexible: "Flexible", opcional: "Opcional", exhibicion: "Exhibición", sinClasificar: "Sin clasificar" };
export const PRIO_ORDEN: Prioridad[] = ["indispensable", "flexible", "opcional", "exhibicion", "sinClasificar"];
export const STATUS_PAGO = ["Anticipo", "Parcialidad", "Finiquito", "Liquidación", "Único"];
export const UNIDADES = ["pza", "m²", "ml", "m³", "kg", "lote", "juego", "servicio", "hr", "global"];
/** Diferencia en puntos entre % pagado y % de avance físico a partir de la cual se avisa. */
export const DESFASE_AVISO = 25;

// ── fase 3 ──
export interface Adjunto { id: string; proyectoId: string; conceptoId: string | null; pagoId: string | null; nombre: string; ruta: string; tipo: string; tamano: number; createdAt: string }
export interface CatalogoProveedor { id: string; nombre: string; razon: string; banco: string; clabe: string; tel: string; nota: string }
export interface PlantillaPartida { nombre: string; pct: number; contingencia?: boolean; conceptos?: { nombre: string; unidad?: string; prioridad?: Prioridad }[] }
export interface PlantillaGuardada { id: string; nombre: string; descripcion: string; cuerpo: PlantillaPartida[]; created_at: string }
