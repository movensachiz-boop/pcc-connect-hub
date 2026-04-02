import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus } from "lucide-react";

const students = [
  { reg: "PCC-2025-001", name: "James Mwangi", form: "4", stream: "Science", status: "Active", balance: "$450" },
  { reg: "PCC-2025-042", name: "Grace Otieno", form: "2", stream: "Arts", status: "Active", balance: "$700" },
  { reg: "PCC-2025-015", name: "Peter Kamau", form: "5", stream: "Commerce", status: "Active", balance: "$0" },
  { reg: "PCC-2025-088", name: "Faith Njeri", form: "1", stream: "Science", status: "Active", balance: "$450" },
  { reg: "PCC-2025-033", name: "David Omondi", form: "3", stream: "Arts", status: "Suspended", balance: "$1,200" },
  { reg: "PCC-2025-056", name: "Mary Wanjiku", form: "6", stream: "Science", status: "Active", balance: "$0" },
  { reg: "PCC-2025-071", name: "John Kiplagat", form: "4", stream: "Commerce", status: "Active", balance: "$300" },
  { reg: "PCC-2025-099", name: "Sarah Achieng", form: "2", stream: "Science", status: "Active", balance: "$150" },
];

const AdminStudents = () => (
  <DashboardLayout role="admin">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Student Management</h2>
        <Button className="gap-2"><UserPlus size={16} /> Register Student</Button>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base">All Students</CardTitle>
            <div className="relative sm:ml-auto w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search students..." className="pl-9" />
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
              {students.map((s) => (
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AdminStudents;
