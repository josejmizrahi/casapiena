import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      neutral: "bg-muted text-muted-foreground",
      ok: "bg-ok-bg text-ok",
      warn: "bg-warn-bg text-warn",
      bad: "bg-bad-bg text-bad",
      info: "bg-info-bg text-info",
      gold: "bg-gold-bg text-gold",
      purple: "bg-[oklch(0.94_0.03_310)] text-[oklch(0.45_0.12_310)]",
    },
  },
  defaultVariants: { variant: "neutral" },
});
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
