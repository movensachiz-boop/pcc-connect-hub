import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Camera, Upload, Smartphone, Loader2, Trash2, Save, Plus, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CameraCaptureDialog from "@/components/CameraCaptureDialog";
import PhoneCameraPairDialog from "@/components/PhoneCameraPairDialog";

interface StockEntry {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  source: string | null;
  received_on: string;
  notes: string | null;
  created_at: string;
}

interface DraftRow { id: string; item: string; quantity: string; unit: string }

const newDraft = (): DraftRow => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, item: "", quantity: "", unit: "units" });

export default function KitchenStockTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [source, setSource] = useState("");
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10));

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kitchen_stock_entries")
      .select("*")
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);
    setEntries((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const processImage = async (base64: string) => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("extract-stock-list", {
        body: { imageBase64: base64 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw new Error(resp.error.message || "Scan failed");
      const extracted: { item: string; quantity: string; unit: string }[] = resp.data?.rows || [];
      if (!extracted.length) {
        toast({ title: "No items found", description: "Try a clearer, straight-on photo of the page.", variant: "destructive" });
        return;
      }
      if (resp.data?.title && !source) setSource(String(resp.data.title).replace(/^current stock in from\s*/i, "").trim());
      setRows((prev) => [
        ...prev,
        ...extracted.map((r, i) => ({ id: `${Date.now()}-${i}`, item: r.item, quantity: r.quantity, unit: r.unit || "units" })),
      ]);
      setReviewOpen(true);
      toast({ title: `Read ${extracted.length} items`, description: "Check the quantities before saving." });
    } catch (err) {
      toast({ title: "Scan failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => processImage(reader.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateRow = (id: string, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const validRows = rows.filter((r) => r.item.trim());

  const saveRows = async () => {
    if (!validRows.length) {
      toast({ title: "Nothing to save", description: "Add at least one item.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const inserts = validRows.map((r) => ({
        item_name: r.item.trim(),
        quantity: parseFloat(r.quantity || "0") || 0,
        unit: r.unit.trim() || "units",
        source: source.trim() || null,
        received_on: receivedOn,
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from("kitchen_stock_entries").insert(inserts);
      if (error) throw error;
      toast({ title: "Stock recorded", description: `${inserts.length} items saved.` });
      setRows([]);
      setReviewOpen(false);
      fetchEntries();
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (e: StockEntry) => {
    if (!confirm(`Delete ${e.item_name}?`)) return;
    const { error } = await supabase.from("kitchen_stock_entries").delete().eq("id", e.id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    fetchEntries();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><ChefHat size={18} /> Kitchen Stock</CardTitle>
            <CardDescription>Photograph the stock book page and the system reads every item and quantity.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCameraOpen(true)} disabled={scanning} className="gap-2">
              <Camera size={16} /> Capture Page
            </Button>
            <Button variant="outline" onClick={() => setPhoneOpen(true)} disabled={scanning} className="gap-2">
              <Smartphone size={16} /> Scan with Phone
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning} className="gap-2">
              <Upload size={16} /> Upload Photo
            </Button>
            <Button variant="outline" onClick={() => { setRows([newDraft()]); setReviewOpen(true); }} className="gap-2">
              <Plus size={16} /> Enter Manually
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </CardHeader>
        <CardContent>
          {scanning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3">
              <Loader2 className="animate-spin h-4 w-4" /> Reading the page...
            </div>
          )}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <TableHead>Item</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                  <TableHead className="w-44">Source</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : entries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No stock recorded yet. Capture a page to begin.</TableCell></TableRow>
                ) : entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.item_name}</TableCell>
                    <TableCell>{Number(e.quantity)} {e.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.source || "—"}</TableCell>
                    <TableCell className="text-sm">{e.received_on}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteEntry(e)} title="Delete">
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={(v) => { if (!saving) setReviewOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Stock Received</DialogTitle>
            <DialogDescription>Correct any misread item or quantity, then save.</DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-3 border-b pb-3">
            <div>
              <Label className="text-xs">Source / Supplier</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Machingara" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Date Received</Label>
              <Input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28">Qty</TableHead>
                  <TableHead className="w-28">Unit</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={r.quantity} onChange={(e) => updateRow(r.id, { quantity: e.target.value })} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Input value={r.unit} onChange={(e) => updateRow(r.id, { unit: e.target.value })} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeRow(r.id)}>
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setRows((rs) => [...rs, newDraft()])}>
              <Plus size={14} /> Add row
            </Button>
          </div>

          <DialogFooter className="border-t pt-3 sm:justify-between">
            <div className="text-xs text-muted-foreground">{validRows.length} item{validRows.length === 1 ? "" : "s"} ready</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={saveRows} disabled={saving || !validRows.length} className="gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Stock
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={processImage}
        title="Capture Kitchen Stock Page"
        description="Hold the book flat and capture the full item and quantity columns."
      />

      <PhoneCameraPairDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        title="Scan Kitchen Stock with Phone"
        onPhotos={async (urls) => {
          for (const u of urls) {
            // eslint-disable-next-line no-await-in-loop
            await processImage(u);
          }
        }}
      />
    </>
  );
}
