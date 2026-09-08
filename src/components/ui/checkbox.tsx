import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ label, className, ...props }: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2.5 text-[14px] cursor-pointer select-none min-h-11 md:min-h-8", className)}>
      <CheckboxPrimitive.Root className="size-[20px] shrink-0 rounded-[6px] border border-border-2 bg-panel data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground flex items-center justify-center" {...props}>
        <CheckboxPrimitive.Indicator><Check className="size-3 stroke-[3]" /></CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  );
}
