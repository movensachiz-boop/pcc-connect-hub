import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Student {
  reg: string;
  name: string;
  form: string;
  stream: string;
  status: string;
  balance: string;
}

const initialStudents: Student[] = [
  { reg: "PCC-2025-001", name: "James Mwangi", form: "4", stream: "Science", status: "Active", balance: "$450" },
  { reg: "PCC-2025-042", name: "Grace Otieno", form: "2", stream: "Arts", status: "Active", balance: "$700" },
  { reg: "PCC-2025-015", name: "Peter Kamau", form: "5", stream: "Commerce", status: "Active", balance: "$0" },
  { reg: "PCC-2025-088", name: "Faith Njeri", form: "1", stream: "Science", status: "Active", balance: "$450" },
  { reg: "PCC-2025-033", name: "David Omondi", form: "3", stream: "Arts", status: "Suspended", balance: "$1,200" },
  { reg: "PCC-2025-056", name: "Mary Wanjiku", form: "6", stream: "Science", status: "Active", balance: "$0" },
  { reg: "PCC-2025-071", name: "John Kiplagat", form: "4", stream: "Commerce", status: "Active", balance: "$300" },
  { reg: "PCC-2025-099", name: "Sarah Achieng", form: "2", stream: "Science", status: "Active", balance: "$150" },
];

const AdminStudents = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [form, setForm] = useState("");
  const [stream, setStream] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const generateRegNumber = () => {
    const year = new Date().getFullYear();
    const num = (students.length + 1).toString().padStart(3, "0");
    return `PCC-${year}-${num}`;
  };

  const handleRegister = () => {
    if (!firstName.trim() || !lastName.trim() || !form || !stream) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const newStudent: Student = {
      reg: generateRegNumber(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      form,
      stream,
      status: "Active",
      balance: "$0",
    };

    setStudents([newStudent, ...students]);
    toast({
      title: "Student Registered",
      description: `${newStudent.name} registered as ${newStudent.reg}`,
    });

    // Reset form
    setFirstName("");
    setLastName("");
    setForm("");
    setStream("");
    setGuardianName("");
    setGuardianPhone("");
    setOpen(false);
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.reg.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-bold text-foreground">Student Management</h2>
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <UserPlus size={16} /> Register Student
          </Button>
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
                  <TableRow key={s.reg}>
                    <TableCell className="font-medium">{s.reg}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.form}</TableCell>
                    <TableCell>{s.stream}</TableCell>
                    <TableCell>
                      <Badge className={s.status === "Active" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.balance}</TableCell>
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
          </CardContent>
        </Card>
      </div>

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
            <Button onClick={handleRegister}>Register Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminStudents;
