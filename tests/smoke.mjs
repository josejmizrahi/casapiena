// Recorre la app compilada (dist/) en Chromium con Supabase simulado. Falla si
// cualquier pantalla o diálogo lanza un error de JavaScript. Uso: npm test [vacio|lleno]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const seed = JSON.parse(fs.readFileSync(new URL("../seed/casapiena_inicial.json", import.meta.url), "utf8"));
const PID = "11111111-1111-1111-1111-111111111111", UID = "2367ee79-38ac-4120-aa0a-35b6a649b25d", PROV = "22222222-2222-2222-2222-222222222222";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "prueba@casapiena.mx", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: "fake.fake.fake", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const modo = process.argv[2] || "lleno";
const lleno = modo === "lleno";

// datos en forma de filas de la base, a partir del seed
const partidas = seed.partidas.map((pa, i) => ({ id: `p${i}`.padEnd(36, "0"), proyecto_id: PID, nombre: pa.nombre, candado: i === 0 ? 250000 : i === 7 ? 40000 : 0, orden: i, contingencia: i === 7 }));
const conceptos = seed.partidas.flatMap((pa, i) => pa.conceptos.map((c, j) => ({ id: `c${i}-${j}`.padEnd(36, "0"), partida_id: partidas[i].id, nombre: c.nombre, proveedor_id: j === 0 ? PROV : null, presupuesto: j === 0 ? 50000 : 0, iva: j === 0 ? 8000 : 0, base_presupuesto: j === 0 ? 40000 : 0, base_iva: j === 0 ? 6400 : 0, cantidad: j === 0 ? 2 : 1, unidad: j === 0 ? "pza" : "", precio_unitario: j === 0 ? 25000 : 0, avance: j === 0 && i === 0 ? 25 : 0, estado: j === 0 ? "cerrado" : "pendiente", prioridad: c.prioridad, logistica: j === 0 ? "comprado" : "porComprar", pedido: "", eta: j === 0 ? "2026-01-15" : null, nota: "", orden: j })));
const proyecto = { id: PID, nombre: "Casa Piena", clientes: "Familia M.", presupuesto_obra: 1500000, pct_honorarios: 15, direccion_efectivo: "Calle 1", contacto_efectivo: "Ana", instrucciones_efectivo: "", owner_id: UID, archivado: false, created_at: "2026-01-01T00:00:00Z" };
const tablas = {
  proveedores: [{ id: PROV, proyecto_id: PID, nombre: "Muebles SA", razon: "Muebles SA de CV", banco: "BBVA", clabe: "0123", tel: "", nota: "" }],
  partidas, conceptos,
  concepto_links: [{ id: "l1", concepto_id: conceptos[0].id, titulo: "Tienda", url: "https://ejemplo.com/x", created_at: "2026-01-01" }],
  concepto_ajustes: [{ id: "a1", concepto_id: conceptos[0].id, fecha: "2026-09-01", anterior: 40000, nuevo: 58000, motivo: "cambio" }],
  relaciones: [{ id: "r1", proyecto_id: PID, numero: 1, fecha: "2026-09-01", fecha_limite: "2026-09-15" }],
  pagos: [
    { id: "g1", proyecto_id: PID, relacion_id: "r1", concepto_id: conceptos[0].id, proveedor_id: PROV, tipo: "obra", fase: "", monto: 20000, fecha: "2026-09-02", forma: "Transferencia", status: "Anticipo", estado: "pagado", de_excedente: false, nota: "" },
    { id: "g2", proyecto_id: PID, relacion_id: "r1", concepto_id: conceptos[0].id, proveedor_id: PROV, tipo: "obra", fase: "", monto: 10000, fecha: "2026-09-10", forma: "Efectivo", status: "Liquidación", estado: "solicitado", de_excedente: false, nota: "" },
    { id: "g3", proyecto_id: PID, relacion_id: "r1", concepto_id: null, proveedor_id: null, tipo: "honorarios", fase: "1", monto: 5000, fecha: "2026-09-02", forma: "Transferencia", status: "Anticipo", estado: "pagado", de_excedente: false, nota: "" },
  ],
  excedentes: [{ id: "e1", proyecto_id: PID, concepto: "Ahorro", monto: 3000, fecha: "2026-09-03" }],
  traspasos: [{ id: "t1", proyecto_id: PID, de_id: partidas[0].id, a_id: partidas[1].id, monto: 10000, fecha: "2026-09-04", motivo: "ajuste" }],
};

const PORT = 4173 + Math.floor(Math.random() * 500);
const raiz = fileURLToPath(new URL("..", import.meta.url));
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", cwd: raiz });
for (let i = 0; i < 100; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const salir = (code) => { server.kill(); process.exit(code); };

const browser = await chromium.launch();
const errors = [];
const pasos = [];
async function conVista(nombre, viewport, fn) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(`PAGEERROR (${nombre}): ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`CONSOLE (${nombre}): ${m.text().slice(0, 300)}`); });
  // las fuentes web no importan para la prueba y no hay red en el sandbox
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  await page.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url()); const t = u.pathname.split("/").pop();
    let body = "[]";
    if (u.pathname.includes("/rpc/")) body = t === "miembros_de" ? JSON.stringify([{ user_id: "u2", email: "socia@casapiena.mx", rol: "editor" }]) : "null";
    else if (r.request().method() !== "GET") body = JSON.stringify(t === "proyectos" ? { id: PID } : [{ id: "nuevo".padEnd(36, "0") }]);
    else if (t === "proyectos") body = JSON.stringify(u.searchParams.get("select") === "*" ? proyecto : [proyecto, { ...proyecto, id: "3".padEnd(36, "3"), nombre: "Otra casa", archivado: true, owner_id: "otro" }]);
    else if (lleno && tablas[t]) body = JSON.stringify(tablas[t]);
    r.fulfill({ status: 200, contentType: "application/json", body });
  });
  await page.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), ["sb-hbshsolmbekqrixumvue-auth-token", session]);
  const paso = async (titulo, f) => {
    const antes = errors.length;
    try { await f(); await page.waitForTimeout(200); } catch (e) { errors.push(`PASO ${nombre} · ${titulo}: ${e.message.split("\n")[0]}`); }
    pasos.push(`${nombre} · ${titulo}${errors.length > antes ? " ✗" : " ✓"}`);
  };
  const dialogo = async () => { await page.waitForSelector("[role=dialog]", { timeout: 4000 }); await page.keyboard.press("Escape"); await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 4000 }); };
  try { await fn(page, paso, dialogo); } catch (e) { errors.push(`FATAL (${nombre}): ${e.message.split("\n")[0]}`); }
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${nombre}.png`, fullPage: true });
  await page.close();
}

// Sin sesión: debe aparecer el login
await conVista("login", { width: 420, height: 860 }, async (page, paso) => {
  await page.addInitScript(() => localStorage.clear());
  await paso("pantalla de entrada", async () => { await page.goto(`http://localhost:${PORT}/`); await page.waitForSelector("input[type=email]", { timeout: 8000 }); });
});

for (const [nombre, viewport] of [["movil", { width: 420, height: 860 }], ["escritorio", { width: 1280, height: 900 }]]) {
  await conVista(nombre, viewport, async (page, paso, dialogo) => {
    await paso("lista de proyectos", async () => { await page.goto(`http://localhost:${PORT}/`); await page.waitForSelector("text=Casa Piena", { timeout: 8000 }); });
    await paso("archivados", async () => { await page.click("button:has-text('Archivados')"); await page.waitForSelector("text=Otra casa"); await page.click("button:has-text('Activos')"); });
    await paso("asistente: 4 pasos y crear", async () => {
      await page.click("header button:has-text('Nuevo')");
      await page.waitForSelector("[role=dialog]");
      await page.fill("[role=dialog] input >> nth=0", "Obra de prueba");
      await page.fill("[role=dialog] input[inputmode=decimal] >> nth=0", "1000000");
      await page.click("button:has-text('Siguiente')");
      await page.click("button:has-text('Remodelación')");
      await page.click("button:has-text('Siguiente')");
      await page.waitForSelector("text=Asignado en candados");
      await page.click("button:has-text('Siguiente')");
      await page.waitForSelector("text=Candados asignados");
      await page.click("button:has-text('Crear proyecto')");
      await page.waitForURL(`**/#/p/${PID}/hoy`, { timeout: 8000 });
      await page.waitForSelector("text=Requiere tu atención");
      await page.goto(`http://localhost:${PORT}/`); await page.waitForSelector("text=Casa Piena");
    });
    await paso("abrir proyecto (Hoy)", async () => { await page.click(`a[href="#/p/${PID}"] >> nth=0`); await page.waitForSelector("text=Requiere tu atención", { timeout: 8000 }); if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${nombre}-hoy.png`, fullPage: true }); });
    await paso("guía del método", async () => { await page.click("button:has-text('Guía')"); await page.waitForSelector("text=Partidas y candados"); await page.keyboard.press("Escape"); await page.waitForSelector("[role=dialog]", { state: "detached" }); });
    const ir = async (ruta) => {
      const link = page.locator(`a[href="#/p/${PID}/${ruta}"]`).locator("visible=true");
      if (await link.count() === 0) await page.click("button:has-text('Más')");
      await page.locator(`a[href="#/p/${PID}/${ruta}"]`).locator("visible=true").first().click();
    };
    for (const ruta of ["compras", "pagos", "relaciones", "resumen", "proveedores", "ajustes", "obra", "hoy", "obra"]) await paso(`vista ${ruta}`, async () => { await ir(ruta); await page.waitForURL(`**/#/p/${PID}/${ruta}`); await page.waitForTimeout(400); if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${nombre}-${ruta}.png`, fullPage: true }); });
    if (lleno) {
      await paso("obra: abrir partida", async () => { await page.click(`button:has-text("${seed.partidas[0].nombre}")`); await page.waitForSelector(`text=${seed.partidas[0].conceptos[0].nombre}`); });
      await paso("obra: diálogo concepto (PU y avance)", async () => {
        await page.click(`button:has-text("${seed.partidas[0].conceptos[0].nombre}")`);
        await page.waitForSelector("[role=dialog]");
        await page.waitForSelector("text=Precio unitario");
        await page.click("[role=dialog] button:has-text('75%')");
        await page.waitForSelector("text=Línea base");
        await page.keyboard.press("Escape"); await page.waitForSelector("[role=dialog]", { state: "detached" });
      });
      await paso("obra: + concepto", async () => { await page.click("button:has-text('Concepto') >> nth=0"); await dialogo(); });
      await paso("obra: candado", async () => { await page.click("button:has-text('$240,000')"); await dialogo(); });
    }
    await paso("obra: + partida", async () => { await page.click("main button:has-text('Partida')"); await dialogo(); });
    if (lleno) await paso("resumen: línea base, reserva y avance", async () => { await ir("resumen"); await page.waitForSelector("text=Línea base contra actual"); await page.waitForSelector("text=Reserva de imprevistos"); await page.waitForSelector("text=Avance físico contra pagado"); });

    await paso("botón + Pago", async () => { await page.click("button:has-text('Pago') >> nth=-1"); await dialogo(); });
    if (lleno) {
      await paso("pagos: abrir pago", async () => { await ir("pagos"); await page.click("button:has-text('Honorarios · 1')"); await dialogo(); });
      await paso("relaciones: editar", async () => { await ir("relaciones"); await page.click("button:has-text('Editar')"); await dialogo(); });
      await paso("proveedores: abrir", async () => { await ir("proveedores"); await page.click("button:has-text('Muebles SA')"); await dialogo(); });
      await paso("compras: marcar siguiente", async () => { await ir("compras"); await page.click("button:has-text('Marcar')"); });
    }
    await paso("ajustes: miembros y export", async () => {
      await ir("ajustes"); await page.waitForSelector("text=socia@casapiena.mx");
      const d = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
      await page.click("button:has-text('Exportar Excel')"); await d;
    });
  });
}
await browser.close();
console.log("MODO", modo);
console.log(pasos.join("\n"));
console.log(errors.length ? "ERRORES:\n" + errors.join("\n") : "SIN ERRORES");
salir(errors.length ? 1 : 0);
