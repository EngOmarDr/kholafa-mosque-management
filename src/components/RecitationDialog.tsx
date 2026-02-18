import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addToSyncQueue } from "@/lib/backgroundSync";
import { saveLocalRecitation } from "@/lib/offlineStorage";
import { Plus, X } from "lucide-react";
import { formatDate } from "date-fns";
import { se } from "date-fns/locale";

interface RecitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  teacherId: string;
  selectedDate: string;
  onSuccess: () => void;
}

interface Page {
  pageNumber: string;
  rating: string;
}

const RecitationDialog = ({
  open,
  onOpenChange,
  student,
  teacherId,
  selectedDate,
  onSuccess,
}: RecitationDialogProps) => {
  const [pages, setPages] = useState<Page[]>([
    { pageNumber: "", rating: "ممتاز" },
  ]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [pointsSettings, setPointsSettings] = useState<Record<string, number>>({
    excellent: 2,
    good: 1,
    repeat: 0,
  });

  useEffect(() => {
    fetchPointsSettings();
  }, []);

  const fetchPointsSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("points_settings")
        .select("key, points")
        .eq("category", "recitation");

      if (error) throw error;

      if (data) {
        const settings: Record<string, number> = {};
        data.forEach((s: any) => {
          settings[s.key] = s.points;
        });
        setPointsSettings(settings);
      }
    } catch (error) {
      console.error("Error fetching points settings:", error);
    }
  };

  useEffect(() => {
    if (open) {
      getData();
    } else {
      setPages([{ pageNumber: "", rating: "ممتاز" }]);
      setNotes("");
      setLoading(false);
    }
  }, [student?.id, open]);

  async function getData() {
    let { data, error } = await supabase
      .from("recitations")
      .select("*")
      .eq("student_id", student.id)
      .eq("date", selectedDate);

    if (error) {
      console.error("Error fetching recitations:", error);
      setPages([{ pageNumber: "", rating: "ممتاز" }]);
      return;
    }

    if (data && data.length > 0) {
      // عرض كل صفحة مع تقييمها
      setPages(
        data.map((e) => ({
          pageNumber: e.last_saved,
          rating: e.rating
        }))
      );
    } else {
      setPages([{ pageNumber: "", rating: "ممتاز" }]);
    }
  }

  const addPage = () => {
    setPages([...pages, { pageNumber: "", rating: "ممتاز" }]);
  };

  const removePage = (index: number) => {
    if (pages.length > 1) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const updatePage = (index: number, field: keyof Page, value: string) => {
    const newPages = [...pages];
    newPages[index][field] = value;
    setPages(newPages);
  };

  const calculatePoints = () => {
    return pages.reduce((total, page) => {
      if (!page.pageNumber) return total;
      switch (page.rating) {
        case "ممتاز":
          return total + (pointsSettings.excellent ?? 2);
        case "جيد":
          return total + (pointsSettings.good ?? 1);
        default:
          return total + (pointsSettings.repeat ?? 0);
      }
    }, 0);
  };

  const getPointsLabel = (rating: string) => {
    switch (rating) {
      case "ممتاز":
        return pointsSettings.excellent ?? 2;
      case "جيد":
        return pointsSettings.good ?? 1;
      default:
        return pointsSettings.repeat ?? 0;
    }
  };

  const handleSubmit = async () => {
    const validPages = pages.filter((p) => p.pageNumber);
    if (validPages.length === 0) {
      toast.error("يرجى إدخال رقم صفحة واحدة على الأقل");
      return;
    }

    if (!teacherId) {
      toast.error("خطأ: لم يتم تحديد معرف الأستاذ");
      console.error("teacherId is missing:", teacherId);
      return;
    }

    setLoading(true);

    try {
      // إعداد البيانات مع النقاط الديناميكية
      const recitationsToInsert = validPages.map((page) => {
        const pagePoints = getPointsLabel(page.rating);
        return {
          student_id: student.id,
          teacher_id: teacherId,
          date: selectedDate,
          last_saved: `${page.pageNumber}`,
          rating: page.rating,
          points_awarded: pagePoints,
          notes: notes || null,
        };
      });

      // فحص حالة الاتصال
      if (!navigator.onLine) {
        // وضع Offline - حفظ محلياً
        addToSyncQueue({
          type: 'recitation',
          data: recitationsToInsert
        });

        recitationsToInsert.forEach(rec => saveLocalRecitation(rec));

        const totalPoints = calculatePoints();
        toast.info(`تم حفظ التسميع محلياً (+${totalPoints} نقطة) - سيتم المزامنة عند توفر الإنترنت`);

        onOpenChange(false);
        setPages([{ pageNumber: "", rating: "ممتاز" }]);
        setNotes("");
        onSuccess();
        setLoading(false);
        return;
      }
      // تنفيذ جميع التحققات بالتوازي لتحسين الأداء
      const [
        { data: studentExists, error: studentError },
        { data: { user } },
        { data: userRole }
      ] = await Promise.all([
        supabase.from("students").select("id").eq("id", student.id).single(),
        supabase.auth.getUser(),
        supabase.from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user?.id).single()
      ]);

      if (studentError || !studentExists) {
        toast.error("لم يتم العثور على بيانات الطالب");
        setLoading(false);
        return;
      }

      if (!user) {
        toast.error("يجب تسجيل الدخول أولاً");
        setLoading(false);
        return;
      }

      const isAuthorized = userRole?.role === "admin" || userRole?.role === "supervisor";

      // إذا لم يكن مخولاً (آدمن أو مشرف)، يجب التحقق من ملكية الطالب
      if (!isAuthorized) {
        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("id, user_id")
          .eq("id", teacherId)
          .single();

        if (teacherError || !teacherData) {
          console.error("Teacher verification failed:", teacherError);
          toast.error("خطأ في التحقق من صلاحيات الأستاذ");
          setLoading(false);
          return;
        }

        if (teacherData.user_id !== user.id) {
          toast.error("ليس لديك صلاحية لإضافة تسميع لهذا الطالب");
          setLoading(false);
          return;
        }
      }

      // حذف السجلات القديمة لنفس التاريخ
      await supabase
        .from("recitations")
        .delete()
        .eq("student_id", student.id)
        .eq("date", selectedDate);

      // حفظ كل صفحة كسجل منفصل (البيانات تم إعدادها بالفعل)
      const { data, error } = await supabase
        .from("recitations")
        .insert(recitationsToInsert)
        .select();

      if (error) {
        console.error("Supabase error:", error);
        toast.error(`خطأ في الحفظ: ${error.message || "حدث خطأ غير متوقع"}`);
        return;
      }

      if (data && data.length > 0) {
        const totalPoints = calculatePoints();

        // إغلاق النافذة فوراً قبل تسجيل النشاط
        toast.success(`تم تسجيل التسميع بنجاح (+${totalPoints} نقطة)`);
        onOpenChange(false);
        setPages([{ pageNumber: "", rating: "ممتاز" }]);
        setNotes("");
        onSuccess();

        // تسجيل النشاط في الخلفية (non-blocking) لعدم إبطاء الواجهة
        (async () => {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name, role")
              .eq("id", user.id)
              .single();

            if (profile) {
              const addedByText = (profile as any).role === "admin" ? " (بواسطة الآدمن)" : "";
              await supabase.from("activity_logs").insert([{
                activity_type: "create",
                description: `تم تسجيل تسميع للطالب ${student.student_name}${addedByText}`,
                entity_type: "recitation",
                entity_name: student.student_name,
                entity_id: student.id,
                created_by: user.id,
                activity_date: selectedDate,
                new_data: {
                  pages_count: validPages.length,
                  points: totalPoints,
                  added_by: (profile as any).name || "مستخدم",
                  user_role: (profile as any).role || "user"
                }
              }]);
            }
          } catch (error) {
            console.error("Error logging activity:", error);
          }
        })();
      }
    } catch (error: any) {
      console.error("Error recording recitation:", error);
      toast.error(`حدث خطأ: ${error?.message || "خطأ غير متوقع"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-describedby="recitation-desc"
    >
      <DialogContent
        aria-describedby="recitation-desc"
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            تسجيل تسميع: {student?.student_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {pages.map((page, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  الصفحة {index + 1}
                </Label>
                {pages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePage(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs">رقم الصفحة / اسم السورة</Label>
                <Input
                  type="text"
                  placeholder="مثال: 25 أو البقرة"
                  value={page.pageNumber}
                  onChange={(e) =>
                    updatePage(index, "pageNumber", e.target.value)
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-2 block">التقدير</Label>
                <RadioGroup
                  value={page.rating}
                  onValueChange={(value) => updatePage(index, "rating", value)}
                >
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="ممتاز" id={`excellent-${index}`} />
                      <Label
                        htmlFor={`excellent-${index}`}
                        className="cursor-pointer text-xs"
                      >
                        ممتاز ({pointsSettings.excellent >= 0 ? '+' : ''}{pointsSettings.excellent})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="جيد" id={`good-${index}`} />
                      <Label
                        htmlFor={`good-${index}`}
                        className="cursor-pointer text-xs"
                      >
                        جيد ({pointsSettings.good >= 0 ? '+' : ''}{pointsSettings.good})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="إعادة" id={`repeat-${index}`} />
                      <Label
                        htmlFor={`repeat-${index}`}
                        className="cursor-pointer text-xs"
                      >
                        إعادة ({pointsSettings.repeat >= 0 ? '+' : ''}{pointsSettings.repeat})
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPage}
            className="w-full text-sm"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة صفحة أخرى
          </Button>

          <div>
            <Label className="text-xs">ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات عن التسميع..."
              className="text-sm"
              rows={3}
            />
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs font-medium">
              إجمالي النقاط: {calculatePoints()} نقطة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 text-sm"
          >
            {loading ? "جاري الحفظ..." : "حفظ التسميع"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-sm"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecitationDialog;
