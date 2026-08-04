import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTimetable } from "@/context/TimetableContext";
import { getEffectiveSubjectIds, getEffectiveClassIds } from "@/lib/teacherSubjects";
import { AlertTriangle, Save, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
}



const EXAM_TYPES = ["Mid-Term", "End-of-Term", "Mock", "Final"];
const TERMS = ["Term 1", "Term 2", "Term 3"];

const marksKey = (form: string, stream: string, subjectId: string, term: string, examType: string) =>
  `exam_marks_${form}_${stream}_${subjectId}_${term}_${examType}`;

export default function TeacherMarks() {
  const { subjects, teachers, classes } = useTimetable();
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");

  const [form, setForm] = useState("1");
  const [stream, setStream] = useState("G1");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState(TERMS[0]);
  const [examType, setExamType] = useState(EXAM_TYPES[0]);
  const [maxMark, setMaxMark] = useState(100);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
      if (p) setFullName(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    })();
  }, []);

  const effective = useMemo(() => getEffectiveSubjectIds({ userId, fullName, teachers }), [userId, fullName, teachers]);
  const effectiveClasses = useMemo(() => getEffectiveClassIds({ userId, fullName, teachers }), [userId, fullName, teachers]);
  const allowedSubjects = subjects.filter(s => effective.subjectIds.includes(s.id));
  const allowedClasses = classes.filter(c => effectiveClasses.classIds.includes(c.id));

  const allowedForms = useMemo(
    () => [...new Set(allowedClasses.map(c => String(c.form)))].sort(),
    [allowedClasses]
  );
  const streams = useMemo(
    () => allowedClasses.filter(c => String(c.form) === form).map(c => c.stream),
    [allowedClasses, form]
  );

  useEffect(() => {
    if (!subjectId && allowedSubjects.length > 0) setSubjectId(allowedSubjects[0].id);
    if (subjectId && !allowedSubjects.find(s => s.id === subjectId)) {
      setSubjectId(allowedSubjects[0]?.id || "");
    }
  }, [allowedSubjects.length]);

  useEffect(() => {
    if (allowedForms.length > 0 && !allowedForms.includes(form)) setForm(allowedForms[0]);
  }, [allowedForms.join(",")]);

  useEffect(() => {
    if (streams.length > 0 && !streams.includes(stream)) setStream(streams[0]);
  }, [form, streams.join(",")]);

  useEffect(() => { loadStudents(); }, [form, stream]);
  useEffect(() => { loadMarks(); }, [form, stream, subjectId, term, examType]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("student_roster" as any)
        .select("id, first_name, last_name, registration_number")
        .eq("form", form).eq("stream", stream).order("last_name");
      setStudents(((data || []) as unknown as StudentRow[]));
    } finally { setLoading(false); }
  };

  const loadMarks = async () => {
    if (!subjectId) { setMarks({}); return; }
    // Cloud first
    const { data } = await supabase
      .from("exam_marks" as any)
      .select("student_profile_id, mark, max_mark")
      .eq("form", form).eq("stream", stream).eq("subject_id", subjectId)
      .eq("term", term).eq("exam_type", examType);
    const rows = (data || []) as any[];
    if (rows.length > 0) {
      const m: Record<string, string> = {};
      rows.forEach(r => { m[r.student_profile_id] = String(r.mark); });
      setMarks(m);
      if (rows[0].max_mark) setMaxMark(Number(rows[0].max_mark));
      return;
    }
    // Fallback to any legacy local draft
    try {
      const raw = localStorage.getItem(marksKey(form, stream, subjectId, term, examType));
      const parsed = raw ? JSON.parse(raw) : {};
      setMarks(parsed.marks || {});
      if (parsed.maxMark) setMaxMark(parsed.maxMark);
    } catch { setMarks({}); }
  };

  const save = async () => {
    if (!subjectId) { toast.error("Pick a subject"); return; }
    for (const [, v] of Object.entries(marks)) {
      if (v === "") continue;
      const n = Number(v);
      if (isNaN(n) || n < 0 || n > maxMark) {
        toast.error(`Invalid mark for a student — must be 0..${maxMark}`);
        return;
      }
    }
    const subjectName = subjects.find(s => s.id === subjectId)?.name || subjectId;
    const rows = Object.entries(marks)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([sid, v]) => ({
        student_profile_id: sid,
        form, stream,
        subject_id: subjectId,
        subject_name: subjectName,
        term, exam_type: examType,
        mark: Number(v),
        max_mark: maxMark,
        recorded_by: userId || null,
      }));

    localStorage.setItem(
      marksKey(form, stream, subjectId, term, examType),
      JSON.stringify({ marks, maxMark, savedAt: new Date().toISOString(), by: fullName })
    );

    if (rows.length === 0) { toast.success("Marks saved"); return; }
    const { error } = await supabase
      .from("exam_marks" as any)
      .upsert(rows as any, { onConflict: "student_profile_id,subject_id,term,exam_type" });
    if (error) { toast.error("Could not sync marks: " + error.message); return; }
    toast.success("Marks saved and published to the school records");
  };


  const setMark = (id: string, v: string) => setMarks(m => ({ ...m, [id]: v }));

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" /> Record Exam Marks
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter marks only for the subjects and classes you teach.
              {effective.source === "admin" && <Badge className="ml-2" variant="secondary">Admin-allocated subjects</Badge>}
              {effective.source === "self" && <Badge className="ml-2" variant="secondary">Self-selected subjects</Badge>}
              {effectiveClasses.source === "admin" && <Badge className="ml-2" variant="secondary">Admin classes</Badge>}
              {effectiveClasses.source === "self" && <Badge className="ml-2" variant="secondary">Self classes</Badge>}
            </p>
          </div>
        </div>

        {effective.subjectIds.length === 0 || effectiveClasses.classIds.length === 0 ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Set up your teaching profile</p>
                <p className="text-muted-foreground">
                  You need at least one subject and one class assigned before recording marks.
                  Go to <span className="font-medium">My Subjects</span> to pick the subjects and classes you teach.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Session</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <div>
                  <label className="text-xs text-muted-foreground">Form</label>
                  <Select value={form} onValueChange={setForm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{allowedForms.map(f => <SelectItem key={f} value={f}>Form {f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Stream</label>
                  <Select value={stream} onValueChange={setStream}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Subject</label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
                    <SelectContent>
                      {allowedSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Term</label>
                  <Select value={term} onValueChange={setTerm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Exam Type</label>
                  <Select value={examType} onValueChange={setExamType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Mark</label>
                  <Input type="number" min={1} value={maxMark} onChange={e => setMaxMark(Number(e.target.value) || 100)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Students — {students.length}</CardTitle>
                <Button size="sm" onClick={save} disabled={!subjectId || students.length === 0}>
                  <Save className="w-4 h-4 mr-2" /> Save Marks
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <p className="p-6 text-center text-muted-foreground">Loading…</p>
                ) : students.length === 0 ? (
                  <p className="p-6 text-center text-muted-foreground">No students in Form {form} — {stream}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary">
                          <th className="text-left p-3">#</th>
                          <th className="text-left p-3">Reg No.</th>
                          <th className="text-left p-3">Name</th>
                          <th className="text-left p-3 w-40">Mark (/{maxMark})</th>
                          <th className="text-left p-3 w-20">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, i) => {
                          const v = marks[s.id] ?? "";
                          const pct = v !== "" && !isNaN(Number(v)) ? Math.round((Number(v) / maxMark) * 100) : null;
                          return (
                            <tr key={s.id} className="border-t hover:bg-muted/30">
                              <td className="p-3 text-muted-foreground">{i + 1}</td>
                              <td className="p-3 font-mono text-xs">{s.registration_number}</td>
                              <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxMark}
                                  value={v}
                                  onChange={e => setMark(s.id, e.target.value)}
                                  className="h-8"
                                  placeholder="—"
                                />
                              </td>
                              <td className="p-3">
                                {pct !== null ? <Badge variant={pct >= 50 ? "secondary" : "destructive"}>{pct}%</Badge> : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
