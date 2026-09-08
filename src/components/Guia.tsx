import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UMBRAL_AMBAR } from "@/lib/calculos";

/** Guía corta del método: cómo se usa la app para controlar una obra. */
export const SECCIONES = [
  {
    id: "presupuesto", titulo: "1. Presupuesto general",
    texto: "Es el techo de toda la obra, sin honorarios. Se define con el cliente antes de gastar un peso. Todo lo demás se compara contra este número: si la suma de lo comprometido lo rebasa, la app lo marca en rojo.",
  },
  {
    id: "candados", titulo: "2. Partidas y candados",
    texto: `Una partida agrupa conceptos (un cuarto, la carpintería, las instalaciones). Su candado es el tope que decides no rebasar ahí. Reglas: la suma de candados no debe superar el presupuesto general; marca una partida como reserva de imprevistos, del 5 al 10 %, cuyo candado solo sale por traspaso; y cuando una partida crece, traspásale candado de otra en vez de subirlo, así queda registrado de dónde salió el dinero. La app avisa en ámbar a partir del ${Math.round(UMBRAL_AMBAR * 100)} % del candado y en rojo cuando se excede.`,
  },
  {
    id: "conceptos", titulo: "3. Conceptos",
    texto: "Cada cosa que se compra o contrata. Captúralo como cantidad × precio unitario siempre que puedas (m², piezas, metros lineales): así distingues si algo subió porque cambió el precio o porque creció el alcance. IVA aparte, proveedor, y una prioridad: indispensable, flexible, opcional o exhibición, que te dice qué recortar si el dinero no alcanza. El primer presupuesto de cada concepto queda como línea base; cuando lo cambias, escribe el motivo: la desviación contra la base y sus razones son lo que el cliente va a preguntar.",
  },
  {
    id: "pagos", titulo: "4. Pagos y relaciones",
    texto: "Un pago nace como solicitado, el cliente lo autoriza y después se marca pagado. Los pagos se agrupan en relaciones numeradas, que son el documento que se imprime y se entrega al cliente para que libere el dinero. La fecha límite de cada relación alimenta el flujo de caja previsto.",
  },
  {
    id: "compras", titulo: "5. Compras y entregas",
    texto: "Cada concepto lleva un estatus logístico: por comprar, cotizado, comprado, en camino, recibido, instalado. Pon la fecha estimada de llegada y el número de pedido; la vista Compras te muestra lo atrasado y lo pendiente ordenado por fecha.",
  },
  {
    id: "ritmo", titulo: "6. Ritmo de pagos",
    texto: "Pagar mucho antes de tiempo es riesgo. Captura en cada concepto el avance físico real (0, 25, 50, 75, 100 %); la app lo compara contra el porcentaje pagado y avisa cuando llevas 25 puntos o más pagados por delante de lo hecho. Usa anticipo, parcialidades y finiquito ligados a entregas reales, y marca instalado cuando de verdad esté puesto.",
  },
];

export function GuiaDialog({ open, onClose, seccion }: { open: boolean; onClose: () => void; seccion?: string }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Cómo funciona el método" description="Seis ideas para controlar una obra sin sorpresas.">
        <div className="space-y-4">
          {SECCIONES.map((s) => (
            <section key={s.id} className={s.id === seccion ? "rounded-xl bg-accent/60 -mx-2 px-2 py-2" : ""}>
              <h3 className="font-semibold text-sm">{s.titulo}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.texto}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
