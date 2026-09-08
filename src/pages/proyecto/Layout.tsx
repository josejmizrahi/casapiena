import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, ClipboardList, CreditCard, FileText, Hammer, Home, MoreHorizontal, Settings, ShoppingCart, Users, Plus } from "lucide-react";
import { ProyectoContext, useAccion, useCtxValue, useProyecto, useProyectoQuery } from "@/hooks/useProyecto";
import { ModalProvider, useModal } from "@/hooks/useModal";
import { cn, fm, pct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StackedBar } from "@/components/ui/progress";
import { Modales } from "@/modals";
import { Semaforo } from "./Hoy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/misc";

const NAV = [
  ["hoy", "Hoy", Home], ["obra", "Obra", Hammer], ["compras", "Compras", ShoppingCart], ["pagos", "Pagos", CreditCard], ["relaciones", "Relaciones", FileText],
  ["resumen", "Resumen", BarChart3], ["reporte", "Reporte", ClipboardList], ["proveedores", "Proveedores", Users], ["ajustes", "Ajustes", Settings],
] as const;
const MOVIL = new Set(["hoy", "obra", "compras", "pagos"]);

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
  <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-sm text-ink-3">{children}</div>
);

function Shell() {
  const { p, calc } = useProyecto();
  const { abrir } = useModal();
  const avance = pct(calc.pagadoTotal, calc.granTotal);
  return (
    <div className="min-h-dvh md:flex">
      {/* barra lateral en escritorio */}
      <aside className="no-print hidden md:flex md:w-56 md:flex-col md:border-r md:border-border-2 md:sticky md:top-0 md:h-dvh">
        <div className="px-5 pt-5 pb-4">
          <Link to="/" className="anno hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-3" />Proyectos</Link>
          <h1 className="text-[17px] font-semibold leading-tight mt-3 truncate" title={p.meta.nombre}>{p.meta.nombre}</h1>
          <p className="text-[12.5px] text-ink-2 truncate mt-0.5">{p.meta.clientes || "Sin clientes"}</p>
          <div className="mt-3"><Semaforo nivel={calc.salud.nivel} etiqueta /></div>
        </div>
        <nav className="px-3 border-t border-border pt-2">
          {NAV.map(([k, v, Icon]) => (
            <NavLink key={k} to={k} className={({ isActive }) => cn("flex items-center gap-3 px-2 py-2 text-[14px] border-l-2 -ml-px", isActive ? "border-foreground text-foreground font-medium" : "border-transparent text-ink-2 hover:text-foreground")}>
              <Icon className="size-4 stroke-[1.5]" />{v}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 border-t border-border space-y-2">
          <div className="anno">Gran total</div>
          <div className="text-[19px] font-semibold fig">{fm(calc.granTotal)}</div>
          <StackedBar pagado={avance} tramite={pct(calc.porPagarObra, calc.granTotal)} />
          <div className="flex justify-between text-[11px] text-ink-3 num"><span>Pagado {avance}%</span><span>{fm(calc.porPagarObra)} en trámite</span></div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* encabezado en móvil */}
        <header className="no-print md:hidden sticky top-0 z-20 border-b border-border-2 bg-background/95 backdrop-blur px-4 pt-2 pb-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2 min-h-11">
            <Link to="/" className="text-ink-2 -ml-2 p-2" aria-label="Mis proyectos"><ArrowLeft className="size-5 stroke-[1.75]" /></Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-semibold leading-tight truncate">{p.meta.nombre}</h1>
              <p className="anno truncate normal-case tracking-[0.04em]">Pagado {avance}% · {fm(calc.granTotal)}</p>
            </div>
            <Semaforo nivel={calc.salud.nivel} etiqueta />
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-4 pb-32 md:pb-12 md:px-10 md:pt-8 space-y-6">
          <Outlet />
        </main>

        {/* botón flotante: registrar pago desde cualquier vista */}
        <Button className="no-print fixed right-4 z-30 h-13 rounded-full px-6 shadow-[0_6px_20px_-8px_rgba(23,23,22,.5)] md:bottom-8 md:right-10" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }} onClick={() => abrir({ tipo: "pago", d: {} })}><Plus />Pago</Button>

        {/* pestañas inferiores en móvil */}
        <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border-2 bg-panel/95 backdrop-blur grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.filter(([k]) => MOVIL.has(k)).map(([k, v, Icon]) => (
            <NavLink key={k} to={k} className={({ isActive }) => cn("flex flex-col items-center justify-center gap-1 h-14 font-mono uppercase text-[9px] tracking-[0.08em]", isActive ? "text-foreground" : "text-ink-3")}>
              {({ isActive }) => <><Icon className={cn("size-[22px]", isActive ? "stroke-[2]" : "stroke-[1.5]")} />{v}</>}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center justify-center gap-1 h-14 font-mono uppercase text-[9px] tracking-[0.08em] text-ink-3 data-[state=open]:text-foreground" aria-label="Más"><MoreHorizontal className="size-[22px] stroke-[1.5]" />Más</DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8} className="mb-1">
              {NAV.filter(([k]) => !MOVIL.has(k)).map(([k, v, Icon]) => (
                <DropdownMenuItem key={k} asChild><NavLink to={k}><Icon />{v}</NavLink></DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </div>
  );
}

