import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { TimetableSlot, Subject, Teacher, SchoolClass } from '@/types/school';

interface SlotEditDialogProps {
  slot: TimetableSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  teachers: Teacher[];
  classes: SchoolClass[];
  onSave: (slotId: string, updates: Partial<TimetableSlot>) => void;
  allSlots: TimetableSlot[];
}

export default function SlotEditDialog({
  slot, open, onOpenChange, subjects, teachers, classes, onSave, allSlots,
}: SlotEditDialogProps) {
  const [subjectId, setSubjectId] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');

  useEffect(() => {
    if (slot) { setSubjectId(slot.subjectId || ''); setTeacherId(slot.teacherId || ''); }
  }, [slot]);

  const cls = classes.find(c => c.id === slot?.classId);

  const availableSubjects = useMemo(() => {
    if (!cls) return subjects;
    return subjects.filter(s => cls.subjectIds.includes(s.id));
  }, [cls, subjects]);

  const availableTeachers = useMemo(() => {
    if (!subjectId) return [];
    return teachers.filter(t => t.assignments.some(a => a.subjectId === subjectId && (!cls || a.classIds.includes(cls.id))));
  }, [subjectId, teachers, cls]);

  const conflict = useMemo(() => {
    if (!slot || !teacherId) return null;
    const clashing = allSlots.find(s => s.id !== slot.id && s.teacherId === teacherId && s.day === slot.day && s.period === slot.period);
    if (clashing) {
      const teacher = teachers.find(t => t.id === teacherId);
      const clashClass = classes.find(c => c.id === clashing.classId);
      return `${teacher?.name} is already teaching ${clashClass?.id || 'another class'} at this time`;
    }
    return null;
  }, [slot, teacherId, allSlots, teachers, classes]);

  const handleSave = () => {
    if (!slot) return;
    onSave(slot.id, { subjectId: subjectId || undefined, teacherId: teacherId || undefined });
    onOpenChange(false);
  };

  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Slot — {slot.day} Period {slot.period}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Class: <span className="font-semibold text-foreground">{slot.classId}</span></p>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setTeacherId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Free —</SelectItem>
                {availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId} disabled={!subjectId || subjectId === '__none'}>
              <SelectTrigger><SelectValue placeholder={availableTeachers.length ? 'Select teacher' : 'No teachers assigned'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {availableTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.title} {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {conflict && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{conflict}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
