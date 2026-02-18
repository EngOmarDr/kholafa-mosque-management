import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, CheckCircle, XCircle, Clock, Plus, Minus, Search, Award, BarChart3, FileText, Printer, Users, MessageSquare, BookOpen, Star } from "lucide-react";
import BonusPointsDialog from "./BonusPointsDialog";
import StudentReportPreview from "./StudentReportPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UnifiedStudentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const UnifiedStudentSearchDialog = ({ open, onOpenChange }: UnifiedStudentSearchDialogProps) => {
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
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [showReport, setShowReport] = useState(false);
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
    if (open) {
      fetchStudents();
      fetchTeachers();
      const userData = localStorage.getItem("jeelUser");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setCurrentUserId(parsedUser.id);
      }
    }
  }, [open]);

  useEffect(() => {
    const filtered = students.filter(student => {
      const matchesSearch = !searchTerm || student.student_name.toLowerCase().includes(searchTerm.toLowerCase());
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
  }, [selectedTeacherForReport, activeTab]);

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
      // جلب جميع الأساتذة من جدول teachers
      const { data: teachersData } = await supabase
        .from("teachers")
        .select("\"اسم الاستاذ\"")
        .order("\"اسم الاستاذ\"");
      
      const teacherNames = teachersData?.map(t => t["اسم الاستاذ"]).filter(Boolean) || [];
      
      // جلب الأساتذة من current_teacher في جدول الطلاب كاحتياطي
      const { data: studentsData } = await supabase
        .from("students")
        .select("current_teacher");
      
      const studentTeachers = studentsData?.map(s => s.current_teacher).filter(Boolean) || [];
      
      // دمج القائمتين وإزالة التكرار
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

      // Fetch attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      // Fetch recitations
      const { data: recitationsData } = await supabase
        .from('recitations')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      // Fetch bonus points
      const { data: bonusPointsData } = await supabase
        .from('bonus_points')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      // Fetch check records
      const { data: checkRecordsData } = await supabase
        .from('check_records')
        .select('*, check_items(*)')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      // Fetch notes
      const { data: notesData } = await supabase
        .from('student_notes')
        .select('*')
        .eq('student_id', selectedStudentId)
        .order('created_at', { ascending: false });

      // Fetch points balance
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

  // Teacher Reports Functions
  const fetchTeacherStudents = async () => {
    try {
      // Find teacher by name to get ID
      const teacher = teachers.find(t => t.name === selectedTeacherForReport);
      if (!teacher) {
        console.error("Teacher not found");
        return;
      }

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

        // حساب نقاط الحضور مباشرة
        const attendancePoints = attendance.reduce((sum, a) => {
          if (a.status === 'حاضر') return sum + (a.points || 1);
          if (a.status === 'غائب') return sum + (a.points || -1);
          return sum;
        }, 0);

        // حساب نقاط التسميع مباشرة
        const recitationPoints = recitations.reduce((sum, r) => sum + (r.points_awarded || 0), 0);

        // حساب نقاط تفقد الأدوات
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
      
      // طباعة التقرير مباشرة
      toast.success("تم إنشاء التقارير بنجاح، جاري فتح نافذة الطباعة...");
      
      // الانتظار قليلاً لضمان تحديث الحالة
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

    // Cover page
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Search className="w-6 h-6 text-primary" />
              سجل وإحصائيات الطلاب
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="search" className="gap-2">
                <Search className="w-4 h-4" />
                سجل طالب
              </TabsTrigger>
              <TabsTrigger value="statistics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                إحصائيات عامة
              </TabsTrigger>
              <TabsTrigger value="teacher-report" className="gap-2">
                <FileText className="w-4 h-4" />
                إحصائيات الأستاذ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4 mt-4">
              {/* فلتر بالأستاذ */}
              <div>
                <Label className="text-xs text-muted-foreground">فلتر حسب الأستاذ</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
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

              {/* بحث بالاسم */}
              <div>
                <Label className="text-xs text-muted-foreground">ابحث عن طالب</Label>
                <Input
                  placeholder="اكتب اسم الطالب للبحث الفوري..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedStudentId("");
                  }}
                  className="flex-1"
                />
              </div>

              {/* عرض نتائج البحث */}
              {(searchTerm || selectedTeacher !== "all") && (
                <div className="border rounded-lg">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-medium">
                    النتائج: {filteredStudentsList.length} طالب
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {filteredStudentsList.length > 0 ? (
                      <div className="divide-y">
                        {filteredStudentsList.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => setSelectedStudentId(student.id)}
                            className={`w-full text-right px-3 py-2.5 hover:bg-accent transition-colors ${
                              selectedStudentId === student.id ? 'bg-primary/10 font-medium' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{student.student_name}</span>
                              {student.current_teacher && (
                                <span className="text-xs text-muted-foreground border-r pr-2">
                                  {student.current_teacher}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">لا توجد نتائج</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedStudentId && (
                <>
                  {/* فلترة سريعة بالتاريخ */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">فلترة حسب الفترة الزمنية</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('month')}
                        className="flex-1"
                      >
                        آخر شهر
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('2months')}
                        className="flex-1"
                      >
                        آخر شهرين
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                        className="flex-1"
                      >
                        {showCustomDateRange ? "إخفاء التاريخ المخصص" : "تاريخ مخصص"}
                      </Button>
                    </div>
                  </div>

                  {/* تحديد الفترة الزمنية المخصصة */}
                  {showCustomDateRange && (
                    <div className="grid grid-cols-2 gap-3 animate-fade-in">
                      <div>
                        <Label className="text-xs">من تاريخ</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">إلى تاريخ</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : recordData ? (
                    <>
                      {/* إحصائيات */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                          <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-600" />
                          <p className="text-xs text-muted-foreground">حضور</p>
                          <p className="text-lg font-bold text-green-600">{recordData.attendanceCount}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                          <XCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                          <p className="text-xs text-muted-foreground">غياب</p>
                          <p className="text-lg font-bold text-red-600">{recordData.absentCount}</p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                          <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                          <p className="text-xs text-muted-foreground">اعتذار</p>
                          <p className="text-lg font-bold text-yellow-600">{recordData.excusedCount}</p>
                        </div>
                      </div>

                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">إجمالي النقاط</p>
                        <p className="text-2xl font-bold text-primary">{recordData.totalPoints}</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBonusDialog(true)}
                        className="w-full gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <Minus className="w-4 h-4" />
                        إضافة أو خصم نقاط
                      </Button>

                      {/* النقاط الإضافية */}
                      {recordData.bonusPoints.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            النقاط الإضافية ({recordData.bonusPoints.length})
                          </h4>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {recordData.bonusPoints.map((bonus) => (
                              <div key={bonus.id} className="border rounded-lg p-2 text-xs">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium">{bonus.reason}</span>
                                  <span className={`font-semibold ${bonus.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {bonus.points > 0 ? '+' : ''}{bonus.points} نقطة
                                  </span>
                                </div>
                                <div className="text-muted-foreground">
                                  {new Date(bonus.date).toLocaleDateString('ar-EG')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* سجل التسميع */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          سجل التسميع ({recordData.recitations.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {recordData.recitations.length > 0 ? (
                            recordData.recitations.map((rec) => (
                              <div key={rec.id} className="border rounded-lg p-2 text-xs">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium">{rec.last_saved}</span>
                                  <span className="text-primary font-semibold">+{rec.points_awarded} نقطة</span>
                                </div>
                                <div className="flex gap-2 text-muted-foreground">
                                  <span>{new Date(rec.date).toLocaleDateString('ar-EG')}</span>
                                  <span>•</span>
                                  <span className={
                                    rec.rating === 'ممتاز' ? 'text-green-600' :
                                    rec.rating === 'جيد' ? 'text-blue-600' :
                                    'text-orange-600'
                                  }>
                                    {rec.rating}
                                  </span>
                                </div>
                                {rec.notes && (
                                  <p className="mt-1 text-muted-foreground italic">
                                    ملاحظات: {rec.notes}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا يوجد سجل تسميع في هذه الفترة</p>
                          )}
                        </div>
                      </div>

                      {/* تفاصيل أيام الحضور */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          تفاصيل أيام الحضور ({recordData.attendance.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {recordData.attendance.length > 0 ? (
                            recordData.attendance.map((att) => (
                              <div key={att.id} className="border rounded-lg p-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">
                                    {new Date(att.date).toLocaleDateString('ar-EG', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {att.status === 'حاضر' ? (
                                      <>
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="font-medium text-green-600">حاضر</span>
                                      </>
                                    ) : att.status === 'غائب' ? (
                                      <>
                                        <XCircle className="w-4 h-4 text-red-600" />
                                        <span className="font-medium text-red-600">غائب</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-4 h-4 text-yellow-600" />
                                        <span className="font-medium text-yellow-600">اعتذر</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {att.points > 0 && (
                                  <div className="mt-1 text-primary font-semibold">
                                    +{att.points} نقطة
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا يوجد سجل حضور في هذه الفترة</p>
                          )}
                        </div>
                      </div>

                      {/* الملاحظات */}
                      {recordData.notes.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            الملاحظات ({recordData.notes.length})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {recordData.notes.map((note) => (
                              <div key={note.id} className="border rounded-lg p-3 text-xs bg-amber-50/50 dark:bg-amber-950/20">
                                <p className="text-foreground mb-2">{note.note}</p>
                                <div className="text-muted-foreground">
                                  {new Date(note.created_at).toLocaleDateString('ar-EG', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* زر إنشاء التقرير */}
                      <div className="pt-4 border-t">
                        <Button
                          onClick={generateStudentReportForPreview}
                          disabled={loading}
                          className="w-full gap-2"
                          size="lg"
                        >
                          {loading ? (
                            <>جاري التحميل...</>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              إنشاء التقرير
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </TabsContent>

            <TabsContent value="statistics" className="space-y-4 mt-4">
              {/* فلتر بالأستاذ */}
              <div>
                <Label className="text-xs text-muted-foreground">فلتر حسب الأستاذ (اختياري)</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
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

              {/* تحديد الفترة الزمنية */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من تاريخ</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* أزرار اختيار الفترة الزمنية السريعة */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('week')}
                  className="text-xs"
                >
                  آخر أسبوع
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('month')}
                  className="text-xs"
                >
                  آخر شهر
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('3months')}
                  className="text-xs"
                >
                  آخر 3 أشهر
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('all')}
                  className="text-xs"
                >
                  جميع البيانات
                </Button>
              </div>

              <Button
                onClick={fetchStatistics} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "جاري التحميل..." : "عرض الإحصائيات"}
              </Button>

              {loading && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {!loading && statistics && (
                <>
                  {/* ملخص الإحصائيات */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                      <Award className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground mb-1">مجموع النقاط الكلي</p>
                      <p className="text-3xl font-bold text-primary">{statistics.totalPoints}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                      <XCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                      <p className="text-sm text-muted-foreground mb-1">عدد الغيابات الكلي</p>
                      <p className="text-3xl font-bold text-red-600">{statistics.totalAbsences}</p>
                    </div>
                  </div>

                  {/* أفضل 10 طلاب */}
                  <div className="border rounded-lg">
                    <div className="bg-primary/10 px-4 py-3 border-b">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Award className="w-5 h-5 text-primary" />
                        أفضل 10 طلاب (حسب النقاط)
                      </h3>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {statistics.topStudents.length > 0 ? (
                        statistics.topStudents.map((student, index) => (
                          <div 
                            key={index} 
                            className="flex justify-between items-center p-3 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                ${index === 0 ? 'bg-yellow-500 text-white' : 
                                  index === 1 ? 'bg-gray-400 text-white' : 
                                  index === 2 ? 'bg-orange-700 text-white' : 
                                  'bg-primary/10 text-primary'}
                              `}>
                                {index + 1}
                              </span>
                              <span className="font-medium">{student.student_name}</span>
                            </div>
                            <span className="text-primary font-bold text-lg">
                              {student.points} نقطة
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          لا توجد بيانات
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أكثر 10 طلاب غياباً */}
                  {statistics.mostAbsent.length > 0 && (
                    <div className="border rounded-lg">
                      <div className="bg-red-500/10 px-4 py-3 border-b">
                        <h3 className="font-semibold flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          أكثر 10 طلاب غياباً
                        </h3>
                      </div>
                      <div className="divide-y max-h-80 overflow-y-auto">
                        {statistics.mostAbsent.map((student, index) => (
                          <div 
                            key={index} 
                            className="flex justify-between items-center p-3 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold text-sm text-red-600">
                                {index + 1}
                              </span>
                              <span className="font-medium">{student.student_name}</span>
                            </div>
                            <span className="text-red-600 font-bold">
                              {student.absences} غياب
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="teacher-report" className="space-y-4 mt-4">
              {!showReport ? (
                <>
                  {/* اختيار الأستاذ */}
                  <div>
                    <Label>اختر الأستاذ</Label>
                    <Select value={selectedTeacherForReport} onValueChange={setSelectedTeacherForReport}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الأستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.name} value={teacher.name}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTeacherForReport && teacherStudents.length > 0 && (
                    <>
                      {/* الفترة الزمنية */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          الفترة الزمنية
                        </Label>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDateRange('month')}
                            className="flex-1"
                          >
                            <Clock className="w-3 h-3 ml-1" />
                            آخر شهر
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDateRange('2months')}
                            className="flex-1"
                          >
                            <Clock className="w-3 h-3 ml-1" />
                            آخر شهرين
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDateRange('3months')}
                            className="flex-1"
                          >
                            <Clock className="w-3 h-3 ml-1" />
                            آخر 3 شهور
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                            className="flex-1"
                          >
                            آخر أسبوع
                          </Button>
                        </div>
                      </div>

                      {/* تاريخ مخصص */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>من تاريخ</Label>
                          <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>إلى تاريخ</Label>
                          <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* محتويات التقرير */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 text-base font-semibold">
                            <FileText className="w-4 h-4" />
                            محتويات التقرير
                          </Label>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={selectAllReportOptions}
                            >
                              تحديد الكل
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={deselectAllReportOptions}
                            >
                              إلغاء التحديد
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id="points"
                              checked={reportOptions.points}
                              onCheckedChange={() => toggleReportOption('points')}
                            />
                            <Label htmlFor="points" className="cursor-pointer">رصيد النقاط</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id="recitations"
                              checked={reportOptions.recitations}
                              onCheckedChange={() => toggleReportOption('recitations')}
                            />
                            <Label htmlFor="recitations" className="cursor-pointer">سجل التسميع</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id="attendance"
                              checked={reportOptions.attendance}
                              onCheckedChange={() => toggleReportOption('attendance')}
                            />
                            <Label htmlFor="attendance" className="cursor-pointer">سجل الحضور</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id="tools"
                              checked={reportOptions.tools}
                              onCheckedChange={() => toggleReportOption('tools')}
                            />
                            <Label htmlFor="tools" className="cursor-pointer">تفقد الأدوات</Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id="notes"
                              checked={reportOptions.notes}
                              onCheckedChange={() => toggleReportOption('notes')}
                            />
                            <Label htmlFor="notes" className="cursor-pointer">النشاط الإضافية</Label>
                          </div>
                        </div>
                      </div>

                      {/* اختيار الطلاب */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 text-base font-semibold">
                            <Users className="w-4 h-4" />
                            اختيار الطلاب ({selectedStudentsForReport.length} من {teacherStudents.length})
                          </Label>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={selectAllStudentsForReport}
                            >
                              تحديد الكل
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={deselectAllStudentsForReport}
                            >
                              إلغاء التحديد
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                          {teacherStudents.map((student) => (
                            <div key={student.id} className="flex items-center space-x-2 space-x-reverse">
                              <Checkbox
                                id={student.id}
                                checked={selectedStudentsForReport.includes(student.id)}
                                onCheckedChange={() => handleStudentToggleForReport(student.id)}
                              />
                              <Label htmlFor={student.id} className="cursor-pointer text-sm">
                                {student.student_name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={generateTeacherReports}
                        disabled={loading || selectedStudentsForReport.length === 0}
                        className="w-full"
                      >
                        {loading ? "جاري إنشاء التقرير..." : "إنشاء وطباعة التقرير"}
                      </Button>
                    </>
                  )}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedStudent && (
        <BonusPointsDialog
          open={showBonusDialog}
          onOpenChange={setShowBonusDialog}
          student={selectedStudent}
          teacherId={currentUserId}
          onSuccess={fetchStudentRecord}
        />
      )}

      {previewReportData && (
        <StudentReportPreview
          open={showReportPreview}
          onOpenChange={setShowReportPreview}
          reportData={previewReportData}
        />
      )}
    </>
  );
};

export default UnifiedStudentSearchDialog;
