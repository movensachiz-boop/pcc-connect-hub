import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTimetable } from "@/context/TimetableContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySubjects, setMySubjects,
  getMyClasses, setMyClasses,
  findAdminTeacher,
} from "@/lib/teacherSubjects";
import { Info, Lock, Save } from "lucide-react";
import { toast } from "sonner";

export default function TeacherMySubjects() {
  const { subjects, teachers, classes } = useTimetable();
  const [userId, setUserId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [selSubjects, setSelSubjects] = useState<string[]>([]);
  const [selClasses, setSelClasses] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setSelSubjects(getMySubjects(user.id));
      setSelClasses(getMyClasses(user.id));
      const { data: p } = await supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
      if (p) setFullName(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    })();
  }, []);

  const adminTeacher = findAdminTeacher(teachers, fullName);
  const subjectsLocked = !!(adminTeacher && adminTeacher.subjectIds.length > 0);
  const adminClassIds = useMemo(() => {
    if (!adminTeacher) return [];
    const s = new Set<string>();
    adminTeacher.assignments?.forEach(a => a.classIds.forEach(c => s.add(c)));
    return [...s];
  }, [adminTeacher]);
  const classesLocked = adminClassIds.length > 0;

  const toggleSubject = (id: string) => {
    if (subjectsLocked) return;
    setSelSubjects(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };
  const toggleClass = (id: string) => {
    if (classesLocked) return;
    setSelClasses(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const save = () => {
    if (!subjectsLocked) setMySubjects(userId, selSubjects);
    if (!classesLocked) setMyClasses(userId, selClasses);
    toast.success("Your teaching profile has been saved");
  };

  const displaySubjects = subjectsLocked ? adminTeacher!.subjectIds : selSubjects;
  const displayClasses = classesLocked ? adminClassIds : selClasses;

  // Group classes by form
  const classesByForm = useMemo(() => {
    const map: Record<number, typeof classes> = {};
    classes.forEach(c => { (map[c.form] ||= []).push(c); });
    return map;
  }, [classes]);

  const bothLocked = subjectsLocked && classesLocked;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Teaching Profile</h2>
          <p className="text-sm text-muted-foreground">
            Choose the subjects and classes you teach. Only these appear when recording exam marks.
          </p>
        </div>

        {bothLocked ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Set by Administration</p>
                <p className="text-muted-foreground">
                  Your subjects and classes have been allocated by the school administration and cannot be changed here.
                  Contact admin if a correction is needed.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="pt-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-accent-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                Pick the subjects and classes you teach below. If admin later assigns you, their allocation will take priority.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subjects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {subjectsLocked ? "Allocated Subjects" : "Select Your Subjects"}
              {subjectsLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              {displaySubjects.length > 0 && <span className="text-xs text-muted-foreground font-normal">({displaySubjects.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects available yet.</p>
            ) : subjectsLocked ? (
              <div className="flex flex-wrap gap-2">
                {displaySubjects.map(id => {
                  const s = subjects.find(x => x.id === id);
                  return s ? <Badge key={id} className="text-sm px-3 py-1">{s.code} — {s.name}</Badge> : null;
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => {
                  const on = selSubjects.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSubject(s.id)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                      {s.code} — {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Classes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {classesLocked ? "Allocated Classes" : "Select Your Classes"}
              {classesLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              {displayClasses.length > 0 && <span className="text-xs text-muted-foreground font-normal">({displayClasses.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes configured yet.</p>
            ) : classesLocked ? (
              <div className="flex flex-wrap gap-2">
                {displayClasses.map(id => {
                  const c = classes.find(x => x.id === id);
                  return c ? <Badge key={id} className="text-sm px-3 py-1">Form {c.form} — {c.stream}</Badge> : null;
                })}
              </div>
            ) : (
              Object.keys(classesByForm).sort().map(fLevel => (
                <div key={fLevel}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Form {fLevel}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {classesByForm[Number(fLevel)].map(c => {
                      const on = selClasses.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleClass(c.id)}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${on ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border hover:border-accent/50"}`}>
                          {c.stream}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {!bothLocked && (
          <Button onClick={save}><Save className="w-4 h-4 mr-2" /> Save My Profile</Button>
        )}
      </div>
    </DashboardLayout>
  );
}
