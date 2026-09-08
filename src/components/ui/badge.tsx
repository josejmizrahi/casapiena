import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Etiquetas: mono, mayúsculas, sin relleno salvo estados (tinte muy suave).
const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm px-1.5 py-[3px] font-mono uppercase tracking-[0.08em] text-[9.5px] leading-none whitespace-nowrap border", {
  variants: {
    variant: {
      neutral: "border-border-2 text-ink-2 bg-transparent",
      ok: "border-transparent bg-ok-bg text-ok",
      warn: "border-transparent bg-warn-bg text-warn",
      bad: "border-transparent bg-bad-bg text-bad",
      info: "border-transparent bg-info-bg text-info",
      gold: "border-warn/40 text-warn bg-transparent",
      purple: "border-border-2 text-ink-2 bg-transparent",
      ink: "border-transparent bg-primary text-primary-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
