import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, Check, BookOpen, MessageCircle, Calendar, RotateCcw, LayoutGrid, List, ChevronsUpDown, Search, Copy, FileText as FileTextIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AttendanceDialog from "@/components/AttendanceDialog";
import RecitationDialog from "@/components/RecitationDialog";
import StudentDetailsDialog from "@/components/StudentDetailsDialog";
import StudentRecordDialog from "@/components/StudentRecordDialog";
import BonusPointsDialog from "@/components/BonusPointsDialog";
import StudentsListView from "@/components/StudentsListView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const AdminClassMonitoring = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showRecitation, setShowRecitation] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, string>>({});
  const [studentRecitations, setStudentRecitations] = useState<Record<string, boolean>>({});
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [studentDailyPoints, setStudentDailyPoints] = useState<Record<string, number>>({});
  const [studentBonusPoints, setStudentBonusPoints] = useState<Record<string, { points: number; type: "add" | "deduct" }>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStopSessionConfirm, setShowStopSessionConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "mobile">(
    () => (localStorage.getItem("view_mode") as any) || "grid"
  );
  const [openTeacherCombobox, setOpenTeacherCombobox] = useState(false);
  const [loadingStudentIds, setLoadingStudentIds] = useState<string[]>([]); // الطلاب قيد التحديث
  const [showUnrecordedWarning, setShowUnrecordedWarning] = useState(false);
  const [pendingSummaryAction, setPendingSummaryAction] = useState<'generate' | 'copy' | null>(null);
  const [unrecordedStudents, setUnrecordedStudents] = useState<string[]>([]);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    const role = parsedUser.role;

    if (role !== "admin" && role !== "supervisor") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }

    setUser(parsedUser);
    fetchTeachers();

    // الاستماع لتغييرات طريقة العرض
    const handleViewModeChange = (e: any) => {
      setViewMode(e.detail);
    };
    window.addEventListener("viewModeChange", handleViewModeChange);

    return () => {
      window.removeEventListener("viewModeChange", handleViewModeChange);
    };
  }, [navigate]);

  // Effect for checking session status - runs immediately when teacher is selected
  useEffect(() => {
    if (selectedTeacher) {
      checkTeachingSession(selectedTeacher, selectedDate);
    }
  }, [selectedDate, selectedTeacher]);

  // Effect for fetching attendance - runs when students are loaded
  useEffect(() => {
    if (selectedTeacher && students.length > 0) {
      fetchTodayAttendance(students);
    }
  }, [selectedDate, selectedTeacher, students.length]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, \"اسم الاستاذ\", user_id")
        .order("اسم الاستاذ");

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherStudents = async (teacher: any) => {
    try {
      setLoading(true);
      const teacherId = teacher.id;
      const teacherName = teacher["اسم الاستاذ"];

      const { data: byId, error: errById } = await supabase
        .from("students")
        .select(`
          *,
          points_balance(total),
          students_profiles(last_memorization)
        `)
        .eq("teacher_id", teacherId);

      if (errById) throw errById;

      let merged = byId || [];

      const { data: byName, error: errByName } = await supabase
        .from("students")
        .select(`
          *,
          points_balance(total),
          students_profiles(last_memorization)
        `)
        .eq("current_teacher", teacherName);

      if (errByName) throw errByName;

      const map: Record<string, any> = {};
      [...(merged || []), ...(byName || [])].forEach((s) => (map[s.id] = s));
      merged = Object.values(map);

      setStudents(merged);
      await fetchTodayAttendance(merged);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل الطلاب");
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async (studentsList: any[]) => {
    try {
      const studentIds = studentsList.map(s => s.id);

      const { data: attData, error: attError } = await supabase
        .from("attendance")
        .select("student_id, status, points")
        .eq("date", selectedDate)
        .in("student_id", studentIds);

      if (attError) throw attError;

      const attendanceMap: Record<string, string> = {};
      attData?.forEach(att => {
        attendanceMap[att.student_id] = att.status;
      });
      setStudentAttendance(attendanceMap);

      const { data: recData, error: recError } = await supabase
        .from("recitations")
        .select("student_id, points_awarded")
        .eq("date", selectedDate)
        .in("student_id", studentIds);

      if (recError) throw recError;

      const recitationsMap: Record<string, boolean> = {};
      recData?.forEach(rec => {
        recitationsMap[rec.student_id] = true;
      });
      setStudentRecitations(recitationsMap);

      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("student_id, points")
        .eq("date", selectedDate)
        .in("student_id", studentIds);

      if (bonusError) throw bonusError;

      // جلب نقاط تفقد الأدوات
      const { data: checkData, error: checkError } = await supabase
        .from("check_records")
        .select("student_id, points")
        .eq("date", selectedDate)
        .in("student_id", studentIds);

      if (checkError) throw checkError;

      const dailyPointsMap: Record<string, number> = {};
      const bonusPointsMap: Record<string, { points: number; type: "add" | "deduct" }> = {};

      studentIds.forEach(studentId => {
        const attPoints = attData?.find(a => a.student_id === studentId)?.points || 0;
        const recPoints = recData?.filter(r => r.student_id === studentId).reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
        const bonPoints = bonusData?.filter(b => b.student_id === studentId).reduce((sum, b) => sum + (b.points || 0), 0) || 0;
        const checkPoints = checkData?.filter(c => c.student_id === studentId).reduce((sum, c) => sum + (c.points || 0), 0) || 0;
        dailyPointsMap[studentId] = attPoints + recPoints + bonPoints + checkPoints;

        // تتبع حالة النقاط الإضافية للطالب
        const studentBonus = bonusData?.find(b => b.student_id === studentId);
        if (studentBonus) {
          bonusPointsMap[studentId] = {
            points: Math.abs(studentBonus.points),
            type: studentBonus.points >= 0 ? "add" : "deduct"
          };
        }
      });
      setStudentDailyPoints(dailyPointsMap);
      setStudentBonusPoints(bonusPointsMap);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const checkTeachingSession = async (teacher: any, date: string) => {
    if (!teacher) return;

    // استخدام id من جدول teachers دائماً لضمان التوافق مع لوحة المعلم
    const teacherIdentifier = teacher.id;
    if (!teacherIdentifier) return;

    try {
      const { data, error } = await supabase
        .from("teaching_sessions")
        .select("is_active")
        .eq("teacher_id", teacherIdentifier)
        .eq("session_date", date)
        .maybeSingle();

      if (error) throw error;
      setIsSessionActive(data?.is_active || false);
    } catch (error) {
      console.error("Error checking session:", error);
      setIsSessionActive(false);
    }
  };

  const startSession = async () => {
    if (!selectedTeacher) {
      toast.error("الرجاء اختيار أستاذ أولاً");
      return;
    }

    // استخدام id من جدول teachers دائماً لضمان التوافق مع لوحة المعلم
    const teacherIdentifier = selectedTeacher.id;

    if (!teacherIdentifier) {
      toast.error("لا يمكن تحديد هوية الأستاذ");
      return;
    }

    setCheckingSession(true);
    try {
      // التأكد من ربط المعلم بالمستخدم الحالي إذا كان user_id متوفراً
      if (selectedTeacher.user_id && user?.id) {
        const { data: teacherData } = await supabase
          .from("teachers")
          .select("user_id")
          .eq("id", selectedTeacher.id)
          .single();

        // إذا لم يكن المعلم مربوطاً بـ user_id، قم بربطه
        if (teacherData && !teacherData.user_id) {
          await supabase
            .from("teachers")
            .update({ user_id: user.id })
            .eq("id", selectedTeacher.id);
        }
      }

      // التحقق من وجود جلسة
      const { data: existing } = await supabase
        .from("teaching_sessions")
        .select("id, is_active")
        .eq("teacher_id", teacherIdentifier)
        .eq("session_date", selectedDate)
        .maybeSingle();

      if (existing) {
        // تحديث الجلسة الموجودة لتفعيلها
        try {
          const { error } = await supabase
            .from("teaching_sessions")
            .update({
              is_active: true,
              started_at: new Date().toISOString(),
              started_by_name: user?.name || "Admin"
            })
            .eq("id", existing.id);

          if (error) throw error;
        } catch (err: any) {
          // في حال حدوث خطأ بسبب عدم وجود العمود، نحاول التحديث بدونه
          if (err.message?.includes("started_by_name") || err.code === "PGRST204" || err.message?.includes("schema cache")) {
            console.warn("Column started_by_name not found, falling back to basic update");
            const { error: retryError } = await supabase
              .from("teaching_sessions")
              .update({
                is_active: true,
                started_at: new Date().toISOString()
              })
              .eq("id", existing.id);
            if (retryError) throw retryError;
          } else {
            throw err;
          }
        }
      } else {
        // إنشاء جلسة جديدة
        try {
          const { error } = await supabase
            .from("teaching_sessions")
            .insert({
              teacher_id: teacherIdentifier,
              session_date: selectedDate,
              is_active: true,
              started_at: new Date().toISOString(),
              started_by_name: user?.name || "Admin"
            });

          if (error) throw error;
        } catch (err: any) {
          // في حال حدوث خطأ بسبب عدم وجود العمود، نحاول الإضافة بدونه
          if (err.message?.includes("started_by_name") || err.code === "PGRST204" || err.message?.includes("schema cache")) {
            console.warn("Column started_by_name not found, falling back to basic insert");
            const { error: retryError } = await supabase
              .from("teaching_sessions")
              .insert({
                teacher_id: teacherIdentifier,
                session_date: selectedDate,
                is_active: true,
                started_at: new Date().toISOString()
              });
            if (retryError) throw retryError;
          } else {
            throw err;
          }
        }
      }

      setIsSessionActive(true);
      const adminName = user?.name || "Admin";
      toast.success(`تم تفعيل الدوام بنجاح بواسطة الادمن "${adminName}"`);
    } catch (error: any) {
      console.error("Error starting session:", error);
      toast.error(`حدث خطأ في بدء الدوام: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setCheckingSession(false);
    }
  };

  const stopSession = async () => {
    if (!selectedTeacher) return;

    // استخدام id من جدول teachers دائماً لضمان التوافق مع لوحة المعلم
    const teacherIdentifier = selectedTeacher.id;
    if (!teacherIdentifier) return;

    setCheckingSession(true);
    try {
      const { data: existing } = await supabase
        .from("teaching_sessions")
        .select("id")
        .eq("teacher_id", teacherIdentifier)
        .eq("session_date", selectedDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("teaching_sessions")
          .update({
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) throw error;
        setIsSessionActive(false);
        toast.success("تم إلغاء تفعيل الدوام");
      }
    } catch (error) {
      console.error("Error stopping session:", error);
      toast.error("حدث خطأ في إيقاف الدوام");
    } finally {
      setCheckingSession(false);
      setShowStopSessionConfirm(false);
    }
  };

  const toggleSession = async () => {
    if (!selectedTeacher) {
      toast.error("الرجاء اختيار أستاذ أولاً");
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

  const checkUnrecordedAttendance = (action: 'generate' | 'copy') => {
    const unrecorded = students.filter(s => !studentAttendance[s.id]).map(s => s.student_name);

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
      const notRecordedCount = students.length - presentCount - absentCount - excusedCount;

      // جلب التسميع لليوم
      const { data: todayRecitations } = await supabase
        .from("recitations")
        .select("student_id, last_saved, rating")
        .eq("date", selectedDate)
        .in("student_id", students.map(s => s.id));

      const recitationsMap: Record<string, Array<{ page: string; rating: string }>> = {};
      todayRecitations?.forEach(rec => {
        if (!recitationsMap[rec.student_id]) recitationsMap[rec.student_id] = [];
        recitationsMap[rec.student_id].push({
          page: rec.last_saved,
          rating: rec.rating
        });
      });

      // جلب تفقد الأدوات لليوم مع أسماء العناصر
      const { data: todayChecks } = await supabase
        .from("check_records")
        .select("student_id, item_id, status, points")
        .eq("date", selectedDate)
        .in("student_id", students.map(s => s.id));

      const itemIds = Array.from(new Set((todayChecks || []).map(c => c.item_id)));
      let itemsMap: Record<string, { name: string; points: number }> = {};

      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from("check_items")
          .select("id, name, points")
          .in("id", itemIds as any);
        items?.forEach((it: any) => {
          itemsMap[it.id] = { name: it.name, points: it.points };
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
      const { data: todayBonusPoints } = await supabase
        .from("bonus_points")
        .select("student_id, points, reason")
        .eq("date", selectedDate)
        .in("student_id", students.map(s => s.id));

      const bonusPointsMap: Record<string, Array<{ points: number; reason: string }>> = {};
      todayBonusPoints?.forEach(bp => {
        if (!bonusPointsMap[bp.student_id]) bonusPointsMap[bp.student_id] = [];
        bonusPointsMap[bp.student_id].push({ points: bp.points, reason: bp.reason });
      });

      const message = `📊 تقرير يومي - ${dateStr}\n` +
        `👨‍🏫 الأستاذ: ${selectedTeacher["اسم الاستاذ"]}\n\n` +
        `👥 عدد الطلاب: ${students.length}\n` +
        `✅ حاضر: ${presentCount}\n` +
        `❌ غائب: ${absentCount}\n` +
        `⚠️ اعتذر: ${excusedCount}\n` +
        `⏳ لم يُسجّل: ${notRecordedCount}\n\n` +
        `📋 قائمة الطلاب:\n` +
        students.map((s, i) => {
          const status = studentAttendance[s.id] || 'لم يُسجّل';
          const dailyPoints = studentDailyPoints[s.id] || 0;
          const dailyPointsStr = dailyPoints > 0 ? `+${dailyPoints}` : dailyPoints < 0 ? `${dailyPoints}` : '0';

          const recitations = recitationsMap[s.id] || [];
          const recitationText = recitations.length > 0
            ? `\n   • تسميع: ${recitations.map(r => `${r.page} (${r.rating})`).join(', ')}`
            : '';

          const checksText = checksTextMap[s.id]
            ? `\n   • تفقد: ${checksTextMap[s.id]}`
            : '';

          const bonusPoints = bonusPointsMap[s.id] || [];
          const bonusText = bonusPoints.length > 0
            ? `\n   • نقاط إضافية: ${bonusPoints.map(bp => `${bp.points > 0 ? '+' : ''}${bp.points} (${bp.reason})`).join(', ')}`
            : '';

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

  const generateDailySummary = async () => {
    if (!selectedTeacher) return;

    const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const presentCount = Object.values(studentAttendance).filter(s => s === 'حاضر').length;
    const absentCount = Object.values(studentAttendance).filter(s => s === 'غائب').length;
    const excusedCount = Object.values(studentAttendance).filter(s => s === 'اعتذر').length;
    const notRecordedCount = students.length - presentCount - absentCount - excusedCount;

    // جلب التسميع لليوم
    const { data: todayRecitations } = await supabase
      .from("recitations")
      .select("student_id, last_saved, rating")
      .eq("date", selectedDate)
      .in("student_id", students.map(s => s.id));

    const recitationsMap: Record<string, Array<{ page: string; rating: string }>> = {};
    todayRecitations?.forEach(rec => {
      if (!recitationsMap[rec.student_id]) recitationsMap[rec.student_id] = [];
      recitationsMap[rec.student_id].push({
        page: rec.last_saved,
        rating: rec.rating
      });
    });

    // جلب تفقد الأدوات لليوم مع أسماء العناصر
    const { data: todayChecks } = await supabase
      .from("check_records")
      .select("student_id, item_id, status, points")
      .eq("date", selectedDate)
      .in("student_id", students.map(s => s.id));

    const itemIds = Array.from(new Set((todayChecks || []).map(c => c.item_id)));
    let itemsMap: Record<string, { name: string; points: number }> = {};

    if (itemIds.length > 0) {
      const { data: items } = await supabase
        .from("check_items")
        .select("id, name, points")
        .in("id", itemIds as any);
      items?.forEach((it: any) => {
        itemsMap[it.id] = { name: it.name, points: it.points };
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
    const { data: todayBonusPoints } = await supabase
      .from("bonus_points")
      .select("student_id, points, reason")
      .eq("date", selectedDate)
      .in("student_id", students.map(s => s.id));

    const bonusPointsMap: Record<string, Array<{ points: number; reason: string }>> = {};
    todayBonusPoints?.forEach(bp => {
      if (!bonusPointsMap[bp.student_id]) bonusPointsMap[bp.student_id] = [];
      bonusPointsMap[bp.student_id].push({ points: bp.points, reason: bp.reason });
    });

    const message = `📊 تقرير يومي - ${dateStr}\n` +
      `👨‍🏫 الأستاذ: ${selectedTeacher["اسم الاستاذ"]}\n\n` +
      `👥 عدد الطلاب: ${students.length}\n` +
      `✅ حاضر: ${presentCount}\n` +
      `❌ غائب: ${absentCount}\n` +
      `⚠️ اعتذر: ${excusedCount}\n` +
      `⏳ لم يُسجّل: ${notRecordedCount}\n\n` +
      `📋 قائمة الطلاب:\n` +
      students.map((s, i) => {
        const status = studentAttendance[s.id] || 'لم يُسجّل';
        const dailyPoints = studentDailyPoints[s.id] || 0;
        const dailyPointsStr = dailyPoints > 0 ? `+${dailyPoints}` : dailyPoints < 0 ? `${dailyPoints}` : '0';

        const recitations = recitationsMap[s.id] || [];
        const recitationText = recitations.length > 0
          ? `\n   • تسميع: ${recitations.map(r => `${r.page} (${r.rating})`).join(', ')}`
          : '';

        const checksText = checksTextMap[s.id]
          ? `\n   • تفقد: ${checksTextMap[s.id]}`
          : '';

        const bonusPoints = bonusPointsMap[s.id] || [];
        const bonusText = bonusPoints.length > 0
          ? `\n   • نقاط إضافية: ${bonusPoints.map(bp => `${bp.points > 0 ? '+' : ''}${bp.points} (${bp.reason})`).join(', ')}`
          : '';

        return `${i + 1}. ${s.student_name}\n   • الحالة: ${status}\n   • نقاط اليوم: ${dailyPointsStr}${recitationText}${checksText}${bonusText}`;
      }).join('\n\n');

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleResetDay = async () => {
    if (!selectedTeacher?.id) {
      toast.error("الرجاء اختيار أستاذ أولاً");
      return;
    }

    // التحقق من صلاحيات الآدمن
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin" && userRole?.role !== "supervisor") {
      toast.error("هذه العملية متاحة للآدمن والمشرفين فقط");
      return;
    }

    setResetting(true);
    try {
      const { error } = await supabase.rpc('admin_reset_teacher_day', {
        p_teacher_id: selectedTeacher.id,
        p_date: selectedDate,
      } as any);

      if (error) throw error;

      const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // تسجيل العملية في سجل النشاطات
      await supabase.from("activity_logs").insert([{
        activity_type: "delete",
        description: `تم إعادة تعيين جميع سجلات طلاب ${selectedTeacher["اسم الاستاذ"]} في تاريخ ${dateStr}`,
        entity_type: "reset_day",
        entity_name: selectedTeacher["اسم الاستاذ"],
        entity_id: selectedTeacher.id,
        created_by: user.id,
        activity_date: selectedDate,
        new_data: JSON.parse(JSON.stringify({
          date: selectedDate,
          teacher: selectedTeacher["اسم الاستاذ"],
          students_count: students.length
        }))
      }]);

      setStudentAttendance({});
      setStudentRecitations({});
      setStudentDailyPoints({});

      toast.success(`✅ تم إعادة تعيين جميع السجلات (حضور، تسميع، نقاط إضافية، تفقد أدوات) للأستاذ ${selectedTeacher["اسم الاستاذ"]} في تاريخ ${dateStr}`);
      setShowResetConfirm(false);

      await refreshData();
    } catch (error: any) {
      console.error("Error resetting day:", error);
      toast.error(`حدث خطأ: ${error?.message || "خطأ غير متوقع"}`);
    } finally {
      setResetting(false);
    }
  };

  const refreshData = async () => {
    if (selectedTeacher) {
      await fetchTeacherStudents(selectedTeacher);
      if (students.length > 0) {
        await fetchTodayAttendance(students);
      }
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
            points: Math.abs(lastBonus.points),
            type: lastBonus.points >= 0 ? "add" : "deduct"
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

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    setShowDetails(true);
  };

  const handleAttendance = (student: any) => {
    setSelectedStudent(student);
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

  const getStudentCardColor = (studentId: string) => {
    const status = studentAttendance[studentId];
    if (status === 'حاضر') return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
    if (status === 'غائب') return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
    if (status === 'اعتذر') return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="متابعة الحلقات" userName={user?.name}>
      <div className="space-y-4 animate-fade-in">
        {/* اختيار الأستاذ */}
        <div className="stats-card">
          <h3 className="text-base font-bold mb-3">اختر حلقة الأستاذ</h3>
          <Popover open={openTeacherCombobox} onOpenChange={setOpenTeacherCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openTeacherCombobox}
                className="w-full justify-between"
              >
                {selectedTeacher
                  ? selectedTeacher["اسم الاستاذ"]
                  : "اختر الأستاذ..."}
                <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="ابحث عن أستاذ..." className="h-9" />
                <CommandList>
                  <CommandEmpty>لا يوجد أستاذ بهذا الاسم</CommandEmpty>
                  <CommandGroup>
                    {teachers.map((teacher) => (
                      <CommandItem
                        key={teacher.id}
                        value={teacher["اسم الاستاذ"]}
                        onSelect={() => {
                          setSelectedTeacher(teacher);
                          fetchTeacherStudents(teacher);
                          setOpenTeacherCombobox(false);
                        }}
                      >
                        {teacher["اسم الاستاذ"]}
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            selectedTeacher?.id === teacher.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {selectedTeacher && (
          <>
            {/* Header Actions */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => checkUnrecordedAttendance('generate')}
                className="text-xs"
              >
                <MessageCircle className="w-3 h-3 ml-1" />
                ملخص يومي
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkUnrecordedAttendance('copy')}
                className="text-xs"
              >
                <Copy className="w-3 h-3 ml-1" />
                نسخ الملخص
              </Button>
            </div>

            {/* Students List */}
            <div className="stats-card">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">قائمة الطلاب</h3>
                  <span className="text-xs text-muted-foreground">({students.length} طالب)</span>
                </div>

                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <Button
                    onClick={toggleSession}
                    disabled={checkingSession}
                    variant={isSessionActive ? "default" : "outline"}
                    size="lg"
                    className={`
                      relative overflow-hidden transition-all duration-300
                      ${isSessionActive
                        ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30"
                        : "border-2 border-primary hover:bg-primary/10 animate-pulse"
                      }
                      ${!isSessionActive ? "animate-bounce" : ""}
                      font-bold text-base px-6 py-6 rounded-xl
                    `}
                  >
                    <Check className={`w-5 h-5 ml-2 ${!isSessionActive ? "animate-pulse" : ""}`} />
                    {isSessionActive ? "الدوام مفعّل ✓" : "ابدأ الدوام اليوم"}
                  </Button>

                  {/* زر التبديل بين list و grid */}
                  <div className="flex gap-1 border border-border rounded-lg p-1">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setViewMode("grid");
                        localStorage.setItem("view_mode", "grid");
                      }}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setViewMode("list");
                        localStorage.setItem("view_mode", "list");
                      }}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                    />
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={resetting}
                  >
                    <RotateCcw className="w-4 h-4 ml-1" />
                    إعادة تعيين
                  </Button>
                </div>

                <StudentsListView
                  students={students}
                  viewMode={viewMode}
                  onStudentClick={handleStudentClick}
                  onAttendance={handleAttendance}
                  onRecitation={handleRecitation}
                  onShowRecord={handleShowRecord}
                  onBonusPoints={handleBonusPoints}
                  studentAttendance={studentAttendance}
                  studentRecitations={studentRecitations}
                  studentDailyPoints={studentDailyPoints}
                  studentBonusPoints={studentBonusPoints}
                  isSessionActive={isSessionActive}
                  loadingStudentIds={loadingStudentIds}
                  getStudentCardColor={getStudentCardColor}
                  onPhotoUpdated={refreshData}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {selectedStudent && (
        <>
          <AttendanceDialog
            open={showAttendance}
            onOpenChange={setShowAttendance}
            student={selectedStudent}
            selectedDate={selectedDate}
            onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)}
            teacherId={selectedTeacher?.user_id || user?.id}
            currentStatus={studentAttendance[selectedStudent.id]}
          />
          <RecitationDialog
            open={showRecitation}
            onOpenChange={setShowRecitation}
            student={selectedStudent}
            teacherId={selectedTeacher?.user_id || user?.id}
            selectedDate={selectedDate}
            onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)}
          />
          <StudentDetailsDialog
            open={showDetails}
            onOpenChange={setShowDetails}
            student={selectedStudent}
          />
          <StudentRecordDialog
            open={showRecord}
            onOpenChange={setShowRecord}
            student={selectedStudent}
            isAdmin={true}
          />
          <BonusPointsDialog
            open={showBonusPoints}
            onOpenChange={setShowBonusPoints}
            student={selectedStudent}
            teacherId={selectedTeacher?.user_id || user?.id}
            selectedDate={selectedDate}
            onSuccess={() => selectedStudent?.id && updateSingleStudentData(selectedStudent.id)}
          />
        </>
      )}

      {/* Stop Session Confirmation Dialog */}
      <AlertDialog open={showStopSessionConfirm} onOpenChange={setShowStopSessionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء الدوام</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في إلغاء دوام الأستاذ {selectedTeacher?.["اسم الاستاذ"]} لتاريخ {new Date(selectedDate).toLocaleDateString('ar-EG')}؟
              <br /><br />
              <strong className="text-destructive">لن تُحتسب هذه الجلسة في التقارير والإحصائيات.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={stopSession} disabled={checkingSession} className="bg-destructive hover:bg-destructive/90">
              {checkingSession ? "جاري الإلغاء..." : "تأكيد إلغاء الدوام"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في إعادة تعيين جميع البيانات (الحضور، التسميع، النقاط الإضافية) لطلاب {selectedTeacher?.["اسم الاستاذ"]} في تاريخ {new Date(selectedDate).toLocaleDateString('ar-EG')}؟
              <br /><br />
              <strong className="text-destructive">تحذير: هذا الإجراء لا يمكن التراجع عنه!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetDay} disabled={resetting} className="bg-destructive hover:bg-destructive/90">
              {resetting ? "جاري إعادة التعيين..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

          <div className="flex justify-end gap-2 mt-4">
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
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminClassMonitoring;
