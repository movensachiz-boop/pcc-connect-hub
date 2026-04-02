import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { generateReceipt } from "@/lib/generateReceipt";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const payments = [
  { id: "RCP-001", date: "2025-01-15", amount: "$450.00", method: "Bank Transfer", status: "Paid" },
  { id: "RCP-002", date: "2025-03-20", amount: "$450.00", method: "Mobile Money", status: "Paid" },
  { id: "RCP-003", date: "2025-06-01", amount: "$450.00", method: "Card", status: "Pending" },
];

const StudentPayments = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; registration_number: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, registration_number")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
    };
    load();
  }, []);

  const handleDownloadReceipt = (p: typeof payments[0]) => {
    generateReceipt({
      receiptNo: p.id,
      studentName: profile ? `${profile.first_name} ${profile.last_name}` : "Student",
      regNo: profile?.registration_number || "N/A",
      date: p.date,
      amount: p.amount,
      method: p.method,
    });
    toast({ title: "Receipt Downloaded", description: `${p.id} receipt has been saved.` });
  };

  return (
  <DashboardLayout role="student">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">My Payments</h2>
      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>
                    <Badge className={p.status === "Paid" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>{p.status === "Paid" && <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(p)}><Download size={16} /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
  );
};

export default StudentPayments;
