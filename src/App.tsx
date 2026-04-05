import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TimetableProvider } from "@/context/TimetableContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SetupAccount from "./pages/SetupAccount";
import StudentDashboard from "./pages/StudentDashboard";
import StudentPayments from "./pages/StudentPayments";
import StudentTimetable from "./pages/StudentTimetable";
import StudentCourses from "./pages/StudentCourses";
import AdminDashboard from "./pages/AdminDashboard";
import AdminStudents from "./pages/AdminStudents";
import AdminPayments from "./pages/AdminPayments";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminSubjects from "./pages/AdminSubjects";
import AdminTeachers from "./pages/AdminTeachers";
import AdminClasses from "./pages/AdminClasses";
import AdminTimetableGenerate from "./pages/AdminTimetableGenerate";
import AdminTimetableView from "./pages/AdminTimetableView";
import AdminMasterTimetable from "./pages/AdminMasterTimetable";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import AdminClassRoster from "./pages/AdminClassRoster";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherAttendance from "./pages/TeacherAttendance";
import NotFound from "./pages/NotFound";
import VerifyReceipt from "./pages/VerifyReceipt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TimetableProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/setup-account" element={<SetupAccount />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/payments" element={<StudentPayments />} />
            <Route path="/student/timetable" element={<StudentTimetable />} />
            <Route path="/student/courses" element={<StudentCourses />} />
            <Route path="/student/announcements" element={<AnnouncementsPage role="student" />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/announcements" element={<AnnouncementsPage role="admin" />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/subjects" element={<AdminSubjects />} />
            <Route path="/admin/teachers" element={<AdminTeachers />} />
            <Route path="/admin/classes" element={<AdminClasses />} />
            <Route path="/admin/timetable" element={<AdminTimetableGenerate />} />
            <Route path="/admin/timetable/view" element={<AdminTimetableView />} />
            <Route path="/admin/timetable/master" element={<AdminMasterTimetable />} />
            <Route path="/admin/roster" element={<AdminClassRoster />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/attendance" element={<TeacherAttendance />} />
            <Route path="/teacher/timetable" element={<StudentTimetable />} />
            <Route path="/teacher/announcements" element={<AnnouncementsPage role="teacher" />} />
            <Route path="/verify" element={<VerifyReceipt />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TimetableProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
