# Control de obra

App de control de presupuesto, pagos, compras y proveedores de obra.
React + Vite, con Supabase como backend (Postgres + auth por magic link).

## Antes de correr

1. Aplica `schema.sql` (ya lo hiciste) y luego `02_set_motivo.sql` en el SQL Editor.
2. En Supabase → Authentication → URL Configuration, agrega tu dominio de Vercel
   y `http://localhost:5173` en **Redirect URLs**.
3. Copia `.env.example` a `.env` y pon tu publishable key
   (Supabase → Project Settings → API → anon/publishable).

## Local

```bash
npm install
npm run dev
```

## Publicar en GitHub Pages

1. Crea un repo y sube esta carpeta (rama `main`).
2. En el repo: Settings → Pages → Source = **GitHub Actions**.
3. El workflow `.github/workflows/pages.yml` compila y publica en cada push.
4. Copia la URL que queda (`https://usuario.github.io/repo/`) y pégala en
   Supabase → Authentication → URL Configuration, en **Site URL** y en
   **Redirect URLs**. Sin eso el magic link no regresa a la app.

La URL y la publishable key de Supabase vienen incrustadas como respaldo, así que
funciona sin configurar nada. Si prefieres no tenerlas en el código, ponlas en
Settings → Secrets and variables → Actions → Variables como `VITE_SUPABASE_URL`
y `VITE_SUPABASE_ANON_KEY`; el workflow ya las lee.

## Deploy en Vercel (alternativa)

`npx vercel --prod` desde esta carpeta. Framework: Vite.

## Cómo está armado

- `src/lib/supabase.js` — cliente.
- `src/lib/api.js` — todo el acceso a datos. `cargar()` arma el proyecto completo
  en la forma que usa la interfaz; `importarProyecto()` sube un respaldo JSON del
  artefacto (proveedores, partidas, conceptos, links, relaciones, pagos, traspasos).
- `src/App.jsx` — login por magic link, selector de proyecto, importación.
- `src/Tracker.jsx` — la interfaz. Cada cambio escribe en Supabase y recarga.

La bitácora de presupuestos la escribe un trigger en la base, no el cliente:
antes de actualizar un concepto se llama `set_motivo()` para dejar el motivo.
