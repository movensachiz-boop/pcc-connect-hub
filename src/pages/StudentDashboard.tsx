import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, CreditCard, AlertTriangle, Bell, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const payments = [
  { id: "RCP-001", date: "2025-01-15", amount: "$450.00", method: "Bank Transfer", status: "Paid" },
  { id: "RCP-002", date: "2025-03-20", amount: "$450.00", method: "Mobile Money", status: "Paid" },
  { id: "RCP-003", date: "2025-06-01", amount: "$450.00", method: "Card", status: "Pending" },
];

const announcements = [
  { title: "Term 2 Exam Timetable Released", date: "Mar 28, 2025", priority: "high" },
  { title: "School Fees Deadline: April 15", date: "Mar 25, 2025", priority: "high" },
  { title: "Sports Day – April 5th", date: "Mar 20, 2025", priority: "low" },
];

const StudentDashboard = () => {
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; registration_number: string; form: string | null; stream: string | null; balance: number } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, registration_number, form, stream, balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
    };
    loadProfile();
  }, []);

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Welcome, {profile ? `${profile.first_name} ${profile.last_name}` : "..."}
          </h2>
          <p className="text-muted-foreground">
            Reg: {profile?.registration_number || "..."} · Form {profile?.form || "—"} · {profile?.stream || "—"} Stream
          </p>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Fees" value="$1,350" icon={DollarSign} variant="primary" />
        <StatCard title="Paid" value="$900" icon={CreditCard} variant="success" />
        <StatCard title="Outstanding" value="$450" icon={AlertTriangle} variant="warning" />
        <StatCard title="Notices" value="3" icon={Bell} variant="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
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
                      <Badge variant={p.status === "Paid" ? "default" : "secondary"} className={p.status === "Paid" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.status === "Paid" && (
                        <Button variant="ghost" size="icon"><Download size={16} /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((a, i) => (
              <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-start gap-2">
                  <Bell size={14} className={a.priority === "high" ? "text-destructive mt-0.5" : "text-muted-foreground mt-0.5"} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
