import { useState, useEffect, useCallback } from "react";
import { supabase, APP_URL } from "./lib/supabase.js";
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

function Entrar() {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);
  const enviar = async () => {
    setErr(""); setCargando(true);
    const { error } = await supabase.auth.signInWithOtp({ email: correo.trim(), options: { emailRedirectTo: APP_URL } });
    setCargando(false);
    if (error) setErr(error.message); else setEnviado(true);
  };
  return (
    <div style={shell}>
      <div style={caja}>
        <h1 style={{ fontFamily: '"Iowan Old Style",Palatino,Georgia,serif', fontSize: 24, margin: "0 0 4px" }}>Control de obra</h1>
        {enviado ? (
          <p style={{ fontSize: 14, color: "#5B6B75" }}>Te mandé un link a <b>{correo}</b>. Ábrelo y entras directo.</p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "#5B6B75", margin: "0 0 14px" }}>Escribe tu correo y te mando un link para entrar. Sin contraseña.</p>
            <input style={input} type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={correo}
              onChange={(e) => setCorreo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && correo.includes("@") && enviar()} />
            <button style={{ ...boton, opacity: correo.includes("@") && !cargando ? 1 : 0.5 }} disabled={!correo.includes("@") || cargando} onClick={enviar}>
              {cargando ? "Enviando…" : "Mandarme el link"}
            </button>
            {err && <p style={{ color: "#B23A32", fontSize: 13, marginTop: 10 }}>{err}</p>}
          </>
        )}
      </div>
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
  if (!proyectoId) return <Proyectos onAbrir={abrir} onSalir={salir} />;
  return <Tracker proyectoId={proyectoId} onCambiarProyecto={cerrarProyecto} onSalir={salir} />;
}
