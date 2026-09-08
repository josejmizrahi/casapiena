import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Botones: rectos, radio mínimo, 44px de alto en móvil (objetivo táctil), 40 en escritorio.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[14px] font-medium tracking-[0.005em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-ink-2",
        secondary: "bg-panel border border-border-2 text-foreground hover:bg-muted",
        outline: "border border-border-2 bg-transparent hover:bg-muted",
        ghost: "hover:bg-muted text-ink-2 hover:text-foreground",
        destructive: "text-bad border border-bad/40 bg-transparent hover:bg-bad-bg",
        dashed: "border border-dashed border-border-2 text-ink-2 hover:bg-muted hover:text-foreground w-full",
        link: "text-foreground underline underline-offset-4 decoration-border-2 hover:decoration-foreground px-0 h-auto",
      },
      size: { default: "h-11 md:h-10 px-4", sm: "h-9 px-3 text-[13px]", lg: "h-12 px-6 text-[15px]", icon: "h-10 w-10 md:h-9 md:w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={asChild ? undefined : type} {...props} />;
});
Button.displayName = "Button";
export { buttonVariants };
