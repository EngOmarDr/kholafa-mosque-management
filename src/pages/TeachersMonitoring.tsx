import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BookOpen, TrendingUp, Search, ChevronDown, ChevronUp, Building, ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TeacherActivity {
  teacher_id: string;
  teacher_name: string;
  mosque: string;
  grades?: string[];
  total_students: number;
  has_activity: boolean;
  attendance_registered_count?: number;
  present_count?: number;
  recitations_count?: number;
  bonus_points_total?: number;
  attendance_percentage?: number;
  recitation_percentage?: number;
  detailsLoaded?: boolean;
  started_by_name?: string | null;
}

interface MonthlyActivityData {
  [date: string]: {
    activeTeacherIds: string[];
    inactiveTeacherIds: string[];
    adminActiveInfo: Record<string, string>;
  };
}

interface TeacherBasicInfo {
  id: string;
  name: string;
  mosque: string;
  started_by_name?: string | null;
}

const TeachersMonitoring = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [teachersActivity, setTeachersActivity] = useState<TeacherActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<string>("all");
  const [mosques, setMosques] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Calendar tab states
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [monthlyData, setMonthlyData] = useState<MonthlyActivityData>({});
  const [allTeachers, setAllTeachers] = useState<TeacherBasicInfo[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [daySearchTerm, setDaySearchTerm] = useState("");
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");
  const [calendarMosqueFilter, setCalendarMosqueFilter] = useState<string>("all");
  const [calendarMosques, setCalendarMosques] = useState<string[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    const role = parsedUser.role;

    if (role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }

    setUser(parsedUser);
    fetchTeachersActivity(selectedDate);
    fetchAllTeachers();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchTeachersActivity(selectedDate);
    }
  }, [selectedDate, user]);

  useEffect(() => {
    if (user && activeTab === "calendar") {
      fetchMonthlyActivity(selectedMonth);
    }
  }, [selectedMonth, user, activeTab]);

  const fetchAllTeachers = async () => {
    try {
      const { data: teachersData, error } = await supabase
        .from("teachers")
        .select(`id, "اسم الاستاذ", "المسجد", students!inner(id, registration_status, mosque_name)`)
        .order("اسم الاستاذ");

      if (error) throw error;

      const uniqueMosques = new Set<string>();
      const teachersWithStudents = (teachersData || [])
        .filter((t: any) => t.students?.some((s: any) => s.registration_status === "مسجل"))
        .map((t: any) => {
          // تحديد المسجد الأكثر شيوعاً للأستاذ
          const mosqueCounts: Record<string, number> = {};
          t.students?.forEach((s: any) => {
            if (s.mosque_name) {
              mosqueCounts[s.mosque_name] = (mosqueCounts[s.mosque_name] || 0) + 1;
              uniqueMosques.add(s.mosque_name);
            }
          });

          let mostFrequentMosque = t["المسجد"] || "غير محدد";
          let maxCount = 0;
          Object.entries(mosqueCounts).forEach(([mosque, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostFrequentMosque = mosque;
            }
          });

          return {
            id: t.id,
            name: t["اسم الاستاذ"],
            mosque: mostFrequentMosque
          };
        });

      setAllTeachers(teachersWithStudents);
      setCalendarMosques(Array.from(uniqueMosques).sort());
    } catch (error) {
      console.error("Error fetching all teachers:", error);
    }
  };

  const fetchMonthlyActivity = async (month: Date) => {
    setLoadingMonthly(true);
    try {
      const startDate = format(startOfMonth(month), "yyyy-MM-dd");
      const endDate = format(endOfMonth(month), "yyyy-MM-dd");

      // جلب جميع الأساتذة الذين لديهم طلاب مسجلين
      const teacherIds = allTeachers.map(t => t.id);
      if (teacherIds.length === 0) {
        setMonthlyData({});
        setLoadingMonthly(false);
        return;
      }

      // جلب البيانات بالتوازي
      const [sessionsResult, attendanceResult, recitationsResult, bonusResult] = await Promise.all([
        supabase
          .from("teaching_sessions")
          .select("teacher_id, session_date, started_by_name")
          .eq("is_active", true)
          .gte("session_date", startDate)
          .lte("session_date", endDate)
          .in("teacher_id", teacherIds),
        supabase
          .from("attendance")
          .select("student_id, date, students!inner(teacher_id)")
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("recitations")
          .select("teacher_id, date")
          .gte("date", startDate)
          .lte("date", endDate)
          .in("teacher_id", teacherIds),
        supabase
          .from("bonus_points")
          .select("teacher_id, date")
          .gte("date", startDate)
          .lte("date", endDate)
          .in("teacher_id", teacherIds)
      ]);

      // تجميع النشاط حسب اليوم
      const activityByDate: MonthlyActivityData = {};
      const daysInMonth = eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month)
      });

      daysInMonth.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const activeSet = new Set<string>();

        // التحقق من الجلسات النشطة
        const adminActiveInfo: Record<string, string> = {};
        (sessionsResult.data as any[])?.forEach(s => {
          if (s.session_date === dateStr) {
            activeSet.add(s.teacher_id);
            if (s.started_by_name) {
              adminActiveInfo[s.teacher_id] = s.started_by_name;
            }
          }
        });

        // التحقق من الحضور
        attendanceResult.data?.forEach((a: any) => {
          if (a.date === dateStr && a.students?.teacher_id) {
            activeSet.add(a.students.teacher_id);
          }
        });

        // التحقق من التسميع
        recitationsResult.data?.forEach(r => {
          if (r.date === dateStr) {
            activeSet.add(r.teacher_id);
          }
        });

        // التحقق من النقاط الإضافية
        bonusResult.data?.forEach(b => {
          if (b.date === dateStr) {
            activeSet.add(b.teacher_id);
          }
        });

        const activeTeacherIds = Array.from(activeSet);
        const inactiveTeacherIds = teacherIds.filter(id => !activeSet.has(id));

        activityByDate[dateStr] = {
          activeTeacherIds,
          inactiveTeacherIds,
          adminActiveInfo
        };
      });

      setMonthlyData(activityByDate);
    } catch (error) {
      console.error("Error fetching monthly activity:", error);
      toast.error("حدث خطأ في تحميل بيانات الشهر");
    } finally {
      setLoadingMonthly(false);
    }
  };

  const fetchTeachersActivity = async (date: string) => {
    setLoading(true);
    try {
      const { data: teachersData, error: teachersError } = await supabase
        .from("teachers")
        .select(`
          id, 
          "اسم الاستاذ", 
          students!inner(id, grade, mosque_name, registration_status)
        `);

      if (teachersError) throw teachersError;

      const uniqueGrades = new Set<string>();
      const uniqueMosques = new Set<string>();
      teachersData?.forEach(t => {
        t.students?.forEach((s: any) => {
          if (s.grade) uniqueGrades.add(s.grade);
          if (s.mosque_name) uniqueMosques.add(s.mosque_name);
        });
      });
      setGrades(Array.from(uniqueGrades).sort());
      setMosques(Array.from(uniqueMosques).sort());

      const teacherIds = (teachersData || []).map(t => t.id);

      const [attendanceResult, recitationsResult, bonusResult, sessionsResult] = await Promise.all([
        supabase
          .from("attendance")
          .select("student_id, students!inner(teacher_id)")
          .eq("date", date)
          .in("students.teacher_id", teacherIds),
        supabase
          .from("recitations")
          .select("student_id, teacher_id")
          .eq("date", date)
          .in("teacher_id", teacherIds),
        supabase
          .from("bonus_points")
          .select("student_id, teacher_id")
          .eq("date", date)
          .in("teacher_id", teacherIds),
        supabase
          .from("teaching_sessions")
          .select("teacher_id, started_by_name")
          .eq("session_date", date)
          .eq("is_active", true)
          .in("teacher_id", teacherIds)
      ]);

      const activities: TeacherActivity[] = [];

      for (const teacher of teachersData || []) {
        const registeredStudents = teacher.students?.filter((s: any) =>
          s.registration_status === "مسجل"
        ) || [];
        const totalStudents = registeredStudents.length;
        if (totalStudents === 0) continue;

        const teacherGrades = [...new Set(registeredStudents.map((s: any) => s.grade).filter(Boolean))];

        const mosqueCounts: Record<string, number> = {};
        registeredStudents.forEach((s: any) => {
          if (s.mosque_name) {
            mosqueCounts[s.mosque_name] = (mosqueCounts[s.mosque_name] || 0) + 1;
          }
        });

        let mostFrequentMosque = "غير محدد";
        let maxCount = 0;
        Object.entries(mosqueCounts).forEach(([mosque, count]) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentMosque = mosque;
          }
        });

        const hasAttendance = attendanceResult.data?.some((a: any) =>
          a.students?.teacher_id === teacher.id
        ) || false;

        const hasRecitations = recitationsResult.data?.some((r: any) =>
          r.teacher_id === teacher.id
        ) || false;

        const hasBonus = bonusResult.data?.some((b: any) =>
          b.teacher_id === teacher.id
        ) || false;

        const activeSession = sessionsResult.data?.find((s: any) =>
          s.teacher_id === teacher.id
        );
        const hasActiveSession = !!activeSession;

        const hasActivity = hasActiveSession || hasAttendance || hasRecitations || hasBonus;

        const attendanceRegisteredCount = attendanceResult.data?.filter((a: any) =>
          a.students?.teacher_id === teacher.id
        ).length || 0;

        activities.push({
          teacher_id: teacher.id,
          teacher_name: teacher["اسم الاستاذ"],
          mosque: mostFrequentMosque,
          grades: teacherGrades,
          total_students: totalStudents,
          has_activity: hasActivity,
          attendance_registered_count: attendanceRegisteredCount,
          detailsLoaded: false,
          started_by_name: (activeSession as any)?.started_by_name
        });
      }

      activities.sort((a, b) => {
        if (a.has_activity && !b.has_activity) return -1;
        if (!a.has_activity && b.has_activity) return 1;
        return a.teacher_name.localeCompare(b.teacher_name);
      });

      setTeachersActivity(activities);
    } catch (error) {
      console.error("Error fetching teachers activity:", error);
      toast.error("حدث خطأ في تحميل بيانات الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherDetails = async (teacherId: string, date: string) => {
    setLoadingDetails(teacherId);
    try {
      const teacher = teachersActivity.find(t => t.teacher_id === teacherId);
      if (!teacher) return;

      const { data: studentsData } = await supabase
        .from("students")
        .select("id")
        .eq("teacher_id", teacherId);

      const studentIds = studentsData?.map(s => s.id) || [];
      const totalStudents = studentIds.length;

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("date", date)
        .in("student_id", studentIds);

      const presentCount = attendanceData?.filter(a => a.status === "حاضر").length || 0;

      const { data: recitationsData } = await supabase
        .from("recitations")
        .select("id")
        .eq("date", date)
        .in("student_id", studentIds);

      const recitationsCount = recitationsData?.length || 0;

      const { data: bonusData } = await supabase
        .from("bonus_points")
        .select("points")
        .eq("date", date)
        .in("student_id", studentIds);

      const bonusPointsTotal = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

      const attendancePercentage = totalStudents > 0
        ? Math.round((presentCount / totalStudents) * 100)
        : 0;

      const recitationPercentage = totalStudents > 0
        ? Math.round((recitationsCount / totalStudents) * 100)
        : 0;

      setTeachersActivity(prev =>
        prev.map(t =>
          t.teacher_id === teacherId
            ? {
              ...t,
              present_count: presentCount,
              recitations_count: recitationsCount,
              bonus_points_total: bonusPointsTotal,
              attendance_percentage: attendancePercentage,
              recitation_percentage: recitationPercentage,
              detailsLoaded: true
            }
            : t
        )
      );
    } catch (error) {
      console.error("Error loading teacher details:", error);
      toast.error("حدث خطأ في تحميل تفاصيل الأستاذ");
    } finally {
      setLoadingDetails(null);
    }
  };

  const toggleAllTeachers = () => {
    if (expandedTeachers.size === filteredTeachers.length) {
      setExpandedTeachers(new Set());
    } else {
      const allIds = new Set(filteredTeachers.map(t => t.teacher_id));
      setExpandedTeachers(allIds);
      filteredTeachers.forEach(teacher => {
        if (!teacher.detailsLoaded) {
          loadTeacherDetails(teacher.teacher_id, selectedDate);
        }
      });
    }
  };

  const filteredTeachers = teachersActivity.filter(teacher => {
    const matchesSearch = teacher.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.mosque.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === "all" || teacher.grades?.includes(selectedGrade);
    const matchesMosque = selectedMosque === "all" || teacher.mosque === selectedMosque;
    const matchesStatus = selectedStatus === "all" ||
      (selectedStatus === "active" && teacher.has_activity) ||
      (selectedStatus === "inactive" && !teacher.has_activity);
    return matchesSearch && matchesGrade && matchesMosque && matchesStatus;
  });

  const activeTeachersCount = filteredTeachers.filter(t => t.has_activity && !t.started_by_name).length;
  const adminActiveTeachersCount = filteredTeachers.filter(t => t.started_by_name).length;
  const inactiveTeachersCount = filteredTeachers.filter(t => !t.has_activity).length;
  const totalStudentsToday = filteredTeachers.reduce((sum, t) => sum + t.total_students, 0);

  // Calendar helpers
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth)
  });

  const weekDays = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  const firstDayOfMonth = getDay(startOfMonth(selectedMonth));
  const emptyDays = Array(firstDayOfMonth).fill(null);

  // فلترة الأساتذة حسب المسجد للتقويم
  const filteredCalendarTeachers = calendarMosqueFilter === "all"
    ? allTeachers
    : allTeachers.filter(t => t.mosque === calendarMosqueFilter);

  const filteredCalendarTeacherIds = filteredCalendarTeachers.map(t => t.id);

  const getTeacherActivityForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayData = monthlyData[dateStr] || { activeTeacherIds: [], inactiveTeacherIds: [], adminActiveInfo: {} };

    // فلترة حسب المسجد
    const filteredActiveIds = dayData.activeTeacherIds.filter(id => filteredCalendarTeacherIds.includes(id));
    const filteredInactiveIds = dayData.inactiveTeacherIds.filter(id => filteredCalendarTeacherIds.includes(id));

    // حساب النشطين من قبل الأدمن للفلاتر الحالية
    const adminActiveCount = filteredActiveIds.filter(id => !!dayData.adminActiveInfo?.[id]).length;

    return {
      activeTeacherIds: filteredActiveIds,
      inactiveTeacherIds: filteredInactiveIds,
      adminActiveCount
    };
  };

  const getDayStyle = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayData = monthlyData[dateStr];

    if (!dayData) return "bg-muted/30";

    if (selectedTeacherId !== "all") {
      const isActive = dayData.activeTeacherIds.includes(selectedTeacherId);
      const isInactive = dayData.inactiveTeacherIds.includes(selectedTeacherId);

      // Check if started by admin for this specific day/teacher combination
      // Note: This is an approximation since we don't have per-day started_by_name in the monthly map yet
      // For accurate coloring we would need to update the monthly data structure

      if (isActive) return "bg-green-500 text-white hover:bg-green-600";
      if (isInactive) return "bg-red-500 text-white hover:bg-red-600";
      return "bg-muted/30";
    }

    const hasActivity = dayData.activeTeacherIds.length > 0;
    if (hasActivity) {
      return "bg-primary/20 hover:bg-primary/30";
    }
    return "bg-muted/50 hover:bg-muted";
  };

  const getDayTeachersForDialog = () => {
    if (!selectedDay) return { active: [], inactive: [] };

    const dateStr = format(selectedDay, "yyyy-MM-dd");
    const dayData = monthlyData[dateStr];

    if (!dayData) return { active: [], inactive: [] };

    // فلترة حسب المسجد أولاً، ثم حسب البحث
    const teachersToFilter = calendarMosqueFilter === "all"
      ? allTeachers
      : allTeachers.filter(t => t.mosque === calendarMosqueFilter);

    const active = teachersToFilter
      .filter(t => dayData.activeTeacherIds.includes(t.id))
      .filter(t => t.name.toLowerCase().includes(daySearchTerm.toLowerCase()))
      .map(t => ({
        ...t,
        started_by_name: dayData.adminActiveInfo?.[t.id]
      }));

    const inactive = teachersToFilter
      .filter(t => dayData.inactiveTeacherIds.includes(t.id))
      .filter(t => t.name.toLowerCase().includes(daySearchTerm.toLowerCase()));

    return { active, inactive };
  };

  const dayTeachers = getDayTeachersForDialog();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="مراقبة الأساتذة" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="daily" className="gap-2">
              {activeTab === "daily" && <LayoutGrid className="w-4 h-4" />}
              المراقبة اليومية
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              {activeTab === "calendar" && <CalendarDays className="w-4 h-4" />}
              التقويم الشهري
            </TabsTrigger>
          </TabsList>

          {/* Daily Tab Content */}
          <TabsContent value="daily" className="space-y-6">
            {/* Header Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <Label className="text-sm mb-2 block">
                  <Calendar className="w-4 h-4 inline ml-1" />
                  التاريخ المحدد
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  <Search className="w-4 h-4 inline ml-1" />
                  بحث
                </Label>
                <Input
                  type="text"
                  placeholder="ابحث عن أستاذ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  <Users className="w-4 h-4 inline ml-1" />
                  فلترة حسب الصف
                </Label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر صف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الصفوف</SelectItem>
                    {grades.map(grade => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  <Building className="w-4 h-4 inline ml-1" />
                  فلترة حسب المسجد
                </Label>
                <Select value={selectedMosque} onValueChange={setSelectedMosque}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر مسجد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المساجد</SelectItem>
                    {mosques.map(mosque => (
                      <SelectItem key={mosque} value={mosque}>
                        {mosque}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  <TrendingUp className="w-4 h-4 inline ml-1" />
                  فلترة حسب الحالة
                </Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">
                  التحكم بالعرض
                </Label>
                <Button
                  onClick={toggleAllTeachers}
                  variant="outline"
                  className="w-full"
                >
                  {expandedTeachers.size === filteredTeachers.length ? (
                    <>
                      <ChevronUp className="w-4 h-4 ml-2" />
                      إغلاق الكل
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 ml-2" />
                      فتح الكل
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    الأساتذة النشطون
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{activeTeachersCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    من أصل {filteredTeachers.length} أستاذ
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-500">
                    نشطون من قبل الأدمن
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{adminActiveTeachersCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    تم تفعيلهم بواسطة المشرفين
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    الأساتذة غير النشطين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{inactiveTeachersCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    لم يسجلوا أي نشاط اليوم
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    إجمالي الطلاب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{totalStudentsToday}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    في الفصول المعروضة
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Teachers List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTeachers.map((teacher) => (
                <Card
                  key={teacher.teacher_id}
                  className={`cursor-pointer transition-all ${teacher.started_by_name
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : teacher.has_activity
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    } ${expandedTeachers.has(teacher.teacher_id) ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => {
                    const newExpanded = new Set(expandedTeachers);
                    if (expandedTeachers.has(teacher.teacher_id)) {
                      newExpanded.delete(teacher.teacher_id);
                    } else {
                      newExpanded.add(teacher.teacher_id);
                      if (!teacher.detailsLoaded) {
                        loadTeacherDetails(teacher.teacher_id, selectedDate);
                      }
                    }
                    setExpandedTeachers(newExpanded);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{teacher.teacher_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">عدد الطلاب: {teacher.total_students}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${teacher.started_by_name
                        ? 'bg-amber-600 text-white'
                        : teacher.has_activity
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        }`}>
                        {teacher.started_by_name
                          ? `نشط من قبل الأدمن (${teacher.started_by_name})`
                          : teacher.has_activity
                            ? 'نشط ✓'
                            : 'غير نشط'}
                      </div>
                    </div>
                  </CardHeader>

                  {expandedTeachers.has(teacher.teacher_id) && (
                    <CardContent className="space-y-3">
                      {loadingDetails === teacher.teacher_id ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : teacher.detailsLoaded ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <Users className="w-4 h-4" />
                                <span>الحضور</span>
                              </div>
                              <div className="text-2xl font-bold text-green-600">{teacher.present_count}</div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <BookOpen className="w-4 h-4" />
                                <span>التسميع</span>
                              </div>
                              <div className="text-2xl font-bold text-blue-600">{teacher.recitations_count}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg text-center">
                              <div className="text-xs text-muted-foreground mb-1">نسبة التسميع</div>
                              <div className="text-lg font-bold">{teacher.recitation_percentage}%</div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg text-center">
                              <TrendingUp className="w-4 h-4 mx-auto mb-1 text-orange-600" />
                              <div className="text-xs text-muted-foreground mb-1">النقاط</div>
                              <div className={`text-lg font-bold ${(teacher.bonus_points_total || 0) > 0 ? 'text-green-600' :
                                (teacher.bonus_points_total || 0) < 0 ? 'text-red-600' : ''
                                }`}>
                                {(teacher.bonus_points_total || 0) > 0 ? '+' : ''}{teacher.bonus_points_total || 0}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {filteredTeachers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد نتائج للبحث</p>
              </div>
            )}
          </TabsContent>

          {/* Calendar Tab Content */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Month Navigation and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="font-bold text-xl min-w-[180px] text-center">
                  {format(selectedMonth, "MMMM yyyy", { locale: ar })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label className="text-sm whitespace-nowrap">
                  <Building className="w-4 h-4 inline ml-1" />
                  فلتر المسجد:
                </Label>
                <Select value={calendarMosqueFilter} onValueChange={setCalendarMosqueFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="اختر مسجد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المساجد</SelectItem>
                    {calendarMosques.map(mosque => (
                      <SelectItem key={mosque} value={mosque}>{mosque}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label className="text-sm whitespace-nowrap">فلتر أستاذ:</Label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="اختر أستاذ لعرض نشاطه" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأساتذة</SelectItem>
                    {filteredCalendarTeachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              {selectedTeacherId !== "all" ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span>نشط</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span>غير نشط</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span>نشط من قبل الأدمن</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span>نشط (أستاذ)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span>غير نشط</span>
                  </div>
                </>
              )}
            </div>

            {/* Calendar Grid */}
            {loadingMonthly ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map(day => (
                    <div key={day} className="text-center font-bold text-sm py-2 text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, idx) => (
                    <div key={`empty-${idx}`} className="aspect-square"></div>
                  ))}

                  {daysInMonth.map(day => {
                    const dayData = getTeacherActivityForDay(day);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "aspect-square p-1 rounded-lg cursor-pointer transition-all flex flex-col items-center justify-center",
                          getDayStyle(day),
                          isSelected && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => {
                          setSelectedDay(day);
                          setDaySearchTerm("");
                        }}
                      >
                        <div className="text-lg font-bold">{format(day, "d")}</div>
                        {selectedTeacherId === "all" && (
                          <div className="text-[10px] flex gap-1 font-bold">
                            <span className="text-amber-600 dark:text-amber-400">{dayData.adminActiveCount}</span>
                            <span>/</span>
                            <span className="text-green-600 dark:text-green-400">{dayData.activeTeacherIds.length - dayData.adminActiveCount}</span>
                            <span>/</span>
                            <span className="text-red-600 dark:text-red-400">{dayData.inactiveTeacherIds.length}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Day Details Dialog */}
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {selectedDay && format(selectedDay, "EEEE dd MMMM yyyy", { locale: ar })}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="ابحث عن أستاذ..."
                value={daySearchTerm}
                onChange={(e) => setDaySearchTerm(e.target.value)}
                className="w-full"
              />

              <ScrollArea className="h-[50vh]">
                <div className="space-y-6 pr-4">
                  {/* Active Teachers */}
                  <div>
                    <h3 className="text-green-600 font-bold flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5" />
                      الأساتذة النشطون ({dayTeachers.active.filter(t => !t.started_by_name).length})
                    </h3>
                    {dayTeachers.active.filter(t => !t.started_by_name).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                        {dayTeachers.active.filter(t => !t.started_by_name).map(t => (
                          <Card key={t.id} className="border-green-500 bg-green-50 dark:bg-green-950/20">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="font-medium">{t.name}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm mb-6">لا يوجد أساتذة نشطون</p>
                    )}

                    <h3 className="text-amber-600 font-bold flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5" />
                      نشطون من قبل الأدمن ({dayTeachers.active.filter(t => t.started_by_name).length})
                    </h3>
                    {dayTeachers.active.filter(t => t.started_by_name).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dayTeachers.active.filter(t => t.started_by_name).map(t => (
                          <Card key={t.id} className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                            <CardContent className="p-3">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                  <span className="font-medium">{t.name}</span>
                                </div>
                                <div className="text-xs text-amber-600 dark:text-amber-400 mr-4">
                                  تم التفعيل بواسطة: {t.started_by_name}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">لا يوجد أساتذة نشطون من قبل الأدمن</p>
                    )}
                  </div>

                  {/* Inactive Teachers */}
                  <div>
                    <h3 className="text-red-600 font-bold flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5" />
                      الأساتذة غير النشطين ({dayTeachers.inactive.length})
                    </h3>
                    {dayTeachers.inactive.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dayTeachers.inactive.map(t => (
                          <Card key={t.id} className="border-red-500 bg-red-50 dark:bg-red-950/20">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span className="font-medium">{t.name}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">لا يوجد أساتذة غير نشطين</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TeachersMonitoring;
