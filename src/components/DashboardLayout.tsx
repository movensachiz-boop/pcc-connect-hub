import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Receipt, Bell, FileText, Settings,
  LogOut, Menu, X, BookOpen, CalendarDays, ChevronRight
} from "lucide-react";
import pccLogo from "@/assets/pcc-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "student";
}

const adminLinks = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Students", icon: Users, path: "/admin/students" },
  { label: "Payments", icon: Receipt, path: "/admin/payments" },
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

const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const links = role === "admin" ? adminLinks : studentLinks;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 gradient-primary flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <img src={pccLogo} alt="PCC" width={36} height={36} />
          <div>
            <h2 className="text-sm font-bold text-primary-foreground">Pioneer Christian</h2>
            <p className="text-xs text-primary-foreground/70 capitalize">{role} Portal</p>
          </div>
          <button className="lg:hidden ml-auto text-primary-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const active = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-primary-foreground/80 hover:bg-sidebar-accent/50 hover:text-primary-foreground"
                )}
              >
                <link.icon size={18} />
                {link.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-primary-foreground/80 hover:text-primary-foreground hover:bg-sidebar-accent/50"
            onClick={() => navigate("/")}
          >
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3 shadow-card">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-semibold text-primary capitalize">{role} Portal</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
