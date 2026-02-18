import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, TrendingUp, Users, Award, BookOpen, UserCheck, Target, CheckCircle, Search, Check, ChevronsUpDown, Star, XCircle, Loader2, Zap, Trophy } from "lucide-react";
import { format, subMonths, subWeeks, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { toast } from "sonner";
import StatsCard from "@/components/StatsCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: endOfMonth(new Date())
  });
  const [growthPeriod, setGrowthPeriod] = useState<"1week" | "2weeks" | "3weeks" | "1month" | "3months" | "6months" | "1year" | "custom">("6months");
  const [customGrowthRange, setCustomGrowthRange] = useState({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: endOfMonth(new Date())
  });
  const [mosqueName, setMosqueName] = useState<string>("all");
  const [mosques, setMosques] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [grades, setGrades] = useState<string[]>([]);
  const [activePeriodLabel, setActivePeriodLabel] = useState("آخر 6 أشهر");
  const [activeTab, setActiveTab] = useState("teachers");

  // Analytics data
  const [studentGrowth, setStudentGrowth] = useState<any[]>([]);
  const [studentsByStatus, setStudentsByStatus] = useState<any[]>([]);
  const [teacherPerformance, setTeacherPerformance] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    avgPoints: 0,
    attendanceRate: 0
  });

  // Teacher performance tab
  const [selectedTeacherPerformance, setSelectedTeacherPerformance] = useState<string>("");
  const [openTeacherPerformance, setOpenTeacherPerformance] = useState(false);
  const [teacherPerformanceData, setTeacherPerformanceData] = useState<any>(null);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [isPeriodPointsDialogOpen, setIsPeriodPointsDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [selectedSessionAttendance, setSelectedSessionAttendance] = useState<any>(null);
  const [isSessionDetailDialogOpen, setIsSessionDetailDialogOpen] = useState(false);
  const [attendanceSort, setAttendanceSort] = useState<'attended' | 'absent'>('attended');

  // Teacher comparison data
  const [compareTeacher1, setCompareTeacher1] = useState<string>("");
  const [compareTeacher2, setCompareTeacher2] = useState<string>("");
  const [teacherComparisonData, setTeacherComparisonData] = useState<any[]>([]);
  const [comparisonTableData, setComparisonTableData] = useState<any>(null);

  // Student comparison data
  const [compareStudent1, setCompareStudent1] = useState<string>("");
  const [compareStudent2, setCompareStudent2] = useState<string>("");
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [studentComparisonData, setStudentComparisonData] = useState<any[]>([]);
  const [studentComparisonTable, setStudentComparisonTable] = useState<any>(null);
  const [openStudent1, setOpenStudent1] = useState(false);
  const [openStudent2, setOpenStudent2] = useState(false);
  const [openTeacher1, setOpenTeacher1] = useState(false);
  const [openTeacher2, setOpenTeacher2] = useState(false);

  useEffect(() => {
    fetchMosques();
    fetchTeachers();
    fetchGrades();
    fetchAllStudents();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, mosqueName, selectedTeacher, selectedGrade]);

  useEffect(() => {
    if (selectedTeacherPerformance) {
      fetchSelectedTeacherPerformance();
    }
  }, [selectedTeacherPerformance, dateRange]);

  useEffect(() => {
    fetchStudentGrowth();
  }, [growthPeriod, customGrowthRange, mosqueName, selectedTeacher, selectedGrade]);

  const fetchMosques = async () => {
    const { data } = await supabase.from("mosques").select("*");
    if (data) setMosques(data);
  };

  const fetchTeachers = async () => {
    let query = supabase.from("teachers").select("*");

    if (mosqueName !== "all") {
      query = query.eq("المسجد", mosqueName);
    }

    const { data } = await query;
    if (data) {
      const teachersWithDetails = await Promise.all(
        data.map(async (teacher: any) => {
          const [{ count, data: studentData }, { data: classData }] = await Promise.all([
            supabase
              .from("students")
              .select("grade", { count: "exact" })
              .eq("teacher_id", teacher.id)
              .not("grade", "is", null)
              .limit(5),
            supabase
              .from("classes")
              .select("class_name")
              .eq("teacher_id", teacher.id)
              .maybeSingle()
          ]);

          // Find the first non-empty grade if any
          const studentGrade = studentData?.find(s => s.grade)?.grade;
          const className = classData?.class_name || (studentGrade ? `الصف ${studentGrade}` : "غير محدد");

          return {
            ...teacher,
            student_count: count || 0,
            class_name: className
          };
        })
      );
      setTeachers(teachersWithDetails);
    }
  };

  const fetchGrades = async () => {
    let query = supabase.from("students").select("grade");

    if (mosqueName !== "all") {
      query = query.eq("mosque_name", mosqueName);
    }

    if (selectedTeacher !== "all") {
      query = query.eq("teacher_id", selectedTeacher);
    }

    const { data } = await query;
    if (data) {
      const uniqueGrades = [...new Set(data.map((s) => s.grade).filter(Boolean))];
      setGrades(uniqueGrades as string[]);
    }
  };

  const fetchAllStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, student_name, grade, current_teacher, mosque_name, teacher_id")
      .order("student_name");

    if (data) {
      setAllStudents(data);
    }
  };

  useEffect(() => {
    if (compareTeacher1 && compareTeacher2) {
      fetchTeacherComparison();
    }
  }, [compareTeacher1, compareTeacher2, dateRange]);

  useEffect(() => {
    if (compareStudent1 && compareStudent2) {
      fetchStudentComparison();
    }
  }, [compareStudent1, compareStudent2, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStudentGrowth(),
        fetchStudentsByStatus(),
        fetchTeacherPerformance(),
        fetchTopStudents(),
        fetchOverallStats()
      ]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("حدث خطأ في جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentGrowth = async () => {
    let startDate: Date;
    let endDate = new Date();
    let isWeeklyPeriod = false;

    if (growthPeriod === "custom") {
      startDate = customGrowthRange.from;
      endDate = customGrowthRange.to;
    } else if (growthPeriod === "1week" || growthPeriod === "2weeks" || growthPeriod === "3weeks") {
      // Weekly periods
      isWeeklyPeriod = true;
      const weeksMap = {
        "1week": 1,
        "2weeks": 2,
        "3weeks": 3
      };
      startDate = startOfWeek(subWeeks(endDate, weeksMap[growthPeriod] - 1), { weekStartsOn: 6 }); // Week starts on Saturday
    } else {
      // Monthly periods
      const monthsMap = {
        "1month": 1,
        "3months": 3,
        "6months": 6,
        "1year": 12
      };
      startDate = startOfMonth(subMonths(endDate, monthsMap[growthPeriod] - 1));
    }

    const periodsToFetch = [];
    let currentDate = new Date(startDate);

    if (isWeeklyPeriod) {
      // Fetch weekly data
      while (currentDate <= endDate) {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 6 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 6 });
        periodsToFetch.push({
          month: `${format(weekStart, "d MMM", { locale: ar })} - ${format(weekEnd, "d MMM", { locale: ar })}`,
          date: format(weekStart, 'yyyy-MM-dd'),
          end: weekEnd
        });
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Add 7 days
      }
    } else {
      // Fetch monthly data
      while (currentDate <= endDate) {
        periodsToFetch.push({
          month: format(currentDate, "MMMM yyyy", { locale: ar }),
          date: format(currentDate, 'yyyy-MM'),
          end: endOfMonth(currentDate)
        });
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }
    }

    const growthData = await Promise.all(
      periodsToFetch.map(async ({ month, date, end }) => {
        // Total students
        let totalQuery = supabase
          .from("students")
          .select("id", { count: "exact" })
          .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"));

        if (mosqueName !== "all") {
          totalQuery = totalQuery.eq("mosque_name", mosqueName);
        }
        if (selectedTeacher !== "all") {
          totalQuery = totalQuery.eq("teacher_id", selectedTeacher);
        }
        if (selectedGrade !== "all") {
          totalQuery = totalQuery.eq("grade", selectedGrade);
        }

        const { count: totalCount } = await totalQuery;

        // Registered students
        let registeredQuery = supabase
          .from("students")
          .select("id", { count: "exact" })
          .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"))
          .eq("registration_status", "مسجل");

        if (mosqueName !== "all") {
          registeredQuery = registeredQuery.eq("mosque_name", mosqueName);
        }
        if (selectedTeacher !== "all") {
          registeredQuery = registeredQuery.eq("teacher_id", selectedTeacher);
        }
        if (selectedGrade !== "all") {
          registeredQuery = registeredQuery.eq("grade", selectedGrade);
        }

        const { count: registeredCount } = await registeredQuery;

        // Unregistered students
        let unregisteredQuery = supabase
          .from("students")
          .select("id", { count: "exact" })
          .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"))
          .eq("registration_status", "غير مسجل");

        if (mosqueName !== "all") {
          unregisteredQuery = unregisteredQuery.eq("mosque_name", mosqueName);
        }
        if (selectedTeacher !== "all") {
          unregisteredQuery = unregisteredQuery.eq("teacher_id", selectedTeacher);
        }
        if (selectedGrade !== "all") {
          unregisteredQuery = unregisteredQuery.eq("grade", selectedGrade);
        }

        const { count: unregisteredCount } = await unregisteredQuery;

        // Pending students
        let pendingQuery = supabase
          .from("students")
          .select("id", { count: "exact" })
          .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"))
          .eq("registration_status", "غير مدرج بعد");

        if (mosqueName !== "all") {
          pendingQuery = pendingQuery.eq("mosque_name", mosqueName);
        }
        if (selectedTeacher !== "all") {
          pendingQuery = pendingQuery.eq("teacher_id", selectedTeacher);
        }
        if (selectedGrade !== "all") {
          pendingQuery = pendingQuery.eq("grade", selectedGrade);
        }

        const { count: pendingCount } = await pendingQuery;

        return {
          month,
          students: totalCount || 0,
          registered: registeredCount || 0,
          unregistered: unregisteredCount || 0,
          pending: pendingCount || 0
        };
      })
    );

    setStudentGrowth(growthData);
  };

  const fetchStudentsByStatus = async () => {
    let query = supabase.from("students").select("registration_status");

    if (mosqueName !== "all") {
      query = query.eq("mosque_name", mosqueName);
    }

    if (selectedTeacher !== "all") {
      query = query.eq("teacher_id", selectedTeacher);
    }

    if (selectedGrade !== "all") {
      query = query.eq("grade", selectedGrade);
    }

    const { data } = await query;

    if (data) {
      const statusCounts: Record<string, number> = {};
      data.forEach((student) => {
        const status = student.registration_status || "غير محدد";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      setStudentsByStatus(
        Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
      );
    }
  };

  const fetchTeacherPerformance = async () => {
    let teachersQuery = supabase
      .from("teachers")
      .select("id, اسم الاستاذ, المسجد");

    if (mosqueName !== "all") {
      teachersQuery = teachersQuery.eq("المسجد", mosqueName);
    }

    if (selectedTeacher !== "all") {
      teachersQuery = teachersQuery.eq("id", selectedTeacher);
    }

    const { data: teachersData } = await teachersQuery;

    if (teachersData) {
      const performanceData = await Promise.all(
        teachersData.map(async (teacher: any) => {
          let studentsQuery = supabase
            .from("students")
            .select("id", { count: "exact" })
            .eq("teacher_id", teacher.id);

          if (selectedGrade !== "all") {
            studentsQuery = studentsQuery.eq("grade", selectedGrade);
          }

          const { count: studentCount } = await studentsQuery;

          let studentsListQuery = supabase
            .from("students")
            .select("id")
            .eq("teacher_id", teacher.id);

          if (selectedGrade !== "all") {
            studentsListQuery = studentsListQuery.eq("grade", selectedGrade);
          }

          const { data: students } = await studentsListQuery;

          const studentIds = students?.map(s => s.id) || [];

          // جلب بيانات الحضور
          const { data: attendanceData } = await supabase
            .from("attendance")
            .select("student_id, status")
            .gte("date", format(dateRange.from, "yyyy-MM-dd"))
            .lte("date", format(dateRange.to, "yyyy-MM-dd"))
            .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

          const attendanceRate = attendanceData && attendanceData.length > 0
            ? Math.round((attendanceData.filter(a => a.status === "حاضر").length / attendanceData.length) * 100)
            : 0;

          // جلب بيانات التسميع
          const { data: recitationData } = await supabase
            .from("recitations")
            .select("points_awarded, rating")
            .eq("teacher_id", teacher.id)
            .gte("date", format(dateRange.from, "yyyy-MM-dd"))
            .lte("date", format(dateRange.to, "yyyy-MM-dd"))
            .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

          const totalRecitations = recitationData?.length || 0;
          const avgRecitationPoints = recitationData && recitationData.length > 0
            ? recitationData.reduce((sum, r) => sum + (r.points_awarded || 0), 0) / recitationData.length
            : 0;

          // جلب إجمالي النقاط
          const { data: pointsData } = await supabase
            .from("points_balance")
            .select("total")
            .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

          const totalPoints = pointsData?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;
          const avgPoints = pointsData && pointsData.length > 0 ? totalPoints / pointsData.length : 0;

          // جلب النقاط الإضافية
          const { data: bonusData } = await supabase
            .from("bonus_points")
            .select("points")
            .eq("teacher_id", teacher.id)
            .gte("date", format(dateRange.from, "yyyy-MM-dd"))
            .lte("date", format(dateRange.to, "yyyy-MM-dd"))
            .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

          const totalBonus = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

          return {
            name: teacher["اسم الاستاذ"],
            mosque: teacher["المسجد"] || "غير محدد",
            students: studentCount || 0,
            attendance: Math.round(attendanceRate),
            recitations: totalRecitations,
            avgRecitationPoints: Math.round(avgRecitationPoints * 10) / 10,
            totalPoints: totalPoints,
            avgPoints: Math.round(avgPoints),
            bonusPoints: totalBonus
          };
        })
      );

      setTeacherPerformance(performanceData.sort((a, b) => b.students - a.students).slice(0, 10));
    }
  };

  const fetchSelectedTeacherPerformance = async () => {
    if (!selectedTeacherPerformance) return;
    setLoading(true);
    try {
      const { data: teacherData, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", selectedTeacherPerformance)
        .maybeSingle();

      if (!teacherData) {
        toast.error("لم يتم العثور على بيانات الأستاذ");
        setLoading(false);
        return;
      }

      // جلب طلاب الأستاذ
      const { data: students, count: studentCount } = await supabase
        .from("students")
        .select("id, student_name, grade", { count: "exact" })
        .eq("teacher_id", teacherData.id);

      const studentIds = students?.map(s => s.id) || [];

      if (studentIds.length === 0) {
        setTeacherPerformanceData({
          name: teacherData["اسم الاستاذ"],
          mosque: teacherData["المسجد"] || "غير محدد",
          students: 0,
          attendance: 0,
          recitations: 0,
          avgRecitationPoints: 0,
          totalPoints: 0,
          avgPoints: 0,
          bonusPoints: 0,
          activeSessions: 0,
          activeSessionDates: [],
          studentDetails: []
        });
        setLoading(false);
        return;
      }

      // جلب بيانات الحضور
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id, status, date, points")
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .in("student_id", studentIds);

      // جلب بيانات التفتيش
      const { data: checkData } = await supabase
        .from("check_records")
        .select("student_id, points")
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .in("student_id", studentIds);

      const attendanceRate = attendanceData && attendanceData.length > 0
        ? Math.round((attendanceData.filter(a => a.status === "حاضر").length / attendanceData.length) * 100)
        : 0;

      // جلب بيانات التسميع
      const { data: recitationData } = await supabase
        .from("recitations")
        .select("points_awarded, rating, student_id")
        .eq("teacher_id", teacherData.id)
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .in("student_id", studentIds);

      const totalRecitations = recitationData?.length || 0;
      const avgRecitationPoints = recitationData && recitationData.length > 0
        ? recitationData.reduce((sum, r) => sum + (r.points_awarded || 0), 0) / recitationData.length
        : 0;

      // جلب إجمالي النقاط
      const { data: pointsData } = await supabase
        .from("points_balance")
        .select("total")
        .in("student_id", studentIds);

      const totalPoints = pointsData?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;
      const avgPoints = pointsData && pointsData.length > 0 ? totalPoints / pointsData.length : 0;

      // جلب النقاط الإضافية
      const { data: bonusData } = await supabase
        .from("bonus_points")
        .select("points, student_id")
        .eq("teacher_id", teacherData.id)
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .in("student_id", studentIds);

      const totalBonus = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

      // حساب التفاصيل لكل طالب
      const studentDetailedData = students.map(student => {
        // نقاط التسميع في الفترة
        const studentRecitations = recitationData?.filter(r => r.student_id === student.id) || [];
        const recitationPoints = studentRecitations.reduce((sum, r) => sum + (r.points_awarded || 0), 0);

        // النقاط الإضافية في الفترة
        const studentBonus = bonusData?.filter(b => b.student_id === student.id) || [];
        const bonusPoints = studentBonus.reduce((sum, b) => sum + (b.points || 0), 0);

        // غرامات ونقاط تفتيش في الفترة
        const studentChecks = checkData?.filter(c => c.student_id === student.id) || [];
        const checkPoints = studentChecks.reduce((sum, c) => sum + (c.points || 0), 0);

        // نقاط الحضور في الفترة
        const studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
        const attendancePoints = studentAttendance.reduce((sum, a) => sum + (a.points || 0), 0);
        const attendedDays = studentAttendance.filter(a => a.status === "حاضر").length;
        const absences = studentAttendance.filter(a => a.status !== "حاضر").length;

        // إجمالي نقاط الفترة
        const periodPoints = recitationPoints + bonusPoints + attendancePoints + checkPoints;

        return {
          id: student.id,
          name: student.student_name,
          periodPoints,
          recitationPoints,
          bonusPoints,
          attendancePoints,
          checkPoints,
          attendedDays,
          absences
        };
      });

      const totalPeriodPoints = studentDetailedData.reduce((sum, s) => sum + s.periodPoints, 0);

      // جلب عدد الجلسات النشطة وتواريخها
      const { data: activeSessionsData } = await supabase
        .from("attendance")
        .select("date")
        .in("student_id", studentIds)
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      // تصفية التواريخ الفريدة (جلسات التسميع)
      const uniqueDates = Array.from(new Set(activeSessionsData?.map(d => d.date) || []));

      // حساب تفاصيل كل جلسة
      const sessionDetails = await Promise.all(uniqueDates.map(async (date) => {
        const sessionAttendance = attendanceData?.filter(a => a.date === date) || [];
        const presentStudents = sessionAttendance.filter(a => a.status === "حاضر").map(a => {
          const student = students.find(s => s.id === a.student_id);
          return student ? student.student_name : "طالب غير معروف";
        });
        const absentStudents = sessionAttendance.filter(a => a.status !== "حاضر").map(a => {
          const student = students.find(s => s.id === a.student_id);
          return student ? student.student_name : "طالب غير معروف";
        });

        return {
          date,
          presentCount: presentStudents.length,
          absentCount: absentStudents.length,
          presentStudents,
          absentStudents
        };
      }));

      setTeacherPerformanceData({
        name: teacherData["اسم الاستاذ"],
        mosque: teacherData["المسجد"] || "غير محدد",
        students: studentCount || 0,
        attendance: attendanceRate,
        recitations: totalRecitations,
        avgRecitationPoints: avgRecitationPoints,
        totalPoints: totalPoints,
        totalPeriodPoints: totalPeriodPoints,
        avgPoints: avgPoints,
        bonusPoints: totalBonus,
        activeSessions: uniqueDates.length,
        sessions: sessionDetails,
        studentDetails: studentDetailedData
      });
    } catch (err) {
      console.error("Error fetching teacher performance:", err);
      toast.error("حدث خطأ في جلب بيانات أداء الأستاذ");
    } finally {
      setLoading(false);
    }
  };

  const fetchTopStudents = async () => {
    // 1. Get filtered students
    let studentsQuery = supabase
      .from("students")
      .select("id, student_name, current_teacher, mosque_name, teacher_id, grade");

    if (mosqueName !== "all") {
      studentsQuery = studentsQuery.eq("mosque_name", mosqueName);
    }
    if (selectedTeacher !== "all") {
      studentsQuery = studentsQuery.eq("teacher_id", selectedTeacher);
    }
    if (selectedGrade !== "all") {
      studentsQuery = studentsQuery.eq("grade", selectedGrade);
    }

    const { data: studentsData } = await studentsQuery;
    if (!studentsData || studentsData.length === 0) {
      setTopStudents([]);
      return;
    }

    const firstDate = format(dateRange.from, "yyyy-MM-dd");
    const lastDate = format(dateRange.to, "yyyy-MM-dd");
    const studentIds = studentsData.map(s => s.id);

    // 2. Fetch points from all sources within the date range
    const [recitations, bonus, attendance, check] = await Promise.all([
      supabase.from("recitations").select("student_id, points_awarded").in("student_id", studentIds).gte("date", firstDate).lte("date", lastDate),
      supabase.from("bonus_points").select("student_id, points").in("student_id", studentIds).gte("date", firstDate).lte("date", lastDate),
      supabase.from("attendance").select("student_id, points").in("student_id", studentIds).gte("date", firstDate).lte("date", lastDate),
      supabase.from("check_records").select("student_id, points").in("student_id", studentIds).gte("date", firstDate).lte("date", lastDate),
    ]);

    // 3. Aggregate points per student
    const pointsMap: Record<string, number> = {};
    studentIds.forEach(id => pointsMap[id] = 0);

    recitations.data?.forEach(r => { if (r.student_id) pointsMap[r.student_id] += (r.points_awarded || 0); });
    bonus.data?.forEach(b => { if (b.student_id) pointsMap[b.student_id] += (b.points || 0); });
    attendance.data?.forEach(a => { if (a.student_id) pointsMap[a.student_id] += (a.points || 0); });
    check.data?.forEach(c => { if (c.student_id) pointsMap[c.student_id] += (c.points || 0); });

    // 4. Sort and set top 20
    const topList = studentsData
      .map(s => ({
        name: s.student_name,
        teacher: s.current_teacher,
        points: pointsMap[s.id] || 0
      }))
      .filter(s => s.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 20)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    setTopStudents(topList);
  };

  const fetchOverallStats = async () => {
    let studentsQuery = supabase.from("students").select("id", { count: "exact" });

    if (mosqueName !== "all") {
      studentsQuery = studentsQuery.eq("mosque_name", mosqueName);
    }

    if (selectedTeacher !== "all") {
      studentsQuery = studentsQuery.eq("teacher_id", selectedTeacher);
    }

    if (selectedGrade !== "all") {
      studentsQuery = studentsQuery.eq("grade", selectedGrade);
    }

    // Filter only registered students
    studentsQuery = studentsQuery.eq("registration_status", "مسجل");

    const { count: totalStudents } = await studentsQuery;

    // Filter teachers who have students using inner join
    let teachersQuery = supabase.from("teachers").select("id, students!inner(id)", { count: "exact", head: true });

    if (mosqueName !== "all") {
      teachersQuery = teachersQuery.eq("المسجد", mosqueName);
    }

    if (selectedTeacher !== "all") {
      teachersQuery = teachersQuery.eq("id", selectedTeacher);
    }

    const { count: totalTeachers } = await teachersQuery;

    let pointsQuery = supabase
      .from("points_balance")
      .select("total, students!inner(mosque_name, teacher_id, grade)");

    const { data: pointsData } = await pointsQuery;

    let filteredPoints = pointsData;

    if (mosqueName !== "all") {
      filteredPoints = filteredPoints?.filter((p: any) => p.students.mosque_name === mosqueName);
    }

    if (selectedTeacher !== "all") {
      filteredPoints = filteredPoints?.filter((p: any) => p.students.teacher_id === selectedTeacher);
    }

    if (selectedGrade !== "all") {
      filteredPoints = filteredPoints?.filter((p: any) => p.students.grade === selectedGrade);
    }

    const avgPoints = filteredPoints && filteredPoints.length > 0
      ? Math.round(filteredPoints.reduce((sum: number, p: any) => sum + p.total, 0) / filteredPoints.length)
      : 0;

    let attendanceQuery = supabase
      .from("attendance")
      .select("status, students!inner(mosque_name, teacher_id, grade)")
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    const { data: attendanceData } = await attendanceQuery;

    let filteredAttendance = attendanceData;

    if (mosqueName !== "all") {
      filteredAttendance = filteredAttendance?.filter((a: any) => a.students.mosque_name === mosqueName);
    }

    if (selectedTeacher !== "all") {
      filteredAttendance = filteredAttendance?.filter((a: any) => a.students.teacher_id === selectedTeacher);
    }

    if (selectedGrade !== "all") {
      filteredAttendance = filteredAttendance?.filter((a: any) => a.students.grade === selectedGrade);
    }

    const attendanceRate = filteredAttendance && filteredAttendance.length > 0
      ? Math.round((filteredAttendance.filter((a: any) => a.status === "حاضر").length / filteredAttendance.length) * 100)
      : 0;

    setOverallStats({
      totalStudents: totalStudents || 0,
      totalTeachers: totalTeachers || 0,
      avgPoints,
      attendanceRate
    });
  };

  const fetchTeacherComparison = async () => {
    if (!compareTeacher1 || !compareTeacher2) return;
    setLoading(true);
    try {
      const teacher1Data = await getTeacherMetrics(compareTeacher1);
      const teacher2Data = await getTeacherMetrics(compareTeacher2);

      const teacher1Name = teachers.find(t => t.id === compareTeacher1)?.["اسم الاستاذ"] || "أستاذ 1";
      const teacher2Name = teachers.find(t => t.id === compareTeacher2)?.["اسم الاستاذ"] || "أستاذ 2";

      // Bar chart data with actual values
      const barData = [
        {
          metric: "عدد الطلاب",
          [teacher1Name]: teacher1Data.studentCount,
          [teacher2Name]: teacher2Data.studentCount,
        },
        {
          metric: "عدد الجلسات النشطة",
          [teacher1Name]: teacher1Data.activeSessions,
          [teacher2Name]: teacher2Data.activeSessions,
        },
        {
          metric: "عدد النقاط الاجمالية",
          [teacher1Name]: teacher1Data.totalPoints,
          [teacher2Name]: teacher2Data.totalPoints,
        },
        {
          metric: "عدد نقاط الحضور",
          [teacher1Name]: teacher1Data.attendancePoints,
          [teacher2Name]: teacher2Data.attendancePoints,
        },
        {
          metric: "عدد نقاط التسميع",
          [teacher1Name]: teacher1Data.recitationPoints,
          [teacher2Name]: teacher2Data.recitationPoints,
        },
        {
          metric: "نسبة الحضور %",
          [teacher1Name]: teacher1Data.attendanceRate,
          [teacher2Name]: teacher2Data.attendanceRate,
        },
        {
          metric: "عدد التسميعات",
          [teacher1Name]: teacher1Data.recitationCount,
          [teacher2Name]: teacher2Data.recitationCount,
        },
        {
          metric: "النقاط الإضافية",
          [teacher1Name]: teacher1Data.bonusPoints,
          [teacher2Name]: teacher2Data.bonusPoints,
        },
      ];

      setTeacherComparisonData(barData);
      setComparisonTableData({
        teacher1: { ...teacher1Data, name: teacher1Name },
        teacher2: { ...teacher2Data, name: teacher2Name }
      });
    } catch (error) {
      console.error("Error comparing teachers:", error);
      toast.error("حدث خطأ في مقارنة الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const getTeacherMetrics = async (teacherId: string) => {
    // Get student count
    const { count: studentCount } = await supabase
      .from("students")
      .select("id", { count: "exact" })
      .eq("teacher_id", teacherId);

    // Get students list
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("teacher_id", teacherId);

    const studentIds = students?.map(s => s.id) || [];

    // Get points metrics
    const { data: pointsData } = await supabase
      .from("points_balance")
      .select("total, attendance_points, recitation_points")
      .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

    const totalPoints = pointsData?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;
    const attendancePointsTotal = pointsData?.reduce((sum, p) => sum + (p.attendance_points || 0), 0) || 0;
    const recitationPointsTotal = pointsData?.reduce((sum, p) => sum + (p.recitation_points || 0), 0) || 0;

    // Get attendance records
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("status, date")
      .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    const attendanceRate = attendanceData && attendanceData.length > 0
      ? Math.round((attendanceData.filter(a => a.status === "حاضر").length / attendanceData.length) * 100)
      : 0;

    const activeSessions = new Set(attendanceData?.map(a => a.date)).size;

    // Get recitation count
    const { count: recitationCount } = await supabase
      .from("recitations")
      .select("id", { count: "exact" })
      .eq("teacher_id", teacherId)
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    // Get bonus points
    const { data: bonusData } = await supabase
      .from("bonus_points")
      .select("points")
      .eq("teacher_id", teacherId)
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    const bonusPoints = bonusData && bonusData.length > 0
      ? bonusData.reduce((sum, b) => sum + b.points, 0)
      : 0;

    return {
      studentCount: studentCount || 0,
      totalPoints,
      attendancePoints: attendancePointsTotal,
      recitationPoints: recitationPointsTotal,
      activeSessions,
      attendanceRate,
      recitationCount: recitationCount || 0,
      bonusPoints,
    };
  };

  const fetchStudentComparison = async () => {
    if (!compareStudent1 || !compareStudent2) return;
    setLoading(true);
    try {
      const student1Data = await getStudentMetrics(compareStudent1);
      const student2Data = await getStudentMetrics(compareStudent2);

      const student1Name = allStudents.find(s => s.id === compareStudent1)?.student_name || "طالب 1";
      const student2Name = allStudents.find(s => s.id === compareStudent2)?.student_name || "طالب 2";

      // Bar chart data with actual student names
      const barData = [
        {
          metric: "إجمالي النقاط",
          [student1Name]: student1Data.totalPoints,
          [student2Name]: student2Data.totalPoints
        },
        {
          metric: "نقاط الحضور",
          [student1Name]: student1Data.attendancePoints,
          [student2Name]: student2Data.attendancePoints
        },
        {
          metric: "نقاط التسميع",
          [student1Name]: student1Data.recitationPoints,
          [student2Name]: student2Data.recitationPoints
        },
        {
          metric: "النقاط الإضافية",
          [student1Name]: student1Data.bonusPoints,
          [student2Name]: student2Data.bonusPoints
        },
        {
          metric: "نسبة الحضور %",
          [student1Name]: student1Data.attendanceRate,
          [student2Name]: student2Data.attendanceRate
        },
        {
          metric: "عدد التسميعات",
          [student1Name]: student1Data.recitationCount,
          [student2Name]: student2Data.recitationCount
        },
        {
          metric: "نسبة الأدوات %",
          [student1Name]: student1Data.toolsRate,
          [student2Name]: student2Data.toolsRate
        }
      ];

      setStudentComparisonData(barData);
      setStudentComparisonTable({
        student1: { ...student1Data, name: student1Name },
        student2: { ...student2Data, name: student2Name }
      });
    } catch (error) {
      console.error("Error comparing students:", error);
      toast.error("حدث خطأ في مقارنة الطلاب");
    } finally {
      setLoading(false);
    }
  };

  const getStudentMetrics = async (studentId: string) => {
    // Get points balance
    const { data: pointsData } = await supabase
      .from("points_balance")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    const totalPoints = pointsData?.total || 0;
    const attendancePoints = pointsData?.attendance_points || 0;
    const recitationPoints = pointsData?.recitation_points || 0;
    const bonusPoints = pointsData?.bonus_points || 0;

    // Get attendance count
    const { count: attendanceDays } = await supabase
      .from("attendance")
      .select("id", { count: "exact" })
      .eq("student_id", studentId)
      .eq("status", "حاضر")
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    // Get total attendance records for rate
    const { count: totalAttendance } = await supabase
      .from("attendance")
      .select("id", { count: "exact" })
      .eq("student_id", studentId)
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    const attendanceRate = totalAttendance && totalAttendance > 0
      ? Math.round((attendanceDays || 0) / totalAttendance * 100)
      : 0;

    // Get recitation count
    const { count: recitationCount } = await supabase
      .from("recitations")
      .select("id", { count: "exact" })
      .eq("student_id", studentId)
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    // Get check records (tools)
    const { data: checkRecords } = await supabase
      .from("check_records")
      .select("status")
      .eq("student_id", studentId)
      .gte("date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("date", format(dateRange.to, "yyyy-MM-dd"));

    const toolsRate = checkRecords && checkRecords.length > 0
      ? Math.round((checkRecords.filter(r => r.status === "موجود").length / checkRecords.length) * 100)
      : 0;

    return {
      totalPoints,
      attendancePoints,
      recitationPoints,
      bonusPoints,
      attendanceDays: attendanceDays || 0,
      attendanceRate,
      recitationCount: recitationCount || 0,
      toolsRate
    };
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحليلات</h1>
          <p className="text-muted-foreground mt-1">تحليل شامل لأداء المركز</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium animate-pulse">جاري جلب البيانات...</p>
            </div>
          </div>
        )}
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-2 bg-background/60 backdrop-blur-lg border border-border/50 p-2 rounded-2xl transition-all duration-500 shadow-sm mb-8">
          <TabsTrigger
            value="teachers"
            className="flex items-center gap-2 py-3.5 px-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-[1.02] transition-all duration-300 hover:bg-muted/50 group"
          >
            <UserCheck className="w-4 h-4 group-data-[state=active]:animate-bounce" />
            <span className="font-semibold">أداء الأساتذة</span>
          </TabsTrigger>
          <TabsTrigger
            value="growth"
            className="flex items-center gap-2 py-3.5 px-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-[1.02] transition-all duration-300 hover:bg-muted/50 group"
          >
            <TrendingUp className="w-4 h-4 group-data-[state=active]:animate-pulse" />
            <span className="font-semibold">نمو الطلاب</span>
          </TabsTrigger>
          <TabsTrigger
            value="top"
            className="flex items-center gap-2 py-3.5 px-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-[1.02] transition-all duration-300 hover:bg-muted/50 group"
          >
            <Award className="w-4 h-4 group-data-[state=active]:animate-spin-slow" />
            <span className="font-semibold">أفضل الطلاب</span>
          </TabsTrigger>
          <TabsTrigger
            value="compare-teachers"
            className="flex items-center gap-2 py-3.5 px-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-[1.02] transition-all duration-300 hover:bg-muted/50 group"
          >
            <Users className="w-4 h-4 group-data-[state=active]:animate-pulse" />
            <span className="font-semibold">مقارنة الأساتذة</span>
          </TabsTrigger>
          <TabsTrigger
            value="compare-students"
            className="flex items-center gap-2 py-3.5 px-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-[1.02] transition-all duration-300 hover:bg-muted/50 group"
          >
            <Search className="w-4 h-4 group-data-[state=active]:animate-bounce" />
            <span className="font-semibold">مقارنة الطلاب</span>
          </TabsTrigger>
        </TabsList>

        {(activeTab === "growth" || activeTab === "top") && (
          <>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>الفلاتر المتقدمة</CardTitle>
                <CardDescription>قم بتصفية البيانات حسب المسجد، الأستاذ، الصف والفترة الزمنية</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">المسجد</label>
                    <Select value={mosqueName} onValueChange={(value) => {
                      setMosqueName(value);
                      setSelectedTeacher("all");
                      setSelectedGrade("all");
                      fetchTeachers();
                      fetchGrades();
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المساجد</SelectItem>
                        {mosques.map((mosque) => (
                          <SelectItem key={mosque.id} value={mosque["اسم المسجد"]}>
                            {mosque["اسم المسجد"]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">الأستاذ</label>
                    <Select value={selectedTeacher} onValueChange={(value) => {
                      setSelectedTeacher(value);
                      setSelectedGrade("all");
                      fetchGrades();
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأساتذة</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher["اسم الاستاذ"]} ({teacher.student_count} طالب)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">الصف</label>
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الصفوف</SelectItem>
                        {grades.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">الفترة الزمنية</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(dateRange.from, "dd/MM", { locale: ar })} - {format(dateRange.to, "dd/MM", { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: dateRange.from, to: dateRange.to }}
                          onSelect={(range: any) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "top" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>الفترة الزمنية للتحليل</CardTitle>
              <CardDescription>حدد الفترة الزمنية لعرض الإحصائيات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activePeriodLabel === "آخر يوم" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subDays(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر يوم");
                  }}
                >
                  آخر يوم
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر أسبوع" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subWeeks(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر أسبوع");
                  }}
                >
                  آخر أسبوع
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر شهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر شهر");
                  }}
                >
                  آخر شهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 3 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 3), to: new Date() });
                    setActivePeriodLabel("آخر 3 أشهر");
                  }}
                >
                  آخر 3 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 6 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 6), to: new Date() });
                    setActivePeriodLabel("آخر 6 أشهر");
                  }}
                >
                  آخر 6 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "تاريخ مخصص" ? "default" : "outline"}
                  onClick={() => setActivePeriodLabel("تاريخ مخصص")}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  تاريخ مخصص
                </Button>
              </div>

              {activePeriodLabel === "تاريخ مخصص" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">من تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "PPP", { locale: ar }) : "اختر تاريخ البدء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">إلى تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "PPP", { locale: ar }) : "اختر تاريخ الانتهاء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Charts */}


        <TabsContent value="growth" className="space-y-4">
          {/* Period Selection */}
          <Card>
            <CardHeader>
              <CardTitle>اختر الفترة الزمنية</CardTitle>
              <CardDescription>حدد الفترة لعرض تطور عدد الطلاب</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={growthPeriod === "1week" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("1week")}
                  size="sm"
                >
                  آخر أسبوع
                </Button>
                <Button
                  variant={growthPeriod === "2weeks" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("2weeks")}
                  size="sm"
                >
                  آخر أسبوعين
                </Button>
                <Button
                  variant={growthPeriod === "3weeks" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("3weeks")}
                  size="sm"
                >
                  آخر 3 أسابيع
                </Button>
                <Button
                  variant={growthPeriod === "1month" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("1month")}
                  size="sm"
                >
                  آخر شهر
                </Button>
                <Button
                  variant={growthPeriod === "3months" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("3months")}
                  size="sm"
                >
                  آخر 3 أشهر
                </Button>
                <Button
                  variant={growthPeriod === "6months" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("6months")}
                  size="sm"
                >
                  آخر 6 أشهر
                </Button>
                <Button
                  variant={growthPeriod === "1year" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("1year")}
                  size="sm"
                >
                  آخر سنة
                </Button>
                <Button
                  variant={growthPeriod === "custom" ? "default" : "outline"}
                  onClick={() => setGrowthPeriod("custom")}
                  size="sm"
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  تاريخ مخصص
                </Button>
              </div>

              {growthPeriod === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">من تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(customGrowthRange.from, "PPP", { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customGrowthRange.from}
                          onSelect={(date) => date && setCustomGrowthRange({ ...customGrowthRange, from: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">إلى تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(customGrowthRange.to, "PPP", { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customGrowthRange.to}
                          onSelect={(date) => date && setCustomGrowthRange({ ...customGrowthRange, to: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Students Chart */}
          <Card>
            <CardHeader>
              <CardTitle>إجمالي عدد الطلاب</CardTitle>
              <CardDescription>تطور العدد الإجمالي للطلاب المسجلين</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={studentGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="students"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    name="إجمالي الطلاب"
                    dot={{ fill: "hsl(var(--primary))", r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Registered Students Chart */}
          <Card>
            <CardHeader>
              <CardTitle>الطلاب المسجلين</CardTitle>
              <CardDescription>تطور عدد الطلاب الذين تم تسجيلهم رسمياً</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={studentGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="registered" fill="hsl(var(--primary))" name="مسجل" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>مقارنة حالات التسجيل</CardTitle>
              <CardDescription>مقارنة بين الطلاب المسجلين وغير المسجلين والمعلقين</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={studentGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="registered"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="مسجل"
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="unregistered"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="غير مسجل"
                    dot={{ fill: "hsl(var(--destructive))", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    name="غير مدرج بعد"
                    dot={{ fill: "hsl(var(--secondary))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>توزيع حالات التسجيل</CardTitle>
              <CardDescription>تفصيل نسب كل حالة تسجيل</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={studentGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="registered" stackId="a" fill="hsl(var(--primary))" name="مسجل" />
                  <Bar dataKey="unregistered" stackId="a" fill="hsl(var(--destructive))" name="غير مسجل" />
                  <Bar dataKey="pending" stackId="a" fill="hsl(var(--secondary))" name="غير مدرج بعد" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart: Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>توزيع الطلاب حسب الحالة (الحالي)</CardTitle>
              <CardDescription>نسب حالات التسجيل المختلفة حالياً</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={studentsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {studentsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          {/* اختيار الأستاذ */}
          <Card>
            <CardHeader>
              <CardTitle>اختر أستاذ لعرض أدائه</CardTitle>
              <CardDescription>ابحث واختر الأستاذ لعرض تفاصيل أدائه الكاملة</CardDescription>
            </CardHeader>
            <CardContent>
              <Popover open={openTeacherPerformance} onOpenChange={setOpenTeacherPerformance}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openTeacherPerformance}
                    className="w-full justify-between h-12"
                  >
                    {selectedTeacherPerformance
                      ? teachers.find((teacher) => teacher.id === selectedTeacherPerformance)?.["اسم الاستاذ"]
                      : "اختر الأستاذ..."}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="ابحث عن أستاذ..." />
                    <CommandList>
                      <CommandEmpty>لم يتم العثور على أساتذة.</CommandEmpty>
                      <CommandGroup>
                        {teachers.map((teacher) => (
                          <CommandItem
                            key={teacher.id}
                            value={teacher["اسم الاستاذ"]}
                            onSelect={() => {
                              setSelectedTeacherPerformance(teacher.id);
                              setOpenTeacherPerformance(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                selectedTeacherPerformance === teacher.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1 text-right">
                              <div className="font-medium">{teacher["اسم الاستاذ"]} ({teacher.student_count} طالب)</div>
                              <div className="text-sm text-muted-foreground">
                                {teacher.class_name}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {selectedTeacherPerformance && (
            <Card>
              <CardHeader>
                <CardTitle>الفترة الزمنية للتحليل</CardTitle>
                <CardDescription>حدد الفترة الزمنية لعرض إحصائيات الأداء لهذا الأستاذ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={activePeriodLabel === "آخر يوم" ? "default" : "outline"}
                    onClick={() => {
                      setDateRange({ from: subDays(new Date(), 1), to: new Date() });
                      setActivePeriodLabel("آخر يوم");
                    }}
                  >
                    آخر يوم
                  </Button>
                  <Button
                    variant={activePeriodLabel === "آخر أسبوع" ? "default" : "outline"}
                    onClick={() => {
                      setDateRange({ from: subWeeks(new Date(), 1), to: new Date() });
                      setActivePeriodLabel("آخر أسبوع");
                    }}
                  >
                    آخر أسبوع
                  </Button>
                  <Button
                    variant={activePeriodLabel === "آخر شهر" ? "default" : "outline"}
                    onClick={() => {
                      setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
                      setActivePeriodLabel("آخر شهر");
                    }}
                  >
                    آخر شهر
                  </Button>
                  <Button
                    variant={activePeriodLabel === "آخر 3 أشهر" ? "default" : "outline"}
                    onClick={() => {
                      setDateRange({ from: subMonths(new Date(), 3), to: new Date() });
                      setActivePeriodLabel("آخر 3 أشهر");
                    }}
                  >
                    آخر 3 أشهر
                  </Button>
                  <Button
                    variant={activePeriodLabel === "آخر 6 أشهر" ? "default" : "outline"}
                    onClick={() => {
                      setDateRange({ from: subMonths(new Date(), 6), to: new Date() });
                      setActivePeriodLabel("آخر 6 أشهر");
                    }}
                  >
                    آخر 6 أشهر
                  </Button>
                  <Button
                    variant={activePeriodLabel === "تاريخ مخصص" ? "default" : "outline"}
                    onClick={() => setActivePeriodLabel("تاريخ مخصص")}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    تاريخ مخصص
                  </Button>
                </div>

                {activePeriodLabel === "تاريخ مخصص" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block text-right">من تاريخ</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-right">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {dateRange.from ? format(dateRange.from, "PPP", { locale: ar }) : "اختر تاريخ البدء"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.from}
                            onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                            locale={ar}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block text-right">إلى تاريخ</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-right">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {dateRange.to ? format(dateRange.to, "PPP", { locale: ar }) : "اختر تاريخ الانتهاء"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.to}
                            onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                            locale={ar}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!teacherPerformanceData && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">اختر أستاذاً لعرض تفاصيل أدائه</p>
                  <p className="text-sm mt-2">استخدم البحث أعلاه لاختيار الأستاذ</p>
                </div>
              </CardContent>
            </Card>
          )}

          {teacherPerformanceData && (
            <>
              {/* إحصائيات سريعة */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Card
                  className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setIsStudentsDialogOpen(true)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">عدد الطلاب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {teacherPerformanceData.students}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setIsSessionsDialogOpen(true)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">عدد الجلسات ({activePeriodLabel})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {teacherPerformanceData.activeSessions}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setAttendanceSort('attended');
                    setIsAttendanceDialogOpen(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">نسبة الحضور ({activePeriodLabel})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {teacherPerformanceData.attendance}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">التسميعات ({activePeriodLabel})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {teacherPerformanceData.recitations}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">النقاط الإضافية ({activePeriodLabel})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {teacherPerformanceData.bonusPoints}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setIsPeriodPointsDialogOpen(true)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي النقاط ({activePeriodLabel})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {teacherPerformanceData.totalPeriodPoints}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dialogs */}
              <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      سجل الجلسات - {teacherPerformanceData.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 p-3 bg-indigo-500/10 rounded-lg text-indigo-700 dark:text-indigo-400">
                      <Clock className="h-5 w-5" />
                      <span className="font-semibold">
                        إجمالي الجلسات النشطة: {teacherPerformanceData.activeSessions}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {Object.entries(
                        teacherPerformanceData.sessions.reduce((acc: any, session: any) => {
                          const monthLabel = format(new Date(session.date), "MMMM yyyy", { locale: ar });
                          if (!acc[monthLabel]) acc[monthLabel] = [];
                          acc[monthLabel].push(session);
                          return acc;
                        }, {})
                      ).map(([month, monthSessions]: [string, any]) => (
                        <div key={month} className="space-y-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                              {month}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {monthSessions.length} جلسات
                            </span>
                          </div>
                          <div className="grid gap-2">
                            {monthSessions.map((session: any) => (
                              <div
                                key={session.date}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedSessionAttendance(session);
                                  setIsSessionDetailDialogOpen(true);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 font-semibold text-sm">
                                    {teacherPerformanceData.activeSessions - teacherPerformanceData.sessions.findIndex((s: any) => s.date === session.date)}
                                  </div>
                                  <span className="font-medium text-sm">
                                    {format(new Date(session.date), "EEEE، dd MMMM yyyy", { locale: ar })}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-none text-[10px] px-1.5 py-0">
                                    {session.presentCount} حاضر
                                  </Badge>
                                  <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-none text-[10px] px-1.5 py-0">
                                    {session.absentCount} غائب
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {teacherPerformanceData.sessions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        لا توجد جلسات مسجلة في هذه الفترة
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isSessionDetailDialogOpen} onOpenChange={setIsSessionDetailDialogOpen}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      تفاصيل الحضور - {selectedSessionAttendance && format(new Date(selectedSessionAttendance.date), "dd MMMM yyyy", { locale: ar })}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1">
                        <h4 className="font-bold text-sm text-green-600 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          الطلاب الحاضرون ({selectedSessionAttendance?.presentCount})
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSessionAttendance?.presentStudents.map((name: string) => (
                          <Badge key={name} variant="secondary" className="bg-green-500/10 text-green-700 border-none">
                            {name}
                          </Badge>
                        ))}
                        {selectedSessionAttendance?.presentStudents.length === 0 && (
                          <p className="text-sm text-muted-foreground">لا يوجد طلاب حاضرون</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1">
                        <h4 className="font-bold text-sm text-red-600 flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          الطلاب الغائبون ({selectedSessionAttendance?.absentCount})
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSessionAttendance?.absentStudents.map((name: string) => (
                          <Badge key={name} variant="secondary" className="bg-red-500/10 text-red-700 border-none">
                            {name}
                          </Badge>
                        ))}
                        {selectedSessionAttendance?.absentStudents.length === 0 && (
                          <p className="text-sm text-muted-foreground">لا يوجد طلاب غائبون</p>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>


              <Dialog open={isStudentsDialogOpen} onOpenChange={setIsStudentsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      تفاصيل الطلاب - {teacherPerformanceData.name} ({activePeriodLabel})
                    </DialogTitle>
                  </DialogHeader>
                  <div className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right w-[100px]">م</TableHead>
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-center">النقاط (في الفترة)</TableHead>
                          <TableHead className="text-center">عدد مرات الغياب</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherPerformanceData.studentDetails.map((student: any, index: number) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-none font-bold">
                                {student.periodPoints} نقطة
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-none font-bold">
                                {student.absences} غياب
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {teacherPerformanceData.studentDetails.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        لا يوجد طلاب مسجلين لهذا الأستاذ
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      سجل حضور الطلاب - {teacherPerformanceData.name} ({activePeriodLabel})
                    </DialogTitle>
                  </DialogHeader>
                  <div className="pt-4 space-y-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={attendanceSort === 'attended' ? "default" : "outline"}
                        onClick={() => setAttendanceSort('attended')}
                      >
                        الأكثر حضوراً
                      </Button>
                      <Button
                        size="sm"
                        variant={attendanceSort === 'absent' ? "default" : "outline"}
                        onClick={() => setAttendanceSort('absent')}
                      >
                        الأكثر غياباً
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right w-[60px]">م</TableHead>
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-center">أيام الحضور</TableHead>
                          <TableHead className="text-center">أيام الغياب</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...teacherPerformanceData.studentDetails]
                          .sort((a, b) => {
                            if (attendanceSort === 'attended') return b.attendedDays - a.attendedDays;
                            return b.absences - a.absences;
                          })
                          .map((student: any, index: number) => (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>{student.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-none font-bold">
                                  {student.attendedDays} أيام
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-none font-bold">
                                  {student.absences} أيام
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isPeriodPointsDialogOpen} onOpenChange={setIsPeriodPointsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      ترتيب الطلاب حسب النقاط - {teacherPerformanceData.name} ({activePeriodLabel})
                    </DialogTitle>
                  </DialogHeader>
                  <div className="pt-4 text-center mb-4">
                    <div className="bg-yellow-500/10 text-yellow-700 p-4 rounded-lg border border-yellow-200 inline-block">
                      <p className="text-sm font-medium">إجمالي نقاط الطلاب في هذه الفترة</p>
                      <p className="text-3xl font-bold">{teacherPerformanceData.totalPeriodPoints} نقطة</p>
                    </div>
                  </div>
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right w-[60px]">م</TableHead>
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-center text-blue-600">التسميع</TableHead>
                          <TableHead className="text-center text-green-600">الحضور</TableHead>
                          <TableHead className="text-center text-orange-600">إضافية</TableHead>
                          <TableHead className="text-center text-red-600">أخرى</TableHead>
                          <TableHead className="text-center font-bold text-lg">المجموع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...teacherPerformanceData.studentDetails]
                          .sort((a, b) => b.periodPoints - a.periodPoints)
                          .map((student: any, index: number) => (
                            <TableRow key={student.id} className={index < 3 ? "bg-yellow-50/50" : ""}>
                              <TableCell className="font-medium text-center">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                              </TableCell>
                              <TableCell className="font-semibold">{student.name}</TableCell>
                              <TableCell className="text-center text-blue-600">{student.recitationPoints}</TableCell>
                              <TableCell className="text-center text-green-600">{student.attendancePoints}</TableCell>
                              <TableCell className="text-center text-orange-600">{student.bonusPoints}</TableCell>
                              <TableCell className="text-center text-red-600">{student.checkPoints}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-base">
                                  {student.periodPoints} نقطة
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>


            </>
          )}
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أفضل 20 طالب</CardTitle>
              <CardDescription>الطلاب الحاصلين على أعلى النقاط</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topStudents.map((student) => (
                  <div
                    key={student.rank}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {student.rank}
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.teacher || "بدون أستاذ"}</p>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {student.points} نقطة
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare-teachers" className="space-y-4">
          {/* Teacher Selection */}
          <Card>
            <CardHeader>
              <CardTitle>اختر أستاذين للمقارنة</CardTitle>
              <CardDescription>قارن بين أداء أستاذين مختلفين</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">الأستاذ الأول</label>
                  <Popover open={openTeacher1} onOpenChange={setOpenTeacher1}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openTeacher1}
                        className="w-full justify-between"
                      >
                        {compareTeacher1
                          ? teachers.find((teacher) => teacher.id === compareTeacher1)?.["اسم الاستاذ"]
                          : "اختر الأستاذ الأول"}
                        <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن أستاذ..." />
                        <CommandList>
                          <CommandEmpty>لا يوجد أستاذ</CommandEmpty>
                          <CommandGroup>
                            {teachers.filter(t => t.id !== compareTeacher2).map((teacher) => (
                              <CommandItem
                                key={teacher.id}
                                value={teacher["اسم الاستاذ"]}
                                onSelect={() => {
                                  setCompareTeacher1(teacher.id);
                                  setOpenTeacher1(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    compareTeacher1 === teacher.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{teacher["اسم الاستاذ"]}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {teacher.student_count} طالب - {teacher.class_name}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">الأستاذ الثاني</label>
                  <Popover open={openTeacher2} onOpenChange={setOpenTeacher2}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openTeacher2}
                        className="w-full justify-between"
                      >
                        {compareTeacher2
                          ? teachers.find((teacher) => teacher.id === compareTeacher2)?.["اسم الاستاذ"]
                          : "اختر الأستاذ الثاني"}
                        <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن أستاذ..." />
                        <CommandList>
                          <CommandEmpty>لا يوجد أستاذ</CommandEmpty>
                          <CommandGroup>
                            {teachers.filter(t => t.id !== compareTeacher1).map((teacher) => (
                              <CommandItem
                                key={teacher.id}
                                value={teacher["اسم الاستاذ"]}
                                onSelect={() => {
                                  setCompareTeacher2(teacher.id);
                                  setOpenTeacher2(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    compareTeacher2 === teacher.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{teacher["اسم الاستاذ"]}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {teacher.student_count} طالب - {teacher.class_name}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الفترة الزمنية للمقارنة</CardTitle>
              <CardDescription>حدد الفترة الزمنية لمقارنة الأداء</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activePeriodLabel === "آخر يوم" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subDays(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر يوم");
                  }}
                >
                  آخر يوم
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر أسبوع" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subWeeks(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر أسبوع");
                  }}
                >
                  آخر أسبوع
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر شهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر شهر");
                  }}
                >
                  آخر شهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 3 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 3), to: new Date() });
                    setActivePeriodLabel("آخر 3 أشهر");
                  }}
                >
                  آخر 3 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 6 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 6), to: new Date() });
                    setActivePeriodLabel("آخر 6 أشهر");
                  }}
                >
                  آخر 6 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "تاريخ مخصص" ? "default" : "outline"}
                  onClick={() => setActivePeriodLabel("تاريخ مخصص")}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  تاريخ مخصص
                </Button>
              </div>

              {activePeriodLabel === "تاريخ مخصص" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">من تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "PPP", { locale: ar }) : "اختر تاريخ البدء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">إلى تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "PPP", { locale: ar }) : "اختر تاريخ الانتهاء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {compareTeacher1 && compareTeacher2 && comparisonTableData && (
            <>
              {/* Comparison Statistics Cards */}
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة تفصيلية - المؤشرات الرئيسية</CardTitle>
                  <CardDescription>مقارنة واضحة بين مؤشرات الأستاذين</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right font-bold text-lg w-1/4">المؤشر</TableHead>
                          <TableHead className="text-center font-bold text-lg w-1/4">{comparisonTableData.teacher1.name}</TableHead>
                          <TableHead className="text-center font-bold text-lg w-1/4">{comparisonTableData.teacher2.name}</TableHead>
                          <TableHead className="text-center font-bold text-lg w-1/4">الفرق</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <Users className="w-5 h-5 text-primary" />
                              عدد الطلاب
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.studentCount}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.studentCount}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.studentCount > comparisonTableData.teacher2.studentCount ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.studentCount > comparisonTableData.teacher2.studentCount ? "+" : ""}
                              {comparisonTableData.teacher1.studentCount - comparisonTableData.teacher2.studentCount}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <Zap className="w-5 h-5 text-amber-500" />
                              عدد الجلسات النشطة
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.activeSessions}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.activeSessions}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.activeSessions > comparisonTableData.teacher2.activeSessions ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.activeSessions > comparisonTableData.teacher2.activeSessions ? "+" : ""}
                              {comparisonTableData.teacher1.activeSessions - comparisonTableData.teacher2.activeSessions}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <Trophy className="w-5 h-5 text-yellow-500" />
                              إجمالي النقاط
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.totalPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.totalPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.totalPoints > comparisonTableData.teacher2.totalPoints ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.totalPoints > comparisonTableData.teacher2.totalPoints ? "+" : ""}
                              {comparisonTableData.teacher1.totalPoints - comparisonTableData.teacher2.totalPoints}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="w-5 h-5 text-teal-500" />
                              نقاط الحضور
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.attendancePoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.attendancePoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.attendancePoints > comparisonTableData.teacher2.attendancePoints ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.attendancePoints > comparisonTableData.teacher2.attendancePoints ? "+" : ""}
                              {comparisonTableData.teacher1.attendancePoints - comparisonTableData.teacher2.attendancePoints}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <Target className="w-5 h-5 text-rose-500" />
                              نقاط التسميع
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.recitationPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.recitationPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.recitationPoints > comparisonTableData.teacher2.recitationPoints ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.recitationPoints > comparisonTableData.teacher2.recitationPoints ? "+" : ""}
                              {comparisonTableData.teacher1.recitationPoints - comparisonTableData.teacher2.recitationPoints}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <UserCheck className="w-5 h-5 text-green-500" />
                              نسبة الحضور
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.attendanceRate}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.attendanceRate}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.attendanceRate > comparisonTableData.teacher2.attendanceRate ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.attendanceRate > comparisonTableData.teacher2.attendanceRate ? "+" : ""}
                              {comparisonTableData.teacher1.attendanceRate - comparisonTableData.teacher2.attendanceRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-blue-500" />
                              عدد التسميعات
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.recitationCount}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.recitationCount}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.recitationCount > comparisonTableData.teacher2.recitationCount ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.recitationCount > comparisonTableData.teacher2.recitationCount ? "+" : ""}
                              {comparisonTableData.teacher1.recitationCount - comparisonTableData.teacher2.recitationCount}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold text-base">
                            <div className="flex items-center gap-3">
                              <Star className="w-5 h-5 text-orange-500" />
                              النقاط الإضافية
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-primary">
                              {comparisonTableData.teacher1.bonusPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-3xl font-bold text-chart-2">
                              {comparisonTableData.teacher2.bonusPoints}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={comparisonTableData.teacher1.bonusPoints > comparisonTableData.teacher2.bonusPoints ? "default" : "secondary"}
                              className="text-lg px-3 py-1"
                            >
                              {comparisonTableData.teacher1.bonusPoints > comparisonTableData.teacher2.bonusPoints ? "+" : ""}
                              {comparisonTableData.teacher1.bonusPoints - comparisonTableData.teacher2.bonusPoints}
                            </Badge>
                          </TableCell>
                        </TableRow>


                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>


              {/* Performance Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{comparisonTableData.teacher1.name}</CardTitle>
                    <CardDescription>الأداء العام</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">إجمالي الطلاب</span>
                        <span className="font-semibold">{comparisonTableData.teacher1.studentCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">معدل الأداء</span>
                        <Badge variant="default">
                          {comparisonTableData.teacher1.attendanceRate}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{comparisonTableData.teacher2.name}</CardTitle>
                    <CardDescription>الأداء العام</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">إجمالي الطلاب</span>
                        <span className="font-semibold">{comparisonTableData.teacher2.studentCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">معدل الأداء</span>
                        <Badge variant="default">
                          {comparisonTableData.teacher2.attendanceRate}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {(!compareTeacher1 || !compareTeacher2) && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">اختر أستاذين من الأعلى لبدء المقارنة</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compare Students Tab */}
        <TabsContent value="compare-students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>اختر الطلاب للمقارنة</CardTitle>
              <CardDescription>قارن بين أداء طالبين لفهم نقاط القوة والتحسين</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">الطالب الأول</label>
                  <Popover open={openStudent1} onOpenChange={setOpenStudent1}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openStudent1}
                        className="w-full justify-between"
                      >
                        {compareStudent1
                          ? allStudents.find((s) => s.id === compareStudent1)?.student_name
                          : "اختر الطالب الأول"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن الطالب..." />
                        <CommandList>
                          <CommandEmpty>لم يتم العثور على طلاب</CommandEmpty>
                          <CommandGroup>
                            {allStudents
                              .filter(s => s.id !== compareStudent2)
                              .map((student) => (
                                <CommandItem
                                  key={student.id}
                                  value={student.student_name}
                                  onSelect={() => {
                                    setCompareStudent1(student.id);
                                    setOpenStudent1(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      compareStudent1 === student.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{student.student_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {student.grade || "غير محدد"} - {student.current_teacher || "لا يوجد أستاذ"}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">الطالب الثاني</label>
                  <Popover open={openStudent2} onOpenChange={setOpenStudent2}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openStudent2}
                        className="w-full justify-between"
                      >
                        {compareStudent2
                          ? allStudents.find((s) => s.id === compareStudent2)?.student_name
                          : "اختر الطالب الثاني"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن الطالب..." />
                        <CommandList>
                          <CommandEmpty>لم يتم العثور على طلاب</CommandEmpty>
                          <CommandGroup>
                            {allStudents
                              .filter(s => s.id !== compareStudent1)
                              .map((student) => (
                                <CommandItem
                                  key={student.id}
                                  value={student.student_name}
                                  onSelect={() => {
                                    setCompareStudent2(student.id);
                                    setOpenStudent2(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      compareStudent2 === student.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{student.student_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {student.grade || "غير محدد"} - {student.current_teacher || "لا يوجد أستاذ"}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الفترة الزمنية للمقارنة</CardTitle>
              <CardDescription>حدد الفترة الزمنية لمقارنة الطلاب</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activePeriodLabel === "آخر يوم" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subDays(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر يوم");
                  }}
                >
                  آخر يوم
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر أسبوع" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subWeeks(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر أسبوع");
                  }}
                >
                  آخر أسبوع
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر شهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
                    setActivePeriodLabel("آخر شهر");
                  }}
                >
                  آخر شهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 3 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 3), to: new Date() });
                    setActivePeriodLabel("آخر 3 أشهر");
                  }}
                >
                  آخر 3 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "آخر 6 أشهر" ? "default" : "outline"}
                  onClick={() => {
                    setDateRange({ from: subMonths(new Date(), 6), to: new Date() });
                    setActivePeriodLabel("آخر 6 أشهر");
                  }}
                >
                  آخر 6 أشهر
                </Button>
                <Button
                  variant={activePeriodLabel === "تاريخ مخصص" ? "default" : "outline"}
                  onClick={() => setActivePeriodLabel("تاريخ مخصص")}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  تاريخ مخصص
                </Button>
              </div>

              {activePeriodLabel === "تاريخ مخصص" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">من تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "PPP", { locale: ar }) : "اختر تاريخ البدء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-right">إلى تاريخ</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "PPP", { locale: ar }) : "اختر تاريخ الانتهاء"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {compareStudent1 && compareStudent2 && studentComparisonTable && (
            <>
              {/* Numerical Comparison Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Total Points */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-emerald-500/20 hover:border-emerald-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي النقاط</CardTitle>
                      <Trophy className="w-5 h-5 text-yellow-500 animate-pulse" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.totalPoints}</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.totalPoints}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Attendance Rate */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-blue-500/20 hover:border-blue-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-100">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">نسبة الحضور</CardTitle>
                      <CalendarIcon className="w-5 h-5 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.attendanceRate}%</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.attendanceRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recitation Points */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-purple-500/20 hover:border-purple-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">نقاط التسميع</CardTitle>
                      <Target className="w-5 h-5 text-purple-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.recitationPoints}</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.recitationPoints}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Attendance Points */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-teal-500/20 hover:border-teal-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-300">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">نقاط الحضور</CardTitle>
                      <CheckCircle className="w-5 h-5 text-teal-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.attendancePoints}</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.attendancePoints}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bonus Points */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-orange-500/20 hover:border-orange-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">النقاط الإضافية</CardTitle>
                      <Star className="w-5 h-5 text-orange-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.bonusPoints}</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.bonusPoints}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recitation Count */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-indigo-500/20 hover:border-indigo-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">عدد التسميعات</CardTitle>
                      <BookOpen className="w-5 h-5 text-indigo-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.recitationCount}</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.recitationCount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tools Rate */}
                <Card className="animate-slide-up bg-card/60 backdrop-blur-sm border-rose-500/20 hover:border-rose-500/50 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 transition-delay-600">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">نسبة الأدوات</CardTitle>
                      <Zap className="w-5 h-5 text-rose-500 animate-pulse" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student1.name}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">{studentComparisonTable.student1.toolsRate}%</span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{studentComparisonTable.student2.name}</span>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 animate-fade-in">{studentComparisonTable.student2.toolsRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Comparison Table */}
              <Card>
                <CardHeader>
                  <CardTitle>جدول المقارنة التفصيلي</CardTitle>
                  <CardDescription>مقارنة رقمية دقيقة بين الطالبين</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المعيار</TableHead>
                        <TableHead className="text-center">{studentComparisonTable.student1.name}</TableHead>
                        <TableHead className="text-center">{studentComparisonTable.student2.name}</TableHead>
                        <TableHead className="text-center">الفرق</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-500" />
                            إجمالي النقاط
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.totalPoints}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.totalPoints}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.totalPoints > studentComparisonTable.student2.totalPoints ? "default" : "secondary"}>
                            {studentComparisonTable.student1.totalPoints > studentComparisonTable.student2.totalPoints ? "+" : ""}
                            {studentComparisonTable.student1.totalPoints - studentComparisonTable.student2.totalPoints}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-green-500" />
                            نقاط الحضور
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.attendancePoints}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.attendancePoints}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.attendancePoints > studentComparisonTable.student2.attendancePoints ? "default" : "secondary"}>
                            {studentComparisonTable.student1.attendancePoints > studentComparisonTable.student2.attendancePoints ? "+" : ""}
                            {studentComparisonTable.student1.attendancePoints - studentComparisonTable.student2.attendancePoints}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            نقاط التسميع
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.recitationPoints}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.recitationPoints}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.recitationPoints > studentComparisonTable.student2.recitationPoints ? "default" : "secondary"}>
                            {studentComparisonTable.student1.recitationPoints > studentComparisonTable.student2.recitationPoints ? "+" : ""}
                            {studentComparisonTable.student1.recitationPoints - studentComparisonTable.student2.recitationPoints}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            النقاط الإضافية
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.bonusPoints}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.bonusPoints}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.bonusPoints > studentComparisonTable.student2.bonusPoints ? "default" : "secondary"}>
                            {studentComparisonTable.student1.bonusPoints > studentComparisonTable.student2.bonusPoints ? "+" : ""}
                            {studentComparisonTable.student1.bonusPoints - studentComparisonTable.student2.bonusPoints}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            نسبة الحضور %
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.attendanceRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.attendanceRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.attendanceRate > studentComparisonTable.student2.attendanceRate ? "default" : "secondary"}>
                            {studentComparisonTable.student1.attendanceRate > studentComparisonTable.student2.attendanceRate ? "+" : ""}
                            {(studentComparisonTable.student1.attendanceRate - studentComparisonTable.student2.attendanceRate).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-500" />
                            عدد التسميعات
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.recitationCount}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.recitationCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.recitationCount > studentComparisonTable.student2.recitationCount ? "default" : "secondary"}>
                            {studentComparisonTable.student1.recitationCount > studentComparisonTable.student2.recitationCount ? "+" : ""}
                            {studentComparisonTable.student1.recitationCount - studentComparisonTable.student2.recitationCount}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-teal-500" />
                            نسبة الأدوات %
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student1.toolsRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {studentComparisonTable.student2.toolsRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={studentComparisonTable.student1.toolsRate > studentComparisonTable.student2.toolsRate ? "default" : "secondary"}>
                            {studentComparisonTable.student1.toolsRate > studentComparisonTable.student2.toolsRate ? "+" : ""}
                            {(studentComparisonTable.student1.toolsRate - studentComparisonTable.student2.toolsRate).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Performance Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{studentComparisonTable.student1.name}</CardTitle>
                    <CardDescription>الأداء العام</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">إجمالي النقاط</span>
                        <span className="font-bold text-xl">{studentComparisonTable.student1.totalPoints}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">معدل الأداء</span>
                        <Badge variant="default">
                          {Math.round((
                            studentComparisonTable.student1.attendanceRate +
                            studentComparisonTable.student1.toolsRate
                          ) / 2)}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{studentComparisonTable.student2.name}</CardTitle>
                    <CardDescription>الأداء العام</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">إجمالي النقاط</span>
                        <span className="font-bold text-xl">{studentComparisonTable.student2.totalPoints}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">معدل الأداء</span>
                        <Badge variant="default">
                          {Math.round((
                            studentComparisonTable.student2.attendanceRate +
                            studentComparisonTable.student2.toolsRate
                          ) / 2)}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {(!compareStudent1 || !compareStudent2) && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">اختر طالبين من الأعلى لبدء المقارنة</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs >
    </div >
  );
}

export default AdminAnalytics;
