import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Link2Off, Printer } from "lucide-react";
import * as api from "@/api";
import type { Perfil } from "@/lib/types";
import { useProyecto } from "@/hooks/useProyecto";
import { useSesion } from "@/hooks/useSesion";
import { usePerfil } from "@/components/PerfilDialog";
import { FLUJO, LOG } from "@/lib/types";
import { HOY, fecha, fm, pct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StackedBar } from "@/components/ui/progress";
import { Semaforo } from "./Hoy";

/** Reporte para el cliente: una página imprimible (Guardar como PDF desde el navegador).
 *  Con `publico` se muestra desde la liga compartida: sin sesión, sin botones de edición. */
export default function Reporte({ publico, perfilPublico }: { publico?: boolean; perfilPublico?: Perfil } = {}) {
  const { p, calc, nombreProv, conceptoDe } = useProyecto();
  const sesion = useSesion();
  const { data: perfilMio } = usePerfil();
  const perfil = perfilPublico || perfilMio;
  const firma = perfil?.nombre || perfil?.despacho ? [perfil?.nombre, perfil?.despacho].filter(Boolean).join(" · ") : sesion?.user.email || "";
  const hoy = HOY();
  const avance = pct(calc.pagadoTotal, calc.granTotal);
  const pendientes = p.pagos.filter((x) => x.estado !== "pagado").sort((a, b) => a.rel - b.rel || (a.fecha || "").localeCompare(b.fecha || ""));
  const relLim = new Map(p.relaciones.map((r) => [r.n, r.fechaLimite || r.fecha]));
  const vencidas = calc.conceptos.filter((c) => c.eta && c.eta < hoy && !["recibido", "instalado"].includes(c.logistica));
  const enCamino = calc.conceptos.filter((c) => ["comprado", "transito"].includes(c.logistica));
  const imprimir = () => { document.body.classList.add("reporte-print"); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("reporte-print"), 500); }, 50); };
  const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="border-t border-border-2 pt-3 break-inside-avoid"><div className="anno mb-2">{t}</div>{children}</section>;
  const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => <th className={"anno font-normal pb-1.5 " + (r ? "text-right pl-2" : "text-left")}>{children}</th>;
  const Td = ({ children, r, className = "" }: { children: React.ReactNode; r?: boolean; className?: string }) => <td className={"py-1.5 text-[13px] num " + (r ? "text-right pl-2 whitespace-nowrap " : "") + className}>{children}</td>;

  return (
    <div className="reporte space-y-6">
      <div className="flex items-start justify-between gap-3 no-print">
        <p className="text-[13px] text-ink-2">{publico ? "Reporte de obra compartido por tu arquitecta." : "Resumen de la obra para el cliente. Usa “Imprimir” y elige “Guardar como PDF”."}</p>
        <Button size="sm" onClick={imprimir}><Printer />Imprimir</Button>
      </div>
      {!publico && <Compartir />}

      <header className="border-t-2 border-foreground pt-3">
        <div className="flex justify-between gap-3 anno"><span>Reporte de obra</span><span>{fecha(hoy)}</span></div>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div className="min-w-0">
            <h1 className="text-[28px] md:text-[34px] font-semibold leading-tight fig">{p.meta.nombre}</h1>
            <div className="text-[14px] text-ink-2 mt-1">{p.meta.clientes || "—"}{firma ? ` · preparado por ${firma}` : ""}{perfil?.telefono ? ` · ${perfil.telefono}` : ""}</div>
          </div>
          {perfil?.logoUrl && <img src={perfil.logoUrl} alt={perfil.despacho || "Logo"} className="h-12 md:h-14 max-w-[140px] object-contain shrink-0" />}
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 border-y border-border-2 py-3">
        {[["Presupuesto general", fm(p.meta.presupuestoObra)], ["Comprometido", fm(calc.totalObra)], ["Pagado", `${fm(calc.pagadoTotal)} · ${avance}%`], ["Gran total con honorarios", fm(calc.granTotal)]].map(([k, v]) => (
          <div key={k}><div className="anno">{k}</div><div className="text-[18px] font-semibold fig mt-1">{v}</div></div>
        ))}
      </section>
      <div>
        <div className="flex justify-between text-[12px] text-ink-2 num mb-1.5"><span>Pagado {avance}%</span><span>En trámite {fm(calc.porPagarObra)}</span></div>
        <StackedBar pagado={avance} tramite={pct(calc.porPagarObra, calc.granTotal)} />
        <div className="mt-2 flex items-center gap-4 text-[12px] text-ink-2"><Semaforo nivel={calc.salud.nivel} etiqueta />{calc.conAvance && <span className="num">Avance físico {calc.avanceFisicoObra}%</span>}{calc.comparativaGlobal < 0 && p.meta.presupuestoObra > 0 && <span className="text-bad">Sobre el presupuesto por {fm(-calc.comparativaGlobal)}</span>}</div>
      </div>

      <Sec t="Partidas">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0"><table className="w-full min-w-[560px]">
          <thead><tr><Th>Partida</Th><Th r>Candado</Th><Th r>Comprometido</Th><Th r>Pagado</Th>{calc.conAvance && <Th r>Hecho</Th>}<Th r>vs base</Th></tr></thead>
          <tbody>
            {calc.partidas.map((x) => (
              <tr key={x.id} className="border-t border-border">
                <Td><span className="inline-flex items-center gap-2"><Semaforo nivel={x.nivel} />{x.nombre}{x.contingencia ? <span className="anno">reserva</span> : null}</span></Td>
                <Td r className="text-ink-3">{x.candadoEf ? fm(x.candadoEf) : "—"}</Td>
                <Td r>{fm(x.comprometido)}</Td>
                <Td r>{fm(x.pagado)} <span className="text-ink-3">{x.comprometido ? `${x.avance}%` : ""}</span></Td>
                {calc.conAvance && <Td r>{x.conAvance ? `${x.avanceFisico}%` : "—"}</Td>}
                <Td r className={x.desviacion > 0.005 ? "text-bad" : x.desviacion < -0.005 ? "text-ok" : "text-ink-3"}>{Math.abs(x.desviacion) > 0.005 ? `${x.desviacion > 0 ? "+" : ""}${fm(x.desviacion)}` : "—"}</Td>
              </tr>
            ))}
            <tr className="border-t border-border-2 font-semibold">
              <Td>Obra</Td><Td r>{fm(calc.totalCandados)}</Td><Td r>{fm(calc.totalObra)}</Td><Td r>{fm(calc.pagadoObra)} <span className="text-ink-3 font-normal">{pct(calc.pagadoObra, calc.totalObra)}%</span></Td>{calc.conAvance && <Td r>{calc.avanceFisicoObra}%</Td>}<Td r className={calc.desviacionObra > 0 ? "text-bad" : "text-ok"}>{Math.abs(calc.desviacionObra) > 0.005 ? `${calc.desviacionObra > 0 ? "+" : ""}${fm(calc.desviacionObra)}` : "—"}</Td>
            </tr>
          </tbody>
        </table></div>
      </Sec>

      {calc.contingencia.hay && (
        <Sec t="Reserva de imprevistos">
          <div className="grid grid-cols-3 gap-3 text-[13px] num">
            <div><div className="anno">Original</div><div className="mt-1">{fm(calc.contingencia.candadoOriginal)}</div></div>
            <div><div className="anno">Usada</div><div className="mt-1">{fm(calc.contingencia.usada + calc.contingencia.comprometidoDentro)}</div></div>
            <div><div className="anno">Disponible</div><div className={"mt-1 font-semibold " + (calc.contingencia.disponible < 0 ? "text-bad" : "")}>{fm(calc.contingencia.disponible)}</div></div>
          </div>
        </Sec>
      )}

      <Sec t="Pagos pendientes">
        {pendientes.length === 0 ? <p className="text-[13px] text-ink-2">No hay pagos solicitados ni autorizados.</p> : (
          <table className="w-full">
            <thead><tr><Th>Concepto</Th><Th>Estado</Th><Th r>Límite</Th><Th r>Monto</Th></tr></thead>
            <tbody>
              {pendientes.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <Td><span className="block truncate max-w-[12rem]">{x.tipo === "honorarios" ? `Honorarios · ${x.fase}` : conceptoDe(x.conceptoId)?.nombre || "—"}</span><span className="block text-[11.5px] text-ink-3">Rel {x.rel}{nombreProv(x.proveedorId) ? ` · ${nombreProv(x.proveedorId)}` : ""}</span></Td>
                  <Td>{FLUJO[x.estado]}</Td>
                  <Td r className="text-ink-3">{fecha(relLim.get(x.rel) || "")}</Td>
                  <Td r>{fm(x.monto)}</Td>
                </tr>
              ))}
              <tr className="border-t border-border-2 font-semibold"><Td>Total pendiente</Td><Td>{""}</Td><Td r>{""}</Td><Td r>{fm(pendientes.reduce((s, x) => s + x.monto, 0))}</Td></tr>
            </tbody>
          </table>
        )}
      </Sec>

      {(vencidas.length > 0 || enCamino.length > 0) && (
        <Sec t="Compras y entregas">
          {vencidas.length > 0 && <p className="text-[13px] mb-2"><span className="text-bad font-medium">{vencidas.length} con entrega vencida:</span> {vencidas.map((c) => `${c.nombre} (${fecha(c.eta)})`).join(", ")}</p>}
          {enCamino.length > 0 && <p className="text-[13px]"><span className="font-medium">En camino:</span> {enCamino.map((c) => `${c.nombre}${c.eta ? ` (${LOG[c.logistica].toLowerCase()}, llega ${fecha(c.eta)})` : ""}`).join(", ")}</p>}
        </Sec>
      )}

      {calc.conceptos.some((c) => c.ajustes.length) && (
        <Sec t="Cambios de presupuesto">
          <table className="w-full">
            <thead><tr><Th>Concepto</Th><Th>Motivo</Th><Th r>Cambio</Th></tr></thead>
            <tbody>
              {calc.conceptos.flatMap((c) => c.ajustes.map((a) => ({ c, a }))).sort((x, y) => y.a.fecha.localeCompare(x.a.fecha)).slice(0, 15).map(({ c, a }) => (
                <tr key={a.id} className="border-t border-border"><Td><span className="block truncate max-w-[10rem]">{c.nombre}</span><span className="block text-[11.5px] text-ink-3">{fecha(a.fecha)}</span></Td><Td className="text-ink-2">{a.motivo || "—"}</Td><Td r className={a.nuevo > a.anterior ? "text-bad" : "text-ok"}>{a.nuevo > a.anterior ? "+" : ""}{fm(a.nuevo - a.anterior)}</Td></tr>
              ))}
            </tbody>
          </table>
        </Sec>
      )}

      <footer className="border-t border-border pt-3 anno">Generado con Control de obra · {fecha(hoy)}</footer>
    </div>
  );
}

/** Liga pública de solo lectura del reporte. */
function Compartir() {
  const { p } = useProyecto();
  const qc = useQueryClient();
  const { data: token } = useQuery({ queryKey: ["liga", p.id], queryFn: () => api.ligaReporte(p.id) });
  const [cargando, setCargando] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(token ? `${location.origin}${location.pathname}#/r/${token}` : ""); }, [token]);
  const refrescar = () => qc.invalidateQueries({ queryKey: ["liga", p.id] });
  const crear = async () => {
    setCargando(true);
    try { await api.crearLigaReporte(p.id); refrescar(); toast.success("Liga creada"); }
    catch (e) { toast.error("No se pudo crear", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCargando(false); }
  };
  const desactivar = async () => {
    if (!confirm("¿Desactivar la liga? Quien la tenga dejará de ver el reporte.")) return;
    try { await api.desactivarLigaReporte(p.id); refrescar(); toast.success("Liga desactivada"); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast.success("Liga copiada"); } catch { toast.error("No se pudo copiar"); } };
  return (
    <section className="no-print border-t border-border-2 pt-3">
      <div className="anno mb-2">Compartir con el cliente</div>
      {url ? (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-2">Quien tenga esta liga ve el reporte actualizado, sin cuenta y sin poder editar. No incluye datos bancarios ni archivos.</p>
          <div className="flex gap-2">
            <Input readOnly value={url} className="flex-1 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={copiar}><Copy />Copiar</Button>
          </div>
          <Button size="sm" variant="ghost" className="text-bad" onClick={desactivar}><Link2Off />Desactivar liga</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-2">Genera una liga de solo lectura para que el cliente consulte el reporte desde su teléfono, sin cuenta.</p>
          <Button size="sm" variant="outline" disabled={cargando} onClick={crear}><Link2 />Crear liga para el cliente</Button>
        </div>
      )}
    </section>
  );
}
