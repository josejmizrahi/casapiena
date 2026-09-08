import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Separator = ({ className }: { className?: string }) => <div className={cn("h-px w-full bg-border", className)} />;

/** Estado vacío: texto centrado entre reglas, sin caja punteada. */
export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("border-y border-border-2 px-2 py-8 text-center text-[14px] text-ink-2 leading-relaxed", className)}>{children}</div>;
}

/** Fila clave-valor para resúmenes numéricos. */
export function KV({ k, v, tone, bold, className }: { k: React.ReactNode; v: React.ReactNode; tone?: "ok" | "warn" | "bad"; bold?: boolean; className?: string }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2 text-[14px] border-t border-border first:border-t-0", bold && "font-semibold text-[15px] border-t-border-2", className)}>
      <span className="text-ink-2 min-w-0">{k}</span>
      <span className={cn("num whitespace-nowrap font-medium", color)}>{v}</span>
    </div>
  );
}

/** Fila de lista (concepto, pago, proveedor…). 44px mínimo para el pulgar. */
export function Row({ onClick, left, right, className, leading }: { onClick?: () => void; left: React.ReactNode; right?: React.ReactNode; className?: string; leading?: React.ReactNode }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("flex w-full items-center gap-3 py-3 min-h-11 text-left border-t border-border first:border-t-0", onClick && "active:bg-muted md:hover:bg-muted -mx-2 px-2 w-[calc(100%+1rem)] transition-colors", className)}>
      {leading}
      <div className="min-w-0 flex-1">{left}</div>
      {right && <div className="text-right shrink-0 num">{right}</div>}
    </Comp>
  );
}

/** Aviso: barra lateral de color, texto en tinta (el color no lleva el texto). */
export const Alert = ({ tone = "warn", children, className }: { tone?: "ok" | "warn" | "bad" | "info"; children: React.ReactNode; className?: string }) => (
  <div className={cn("border-l-2 pl-3 py-1 text-[14px] leading-snug text-foreground", tone === "bad" ? "border-bad" : tone === "ok" ? "border-ok" : tone === "info" ? "border-info" : "border-warn", className)}>{children}</div>
);

export const TooltipProvider = TooltipPrimitive.Provider;
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-sm bg-foreground px-2 py-1 text-[12px] text-background">{label}</TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content sideOffset={4} align="end" className={cn("z-50 min-w-[11rem] rounded-md border border-border-2 bg-panel p-1 shadow-[0_8px_24px_-12px_rgba(23,23,22,.35)]", className)} {...p} />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuItem = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) => (
  <DropdownMenuPrimitive.Item className={cn("flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 py-2.5 md:py-2 text-[14px] outline-none hover:bg-muted data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:stroke-[1.75] [&_svg]:text-ink-2", className)} {...p} />
);
