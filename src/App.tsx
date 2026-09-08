import { Component, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useSesion } from "@/hooks/useSesion";
import { TooltipProvider } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import Login from "@/pages/Login";
import Proyectos from "@/pages/Proyectos";
import ProyectoLayout from "@/pages/proyecto/Layout";
import Hoy from "@/pages/proyecto/Hoy";
import Obra from "@/pages/proyecto/Obra";
import Compras from "@/pages/proyecto/Compras";
import Pagos from "@/pages/proyecto/Pagos";
import Relaciones from "@/pages/proyecto/Relaciones";
import Resumen from "@/pages/proyecto/Resumen";
import Proveedores from "@/pages/proyecto/Proveedores";
import Ajustes from "@/pages/proyecto/Ajustes";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

// Si una vista truena, muestra el error en vez de dejar la pantalla en blanco.
class Guardia extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) { console.error("Error de interfaz:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-md border border-border bg-card p-6 space-y-3">
          <h1 className="text-lg font-semibold">Algo falló</h1>
          <p className="text-sm text-ink-3">La pantalla no se pudo mostrar. Recarga la página; si sigue igual, comparte este mensaje:</p>
          <pre className="text-xs whitespace-pre-wrap rounded-md bg-muted p-3">{this.state.error.message}</pre>
          <Button className="w-full" onClick={() => { location.hash = "#/"; location.reload(); }}>Volver a mis proyectos</Button>
        </div>
      </div>
    );
  }
}

function Rutas() {
  const sesion = useSesion();
  if (sesion === undefined) return <div className="min-h-dvh flex items-center justify-center text-sm text-ink-3">Cargando…</div>;
  if (!sesion) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Proyectos />} />
      <Route path="/p/:id" element={<ProyectoLayout />}>
        <Route index element={<Navigate to="hoy" replace />} />
        <Route path="hoy" element={<Hoy />} />
        <Route path="obra" element={<Obra />} />
        <Route path="compras" element={<Compras />} />
        <Route path="pagos" element={<Pagos />} />
        <Route path="relaciones" element={<Relaciones />} />
        <Route path="resumen" element={<Resumen />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="ajustes" element={<Ajustes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={300}>
        <HashRouter>
          <Guardia><Rutas /></Guardia>
        </HashRouter>
      </TooltipProvider>
      <Toaster position="bottom-center" richColors closeButton />
    </QueryClientProvider>
  );
}
