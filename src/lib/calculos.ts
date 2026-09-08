import type { Concepto, Partida, Prioridad, Proyecto } from "./types";
import { PRIO, PRIO_ORDEN } from "./types";
import { mesLabel, pct } from "./utils";

export interface ConceptoCalc extends Concepto { total: number; pagado: number; enTramite: number; saldo: number; pctPagado: number }
export interface PartidaCalc extends Omit<Partida, "conceptos"> {
  conceptos: ConceptoCalc[]; comprometido: number; pagado: number; enTramite: number;
  recibido: number; cedido: number; candadoEf: number; disponible: number; comparativa: number;
  excedido: boolean; avance: number; adelantada: boolean;
}
export interface MesFlujo { ym: string; mes: string; pagado: number; previsto: number; acumulado: number }
export interface Calculo {
  partidas: PartidaCalc[]; totalObra: number; totalCandados: number; pagadoObra: number; porPagarObra: number;
  honorarios: number; pagadoHonorarios: number; granTotal: number; pagadoTotal: number; pagosPorRel: Record<number, number>;
  avanceGlobal: number; comparativaGlobal: number; excedenteFavor: number; excedenteUsado: number; excedenteDiferencia: number;
  flujo: MesFlujo[]; porPrioridad: { k: Prioridad; etiqueta: string; conceptos: number; monto: number; pagado: number }[];
  conceptos: ConceptoCalc[];
}

/** Toda la aritmética del proyecto: candados, comprometido, pagado, flujo. Pura, sin efectos. */
export function calcular(p: Proyecto): Calculo {
  const pagosPorConcepto: Record<string, number> = {}, pagosPorRel: Record<number, number> = {}, compPorConcepto: Record<string, number> = {};
  let pagadoHonorarios = 0;
  for (const pg of p.pagos) {
    const esPagado = pg.estado === "pagado";
    if (pg.tipo === "honorarios") { if (esPagado) pagadoHonorarios += pg.monto; }
    else if (esPagado) pagosPorConcepto[pg.conceptoId] = (pagosPorConcepto[pg.conceptoId] || 0) + pg.monto;
    else compPorConcepto[pg.conceptoId] = (compPorConcepto[pg.conceptoId] || 0) + pg.monto;
    pagosPorRel[pg.rel] = (pagosPorRel[pg.rel] || 0) + pg.monto;
  }
  const traIn: Record<string, number> = {}, traOut: Record<string, number> = {};
  for (const t of p.traspasos) { traIn[t.aId] = (traIn[t.aId] || 0) + t.monto; traOut[t.deId] = (traOut[t.deId] || 0) + t.monto; }

  let totalObra = 0, totalCandados = 0, pagadoObra = 0, porPagarObra = 0;
  const partidas: PartidaCalc[] = p.partidas.map((pa) => {
    const conceptos: ConceptoCalc[] = pa.conceptos.map((c) => {
      const total = c.presupuesto + c.iva;
      const pagado = pagosPorConcepto[c.id] || 0;
      const enTramite = compPorConcepto[c.id] || 0;
      return { ...c, total, pagado, enTramite, saldo: total - pagado, pctPagado: pct(pagado, total) };
    });
    const comprometido = conceptos.reduce((s, c) => s + c.total, 0);
    const pagado = conceptos.reduce((s, c) => s + c.pagado, 0);
    const enTramite = conceptos.reduce((s, c) => s + c.enTramite, 0);
    const recibido = traIn[pa.id] || 0, cedido = traOut[pa.id] || 0;
    const candadoEf = pa.candado + recibido - cedido;
    totalObra += comprometido; totalCandados += candadoEf; pagadoObra += pagado; porPagarObra += enTramite;
    return {
      ...pa, conceptos, comprometido, pagado, enTramite, recibido, cedido, candadoEf,
      disponible: candadoEf - comprometido, comparativa: candadoEf - comprometido,
      excedido: candadoEf > 0 && comprometido > candadoEf + 0.005, avance: 0, adelantada: false,
    };
  });
  const honorarios = totalObra * (p.meta.pctHonorarios / 100);
  const granTotal = totalObra + honorarios;
  const pagadoTotal = pagadoObra + pagadoHonorarios;
  const avanceGlobal = pct(pagadoObra, totalObra);
  for (const pa of partidas) {
    pa.avance = pct(pa.pagado, pa.comprometido);
    pa.adelantada = pa.comprometido > 0 && pa.avance - avanceGlobal >= 25;
  }
  const conceptos = partidas.flatMap((pa) => pa.conceptos);
  const porPrioridad = PRIO_ORDEN.map((k) => {
    const cs = conceptos.filter((c) => (c.prioridad || "sinClasificar") === k);
    return { k, etiqueta: PRIO[k], conceptos: cs.length, monto: cs.reduce((s, c) => s + c.total, 0), pagado: cs.reduce((s, c) => s + c.pagado, 0) };
  }).filter((x) => x.conceptos > 0);
  const excedenteFavor = p.excedentes.reduce((s, e) => s + e.monto, 0);
  const excedenteUsado = p.pagos.filter((x) => x.deExcedente && x.estado === "pagado").reduce((s, x) => s + x.monto, 0);

  // flujo de caja por mes: lo pagado por fecha de pago, lo pendiente por fecha límite de su relación
  const relLim: Record<number, string> = {};
  for (const r of p.relaciones) relLim[r.n] = r.fechaLimite || r.fecha;
  const meses: Record<string, MesFlujo> = {};
  for (const pg of p.pagos) {
    const f = pg.estado === "pagado" ? pg.fecha : relLim[pg.rel] || pg.fecha;
    if (!f) continue;
    const ym = f.slice(0, 7);
    meses[ym] ||= { ym, mes: mesLabel(ym), pagado: 0, previsto: 0, acumulado: 0 };
    if (pg.estado === "pagado") meses[ym].pagado += pg.monto; else meses[ym].previsto += pg.monto;
  }
  const flujo = Object.values(meses).sort((a, b) => a.ym.localeCompare(b.ym));
  let acum = 0; for (const m of flujo) { acum += m.pagado + m.previsto; m.acumulado = acum; }

  return {
    partidas, conceptos, totalObra, totalCandados, pagadoObra, porPagarObra, honorarios, pagadoHonorarios, granTotal, pagadoTotal, pagosPorRel,
    avanceGlobal, comparativaGlobal: p.meta.presupuestoObra - totalObra,
    excedenteFavor, excedenteUsado, excedenteDiferencia: excedenteFavor - excedenteUsado, flujo, porPrioridad,
  };
}
