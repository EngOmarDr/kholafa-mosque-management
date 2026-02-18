import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkTransferStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: any;
  onSuccess: () => void;
}

const BulkTransferStudentsDialog = ({ open, onOpenChange, teacher, onSuccess }: BulkTransferStudentsDialogProps) => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [newTeacherId, setNewTeacherId] = useState<string>("");
  const [individualTeachers, setIndividualTeachers] = useState<Record<string, string>>({});
  const [individualStatuses, setIndividualStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (open && teacher) {
      fetchStudents();
      fetchAvailableTeachers();
      setSelectedStudents(new Set());
      setNewTeacherId("");
      setIndividualTeachers({});
      setIndividualStatuses({});
      setShowConfirmation(false);
    }
  }, [open, teacher]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("teacher_id", teacher.id)
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل الطلاب");
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .neq("id", teacher.id)
        .order("اسم الاستاذ");

      if (error) throw error;
      setAvailableTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل الأساتذة");
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleIndividualTeacherChange = (studentId: string, teacherId: string) => {
    setIndividualTeachers(prev => ({
      ...prev,
      [studentId]: teacherId
    }));
  };

  const handleTransfer = async () => {
    if (selectedStudents.size === 0) {
      toast.error("الرجاء اختيار طالب واحد على الأقل");
      return;
    }

    // التحقق من أن كل طالب محدد لديه أستاذ جديد
    const studentsWithoutTeacher = Array.from(selectedStudents).filter(
      studentId => !individualTeachers[studentId] && !newTeacherId
    );

    if (studentsWithoutTeacher.length > 0) {
      toast.error("الرجاء اختيار الأستاذ الجديد لجميع الطلاب المحددين");
      return;
    }

    setLoading(true);

    try {
      const studentIds = Array.from(selectedStudents);
      const currentUser = (await supabase.auth.getUser()).data.user;

      // تحديث كل طالب بأستاذه الجديد
      for (const studentId of studentIds) {
        const targetTeacherId = individualTeachers[studentId] || newTeacherId;
        const newTeacher = availableTeachers.find(t => t.id === targetTeacherId);
        const newStatus = individualStatuses[studentId];
        
        const updateData: any = {
          teacher_id: targetTeacherId,
          current_teacher: newTeacher?.["اسم الاستاذ"]
        };
        
        // إضافة حالة التسجيل إذا تم تحديدها
        if (newStatus) {
          updateData.registration_status = newStatus;
        }

        const { error: updateError } = await supabase
          .from("students")
          .update(updateData)
          .eq("id", studentId);

        if (updateError) throw updateError;

        // تسجيل التغيير في سجل تاريخ الأساتذة
        await supabase
          .from("student_teacher_history")
          .insert({
            student_id: studentId,
            old_teacher: teacher["اسم الاستاذ"],
            new_teacher: newTeacher?.["اسم الاستاذ"],
            updated_by: currentUser?.id
          });
      }

      toast.success(`تم نقل ${selectedStudents.size} طالب بنجاح ✅`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error transferring students:", error);
      toast.error("حدث خطأ أثناء نقل الطلاب");
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const selectedTeacher = availableTeachers.find(t => t.id === newTeacherId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            نقل الطلاب الجماعي
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            نقل طلاب الأستاذ <span className="font-bold text-foreground">{teacher?.["اسم الاستاذ"]}</span> إلى أستاذ آخر
          </p>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6 py-4">
            {/* اختيار الأستاذ الجديد */}
            <div className="space-y-2">
              <label className="text-sm font-medium">الأستاذ الجديد</label>
              <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الأستاذ الجديد" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher["اسم الاستاذ"]}
                      {teacher["رقم الهاتف"] && ` - ${teacher["رقم الهاتف"]}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* قائمة الطلاب */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  الطلاب ({students.length})
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedStudents.size === students.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </Button>
              </div>

              {students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد طلاب لهذا الأستاذ
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedStudents.has(student.id)}
                        onCheckedChange={() => handleSelectStudent(student.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <div className="font-medium">{student.student_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {student.grade && `الصف: ${student.grade}`}
                            {student.phone && ` • ${student.phone}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            حالة التسجيل: <span className="font-medium">{student.registration_status || "مسجل"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Select 
                              value={individualTeachers[student.id] || ""} 
                              onValueChange={(value) => handleIndividualTeacherChange(student.id, value)}
                              disabled={!selectedStudents.has(student.id)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="اختر الأستاذ" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTeachers.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t["اسم الاستاذ"]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Select
                              value={individualStatuses[student.id] || student.registration_status || "مسجل"}
                              onValueChange={(value) => {
                                setIndividualStatuses(prev => ({
                                  ...prev,
                                  [student.id]: value
                                }));
                              }}
                              disabled={!selectedStudents.has(student.id)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="حالة التسجيل" />
                              </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="مسجل">مسجل</SelectItem>
                                <SelectItem value="غير مدرج بعد">غير مدرج بعد</SelectItem>
                                <SelectItem value="انتظار">انتظار</SelectItem>
                                <SelectItem value="فترة تجربة">فترة تجربة</SelectItem>
                                <SelectItem value="مجاز">مجاز</SelectItem>
                                <SelectItem value="حافظ">حافظ</SelectItem>
                                <SelectItem value="متدرب">متدرب</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedStudents.size > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  سيتم نقل <span className="font-bold">{selectedStudents.size}</span> طالب من 
                  <span className="font-bold"> {teacher?.["اسم الاستاذ"]} </span>
                  {newTeacherId && !Object.keys(individualTeachers).some(id => selectedStudents.has(id)) && (
                    <>
                      إلى <span className="font-bold"> {selectedTeacher?.["اسم الاستاذ"]}</span>
                    </>
                  )}
                  {Object.keys(individualTeachers).some(id => selectedStudents.has(id)) && (
                    <span> إلى الأساتذة المحددين لكل طالب</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="py-8">
            <Alert className="border-primary">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertDescription className="text-base">
                <div className="space-y-2">
                  <p className="font-bold">هل أنت متأكد من نقل الطلاب؟</p>
                  <p className="text-sm">
                    سيتم نقل <span className="font-bold text-primary">{selectedStudents.size}</span> طالب
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span>من:</span>
                    <span className="font-bold">{teacher?.["اسم الاستاذ"]}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span>إلى:</span>
                    <span className="font-bold">{selectedTeacher?.["اسم الاستاذ"]}</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {!showConfirmation ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                إلغاء
              </Button>
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={
                  selectedStudents.size === 0 || 
                  (Array.from(selectedStudents).some(id => !individualTeachers[id]) && !newTeacherId)
                }
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                متابعة
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={loading}
              >
                رجوع
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={loading}
              >
                {loading ? "جاري النقل..." : "تأكيد النقل"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTransferStudentsDialog;
