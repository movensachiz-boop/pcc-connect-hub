import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const feeCollectionCSV = `Form,Students,Total Fees,Collected,Outstanding,Collection Rate
Form 1,220,$99000,$85000,$14000,85.9%
Form 2,210,$94500,$82000,$12500,86.8%
Form 3,200,$90000,$85000,$5000,94.4%
Form 4,215,$96750,$93000,$3750,96.1%
Form 5,195,$87750,$72000,$15750,82.1%
Form 6,207,$93150,$83000,$10150,89.1%
Total,1247,$561150,$500000,$61150,89.1%`;

const outstandingCSV = `Reg No,Student Name,Form,Total Fees,Paid,Outstanding,Status
PCC-2025-042,Grace Otieno,2,$4500,$3800,$700,Partially Paid
PCC-2025-033,David Omondi,3,$4500,$3300,$1200,Partially Paid
PCC-2025-001,James Mwangi,4,$4500,$4050,$450,Partially Paid
PCC-2025-088,Faith Njeri,1,$4500,$4050,$450,Partially Paid
PCC-2025-071,John Kiplagat,4,$4500,$4200,$300,Partially Paid
PCC-2025-099,Sarah Achieng,2,$4500,$4350,$150,Partially Paid`;

const paymentMethodCSV = `Payment Method,Transactions,Total Amount,Percentage
Bank Transfer,156,$225000,45%
Mobile Money,122,$175000,35%
Card Payment,52,$75000,15%
Cash,18,$25000,5%
Total,348,$500000,100%`;

const enrollmentCSV = `Form,Male,Female,Total,Science,Arts,Commerce
Form 1,115,105,220,80,85,55
Form 2,108,102,210,75,80,55
Form 3,105,95,200,70,78,52
Form 4,112,103,215,82,75,58
Form 5,100,95,195,68,72,55
Form 6,110,97,207,76,78,53
Total,650,597,1247,451,468,328`;

const reportData: Record<string, { csv: string; filename: string }> = {
  "Term 1 Fee Collection Summary": { csv: feeCollectionCSV, filename: "fee_collection_summary.csv" },
  "Outstanding Balances by Form": { csv: outstandingCSV, filename: "outstanding_balances.csv" },
  "Payment Method Analysis": { csv: paymentMethodCSV, filename: "payment_method_analysis.csv" },
  "Student Enrollment Report": { csv: enrollmentCSV, filename: "student_enrollment.csv" },
};

const reports = [
  { name: "Term 1 Fee Collection Summary", type: "Financial", date: "2025-03-30" },
  { name: "Outstanding Balances by Form", type: "Financial", date: "2025-03-28" },
  { name: "Payment Method Analysis", type: "Analytics", date: "2025-03-25" },
  { name: "Student Enrollment Report", type: "Academic", date: "2025-03-20" },
];

const AdminReports = () => {
  const { toast } = useToast();

  const handleDownload = (reportName: string) => {
    const data = reportData[reportName];
    if (!data) return;

    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Report Downloaded", description: `${data.filename} has been saved.` });
  };

  return (
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
                <Button variant="outline" size="icon" onClick={() => handleDownload(r.name)}>
                  <Download size={16} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminReports;
