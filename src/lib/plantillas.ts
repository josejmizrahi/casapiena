// Plantillas de partidas por tipo de obra, con un reparto sugerido de candados (% del presupuesto).
// Los porcentajes son puntos de partida razonables para obra residencial en México; el usuario los ajusta.

export interface PartidaPlantilla { nombre: string; pct: number; contingencia?: boolean }
export interface Plantilla { id: string; nombre: string; descripcion: string; partidas: PartidaPlantilla[] }

export const CONTINGENCIA_SUGERIDA = 7; // % del presupuesto reservado a imprevistos

export const PLANTILLAS: Plantilla[] = [
  {
    id: "mobiliario", nombre: "Mobiliario e interiores",
    descripcion: "Amueblar y decorar una casa o departamento: por espacio, más fletes e instalaciones.",
    partidas: [
      { nombre: "Cuarto principal", pct: 18 }, { nombre: "Cuartos secundarios", pct: 14 }, { nombre: "Sala", pct: 16 },
      { nombre: "Comedor", pct: 9 }, { nombre: "Cocina y desayunador", pct: 6 }, { nombre: "Family / TV", pct: 8 },
      { nombre: "Recibidor y pasillos", pct: 4 }, { nombre: "Terraza y exteriores", pct: 7 }, { nombre: "Iluminación decorativa", pct: 5 },
      { nombre: "Fletes, armados e instalaciones", pct: 6 }, { nombre: "Imprevistos", pct: CONTINGENCIA_SUGERIDA, contingencia: true },
    ],
  },
  {
    id: "remodelacion", nombre: "Remodelación",
    descripcion: "Intervenir una construcción existente: demoliciones, instalaciones, acabados y carpintería.",
    partidas: [
      { nombre: "Demoliciones y retiros", pct: 5 }, { nombre: "Albañilería", pct: 14 }, { nombre: "Instalación hidrosanitaria", pct: 8 },
      { nombre: "Instalación eléctrica e iluminación", pct: 9 }, { nombre: "Acabados en pisos y muros", pct: 18 }, { nombre: "Carpintería", pct: 15 },
      { nombre: "Cancelería y vidrio", pct: 7 }, { nombre: "Baños y cocina (muebles y accesorios)", pct: 9 }, { nombre: "Pintura", pct: 4 },
      { nombre: "Limpieza y entrega", pct: 2 }, { nombre: "Imprevistos", pct: 9, contingencia: true },
    ],
  },
  {
    id: "obra-nueva", nombre: "Obra nueva",
    descripcion: "Construir desde cero: preliminares, cimentación, estructura, instalaciones y acabados.",
    partidas: [
      { nombre: "Preliminares y trazo", pct: 3 }, { nombre: "Cimentación", pct: 10 }, { nombre: "Estructura", pct: 20 },
      { nombre: "Albañilería y muros", pct: 12 }, { nombre: "Instalaciones (hidráulica, sanitaria, eléctrica, gas)", pct: 12 },
      { nombre: "Acabados", pct: 15 }, { nombre: "Carpintería y herrería", pct: 8 }, { nombre: "Cancelería", pct: 5 },
      { nombre: "Exteriores y jardín", pct: 5 }, { nombre: "Limpieza y entrega", pct: 2 }, { nombre: "Imprevistos", pct: 8, contingencia: true },
    ],
  },
  { id: "blanco", nombre: "Empezar en blanco", descripcion: "Sin partidas. Las creas una por una en la vista Obra.", partidas: [] },
];
