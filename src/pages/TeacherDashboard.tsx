import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/StatsCard";
import { Users, CheckCircle, BookOpen, Settings, MessageCircle, Calendar, Check, Plus, RotateCcw, Copy, FileText as FileTextIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cacheStudents, getCachedStudents, mergeAttendanceData } from "@/lib/offlineStorage";
import { Button } from "@/components/ui/button";
import TeacherAccountSettings from "@/components/TeacherAccountSettings";
import SimpleTeacherSettings from "@/components/SimpleTeacherSettings";
import AttendanceDialog from "@/components/AttendanceDialog";
import RecitationDialog from "@/components/RecitationDialog";
import StudentDetailsDialog from "@/components/StudentDetailsDialog";
import StudentRecordDialog from "@/components/StudentRecordDialog";
import BonusPointsDialog from "@/components/BonusPointsDialog";
import StudentsListView from "@/components/StudentsListView";
import TeacherReportsDialog from "@/components/TeacherReportsDialog";
import { FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useRequireAuth } from "@/hooks/useRequireAuth";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showRecitation, setShowRecitation] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [studentAttendance, setStudentAttendance] = useState<Record<string, string>>({});
  const [studentRecitations, setStudentRecitations] = useState<Record<string, boolean>>({});
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [studentDailyPoints, setStudentDailyPoints] = useState<Record<string, number>>({});
  const [studentBonusPoints, setStudentBonusPoints] = useState<Record<string, {
    points: number;
    type: "add" | "deduct";
  }>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showStopSessionConfirm, setShowStopSessionConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "mobile">(() => localStorage.getItem("view_mode") as any || "grid");
  const [showReports, setShowReports] = useState(false);
  const [showUnrecordedWarning, setShowUnrecordedWarning] = useState(false);
  const [pendingSummaryAction, setPendingSummaryAction] = useState<'generate' | 'copy' | null>(null);
  const [unrecordedStudents, setUnrecordedStudents] = useState<string[]>([]);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingStudentIds, setLoadingStudentIds] = useState<string[]>([]); // الطلاب قيد التحديث

  // Compute filtered students for supervisor view
  const filteredStudents = useMemo(() => {
    if (isSupervisor && selectedTeacherId !== "all") {
      return students.filter(s => s.teacher_id === selectedTeacherId);
    }
    return students;
  }, [students, isSupervisor, selectedTeacherId]);

  const studentsCount = filteredStudents.length;

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "teacher" && user.role !== "supervisor") {
        toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
        navigate("/login");
        return;
      }
      fetchTeacherStudents(user);
    }

    if (!authLoading && !user) {
      navigate("/login");
    }

    // تطبيق الوضع الليلي عند التحميل
    const themeMode = localStorage.getItem("theme_mode");
    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // الاستماع لتغييرات طريقة العرض
    const handleViewModeChange = (e: any) => {
      setViewMode(e.detail);
    };
    window.addEventListener("viewModeChange", handleViewModeChange);
    return () => {
      window.removeEventListener("viewModeChange", handleViewModeChange);
    };
  }, [user, navigate]);

  // useEffect لتحديث البيانات عند تغيير التاريخ
  useEffect(() => {
    if (teacherId && students.length > 0) {
      fetchTodayAttendance(students);
      checkTeachingSession(teacherId, selectedDate);
    }
  }, [selectedDate, teacherId]);
  const fetchTeacherStudents = async (user: any) => {
    try {
      // Check if user is a supervisor
      const userIsSupervisor = user.role === "supervisor";
      setIsSupervisor(userIsSupervisor);

      // فحص حالة الاتصال
      if (!navigator.onLine) {
        // وضع Offline - استخدام الـ cache
        const cachedStudents = getCachedStudents();
        if (cachedStudents.length > 0) {
          setStudents(cachedStudents);
          toast.info("يتم العرض من البيانات المحفوظة محلياً - الوضع Offline");
        } else {
          toast.error("لا توجد بيانات محفوظة محلياً");
        }
        setDataLoading(false);
        return;
      }

      // If supervisor, fetch all teachers and all students
      if (userIsSupervisor) {
        // Fetch all teachers
        const { data: teachersData } = await supabase
          .from("teachers")
          .select("id, \"اسم الاستاذ\"")
          .order("اسم الاستاذ");
        setAllTeachers(teachersData || []);

        // Fetch all students
        const { data: allStudentsData, error: studentsError } = await supabase
          .from("students")
          .select(`
            *,
            points_balance(total),
            students_profiles(last_memorization),
            teachers("اسم الاستاذ")
          `);
        if (studentsError) throw studentsError;

        // Filter active students
        const activeStatuses = ['مسجل', 'غير مدرج بعد', 'انتظار', 'فترة تجربة'];
        const filteredStudents = (allStudentsData || []).filter(s =>
          s.registration_status !== 'غير مسجل' &&
          (!s.registration_status || activeStatuses.includes(s.registration_status))
        );

        setStudents(filteredStudents);
        setDataLoading(false);
        return;
      }

      // وضع Online - جلب من Supabase
      // 1) حاول إيجاد الأستاذ عبر الربط المباشر user_id
      const {
        data: byUser,
        error: byUserErr
      } = await supabase.from("teachers").select("id, \"اسم الاستاذ\", user_id, \"البريد_الالكتروني\"").eq("user_id", user.id).maybeSingle();
      let teacherRec = byUser as any | null;

      // 2) إن لم يوجد ربط، جرّب المطابقة عبر البريد الإلكتروني
      if (!teacherRec && user.email) {
        const {
          data: allTeachers
        } = await supabase.from("teachers").select("id, \"اسم الاستاذ\", user_id, \"البريد_الالكتروني\"");
        const foundByEmail = (allTeachers || []).find((t: any) => t?.البريد_الالكتروني && t.البريد_الالكتروني.toLowerCase() === String(user.email).toLowerCase());
        if (foundByEmail) teacherRec = foundByEmail;
      }

      // 3) إن لم نجد بالبريد، حاول باسم الأستاذ
      if (!teacherRec && user.name) {
        const {
          data: allTeachersByName
        } = await supabase.from("teachers").select("id, \"اسم الاستاذ\", user_id, \"البريد_الالكتروني\"");
        const foundByName = (allTeachersByName || []).find((t: any) => t?.["اسم الاستاذ"] === user.name);
        if (foundByName) teacherRec = foundByName;
      }

      // 4) في حال وُجد أستاذ بلا ربط سابق، اربطه بالمستخدم الحالي لتثبيت العلاقة
      if (teacherRec && !teacherRec.user_id) {
        await supabase.from("teachers").update({
          user_id: user.id
        }).eq("id", teacherRec.id);
      }
      if (!teacherRec) {
        setStudents([]);
        setDataLoading(false);
        return;
      }

      // 5) جلب الطلاب بطريقتين: (teacher_id) أو (current_teacher) بالاسم كحلّ احتياطي
      const fetchedTeacherId = teacherRec.id as string;
      const teacherName = teacherRec["اسم الاستاذ"] as string;

      // حفظ teacher_id في الـ state
      setTeacherId(fetchedTeacherId);
      const {
        data: byId,
        error: errById
      } = await supabase.from("students").select(`
          *,
          points_balance(total),
          students_profiles(last_memorization)
        `).eq("teacher_id", fetchedTeacherId);
      if (errById) throw errById;
      let merged = byId || [];

      // إن لم يرجع شيء (أو لإدماج الحالات القديمة)، جرّب المطابقة بالاسم
      const {
        data: byName,
        error: errByName
      } = await supabase.from("students").select(`
          *,
          points_balance(total),
          students_profiles(last_memorization)
        `).eq("current_teacher", teacherName);
      if (errByName) throw errByName;

      // دمج النتائج مع إزالة التكرار حسب id
      const map: Record<string, any> = {};
      [...(merged || []), ...(byName || [])].forEach(s => map[s.id] = s);
      merged = Object.values(map);

      // فلترة الطلاب لإظهار فقط من لديهم حالة تسجيل: مسجل، غير مدرج بعد، انتظار، فترة تجربة
      // استبعاد الطلاب بحالة "غير مسجل" نهائياً
      const activeStatuses = ['مسجل', 'غير مدرج بعد', 'انتظار', 'فترة تجربة'];
      const filteredStudents = merged.filter(s =>
        s.registration_status !== 'غير مسجل' &&
        (!s.registration_status || activeStatuses.includes(s.registration_status))
      );

      setStudents(filteredStudents);

      // حفظ الطلاب محلياً للاستخدام في وضع Offline
      cacheStudents(filteredStudents, fetchedTeacherId);

      // جلب حالة الحضور لليوم المحدد
      await fetchTodayAttendance(merged);

      // فحص حالة الدوام بعد جلب teacherId
      await checkTeachingSession(fetchedTeacherId, selectedDate);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل الطلاب");
    } finally {
      setDataLoading(false);
    }
  };
  const fetchTodayAttendance = async (studentsList: any[]) => {
    // التحقق من أن التاريخ صحيح
    if (!selectedDate || selectedDate.trim() === '') {
      return;
    }

    try {
      const studentIds = studentsList.map(s => s.id);

      // جلب بيانات الحضور لليوم المحدد
      const {
        data: attData,
        error: attError
      } = await supabase.from("attendance").select("student_id, status, points").eq("date", selectedDate).in("student_id", studentIds);
      if (attError) throw attError;
      const attendanceMap: Record<string, string> = {};
      attData?.forEach(att => {
        attendanceMap[att.student_id] = att.status;
      });

      // دمج البيانات المحلية مع البيانات من السيرفر
      const mergedAttendance = mergeAttendanceData(attendanceMap, studentsList, selectedDate);
      setStudentAttendance(mergedAttendance);

      // جلب بيانات التسميع لليوم المحدد
      const {
        data: recData,
        error: recError
      } = await supabase.from("recitations").select("student_id, points_awarded").eq("date", selectedDate).in("student_id", studentIds);
      if (recError) throw recError;
      const recitationsMap: Record<string, boolean> = {};
      recData?.forEach(rec => {
        recitationsMap[rec.student_id] = true;
      });
      setStudentRecitations(recitationsMap);

      // جلب النقاط الإضافية لليوم المحدد
      const {
        data: bonusData,
        error: bonusError
      } = await supabase.from("bonus_points").select("student_id, points").eq("date", selectedDate).in("student_id", studentIds);
      if (bonusError) throw bonusError;

      // جلب تفقد الأدوات لليوم المحدد
      const {
        data: checkData,
        error: checkError
      } = await supabase.from("check_records").select("student_id, item_id, status, points").eq("date", selectedDate).in("student_id", studentIds);
      if (checkError) throw checkError;

      // حساب النقاط اليومية ونوع النقاط الإضافية لكل طالب (مع تفقد الأدوات)
      const dailyPointsMap: Record<string, number> = {};
      const bonusPointsMap: Record<string, {
        points: number;
        type: "add" | "deduct";
      }> = {};

      // خريطة لنقاط تفقد الأدوات لكل طالب
      const checkPointsMap: Record<string, number> = {};
      (checkData || []).forEach(r => {
        // r.points يحتوي بالفعل على القيمة الصحيحة (موجبة أو سالبة)
        checkPointsMap[r.student_id] = (checkPointsMap[r.student_id] || 0) + (r.points || 0);
      });
      studentIds.forEach(studentId => {
        const attPoints = attData?.find(a => a.student_id === studentId)?.points || 0;
        const recPoints = recData?.filter(r => r.student_id === studentId).reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
        const bonPoints = bonusData?.filter(b => b.student_id === studentId).reduce((sum, b) => sum + (b.points || 0), 0) || 0;
        const chkPoints = checkPointsMap[studentId] || 0;
        dailyPointsMap[studentId] = attPoints + recPoints + bonPoints + chkPoints;

        // تحديد نوع النقاط الإضافية
        const studentBonus = bonusData?.find(b => b.student_id === studentId);
        if (studentBonus) {
          bonusPointsMap[studentId] = {
            points: studentBonus.points,
            type: studentBonus.points > 0 ? "add" : "deduct"
          };
        }
      });
      setStudentDailyPoints(dailyPointsMap);
      setStudentBonusPoints(bonusPointsMap);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };
  const checkTeachingSession = async (teacherId: string, date: string) => {
    // التحقق من أن التاريخ صحيح
    if (!date || date.trim() === '') {
      setIsSessionActive(false);
      return;
    }

    try {
      const {
        data,
        error
      } = await supabase.from("teaching_sessions").select("is_active").eq("teacher_id", teacherId).eq("session_date", date).maybeSingle();
      if (error) throw error;
      setIsSessionActive(data?.is_active || false);
    } catch (error) {
      console.error("Error checking session:", error);
      setIsSessionActive(false);
    }
  };
  const toggleSession = async () => {
    if (!teacherId) {
      toast.error("لم يتم العثور على معرف الأستاذ");
      return;
    }

    // إذا كان الدوام مفعلاً، اطلب التأكيد قبل الإلغاء
    if (isSessionActive) {
      setShowStopSessionConfirm(true);
      return;
    }

    // إذا كان الدوام غير مفعل، ابدأه مباشرة
    await startSession();
  };
  const startSession = async () => {
    if (!teacherId) return;

    // التحقق من أن التاريخ صحيح
    if (!selectedDate || selectedDate.trim() === '') {
      toast.error("التاريخ غير صحيح");
      return;
    }

    setCheckingSession(true);
    try {
      // التأكد من ربط المعلم بالمستخدم الحالي
      if (user?.id) {
        const {
          data: teacherData
        } = await supabase.from("teachers").select("user_id").eq("id", teacherId).single();

        // إذا لم يكن المعلم مربوطاً بـ user_id، قم بربطه
        if (teacherData && !teacherData.user_id) {
          await supabase.from("teachers").update({
            user_id: user.id
          }).eq("id", teacherId);
        }
      }

      // التحقق من وجود جلسة
      const {
        data: existing
      } = await supabase.from("teaching_sessions").select("id, is_active").eq("teacher_id", teacherId).eq("session_date", selectedDate).maybeSingle();
      if (existing) {
        // تحديث الجلسة الموجودة لتفعيلها
        const {
          error
        } = await supabase.from("teaching_sessions").update({
          is_active: true,
          started_at: new Date().toISOString()
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        // إنشاء جلسة جديدة
        const {
          error
        } = await supabase.from("teaching_sessions").insert({
          teacher_id: teacherId,
          session_date: selectedDate,
          is_active: true,
          started_at: new Date().toISOString()
        });
        if (error) throw error;
      }
      setIsSessionActive(true);
      toast.success("✅ تم تفعيل الدوام بنجاح");
    } catch (error: any) {
      console.error("Error starting session:", error);
      toast.error(`حدث خطأ في بدء الدوام: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setCheckingSession(false);
    }
  };
  const stopSession = async () => {
    if (!teacherId) return;

    // التحقق من أن التاريخ صحيح
    if (!selectedDate || selectedDate.trim() === '') {
      toast.error("التاريخ غير صحيح");
      return;
    }

    setCheckingSession(true);
    try {
      const {
        data: existing
      } = await supabase.from("teaching_sessions").select("id").eq("teacher_id", teacherId).eq("session_date", selectedDate).maybeSingle();
      if (existing) {
        const {
          error
        } = await supabase.from("teaching_sessions").update({
          is_active: false,
          ended_at: new Date().toISOString()
        }).eq("id", existing.id);
        if (error) throw error;
        setIsSessionActive(false);
        toast.success("تم إلغاء الدوام - لن تُحتسب هذه الجلسة");
      }
    } catch (error) {
      console.error("Error stopping session:", error);
      toast.error("حدث خطأ في إيقاف الدوام");
    } finally {
      setCheckingSession(false);
      setShowStopSessionConfirm(false);
    }
  };
  if (authLoading || dataLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  const checkUnrecordedAttendance = (action: 'generate' | 'copy') => {
    const unrecorded = filteredStudents.filter(s => !studentAttendance[s.id]).map(s => s.student_name);

    if (unrecorded.length > 0) {
      setUnrecordedStudents(unrecorded);
      setPendingSummaryAction(action);
      setShowUnrecordedWarning(true);
    } else {
      if (action === 'generate') {
        generateDailySummary();
      } else {
        copyDailySummary();
      }
    }
  };

  const proceedWithSummary = () => {
    setShowUnrecordedWarning(false);
    if (pendingSummaryAction === 'generate') {
      generateDailySummary();
    } else if (pendingSummaryAction === 'copy') {
      copyDailySummary();
    }
    setPendingSummaryAction(null);
    setUnrecordedStudents([]);
  };

  const generateDailySummary = async () => {
    const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // إحصائيات الحضور
    const presentCount = Object.values(studentAttendance).filter(s => s === 'حاضر').length;
    const absentCount = Object.values(studentAttendance).filter(s => s === 'غائب').length;
    const excusedCount = Object.values(studentAttendance).filter(s => s === 'اعتذر').length;
    const notRecordedCount = studentsCount - presentCount - absentCount - excusedCount;

    // جلب التسميع لليوم
    const {
      data: todayRecitations
    } = await supabase.from("recitations").select("student_id, last_saved, rating").eq("date", selectedDate).in("student_id", filteredStudents.map(s => s.id));
    const recitationsMap: Record<string, Array<{
      page: string;
      rating: string;
    }>> = {};
    todayRecitations?.forEach(rec => {
      if (!recitationsMap[rec.student_id]) recitationsMap[rec.student_id] = [];
      recitationsMap[rec.student_id].push({
        page: rec.last_saved,
        rating: rec.rating
      });
    });

    // جلب تفقد الأدوات لليوم مع أسماء العناصر
    const {
      data: todayChecks
    } = await supabase.from("check_records").select("student_id, item_id, status, points").eq("date", selectedDate).in("student_id", filteredStudents.map(s => s.id));
    const itemIds = Array.from(new Set((todayChecks || []).map(c => c.item_id)));
    let itemsMap: Record<string, {
      name: string;
      points: number;
    }> = {};
    if (itemIds.length > 0) {
      const {
        data: items
      } = await supabase.from("check_items").select("id, name, points").in("id", itemIds as any);
      items?.forEach((it: any) => {
        itemsMap[it.id] = {
          name: it.name,
          points: it.points
        };
      });
    }
    const checksTextMap: Record<string, string> = {};
    (todayChecks || []).forEach((c: any) => {
      const it = itemsMap[c.item_id];
      if (!it) return;
      const delta = c.status === 'موجود' ? c.points ?? it.points ?? 0 : c.status === 'غير موجود' ? -(c.points ?? it.points ?? 0) : 0;
      const part = `${it.name} (${delta > 0 ? '+' : ''}${delta})`;
      if (checksTextMap[c.student_id]) {
        checksTextMap[c.student_id] += `، ${part}`;
      } else {
        checksTextMap[c.student_id] = part;
      }
    });

    // جلب النقاط الإضافية لليوم
    const {
      data: todayBonusPoints
    } = await supabase.from("bonus_points").select("student_id, points, reason").eq("date", selectedDate).in("student_id", students.map(s => s.id));
    const bonusPointsMap: Record<string, Array<{
      points: number;
      reason: string;
    }>> = {};
    todayBonusPoints?.forEach(bp => {
      if (!bonusPointsMap[bp.student_id]) bonusPointsMap[bp.student_id] = [];
      bonusPointsMap[bp.student_id].push({
        points: bp.points,
        reason: bp.reason
      });
    });

    const message = `📊 تقرير يومي - ${dateStr}\n\n` + `👥 عدد الطلاب: ${studentsCount}\n` + `✅ حاضر: ${presentCount}\n` + `❌ غائب: ${absentCount}\n` + `⚠️ اعتذر: ${excusedCount}\n` + `⏳ لم يُسجّل: ${notRecordedCount}\n\n` + `📋 قائمة الطلاب:\n` + students.map((s, i) => {
      const status = studentAttendance[s.id] || 'لم يُسجّل';
      const dailyPoints = studentDailyPoints[s.id] || 0;
      const dailyPointsStr = dailyPoints > 0 ? `+${dailyPoints}` : dailyPoints < 0 ? `${dailyPoints}` : '0';
      const recitations = recitationsMap[s.id] || [];
      const recitationText = recitations.length > 0 ? `\n   • تسميع: ${recitations.map(r => `${r.page} (${r.rating})`).join(', ')}` : '';
      const checksText = checksTextMap[s.id] ? `\n   • تفقد: ${checksTextMap[s.id]}` : '';
      const bonusPoints = bonusPointsMap[s.id] || [];
      const bonusText = bonusPoints.length > 0 ? `\n   • نقاط إضافية: ${bonusPoints.map(bp => `${bp.points > 0 ? '+' : ''}${bp.points} (${bp.reason})`).join(', ')}` : '';
      return `${i + 1}. ${s.student_name}\n   • الحالة: ${status}\n   • نقاط اليوم: ${dailyPointsStr}${recitationText}${checksText}${bonusText}`;
    }).join('\n\n');
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };
  const copyDailySummary = async () => {
    setLoadingSummary(true);
    try {
      const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const presentCount = Object.values(studentAttendance).filter(s => s === 'حاضر').length;
      const absentCount = Object.values(studentAttendance).filter(s => s === 'غائب').length;
      const excusedCount = Object.values(studentAttendance).filter(s => s === 'اعتذر').length;
      const notRecordedCount = studentsCount - presentCount - absentCount - excusedCount;
      const {
        data: todayRecitations
      } = await supabase.from("recitations").select("student_id, last_saved, rating").eq("date", selectedDate).in("student_id", students.map(s => s.id));
      const recitationsMap: Record<string, Array<{
        page: string;
        rating: string;
      }>> = {};
      todayRecitations?.forEach(rec => {
        if (!recitationsMap[rec.student_id]) recitationsMap[rec.student_id] = [];
        recitationsMap[rec.student_id].push({
          page: rec.last_saved,
          rating: rec.rating
        });
      });
      const {
        data: todayChecks
      } = await supabase.from("check_records").select("student_id, item_id, status, points").eq("date", selectedDate).in("student_id", students.map(s => s.id));
      const itemIds = Array.from(new Set((todayChecks || []).map(c => c.item_id)));
      let itemsMap: Record<string, {
        name: string;
        points: number;
      }> = {};
      if (itemIds.length > 0) {
        const {
          data: items
        } = await supabase.from("check_items").select("id, name, points").in("id", itemIds as any);
        items?.forEach((it: any) => {
          itemsMap[it.id] = {
            name: it.name,
            points: it.points
          };
        });
      }
      const checksTextMap: Record<string, string> = {};
      (todayChecks || []).forEach((c: any) => {
        const it = itemsMap[c.item_id];
        if (!it) return;
        const delta = c.status === 'موجود' ? c.points ?? it.points ?? 0 : c.status === 'غير موجود' ? -(c.points ?? it.points ?? 0) : 0;
        const part = `${it.name} (${delta > 0 ? '+' : ''}${delta})`;
        if (checksTextMap[c.student_id]) {
          checksTextMap[c.student_id] += `، ${part}`;
        } else {
          checksTextMap[c.student_id] = part;
        }
      });

      // جلب النقاط الإضافية لليوم
      const {
        data: todayBonusPoints
      } = await supabase.from("bonus_points").select("student_id, points, reason").eq("date", selectedDate).in("student_id", filteredStudents.map(s => s.id));
      const bonusPointsMap: Record<string, Array<{
        points: number;
        reason: string;
      }>> = {};
      todayBonusPoints?.forEach(bp => {
        if (!bonusPointsMap[bp.student_id]) bonusPointsMap[bp.student_id] = [];
        bonusPointsMap[bp.student_id].push({
          points: bp.points,
          reason: bp.reason
        });
      });

      const message = `📊 تقرير يومي - ${dateStr}\n\n` + `👥 عدد الطلاب: ${studentsCount}\n` + `✅ حاضر: ${presentCount}\n` + `❌ غائب: ${absentCount}\n` + `⚠️ اعتذر: ${excusedCount}\n` + `⏳ لم يُسجّل: ${notRecordedCount}\n\n` + `📋 قائمة الطلاب:\n` + filteredStudents.map((s, i) => {
        const status = studentAttendance[s.id] || 'لم يُسجّل';
        const dailyPoints = studentDailyPoints[s.id] || 0;
        const dailyPointsStr = dailyPoints > 0 ? `+${dailyPoints}` : dailyPoints < 0 ? `${dailyPoints}` : '0';
        const recitations = recitationsMap[s.id] || [];
        const recitationText = recitations.length > 0 ? `\n   • تسميع: ${recitations.map(r => `${r.page} (${r.rating})`).join(', ')}` : '';
        const checksText = checksTextMap[s.id] ? `\n   • تفقد: ${checksTextMap[s.id]}` : '';
        const bonusPoints = bonusPointsMap[s.id] || [];
        const bonusText = bonusPoints.length > 0 ? `\n   • نقاط إضافية: ${bonusPoints.map(bp => `${bp.points > 0 ? '+' : ''}${bp.points} (${bp.reason})`).join(', ')}` : '';
        return `${i + 1}. ${s.student_name}\n   • الحالة: ${status}\n   • نقاط اليوم: ${dailyPointsStr}${recitationText}${checksText}${bonusText}`;
      }).join('\n\n');

      setSummaryText(message);
      setShowSummaryDialog(true);
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("حدث خطأ في تحميل الملخص");
    } finally {
      setLoadingSummary(false);
    }
  };
  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    setShowDetails(true);
  };
  const handleAttendance = (student: any) => {
    setSelectedStudent({
      ...student,
      currentStatus: studentAttendance[student.id]
    });
    setShowAttendance(true);
  };
  const handleRecitation = (student: any) => {
    setSelectedStudent(student);
    setShowRecitation(true);
  };
  const handleShowRecord = (student: any) => {
    setSelectedStudent(student);
    setShowRecord(true);
  };
  const handleBonusPoints = (student: any) => {
    setSelectedStudent(student);
    setShowBonusPoints(true);
  };
  const refreshData = async () => {
    if (user) {
      await fetchTeacherStudents(user);
      if (students.length > 0) {
        await fetchTodayAttendance(students);
      }
    }
  };
  // دالة التحديث المحلي لبيانات الطالب دون إعادة تحميل الصفحة
  const handleLocalStudentUpdate = (studentId: string, updatedFields: any) => {
    setStudents(prevStudents =>
      prevStudents.map(student =>
        student.id === studentId ? { ...student, ...updatedFields } : student
      )
    );

    // تحديث الطالب المحدد أيضاً إذا كان مفتوحاً
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent(prev => ({ ...prev, ...updatedFields }));
    }
  };

  // دالة التحديث الجزئي لطالب واحد فقط - تحسين الأداء
  const updateSingleStudentData = async (studentId: string) => {
    if (!studentId || !selectedDate) return;

    // إضافة الطالب لقائمة التحميل
    setLoadingStudentIds(prev => [...prev, studentId]);

    try {
      // جلب بيانات الحضور لهذا الطالب فقط
      const [attResult, recResult, bonusResult, checkResult] = await Promise.all([
        supabase
          .from("attendance")
          .select("status, points")
          .eq("date", selectedDate)
          .eq("student_id", studentId)
          .maybeSingle(),
        supabase
          .from("recitations")
          .select("points_awarded")
          .eq("date", selectedDate)
          .eq("student_id", studentId),
        supabase
          .from("bonus_points")
          .select("points")
          .eq("date", selectedDate)
          .eq("student_id", studentId),
        supabase
          .from("check_records")
          .select("points")
          .eq("date", selectedDate)
          .eq("student_id", studentId)
      ]);

      // تحديث حالة الحضور
      if (attResult.data) {
        setStudentAttendance(prev => ({
          ...prev,
          [studentId]: attResult.data.status
        }));
      }

      // تحديث حالة التسميع
      const hasRecitation = (recResult.data?.length || 0) > 0;
      setStudentRecitations(prev => ({
        ...prev,
        [studentId]: hasRecitation
      }));

      // حساب وتحديث النقاط اليومية
      const attPoints = attResult.data?.points || 0;
      const recPoints = recResult.data?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
      const bonusPoints = bonusResult.data?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      const checkPoints = checkResult.data?.reduce((sum, c) => sum + (c.points || 0), 0) || 0;

      const totalDailyPoints = attPoints + recPoints + bonusPoints + checkPoints;

      setStudentDailyPoints(prev => ({
        ...prev,
        [studentId]: totalDailyPoints
      }));

      // تحديث نوع النقاط الإضافية
      if (bonusResult.data && bonusResult.data.length > 0) {
        const lastBonus = bonusResult.data[bonusResult.data.length - 1];
        setStudentBonusPoints(prev => ({
          ...prev,
          [studentId]: {
            points: lastBonus.points,
            type: lastBonus.points > 0 ? "add" : "deduct"
          }
        }));
      }
    } catch (error) {
      console.error("Error updating single student data:", error);
    } finally {
      // إزالة الطالب من قائمة التحميل
      setLoadingStudentIds(prev => prev.filter(id => id !== studentId));
    }
  };
  const getStudentCardColor = (studentId: string) => {
    const status = studentAttendance[studentId];
    if (status === 'حاضر') return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
    if (status === 'غائب') return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
    if (status === 'اعتذر') return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    return '';
  };
  const handleResetDay = async () => {
    if (!teacherId) {
      toast.error("لم يتم العثور على معرف الأستاذ");
      return;
    }
    setResetting(true);
    try {
      const {
        error
      } = await supabase.rpc('reset_teacher_day', {
        p_teacher_id: teacherId,
        p_date: selectedDate
      } as any);
      if (error) throw error;
      const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // إعادة ضبط الحالة محلياً فوراً
      setStudentAttendance({});
      setStudentRecitations({});
      setStudentDailyPoints({});
      setStudentBonusPoints({});
      toast.success(`✅ تم إعادة تعيين جميع سجلات طلابك في تاريخ ${dateStr}`);
      setShowResetConfirm(false);

      // تحديث البيانات فورًا
      await refreshData();
    } catch (error) {
      console.error("Error resetting day:", error);
      toast.error("حدث خطأ أثناء إعادة التعيين");
    } finally {
      setResetting(false);
    }
  };
  if (dataLoading || authLoading) {
    return <DashboardLayout title={isSupervisor ? "لوحة تحكم المشرف" : "لوحة تحكم الأستاذ"} userName={user?.name}>
      <div className="space-y-4 animate-fade-in">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="stats-card">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-12 w-40" />
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-44" />)}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>;
  }
  return <DashboardLayout title="لوحة تحكم الأستاذ" userName={user?.name}>
    <div className="space-y-4 animate-fade-in">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => checkUnrecordedAttendance('generate')} className="text-xs">
            <MessageCircle className="w-3 h-3 ml-1" />
            ملخص يومي
          </Button>
          <Button variant="outline" size="sm" onClick={() => checkUnrecordedAttendance('copy')} className="text-xs">
            <Copy className="w-3 h-3 ml-1" />
            نسخ الملخص
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowReports(true)} className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
            <FileText className="w-3 h-3 ml-1" />
            تقارير
          </Button>
          <Button variant="default" size="sm" onClick={() => navigate('/teacher/surveys')} className="text-xs bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
            <CheckCircle className="w-3 h-3 ml-1" />
            الاستبيانات
          </Button>
        </div>

      </div>



      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => navigate("/teacher/students/compare")}
          className="stats-card hover:border-orange-500 cursor-pointer transition-all hover:shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">⚖️ مقارنة الطلاب</h3>
              <p className="text-sm text-muted-foreground">مقارنة أداء طالبين بصرياً وتفصيلياً</p>
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="stats-card">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">قائمة الطلاب</h3>
              <span className="text-xs text-muted-foreground">({studentsCount} طالب)</span>
            </div>

            {/* Supervisor Teacher Filter */}
            {isSupervisor && allTeachers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">فلترة حسب الأستاذ:</span>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">جميع الأساتذة</option>
                  {allTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher["اسم الاستاذ"]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 items-center">
              <Button onClick={toggleSession} disabled={checkingSession} variant={isSessionActive ? "default" : "outline"} size="lg" className={`
                    relative overflow-hidden transition-all duration-300
                    ${isSessionActive ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30" : "border-2 border-primary hover:bg-primary/10 animate-pulse"}
                    ${!isSessionActive ? "animate-bounce" : ""}
                    font-bold text-base px-6 py-6 rounded-xl
                  `}>
                <Check className={`w-5 h-5 ml-2 ${!isSessionActive ? "animate-pulse" : ""}`} />
                {isSessionActive ? "الدوام مفعّل ✓" : "ابدأ الدوام اليوم"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => {
                      const newDate = e.target.value;
                      if (newDate) {
                        setSelectedDate(newDate);
                      }
                    }}
                    className="h-8 text-xs w-auto"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {selectedDate && selectedDate.trim() !== '' ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                    weekday: 'long'
                  }) : 'اختر تاريخ'}
                </span>
              </div>

              <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(true)} className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" title="إعادة تعيين سجلات اليوم">
                <RotateCcw className="w-3 h-3 ml-1" />
                إعادة التعيين
              </Button>
            </div>
          </div>
        </div>

        <StudentsListView students={filteredStudents} viewMode={viewMode} studentAttendance={studentAttendance} studentRecitations={studentRecitations} studentDailyPoints={studentDailyPoints} studentBonusPoints={studentBonusPoints} isSessionActive={isSupervisor || isSessionActive} loadingStudentIds={loadingStudentIds} getStudentCardColor={getStudentCardColor} onStudentClick={handleStudentClick} onShowRecord={handleShowRecord} onAttendance={handleAttendance} onRecitation={handleRecitation} onBonusPoints={handleBonusPoints}
          isSupervisor={isSupervisor}
          onPhotoUpdated={(studentId, newUrl) => {
            if (studentId) {
              handleLocalStudentUpdate(studentId, { photo_url: newUrl });
            } else {
              // Fallback if no ID provided (shouldn't happen with new logic)
              user && fetchTeacherStudents(user);
            }
          }} />

        {filteredStudents.length === 0 && <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{isSupervisor && selectedTeacherId !== "all" ? "لا يوجد طلاب لهذا الأستاذ" : "لا يوجد طلاب مسجلين بعد"}</p>
        </div>}
      </div>
    </div>

    {user && <>
      <SimpleTeacherSettings open={showSettings} onOpenChange={setShowSettings} userId={user.id} />
      <AttendanceDialog open={showAttendance} onOpenChange={setShowAttendance} student={selectedStudent} selectedDate={selectedDate} onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)} teacherId={teacherId || ""} currentStatus={selectedStudent?.currentStatus} />
      <RecitationDialog open={showRecitation} onOpenChange={setShowRecitation} student={selectedStudent} teacherId={teacherId || ""} selectedDate={selectedDate} onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)} />
      <StudentDetailsDialog open={showDetails} onOpenChange={setShowDetails} student={selectedStudent} onStudentUpdated={(updatedFields) => {
        if (selectedStudent?.id && updatedFields) {
          handleLocalStudentUpdate(selectedStudent.id, updatedFields);
        }
      }} />
      <StudentRecordDialog open={showRecord} onOpenChange={setShowRecord} student={selectedStudent} onSuccess={refreshData} isAdmin={false} />
      <BonusPointsDialog open={showBonusPoints} onOpenChange={setShowBonusPoints} student={selectedStudent} teacherId={teacherId || ""} selectedDate={selectedDate} onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)} />

      {/* Reset Day Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد إعادة التعيين</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل ترغب في إعادة تعيين النقاط والتسميع والحضور لجميع طلابك في تاريخ{" "}
              <strong>
                {new Date(selectedDate).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </strong>؟
              <br />
              <span className="text-destructive font-medium">
                تحذير: لا يمكن التراجع عن هذا الإجراء!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetDay} disabled={resetting} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {resetting ? "جاري إعادة التعيين..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Session Confirmation Dialog */}
      <AlertDialog open={showStopSessionConfirm} onOpenChange={setShowStopSessionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد إلغاء الدوام</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل تريد إلغاء الدوام اليوم؟ لن تُحتسب هذه الجلسة في التقارير والإحصائيات.
              <br />
              البيانات المدخلة ستبقى محفوظة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">لا، إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={stopSession} disabled={checkingSession} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {checkingSession ? "جاري الإلغاء..." : "نعم، إلغاء الدوام"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reports Dialog */}
      <TeacherReportsDialog open={showReports} onOpenChange={setShowReports} students={students} teacherName={user?.name || ""} />

      {/* Unrecorded Attendance Warning Dialog */}
      <AlertDialog open={showUnrecordedWarning} onOpenChange={setShowUnrecordedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600 text-sm">
              ⚠️ تنبيه: يوجد طلاب بدون حضور مسجل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p className="text-sm">لم يتم تسجيل حضور {unrecordedStudents.length} طالب:</p>
              <div className="max-h-32 overflow-y-auto bg-muted p-2 rounded text-sm">
                {unrecordedStudents.map((name, i) => (
                  <div key={i}>• {name}</div>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                هل تريد المتابعة في إنشاء الملخص؟
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSummary} className="text-xs bg-amber-600 hover:bg-amber-700">
              متابعة على أي حال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileTextIcon className="w-5 h-5" />
              الملخص اليومي
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh]">
            <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {summaryText}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSummaryDialog(false)}
            >
              إغلاق
            </Button>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(summaryText);
                toast.success("تم نسخ الملخص");
              }}
            >
              <Copy className="w-4 h-4 ml-2" />
              نسخ الملخص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>}
  </DashboardLayout>;
};
export default TeacherDashboard;
