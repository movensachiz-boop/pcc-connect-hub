import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Camera, Upload, Loader2, CheckCircle, Search, Eye, Printer, MoreVertical, UserPlus } from "lucide-react";
import { generateReceipt, generateThermalReceipt, printReceipt } from "@/lib/generateReceipt";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentRow {
  id: string;
  student_profile_id: string;
  amount: number;
  method: string;
  status: string;
  receipt_number: string | null;
  created_at: string;
  currency: string;
  description: string | null;
  paynow_reference: string | null;
  phone: string | null;
  deposit_slip_url: string | null;
  verification_hash: string | null;
  studentName?: string;
  regNo?: string;
}

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  guardian_phone: string | null;
}

const AdminPayments = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("");
  const [manualRef, setManualRef] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [patternWarnings, setPatternWarnings] = useState<string[]>([]);
  const [quickRegister, setQuickRegister] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newForm, setNewForm] = useState("");
  const [newGender, setNewGender] = useState("male");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("id, first_name, last_name, registration_number, guardian_phone").order("first_name");
    if (data) setStudents(data);
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data: paymentData } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (paymentData) {
      const profileIds = [...new Set(paymentData.map(p => p.student_profile_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, registration_number")
        .in("id", profileIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = paymentData.map(p => {
        const prof = profileMap.get(p.student_profile_id);
        return {
          ...p,
          studentName: prof ? `${prof.first_name} ${prof.last_name}` : "Unknown",
          regNo: prof?.registration_number || "N/A",
        };
      });
      setPayments(enriched);
    }
    setLoading(false);
  };

  const handleDownloadReceipt = (p: PaymentRow) => {
    generateReceipt({
      receiptNo: p.receipt_number || p.id.slice(0, 12),
      studentName: p.studentName || "Unknown",
      regNo: p.regNo || "N/A",
      date: new Date(p.created_at).toLocaleDateString(),
      amount: `$${p.amount}`,
      method: p.method,
      verificationHash: p.verification_hash || undefined,
    });
    toast({ title: "Receipt Downloaded" });
  };

  const handleDownloadThermal = (p: PaymentRow) => {
    generateThermalReceipt({
      receiptNo: p.receipt_number || p.id.slice(0, 12),
      studentName: p.studentName || "Unknown",
      regNo: p.regNo || "N/A",
      date: new Date(p.created_at).toLocaleDateString(),
      amount: `$${p.amount}`,
      method: p.method,
      verificationHash: p.verification_hash || undefined,
    });
    toast({ title: "Thermal Receipt Downloaded" });
  };

  const handlePrint = (p: PaymentRow) => {
    printReceipt({
      receiptNo: p.receipt_number || p.id.slice(0, 12),
      studentName: p.studentName || "Unknown",
      regNo: p.regNo || "N/A",
      date: new Date(p.created_at).toLocaleDateString(),
      amount: `$${p.amount}`,
      method: p.method,
      verificationHash: p.verification_hash || undefined,
    });
  };

  const handlePrintThermal = (p: PaymentRow) => {
    generateThermalReceipt({
      receiptNo: p.receipt_number || p.id.slice(0, 12),
      studentName: p.studentName || "Unknown",
      regNo: p.regNo || "N/A",
      date: new Date(p.created_at).toLocaleDateString(),
      amount: `$${p.amount}`,
      method: p.method,
      verificationHash: p.verification_hash || undefined,
    }, "print");
  };

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipFile(file);

    setScanning(true);
    setSlipDialogOpen(false);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await supabase.functions.invoke("extract-payment", {
          body: { imageBase64: base64 },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });

        if (resp.error) throw new Error(resp.error.message || "Scan failed");

        const payment = resp.data?.payment;
        const warnings: string[] = resp.data?.warnings || [];
        if (payment) {
          setScannedData(payment);
          setPatternWarnings(warnings);
          setManualAmount(payment.amount || "");
          setManualMethod(payment.method || "Bank Deposit");
          setManualRef(payment.reference_number || "");

          // Try to match student by name
          const name = (payment.depositor_name || "").toLowerCase();
          const match = students.find(s =>
            name.includes(s.first_name.toLowerCase()) || name.includes(s.last_name.toLowerCase())
          );
          if (match) setSelectedStudentId(match.id);
          setConfirmDialogOpen(true);
        }
      } catch (err: any) {
        toast({ title: "Scan Failed", description: err.message, variant: "destructive" });
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSavePayment = async () => {
    if (!selectedStudentId || !manualAmount) {
      toast({ title: "Missing Info", description: "Select a student and enter amount.", variant: "destructive" });
      return;
    }

    setSaving(true);
    let depositSlipUrl: string | null = null;

    // Upload deposit slip image to storage
    if (slipFile) {
      const fileName = `${Date.now()}-${slipFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("deposit-slips")
        .upload(fileName, slipFile);

      if (uploadError) {
        console.error("Slip upload error:", uploadError);
      } else {
        const { data: urlData } = supabase.storage
          .from("deposit-slips")
          .getPublicUrl(uploadData.path);
        depositSlipUrl = urlData.publicUrl;
      }
    }

    const { data: paymentData, error } = await supabase.from("payments").insert({
      student_profile_id: selectedStudentId,
      amount: parseFloat(manualAmount),
      method: manualMethod || "Bank Deposit",
      status: "confirmed",
      paynow_reference: manualRef || null,
      description: "Deposit slip payment",
      deposit_slip_url: depositSlipUrl,
      bank_name: scannedData?.bank_name || null,
      swift_code: scannedData?.swift_code || null,
      transaction_id_format: scannedData?.transaction_id_format || null,
    } as any).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Send SMS notification to guardian
      const student = students.find(s => s.id === selectedStudentId);
      if (student?.guardian_phone) {
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              type: "payment",
              guardianPhone: student.guardian_phone,
              studentName: `${student.first_name} ${student.last_name}`,
              amount: manualAmount,
              receiptNumber: paymentData?.receipt_number,
              method: manualMethod || "Bank Deposit",
            },
          });
        } catch {
          // Payment saved, notification failed silently
        }
      }
      toast({ title: "Payment Recorded", description: "Payment saved with deposit slip attached." });
      setConfirmDialogOpen(false);
      setScannedData(null);
      setSlipFile(null);
      setPatternWarnings([]);
      setSelectedStudentId("");
      setManualAmount("");
      setManualMethod("");
      setManualRef("");
      fetchPayments();
    }
    setSaving(false);
  };

  const handleQuickRegister = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) {
      toast({ title: "Missing Info", description: "First and last name are required.", variant: "destructive" });
      return;
    }
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-students", {
        body: {
          action: "add",
          students: [{
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            form: newForm || null,
            gender: newGender,
          }],
        },
      });
      if (error) throw error;
      // Refresh students list and select the new student
      await fetchStudents();
      // Find the newly created student by name match (most recent)
      const { data: newStudents } = await supabase.from("profiles")
        .select("id, first_name, last_name, registration_number, guardian_phone")
        .ilike("first_name", newFirstName.trim())
        .ilike("last_name", newLastName.trim())
        .order("created_at", { ascending: false })
        .limit(1);
      if (newStudents && newStudents.length > 0) {
        setSelectedStudentId(newStudents[0].id);
        setStudents(prev => {
          const exists = prev.find(s => s.id === newStudents[0].id);
          return exists ? prev : [...prev, newStudents[0]];
        });
      }
      toast({ title: "Student Registered", description: `${newFirstName} ${newLastName} added successfully.` });
      setQuickRegister(false);
      setNewFirstName("");
      setNewLastName("");
      setNewForm("");
      setNewGender("male");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    }
    setRegistering(false);
  };

  const filteredStudents = students.filter(s =>
    studentSearch === "" ||
    `${s.first_name} ${s.last_name} ${s.registration_number}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Payment Records</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setScannedData({ depositor_name: "", bank_name: "", date: "", amount: "", method: "Cash", reference_number: "" });
              setManualAmount("");
              setManualMethod("Cash");
              setManualRef("");
              setSelectedStudentId("");
              setStudentSearch("");
              setSlipFile(null);
              setConfirmDialogOpen(true);
            }} className="gap-2">
              Record Payment
            </Button>
            <Button onClick={() => setSlipDialogOpen(true)} className="gap-2">
              <Camera size={16} /> Scan Deposit Slip
            </Button>
          </div>
        </div>

        {scanning && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Scanning deposit slip with AI...</span>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No payments recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Reg No.</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.receipt_number || p.id.slice(0, 8)}</TableCell>
                      <TableCell>{p.studentName}</TableCell>
                      <TableCell>{p.regNo}</TableCell>
                      <TableCell>${p.amount}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={p.status === "confirmed" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.deposit_slip_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={p.deposit_slip_url} target="_blank" rel="noopener noreferrer" title="View Slip">
                                <Eye size={16} />
                              </a>
                            </Button>
                          )}
                          {p.status === "confirmed" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handlePrint(p)}>
                                  <Printer size={14} className="mr-2" /> Print A4
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePrintThermal(p)}>
                                  <Printer size={14} className="mr-2" /> Print Thermal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadReceipt(p)}>
                                  <Download size={14} className="mr-2" /> Download A4 PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadThermal(p)}>
                                  <Download size={14} className="mr-2" /> Download Thermal PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Slip Dialog */}
      <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Deposit Slip</DialogTitle>
            <DialogDescription>
              Take a photo or upload an image of the deposit slip. AI will extract the payment details automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Click to upload or take photo</p>
              <p className="text-xs text-muted-foreground/70">JPG, PNG supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleSlipUpload}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Scanned Payment Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" /> Payment Details Extracted
            </DialogTitle>
            <DialogDescription>
              Review and confirm the details below. Select the correct student then save.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {scannedData && (
            <>
              <div className="space-y-2">
                <Label>Depositor / Student Name</Label>
                <Input
                  value={scannedData.depositor_name || ""}
                  onChange={(e) => setScannedData({ ...scannedData, depositor_name: e.target.value })}
                  placeholder="Name on deposit slip or student name"
                />
              </div>

              <div className="space-y-2">
                <Label>Bank</Label>
                <Input
                  value={scannedData.bank_name || ""}
                  onChange={(e) => setScannedData({ ...scannedData, bank_name: e.target.value })}
                  placeholder="e.g. Ecobank Zimbabwe"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  value={scannedData.date || ""}
                  onChange={(e) => setScannedData({ ...scannedData, date: e.target.value })}
                  type="date"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Student *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    onClick={() => setQuickRegister(!quickRegister)}
                  >
                    <UserPlus size={14} />
                    {quickRegister ? "Search Existing" : "Register New"}
                  </Button>
                </div>

                {quickRegister ? (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">Quick Register New Student</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">First Name *</Label>
                        <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="First name" />
                      </div>
                      <div>
                        <Label className="text-xs">Last Name *</Label>
                        <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Last name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Form</Label>
                        <Select value={newForm} onValueChange={setNewForm}>
                          <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Form 1">Form 1</SelectItem>
                            <SelectItem value="Form 2">Form 2</SelectItem>
                            <SelectItem value="Form 3">Form 3</SelectItem>
                            <SelectItem value="Form 4">Form 4</SelectItem>
                            <SelectItem value="Form 5">Form 5</SelectItem>
                            <SelectItem value="Form 6">Form 6</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Gender</Label>
                        <Select value={newGender} onValueChange={setNewGender}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" onClick={handleQuickRegister} disabled={registering} className="w-full">
                      {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus size={14} className="mr-2" />}
                      Register & Select
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search student..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
                      <SelectContent>
                        {filteredStudents.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.first_name} {s.last_name} ({s.registration_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {selectedStudentId && (
                  <p className="text-xs text-success">
                    ✓ Student selected: {students.find(s => s.id === selectedStudentId)?.first_name} {students.find(s => s.id === selectedStudentId)?.last_name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount ($) *</Label>
                  <Input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={manualMethod} onValueChange={setManualMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
                      <SelectItem value="EcoCash">EcoCash</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input value={manualRef} onChange={(e) => setManualRef(e.target.value)} placeholder="e.g. DEP-123456" />
              </div>
            </>
          )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePayment} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminPayments;
