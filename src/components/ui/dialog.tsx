import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Hoja: en móvil sube desde abajo, en escritorio es un modal centrado. */
export function DialogContent({ className, children, title, description, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-card shadow-xl focus:outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl",
          "md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:max-h-[88vh]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 shrink-0">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-xs text-muted-foreground mt-0.5">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Cerrar"><X className="size-5" /></DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 pb-5 space-y-3">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
/** Barra de acciones al pie de un diálogo. */
export const DialogActions = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-wrap gap-2 pt-2 [&>button]:flex-1 [&>button]:min-w-[110px]", className)}>{children}</div>
);
