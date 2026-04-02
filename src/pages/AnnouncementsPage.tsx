import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const announcements = [
  { title: "Term 2 Exam Timetable Released", body: "The exam timetable for Term 2 has been posted. Please check your student portal.", date: "Mar 28, 2025", priority: "high" },
  { title: "School Fees Deadline: April 15", body: "All outstanding fees must be settled before April 15 to avoid penalties.", date: "Mar 25, 2025", priority: "high" },
  { title: "Sports Day – April 5th", body: "Annual sports day event. All students are encouraged to participate.", date: "Mar 20, 2025", priority: "low" },
  { title: "Library Hours Extended", body: "The library will now be open until 8 PM on weekdays during exam period.", date: "Mar 18, 2025", priority: "low" },
];

interface AnnouncementsPageProps {
  role: "admin" | "student";
}

const AnnouncementsPage = ({ role }: AnnouncementsPageProps) => (
  <DashboardLayout role={role}>
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Announcements</h2>
      <div className="space-y-4">
        {announcements.map((a, i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Bell size={18} className={a.priority === "high" ? "text-destructive mt-0.5" : "text-muted-foreground mt-0.5"} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{a.title}</p>
                    {a.priority === "high" && <Badge variant="destructive" className="text-xs">Important</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{a.body}</p>
                  <p className="text-xs text-muted-foreground">{a.date}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default AnnouncementsPage;
