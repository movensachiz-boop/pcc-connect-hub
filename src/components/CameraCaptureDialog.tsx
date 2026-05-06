import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, RefreshCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string) => void | Promise<void>;
  title?: string;
  description?: string;
}

const CameraCaptureDialog = ({ open, onOpenChange, onCapture, title = "Scan with Camera", description = "Point your camera at the list and capture a clear photo." }: CameraCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const { toast } = useToast();

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  };

  const startStream = async (mode: "environment" | "user") => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (err: any) {
      toast({
        title: "Camera unavailable",
        description: err?.message?.includes("Permission")
          ? "Allow camera access in your browser settings."
          : "Could not access the camera on this device.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (open && !preview) {
      startStream(facingMode);
    }
    if (!open) {
      stopStream();
      setPreview(null);
    }
    return () => {
      if (!open) stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreview(dataUrl);
    stopStream();
  };

  const retake = () => {
    setPreview(null);
    startStream(facingMode);
  };

  const flip = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
  };

  const confirm = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      await onCapture(preview);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera size={18} /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video flex items-center justify-center">
          {!preview ? (
            <>
              <video ref={videoRef} className="h-full w-full object-contain" playsInline muted />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </>
          ) : (
            <img src={preview} alt="Captured" className="h-full w-full object-contain" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {!preview && ready && (
              <Button type="button" variant="outline" onClick={flip} className="gap-2">
                <RefreshCw size={14} /> Flip
              </Button>
            )}
            {preview && (
              <Button type="button" variant="outline" onClick={retake} disabled={submitting} className="gap-2">
                <RefreshCw size={14} /> Retake
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting} className="gap-2">
              <X size={14} /> Cancel
            </Button>
            {!preview ? (
              <Button type="button" onClick={snap} disabled={!ready} className="gap-2">
                <Camera size={14} /> Capture
              </Button>
            ) : (
              <Button type="button" onClick={confirm} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Use Photo
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCaptureDialog;
