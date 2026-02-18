import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logStudentUpdated, logStudentDeleted } from "@/lib/activityLogger";
import { Edit, Plus, Package, Search, Check, ChevronsUpDown, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import StudentPhotoUpload from "./StudentPhotoUpload";

interface Teacher {
  id: string;
  name: string;
}

interface Mosque {
  id: string;
  "اسم المسجد": string;
}

interface Student {
  id: string;
  student_name: string;
  phone?: string;
  grade?: string;
  father_name?: string;
  social_status?: string;
  teacher_id?: string;
  current_teacher?: string;
  previous_teacher?: string;
  address?: string;
  registration_status?: string;
  mosque_name?: string;
  notes?: string;
  received_tools?: string[];
  photo_url?: string | null;
  registration_date?: string;
}

interface TeacherStats {
  teacherId: string;
  studentCount: number;
  mostFrequentGrade: string;
}

interface CheckItem {
  id: string;
  name: string;
  active: boolean;
  points_brought: number;
  points_not_brought: number;
  points_skipped: number;
  points_lost: number;
}

export const EditStudentDialog = ({
  student,
  onSuccess,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  student: Student;
  onSuccess: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [showTeacherWarning, setShowTeacherWarning] = useState(false);
  const [pendingTeacherId, setPendingTeacherId] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(student.photo_url || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState({
    student_name: student.student_name || "",
    phone: student.phone || "",
    grade: student.grade || "",
    father_name: student.father_name || "",
    social_status: student.social_status || "",
    teacher_id: student.teacher_id || "",
    address: student.address || "",
    registration_status: student.registration_status || "مسجل",
    mosque_name: student.mosque_name || "",
    notes: student.notes || "",
    received_tools: student.received_tools || [],
    registration_date: student.registration_date || "",
  });

  useEffect(() => {
    if (open) {
      fetchTeachers();
      fetchMosques();
      fetchCheckItems();
      fetchStudents();
      setFormData({
        student_name: student.student_name || "",
        phone: student.phone || "",
        grade: student.grade || "",
        father_name: student.father_name || "",
        social_status: student.social_status || "",
        teacher_id: student.teacher_id || "",
        address: student.address || "",
        registration_status: student.registration_status || "مسجل",
        mosque_name: student.mosque_name || "",
        notes: student.notes || "",
        received_tools: student.received_tools || [],
        registration_date: student.registration_date || "",
      });
      setPhotoUrl(student.photo_url || null);
    }
  }, [open, student]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTeachers(
        data?.map((t) => ({ id: t.id, name: t["اسم الاستاذ"] || "غير محدد" })) || []
      );
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const fetchMosques = async () => {
    try {
      const { data, error } = await supabase
        .from("mosques")
        .select("*")
        .order("اسم المسجد");

      if (error) throw error;
      setMosques(data || []);
    } catch (error) {
      console.error("Error fetching mosques:", error);
    }
  };

  const fetchCheckItems = async () => {
    try {
      const { data, error } = await supabase
        .from("check_items")
        .select("id, name, active, points_brought, points_not_brought, points_skipped, points_lost")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setCheckItems(data || []);
    } catch (error) {
      console.error("Error fetching check items:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, teacher_id, grade")
        .not("teacher_id", "is", null);

      if (error) throw error;
      setStudentsData(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const teacherStats = useMemo(() => {
    const stats: Record<string, { studentCount: number; mostFrequentGrade: string }> = {};

    // حساب عدد الطلاب والصف الأكثر تكراراً لكل أستاذ
    studentsData.forEach((studentData) => {
      if (!studentData.teacher_id) return;

      if (!stats[studentData.teacher_id]) {
        stats[studentData.teacher_id] = {
          studentCount: 0,
          mostFrequentGrade: "",
        };
      }

      stats[studentData.teacher_id].studentCount++;
    });

    // حساب الصف الأكثر تكراراً
    Object.keys(stats).forEach((teacherId) => {
      const teacherStudents = studentsData.filter((s) => s.teacher_id === teacherId);
      const gradeCounts: Record<string, number> = {};

      teacherStudents.forEach((s) => {
        if (s.grade) {
          gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
        }
      });

      // إيجاد الصف الأكثر تكراراً
      let maxGrade = "";
      let maxCount = 0;
      Object.entries(gradeCounts).forEach(([grade, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxGrade = grade;
        }
      });

      stats[teacherId].mostFrequentGrade = maxGrade || "غير محدد";
    });

    return stats;
  }, [studentsData]);

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const aStats = teacherStats[a.id];
      const bStats = teacherStats[b.id];

      const aGrade = aStats?.mostFrequentGrade || "غير محدد";
      const bGrade = bStats?.mostFrequentGrade || "غير محدد";

      // استخراج الرقم من الصف للترتيب
      const extractGradeNumber = (grade: string): number => {
        if (grade === "غير محدد") return 999;
        if (grade === "طالب جامعي") return 100;
        const match = grade.match(/^(\d+)/);
        return match ? parseInt(match[1]) : 999;
      };

      return extractGradeNumber(aGrade) - extractGradeNumber(bGrade);
    });
  }, [teachers, teacherStats]);

  const getCountColor = (count: number) => {
    if (count >= 9) return "bg-yellow-500 text-white";
    if (count > 9) return "bg-destructive text-destructive-foreground";
    return "bg-green-500 text-white";
  };

  const handleTeacherChange = (teacherId: string) => {
    const stats = teacherStats[teacherId];
    if (stats && stats.studentCount >= 9) {
      setPendingTeacherId(teacherId);
      setShowTeacherWarning(true);
    } else {
      setFormData({ ...formData, teacher_id: teacherId });
    }
  };

  const confirmTeacherChange = () => {
    setFormData({ ...formData, teacher_id: pendingTeacherId });
    setShowTeacherWarning(false);
    setPendingTeacherId("");
  };

  const handleDeleteStudent = async () => {
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", student.id);

      if (error) throw error;

      await logStudentDeleted(student.student_name);

      toast.success("تم حذف الطالب بنجاح");
      setShowDeleteConfirm(false);
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("حدث خطأ أثناء حذف الطالب");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // تسجيل تغيير الأستاذ في السجل إذا تغير
      if (formData.teacher_id !== student.teacher_id) {
        const oldTeacherName = student.current_teacher || "بدون أستاذ";
        const newTeacherName = teachers.find(t => t.id === formData.teacher_id)?.name || "بدون أستاذ";

        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("student_teacher_history").insert({
          student_id: student.id,
          old_teacher: oldTeacherName,
          new_teacher: newTeacherName,
          updated_by: userData?.user?.id || null
        });
      }

      const { error } = await supabase
        .from("students")
        .update({
          student_name: formData.student_name,
          phone: formData.phone,
          grade: formData.grade,
          father_name: formData.father_name,
          social_status: formData.social_status,
          teacher_id: formData.teacher_id || null,
          current_teacher: teachers.find(t => t.id === formData.teacher_id)?.name || formData.teacher_id,
          address: formData.address,
          registration_status: formData.registration_status,
          mosque_name: formData.mosque_name,
          notes: formData.notes,
          received_tools: formData.received_tools,
          photo_url: photoUrl,
          registration_date: formData.registration_date || null,
        })
        .eq("id", student.id);

      if (error) throw error;

      toast.success("تم تحديث معلومات الطالب بنجاح");
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("حدث خطأ أثناء تحديث معلومات الطالب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {externalOnOpenChange === undefined && (
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل معلومات الطالب</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* صورة الطالب */}
            <StudentPhotoUpload
              currentPhotoUrl={photoUrl}
              onPhotoChange={setPhotoUrl}
              studentId={student.id}
              disabled={loading}
            />

            {/* اسم الطالب */}
            <div className="space-y-2">
              <Label htmlFor="student_name">اسم الطالب *</Label>
              <Input
                id="student_name"
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                required
              />
            </div>

            {/* رقم الهاتف */}
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="09XXXXXXXX"
              />
            </div>

            {/* الصف الدراسي */}
            <div className="space-y-2">
              <Label htmlFor="grade">الصف الدراسي</Label>
              <Select value={formData.grade} onValueChange={(value) => setFormData({ ...formData, grade: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الصف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 الأول">1 الأول</SelectItem>
                  <SelectItem value="2 الثاني">2 الثاني</SelectItem>
                  <SelectItem value="3 الثالث">3 الثالث</SelectItem>
                  <SelectItem value="4 الرابع">4 الرابع</SelectItem>
                  <SelectItem value="5 الخامس">5 الخامس</SelectItem>
                  <SelectItem value="6 السادس">6 السادس</SelectItem>
                  <SelectItem value="7 السابع">7 السابع</SelectItem>
                  <SelectItem value="8 الثامن">8 الثامن</SelectItem>
                  <SelectItem value="9 التاسع">9 التاسع</SelectItem>
                  <SelectItem value="10 العاشر">10 العاشر</SelectItem>
                  <SelectItem value="11 الحادي عشر">11 الحادي عشر</SelectItem>
                  <SelectItem value="12 الثاني عشر">12 الثاني عشر</SelectItem>
                  <SelectItem value="طالب جامعي">طالب جامعي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* اسم الأب */}
            <div className="space-y-2">
              <Label htmlFor="father_name">اسم الأب</Label>
              <Input
                id="father_name"
                value={formData.father_name}
                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
              />
            </div>

            {/* الحالة الاجتماعية */}
            <div className="space-y-2">
              <Label htmlFor="social_status">الحالة الاجتماعية</Label>
              <Select value={formData.social_status} onValueChange={(value) => setFormData({ ...formData, social_status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة الاجتماعية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="عائلة نموذجية">عائلة نموذجية</SelectItem>
                  <SelectItem value="فاقد الأب">فاقد الأب</SelectItem>
                  <SelectItem value="فاقد الأم">فاقد الأم</SelectItem>
                  <SelectItem value="فاقد الأب والأم">فاقد الأب والأم</SelectItem>
                  <SelectItem value="عائلة منفصلة">عائلة منفصلة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* اسم الأستاذ */}
            <div className="space-y-2">
              <Label htmlFor="teacher">اسم الأستاذ</Label>
              <Popover open={teacherSearchOpen} onOpenChange={setTeacherSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={teacherSearchOpen}
                    className="w-full justify-between"
                  >
                    {formData.teacher_id
                      ? teachers.find((teacher) => teacher.id === formData.teacher_id)?.name
                      : "اختر الأستاذ..."}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-full p-0"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <Command dir="rtl">
                    <CommandInput placeholder="ابحث عن أستاذ..." />
                    <CommandList>
                      <CommandEmpty>لا يوجد أستاذ بهذا الاسم</CommandEmpty>
                      <CommandGroup>
                        {sortedTeachers.map((teacher) => {
                          const stats = teacherStats[teacher.id];
                          return (
                            <CommandItem
                              key={teacher.id}
                              value={teacher.name}
                              onSelect={() => {
                                handleTeacherChange(teacher.id);
                                setTeacherSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "ml-2 h-4 w-4",
                                  formData.teacher_id === teacher.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{teacher.name}</span>
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
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* حالة التسجيل */}
            <div className="space-y-2">
              <Label htmlFor="registration_status">حالة التسجيل</Label>
              <Select value={formData.registration_status} onValueChange={(value) => setFormData({ ...formData, registration_status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
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

            {/* تاريخ التسجيل */}
            <div className="space-y-2">
              <Label htmlFor="registration_date">تاريخ التسجيل</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !formData.registration_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.registration_date
                      ? format(new Date(formData.registration_date), "PPP", { locale: ar })
                      : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.registration_date ? new Date(formData.registration_date) : undefined}
                    onSelect={(date) =>
                      setFormData({
                        ...formData,
                        registration_date: date ? date.toISOString().split('T')[0] : '',
                      })
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* اسم المسجد */}
            <div className="space-y-2">
              <Label htmlFor="mosque">اسم المسجد</Label>
              <Select value={formData.mosque_name} onValueChange={(value) => setFormData({ ...formData, mosque_name: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المسجد" />
                </SelectTrigger>
                <SelectContent>
                  {mosques.map((mosque) => (
                    <SelectItem key={mosque.id} value={mosque["اسم المسجد"]}>
                      {mosque["اسم المسجد"]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* العنوان */}
            <div className="space-y-2">
              <Label htmlFor="address">العنوان</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            {/* ملاحظات */}
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* الأدوات المستلمة من الإدارة */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <Label className="text-lg font-semibold">الأدوات المستلمة من الإدارة</Label>
              </div>
              {checkItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {checkItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-md border hover:bg-accent transition-colors">
                      <Checkbox
                        id={`tool-${item.id}`}
                        checked={formData.received_tools.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              received_tools: [...formData.received_tools, item.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              received_tools: formData.received_tools.filter(id => id !== item.id)
                            });
                          }
                        }}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`tool-${item.id}`} className="cursor-pointer font-medium">
                          {item.name}
                        </Label>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="text-green-600">أحضره: +{item.points_brought}</span>
                          <span className="text-orange-600">لم يحضره: {item.points_not_brought}</span>
                          <span className="text-blue-600">تجاوز: {item.points_skipped}</span>
                          <span className="text-red-600">فقدان: {item.points_lost}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد أدوات متاحة حالياً</p>
              )}
              {formData.received_tools.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.received_tools.map((toolId) => {
                    const tool = checkItems.find(item => item.id === toolId);
                    return tool ? (
                      <Badge key={toolId} variant="secondary">
                        {tool.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2 border-t pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || deleteLoading}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف الطالب
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showTeacherWarning} onOpenChange={setShowTeacherWarning}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تحذير: عدد طلاب كبير</AlertDialogTitle>
            <AlertDialogDescription>
              الأستاذ المحدد لديه {teacherStats[pendingTeacherId]?.studentCount || 0} طالب حالياً.
              عدد الطلاب أصبح كبيراً. هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTeacherId("")}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTeacherChange}>
              نعم، متابعة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد حذف الطالب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الطالب "{student.student_name}"؟
              <br />
              <span className="text-destructive font-semibold">
                هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع بيانات الطالب نهائياً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "جاري الحذف..." : "نعم، احذف الطالب"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
