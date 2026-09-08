import { supabase } from "./supabase.js";

const ok = ({ data, error }) => { if (error) throw error; return data; };

// ── proyectos ────────────────────────────────────────────────
export async function listaProyectos() {
  return ok(await supabase.from("proyectos").select("id,nombre,clientes,archivado").order("created_at", { ascending: false }));
}

export async function crearProyecto(nombre, clientes = "") {
  const { data: { user } } = await supabase.auth.getUser();
  return ok(await supabase.from("proyectos").insert({ nombre, clientes, owner_id: user.id }).select().single());
}

// Carga el proyecto completo en la forma que usa la interfaz.
export async function cargar(proyectoId) {
  const [proy, provs, parts, rels, pags, excs, tras] = await Promise.all([
    supabase.from("proyectos").select("*").eq("id", proyectoId).single(),
    supabase.from("proveedores").select("*").eq("proyecto_id", proyectoId).order("nombre"),
    supabase.from("partidas").select("*").eq("proyecto_id", proyectoId).order("orden"),
    supabase.from("relaciones").select("*").eq("proyecto_id", proyectoId).order("numero"),
    supabase.from("pagos").select("*").eq("proyecto_id", proyectoId),
    supabase.from("excedentes").select("*").eq("proyecto_id", proyectoId).order("fecha"),
    supabase.from("traspasos").select("*").eq("proyecto_id", proyectoId).order("fecha"),
  ]).then((r) => r.map(ok));

  const partIds = parts.map((x) => x.id);
  const cons = partIds.length ? ok(await supabase.from("conceptos").select("*").in("partida_id", partIds).order("orden")) : [];
  const conIds = cons.map((x) => x.id);
  const [links, ajus] = conIds.length
    ? await Promise.all([
        supabase.from("concepto_links").select("*").in("concepto_id", conIds).order("created_at"),
        supabase.from("concepto_ajustes").select("*").in("concepto_id", conIds).order("fecha"),
      ]).then((r) => r.map(ok))
    : [[], []];

  const linksDe = {}; links.forEach((l) => (linksDe[l.concepto_id] ||= []).push({ id: l.id, titulo: l.titulo || "", url: l.url }));
  const ajusDe = {}; ajus.forEach((a) => (ajusDe[a.concepto_id] ||= []).push({ id: a.id, fecha: a.fecha, anterior: +a.anterior, nuevo: +a.nuevo, motivo: a.motivo || "" }));
  const numDe = {}; rels.forEach((r) => (numDe[r.id] = r.numero));

  return {
    id: proy.id,
    meta: {
      nombre: proy.nombre, clientes: proy.clientes || "",
      presupuestoObra: +proy.presupuesto_obra, pctHonorarios: +proy.pct_honorarios,
      direccionEfectivo: proy.direccion_efectivo || "", contactoEfectivo: proy.contacto_efectivo || "",
      instruccionesEfectivo: proy.instrucciones_efectivo || "",
    },
    proveedores: provs.map((v) => ({ id: v.id, nombre: v.nombre, razon: v.razon || "", banco: v.banco || "", clabe: v.clabe || "", tel: v.tel || "", nota: v.nota || "" })),
    partidas: parts.map((pa) => ({
      id: pa.id, nombre: pa.nombre, candado: +pa.candado, orden: pa.orden,
      conceptos: cons.filter((c) => c.partida_id === pa.id).map((c) => ({
        id: c.id, nombre: c.nombre, proveedorId: c.proveedor_id || "",
        presupuesto: +c.presupuesto, iva: +c.iva,
        base: { presupuesto: +c.base_presupuesto, iva: +c.base_iva },
        estado: c.estado, prioridad: c.prioridad || "sinClasificar", logistica: c.logistica, pedido: c.pedido || "", eta: c.eta || "", nota: c.nota || "",
        links: linksDe[c.id] || [], ajustes: ajusDe[c.id] || [],
      })),
    })),
    relaciones: rels.map((r) => ({ id: r.id, n: r.numero, fecha: r.fecha || "", fechaLimite: r.fecha_limite || "" })),
    pagos: pags.map((x) => ({
      id: x.id, tipo: x.tipo, conceptoId: x.concepto_id || "", proveedorId: x.proveedor_id || "",
      rel: numDe[x.relacion_id] ?? 0, relacionId: x.relacion_id,
      monto: +x.monto, fecha: x.fecha, forma: x.forma, status: x.status, estado: x.estado,
      deExcedente: x.de_excedente, nota: x.nota || "", fase: x.fase || "",
    })),
    excedentes: excs.map((e) => ({ id: e.id, concepto: e.concepto, monto: +e.monto, fecha: e.fecha })),
    traspasos: tras.map((t) => ({ id: t.id, deId: t.de_id, aId: t.a_id, monto: +t.monto, fecha: t.fecha, motivo: t.motivo || "" })),
  };
}

// ── meta ─────────────────────────────────────────────────────
export const guardarMeta = (proyectoId, m) => supabase.from("proyectos").update({
  nombre: m.nombre, clientes: m.clientes, presupuesto_obra: m.presupuestoObra, pct_honorarios: m.pctHonorarios,
  direccion_efectivo: m.direccionEfectivo, contacto_efectivo: m.contactoEfectivo, instrucciones_efectivo: m.instruccionesEfectivo,
}).eq("id", proyectoId).then(ok);

// ── proveedores ──────────────────────────────────────────────
export async function guardarProveedor(proyectoId, d) {
  const row = { proyecto_id: proyectoId, nombre: d.nombre.trim(), razon: d.razon, banco: d.banco, clabe: d.clabe, tel: d.tel, nota: d.nota };
  if (d.id) { await supabase.from("proveedores").update(row).eq("id", d.id).then(ok); return d.id; }
  const r = ok(await supabase.from("proveedores").insert(row).select("id").single());
  return r.id;
}
export const borrarProveedor = (id) => supabase.from("proveedores").delete().eq("id", id).then(ok);

// ── partidas ─────────────────────────────────────────────────
export async function guardarPartida(proyectoId, d, orden = 0) {
  if (d.id) return supabase.from("partidas").update({ nombre: d.nombre, candado: d.candado }).eq("id", d.id).then(ok);
  return supabase.from("partidas").insert({ proyecto_id: proyectoId, nombre: d.nombre, candado: d.candado, orden }).then(ok);
}
export const borrarPartida = (id) => supabase.from("partidas").delete().eq("id", id).then(ok);

// ── conceptos ────────────────────────────────────────────────
export async function guardarConcepto(d, motivo, orden = 0) {
  const row = {
    nombre: d.nombre, proveedor_id: d.proveedorId || null, presupuesto: d.presupuesto, iva: d.iva,
    estado: d.estado, prioridad: d.prioridad || "sinClasificar", logistica: d.logistica || "porComprar", pedido: d.pedido || "", eta: d.eta || null, nota: d.nota || "",
  };
  let id = d.id;
  if (id) {
    // el trigger de la base escribe la bitácora; le pasamos el motivo por sesión
    if (motivo) await supabase.rpc("set_motivo", { texto: motivo }).catch(() => {});
    await supabase.from("conceptos").update(row).eq("id", id).then(ok);
  } else {
    const r = ok(await supabase.from("conceptos").insert({
      ...row, partida_id: d.partidaId, orden, base_presupuesto: d.presupuesto, base_iva: d.iva,
    }).select("id").single());
    id = r.id;
  }
  await sincronizarLinks(id, d.links || []);
  return id;
}
export const borrarConcepto = (id) => supabase.from("conceptos").delete().eq("id", id).then(ok);
export const setLogistica = (id, logistica) => supabase.from("conceptos").update({ logistica }).eq("id", id).then(ok);

async function sincronizarLinks(conceptoId, links) {
  const actuales = ok(await supabase.from("concepto_links").select("id").eq("concepto_id", conceptoId));
  const vivos = links.filter((l) => l.url.trim());
  const idsVivos = new Set(vivos.map((l) => l.id));
  const sobran = actuales.filter((a) => !idsVivos.has(a.id)).map((a) => a.id);
  if (sobran.length) await supabase.from("concepto_links").delete().in("id", sobran).then(ok);
  for (const l of vivos) {
    const url = l.url.trim().startsWith("http") ? l.url.trim() : `https://${l.url.trim()}`;
    if (actuales.some((a) => a.id === l.id)) await supabase.from("concepto_links").update({ titulo: l.titulo, url }).eq("id", l.id).then(ok);
    else await supabase.from("concepto_links").insert({ concepto_id: conceptoId, titulo: l.titulo, url }).then(ok);
  }
}

// ── traspasos ────────────────────────────────────────────────
export const guardarTraspaso = (proyectoId, d) => supabase.from("traspasos").insert({
  proyecto_id: proyectoId, de_id: d.deId, a_id: d.aId, monto: d.monto, fecha: d.fecha, motivo: d.motivo,
}).then(ok);
export const borrarTraspaso = (id) => supabase.from("traspasos").delete().eq("id", id).then(ok);

// ── relaciones ───────────────────────────────────────────────
export async function relacionPorNumero(proyectoId, numero, fecha) {
  const hay = ok(await supabase.from("relaciones").select("id").eq("proyecto_id", proyectoId).eq("numero", numero).maybeSingle());
  if (hay) return hay.id;
  const r = ok(await supabase.from("relaciones").insert({ proyecto_id: proyectoId, numero, fecha: fecha || null }).select("id").single());
  return r.id;
}
export const guardarRel = (proyectoId, d) => (d.id
  ? supabase.from("relaciones").update({ numero: d.n, fecha: d.fecha || null, fecha_limite: d.fechaLimite || null }).eq("id", d.id).then(ok)
  : supabase.from("relaciones").insert({ proyecto_id: proyectoId, numero: d.n, fecha: d.fecha || null, fecha_limite: d.fechaLimite || null }).then(ok));
export const borrarRel = (id) => supabase.from("relaciones").delete().eq("id", id).then(ok);

// ── pagos ────────────────────────────────────────────────────
export async function guardarPago(proyectoId, d) {
  const relacionId = await relacionPorNumero(proyectoId, d.rel, d.fecha);
  const row = {
    proyecto_id: proyectoId, relacion_id: relacionId,
    concepto_id: d.tipo === "obra" ? d.conceptoId : null,
    proveedor_id: d.proveedorId || null, tipo: d.tipo, fase: d.fase || "",
    monto: d.monto, fecha: d.fecha, forma: d.forma, status: d.status, estado: d.estado,
    de_excedente: !!d.deExcedente, nota: d.nota || "",
  };
  if (d.id) await supabase.from("pagos").update(row).eq("id", d.id).then(ok);
  else await supabase.from("pagos").insert(row).then(ok);
  if (d.proveedorId && d.tipo === "obra" && d.conceptoId) {
    const c = ok(await supabase.from("conceptos").select("proveedor_id").eq("id", d.conceptoId).single());
    if (!c.proveedor_id) await supabase.from("conceptos").update({ proveedor_id: d.proveedorId }).eq("id", d.conceptoId).then(ok);
  }
}
export const borrarPago = (id) => supabase.from("pagos").delete().eq("id", id).then(ok);
export const marcarPago = (id, estado, fecha) => supabase.from("pagos")
  .update(estado === "pagado" ? { estado, fecha } : { estado }).eq("id", id).then(ok);
export const marcarRelacion = (relacionId, estado, fecha) => supabase.from("pagos")
  .update(estado === "pagado" ? { estado, fecha } : { estado })
  .eq("relacion_id", relacionId).neq("estado", "pagado").then(ok);

// ── excedentes ───────────────────────────────────────────────
export const guardarExc = (proyectoId, d) => (d.id
  ? supabase.from("excedentes").update({ concepto: d.concepto, monto: d.monto, fecha: d.fecha }).eq("id", d.id).then(ok)
  : supabase.from("excedentes").insert({ proyecto_id: proyectoId, concepto: d.concepto, monto: d.monto, fecha: d.fecha }).then(ok));
export const borrarExc = (id) => supabase.from("excedentes").delete().eq("id", id).then(ok);

// ── carga inicial de un proyecto completo (respaldo JSON del artefacto) ──
export async function importarProyecto(json) {
  const proy = await crearProyecto(json.meta.nombre, json.meta.clientes);
  await guardarMeta(proy.id, json.meta);

  const mapProv = {};
  for (const v of json.proveedores || []) mapProv[v.id] = await guardarProveedor(proy.id, { ...v, id: null });

  const mapPart = {}, mapCon = {};
  let i = 0;
  for (const pa of json.partidas) {
    const r = ok(await supabase.from("partidas").insert({ proyecto_id: proy.id, nombre: pa.nombre, candado: pa.candado, orden: i++ }).select("id").single());
    mapPart[pa.id] = r.id;
    let j = 0;
    const filas = pa.conceptos.map((c) => ({
      partida_id: r.id, nombre: c.nombre, proveedor_id: mapProv[c.proveedorId] || null,
      presupuesto: c.presupuesto, iva: c.iva,
      base_presupuesto: c.base?.presupuesto ?? c.presupuesto, base_iva: c.base?.iva ?? c.iva,
      estado: c.estado || "pendiente", prioridad: c.prioridad || "sinClasificar", logistica: c.logistica || "porComprar",
      pedido: c.pedido || "", eta: c.eta || null, nota: c.nota || "", orden: j++,
    }));
    if (filas.length) {
      const ins = ok(await supabase.from("conceptos").insert(filas).select("id"));
      pa.conceptos.forEach((c, k) => (mapCon[c.id] = ins[k].id));
      const links = pa.conceptos.flatMap((c) => (c.links || []).map((l) => ({ concepto_id: mapCon[c.id], titulo: l.titulo || "", url: l.url })));
      if (links.length) await supabase.from("concepto_links").insert(links).then(ok);
    }
  }

  const mapRel = {};
  for (const r of json.relaciones || []) {
    const ins = ok(await supabase.from("relaciones").insert({ proyecto_id: proy.id, numero: r.n, fecha: r.fecha || null, fecha_limite: r.fechaLimite || null }).select("id").single());
    mapRel[r.n] = ins.id;
  }
  for (const t of json.traspasos || []) {
    await supabase.from("traspasos").insert({ proyecto_id: proy.id, de_id: mapPart[t.deId], a_id: mapPart[t.aId], monto: t.monto, fecha: t.fecha, motivo: t.motivo || "" }).then(ok);
  }
  const pagos = (json.pagos || []).map((x) => ({
    proyecto_id: proy.id, relacion_id: mapRel[x.rel] || null,
    concepto_id: x.tipo === "obra" ? mapCon[x.conceptoId] || null : null,
    proveedor_id: mapProv[x.proveedorId] || null, tipo: x.tipo, fase: x.fase || "",
    monto: x.monto, fecha: x.fecha, forma: x.forma, status: x.status,
    estado: x.estado || (x.pagado ? "pagado" : "solicitado"), de_excedente: !!x.deExcedente, nota: x.nota || "",
  })).filter((x) => x.monto > 0 && (x.tipo === "honorarios" || x.concepto_id));
  for (let k = 0; k < pagos.length; k += 200) await supabase.from("pagos").insert(pagos.slice(k, k + 200)).then(ok);

  const excs = (json.excedentes || []).map((e) => ({ proyecto_id: proy.id, concepto: e.concepto, monto: e.monto, fecha: e.fecha }));
  if (excs.length) await supabase.from("excedentes").insert(excs).then(ok);

  return proy.id;
}
