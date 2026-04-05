import { useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useTimetable } from '@/context/TimetableContext';
import { DAYS } from '@/data/defaults';
import { DayOfWeek } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Calendar, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminMasterTimetable() {
  const { timetable, classes, subjects, teachers, config } = useTimetable();

  const totalSlots = config.periodsPerDay + 2;
  const periods = Array.from({ length: totalSlots }, (_, i) => i + 1);

  const sortedClasses = useMemo(() =>
    [...classes].sort((a, b) => a.form - b.form || a.stream.localeCompare(b.stream)),
    [classes]
  );

  const getPeriodLabel = (period: number): string => {
    const breakSlot = config.morningBreakAfterPeriod + 1;
    const lunchSlot = config.lunchAfterPeriod + 2;
    if (period === breakSlot) return 'BREAK';
    if (period === lunchSlot) return 'LUNCH';
    return `P${period <= breakSlot ? period : period <= lunchSlot ? period - 1 : period - 2}`;
  };

  const getPeriodTime = (period: number): string => {
    const breakSlot = config.morningBreakAfterPeriod + 1;
    const lunchSlot = config.lunchAfterPeriod + 2;
    const [startH, startM] = config.startTime.split(':').map(Number);
    let minutes = startH * 60 + startM;
    for (let p = 1; p < period; p++) {
      if (p === breakSlot) minutes += config.morningBreakDuration;
      else if (p === lunchSlot) minutes += config.lunchDuration;
      else minutes += config.periodDuration;
    }
    const durMin = period === breakSlot ? config.morningBreakDuration : period === lunchSlot ? config.lunchDuration : config.periodDuration;
    const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return `${fmt(minutes)}–${fmt(minutes + durMin)}`;
  };

  const getSlotContent = (classId: string, day: DayOfWeek, period: number) => {
    if (!timetable) return '';
    const slot = timetable.slots.find(s => s.classId === classId && s.day === day && s.period === period);
    if (!slot) return '';
    if (slot.type === 'break') return 'BREAK';
    if (slot.type === 'lunch') return 'LUNCH';
    if (slot.type === 'sports') return 'SPORTS';
    const subject = subjects.find(s => s.id === slot.subjectId);
    const teacher = teachers.find(t => t.id === slot.teacherId);
    if (!subject) return '—';
    return `${subject.code}${teacher ? `\n${teacher.name.split(' ').pop()}` : ''}`;
  };

  const getSlotStyle = (classId: string, day: DayOfWeek, period: number) => {
    if (!timetable) return '';
    const slot = timetable.slots.find(s => s.classId === classId && s.day === day && s.period === period);
    if (!slot) return '';
    if (slot.type === 'break' || slot.type === 'lunch') return 'bg-warning/20 text-warning-foreground';
    if (slot.type === 'sports') return 'bg-success/20 text-success';
    if (slot.subjectId) return 'bg-primary/10 text-primary';
    return 'bg-muted text-muted-foreground';
  };

  const handlePrintPDF = () => {
    if (!timetable) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102);
    doc.text(config.schoolName, doc.internal.pageSize.width / 2, 15, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(51, 51, 51);
    doc.text('Master Timetable', doc.internal.pageSize.width / 2, 23, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width / 2, 28, { align: 'center' });

    // One table per day
    let startY = 34;
    for (const day of DAYS) {
      doc.setFontSize(11);
      doc.setTextColor(0, 51, 102);
      doc.text(day, 14, startY);
      startY += 2;

      const headers = ['Period / Time', ...sortedClasses.map(c => `${c.form}${c.stream}`)];
      const rows = periods.map(period => {
        const label = `${getPeriodLabel(period)}\n${getPeriodTime(period)}`;
        return [label, ...sortedClasses.map(c => {
          const slot = timetable.slots.find(s => s.classId === c.id && s.day === day && s.period === period);
          if (!slot) return '';
          if (slot.type === 'break') return 'BREAK';
          if (slot.type === 'lunch') return 'LUNCH';
          if (slot.type === 'sports') return 'SPORTS';
          const sub = subjects.find(s => s.id === slot.subjectId);
          return sub?.code || '—';
        })];
      });

      autoTable(doc, {
        startY,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 6, cellPadding: 1.5 },
        bodyStyles: { fontSize: 6, cellPadding: 1.5, halign: 'center', textColor: [51, 51, 51] },
        columnStyles: { 0: { halign: 'left', cellWidth: 28 } },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
      if (startY > doc.internal.pageSize.height - 30 && day !== DAYS[DAYS.length - 1]) {
        doc.addPage();
        startY = 15;
      }
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(128, 128, 128);
      doc.text(`${config.schoolName} · Master Timetable · Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
    }

    doc.save('master_timetable.pdf');
  };

  if (!timetable) {
    return (
      <DashboardLayout role="admin">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Master Timetable</h2>
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Calendar className="w-16 h-16 mb-4 opacity-30" />
            <p>No timetable generated yet</p>
            <p className="text-xs mt-1">Go to Timetable → Generate to create one</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Master Timetable</h2>
            <p className="text-sm text-muted-foreground">All classes · All days</p>
          </div>
          <Button onClick={handlePrintPDF} className="gap-1.5">
            <FileDown className="w-4 h-4" /> Download PDF
          </Button>
        </div>

        {DAYS.map(day => (
          <div key={day} className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{day}</h3>
            <div className="bg-card rounded-xl border overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-[10px] font-semibold text-muted-foreground border-b w-24">Period</th>
                    {sortedClasses.map(c => (
                      <th key={c.id} className="p-2 text-[10px] font-semibold text-muted-foreground border-b text-center">{c.form}{c.stream}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => (
                    <tr key={period}>
                      <td className="p-1.5 text-[9px] text-muted-foreground font-medium border-b whitespace-nowrap leading-tight">
                        <div>{getPeriodLabel(period)}</div>
                        <div className="text-[8px]">{getPeriodTime(period)}</div>
                      </td>
                      {sortedClasses.map(c => {
                        const content = getSlotContent(c.id, day, period);
                        const style = getSlotStyle(c.id, day, period);
                        return (
                          <td key={c.id} className="p-1 border-b">
                            <div className={`rounded px-1 py-0.5 text-center text-[9px] font-medium leading-tight min-h-[28px] flex items-center justify-center ${style}`}>
                              <span className="whitespace-pre-line">{content}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
