import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Camera, Upload, Loader2, CheckCircle, Search, Eye, AlertTriangle } from "lucide-react";
import { generateReceipt } from "@/lib/generateReceipt";
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
    });
    toast({ title: "Receipt Downloaded" });
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

          // Check for duplicate via document fingerprint
          if (payment.bank_name && payment.amount) {
            const { data: fpMatch } = await supabase.rpc("verify_document_fingerprint", {
              p_bank_name: payment.bank_name || "",
              p_swift_code: payment.swift_code || "",
              p_transaction_id_format: payment.transaction_id_format || "",
              p_amount: payment.amount,
            });
            if (fpMatch && fpMatch.length > 0) {
              toast({
                title: "⚠️ Possible Duplicate",
                description: `This document matches receipt ${fpMatch[0].matching_receipt_number} for ${fpMatch[0].matching_student}.`,
                variant: "destructive",
              });
            }
          }

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
      setSelectedStudentId("");
      setManualAmount("");
      setManualMethod("");
      setManualRef("");
      fetchPayments();
    }
    setSaving(false);
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
                      <TableCell className="flex gap-1">
                        {p.deposit_slip_url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={p.deposit_slip_url} target="_blank" rel="noopener noreferrer" title="View Deposit Slip">
                              <Eye size={16} />
                            </a>
                          </Button>
                        )}
                        {p.status === "confirmed" && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(p)}>
                            <Download size={16} />
                          </Button>
                        )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" /> Payment Details Extracted
            </DialogTitle>
            <DialogDescription>
              Review and confirm the details below. Select the correct student then save.
            </DialogDescription>
          </DialogHeader>

          {scannedData && (
            <div className="space-y-4">
              {scannedData.depositor_name && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Depositor on slip</p>
                  <p className="font-medium">{scannedData.depositor_name}</p>
                </div>
              )}

              {(scannedData.bank_name || scannedData.swift_code) && (
                <div className="grid grid-cols-3 gap-2 rounded-md bg-primary/5 border border-primary/20 p-3">
                  {scannedData.bank_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bank</p>
                      <p className="font-medium text-sm">{scannedData.bank_name}</p>
                    </div>
                  )}
                  {scannedData.swift_code && (
                    <div>
                      <p className="text-xs text-muted-foreground">SWIFT/BIC</p>
                      <p className="font-mono font-medium text-sm">{scannedData.swift_code}</p>
                    </div>
                  )}
                  {scannedData.transaction_id_format && (
                    <div>
                      <p className="text-xs text-muted-foreground">TX Format</p>
                      <p className="font-mono font-medium text-sm">{scannedData.transaction_id_format}</p>
                    </div>
                  )}
                </div>
              )}

              {patternWarnings.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Document Pattern Warnings
                  </p>
                  {patternWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-destructive/80">• {w}</p>
                  ))}
                </div>
              )}

                <Label>Select Student *</Label>
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
            </div>
          )}

          <DialogFooter>
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
