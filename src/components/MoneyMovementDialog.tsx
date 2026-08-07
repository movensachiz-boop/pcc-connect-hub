import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { titleCaseName } from "@/lib/normalize";
import { generateMovementVoucher } from "@/lib/generateCashReport";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const OUT_TYPES = [
  { value: "bank_transfer", label: "Bank transfer / Banking" },
  { value: "admin_collection", label: "Cash collected by Admin" },
  { value: "purchase", label: "Purchase / Expense" },
  { value: "disbursement", label: "Other disbursement" },
];
const IN_TYPE = { value: "cash_in", label: "Cash injection (top-up)" };

const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyMovementDialog({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"in" | "out" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ movement_type: "bank_transfer", amount: "", recipient: "", reason: "", reference: "" });

  const open = (k: "in" | "out") => {
    setForm({ movement_type: k === "in" ? IN_TYPE.value : "bank_transfer", amount: "", recipient: "", reason: "", reference: "" });
    setKind(k);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const label = titleCaseName((user?.email || "cashier").split("@")[0].replace(/[._-]+/g, " "));
    const date = today();

    const { data: sess } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("cashier_user_id", user?.id ?? "")
      .eq("business_date", date)
      .eq("status", "open")
      .maybeSingle();

    const row = {
      session_id: sess?.id ?? null,
      cashier_user_id: user?.id ?? null,
      cashier_name: label,
      business_date: date,
      movement_type: form.movement_type,
      amount,
      recipient: form.recipient || null,
      reason: form.reason || null,
      reference: form.reference || null,
    };
    const res = await saveOrQueue("cash_movements", row, `${form.movement_type} $${amount}`);
    setSaving(false);
    if (res.error) return toast({ title: "Could not record", description: res.error.message, variant: "destructive" });

    const data = (res.data ?? {
      id: `local-${Date.now()}`,
      reference: form.reference || null,
      occurred_at: new Date().toISOString(),
      business_date: date,
    }) as { id: string; reference: string | null; occurred_at: string; business_date: string };

    setKind(null);
    toast({
      title: res.queued ? "Saved on this device" : "Recorded",
      description: res.queued
        ? "No internet — it will upload to the cloud automatically once you're back online."
        : "Receipt sent to the printer.",
    });
    const out = form.movement_type !== "cash_in";
    const typeLabel = out ? (OUT_TYPES.find(t => t.value === form.movement_type)?.label || form.movement_type) : IN_TYPE.label;
    await generateMovementVoucher({
      voucherNo: (data.reference || data.id).slice(0, 12).toUpperCase(),
      kind: out ? "out" : "in",
      typeLabel,
      amount,
      dateTime: new Date(data.occurred_at).toLocaleString(),
      businessDate: data.business_date,
      issuedBy: out ? label : (form.recipient || "—"),
      receivedBy: out ? (form.recipient || "—") : label,
      reason: form.reason || null,
      reference: form.reference || null,
    });

    onSaved?.();
  };

  const isIn = kind === "in";

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => open("in")}>
        <ArrowDownCircle size={16} /> Money In
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => open("out")}>
        <ArrowUpCircle size={16} /> Money Out
      </Button>

      <Dialog open={kind !== null} onOpenChange={o => !o && setKind(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isIn ? "Record money in" : "Record money out"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!isIn && (
              <div>
                <Label>Type</Label>
                <Select value={form.movement_type} onValueChange={v => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>{isIn ? "Received from (payer / source)" : "Paid to / Collected by / Bank"}</Label>
              <Input
                value={form.recipient}
                onChange={e => setForm({ ...form, recipient: e.target.value })}
                placeholder={isIn ? "e.g. Mrs Ncube (Admin float)" : "e.g. Mr Moyo (Admin) or CBZ Bank"}
              />
            </div>
            <div>
              <Label>Reason / Description</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save & print receipt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
