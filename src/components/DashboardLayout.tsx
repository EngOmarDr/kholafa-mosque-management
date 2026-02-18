import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Bell, Menu, ArrowRight, Download, Sun, Moon, Monitor, Smartphone, Settings, LayoutGrid, List, ClipboardList, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import AdminAccountSettings from "./AdminAccountSettings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PushNotificationManager from "./PushNotificationManager";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  userName?: string;
  role?: string;
  showBackButton?: boolean;
  backPath?: string;
}
const DashboardLayout = ({
  children,
  title,
  userName,
  role,
  showBackButton = true,
  backPath
}: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string>("admin");
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { theme, setTheme } = useTheme();
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => localStorage.getItem("view_mode") as any || "grid");
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPushNotifications, setShowPushNotifications] = useState(false);
  const [pendingSurveysCount, setPendingSurveysCount] = useState(0);

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("view_mode", mode);
    // إطلاق حدث لتحديث طريقة العرض في الصفحات الأخرى
    window.dispatchEvent(new CustomEvent("viewModeChange", { detail: mode }));
  };

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUserRole(parsedUser.role || "admin");
      setUserId(parsedUser.id);
    }
  }, []);

  useEffect(() => {
    if (userRole === "teacher" || userRole === "supervisor") {
      fetchPendingSurveys();

      // الاستماع لحدث إرسال الاستبيان لتحديث العداد
      const handleSurveySubmitted = () => {
        fetchPendingSurveys();
      };

      window.addEventListener('surveySubmitted', handleSurveySubmitted);
      return () => window.removeEventListener('surveySubmitted', handleSurveySubmitted);
    }
  }, [userRole]);

  const fetchPendingSurveys = async () => {
    try {
      const userData = localStorage.getItem("jeelUser");
      if (!userData) return;
      const parsedUser = JSON.parse(userData);

      // جلب معرف الأستاذ
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', parsedUser.id)
        .single();

      if (!teacherData) return;

      // جلب الاستبيانات النشطة التي لم يشارك فيها بعد
      const { data: surveys } = await supabase
        .from('surveys')
        .select('id')
        .eq('status', 'active');

      if (!surveys) return;

      const { data: submissions } = await supabase
        .from('survey_submissions')
        .select('survey_id')
        .eq('teacher_id', teacherData.id);

      const submittedIds = new Set(submissions?.map(s => s.survey_id) || []);
      const pending = surveys.filter(s => !submittedIds.has(s.id));

      setPendingSurveysCount(pending.length);
    } catch (error) {
      console.error('Error fetching pending surveys:', error);
    }
  };

  // تحديد مسار الرجوع التلقائي بناءً على الصفحة الحالية
  const getDefaultBackPath = () => {
    const currentPath = window.location.pathname;
    // لا تظهر زر الرجوع في الصفحات الرئيسية
    if (currentPath === "/admin" || currentPath === "/teacher" || currentPath === "/student" || currentPath === "/parent") {
      return null;
    }
    if (currentPath.startsWith("/admin/")) {
      return "/admin";
    }
    if (currentPath.startsWith("/teacher")) {
      return "/teacher";
    }
    if (currentPath.startsWith("/student")) {
      return "/student";
    }
    if (currentPath.startsWith("/parent")) {
      return "/parent";
    }
    return "/";
  };
  const finalBackPath = backPath || getDefaultBackPath();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    localStorage.removeItem("jeelUser");
    console.log(error);
    toast.success("تم تسجيل الخروج بنجاح");
    navigate("/login");
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(true);
  };

  return <div className="min-h-screen bg-background">
    {/* Navbar */}
    <nav className="bg-card border-b border-border sticky top-0 z-40 shadow-soft">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 md:gap-3">
            {showBackButton && finalBackPath && <Button onClick={() => navigate(finalBackPath)} variant="ghost" size="icon" className="ml-1 md:ml-2 hover:bg-primary/10" title="رجوع">
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </Button>}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center shadow-emerald overflow-hidden shrink-0">
              <img src="/logo.png" alt="جيل صلاحي" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xs md:text-xl font-bold text-primary truncate hidden sm:block">جيل صلاحي</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">{title}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 md:gap-1">
            {/* Notifications */}
            <NotificationsPanel userRole={userRole} userId={userId} />

            {/* Surveys (for teachers and supervisors) */}
            {(userRole === "teacher" || userRole === "supervisor") && (
              <Button
                onClick={() => navigate('/teacher/surveys')}
                variant="ghost"
                size="icon"
                className="relative w-9 h-9"
                title="الاستبيانات"
              >
                <ClipboardList className="w-5 h-5 text-primary" />
                {pendingSurveysCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground animate-bounce">
                    {pendingSurveysCount}
                  </span>
                )}
              </Button>
            )}



            {/* Theme Toggle */}
            <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} variant="ghost" size="icon" className="w-9 h-9" title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Settings Dropdown */}
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9" title="الإعدادات">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>الإعدادات</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* View Mode Options - show for teacher and supervisor role */}
                {(userRole === "teacher" || userRole === "supervisor") && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">طريقة العرض</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleViewModeChange("grid")}
                      className={viewMode === "grid" ? "bg-accent" : ""}
                    >
                      <LayoutGrid className="w-4 h-4 ml-2" />
                      عرض شبكي
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleViewModeChange("list")}
                      className={viewMode === "list" ? "bg-accent" : ""}
                    >
                      <List className="w-4 h-4 ml-2" />
                      عرض قائمة
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Push Notifications - for teachers and supervisors */}
                {(userRole === "teacher" || userRole === "supervisor") && (
                  <DropdownMenuItem onClick={() => setShowPushNotifications(true)}>
                    <Bell className="w-4 h-4 ml-2" />
                    الإشعارات الفورية
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => setShowAccountSettings(true)}>
                  <Settings className="w-4 h-4 ml-2" />
                  إعدادات الحساب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout */}
            <Button onClick={confirmLogout} variant="ghost" size="icon" className="w-9 h-9 text-destructive hover:text-destructive hover:bg-destructive/10" title="تسجيل الخروج">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>

    {/* Main Content */}
    <main className="container mx-auto px-4 py-6">
      {children}
    </main>

    {/* Account Settings Dialog */}
    <AdminAccountSettings open={showAccountSettings} onOpenChange={setShowAccountSettings} />

    {/* Push Notifications Dialog */}
    <Dialog open={showPushNotifications} onOpenChange={setShowPushNotifications}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            الإشعارات الفورية
          </DialogTitle>
        </DialogHeader>
        <PushNotificationManager />
      </DialogContent>
    </Dialog>

    {/* Logout Confirmation Dialog */}
    <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد تسجيل الخروج</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
            تسجيل الخروج
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
};
export default DashboardLayout;