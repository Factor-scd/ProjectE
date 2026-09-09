import { useState, useEffect } from "react";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Wifi, WifiOff, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const [collapsed, setCollapsed] = useState(false);
  const [sseStatus, setSseStatus] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");
  const activeDomainId = useApiDomain();

  useEffect(() => {
    const es = new EventSource("/api/realtime");
    const check = () => {
      if (es.readyState === EventSource.OPEN) setSseStatus("connected");
      else if (es.readyState === EventSource.CONNECTING) setSseStatus("reconnecting");
      else setSseStatus("disconnected");
    };
    es.onopen = () => setSseStatus("connected");
    es.onerror = () => check();
    const interval = setInterval(check, 5000);
    return () => {
      es.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="border-t bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground flex items-center gap-4 shrink-0">
      <span className="flex items-center gap-1">
        {sseStatus === "connected" ? (
          <Wifi className="h-3 w-3 text-green-500" />
        ) : (
          <WifiOff className="h-3 w-3 text-amber-500" />
        )}
        {sseStatus}
      </span>
      {activeDomainId && <span>Domain: {activeDomainId.slice(0, 8)}</span>}
      <span className="ml-auto">
        <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">⌘K</kbd>
      </span>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hover:text-foreground"
      >
        {collapsed ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
