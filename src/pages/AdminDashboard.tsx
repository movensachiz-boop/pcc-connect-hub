import DashboardLayout from "@/components/DashboardLayout";
import PinGate from "@/components/PinGate";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const barData = [
  { name: "Form 1", collected: 42000, outstanding: 8000 },
  { name: "Form 2", collected: 38000, outstanding: 12000 },
  { name: "Form 3", collected: 45000, outstanding: 5000 },
  { name: "Form 4", collected: 50000, outstanding: 3000 },
  { name: "Form 5", collected: 35000, outstanding: 15000 },
  { name: "Form 6", collected: 30000, outstanding: 10000 },
];

const pieData = [
  { name: "Bank Transfer", value: 45 },
  { name: "Mobile Money", value: 35 },
  { name: "Card", value: 15 },
  { name: "Cash", value: 5 },
];
const PIE_COLORS = ["hsl(210,100%,20%)", "hsl(51,100%,50%)", "hsl(142,72%,40%)", "hsl(0,0%,60%)"];

const recentPayments = [
  { student: "James Mwangi", reg: "PCC-2025-001", form: "4", amount: "$450", date: "2025-03-28", status: "Paid" },
  { student: "Grace Otieno", reg: "PCC-2025-042", form: "2", amount: "$200", date: "2025-03-27", status: "Partial" },
  { student: "Peter Kamau", reg: "PCC-2025-015", form: "5", amount: "$500", date: "2025-03-26", status: "Paid" },
  { student: "Faith Njeri", reg: "PCC-2025-088", form: "1", amount: "$450", date: "2025-03-25", status: "Paid" },
  { student: "David Omondi", reg: "PCC-2025-033", form: "3", amount: "$150", date: "2025-03-24", status: "Partial" },
];

const AdminDashboard = () => (
  <PinGate>
  <DashboardLayout role="admin">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value="1,247" subtitle="+23 this term" icon={Users} variant="primary" />
        <StatCard title="Fees Collected" value="$240,000" subtitle="Term 1, 2025" icon={DollarSign} variant="success" />
        <StatCard title="Outstanding" value="$53,000" subtitle="18% of total" icon={AlertTriangle} variant="warning" />
        <StatCard title="Collection Rate" value="82%" subtitle="+5% vs last term" icon={TrendingUp} variant="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fee Collection by Form</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
                  <Bar dataKey="collected" fill="hsl(210,100%,20%)" radius={[4, 4, 0, 0]} name="Collected" />
                  <Bar dataKey="outstanding" fill="hsl(51,100%,50%)" radius={[4, 4, 0, 0]} name="Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                  {d.name} ({d.value}%)
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead>Student</TableHead>
                <TableHead>Reg No.</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.map((p) => (
                <TableRow key={p.reg}>
                  <TableCell className="font-medium">{p.student}</TableCell>
                  <TableCell>{p.reg}</TableCell>
                  <TableCell>{p.form}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>
                    <Badge className={p.status === "Paid" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                      {p.status}
                    </Badge>
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

export default AdminDashboard;
