import { cn } from "@/lib/utils";

/** Cifra con anotación. En tira, separadas por hairlines verticales. */
export function Stat({ label, value, tone, sub, className }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "bad" | "info"; sub?: React.ReactNode; className?: string }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "info" ? "text-info" : "";
  return (
    <div className={cn("min-w-0 py-2 pr-2", className)}>
      <div className="anno truncate">{label}</div>
      <div className={cn("mt-1 text-[17px] md:text-[21px] font-semibold fig leading-none truncate", color)}>{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-3 truncate num">{sub}</div>}
    </div>
  );
}
export const StatStrip = ({ children, cols = 3, className }: { children: React.ReactNode; cols?: 2 | 3 | 4; className?: string }) => (
  <div className={cn("grid border-y border-border-2 [&>*+*]:border-l [&>*+*]:border-border [&>*+*]:pl-3", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 md:grid-cols-4 [&>*:nth-child(3)]:border-l-0 [&>*:nth-child(3)]:pl-0 md:[&>*:nth-child(3)]:border-l md:[&>*:nth-child(3)]:pl-3 [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+3)]:border-t-0" : "grid-cols-3", className)}>{children}</div>
);
