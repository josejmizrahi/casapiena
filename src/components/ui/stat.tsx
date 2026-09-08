import { cn } from "@/lib/utils";

/** Tarjeta de cifra. Se usa en tiras de 2 a 4. */
export function Stat({ label, value, tone, sub, className }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "bad" | "info"; sub?: React.ReactNode; className?: string }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "info" ? "text-info" : "";
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-2.5 min-w-0", className)}>
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className={cn("text-[15px] font-semibold num truncate", color)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}
export const StatStrip = ({ children, cols = 3, className }: { children: React.ReactNode; cols?: 2 | 3 | 4; className?: string }) => (
  <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3", className)}>{children}</div>
);
