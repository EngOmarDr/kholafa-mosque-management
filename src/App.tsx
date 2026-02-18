import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import NetworkStatus from "@/components/NetworkStatus";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import { ThemeProvider } from "next-themes";
import { initBackgroundSync } from "@/lib/backgroundSync";
import { PWAProvider } from "@/contexts/PWAContext";
import { AuthProvider } from "@/contexts/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

// Eager load critical pages
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SmartRedirect from "./pages/SmartRedirect";

// Lazy load all other pages for better performance
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FirstSetup = lazy(() => import("./pages/FirstSetup"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const StudentsManagement = lazy(() => import("./pages/StudentsManagement"));
const StudentsImport = lazy(() => import("./pages/StudentsImport"));
const TeachersManagement = lazy(() => import("./pages/TeachersManagement"));
const TeacherAccountsManagement = lazy(() => import("./pages/TeacherAccountsManagement"));
const MosquesManagement = lazy(() => import("./pages/MosquesManagement"));
const TeacherApplicationForm = lazy(() => import("./pages/TeacherApplicationForm"));
const TeacherApplications = lazy(() => import("./pages/TeacherApplications"));
const BulkAddTeachers = lazy(() => import("./pages/BulkAddTeachers"));
const AdminClassMonitoring = lazy(() => import("./pages/AdminClassMonitoring"));
const SupervisorDashboard = lazy(() => import("./pages/SupervisorDashboard"));
const TeachersMonitoring = lazy(() => import("./pages/TeachersMonitoring"));
const ActivityLogsViewer = lazy(() => import("./pages/ActivityLogsViewer"));
const AdminCheckItems = lazy(() => import("./pages/AdminCheckItems"));
const InstallPWA = lazy(() => import("./pages/InstallPWA"));
const AdminReportsAnalytics = lazy(() => import("./pages/AdminReportsAnalytics"));
const StudentsCompare = lazy(() => import("./pages/StudentsCompare"));
const StudentInquiry = lazy(() => import("./pages/StudentInquiry"));
const BackupManagement = lazy(() => import("./pages/BackupManagement"));
const AdminPointsSettings = lazy(() => import("./pages/AdminPointsSettings"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSurveys = lazy(() => import("./pages/AdminSurveys"));
const AdminSurveyBuilder = lazy(() => import("./pages/AdminSurveyBuilder"));
const AdminSurveyAnalytics = lazy(() => import("./pages/AdminSurveyAnalytics"));
const TeacherSurveys = lazy(() => import("./pages/TeacherSurveys"));
const AdminQuickAttendance = lazy(() => import("./pages/AdminQuickAttendance"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen p-6 space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
    <Skeleton className="h-96" />
  </div>
);

const queryClient = new QueryClient();

// Initialize background sync
if (typeof window !== 'undefined') {
  initBackgroundSync();
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PWAProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <PWAInstallPrompt />
              <NetworkStatus />
              <SyncStatusIndicator />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<SmartRedirect />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/first-setup" element={<FirstSetup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/students" element={<ProtectedRoute allowedRoles={["admin"]}><StudentsManagement /></ProtectedRoute>} />
                  <Route path="/admin/students/import" element={<ProtectedRoute allowedRoles={["admin"]}><StudentsImport /></ProtectedRoute>} />
                  <Route path="/admin/teachers" element={<ProtectedRoute allowedRoles={["admin"]}><TeachersManagement /></ProtectedRoute>} />
                  <Route path="/admin/teachers/accounts" element={<ProtectedRoute allowedRoles={["admin"]}><TeacherAccountsManagement /></ProtectedRoute>} />
                  <Route path="/admin/teachers/bulk-add" element={<ProtectedRoute allowedRoles={["admin"]}><BulkAddTeachers /></ProtectedRoute>} />
                  <Route path="/admin/teacher-applications" element={<ProtectedRoute allowedRoles={["admin"]}><TeacherApplications /></ProtectedRoute>} />
                  <Route path="/admin/mosques" element={<ProtectedRoute allowedRoles={["admin"]}><MosquesManagement /></ProtectedRoute>} />
                  <Route path="/admin/class-monitoring" element={<ProtectedRoute allowedRoles={["admin", "supervisor"]}><AdminClassMonitoring /></ProtectedRoute>} />
                  <Route path="/admin/teachers-monitoring" element={<ProtectedRoute allowedRoles={["admin"]}><TeachersMonitoring /></ProtectedRoute>} />
                  <Route path="/admin/activity-logs" element={<ProtectedRoute allowedRoles={["admin"]}><ActivityLogsViewer /></ProtectedRoute>} />
                  <Route path="/admin/check-items" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCheckItems /></ProtectedRoute>} />
                  <Route path="/admin/reports-analytics" element={<ProtectedRoute allowedRoles={["admin"]}><AdminReportsAnalytics /></ProtectedRoute>} />
                  <Route path="/admin/backup" element={<ProtectedRoute allowedRoles={["admin"]}><BackupManagement /></ProtectedRoute>} />
                  <Route path="/admin/points-settings" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPointsSettings /></ProtectedRoute>} />
                  <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={["admin"]}><AdminNotifications /></ProtectedRoute>} />
                  <Route path="/admin/surveys" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSurveys /></ProtectedRoute>} />
                  <Route path="/admin/surveys/new" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSurveyBuilder /></ProtectedRoute>} />
                  <Route path="/admin/surveys/:id" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSurveyBuilder /></ProtectedRoute>} />
                  <Route path="/admin/surveys/:id/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSurveyAnalytics /></ProtectedRoute>} />
                  <Route path="/admin/quick-attendance" element={<ProtectedRoute allowedRoles={["admin"]}><AdminQuickAttendance /></ProtectedRoute>} />

                  {/* Teacher Routes */}
                  <Route path="/supervisor" element={<ProtectedRoute allowedRoles={["supervisor"]}><SupervisorDashboard /></ProtectedRoute>} />
                  <Route path="/supervisor/class-monitoring" element={<ProtectedRoute allowedRoles={["supervisor"]}><AdminClassMonitoring /></ProtectedRoute>} />
                  <Route path="/teacher" element={<ProtectedRoute allowedRoles={["teacher"]}><TeacherDashboard /></ProtectedRoute>} />
                  <Route path="/teacher/students/compare" element={<ProtectedRoute allowedRoles={["teacher", "supervisor"]}><StudentsCompare /></ProtectedRoute>} />
                  <Route path="/teacher/surveys" element={<ProtectedRoute allowedRoles={["teacher", "supervisor"]}><TeacherSurveys /></ProtectedRoute>} />

                  {/* Student & Parent Routes */}
                  <Route path="/student" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
                  <Route path="/parent" element={<ProtectedRoute allowedRoles={["parent"]}><ParentDashboard /></ProtectedRoute>} />

                  {/* Public / Semi-public Routes */}
                  <Route path="/teacher-application" element={<TeacherApplicationForm />} />
                  <Route path="/student-inquiry" element={<StudentInquiry />} />
                  <Route path="/install" element={<InstallPWA />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </PWAProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
