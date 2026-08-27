import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Edit, FileDown, Plus, Trash2, History, Archive, FileText } from "lucide-react";
import { DEFAULT_PRICING, DEFAULT_PROVIDER, DEFAULT_SECTIONS, SECTION_ORDER } from "@/lib/slaDefaults";
import { generateSLA } from "@/lib/generateSLA";
import { logSlaActivity } from "@/lib/slaAudit";

interface Agreement {
  id: string;
  agreement_number: string;
  status: string;
  client_name: string;
  contact_person: string | null;
  school_name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  start_date: string | null;
  expiry_date: string | null;
  renewal_date: string | null;
  monthly_fee: number;
  currency: string;
  provider: any;
  pricing: any;
  sections: any;
  current_version: number;
  created_at: string;
  updated_at: string;
}

const STATUSES = ["draft", "active", "expired", "awaiting_renewal", "archived"];

const DeveloperSla = () => {
  const [tab, setTab] = useState("dashboard");
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Agreement | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sla_agreements" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAgreements((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const stats = useMemo(() => {
    const total = agreements.length;
    const active = agreements.filter(a => a.status === "active").length;
    const expired = agreements.filter(a => a.status === "expired").length;
    const today = new Date();
    const renewSoon = agreements.filter(a => {
      if (a.status !== "active" || !a.expiry_date) return false;
      const d = new Date(a.expiry_date);
      const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;
    const revenue = agreements
      .filter(a => a.status === "active")
      .reduce((s, a) => s + Number(a.monthly_fee || 0), 0);
    return { total, active, expired, renewSoon, revenue };
  }, [agreements]);

  const filtered = useMemo(() => {
    return agreements.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.agreement_number?.toLowerCase().includes(q) ||
        a.client_name?.toLowerCase().includes(q) ||
        a.school_name?.toLowerCase().includes(q)
      );
    });
  }, [agreements, search, statusFilter]);

  const createNew = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("sla_agreements" as any)
      .insert({
        client_name: "New Client",
        provider: DEFAULT_PROVIDER,
        pricing: DEFAULT_PRICING,
        sections: DEFAULT_SECTIONS,
        monthly_fee: 60,
        currency: "USD",
        status: "draft",
        created_by: user?.id,
        updated_by: user?.id,
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    const ag = data as unknown as Agreement;
    await logSlaActivity("create", ag.id, { agreement_number: ag.agreement_number });
    await fetchAll();
    setEditing(ag);
    setTab("editor");
  };

  const duplicate = async (a: Agreement) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("sla_agreements" as any)
      .insert({
        client_name: a.client_name + " (Copy)",
        contact_person: a.contact_person,
        school_name: a.school_name,
        address: a.address,
        email: a.email,
        phone: a.phone,
        monthly_fee: a.monthly_fee,
        currency: a.currency,
        provider: a.provider,
        pricing: a.pricing,
        sections: a.sections,
        status: "draft",
        created_by: user?.id,
        updated_by: user?.id,
      } as any)
      .select().single();
    if (error) { toast.error(error.message); return; }
    await logSlaActivity("duplicate", (data as any).id, { source: a.id });
    toast.success("Duplicated");
    fetchAll();
  };

  const archive = async (a: Agreement) => {
    const { error } = await supabase
      .from("sla_agreements" as any)
      .update({ status: "archived" } as any)
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logSlaActivity("archive", a.id);
    toast.success("Archived");
    fetchAll();
  };

  const remove = async (a: Agreement) => {
    if (!confirm(`Delete ${a.agreement_number}? This cannot be undone.`)) return;
    const { error } = await supabase.from("sla_agreements" as any).delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logSlaActivity("delete", a.id, { agreement_number: a.agreement_number });
    toast.success("Deleted");
    fetchAll();
  };

  const saveEditing = async () => {
    if (!editing) return;
    const { data: { user } } = await supabase.auth.getUser();
    // snapshot prior
    await supabase.from("sla_versions" as any).insert({
      agreement_id: editing.id,
      version_number: (editing.current_version || 1),
      snapshot: editing,
      edited_by: user?.id,
    } as any);
    const { error } = await supabase
      .from("sla_agreements" as any)
      .update({
        ...editing,
        current_version: (editing.current_version || 1) + 1,
        updated_by: user?.id,
      } as any)
      .eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await logSlaActivity("update", editing.id);
    toast.success("Saved");
    fetchAll();
  };

  const exportPdf = async (a: Agreement) => {
    generateSLA({
      agreement_number: a.agreement_number,
      status: a.status,
      client_name: a.client_name,
      contact_person: a.contact_person,
      school_name: a.school_name,
      address: a.address,
      email: a.email,
      phone: a.phone,
      start_date: a.start_date,
      expiry_date: a.expiry_date,
      renewal_date: a.renewal_date,
      monthly_fee: Number(a.monthly_fee),
      currency: a.currency,
      provider: a.provider || DEFAULT_PROVIDER,
      pricing: a.pricing || DEFAULT_PRICING,
      sections: { ...DEFAULT_SECTIONS, ...(a.sections || {}) },
    });
    await logSlaActivity("pdf_export", a.id);
  };

  const openHistory = async (id: string) => {
    setHistoryOpen(id);
    const { data } = await supabase.from("sla_versions" as any)
      .select("*").eq("agreement_id", id).order("edited_at", { ascending: false });
    setVersions((data as any) || []);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="text-primary" />
              Developer Portal — Service Level Agreements
            </h1>
            <p className="text-sm text-muted-foreground">Internal contract management. Not visible to school users.</p>
          </div>
          <Button onClick={createNew} className="gap-2"><Plus size={16} /> New Agreement</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="agreements">Agreements</TabsTrigger>
            <TabsTrigger value="editor" disabled={!editing}>Editor</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["Total", stats.total],
                ["Active", stats.active],
                ["Expired", stats.expired],
                ["Awaiting Renewal", stats.renewSoon],
                ["Monthly Revenue", `$${stats.revenue.toFixed(2)}`],
              ].map(([l, v]) => (
                <Card key={l as string}>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{l}</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">{v as any}</CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="agreements" className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Search by client or number..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Number</th>
                      <th className="p-3">Client</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Fee/mo</th>
                      <th className="p-3">Expiry</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No agreements yet. Click "New Agreement".</td></tr>
                    ) : filtered.map(a => (
                      <tr key={a.id} className="border-t">
                        <td className="p-3 font-mono">{a.agreement_number}</td>
                        <td className="p-3">{a.client_name}<div className="text-xs text-muted-foreground">{a.school_name}</div></td>
                        <td className="p-3"><Badge variant="outline">{a.status}</Badge></td>
                        <td className="p-3">{a.currency} ${Number(a.monthly_fee).toFixed(2)}</td>
                        <td className="p-3">{a.expiry_date || "—"}</td>
                        <td className="p-3 text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setTab("editor"); }}><Edit size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => exportPdf(a)}><FileDown size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => duplicate(a)}><Copy size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => openHistory(a.id)}><History size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => archive(a)}><Archive size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 size={14} className="text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editor">
            {editing && (
              <EditorPane
                value={editing}
                onChange={setEditing}
                onSave={saveEditing}
                onExport={() => exportPdf(editing)}
              />
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) { setHistoryOpen(null); setVersions([]); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Version History</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No versions yet — versions are recorded each time you save.</p>
              ) : versions.map(v => (
                <div key={v.id} className="border rounded p-2 text-sm">
                  <div className="font-semibold">Version {v.version_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.edited_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryOpen(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

const EditorPane = ({
  value, onChange, onSave, onExport,
}: {
  value: Agreement;
  onChange: (a: Agreement) => void;
  onSave: () => void;
  onExport: () => void;
}) => {
  const set = (patch: Partial<Agreement>) => onChange({ ...value, ...patch });
  const provider = { ...DEFAULT_PROVIDER, ...(value.provider || {}) };
  const pricing = { ...DEFAULT_PRICING, ...(value.pricing || {}) };
  const sections = { ...DEFAULT_SECTIONS, ...(value.sections || {}) };
  const installations: string[] = pricing.installations || [];
  const setInstallations = (list: string[]) => set({ pricing: { ...pricing, installations: list } });

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Client Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Client Name"><Input value={value.client_name || ""} onChange={e => set({ client_name: e.target.value })} /></Field>
            <Field label="School Name"><Input value={value.school_name || ""} onChange={e => set({ school_name: e.target.value })} /></Field>
            <Field label="Contact Person"><Input value={value.contact_person || ""} onChange={e => set({ contact_person: e.target.value })} /></Field>
            <Field label="Address"><Input value={value.address || ""} onChange={e => set({ address: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Email"><Input value={value.email || ""} onChange={e => set({ email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={value.phone || ""} onChange={e => set({ phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Start"><Input type="date" value={value.start_date || ""} onChange={e => set({ start_date: e.target.value })} /></Field>
              <Field label="Expiry"><Input type="date" value={value.expiry_date || ""} onChange={e => set({ expiry_date: e.target.value })} /></Field>
              <Field label="Renewal"><Input type="date" value={value.renewal_date || ""} onChange={e => set({ renewal_date: e.target.value })} /></Field>
            </div>
            <Field label="Status">
              <Select value={value.status} onValueChange={v => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Monthly Fee"><Input type="number" step="0.01" value={value.monthly_fee} onChange={e => set({ monthly_fee: Number(e.target.value) })} /></Field>
              <Field label="Currency"><Input value={value.currency} onChange={e => set({ currency: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Additional modules and custom developments are quoted and billed separately.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Service Provider</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Name"><Input value={provider.name} onChange={e => set({ provider: { ...provider, name: e.target.value } })} /></Field>
            <Field label="Business Type"><Input value={provider.business_type} onChange={e => set({ provider: { ...provider, business_type: e.target.value } })} /></Field>
            <Field label="Address"><Input value={provider.address} onChange={e => set({ provider: { ...provider, address: e.target.value } })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone"><Input value={provider.phone} onChange={e => set({ provider: { ...provider, phone: e.target.value } })} /></Field>
              <Field label="Email"><Input value={provider.email} onChange={e => set({ provider: { ...provider, email: e.target.value } })} /></Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agreement Sections</CardTitle>
            <Button size="sm" variant="outline" onClick={() => set({ sections: DEFAULT_SECTIONS })}>Reset to defaults</Button>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {SECTION_ORDER.map(s => (
              <Field key={s.key} label={s.title}>
                <Textarea
                  rows={4}
                  value={sections[s.key] || ""}
                  onChange={e => set({ sections: { ...sections, [s.key]: e.target.value } })}
                />
              </Field>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2 sticky bottom-0">
          <Button onClick={onSave} className="flex-1">Save Changes</Button>
          <Button onClick={onExport} variant="outline" className="gap-2"><FileDown size={16} /> Export PDF</Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

export default DeveloperSla;
