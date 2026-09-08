import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Separator = ({ className }: { className?: string }) => <div className={cn("h-px w-full bg-border", className)} />;

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground", className)}>{children}</div>;
}

/** Fila clave-valor para resúmenes numéricos. */
export function KV({ k, v, tone, bold, className }: { k: React.ReactNode; v: React.ReactNode; tone?: "ok" | "warn" | "bad"; bold?: boolean; className?: string }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm border-t border-border first:border-t-0", bold && "font-semibold text-[15px]", className)}>
      <span className="text-muted-foreground min-w-0">{k}</span>
      <span className={cn("num whitespace-nowrap font-medium", color)}>{v}</span>
    </div>
  );
}

/** Fila interactiva de lista (concepto, pago, proveedor…). */
export function Row({ onClick, left, right, className, leading }: { onClick?: () => void; left: React.ReactNode; right?: React.ReactNode; className?: string; leading?: React.ReactNode }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("flex w-full items-center gap-3 py-2.5 text-left border-t border-border first:border-t-0", onClick && "hover:bg-muted/60 -mx-2 px-2 rounded-md w-[calc(100%+1rem)]", className)}>
      {leading}
      <div className="min-w-0 flex-1">{left}</div>
      {right && <div className="text-right shrink-0 num">{right}</div>}
    </Comp>
  );
}

export const Alert = ({ tone = "warn", children, className }: { tone?: "ok" | "warn" | "bad" | "info"; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border px-4 py-3 text-sm", tone === "bad" ? "bg-bad-bg border-bad/30 text-bad" : tone === "ok" ? "bg-ok-bg border-ok/30 text-ok" : tone === "info" ? "bg-info-bg border-info/30 text-info" : "bg-warn-bg border-warn/30 text-warn", className)}>{children}</div>
);

export const TooltipProvider = TooltipPrimitive.Provider;
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow">{label}</TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content sideOffset={4} align="end" className={cn("z-50 min-w-[10rem] rounded-lg border border-border bg-card p-1 shadow-lg", className)} {...p} />
  </DropdownMenuPrimitive.Portal>
);
export const DropdownMenuItem = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) => (
  <DropdownMenuPrimitive.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted data-[highlighted]:bg-muted [&_svg]:size-4", className)} {...p} />
);
