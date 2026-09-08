import { cn } from "@/lib/utils";

/** Filtros en fila desplazable (chips). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: [T, string][]; className?: string }) {
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]", className)}>
      {options.map(([k, v]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", value === k ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
          {v}
        </button>
      ))}
    </div>
  );
}
