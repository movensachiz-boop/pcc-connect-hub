import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Loader2 } from "lucide-react";

interface Term {
  id: string;
  name: string;
  year: number;
  term_number: number;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

const TermManagerCard = () => {
  const { toast } = useToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [termNumber, setTermNumber] = useState("1");
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 10));

  const current = terms.find((t) => t.is_current) || null;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("academic_terms")
      .select("*")
      .order("start_date", { ascending: false });
    const list = (data || []) as Term[];
    setTerms(list);
    const cur = list.find((t) => t.is_current);
    if (cur) {
      const next = cur.term_number >= 3 ? 1 : cur.term_number + 1;
      setTermNumber(String(next));
      setYear(String(next === 1 ? cur.year + 1 : cur.year));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startTerm = async () => {
    setStarting(true);
    try {
      const name = `Term ${termNumber} ${year}`;
      const { error } = await supabase.rpc("start_new_term", {
        _name: name,
        _year: Number(year),
        _term_number: Number(termNumber),
        _start_date: startDate,
      });
      if (error) throw error;
      toast({
        title: "New term started",
        description: `${name} is now active. Fee balances have been reset — all students start owing this term's fees. Student records are unchanged.`,
      });
      setConfirmOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Could not start term", description: e.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="shadow-card max-w-lg border-l-4 border-l-accent">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock size={18} className="text-accent" />
          Academic Term
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Starting a new term resets fee recording: previous payments stay on record but every student begins the new term owing their full fees. No student information is changed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Loading terms...
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current term:</span>
              <Badge className="bg-primary text-primary-foreground">
                {current ? current.name : "None"}
              </Badge>
              {current && (
                <span className="text-xs text-muted-foreground">
                  since {new Date(current.start_date).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Term</Label>
                <Input type="number" min={1} max={3} value={termNumber} onChange={(e) => setTermNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>

            <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={starting}>
              {starting ? <Loader2 className="animate-spin mr-2" size={16} /> : <CalendarClock className="mr-2" size={16} />}
              Start Term {termNumber} {year}
            </Button>

            {terms.length > 1 && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Past terms</p>
                {terms.filter((t) => !t.is_current).map((t) => (
                  <div key={t.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{t.name}</span>
                    <span>
                      {new Date(t.start_date).toLocaleDateString()}
                      {t.end_date ? ` – ${new Date(t.end_date).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Term {termNumber} {year}?</AlertDialogTitle>
            <AlertDialogDescription>
              All fee balances reset for the new term — every student will show as owing their full fees until they pay again.
              Existing payments and all student information are kept exactly as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); startTerm(); }} disabled={starting}>
              {starting ? "Starting..." : "Yes, start new term"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default TermManagerCard;
