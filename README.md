# Casa Piena · Control de obra

App para llevar presupuesto, candados por partida, compras, pagos, relaciones y
proveedores de una o varias obras. Cada proyecto es independiente y se puede
compartir con otras personas por correo (editor o lector).

**Pila:** React 18 + TypeScript + Vite, Tailwind CSS 4 con componentes propios
sobre Radix, TanStack Query para datos, Supabase (Postgres + auth con correo y
contraseña, RLS en todas las tablas). Gráficas en SVG propio, sin librería.

**Diseño:** mobile first, "papel y tinta": una superficie cálida, hairlines en vez
de cajas, Geist para texto y Geist Mono para anotaciones, color solo cuando
significa estado (verde, ámbar, rojo, azul). Los tokens viven en `src/index.css`.

## Antes de correr

1. Aplica en el SQL Editor de Supabase, en orden: `schema.sql`, `02_set_motivo.sql`,
   `03_fix_rls_proyectos.sql`, `04_miembros.sql`, `05_fase2.sql`, `06_linea_base.sql`.
2. Crea tu usuario en Supabase → Authentication → Users → **Add user** (correo y
   contraseña, con "Auto confirm"). Desde "Mis proyectos" puedes cambiarla.
3. Opcional: copia `.env.example` a `.env` y pon tu URL y publishable key. Si no,
   se usan las del proyecto `casapiena` que vienen incrustadas.

## Local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # lint + tsc + vite build
npm test         # recorrido en Chromium con Supabase simulado (requiere npx playwright install chromium)
```

## Publicación

`.github/workflows/pages.yml` compila, corre `npm test` y publica en GitHub Pages en
cada push a `main`. La app queda en https://josejmizrahi.github.io/casapiena/.
Usa rutas con `#` (HashRouter) para que funcione en Pages sin configuración extra.

## Proyecto inicial

`seed/casapiena_inicial.json` es el respaldo del proyecto "Casa Piena — Mobiliario"
(partidas y conceptos por cuarto). Cárgalo con **Importar respaldo** en "Mis proyectos".

## Cómo está armado

```
src/
  api/index.ts        acceso a datos: carga completa del proyecto y todas las escrituras
  lib/types.ts        tipos de dominio y catálogos (estados, prioridades, logística)
  lib/calculos.ts     toda la aritmética: candados, comprometido, pagado, flujo de caja
  lib/importar.ts     importación de respaldo JSON validada con zod
  lib/exportar.ts     Excel (carga xlsx bajo demanda) y respaldo JSON
  components/Graficas.tsx  flujo de caja, comprometido contra candado y avance, en SVG
  hooks/              sesión, proyecto (query + acciones) y diálogos
  components/ui/      componentes base (button, card, dialog, input, badge…)
  pages/              Login, Mis proyectos y las 7 vistas del proyecto
  modals/             diálogos de concepto, partida, traspaso, pago, relación, excedente, proveedor
  print/              documento imprimible de una relación
tests/smoke.mjs       prueba de recorrido de todas las vistas y diálogos
```

La bitácora de presupuestos la escribe un trigger en la base, no el cliente:
antes de actualizar un concepto se llama `set_motivo()` para dejar el motivo.
