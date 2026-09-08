import type { Calculo } from "./calculos";
import type { Proyecto } from "./types";
import { ESTADOS, FLUJO, LOG, PRIO } from "./types";
import { descargar, fecha } from "./utils";

export const exportarJSON = (p: Proyecto) =>
  descargar(new Blob([JSON.stringify({ v: 3, ...p }, null, 2)], { type: "application/json" }), `${p.meta.nombre.replace(/\s+/g, "_")}_respaldo.json`);

/** Libro de Excel con General, Registro de pagos, Proveedores, Compras, Flujo, Traspasos, Bitácora y una hoja por relación. */
export async function exportarExcel(p: Proyecto, calc: Calculo) {
  const XLSX = await import("xlsx");
  const provDe = (id: string) => p.proveedores.find((v) => v.id === id);
  const nombreProv = (id: string) => provDe(id)?.nombre || "";
  const conceptoDe = (id: string) => calc.conceptos.find((c) => c.id === id);
  const rels = [...p.relaciones].sort((a, b) => a.n - b.n);
  const nums = rels.map((r) => r.n);
  type Fila = (string | number)[];

  const gen: Fila[] = [[p.meta.nombre], [p.meta.clientes], [], ["Partida", "Concepto", "Proveedor", "Presupuesto", "IVA", "Total", "Presupuesto original", "Ajustes", "Candado vigente", "Comparativa", "Prioridad", "Estado", ...nums.map((r) => `Rel ${r}`), "Total pagado", "% Pagado", "Saldo a ejercer"]];
  for (const pa of calc.partidas) {
    pa.conceptos.forEach((c, i) => {
      const orig = c.base.presupuesto + c.base.iva;
      const porRel = nums.map((r) => p.pagos.filter((x) => x.estado === "pagado" && x.conceptoId === c.id && x.rel === r).reduce((s, x) => s + x.monto, 0) || "");
      gen.push([i === 0 ? pa.nombre : "", c.nombre, nombreProv(c.proveedorId), c.presupuesto, c.iva, c.total, orig, c.total - orig || "", i === 0 ? pa.candadoEf : "", i === 0 ? pa.comparativa : "", PRIO[c.prioridad], ESTADOS[c.estado], ...porRel, c.pagado, c.total ? c.pagado / c.total : "", c.saldo]);
    });
    gen.push([]);
  }
  const relTot = (f: (x: Proyecto["pagos"][number]) => boolean) => nums.map((r) => p.pagos.filter((x) => x.estado === "pagado" && x.rel === r && f(x)).reduce((s, x) => s + x.monto, 0));
  gen.push(["TOTAL OBRA", "", "", "", "", calc.totalObra, "", "", p.meta.presupuestoObra, calc.comparativaGlobal, "", "", ...relTot((x) => x.tipo === "obra"), calc.pagadoObra, calc.totalObra ? calc.pagadoObra / calc.totalObra : "", calc.totalObra - calc.pagadoObra]);
  gen.push([`Honorarios (${p.meta.pctHonorarios}%)`, "", "", "", "", calc.honorarios, "", "", "", "", "", "", ...relTot((x) => x.tipo === "honorarios"), calc.pagadoHonorarios, calc.honorarios ? calc.pagadoHonorarios / calc.honorarios : "", calc.honorarios - calc.pagadoHonorarios]);
  gen.push(["GRAN TOTAL", "", "", "", "", calc.granTotal, "", "", "", "", "", "", ...relTot(() => true), calc.pagadoTotal, calc.granTotal ? calc.pagadoTotal / calc.granTotal : "", calc.granTotal - calc.pagadoTotal]);

  const reg: Fila[] = [["REGISTRO DE PAGOS"], [], ["No.", "Relación", "Concepto", "Proveedor", "Fecha", "Forma de pago", "Tipo", "Estado", "Monto", "De excedente", "Nota"]];
  [...p.pagos].sort((a, b) => a.rel - b.rel || (a.fecha || "").localeCompare(b.fecha || "")).forEach((x, i) => reg.push([i + 1, x.rel, x.tipo === "honorarios" ? `Honorarios - ${x.fase}` : conceptoDe(x.conceptoId)?.nombre || "", nombreProv(x.proveedorId), x.fecha, x.forma, x.status, FLUJO[x.estado], x.monto, x.deExcedente ? "Sí" : "", x.nota]));
  reg.push([], ["CONTROL EFECTIVO - EXCEDENTE A FAVOR"], ["Concepto", "Fecha", "Excedente a favor"]);
  p.excedentes.forEach((e) => reg.push([e.concepto, e.fecha, e.monto]));
  reg.push(["Total excedente", "", calc.excedenteFavor], ["Usado en pagos", "", calc.excedenteUsado], ["Diferencia", "", calc.excedenteDiferencia]);

  const pv: Fila[] = [["PROVEEDORES"], [], ["Proveedor", "Razón social", "Banco", "CLABE", "Teléfono", "Contratado", "Pagado", "Saldo", "Relaciones"]];
  for (const x of p.proveedores) {
    const cs = calc.conceptos.filter((c) => c.proveedorId === x.id);
    const pgs = p.pagos.filter((y) => y.proveedorId === x.id);
    const comp = cs.reduce((s, c) => s + c.total, 0), pag = pgs.filter((y) => y.estado === "pagado").reduce((s, y) => s + y.monto, 0);
    pv.push([x.nombre, x.razon, x.banco, x.clabe, x.tel, comp, pag, comp - pag, [...new Set(pgs.map((y) => y.rel))].sort((a, b) => a - b).join(", ")]);
  }
  const co: Fila[] = [["COMPRAS Y ENTREGAS"], [], ["Partida", "Concepto", "Proveedor", "Total", "Prioridad", "Estatus", "Llega el", "Pedido / guía", "Links"]];
  for (const pa of calc.partidas) for (const c of pa.conceptos) {
    if (!c.links.length && c.logistica === "porComprar" && !c.total) continue;
    co.push([pa.nombre, c.nombre, nombreProv(c.proveedorId), c.total, PRIO[c.prioridad], LOG[c.logistica], c.eta, c.pedido, c.links.map((l) => l.url).join("  ")]);
  }
  const fl: Fila[] = [["FLUJO DE CAJA"], [], ["Mes", "Pagado", "Previsto", "Acumulado"], ...calc.flujo.map((m): Fila => [m.mes, m.pagado, m.previsto, m.acumulado])];
  const nombrePa = (id: string) => p.partidas.find((x) => x.id === id)?.nombre || "";
  const tr: Fila[] = [["TRASPASOS DE CANDADO"], [], ["Fecha", "De", "A", "Monto", "Motivo"], ...p.traspasos.map((t): Fila => [t.fecha, nombrePa(t.deId), nombrePa(t.aId), t.monto, t.motivo])];
  const bit: Fila[] = [["BITÁCORA DE PRESUPUESTOS"], [], ["Partida", "Concepto", "Fecha", "Anterior", "Nuevo", "Diferencia", "Motivo"]];
  for (const pa of p.partidas) for (const c of pa.conceptos) for (const a of c.ajustes) bit.push([pa.nombre, c.nombre, a.fecha, a.anterior, a.nuevo, a.nuevo - a.anterior, a.motivo]);

  const wb = XLSX.utils.book_new();
  const hoja = (rows: Fila[], nombre: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), nombre);
  hoja(gen, "General"); hoja(reg, "Registro de Pagos"); hoja(pv, "Proveedores"); hoja(co, "Compras"); hoja(fl, "Flujo de Caja"); hoja(tr, "Traspasos"); hoja(bit, "Bitácora");
  for (const r of rels) {
    const lista = p.pagos.filter((x) => x.rel === r.n);
    const rows: Fila[] = [[p.meta.clientes], [p.meta.nombre], [fecha(r.fecha)], [], [`Relación ${r.n} - Resumen de pagos`], [], ["No.", "Concepto", "Proveedor", "Pago solicitado", "Forma", "Tipo", "Estado", "Datos bancarios"]];
    lista.forEach((x, i) => {
      const v = provDe(x.proveedorId);
      rows.push([i + 1, x.tipo === "honorarios" ? `Honorarios - ${x.fase}` : conceptoDe(x.conceptoId)?.nombre || "", v?.nombre || "", x.monto, x.forma, x.status, FLUJO[x.estado], x.forma === "Transferencia" && v ? `${v.razon} · ${v.banco} · CLABE ${v.clabe}` : ""]);
    });
    rows.push([], ["", "", "Total relación", lista.reduce((s, x) => s + x.monto, 0)], ["", "", "Saldo a pagar", lista.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0)], ["", "", "Fecha límite", fecha(r.fechaLimite)]);
    hoja(rows, `Rel-${r.n}`);
  }
  XLSX.writeFile(wb, `Rel_Gastos_${p.meta.nombre.replace(/\s+/g, "_")}.xlsx`);
}
