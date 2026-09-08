import * as React from "react";
import { cn } from "@/lib/utils";

/* Sección de contenido: regla superior hairline y anotación en mono, sin caja.
   Mantiene los nombres Card* para no tocar las vistas. */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...p }, ref) => (
  <section ref={ref} className={cn("border-t border-border-2 pt-3 pb-1", className)} {...p} />
));
Card.displayName = "Card";
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-start justify-between gap-3 pb-2", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("anno !text-foreground pt-0.5", className)} {...p} />;
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-[13px] text-ink-2 mt-1.5 normal-case tracking-normal font-sans leading-snug", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("pt-1", className)} {...p} />;
