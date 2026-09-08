import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ label, className, ...props }: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm cursor-pointer select-none", className)}>
      <CheckboxPrimitive.Root className="size-5 shrink-0 rounded border border-input bg-card data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary flex items-center justify-center" {...props}>
        <CheckboxPrimitive.Indicator><Check className="size-3.5" /></CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  );
}
