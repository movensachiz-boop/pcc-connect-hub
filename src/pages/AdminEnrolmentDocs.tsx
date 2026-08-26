import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Printer, FileText, Loader2, Pencil, Plus, Trash2, RotateCcw } from "lucide-react";
import { ENROLMENT_PRESETS, type EnrolmentPreset } from "@/data/enrolmentDocs";
import type { EnrolmentDocData } from "@/lib/generateEnrolmentDoc";
import { downloadEnrolmentDoc, printEnrolmentDoc } from "@/lib/generateEnrolmentDoc";

const STORAGE_KEY = "pcc_enrolment_docs_v1";

export default function AdminEnrolmentDocs() {
  const { toast } = useToast();
  const [year, setYear] = useState("2027");
  const [campus, setCampus] = useState("Mkoba Campus");
  const [busy, setBusy] = useState<string | null>(null);
  const [presets, setPresets] = useState<EnrolmentPreset[]>(ENROLMENT_PRESETS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EnrolmentDocData | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, EnrolmentDocData>;
        setPresets(ENROLMENT_PRESETS.map((p) => (saved[p.id] ? { ...p, data: saved[p.id] } : p)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: EnrolmentPreset[]) => {
    setPresets(next);
    const map: Record<string, EnrolmentDocData> = {};
    next.forEach((p) => (map[p.id] = p.data));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  };

  const editing = useMemo(() => presets.find((p) => p.id === editingId) ?? null, [presets, editingId]);

  const openEdit = (p: EnrolmentPreset) => {
    setEditingId(p.id);
    setDraft(JSON.parse(JSON.stringify(p.data)) as EnrolmentDocData);
  };

  const saveDraft = () => {
    if (!editingId || !draft) return;
    persist(presets.map((p) => (p.id === editingId ? { ...p, data: draft } : p)));
    setEditingId(null);
    setDraft(null);
    toast({ title: "Document list saved" });
  };

  const resetPreset = (id: string) => {
    const original = ENROLMENT_PRESETS.find((p) => p.id === id);
    if (!original) return;
    persist(presets.map((p) => (p.id === id ? { ...p, data: original.data } : p)));
    toast({ title: "Reset to defaults" });
  };

  const run = async (id: string, action: "download" | "print") => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setBusy(`${id}-${action}`);
    try {
      const data = { ...preset.data, year, campus };
      if (action === "download") await downloadEnrolmentDoc(data);
      else await printEnrolmentDoc(data);
      toast({ title: action === "download" ? "PDF downloaded" : "Sent to printer", description: preset.title });
    } catch (e) {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy("all");
    try {
      for (const p of presets) {
        await downloadEnrolmentDoc({ ...p.data, year, campus });
      }
      toast({ title: "All enrolment documents downloaded" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enrolment Documents</h1>
            <p className="text-sm text-muted-foreground">
              Download the official Progress Centre College enrolment requirements sheets as PDF.
            </p>
          </div>
          <Button onClick={downloadAll} disabled={!!busy} className="gap-2">
            {busy === "all" ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            Download all
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="year">Enrolment year</Label>
              <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campus">Campus</Label>
              <Input id="campus" value={campus} onChange={(e) => setCampus(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {presets.map((p) => {
            const total = p.data.uniforms.reduce((s, u) => s + u.qty * u.price, 0);
            return (
              <Card key={p.id} className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Fees {p.data.fees[p.data.fees.length - 1]?.amount}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Uniform ${total.toFixed(2)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {p.data.uniforms.length} items · {p.data.books.length} books
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 flex-1"
                      disabled={!!busy}
                      onClick={() => run(p.id, "download")}
                    >
                      {busy === `${p.id}-download` ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <FileDown size={14} />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 flex-1"
                      disabled={!!busy}
                      onClick={() => run(p.id, "print")}
                    >
                      <Printer size={14} /> Print
                    </Button>
                    <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => openEdit(p)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => resetPreset(p.id)}
                      title="Reset to defaults"
                    >
                      <RotateCcw size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog
        open={!!editingId}
        onOpenChange={(o) => {
          if (!o) {
            setEditingId(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.title}</DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Level label</Label>
                  <Input
                    value={draft.levelLabel}
                    onChange={(e) => setDraft({ ...draft, levelLabel: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Uniform heading</Label>
                  <Input
                    value={draft.uniformHeading}
                    onChange={(e) => setDraft({ ...draft, uniformHeading: e.target.value })}
                  />
                </div>
              </div>

              {/* Fees */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Fees</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDraft({ ...draft, fees: [...draft.fees, { label: "", amount: "$0.00" }] })}
                  >
                    <Plus size={14} /> Add fee
                  </Button>
                </div>
                {draft.fees.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Item"
                      value={f.label}
                      onChange={(e) => {
                        const fees = [...draft.fees];
                        fees[i] = { ...fees[i], label: e.target.value };
                        setDraft({ ...draft, fees });
                      }}
                    />
                    <Input
                      className="w-32"
                      placeholder="$0.00"
                      value={f.amount}
                      onChange={(e) => {
                        const fees = [...draft.fees];
                        fees[i] = { ...fees[i], amount: e.target.value };
                        setDraft({ ...draft, fees });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDraft({ ...draft, fees: draft.fees.filter((_, x) => x !== i) })}
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Books */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Books / stationery</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDraft({ ...draft, books: [...draft.books, ""] })}
                  >
                    <Plus size={14} /> Add book
                  </Button>
                </div>
                {draft.books.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={b}
                      onChange={(e) => {
                        const books = [...draft.books];
                        books[i] = e.target.value;
                        setDraft({ ...draft, books });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDraft({ ...draft, books: draft.books.filter((_, x) => x !== i) })}
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Uniforms */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Uniform items — total $
                    {draft.uniforms.reduce((s, u) => s + u.qty * u.price, 0).toFixed(2)}
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setDraft({ ...draft, uniforms: [...draft.uniforms, { name: "", qty: 1, price: 0 }] })
                    }
                  >
                    <Plus size={14} /> Add item
                  </Button>
                </div>
                {draft.uniforms.map((u, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Item name"
                      value={u.name}
                      onChange={(e) => {
                        const uniforms = [...draft.uniforms];
                        uniforms[i] = { ...uniforms[i], name: e.target.value };
                        setDraft({ ...draft, uniforms });
                      }}
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      value={u.qty}
                      onChange={(e) => {
                        const uniforms = [...draft.uniforms];
                        uniforms[i] = { ...uniforms[i], qty: Number(e.target.value) || 0 };
                        setDraft({ ...draft, uniforms });
                      }}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      min={0}
                      step="0.01"
                      value={u.price}
                      onChange={(e) => {
                        const uniforms = [...draft.uniforms];
                        uniforms[i] = { ...uniforms[i], price: Number(e.target.value) || 0 };
                        setDraft({ ...draft, uniforms });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDraft({ ...draft, uniforms: draft.uniforms.filter((_, x) => x !== i) })}
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Footnote</Label>
                <Input
                  value={draft.footNote ?? ""}
                  onChange={(e) => setDraft({ ...draft, footNote: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveDraft}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
