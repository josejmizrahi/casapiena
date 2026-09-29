import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/api";
import { useSesion } from "@/hooks/useSesion";
import { aMano, saldos } from "@/lib/gastos";

export const gastosKey = (id: string) => ["gastos", id] as const;

/** Gastos compartidos del proyecto, saldos y nombres. Van en su propia consulta, aparte de la obra. */
export function useGastos(proyectoId: string) {
  const qc = useQueryClient();
  const yo = useSesion()?.user.id || "";
  const q = useQuery({ queryKey: gastosKey(proyectoId), queryFn: () => api.cargarGastos(proyectoId), staleTime: 30_000 });
  const derivado = useMemo(() => {
    const g = q.data;
    const personas = new Map((g?.participantes || []).map((x) => [x.userId, x]));
    const nombre = (id: string) => {
      if (id === yo) return "Tú";
      const x = personas.get(id);
      return x ? x.nombre || x.email.split("@")[0] || "Sin nombre" : "Ex miembro";
    };
    const s = g ? saldos(g) : [];
    return { nombre, saldos: s, transferencias: aMano(s), activos: (g?.participantes || []).filter((x) => x.activo) };
  }, [q.data, yo]);

  const accion = useCallback(async (fn: () => PromiseLike<unknown>, mensaje?: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: gastosKey(proyectoId) });
      if (mensaje) toast.success(mensaje);
      return true;
    } catch (e) {
      toast.error("No se guardó", { description: e instanceof Error ? e.message : String(e) });
      return false;
    }
  }, [qc, proyectoId]);

  return { ...q, ...derivado, yo, accion };
}
