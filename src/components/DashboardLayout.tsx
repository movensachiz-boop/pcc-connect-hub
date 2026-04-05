import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Receipt, Bell, FileText, Settings,
  LogOut, Menu, X, BookOpen, CalendarDays, ChevronRight, GraduationCap, School, Calendar, ClipboardList
} from "lucide-react";
import pccLogo from "@/assets/pcc-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "student" | "teacher";
}

const adminLinks = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Students", icon: Users, path: "/admin/students" },
  { label: "Payments", icon: Receipt, path: "/admin/payments" },
  { label: "Subjects", icon: BookOpen, path: "/admin/subjects" },
  { label: "Teachers", icon: GraduationCap, path: "/admin/teachers" },
  { label: "Classes", icon: School, path: "/admin/classes" },
  { label: "Class Roster", icon: ClipboardList, path: "/admin/roster" },
  { label: "Timetable", icon: Calendar, path: "/admin/timetable" },
  { label: "Master Timetable", icon: CalendarDays, path: "/admin/timetable/master" },
  { label: "Reports", icon: FileText, path: "/admin/reports" },
  { label: "Announcements", icon: Bell, path: "/admin/announcements" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

const studentLinks = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/student" },
  { label: "Payments", icon: Receipt, path: "/student/payments" },
  { label: "Timetable", icon: CalendarDays, path: "/student/timetable" },
  { label: "Courses", icon: BookOpen, path: "/student/courses" },
  { label: "Announcements", icon: Bell, path: "/student/announcements" },
];

const teacherLinks = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/teacher" },
  { label: "Attendance", icon: Users, path: "/teacher/attendance" },
  { label: "Timetable", icon: CalendarDays, path: "/teacher/timetable" },
  { label: "Announcements", icon: Bell, path: "/teacher/announcements" },
];

const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const links = role === "admin" ? adminLinks : role === "teacher" ? teacherLinks : studentLinks;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center overflow-hidden">
            <img src={pccLogo} alt="PCC" width={32} height={32} className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-sidebar-foreground truncate">Progress Christian</h2>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{role} Portal</p>
          </div>
          <button className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">
            Navigation
          </p>
          {links.map((link, i) => {
            const active = location.pathname === link.path || (link.path !== '/admin' && link.path !== '/student' && location.pathname.startsWith(link.path));
            return (
              <button
                key={link.path}
                onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <link.icon size={18} />
                {link.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
            onClick={() => navigate("/")}
          >
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b px-4 lg:px-6 py-3 flex items-center gap-3">
          <button className="lg:hidden text-foreground hover:text-primary transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground capitalize">{role} Portal</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />
            </Button>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
