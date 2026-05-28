import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, RefreshCw, Send, Check, X, WifiOff, Zap, ZapOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PhoneScan = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const applyTorch = async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks?.()[0] as any;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch {
      toast({ title: "Flash unavailable", description: "This camera does not support flash.", variant: "destructive" });
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
    setTorchOn(false);
    setTorchSupported(false);
  };

  const startStream = async (mode: "environment" | "user") => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0] as any;
      const caps = track?.getCapabilities?.();
      setTorchSupported(!!caps?.torch);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (err: any) {
      toast({
        title: "Camera unavailable",
        description: err?.message || "Could not access the camera.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`phone-scan:${sessionId}`, { config: { broadcast: { ack: true } } });
    ch.subscribe((status) => {
      setConnected(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "phone-online", payload: { ts: Date.now() } });
      }
    });
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!preview) startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const downscale = (dataUrl: string, maxDim = 1600, quality = 0.85): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > maxDim) {
          const ratio = maxDim / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });

  const snap = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const raw = canvas.toDataURL("image/jpeg", 0.92);
    const compressed = await downscale(raw);
    setPreview(compressed);
    stopStream();
  };

  const send = async () => {
    if (!preview || !channelRef.current) return;
    setSending(true);
    try {
      const res = await channelRef.current.send({
        type: "broadcast",
        event: "photo",
        payload: { dataUrl: preview, ts: Date.now() },
      });
      if (res === "ok" || res === "timed out") {
        setSentCount((n) => n + 1);
        toast({ title: "Photo sent", description: "Image delivered to laptop." });
        setPreview(null);
        startStream(facingMode);
      } else {
        toast({ title: "Send failed", description: "Try again.", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <p className="text-muted-foreground">Invalid session link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between bg-black/80 border-b border-white/10">
        <div>
          <p className="text-sm font-semibold">Phone Camera Bridge</p>
          <p className="text-xs text-white/60">Session {sessionId.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <span className="flex items-center gap-1 text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> Linked
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-400">
              <WifiOff size={12} /> Connecting…
            </span>
          )}
          <span className="text-white/60">Sent: {sentCount}</span>
        </div>
      </header>

      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {!preview ? (
          <>
            <video ref={videoRef} className="max-h-full max-w-full object-contain" playsInline muted />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin" />
              </div>
            )}
          </>
        ) : (
          <img src={preview} alt="Captured" className="max-h-full max-w-full object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <footer className="p-4 bg-black/90 border-t border-white/10 flex items-center justify-between gap-2">
        {!preview ? (
          <>
            <Button
              variant="outline"
              onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
              className="gap-2 bg-transparent text-white border-white/20"
            >
              <RefreshCw size={14} /> Flip
            </Button>
            <Button onClick={snap} disabled={!ready} className="gap-2 px-6">
              <Camera size={18} /> {ready ? "Capture" : "Loading camera…"}
            </Button>
            <div className="w-[88px]" />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => { setPreview(null); startStream(facingMode); }}
              disabled={sending}
              className="gap-2 bg-transparent text-white border-white/20"
            >
              <X size={14} /> Retake
            </Button>
            <Button onClick={send} disabled={sending || !connected} className="gap-2 px-6">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send to Laptop
            </Button>
            <div className="w-[88px]" />
          </>
        )}
      </footer>
    </div>
  );
};

export default PhoneScan;
