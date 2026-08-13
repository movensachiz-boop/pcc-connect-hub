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
import { catToday, catHour, catTime, catDateTime, nowIso, nowDate } from "@/lib/catTime";
import {
  generateCashReport, generatePeriodCashReport, generateInventoryReport, generateMovementVoucher, generateThermalCashReport,
  generateThermalPeriodCashReport, generateThermalInventoryReport,
  CashTxn, CashOutflow, PeriodRow, InventoryReportRow,
} from "@/lib/generateCashReport";
import { DoorOpen, DoorClosed, FileDown, Plus, Wallet, Package, Printer, Trash2, Pencil } from "lucide-react";

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

const timeOf = (iso: string) => catTime(iso);
const today = () => catToday();

export default function CashierReports() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Cashier");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashierFilter, setCashierFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("");
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

  // Trading hours: auto-open at 07:00, auto-close at 16:00
  const AUTO_OPEN_HOUR = 7;
  const AUTO_CLOSE_HOUR = 16;
  const atHour = (date: string, hour: number) => catIsoAt(date, hour);

  const autoManageDay = async (rows: Session[], uid: string | null, label: string) => {
    if (!uid) return false;
    let changed = false;
    const now = nowDate();
    const d = today();

    // Auto-close any of my sessions left open from a previous day or past 16:00 today
    const stale = rows.filter(s => s.status === "open" && s.cashier_user_id === uid &&
      (s.business_date < d || catHour(now) >= AUTO_CLOSE_HOUR));
    for (const s of stale) {
      await supabase.from("cash_sessions").update({
        status: "closed",
        closed_at: atHour(s.business_date, AUTO_CLOSE_HOUR),
        notes: s.notes || "Auto-closed at 16:00 (trading hours).",
      }).eq("id", s.id);
      changed = true;
    }

    // Auto-open today's session during trading hours if none exists yet
    const hasToday = rows.some(s => s.business_date === d && s.cashier_user_id === uid);
    if (!hasToday && catHour(now) >= AUTO_OPEN_HOUR && catHour(now) < AUTO_CLOSE_HOUR) {
      await supabase.from("cash_sessions").insert({
        cashier_user_id: uid,
        cashier_name: label,
        business_date: d,
        opened_at: atHour(d, AUTO_OPEN_HOUR),
        opening_float: 0,
        status: "open",
        notes: "Auto-opened at 07:00 (trading hours).",
      });
      changed = true;
    }
    return changed;
  };

  const load = async (skipAuto = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    const label = titleCaseName((user?.email || "cashier").split("@")[0].replace(/[._-]+/g, " "));
    setUserId(uid);
    setUserLabel(label);
    const [s, m] = await Promise.all([
      supabase.from("cash_sessions").select("*").order("business_date", { ascending: false }).order("opened_at", { ascending: false }).limit(200),
      supabase.from("cash_movements").select("*").order("occurred_at", { ascending: false }).limit(500),
    ]);
    const rows: Session[] = (s.data as any) || [];
    if (!skipAuto && await autoManageDay(rows, uid, label)) return load(true);
    setSessions(rows);
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
      closed_at: nowIso(),
      closing_counted: closingCounted === "" ? null : Number(closingCounted),
      notes: closeNotes || null,
    }).eq("id", mySession.id);
    if (error) return toast({ title: "Could not close day", description: error.message, variant: "destructive" });
    setClosingCounted(""); setCloseNotes("");
    toast({ title: "Day closed", description: "You can now download the day's accounting report." });
    load();
  };

  const printMovement = async (m: Movement) => {
    const out = isOutflow(m.movement_type);
    await generateMovementVoucher({
      voucherNo: (m.reference || m.id).slice(0, 12).toUpperCase(),
      kind: out ? "out" : "in",
      typeLabel: typeLabel(m.movement_type),
      amount: Number(m.amount),
      dateTime: catDateTime(m.occurred_at),
      businessDate: m.business_date,
      issuedBy: out ? m.cashier_name : (m.recipient || "—"),
      receivedBy: out ? (m.recipient || "—") : m.cashier_name,
      reason: m.reason,
      reference: m.reference,
    });
  };

  const [editM, setEditM] = useState<Movement | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", recipient: "", reason: "", reference: "" });

  const startEdit = (m: Movement) => {
    setEditForm({
      amount: String(m.amount ?? ""),
      recipient: m.recipient || "",
      reason: m.reason || "",
      reference: m.reference || "",
    });
    setEditM(m);
  };

  const saveEdit = async () => {
    if (!editM) return;
    const amount = Number(editForm.amount);
    if (!amount || amount <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    const { error } = await supabase.from("cash_movements").update({
      amount,
      recipient: editForm.recipient || null,
      reason: editForm.reason || null,
      reference: editForm.reference || null,
    }).eq("id", editM.id);
    if (error) return toast({ title: "Could not update", description: error.message, variant: "destructive" });
    setEditM(null);
    toast({ title: "Updated", description: "The amount has been corrected in the day's totals." });
    load();
  };

  const deleteMovement = async (m: Movement) => {
    if (!confirm(`Delete this ${isOutflow(m.movement_type) ? "money out" : "money in"} record of US$${Number(m.amount).toFixed(2)}? This cannot be undone.`)) return;
    const { error } = await supabase.from("cash_movements").delete().eq("id", m.id);
    if (error) return toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    toast({ title: "Deleted", description: "Record removed from the day's totals." });
    load();
  };



  const addMovement = async () => {
    const amount = Number(mv.amount);
    if (!amount || amount <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    const { data, error } = await supabase.from("cash_movements").insert({
      session_id: mySession?.id ?? null,
      cashier_user_id: userId,
      cashier_name: userLabel,
      business_date: mySession?.business_date || today(),
      movement_type: mv.movement_type,
      amount,
      recipient: mv.recipient || null,
      reason: mv.reason || null,
      reference: mv.reference || null,
    }).select().single();
    if (error) return toast({ title: "Could not record", description: error.message, variant: "destructive" });
    setMv({ movement_type: "bank_transfer", amount: "", recipient: "", reason: "", reference: "" });
    setMvOpen(false);
    toast({ title: "Recorded", description: "Voucher generated for this movement." });
    if (data) await printMovement(data as any);
    load();
  };


  // Collects all receipts + outflows attributable to one session
  const collectSessionData = async (s: Session) => {
    const dayStart = catDayStartIso(s.business_date);
    const dayEnd = catDayEndIso(s.business_date);

    const [auditRes, vacRes, invRes] = await Promise.all([
      supabase.from("payment_audit_log").select("payment_id, student_profile_id, amount, method, receipt_number, created_at, actor_user_id, action")
        .eq("action", "created").gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("vacation_payments").select("id, amount, method, receipt_number, created_at, cashier_user_id, vacation_student_id")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("inventory_sales").select("id, total_amount, method, receipt_number, created_at, cashier_user_id, items")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
    ]);

    // Records with no cashier stamped are counted in the day's report (unattributed takings)
    const mine = (uid: string | null | undefined) => !s.cashier_user_id || !uid || uid === s.cashier_user_id;
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
      description: `${m.recipient ? `Received from ${m.recipient}` : "Cash injection"}${m.reason ? ` — ${m.reason}` : ""}`,
      method: "Cash", amount: Number(m.amount), source: "Fees",
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

  const downloadSessionReport = async (s: Session, thermal = false) => {
    const { receipts, outflows } = await collectSessionData(s);
    const payload = {
      cashierName: s.cashier_name,
      businessDate: s.business_date,
      openedAt: catDateTime(s.opened_at),
      closedAt: s.closed_at ? catDateTime(s.closed_at) : undefined,
      openingFloat: Number(s.opening_float || 0),
      closingCounted: s.closing_counted,
      receipts,
      outflows,
      notes: s.notes || undefined,
    };
    if (thermal) await generateThermalCashReport(payload, "print");
    else await generateCashReport(payload);
    toast({ title: thermal ? "Thermal receipt sent to printer" : "Report downloaded", description: `${s.cashier_name} — ${s.business_date}` });
  };

  const downloadPeriodReport = async (thermal = false) => {
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
    if (thermal) await generateThermalPeriodCashReport(rows, from, to, "USD", "print");
    else await generatePeriodCashReport(rows, from, to);
  };

  const downloadInventoryReport = async (thermal = false) => {
    setInvBusy(true);
    try {
      const fromIso = catDayStartIso(from);
      const toIso = catDayEndIso(to);
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
      const totals = { salesThisPeriod, priorTermSettled, stockValue };
      if (thermal) await generateThermalInventoryReport(rows, `${from} to ${to}`, totals, "USD", "print");
      else await generateInventoryReport(rows, `${from} to ${to}`, totals);
    } finally {
      setInvBusy(false);
    }
  };

  const ownSessions = role === "cashier" ? sessions.filter(s => s.cashier_user_id === userId) : sessions;
  const cashierOptions = useMemo(
    () => Array.from(new Set(ownSessions.map(s => s.cashier_name))).sort(),
    [ownSessions]
  );
  const visibleSessions = useMemo(
    () => ownSessions.filter(s =>
      (cashierFilter === "all" || s.cashier_name === cashierFilter) &&
      (!dayFilter || s.business_date === dayFilter)
    ),
    [ownSessions, cashierFilter, dayFilter]
  );

  // Combines every cashier's receipts and outflows for one day into a single PDF
  const downloadCombinedDayReport = async (thermal = false) => {
    const date = dayFilter || today();
    let daySessions = ownSessions.filter(s => s.business_date === date &&
      (cashierFilter === "all" || s.cashier_name === cashierFilter));
    if (!daySessions.length) {
      // No day was opened — still report on everything transacted that date
      daySessions = [{
        id: `virtual-${date}`,
        cashier_user_id: role === "cashier" ? userId : null,
        cashier_name: cashierFilter !== "all" ? cashierFilter : (role === "cashier" ? userLabel : "All Cashiers"),
        business_date: date,
        opened_at: atHour(date, AUTO_OPEN_HOUR),
        closed_at: null,
        opening_float: 0,
        closing_counted: null,
        status: "auto",
        notes: "No day was opened — auto-generated from trading hours (07:00–16:00).",
      }];
    }

    const receipts: CashTxn[] = [];
    const outflows: CashOutflow[] = [];
    let float = 0, counted = 0, anyCounted = false;
    for (const s of daySessions) {
      const data = await collectSessionData(s);
      data.receipts.forEach(r => receipts.push({ ...r, description: `[${s.cashier_name}] ${r.description}` }));
      data.outflows.forEach(o => outflows.push({ ...o, reason: `[${s.cashier_name}] ${o.reason}` }));
      float += Number(s.opening_float || 0);
      if (s.closing_counted != null) { counted += Number(s.closing_counted); anyCounted = true; }
    }
    // A cashier can have more than one session on the same day. Each session
    // query sees that cashier's full day, so remove repeated transactions from
    // the combined report before calculating totals.
    const uniqueReceipts = Array.from(new Map(receipts.map(r => [
      `${r.source}|${r.reference}|${r.time}|${r.method}|${r.amount}`,
      r,
    ])).values()).sort((a, b) => a.time.localeCompare(b.time));
    const uniqueOutflows = Array.from(new Map(outflows.map(o => [
      `${o.reference}|${o.time}|${o.type}|${o.recipient}|${o.amount}`,
      o,
    ])).values()).sort((a, b) => a.time.localeCompare(b.time));

    const combined = {
      cashierName: cashierFilter === "all"
        ? `All Cashiers (${daySessions.map(s => s.cashier_name).join(", ")})`
        : cashierFilter,
      businessDate: date,
      openedAt: catDateTime(daySessions[daySessions.length - 1].opened_at),
      closedAt: undefined,
      openingFloat: float,
      closingCounted: anyCounted ? counted : null,
      receipts: uniqueReceipts,
      outflows: uniqueOutflows,
      notes: `Combined day report covering ${daySessions.length} cashier session(s).`,
    };
    if (thermal) await generateThermalCashReport(combined, "print");
    else await generateCashReport(combined);
    toast({ title: thermal ? "Thermal day report sent to printer" : "Combined report downloaded", description: `${date} — ${daySessions.length} session(s)` });
  };

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
                    Opened {catTime(mySession.opened_at)} • Float US${Number(mySession.opening_float).toFixed(2)}
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
                          <Label className="text-xs">
                            {mv.movement_type === "cash_in" ? "Received from (payer / source)" : "Paid to / Collected by / Bank"}
                          </Label>
                          <Input
                            value={mv.recipient}
                            onChange={e => setMv({ ...mv, recipient: e.target.value })}
                            placeholder={mv.movement_type === "cash_in" ? "e.g. Mrs Ncube (Admin float) or Head Office" : "e.g. Mr Moyo (Admin) or CBZ Bank"}
                          />

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

          <TabsContent value="days" className="space-y-3">
            <Card>
              <CardContent className="p-4 flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Cashier</Label>
                  <Select value={cashierFilter} onValueChange={setCashierFilter}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cashiers</SelectItem>
                      {cashierOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" className="w-44" value={dayFilter} onChange={e => setDayFilter(e.target.value)} />
                </div>
                {dayFilter && <Button variant="ghost" onClick={() => setDayFilter("")}>Clear date</Button>}
                <Button className="gap-1.5 ml-auto" onClick={() => downloadCombinedDayReport(false)}>
                  <FileDown size={14} /> Combined day report
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={() => downloadCombinedDayReport(true)}>
                  <Printer size={14} /> Thermal receipt
                </Button>
              </CardContent>
            </Card>
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
                          <Button size="sm" variant="outline" className="gap-1.5 ml-1" onClick={() => downloadSessionReport(s, true)}>
                            <Printer size={14} /> Thermal
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            {([
              { key: "in", title: "Money In (Cash Received)", who: "Received from", empty: "No money-in recorded yet" },
              { key: "out", title: "Money Out (Payments / Transfers)", who: "Paid to", empty: "No money-out recorded yet" },
            ] as const).map(sec => {
              const rows = movements.filter(m => (sec.key === "out") === isOutflow(m.movement_type));
              const total = rows.reduce((s, m) => s + Number(m.amount || 0), 0);
              return (
                <Card key={sec.key}>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{sec.title}</CardTitle>
                    <span className={`text-sm font-semibold ${sec.key === "out" ? "text-destructive" : "text-success"}`}>
                      {sec.key === "out" ? "-" : "+"}US${total.toFixed(2)}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Cashier</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>{sec.who}</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{sec.empty}</TableCell></TableRow>
                        ) : rows.map(m => (
                          <TableRow key={m.id}>
                            <TableCell>{m.business_date}</TableCell>
                            <TableCell>{timeOf(m.occurred_at)}</TableCell>
                            <TableCell>{m.cashier_name}</TableCell>
                            <TableCell>{typeLabel(m.movement_type)}</TableCell>
                            <TableCell>{m.recipient || "—"}</TableCell>
                            <TableCell className="max-w-[240px] truncate">{m.reason || "—"}</TableCell>
                            <TableCell className={`text-right font-semibold ${sec.key === "out" ? "text-destructive" : "text-success"}`}>
                              {sec.key === "out" ? "-" : "+"}US${Number(m.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => printMovement(m)}>
                                <Printer size={14} /> Print
                              </Button>
                              <Button size="sm" variant="ghost" className="ml-1" onClick={() => startEdit(m)} title="Edit amount">
                                <Pencil size={14} />
                              </Button>
                              <Button size="sm" variant="ghost" className="ml-1 text-destructive" onClick={() => deleteMovement(m)} title="Delete record">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>


                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
            <Dialog open={editM !== null} onOpenChange={o => !o && setEditM(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Edit {editM && isOutflow(editM.movement_type) ? "money out" : "money in"} record
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Amount (USD)</Label>
                    <Input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>{editM && isOutflow(editM.movement_type) ? "Paid to" : "Received from"}</Label>
                    <Input value={editForm.recipient} onChange={e => setEditForm({ ...editForm, recipient: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reason / Description</Label>
                    <Textarea rows={2} value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reference (optional)</Label>
                    <Input value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })} />
                  </div>
                  <Button className="w-full" onClick={saveEdit}>Save changes</Button>
                </div>
              </DialogContent>
            </Dialog>
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
                  <Button className="gap-2" onClick={() => downloadPeriodReport(false)}><FileDown size={16} /> Cash Summary PDF</Button>
                  <Button variant="outline" className="gap-2" onClick={() => downloadPeriodReport(true)}>
                    <Printer size={16} /> Cash Summary Thermal
                  </Button>
                  <Button variant="outline" className="gap-2" disabled={invBusy} onClick={() => downloadInventoryReport(false)}>
                    <Package size={16} /> {invBusy ? "Preparing…" : "Inventory Report PDF"}
                  </Button>
                  <Button variant="outline" className="gap-2" disabled={invBusy} onClick={() => downloadInventoryReport(true)}>
                    <Printer size={16} /> Inventory Thermal
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
