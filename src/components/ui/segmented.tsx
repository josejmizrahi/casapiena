import { cn } from "@/lib/utils";

/** Filtros en fila desplazable: texto con subrayado activo, sin píldoras. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: [T, string][]; className?: string }) {
  return (
    <div className={cn("flex gap-5 overflow-x-auto border-b border-border -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none]", className)}>
      {options.map(([k, v]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cn("shrink-0 -mb-px border-b-2 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors", value === k ? "border-foreground text-foreground" : "border-transparent text-ink-3 hover:text-foreground")}>
          {v}
        </button>
      ))}
    </div>
  );
}
