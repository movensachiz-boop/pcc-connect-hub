import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Landmark, Printer, FileText } from "lucide-react";
import { generateReceipt, generateThermalReceipt } from "@/lib/generateReceipt";
import { generateInventoryReceipt, generateInventoryThermalReceipt } from "@/lib/generateInventoryReceipt";
import { supabase } from "@/integrations/supabase/client";
import { buildBankCollections, matchesBankCollection, type BankCollection } from "@/lib/bankTransactions";

/**
 * Dashboard list of transactions received straight from the bank (NBS).
 * Bank-only: fee payments and uniform/trip sales posted via the bank API.
 */
const DashboardBankTransactions = () => {
  const [collections, setCollections] = useState<BankCollection[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: feeRows, error: feeError }, { data: invRows, error: invError }] = await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, currency, receipt_number, bank_name, status, description, paynow_reference, verification_hash, created_at, profiles:student_profile_id (first_name, last_name, registration_number, form, stream)")
        .eq("bank_name", "National Building Society")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_sales")
        .select("id, total_amount, currency, receipt_number, status, notes, items, created_at, profiles:student_profile_id (first_name, last_name, registration_number, form, stream)")
        .ilike("notes", "NBS %")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setError(!!feeError || !!invError);
    if (!feeError && !invError) setCollections(buildBankCollections(feeRows || [], invRows || []));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("dashboard-bank-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_sales" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const printRow = async (c: BankCollection, kind: "a4" | "thermal") => {
    const receiptNo = c.receipt || c.id;
    const date = new Date(c.created_at).toLocaleDateString("en-GB");
    if (c.category === "Uniforms" || c.category === "Trip") {
      const items = c.items?.length ? c.items : [{ name: c.category, quantity: 1, unit_price: c.amount, subtotal: c.amount }];
      const data = { receiptNo, studentName: c.student, regNo: c.registration || "—", studentClass: c.className, date, method: "Bank (NBS)", items, total: c.amount, currency: c.currency };
      if (kind === "thermal") await generateInventoryThermalReceipt(data);
      else await generateInventoryReceipt(data);
      return;
    }
    const data = { receiptNo, studentName: c.student, regNo: c.registration || "N/A", studentClass: c.className, date, amount: `$${c.amount.toFixed(2)}`, method: "Bank (NBS)", description: c.description || `${c.category} — bank ref ${c.reference || ""}`, verificationHash: c.verificationHash || undefined };
    if (kind === "thermal") await generateThermalReceipt(data, "print");
    else await generateReceipt(data);
  };

  const visible = collections.filter(row => matchesBankCollection(row, search, category));
  const total = collections.reduce((s, c) => s + c.amount, 0);

  return (
    <Card className="shadow-card border-primary/40">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-primary" /> Bank transactions (NBS)
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">${total.toFixed(2)} received</span>
          <Button size="icon" variant="ghost" onClick={load} aria-label="Refresh bank transactions">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(["Tuition", "Levy", "Uniforms", "Trip"] as const).map(cat => {
            const rows = collections.filter(c => c.category === cat);
            return (
              <div key={cat} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground">{cat}</p>
                <p className="text-base font-bold">${rows.reduce((s, c) => s + c.amount, 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{rows.length} payment{rows.length === 1 ? "" : "s"}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Search bank transactions"
            placeholder="Student name, registration number, bank reference or receipt"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sm:flex-1"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Bank transaction category" className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {["Tuition", "Levy", "Uniforms", "Trip"].map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          {visible.length} bank transaction{visible.length === 1 ? "" : "s"} · Latest 200 fee and 200 inventory transactions
        </p>

        {error ? (
          <p role="alert" className="text-sm text-destructive">Bank transactions could not be loaded. Please refresh.</p>
        ) : loading && collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading bank transactions…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {collections.length ? "No bank transactions match this search." : "No NBS bank transactions recorded yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Student name</th>
                  <th className="py-2 pr-3 font-medium">Registration number</th>
                  <th className="py-2 pr-3 font-medium">Class</th>
                  <th className="py-2 pr-3 font-medium">Paid for</th>
                  <th className="py-2 pr-3 font-medium">Bank reference</th>
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 text-right font-medium">Print</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.created_at).toLocaleString("en-GB")}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.student}</span>
                      {c.payer && <div className="text-muted-foreground">Payer: {c.payer}</div>}
                    </td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{c.registration || "Not linked"}</td>
                    <td className="py-2 pr-3">{c.className || "—"}</td>
                    <td className="py-2 pr-3"><Badge variant="secondary">{c.category}</Badge></td>
                    <td className="py-2 pr-3">{c.reference || "—"}</td>
                    <td className="py-2 pr-3">{c.receipt || "—"}</td>
                    <td className="py-2 pr-3 capitalize">{c.status}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{c.currency === "USD" ? "$" : `${c.currency} `}{c.amount.toFixed(2)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" title="A4 receipt" aria-label="Print A4 receipt" onClick={() => void printRow(c, "a4")}><FileText className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Thermal 80mm receipt" aria-label="Print thermal receipt" onClick={() => void printRow(c, "thermal")}><Printer className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardBankTransactions;
