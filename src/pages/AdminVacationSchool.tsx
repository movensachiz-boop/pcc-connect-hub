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
import { Loader2, UserPlus, DollarSign, Printer, Download, Trash2, Pencil, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateReceipt, generateThermalReceipt, printReceipt } from "@/lib/generateReceipt";
import { titleCaseName } from "@/lib/normalize";

const STREAMS = ["G1", "G2", "G22", "Blue", "Sciences", "Commercials", "Arts"];
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
}

const AdminVacationSchool = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<VStudent[]>([]);
  const [payments, setPayments] = useState<VPayment[]>([]);
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

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
    const { error } = editingStudent
      ? await supabase.from("vacation_students" as any).update(payload).eq("id", editingStudent.id)
      : await supabase.from("vacation_students" as any).insert(payload as any);
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingStudent ? "Learner updated" : "Learner registered" });
    setRegOpen(false); resetStudentForm(); loadAll();
  };

  const deleteStudent = async (s: VStudent) => {
    if (!confirm(`Remove ${s.first_name} ${s.last_name} and all their vacation school payments?`)) return;
    const { error } = await supabase.from("vacation_students" as any).delete().eq("id", s.id);
    if (error) { toast({ title: "Could not remove", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Learner removed" });
    loadAll();
  };

  const openNewPayment = (studentId?: string) => {
    setEditingPayment(null);
    setPayStudentId(studentId || "");
    setAmount(""); setMethod("Cash"); setDescription("Vacation School Fees");
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
    const payload = {
      vacation_student_id: payStudentId,
      amount: num,
      method,
      status: "paid",
      description: description.trim() || "Vacation School Fees",
    };
    const { error } = editingPayment
      ? await supabase.from("vacation_payments" as any).update(payload).eq("id", editingPayment.id)
      : await supabase.from("vacation_payments" as any).insert(payload as any);
    setSaving(false);
    if (error) { toast({ title: "Could not save payment", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingPayment ? "Payment updated" : "Payment recorded" });
    setPayOpen(false); loadAll();
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

  const receiptDataFor = (p: VPayment) => {
    const s = studentById[p.vacation_student_id];
    return {
      receiptNo: p.receipt_number || p.id.slice(0, 8),
      studentName: s ? titleCaseName(`${s.first_name} ${s.last_name}`) : "Vacation Learner",
      regNo: "VACATION SCHOOL",
      studentClass: s ? `Vacation School — ${s.stream}` : "Vacation School",
      date: new Date(p.created_at).toLocaleDateString(),
      amount: `$${Number(p.amount).toFixed(2)}`,
      method: p.method,
      description: `VACATION SCHOOL — ${p.description || "Vacation School Fees"}`,
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
            <Button variant="outline" className="gap-2" onClick={() => { resetStudentForm(); setRegOpen(true); }}>
              <UserPlus size={16} /> Register Learner
            </Button>
            <Button className="gap-2" onClick={() => openNewPayment()}>
              <DollarSign size={16} /> Record Payment
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
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
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Total Collected</CardDescription>
              <CardTitle className="text-2xl text-success">${totalCollected.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="learners">Registered Learners</TabsTrigger>
          </TabsList>

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
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.receipt_number || "—"}</TableCell>
                            <TableCell>{s ? titleCaseName(`${s.first_name} ${s.last_name}`) : "—"}</TableCell>
                            <TableCell><Badge variant="secondary">{s?.stream || "—"}</Badge></TableCell>
                            <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
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
                        <TableHead>Total Paid</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{titleCaseName(`${s.first_name} ${s.last_name}`)}</TableCell>
                          <TableCell><Badge variant="secondary">{s.stream}</Badge></TableCell>
                          <TableCell>{s.guardian_name || "—"}</TableCell>
                          <TableCell>{s.guardian_phone || "—"}</TableCell>
                          <TableCell>${(paidByStudent[s.id] || 0).toFixed(2)}</TableCell>
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
                      ))}
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
              <Select value={payStudentId} onValueChange={setPayStudentId}>
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
              <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
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
