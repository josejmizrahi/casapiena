import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Lock, Plus, X } from "lucide-react";
import * as api from "@/api";
import { PLANTILLAS, type Plantilla } from "@/lib/plantillas";
import { cn, fm, num } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { KV } from "@/components/ui/misc";

interface Fila { nombre: string; pct: number; contingencia?: boolean }
const PASOS = ["Proyecto", "Partidas", "Candados", "Listo"];

/** Asistente de cuatro pasos: datos, plantilla de partidas, reparto de candados, resumen. */
export function AsistenteProyecto({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [clientes, setClientes] = useState("");
  const [presupuesto, setPresupuesto] = useState(0);
  const [honorarios, setHonorarios] = useState(15);
  const [plantilla, setPlantilla] = useState<Plantilla>(PLANTILLAS[0]);
  const [filas, setFilas] = useState<Fila[]>(PLANTILLAS[0].partidas);
  const [nueva, setNueva] = useState("");
  const [creando, setCreando] = useState("");

  const elegir = (pl: Plantilla) => { setPlantilla(pl); setFilas(pl.partidas.map((x) => ({ ...x }))); };
  const totalPct = useMemo(() => filas.reduce((s, f) => s + f.pct, 0), [filas]);
  const asignado = (presupuesto * totalPct) / 100;
  const libre = presupuesto - asignado;
  const setPct = (i: number, pct: number) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, pct } : f)));
  const setMonto = (i: number, monto: number) => setPct(i, presupuesto > 0 ? Math.round((monto / presupuesto) * 1000) / 10 : 0);
  const puedeSeguir = paso === 0 ? nombre.trim().length > 0 : paso === 2 ? totalPct <= 100.05 : true;

  const crear = async () => {
    try {
      setCreando("Creando proyecto…");
      const p = await api.crearProyecto(nombre.trim(), clientes.trim());
      await api.guardarMeta(p.id, { nombre: nombre.trim(), clientes: clientes.trim(), presupuestoObra: presupuesto, pctHonorarios: honorarios, direccionEfectivo: "", contactoEfectivo: "", instruccionesEfectivo: "" });
      let i = 0;
      for (const f of filas) {
        setCreando(`Partida ${i + 1} de ${filas.length}…`);
        await api.guardarPartida(p.id, { nombre: f.nombre, candado: Math.round((presupuesto * f.pct) / 100), contingencia: !!f.contingencia }, i++);
      }
      toast.success(`Proyecto "${nombre.trim()}" creado`);
      onClose();
      location.hash = `#/p/${p.id}/hoy`;
    } catch (e) {
      toast.error("No se pudo crear", { description: e instanceof Error ? e.message : String(e) });
    } finally { setCreando(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !creando && onClose()}>
      <DialogContent title="Nuevo proyecto" description={`Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso]}`} className="md:max-w-2xl">
        <ol className="flex gap-1 mb-1">{PASOS.map((p, i) => <li key={p} className={cn("h-[3px] flex-1", i <= paso ? "bg-primary" : "bg-wash")} />)}</ol>

        {paso === 0 && (
          <div className="space-y-3">
            <Field label="Nombre del proyecto"><Input autoFocus value={nombre} placeholder="Ej. Casa Piena — Mobiliario" onChange={(e) => setNombre(e.target.value)} /></Field>
            <Field label="Clientes"><Input value={clientes} placeholder="Ej. José y Lynda" onChange={(e) => setClientes(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Presupuesto general de obra" hint="Sin honorarios. Es el techo que acordaste con el cliente; todo se compara contra él."><MoneyInput value={presupuesto} onChange={setPresupuesto} /></Field>
              <Field label="Honorarios %" hint="Se calculan sobre lo comprometido en obra."><MoneyInput value={honorarios} onChange={setHonorarios} /></Field>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">Elige el tipo de obra. Las partidas son las cajas donde vas a agrupar conceptos; puedes quitar, agregar o renombrar.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLANTILLAS.map((pl) => (
                <button key={pl.id} type="button" onClick={() => elegir(pl)} className={cn("rounded-md border p-3 text-left transition-colors", plantilla.id === pl.id ? "border-foreground" : "border-border-2 hover:bg-muted")}>
                  <div className="font-medium text-sm flex items-center justify-between">{pl.nombre}{plantilla.id === pl.id && <Check className="size-4 text-primary" />}</div>
                  <div className="text-xs text-ink-3 mt-0.5">{pl.descripcion}</div>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {filas.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f.nombre} onChange={(e) => setFilas((fs) => fs.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} className="h-9" />
                  <Button size="icon" variant="ghost" className="size-8 text-ink-3 shrink-0" aria-label="Quitar" onClick={() => setFilas((fs) => fs.filter((_, k) => k !== i))}><X /></Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input value={nueva} placeholder="Agregar partida…" className="h-9" onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nueva.trim()) { setFilas((fs) => [...fs, { nombre: nueva.trim(), pct: 0 }]); setNueva(""); } }} />
                <Button size="icon" variant="outline" className="size-8 shrink-0" aria-label="Agregar" disabled={!nueva.trim()} onClick={() => { setFilas((fs) => [...fs, { nombre: nueva.trim(), pct: 0 }]); setNueva(""); }}><Plus /></Button>
              </div>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-3">
            <div className="border-l-2 border-warn pl-3 py-1 text-[14px] flex gap-2"><Lock className="size-4 shrink-0 mt-0.5 text-warn stroke-[1.75]" /><span><b>El candado es el tope de cada partida.</b> Reparte el presupuesto en porcentajes; la suma no debe pasar del 100 %. Deja imprevistos entre 5 y 10 %. Si después una partida crece, traspásale candado de otra en vez de subirlo.</span></div>
            {presupuesto <= 0 && <p className="text-xs text-warn">Sin presupuesto general los candados quedan en cero. Puedes regresar al paso 1 o capturarlos después en cada partida.</p>}
            <div className="space-y-1.5">
              {filas.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_120px] items-center gap-2 text-sm">
                  <span className={cn("truncate", f.contingencia && "text-gold font-medium")}>{f.nombre}</span>
                  <div className="relative"><Input inputMode="decimal" value={f.pct} onChange={(e) => setPct(i, num(e.target.value))} className="h-9 pr-6 num text-right" /><span className="absolute right-2 top-2 text-xs text-ink-3">%</span></div>
                  <Input inputMode="decimal" value={Math.round((presupuesto * f.pct) / 100)} onChange={(e) => setMonto(i, num(e.target.value))} className="h-9 num text-right" />
                </div>
              ))}
            </div>
            <div className="rounded-md border bg-panel border-border px-3 py-1">
              <KV k="Asignado en candados" v={<>{fm(asignado)} <span className="text-ink-3 font-normal">· {Math.round(totalPct * 10) / 10}%</span></>} tone={totalPct > 100.05 ? "bad" : undefined} />
              <KV k={libre < 0 ? "Te pasas del presupuesto por" : "Sin asignar"} v={fm(Math.abs(libre))} tone={libre < 0 ? "bad" : libre > 0 ? "ok" : undefined} />
            </div>
            {totalPct > 100.05 && <p className="text-xs text-bad">La suma de candados rebasa el presupuesto general. Baja algún porcentaje para continuar.</p>}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-3">
            <div className="rounded-md border bg-panel border-border px-3 py-1">
              <KV k="Proyecto" v={nombre.trim()} />
              {clientes.trim() && <KV k="Clientes" v={clientes.trim()} />}
              <KV k="Presupuesto general" v={fm(presupuesto)} />
              <KV k="Honorarios" v={`${honorarios}% · ${fm((presupuesto * honorarios) / 100)} sobre el presupuesto`} />
              <KV k="Partidas" v={String(filas.length)} />
              <KV k="Candados asignados" v={fm(asignado)} />
            </div>
            <p className="text-sm text-ink-3">Al crearlo te llevo a la vista <b>Hoy</b>, que te dice qué sigue: capturar conceptos en cada partida, asignar proveedores y registrar el primer pago.</p>
          </div>
        )}

        <DialogActions>
          {paso > 0 ? <Button variant="outline" onClick={() => setPaso(paso - 1)} disabled={!!creando}><ArrowLeft />Atrás</Button> : <Button variant="outline" onClick={onClose}>Cancelar</Button>}
          {paso < PASOS.length - 1
            ? <Button disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>Siguiente<ArrowRight /></Button>
            : <Button disabled={!!creando} onClick={crear}>{creando || "Crear proyecto"}</Button>}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
