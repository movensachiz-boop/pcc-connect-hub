import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { titleCaseName } from "@/lib/normalize";
import {
  generateCashReport, generatePeriodCashReport, generateInventoryReport,
  CashTxn, CashOutflow, PeriodRow, InventoryReportRow,
} from "@/lib/generateCashReport";
import { DoorOpen, DoorClosed, FileDown, Plus, Wallet, Package } from "lucide-react";

interface Session {
  id: string;
  cashier_user_id: string | null;
  cashier_name: string;
  business_date: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  closing_counted: number | null;
  status: string;
  notes: string | null;
}

interface Movement {
  id: string;
  session_id: string | null;
  cashier_name: string;
  business_date: string;
  movement_type: string;
  amount: number;
  reason: string | null;
  recipient: string | null;
  reference: string | null;
  occurred_at: string;
}

const MOVEMENT_TYPES = [
  { value: "bank_transfer", label: "Bank transfer / Banking" },
  { value: "admin_collection", label: "Cash collected by Admin" },
  { value: "purchase", label: "Purchase / Expense" },
  { value: "disbursement", label: "Other disbursement" },
  { value: "cash_in", label: "Cash injection (top-up)" },
];

const typeLabel = (v: string) => MOVEMENT_TYPES.find(t => t.value === v)?.label || v;
const isOutflow = (v: string) => v !== "cash_in";

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);

export default function CashierReports() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Cashier");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCounted, setClosingCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [mvOpen, setMvOpen] = useState(false);
  const [mv, setMv] = useState({ movement_type: "bank_transfer", amount: "", recipient: "", reason: "", reference: "" });
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [invBusy, setInvBusy] = useState(false);

  const mySession = useMemo(
    () => sessions.find(s => s.status === "open" && s.cashier_user_id === userId) || null,
    [sessions, userId]
  );

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    setUserLabel(titleCaseName((user?.email || "cashier").split("@")[0].replace(/[._-]+/g, " ")));
    const [s, m] = await Promise.all([
      supabase.from("cash_sessions").select("*").order("business_date", { ascending: false }).order("opened_at", { ascending: false }).limit(200),
      supabase.from("cash_movements").select("*").order("occurred_at", { ascending: false }).limit(500),
    ]);
    setSessions((s.data as any) || []);
    setMovements((m.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDay = async () => {
    if (mySession) return;
    const { error } = await supabase.from("cash_sessions").insert({
      cashier_user_id: userId,
      cashier_name: userLabel,
      business_date: today(),
      opening_float: Number(openingFloat) || 0,
      status: "open",
    });
    if (error) return toast({ title: "Could not open day", description: error.message, variant: "destructive" });
    toast({ title: "Day opened", description: `Trading day started for ${userLabel}.` });
    load();
  };

  const closeDay = async () => {
    if (!mySession) return;
    const { error } = await supabase.from("cash_sessions").update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closing_counted: closingCounted === "" ? null : Number(closingCounted),
      notes: closeNotes || null,
    }).eq("id", mySession.id);
    if (error) return toast({ title: "Could not close day", description: error.message, variant: "destructive" });
    setClosingCounted(""); setCloseNotes("");
    toast({ title: "Day closed", description: "You can now download the day's accounting report." });
    load();
  };

  const addMovement = async () => {
    const amount = Number(mv.amount);
    if (!amount || amount <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    const { error } = await supabase.from("cash_movements").insert({
      session_id: mySession?.id ?? null,
      cashier_user_id: userId,
      cashier_name: userLabel,
      business_date: mySession?.business_date || today(),
      movement_type: mv.movement_type,
      amount,
      recipient: mv.recipient || null,
      reason: mv.reason || null,
      reference: mv.reference || null,
    });
    if (error) return toast({ title: "Could not record", description: error.message, variant: "destructive" });
    setMv({ movement_type: "bank_transfer", amount: "", recipient: "", reason: "", reference: "" });
    setMvOpen(false);
    toast({ title: "Recorded", description: "Money movement added to today's records." });
    load();
  };

  // Collects all receipts + outflows attributable to one session
  const collectSessionData = async (s: Session) => {
    const dayStart = new Date(`${s.business_date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${s.business_date}T23:59:59.999`).toISOString();

    const [auditRes, vacRes, invRes] = await Promise.all([
      supabase.from("payment_audit_log").select("payment_id, student_profile_id, amount, method, receipt_number, created_at, actor_user_id, action")
        .eq("action", "created").gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("vacation_payments").select("id, amount, method, receipt_number, created_at, cashier_user_id, vacation_student_id")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("inventory_sales").select("id, total_amount, method, receipt_number, created_at, cashier_user_id, items")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
    ]);

    const mine = (uid: string | null | undefined) => !s.cashier_user_id || uid === s.cashier_user_id;
    const audit = ((auditRes.data as any[]) || []).filter(r => mine(r.actor_user_id));
    const vac = ((vacRes.data as any[]) || []).filter(r => mine(r.cashier_user_id));
    const inv = ((invRes.data as any[]) || []).filter(r => mine(r.cashier_user_id));

    const profileIds = Array.from(new Set(audit.map(a => a.student_profile_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (profileIds.length) {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, registration_number").in("id", profileIds);
      (data || []).forEach((p: any) => { names[p.id] = `${titleCaseName(`${p.first_name} ${p.last_name}`)} (${p.registration_number})`; });
    }
    const vacIds = Array.from(new Set(vac.map(v => v.vacation_student_id).filter(Boolean)));
    let vacNames: Record<string, string> = {};
    if (vacIds.length) {
      const { data } = await supabase.from("vacation_students").select("id, first_name, last_name, stream").in("id", vacIds);
      (data || []).forEach((p: any) => { vacNames[p.id] = `${titleCaseName(`${p.first_name} ${p.last_name}`)} — ${p.stream}`; });
    }

    const receipts: CashTxn[] = [
      ...audit.map(a => ({
        time: timeOf(a.created_at),
        reference: a.receipt_number || "—",
        description: names[a.student_profile_id] || "Student payment",
        method: a.method || "—",
        amount: Number(a.amount || 0),
        source: "Fees" as const,
      })),
      ...vac.map(v => ({
        time: timeOf(v.created_at),
        reference: v.receipt_number || "—",
        description: vacNames[v.vacation_student_id] || "Vacation school payment",
        method: v.method || "—",
        amount: Number(v.amount || 0),
        source: "Vacation" as const,
      })),
      ...inv.map(i => ({
        time: timeOf(i.created_at),
        reference: i.receipt_number || "—",
        description: ((i.items as any[]) || []).map(x => `${x.name} x${x.quantity}`).join(", ") || "Shop sale",
        method: i.method || "—",
        amount: Number(i.total_amount || 0),
        source: "Shop" as const,
      })),
    ].sort((a, b) => a.time.localeCompare(b.time));

    const sessMoves = movements.filter(m => (m.session_id === s.id) || (!m.session_id && m.business_date === s.business_date && m.cashier_name === s.cashier_name));
    const cashIns = sessMoves.filter(m => !isOutflow(m.movement_type));
    cashIns.forEach(m => receipts.push({
      time: timeOf(m.occurred_at), reference: m.reference || "—",
      description: m.reason || "Cash injection", method: "Cash", amount: Number(m.amount), source: "Fees",
    }));

    const outflows: CashOutflow[] = sessMoves.filter(m => isOutflow(m.movement_type)).map(m => ({
      time: timeOf(m.occurred_at),
      type: typeLabel(m.movement_type),
      recipient: m.recipient || "—",
      reason: m.reason || "—",
      reference: m.reference || "—",
      amount: Number(m.amount || 0),
    }));

    return { receipts, outflows };
  };

  const downloadSessionReport = async (s: Session) => {
    const { receipts, outflows } = await collectSessionData(s);
    await generateCashReport({
      cashierName: s.cashier_name,
      businessDate: s.business_date,
      openedAt: new Date(s.opened_at).toLocaleString(),
      closedAt: s.closed_at ? new Date(s.closed_at).toLocaleString() : undefined,
      openingFloat: Number(s.opening_float || 0),
      closingCounted: s.closing_counted,
      receipts,
      outflows,
      notes: s.notes || undefined,
    });
    toast({ title: "Report downloaded", description: `${s.cashier_name} — ${s.business_date}` });
  };

  const downloadPeriodReport = async () => {
    const inRange = sessions.filter(s => s.business_date >= from && s.business_date <= to);
    if (!inRange.length) return toast({ title: "No sessions in that period", variant: "destructive" });
    const rows: PeriodRow[] = [];
    for (const s of inRange) {
      const { receipts, outflows } = await collectSessionData(s);
      const rec = receipts.reduce((a, r) => a + r.amount, 0);
      const dis = outflows.reduce((a, r) => a + r.amount, 0);
      rows.push({ date: s.business_date, cashier: s.cashier_name, received: rec, disbursed: dis, net: rec - dis });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.cashier.localeCompare(b.cashier));
    await generatePeriodCashReport(rows, from, to);
  };

  const downloadInventoryReport = async () => {
    setInvBusy(true);
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999`).toISOString();
      const [itemsRes, salesRes] = await Promise.all([
        supabase.from("inventory_items").select("*").order("category").order("name"),
        supabase.from("inventory_sales").select("total_amount, items, created_at, notes").gte("created_at", fromIso).lte("created_at", toIso),
      ]);
      const items = (itemsRes.data as any[]) || [];
      const sales = (salesRes.data as any[]) || [];
      const sold: Record<string, { qty: number; value: number }> = {};
      sales.forEach(s => ((s.items as any[]) || []).forEach(i => {
        const key = i.item_id || i.name;
        sold[key] = sold[key] || { qty: 0, value: 0 };
        sold[key].qty += Number(i.quantity || 0);
        sold[key].value += Number(i.subtotal ?? (i.unit_price || 0) * (i.quantity || 0));
      }));
      const rows: InventoryReportRow[] = items.map(i => ({
        name: i.name,
        category: i.category,
        price: Number(i.price || 0),
        stock: Number(i.stock_quantity || 0),
        soldQty: (sold[i.id]?.qty ?? sold[i.name]?.qty) || 0,
        soldValue: (sold[i.id]?.value ?? sold[i.name]?.value) || 0,
      }));
      const salesThisPeriod = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
      const priorTermSettled = sales
        .filter(s => /last term|previous term|arrear|carried|balance/i.test(String(s.notes || "")))
        .reduce((a, s) => a + Number(s.total_amount || 0), 0);
      const stockValue = items.reduce((a, i) => a + Number(i.price || 0) * Number(i.stock_quantity || 0), 0);
      await generateInventoryReport(rows, `${from} to ${to}`, { salesThisPeriod, priorTermSettled, stockValue });
    } finally {
      setInvBusy(false);
    }
  };

  const visibleSessions = role === "cashier" ? sessions.filter(s => s.cashier_user_id === userId) : sessions;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Wallet className="text-primary" /> Cash Desk & Reports</h2>
          <p className="text-sm text-muted-foreground">Open and close each trading day, record disbursements, and print signed accounting reports.</p>
        </div>

        {/* Day control */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Today — {today()}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!mySession ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Label className="text-xs">Opening float (US$)</Label>
                  <Input type="number" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} />
                </div>
                <Button onClick={openDay} className="gap-2"><DoorOpen size={16} /> Open Day</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-success text-success-foreground">Day open</Badge>
                  <span className="text-sm text-muted-foreground">
                    Opened {new Date(mySession.opened_at).toLocaleTimeString()} • Float US${Number(mySession.opening_float).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <Label className="text-xs">Cash counted at close (US$)</Label>
                    <Input type="number" value={closingCounted} onChange={e => setClosingCounted(e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <Label className="text-xs">Closing notes</Label>
                    <Input value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Optional" />
                  </div>
                  <Button variant="destructive" onClick={closeDay} className="gap-2"><DoorClosed size={16} /> Close Day</Button>
                  <Dialog open={mvOpen} onOpenChange={setMvOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2"><Plus size={16} /> Record Money Out/In</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Record money movement</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select value={mv.movement_type} onValueChange={v => setMv({ ...mv, movement_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Amount (US$)</Label>
                          <Input type="number" value={mv.amount} onChange={e => setMv({ ...mv, amount: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Paid to / Collected by / Bank</Label>
                          <Input value={mv.recipient} onChange={e => setMv({ ...mv, recipient: e.target.value })} placeholder="e.g. Mr Moyo (Admin) or CBZ Bank" />
                        </div>
                        <div>
                          <Label className="text-xs">Reason</Label>
                          <Textarea rows={2} value={mv.reason} onChange={e => setMv({ ...mv, reason: e.target.value })} placeholder="e.g. Bought printing paper" />
                        </div>
                        <div>
                          <Label className="text-xs">Reference / Slip no.</Label>
                          <Input value={mv.reference} onChange={e => setMv({ ...mv, reference: e.target.value })} />
                        </div>
                        <Button className="w-full" onClick={addMovement}>Save record</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="days">
          <TabsList>
            <TabsTrigger value="days">Daily Reports</TabsTrigger>
            <TabsTrigger value="movements">Money Movements</TabsTrigger>
            <TabsTrigger value="summary">Summary & Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="days">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead>Float</TableHead>
                      <TableHead>Counted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : visibleSessions.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No trading days recorded yet</TableCell></TableRow>
                    ) : visibleSessions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{s.business_date}</TableCell>
                        <TableCell>{s.cashier_name}</TableCell>
                        <TableCell>{timeOf(s.opened_at)}</TableCell>
                        <TableCell>{s.closed_at ? timeOf(s.closed_at) : "—"}</TableCell>
                        <TableCell>US${Number(s.opening_float).toFixed(2)}</TableCell>
                        <TableCell>{s.closing_counted == null ? "—" : `US$${Number(s.closing_counted).toFixed(2)}`}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "open" ? "secondary" : "outline"} className="capitalize">{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadSessionReport(s)}>
                            <FileDown size={14} /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>To / By</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nothing recorded yet</TableCell></TableRow>
                    ) : movements.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{m.business_date}</TableCell>
                        <TableCell>{timeOf(m.occurred_at)}</TableCell>
                        <TableCell>{m.cashier_name}</TableCell>
                        <TableCell>{typeLabel(m.movement_type)}</TableCell>
                        <TableCell>{m.recipient || "—"}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{m.reason || "—"}</TableCell>
                        <TableCell className={`text-right font-semibold ${isOutflow(m.movement_type) ? "text-destructive" : "text-success"}`}>
                          {isOutflow(m.movement_type) ? "-" : "+"}US${Number(m.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Period reports</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
                  </div>
                  <Button className="gap-2" onClick={downloadPeriodReport}><FileDown size={16} /> Cash Summary PDF</Button>
                  <Button variant="outline" className="gap-2" disabled={invBusy} onClick={downloadInventoryReport}>
                    <Package size={16} /> {invBusy ? "Preparing…" : "Inventory Report PDF"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The cash summary separates totals per day and per cashier with an overall total and signature lines.
                  The inventory report shows sales in the period, stock value on hand, and any prior-term balances settled
                  within the period (sales whose notes mention a previous term or arrears are counted on the day they were paid).
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
