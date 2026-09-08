import { createContext, useContext, useState, type ReactNode } from "react";
import type { Concepto, Excedente, Pago, Proveedor } from "@/lib/types";
import type { ConceptoForm, PagoForm } from "@/api";

// Un solo lugar abre los diálogos del proyecto, desde cualquier vista.
export type Modal =
  | { tipo: "concepto"; d: ConceptoForm }
  | { tipo: "partida"; d: { id?: string; nombre: string; candado: number; contingencia?: boolean } }
  | { tipo: "traspaso"; d: { deId: string; aId: string; monto: number; fecha: string; motivo: string } }
  | { tipo: "pago"; d: Partial<PagoForm> }
  | { tipo: "rel"; d: { nOriginal?: number; n: number; fecha: string; fechaLimite: string } }
  | { tipo: "exc"; d: Partial<Excedente> }
  | { tipo: "prov"; d: Partial<Proveedor>; onSave?: (id: string) => void }
  | { tipo: "guia"; seccion?: string }
  | null;

const ModalContext = createContext<{ modal: Modal; abrir: (m: Modal) => void; cerrar: () => void } | null>(null);
export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<Modal>(null);
  return <ModalContext.Provider value={{ modal, abrir: setModal, cerrar: () => setModal(null) }}>{children}</ModalContext.Provider>;
}
export const useModal = () => {
  const c = useContext(ModalContext);
  if (!c) throw new Error("useModal fuera de ModalProvider");
  return c;
};

export const conceptoNuevo = (partidaId: string): ConceptoForm => ({
  partidaId, nombre: "", proveedorId: "", presupuesto: 0, iva: 0, base: { presupuesto: 0, iva: 0 }, ajustes: [],
  cantidad: 1, unidad: "", precioUnitario: 0, avance: 0,
  estado: "pendiente", prioridad: "sinClasificar", logistica: "porComprar", pedido: "", eta: "", nota: "", links: [],
});
export const conceptoForm = (c: Concepto): ConceptoForm => ({ ...c });
export const pagoDesde = (x: Pago): Partial<PagoForm> => ({ ...x });
