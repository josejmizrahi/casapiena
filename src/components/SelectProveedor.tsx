import { NativeSelect } from "@/components/ui/input";
import { useProyecto } from "@/hooks/useProyecto";
import { useModal } from "@/hooks/useModal";

/** Selector de proveedor con opción de crear uno nuevo sin salir del formulario. */
export function SelectProveedor({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { p } = useProyecto();
  const { abrir } = useModal();
  return (
    <NativeSelect value={value || ""} onChange={(e) => {
      if (e.target.value === "__nuevo") abrir({ tipo: "prov", d: {}, onSave: onChange });
      else onChange(e.target.value);
    }}>
      <option value="">Sin proveedor</option>
      {[...p.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
      <option value="__nuevo">+ Nuevo proveedor…</option>
    </NativeSelect>
  );
}
