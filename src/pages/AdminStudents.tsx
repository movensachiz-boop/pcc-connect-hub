import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus, KeyRound, Loader2, Camera, Upload, X, Check, Send, CreditCard, ImagePlus } from "lucide-react";
import { generateStudentID, generateBulkStudentIDs } from "@/lib/generateStudentID";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  form: string | null;
  stream: string | null;
  status: string;
  balance: number;
  claimed: boolean;
  guardian_phone: string | null;
  guardian_name: string | null;
}

interface ExtractedStudent {
  first_name: string;
  last_name: string;
  form: string;
  stream: string;
  guardian_name: string;
  guardian_phone: string;
  selected: boolean;
}

const AdminStudents = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [form, setForm] = useState("");
  const [stream, setStream] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Reset password form
  const [resetRegNumber, setResetRegNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Scan/OCR state
  const [scanning, setScanning] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [extractedStudents, setExtractedStudents] = useState<ExtractedStudent[]>([]);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [bulkRegistering, setBulkRegistering] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [studentPhotos, setStudentPhotos] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

  const generateRegNumber = (offset = 0) => {
    const year = new Date().getFullYear();
    const num = (students.length + 1 + offset).toString().padStart(3, "0");
    return `PCC-${year}-${num}`;
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-students", {
        body: { action: "list_students" },
      });
      if (error || data?.error) {
        console.error("Failed to fetch students:", data?.error || error);
        return;
      }
      setStudents(data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length === 0) return;
    const loadPhotos = async () => {
      const photos: Record<string, string> = {};
      for (const s of students) {
        const { data } = supabase.storage
          .from("student-photos")
          .getPublicUrl(`${s.registration_number}.jpg`);
        try {
          const res = await fetch(data.publicUrl, { method: "HEAD" });
          if (res.ok) photos[s.id] = data.publicUrl;
        } catch { /* no photo */ }
      }
      setStudentPhotos(photos);
    };
    loadPhotos();
  }, [students]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTargetId) return;
    const student = students.find((s) => s.id === photoTargetId);
    if (!student) return;
    setUploadingPhoto(photoTargetId);
    try {
      const filePath = `${student.registration_number}.jpg`;
      const { error } = await supabase.storage
        .from("student-photos")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (error) {
        toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
        return;
      }
      const { data } = supabase.storage.from("student-photos").getPublicUrl(filePath);
      setStudentPhotos((prev) => ({ ...prev, [photoTargetId]: data.publicUrl + "?t=" + Date.now() }));
      toast({ title: "Photo Uploaded", description: `Photo for ${student.first_name} uploaded.` });
    } catch {
      toast({ title: "Error", description: "Failed to upload photo.", variant: "destructive" });
    } finally {
      setUploadingPhoto(null);
      setPhotoTargetId(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !form || !stream) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const regNumber = generateRegNumber();

    try {
      const { data, error } = await supabase.functions.invoke("manage-students", {
        body: {
          action: "create_student",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          form,
          stream,
          guardianName: guardianName.trim(),
          guardianPhone: guardianPhone.trim(),
          registrationNumber: regNumber,
        },
      });

      if (error || data?.error) {
        toast({ title: "Registration Failed", description: data?.error || "Something went wrong.", variant: "destructive" });
        return;
      }

      // Send notification to guardian if phone is provided
      if (guardianPhone.trim()) {
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              type: "registration",
              guardianPhone: guardianPhone.trim(),
              studentName: `${firstName.trim()} ${lastName.trim()}`,
              registrationNumber: regNumber,
            },
          });
          toast({
            title: "Student Pre-Registered & Notified",
            description: `${firstName} ${lastName} registered as ${regNumber}. Guardian notified via SMS/WhatsApp.`,
          });
        } catch {
          toast({
            title: "Student Pre-Registered",
            description: `${firstName} ${lastName} registered as ${regNumber}. Guardian notification failed.`,
          });
        }
      } else {
        toast({
          title: "Student Pre-Registered",
          description: `${firstName} ${lastName} registered as ${regNumber}.`,
        });
      }

      setFirstName("");
      setLastName("");
      setForm("");
      setStream("");
      setGuardianName("");
      setGuardianPhone("");
      setOpen(false);
      fetchStudents();
    } catch {
      toast({ title: "Error", description: "Failed to register student.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetRegNumber.trim() || !newPassword) {
      toast({ title: "Missing Fields", description: "Please enter the registration number and new password.", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-students", {
        body: {
          action: "reset_password",
          registrationNumber: resetRegNumber.trim(),
          newPassword,
        },
      });

      if (error || data?.error) {
        toast({ title: "Reset Failed", description: data?.error || "Something went wrong.", variant: "destructive" });
        return;
      }

      toast({ title: "Password Reset", description: `Password for ${resetRegNumber} has been reset successfully.` });
      setResetRegNumber("");
      setNewPassword("");
      setResetOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to reset password.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNotification = async (student: Student) => {
    if (!student.guardian_phone) {
      toast({ title: "No Phone Number", description: "This student has no guardian phone number on file.", variant: "destructive" });
      return;
    }
    setSendingNotification(student.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "registration",
          guardianPhone: student.guardian_phone,
          studentName: `${student.first_name} ${student.last_name}`,
          registrationNumber: student.registration_number,
        },
      });
      if (error || data?.error) {
        toast({ title: "Notification Failed", description: data?.error || data?.details?.message || "Could not send message.", variant: "destructive" });
      } else {
        toast({ title: "Notification Sent", description: `Message sent to ${student.guardian_phone} for ${student.first_name} ${student.last_name}.` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send notification.", variant: "destructive" });
    } finally {
      setSendingNotification(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreviewImage(base64);
      setScanOpen(true);
      setScanning(true);
      setExtractedStudents([]);

      try {
        const { data, error } = await supabase.functions.invoke("extract-students", {
          body: { imageBase64: base64 },
        });

        if (error || data?.error) {
          toast({ title: "Scan Failed", description: data?.error || "Could not process the image.", variant: "destructive" });
          setScanning(false);
          return;
        }

        const extracted = (data.students || []).map((s: any) => ({
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          form: s.form || "",
          stream: s.stream || "",
          guardian_name: s.guardian_name || "",
          guardian_phone: s.guardian_phone || "",
          selected: true,
        }));

        setExtractedStudents(extracted);
        toast({ title: "Scan Complete", description: `Found ${extracted.length} student(s) in the image.` });
      } catch {
        toast({ title: "Error", description: "Failed to scan image.", variant: "destructive" });
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleStudentSelection = (index: number) => {
    setExtractedStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const updateExtractedStudent = (index: number, field: keyof ExtractedStudent, value: string) => {
    setExtractedStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleBulkRegister = async () => {
    const selected = extractedStudents.filter((s) => s.selected && s.first_name && s.last_name);
    if (selected.length === 0) {
      toast({ title: "No Students Selected", description: "Select at least one student to register.", variant: "destructive" });
      return;
    }

    setBulkRegistering(true);
    let registered = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
      const s = selected[i];
      const regNumber = generateRegNumber(i);

      try {
        const { data, error } = await supabase.functions.invoke("manage-students", {
          body: {
            action: "create_student",
            firstName: s.first_name.trim(),
            lastName: s.last_name.trim(),
            form: s.form || null,
            stream: s.stream || null,
            guardianName: s.guardian_name || null,
            guardianPhone: s.guardian_phone || null,
            registrationNumber: regNumber,
          },
        });

        if (error || data?.error) {
          failed++;
        } else {
          registered++;
          // Send notification if guardian phone exists
          if (s.guardian_phone) {
            try {
              await supabase.functions.invoke("send-notification", {
                body: {
                  type: "registration",
                  guardianPhone: s.guardian_phone,
                  studentName: `${s.first_name.trim()} ${s.last_name.trim()}`,
                  registrationNumber: regNumber,
                },
              });
            } catch {
              // Notification failed but registration succeeded
            }
          }
        }
      } catch {
        failed++;
      }
    }

    toast({
      title: "Bulk Registration Complete",
      description: `${registered} student(s) registered${failed > 0 ? `, ${failed} failed` : ""}.`,
    });

    setScanOpen(false);
    setExtractedStudents([]);
    setPreviewImage(null);
    fetchStudents();
    setBulkRegistering(false);
  };

  const filtered = students.filter(
    (s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      s.registration_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-bold text-foreground">Student Management</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setResetOpen(true)}>
              <KeyRound size={16} /> Reset Password
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} /> Scan List
            </Button>
            <Button variant="outline" className="gap-2" onClick={async () => {
              const year = new Date().getFullYear().toString();
              const ids = filtered.map(s => ({
                name: `${s.first_name} ${s.last_name}`,
                regNumber: s.registration_number,
                form: s.form || "—",
                stream: s.stream || "—",
                year,
                photoUrl: studentPhotos[s.id],
              }));
              if (ids.length === 0) {
                toast({ title: "No Students", description: "No students to generate IDs for.", variant: "destructive" });
                return;
              }
              await generateBulkStudentIDs(ids);
              toast({ title: "IDs Generated", description: `${ids.length} student ID card(s) saved as PDF.` });
            }}>
              <CreditCard size={16} /> Generate All IDs
            </Button>
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <UserPlus size={16} /> Register Student
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-base">All Students ({filtered.length})</CardTitle>
              <div className="relative sm:ml-auto w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or reg no..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead>Reg No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.registration_number}</TableCell>
                      <TableCell>{s.first_name} {s.last_name}</TableCell>
                      <TableCell>{s.form || "—"}</TableCell>
                      <TableCell>{s.stream || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.claimed ? "default" : "outline"} className={s.claimed ? "bg-success text-success-foreground" : ""}>
                          {s.claimed ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={s.status === "Active" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>${s.balance}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            disabled={uploadingPhoto === s.id}
                            onClick={() => {
                              setPhotoTargetId(s.id);
                              setTimeout(() => photoInputRef.current?.click(), 0);
                            }}
                            title={studentPhotos[s.id] ? "Change photo" : "Upload photo"}
                          >
                            {uploadingPhoto === s.id ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                            {studentPhotos[s.id] ? "📷" : "Photo"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            disabled={sendingNotification === s.id || !s.guardian_phone}
                            onClick={() => handleSendNotification(s)}
                            title={s.guardian_phone ? `Send to ${s.guardian_phone}` : "No phone number"}
                          >
                            {sendingNotification === s.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Notify
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={async () => {
                              await generateStudentID({
                                name: `${s.first_name} ${s.last_name}`,
                                regNumber: s.registration_number,
                                form: s.form || "—",
                                stream: s.stream || "—",
                                year: new Date().getFullYear().toString(),
                                photoUrl: studentPhotos[s.id],
                              });
                              toast({ title: "ID Generated", description: `ID card for ${s.first_name} saved.` });
                            }}
                            title="Generate Student ID Card"
                          >
                            <CreditCard size={14} /> ID
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Register Student Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pre-Register New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Form *</Label>
                <Select value={form} onValueChange={setForm}>
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4", "5", "6"].map((f) => (
                      <SelectItem key={f} value={f}>Form {f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stream *</Label>
                <Select value={stream} onValueChange={setStream}>
                  <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
                  <SelectContent>
                    {["Science", "Arts", "Commerce"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Guardian Name</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Parent/Guardian name" />
            </div>
            <div className="space-y-2">
              <Label>Guardian Phone</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
            </div>
            <div className="rounded-md bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Registration number will be auto-generated:</p>
              <p className="text-sm font-semibold text-primary">{generateRegNumber()}</p>
              <p className="text-xs text-muted-foreground mt-1">Share this number with the student so they can set up their account.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Register Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Student Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Registration Number *</Label>
              <Input
                value={resetRegNumber}
                onChange={(e) => setResetRegNumber(e.target.value)}
                placeholder="e.g. PCC-2025-001"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan Student List Dialog */}
      <Dialog open={scanOpen} onOpenChange={(v) => { if (!scanning && !bulkRegistering) setScanOpen(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan Student List</DialogTitle>
            <DialogDescription>
              AI will extract student names from your photo. Review and edit before registering.
            </DialogDescription>
          </DialogHeader>

          {previewImage && (
            <div className="rounded-md overflow-hidden border max-h-48">
              <img src={previewImage} alt="Uploaded student list" className="w-full object-contain max-h-48" />
            </div>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-sm text-muted-foreground">Reading student list... This may take a moment.</p>
            </div>
          )}

          {!scanning && extractedStudents.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Found {extractedStudents.length} student(s). Review and edit:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {extractedStudents.map((s, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-md border ${s.selected ? "bg-secondary/50" : "opacity-50"}`}>
                    <Checkbox
                      checked={s.selected}
                      onCheckedChange={() => toggleStudentSelection(i)}
                      className="mt-1"
                    />
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        value={s.first_name}
                        onChange={(e) => updateExtractedStudent(i, "first_name", e.target.value)}
                        placeholder="First name"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={s.last_name}
                        onChange={(e) => updateExtractedStudent(i, "last_name", e.target.value)}
                        placeholder="Last name"
                        className="h-8 text-sm"
                      />
                      <Select value={s.form} onValueChange={(v) => updateExtractedStudent(i, "form", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Form" /></SelectTrigger>
                        <SelectContent>
                          {["1", "2", "3", "4", "5", "6"].map((f) => (
                            <SelectItem key={f} value={f}>Form {f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={s.stream} onValueChange={(v) => updateExtractedStudent(i, "stream", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Stream" /></SelectTrigger>
                        <SelectContent>
                          {["Science", "Arts", "Commerce"].map((st) => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!scanning && extractedStudents.length === 0 && previewImage && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No students could be extracted. Try a clearer photo.</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} /> Try Another Photo
              </Button>
            </div>
          )}

          {extractedStudents.length > 0 && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload size={16} /> Rescan
              </Button>
              <Button variant="outline" onClick={() => { setScanOpen(false); setExtractedStudents([]); setPreviewImage(null); }}>
                Cancel
              </Button>
              <Button onClick={handleBulkRegister} disabled={bulkRegistering} className="gap-2">
                {bulkRegistering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Register {extractedStudents.filter((s) => s.selected).length} Student(s)
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminStudents;
