/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import type { Adjunto, CatalogoProveedor, Concepto, Excedente, Meta, Miembro, Pago, Partida, Perfil, PlantillaGuardada, PlantillaPartida, Proveedor, Proyecto, ProyectoResumen, Relacion, Traspaso } from "@/lib/types";

const ok = <T,>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

// ── proyectos ────────────────────────────────────────────────
export async function listaProyectos(): Promise<ProyectoResumen[]> {
  return ok(await supabase.from("proyectos").select("id,nombre,clientes,archivado,created_at,presupuesto_obra,owner_id").order("created_at", { ascending: false }));
}
export async function crearProyecto(nombre: string, clientes = ""): Promise<{ id: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  return ok(await supabase.from("proyectos").insert({ nombre, clientes, owner_id: user!.id }).select("id").single());
}
export const archivarProyecto = (id: string, archivado: boolean) => supabase.from("proyectos").update({ archivado }).eq("id", id).then(ok);
export const borrarProyecto = (id: string) => supabase.from("proyectos").delete().eq("id", id).then(ok);

// Carga el proyecto completo en la forma que usa la interfaz.
export async function cargar(proyectoId: string): Promise<Proyecto> {
  const [proy, provs, parts, rels, pags, excs, tras] = (await Promise.all([
    supabase.from("proyectos").select("*").eq("id", proyectoId).single(),
    supabase.from("proveedores").select("*").eq("proyecto_id", proyectoId).order("nombre"),
    supabase.from("partidas").select("*").eq("proyecto_id", proyectoId).order("orden"),
    supabase.from("relaciones").select("*").eq("proyecto_id", proyectoId).order("numero"),
    supabase.from("pagos").select("*").eq("proyecto_id", proyectoId),
    supabase.from("excedentes").select("*").eq("proyecto_id", proyectoId).order("fecha"),
    supabase.from("traspasos").select("*").eq("proyecto_id", proyectoId).order("fecha"),
  ])).map((r) => ok<any>(r));

  const partIds = parts.map((x: any) => x.id);
  const cons: any[] = partIds.length ? ok(await supabase.from("conceptos").select("*").in("partida_id", partIds).order("orden")) : [];
  const conIds = cons.map((x) => x.id);
  const [links, ajus]: any[][] = conIds.length
    ? (await Promise.all([
        supabase.from("concepto_links").select("*").in("concepto_id", conIds).order("created_at"),
        supabase.from("concepto_ajustes").select("*").in("concepto_id", conIds).order("fecha"),
      ])).map((r) => ok<any>(r))
    : [[], []];

  return armarProyecto({ proy, provs, parts, cons, links, ajus, rels, pags, excs, tras });
}

/** Convierte filas de la base en el Proyecto que usa la interfaz. Lo usan cargar() y el reporte público. */
export function armarProyecto(f: { proy: any; provs: any[]; parts: any[]; cons: any[]; links: any[]; ajus: any[]; rels: any[]; pags: any[]; excs: any[]; tras: any[] }): Proyecto {
  const { proy, provs, parts, cons, links, ajus, rels, pags, excs, tras } = f;
  const linksDe: Record<string, Concepto["links"]> = {};
  for (const l of links) (linksDe[l.concepto_id] ||= []).push({ id: l.id, titulo: l.titulo || "", url: l.url });
  const ajusDe: Record<string, Concepto["ajustes"]> = {};
  for (const a of ajus) (ajusDe[a.concepto_id] ||= []).push({ id: a.id, fecha: a.fecha, anterior: +a.anterior, nuevo: +a.nuevo, motivo: a.motivo || "" });
  const numDe: Record<string, number> = {};
  for (const r of rels) numDe[r.id] = r.numero;

  return {
    id: proy.id,
    meta: {
      nombre: proy.nombre, clientes: proy.clientes || "",
      presupuestoObra: +proy.presupuesto_obra, pctHonorarios: +proy.pct_honorarios,
      direccionEfectivo: proy.direccion_efectivo || "", contactoEfectivo: proy.contacto_efectivo || "", instruccionesEfectivo: proy.instrucciones_efectivo || "",
    },
    proveedores: provs.map((v: any) => ({ id: v.id, nombre: v.nombre, razon: v.razon || "", banco: v.banco || "", clabe: v.clabe || "", tel: v.tel || "", nota: v.nota || "" })),
    partidas: parts.map((pa: any): Partida => ({
      id: pa.id, nombre: pa.nombre, candado: +pa.candado, orden: pa.orden, contingencia: !!pa.contingencia,
      conceptos: cons.filter((c) => c.partida_id === pa.id).map((c): Concepto => ({
        id: c.id, partidaId: pa.id, nombre: c.nombre, proveedorId: c.proveedor_id || "",
        presupuesto: +c.presupuesto, iva: +c.iva, base: { presupuesto: +c.base_presupuesto, iva: +c.base_iva },
        cantidad: +c.cantidad || 1, unidad: c.unidad || "", precioUnitario: +c.precio_unitario || 0, avance: +c.avance || 0,
        estado: c.estado, prioridad: c.prioridad || "sinClasificar", logistica: c.logistica || "porComprar",
        pedido: c.pedido || "", eta: c.eta || "", nota: c.nota || "", links: linksDe[c.id] || [], ajustes: ajusDe[c.id] || [],
      })),
    })),
    relaciones: rels.map((r: any): Relacion => ({ id: r.id, n: r.numero, fecha: r.fecha || "", fechaLimite: r.fecha_limite || "" })),
    pagos: pags.map((x: any): Pago => ({
      id: x.id, tipo: x.tipo, conceptoId: x.concepto_id || "", proveedorId: x.proveedor_id || "",
      rel: numDe[x.relacion_id] ?? 0, relacionId: x.relacion_id, monto: +x.monto, fecha: x.fecha, forma: x.forma, status: x.status, estado: x.estado,
      deExcedente: !!x.de_excedente, nota: x.nota || "", fase: x.fase || "",
    })),
    excedentes: excs.map((e: any): Excedente => ({ id: e.id, concepto: e.concepto, monto: +e.monto, fecha: e.fecha })),
    traspasos: tras.map((t: any): Traspaso => ({ id: t.id, deId: t.de_id, aId: t.a_id, monto: +t.monto, fecha: t.fecha, motivo: t.motivo || "" })),
  };
}

// ── meta ─────────────────────────────────────────────────────
export const guardarMeta = (proyectoId: string, m: Meta) => supabase.from("proyectos").update({
  nombre: m.nombre, clientes: m.clientes, presupuesto_obra: m.presupuestoObra, pct_honorarios: m.pctHonorarios,
  direccion_efectivo: m.direccionEfectivo, contacto_efectivo: m.contactoEfectivo, instrucciones_efectivo: m.instruccionesEfectivo,
}).eq("id", proyectoId).then(ok);

// ── proveedores ──────────────────────────────────────────────
export async function guardarProveedor(proyectoId: string, d: Partial<Proveedor> & { nombre: string }): Promise<string> {
  const row = { proyecto_id: proyectoId, nombre: d.nombre.trim(), razon: d.razon || "", banco: d.banco || "", clabe: d.clabe || "", tel: d.tel || "", nota: d.nota || "" };
  if (d.id) { await supabase.from("proveedores").update(row).eq("id", d.id).then(ok); return d.id; }
  const r = ok<{ id: string }>(await supabase.from("proveedores").insert(row).select("id").single());
  return r.id;
}
export const borrarProveedor = (id: string) => supabase.from("proveedores").delete().eq("id", id).then(ok);

// ── partidas ─────────────────────────────────────────────────
export async function guardarPartida(proyectoId: string, d: { id?: string; nombre: string; candado: number; contingencia?: boolean }, orden = 0) {
  const row = { nombre: d.nombre, candado: d.candado, contingencia: !!d.contingencia };
  if (d.id) return supabase.from("partidas").update(row).eq("id", d.id).then(ok);
  return supabase.from("partidas").insert({ proyecto_id: proyectoId, ...row, orden }).then(ok);
}
export const borrarPartida = (id: string) => supabase.from("partidas").delete().eq("id", id).then(ok);

// ── conceptos ────────────────────────────────────────────────
export type ConceptoForm = Omit<Concepto, "id" | "ajustes" | "base"> & { id?: string; base?: Concepto["base"]; ajustes?: Concepto["ajustes"] };
export async function guardarConcepto(d: ConceptoForm, motivo: string, orden = 0): Promise<string> {
  const row = {
    nombre: d.nombre, proveedor_id: d.proveedorId || null, presupuesto: d.presupuesto, iva: d.iva,
    cantidad: d.cantidad || 1, unidad: d.unidad || "", precio_unitario: d.precioUnitario || 0,
    avance: Math.max(0, Math.min(100, d.avance || 0)),
    estado: d.estado, prioridad: d.prioridad || "sinClasificar", logistica: d.logistica || "porComprar",
    pedido: d.pedido || "", eta: d.eta || null, nota: d.nota || "",
  };
  let id = d.id;
  if (id) {
    // el trigger de la base escribe la bitácora; le pasamos el motivo por sesión
    if (motivo) await supabase.rpc("set_motivo", { texto: motivo });
    // la línea base es el primer presupuesto distinto de cero
    const baseCero = !d.base || d.base.presupuesto + d.base.iva <= 0.005;
    const conBase = baseCero && d.presupuesto + d.iva > 0.005 ? { ...row, base_presupuesto: d.presupuesto, base_iva: d.iva } : row;
    await supabase.from("conceptos").update(conBase).eq("id", id).then(ok);
  } else {
    const r = ok<{ id: string }>(await supabase.from("conceptos").insert({ ...row, partida_id: d.partidaId, orden, base_presupuesto: d.presupuesto, base_iva: d.iva }).select("id").single());
    id = r.id;
  }
  await sincronizarLinks(id, d.links || []);
  return id;
}
export const borrarConcepto = (id: string) => supabase.from("conceptos").delete().eq("id", id).then(ok);
// Al marcar instalado, el avance físico queda en 100.
export const setLogistica = (id: string, logistica: string) => supabase.from("conceptos").update(logistica === "instalado" ? { logistica, avance: 100 } : { logistica }).eq("id", id).then(ok);
export const setAvance = (id: string, avance: number) => supabase.from("conceptos").update({ avance: Math.max(0, Math.min(100, avance)) }).eq("id", id).then(ok);

async function sincronizarLinks(conceptoId: string, links: Concepto["links"]) {
  const actuales = ok<{ id: string }[]>(await supabase.from("concepto_links").select("id").eq("concepto_id", conceptoId));
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
export const guardarTraspaso = (proyectoId: string, d: Omit<Traspaso, "id">) => supabase.from("traspasos").insert({
  proyecto_id: proyectoId, de_id: d.deId, a_id: d.aId, monto: d.monto, fecha: d.fecha, motivo: d.motivo,
}).then(ok);
export const borrarTraspaso = (id: string) => supabase.from("traspasos").delete().eq("id", id).then(ok);

// ── relaciones ───────────────────────────────────────────────
export async function relacionPorNumero(proyectoId: string, numero: number, fecha: string): Promise<string> {
  const hay = ok<{ id: string } | null>(await supabase.from("relaciones").select("id").eq("proyecto_id", proyectoId).eq("numero", numero).maybeSingle());
  if (hay) return hay.id;
  const r = ok<{ id: string }>(await supabase.from("relaciones").insert({ proyecto_id: proyectoId, numero, fecha: fecha || null }).select("id").single());
  return r.id;
}
export const guardarRel = (proyectoId: string, d: { id?: string; n: number; fecha: string; fechaLimite: string }) => (d.id
  ? supabase.from("relaciones").update({ numero: d.n, fecha: d.fecha || null, fecha_limite: d.fechaLimite || null }).eq("id", d.id).then(ok)
  : supabase.from("relaciones").insert({ proyecto_id: proyectoId, numero: d.n, fecha: d.fecha || null, fecha_limite: d.fechaLimite || null }).then(ok));
export const borrarRel = (id: string) => supabase.from("relaciones").delete().eq("id", id).then(ok);

// ── pagos ────────────────────────────────────────────────────
export type PagoForm = Omit<Pago, "id" | "relacionId"> & { id?: string };
export async function guardarPago(proyectoId: string, d: PagoForm) {
  const relacionId = await relacionPorNumero(proyectoId, d.rel, d.fecha);
  const row = {
    proyecto_id: proyectoId, relacion_id: relacionId,
    concepto_id: d.tipo === "obra" ? d.conceptoId : null, proveedor_id: d.proveedorId || null,
    tipo: d.tipo, fase: d.fase || "", monto: d.monto, fecha: d.fecha, forma: d.forma, status: d.status, estado: d.estado,
    de_excedente: !!d.deExcedente, nota: d.nota || "",
  };
  if (d.id) await supabase.from("pagos").update(row).eq("id", d.id).then(ok);
  else await supabase.from("pagos").insert(row).then(ok);
  if (d.proveedorId && d.tipo === "obra" && d.conceptoId) {
    const c = ok<{ proveedor_id: string | null }>(await supabase.from("conceptos").select("proveedor_id").eq("id", d.conceptoId).single());
    if (!c.proveedor_id) await supabase.from("conceptos").update({ proveedor_id: d.proveedorId }).eq("id", d.conceptoId).then(ok);
  }
}
export const borrarPago = (id: string) => supabase.from("pagos").delete().eq("id", id).then(ok);
export const marcarPago = (id: string, estado: string, fecha: string) => supabase.from("pagos")
  .update(estado === "pagado" ? { estado, fecha } : { estado }).eq("id", id).then(ok);
export const marcarRelacion = (relacionId: string, estado: string, fecha: string) => supabase.from("pagos")
  .update(estado === "pagado" ? { estado, fecha } : { estado }).eq("relacion_id", relacionId).neq("estado", "pagado").then(ok);

// ── excedentes ───────────────────────────────────────────────
export const guardarExc = (proyectoId: string, d: Omit<Excedente, "id"> & { id?: string }) => (d.id
  ? supabase.from("excedentes").update({ concepto: d.concepto, monto: d.monto, fecha: d.fecha }).eq("id", d.id).then(ok)
  : supabase.from("excedentes").insert({ proyecto_id: proyectoId, concepto: d.concepto, monto: d.monto, fecha: d.fecha }).then(ok));
export const borrarExc = (id: string) => supabase.from("excedentes").delete().eq("id", id).then(ok);

// ── miembros ─────────────────────────────────────────────────
export async function listaMiembros(proyectoId: string): Promise<Miembro[]> {
  return ok(await supabase.rpc("miembros_de", { p: proyectoId }));
}
/** Devuelve "agregado" si el correo ya tenía cuenta, o "invitado" si quedó pendiente. */
export const agregarMiembro = async (proyectoId: string, email: string, rol: string): Promise<"agregado" | "invitado"> => ok(await supabase.rpc("agregar_miembro", { p: proyectoId, correo: email, r: rol }));
export const quitarMiembro = (proyectoId: string, userId: string) => supabase.from("proyecto_miembros").delete().eq("proyecto_id", proyectoId).eq("user_id", userId).then(ok);
export const quitarInvitacion = (proyectoId: string, email: string) => supabase.from("invitaciones").delete().eq("proyecto_id", proyectoId).eq("email", email).then(ok);

// ── catálogo de proveedores (por usuario, entre proyectos) ──────
export async function listaCatalogo(): Promise<CatalogoProveedor[]> {
  return ok(await supabase.from("catalogo_proveedores").select("id,nombre,razon,banco,clabe,tel,nota").order("nombre"));
}
/** Guarda o actualiza en el catálogo por nombre. No falla la operación principal si esto falla. */
export async function recordarEnCatalogo(d: Omit<CatalogoProveedor, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("catalogo_proveedores").upsert({ user_id: user.id, nombre: d.nombre.trim(), razon: d.razon || "", banco: d.banco || "", clabe: d.clabe || "", tel: d.tel || "", nota: d.nota || "", updated_at: new Date().toISOString() }, { onConflict: "user_id,nombre" });
}
export const borrarDelCatalogo = (id: string) => supabase.from("catalogo_proveedores").delete().eq("id", id).then(ok);

// ── plantillas guardadas por el usuario ─────────────────────────
export async function listaPlantillas(): Promise<PlantillaGuardada[]> {
  return ok(await supabase.from("plantillas").select("id,nombre,descripcion,cuerpo,created_at").order("created_at", { ascending: false }));
}
export const guardarPlantilla = (nombre: string, descripcion: string, cuerpo: PlantillaPartida[]) => supabase.from("plantillas").insert({ nombre, descripcion, cuerpo }).then(ok);
export const borrarPlantilla = (id: string) => supabase.from("plantillas").delete().eq("id", id).then(ok);

// ── adjuntos (Supabase Storage, bucket privado "adjuntos") ─────
const BUCKET = "adjuntos";
export async function listaAdjuntos(proyectoId: string): Promise<Adjunto[]> {
  const rows = ok<any[]>(await supabase.from("adjuntos").select("*").eq("proyecto_id", proyectoId).order("created_at"));
  return rows.map((a) => ({ id: a.id, proyectoId: a.proyecto_id, conceptoId: a.concepto_id, pagoId: a.pago_id, nombre: a.nombre, ruta: a.ruta, tipo: a.tipo || "", tamano: a.tamano || 0, createdAt: a.created_at }));
}
export async function subirAdjunto(proyectoId: string, destino: { conceptoId?: string; pagoId?: string }, file: File) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ruta = `${proyectoId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  await supabase.from("adjuntos").insert({ proyecto_id: proyectoId, concepto_id: destino.conceptoId || null, pago_id: destino.pagoId || null, nombre: file.name, ruta, tipo: file.type || "", tamano: file.size }).then(ok);
}
export async function borrarAdjunto(a: Adjunto) {
  await supabase.storage.from(BUCKET).remove([a.ruta]);
  await supabase.from("adjuntos").delete().eq("id", a.id).then(ok);
}
/** URLs firmadas (una hora) para abrir o previsualizar. */
export async function urlsFirmadas(rutas: string[]): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const d of data || []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
  return out;
}

// ── perfil (nombre, despacho, logo) ─────────────────────────────
const LOGOS = "logos";
const logoUrl = (ruta: string) => (ruta ? supabase.storage.from(LOGOS).getPublicUrl(ruta).data.publicUrl : "");
export async function miPerfil(): Promise<Perfil> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { nombre: "", despacho: "", telefono: "", logoUrl: "" };
  const r = ok<any>(await supabase.from("perfiles").select("nombre,despacho,telefono,logo_ruta").eq("user_id", user.id).maybeSingle());
  return { nombre: r?.nombre || "", despacho: r?.despacho || "", telefono: r?.telefono || "", logoUrl: logoUrl(r?.logo_ruta || "") };
}
/** Perfil del dueño de un proyecto (para "preparado por" en el reporte). */
export async function perfilDe(userId: string): Promise<Perfil> {
  const r = ok<any>(await supabase.from("perfiles").select("nombre,despacho,telefono,logo_ruta").eq("user_id", userId).maybeSingle());
  return { nombre: r?.nombre || "", despacho: r?.despacho || "", telefono: r?.telefono || "", logoUrl: logoUrl(r?.logo_ruta || "") };
}
export async function guardarPerfil(d: { nombre: string; despacho: string; telefono: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  await supabase.from("perfiles").upsert({ user_id: user.id, nombre: d.nombre, despacho: d.despacho, telefono: d.telefono, updated_at: new Date().toISOString() }).then(ok);
}
export async function subirLogo(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ruta = `${user.id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(LOGOS).upload(ruta, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw new Error(error.message);
  await supabase.from("perfiles").upsert({ user_id: user.id, logo_ruta: ruta, updated_at: new Date().toISOString() }).then(ok);
  return logoUrl(ruta);
}
export async function quitarLogo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("perfiles").upsert({ user_id: user.id, logo_ruta: "", updated_at: new Date().toISOString() }).then(ok);
}

// ── liga pública del reporte ────────────────────────────────────
export async function ligaReporte(proyectoId: string): Promise<string | null> {
  const r = ok<{ token: string }[]>(await supabase.from("ligas_reporte").select("token").eq("proyecto_id", proyectoId).eq("activa", true).limit(1));
  return r[0]?.token || null;
}
export const crearLigaReporte = async (proyectoId: string): Promise<string> => ok(await supabase.rpc("crear_liga_reporte", { p: proyectoId }));
export const desactivarLigaReporte = (proyectoId: string) => supabase.from("ligas_reporte").update({ activa: false }).eq("proyecto_id", proyectoId).then(ok);
/** Proyecto completo para el reporte público, o null si la liga no existe o se desactivó. */
export async function reportePublico(token: string): Promise<{ proyecto: Proyecto; perfil: Perfil } | null> {
  const d = ok<any>(await supabase.rpc("reporte_publico", { t: token }));
  if (!d) return null;
  const proyecto = armarProyecto({ proy: d.proyecto, provs: d.proveedores, parts: d.partidas, cons: d.conceptos, links: [], ajus: d.ajustes, rels: d.relaciones, pags: d.pagos, excs: d.excedentes, tras: d.traspasos });
  const pf = d.perfil || {};
  return { proyecto, perfil: { nombre: pf.nombre || "", despacho: pf.despacho || "", telefono: pf.telefono || "", logoUrl: logoUrl(pf.logo_ruta || "") } };
}
