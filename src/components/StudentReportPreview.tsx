import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  X, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  BookOpen, 
  Star,
  MessageSquare,
  Award,
  TrendingUp,
  PieChart as PieChartIcon
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StudentReportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportData: {
    student: any;
    attendance: any[];
    recitations: any[];
    bonusPoints: any[];
    checkRecords?: any[];
    notes: any[];
    points?: any;
    dateRange: {
      from: Date;
      to: Date;
    };
  };
}

const StudentReportPreview = ({ open, onOpenChange, reportData }: StudentReportPreviewProps) => {
  const isMobile = useIsMobile();

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Prepare chart data - Points progress over time
  const progressData = reportData.attendance
    .map((att: any) => ({
      date: new Date(att.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      نقاط: att.points || 0,
      fullDate: att.date
    }))
    .concat(
      reportData.recitations.map((rec: any) => ({
        date: new Date(rec.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
        نقاط: rec.points_awarded || 0,
        fullDate: rec.date
      }))
    )
    .concat(
      reportData.bonusPoints.map((bonus: any) => ({
        date: new Date(bonus.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
        نقاط: bonus.points || 0,
        fullDate: bonus.date
      }))
    )
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
    .reduce((acc: any[], curr) => {
      const lastTotal = acc.length > 0 ? acc[acc.length - 1].الإجمالي : 0;
      acc.push({
        date: curr.date,
        النقاط: curr.نقاط,
        الإجمالي: lastTotal + curr.نقاط
      });
      return acc;
    }, []);

  // Prepare pie chart data - Points distribution
  const pieData = [
    { name: 'نقاط الحضور', value: reportData.points?.attendance_points || 0, color: '#10b981' },
    { name: 'نقاط التسميع', value: reportData.points?.recitation_points || 0, color: '#3b82f6' },
    { name: 'نقاط إضافية', value: reportData.points?.bonus_points || 0, color: '#a855f7' }
  ].filter(item => item.value > 0);

  const ReportContent = () => (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header - Hidden on print */}
      <div className="flex items-center justify-between pb-4 border-b print:hidden">
        <h2 className="text-xl md:text-2xl font-bold">معاينة التقرير</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            onClick={handlePrint}
            size={isMobile ? "sm" : "default"}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Print Header - Only visible on print */}
      <div className="hidden print:block text-center space-y-2 mb-6">
        <h1 className="text-2xl font-bold">تقرير الطالب</h1>
        <p className="text-sm text-muted-foreground">
          الفترة من {formatDate(reportData.dateRange.from)} إلى {formatDate(reportData.dateRange.to)}
        </p>
      </div>

      {/* Student Info */}
      <Card className="p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">اسم الطالب:</span>
            <span className="font-semibold">{reportData.student.student_name}</span>
          </div>
          {reportData.student.phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رقم الهاتف:</span>
              <span className="font-semibold">{reportData.student.phone}</span>
            </div>
          )}
          {reportData.student.grade && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">الحلقة:</span>
              <span className="font-semibold">{reportData.student.grade}</span>
            </div>
          )}
          {reportData.student.mosque_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">المسجد:</span>
              <span className="font-semibold">{reportData.student.mosque_name}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Points Summary */}
      {reportData.points && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
          <Card className="p-3 bg-primary/10 text-center">
            <div className="text-2xl font-bold text-primary">{reportData.points.total}</div>
            <div className="text-xs text-muted-foreground mt-1">مجموع النقاط</div>
          </Card>
          <Card className="p-3 bg-green-100 dark:bg-green-900/20 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {reportData.points.attendance_points || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">نقاط الحضور</div>
          </Card>
          <Card className="p-3 bg-blue-100 dark:bg-blue-900/20 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {reportData.points.recitation_points || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">نقاط التسميع</div>
          </Card>
          <Card className="p-3 bg-purple-100 dark:bg-purple-900/20 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {reportData.points.bonus_points || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">نقاط إضافية</div>
          </Card>
        </div>
      )}

      {/* Interactive Charts - Hidden on print */}
      {progressData.length > 0 && (
        <div className="space-y-4 print:hidden">
          <Separator />
          
          {/* Progress Chart */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
              تطور الأداء خلال الفترة
            </h3>
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="الإجمالي" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="النقاط" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Pie Chart - Points Distribution */}
          {pieData.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 md:w-5 md:h-5" />
                توزيع النقاط
              </h3>
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Attendance Statistics */}
      <div className="space-y-3">
        <h3 className="font-semibold text-base md:text-lg flex items-center gap-2">
          <Calendar className="w-4 h-4 md:w-5 md:h-5" />
          إحصائيات الحضور
        </h3>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Card className="p-3 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-center">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {reportData.attendance.filter((a: any) => a.status === 'حاضر').length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">حاضر</div>
          </Card>
          <Card className="p-3 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-center">
            <div className="text-xl font-bold text-red-600 dark:text-red-400">
              {reportData.attendance.filter((a: any) => a.status === 'غائب').length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">غائب</div>
          </Card>
          <Card className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800 text-center">
            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
              {reportData.attendance.filter((a: any) => a.status === 'اعتذر').length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">اعتذر</div>
          </Card>
        </div>
      </div>

      {/* Detailed Attendance Records */}
      {reportData.attendance.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            تفاصيل أيام الحضور ({reportData.attendance.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {reportData.attendance.map((att: any) => (
              <Card key={att.id} className="p-2 md:p-3">
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-muted-foreground">
                    {new Date(att.date).toLocaleDateString('ar-EG', { 
                      weekday: 'short',
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {att.status === 'حاضر' && (
                      <>
                        <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          حاضر
                        </Badge>
                      </>
                    )}
                    {att.status === 'غائب' && (
                      <>
                        <XCircle className="w-3 h-3 md:w-4 md:h-4 text-red-600" />
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                          غائب
                        </Badge>
                      </>
                    )}
                    {att.status === 'اعتذر' && (
                      <>
                        <Clock className="w-3 h-3 md:w-4 md:h-4 text-yellow-600" />
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                          اعتذر
                        </Badge>
                      </>
                    )}
                    {att.points > 0 && (
                      <span className="text-xs font-semibold text-primary">+{att.points}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recitations */}
      {reportData.recitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            سجل التسميع ({reportData.recitations.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {reportData.recitations.map((rec: any) => (
              <Card key={rec.id} className="p-2 md:p-3 space-y-1">
                <div className="flex justify-between items-start text-xs md:text-sm">
                  <div className="space-y-1 flex-1">
                    <div className="font-medium">{rec.last_saved}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rec.date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <Badge variant={rec.rating === 'ممتاز' ? 'default' : 'secondary'} className="text-xs">
                      {rec.rating}
                    </Badge>
                    {rec.points_awarded > 0 && (
                      <div className="text-xs font-semibold text-primary">
                        +{rec.points_awarded}
                      </div>
                    )}
                  </div>
                </div>
                {rec.notes && (
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    {rec.notes}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Check Records (Tools) */}
      {reportData.checkRecords && reportData.checkRecords.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
            <Award className="w-4 h-4" />
            سجل تفقد الأدوات ({reportData.checkRecords.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {reportData.checkRecords.map((check: any) => (
              <Card key={check.id} className="p-2 md:p-3">
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">{check.check_items?.name || check.item_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(check.date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <Badge 
                      variant={check.status === 'موجود' || check.status === 'brought' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {check.status}
                    </Badge>
                    <div className={`text-xs font-semibold ${check.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {check.points >= 0 ? '+' : ''}{check.points}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Bonus Points */}
      {reportData.bonusPoints.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
            <Star className="w-4 h-4" />
            النقاط الإضافية ({reportData.bonusPoints.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {reportData.bonusPoints.map((bonus: any) => (
              <Card key={bonus.id} className="p-2 md:p-3">
                <div className="flex justify-between items-start text-xs md:text-sm">
                  <div className="flex-1 space-y-1">
                    <div className="font-medium">{bonus.reason}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(bonus.date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    +{bonus.points}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {reportData.notes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            الملاحظات ({reportData.notes.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {reportData.notes.map((note: any) => (
              <Card key={note.id} className="p-2 md:p-3 space-y-2 text-xs md:text-sm">
                <p className="text-foreground">{note.note}</p>
                <div className="text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Print Footer */}
      <div className="hidden print:block text-center text-xs text-muted-foreground pt-4 border-t mt-6">
        تم إنشاء التقرير في {new Date().toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[95vh]">
            <DrawerHeader className="text-right">
              <DrawerTitle>معاينة التقرير</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">
              <ReportContent />
            </div>
          </DrawerContent>
        </Drawer>
        
        {/* Print Styles */}
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 1cm;
            }
            
            body * {
              visibility: hidden;
            }
            
            .print\\:block {
              display: block !important;
              visibility: visible !important;
            }
            
            .print\\:hidden, .print\\:hidden * {
              display: none !important;
            }
            
            [vaul-drawer-wrapper] {
              position: static !important;
            }
            
            [vaul-drawer] {
              position: static !important;
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
              overflow: visible !important;
              transform: none !important;
            }
            
            [vaul-drawer] *, [vaul-drawer] {
              visibility: visible !important;
            }
            
            /* Print-specific styling */
            body {
              background: white !important;
            }
            
            /* Better card printing */
            [class*="Card"], [class*="card"] {
              border: 1px solid #e5e7eb !important;
              page-break-inside: avoid;
            }
            
            /* Better text contrast for print */
            h1, h2, h3, h4, h5, h6 {
              color: #000 !important;
            }
            
            /* Avoid breaking inside elements */
            .space-y-3 > div {
              page-break-inside: avoid;
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <ReportContent />
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print\\:block {
            display: block !important;
            visibility: visible !important;
          }
          
          .print\\:hidden, .print\\:hidden * {
            display: none !important;
          }
          
          [role="dialog"] {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          [role="dialog"] *, [role="dialog"] {
            visibility: visible !important;
          }
          
          /* Print-specific styling */
          body {
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Better card printing */
          [class*="Card"], [class*="card"] {
            border: 1px solid #e5e7eb !important;
            page-break-inside: avoid;
            box-shadow: none !important;
          }
          
          /* Better text contrast for print */
          h1, h2, h3, h4, h5, h6 {
            color: #000 !important;
          }
          
          /* Avoid breaking inside elements */
          .space-y-3 > div, .space-y-4 > div {
            page-break-inside: avoid;
          }
          
          /* Ensure colors print correctly */
          .bg-green-50, .bg-green-100 {
            background-color: #f0fdf4 !important;
          }
          
          .bg-red-50, .bg-red-100 {
            background-color: #fef2f2 !important;
          }
          
          .bg-yellow-50, .bg-yellow-100 {
            background-color: #fefce8 !important;
          }
          
          .bg-blue-50, .bg-blue-100 {
            background-color: #eff6ff !important;
          }
          
          .bg-purple-50, .bg-purple-100 {
            background-color: #faf5ff !important;
          }
        }
      `}</style>
    </>
  );
};

export default StudentReportPreview;
