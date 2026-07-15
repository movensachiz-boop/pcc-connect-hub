import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTimetable } from "@/context/TimetableContext";
import { supabase } from "@/integrations/supabase/client";
import { getMySubjects, setMySubjects, findAdminTeacher } from "@/lib/teacherSubjects";
import { Info, Lock, Save } from "lucide-react";
import { toast } from "sonner";

export default function TeacherMySubjects() {
  const { subjects, teachers } = useTimetable();
  const [userId, setUserId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setSelected(getMySubjects(user.id));
      const { data: p } = await supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
      if (p) setFullName(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    })();
  }, []);

  const adminTeacher = findAdminTeacher(teachers, fullName);
  const adminLocked = !!(adminTeacher && adminTeacher.subjectIds.length > 0);

  const toggle = (id: string) => {
    if (adminLocked) return;
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const save = () => {
    if (adminLocked) return;
    setMySubjects(userId, selected);
    toast.success("Your subjects have been saved");
  };

  const displayIds = adminLocked ? adminTeacher!.subjectIds : selected;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Subjects</h2>
          <p className="text-sm text-muted-foreground">
            Choose the subjects you teach. Only these subjects appear when recording exam marks.
          </p>
        </div>

        {adminLocked ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Set by Administration</p>
                <p className="text-muted-foreground">
                  Your subjects have been allocated by the school administration and cannot be changed here.
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
                Administration hasn't allocated subjects to your account yet — please select the subjects you teach below.
                If admin later assigns subjects, their allocation will take priority.
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {adminLocked ? "Allocated Subjects" : "Select Your Subjects"}
              {displayIds.length > 0 && <span className="ml-2 text-xs text-muted-foreground">({displayIds.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects available yet.</p>
            ) : adminLocked ? (
              <div className="flex flex-wrap gap-2">
                {displayIds.map(id => {
                  const s = subjects.find(x => x.id === id);
                  return s ? <Badge key={id} className="text-sm px-3 py-1">{s.code} — {s.name}</Badge> : null;
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => {
                  const on = selected.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}
                    >
                      {s.code} — {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {!adminLocked && (
          <Button onClick={save}><Save className="w-4 h-4 mr-2" /> Save My Subjects</Button>
        )}
      </div>
    </DashboardLayout>
  );
}
