import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Hoja: en móvil sube desde abajo casi a pantalla completa; en escritorio es un panel centrado. */
export function DialogContent({ className, children, title, description, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[#171716]/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-panel shadow-[0_-1px_0_var(--line-2)] focus:outline-none",
          "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-lg",
          "md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:max-h-[88vh] md:border md:border-border-2 md:shadow-none",
          className,
        )}
        {...props}
      >
        <div className="md:hidden mx-auto mt-2 h-1 w-9 rounded-full bg-border-2" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 shrink-0 border-b border-border">
          <div className="min-w-0">
            {description ? <DialogPrimitive.Description className="anno mb-1">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
            <DialogPrimitive.Title className="text-[19px] font-semibold leading-tight truncate">{title}</DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close className="rounded-md p-2 -mr-2 text-ink-2 hover:bg-muted" aria-label="Cerrar"><X className="size-5 stroke-[1.75]" /></DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const DialogActions = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-wrap gap-2 pt-3 border-t border-border [&>button]:flex-1 [&>button]:min-w-[110px]", className)}>{children}</div>
);
