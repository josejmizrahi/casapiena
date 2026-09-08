import { Plus } from "lucide-react";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";
import { fm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Empty, Row } from "@/components/ui/misc";

export default function Proveedores() {
  const { p, calc } = useProyecto();
  const { abrir } = useModal();
  const lista = p.proveedores.map((v) => {
    const cs = calc.conceptos.filter((c) => c.proveedorId === v.id);
    const pgs = p.pagos.filter((x) => x.proveedorId === v.id);
    const comp = cs.reduce((s, c) => s + c.total, 0);
    const pag = pgs.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
    return { ...v, comp, pag, saldo: comp - pag, nConceptos: cs.length };
  }).sort((a, b) => b.saldo - a.saldo || b.comp - a.comp || a.nombre.localeCompare(b.nombre));
  const conSaldo = lista.filter((x) => x.saldo > 0.005);
  return (
    <>
      <StatStrip>
        <Stat label="Proveedores" value={lista.length} />
        <Stat label="Con saldo" value={conSaldo.length} />
        <Stat label="Por pagar" value={fm(conSaldo.reduce((s, x) => s + x.saldo, 0))} tone="warn" />
      </StatStrip>
      {lista.length === 0 && (
        <Empty>
          <p className="font-medium text-foreground">Aún no tienes proveedores</p>
          <p className="mt-1">Guarda razón social, banco y CLABE una vez; después cada relación impresa sale con los datos para transferir. También puedes crearlos desde cualquier concepto o pago.</p>
          <Button size="sm" className="mt-3" onClick={() => abrir({ tipo: "prov", d: {} })}><Plus />Primer proveedor</Button>
        </Empty>
      )}
      <Card>
        <CardContent className="pt-2">
          {lista.map((v) => (
            <Row key={v.id} onClick={() => abrir({ tipo: "prov", d: v })}
              left={<><div className="text-sm font-medium truncate">{v.nombre}</div><div className="text-xs text-ink-3">{v.nConceptos} concepto{v.nConceptos === 1 ? "" : "s"}{v.clabe ? " · CLABE guardada" : " · sin datos bancarios"}</div></>}
              right={<><div className="text-sm font-semibold">{fm(v.comp)}</div>{v.saldo > 0.005 ? <div className="text-[11px] text-warn">saldo {fm(v.saldo)}</div> : <div className="text-[11px] text-ok">liquidado</div>}</>} />
          ))}
          <Button variant="dashed" className="mt-2" onClick={() => abrir({ tipo: "prov", d: {} })}><Plus />Proveedor</Button>
        </CardContent>
      </Card>
    </>
  );
}
