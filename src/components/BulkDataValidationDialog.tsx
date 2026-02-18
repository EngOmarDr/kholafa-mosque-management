import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Save, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ValidationIssue {
  field: string;
  currentValue: string;
  issue: string;
}

interface InvalidStudent {
  id: string;
  student_name: string;
  current_teacher?: string;
  grade?: string;
  issues: ValidationIssue[];
}

interface BulkDataValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalidStudents: InvalidStudent[];
  totalChecked: number;
  onSave?: (corrections: Record<string, Record<string, string>>) => void;
}

export function BulkDataValidationDialog({
  open,
  onOpenChange,
  invalidStudents,
  totalChecked,
  onSave,
}: BulkDataValidationDialogProps) {
  const validCount = totalChecked - invalidStudents.length;
  const [editedValues, setEditedValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [mosques, setMosques] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // القوائم الرسمية للقيم الصحيحة
  const validGrades = [
    "1 الأول", "2 الثاني", "3 الثالث", "4 الرابع",
    "5 الخامس", "6 السادس", "7 السابع", "8 الثامن",
    "9 التاسع", "10 العاشر", "11 الحادي عشر",
    "12 الثاني عشر", "طالب جامعي"
  ];

  const validSocialStatuses = [
    "عائلة نموذجية", "فاقد الأب", "فاقد الأم",
    "فاقد الأب والأم", "عائلة منفصلة"
  ];

  const validRegistrationStatuses = [
    "مسجل", "غير مسجل", "انتظار",
    "غير مدرج بعد", "متدرب", "حافظ", "مجاز", "فترة تجربة"
  ];

  // جلب بيانات المساجد والأساتذة
  useEffect(() => {
    if (open) {
      fetchMosquesAndTeachers();
    }
  }, [open]);

  const fetchMosquesAndTeachers = async () => {
    setLoadingData(true);
    try {
      // جلب المساجد
      const { data: mosquesData, error: mosquesError } = await supabase
        .from("mosques" as any)
        .select("*")
        .order("اسم المسجد");

      if (!mosquesError && mosquesData) {
        const mosqueNames = mosquesData.map((mosque: any) => {
          const keys = Object.keys(mosque);
          const nameKey = keys.find(key => key.includes('اسم') && key.includes('مسجد'));
          return nameKey ? mosque[nameKey] : null;
        }).filter(Boolean);
        setMosques(mosqueNames);
      }

      // جلب الأساتذة
      const { data: teachersData, error: teachersError } = await supabase
        .from("teachers" as any)
        .select("*")
        .order("اسم الاستاذ");

      if (!teachersError && teachersData) {
        const teacherNames = teachersData.map((teacher: any) => {
          const keys = Object.keys(teacher);
          const nameKey = keys.find(key => key.includes('اسم') && key.includes('استاذ'));
          return nameKey ? teacher[nameKey] : null;
        }).filter(Boolean);
        setTeachers(teacherNames);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // دالة لحساب المسافة بين نصين (Levenshtein distance)
  const levenshteinDistance = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  };

  // دالة للبحث عن أقرب تطابق من قائمة
  const findClosestMatch = (value: string, options: string[]): string | null => {
    if (!value || value.trim() === "") return null;

    let closestMatch = options[0];
    let minDistance = levenshteinDistance(value, closestMatch);

    for (const option of options) {
      const distance = levenshteinDistance(value, option);
      if (distance < minDistance) {
        minDistance = distance;
        closestMatch = option;
      }
    }

    // إذا كانت المسافة صغيرة جداً، نعتبرها تطابق جيد
    const threshold = Math.max(3, Math.floor(value.length * 0.4));
    return minDistance <= threshold ? closestMatch : null;
  };

  // دالة لتصحيح رقم الهاتف
  const correctPhoneNumber = (phone: string): string | null => {
    if (!phone || phone.trim() === "") return null;

    // إزالة جميع الأحرف غير الرقمية
    let digits = phone.replace(/\D/g, '');

    // إذا كان الرقم 9 خانات فقط، أضف 0 في البداية
    if (digits.length === 9) {
      digits = '0' + digits;
    }

    // التحقق من أن الرقم الآن 10 خانات على الأقل
    if (digits.length >= 10) {
      return digits;
    }

    return null;
  };

  // دالة لتصحيح الصف بقواعد خاصة
  const correctGrade = (grade: string, validGrades: string[]): string | null => {
    if (!grade || grade.trim() === "") return null;

    const normalized = grade.toLowerCase().trim();

    // قاعدة خاصة: البكالوريا = 12 الثاني عشر
    if (normalized.includes('بكالوريا') || normalized === 'بكالوريا') {
      return '12 الثاني عشر';
    }

    // قاعدة خاصة: أي شيء يحتوي على "جامعة" = طالب جامعي
    if (normalized.includes('جامعة') || normalized.includes('جامعي')) {
      return 'طالب جامعي';
    }

    // البحث العادي عن أقرب تطابق
    return findClosestMatch(grade, validGrades);
  };

  // دالة التصحيح التلقائي لجميع الطلاب
  const handleAutoCorrect = () => {
    const newEditedValues: Record<string, Record<string, string>> = {};
    let correctedCount = 0;

    invalidStudents.forEach(student => {
      const studentEdits: Record<string, string> = {};

      student.issues.forEach(issue => {
        const fieldKey = issue.field === "الصف" ? "grade" :
          issue.field === "الحالة الاجتماعية" ? "social_status" :
            issue.field === "حالة التسجيل" ? "registration_status" :
              issue.field === "اسم الأستاذ" ? "current_teacher" :
                issue.field === "المسجد" ? "mosque_name" :
                  issue.field === "رقم الهاتف" ? "phone" :
                    issue.field === "اسم الأب" ? "father_name" : "";

        let correctedValue: string | null = null;

        // محاولة تصحيح القيمة حسب نوع الحقل
        if (issue.field === "الصف") {
          // استخدام دالة التصحيح الذكية للصف
          correctedValue = correctGrade(issue.currentValue, validGrades);
        } else if (issue.field === "الحالة الاجتماعية") {
          correctedValue = findClosestMatch(issue.currentValue, validSocialStatuses);
        } else if (issue.field === "حالة التسجيل") {
          correctedValue = findClosestMatch(issue.currentValue, validRegistrationStatuses);
        } else if (issue.field === "المسجد" && mosques.length > 0) {
          correctedValue = findClosestMatch(issue.currentValue, mosques);
        } else if (issue.field === "اسم الأستاذ" && teachers.length > 0) {
          correctedValue = findClosestMatch(issue.currentValue, teachers);
        } else if (issue.field === "رقم الهاتف") {
          // استخدام دالة التصحيح الذكية لرقم الهاتف
          correctedValue = correctPhoneNumber(issue.currentValue);
        }

        if (correctedValue) {
          studentEdits[fieldKey] = correctedValue;
          correctedCount++;
        }
      });

      if (Object.keys(studentEdits).length > 0) {
        newEditedValues[student.id] = studentEdits;
      }
    });

    setEditedValues(newEditedValues);

    if (correctedCount > 0) {
      toast.success(`تم التصحيح التلقائي لـ ${correctedCount} حقل. الرجاء المراجعة قبل الحفظ.`);
    } else {
      toast.info("لم يتم العثور على تطابقات قريبة للتصحيح التلقائي");
    }
  };

  // دالة لتحديث القيمة المعدلة
  const handleValueChange = (studentId: string, field: string, newValue: string) => {
    setEditedValues(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: newValue
      }
    }));
  };

  // دالة لحفظ جميع التعديلات
  const handleSaveAll = () => {
    setSaving(true);

    try {
      if (Object.keys(editedValues).length === 0) {
        toast.warning("لا توجد تعديلات للحفظ");
        setSaving(false);
        return;
      }

      // تمرير التعديلات إلى الصفحة الأم لتحديث البيانات المحلية
      toast.success(`تم حفظ تعديلات ${Object.keys(editedValues).length} طالب`);
      onSave?.(editedValues);
      setEditedValues({});
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving updates:", error);
      toast.error("حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  // دالة لتحديد نوع حقل الإدخال
  const renderEditField = (studentId: string, issue: ValidationIssue) => {
    const fieldKey = issue.field === "الصف" ? "grade" :
      issue.field === "الحالة الاجتماعية" ? "social_status" :
        issue.field === "حالة التسجيل" ? "registration_status" :
          issue.field === "اسم الأستاذ" ? "current_teacher" :
            issue.field === "المسجد" ? "mosque_name" :
              issue.field === "رقم الهاتف" ? "phone" :
                issue.field === "اسم الأب" ? "father_name" : "";

    const currentValue = editedValues[studentId]?.[fieldKey] || issue.currentValue;

    if (issue.field === "الصف") {
      return (
        <Select value={currentValue} onValueChange={(value) => handleValueChange(studentId, fieldKey, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الصف" />
          </SelectTrigger>
          <SelectContent>
            {validGrades.map(grade => (
              <SelectItem key={grade} value={grade}>{grade}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (issue.field === "الحالة الاجتماعية") {
      return (
        <Select value={currentValue} onValueChange={(value) => handleValueChange(studentId, fieldKey, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الحالة" />
          </SelectTrigger>
          <SelectContent>
            {validSocialStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (issue.field === "حالة التسجيل") {
      return (
        <Select value={currentValue} onValueChange={(value) => handleValueChange(studentId, fieldKey, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الحالة" />
          </SelectTrigger>
          <SelectContent>
            {validRegistrationStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (issue.field === "رقم الهاتف") {
      // حقل خاص لرقم الهاتف
      return (
        <Input
          type="tel"
          value={currentValue}
          onChange={(e) => {
            const value = e.target.value;
            // السماح بالأرقام فقط مع بعض الرموز المسموحة
            const sanitized = value.replace(/[^\d+\-\s()]/g, '');
            handleValueChange(studentId, fieldKey, sanitized);
          }}
          placeholder="أدخل رقم الهاتف (10 خانات على الأقل)"
          className="w-full"
          dir="ltr"
        />
      );
    } else if (issue.field === "المسجد") {
      // قائمة اختيار المساجد من قاعدة البيانات
      return (
        <Select value={currentValue} onValueChange={(value) => handleValueChange(studentId, fieldKey, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر المسجد" />
          </SelectTrigger>
          <SelectContent>
            {loadingData ? (
              <SelectItem value="loading" disabled>جاري التحميل...</SelectItem>
            ) : mosques.length === 0 ? (
              <SelectItem value="empty" disabled>لا توجد مساجد</SelectItem>
            ) : (
              mosques.map(mosque => (
                <SelectItem key={mosque} value={mosque}>{mosque}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    } else if (issue.field === "اسم الأستاذ") {
      // قائمة اختيار الأساتذة من قاعدة البيانات
      return (
        <Select value={currentValue} onValueChange={(value) => handleValueChange(studentId, fieldKey, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="اختر الأستاذ" />
          </SelectTrigger>
          <SelectContent>
            {loadingData ? (
              <SelectItem value="loading" disabled>جاري التحميل...</SelectItem>
            ) : teachers.length === 0 ? (
              <SelectItem value="empty" disabled>لا يوجد أساتذة</SelectItem>
            ) : (
              teachers.map(teacher => (
                <SelectItem key={teacher} value={teacher}>{teacher}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    } else {
      // حقول نصية أخرى
      return (
        <Input
          value={currentValue}
          onChange={(e) => handleValueChange(studentId, fieldKey, e.target.value)}
          placeholder={`أدخل ${issue.field} الصحيح`}
          className="w-full"
        />
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl flex items-center gap-3">
            {invalidStudents.length === 0 ? (
              <>
                <div className="p-2 rounded-full bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                نتائج التحقق - جميع البيانات صحيحة
              </>
            ) : (
              <>
                <div className="p-2 rounded-full bg-orange-500/10">
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                </div>
                نتائج التحقق - تم العثور على مشاكل
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-base mr-11">
            تم التحقق من {totalChecked} طالب
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 p-6 pt-2 overflow-hidden">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border border-green-200 dark:border-green-800/30 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">بيانات صحيحة</div>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                    {validCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200 dark:border-orange-800/30 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">بيانات تحتاج إصلاح</div>
                  <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                    {invalidStudents.length}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </div>
          </div>

          {invalidStudents.length === 0 ? (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                تم التحقق من جميع بيانات الطلاب بنجاح. جميع البيانات صحيحة ومطابقة لقاعدة البيانات.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Alert className="bg-orange-500/5 border-orange-200 dark:border-orange-800/30 flex-1">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-300 font-medium">
                    يرجى مراجعة وإصلاح بيانات الطلاب التالية لضمان دقة التقارير:
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleAutoCorrect}
                  disabled={loadingData}
                  variant="secondary"
                  className="gap-2 whitespace-nowrap"
                >
                  <Wand2 className="w-4 h-4" />
                  تصحيح تلقائي
                </Button>
              </div>

              <ScrollArea className="flex-1 rounded-xl border bg-muted/30 p-4 shadow-inner">
                <div className="space-y-6">
                  {invalidStudents.map((student, index) => (
                    <div
                      key={student.id}
                      className="p-5 rounded-xl border bg-background shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-dashed">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-xl text-foreground leading-none">
                              {student.student_name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {student.grade && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-5 px-1.5 font-normal">
                                  الصف: {student.grade}
                                </Badge>
                              )}
                              {student.current_teacher && (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 py-0 h-5 px-1.5 font-normal">
                                  الأستاذ: {student.current_teacher}
                                </Badge>
                              )}
                              <div className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0 rounded h-5 flex items-center">
                                {student.issues.length} {student.issues.length === 1 ? "مشكلة" : "مشاكل"}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive" className="px-4 py-1 font-bold text-xs shadow-sm">
                          تحتاج إصلاح
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {student.issues.map((issue, issueIndex) => (
                          <div
                            key={issueIndex}
                            className="flex flex-col gap-3 p-4 rounded-lg bg-muted/40 border border-border/50 hover:border-orange-200 dark:hover:border-orange-800/40 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-foreground/80">{issue.field}:</span>
                              <Badge variant="outline" className="text-xs font-normal border-destructive/30 bg-destructive/5 text-destructive">
                                الحالي: {issue.currentValue || "غير محدد"}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground bg-muted/60 p-2 rounded border-r-2 border-orange-400">
                              {issue.issue}
                            </div>

                            <div className="space-y-2 mt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-primary flex items-center gap-1">
                                  تحديد القيمة الصحيحة
                                </label>
                                {editedValues[student.id]?.[
                                  issue.field === "الصف" ? "grade" :
                                    issue.field === "الحالة الاجتماعية" ? "social_status" :
                                      issue.field === "حالة التسجيل" ? "registration_status" :
                                        issue.field === "اسم الأستاذ" ? "current_teacher" :
                                          issue.field === "المسجد" ? "mosque_name" :
                                            issue.field === "رقم الهاتف" ? "phone" :
                                              issue.field === "اسم الأب" ? "father_name" : ""
                                ] && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-500/10 text-green-700 border-green-500/20 gap-1 rounded-sm">
                                      <CheckCircle className="w-2.5 h-2.5" />
                                      معدل
                                    </Badge>
                                  )}
                              </div>
                              <div className="ring-offset-background focus-within:ring-1 focus-within:ring-ring rounded-md">
                                {renderEditField(student.id, issue)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="p-6 bg-muted/20 border-t flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-0.5">
            <div className="text-sm font-medium text-foreground">
              {Object.keys(editedValues).length > 0 ? (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <Save className="w-4 h-4" />
                  جاهز لحفظ {Object.keys(editedValues).length} تعديلات
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  لم يتم إجراء تعديلات بعد
                </span>
              )}
            </div>
            {Object.keys(editedValues).length > 0 && (
              <div className="text-[11px] text-muted-foreground pr-5 leading-none">
                سيتم حفظ التغييرات عند النقر على "حفظ التعديلات"
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6">
              إغلاق النافذة
            </Button>
            {invalidStudents.length > 0 && (
              <Button
                onClick={handleSaveAll}
                disabled={saving || Object.keys(editedValues).length === 0}
                className="px-8 gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ التغييرات
                    {Object.keys(editedValues).length > 0 && (
                      <span className="mr-1 bg-white/20 px-1.5 py-0.5 rounded-sm text-xs">
                        {Object.keys(editedValues).length}
                      </span>
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent >

    </Dialog >
  );
}
