import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, CheckCircle2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Student {
  id: string;
  student_name: string;
  grade?: string;
}

interface Teacher {
  id: string;
  "اسم الاستاذ": string;
  user_id: string | null;
}

interface StudentReassignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  teacherName: string;
  currentTeacherId: string;
  onReassignmentComplete?: () => void;
}

export const StudentReassignmentDialog = ({
  open,
  onOpenChange,
  students,
  teacherName,
  currentTeacherId,
  onReassignmentComplete
}: StudentReassignmentDialogProps) => {
  const [selectedTeachers, setSelectedTeachers] = useState<Record<string, string>>({});
  const [bulkTeacher, setBulkTeacher] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all teachers except the current one
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-reassignment', currentTeacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, "اسم الاستاذ", user_id')
        .neq('id', currentTeacherId);
      
      if (error) throw error;
      return data as Teacher[];
    },
    enabled: open,
  });

  // Fetch all students for each teacher to calculate most frequent grade
  const { data: allStudents = [] } = useQuery({
    queryKey: ['all-students-by-teacher'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, teacher_id, grade');
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch admin users to warn when assigning to admin
  const { data: adminRoles = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');
      if (error) throw error;
      return data as { user_id: string; role: string }[];
    },
    enabled: open,
  });

  const adminUserIds = useMemo(() => new Set(adminRoles.map(r => r.user_id)), [adminRoles]);

  // Calculate most frequent grade and student count for each teacher
  const teacherStats = useMemo(() => {
    const statsMap: Record<string, { mostFrequentGrade: string; studentCount: number }> = {};
    
    teachers.forEach(teacher => {
      const teacherStudents = allStudents.filter(s => s.teacher_id === teacher.id);
      const studentCount = teacherStudents.length;
      
      if (studentCount === 0) {
        statsMap[teacher.id] = { mostFrequentGrade: 'لا يوجد طلاب', studentCount: 0 };
        return;
      }

      // Count grades
      const gradeCounts: Record<string, number> = {};
      teacherStudents.forEach(student => {
        if (student.grade) {
          gradeCounts[student.grade] = (gradeCounts[student.grade] || 0) + 1;
        }
      });

      // Find most frequent
      let maxCount = 0;
      let mostFrequent = '';
      Object.entries(gradeCounts).forEach(([grade, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFrequent = grade;
        }
      });

      statsMap[teacher.id] = {
        mostFrequentGrade: mostFrequent || 'غير محدد',
        studentCount
      };
    });

    return statsMap;
  }, [teachers, allStudents]);

  const reassignMutation = useMutation({
    mutationFn: async () => {
      // التحقق من أن جميع الطلاب لديهم أستاذ محدد
      const studentsToUpdate = Object.entries(selectedTeachers);
      if (studentsToUpdate.length !== students.length) {
        throw new Error('يجب اختيار أستاذ لجميع الطلاب');
      }

      // تحديث كل طالب على حدة مع معالجة الأخطاء
      const results = [];
      for (const [studentId, newTeacherId] of studentsToUpdate) {
        const { data, error } = await supabase
          .from('students')
          .update({ teacher_id: newTeacherId })
          .eq('id', studentId)
          .select();
        
        if (error) {
          console.error(`Error updating student ${studentId}:`, error);
          throw new Error(`فشل تحديث الطالب: ${error.message}`);
        }
        results.push(data);
      }

      return results;
    },
    onSuccess: async () => {
      toast.success('تم إعادة تعيين الطلاب بنجاح');
      
      // انتظار قليلاً لضمان تحديث البيانات
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // تحديث البيانات
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['teachers'] });
      await queryClient.refetchQueries({ queryKey: ['students'] });
      
      onReassignmentComplete?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error reassigning students:', error);
      toast.error(error.message || 'حدث خطأ أثناء إعادة تعيين الطلاب');
    },
  });

  const handleReassign = () => {
    // Check all students have a teacher selected
    const unassigned = students.filter(s => !selectedTeachers[s.id]);
    if (unassigned.length > 0) {
      toast.error('يرجى اختيار أستاذ لجميع الطلاب');
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmReassign = () => {
    setShowConfirmDialog(false);
    reassignMutation.mutate();
  };

  const handleBulkAssign = () => {
    if (!bulkTeacher) {
      toast.error('يرجى اختيار أستاذ للنقل الجماعي');
      return;
    }
    
    const targetTeacher = teachers.find(t => t.id === bulkTeacher);
    if (targetTeacher?.user_id && adminUserIds.has(targetTeacher.user_id)) {
      toast.warning('تحذير: سيتم نقل جميع الطلاب إلى أدمن وليس أستاذ');
    }
    const newAssignments: Record<string, string> = {};
    students.forEach(student => {
      newAssignments[student.id] = bulkTeacher;
    });
    setSelectedTeachers(newAssignments);
    toast.success('تم تعيين جميع الطلاب بنجاح');
    setBulkTeacher("");
  };

  const allAssigned = students.every(s => selectedTeachers[s.id]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-6 w-6 text-warning animate-pulse" />
              <DialogTitle className="text-xl">تنبيه: الأستاذ لديه طلاب</DialogTitle>
            </div>
            <DialogDescription className="text-base text-right space-y-1">
              <div>
                لا يمكن تحويل الأستاذ <span className="font-bold text-foreground">{teacherName}</span> إلى دور أدمن لأنه مسؤول عن{" "}
                <span className="font-bold text-foreground">{students.length}</span> طالب.
              </div>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 mt-4 pb-4">
              {/* خيار النقل الجماعي */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">نقل جماعي لجميع الطلاب</h3>
                </div>
                <div className="flex gap-2">
                  <Select value={bulkTeacher} onValueChange={setBulkTeacher}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="اختر أستاذ لنقل جميع الطلاب" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{teacher["اسم الاستاذ"]}</span>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                {teacherStats[teacher.id]?.mostFrequentGrade}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {teacherStats[teacher.id]?.studentCount} طالب
                              </Badge>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleBulkAssign}
                    disabled={!bulkTeacher}
                    variant="default"
                  >
                    تطبيق
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">قائمة الطلاب - اختر أستاذ جديد لكل طالب</h3>
                  <Badge variant="secondary" className="mr-auto">
                    {students.length} طالب
                  </Badge>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                  {students.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-start gap-3 p-3 bg-background border border-border rounded-md hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="text-right">
                          <p className="font-medium">{student.student_name}</p>
                          {student.grade && (
                            <p className="text-sm text-muted-foreground">{student.grade}</p>
                          )}
                        </div>
                        <Select
                          value={selectedTeachers[student.id] || ""}
                          onValueChange={(value) => {
                            const selectedTeacher = teachers.find(t => t.id === value);
                            if (selectedTeacher?.user_id && adminUserIds.has(selectedTeacher.user_id)) {
                              toast.warning('تحذير: سيتم نقل هذا الطالب إلى أدمن وليس أستاذ');
                            }
                            setSelectedTeachers(prev => ({ ...prev, [student.id]: value }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="اختر أستاذ جديد" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span>{teacher["اسم الاستاذ"]}</span>
                                  <div className="flex gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {teacherStats[teacher.id]?.mostFrequentGrade}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {teacherStats[teacher.id]?.studentCount} طالب
                                    </Badge>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedTeachers[student.id] && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-accent/50 border border-accent rounded-lg p-4">
                <p className="text-sm text-right">
                  <span className="font-semibold">الإجراء المطلوب:</span>
                  <br />
                  اختر أستاذ جديد لكل طالب من القائمة المنسدلة. الصف وعدد الطلاب الظاهر بجانب كل أستاذ يساعدك في اختيار الأستاذ المناسب.
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-2 flex-shrink-0 pt-4 border-t">
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1"
              variant="outline"
              disabled={reassignMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleReassign}
              className="flex-1"
              disabled={!allAssigned || reassignMutation.isPending}
            >
              {reassignMutation.isPending ? 'جاري التحديث...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* رسالة التأكيد */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد إعادة التعيين</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من إعادة تعيين <span className="font-bold text-foreground">{students.length}</span> طالب لأساتذة جدد؟
              <br />
              <br />
              لن تتمكن من التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={confirmReassign} className="bg-primary">
              نعم، متأكد
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
