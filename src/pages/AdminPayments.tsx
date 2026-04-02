import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { generateReceipt } from "@/lib/generateReceipt";
import { useToast } from "@/hooks/use-toast";

const payments = [
  { id: "TXN-0501", student: "James Mwangi", reg: "PCC-2025-001", amount: "$450", method: "Bank Transfer", date: "2025-03-28", status: "Confirmed" },
  { id: "TXN-0502", student: "Grace Otieno", reg: "PCC-2025-042", amount: "$200", method: "Mobile Money", date: "2025-03-27", status: "Confirmed" },
  { id: "TXN-0503", student: "Peter Kamau", reg: "PCC-2025-015", amount: "$500", method: "Card", date: "2025-03-26", status: "Confirmed" },
  { id: "TXN-0504", student: "Faith Njeri", reg: "PCC-2025-088", amount: "$450", method: "Mobile Money", date: "2025-03-25", status: "Pending" },
  { id: "TXN-0505", student: "David Omondi", reg: "PCC-2025-033", amount: "$150", method: "Cash", date: "2025-03-24", status: "Confirmed" },
];

const AdminPayments = () => (
  <DashboardLayout role="admin">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Payment Records</h2>
      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">All Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead>Transaction</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Reg No.</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell>{p.student}</TableCell>
                  <TableCell>{p.reg}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>
                    <Badge className={p.status === "Confirmed" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AdminPayments;
