import { useEffect, useMemo, useRef, useState } from "react";
import { useProyecto } from "@/hooks/useProyecto";
import { fm, cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/* Gráficas propias en SVG: marcas delgadas, ejes hairline, tinta para lo real y
   gris cálido para lo previsto. Cada gráfica tiene leyenda, etiquetas directas
   selectivas, tooltip al pasar y su tabla equivalente. */

const INK = "var(--serie-1)", GRIS = "var(--serie-2)", LINEA = "var(--line)", BASE = "var(--line-2)", EJE = "var(--ink-3)", BAD = "var(--bad)";
const compacto = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
/** Ticks redondos: 0, paso, 2·paso… hasta cubrir el máximo. */
function ticks(max: number, n = 4) {
  if (max <= 0) return [0];
  const bruto = max / n, mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) || mag;
  const out = []; for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(v); if (out[out.length - 1] < max) out.push(out[out.length - 1] + paso);
  return out;
}

/** Ancho real del contenedor, para que el texto del SVG no escale con la pantalla. */
function useAncho<T extends HTMLElement>(inicial = 360) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el); setW(Math.max(240, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Leyenda({ items }: { items: { color: string; texto: string; hueco?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
      {items.map((i) => <span key={i.texto} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2"><span className="inline-block size-2.5 rounded-[1px]" style={{ background: i.hueco ? "transparent" : i.color, boxShadow: i.hueco ? `inset 0 0 0 1.5px ${i.color}` : "inset 0 0 0 1px var(--line-2)" }} />{i.texto}</span>)}
    </div>
  );
}
function BotonTabla({ tabla, setTabla }: { tabla: boolean; setTabla: (v: boolean) => void }) {
  return <button type="button" className="anno hover:text-foreground" onClick={() => setTabla(!tabla)}>{tabla ? "Ver gráfica" : "Ver tabla"}</button>;
}
/** Tooltip anclado en porcentaje del ancho, para que funcione con el SVG escalable. */
function Tooltip({ pctX, children }: { pctX: number; children: React.ReactNode }) {
  const izq = pctX > 60;
  return (
    <div className="pointer-events-none absolute top-0 z-10 rounded-[8px] bg-foreground text-background px-2 py-1.5 text-[11.5px] leading-snug num whitespace-nowrap" style={{ left: izq ? undefined : `calc(${pctX}% + 8px)`, right: izq ? `calc(${100 - pctX}% + 8px)` : undefined }}>{children}</div>
  );
}

/** Flujo de caja por mes: columnas apiladas pagado (tinta) + previsto (gris), con hueco de 2px. */
export function FlujoChart() {
  const { calc } = useProyecto();
  const [tabla, setTabla] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const datos = calc.flujo;
  const [ref, W] = useAncho<HTMLDivElement>();
  const H = 200, ML = 40, MR = 8, MT = 14, MB = 26;
  const max = Math.max(...datos.map((m) => m.pagado + m.previsto), 1);
  const ts = ticks(max); const top = ts[ts.length - 1];
  const y = (v: number) => MT + (H - MT - MB) * (1 - v / top);
  const banda = (W - ML - MR) / Math.max(datos.length, 1);
  const ancho = Math.min(24, Math.max(8, banda * 0.6));
  const pico = datos.reduce((a, b, i) => (b.pagado + b.previsto > datos[a].pagado + datos[a].previsto ? i : a), 0);
  if (!datos.length) return null;
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Flujo de caja por mes</CardTitle><CardDescription>Lo previsto usa la fecha límite de cada relación.</CardDescription></div>
        <BotonTabla tabla={tabla} setTabla={setTabla} />
      </CardHeader>
      <CardContent>
        {tabla ? (
          <table className="w-full text-[13px] num"><thead><tr className="anno text-left"><th className="font-normal pb-1">Mes</th><th className="font-normal pb-1 text-right">Pagado</th><th className="font-normal pb-1 text-right">Previsto</th><th className="font-normal pb-1 text-right">Acumulado</th></tr></thead>
            <tbody>{datos.map((m) => <tr key={m.ym} className="border-t border-border"><td className="py-1.5">{m.mes}</td><td className="py-1.5 text-right">{fm(m.pagado)}</td><td className="py-1.5 text-right">{fm(m.previsto)}</td><td className="py-1.5 text-right">{fm(m.acumulado)}</td></tr>)}</tbody></table>
        ) : (
          <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Flujo de caja por mes">
              {ts.map((t) => <g key={t}><line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : LINEA} strokeWidth={1} /><text x={ML - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={EJE} className="num">{compacto(t)}</text></g>)}
              {datos.map((m, i) => {
                const cx = ML + banda * i + banda / 2, x = cx - ancho / 2;
                const hp = y(0) - y(m.pagado), hv = y(0) - y(m.previsto);
                const activo = hover === i;
                return (
                  <g key={m.ym} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                    <rect x={ML + banda * i} y={MT} width={banda} height={H - MT - MB} fill="transparent" />
                    {m.pagado > 0 && <rect x={x} y={y(m.pagado)} width={ancho} height={hp} fill={INK} opacity={hover === null || activo ? 1 : 0.45} rx={m.previsto > 0 ? 0 : 3} />}
                    {m.previsto > 0 && <rect x={x} y={y(m.pagado + m.previsto) } width={ancho} height={Math.max(0, hv - (m.pagado > 0 ? 2 : 0))} fill={GRIS} opacity={hover === null || activo ? 1 : 0.45} rx={3} />}
                    {(i === pico || activo) && <text x={cx} y={y(m.pagado + m.previsto) - 5} textAnchor="middle" fontSize={10.5} fontWeight={500} fill="var(--ink)" className="num">{compacto(m.pagado + m.previsto)}</text>}
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill={EJE}>{m.mes}</text>
                  </g>
                );
              })}
            </svg>
            {hover !== null && <Tooltip pctX={((ML + banda * hover + banda / 2) / W) * 100}><b>{datos[hover].mes}</b><br />Pagado {fm(datos[hover].pagado)}<br />Previsto {fm(datos[hover].previsto)}<br />Acumulado {fm(datos[hover].acumulado)}</Tooltip>}
          </div>
        )}
        <Leyenda items={[{ color: INK, texto: "Pagado" }, { color: GRIS, texto: "Previsto" }]} />
      </CardContent>
    </Card>
  );
}

/** Comprometido contra candado: una fila por partida, pista gris = candado, tinta = comprometido; rojo si se excede. */
export function CandadoChart() {
  const { calc } = useProyecto();
  const [tabla, setTabla] = useState(false);
  const filas = useMemo(() => calc.partidas.filter((x) => x.candadoEf > 0 || x.comprometido > 0), [calc]);
  const max = Math.max(...filas.map((x) => Math.max(x.candadoEf, x.comprometido)), 1);
  if (!filas.length) return null;
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Comprometido contra candado</CardTitle><CardDescription>La pista es el candado; la barra, lo comprometido.</CardDescription></div>
        <BotonTabla tabla={tabla} setTabla={setTabla} />
      </CardHeader>
      <CardContent>
        {tabla ? (
          <table className="w-full text-[13px] num"><thead><tr className="anno text-left"><th className="font-normal pb-1">Partida</th><th className="font-normal pb-1 text-right">Candado</th><th className="font-normal pb-1 text-right">Comprometido</th><th className="font-normal pb-1 text-right">Libre</th></tr></thead>
            <tbody>{filas.map((x) => <tr key={x.id} className="border-t border-border"><td className="py-1.5 truncate max-w-[9rem]">{x.nombre}</td><td className="py-1.5 text-right">{fm(x.candadoEf)}</td><td className="py-1.5 text-right">{fm(x.comprometido)}</td><td className={cn("py-1.5 text-right", x.excedido && "text-bad")}>{fm(x.candadoEf - x.comprometido)}</td></tr>)}</tbody></table>
        ) : (
          <div className="space-y-3">
            {filas.map((x) => {
              const wc = (x.candadoEf / max) * 100, wm = (x.comprometido / max) * 100;
              return (
                <div key={x.id} className="group" title={`${x.nombre}: comprometido ${fm(x.comprometido)} de ${fm(x.candadoEf)}`}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span className="truncate text-foreground">{x.nombre}</span><span className="num text-ink-2 shrink-0 ml-3">{fm(x.comprometido)}{x.candadoEf > 0 ? <span className="text-ink-3"> / {fm(x.candadoEf)}</span> : null}</span></div>
                  <div className="relative h-[6px]">
                    <div className="absolute inset-y-0 left-0 bg-wash" style={{ width: `${wc}%`, backgroundColor: "var(--wash)" }} />
                    <div className="absolute inset-y-[1px] left-0" style={{ width: `${wm}%`, background: x.excedido ? BAD : INK, borderRadius: "0 2px 2px 0" }} />
                    {x.candadoEf > 0 && <div className="absolute -top-[2px] -bottom-[2px] w-px" style={{ left: `${wc}%`, background: BASE }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Leyenda items={[{ color: INK, texto: "Comprometido" }, { color: "var(--wash)", texto: "Candado (pista)", hueco: false }, { color: BAD, texto: "Excede el candado" }]} />
      </CardContent>
    </Card>
  );
}

/** Avance físico contra pagado: una fila por partida; tinta = hecho, marca vertical = pagado. */
export function AvanceChart() {
  const { calc } = useProyecto();
  const filas = calc.partidas.filter((x) => x.comprometido > 0);
  if (!filas.length) return null;
  return (
    <Card>
      <CardHeader><div><CardTitle>Avance físico contra pagado</CardTitle><CardDescription>Si la marca de pagado va muy por delante de la barra de hecho, estás financiando al proveedor.</CardDescription></div></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filas.map((x) => {
            const tarde = x.avance - x.avanceFisico >= 25;
            return (
              <div key={x.id} title={`${x.nombre}: hecho ${x.avanceFisico}%, pagado ${x.avance}%`}>
                <div className="flex justify-between text-[12.5px] mb-1"><span className="truncate">{x.nombre}</span><span className={cn("num shrink-0 ml-3", tarde ? "text-warn" : "text-ink-2")}>hecho {x.avanceFisico}% · pagado {x.avance}%</span></div>
                <div className="relative h-[6px]" style={{ backgroundColor: "var(--wash)" }}>
                  <div className="absolute inset-y-[1px] left-0" style={{ width: `${x.avanceFisico}%`, background: INK }} />
                  <div className="absolute -top-[3px] -bottom-[3px] w-[2px]" style={{ left: `calc(${x.avance}% - 1px)`, background: tarde ? "var(--warn)" : "var(--ink-2)" }} />
                </div>
              </div>
            );
          })}
        </div>
        <Leyenda items={[{ color: INK, texto: "Hecho (avance físico)" }, { color: "var(--ink-2)", texto: "Pagado (marca)" }, { color: "var(--warn)", texto: "Pagado 25 pts o más por delante" }]} />
      </CardContent>
    </Card>
  );
}

export default function Graficas() {
  return <><FlujoChart /><CandadoChart /></>;
}
