import { useEffect, useState } from "react";
import { Building2, Download, FileCheck2, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { generateBankProposal } from "@/lib/generateBankProposal";
import { toast } from "sonner";

const STORAGE_KEY = "dataplex-bank-proposal-details";

const defaults = {
  bankName: "",
  bankContact: "",
  schoolName: "Progress Christian Centre",
  schoolAddress: "11729 Mkoba 14, Gweru, Zimbabwe",
  schoolPhone: "+263 77 400 0143",
  preparedBy: "Takudzwa Singo — Dataplex Softwares",
};

const BankIntegrationProposal = () => {
  const [details, setDetails] = useState(defaults);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadStudentCount = async () => {
    const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    if (error) {
      toast.error("Could not load the live student total");
      return;
    }
    setStudentCount(count || 0);
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDetails({ ...defaults, ...JSON.parse(saved) });
      } catch { /* Keep safe defaults if saved details are damaged. */ }
    }
    loadStudentCount();
  }, []);

  const setField = (key: keyof typeof defaults, value: string) => {
    const next = { ...details, [key]: value };
    setDetails(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const download = async () => {
    if (!details.bankName.trim()) {
      toast.error("Enter the bank name first");
      return;
    }
    setLoading(true);
    try {
      await loadStudentCount();
      await generateBankProposal({ ...details, studentCount });
      toast.success("Bank integration proposal downloaded");
    } catch {
      toast.error("Could not generate the bank proposal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Landmark className="h-4 w-4" /> Bank-ready document
            </div>
            <h2 className="text-2xl font-bold">Banking Integration Proposal</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A separate proposal covering the finance system, receipt samples and everything required from the bank before launch.
            </p>
          </div>
          <Button onClick={download} disabled={loading} className="gap-2">
            <Download className="h-4 w-4" /> {loading ? "Preparing…" : "Download Bank Proposal"}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" /> Registered learners</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <strong className="text-3xl">{studentCount.toLocaleString()}</strong>
            <Button size="icon" variant="ghost" onClick={loadStudentCount} aria-label="Refresh student total"><RefreshCw className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileCheck2 className="h-4 w-4 text-primary" /> Included in the PDF</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <span>Finance and reconciliation flow</span><span>Requirements from the bank</span>
            <span>Registration-number matching</span><span>Fees and inventory receipts</span>
            <span>Security and duplicate controls</span><span>Go-live responsibilities and checklist</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Document Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Bank Name *"><Input value={details.bankName} placeholder="Enter the receiving bank" onChange={event => setField("bankName", event.target.value)} /></Field>
          <Field label="Bank Contact / Department"><Input value={details.bankContact} placeholder="e.g. Head of Digital Banking" onChange={event => setField("bankContact", event.target.value)} /></Field>
          <Field label="School Name"><Input value={details.schoolName} onChange={event => setField("schoolName", event.target.value)} /></Field>
          <Field label="School Phone"><Input value={details.schoolPhone} onChange={event => setField("schoolPhone", event.target.value)} /></Field>
          <Field label="School Address"><Input value={details.schoolAddress} onChange={event => setField("schoolAddress", event.target.value)} /></Field>
          <Field label="Prepared By"><Input value={details.preparedBy} onChange={event => setField("preparedBy", event.target.value)} /></Field>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

export default BankIntegrationProposal;