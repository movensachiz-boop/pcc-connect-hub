import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardBankTransactions from "@/components/DashboardBankTransactions";

import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, DollarSign, AlertTriangle, TrendingUp, ShoppingBag, Landmark } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BankAlert {
  id: string;
  who: string;
  amount: number;
  what: string;
  receipt: string | null;
  at: string;
}

const PIE_COLORS = ["hsl(210,100%,20%)", "hsl(51,100%,50%)", "hsl(142,72%,40%)", "hsl(0,0%,60%)"];

interface RecentPayment {
  student: string;
  reg: string;
  form: string;
  amount: string;
  date: string;
  status: string;
}

interface TermOption {
  id: string;
  name: string;
  is_current: boolean;
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [feesCollected, setFeesCollected] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [inventoryRevenue, setInventoryRevenue] = useState(0);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankCount, setBankCount] = useState(0);
  const [bankAlerts, setBankAlerts] = useState<BankAlert[]>([]);
  const [showBankList, setShowBankList] = useState(false);
  const [barData, setBarData] = useState<{ name: string; collected: number; outstanding: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const selectedTerm = terms.find((t) => t.id === selectedTermId) || null;

  useEffect(() => {
    supabase
      .from("academic_terms")
      .select("id, name, is_current")
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        const list = (data || []) as TermOption[];
        setTerms(list);
        const cur = list.find((t) => t.is_current) || list[0];
        setSelectedTermId(cur?.id ?? null);
        if (!cur) loadDashboard(null);
      });
  }, []);

  useEffect(() => {
    if (selectedTermId) loadDashboard(selectedTermId);
  }, [selectedTermId]);

  // Live alerts when the bank posts a payment into the system
  useEffect(() => {
    const announce = async (profileId: string | null, amount: number, what: string, receipt?: string | null) => {
      let who = "A learner";
      if (profileId) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, registration_number")
          .eq("id", profileId)
          .maybeSingle();
        if (data) who = `${data.first_name} ${data.last_name} (${data.registration_number})`;
      }
      setBankAlerts(prev => [
        { id: `${Date.now()}-${Math.random()}`, who, amount, what, receipt: receipt || null, at: new Date().toISOString() },
        ...prev,
      ].slice(0, 8));
      toast.success(`Bank payment received — $${amount.toFixed(2)}`, {
        description: `${who} · ${what}${receipt ? ` · Receipt ${receipt}` : ""}`,
        duration: 10000,
      });
      loadDashboard(selectedTermId);
    };

    const channel = supabase
      .channel("bank-payment-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, (payload: any) => {
        const row = payload.new;
        if (row?.bank_name !== "National Building Society") return;
        announce(row.student_profile_id, Number(row.amount) || 0, /levy/i.test(row.description || "") ? "Levy" : "Tuition", row.receipt_number);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_sales" }, (payload: any) => {
        const row = payload.new;
        if (!String(row?.notes || "").startsWith("NBS ")) return;
        announce(row.student_profile_id, Number(row.total_amount) || 0, /trip/i.test(row.notes) ? "Trip" : "Uniforms", row.receipt_number);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTermId]);



  const loadDashboard = async (termId: string | null) => {

    setLoading(true);
    try {
      // Total students
      const { count: studentCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      setTotalStudents(studentCount || 0);

      // Fee summary via RPC (scoped to the selected term)
      const { data: feeSummary } = termId
        ? await supabase.rpc("get_student_fee_summary", { _term_id: termId })
        : await supabase.rpc("get_student_fee_summary");
      const summaries = feeSummary || [];
      const totalPaid = summaries.reduce((s, r) => s + Number(r.total_paid), 0);
      const totalFees = summaries.reduce((s, r) => s + Number(r.total_fees), 0);
      const totalOutstanding = Math.max(totalFees - totalPaid, 0);
      setFeesCollected(totalPaid);
      setOutstanding(totalOutstanding);

      // Inventory sales (separate from fees)
      const { data: invSales } = await supabase
        .from("inventory_sales")
        .select("total_amount, status, notes")
        .in("status", ["paid", "completed", "confirmed"]);
      const invTotal = (invSales || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      setInventoryRevenue(invTotal);

      // Money received straight from the bank (fees + uniforms/trips)
      const { data: bankFees } = await supabase
        .from("payments")
        .select("amount")
        .eq("bank_name", "National Building Society");
      const bankFeesTotal = (bankFees || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const bankInvTotal = (invSales || [])
        .filter((r: any) => (r.notes || "").startsWith("NBS "))
        .reduce((s, r) => s + Number(r.total_amount || 0), 0);
      setBankTotal(bankFeesTotal + bankInvTotal);
      setBankCount((bankFees || []).length + (invSales || []).filter((r: any) => (r.notes || "").startsWith("NBS ")).length);

      // Bar data per form
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, form");
      const formMap: Record<string, { collected: number; outstanding: number }> = {};
      for (const f of ["1", "2", "3", "4", "5", "6"]) {
        formMap[f] = { collected: 0, outstanding: 0 };
      }
      for (const s of summaries) {
        const prof = (profiles || []).find(p => p.id === s.profile_id);
        if (prof?.form && formMap[prof.form]) {
          formMap[prof.form].collected += Number(s.total_paid);
          formMap[prof.form].outstanding += Math.max(Number(s.total_fees) - Number(s.total_paid), 0);
        }
      }
      setBarData(Object.entries(formMap).map(([f, d]) => ({ name: `Form ${f}`, ...d })));

      // Recent payments (selected term)
      let payQuery = supabase
        .from("payments")
        .select("amount, created_at, status, method, student_profile_id, profile:profiles!payments_student_profile_id_fkey(first_name, last_name, registration_number, form)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (termId) payQuery = payQuery.eq("term_id", termId);
      const { data: payData } = await payQuery;

      if (payData && payData.length > 0) {
        setRecentPayments(payData.map((p: any) => {
          const prof = p.profile;
          return {
            student: prof ? `${prof.first_name} ${prof.last_name}` : "Unknown",
            reg: prof?.registration_number || "—",
            form: prof?.form || "—",
            amount: `$${Number(p.amount).toFixed(2)}`,
            date: new Date(p.created_at).toLocaleDateString(),
            status: p.status === "paid" || p.status === "completed" ? "Paid" : "Pending",
          };
        }));
      } else {
        setRecentPayments([]);
      }


      // Pie data from payment methods
      if (payData && payData.length > 0) {
        const methodCounts: Record<string, number> = {};
        for (const p of payData) {
          const m = p.method || "Other";
          methodCounts[m] = (methodCounts[m] || 0) + 1;
        }
        // Use all payments for pie, not just recent 5
        const { data: allPay } = await supabase
          .from("payments")
          .select("method")
          .eq("status", "paid");
        const allCounts: Record<string, number> = {};
        for (const p of allPay || []) {
          const m = p.method || "Other";
          allCounts[m] = (allCounts[m] || 0) + 1;
        }
        const total = Object.values(allCounts).reduce((a, b) => a + b, 0);
        setPieData(
          Object.entries(allCounts).map(([name, count]) => ({
            name,
            value: total > 0 ? Math.round((count / total) * 100) : 0,
          }))
        );
      } else {
        setPieData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const collectionRate = feesCollected + outstanding > 0
    ? Math.round((feesCollected / (feesCollected + outstanding)) * 100)
    : 0;

  return (
      <DashboardLayout role="admin">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
            {terms.length > 0 && (
              <Select value={selectedTermId ?? undefined} onValueChange={setSelectedTermId}>
                <SelectTrigger className="w-56 h-9">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_current ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedTerm && !selectedTerm.is_current && (
              <Badge className="bg-warning text-warning-foreground">Viewing past term</Badge>
            )}
          </div>


          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard title="Total Students" value={totalStudents.toLocaleString()} subtitle="Registered" icon={Users} variant="primary" />
              <StatCard title="Fees Collected" value={`$${feesCollected.toLocaleString()}`} subtitle="School fees only" icon={DollarSign} variant="success" />
              <StatCard title="Inventory Sales" value={`$${inventoryRevenue.toLocaleString()}`} subtitle="Shop revenue" icon={ShoppingBag} variant="accent" />
              <StatCard title="Outstanding" value={`$${outstanding.toLocaleString()}`} subtitle={totalStudents > 0 ? `${Math.round((outstanding / (feesCollected + outstanding || 1)) * 100)}% of total` : "—"} icon={AlertTriangle} variant="warning" />
              <StatCard title="Collection Rate" value={`${collectionRate}%`} subtitle="Based on fee requirements" icon={TrendingUp} variant="accent" />
              <StatCard title="Bank Payments" value={`$${bankTotal.toLocaleString()}`} subtitle={`${bankCount} received from NBS`} icon={Landmark} variant="primary" />
            </div>
          )}

          {bankAlerts.length > 0 && (
            <Card className="shadow-card border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-primary" /> New bank payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bankAlerts.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm">
                    <Badge>{a.what}</Badge>
                    <span className="font-medium">{a.who}</span>
                    <span className="font-semibold">${a.amount.toFixed(2)}</span>
                    {a.receipt && <span className="text-muted-foreground text-xs">Receipt {a.receipt}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(a.at).toLocaleTimeString("en-GB")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fee Collection by Form</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {barData.some(d => d.collected > 0 || d.outstanding > 0) ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No fee data yet. Register students and record payments to see analytics.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-3 h-3 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {d.name} ({d.value}%)
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                    No payments recorded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentPayments.length > 0 ? (
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
                    {recentPayments.map((p, i) => (
                      <TableRow key={i}>
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
              ) : (
                <p className="p-6 text-center text-muted-foreground text-sm">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
  );
};

export default AdminDashboard;
