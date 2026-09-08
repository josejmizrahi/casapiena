import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn("flex w-full border-b border-border-2", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn("flex-1 -mb-px border-b-2 border-transparent px-3 py-2.5 text-[14px] font-medium text-ink-2 data-[state=active]:border-foreground data-[state=active]:text-foreground", className)} {...p} />
);
export const TabsContent = TabsPrimitive.Content;
