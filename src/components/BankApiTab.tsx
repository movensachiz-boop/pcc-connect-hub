import { useEffect, useState } from "react";
import { Copy, Download, KeyRound, Plug, RefreshCw, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateBankApiDocs } from "@/lib/generateBankApiDocs";
import { toast } from "sonner";

const STORAGE_KEY = "dataplex-bank-api-details";
const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-api`;

const defaults = {
  bankName: "National Building Society",
  bankContact: "Luckson Moyo — POS Merchant Service Officer",
  schoolName: "Progress Christian Centre",
  collectionAccount: "3251011999451",
  preparedBy: "Takudzwa Singo — Dataplex Softwares",
  contactEmail: "dataplexsoftwares@gmail.com",
  contactPhone: "+263 77 400 0143",
};

type ApiKey = {
  id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

type ApiLog = {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  registration_number: string | null;
  bank_reference: string | null;
  error: string | null;
  created_at: string;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const BankApiTab = () => {
  const [details, setDetails] = useState(defaults);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [label, setLabel] = useState("NBS Production");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: keyRows }, { data: logRows }, { count }] = await Promise.all([
      supabase.from("bank_api_keys").select("id, label, key_prefix, is_active, last_used_at, created_at").order("created_at", { ascending: false }),
      supabase.from("bank_api_logs").select("id, endpoint, method, status_code, registration_number, bank_reference, error, created_at").order("created_at", { ascending: false }).limit(25),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setKeys((keyRows as ApiKey[]) || []);
    setLogs((logRows as ApiLog[]) || []);
    setStudentCount(count || 0);
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setDetails({ ...defaults, ...JSON.parse(saved) }); } catch { /* keep defaults */ }
    }
    load();
  }, []);

  const setField = (key: keyof typeof defaults, value: string) => {
    const next = { ...details, [key]: value };
    setDetails(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const createKey = async () => {
    if (!label.trim()) { toast.error("Give the key a name first"); return; }
    setBusy(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const raw = `pcc_${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;
      const { error } = await supabase.from("bank_api_keys").insert({
        label: label.trim(),
        key_prefix: raw.slice(0, 12),
        key_hash: await sha256(raw),
      });
      if (error) throw error;
      setNewKey(raw);
      setLabel("");
      await load();
    } catch {
      toast.error("Could not create the key");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("bank_api_keys")
      .update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Could not revoke the key"); return; }
    toast.success("Key revoked");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("bank_api_keys").delete().eq("id", id);
    if (error) { toast.error("Could not delete the key"); return; }
    load();
  };

  const downloadDocs = () => {
    generateBankApiDocs({ ...details, baseUrl: BASE_URL, studentCount });
    toast.success("Integration document downloaded");
  };

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Plug className="h-4 w-4" /> Live integration
          </div>
          <h2 className="text-2xl font-bold">Bank Payment Interface</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Secure connection the bank uses to look up learners, post payments and read payment history. Issue a key, then send the document to the bank.
          </p>
        </div>
        <Button onClick={downloadDocs} className="gap-2"><Download className="h-4 w-4" /> Download Integration Document</Button>
      </section>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Connection address</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">{BASE_URL}</code>
            <Button size="icon" variant="outline" onClick={() => copy(BASE_URL)}><Copy className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span>GET /students — full learner register</span>
            <span>GET /students/&#123;reg&#125; — lookup and balance</span>
            <span>POST /payments — post a collection</span>
            <span>GET /students/&#123;reg&#125;/payments — history</span>
            <span>GET /fee-categories — Tuition and Levy</span>
            <span>GET /health — availability check</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Access keys</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={label} placeholder="Key name, e.g. NBS Production" onChange={e => setLabel(e.target.value)} />
            <Button onClick={createKey} disabled={busy}>Issue New Key</Button>
          </div>
          {keys.length === 0 && <p className="text-sm text-muted-foreground">No keys issued yet.</p>}
          <div className="space-y-2">
            {keys.map(key => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">{key.label}</strong>
                    <Badge variant={key.is_active ? "default" : "secondary"}>{key.is_active ? "Active" : "Revoked"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {key.key_prefix}••••••••  ·  issued {new Date(key.created_at).toLocaleDateString("en-GB")}
                    {key.last_used_at ? ` · last used ${new Date(key.last_used_at).toLocaleString("en-GB")}` : " · never used"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {key.is_active && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => revoke(key.id)}>
                      <ShieldOff className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(key.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent bank requests</CardTitle>
          <Button size="icon" variant="ghost" onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — activity appears here as soon as the bank connects.</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map(log => (
                <div key={log.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                  <Badge variant={log.status_code < 300 ? "default" : "destructive"}>{log.status_code}</Badge>
                  <span className="font-mono">{log.method} {log.endpoint}</span>
                  {log.registration_number && <span className="text-muted-foreground">{log.registration_number}</span>}
                  {log.bank_reference && <span className="text-muted-foreground">ref {log.bank_reference}</span>}
                  {log.error && <span className="text-destructive">{log.error}</span>}
                  <span className="ml-auto text-muted-foreground">{new Date(log.created_at).toLocaleString("en-GB")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Bank Name"><Input value={details.bankName} onChange={e => setField("bankName", e.target.value)} /></Field>
          <Field label="Bank Contact"><Input value={details.bankContact} onChange={e => setField("bankContact", e.target.value)} /></Field>
          <Field label="School Name"><Input value={details.schoolName} onChange={e => setField("schoolName", e.target.value)} /></Field>
          <Field label="Collection Account Number"><Input value={details.collectionAccount} onChange={e => setField("collectionAccount", e.target.value)} /></Field>
          <Field label="Prepared By"><Input value={details.preparedBy} onChange={e => setField("preparedBy", e.target.value)} /></Field>
          <Field label="Contact Email"><Input value={details.contactEmail} onChange={e => setField("contactEmail", e.target.value)} /></Field>
          <Field label="Contact Phone"><Input value={details.contactPhone} onChange={e => setField("contactPhone", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Dialog open={!!newKey} onOpenChange={() => setNewKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copy this key now</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is the only time the full key is shown. Send it to the bank securely — never by plain email.
          </p>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">{newKey}</code>
          <DialogFooter>
            <Button variant="outline" onClick={() => newKey && copy(newKey)} className="gap-2"><Copy className="h-4 w-4" /> Copy</Button>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

export default BankApiTab;
