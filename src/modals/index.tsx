import { useModal } from "@/hooks/useModal";
import { ConceptoDialog } from "./ConceptoDialog";
import { PartidaDialog, TraspasoDialog } from "./PartidaDialog";
import { PagoDialog } from "./PagoDialog";
import { RelacionDialog, ExcedenteDialog } from "./OtrosDialogs";
import { ProveedorDialog } from "./ProveedorDialog";

/** Monta el diálogo abierto (si hay). Un solo modal a la vez, como en un móvil. */
export function Modales() {
  const { modal } = useModal();
  if (!modal) return null;
  switch (modal.tipo) {
    case "concepto": return <ConceptoDialog key={modal.d.id || "nuevo"} d0={modal.d} />;
    case "partida": return <PartidaDialog d0={modal.d} />;
    case "traspaso": return <TraspasoDialog d0={modal.d} />;
    case "pago": return <PagoDialog key={modal.d.id || "nuevo"} d0={modal.d} />;
    case "rel": return <RelacionDialog d0={modal.d} />;
    case "exc": return <ExcedenteDialog d0={modal.d} />;
    case "prov": return <ProveedorDialog d0={modal.d} onSave={modal.onSave} />;
  }
}
