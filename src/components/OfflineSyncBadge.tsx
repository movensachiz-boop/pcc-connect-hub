import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { subscribeQueue, syncQueue, initOfflineSync, type QueuedWrite } from "@/lib/offlineQueue";

export default function OfflineSyncBadge() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueuedWrite[]>([]);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initOfflineSync();
    const unsub = subscribeQueue(setItems);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && items.length === 0) return null;

  const doSync = async () => {
    setBusy(true);
    const { uploaded, failed } = await syncQueue();
    setBusy(false);
    toast({
      title: uploaded ? `${uploaded} record(s) uploaded` : "Nothing uploaded",
      description: failed ? `${failed} still waiting.` : "Saved records are now in the cloud.",
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
      {online ? (
        <CloudUpload size={14} className="text-primary" />
      ) : (
        <CloudOff size={14} className="text-destructive" />
      )}
      <span className="hidden sm:inline text-muted-foreground">
        {online ? "Online" : "Offline — saving on this device"}
        {items.length > 0 && ` · ${items.length} pending`}
      </span>
      <span className="sm:hidden text-muted-foreground">{items.length || (online ? "" : "Offline")}</span>
      {online && items.length > 0 && (
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={doSync} disabled={busy}>
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
        </Button>
      )}
    </div>
  );
}
