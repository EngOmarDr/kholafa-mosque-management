import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminStatisticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StudentStats {
  id: string;
  student_name: string;
  total_points: number;
  absent_count: number;
}

const AdminStatisticsDialog = ({ open, onOpenChange }: AdminStatisticsDialogProps) => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [topStudents, setTopStudents] = useState<StudentStats[]>([]);
  const [mostAbsent, setMostAbsent] = useState<StudentStats[]>([]);

  useEffect(() => {
    if (open) {
      fetchTeachers();
    }
  }, [open]);

  useEffect(() => {
    if (selectedTeacherId) {
      fetchStatistics();
    }
  }, [selectedTeacherId]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select('id, "اسم الاستاذ"')
        .order("اسم الاستاذ");

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل قائمة الأساتذة");
    }
  };

  const fetchStatistics = async () => {
    if (!selectedTeacherId) return;
    
    setLoading(true);
    try {
      // جلب طلاب الأستاذ
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          student_name,
          points_balance(total)
        `)
        .eq("teacher_id", selectedTeacherId);

      if (studentsError) throw studentsError;

      if (!students || students.length === 0) {
        setTopStudents([]);
        setMostAbsent([]);
        setLoading(false);
        toast.info("لا يوجد طلاب لهذا الأستاذ");
        return;
      }

      // جلب بيانات الغياب لكل طالب
      const studentIds = students.map(s => s.id);
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("student_id, status")
        .in("student_id", studentIds);

      if (attendanceError) throw attendanceError;

      // حساب عدد الغيابات لكل طالب
      const absentCounts: Record<string, number> = {};
      attendanceData?.forEach(att => {
        if (att.status === 'غائب') {
          absentCounts[att.student_id] = (absentCounts[att.student_id] || 0) + 1;
        }
      });

      // تجهيز البيانات
      const studentsStats: StudentStats[] = students.map(student => ({
        id: student.id,
        student_name: student.student_name,
        total_points: student.points_balance?.[0]?.total || 0,
        absent_count: absentCounts[student.id] || 0
      }));

      // أفضل 3 طلاب بالنقاط
      const top3 = [...studentsStats]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 3);

      // أكثر 3 طلاب غياباً
      const mostAbsent3 = [...studentsStats]
        .sort((a, b) => b.absent_count - a.absent_count)
        .slice(0, 3);

      setTopStudents(top3);
      setMostAbsent(mostAbsent3);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast.error("حدث خطأ في تحميل الإحصائيات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">إحصائيات الطلاب</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* اختيار الأستاذ */}
          <div>
            <Label>اختر الأستاذ</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر أستاذاً..." />
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

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : selectedTeacherId ? (
            <>
              {/* أفضل 3 طلاب */}
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  أفضل 3 طلاب بالنقاط
                </h4>
                {topStudents.length > 0 ? (
                  <div className="space-y-2">
                    {topStudents.map((student, index) => (
                      <div
                        key={student.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                          index === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                          'bg-orange-500/10 border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${
                            index === 0 ? 'bg-yellow-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            'bg-orange-500 text-white'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-medium">{student.student_name}</span>
                        </div>
                        <span className="text-primary font-bold text-lg">
                          {student.total_points} نقطة
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">لا توجد بيانات</p>
                )}
              </div>

              {/* أكثر 3 طلاب غياباً */}
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  أكثر 3 طلاب غياباً
                </h4>
                {mostAbsent.length > 0 ? (
                  <div className="space-y-2">
                    {mostAbsent.map((student, index) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-red-500/10 border-red-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg">
                            {index + 1}
                          </div>
                          <span className="font-medium">{student.student_name}</span>
                        </div>
                        <span className="text-red-600 font-bold text-lg">
                          {student.absent_count} غياب
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">لا توجد بيانات</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">
              اختر أستاذاً لعرض الإحصائيات
            </p>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          إغلاق
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AdminStatisticsDialog;
