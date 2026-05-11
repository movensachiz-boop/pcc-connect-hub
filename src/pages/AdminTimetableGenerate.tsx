import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useTimetable } from '@/context/TimetableContext';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminTimetableGenerate() {
  const { teachers, subjects, classes, setClasses, config, generateTimetable, timetable } = useTimetable();
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  const syncSubjectsFromTeachers = () => {
    const compulsoryIds = subjects.filter(s => s.isCompulsory).map(s => s.id);
    let updated = 0;
    const next = classes.map(c => {
      const set = new Set<string>();
      teachers.forEach(t => t.assignments.forEach(a => {
        if (a.classIds.includes(c.id) && subjects.some(s => s.id === a.subjectId)) set.add(a.subjectId);
      }));
      compulsoryIds.forEach(id => {
        const subj = subjects.find(s => s.id === id);
        if (subj && subj.forms.includes(c.form)) set.add(id);
      });
      const merged = [...new Set([...c.subjectIds, ...set])];
      const same = merged.length === c.subjectIds.length && merged.every(id => c.subjectIds.includes(id));
      if (!same) updated++;
      return same ? c : { ...c, subjectIds: merged };
    });
    setClasses(next);
    toast.success(updated === 0 ? 'All classes already in sync' : `Updated ${updated} class(es) from teacher assignments`);
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      generateTimetable();
      setGenerating(false);
    }, 1500);
  };

  const readiness = [
    { label: 'Teachers configured', ok: teachers.length > 0, count: teachers.length },
    { label: 'Subjects configured', ok: subjects.length > 0, count: subjects.length },
    { label: 'Classes configured', ok: classes.length > 0, count: classes.length },
    { label: 'School times set', ok: !!config.startTime && !!config.endTime, count: null },
  ];

  const allReady = readiness.every(r => r.ok);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Generate Timetable</h2>
          <p className="text-sm text-muted-foreground">Automatically generate clash-free timetables</p>
        </div>

        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-card rounded-xl border p-6">
            <h3 className="text-base font-semibold mb-4">Pre-Generation Checklist</h3>
            <div className="space-y-3">
              {readiness.map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {r.ok ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                    <span className="text-sm">{r.label}</span>
                  </div>
                  {r.count !== null && <span className="text-sm text-muted-foreground">{r.count}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border p-6 text-center">
            <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to Generate</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The system will create optimized timetables for all {classes.length} classes, ensuring no teacher clashes and proper break enforcement.
            </p>
            <Button onClick={syncSubjectsFromTeachers} variant="outline" size="lg" className="w-full mb-2">
              <RefreshCw className="w-4 h-4 mr-2" /> Sync Class Subjects from Teachers
            </Button>
            <Button onClick={handleGenerate} disabled={!allReady || generating} size="lg" className="w-full">
              {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Generate Timetable'}
            </Button>
          </div>

          {timetable && (
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-3">
                {timetable.conflicts.length === 0 ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-warning" />}
                <h3 className="text-base font-semibold">
                  {timetable.conflicts.length === 0 ? 'Timetable Generated Successfully!' : `Generated with ${timetable.conflicts.length} warning(s)`}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Generated at {new Date(timetable.generatedAt).toLocaleString()}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/timetable/view')}>View Timetable</Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
