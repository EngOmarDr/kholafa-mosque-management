import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkEditStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudentIds: string[];
  onSuccess: () => void;
  teachers: string[];
  mosques: string[];
}

interface TeacherStats {
  teacher: string;
  teacherId: string;
  studentCount: number;
  mostFrequentGrade: string;
}

export function BulkEditStudentsDialog({
  open,
  onOpenChange,
  selectedStudentIds,
  onSuccess,
  teachers,
  mosques,
}: BulkEditStudentsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [teachersData, setTeachersData] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    teacher_id: "",
    current_teacher: "",
    mosque_name: "",
    registration_status: "",
    grade: "",
  });

  useEffect(() => {
    if (open) {
      fetchAllStudents();
      fetchTeachers();
    }
  }, [open]);

  const fetchAllStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, current_teacher, grade, teacher_id");

      if (error) throw error;
      setAllStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select('id, "اسم الاستاذ"')
        .order('"اسم الاستاذ"');

      if (error) throw error;
      console.log("Teachers data fetched:", data);
      setTeachersData(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ أثناء جلب بيانات الأساتذة");
    }
  };

  const teacherStats = useMemo(() => {
    const stats: Record<string, TeacherStats & { teacherId: string }> = {};
    
    teachersData.forEach((teacher) => {
      const teacherStudents = allStudents.filter(
        (s) => s.teacher_id === teacher.id
      );
      
      const gradeCount: Record<string, number> = {};
      teacherStudents.forEach((student) => {
        if (student.grade) {
          gradeCount[student.grade] = (gradeCount[student.grade] || 0) + 1;
        }
      });
      
      const mostFrequentGrade = Object.entries(gradeCount).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] || "غير محدد";
      
      stats[teacher.id] = {
        teacher: teacher["اسم الاستاذ"],
        teacherId: teacher.id,
        studentCount: teacherStudents.length,
        mostFrequentGrade,
      };
    });
    
    return stats;
  }, [teachersData, allStudents]);

  const getCountColor = (count: number) => {
    if (count > 9) return "bg-destructive text-destructive-foreground";
    if (count === 9) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("لم يتم تحديد أي طلاب");
      return;
    }

    setLoading(true);

    try {
      // Build update object with only filled fields
      const updateData: any = {};
      
      // معالجة الأستاذ
      if (formData.teacher_id) {
        if (formData.teacher_id === "__CLEAR__") {
          updateData.teacher_id = null;
          updateData.current_teacher = null;
        } else {
          const selectedTeacher = teachersData.find(t => t.id === formData.teacher_id);
          updateData.teacher_id = formData.teacher_id;
          updateData.current_teacher = selectedTeacher?.["اسم الاستاذ"] || null;
        }
      }
      
      if (formData.mosque_name) {
        if (formData.mosque_name === "__CLEAR__") {
          updateData.mosque_name = null;
        } else {
          updateData.mosque_name = formData.mosque_name;
        }
      }
      
      if (formData.registration_status) {
        if (formData.registration_status === "__CLEAR__") {
          updateData.registration_status = null;
        } else {
          updateData.registration_status = formData.registration_status;
        }
      }
      
      if (formData.grade) updateData.grade = formData.grade;

      if (Object.keys(updateData).length === 0) {
        toast.error("يرجى ملء حقل واحد على الأقل للتعديل");
        setLoading(false);
        return;
      }

      // تسجيل تغييرات الأستاذ في السجل إذا تغير
      if (formData.teacher_id && formData.teacher_id !== "__CLEAR__") {
        const { data: userData } = await supabase.auth.getUser();
        const newTeacherName = teachersData.find(t => t.id === formData.teacher_id)?.["اسم الاستاذ"] || "بدون أستاذ";
        
        // جلب الطلاب المحددين لمعرفة أستاذهم الحالي
        const { data: studentsToUpdate } = await supabase
          .from("students")
          .select("id, current_teacher, teacher_id")
          .in("id", selectedStudentIds);
        
        // تسجيل تغييرات الأستاذ لكل طالب تغير أستاذه
        if (studentsToUpdate) {
          const historyRecords = studentsToUpdate
            .filter(s => s.teacher_id !== formData.teacher_id)
            .map(s => ({
              student_id: s.id,
              old_teacher: s.current_teacher || "بدون أستاذ",
              new_teacher: newTeacherName,
              updated_by: userData?.user?.id || null
            }));
          
          if (historyRecords.length > 0) {
            await supabase.from("student_teacher_history").insert(historyRecords);
          }
        }
      }

      const { error } = await supabase
        .from("students")
        .update(updateData)
        .in("id", selectedStudentIds);

      if (error) throw error;

      toast.success(`تم تحديث ${selectedStudentIds.length} طالب بنجاح`);
      onSuccess();
      onOpenChange(false);
      setFormData({
        teacher_id: "",
        current_teacher: "",
        mosque_name: "",
        registration_status: "",
        grade: "",
      });
    } catch (error) {
      console.error("Error bulk updating students:", error);
      toast.error("حدث خطأ أثناء تحديث الطلاب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل جماعي ({selectedStudentIds.length} طالب)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            املأ فقط الحقول التي تريد تحديثها. الحقول الفارغة لن يتم تغييرها.
          </p>

          <div className="space-y-2">
            <Label>الأستاذ</Label>
            <Select
              value={formData.teacher_id}
              onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الأستاذ" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                className="max-h-[300px] overflow-y-auto bg-background z-50"
                sideOffset={5}
              >
                <SelectItem value="__CLEAR__">مسح القيمة</SelectItem>
                {teachersData.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    لا يوجد أساتذة
                  </div>
                ) : (
                  teachersData.map((teacher) => {
                    const stats = teacherStats[teacher.id];
                    return (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{teacher["اسم الاستاذ"]}</span>
                          {stats && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                ({stats.mostFrequentGrade})
                              </span>
                              <span
                                className={`text-xs font-bold px-1.5 py-0.5 rounded ${getCountColor(
                                  stats.studentCount
                                )}`}
                              >
                                {stats.studentCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المسجد</Label>
            <Select
              value={formData.mosque_name}
              onValueChange={(value) => setFormData({ ...formData, mosque_name: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المسجد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">مسح القيمة</SelectItem>
                {mosques.map((mosque) => (
                  <SelectItem key={mosque} value={mosque}>
                    {mosque}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>حالة التسجيل</Label>
            <Select
              value={formData.registration_status}
              onValueChange={(value) => setFormData({ ...formData, registration_status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">مسح القيمة</SelectItem>
                <SelectItem value="مسجل">مسجل</SelectItem>
                <SelectItem value="غير مسجل">غير مسجل</SelectItem>
                <SelectItem value="انتظار">انتظار</SelectItem>
                <SelectItem value="غير مدرج بعد">غير مدرج بعد</SelectItem>
                <SelectItem value="فترة تجربة">فترة تجربة</SelectItem>
                <SelectItem value="متدرب">متدرب</SelectItem>
                <SelectItem value="حافظ">حافظ</SelectItem>
                <SelectItem value="مجاز">مجاز</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الصف</Label>
            <Input
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              placeholder="مثال: الصف الخامس"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "جاري التحديث..." : "تحديث"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
