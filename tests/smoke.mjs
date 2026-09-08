import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
const seed = JSON.parse(fs.readFileSync(new URL("../seed/casapiena_inicial.json", import.meta.url),"utf8"));
const PID = "11111111-1111-1111-1111-111111111111", UID = "2367ee79-38ac-4120-aa0a-35b6a649b25d";
const PROV = "22222222-2222-2222-2222-222222222222";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "x@y.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: "fake.fake.fake", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user };
// datos en forma de filas de la base, a partir del seed
const partidas = seed.partidas.map((pa,i) => ({ id: `p${i}`.padEnd(36,"0"), proyecto_id: PID, nombre: pa.nombre, candado: i===0 ? 250000 : 0, orden: i }));
const conceptos = seed.partidas.flatMap((pa,i) => pa.conceptos.map((c,j) => ({ id: `c${i}-${j}`.padEnd(36,"0"), partida_id: partidas[i].id, nombre: c.nombre, proveedor_id: j===0 ? PROV : null, presupuesto: j===0 ? 50000 : 0, iva: j===0 ? 8000 : 0, base_presupuesto: 50000, base_iva: 8000, estado: j===0 ? "cerrado" : "pendiente", prioridad: c.prioridad, logistica: j===0 ? "comprado" : "porComprar", pedido: "", eta: null, nota: "", orden: j })));
const tablas = {
  proyectos: { id: PID, nombre: "Casa Piena", clientes: "Familia M.", presupuesto_obra: 1500000, pct_honorarios: 15, direccion_efectivo: "Calle 1", contacto_efectivo: "Ana", instrucciones_efectivo: "", owner_id: UID, archivado: false, created_at: "2026-01-01" },
  proveedores: [{ id: PROV, proyecto_id: PID, nombre: "Muebles SA", razon: "", banco: "BBVA", clabe: "0123", tel: "", nota: "" }],
  partidas, conceptos, concepto_links: [], concepto_ajustes: [{ id: "a1", concepto_id: conceptos[0].id, fecha: "2026-09-01", anterior: 40000, nuevo: 58000, motivo: "cambio" }],
  relaciones: [{ id: "r1", proyecto_id: PID, numero: 1, fecha: "2026-09-01", fecha_limite: "2026-09-15" }],
  pagos: [{ id: "g1", proyecto_id: PID, relacion_id: "r1", concepto_id: conceptos[0].id, proveedor_id: PROV, tipo: "obra", fase: "", monto: 20000, fecha: "2026-09-02", forma: "Transferencia", status: "Anticipo", estado: "pagado", de_excedente: false, nota: "" },
          { id: "g2", proyecto_id: PID, relacion_id: "r1", concepto_id: conceptos[0].id, proveedor_id: PROV, tipo: "obra", fase: "", monto: 10000, fecha: "2026-09-10", forma: "Efectivo", status: "Liquidación", estado: "solicitado", de_excedente: false, nota: "" },
          { id: "g3", proyecto_id: PID, relacion_id: "r1", concepto_id: null, proveedor_id: null, tipo: "honorarios", fase: "1", monto: 5000, fecha: "2026-09-02", forma: "Transferencia", status: "Anticipo", estado: "pagado", de_excedente: false, nota: "" }],
  excedentes: [{ id: "e1", proyecto_id: PID, concepto: "Ahorro", monto: 3000, fecha: "2026-09-03" }],
  traspasos: [{ id: "t1", proyecto_id: PID, de_id: partidas[0].id, a_id: partidas[1].id, monto: 10000, fecha: "2026-09-04", motivo: "ajuste" }],
};
// Recorre la app compilada (dist/) en Chromium con Supabase simulado. Falla si
// cualquier pantalla o modal lanza un error de JavaScript. Uso: npm test
const modo = process.argv[2] || "lleno";
const PORT = 4173 + Math.floor(Math.random() * 500);
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", cwd: fileURLToPath(new URL("..", import.meta.url)) });
for (let i = 0; i < 100; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const errors = [];
page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
page.on("console", m => { if (m.type()==="error") errors.push("CONSOLE: " + m.text().slice(0,300)); });
await page.route("**/auth/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
await page.route("**/rest/v1/**", r => {
  const u = new URL(r.request().url()); const t = u.pathname.split("/").pop();
  let body = "[]";
  if (r.request().method() !== "GET") body = JSON.stringify(t === "proyectos" ? tablas.proyectos : [{ id: "nuevo".padEnd(36,"0") }]);
  else if (t === "proyectos") body = JSON.stringify(u.searchParams.get("select") === "*" ? tablas.proyectos : [tablas.proyectos]);
  else if (modo === "lleno" && tablas[t]) body = JSON.stringify(tablas[t]);
  r.fulfill({ status: 200, contentType: "application/json", body });
});
await page.addInitScript(([k, s, pid]) => { localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem("obra:proyecto", pid); }, ["sb-hbshsolmbekqrixumvue-auth-token", session, PID]);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
try { await page.waitForSelector(".ob .tabs button", { timeout: 10000 }); }
catch { console.log("La app no cargó. Errores:", errors.join("\n") || "(ninguno)", "\nHTML:", (await page.innerHTML("#root")).slice(0, 300)); server.kill(); process.exit(1); }
const pasos = [];
const paso = async (nombre, fn) => { const antes = errors.length; try { await fn(); await page.waitForTimeout(250); } catch (e) { errors.push("PASO " + nombre + ": " + e.message.split("\n")[0]); } pasos.push(nombre + (errors.length > antes ? " ✗" : " ✓")); };
const cerrar = async () => { const b = page.locator(".sheet .x, .sheet button:has-text('Cerrar'), .sheet button:has-text('Cancelar')").first(); if (await b.count()) await b.click(); else await page.keyboard.press("Escape"); };
for (const tab of ["Obra","Compras","Pagos","Rels","Resumen","Provs","Ajustes"]) await paso("tab " + tab, () => page.click(`.tabs button:has-text("${tab}")`));
if (modo === "lleno") await paso("obra: abrir partida", async () => { await page.click('.tabs button:has-text("Obra")'); await page.locator(".pa-head .row").first().click(); });
if (modo === "lleno") await paso("obra: modal concepto", async () => { await page.locator(".card .row").nth(1).click(); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); });
if (modo === "lleno") await paso("obra: + Concepto", async () => { await page.locator("button:has-text('+ Concepto')").first().click(); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); });
await paso("obra: + Partida", async () => { await page.click('.tabs button:has-text("Obra")'); await page.locator("button:has-text('+ Partida')").click(); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); });
if (modo === "lleno") await paso("obra: candado", async () => { await page.locator(".lock").first().click(); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); });
await paso("fab + Pago", async () => { await page.click(".fab"); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); });
await paso("pagos: fila", async () => { await page.click('.tabs button:has-text("Pagos")'); const f = page.locator(".wrap .row").first(); if (await f.count()) { await f.click(); await page.waitForTimeout(300); await cerrar(); } });
await paso("rels: fila", async () => { await page.click('.tabs button:has-text("Rels")'); const f = page.locator(".wrap .row, .wrap .card button").first(); if (await f.count()) { await f.click(); await page.waitForTimeout(300); await cerrar(); } });
await paso("provs: + proveedor", async () => { await page.click('.tabs button:has-text("Provs")'); const b = page.locator("button:has-text('+ Proveedor'), button:has-text('+ Prov')").first(); if (await b.count()) { await b.click(); await page.waitForSelector(".sheet", { timeout: 3000 }); await cerrar(); } });
await paso("ajustes: exportar excel", async () => { await page.click('.tabs button:has-text("Ajustes")'); const b = page.locator("button:has-text('Excel'), button:has-text('xlsx')").first(); if (await b.count()) { const d = page.waitForEvent("download", { timeout: 4000 }).catch(() => null); await b.click(); await d; } });
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
console.log("MODO", modo); console.log(pasos.join("\n")); console.log(errors.length ? "ERRORES:\n" + errors.join("\n") : "SIN ERRORES");
await browser.close();
server.kill();
process.exit(errors.length ? 1 : 0);
