import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, GraduationCap, ChevronDown, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Student {
  id: string;
  student_name: string;
  grade: string | null;
  registration_status: string | null;
}

interface TeacherWithStudents {
  id: string;
  name: string;
  students: Student[];
  mostFrequentGrade: string;
  studentCount: number;
}

interface ClassesOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const gradeOrder: Record<string, number> = {
  "1 الأول": 1,
  "2 الثاني": 2,
  "3 الثالث": 3,
  "4 الرابع": 4,
  "5 الخامس": 5,
  "6 السادس": 6,
  "7 السابع": 7,
  "8 الثامن": 8,
  "9 التاسع": 9,
  "10 العاشر": 10,
  "11 الحادي عشر": 11,
  "12 الثاني عشر": 12,
  "طالب جامعي": 13,
};

const ClassesOverviewDialog = ({ open, onOpenChange }: ClassesOverviewDialogProps) => {
  const [teachers, setTeachers] = useState<TeacherWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchTeachersWithStudents();
    }
  }, [open]);

  const fetchTeachersWithStudents = async () => {
    setLoading(true);
    try {
      // جلب الأساتذة مع طلابهم
      const { data: teachersData, error } = await supabase
        .from("teachers")
        .select(`
          id,
          "اسم الاستاذ"
        `);

      if (error) throw error;

      // جلب الطلاب المسجلين فقط
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, student_name, grade, registration_status, teacher_id")
        .in("registration_status", ["مسجل", "غير مدرج بعد", "انتظار"]);

      if (studentsError) throw studentsError;

      // تجميع الطلاب حسب الأستاذ
      const teachersWithStudents: TeacherWithStudents[] = [];

      for (const teacher of teachersData || []) {
        const teacherStudents = studentsData?.filter(s => s.teacher_id === teacher.id) || [];
        
        if (teacherStudents.length === 0) continue;

        // حساب الصف الأكثر شيوعاً
        const gradeCounts: Record<string, number> = {};
        teacherStudents.forEach(s => {
          if (s.grade) {
            gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
          }
        });

        const mostFrequentGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "غير محدد";

        teachersWithStudents.push({
          id: teacher.id,
          name: teacher["اسم الاستاذ"],
          students: teacherStudents,
          mostFrequentGrade,
          studentCount: teacherStudents.length,
        });
      }

      // ترتيب حسب الصف
      teachersWithStudents.sort((a, b) => {
        const orderA = gradeOrder[a.mostFrequentGrade] || 999;
        const orderB = gradeOrder[b.mostFrequentGrade] || 999;
        return orderA - orderB;
      });

      setTeachers(teachersWithStudents);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (teacherId: string) => {
    setExpandedTeachers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId);
      } else {
        newSet.add(teacherId);
      }
      return newSet;
    });
  };

  // فلترة حسب البحث
  const filteredTeachers = teachers.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    const teacherMatch = teacher.name.toLowerCase().includes(searchLower);
    const studentMatch = teacher.students.some(s => 
      s.student_name.toLowerCase().includes(searchLower)
    );
    return teacherMatch || studentMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="w-6 h-6 text-primary" />
            الحلقات ({teachers.length} حلقة)
          </DialogTitle>
        </DialogHeader>

        {/* خانة البحث */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث عن أستاذ أو طالب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* قائمة الحلقات */}
        <ScrollArea className="h-[55vh] pr-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا توجد حلقات
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTeachers.map(teacher => (
                <Collapsible
                  key={teacher.id}
                  open={expandedTeachers.has(teacher.id)}
                  onOpenChange={() => toggleExpanded(teacher.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="w-full p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <GraduationCap className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-right">
                            <h3 className="font-semibold text-base">{teacher.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="bg-secondary/20 px-2 py-0.5 rounded text-secondary-foreground">
                                {teacher.mostFrequentGrade}
                              </span>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                                teacher.studentCount === 9 
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : teacher.studentCount < 9 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                              }`}>
                                <Users className="w-3.5 h-3.5" />
                                {teacher.studentCount} طالب
                              </span>
                            </div>
                          </div>
                        </div>
                        {expandedTeachers.has(teacher.id) ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="mr-6 mt-2 p-3 rounded-lg bg-muted/50 border-r-2 border-primary/30">
                      <div className="space-y-1.5">
                        {teacher.students.map((student, index) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-background/50"
                          >
                            <span className="text-sm">
                              {index + 1}. {student.student_name}
                            </span>
                            {student.registration_status !== "مسجل" && (
                              <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                                {student.registration_status}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ClassesOverviewDialog;
