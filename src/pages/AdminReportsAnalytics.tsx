import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, CheckCircle, XCircle, Clock, Plus, Minus, Search, Award, BarChart3, FileText, Users, MessageSquare } from "lucide-react";
import BonusPointsDialog from "@/components/BonusPointsDialog";
import StudentReportPreview from "@/components/StudentReportPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeArabic } from "@/lib/utils";
import AdminAnalytics from "./AdminAnalytics";
import SessionsLog from "./SessionsLog";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface RecordData {
  attendance: any[];
  recitations: any[];
  bonusPoints: any[];
  notes: any[];
  totalPoints: number;
  attendanceCount: number;
  absentCount: number;
  excusedCount: number;
}

interface StatisticsData {
  totalPoints: number;
  totalAbsences: number;
  topStudents: Array<{
    student_name: string;
    points: number;
  }>;
  mostAbsent: Array<{
    student_name: string;
    absences: number;
  }>;
}

interface StudentReport {
  student: any;
  attendance: any[];
  recitations: any[];
  bonusPoints: any[];
  checkRecords: any[];
  pointsBalance: any;
  stats: {
    presentDays: number;
    absentDays: number;
    excusedDays: number;
    totalRecitations: number;
    totalBonusPoints: number;
    totalPoints: number;
  };
}

const AdminReportsAnalytics = () => {
  const { user } = useRequireAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filteredStudentsList, setFilteredStudentsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState<RecordData | null>(null);
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("search");

  // Teacher Reports states
  const [selectedTeacherForReport, setSelectedTeacherForReport] = useState<string>("");
  const [selectedTeacherNameForReport, setSelectedTeacherNameForReport] = useState<string>("");
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);
  const [selectedStudentsForReport, setSelectedStudentsForReport] = useState<string[]>([]);
  const [, setReports] = useState<StudentReport[]>([]);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [previewReportData, setPreviewReportData] = useState<any>(null);
  const [reportOptions, setReportOptions] = useState({
    points: true,
    recitations: true,
    attendance: true,
    tools: true,
    notes: true,
  });

  useEffect(() => {
    fetchStudents();
    fetchTeachers();
    const userData = localStorage.getItem("jeelUser");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setCurrentUserId(parsedUser.id);
    }
  }, []);

  useEffect(() => {
    const filtered = students.filter(student => {
      const normalizedSearch = normalizeArabic(searchTerm);
      const matchesSearch = !searchTerm || normalizeArabic(student.student_name).includes(normalizedSearch);
      const matchesTeacher = selectedTeacher === "all" || student.current_teacher === selectedTeacher;
      return matchesSearch && matchesTeacher;
    });
    setFilteredStudentsList(filtered);
  }, [students, searchTerm, selectedTeacher]);

  useEffect(() => {
    if (selectedStudentId && activeTab === "search") {
      const student = students.find(s => s.id === selectedStudentId);
      setSelectedStudent(student);
      fetchStudentRecord();
    }
  }, [selectedStudentId, startDate, endDate, activeTab]);

  useEffect(() => {
    if (selectedTeacherForReport && activeTab === "teacher-report") {
      fetchTeacherStudents();
    }
  }, [selectedTeacherForReport, activeTab, teachers]);

  const setDateRange = (type: 'week' | 'month' | '2months' | '3months' | 'all') => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start: string;

    switch (type) {
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        start = monthAgo.toISOString().split('T')[0];
        break;
      case '2months':
        const twoMonthsAgo = new Date(today);
        twoMonthsAgo.setMonth(today.getMonth() - 2);
        start = twoMonthsAgo.toISOString().split('T')[0];
        break;
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        start = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case 'all':
        start = '2020-01-01';
        break;
      default:
        start = end;
    }

    setStartDate(start);
    setEndDate(end);
    setShowCustomDateRange(false);
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
      setFilteredStudentsList(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل قائمة الطلاب");
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data: teachersData } = await supabase
        .from("teachers")
        .select("\"اسم الاستاذ\"")
        .order("\"اسم الاستاذ\"");

      const teacherNames = teachersData?.map(t => t["اسم الاستاذ"]).filter(Boolean) || [];

      const { data: studentsData } = await supabase
        .from("students")
        .select("current_teacher")
        .not("current_teacher", "is", null);

      const studentTeachers = studentsData?.map(s => s.current_teacher).filter(Boolean) || [];

      const allTeachers = [...new Set([...teacherNames, ...studentTeachers])];
      setTeachers(allTeachers.map(t => ({ name: t })));
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const fetchStudentRecord = async () => {
    if (!selectedStudentId) return;

    setLoading(true);
    try {
      const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (attError) throw attError;

      const { data: recitationsData, error: recError } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (recError) throw recError;

      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (bonusError) throw bonusError;

      const { data: notesData, error: notesError } = await supabase
        .from("student_notes")
        .select("*")
        .eq("student_id", selectedStudentId)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      const attendanceCount = attendanceData?.filter(a => a.status === 'حاضر').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'غائب').length || 0;
      const excusedCount = attendanceData?.filter(a => a.status === 'اعتذر').length || 0;

      const attendancePoints = attendanceData?.reduce((sum, a) => {
        if (a.status === 'حاضر') return sum + 1;
        if (a.status === 'غائب') return sum - 1;
        return sum;
      }, 0) || 0;

      const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
      const bonusPointsSum = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      const totalPoints = attendancePoints + recitationPoints + bonusPointsSum;

      setRecordData({
        attendance: attendanceData || [],
        recitations: recitationsData || [],
        bonusPoints: bonusData || [],
        notes: notesData || [],
        totalPoints,
        attendanceCount,
        absentCount,
        excusedCount
      });
    } catch (error) {
      console.error("Error fetching student record:", error);
      toast.error("حدث خطأ في تحميل سجل الطالب");
    } finally {
      setLoading(false);
    }
  };

  const generateStudentReportForPreview = async () => {
    if (!selectedStudentId) {
      toast.error("يرجى اختيار طالب");
      return;
    }

    setLoading(true);
    try {
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) {
        toast.error("لم يتم العثور على بيانات الطالب");
        return;
      }

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data: recitationsData } = await supabase
        .from('recitations')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data: bonusPointsData } = await supabase
        .from('bonus_points')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data: checkRecordsData } = await supabase
        .from('check_records')
        .select('*, check_items(*)')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data: notesData } = await supabase
        .from('student_notes')
        .select('*')
        .eq('student_id', selectedStudentId)
        .order('created_at', { ascending: false });

      const { data: pointsData } = await supabase
        .from('points_balance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .single();

      setPreviewReportData({
        student,
        attendance: attendanceData || [],
        recitations: recitationsData || [],
        bonusPoints: bonusPointsData || [],
        checkRecords: checkRecordsData || [],
        notes: notesData || [],
        points: pointsData,
        dateRange: {
          from: new Date(startDate),
          to: new Date(endDate)
        }
      });

      setShowReportPreview(true);

    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('حدث خطأ أثناء إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    if (!startDate || !endDate) {
      toast.error("يرجى تحديد الفترة الزمنية");
      return;
    }

    setLoading(true);
    try {
      let filteredStudents = students;
      if (selectedTeacher !== "all") {
        filteredStudents = students.filter(s => s.current_teacher === selectedTeacher);
      }

      const studentPointsPromises = filteredStudents.map(async (student) => {
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", student.id)
          .gte("date", startDate)
          .lte("date", endDate);

        const attendancePoints = attendanceData?.reduce((sum, a) => {
          if (a.status === 'حاضر') return sum + 1;
          if (a.status === 'غائب') return sum - 1;
          return sum;
        }, 0) || 0;

        const { data: recitationsData } = await supabase
          .from("recitations")
          .select("points_awarded")
          .eq("student_id", student.id)
          .gte("date", startDate)
          .lte("date", endDate);

        const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;

        const { data: bonusData } = await supabase
          .from("bonus_points")
          .select("points")
          .eq("student_id", student.id)
          .gte("date", startDate)
          .lte("date", endDate);

        const bonusPoints = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
        const absences = attendanceData?.filter(a => a.status === 'غائب').length || 0;

        return {
          student_name: student.student_name,
          points: attendancePoints + recitationPoints + bonusPoints,
          absences
        };
      });

      const studentPoints = await Promise.all(studentPointsPromises);

      const totalPoints = studentPoints.reduce((sum, s) => sum + s.points, 0);
      const totalAbsences = studentPoints.reduce((sum, s) => sum + s.absences, 0);

      const topStudents = studentPoints
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
        .map(s => ({ student_name: s.student_name, points: s.points }));

      const mostAbsent = studentPoints
        .filter(s => s.absences > 0)
        .sort((a, b) => b.absences - a.absences)
        .slice(0, 10)
        .map(s => ({ student_name: s.student_name, absences: s.absences }));

      setStatistics({
        totalPoints,
        totalAbsences,
        topStudents,
        mostAbsent
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast.error("حدث خطأ في تحميل الإحصائيات");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherStudents = async () => {
    try {
      const teacher = teachers.find(t => t.name === selectedTeacherForReport);
      if (!teacher) return;

      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("اسم الاستاذ", teacher.name)
        .single();

      if (teacherError) throw teacherError;

      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("teacher_id", teacherData.id)
        .order("student_name");

      if (error) throw error;
      setTeacherStudents(data || []);
      setSelectedTeacherNameForReport(teacher.name);
    } catch (error: any) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في جلب الطلاب");
    }
  };

  const toggleReportOption = (option: keyof typeof reportOptions) => {
    setReportOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const selectAllReportOptions = () => {
    setReportOptions({ points: true, recitations: true, attendance: true, tools: true, notes: true });
  };

  const deselectAllReportOptions = () => {
    setReportOptions({ points: false, recitations: false, attendance: false, tools: false, notes: false });
  };

  const handleStudentToggleForReport = (studentId: string) => {
    setSelectedStudentsForReport(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudentsForReport = () => {
    setSelectedStudentsForReport(teacherStudents.map(s => s.id));
  };

  const deselectAllStudentsForReport = () => {
    setSelectedStudentsForReport([]);
  };

  const generateTeacherReports = async () => {
    if (selectedStudentsForReport.length === 0) {
      toast.error("الرجاء اختيار طالب واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      const reportsData: StudentReport[] = [];

      for (const studentId of selectedStudentsForReport) {
        const student = teacherStudents.find(s => s.id === studentId);
        if (!student) continue;

        const [attendanceRes, recitationsRes, bonusRes, checkRecordsRes] = await Promise.all([
          supabase.from("attendance").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false }),
          supabase.from("recitations").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false }),
          supabase.from("bonus_points").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false }),
          supabase.from("check_records").select("*, check_items(name)").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false })
        ]);

        const attendance = attendanceRes.data || [];
        const recitations = recitationsRes.data || [];
        const bonusPoints = bonusRes.data || [];
        const checkRecords = checkRecordsRes.data || [];

        const presentDays = attendance.filter(a => a.status === 'حاضر').length;
        const absentDays = attendance.filter(a => a.status === 'غائب').length;
        const excusedDays = attendance.filter(a => a.status === 'اعتذر').length;
        const totalRecitations = recitations.length;
        const totalBonusPoints = bonusPoints.reduce((sum, bp) => sum + bp.points, 0);

        const attendancePoints = attendance.reduce((sum, a) => {
          if (a.status === 'حاضر') return sum + (a.points || 1);
          if (a.status === 'غائب') return sum + (a.points || -1);
          return sum;
        }, 0);

        const recitationPoints = recitations.reduce((sum, r) => sum + (r.points_awarded || 0), 0);
        const checkPointsSum = checkRecords.reduce((sum, cr) => sum + (cr.points || 0), 0);
        const totalPoints = attendancePoints + recitationPoints + totalBonusPoints + checkPointsSum;

        reportsData.push({
          student,
          attendance,
          recitations,
          bonusPoints,
          checkRecords,
          pointsBalance: {
            attendance_points: attendancePoints,
            recitation_points: recitationPoints,
            bonus_points: totalBonusPoints + checkPointsSum,
            total: totalPoints
          },
          stats: {
            presentDays,
            absentDays,
            excusedDays,
            totalRecitations,
            totalBonusPoints,
            totalPoints
          }
        });
      }

      setReports(reportsData);
      toast.success("تم إنشاء التقارير بنجاح، جاري فتح نافذة الطباعة...");

      setTimeout(() => {
        handlePrintTeacherReportDirectly(reportsData);
      }, 500);

    } catch (error: any) {
      console.error("Error generating reports:", error);
      toast.error("حدث خطأ في إنشاء التقارير");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTeacherReportDirectly = (reportsData: StudentReport[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    const coverPage = `
      <div class="cover-page">
        <div class="cover-content">
          <h1 class="cover-title">تقرير أداء الطلاب</h1>
          <div class="cover-teacher">الأستاذ: ${selectedTeacherNameForReport || selectedTeacherForReport}</div>
          <div class="cover-period">من ${formatDate(startDate)} إلى ${formatDate(endDate)}</div>
          <div class="cover-count">عدد الطلاب: ${reportsData.length}</div>
          <div class="cover-date">تاريخ الطباعة: ${formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    `;

    const reportsHTML = reportsData.map((report) => `
      <div class="student-page">
        <div class="student-header">
          <div class="student-name">${report.student.student_name}</div>
          ${report.student.grade ? `<div class="student-grade">الصف: ${report.student.grade}</div>` : ''}
        </div>
        
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${report.stats.totalPoints}</div><div class="stat-label">إجمالي النقاط</div></div>
          <div class="stat-card"><div class="stat-value">${report.stats.presentDays}</div><div class="stat-label">أيام الحضور</div></div>
          <div class="stat-card"><div class="stat-value">${report.stats.totalRecitations}</div><div class="stat-label">مرات التسميع</div></div>
          <div class="stat-card"><div class="stat-value">${report.stats.absentDays}</div><div class="stat-label">أيام الغياب</div></div>
        </div>
        
        ${reportOptions.points ? `<div class="section"><div class="section-title section-points">رصيد النقاط</div><div class="stats-grid"><div class="stat-card"><div class="stat-value">${report.pointsBalance?.attendance_points || 0}</div><div class="stat-label">نقاط الحضور</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.recitation_points || 0}</div><div class="stat-label">نقاط التسميع</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.bonus_points || 0}</div><div class="stat-label">النقاط الإضافية</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.total || 0}</div><div class="stat-label">المجموع الكلي</div></div></div></div>` : ''}
        
        ${reportOptions.attendance && report.attendance.length > 0 ? `<div class="section"><div class="section-title section-attendance">سجل الحضور</div><table><thead><tr><th>التاريخ</th><th style="text-align:center">الحالة</th><th style="text-align:center">النقاط</th></tr></thead><tbody>${report.attendance.map((att: any) => `<tr><td>${formatDate(att.date)}</td><td style="text-align:center"><span class="badge ${att.status === 'حاضر' ? 'badge-success' : att.status === 'غائب' ? 'badge-danger' : 'badge-warning'}">${att.status}</span></td><td style="text-align:center">${att.points || 0}</td></tr>`).join('')}</tbody></table></div>` : ''}
        
        ${reportOptions.recitations && report.recitations.length > 0 ? `<div class="section"><div class="section-title section-recitation">سجل التسميع</div><table><thead><tr><th>التاريخ</th><th>آخر حفظ</th><th style="text-align:center">التقييم</th><th style="text-align:center">النقاط</th></tr></thead><tbody>${report.recitations.map((rec: any) => `<tr><td>${formatDate(rec.date)}</td><td>${rec.last_saved}</td><td style="text-align:center"><span class="badge badge-success">${rec.rating}</span></td><td style="text-align:center">${rec.points_awarded || 0}</td></tr>`).join('')}</tbody></table></div>` : ''}
        
        ${reportOptions.notes && report.bonusPoints.length > 0 ? `<div class="section"><div class="section-title section-bonus">النقاط الإضافية</div>${report.bonusPoints.map((bp: any) => `<div class="item-row"><div><div style="font-weight:600;margin-bottom:2px">${bp.reason}</div><div style="font-size:10px;color:#64748b">${formatDate(bp.date)}</div></div><span class="badge badge-warning">+${bp.points}</span></div>`).join('')}</div>` : ''}
        
        ${reportOptions.tools && report.checkRecords.length > 0 ? `<div class="section"><div class="section-title section-tools">سجل تفقد الأدوات</div>${report.checkRecords.map((cr: any) => `<div class="item-row"><div style="flex:1"><span style="font-weight:600">${cr.check_items?.name || 'أداة'}</span><span style="margin:0 8px;color:#94a3b8">•</span><span style="color:#64748b;font-size:11px">${formatDate(cr.date)}</span></div><div style="display:flex;gap:8px;align-items:center"><span class="badge ${cr.status === 'موجود' ? 'badge-success' : cr.status === 'فقدان' ? 'badge-danger' : 'badge-warning'}">${cr.status}</span><span style="font-weight:700;color:${cr.points >= 0 ? '#16a34a' : '#dc2626'};font-size:13px">${cr.points > 0 ? '+' : ''}${cr.points}</span></div></div>`).join('')}</div>` : ''}
        
        <div class="page-separator"></div>
      </div>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الطلاب - ${selectedTeacherNameForReport || selectedTeacherForReport}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;direction:rtl;background:white;color:#1a1a1a;font-size:11px}@page{size:A4;margin:1.2cm}.cover-page{page-break-after:always;height:100vh;display:flex;align-items:center;justify-content:center}.cover-content{text-align:center;padding:40px;background:linear-gradient(135deg,#e0f2f1,#b2dfdb);border-radius:20px;border:4px solid #00897b}.cover-title{font-size:42px;font-weight:bold;color:#00695c;margin-bottom:30px}.cover-teacher{font-size:28px;color:#00796b;margin-bottom:15px}.cover-period{font-size:20px;color:#00796b;margin-bottom:15px}.cover-count{font-size:24px;font-weight:bold;color:#00695c;margin-bottom:15px;padding:15px;background:white;border-radius:10px}.cover-date{font-size:14px;color:#64748b;margin-top:20px}.student-page{page-break-after:always;padding:15px}.student-page:last-child{page-break-after:auto}.student-header{text-align:center;margin-bottom:15px;padding:15px;background:linear-gradient(135deg,#e0f2f1,#b2dfdb);border-radius:10px;border:2px solid #00897b}.student-name{font-size:24px;font-weight:bold;color:#00695c;margin-bottom:5px}.student-grade{font-size:13px;color:#00796b}.section{margin-bottom:15px;break-inside:avoid;page-break-inside:avoid}.section-title{font-size:13px;font-weight:bold;color:white;padding:6px 10px;border-radius:6px;margin-bottom:8px}.section-points{background:linear-gradient(135deg,#10b981,#059669)}.section-attendance{background:linear-gradient(135deg,#3b82f6,#2563eb)}.section-recitation{background:linear-gradient(135deg,#8b5cf6,#7c3aed)}.section-bonus{background:linear-gradient(135deg,#f59e0b,#d97706)}.section-tools{background:linear-gradient(135deg,#f43f5e,#e11d48)}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.stat-card{text-align:center;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}.stat-value{font-size:18px;font-weight:bold;color:#00695c;margin-bottom:3px}.stat-label{font-size:9px;color:#64748b}table{width:100%;border-collapse:collapse;margin-top:5px;background:white;font-size:10px;break-inside:avoid}th{background:#f1f5f9;padding:6px 8px;text-align:right;font-weight:bold;border-bottom:1px solid #cbd5e1;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;padding:3px 8px;border-radius:8px;font-size:9px;font-weight:600}.badge-success{background:#dcfce7;color:#166534}.badge-danger{background:#fee2e2;color:#991b1b}.badge-warning{background:#fef3c7;color:#92400e}.item-row{display:flex;justify-content:space-between;align-items:center;padding:6px;background:#f8fafc;border-radius:4px;margin-bottom:4px;break-inside:avoid;font-size:10px}.page-separator{height:2px;background:linear-gradient(to left,#00695c,#00897b,#00695c);margin-top:20px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}.cover-page,.student-page{page-break-after:always}.student-page:last-child{page-break-after:auto}}</style></head><body>${coverPage}${reportsHTML}</body></html>`);

    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <DashboardLayout title="سجلات وإحصائيات وتقارير" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="search" className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <Search className="w-4 h-4" />
              سجل طالب
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <BarChart3 className="w-4 h-4" />
              إحصائيات عامة
            </TabsTrigger>
            <TabsTrigger value="teacher-report" className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <FileText className="w-4 h-4" />
              إحصائيات الأستاذ
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <BarChart3 className="w-4 h-4" />
              التحليلات
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
              <Clock className="w-4 h-4" />
              سجل الجلسات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">فلتر حسب الأستاذ</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="اختر الأستاذ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأساتذة</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.name} value={teacher.name}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1.5 block">ابحث عن طالب</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="اكتب اسم الطالب للبحث الفوري..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSelectedStudentId("");
                    }}
                    className="pr-10 bg-background"
                  />
                </div>
              </div>
            </div>

            {(searchTerm || selectedTeacher !== "all") && (
              <div className="border rounded-xl bg-card overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                  النتائج: {filteredStudentsList.length} طالب
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredStudentsList.length > 0 ? (
                    <div className="divide-y divide-muted/50">
                      {filteredStudentsList.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`w-full text-right px-4 py-3 hover:bg-accent transition-all flex items-center justify-between ${selectedStudentId === student.id ? 'bg-primary/5 font-medium border-r-4 border-primary' : ''}`}
                        >
                          <span className="text-sm">{student.student_name}</span>
                          {student.current_teacher && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                              {student.current_teacher}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <p className="text-sm">لا توجد نتائج تطابق بحثك</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedStudentId && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl">
                  <div>
                    <h2 className="text-xl font-bold text-primary">{students.find(s => s.id === selectedStudentId)?.student_name}</h2>
                    <p className="text-sm text-muted-foreground">عرض سجل الطالب خلال فترة محددة</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={startDate === new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ? "default" : "outline"} size="sm" onClick={() => setDateRange('month')}>آخر شهر</Button>
                    <Button variant={startDate === new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ? "default" : "outline"} size="sm" onClick={() => setDateRange('2months')}>آخر شهرين</Button>
                    <Button variant={showCustomDateRange ? "default" : "outline"} size="sm" onClick={() => setShowCustomDateRange(!showCustomDateRange)} className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {showCustomDateRange ? "إخفاء المخصص" : "تاريخ مخصص"}
                    </Button>
                  </div>
                </div>

                {showCustomDateRange && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background p-4 rounded-xl border animate-in zoom-in-95 duration-200">
                    <div className="space-y-1.5">
                      <Label className="text-xs">من تاريخ</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">إلى تاريخ</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                  </div>
                ) : recordData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="border-none shadow-sm bg-green-500/5">
                        <CardContent className="p-4 flex flex-col items-center text-center">
                          <CheckCircle className="w-8 h-8 mb-2 text-green-600" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">أيام الحضور</p>
                          <p className="text-3xl font-black text-green-600">{recordData.attendanceCount}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-sm bg-red-500/5">
                        <CardContent className="p-4 flex flex-col items-center text-center">
                          <XCircle className="w-8 h-8 mb-2 text-red-600" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">أيام الغياب</p>
                          <p className="text-3xl font-black text-red-600">{recordData.absentCount}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-sm bg-yellow-500/5">
                        <CardContent className="p-4 flex flex-col items-center text-center">
                          <Clock className="w-8 h-8 mb-2 text-yellow-600" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">أيام الاعتذار</p>
                          <p className="text-3xl font-black text-yellow-600">{recordData.excusedCount}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-sm bg-primary/5">
                        <CardContent className="p-4 flex flex-col items-center text-center">
                          <Award className="w-8 h-8 mb-2 text-primary" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">إجمالي النقاط</p>
                          <p className="text-3xl font-black text-primary">{recordData.totalPoints}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowBonusDialog(true)} className="gap-2 bg-background shadow-sm">
                        <Plus className="w-4 h-4 text-green-600" />
                        <Minus className="w-4 h-4 text-red-600" />
                        تعديل النقاط يدوياً
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 px-1">
                          <Calendar className="w-5 h-5 text-primary" />
                          سجل التسميع
                          <Badge variant="secondary" className="mr-auto">{recordData.recitations.length}</Badge>
                        </h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                          {recordData.recitations.length > 0 ? recordData.recitations.map((rec) => (
                            <Card key={rec.id} className="shadow-none border-muted/60">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-base">{rec.last_saved}</span>
                                  <Badge className="bg-primary/10 text-primary border-none">+{rec.points_awarded} نقطة</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{formatDate(rec.date)}</span>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                                  <span className={rec.rating === 'ممتاز' ? 'text-green-600 font-bold' : rec.rating === 'جيد' ? 'text-blue-600' : 'text-orange-600'}>{rec.rating}</span>
                                </div>
                                {rec.notes && <p className="mt-2 text-sm text-muted-foreground italic bg-muted/30 p-2 rounded-md">ملاحظات: {rec.notes}</p>}
                              </CardContent>
                            </Card>
                          )) : <div className="text-center py-10 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">لا يوجد سجل تسميع في هذه الفترة</div>}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 px-1">
                          <Clock className="w-5 h-5 text-primary" />
                          سجل الحضور والغياب
                          <Badge variant="secondary" className="mr-auto">{recordData.attendance.length}</Badge>
                        </h3>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                          {recordData.attendance.length > 0 ? recordData.attendance.map((att) => (
                            <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:border-primary/30 transition-colors">
                              <span className="text-sm font-medium">{new Date(att.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              <div className="flex items-center gap-4">
                                {att.points !== 0 && <span className={`text-xs font-bold ${att.points > 0 ? 'text-green-600' : 'text-red-600'}`}>{att.points > 0 ? '+' : ''}{att.points}</span>}
                                {att.status === 'حاضر' ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3">حاضر</Badge> : att.status === 'غائب' ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-3">غائب</Badge> : <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none px-3">اعتذر</Badge>}
                              </div>
                            </div>
                          )) : <div className="text-center py-10 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">لا يوجد سجل حضور في هذه الفترة</div>}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-8">
                      <Button onClick={generateStudentReportForPreview} disabled={loading} size="lg" className="w-full md:w-80 h-14 rounded-xl shadow-lg shadow-primary/20 gap-3 text-lg font-bold transition-all hover:scale-105 active:scale-95">
                        <FileText className="w-6 h-6" />
                        نظام إصدار التقارير المتقدم
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6 mt-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-6 bg-muted/10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-sm font-medium">فلتر حسب الأستاذ (اختياري)</Label>
                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="اختر الأستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأساتذة</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.name} value={teacher.name}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">من تاريخ</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">إلى تاريخ</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  <Button variant="outline" size="sm" onClick={() => setDateRange('week')} className="bg-background">آخر أسبوع</Button>
                  <Button variant="outline" size="sm" onClick={() => setDateRange('month')} className="bg-background">آخر شهر</Button>
                  <Button variant="outline" size="sm" onClick={() => setDateRange('3months')} className="bg-background">آخر 3 أشهر</Button>
                  <Button onClick={fetchStatistics} disabled={loading} className="shadow-md">
                    {loading ? "جاري المعالجة..." : "تطبيق الفلترة وعرض النتائج"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {statistics && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center flex flex-col items-center shadow-lg shadow-primary/5">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Award className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mb-1">مجموع النقاط الكلي</p>
                    <p className="text-5xl font-black text-primary tabular-nums">{statistics.totalPoints}</p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center flex flex-col items-center shadow-lg shadow-red-500/5">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mb-1">عدد الغيابات الكلي</p>
                    <p className="text-5xl font-black text-red-600 tabular-nums">{statistics.totalAbsences}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-3 px-1">
                      <Award className="w-6 h-6 text-yellow-500" />
                      قائمة النخبة (أفضل 10 طلاب)
                    </h3>
                    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y divide-muted/50">
                      {statistics.topStudents.length > 0 ? statistics.topStudents.map((student, index) => (
                        <div key={index} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-all group">
                          <div className="flex items-center gap-4">
                            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shadow-sm transition-transform group-hover:scale-110 ${index === 0 ? 'bg-yellow-500 text-white shadow-yellow-500/20' : index === 1 ? 'bg-zinc-400 text-white shadow-zinc-400/20' : index === 2 ? 'bg-orange-600 text-white shadow-orange-600/20' : 'bg-muted text-foreground'}`}>
                              {index + 1}
                            </span>
                            <span className="font-bold text-base">{student.student_name}</span>
                          </div>
                          <span className="text-primary font-black text-xl tabular-nums">{student.points} <span className="text-xs font-normal text-muted-foreground">نقطة</span></span>
                        </div>
                      )) : <div className="p-20 text-center text-muted-foreground italic">لا توجد بيانات حالياً</div>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-3 px-1">
                      <XCircle className="w-6 h-6 text-red-600" />
                      قائمة المراجعة (أكثر 10 طلاب غياباً)
                    </h3>
                    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y divide-muted/50">
                      {statistics.mostAbsent.length > 0 ? statistics.mostAbsent.map((student, index) => (
                        <div key={index} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-all">
                          <div className="flex items-center gap-4">
                            <span className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-600">{index + 1}</span>
                            <span className="font-bold text-base">{student.student_name}</span>
                          </div>
                          <span className="text-red-600 font-bold text-lg tabular-nums">{student.absences} <span className="text-xs font-normal text-muted-foreground">غابة</span></span>
                        </div>
                      )) : <div className="p-20 text-center text-muted-foreground italic">جميع الطلاب ملتزمون، لا توجد غيابات مسجلة</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="teacher-report" className="space-y-6 mt-6">
            <Card className="border-none shadow-sm bg-muted/10">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">اختر الأستاذ</Label>
                    <Select value={selectedTeacherForReport} onValueChange={setSelectedTeacherForReport}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="اختر الأستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.name} value={teacher.name}>{teacher.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">الفترة الزمنية</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDateRange('month')} className="flex-1 bg-background">آخر شهر</Button>
                      <Button variant="outline" size="sm" onClick={() => setDateRange('2months')} className="flex-1 bg-background">آخر شهرين</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowCustomDateRange(!showCustomDateRange)} className="flex-1 bg-background">مخصص</Button>
                    </div>
                  </div>
                </div>

                {showCustomDateRange && (
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-xl bg-background animate-in slide-in-from-top-2">
                    <div className="space-y-1.5"><Label className="text-xs">من</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">إلى</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                  </div>
                )}

                {selectedTeacherForReport && teacherStudents.length > 0 && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="p-5 border rounded-2xl bg-background shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3 mb-2">
                        <Label className="text-lg font-bold">محتويات التقرير المطبوع</Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={selectAllReportOptions} className="text-xs hover:text-primary">تحديد الكل</Button>
                          <Button variant="ghost" size="sm" onClick={deselectAllReportOptions} className="text-xs hover:text-destructive">إلغاء الكل</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg"><Checkbox id="p-points" checked={reportOptions.points} onCheckedChange={() => toggleReportOption('points')} /><Label htmlFor="p-points" className="text-xs font-bold cursor-pointer">رصيد النقاط</Label></div>
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg"><Checkbox id="p-rec" checked={reportOptions.recitations} onCheckedChange={() => toggleReportOption('recitations')} /><Label htmlFor="p-rec" className="text-xs font-bold cursor-pointer">سجل التسميع</Label></div>
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg"><Checkbox id="p-att" checked={reportOptions.attendance} onCheckedChange={() => toggleReportOption('attendance')} /><Label htmlFor="p-att" className="text-xs font-bold cursor-pointer">سجل الحضور</Label></div>
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg"><Checkbox id="p-tools" checked={reportOptions.tools} onCheckedChange={() => toggleReportOption('tools')} /><Label htmlFor="p-tools" className="text-xs font-bold cursor-pointer">تفقد الأدوات</Label></div>
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg"><Checkbox id="p-notes" checked={reportOptions.notes} onCheckedChange={() => toggleReportOption('notes')} /><Label htmlFor="p-notes" className="text-xs font-bold cursor-pointer">الأنشطة</Label></div>
                      </div>
                    </div>

                    <div className="p-5 border rounded-2xl bg-background shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <Label className="text-lg font-bold">اختيار الطلاب المصدرين ({selectedStudentsForReport.length})</Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={selectAllStudentsForReport} className="text-xs">تحديد جميع طلاب الأستاذ</Button>
                          <Button variant="ghost" size="sm" onClick={deselectAllStudentsForReport} className="text-xs">إلغاء التحديد</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {teacherStudents.map((student) => (
                          <div key={student.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer ${selectedStudentsForReport.includes(student.id) ? 'bg-primary/5 border-primary/40' : 'bg-muted/10 border-transparent hover:bg-muted/20'}`} onClick={() => handleStudentToggleForReport(student.id)}>
                            <Checkbox id={student.id} checked={selectedStudentsForReport.includes(student.id)} onCheckedChange={() => handleStudentToggleForReport(student.id)} />
                            <Label htmlFor={student.id} className="text-sm font-medium cursor-pointer flex-1">{student.student_name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button onClick={generateTeacherReports} disabled={loading || selectedStudentsForReport.length === 0} className="w-full h-14 rounded-2xl text-lg font-black shadow-xl shadow-primary/10 transition-transform active:scale-95" size="lg">
                      {loading ? "جاري تجهيز التقارير..." : "إنشاء وإصدار التقارير النهائية للطباعة"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="animate-fade-in mt-6">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="sessions" className="animate-fade-in mt-6">
            <SessionsLog />
          </TabsContent>
        </Tabs>
      </div>

      {selectedStudent && (
        <BonusPointsDialog open={showBonusDialog} onOpenChange={setShowBonusDialog} student={selectedStudent} teacherId={currentUserId} onSuccess={fetchStudentRecord} />
      )}

      {previewReportData && (
        <StudentReportPreview open={showReportPreview} onOpenChange={setShowReportPreview} reportData={previewReportData} />
      )}
    </DashboardLayout>
  );
};

export default AdminReportsAnalytics;
