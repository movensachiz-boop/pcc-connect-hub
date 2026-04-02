import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useTimetable } from '@/context/TimetableContext';
import { Subject, FormLevel, LearningArea } from '@/types/school';
import { v4 } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';

export default function AdminSubjects() {
  const { subjects, setSubjects } = useTimetable();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', forms: [] as FormLevel[], learningAreas: [] as LearningArea[],
    periodsPerWeek: 4, isCompulsory: false,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', forms: [], learningAreas: [], periodsPerWeek: 4, isCompulsory: false });
    setDialogOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code, forms: [...s.forms], learningAreas: s.learningAreas ? [...s.learningAreas] : [], periodsPerWeek: s.periodsPerWeek, isCompulsory: s.isCompulsory });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name || !form.code) return;
    const subjectData: Subject = {
      id: editing?.id || v4(), name: form.name, code: form.code, forms: form.forms,
      learningAreas: form.learningAreas.length > 0 ? form.learningAreas : undefined,
      periodsPerWeek: form.periodsPerWeek, isCompulsory: form.isCompulsory,
    };
    if (editing) {
      setSubjects(subjects.map(s => s.id === editing.id ? subjectData : s));
    } else {
      setSubjects([...subjects, subjectData]);
    }
    setDialogOpen(false);
  };

  const toggleForm = (fl: FormLevel) => {
    setForm(f => ({ ...f, forms: f.forms.includes(fl) ? f.forms.filter(x => x !== fl) : [...f.forms, fl] }));
  };

  const toggleArea = (a: LearningArea) => {
    setForm(f => ({ ...f, learningAreas: f.learningAreas.includes(a) ? f.learningAreas.filter(x => x !== a) : [...f.learningAreas, a] }));
  };

  const lower = subjects.filter(s => s.forms.some(f => f <= 4));
  const upper = subjects.filter(s => s.forms.some(f => f >= 5));

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
            <p className="text-sm text-muted-foreground">ZIMSEC-aligned subject management</p>
          </div>
          <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Subject</Button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">O-Level (Form 1–4)</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lower.map(s => (
                <div key={s.id} className="bg-card rounded-xl border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.code} · {s.periodsPerWeek}/wk {s.isCompulsory && '· Core'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">A-Level (Form 5–6)</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {upper.map(s => (
                <div key={s.id} className="bg-card rounded-xl border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center">
                      <BookOpen className="w-3.5 h-3.5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.code} · {s.periodsPerWeek}/wk · {s.learningAreas?.join(', ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit Subject' : 'Add Subject'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Code</label>
                  <Input className="mt-1" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Periods/Week</label>
                  <Input type="number" className="mt-1" value={form.periodsPerWeek} onChange={e => setForm(f => ({ ...f, periodsPerWeek: Number(e.target.value) }))} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.isCompulsory} onChange={e => setForm(f => ({ ...f, isCompulsory: e.target.checked }))} className="rounded" />
                    Compulsory
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Forms</label>
                <div className="flex gap-1.5">
                  {([1,2,3,4,5,6] as FormLevel[]).map(fl => (
                    <button key={fl} onClick={() => toggleForm(fl)}
                      className={`w-10 h-10 text-sm rounded-md border transition-colors ${form.forms.includes(fl) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                    >{fl}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Learning Areas (A-Level)</label>
                <div className="flex gap-1.5">
                  {(['Sciences','Commercials','Arts'] as LearningArea[]).map(a => (
                    <button key={a} onClick={() => toggleArea(a)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${form.learningAreas.includes(a) ? 'bg-accent text-accent-foreground border-accent' : 'bg-muted text-muted-foreground border-border'}`}
                    >{a}</button>
                  ))}
                </div>
              </div>
              <Button onClick={save} className="w-full">{editing ? 'Update' : 'Add'} Subject</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
