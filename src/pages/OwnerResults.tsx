import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, FileDown, GraduationCap, TrendingUp, Users, Award, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { buildClassAnalytics, isPass, RawMark, ClassAnalytics } from "@/lib/examAnalytics";
import { generateResultsPDF, ResultsSection } from "@/lib/generateResultsReport";
import { formatClass } from "@/lib/normalize";
import { toast } from "sonner";

interface Prof {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  form: string | null;
  stream: string | null;
}

const classKey = (form?: string | null, stream?: string | null) => `${form || "—"}|${stream || "—"}`;

const OwnerResults = () => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [marks, setMarks] = useState<RawMark[]>([]);
  const [term, setTerm] = useState("all");
  const [examType, setExamType] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: profs }, { data: mk }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, registration_number, form, stream").order("last_name"),
        supabase.from("exam_marks" as any).select("*"),
      ]);
      setProfiles((profs || []) as Prof[]);
      setMarks(((mk || []) as unknown as RawMark[]));
    } finally {
      setLoading(false);
    }
  };

  const terms = useMemo(() => [...new Set(marks.map(m => m.term))].sort(), [marks]);
  const examTypes = useMemo(() => [...new Set(marks.map(m => m.exam_type))].sort(), [marks]);

  const filteredMarks = useMemo(
    () => marks.filter(m => (term === "all" || m.term === term) && (examType === "all" || m.exam_type === examType)),
    [marks, term, examType]
  );

  const classes = useMemo(() => {
    const map = new Map<string, { key: string; label: string; students: Prof[] }>();
    for (const p of profiles) {
      if (!p.form) continue;
      const k = classKey(p.form, p.stream);
      if (!map.has(k)) map.set(k, { key: k, label: formatClass(p), students: [] });
      map.get(k)!.students.push(p);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [profiles]);

  const analyticsFor = (key: string): ClassAnalytics => {
    const cls = classes.find(c => c.key === key);
    const ids = new Set((cls?.students || []).map(s => s.id));
    return buildClassAnalytics(filteredMarks.filter(m => ids.has(m.student_profile_id)), cls?.students || []);
  };

  const overview = useMemo(
    () => classes.map(c => ({ ...c, a: analyticsFor(c.key) })),
    [classes, filteredMarks]
  );

  const school = useMemo(() => {
    const withMarks = overview.filter(o => o.a.entered > 0);
    const avg = withMarks.length ? Math.round(withMarks.reduce((s, o) => s + o.a.classAverage, 0) / withMarks.length) : 0;
    const pass = withMarks.reduce((s, o) => s + o.a.passCount, 0);
    const fail = withMarks.reduce((s, o) => s + o.a.failCount, 0);
    return { avg, pass, fail, rate: pass + fail ? Math.round((pass / (pass + fail)) * 100) : 0, entered: pass + fail };
  }, [overview]);

  const sectionFor = (key: string): ResultsSection => ({
    className: classes.find(c => c.key === key)?.label || "Class",
    term: term === "all" ? "All Terms" : term,
    examType: examType === "all" ? "All Exams" : examType,
    analytics: analyticsFor(key),
  });

  const downloadAll = () => {
    const sections = overview.filter(o => o.a.entered > 0).map(o => sectionFor(o.key));
    if (sections.length === 0) { toast.error("No recorded results to export yet"); return; }
    generateResultsPDF(sections, "Exam Results Analysis");
    toast.success("Full results analysis downloaded");
  };

  const downloadOne = (key: string) => {
    const s = sectionFor(key);
    if (s.analytics.entered === 0) { toast.error("No recorded results for this class"); return; }
    generateResultsPDF([s], `Results ${s.className}`);
    toast.success(`${s.className} results downloaded`);
  };

  const current = selected ? analyticsFor(selected) : null;
  const currentLabel = selected ? classes.find(c => c.key === selected)?.label : "";

  return (
    <DashboardLayout role="owner">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" /> Results Per Class
            </h2>
            <p className="text-sm text-muted-foreground">
              Click a class to see every learner's result, with statistics and graphs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {examTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={downloadAll} className="gap-2">
              <FileDown size={16} /> Download All Results PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : !selected ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Classes" value={String(classes.length)} subtitle="With registered learners" icon={Users} variant="primary" />
              <StatCard title="Results Entered" value={String(school.entered)} subtitle="Learners graded" icon={Award} variant="accent" />
              <StatCard title="School Average" value={`${school.avg}%`} subtitle="Mean of class averages" icon={TrendingUp} variant="success" />
              <StatCard title="Pass Rate" value={`${school.rate}%`} subtitle="Grade C and above" icon={GraduationCap} variant={school.rate >= 50 ? "success" : "warning"} />
            </div>

            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Class Averages</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  {overview.some(o => o.a.entered > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.map(o => ({ name: o.label, average: o.a.classAverage }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number) => [`${v}%`, "Average"]} />
                        <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                          {overview.map((o, i) => (
                            <Cell key={i} fill={o.a.classAverage >= 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      No exam marks recorded yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {overview.map(o => (
                <Card
                  key={o.key}
                  className="shadow-card hover:shadow-card-hover transition-all cursor-pointer hover:-translate-y-0.5"
                  onClick={() => setSelected(o.key)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{o.label}</p>
                      <ChevronRight size={18} className="text-muted-foreground" />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{o.students.length} learners</Badge>
                      <Badge variant="secondary">{o.a.entered} graded</Badge>
                      {o.a.entered > 0 && (
                        <Badge className={o.a.passRate >= 50 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {o.a.passRate}% pass
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Average: <span className="font-semibold text-foreground">{o.a.entered ? `${o.a.classAverage}%` : "—"}</span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setSelected(null)}>
                <ArrowLeft size={16} /> All Classes
              </Button>
              <Button className="gap-2" onClick={() => downloadOne(selected)}>
                <FileDown size={16} /> Download {currentLabel} PDF
              </Button>
            </div>

            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">{currentLabel} — Statistical Overview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {current.entered} of {current.students.length} learners have recorded marks across {current.subjectNames.length} subject(s).
                  The class average is <span className="font-semibold text-foreground">{current.classAverage}%</span> with a pass rate of{" "}
                  <span className="font-semibold text-foreground">{current.passRate}%</span> (grade C or better).
                  {current.best && <> Top learner: <span className="font-semibold text-foreground">{current.best.name} ({current.best.average}%)</span>.</>}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Learners" value={String(current.students.length)} subtitle={`${current.entered} graded`} icon={Users} variant="primary" />
                  <StatCard title="Class Average" value={`${current.classAverage}%`} subtitle="All subjects" icon={TrendingUp} variant="accent" />
                  <StatCard title="Pass Rate" value={`${current.passRate}%`} subtitle="Grade C and above" icon={GraduationCap} variant={current.passRate >= 50 ? "success" : "warning"} />
                  <StatCard title="Passes / Fails" value={`${current.passCount} / ${current.failCount}`} subtitle="Learners" icon={Award} variant="success" />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-base">Grade Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={current.gradeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {current.gradeDistribution.map((g, i) => (
                            <Cell key={i} fill={isPass(g.name) ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-base">Subject Averages</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    {current.subjectAverages.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={current.subjectAverages} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" domain={[0, 100]} fontSize={12} tickFormatter={v => `${v}%`} />
                          <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                          <Tooltip formatter={(v: number) => [`${v}%`, "Average"]} />
                          <Bar dataKey="average" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        No marks recorded for this class.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Results Per Student</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Pos</TableHead>
                      <TableHead>Reg No.</TableHead>
                      <TableHead>Student</TableHead>
                      {current.subjectNames.map(n => <TableHead key={n}>{n}</TableHead>)}
                      <TableHead>Total</TableHead>
                      <TableHead>Avg</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.students.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{s.position || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.reg}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        {current.subjectNames.map(n => (
                          <TableCell key={n} className={typeof s.subjects[n] === "number" && s.subjects[n] < 50 ? "text-destructive" : ""}>
                            {typeof s.subjects[n] === "number" ? `${s.subjects[n]}%` : "—"}
                          </TableCell>
                        ))}
                        <TableCell>{s.count ? s.total : "—"}</TableCell>
                        <TableCell>{s.count ? `${s.average}%` : "—"}</TableCell>
                        <TableCell>
                          {s.grade === "—" ? "—" : (
                            <Badge className={isPass(s.grade) ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}>
                              {s.grade}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default OwnerResults;
