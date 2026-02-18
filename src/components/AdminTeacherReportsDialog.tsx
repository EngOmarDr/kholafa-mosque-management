import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Printer, Calendar, Users, Clock, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdminTeacherReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Teacher {
  id: string;
  "اسم الاستاذ": string;
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

const AdminTeacherReportsDialog = ({ open, onOpenChange }: AdminTeacherReportsDialogProps) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [showReport, setShowReport] = useState(false);
  
  const [reportOptions, setReportOptions] = useState({
    points: true,
    recitations: true,
    attendance: true,
    tools: true,
    notes: true,
  });

  useEffect(() => {
    if (open) {
      fetchTeachers();
    }
  }, [open]);

  useEffect(() => {
    if (selectedTeacherId) {
      fetchStudents();
    }
  }, [selectedTeacherId]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, اسم الاستاذ")
        .order("اسم الاستاذ");
      
      if (error) throw error;
      setTeachers((data || []) as any);
    } catch (error: any) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في جلب الأساتذة");
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("teacher_id", selectedTeacherId)
        .order("student_name");
      
      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في جلب الطلاب");
    }
  };

  const toggleReportOption = (option: keyof typeof reportOptions) => {
    setReportOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const selectAllOptions = () => {
    setReportOptions({ points: true, recitations: true, attendance: true, tools: true, notes: true });
  };

  const deselectAllOptions = () => {
    setReportOptions({ points: false, recitations: false, attendance: false, tools: false, notes: false });
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllStudents = () => setSelectedStudents(students.map(s => s.id));
  const deselectAllStudents = () => setSelectedStudents([]);

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const generateReport = async () => {
    if (!selectedTeacherId) {
      toast.error("الرجاء اختيار أستاذ");
      return;
    }
    
    if (selectedStudents.length === 0) {
      toast.error("الرجاء اختيار طالب واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      const reportsData: StudentReport[] = [];

      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        const { data: attendance } = await supabase.from("attendance").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
        const { data: recitations } = await supabase.from("recitations").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
        const { data: bonusPoints } = await supabase.from("bonus_points").select("*").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
        const { data: checkRecords } = await supabase.from("check_records").select("*, check_items(*)").eq("student_id", studentId).gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
        const { data: pointsBalance } = await supabase.from("points_balance").select("*").eq("student_id", studentId).maybeSingle();

        const presentDays = attendance?.filter(a => a.status === "حاضر").length || 0;
        const absentDays = attendance?.filter(a => a.status === "غائب").length || 0;
        const excusedDays = attendance?.filter(a => a.status === "إذن").length || 0;

        reportsData.push({
          student,
          attendance: attendance || [],
          recitations: recitations || [],
          bonusPoints: bonusPoints || [],
          checkRecords: checkRecords || [],
          pointsBalance,
          stats: {
            presentDays,
            absentDays,
            excusedDays,
            totalRecitations: recitations?.length || 0,
            totalBonusPoints: bonusPoints?.reduce((sum, bp) => sum + bp.points, 0) || 0,
            totalPoints: pointsBalance?.total || 0,
          },
        });
      }

      setReports(reportsData);
      setShowReport(true);
      toast.success("تم إنشاء التقرير بنجاح");
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error("حدث خطأ في إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    const teacherName = teachers.find(t => t.id === selectedTeacherId)?.["اسم الاستاذ"] || "";
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    const coverPage = `
      <div class="cover-page">
        <div class="cover-content">
          <h1 class="cover-title">تقرير أداء الطلاب</h1>
          <div class="cover-teacher">الأستاذ: ${teacherName}</div>
          <div class="cover-period">من ${formatDate(startDate)} إلى ${formatDate(endDate)}</div>
          <div class="cover-count">عدد الطلاب: ${reports.length}</div>
          <div class="cover-date">تاريخ الطباعة: ${formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    `;

    const reportsHTML = reports.map((report) => `
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
        
        ${reportOptions.attendance && report.attendance.length > 0 ? `
          <div class="section">
            <div class="section-header">الحضور والغياب</div>
            <div class="section-content">
              ${report.attendance.map(att => `
                <div class="record-item">
                  <span class="record-date">${formatDate(att.date)}</span>
                  <span class="record-status status-${att.status === 'حاضر' ? 'present' : att.status === 'غائب' ? 'absent' : 'excused'}">${att.status}</span>
                  ${att.points ? `<span class="record-points">${att.points} نقطة</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${reportOptions.recitations && report.recitations.length > 0 ? `
          <div class="section">
            <div class="section-header">سجل التسميع</div>
            <div class="section-content">
              ${report.recitations.map(rec => `
                <div class="record-item">
                  <span class="record-date">${formatDate(rec.date)}</span>
                  <span class="record-rating">${rec.rating}</span>
                  <span class="record-saved">${rec.last_saved}</span>
                  ${rec.points_awarded ? `<span class="record-points">${rec.points_awarded} نقطة</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${reportOptions.points && report.bonusPoints.length > 0 ? `
          <div class="section">
            <div class="section-header">النقاط الإضافية</div>
            <div class="section-content">
              ${report.bonusPoints.map(bp => `
                <div class="record-item">
                  <span class="record-date">${formatDate(bp.date)}</span>
                  <span class="record-reason">${bp.reason}</span>
                  <span class="record-points points-bonus">${bp.points > 0 ? '+' : ''}${bp.points} نقطة</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${reportOptions.tools && report.checkRecords.length > 0 ? `
          <div class="section">
            <div class="section-header">سجل الأدوات</div>
            <div class="section-content">
              ${report.checkRecords.map(cr => `
                <div class="record-item">
                  <span class="record-date">${formatDate(cr.date)}</span>
                  <span class="record-tool">${cr.check_items?.name || 'أداة'}</span>
                  <span class="record-status status-${cr.status === 'موجود' ? 'present' : 'absent'}">${cr.status}</span>
                  ${cr.points ? `<span class="record-points">${cr.points > 0 ? '+' : ''}${cr.points} نقطة</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="page-break"></div>
    `).join('');

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الطلاب - ${teacherName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: white; }
          
          .cover-page { page-break-after: always; height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .cover-content { text-align: center; color: white; }
          .cover-title { font-size: 42px; font-weight: bold; margin-bottom: 30px; }
          .cover-teacher, .cover-period, .cover-count, .cover-date { font-size: 22px; margin: 12px 0; }
          
          .student-page { padding: 15px; }
          .student-header { text-align: center; margin-bottom: 15px; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
          .student-name { font-size: 28px; font-weight: bold; color: #2d3748; }
          .student-grade { font-size: 16px; color: #718096; margin-top: 4px; }
          
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
          .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 11px; margin-top: 4px; opacity: 0.95; }
          
          .section { margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
          .section-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; font-size: 15px; font-weight: 600; }
          .section-content { padding: 8px; }
          
          .record-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #f7fafc; font-size: 12px; }
          .record-item:last-child { border-bottom: none; }
          .record-date { color: #4a5568; font-weight: 500; }
          .record-status { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
          .status-present { background: #c6f6d5; color: #22543d; }
          .status-absent { background: #fed7d7; color: #742a2a; }
          .status-excused { background: #feebc8; color: #7c2d12; }
          .record-points { color: #667eea; font-weight: 600; }
          .points-bonus { color: #48bb78; }
          .record-rating, .record-saved, .record-reason, .record-tool { color: #2d3748; }
          
          .page-break { page-break-after: always; }
          
          @media print {
            body { background: white; }
            .student-page { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${coverPage}
        ${reportsHTML}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (showReport) {
    const teacherName = teachers.find(t => t.id === selectedTeacherId)?.["اسم الاستاذ"] || "";
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>معاينة التقرير</span>
              <Button onClick={handlePrint} size="sm" className="gap-2">
                <Printer className="w-4 h-4" />
                طباعة
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="bg-gradient-to-r from-primary to-primary/80">
              <CardContent className="p-6 text-white">
                <h2 className="text-2xl font-bold mb-4">تقرير أداء الطلاب</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>الأستاذ: {teacherName}</div>
                  <div>عدد الطلاب: {reports.length}</div>
                  <div>من: {formatDate(startDate)}</div>
                  <div>إلى: {formatDate(endDate)}</div>
                </div>
              </CardContent>
            </Card>

            {reports.map((report, idx) => (
              <Card key={idx} className="border-2">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-primary mb-2">
                      {report.student.student_name}
                    </h3>
                    {report.student.grade && (
                      <p className="text-muted-foreground">الصف: {report.student.grade}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-primary/10 p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">{report.stats.totalPoints}</div>
                      <div className="text-sm text-muted-foreground mt-1">إجمالي النقاط</div>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-green-700">{report.stats.presentDays}</div>
                      <div className="text-sm text-muted-foreground mt-1">أيام الحضور</div>
                    </div>
                    <div className="bg-blue-100 p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-700">{report.stats.totalRecitations}</div>
                      <div className="text-sm text-muted-foreground mt-1">مرات التسميع</div>
                    </div>
                    <div className="bg-red-100 p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-red-700">{report.stats.absentDays}</div>
                      <div className="text-sm text-muted-foreground mt-1">أيام الغياب</div>
                    </div>
                  </div>

                  {reportOptions.attendance && report.attendance.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          الحضور والغياب
                        </h4>
                        <Badge variant="secondary">{report.attendance.length}</Badge>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                        {report.attendance.map((att, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-background rounded border text-sm">
                            <span>{formatDate(att.date)}</span>
                            <Badge variant={att.status === 'حاضر' ? 'default' : att.status === 'غائب' ? 'destructive' : 'secondary'}>
                              {att.status}
                            </Badge>
                            {att.points && <span className="text-primary font-semibold">{att.points} نقطة</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.recitations && report.recitations.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          سجل التسميع
                        </h4>
                        <Badge variant="secondary">{report.recitations.length}</Badge>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                        {report.recitations.map((rec, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-background rounded border text-sm">
                            <span>{formatDate(rec.date)}</span>
                            <span className="font-medium">{rec.rating}</span>
                            <span className="text-muted-foreground">{rec.last_saved}</span>
                            {rec.points_awarded && <span className="text-primary font-semibold">{rec.points_awarded} نقطة</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.points && report.bonusPoints.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary" />
                          النقاط الإضافية
                        </h4>
                        <Badge variant="secondary">{report.bonusPoints.length}</Badge>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                        {report.bonusPoints.map((bp, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-background rounded border text-sm">
                            <span>{formatDate(bp.date)}</span>
                            <span className="flex-1 mx-4">{bp.reason}</span>
                            <Badge variant={bp.points > 0 ? 'default' : 'destructive'}>
                              {bp.points > 0 ? '+' : ''}{bp.points} نقطة
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.tools && report.checkRecords.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          سجل الأدوات
                        </h4>
                        <Badge variant="secondary">{report.checkRecords.length}</Badge>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                        {report.checkRecords.map((cr, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-background rounded border text-sm">
                            <span>{formatDate(cr.date)}</span>
                            <span className="font-medium">{cr.check_items?.name || 'أداة'}</span>
                            <Badge variant={cr.status === 'موجود' ? 'default' : 'destructive'}>
                              {cr.status}
                            </Badge>
                            {cr.points && <span className={`font-semibold ${cr.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cr.points > 0 ? '+' : ''}{cr.points} نقطة
                            </span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button onClick={() => setShowReport(false)} variant="outline" className="flex-1">
                تعديل الإعدادات
              </Button>
              <Button onClick={handlePrint} className="flex-1 gap-2">
                <Printer className="w-4 h-4" />
                طباعة التقرير
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            إنشاء تقرير شامل للطلاب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="teacher-select">اختيار الأستاذ *</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger id="teacher-select" className="mt-2">
                <SelectValue placeholder="اختر الأستاذ" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher["اسم الاستاذ"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTeacherId && students.length > 0 && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>تحديد الفترة الزمنية</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDateRange(7)}>
                      آخر 7 أيام
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDateRange(30)}>
                      آخر 30 يوم
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDateRange(90)}>
                      آخر 3 أشهر
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">من تاريخ</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">إلى تاريخ</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>اختيار الطلاب ({selectedStudents.length}/{students.length})</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={selectAllStudents}>
                      تحديد الكل
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAllStudents}>
                      إلغاء التحديد
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded-lg p-4">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => handleStudentToggle(student.id)}
                      />
                      <Label htmlFor={`student-${student.id}`} className="cursor-pointer text-sm">
                        {student.student_name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>اختيار عناصر التقرير</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={selectAllOptions}>
                      تحديد الكل
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAllOptions}>
                      إلغاء التحديد
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="option-points"
                      checked={reportOptions.points}
                      onCheckedChange={() => toggleReportOption('points')}
                    />
                    <Label htmlFor="option-points" className="cursor-pointer">النقاط الإضافية</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="option-recitations"
                      checked={reportOptions.recitations}
                      onCheckedChange={() => toggleReportOption('recitations')}
                    />
                    <Label htmlFor="option-recitations" className="cursor-pointer">التسميع</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="option-attendance"
                      checked={reportOptions.attendance}
                      onCheckedChange={() => toggleReportOption('attendance')}
                    />
                    <Label htmlFor="option-attendance" className="cursor-pointer">الحضور</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="option-tools"
                      checked={reportOptions.tools}
                      onCheckedChange={() => toggleReportOption('tools')}
                    />
                    <Label htmlFor="option-tools" className="cursor-pointer">الأدوات</Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={generateReport} disabled={loading} className="flex-1">
                  {loading ? "جاري الإنشاء..." : "إنشاء التقرير"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminTeacherReportsDialog;
