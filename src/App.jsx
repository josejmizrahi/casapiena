import { Component, useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import * as api from "./lib/api.js";
import Tracker from "./Tracker.jsx";

const shell = {
  minHeight: "100vh", background: "#EEF1EE", color: "#1E2F3C", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24,
  fontFamily: '-apple-system,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
};
const caja = { background: "#fff", border: "1px solid #D7DDD9", borderRadius: 14, padding: 22, width: "100%", maxWidth: 380 };
const input = { width: "100%", border: "1px solid #D7DDD9", borderRadius: 9, padding: 11, fontSize: 16, background: "#FAFBFA", boxSizing: "border-box" };
const boton = { width: "100%", border: 0, background: "#1E2F3C", color: "#fff", borderRadius: 9, padding: 12, fontSize: 15, fontWeight: 700, marginTop: 10 };

// Si algo truena al renderizar, muestra el error en vez de dejar la pantalla en blanco.
class Guardia extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Error de interfaz:", error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={shell}>
        <div style={caja}>
          <h1 style={{ fontFamily: '"Iowan Old Style",Palatino,Georgia,serif', fontSize: 22, margin: "0 0 8px" }}>Algo falló</h1>
          <p style={{ fontSize: 14, color: "#5B6B75" }}>La pantalla no se pudo mostrar. Recarga la página; si sigue igual, comparte este mensaje:</p>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "#FAFBFA", border: "1px solid #D7DDD9", borderRadius: 9, padding: 10 }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button style={boton} onClick={() => { localStorage.removeItem("obra:proyecto"); location.reload(); }}>Volver a mis proyectos</button>
        </div>
      </div>
    );
  }
}

function Entrar() {
  const [correo, setCorreo] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);
  const listo = correo.includes("@") && pass.length >= 6 && !cargando;
  const entrar = async () => {
    if (!listo) return;
    setErr(""); setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: pass });
    setCargando(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
  };
  return (
    <div style={shell}>
      <div style={caja}>
        <h1 style={{ fontFamily: '"Iowan Old Style",Palatino,Georgia,serif', fontSize: 24, margin: "0 0 14px" }}>Control de obra</h1>
        <input style={input} type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={correo}
          onChange={(e) => setCorreo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} />
        <input style={{ ...input, marginTop: 8 }} type="password" autoComplete="current-password" placeholder="Contraseña" value={pass}
          onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} />
        <button style={{ ...boton, opacity: listo ? 1 : 0.5 }} disabled={!listo} onClick={entrar}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        {err && <p style={{ color: "#B23A32", fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );
}

function CambiarPass() {
  const [abierto, setAbierto] = useState(false);
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const guardar = async () => {
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) setMsg(error.message); else { setMsg("Contraseña actualizada."); setPass(""); setAbierto(false); }
  };
  if (!abierto) return <button onClick={() => setAbierto(true)} style={{ background: "none", border: 0, color: "#5B6B75", fontSize: 13, marginTop: 16, padding: 0, marginRight: 14 }}>{msg || "Cambiar contraseña"}</button>;
  return (
    <div style={{ marginTop: 14 }}>
      <input style={input} type="password" autoComplete="new-password" placeholder="Nueva contraseña (mínimo 6)" value={pass} onChange={(e) => setPass(e.target.value)} />
      <button style={{ ...boton, opacity: pass.length >= 6 ? 1 : 0.5 }} disabled={pass.length < 6} onClick={guardar}>Guardar contraseña</button>
      {msg && <p style={{ color: "#B23A32", fontSize: 13, marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

function Proyectos({ onAbrir, onSalir }) {
  const [lista, setLista] = useState(null);
  const [nombre, setNombre] = useState("");
  const [err, setErr] = useState("");
  const cargar = useCallback(async () => {
    try { setLista(await api.listaProyectos()); } catch (e) { setErr(e.message); setLista([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const crear = async () => {
    try { const p = await api.crearProyecto(nombre.trim()); onAbrir(p.id); } catch (e) { setErr(e.message); }
  };
  const importar = async (file) => {
    setErr("Importando… no cierres la pestaña.");
    try { const id = await api.importarProyecto(JSON.parse(await file.text())); onAbrir(id); }
    catch (e) { setErr("No se pudo importar: " + e.message); }
  };
  return (
    <div style={{ ...shell, alignItems: "flex-start", paddingTop: 48 }}>
      <div style={caja}>
        <h1 style={{ fontFamily: '"Iowan Old Style",Palatino,Georgia,serif', fontSize: 22, margin: "0 0 12px" }}>Tus proyectos</h1>
        {lista === null && <p style={{ fontSize: 14, color: "#5B6B75" }}>Cargando…</p>}
        {lista?.map((x) => (
          <button key={x.id} onClick={() => onAbrir(x.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: "1px solid #D7DDD9", padding: "11px 0", font: "inherit" }}>
            <b style={{ fontSize: 15 }}>{x.nombre}</b>
            <div style={{ fontSize: 12, color: "#5B6B75" }}>{x.clientes || "Sin clientes"}</div>
          </button>
        ))}
        {lista?.length === 0 && <p style={{ fontSize: 14, color: "#5B6B75" }}>Todavía no tienes proyectos.</p>}
        <div style={{ borderTop: "1px solid #D7DDD9", marginTop: 14, paddingTop: 14 }}>
          <input style={input} placeholder="Nombre del proyecto nuevo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button style={{ ...boton, opacity: nombre.trim() ? 1 : 0.5 }} disabled={!nombre.trim()} onClick={crear}>Crear proyecto</button>
          <label style={{ ...boton, background: "#fff", color: "#1E2F3C", border: "1px solid #D7DDD9", display: "block", textAlign: "center", boxSizing: "border-box" }}>
            Importar respaldo JSON
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importar(e.target.files[0])} />
          </label>
        </div>
        {err && <p style={{ color: "#B23A32", fontSize: 13, marginTop: 10 }}>{err}</p>}
        <CambiarPass />
        <button onClick={onSalir} style={{ background: "none", border: 0, color: "#5B6B75", fontSize: 13, marginTop: 16, padding: 0 }}>Cerrar sesión</button>
      </div>
    </div>
  );
}

export default function App() {
  const [sesion, setSesion] = useState(undefined);
  const [proyectoId, setProyectoId] = useState(() => localStorage.getItem("obra:proyecto") || null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const abrir = (id) => { localStorage.setItem("obra:proyecto", id); setProyectoId(id); };
  const cerrarProyecto = () => { localStorage.removeItem("obra:proyecto"); setProyectoId(null); };
  const salir = async () => { await supabase.auth.signOut(); cerrarProyecto(); };

  if (sesion === undefined) return <div style={shell}><span style={{ color: "#5B6B75" }}>Cargando…</span></div>;
  if (!sesion) return <Entrar />;
  if (!proyectoId) return <Guardia><Proyectos onAbrir={abrir} onSalir={salir} /></Guardia>;
  return <Guardia key={proyectoId}><Tracker proyectoId={proyectoId} onCambiarProyecto={cerrarProyecto} onSalir={salir} /></Guardia>;
}
