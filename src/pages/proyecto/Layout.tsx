import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, CreditCard, FileText, Hammer, Settings, ShoppingCart, Users, Plus } from "lucide-react";
import { ProyectoContext, useAccion, useCtxValue, useProyecto, useProyectoQuery } from "@/hooks/useProyecto";
import { ModalProvider, useModal } from "@/hooks/useModal";
import { cn, fm, pct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StackedBar } from "@/components/ui/progress";
import { Modales } from "@/modals";

const NAV = [
  ["obra", "Obra", Hammer], ["compras", "Compras", ShoppingCart], ["pagos", "Pagos", CreditCard], ["relaciones", "Relaciones", FileText],
  ["resumen", "Resumen", BarChart3], ["proveedores", "Proveedores", Users], ["ajustes", "Ajustes", Settings],
] as const;
const MOVIL = new Set(["obra", "compras", "pagos", "relaciones", "resumen"]);

export default function ProyectoLayout() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useProyectoQuery(id);
  const accion = useAccion(id);
  const ctx = useCtxValue(data, accion);

  if (isLoading) return <Pantalla>Cargando proyecto…</Pantalla>;
  if (error || !ctx) return (
    <Pantalla>
      <p className="text-bad">{error ? (error as Error).message : "No se encontró el proyecto."}</p>
      <Button asChild variant="outline"><Link to="/"><ArrowLeft />Mis proyectos</Link></Button>
    </Pantalla>
  );
  return (
    <ProyectoContext.Provider value={ctx}>
      <ModalProvider>
        <Shell />
        <Modales />
      </ModalProvider>
    </ProyectoContext.Provider>
  );
}

const Pantalla = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">{children}</div>
);

function Shell() {
  const { p, calc } = useProyecto();
  const { abrir } = useModal();
  const avance = pct(calc.pagadoTotal, calc.granTotal);
  return (
    <div className="min-h-dvh md:flex">
      {/* barra lateral en escritorio */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-card md:sticky md:top-0 md:h-dvh">
        <div className="p-4 border-b border-border">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-3.5" />Mis proyectos</Link>
          <h1 className="font-semibold leading-tight mt-1 truncate" title={p.meta.nombre}>{p.meta.nombre}</h1>
          <p className="text-xs text-muted-foreground truncate">{p.meta.clientes || "Sin clientes capturados"}</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map(([k, v, Icon]) => (
            <NavLink key={k} to={k} className={({ isActive }) => cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4" />{v}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-border space-y-2">
          <div className="text-[11px] text-muted-foreground">Gran total</div>
          <div className="font-semibold num">{fm(calc.granTotal)}</div>
          <StackedBar pagado={avance} tramite={pct(calc.porPagarObra, calc.granTotal)} />
          <div className="flex justify-between text-[11px] text-muted-foreground num"><span>Pagado {avance}%</span><span>{fm(calc.porPagarObra)} en trámite</span></div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* encabezado en móvil */}
        <header className="md:hidden sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground -ml-1 p-1" aria-label="Mis proyectos"><ArrowLeft className="size-5" /></Link>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold leading-tight truncate">{p.meta.nombre}</h1>
              <p className="text-[11px] text-muted-foreground num truncate">Pagado {avance}% de {fm(calc.granTotal)}{calc.porPagarObra > 0 ? ` · ${fm(calc.porPagarObra)} en trámite` : ""}</p>
            </div>
            <NavLink to="proveedores" className={({ isActive }) => cn("p-2 rounded-md", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground")} aria-label="Proveedores"><Users className="size-5" /></NavLink>
            <NavLink to="ajustes" className={({ isActive }) => cn("p-2 rounded-md", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground")} aria-label="Ajustes"><Settings className="size-5" /></NavLink>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 pb-28 md:pb-10 md:px-8 md:py-6 space-y-3">
          <Outlet />
        </main>

        {/* botón flotante: registrar pago desde cualquier vista */}
        <Button className="fixed right-4 bottom-20 md:bottom-6 md:right-8 z-30 rounded-full shadow-lg h-12 px-5" onClick={() => abrir({ tipo: "pago", d: {} })}><Plus />Pago</Button>

        {/* pestañas inferiores en móvil */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.filter(([k]) => MOVIL.has(k)).map(([k, v, Icon]) => (
            <NavLink key={k} to={k} className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />{v}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

