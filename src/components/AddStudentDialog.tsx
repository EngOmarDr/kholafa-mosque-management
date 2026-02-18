import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logStudentAdded } from "@/lib/activityLogger";
import { Plus, Package, Check, ChevronsUpDown, CalendarIcon, AlertTriangle, UserCheck, Users } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import StudentPhotoUpload from "./StudentPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StudentReactivateDialog } from "./StudentReactivateDialog";

interface Teacher {
  id: string;
  name: string;
}

interface Mosque {
  id: string;
  "اسم المسجد": string;
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

interface ExistingStudent {
  id: string;
  student_name: string;
  father_name: string | null;
  registration_status: string | null;
  phone: string | null;
  mosque_name: string | null;
  current_teacher: string | null;
  grade: string | null;
}

export const AddStudentDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [teacherSearchOpen, setTeacherSearchOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedStudentForReactivate, setSelectedStudentForReactivate] = useState<ExistingStudent | null>(null);

  const [formData, setFormData] = useState({
    student_name: "",
    phone: "",
    grade: "",
    father_name: "",
    social_status: "",
    teacher_id: "",
    address: "",
    registration_status: "مسجل",
    mosque_name: "",
    notes: "",
    received_tools: [] as string[],
    registration_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (open) {
      fetchTeachers();
      fetchMosques();
      fetchAllStudents();
      fetchCheckItems();
    }
  }, [open]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTeachers(data?.map(t => ({ id: t.id, name: t["اسم الاستاذ"] || "غير محدد" })) || []);
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

  const fetchAllStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, father_name, registration_status, phone, mosque_name, current_teacher, grade, teacher_id");

      if (error) throw error;
      setAllStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // تطبيع النص العربي (إزالة الهمزات والتشكيل)
  const normalizeArabicText = (text: string): string => {
    return text
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ى]/g, 'ي')
      .replace(/[ة]/g, 'ه')
      .replace(/[\u064B-\u065F]/g, '') // إزالة التشكيل
      .toLowerCase()
      .trim();
  };

  // البحث عن الأسماء المشابهة
  const similarStudents = useMemo(() => {
    const searchName = formData.student_name.trim();
    if (searchName.length < 3) return { exact: [], similar: [], unregistered: [] };

    const normalizedSearch = normalizeArabicText(searchName);

    const exact: ExistingStudent[] = [];
    const similar: ExistingStudent[] = [];
    const unregistered: ExistingStudent[] = [];

    allStudents.forEach(student => {
      if (!student.student_name) return;

      const normalizedName = normalizeArabicText(student.student_name);
      const isUnregistered = student.registration_status === 'غير مسجل';

      if (normalizedName === normalizedSearch) {
        if (isUnregistered) {
          unregistered.push(student);
        } else {
          exact.push(student);
        }
      } else if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
        if (isUnregistered) {
          unregistered.push(student);
        } else {
          similar.push(student);
        }
      }
    });

    return { exact, similar, unregistered };
  }, [formData.student_name, allStudents]);

  // التحقق من طول رقم الهاتف
  const phoneValidation = useMemo(() => {
    const phone = formData.phone.replace(/\D/g, ''); // إزالة أي أحرف غير رقمية
    if (!phone) return { isValid: true, message: '' }; // لا يظهر تنبيه إذا كان فارغاً

    if (phone.length < 10) {
      return {
        isValid: false,
        message: `رقم الهاتف أقل من 10 خانات (${phone.length} خانات حالياً)`
      };
    }
    if (phone.length > 10) {
      return {
        isValid: false,
        message: `رقم الهاتف أكثر من 10 خانات (${phone.length} خانات حالياً)`
      };
    }
    return { isValid: true, message: '' };
  }, [formData.phone]);

  const handleOpenReactivateDialog = (student: ExistingStudent) => {
    setSelectedStudentForReactivate(student);
    setReactivateDialogOpen(true);
  };

  const handleReactivateSuccess = () => {
    setOpen(false);
    onSuccess();
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

  const teacherStats = useMemo(() => {
    const stats: Record<string, TeacherStats> = {};

    teachers.forEach((teacher) => {
      const teacherStudents = allStudents.filter(
        (s) => s.teacher_id === teacher.id || s.current_teacher === teacher.name
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
        teacherId: teacher.id,
        studentCount: teacherStudents.length,
        mostFrequentGrade,
      };
    });

    return stats;
  }, [teachers, allStudents]);

  const getCountColor = (count: number) => {
    if (count > 9) return "bg-destructive text-destructive-foreground";
    if (count === 9) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  // ترتيب المعلمين حسب الصف الأكثر شيوعاً
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const gradeA = teacherStats[a.id]?.mostFrequentGrade || "غير محدد";
      const gradeB = teacherStats[b.id]?.mostFrequentGrade || "غير محدد";

      // استخراج رقم الصف للترتيب
      const getGradeNumber = (grade: string) => {
        const match = grade.match(/^(\d+)/);
        if (match) return parseInt(match[1]);
        if (grade === "طالب جامعي") return 13;
        return 999; // للقيم غير المحددة
      };

      return getGradeNumber(gradeA) - getGradeNumber(gradeB);
    });
  }, [teachers, teacherStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // التحقق من الحقول الإجبارية
    if (!formData.student_name) {
      toast.error("يرجى إدخال اسم الطالب");
      return;
    }

    setLoading(true);

    try {
      const selectedTeacherName = teachers.find(t => t.id === formData.teacher_id)?.name || null;

      const { data, error } = await supabase.functions.invoke("add-student", {
        body: {
          student_name: formData.student_name.trim(),
          phone: formData.phone?.trim() || null,
          grade: formData.grade || null,
          father_name: formData.father_name?.trim() || null,
          social_status: formData.social_status || null,
          address: formData.address?.trim() || null,
          registration_status: formData.registration_status || null,
          mosque_name: formData.mosque_name || null,
          notes: formData.notes?.trim() || null,
          teacher_id: formData.teacher_id || null,
          teacher_name: selectedTeacherName,
          received_tools: formData.received_tools,
          photo_url: photoUrl,
          registration_date: formData.registration_date || null,
        },
      });

      if (error) throw error;

      // تسجيل النشاط
      if (data) {
        await logStudentAdded({
          id: data.id,
          student_name: formData.student_name.trim(),
          current_teacher: selectedTeacherName,
          mosque_name: formData.mosque_name,
          grade: formData.grade,
          phone: formData.phone,
        });
      }

      toast.success("تمت إضافة الطالب بنجاح ✅");

      // إعادة تعيين النموذج
      setFormData({
        student_name: "",
        phone: "",
        grade: "",
        father_name: "",
        social_status: "",
        teacher_id: "",
        address: "",
        registration_status: "مسجل",
        mosque_name: "",
        notes: "",
        received_tools: [],
        registration_date: new Date().toISOString().split('T')[0],
      });
      setPhotoUrl(null);

      setTimeout(() => {
        setOpen(false);
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error("حدث خطأ أثناء الحفظ، تأكد من جميع الحقول المطلوبة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary">
          <Plus className="w-5 h-5 ml-2" />
          إضافة طالب جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            تسجيل طالب جديد
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* الاسم الكامل */}
          <div className="space-y-2">
            <Label htmlFor="student_name">الاسم الكامل للطالب *</Label>
            <Input
              id="student_name"
              value={formData.student_name}
              onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              placeholder="أدخل الاسم الكامل"
              required
            />

            {/* تنبيه الطلاب غير المسجلين */}
            {similarStudents.unregistered.length > 0 && (
              <Alert className="mt-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <div className="font-medium mb-2">🔄 يوجد طالب بهذا الاسم في الطلاب غير المسجلين:</div>
                  <ul className="space-y-2">
                    {similarStudents.unregistered.map(s => (
                      <li key={s.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2 bg-white/50 dark:bg-white/5 rounded">
                        <div className="text-sm">
                          <span className="font-medium">{s.student_name}</span>
                          {s.father_name && <span className="text-muted-foreground"> - ابن {s.father_name}</span>}
                          {s.mosque_name && <span className="text-muted-foreground"> | {s.mosque_name}</span>}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-100"
                          onClick={() => handleOpenReactivateDialog(s)}
                        >
                          إعادة تسجيل
                        </Button>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* تنبيه التطابق التام */}
            {similarStudents.exact.length > 0 && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">⚠️ يوجد طالب بنفس الاسم بالضبط!</div>
                  <ul className="text-sm space-y-1">
                    {similarStudents.exact.map(s => (
                      <li key={s.id} className="p-2 bg-white/10 rounded">
                        <span className="font-medium">{s.student_name}</span>
                        {s.father_name && <span> - ابن {s.father_name}</span>}
                        {s.current_teacher && <span className="text-muted-foreground"> | الأستاذ: {s.current_teacher}</span>}
                        {s.mosque_name && <span className="text-muted-foreground"> | {s.mosque_name}</span>}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* تنبيه الأسماء المشابهة */}
            {similarStudents.similar.length > 0 && (
              <Alert className="mt-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
                <Users className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  <div className="font-medium mb-2">💡 يوجد {similarStudents.similar.length} أسماء مشابهة:</div>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {similarStudents.similar.slice(0, 5).map(s => (
                      <li key={s.id} className="p-1">
                        <span className="font-medium">{s.student_name}</span>
                        {s.father_name && <span className="text-muted-foreground"> - ابن {s.father_name}</span>}
                        {s.grade && <span className="text-muted-foreground"> | {s.grade}</span>}
                      </li>
                    ))}
                    {similarStudents.similar.length > 5 && (
                      <li className="text-muted-foreground">و {similarStudents.similar.length - 5} آخرين...</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
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
              className={!phoneValidation.isValid ? "border-yellow-500 focus-visible:ring-yellow-500" : ""}
            />
            {!phoneValidation.isValid && (
              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  ⚠️ {phoneValidation.message}
                </AlertDescription>
              </Alert>
            )}
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
              placeholder="أدخل اسم الأب"
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
            <Label htmlFor="teacher_id">اسم الأستاذ المسؤول</Label>
            <Popover open={teacherSearchOpen} onOpenChange={setTeacherSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={teacherSearchOpen}
                  className="w-full justify-between"
                >
                  {formData.teacher_id
                    ? sortedTeachers.find((teacher) => teacher.id === formData.teacher_id)?.name
                    : "اختر الأستاذ"}
                  <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full p-0 bg-background z-50"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <Command>
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
                              setFormData({ ...formData, teacher_id: teacher.id });
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

          {/* العنوان */}
          <div className="space-y-2">
            <Label htmlFor="address">العنوان</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="أدخل العنوان"
              rows={2}
            />
          </div>

          {/* حالة التسجيل */}
          <div className="space-y-2">
            <Label htmlFor="registration_status">حالة التسجيل</Label>
            <Select value={formData.registration_status} onValueChange={(value) => setFormData({ ...formData, registration_status: value })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر حالة التسجيل" />
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
            <Label htmlFor="mosque_name">اسم المسجد</Label>
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

          {/* صورة الطالب */}
          <StudentPhotoUpload
            currentPhotoUrl={photoUrl}
            onPhotoChange={setPhotoUrl}
            disabled={loading}
          />

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات إضافية</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="أي ملاحظات إضافية"
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

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? "جارٍ الحفظ..." : "حفظ الطالب"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
      {/* نافذة إعادة التسجيل */}
      <StudentReactivateDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        studentId={selectedStudentForReactivate?.id || null}
        studentName={selectedStudentForReactivate?.student_name || ""}
        onSuccess={handleReactivateSuccess}
      />
    </Dialog>
  );
};
