import { useProyecto } from "@/hooks/useProyecto";
import { FLUJO } from "@/lib/types";
import { fecha, fm2 } from "@/lib/utils";

/** Documento de una relación para imprimir. Solo se ve en @media print. */
export function RelacionPrint({ n }: { n: number | null }) {
  const { p, conceptoDe } = useProyecto();
  const r = p.relaciones.find((x) => x.n === n);
  if (!r) return null;
  const lista = p.pagos.filter((x) => x.rel === r.n);
  const tot = lista.reduce((s, x) => s + x.monto, 0);
  const pagadoR = lista.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
  const provDe = (id: string) => p.proveedores.find((v) => v.id === id);
  return (
    <div className="print-only">
      <div style={{ textAlign: "right" }}><b>{p.meta.clientes}</b><br />{p.meta.nombre}<br />{fecha(r.fecha)}</div>
      <h2 style={{ fontSize: 20, margin: "16px 0 4px" }}>Relación {r.n} - Resumen de pagos</h2>
      <table>
        <thead><tr><th>No.</th><th>Concepto</th><th>Proveedor</th><th className="r">Pago solicitado</th><th>Forma</th><th>Status</th></tr></thead>
        <tbody>
          {lista.map((x, i) => {
            const v = provDe(x.proveedorId);
            return (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td>{x.tipo === "honorarios" ? `Honorarios - ${x.fase}` : conceptoDe(x.conceptoId)?.nombre || ""}{x.nota ? <div style={{ fontSize: 10, color: "#555" }}>{x.nota}</div> : null}</td>
                <td>{v?.nombre || ""}{x.forma === "Transferencia" && v && (v.razon || v.clabe) ? <div style={{ fontSize: 10, color: "#555" }}>{v.razon}{v.banco ? ` · ${v.banco}` : ""}{v.clabe ? ` · CLABE ${v.clabe}` : ""}</div> : null}</td>
                <td className="r num">{fm2(x.monto)}</td>
                <td>{x.forma}</td>
                <td>{x.status} · {FLUJO[x.estado]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table style={{ width: "50%", marginLeft: "auto" }}>
        <tbody>
          <tr><td>Total relación {r.n}</td><td className="r num"><b>{fm2(tot)}</b></td></tr>
          <tr><td>Pagado</td><td className="r num">{fm2(pagadoR)}</td></tr>
          <tr><td>Saldo a pagar</td><td className="r num"><b>{fm2(tot - pagadoR)}</b></td></tr>
          <tr><td>Fecha límite de pago</td><td className="r">{fecha(r.fechaLimite)}</td></tr>
        </tbody>
      </table>
      {lista.some((x) => x.forma === "Efectivo") && (p.meta.direccionEfectivo || p.meta.contactoEfectivo) && (
        <div style={{ marginTop: 24 }}>
          <b>PAGOS EN EFECTIVO</b>
          {p.meta.direccionEfectivo && <div>Dirección: {p.meta.direccionEfectivo}</div>}
          {p.meta.contactoEfectivo && <div>Contacto: {p.meta.contactoEfectivo}</div>}
          {p.meta.instruccionesEfectivo && <div style={{ marginTop: 6 }}>{p.meta.instruccionesEfectivo}</div>}
        </div>
      )}
    </div>
  );
}
