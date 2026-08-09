import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface EntityDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function EntityDetailPanel({ open, onOpenChange, title, children }: EntityDetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>{title}</SheetTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] pr-4">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
