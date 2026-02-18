import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Printer, Calendar, Users, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TeacherReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: any[];
  teacherName: string;
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

const TeacherReportsDialog = ({ open, onOpenChange, students, teacherName }: TeacherReportsDialogProps) => {
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

        const presentDays = attendance?.filter(a => a.status === "حاضر").length || 0;
        const absentDays = attendance?.filter(a => a.status === "غائب").length || 0;
        const excusedDays = attendance?.filter(a => a.status === "إذن").length || 0;

        // حساب نقاط الحضور مباشرة
        const attendancePoints = attendance?.reduce((sum, a) => {
          if (a.status === 'حاضر') return sum + (a.points || 1);
          if (a.status === 'غائب') return sum + (a.points || -1);
          return sum;
        }, 0) || 0;

        // حساب نقاط التسميع مباشرة
        const recitationPoints = recitations?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;

        // حساب النقاط الإضافية
        const bonusPointsSum = bonusPoints?.reduce((sum, bp) => sum + bp.points, 0) || 0;

        // حساب نقاط تفقد الأدوات
        const checkPointsSum = checkRecords?.reduce((sum, cr) => sum + (cr.points || 0), 0) || 0;

        const totalPoints = attendancePoints + recitationPoints + bonusPointsSum + checkPointsSum;

        reportsData.push({
          student,
          attendance: attendance || [],
          recitations: recitations || [],
          bonusPoints: bonusPoints || [],
          checkRecords: checkRecords || [],
          pointsBalance: {
            attendance_points: attendancePoints,
            recitation_points: recitationPoints,
            bonus_points: bonusPointsSum + checkPointsSum,
            total: totalPoints
          },
          stats: {
            presentDays,
            absentDays,
            excusedDays,
            totalRecitations: recitations?.length || 0,
            totalBonusPoints: bonusPointsSum,
            totalPoints,
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
        
        ${reportOptions.points ? `<div class="section"><div class="section-title section-points">رصيد النقاط</div><div class="stats-grid"><div class="stat-card"><div class="stat-value">${report.pointsBalance?.attendance_points || 0}</div><div class="stat-label">نقاط الحضور</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.recitation_points || 0}</div><div class="stat-label">نقاط التسميع</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.bonus_points || 0}</div><div class="stat-label">النقاط الإضافية</div></div><div class="stat-card"><div class="stat-value">${report.pointsBalance?.total || 0}</div><div class="stat-label">المجموع الكلي</div></div></div></div>` : ''}
        
        ${reportOptions.attendance && report.attendance.length > 0 ? `<div class="section"><div class="section-title section-attendance">سجل الحضور</div><table><thead><tr><th>التاريخ</th><th style="text-align:center">الحالة</th><th style="text-align:center">النقاط</th></tr></thead><tbody>${report.attendance.map((att: any) => `<tr><td>${formatDate(att.date)}</td><td style="text-align:center"><span class="badge ${att.status === 'حاضر' ? 'badge-success' : att.status === 'غائب' ? 'badge-danger' : 'badge-warning'}">${att.status}</span></td><td style="text-align:center">${att.points || 0}</td></tr>`).join('')}</tbody></table></div>` : ''}
        
        ${reportOptions.recitations && report.recitations.length > 0 ? `<div class="section"><div class="section-title section-recitation">سجل التسميع</div><table><thead><tr><th>التاريخ</th><th>آخر حفظ</th><th style="text-align:center">التقييم</th><th style="text-align:center">النقاط</th></tr></thead><tbody>${report.recitations.map((rec: any) => `<tr><td>${formatDate(rec.date)}</td><td>${rec.last_saved}</td><td style="text-align:center"><span class="badge badge-success">${rec.rating}</span></td><td style="text-align:center">${rec.points_awarded || 0}</td></tr>`).join('')}</tbody></table></div>` : ''}
        
        ${reportOptions.notes && report.bonusPoints.length > 0 ? `<div class="section"><div class="section-title section-bonus">النقاط الإضافية</div>${report.bonusPoints.map((bp: any) => `<div class="item-row"><div><div style="font-weight:600;margin-bottom:2px">${bp.reason}</div><div style="font-size:10px;color:#64748b">${formatDate(bp.date)}</div></div><span class="badge badge-warning">+${bp.points}</span></div>`).join('')}</div>` : ''}
        
        ${reportOptions.tools && report.checkRecords.length > 0 ? `<div class="section"><div class="section-title section-tools">سجل تفقد الأدوات</div>${report.checkRecords.map((cr: any) => `<div class="item-row"><div style="flex:1"><span style="font-weight:600">${cr.check_items?.name || 'أداة'}</span><span style="margin:0 8px;color:#94a3b8">•</span><span style="color:#64748b;font-size:11px">${formatDate(cr.date)}</span></div><div style="display:flex;gap:8px;align-items:center"><span class="badge ${cr.status === 'موجود' ? 'badge-success' : cr.status === 'فقدان' ? 'badge-danger' : 'badge-warning'}">${cr.status}</span><span style="font-weight:700;color:${cr.points >= 0 ? '#16a34a' : '#dc2626'};font-size:13px">${cr.points > 0 ? '+' : ''}${cr.points}</span></div></div>`).join('')}</div>` : ''}
        
        <div class="page-separator"></div>
      </div>
    `).join('');
    
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الطلاب - ${teacherName}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;direction:rtl;background:white;color:#1a1a1a;font-size:11px}@page{size:A4;margin:1.2cm}.cover-page{page-break-after:always;height:100vh;display:flex;align-items:center;justify-content:center}.cover-content{text-align:center;padding:40px;background:linear-gradient(135deg,#e0f2f1,#b2dfdb);border-radius:20px;border:4px solid #00897b}.cover-title{font-size:42px;font-weight:bold;color:#00695c;margin-bottom:30px}.cover-teacher{font-size:28px;color:#00796b;margin-bottom:15px}.cover-period{font-size:20px;color:#00796b;margin-bottom:15px}.cover-count{font-size:24px;font-weight:bold;color:#00695c;margin-bottom:15px;padding:15px;background:white;border-radius:10px}.cover-date{font-size:14px;color:#64748b;margin-top:20px}.student-page{page-break-after:always;padding:15px}.student-page:last-child{page-break-after:auto}.student-header{text-align:center;margin-bottom:15px;padding:15px;background:linear-gradient(135deg,#e0f2f1,#b2dfdb);border-radius:10px;border:2px solid #00897b}.student-name{font-size:24px;font-weight:bold;color:#00695c;margin-bottom:5px}.student-grade{font-size:13px;color:#00796b}.section{margin-bottom:15px;break-inside:avoid;page-break-inside:avoid}.section-title{font-size:13px;font-weight:bold;color:white;padding:6px 10px;border-radius:6px;margin-bottom:8px}.section-points{background:linear-gradient(135deg,#10b981,#059669)}.section-attendance{background:linear-gradient(135deg,#3b82f6,#2563eb)}.section-recitation{background:linear-gradient(135deg,#8b5cf6,#7c3aed)}.section-bonus{background:linear-gradient(135deg,#f59e0b,#d97706)}.section-tools{background:linear-gradient(135deg,#f43f5e,#e11d48)}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.stat-card{text-align:center;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}.stat-value{font-size:18px;font-weight:bold;color:#00695c;margin-bottom:3px}.stat-label{font-size:9px;color:#64748b}table{width:100%;border-collapse:collapse;margin-top:5px;background:white;font-size:10px;break-inside:avoid}th{background:#f1f5f9;padding:6px 8px;text-align:right;font-weight:bold;border-bottom:1px solid #cbd5e1;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;padding:3px 8px;border-radius:8px;font-size:9px;font-weight:600}.badge-success{background:#dcfce7;color:#166534}.badge-danger{background:#fee2e2;color:#991b1b}.badge-warning{background:#fef3c7;color:#92400e}.item-row{display:flex;justify-content:space-between;align-items:center;padding:6px;background:#f8fafc;border-radius:4px;margin-bottom:4px;break-inside:avoid;font-size:10px}.page-separator{height:2px;background:linear-gradient(to left,#00695c,#00897b,#00695c);margin-top:20px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}.cover-page,.student-page{page-break-after:always}.student-page:last-child{page-break-after:auto}}</style></head><body>${coverPage}${reportsHTML}</body></html>`);
    
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
  };

  if (showReport && reports.length > 0) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { setShowReport(false); setReports([]); } onOpenChange(isOpen); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <DialogHeader><DialogTitle>معاينة التقرير</DialogTitle></DialogHeader>
            <div className="flex gap-2">
              <Button onClick={() => setShowReport(false)} variant="outline" size="sm"><FileText className="w-4 h-4 ml-2" />تعديل الاختيارات</Button>
              <Button onClick={handlePrint} size="sm"><Printer className="w-4 h-4 ml-2" />طباعة PDF</Button>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Cover Page Preview */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">تقرير أداء الطلاب</h2>
                <p className="text-xl">الأستاذ: {teacherName}</p>
                <p className="text-lg text-muted-foreground">من {formatDate(startDate)} إلى {formatDate(endDate)}</p>
                <Badge variant="secondary" className="text-lg px-4 py-2">عدد الطلاب: {reports.length}</Badge>
              </div>
            </Card>

            {/* Students Reports Preview */}
            {reports.map((report, index) => (
              <Card key={report.student.id} className="p-6">
                <div className="space-y-4">
                  <div className="text-center pb-4 border-b-2">
                    <h3 className="text-2xl font-bold text-primary">{report.student.student_name}</h3>
                    <p className="text-muted-foreground">{report.student.grade || "غير محدد"}</p>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-3 text-center"><div className="text-2xl font-bold text-primary">{report.stats.totalPoints}</div><div className="text-xs text-muted-foreground">إجمالي النقاط</div></Card>
                    <Card className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{report.stats.presentDays}</div><div className="text-xs text-muted-foreground">أيام الحضور</div></Card>
                    <Card className="p-3 text-center"><div className="text-2xl font-bold text-purple-600">{report.stats.totalRecitations}</div><div className="text-xs text-muted-foreground">مرات التسميع</div></Card>
                    <Card className="p-3 text-center"><div className="text-2xl font-bold text-red-600">{report.stats.absentDays}</div><div className="text-xs text-muted-foreground">أيام الغياب</div></Card>
                  </div>

                  {reportOptions.points && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-green-700 bg-green-50 p-2 rounded">رصيد النقاط</h4>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="text-center p-2 bg-muted/50 rounded"><div className="font-bold">{report.pointsBalance?.attendance_points || 0}</div><div className="text-xs">الحضور</div></div>
                        <div className="text-center p-2 bg-muted/50 rounded"><div className="font-bold">{report.pointsBalance?.recitation_points || 0}</div><div className="text-xs">التسميع</div></div>
                        <div className="text-center p-2 bg-muted/50 rounded"><div className="font-bold">{report.pointsBalance?.bonus_points || 0}</div><div className="text-xs">الإضافية</div></div>
                        <div className="text-center p-2 bg-muted/50 rounded"><div className="font-bold">{report.pointsBalance?.total || 0}</div><div className="text-xs">المجموع</div></div>
                      </div>
                    </div>
                  )}

                  {reportOptions.attendance && report.attendance.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-blue-700 bg-blue-50 p-2 rounded flex justify-between items-center">
                        <span>سجل الحضور</span>
                        <Badge variant="secondary">{report.attendance.length} يوم</Badge>
                      </h4>
                      <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                        {report.attendance.map((att: any) => (
                          <div key={att.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                            <span>{formatDate(att.date)}</span>
                            <Badge variant={att.status === 'حاضر' ? 'default' : att.status === 'غائب' ? 'destructive' : 'secondary'}>{att.status}</Badge>
                            <span className="font-bold">{att.points || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.recitations && report.recitations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-purple-700 bg-purple-50 p-2 rounded flex justify-between items-center">
                        <span>سجل التسميع</span>
                        <Badge variant="secondary">{report.recitations.length} تسميع</Badge>
                      </h4>
                      <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                        {report.recitations.map((rec: any) => (
                          <div key={rec.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                            <span className="text-xs">{formatDate(rec.date)}</span>
                            <span className="flex-1 px-2 text-xs">{rec.last_saved}</span>
                            <Badge className="text-xs">{rec.rating}</Badge>
                            <span className="font-bold text-xs">{rec.points_awarded || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.notes && report.bonusPoints.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-amber-700 bg-amber-50 p-2 rounded flex justify-between items-center">
                        <span>النقاط الإضافية</span>
                        <Badge variant="secondary">{report.bonusPoints.length} نقطة</Badge>
                      </h4>
                      <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                        {report.bonusPoints.map((bp: any) => (
                          <div key={bp.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                            <div className="flex-1">
                              <div className="font-semibold text-xs">{bp.reason}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(bp.date)}</div>
                            </div>
                            <Badge variant="outline" className="bg-amber-50">+{bp.points}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportOptions.tools && report.checkRecords.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-rose-700 bg-rose-50 p-2 rounded flex justify-between items-center">
                        <span>سجل تفقد الأدوات</span>
                        <Badge variant="secondary">{report.checkRecords.length} سجل</Badge>
                      </h4>
                      <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                        {report.checkRecords.map((cr: any) => (
                          <div key={cr.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                            <div className="flex-1">
                              <span className="font-semibold text-xs">{cr.check_items?.name || 'أداة'}</span>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{formatDate(cr.date)}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                              <Badge variant={cr.status === 'موجود' ? 'default' : cr.status === 'فقدان' ? 'destructive' : 'secondary'} className="text-xs">{cr.status}</Badge>
                              <span className={`font-bold text-xs ${cr.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>{cr.points > 0 ? '+' : ''}{cr.points}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />إنشاء تقرير الطلاب</DialogTitle></DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />الفترة الزمنية</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(7)} className="text-xs"><Clock className="w-3 h-3 ml-1" />آخر أسبوع</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(14)} className="text-xs"><Clock className="w-3 h-3 ml-1" />آخر أسبوعين</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(30)} className="text-xs"><Clock className="w-3 h-3 ml-1" />آخر شهر</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDateRange(90)} className="text-xs"><Clock className="w-3 h-3 ml-1" />آخر 3 أشهر</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="startDate" className="text-sm text-muted-foreground">من تاريخ</Label><Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><Label htmlFor="endDate" className="text-sm text-muted-foreground">إلى تاريخ</Label><Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><FileText className="w-4 h-4" />محتويات التقرير</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllOptions}>تحديد الكل</Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAllOptions}>إلغاء التحديد</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleReportOption('points')}><Checkbox id="option-points" checked={reportOptions.points} onCheckedChange={() => toggleReportOption('points')} /><Label htmlFor="option-points" className="cursor-pointer">رصيد النقاط</Label></div>
              <div className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleReportOption('attendance')}><Checkbox id="option-attendance" checked={reportOptions.attendance} onCheckedChange={() => toggleReportOption('attendance')} /><Label htmlFor="option-attendance" className="cursor-pointer">سجل الحضور</Label></div>
              <div className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleReportOption('recitations')}><Checkbox id="option-recitations" checked={reportOptions.recitations} onCheckedChange={() => toggleReportOption('recitations')} /><Label htmlFor="option-recitations" className="cursor-pointer">سجل التسميع</Label></div>
              <div className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleReportOption('tools')}><Checkbox id="option-tools" checked={reportOptions.tools} onCheckedChange={() => toggleReportOption('tools')} /><Label htmlFor="option-tools" className="cursor-pointer">تفقد الأدوات</Label></div>
              <div className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleReportOption('notes')}><Checkbox id="option-notes" checked={reportOptions.notes} onCheckedChange={() => toggleReportOption('notes')} /><Label htmlFor="option-notes" className="cursor-pointer">النقاط الإضافية</Label></div>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4" />اختيار الطلاب ({selectedStudents.length} من {students.length})</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>تحديد الكل</Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAllStudents}>إلغاء التحديد</Button>
              </div>
            </div>
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
              {students.length === 0 ? <p className="text-center text-muted-foreground py-8">لا يوجد طلاب</p> : students.map((student) => (
                <div key={student.id} className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => handleStudentToggle(student.id)}>
                  <Checkbox id={student.id} checked={selectedStudents.includes(student.id)} onCheckedChange={() => handleStudentToggle(student.id)} />
                  <Label htmlFor={student.id} className="flex-1 cursor-pointer flex items-center justify-between"><span>{student.student_name}</span><Badge variant="outline" className="text-xs">{student.grade || "غير محدد"}</Badge></Label>
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div className="flex gap-3">
            <Button onClick={generateReport} disabled={loading || selectedStudents.length === 0} className="flex-1">{loading ? "جاري إنشاء التقرير..." : "إنشاء التقرير"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherReportsDialog;
