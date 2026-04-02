import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const timetable = [
  { time: "08:00 - 09:00", mon: "Mathematics", tue: "English", wed: "Physics", thu: "Chemistry", fri: "Biology" },
  { time: "09:00 - 10:00", mon: "English", tue: "Mathematics", wed: "Chemistry", thu: "Physics", fri: "History" },
  { time: "10:30 - 11:30", mon: "Physics", tue: "Biology", wed: "Mathematics", thu: "English", fri: "Geography" },
  { time: "11:30 - 12:30", mon: "Chemistry", tue: "Geography", wed: "English", thu: "Mathematics", fri: "Physics" },
  { time: "14:00 - 15:00", mon: "Biology", tue: "History", wed: "Geography", thu: "CRE", fri: "Mathematics" },
  { time: "15:00 - 16:00", mon: "Games", tue: "Clubs", wed: "Games", thu: "Library", fri: "Games" },
];

const days = ["mon", "tue", "wed", "thu", "fri"] as const;
const dayLabels = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

const subjectColor = (s: string) => {
  if (["Mathematics", "Physics", "Chemistry"].includes(s)) return "bg-primary/10 text-primary";
  if (["English", "History", "Geography", "CRE"].includes(s)) return "bg-accent/20 text-accent-foreground";
  if (["Biology"].includes(s)) return "bg-success/10 text-success";
  return "bg-secondary text-secondary-foreground";
};

const StudentTimetable = () => (
  <DashboardLayout role="student">
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">My Timetable</h2>
      <Card className="shadow-card overflow-x-auto">
        <CardHeader className="pb-2"><CardTitle className="text-base">Form 4 – Science Stream</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="text-left p-3 font-semibold text-foreground">Time</th>
                {days.map(d => <th key={d} className="text-left p-3 font-semibold text-foreground">{dayLabels[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {timetable.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium text-muted-foreground whitespace-nowrap">{row.time}</td>
                  {days.map(d => (
                    <td key={d} className="p-3">
                      <Badge variant="secondary" className={subjectColor(row[d])}>{row[d]}</Badge>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default StudentTimetable;
