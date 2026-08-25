import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus, DollarSign, Printer, Download, Trash2, Pencil, Sun } from "lucide-react";
import { catTime, catToday, catDate, nowIso, nowDate } from "@/lib/catTime";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateReceipt, generateThermalReceipt, printReceipt } from "@/lib/generateReceipt";
import { generateVacationReport } from "@/lib/generateVacationReport";
import { titleCaseName } from "@/lib/normalize";

const STREAMS = [
  "Form 1 G1", "Form 1 G2", "Form 1 G22", "Form 1 Blue",
  "Form 2 G1", "Form 2 G2", "Form 2 G22", "Form 2 Blue",
  "Form 3 G1", "Form 3 G2", "Form 3 G22", "Form 3 Blue",
  "Form 4 G1", "Form 4 G2", "Form 4 G22", "Form 4 Blue",
  "Form 5 Sciences", "Form 5 Commercials", "Form 5 Arts",
  "Form 6 Sciences", "Form 6 Commercials", "Form 6 Arts",
  "Form 1 External", "Form 2 External", "Form 3 External", "Form 4 External",
  "Form 5 External", "Form 6 External",
  "External",
];
const METHODS = ["Cash", "EcoCash", "Bank Transfer", "Swipe", "Other"];

interface VStudent {
  id: string;
  first_name: string;
  last_name: string;
  stream: string;
  gender: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  created_at: string;
}

interface VPayment {
  id: string;
  vacation_student_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  receipt_number: string | null;
  description: string | null;
  created_at: string;
  verified?: boolean;
  verified_at?: string | null;
}

const todayStr = () => catToday();


const AdminVacationSchool = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<VStudent[]>([]);
  const [payments, setPayments] = useState<VPayment[]>([]);
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [verifyDate, setVerifyDate] = useState<string>(todayStr());
  const [verifySearch, setVerifySearch] = useState("");
  const [hideVerified, setHideVerified] = useState(true);

  // registration form
  const [regOpen, setRegOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<VStudent | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stream, setStream] = useState("");
  const [gender, setGender] = useState("other");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // payment form
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VPayment | null>(null);
  const [payStudentId, setPayStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [description, setDescription] = useState("Vacation School Fees");

  useEffect(() => { loadAll(); }, []);

  // Auto-open the registration dialog when the page loads
  useEffect(() => { setRegOpen(true); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("vacation_students" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("vacation_payments" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setStudents(((s || []) as any) as VStudent[]);
    setPayments(((p || []) as any) as VPayment[]);
    setLoading(false);
  };

  const resetStudentForm = () => {
    setEditingStudent(null);
    setFirstName(""); setLastName(""); setStream(""); setGender("other");
    setGuardianName(""); setGuardianPhone(""); setNotes("");
  };

  const openEditStudent = (s: VStudent) => {
    setEditingStudent(s);
    setFirstName(s.first_name); setLastName(s.last_name); setStream(s.stream);
    setGender(s.gender || "other"); setGuardianName(s.guardian_name || "");
    setGuardianPhone(s.guardian_phone || ""); setNotes(s.notes || "");
    setRegOpen(true);
  };

  const saveStudent = async () => {
    if (!firstName.trim() || !lastName.trim() || !stream) {
      toast({ title: "First name, last name and stream are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      stream,
      gender,
      guardian_name: guardianName.trim() || null,
      guardian_phone: guardianPhone.trim() || null,
      notes: notes.trim() || null,
    };
    const wasEditing = !!editingStudent;
    const { data: saved, error } = editingStudent
      ? await supabase.from("vacation_students" as any).update(payload).eq("id", editingStudent.id).select().single()
      : await supabase.from("vacation_students" as any).insert(payload as any).select().single();
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: wasEditing ? "Learner updated" : "Learner registered" });
    const newStudent = saved as any as VStudent | null;
    if (newStudent) setStudents(prev => [newStudent, ...prev.filter(s => s.id !== newStudent.id)]);
    setRegOpen(false); resetStudentForm(); loadAll();
    if (!wasEditing && newStudent) openNewPayment(newStudent.id, newStudent.stream);
  };

  const deleteStudent = async (s: VStudent) => {
    if (!confirm(`Remove ${s.first_name} ${s.last_name} and all their vacation school payments?`)) return;
    const { error } = await supabase.from("vacation_students" as any).delete().eq("id", s.id);
    if (error) { toast({ title: "Could not remove", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Learner removed" });
    loadAll();
  };

  const expectedFor = (streamName?: string) =>
    (streamName || "").toLowerCase().includes("external") ? 60 : 50;

  const defaultAmountFor = (streamName?: string) => String(expectedFor(streamName));


  const openNewPayment = (studentId?: string, streamName?: string) => {
    setEditingPayment(null);
    setPayStudentId(studentId || "");
    const s = streamName ?? (studentId ? studentById[studentId]?.stream : undefined);
    setAmount(studentId ? defaultAmountFor(s) : "");
    setMethod("Cash"); setDescription("Vacation School Fees");
    setPayOpen(true);
  };

  const openEditPayment = (p: VPayment) => {
    setEditingPayment(p);
    setPayStudentId(p.vacation_student_id);
    setAmount(String(p.amount));
    setMethod(p.method);
    setDescription(p.description || "Vacation School Fees");
    setPayOpen(true);
  };

  const savePayment = async () => {
    const num = parseFloat(amount);
    if (!payStudentId) { toast({ title: "Select a learner", variant: "destructive" }); return; }
    if (!num || num <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, any> = {
      vacation_student_id: payStudentId,
      amount: num,
      method,
      status: "paid",
      description: description.trim() || "Vacation School Fees",
    };
    if (!editingPayment) payload.cashier_user_id = user?.id ?? null;
    const wasEditing = !!editingPayment;
    const { data: savedPay, error } = wasEditing
      ? await supabase.from("vacation_payments" as any).update(payload).eq("id", editingPayment!.id).select().single()
      : await supabase.from("vacation_payments" as any).insert(payload as any).select().single();
    setSaving(false);
    if (error) { toast({ title: "Could not save payment", description: error.message, variant: "destructive" }); return; }
    toast({ title: wasEditing ? "Payment updated" : "Payment recorded" });
    setPayOpen(false); loadAll();
    if (!wasEditing && savedPay) {
      try { await printReceipt(receiptDataFor(savedPay as any as VPayment)); } catch (e) { /* printing cancelled */ }
    }
  };

  const deletePayment = async (p: VPayment) => {
    if (!confirm(`Delete payment ${p.receipt_number || ""}?`)) return;
    const { error } = await supabase.from("vacation_payments" as any).delete().eq("id", p.id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Payment deleted" });
    loadAll();
  };

  const studentById = useMemo(() => {
    const m: Record<string, VStudent> = {};
    students.forEach(s => { m[s.id] = s; });
    return m;
  }, [students]);

  const todaysPayments = useMemo(
    () => payments.filter(p => catToday(new Date(p.created_at)) === verifyDate),
    [payments, verifyDate]
  );
  const verifiedCount = todaysPayments.filter(p => p.verified).length;
  const todaysTotal = todaysPayments.reduce((s, p) => s + Number(p.amount), 0);
  const verifiedTotal = todaysPayments.filter(p => p.verified).reduce((s, p) => s + Number(p.amount), 0);

  const visibleVerifyPayments = useMemo(() => {
    const q = verifySearch.trim().toLowerCase();
    return todaysPayments.filter(p => {
      if (hideVerified && p.verified) return false;
      if (!q) return true;
      const s = studentById[p.vacation_student_id];
      const name = s ? `${s.first_name} ${s.last_name} ${s.stream}` : "";
      return [name, p.receipt_number, p.method, String(p.amount)]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [todaysPayments, verifySearch, hideVerified, studentById]);

  const applyVerified = async (ids: string[], value: boolean) => {
    if (ids.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("vacation_payments" as any)
      .update({ verified: value, verified_at: value ? nowIso() : null, verified_by: value ? (user?.id ?? null) : null } as any)
      .in("id", ids);
    if (error) { toast({ title: "Could not update verification", description: error.message, variant: "destructive" }); return; }
    setPayments(prev => prev.map(p => ids.includes(p.id) ? { ...p, verified: value } : p));
  };

  const toggleVerified = (p: VPayment, value: boolean) => applyVerified([p.id], value);
  const verifyAll = (value: boolean) =>
    applyVerified(todaysPayments.filter(p => !!p.verified !== value).map(p => p.id), value);

  const receiptDataFor = (p: VPayment) => {
    const s = studentById[p.vacation_student_id];
    return {
      receiptNo: p.receipt_number || p.id.slice(0, 8),
      studentName: s ? titleCaseName(`${s.first_name} ${s.last_name}`) : "Vacation Learner",
      regNo: "VACATION SCHOOL",
      studentClass: s ? `Vacation School — ${s.stream}` : "Vacation School",
      date: catDate(p.created_at),
      amount: `$${Number(p.amount).toFixed(2)}`,
      method: p.method,
      description: `VACATION SCHOOL — ${p.description || "Vacation School Fees"}`,
      schoolName: "Progress Centre College",
    };
  };

  const filteredStudents = students.filter(s => {
    const okStream = streamFilter === "all" || s.stream === streamFilter;
    const q = search.trim().toLowerCase();
    const okSearch = !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q);
    return okStream && okSearch;
  });

  const filteredPayments = payments.filter(p => {
    const s = studentById[p.vacation_student_id];
    const okStream = streamFilter === "all" || s?.stream === streamFilter;
    const q = search.trim().toLowerCase();
    const okSearch = !q || (s && `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)) ||
      (p.receipt_number || "").toLowerCase().includes(q);
    return okStream && okSearch;
  });

  const totalCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const paidByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach(p => { m[p.vacation_student_id] = (m[p.vacation_student_id] || 0) + Number(p.amount); });
    return m;
  }, [payments]);

  const owingFor = (s?: VStudent) =>
    s ? Math.max(0, expectedFor(s.stream) - (paidByStudent[s.id] || 0)) : 0;

  // Duplicate detection: learners with more than one payment receipt
  const paymentCountByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach(p => { m[p.vacation_student_id] = (m[p.vacation_student_id] || 0) + 1; });
    return m;
  }, [payments]);
  const duplicateCount = useMemo(
    () => Object.values(paymentCountByStudent).filter(c => c > 1).length,
    [paymentCountByStudent]
  );
  const overpaidFor = (s?: VStudent) =>
    s ? Math.max(0, (paidByStudent[s.id] || 0) - expectedFor(s.stream)) : 0;

  const expectedTotal = filteredStudents.reduce((sum, s) => sum + expectedFor(s.stream), 0);
  
  const outstandingTotal = filteredStudents.reduce((sum, s) => sum + owingFor(s), 0);


  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sun className="text-primary" size={22} />
            <h2 className="text-2xl font-bold text-foreground">Vacation School</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={streamFilter} onValueChange={setStreamFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Stream" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                {STREAMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search name or receipt"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-[220px]"
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                generateVacationReport(filteredStudents, filteredPayments);
                toast({ title: "Report generated", description: "Vacation school payment analysis PDF downloaded." });
              }}
            >
              <Download size={16} /> Payment Report
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { resetStudentForm(); setRegOpen(true); }}>
              <UserPlus size={16} /> Register Learner
            </Button>
            <Button className="gap-2" onClick={() => openNewPayment()}>
              <DollarSign size={16} /> Record Payment
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Registered Learners</CardDescription>
              <CardTitle className="text-2xl">{filteredStudents.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Payments Recorded</CardDescription>
              <CardTitle className="text-2xl">{filteredPayments.length}</CardTitle>
              {duplicateCount > 0 && (
                <p className="text-xs text-destructive font-medium">{duplicateCount} learner(s) with multiple receipts</p>
              )}
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Expected (External $60 / Others $50)</CardDescription>
              <CardTitle className="text-2xl">${expectedTotal.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Total Collected</CardDescription>
              <CardTitle className="text-2xl text-success">${totalCollected.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Outstanding</CardDescription>
              <CardTitle className={`text-2xl ${outstandingTotal > 0 ? "text-destructive" : "text-success"}`}>
                ${outstandingTotal.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>


        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="verify">Daily Verification</TabsTrigger>
            <TabsTrigger value="learners">Registered Learners</TabsTrigger>
          </TabsList>

          <TabsContent value="verify">
            <Card className="shadow-card">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Verify Payments</CardTitle>
                    <CardDescription>
                      {verifyDate === todayStr() ? "Today" : verifyDate} — {todaysPayments.length} payment(s),
                      {" "}{verifiedCount} verified, total ${todaysTotal.toFixed(2)} (verified ${verifiedTotal.toFixed(2)})
                      {" "}· {todaysPayments.length - verifiedCount} left
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="date" value={verifyDate} onChange={e => setVerifyDate(e.target.value)} className="w-[160px]" />
                    <Button variant="outline" size="sm" onClick={() => setVerifyDate(todayStr())}>Today</Button>
                    <Button variant="outline" size="sm" onClick={() => verifyAll(true)} disabled={todaysPayments.length === 0}>
                      Verify All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => verifyAll(false)} disabled={verifiedCount === 0}>
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search learner, receipt, amount…"
                    value={verifySearch}
                    onChange={e => setVerifySearch(e.target.value)}
                    className="w-full sm:w-[280px]"
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={hideVerified} onCheckedChange={c => setHideVerified(!!c)} />
                    Hide verified (show only what's left)
                  </label>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : visibleVerifyPayments.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">
                    {todaysPayments.length === 0 ? "No payments recorded for this date" : "Nothing left to verify for this filter"}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary">
                        <TableHead className="w-[80px]">Verified</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Learner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleVerifyPayments.map(p => {
                        const s = studentById[p.vacation_student_id];
                        return (
                          <TableRow key={p.id} className={p.verified ? "bg-success/5" : undefined}>
                            <TableCell>
                              <Checkbox
                                checked={!!p.verified}
                                onCheckedChange={(c) => toggleVerified(p, !!c)}
                                aria-label="Mark payment verified"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{p.receipt_number || "—"}</TableCell>
                            <TableCell>{s ? titleCaseName(`${s.first_name} ${s.last_name}`) : "—"}</TableCell>
                            <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell>{catTime(p.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" title="Print receipt" onClick={() => printReceipt(receiptDataFor(p))}>
                                <Printer size={16} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="payments">
            <Card className="shadow-card">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : filteredPayments.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">No vacation school payments yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary">
                        <TableHead>Receipt</TableHead>
                        <TableHead>Learner</TableHead>
                        <TableHead>Stream</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map(p => {
                        const s = studentById[p.vacation_student_id];
                        const dupCount = paymentCountByStudent[p.vacation_student_id] || 1;
                        const over = overpaidFor(s);
                        return (
                          <TableRow key={p.id} className={dupCount > 1 ? "bg-destructive/10" : undefined}>
                            <TableCell className="font-medium">{p.receipt_number || "—"}</TableCell>
                            <TableCell>
                              {s ? titleCaseName(`${s.first_name} ${s.last_name}`) : "—"}
                              {dupCount > 1 && (
                                <Badge variant="destructive" className="ml-2">{dupCount} receipts</Badge>
                              )}
                              {over > 0 && (
                                <Badge variant="destructive" className="ml-2">Overpaid ${over.toFixed(2)}</Badge>
                              )}
                              {s && owingFor(s) > 0 && (
                                <Badge variant="destructive" className="ml-2">Owes ${owingFor(s).toFixed(2)}</Badge>
                              )}
                            </TableCell>


                            <TableCell><Badge variant="secondary">{s?.stream || "—"}</Badge></TableCell>
                            <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell>{catDate(p.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" title="Print receipt" onClick={() => printReceipt(receiptDataFor(p))}>
                                  <Printer size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" title="Download A4 receipt" onClick={() => generateReceipt(receiptDataFor(p))}>
                                  <Download size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" title="80mm receipt" onClick={() => generateThermalReceipt(receiptDataFor(p))}>
                                  <Receipt80 />
                                </Button>
                                <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditPayment(p)}>
                                  <Pencil size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" title="Delete" onClick={() => deletePayment(p)}>
                                  <Trash2 size={16} className="text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learners">
            <Card className="shadow-card">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">No learners registered yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary">
                        <TableHead>Name</TableHead>
                        <TableHead>Stream</TableHead>
                        <TableHead>Guardian</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map(s => {
                        const owing = owingFor(s);
                        return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            {titleCaseName(`${s.first_name} ${s.last_name}`)}
                            {owing > 0 ? (
                              <Badge variant="destructive" className="ml-2">Owes ${owing.toFixed(2)}</Badge>
                            ) : (
                              <Badge className="ml-2 bg-success text-success-foreground">Paid</Badge>
                            )}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{s.stream}</Badge></TableCell>
                          <TableCell>{s.guardian_name || "—"}</TableCell>
                          <TableCell>{s.guardian_phone || "—"}</TableCell>
                          <TableCell>${expectedFor(s.stream).toFixed(2)}</TableCell>
                          <TableCell>${(paidByStudent[s.id] || 0).toFixed(2)}</TableCell>
                          <TableCell className={owing > 0 ? "text-destructive font-semibold" : "text-success"}>
                            ${owing.toFixed(2)}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="gap-1" onClick={() => openNewPayment(s.id)}>
                                <DollarSign size={14} /> Pay
                              </Button>
                              <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditStudent(s)}>
                                <Pencil size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" title="Remove" onClick={() => deleteStudent(s)}>
                                <Trash2 size={16} className="text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}

                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Registration dialog */}
      <Dialog open={regOpen} onOpenChange={(o) => { setRegOpen(o); if (!o) resetStudentForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit Learner" : "Register Vacation School Learner"}</DialogTitle>
            <DialogDescription>No registration number needed — just names and stream.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>First Name</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div>
              <Label>Stream</Label>
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
                <SelectContent>
                  {STREAMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Not specified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Guardian Name</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} />
            </div>
            <div>
              <Label>Guardian Phone</Label>
              <Input value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegOpen(false)}>Cancel</Button>
            <Button onClick={saveStudent} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {editingStudent ? "Save Changes" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Vacation School Payment" : "Record Vacation School Payment"}</DialogTitle>
            <DialogDescription>Receipts are marked as Vacation School.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Learner</Label>
              <Select
                value={payStudentId}
                onValueChange={(v) => {
                  setPayStudentId(v);
                  if (!editingPayment) setAmount(defaultAmountFor(studentById[v]?.stream));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>
                  {students
                    .filter(s => streamFilter === "all" || s.stream === streamFilter)
                    .map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {titleCaseName(`${s.first_name} ${s.last_name}`)} — {s.stream}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min="1"
                autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!saving) savePayment(); } }}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={savePayment} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
              {editingPayment ? "Save Changes" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const Receipt80 = () => <span className="text-[10px] font-semibold">80mm</span>;

export default AdminVacationSchool;
