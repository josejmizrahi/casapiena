import { z } from "zod";
import { supabase } from "./supabase";
import * as api from "@/api";

// Respaldo JSON (v3, el que genera "Respaldo JSON" y el artefacto original).
const idish = z.string();
const link = z.object({ id: idish.optional(), titulo: z.string().default(""), url: z.string() });
const concepto = z.object({
  id: idish, nombre: z.string(), proveedorId: z.string().default(""), presupuesto: z.number().default(0), iva: z.number().default(0),
  base: z.object({ presupuesto: z.number(), iva: z.number() }).optional(),
  estado: z.string().default("pendiente"), prioridad: z.string().default("sinClasificar"), logistica: z.string().default("porComprar"),
  pedido: z.string().default(""), eta: z.string().default(""), nota: z.string().default(""), links: z.array(link).default([]),
});
const respaldo = z.object({
  v: z.number().optional(),
  meta: z.object({
    nombre: z.string(), clientes: z.string().default(""), presupuestoObra: z.number().default(0), pctHonorarios: z.number().default(15),
    direccionEfectivo: z.string().default(""), contactoEfectivo: z.string().default(""), instruccionesEfectivo: z.string().default(""),
  }),
  proveedores: z.array(z.object({ id: idish, nombre: z.string(), razon: z.string().default(""), banco: z.string().default(""), clabe: z.string().default(""), tel: z.string().default(""), nota: z.string().default("") })).default([]),
  partidas: z.array(z.object({ id: idish, nombre: z.string(), candado: z.number().default(0), conceptos: z.array(concepto).default([]) })),
  relaciones: z.array(z.object({ n: z.number(), fecha: z.string().default(""), fechaLimite: z.string().default("") })).default([]),
  traspasos: z.array(z.object({ deId: idish, aId: idish, monto: z.number(), fecha: z.string(), motivo: z.string().default("") })).default([]),
  pagos: z.array(z.object({
    tipo: z.string(), conceptoId: z.string().default(""), proveedorId: z.string().default(""), rel: z.number().default(0), fase: z.string().default(""),
    monto: z.number(), fecha: z.string(), forma: z.string(), status: z.string(), estado: z.string().optional(), pagado: z.boolean().optional(),
    deExcedente: z.boolean().default(false), nota: z.string().default(""),
  })).default([]),
  excedentes: z.array(z.object({ concepto: z.string(), monto: z.number(), fecha: z.string() })).default([]),
});
export type Respaldo = z.infer<typeof respaldo>;

export function validarRespaldo(texto: string): Respaldo {
  let json: unknown;
  try { json = JSON.parse(texto); } catch { throw new Error("El archivo no es JSON válido."); }
  const r = respaldo.safeParse(json);
  if (!r.success) throw new Error("El respaldo no tiene la forma esperada: " + r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  return r.data;
}

const ok = <T,>({ data, error }: { data: T | null; error: { message: string } | null }): T => { if (error) throw new Error(error.message); return data as T; };

/** Crea un proyecto nuevo con todo el contenido del respaldo. Devuelve su id. */
export async function importarProyecto(json: Respaldo, onProgreso?: (t: string) => void): Promise<string> {
  onProgreso?.("Creando proyecto…");
  const proy = await api.crearProyecto(json.meta.nombre, json.meta.clientes);
  await api.guardarMeta(proy.id, json.meta);

  const mapProv: Record<string, string> = {};
  for (const v of json.proveedores) mapProv[v.id] = await api.guardarProveedor(proy.id, { ...v, id: undefined });

  const mapPart: Record<string, string> = {}, mapCon: Record<string, string> = {};
  let i = 0;
  for (const pa of json.partidas) {
    onProgreso?.(`Partida ${i + 1} de ${json.partidas.length}…`);
    const r = ok<{ id: string }>(await supabase.from("partidas").insert({ proyecto_id: proy.id, nombre: pa.nombre, candado: pa.candado, orden: i++ }).select("id").single());
    mapPart[pa.id] = r.id;
    const filas = pa.conceptos.map((c, j) => ({
      partida_id: r.id, nombre: c.nombre, proveedor_id: mapProv[c.proveedorId] || null, presupuesto: c.presupuesto, iva: c.iva,
      base_presupuesto: c.base?.presupuesto ?? c.presupuesto, base_iva: c.base?.iva ?? c.iva,
      estado: c.estado, prioridad: c.prioridad, logistica: c.logistica, pedido: c.pedido, eta: c.eta || null, nota: c.nota, orden: j,
    }));
    if (!filas.length) continue;
    const ins = ok<{ id: string }[]>(await supabase.from("conceptos").insert(filas).select("id"));
    pa.conceptos.forEach((c, k) => (mapCon[c.id] = ins[k].id));
    const links = pa.conceptos.flatMap((c) => c.links.filter((l) => l.url).map((l) => ({ concepto_id: mapCon[c.id], titulo: l.titulo, url: l.url })));
    if (links.length) await supabase.from("concepto_links").insert(links).then(ok);
  }

  const mapRel: Record<number, string> = {};
  for (const r of json.relaciones) {
    const ins = ok<{ id: string }>(await supabase.from("relaciones").insert({ proyecto_id: proy.id, numero: r.n, fecha: r.fecha || null, fecha_limite: r.fechaLimite || null }).select("id").single());
    mapRel[r.n] = ins.id;
  }
  for (const t of json.traspasos) {
    if (!mapPart[t.deId] || !mapPart[t.aId]) continue;
    await supabase.from("traspasos").insert({ proyecto_id: proy.id, de_id: mapPart[t.deId], a_id: mapPart[t.aId], monto: t.monto, fecha: t.fecha, motivo: t.motivo }).then(ok);
  }
  onProgreso?.("Pagos…");
  const pagos = json.pagos.map((x) => ({
    proyecto_id: proy.id, relacion_id: mapRel[x.rel] || null,
    concepto_id: x.tipo === "obra" ? mapCon[x.conceptoId] || null : null, proveedor_id: mapProv[x.proveedorId] || null,
    tipo: x.tipo, fase: x.fase, monto: x.monto, fecha: x.fecha, forma: x.forma, status: x.status,
    estado: x.estado || (x.pagado ? "pagado" : "solicitado"), de_excedente: x.deExcedente, nota: x.nota,
  })).filter((x) => x.monto > 0 && (x.tipo === "honorarios" || x.concepto_id));
  for (let k = 0; k < pagos.length; k += 200) await supabase.from("pagos").insert(pagos.slice(k, k + 200)).then(ok);
  const excs = json.excedentes.map((e) => ({ proyecto_id: proy.id, concepto: e.concepto, monto: e.monto, fecha: e.fecha }));
  if (excs.length) await supabase.from("excedentes").insert(excs).then(ok);
  return proy.id;
}
