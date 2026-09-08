import * as React from "react";
import { cn } from "@/lib/utils";

const base = "flex w-full rounded-md border border-input bg-panel px-3 text-[16px] md:text-[14px] text-foreground placeholder:text-ink-3 focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-0 disabled:opacity-50 read-only:bg-muted read-only:text-ink-2";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-11 md:h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-[80px] py-2.5 leading-snug", className)} {...props} />
));
Textarea.displayName = "Textarea";

/** Select nativo: en móvil abre el picker del sistema, lo más rápido para capturar en obra. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, "h-11 md:h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238E8B83%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_10px_center] pr-8", className)} {...props}>{children}</select>
));
NativeSelect.displayName = "NativeSelect";
