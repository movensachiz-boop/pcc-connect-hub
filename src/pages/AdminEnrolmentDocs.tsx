import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Printer, FileText, Loader2 } from "lucide-react";
import { ENROLMENT_PRESETS } from "@/data/enrolmentDocs";
import { downloadEnrolmentDoc, printEnrolmentDoc } from "@/lib/generateEnrolmentDoc";

export default function AdminEnrolmentDocs() {
  const { toast } = useToast();
  const [year, setYear] = useState("2027");
  const [campus, setCampus] = useState("Mkoba Campus");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: "download" | "print") => {
    const preset = ENROLMENT_PRESETS.find((p) => p.id === id);
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
      for (const p of ENROLMENT_PRESETS) {
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
          {ENROLMENT_PRESETS.map((p) => {
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
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
