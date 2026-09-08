import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/api";
import { calcular, type Calculo } from "@/lib/calculos";
import type { Proyecto } from "@/lib/types";

export const proyectoKey = (id: string) => ["proyecto", id] as const;

export function useProyectoQuery(id: string) {
  return useQuery({ queryKey: proyectoKey(id), queryFn: () => api.cargar(id), staleTime: 30_000 });
}

/** Ejecuta una escritura, recarga el proyecto y avisa si falla. */
export function useAccion(proyectoId: string) {
  const qc = useQueryClient();
  return useCallback(async (fn: () => PromiseLike<unknown>, mensaje?: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: proyectoKey(proyectoId) });
      if (mensaje) toast.success(mensaje);
      return true;
    } catch (e) {
      toast.error("No se guardó", { description: e instanceof Error ? e.message : String(e) });
      return false;
    }
  }, [qc, proyectoId]);
}

// Contexto del proyecto abierto: datos, cálculo y helpers, disponibles en todas las vistas y modales.
export interface Ctx {
  p: Proyecto; calc: Calculo;
  accion: ReturnType<typeof useAccion>;
  nombreProv: (id: string) => string;
  conceptoDe: (id: string) => Calculo["conceptos"][number] | undefined;
  nextRel: () => number;
}
export const ProyectoContext = createContext<Ctx | null>(null);
export const useProyecto = () => {
  const c = useContext(ProyectoContext);
  if (!c) throw new Error("useProyecto fuera de ProyectoContext");
  return c;
};

export function useCtxValue(p: Proyecto | undefined, accion: ReturnType<typeof useAccion>): Ctx | null {
  return useMemo(() => {
    if (!p) return null;
    const calc = calcular(p);
    const provs = new Map(p.proveedores.map((v) => [v.id, v.nombre]));
    const cons = new Map(calc.conceptos.map((c) => [c.id, c]));
    return {
      p, calc, accion,
      nombreProv: (id) => provs.get(id) || "",
      conceptoDe: (id) => cons.get(id),
      nextRel: () => (p.relaciones.length ? Math.max(...p.relaciones.map((r) => r.n)) + 1 : 1),
    };
  }, [p, accion]);
}
