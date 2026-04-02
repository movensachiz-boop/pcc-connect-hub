import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, KeyRound, Loader2 } from "lucide-react";
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
}

const AdminStudents = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Register form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [form, setForm] = useState("");
  const [stream, setStream] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [initialPassword, setInitialPassword] = useState("");

  // Reset password form
  const [resetRegNumber, setResetRegNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const generateRegNumber = () => {
    const year = new Date().getFullYear();
    const num = (students.length + 1).toString().padStart(3, "0");
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

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !form || !stream || !initialPassword) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields including the initial password.", variant: "destructive" });
      return;
    }

    if (initialPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" });
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
          initialPassword,
        },
      });

      if (error || data?.error) {
        toast({ title: "Registration Failed", description: data?.error || "Something went wrong.", variant: "destructive" });
        return;
      }

      toast({
        title: "Student Registered",
        description: `${firstName} ${lastName} registered as ${regNumber}. Initial password has been set.`,
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setForm("");
      setStream("");
      setGuardianName("");
      setGuardianPhone("");
      setInitialPassword("");
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
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setResetOpen(true)}>
              <KeyRound size={16} /> Reset Password
            </Button>
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <UserPlus size={16} /> Register Student
            </Button>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
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
                        <Badge className={s.status === "Active" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>${s.balance}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
            <DialogTitle>Register New Student</DialogTitle>
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
              <Label>Initial Password *</Label>
              <Input
                type="password"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Set initial password (min 6 chars)"
              />
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
    </DashboardLayout>
  );
};

export default AdminStudents;
