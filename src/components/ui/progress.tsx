import { cn } from "@/lib/utils";

/** Barra apilada: pagado, en trámite, y color de alerta si se excede. */
export function StackedBar({ pagado, tramite, className, bad, light }: { pagado: number; tramite: number; className?: string; bad?: boolean; light?: boolean }) {
  const a = Math.max(0, Math.min(100, pagado));
  const b = Math.max(0, Math.min(100 - a, tramite));
  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full", light ? "bg-white/20" : "bg-muted", className)}>
      <div className={cn("h-full", bad ? "bg-bad" : "bg-ok")} style={{ width: `${a}%` }} />
      <div className={cn("h-full", light ? "bg-[#E0B457]" : "bg-ok/40")} style={{ width: `${b}%` }} />
    </div>
  );
}
