import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3, Award, XCircle } from "lucide-react";

interface StudentStatisticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const StudentStatisticsDialog = ({ open, onOpenChange }: StudentStatisticsDialogProps) => {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);

  const setDateRange = (type: 'week' | 'month' | '3months' | 'all') => {
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
  };

  const fetchStatistics = async () => {
    if (!startDate || !endDate) {
      toast.error("يرجى تحديد الفترة الزمنية");
      return;
    }

    setLoading(true);
    try {
      // جلب جميع الطلاب
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, student_name");

      if (studentsError) throw studentsError;

      // جلب نقاط كل طالب
      const studentPointsPromises = studentsData.map(async (student) => {
        // حساب نقاط الحضور
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

        // حساب نقاط التسميع
        const { data: recitationsData } = await supabase
          .from("recitations")
          .select("points_awarded")
          .eq("student_id", student.id)
          .gte("date", startDate)
          .lte("date", endDate);

        const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;

        // حساب النقاط الإضافية
        const { data: bonusData } = await supabase
          .from("bonus_points")
          .select("points")
          .eq("student_id", student.id)
          .gte("date", startDate)
          .lte("date", endDate);

        const bonusPoints = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

        // حساب الغيابات
        const absences = attendanceData?.filter(a => a.status === 'غائب').length || 0;

        return {
          student_name: student.student_name,
          points: attendancePoints + recitationPoints + bonusPoints,
          absences
        };
      });

      const studentPoints = await Promise.all(studentPointsPromises);

      // حساب الإحصائيات
      const totalPoints = studentPoints.reduce((sum, s) => sum + s.points, 0);
      const totalAbsences = studentPoints.reduce((sum, s) => sum + s.absences, 0);

      // أفضل 10 طلاب
      const topStudents = studentPoints
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
        .map(s => ({ student_name: s.student_name, points: s.points }));

      // أكثر 10 طلاب غياباً
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            إحصائيات الطلاب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentStatisticsDialog;
