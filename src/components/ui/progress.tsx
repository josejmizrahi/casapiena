import { cn } from "@/lib/utils";

/** Medidor hairline: pista clara, tinta para lo real, gris para lo previsto; rojo si se excede. */
export function StackedBar({ pagado, tramite, className, bad, light }: { pagado: number; tramite: number; className?: string; bad?: boolean; light?: boolean }) {
  const a = Math.max(0, Math.min(100, pagado));
  const b = Math.max(0, Math.min(100 - a, tramite));
  return (
    <div className={cn("flex h-[3px] w-full overflow-hidden", light ? "bg-white/25" : "bg-wash", className)} style={!light ? { backgroundColor: "var(--wash)" } : undefined}>
      <div className={cn("h-full", bad ? "bg-bad" : light ? "bg-panel" : "bg-serie-1")} style={{ width: `${a}%` }} />
      {b > 0 && <div className={cn("h-full ml-[2px]", light ? "bg-white/60" : "bg-serie-2")} style={{ width: `calc(${b}% - 2px)` }} />}
    </div>
  );
}
