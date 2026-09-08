import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api";
import { ProyectoContext, useCtxValue } from "@/hooks/useProyecto";
import { ModalProvider } from "@/hooks/useModal";
import Reporte from "@/pages/proyecto/Reporte";

/** /r/:token — el reporte para el cliente, sin sesión. */
export default function ReportePublico() {
  const { token = "" } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["publico", token], queryFn: () => api.reportePublico(token), staleTime: 60_000 });
  const soloLectura = useMemo(() => async () => false, []);
  const ctx = useCtxValue(data?.proyecto, soloLectura);
  if (isLoading) return <div className="min-h-dvh flex items-center justify-center anno">Cargando reporte…</div>;
  if (error || !data || !ctx) return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-2">
        <div className="anno">Reporte no disponible</div>
        <p className="text-[14px] text-ink-2">La liga no existe o fue desactivada. Pide una nueva a tu arquitecta.</p>
      </div>
    </div>
  );
  return (
    <ProyectoContext.Provider value={ctx}>
      <ModalProvider>
        <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-10 md:py-10" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
          <Reporte publico perfilPublico={data.perfil} />
        </main>
      </ModalProvider>
    </ProyectoContext.Provider>
  );
}
