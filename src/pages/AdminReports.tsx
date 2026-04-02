import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

const reports = [
  { name: "Term 1 Fee Collection Summary", type: "Financial", date: "2025-03-30" },
  { name: "Outstanding Balances by Form", type: "Financial", date: "2025-03-28" },
  { name: "Payment Method Analysis", type: "Analytics", date: "2025-03-25" },
  { name: "Student Enrollment Report", type: "Academic", date: "2025-03-20" },
];

const AdminReports = () => (
  <DashboardLayout role="admin">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Reports</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <Card key={i} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-lg bg-primary/10 text-primary"><FileText size={22} /></div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.type} · {r.date}</p>
              </div>
              <Button variant="outline" size="icon"><Download size={16} /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default AdminReports;
