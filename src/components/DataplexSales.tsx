import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Edit, Copy, BarChart3, ArrowRightLeft } from "lucide-react";
import { DEFAULT_PROVIDER } from "@/lib/slaDefaults";
import { computeTotals, generateSalesDoc, SalesLineItem } from "@/lib/generateSalesDoc";
import { generateSalesReport } from "@/lib/generateSalesReport";
import { logSlaActivity } from "@/lib/slaAudit";

type DocType = "quotation" | "invoice" | "receipt";

interface SalesDoc {
  id: string;
  doc_type: DocType;
  doc_number: string;
  client_name: string;
  contact_person: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  issue_date: string | null;
  due_date: string | null;
  valid_until: string | null;
  status: string;
  currency: string;
  items: SalesLineItem[];
  tax_percent: number;
  discount: number;
  amount_paid: number;
  payment_method: string | null;
  notes: string | null;
  provider: any;
  total: number;
  created_at: string;
}

const STATUS_BY_TYPE: Record<DocType, string[]> = {
  quotation: ["draft", "sent", "accepted", "declined", "expired"],
  invoice: ["draft", "sent", "part_paid", "paid", "overdue", "cancelled"],
  receipt: ["issued", "cancelled"],
};

const money = (n: number, cur = "USD") => `${cur} $${Number(n || 0).toFixed(2)}`;

const DataplexSales = () => {
  const [docs, setDocs] = useState<SalesDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | DocType>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<SalesDoc | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dataplex_documents" as any)
      .select("*")
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs(((data as any) || []) as SalesDoc[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => docs.filter(d => {
    if (typeFilter !== "all" && d.doc_type !== typeFilter) return false;
    if (from && (d.issue_date || "") < from) return false;
    if (to && (d.issue_date || "") > to) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.doc_number?.toLowerCase().includes(q) || d.client_name?.toLowerCase().includes(q);
  }), [docs, typeFilter, search, from, to]);

  const stats = useMemo(() => {
    const t = (d: SalesDoc) => computeTotals(d as any);
    const inv = filtered.filter(d => d.doc_type === "invoice");
    return {
      quoted: filtered.filter(d => d.doc_type === "quotation").reduce((s, d) => s + t(d).total, 0),
      invoiced: inv.reduce((s, d) => s + t(d).total, 0),
      collected: filtered.reduce((s, d) => s + t(d).paid, 0),
      outstanding: inv.reduce((s, d) => s + Math.max(0, t(d).balance), 0),
    };
  }, [filtered]);

  const createNew = async (doc_type: DocType) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("dataplex_documents" as any).insert({
      doc_type,
      client_name: "New Client",
      status: doc_type === "receipt" ? "issued" : "draft",
      provider: DEFAULT_PROVIDER,
      items: [{ description: "Software support & maintenance", qty: 1, unit_price: 60 }],
      created_by: user?.id,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    await logSlaActivity(`${doc_type}_create`, null, { doc_number: (data as any).doc_number });
    await fetchAll();
    setEditing(data as any);
  };

  const save = async (d: SalesDoc) => {
    const t = computeTotals(d as any);
    const { id, created_at, ...rest } = d;
    const { error } = await supabase.from("dataplex_documents" as any)
      .update({ ...rest, total: t.total } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logSlaActivity(`${d.doc_type}_update`, null, { doc_number: d.doc_number });
    toast.success("Saved");
    setEditing(null);
    fetchAll();
  };

  const remove = async (d: SalesDoc) => {
    if (!confirm(`Delete ${d.doc_number}?`)) return;
    const { error } = await supabase.from("dataplex_documents" as any).delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetchAll();
  };

  const convert = async (d: SalesDoc, doc_type: DocType) => {
    const { data: { user } } = await supabase.auth.getUser();
    const t = computeTotals(d as any);
    const { error } = await supabase.from("dataplex_documents" as any).insert({
      doc_type,
      client_name: d.client_name,
      contact_person: d.contact_person,
      address: d.address,
      email: d.email,
      phone: d.phone,
      currency: d.currency,
      items: d.items,
      tax_percent: d.tax_percent,
      discount: d.discount,
      amount_paid: doc_type === "receipt" ? t.total : 0,
      status: doc_type === "receipt" ? "issued" : "draft",
      notes: d.notes,
      provider: d.provider || DEFAULT_PROVIDER,
      total: t.total,
      created_by: user?.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Created ${doc_type} from ${d.doc_number}`);
    fetchAll();
  };

  const exportPdf = async (d: SalesDoc) => {
    await generateSalesDoc({ ...(d as any), items: d.items || [] });
    await logSlaActivity(`${d.doc_type}_pdf_export`, null, { doc_number: d.doc_number });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => createNew("quotation")} className="gap-2"><Plus size={16} /> Quotation</Button>
        <Button onClick={() => createNew("invoice")} variant="secondary" className="gap-2"><Plus size={16} /> Invoice</Button>
        <Button onClick={() => createNew("receipt")} variant="secondary" className="gap-2"><Plus size={16} /> Receipt</Button>
        <Button
          variant="outline"
          className="gap-2 ml-auto"
          onClick={() => generateSalesReport(filtered.map(d => ({ ...(d as any), items: d.items || [] })), { from, to })}
        >
          <BarChart3 size={16} /> Sales Report PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Quoted", stats.quoted],
          ["Invoiced", stats.invoiced],
          ["Collected", stats.collected],
          ["Outstanding", stats.outstanding],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{l as string}</CardTitle></CardHeader>
            <CardContent className="text-xl font-bold">${Number(v).toFixed(2)}</CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search number or client…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="quotation">Quotations</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="receipt">Receipts</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
        <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Type</th>
                <th className="p-3">Client</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No documents yet.</td></tr>
              ) : filtered.map(d => {
                const t = computeTotals(d as any);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="p-3 font-mono">{d.doc_number}</td>
                    <td className="p-3 capitalize">{d.doc_type}</td>
                    <td className="p-3">{d.client_name}</td>
                    <td className="p-3">{d.issue_date || "—"}</td>
                    <td className="p-3"><Badge variant="outline">{d.status}</Badge></td>
                    <td className="p-3 text-right">{money(t.total, d.currency)}</td>
                    <td className="p-3 text-right">{d.doc_type === "quotation" ? "—" : money(t.balance, d.currency)}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(d)}><Edit size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => exportPdf(d)}><FileDown size={14} /></Button>
                      {d.doc_type === "quotation" && (
                        <Button size="sm" variant="ghost" title="Convert to invoice" onClick={() => convert(d, "invoice")}><ArrowRightLeft size={14} /></Button>
                      )}
                      {d.doc_type === "invoice" && (
                        <Button size="sm" variant="ghost" title="Create receipt" onClick={() => convert(d, "receipt")}><Copy size={14} /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 size={14} className="text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {editing?.doc_type} — {editing?.doc_number}
            </DialogTitle>
          </DialogHeader>
          {editing && <DocEditor value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && <Button variant="secondary" className="gap-2" onClick={() => exportPdf(editing)}><FileDown size={14} /> PDF</Button>}
            {editing && <Button onClick={() => save(editing)}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
);

const DocEditor = ({ value, onChange }: { value: SalesDoc; onChange: (d: SalesDoc) => void }) => {
  const set = (patch: Partial<SalesDoc>) => onChange({ ...value, ...patch });
  const items: SalesLineItem[] = value.items || [];
  const setItems = (list: SalesLineItem[]) => set({ items: list });
  const t = computeTotals({ ...(value as any), items });

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Client Name"><Input value={value.client_name || ""} onChange={e => set({ client_name: e.target.value })} /></Field>
        <Field label="Contact Person"><Input value={value.contact_person || ""} onChange={e => set({ contact_person: e.target.value })} /></Field>
        <Field label="Address"><Input value={value.address || ""} onChange={e => set({ address: e.target.value })} /></Field>
        <Field label="Email"><Input value={value.email || ""} onChange={e => set({ email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={value.phone || ""} onChange={e => set({ phone: e.target.value })} /></Field>
        <Field label="Currency"><Input value={value.currency || "USD"} onChange={e => set({ currency: e.target.value })} /></Field>
        <Field label="Issue Date"><Input type="date" value={value.issue_date || ""} onChange={e => set({ issue_date: e.target.value })} /></Field>
        {value.doc_type === "quotation" ? (
          <Field label="Valid Until"><Input type="date" value={value.valid_until || ""} onChange={e => set({ valid_until: e.target.value })} /></Field>
        ) : (
          <Field label="Due Date"><Input type="date" value={value.due_date || ""} onChange={e => set({ due_date: e.target.value })} /></Field>
        )}
        <Field label="Status">
          <Select value={value.status} onValueChange={v => set({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_BY_TYPE[value.doc_type].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {value.doc_type !== "quotation" && (
          <Field label="Payment Method"><Input value={value.payment_method || ""} onChange={e => set({ payment_method: e.target.value })} placeholder="EcoCash / Bank / Cash" /></Field>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Line Items</Label>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setItems([...items, { description: "", qty: 1, unit_price: 0 }])}>
            <Plus size={14} /> Add item
          </Button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input className="flex-1" placeholder="Description" value={it.description}
              onChange={e => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <Input className="w-20" type="number" step="1" value={it.qty}
              onChange={e => setItems(items.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
            <Input className="w-28" type="number" step="0.01" value={it.unit_price}
              onChange={e => setItems(items.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
            <div className="w-24 text-right text-sm">{money(Number(it.qty || 0) * Number(it.unit_price || 0), value.currency)}</div>
            <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={14} className="text-destructive" /></Button>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Discount"><Input type="number" step="0.01" value={value.discount || 0} onChange={e => set({ discount: Number(e.target.value) })} /></Field>
        <Field label="Tax %"><Input type="number" step="0.1" value={value.tax_percent || 0} onChange={e => set({ tax_percent: Number(e.target.value) })} /></Field>
        {value.doc_type !== "quotation" && (
          <Field label="Amount Paid"><Input type="number" step="0.01" value={value.amount_paid || 0} onChange={e => set({ amount_paid: Number(e.target.value) })} /></Field>
        )}
      </div>

      <Field label="Notes"><Textarea rows={3} value={value.notes || ""} onChange={e => set({ notes: e.target.value })} /></Field>

      <div className="rounded-md border p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(t.subtotal, value.currency)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>-{money(t.discount, value.currency)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>{money(t.tax, value.currency)}</span></div>
        <div className="flex justify-between font-bold text-primary"><span>Total</span><span>{money(t.total, value.currency)}</span></div>
        {value.doc_type !== "quotation" && (
          <div className="flex justify-between"><span>Balance</span><span>{money(t.balance, value.currency)}</span></div>
        )}
      </div>
    </div>
  );
};

export default DataplexSales;
