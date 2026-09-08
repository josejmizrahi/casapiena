import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";
import * as api from "./lib/api.js";

const ESTADOS = { pendiente: "Faltan presupuestos", porCerrar: "Próximo a cerrar", cerrado: "Cerrado" };
const FLUJO = { solicitado: "Solicitado", autorizado: "Autorizado", pagado: "Pagado" };
const LOG = { porComprar: "Por comprar", cotizado: "Cotizado", comprado: "Comprado", transito: "En camino", recibido: "Recibido", instalado: "Instalado" };
const PRIO = { indispensable: "Indispensable", flexible: "Flexible", opcional: "Opcional", exhibicion: "Exhibición", sinClasificar: "Sin clasificar" };
const PRIO_ORDEN = ["indispensable", "flexible", "opcional", "exhibicion", "sinClasificar"];
const LOG_ORDEN = ["porComprar", "cotizado", "comprado", "transito", "recibido", "instalado"];
const SIGUIENTE = { porComprar: "comprado", cotizado: "comprado", comprado: "transito", transito: "recibido", recibido: "instalado" };
const STATUS_PAGO = ["Anticipo", "Pago a cuenta", "Finiquito", "Pago total"];
const HOY = () => new Date().toISOString().slice(0, 10);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
let _seq = 0;
const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

// ───────────────────────── utilidades
const n = (v) => { const x = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")); return isNaN(x) ? 0 : x; };
const mx0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mx2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fm = (v) => mx0.format(v || 0);
const fm2 = (v) => mx2.format(v || 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fecha = (s) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const mesLabel = (ym) => { const [y, m] = ym.split("-"); return `${MESES[parseInt(m) - 1]} ${y.slice(2)}`; };

function calcular(p) {
  const pagosPorConcepto = {}, pagosPorRel = {}, compPorConcepto = {};
  let pagadoHonorarios = 0;
  for (const pg of p.pagos) {
    const esPagado = pg.estado === "pagado";
    if (pg.tipo === "honorarios") { if (esPagado) pagadoHonorarios += pg.monto; }
    else {
      if (esPagado) pagosPorConcepto[pg.conceptoId] = (pagosPorConcepto[pg.conceptoId] || 0) + pg.monto;
      else compPorConcepto[pg.conceptoId] = (compPorConcepto[pg.conceptoId] || 0) + pg.monto;
    }
    pagosPorRel[pg.rel] = (pagosPorRel[pg.rel] || 0) + pg.monto;
  }
  const traIn = {}, traOut = {};
  for (const t of p.traspasos || []) { traIn[t.aId] = (traIn[t.aId] || 0) + t.monto; traOut[t.deId] = (traOut[t.deId] || 0) + t.monto; }

  let totalObra = 0, totalCandados = 0, pagadoObra = 0, porPagarObra = 0;
  const partidas = p.partidas.map((pa) => {
    const conceptos = pa.conceptos.map((c) => {
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
    return { ...pa, conceptos, comprometido, pagado, enTramite, recibido, cedido, candadoEf, disponible: candadoEf - comprometido, comparativa: candadoEf - comprometido, excedido: candadoEf > 0 && comprometido > candadoEf + 0.005 };
  });
  const honorarios = totalObra * (p.meta.pctHonorarios / 100);
  const granTotal = totalObra + honorarios;
  const pagadoTotal = pagadoObra + pagadoHonorarios;
  const avanceGlobal = pct(pagadoObra, totalObra);
  partidas.forEach((pa) => {
    pa.avance = pct(pa.pagado, pa.comprometido);
    pa.adelantada = pa.comprometido > 0 && pa.avance - avanceGlobal >= 25;
  });
  const porPrioridad = PRIO_ORDEN.map((k) => {
    const cs = partidas.flatMap((pa) => pa.conceptos.filter((c) => (c.prioridad || "sinClasificar") === k));
    return { k, etiqueta: PRIO[k], conceptos: cs.length, monto: cs.reduce((s, c) => s + c.total, 0), pagado: cs.reduce((s, c) => s + c.pagado, 0) };
  }).filter((x) => x.conceptos > 0);
  const excedenteFavor = p.excedentes.reduce((s, e) => s + e.monto, 0);
  const excedenteUsado = p.pagos.filter((x) => x.deExcedente && x.estado === "pagado").reduce((s, x) => s + x.monto, 0);

  // flujo de caja por mes
  const relLim = {}; (p.relaciones || []).forEach((r) => { relLim[r.n] = r.fechaLimite || r.fecha; });
  const meses = {};
  for (const pg of p.pagos) {
    const f = pg.estado === "pagado" ? pg.fecha : (relLim[pg.rel] || pg.fecha);
    if (!f) continue;
    const ym = f.slice(0, 7);
    meses[ym] = meses[ym] || { ym, pagado: 0, previsto: 0 };
    if (pg.estado === "pagado") meses[ym].pagado += pg.monto; else meses[ym].previsto += pg.monto;
  }
  const flujo = Object.values(meses).sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => ({ ...m, mes: mesLabel(m.ym) }));
  let acum = 0; flujo.forEach((m) => { acum += m.pagado + m.previsto; m.acumulado = acum; });

  return {
    partidas, totalObra, totalCandados, pagadoObra, porPagarObra, honorarios, pagadoHonorarios, granTotal, pagadoTotal, pagosPorRel,
    avanceGlobal, comparativaGlobal: p.meta.presupuestoObra - totalObra,
    excedenteFavor, excedenteUsado, excedenteDiferencia: excedenteFavor - excedenteUsado, flujo, porPrioridad,
  };
}

// ───────────────────────── estilos
const css = `
.ob{--paper:#EEF1EE;--card:#FFFFFF;--ink:#1E2F3C;--ink2:#5B6B75;--line:#D7DDD9;--lock:#C89A2E;--lockbg:#F6EBCF;--ok:#2F7D4E;--okbg:#E2F1E7;--warn:#B9791A;--warnbg:#FBEFD9;--bad:#B23A32;--badbg:#F8E3E0;--blue:#2A5D7C;--bluebg:#E1EDF4;
 font-family:-apple-system,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--paper);min-height:100vh;font-size:15px;line-height:1.35;-webkit-font-smoothing:antialiased}
.ob *{box-sizing:border-box}
.ob h1,.ob h2,.ob .serif{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:600;letter-spacing:-.01em}
.ob .num{font-variant-numeric:tabular-nums}
.ob .top{padding:14px 16px 8px;background:var(--paper);position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line)}
.ob .top h1{font-size:22px;margin:0;line-height:1.15}
.ob .top .sub{color:var(--ink2);font-size:13px;margin-top:2px}
.ob .tabs{display:flex;gap:2px;margin-top:10px;background:#E2E7E3;border-radius:10px;padding:3px;overflow-x:auto;scrollbar-width:none}
.ob .tabs::-webkit-scrollbar{display:none}
.ob .tabs button{flex:1 0 auto;border:0;background:transparent;padding:7px 11px;border-radius:8px;font-size:13px;font-weight:600;color:var(--ink2);white-space:nowrap}
.ob .tabs button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(30,47,60,.12)}
.ob .wrap{padding:12px 12px 92px;max-width:720px;margin:0 auto}
.ob .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.ob .strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.ob .strip .k{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.ob .strip .k small,.ob .lbl{display:block;color:var(--ink2);font-size:11px;margin-bottom:2px}
.ob .strip .k b{font-size:15px;display:block}
.ob .bar{height:8px;border-radius:5px;background:#E4E9E5;overflow:hidden;position:relative;margin-top:8px;display:flex}
.ob .bar i{display:block;height:100%;background:var(--ok)}
.ob .bar i.tram{background:#9FC3AE}
.ob .bar i.bad{background:var(--bad)}.ob .bar i.warn{background:var(--warn)}
.ob .lock{display:inline-flex;align-items:center;gap:4px;background:var(--lockbg);color:#6E5312;border-radius:7px;padding:3px 8px;font-size:12px;font-weight:600;border:0;white-space:nowrap}
.ob .lock.bad{background:var(--badbg);color:var(--bad)}
.ob .pa-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ob .pa-head h2{font-size:16px;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ob .pa-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--ink2);margin-top:6px;gap:8px}
.ob .row{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;color:inherit;font:inherit}
.ob .row:first-of-type{border-top:0}
.ob .dot{width:9px;height:9px;border-radius:50%;flex:none}
.ob .dot.pendiente{background:#C9D0CB}.ob .dot.porCerrar{background:var(--warn)}.ob .dot.cerrado{background:var(--ok)}
.ob .row .t{flex:1;min-width:0}.ob .row .t b{display:block;font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ob .row .t small{color:var(--ink2);font-size:12px}
.ob .row .amt{text-align:right}.ob .row .amt b{display:block;font-size:14px}.ob .row .amt small{font-size:11px;color:var(--ink2)}
.ob .btn{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;padding:9px 14px;font-size:14px;font-weight:600;font-family:inherit}
.ob .btn.pri{background:var(--ink);color:#fff;border-color:var(--ink)}
.ob .btn.danger{color:var(--bad);border-color:#E8C4C0}
.ob .btn.sm{padding:6px 10px;font-size:13px}
.ob .btn.ghost{border-style:dashed;color:var(--ink2);width:100%;margin-top:8px}
.ob .fab{position:fixed;right:16px;bottom:18px;z-index:25;border:0;background:var(--ink);color:#fff;border-radius:999px;padding:13px 18px;font-size:15px;font-weight:700;box-shadow:0 6px 16px rgba(30,47,60,.3)}
.ob .sheet-bg{position:fixed;inset:0;background:rgba(20,30,38,.45);z-index:40;display:flex;align-items:flex-end;justify-content:center}
.ob .sheet{background:var(--card);width:100%;max-width:720px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:14px 16px 28px}
.ob .sheet h2{font-size:19px;margin:0 0 10px}
.ob .f{margin-bottom:10px}
.ob .f input,.ob .f select,.ob .f textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:10px;font-size:16px;font-family:inherit;background:#FAFBFA;color:var(--ink)}
.ob .f input:focus,.ob .f select:focus,.ob .f textarea:focus{outline:2px solid var(--blue);outline-offset:1px}
.ob .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ob .chk{display:flex;align-items:center;gap:8px;font-size:14px;margin:6px 0}
.ob .chk input{width:18px;height:18px}
.ob .acts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.ob .acts .btn{flex:1;min-width:110px}
.ob .pill{display:inline-block;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600}
.ob .pill.Efectivo{background:var(--okbg);color:var(--ok)}.ob .pill.Transferencia{background:var(--bluebg);color:var(--blue)}
.ob .pill.solicitado{background:var(--warnbg);color:var(--warn)}
.ob .pill.autorizado{background:var(--bluebg);color:var(--blue)}
.ob .pill.pagado{background:var(--okbg);color:var(--ok)}
.ob .hero{background:var(--ink);color:#fff;border-radius:14px;padding:16px;margin-bottom:12px}
.ob .hero .big{font-size:30px;font-weight:700;line-height:1}
.ob .hero small{opacity:.72;font-size:12px}
.ob .hero .bar{background:rgba(255,255,255,.18)}
.ob .kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}
.ob .kv:first-child{border-top:0}
.ob .kv b{font-weight:600;white-space:nowrap}
.ob .kv.tot{font-weight:700;font-size:15px}
.ob .bad-t{color:var(--bad)}.ob .ok-t{color:var(--ok)}.ob .warn-t{color:var(--warn)}.ob .blue-t{color:var(--blue)}
.ob .note{font-size:12px;color:var(--ink2)}
.ob .empty{padding:24px 12px;text-align:center;color:var(--ink2);font-size:14px}
.ob .seg{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px}
.ob .seg button{border:1px solid var(--line);background:var(--card);color:var(--ink2);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;white-space:nowrap;font-family:inherit}
.ob .seg button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.ob .lk{display:inline-flex;align-items:center;gap:5px;background:var(--bluebg);color:var(--blue);border:1px solid #C6DCEA;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:600;text-decoration:none;margin:4px 6px 0 0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ob .pr{display:inline-block;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600;background:#E4E9E5;color:var(--ink2)}
.ob .pr.indispensable{background:#F1DEDC;color:var(--bad)}
.ob .pr.flexible{background:var(--warnbg);color:var(--warn)}
.ob .pr.opcional{background:var(--bluebg);color:var(--blue)}
.ob .pr.exhibicion{background:#EDE4F2;color:#6B4A80}
.ob .est{display:inline-block;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;background:#E4E9E5;color:var(--ink2)}
.ob .est.cotizado{background:var(--bluebg);color:var(--blue)}
.ob .est.comprado{background:var(--warnbg);color:var(--warn)}
.ob .est.transito{background:var(--warnbg);color:var(--warn)}
.ob .est.recibido{background:var(--okbg);color:var(--ok)}
.ob .est.instalado{background:var(--okbg);color:var(--ok)}
.ob .log{font-size:12px;color:var(--ink2);border-left:2px solid var(--line);padding-left:8px;margin:4px 0}
.ob .print{display:none}
@media print{
 body *{visibility:hidden}
 .ob .print,.ob .print *{visibility:visible}
 .ob .print{display:block;position:absolute;left:0;top:0;width:100%;padding:24px;background:#fff;color:#000;font-size:12px}
 .ob .print table{width:100%;border-collapse:collapse;margin-top:10px}
 .ob .print th,.ob .print td{border-bottom:1px solid #999;padding:6px 4px;text-align:left;vertical-align:top}
 .ob .print th{font-size:11px;text-transform:uppercase}
 .ob .print .r{text-align:right}
}
`;

function Field({ label, children }) { return <div className="f"><span className="lbl">{label}</span>{children}</div>; }
function Money({ value, onChange, placeholder = "0" }) {
  const [txt, setTxt] = useState(value ? String(value) : "");
  useEffect(() => { setTxt(value ? String(value) : ""); }, [value]);
  return <input inputMode="decimal" placeholder={placeholder} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => onChange(n(txt))} />;
}
function Sheet({ title, onClose, children }) {
  return <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}><h2>{title}</h2>{children}</div></div>;
}
function SelProveedor({ value, onChange, ctx }) {
  const { p, setModal } = ctx;
  return (
    <select value={value || ""} onChange={(e) => { if (e.target.value === "__nuevo") setModal({ tipo: "prov", d: { nombre: "", razon: "", banco: "", clabe: "", tel: "", nota: "" }, onSave: onChange }); else onChange(e.target.value); }}>
      <option value="">Sin proveedor</option>
      {[...p.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
      <option value="__nuevo">+ Nuevo proveedor…</option>
    </select>
  );
}

// ───────────────────────── modales
function ModalConcepto({ d0, ctx }) {
  const { p, calc, setModal, guardarConcepto, borrarConcepto, relsOrdenadas, conceptoDe, nombreProv } = ctx;
  const [d, setD] = useState(d0);
  const [ivaAuto, setIvaAuto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const c = d.id ? conceptoDe(d.id) : null;
  const total = d.presupuesto + d.iva;
  const cambio = c ? Math.abs(total - (c.presupuesto + c.iva)) > 0.005 : false;
  const pagosC = d.id ? p.pagos.filter((x) => x.conceptoId === d.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")) : [];
  const pagado = pagosC.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
  const pa = calc.partidas.find((x) => x.id === d.partidaId);
  const otros = pa ? pa.comprometido - (c ? c.presupuesto + c.iva : 0) : 0;
  const excede = pa && pa.candadoEf > 0 && otros + total > pa.candadoEf + 0.005;
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const base = d.base || { presupuesto: 0, iva: 0 };
  return (
    <Sheet title={d.id ? "Concepto" : "Nuevo concepto"} onClose={() => setModal(null)}>
      <div className="note" style={{ marginBottom: 8 }}>{pa?.nombre}</div>
      <Field label="Concepto"><input autoFocus={!d.id} value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
      <Field label="Proveedor"><SelProveedor value={d.proveedorId} onChange={(v) => set("proveedorId", v)} ctx={ctx} /></Field>
      <div className="g2">
        <Field label="Presupuesto (sin IVA)"><Money value={d.presupuesto} onChange={(v) => { set("presupuesto", v); if (ivaAuto) set("iva", Math.round(v * 16) / 100); }} /></Field>
        <Field label="IVA"><Money value={d.iva} onChange={(v) => set("iva", v)} /></Field>
      </div>
      <label className="chk"><input type="checkbox" checked={ivaAuto} onChange={(e) => { setIvaAuto(e.target.checked); if (e.target.checked) set("iva", Math.round(d.presupuesto * 16) / 100); }} />Calcular IVA 16% automático</label>
      {cambio && <Field label="Motivo del cambio (queda en la bitácora)"><input autoFocus value={motivo} placeholder="Ej. aditiva por cambio de acabado" onChange={(e) => setMotivo(e.target.value)} /></Field>}
      <Field label="Prioridad"><select value={d.prioridad || "sinClasificar"} onChange={(e) => set("prioridad", e.target.value)}>{PRIO_ORDEN.map((k) => <option key={k} value={k}>{PRIO[k]}</option>)}</select></Field>
      <Field label="Estado del presupuesto"><select value={d.estado} onChange={(e) => set("estado", e.target.value)}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Nota"><input value={d.nota} onChange={(e) => set("nota", e.target.value)} /></Field>

      <span className="lbl">Compra y entrega</span>
      <div className="g2">
        <Field label="Estatus"><select value={d.logistica || "porComprar"} onChange={(e) => set("logistica", e.target.value)}>{LOG_ORDEN.map((k) => <option key={k} value={k}>{LOG[k]}</option>)}</select></Field>
        <Field label="Llega el"><input type="date" value={d.eta || ""} onChange={(e) => set("eta", e.target.value)} /></Field>
      </div>
      <Field label="No. de pedido / guía"><input value={d.pedido || ""} onChange={(e) => set("pedido", e.target.value)} /></Field>
      <Field label="Links (tienda, cotización, seguimiento)">
        {(d.links || []).map((l) => (
          <div key={l.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input style={{ flex: 2 }} placeholder="Título" value={l.titulo} onChange={(e) => set("links", d.links.map((x) => (x.id === l.id ? { ...x, titulo: e.target.value } : x)))} />
            <input style={{ flex: 3 }} inputMode="url" placeholder="https://…" value={l.url} onChange={(e) => set("links", d.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
            <button className="btn sm danger" onClick={() => set("links", d.links.filter((x) => x.id !== l.id))}>✕</button>
          </div>
        ))}
        <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => set("links", [...(d.links || []), { id: uid("lk"), titulo: "", url: "" }])}>+ Pegar un link</button>
      </Field>

      <div className="card num" style={{ background: excede ? "var(--badbg)" : "#F5F7F5", borderColor: excede ? "#E3B4AF" : "var(--line)" }}>
        <div className="kv"><span>Total con IVA</span><b>{fm2(total)}</b></div>
        {pa?.candadoEf > 0 && <div className="kv"><span>Candado de la partida</span><b>{fm(pa.candadoEf)}</b></div>}
        {pa?.candadoEf > 0 && <div className="kv"><span>{excede ? "Excede el candado por" : "Quedaría disponible"}</span><b className={excede ? "bad-t" : "ok-t"}>{fm(Math.abs(pa.candadoEf - otros - total))}</b></div>}
        {d.id && <div className="kv"><span>Pagado</span><b>{fm2(pagado)} <span className="note">({pct(pagado, total)}%)</span></b></div>}
        {d.id && <div className="kv"><span>Saldo a ejercer</span><b>{fm2(total - pagado)}</b></div>}
      </div>
      {d.id && (d.ajustes || []).length > 0 && (
        <div style={{ margin: "8px 0" }}>
          <span className="lbl">Bitácora del presupuesto</span>
          <div className="log num">Original: {fm2(base.presupuesto + base.iva)}</div>
          {d.ajustes.map((a) => <div className="log num" key={a.id}>{fecha(a.fecha)}: {fm2(a.anterior)} → {fm2(a.nuevo)} <b className={a.nuevo > a.anterior ? "bad-t" : "ok-t"}>({a.nuevo > a.anterior ? "+" : ""}{fm(a.nuevo - a.anterior)})</b>{a.motivo ? ` · ${a.motivo}` : ""}</div>)}
        </div>
      )}
      {d.id && (
        <div style={{ margin: "6px 0 4px" }}>
          {pagosC.map((x) => (
            <button className="row" key={x.id} onClick={() => setModal({ tipo: "pago", d: { ...x } })}>
              <span className="t"><b>Rel {x.rel} · {x.status}</b><small>{fecha(x.fecha)} · <span className={"pill " + x.forma}>{x.forma}</span> <span className={"pill " + x.estado}>{FLUJO[x.estado]}</span></small></span>
              <span className="amt num"><b>{fm(x.monto)}</b></span>
            </button>
          ))}
          <button className="btn ghost" onClick={() => setModal({ tipo: "pago", d: { tipo: "obra", conceptoId: d.id, proveedorId: d.proveedorId, fecha: HOY(), forma: "Transferencia", monto: Math.max(0, total - pagado), rel: relsOrdenadas.length ? relsOrdenadas[relsOrdenadas.length - 1].n : 1, status: pagado > 0 ? "Finiquito" : "Anticipo", nota: "", estado: "solicitado", deExcedente: false, fase: "" } })}>+ Pago a este concepto</button>
        </div>
      )}
      <div className="acts">
        {d.id && <button className="btn danger" onClick={() => { if (window.confirm("¿Borrar el concepto y sus pagos?")) { borrarConcepto(d.partidaId, d.id); setModal(null); } }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!d.nombre.trim()} onClick={() => { guardarConcepto(d, motivo); setModal(null); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

function ModalPartida({ d0, ctx }) {
  const { p, calc, setModal, guardarPartida, borrarPartida } = ctx;
  const [d, setD] = useState(d0);
  const pa = d.id ? calc.partidas.find((x) => x.id === d.id) : null;
  const traspasos = d.id ? (p.traspasos || []).filter((t) => t.deId === d.id || t.aId === d.id) : [];
  const nombreP = (id) => p.partidas.find((x) => x.id === id)?.nombre || "—";
  return (
    <Sheet title={d.id ? "Partida y candado" : "Nueva partida"} onClose={() => setModal(null)}>
      <Field label="Nombre de la partida"><input autoFocus={!d.id} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></Field>
      <Field label="Candado original"><Money value={d.candado} onChange={(v) => setD({ ...d, candado: v })} /></Field>
      {pa && (pa.recibido > 0 || pa.cedido > 0) && (
        <div className="card num" style={{ background: "#F5F7F5" }}>
          <div className="kv"><span>Candado original</span><b>{fm(pa.candado)}</b></div>
          {pa.recibido > 0 && <div className="kv"><span>Recibido en traspasos</span><b className="ok-t">+{fm(pa.recibido)}</b></div>}
          {pa.cedido > 0 && <div className="kv"><span>Cedido a otras partidas</span><b className="bad-t">−{fm(pa.cedido)}</b></div>}
          <div className="kv tot"><span>Candado vigente</span><b>{fm(pa.candadoEf)}</b></div>
        </div>
      )}
      {traspasos.map((t) => <div className="log num" key={t.id}>{fecha(t.fecha)}: {fm(t.monto)} {t.deId === d.id ? `→ ${nombreP(t.aId)}` : `← ${nombreP(t.deId)}`}{t.motivo ? ` · ${t.motivo}` : ""}</div>)}
      {d.id && <button className="btn ghost" onClick={() => setModal({ tipo: "traspaso", d: { aId: d.id, deId: "", monto: 0, motivo: "", fecha: HOY() } })}>⇄ Traspasar candado de otra partida</button>}
      <p className="note" style={{ marginTop: 8 }}>El candado es el máximo que quieres gastar aquí. Si una partida se pasa, traspásale candado de otra en vez de subirlo: así queda registrado de dónde salió.</p>
      <div className="acts">
        {d.id && <button className="btn danger" onClick={() => { if (window.confirm("¿Borrar la partida con sus conceptos y pagos?")) { borrarPartida(d.id); setModal(null); } }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!d.nombre.trim()} onClick={() => { guardarPartida(d); setModal(null); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

function ModalTraspaso({ d0, ctx }) {
  const { calc, setModal, guardarTraspaso } = ctx;
  const [d, setD] = useState(d0);
  const origen = calc.partidas.find((x) => x.id === d.deId);
  const destino = calc.partidas.find((x) => x.id === d.aId);
  const dejaCorto = origen && origen.candadoEf - d.monto < origen.comprometido - 0.005;
  return (
    <Sheet title="Traspaso de candado" onClose={() => setModal(null)}>
      <Field label="Sale de la partida">
        <select value={d.deId} onChange={(e) => setD({ ...d, deId: e.target.value })}>
          <option value="">Elige la partida origen…</option>
          {calc.partidas.filter((x) => x.id !== d.aId && x.candadoEf > 0).map((x) => <option key={x.id} value={x.id}>{x.nombre} · disponible {fm(x.disponible)}</option>)}
        </select>
      </Field>
      <Field label="Entra a"><input value={destino?.nombre || ""} readOnly /></Field>
      <div className="g2">
        <Field label="Monto"><Money value={d.monto} onChange={(v) => setD({ ...d, monto: v })} /></Field>
        <Field label="Fecha"><input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
      </div>
      <Field label="Motivo"><input value={d.motivo} placeholder="Ej. carpintería creció, jardinería no se ejecutó" onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Field>
      {origen && <div className="card num" style={{ background: dejaCorto ? "var(--badbg)" : "#F5F7F5", borderColor: dejaCorto ? "#E3B4AF" : "var(--line)" }}>
        <div className="kv"><span>{origen.nombre} quedaría en</span><b>{fm(origen.candadoEf - d.monto)}</b></div>
        <div className="kv"><span>y tiene comprometido</span><b className={dejaCorto ? "bad-t" : ""}>{fm(origen.comprometido)}</b></div>
        {destino && <div className="kv"><span>{destino.nombre} quedaría en</span><b>{fm(destino.candadoEf + d.monto)}</b></div>}
      </div>}
      <div className="acts">
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!d.deId || !d.monto} onClick={() => { guardarTraspaso(d); setModal(null); }}>Traspasar</button>
      </div>
    </Sheet>
  );
}

function ModalPago({ d0, ctx }) {
  const { p, calc, setModal, guardarPago, borrarPago, nextRel, conceptoDe, flash } = ctx;
  const [d, setD] = useState({ tipo: "obra", conceptoId: "", proveedorId: "", fecha: HOY(), forma: "Transferencia", monto: 0, rel: nextRel(), status: "Anticipo", nota: "", estado: "solicitado", deExcedente: false, fase: "", ...d0 });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const con = d.tipo === "obra" ? conceptoDe(d.conceptoId) : null;
  const conCalc = con ? calc.partidas.flatMap((x) => x.conceptos).find((x) => x.id === con.id) : null;
  const previo = p.pagos.find((x) => x.id === d.id);
  const yaPagado = conCalc ? conCalc.pagado - (previo && previo.estado === "pagado" ? previo.monto : 0) : 0;
  const sobrepasa = conCalc && conCalc.total > 0 && yaPagado + d.monto > conCalc.total + 0.005;
  const valido = d.monto > 0 && (d.tipo === "honorarios" || d.conceptoId);
  const opciones = [...p.relaciones.map((r) => r.n), nextRel()].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  return (
    <Sheet title={d.id ? "Pago" : "Registrar pago"} onClose={() => setModal(null)}>
      <div className="tabs" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className={d.tipo === "obra" ? "on" : ""} onClick={() => set("tipo", "obra")}>Obra</button>
        <button className={d.tipo === "honorarios" ? "on" : ""} onClick={() => set("tipo", "honorarios")}>Honorarios</button>
      </div>
      {d.tipo === "obra" ? (
        <Field label="Concepto">
          <select value={d.conceptoId} onChange={(e) => { const c = conceptoDe(e.target.value); set("conceptoId", e.target.value); if (c && !d.proveedorId) set("proveedorId", c.proveedorId); }}>
            <option value="">Elige un concepto…</option>
            {p.partidas.map((pa) => <optgroup key={pa.id} label={pa.nombre}>{pa.conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>)}
          </select>
        </Field>
      ) : <Field label="Fase"><input value={d.fase} placeholder="Ej. Anticipo 50%, Término fase 2, Cierre" onChange={(e) => set("fase", e.target.value)} /></Field>}
      <Field label="Proveedor"><SelProveedor value={d.proveedorId} onChange={(v) => set("proveedorId", v)} ctx={ctx} /></Field>
      <div className="g2">
        <Field label="Monto"><Money value={d.monto} onChange={(v) => set("monto", v)} /></Field>
        <Field label={d.estado === "pagado" ? "Fecha de pago" : "Fecha de solicitud"}><input type="date" value={d.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
      </div>
      <div className="g2">
        <Field label="Forma de pago"><select value={d.forma} onChange={(e) => set("forma", e.target.value)}><option>Transferencia</option><option>Efectivo</option></select></Field>
        <Field label="Relación"><select value={d.rel} onChange={(e) => set("rel", parseInt(e.target.value))}>{opciones.map((r) => <option key={r} value={r}>Rel {r}{!p.relaciones.some((x) => x.n === r) ? " (nueva)" : ""}</option>)}</select></Field>
      </div>
      <div className="g2">
        <Field label="Tipo"><select value={d.status} onChange={(e) => set("status", e.target.value)}>{STATUS_PAGO.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Estado"><select value={d.estado} onChange={(e) => set("estado", e.target.value)}>{Object.entries(FLUJO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      {d.forma === "Efectivo" && <label className="chk"><input type="checkbox" checked={!!d.deExcedente} onChange={(e) => set("deExcedente", e.target.checked)} />Se toma del excedente en efectivo a favor</label>}
      <Field label="Nota"><input value={d.nota} onChange={(e) => set("nota", e.target.value)} /></Field>
      {conCalc && conCalc.total > 0 && (
        <div className="card num" style={{ background: sobrepasa ? "var(--badbg)" : "#F5F7F5", borderColor: sobrepasa ? "#E3B4AF" : "var(--line)" }}>
          <div className="kv"><span>Total del concepto</span><b>{fm2(conCalc.total)}</b></div>
          <div className="kv"><span>Pagado antes de este</span><b>{fm2(yaPagado)}</b></div>
          <div className="kv"><span>{sobrepasa ? "Se pasa del total por" : "Quedaría por pagar"}</span><b className={sobrepasa ? "bad-t" : ""}>{fm2(Math.abs(conCalc.total - yaPagado - d.monto))}</b></div>
        </div>
      )}
      {con && conCalc && conCalc.total === 0 && <p className="note">Este concepto no tiene presupuesto capturado; el pago se registra pero no se puede comparar.</p>}
      <div className="acts">
        {d.id && <button className="btn danger" onClick={() => { borrarPago(d.id); setModal(null); }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!valido} onClick={() => { guardarPago(d); setModal(null); flash(d.id ? "Pago actualizado" : "Pago registrado"); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

function ModalRel({ d0, ctx }) {
  const { p, setModal, guardarRel, borrarRel } = ctx;
  const [d, setD] = useState(d0);
  const dup = d.nOriginal !== d.n && p.relaciones.some((x) => x.n === d.n);
  return (
    <Sheet title={d.nOriginal != null ? `Relación ${d.nOriginal}` : "Nueva relación"} onClose={() => setModal(null)}>
      <div className="g2">
        <Field label="Número"><input inputMode="numeric" value={d.n} onChange={(e) => setD({ ...d, n: parseInt(e.target.value) || 0 })} /></Field>
        <Field label="Fecha"><input type="date" value={d.fecha || ""} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
      </div>
      <Field label="Fecha límite de pago"><input type="date" value={d.fechaLimite || ""} onChange={(e) => setD({ ...d, fechaLimite: e.target.value })} /></Field>
      <p className="note">La fecha límite es la que alimenta el flujo de caja de los pagos que aún no salen.</p>
      {dup && <p className="note bad-t">Ya existe una relación con ese número.</p>}
      <div className="acts">
        {d.nOriginal != null && <button className="btn danger" onClick={() => { if (window.confirm("¿Borrar la relación y sus pagos?")) { borrarRel(d.nOriginal); setModal(null); } }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={dup || !d.n} onClick={() => { guardarRel(d); setModal(null); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

function ModalExc({ d0, ctx }) {
  const { setModal, guardarExc, borrarExc } = ctx;
  const [d, setD] = useState(d0);
  return (
    <Sheet title={d.id ? "Excedente a favor" : "Nuevo excedente a favor"} onClose={() => setModal(null)}>
      <Field label="Concepto"><input autoFocus={!d.id} value={d.concepto} placeholder="Ej. devolución de sofá, excedente Relación 3" onChange={(e) => setD({ ...d, concepto: e.target.value })} /></Field>
      <div className="g2">
        <Field label="Monto"><Money value={d.monto} onChange={(v) => setD({ ...d, monto: v })} /></Field>
        <Field label="Fecha"><input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
      </div>
      <div className="acts">
        {d.id && <button className="btn danger" onClick={() => { borrarExc(d.id); setModal(null); }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!d.concepto.trim() || !d.monto} onClick={() => { guardarExc(d); setModal(null); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

function ModalProv({ d0, onSave, ctx }) {
  const { p, calc, setModal, guardarProveedor, borrarProveedor, conceptoDe } = ctx;
  const [d, setD] = useState(d0);
  const conceptos = d.id ? calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => c.proveedorId === d.id).map((c) => ({ ...c, partida: pa.nombre }))) : [];
  const pagos = d.id ? p.pagos.filter((x) => x.proveedorId === d.id) : [];
  const comprometido = conceptos.reduce((s, c) => s + c.total, 0);
  const pagado = pagos.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
  const enTramite = pagos.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0);
  const rels = [...new Set(pagos.map((x) => x.rel))].sort((a, b) => a - b);
  const dup = p.proveedores.some((x) => x.id !== d.id && x.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase());
  return (
    <Sheet title={d.id ? d.nombre : "Nuevo proveedor"} onClose={() => setModal(null)}>
      <Field label="Nombre corto (el que usas al hablar)"><input autoFocus={!d.id} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></Field>
      <Field label="Razón social / titular de la cuenta"><input value={d.razon} onChange={(e) => setD({ ...d, razon: e.target.value })} /></Field>
      <div className="g2">
        <Field label="Banco"><input value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} /></Field>
        <Field label="CLABE"><input inputMode="numeric" value={d.clabe} onChange={(e) => setD({ ...d, clabe: e.target.value.replace(/\s/g, "") })} /></Field>
      </div>
      <div className="g2">
        <Field label="Teléfono"><input value={d.tel} onChange={(e) => setD({ ...d, tel: e.target.value })} /></Field>
        <Field label="Nota"><input value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} /></Field>
      </div>
      {dup && <p className="note bad-t">Ya tienes un proveedor con ese nombre.</p>}
      {d.id && (
        <>
          <div className="card num" style={{ background: "#F5F7F5" }}>
            <div className="kv"><span>Contratado ({conceptos.length} concepto{conceptos.length === 1 ? "" : "s"})</span><b>{fm(comprometido)}</b></div>
            <div className="kv"><span>Pagado</span><b className="ok-t">{fm(pagado)}</b></div>
            {enTramite > 0 && <div className="kv"><span>En trámite</span><b className="warn-t">{fm(enTramite)}</b></div>}
            <div className="kv tot"><span>Saldo por pagarle</span><b>{fm(comprometido - pagado)}</b></div>
            {rels.length > 0 && <div className="kv"><span>Aparece en</span><b>{rels.map((r) => `Rel ${r}`).join(", ")}</b></div>}
          </div>
          {conceptos.map((c) => (
            <button className="row" key={c.id} onClick={() => setModal({ tipo: "concepto", d: { ...c, partidaId: p.partidas.find((pa) => pa.conceptos.some((x) => x.id === c.id)).id } })}>
              <span className="t"><b>{c.nombre}</b><small>{c.partida} · pagado {c.pctPagado}%</small></span>
              <span className="amt num"><b>{fm(c.total)}</b>{c.saldo > 0.005 && <small>saldo {fm(c.saldo)}</small>}</span>
            </button>
          ))}
        </>
      )}
      <div className="acts">
        {d.id && conceptos.length === 0 && pagos.length === 0 && <button className="btn danger" onClick={() => { borrarProveedor(d.id); setModal(null); }}>Borrar</button>}
        <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
        <button className="btn pri" disabled={!d.nombre.trim() || dup} onClick={async () => { const id = await guardarProveedor(d); if (onSave && id) onSave(id); setModal(null); }}>Guardar</button>
      </div>
    </Sheet>
  );
}

// ───────────────────────── app
export default function Tracker({ proyectoId, onCambiarProyecto, onSalir }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState("obra");
  const [abiertas, setAbiertas] = useState({});
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [fCompra, setFCompra] = useState("pendientes");
  const [msg, setMsg] = useState("");
  const [relImprimir, setRelImprimir] = useState(null);
  const loaded = useRef(false);
  const timer = useRef(null);

  const recargar = useCallback(async () => {
    try { setP(await api.cargar(proyectoId)); setError(""); }
    catch (e) { setError(e.message || "No se pudo cargar el proyecto"); }
  }, [proyectoId]);
  useEffect(() => { recargar(); }, [recargar]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const calc = useMemo(() => (p ? calcular(p) : null), [p]);
  if (!p || !calc) return <div className="ob"><style>{css}</style><div className="empty">{error || "Cargando…"}</div></div>;

  const accion = async (fn) => {
    setGuardando(true);
    try { await fn(); await recargar(); }
    catch (e) { setError(e.message || "No se pudo guardar"); flash("No se guardó: " + (e.message || "error")); }
    finally { setGuardando(false); }
  };
  const upd = (fn) => setP((prev) => { const c = structuredClone(prev); fn(c); return c; });
  const conceptosLista = p.partidas.flatMap((pa) => pa.conceptos.map((c) => ({ ...c, partida: pa.nombre })));
  const conceptoDe = (id) => conceptosLista.find((c) => c.id === id);
  const provDe = (id) => p.proveedores.find((x) => x.id === id);
  const nombreProv = (id) => provDe(id)?.nombre || "";
  const relsOrdenadas = [...p.relaciones].sort((a, b) => a.n - b.n);
  const nextRel = () => (p.relaciones.length ? Math.max(...p.relaciones.map((r) => r.n)) + 1 : 1);

  // ─── acciones
  const guardarConcepto = (d, motivo) => accion(async () => {
    const pa = p.partidas.find((x) => x.id === d.partidaId);
    await api.guardarConcepto(d, motivo, pa ? pa.conceptos.length : 0);
  });
  const borrarConcepto = (partidaId, id) => accion(() => api.borrarConcepto(id));
  const guardarPartida = (d) => accion(() => api.guardarPartida(proyectoId, d, p.partidas.length));
  const borrarPartida = (id) => accion(() => api.borrarPartida(id));
  const guardarTraspaso = (d) => accion(() => api.guardarTraspaso(proyectoId, d));
  const borrarTraspaso = (id) => accion(() => api.borrarTraspaso(id));
  const guardarPago = (d) => accion(() => api.guardarPago(proyectoId, d));
  const borrarPago = (id) => accion(() => api.borrarPago(id));
  const marcarPago = (id, estado) => accion(() => api.marcarPago(id, estado, HOY()));
  const marcarRelacion = (nRel, estado) => accion(() => api.marcarRelacion(p.relaciones.find((x) => x.n === nRel).id, estado, HOY()));
  const guardarRel = (d) => accion(() => api.guardarRel(proyectoId, { ...d, id: p.relaciones.find((x) => x.n === d.nOriginal)?.id }));
  const borrarRel = (nRel) => accion(() => api.borrarRel(p.relaciones.find((x) => x.n === nRel).id));
  const guardarExc = (d) => accion(() => api.guardarExc(proyectoId, d));
  const borrarExc = (id) => accion(() => api.borrarExc(id));
  const setLogistica = (conceptoId, val) => accion(() => api.setLogistica(conceptoId, val));
  const guardarMeta = (m) => accion(() => api.guardarMeta(proyectoId, m));
  const borrarProveedor = (id) => accion(() => api.borrarProveedor(id));
  const guardarProveedor = async (d) => {
    setGuardando(true);
    try { const id = await api.guardarProveedor(proyectoId, d); await recargar(); return id; }
    catch (e) { flash("No se guardó: " + (e.message || "error")); return null; }
    finally { setGuardando(false); }
  };

  // ─── exportar / importar
  const descargar = (blob, nombre) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const exportarJSON = () => descargar(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }), `${p.meta.nombre.replace(/\s+/g, "_")}_respaldo.json`);
  const exportarExcel = () => {
    const rels = relsOrdenadas.map((r) => r.n);
    const gen = [[p.meta.nombre], [p.meta.clientes], [], ["Partida", "Concepto", "Proveedor", "Presupuesto", "IVA", "Total", "Presupuesto original", "Ajustes", "Candado vigente", "Comparativa", "Prioridad", "Estado", ...rels.map((r) => `Rel ${r}`), "Total pagado", "% Pagado", "Saldo a ejercer"]];
    for (const pa of calc.partidas) {
      pa.conceptos.forEach((c, i) => {
        const orig = (c.base?.presupuesto || 0) + (c.base?.iva || 0);
        const porRel = rels.map((r) => p.pagos.filter((x) => x.estado === "pagado" && x.conceptoId === c.id && x.rel === r).reduce((s, x) => s + x.monto, 0) || "");
        gen.push([i === 0 ? pa.nombre : "", c.nombre, nombreProv(c.proveedorId), c.presupuesto, c.iva, c.total, orig, c.total - orig || "", i === 0 ? pa.candadoEf : "", i === 0 ? pa.comparativa : "", PRIO[c.prioridad || "sinClasificar"], ESTADOS[c.estado], ...porRel, c.pagado, c.total ? c.pagado / c.total : "", c.saldo]);
      });
      gen.push([]);
    }
    const relTot = (f) => rels.map((r) => p.pagos.filter((x) => x.estado === "pagado" && x.rel === r && f(x)).reduce((s, x) => s + x.monto, 0));
    gen.push(["TOTAL OBRA", "", "", "", "", calc.totalObra, "", "", p.meta.presupuestoObra, calc.comparativaGlobal, "", "", ...relTot((x) => x.tipo === "obra"), calc.pagadoObra, calc.totalObra ? calc.pagadoObra / calc.totalObra : "", calc.totalObra - calc.pagadoObra]);
    gen.push([`Honorarios (${p.meta.pctHonorarios}%)`, "", "", "", "", calc.honorarios, "", "", "", "", "", "", ...relTot((x) => x.tipo === "honorarios"), calc.pagadoHonorarios, calc.honorarios ? calc.pagadoHonorarios / calc.honorarios : "", calc.honorarios - calc.pagadoHonorarios]);
    gen.push(["GRAN TOTAL", "", "", "", "", calc.granTotal, "", "", "", "", "", "", ...relTot(() => true), calc.pagadoTotal, calc.granTotal ? calc.pagadoTotal / calc.granTotal : "", calc.granTotal - calc.pagadoTotal]);

    const reg = [["REGISTRO DE PAGOS"], [], ["No.", "Relación", "Concepto", "Proveedor", "Fecha", "Forma de pago", "Tipo", "Estado", "Monto", "De excedente", "Nota"]];
    [...p.pagos].sort((a, b) => a.rel - b.rel || (a.fecha || "").localeCompare(b.fecha || "")).forEach((x, i) => reg.push([i + 1, x.rel, x.tipo === "honorarios" ? `Honorarios - ${x.fase || ""}` : conceptoDe(x.conceptoId)?.nombre || "", nombreProv(x.proveedorId), x.fecha, x.forma, x.status, FLUJO[x.estado], x.monto, x.deExcedente ? "Sí" : "", x.nota]));
    reg.push([], ["CONTROL EFECTIVO - EXCEDENTE A FAVOR"], ["Concepto", "Fecha", "Excedente a favor"]);
    p.excedentes.forEach((e) => reg.push([e.concepto, e.fecha, e.monto]));
    reg.push(["Total excedente", "", calc.excedenteFavor], ["Usado en pagos", "", calc.excedenteUsado], ["Diferencia", "", calc.excedenteDiferencia]);

    const pv = [["PROVEEDORES"], [], ["Proveedor", "Razón social", "Banco", "CLABE", "Teléfono", "Contratado", "Pagado", "Saldo", "Relaciones"]];
    p.proveedores.forEach((x) => {
      const cs = calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => c.proveedorId === x.id));
      const pgs = p.pagos.filter((y) => y.proveedorId === x.id);
      const comp = cs.reduce((s, c) => s + c.total, 0), pag = pgs.filter((y) => y.estado === "pagado").reduce((s, y) => s + y.monto, 0);
      pv.push([x.nombre, x.razon, x.banco, x.clabe, x.tel, comp, pag, comp - pag, [...new Set(pgs.map((y) => y.rel))].sort((a, b) => a - b).join(", ")]);
    });

    const co = [["COMPRAS Y ENTREGAS"], [], ["Partida", "Concepto", "Proveedor", "Total", "Prioridad", "Estatus", "Llega el", "Pedido / guía", "Links"]];
    calc.partidas.forEach((pa) => pa.conceptos.forEach((c) => {
      if (!(c.links || []).length && (c.logistica || "porComprar") === "porComprar" && !c.total) return;
      co.push([pa.nombre, c.nombre, nombreProv(c.proveedorId), c.total, PRIO[c.prioridad || "sinClasificar"], LOG[c.logistica || "porComprar"], c.eta || "", c.pedido || "", (c.links || []).map((l) => l.url).join("  ")]);
    }));
    const fl = [["FLUJO DE CAJA"], [], ["Mes", "Pagado", "Previsto", "Acumulado"]];
    calc.flujo.forEach((m) => fl.push([m.mes, m.pagado, m.previsto, m.acumulado]));
    const tr = [["TRASPASOS DE CANDADO"], [], ["Fecha", "De", "A", "Monto", "Motivo"]];
    (p.traspasos || []).forEach((t) => tr.push([t.fecha, p.partidas.find((x) => x.id === t.deId)?.nombre || "", p.partidas.find((x) => x.id === t.aId)?.nombre || "", t.monto, t.motivo]));
    const bit = [["BITÁCORA DE PRESUPUESTOS"], [], ["Partida", "Concepto", "Fecha", "Anterior", "Nuevo", "Diferencia", "Motivo"]];
    p.partidas.forEach((pa) => pa.conceptos.forEach((c) => (c.ajustes || []).forEach((a) => bit.push([pa.nombre, c.nombre, a.fecha, a.anterior, a.nuevo, a.nuevo - a.anterior, a.motivo]))));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gen), "General");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg), "Registro de Pagos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pv), "Proveedores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(co), "Compras");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fl), "Flujo de Caja");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tr), "Traspasos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bit), "Bitácora");
    for (const r of relsOrdenadas) {
      const rows = [[p.meta.clientes], [p.meta.nombre], [fecha(r.fecha)], [], [`Relación ${r.n} - Resumen de pagos`], [], ["No.", "Concepto", "Proveedor", "Pago solicitado", "Forma", "Tipo", "Estado", "Datos bancarios"]];
      p.pagos.filter((x) => x.rel === r.n).forEach((x, i) => {
        const v = provDe(x.proveedorId);
        rows.push([i + 1, x.tipo === "honorarios" ? `Honorarios - ${x.fase || ""}` : conceptoDe(x.conceptoId)?.nombre || "", v?.nombre || "", x.monto, x.forma, x.status, FLUJO[x.estado], x.forma === "Transferencia" && v ? `${v.razon || ""} · ${v.banco || ""} · CLABE ${v.clabe || ""}` : ""]);
      });
      const lista = p.pagos.filter((x) => x.rel === r.n);
      rows.push([], ["", "", "Total relación", lista.reduce((s, x) => s + x.monto, 0)], ["", "", "Saldo a pagar", lista.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0)], ["", "", "Fecha límite", fecha(r.fechaLimite)]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Rel-${r.n}`);
    }
    XLSX.writeFile(wb, `Rel_Gastos_${p.meta.nombre.replace(/\s+/g, "_")}.xlsx`);
  };
  const imprimirRel = (nRel) => { setRelImprimir(nRel); setTimeout(() => window.print(), 150); };

  // ───────────────────────── vistas
  const renderObra = () => (
    <>
      <div className="strip">
        <div className="k"><small>Comprometido</small><b className="num">{fm(calc.totalObra)}</b></div>
        <div className="k"><small>Presupuesto obra</small><b className="num">{fm(p.meta.presupuestoObra)}</b></div>
        <div className="k"><small>Diferencia</small><b className={"num " + (calc.comparativaGlobal < 0 ? "bad-t" : "ok-t")}>{fm(calc.comparativaGlobal)}</b></div>
      </div>
      {calc.partidas.map((pa) => {
        const open = !!abiertas[pa.id];
        const base = Math.max(pa.candadoEf, pa.comprometido) || 1;
        return (
          <div className="card" key={pa.id} style={pa.excedido ? { borderColor: "#E3B4AF" } : undefined}>
            <div className="pa-head">
              <button className="row" style={{ padding: 0, borderTop: 0, flex: 1, minWidth: 0 }} onClick={() => setAbiertas((a) => ({ ...a, [pa.id]: !open }))}>
                <span style={{ color: "var(--ink2)", fontSize: 12, width: 12 }}>{open ? "▾" : "▸"}</span>
                <h2>{pa.nombre}</h2>
              </button>
              <button className={"lock num " + (pa.excedido ? "bad" : "")} onClick={() => setModal({ tipo: "partida", d: { id: pa.id, nombre: pa.nombre, candado: pa.candado } })}>
                <span>🔒</span>{pa.candadoEf ? fm(pa.candadoEf) : "Sin candado"}{pa.recibido || pa.cedido ? " ⇄" : ""}
              </button>
            </div>
            <div className="bar">
              <i className={pa.excedido ? "bad" : ""} style={{ width: `${Math.min(100, (pa.pagado / base) * 100)}%` }} />
              <i className={"tram"} style={{ width: `${Math.min(100 - (pa.pagado / base) * 100, ((pa.comprometido - pa.pagado) / base) * 100)}%` }} />
            </div>
            <div className="pa-meta num">
              <span>Comprometido <b style={{ color: "var(--ink)" }}>{fm(pa.comprometido)}</b> · pagado {pa.avance}%</span>
              {pa.candadoEf > 0 && <span className={pa.excedido ? "bad-t" : "ok-t"}>{pa.excedido ? "Excedido " : "Libre "}<b>{fm(Math.abs(pa.comparativa))}</b></span>}
            </div>
            {pa.adelantada && <div className="note warn-t" style={{ marginTop: 4 }}>Va {pa.avance - calc.avanceGlobal} puntos adelante del avance general ({calc.avanceGlobal}%): ya le pagaste más de lo que corresponde al ritmo de la obra.</div>}
            {open && (
              <div style={{ marginTop: 8 }}>
                {pa.conceptos.map((c) => (
                  <button className="row" key={c.id} onClick={() => setModal({ tipo: "concepto", d: { ...c, partidaId: pa.id } })}>
                    <span className={"dot " + c.estado} />
                    <span className="t"><b>{(c.links || []).length ? "🔗 " : ""}{c.nombre}</b><small>{nombreProv(c.proveedorId) || "Sin proveedor"}{c.total > 0 ? ` · pagado ${c.pctPagado}%` : ""}{c.logistica && c.logistica !== "porComprar" ? ` · ${LOG[c.logistica]}` : ""}{(c.ajustes || []).length ? " · ajustado" : ""}</small></span>
                    {c.prioridad && c.prioridad !== "sinClasificar" && <span className={"pr " + c.prioridad}>{PRIO[c.prioridad].slice(0, 4)}</span>}
                    <span className="amt num"><b>{c.total ? fm(c.total) : "—"}</b>{c.saldo > 0.005 && c.total > 0 && <small>saldo {fm(c.saldo)}</small>}</span>
                  </button>
                ))}
                <button className="btn ghost" onClick={() => setModal({ tipo: "concepto", d: { partidaId: pa.id, nombre: "", proveedorId: "", presupuesto: 0, iva: 0, base: { presupuesto: 0, iva: 0 }, ajustes: [], estado: "pendiente", prioridad: "sinClasificar", nota: "", links: [], logistica: "porComprar", pedido: "", eta: "" } })}>+ Concepto</button>
              </div>
            )}
          </div>
        );
      })}
      <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setModal({ tipo: "partida", d: { nombre: "", candado: 0 } })}>+ Partida</button>
    </>
  );

  const renderPagos = () => {
    const lista0 = filtro === "todos" ? p.pagos : p.pagos.filter((x) => x.estado === filtro);
    const grupos = relsOrdenadas.slice().reverse();
    return (
      <>
        <div className="strip">
          <div className="k"><small>Pagado</small><b className="num">{fm(calc.pagadoTotal)}</b></div>
          <div className="k"><small>En trámite</small><b className="num warn-t">{fm(calc.porPagarObra)}</b></div>
          <div className="k"><small>Sin solicitar</small><b className="num">{fm(Math.max(0, calc.granTotal - calc.pagadoTotal - calc.porPagarObra))}</b></div>
        </div>
        <div className="seg">
          {[["todos", "Todos"], ["solicitado", "Solicitados"], ["autorizado", "Autorizados"], ["pagado", "Pagados"]].map(([k, v]) => <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{v}</button>)}
        </div>
        {lista0.length === 0 && <div className="card empty">No hay pagos {filtro === "todos" ? "todavía. Usa “+ Pago”." : `en estado ${FLUJO[filtro].toLowerCase()}.`}</div>}
        {grupos.map((r) => {
          const lista = lista0.filter((x) => x.rel === r.n).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
          if (!lista.length) return null;
          return (
            <div className="card" key={r.n}>
              <div className="pa-head"><h2 style={{ fontSize: 15, margin: 0 }}>Relación {r.n}</h2><span className="note num">{fecha(r.fecha)} · {fm(calc.pagosPorRel[r.n] || 0)}</span></div>
              <div style={{ marginTop: 6 }}>
                {lista.map((x) => (
                  <div key={x.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <button className="row" style={{ borderTop: 0 }} onClick={() => setModal({ tipo: "pago", d: { ...x } })}>
                      <span className="t"><b>{x.tipo === "honorarios" ? `Honorarios · ${x.fase || ""}` : conceptoDe(x.conceptoId)?.nombre || "Concepto eliminado"}</b>
                        <small>{nombreProv(x.proveedorId)} · {fecha(x.fecha)} · <span className={"pill " + x.forma}>{x.forma}</span> <span className={"pill " + x.estado}>{FLUJO[x.estado]}</span>{x.deExcedente && " · de excedente"}</small></span>
                      <span className="amt num"><b>{fm(x.monto)}</b><small>{x.status}</small></span>
                    </button>
                    {x.estado !== "pagado" && (
                      <div className="acts" style={{ margin: "0 0 8px" }}>
                        {x.estado === "solicitado" && <button className="btn sm" onClick={() => marcarPago(x.id, "autorizado")}>Autorizar</button>}
                        <button className="btn sm pri" onClick={() => marcarPago(x.id, "pagado")}>Marcar pagado</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="card">
          <div className="pa-head"><h2 style={{ fontSize: 15, margin: 0 }}>Excedente en efectivo</h2><span className={"note num " + (calc.excedenteDiferencia < 0 ? "bad-t" : "")}>a favor {fm(calc.excedenteDiferencia)}</span></div>
          <p className="note" style={{ margin: "4px 0 6px" }}>Dinero entregado de más o devoluciones. Los pagos marcados “se toma del excedente” lo descuentan.</p>
          {p.excedentes.map((e) => (
            <button className="row" key={e.id} onClick={() => setModal({ tipo: "exc", d: { ...e } })}>
              <span className="t"><b>{e.concepto}</b><small>{fecha(e.fecha)}</small></span><span className="amt num"><b>{fm(e.monto)}</b></span>
            </button>
          ))}
          <div className="kv num" style={{ borderTop: "1px solid var(--line)", marginTop: 4 }}><span>Usado en pagos</span><b>{fm(calc.excedenteUsado)}</b></div>
          <button className="btn ghost" onClick={() => setModal({ tipo: "exc", d: { concepto: "", fecha: HOY(), monto: 0 } })}>+ Excedente a favor</button>
        </div>
      </>
    );
  };

  const renderRelaciones = () => (
    <>
      {relsOrdenadas.length === 0 && <div className="card empty">Las relaciones se crean al registrar pagos o con “+ Relación”. Imprímelas antes de pagar: los pagos en estado Solicitado ya salen en el documento.</div>}
      {relsOrdenadas.slice().reverse().map((r) => {
        const lista = p.pagos.filter((x) => x.rel === r.n);
        const tot = lista.reduce((s, x) => s + x.monto, 0);
        const pend = lista.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0);
        const porAutorizar = lista.filter((x) => x.estado === "solicitado").length;
        return (
          <div className="card" key={r.n}>
            <div className="pa-head">
              <h2 style={{ fontSize: 17 }}>Relación {r.n}</h2>
              <button className="btn sm" onClick={() => setModal({ tipo: "rel", d: { nOriginal: r.n, n: r.n, fecha: r.fecha, fechaLimite: r.fechaLimite } })}>Editar</button>
            </div>
            <div className="kv num"><span>Fecha</span><b>{fecha(r.fecha)}</b></div>
            <div className="kv num"><span>Fecha límite de pago</span><b>{fecha(r.fechaLimite)}</b></div>
            <div className="kv num"><span>{lista.length} pago{lista.length === 1 ? "" : "s"} · total</span><b>{fm(tot)}</b></div>
            <div className="kv num"><span>Saldo a pagar</span><b className={pend > 0 ? "warn-t" : "ok-t"}>{fm(pend)}</b></div>
            <div className="acts" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => setModal({ tipo: "pago", d: { tipo: "obra", conceptoId: "", proveedorId: "", fecha: HOY(), forma: "Transferencia", monto: 0, rel: r.n, status: "Anticipo", nota: "", estado: "solicitado", deExcedente: false, fase: "" } })}>+ Pago aquí</button>
              <button className="btn" onClick={() => imprimirRel(r.n)}>Imprimir</button>
              {porAutorizar > 0 && <button className="btn" onClick={() => marcarRelacion(r.n, "autorizado")}>Autorizar {porAutorizar}</button>}
              {pend > 0 && <button className="btn pri" onClick={() => { if (window.confirm(`¿Marcar como pagados los ${fm(pend)} pendientes de la Relación ${r.n}?`)) marcarRelacion(r.n, "pagado"); }}>Pagar todo</button>}
            </div>
          </div>
        );
      })}
      <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setModal({ tipo: "rel", d: { n: nextRel(), fecha: HOY(), fechaLimite: "" } })}>+ Relación</button>
      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Datos para pagos en efectivo</h2>
        <p className="note" style={{ margin: "0 0 8px" }}>Se imprimen al pie de cada relación.</p>
        <Field label="Dirección de entrega"><input value={p.meta.direccionEfectivo} onChange={(e) => upd((c) => { c.meta.direccionEfectivo = e.target.value; })} onBlur={() => guardarMeta(p.meta)} /></Field>
        <Field label="Contacto / celular"><input value={p.meta.contactoEfectivo} onChange={(e) => upd((c) => { c.meta.contactoEfectivo = e.target.value; })} onBlur={() => guardarMeta(p.meta)} /></Field>
        <Field label="Instrucciones"><textarea rows={2} value={p.meta.instruccionesEfectivo} onChange={(e) => upd((c) => { c.meta.instruccionesEfectivo = e.target.value; })} onBlur={() => guardarMeta(p.meta)} /></Field>
      </div>
    </>
  );

  const renderResumen = () => {
    const data = calc.partidas.filter((x) => x.candadoEf > 0 || x.comprometido > 0).map((x) => ({ nombre: x.nombre, candado: x.candadoEf, comprometido: x.comprometido, excedido: x.excedido }));
    const excedidas = calc.partidas.filter((x) => x.excedido);
    const adelantadas = calc.partidas.filter((x) => x.adelantada);
    const avance = pct(calc.pagadoTotal, calc.granTotal);
    return (
      <>
        <div className="hero">
          <small>Gran total (obra + honorarios {p.meta.pctHonorarios}%)</small>
          <div className="big num">{fm(calc.granTotal)}</div>
          <div className="bar"><i style={{ width: `${Math.min(100, avance)}%`, background: "#7FC79A" }} /><i style={{ width: `${Math.min(100 - avance, pct(calc.porPagarObra, calc.granTotal))}%`, background: "#E0B457" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }} className="num"><span>Pagado {fm(calc.pagadoTotal)} ({avance}%)</span><span>En trámite {fm(calc.porPagarObra)}</span></div>
        </div>
        {(calc.comparativaGlobal < 0 && p.meta.presupuestoObra > 0) && <div className="card" style={{ background: "var(--badbg)", borderColor: "#E3B4AF", color: "var(--bad)", fontWeight: 600 }}>Te pasas del presupuesto de obra por {fm(-calc.comparativaGlobal)}.</div>}
        {excedidas.length > 0 && <div className="card" style={{ background: "var(--warnbg)", borderColor: "#E8CFA0" }}><b className="warn-t">{excedidas.length} partida{excedidas.length > 1 ? "s" : ""} sobre su candado:</b> <span className="num">{excedidas.map((x) => `${x.nombre} (+${fm(-x.comparativa)})`).join(", ")}</span></div>}
        {adelantadas.length > 0 && <div className="card"><b>Pagos adelantados al avance:</b> <span className="note">{adelantadas.map((x) => `${x.nombre} (${x.avance}%)`).join(", ")} · avance general {calc.avanceGlobal}%</span></div>}
        {calc.porPrioridad.length > 1 && (
          <div className="card">
            <h2 style={{ fontSize: 15, margin: "0 0 2px" }}>Qué tanto pesa lo prescindible</h2>
            <p className="note" style={{ margin: "0 0 6px" }}>Si tienes que recortar, esto es lo que hay sobre la mesa.</p>
            {calc.porPrioridad.map((x) => (
              <div className="kv num" key={x.k}>
                <span><span className={"pr " + x.k}>{x.etiqueta}</span> <span className="note">{x.conceptos} concepto{x.conceptos === 1 ? "" : "s"}</span></span>
                <b>{fm(x.monto)}{calc.totalObra > 0 ? <span className="note"> · {pct(x.monto, calc.totalObra)}%</span> : null}</b>
              </div>
            ))}
            {(() => {
              const recortable = calc.porPrioridad.filter((x) => x.k === "opcional" || x.k === "exhibicion").reduce((s, x) => s + x.monto - x.pagado, 0);
              return recortable > 0 ? <p className="note num" style={{ marginTop: 6 }}>Sin pagar en opcionales y exhibiciones: {fm(recortable)}.</p> : null;
            })()}
          </div>
        )}
        {calc.flujo.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: 15, margin: "0 0 2px" }}>Flujo de caja por mes</h2>
            <p className="note" style={{ margin: "0 0 8px" }}>Lo previsto usa la fecha límite de cada relación.</p>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.flujo} margin={{ left: -14, right: 6, top: 4, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#5B6B75" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#5B6B75" }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip formatter={(v, k) => [fm(v), k === "pagado" ? "Pagado" : "Previsto"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "pagado" ? "Pagado" : "Previsto")} />
                  <Bar dataKey="pagado" stackId="a" fill="#2F7D4E" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="previsto" stackId="a" fill="#E0B457" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(() => {
              const pico = calc.flujo.reduce((a, b) => (b.pagado + b.previsto > a.pagado + a.previsto ? b : a));
              const prox = calc.flujo.filter((m) => m.previsto > 0)[0];
              return <p className="note num" style={{ marginTop: 6 }}>Mes más pesado: {pico.mes} con {fm(pico.pagado + pico.previsto)}.{prox ? ` Próxima salida prevista: ${prox.mes}, ${fm(prox.previsto)}.` : ""}</p>;
            })()}
          </div>
        )}
        <div className="card">
          <div className="kv num"><span>Presupuesto de obra</span><b>{fm(p.meta.presupuestoObra)}</b></div>
          <div className="kv num"><span>Suma de candados vigentes</span><b>{fm(calc.totalCandados)}</b></div>
          <div className="kv num"><span>Total obra comprometido</span><b>{fm(calc.totalObra)}</b></div>
          <div className="kv num"><span>Comparativa vs presupuesto</span><b className={calc.comparativaGlobal < 0 ? "bad-t" : "ok-t"}>{fm(calc.comparativaGlobal)}</b></div>
          <div className="kv num"><span>Honorarios ({p.meta.pctHonorarios}%)</span><b>{fm(calc.honorarios)}</b></div>
          <div className="kv num tot"><span>Gran total</span><b>{fm(calc.granTotal)}</b></div>
        </div>
        <div className="card">
          <div className="kv num"><span>Pagado obra</span><b>{fm(calc.pagadoObra)} <span className="note">({pct(calc.pagadoObra, calc.totalObra)}%)</span></b></div>
          <div className="kv num"><span>Pagado honorarios</span><b>{fm(calc.pagadoHonorarios)} <span className="note">({pct(calc.pagadoHonorarios, calc.honorarios)}%)</span></b></div>
          <div className="kv num"><span>Efectivo</span><b>{fm(p.pagos.filter((x) => x.estado === "pagado" && x.forma === "Efectivo").reduce((s, x) => s + x.monto, 0))}</b></div>
          <div className="kv num"><span>Transferencia</span><b>{fm(p.pagos.filter((x) => x.estado === "pagado" && x.forma === "Transferencia").reduce((s, x) => s + x.monto, 0))}</b></div>
          <div className="kv num"><span>Excedente en efectivo a favor</span><b>{fm(calc.excedenteDiferencia)}</b></div>
        </div>
        {data.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>Comprometido vs candado</h2>
            <div style={{ height: Math.max(160, data.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barCategoryGap={8}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" width={118} tick={{ fontSize: 11, fill: "#5B6B75" }} />
                  <Tooltip formatter={(v, k) => [fm(v), k === "candado" ? "Candado" : "Comprometido"]} />
                  <Bar dataKey="candado" fill="#E8D7A6" radius={3} />
                  <Bar dataKey="comprometido" radius={3}>{data.map((d, i) => <Cell key={i} fill={d.excedido ? "#B23A32" : "#2F7D4E"} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {(p.traspasos || []).length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>Traspasos de candado</h2>
            {p.traspasos.map((t) => (
              <div className="row" key={t.id}>
                <span className="t"><b>{p.partidas.find((x) => x.id === t.deId)?.nombre} → {p.partidas.find((x) => x.id === t.aId)?.nombre}</b><small>{fecha(t.fecha)}{t.motivo ? ` · ${t.motivo}` : ""}</small></span>
                <span className="amt num"><b>{fm(t.monto)}</b></span>
                <button className="btn sm danger" onClick={() => borrarTraspaso(t.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderCompras = () => {
    const items = calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => (c.links || []).length > 0 || (c.logistica && c.logistica !== "porComprar") || c.total > 0).map((c) => ({ ...c, partidaNombre: pa.nombre, partidaId: pa.id })));
    const cuenta = (k) => items.filter((x) => (x.logistica || "porComprar") === k).length;
    const vista = fCompra === "pendientes" ? items.filter((x) => !["recibido", "instalado"].includes(x.logistica || "porComprar"))
      : fCompra === "links" ? items.filter((x) => (x.links || []).length > 0)
      : fCompra === "todos" ? items : items.filter((x) => (x.logistica || "porComprar") === fCompra);
    const orden = { porComprar: 0, cotizado: 1, comprado: 2, transito: 3, recibido: 4, instalado: 5 };
    vista.sort((a, b) => (a.eta || "9999").localeCompare(b.eta || "9999") || orden[a.logistica || "porComprar"] - orden[b.logistica || "porComprar"] || a.nombre.localeCompare(b.nombre));
    const conEta = items.filter((x) => x.eta && !["recibido", "instalado"].includes(x.logistica));
    const atrasados = conEta.filter((x) => x.eta < HOY());
    return (
      <>
        <div className="strip">
          <div className="k"><small>Por comprar</small><b className="num">{cuenta("porComprar") + cuenta("cotizado")}</b></div>
          <div className="k"><small>En camino</small><b className="num">{cuenta("comprado") + cuenta("transito")}</b></div>
          <div className="k"><small>Recibido</small><b className="num">{cuenta("recibido") + cuenta("instalado")}</b></div>
        </div>
        {atrasados.length > 0 && <div className="card" style={{ background: "var(--warnbg)", borderColor: "#E8CFA0" }}><b className="warn-t">{atrasados.length} con fecha de entrega vencida:</b> <span className="note">{atrasados.map((x) => x.nombre).join(", ")}</span></div>}
        <div className="seg">
          {[["pendientes", "Pendientes"], ["links", "Con link"], ["porComprar", "Por comprar"], ["comprado", "Comprado"], ["transito", "En camino"], ["recibido", "Recibido"], ["instalado", "Instalado"], ["todos", "Todos"]].map(([k, v]) => <button key={k} className={fCompra === k ? "on" : ""} onClick={() => setFCompra(k)}>{v}</button>)}
        </div>
        {vista.length === 0 && <div className="card empty">Nada aquí. Abre cualquier concepto y pégale el link de la tienda o la cotización.</div>}
        {vista.map((c) => {
          const st = c.logistica || "porComprar";
          const sig = SIGUIENTE[st];
          const tarde = c.eta && c.eta < HOY() && !["recibido", "instalado"].includes(st);
          return (
            <div className="card" key={c.id}>
              <div className="pa-head">
                <button className="row" style={{ padding: 0, borderTop: 0, flex: 1, minWidth: 0 }} onClick={() => setModal({ tipo: "concepto", d: { ...c } })}>
                  <span className="t"><b>{c.nombre}</b><small>{c.partidaNombre}{nombreProv(c.proveedorId) ? ` · ${nombreProv(c.proveedorId)}` : ""}</small></span>
                </button>
                <span className={"est " + st}>{LOG[st]}</span>
              </div>
              <div className="pa-meta num">
                <span>{c.total ? fm(c.total) : "Sin presupuesto"}{c.total > 0 ? ` · pagado ${c.pctPagado}%` : ""}</span>
                {c.eta && <span className={tarde ? "bad-t" : ""}>{tarde ? "Debió llegar " : "Llega "}{fecha(c.eta)}</span>}
              </div>
              {c.pedido && <div className="note num" style={{ marginTop: 4 }}>Pedido / guía: {c.pedido}</div>}
              {(c.links || []).length > 0 && (
                <div style={{ marginTop: 2 }}>
                  {c.links.map((l) => <a className="lk" key={l.id} href={l.url} target="_blank" rel="noreferrer noopener">↗ {l.titulo || new URL(l.url.startsWith("http") ? l.url : "https://" + l.url).hostname.replace("www.", "")}</a>)}
                </div>
              )}
              <div className="acts" style={{ marginTop: 8 }}>
                {sig && <button className="btn sm pri" onClick={() => setLogistica(c.id, sig)}>Marcar {LOG[sig].toLowerCase()}</button>}
                <button className="btn sm" onClick={() => setModal({ tipo: "concepto", d: { ...c } })}>{(c.links || []).length ? "Editar" : "+ Link"}</button>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const renderProveedores = () => {
    const lista = p.proveedores.map((v) => {
      const cs = calc.partidas.flatMap((pa) => pa.conceptos.filter((c) => c.proveedorId === v.id));
      const pgs = p.pagos.filter((x) => x.proveedorId === v.id);
      const comp = cs.reduce((s, c) => s + c.total, 0);
      const pag = pgs.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
      const tram = pgs.filter((x) => x.estado !== "pagado").reduce((s, x) => s + x.monto, 0);
      return { ...v, comp, pag, tram, saldo: comp - pag, nConceptos: cs.length };
    }).sort((a, b) => b.saldo - a.saldo || b.comp - a.comp || a.nombre.localeCompare(b.nombre));
    const conSaldo = lista.filter((x) => x.saldo > 0.005);
    return (
      <>
        <div className="strip">
          <div className="k"><small>Proveedores</small><b className="num">{lista.length}</b></div>
          <div className="k"><small>Con saldo</small><b className="num">{conSaldo.length}</b></div>
          <div className="k"><small>Por pagar</small><b className="num">{fm(conSaldo.reduce((s, x) => s + x.saldo, 0))}</b></div>
        </div>
        {lista.length === 0 && <div className="card empty">Aún no tienes proveedores. Créalos aquí o desde cualquier concepto o pago.</div>}
        <div className="card">
          {lista.map((v) => (
            <button className="row" key={v.id} onClick={() => setModal({ tipo: "prov", d: { ...v } })}>
              <span className="t"><b>{v.nombre}</b><small>{v.nConceptos} concepto{v.nConceptos === 1 ? "" : "s"}{v.clabe ? " · CLABE guardada" : " · sin datos bancarios"}</small></span>
              <span className="amt num"><b>{fm(v.comp)}</b>{v.saldo > 0.005 ? <small className="warn-t">saldo {fm(v.saldo)}</small> : <small className="ok-t">liquidado</small>}</span>
            </button>
          ))}
          <button className="btn ghost" onClick={() => setModal({ tipo: "prov", d: { nombre: "", razon: "", banco: "", clabe: "", tel: "", nota: "" } })}>+ Proveedor</button>
        </div>
      </>
    );
  };

  const renderAjustes = () => (
    <>
      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Proyecto</h2>
        <Field label="Nombre del proyecto"><input value={p.meta.nombre} onChange={(e) => upd((c) => { c.meta.nombre = e.target.value; })} onBlur={() => guardarMeta(p.meta)} /></Field>
        <Field label="Clientes"><input value={p.meta.clientes} placeholder="Ej. José y Lynda" onChange={(e) => upd((c) => { c.meta.clientes = e.target.value; })} onBlur={() => guardarMeta(p.meta)} /></Field>
        <div className="g2">
          <Field label="Presupuesto de obra"><Money value={p.meta.presupuestoObra} onChange={(v) => guardarMeta({ ...p.meta, presupuestoObra: v })} /></Field>
          <Field label="Honorarios %"><Money value={p.meta.pctHonorarios} onChange={(v) => guardarMeta({ ...p.meta, pctHonorarios: v })} /></Field>
        </div>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Respaldo y exportación</h2>
        <div className="acts" style={{ marginTop: 0 }}>
          <button className="btn pri" onClick={exportarExcel}>Exportar Excel</button>
          <button className="btn" onClick={exportarJSON}>Respaldo JSON</button>
        </div>
        <p className="note" style={{ marginTop: 8 }}>El Excel sale con General, Registro de Pagos, Compras, Proveedores, Flujo de Caja, Traspasos, Bitácora y una hoja por relación.</p>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Sesión</h2>
        <div className="acts" style={{ marginTop: 0 }}>
          <button className="btn" onClick={onCambiarProyecto}>Cambiar de proyecto</button>
          <button className="btn danger" onClick={onSalir}>Cerrar sesión</button>
        </div>
      </div>
    </>
  );

  const renderRelPrint = () => {
    const r = p.relaciones.find((x) => x.n === relImprimir);
    if (!r) return null;
    const lista = p.pagos.filter((x) => x.rel === r.n);
    const tot = lista.reduce((s, x) => s + x.monto, 0);
    const pagadoR = lista.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
    return (
      <div className="print">
        <div style={{ textAlign: "right" }}><b>{p.meta.clientes}</b><br />{p.meta.nombre}<br />{fecha(r.fecha)}</div>
        <h2 className="serif" style={{ fontSize: 20, margin: "16px 0 4px" }}>Relación {r.n} - Resumen de pagos</h2>
        <table>
          <thead><tr><th>No.</th><th>Concepto</th><th>Proveedor</th><th className="r">Pago solicitado</th><th>Forma</th><th>Status</th></tr></thead>
          <tbody>
            {lista.map((x, i) => {
              const v = provDe(x.proveedorId);
              return (
                <tr key={x.id}>
                  <td>{i + 1}</td>
                  <td>{x.tipo === "honorarios" ? `Honorarios - ${x.fase || ""}` : conceptoDe(x.conceptoId)?.nombre || ""}{x.nota ? <div style={{ fontSize: 10, color: "#555" }}>{x.nota}</div> : null}</td>
                  <td>{v?.nombre || ""}{x.forma === "Transferencia" && v && (v.razon || v.clabe) ? <div style={{ fontSize: 10, color: "#333" }}>{v.razon && `Nombre: ${v.razon}  `}{v.banco && `Banco: ${v.banco}  `}{v.clabe && `CLABE: ${v.clabe}`}</div> : null}</td>
                  <td className="r num">{fm2(x.monto)}</td>
                  <td>{x.forma}</td>
                  <td>{x.status}{x.estado === "pagado" ? " - Pagado" : x.estado === "autorizado" ? " - Autorizado" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <table style={{ width: "auto", marginLeft: "auto" }}>
          <tbody>
            <tr><td>Total relación {r.n}</td><td className="r num"><b>{fm2(tot)}</b></td></tr>
            <tr><td>Pagado</td><td className="r num">{fm2(pagadoR)}</td></tr>
            <tr><td>Saldo a pagar</td><td className="r num"><b>{fm2(tot - pagadoR)}</b></td></tr>
            <tr><td>Fecha límite de pago</td><td className="r">{fecha(r.fechaLimite)}</td></tr>
          </tbody>
        </table>
        {lista.some((x) => x.forma === "Efectivo") && (p.meta.direccionEfectivo || p.meta.contactoEfectivo) && (
          <div style={{ marginTop: 24 }}>
            <b>PAGOS EN EFECTIVO</b>
            {p.meta.direccionEfectivo && <div>Dirección: {p.meta.direccionEfectivo}</div>}
            {p.meta.contactoEfectivo && <div>Contacto: {p.meta.contactoEfectivo}</div>}
            {p.meta.instruccionesEfectivo && <div style={{ marginTop: 6 }}>{p.meta.instruccionesEfectivo}</div>}
          </div>
        )}
      </div>
    );
  };

  const ctx = { p, calc, setModal, flash, conceptoDe, provDe, nombreProv, relsOrdenadas, nextRel, guardarConcepto, borrarConcepto, guardarPartida, borrarPartida, guardarTraspaso, guardarPago, borrarPago, guardarRel, borrarRel, guardarExc, borrarExc, guardarProveedor, borrarProveedor, setLogistica };
  const TABS = [["obra", "Obra"], ["compras", "Compras"], ["pagos", "Pagos"], ["rel", "Rels"], ["resumen", "Resumen"], ["prov", "Provs"], ["ajustes", "Ajustes"]];
  return (
    <div className="ob">
      <style>{css}</style>
      <div className="top no-print">
        <h1>{p.meta.nombre}</h1>
        <div className="sub num">{guardando ? "Guardando…" : error ? <span className="bad-t">{error}</span> : p.meta.clientes || "Sin clientes capturados"} · pagado {pct(calc.pagadoTotal, calc.granTotal)}%{calc.porPagarObra > 0 ? ` · ${fm(calc.porPagarObra)} en trámite` : ""}</div>
        <div className="tabs">{TABS.map(([k, v]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{v}</button>)}</div>
      </div>
      <div className="wrap no-print">
        {tab === "obra" && renderObra()}
        {tab === "compras" && renderCompras()}
        {tab === "pagos" && renderPagos()}
        {tab === "rel" && renderRelaciones()}
        {tab === "resumen" && renderResumen()}
        {tab === "prov" && renderProveedores()}
        {tab === "ajustes" && renderAjustes()}
      </div>
      {(tab === "obra" || tab === "pagos") && <button className="fab no-print" onClick={() => setModal({ tipo: "pago", d: {} })}>+ Pago</button>}
      {msg && <div style={{ position: "fixed", left: 16, right: 16, bottom: 78, background: "var(--ink)", color: "#fff", padding: "10px 14px", borderRadius: 10, fontSize: 14, zIndex: 30, textAlign: "center" }}>{msg}</div>}
      {modal?.tipo === "concepto" && <ModalConcepto d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "partida" && <ModalPartida d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "traspaso" && <ModalTraspaso d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "pago" && <ModalPago d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "rel" && <ModalRel d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "exc" && <ModalExc d0={modal.d} ctx={ctx} />}
      {modal?.tipo === "prov" && <ModalProv d0={modal.d} onSave={modal.onSave} ctx={ctx} />}
      {renderRelPrint()}
    </div>
  );
}
