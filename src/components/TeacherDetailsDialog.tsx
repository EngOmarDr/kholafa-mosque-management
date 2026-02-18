import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Phone, Mail, Briefcase, GraduationCap, Heart, Info, BookOpen, FileText } from "lucide-react";

interface TeacherDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: any;
  onSuccess: () => void;
}

const TeacherDetailsDialog = ({ open, onOpenChange, teacher, onSuccess }: TeacherDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (teacher) {
      setFormData({
        اسم_الاستاذ: teacher["اسم الاستاذ"] || "",
        اسم_الاب: teacher.اسم_الاب || "",
        تاريخ_الميلاد: teacher.تاريخ_الميلاد || "",
        رقم_الهاتف: teacher["رقم الهاتف"] || "",
        البريد_الالكتروني: teacher.البريد_الالكتروني || "",
        التحصيل_الدراسي: teacher.التحصيل_الدراسي || "",
        الحالة_الاجتماعية: teacher.الحالة_الاجتماعية || "",
        المؤهل_العلمي_الديني: teacher.المؤهل_العلمي_الديني || [],
        اسم_المسجد_السابق: teacher.اسم_المسجد_السابق || "",
        مكان_وصول_الحفظ: teacher.مكان_وصول_الحفظ || "",
        اسم_المعلم_السابق: teacher.اسم_المعلم_السابق || "",
        اسم_الثانوية_الشرعية: teacher.اسم_الثانوية_الشرعية || "",
        عدد_سنوات_التحصيل: teacher.عدد_سنوات_التحصيل || "",
        الحالة_الصحية_والنفسية: teacher.الحالة_الصحية_والنفسية || "",
        الوظيفة_المرغوبة: teacher.الوظيفة_المرغوبة || "",
        الصف_المرغوب: teacher.الصف_المرغوب || "",
        المهارات: teacher.المهارات || "",
        الأحلام: teacher.الأحلام || "",
        سنوات_الالتزام: teacher.سنوات_الالتزام || "",
        المسجد: teacher.المسجد || "",
      });
    }
  }, [teacher]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("teachers")
        .update({
          "اسم الاستاذ": formData.اسم_الاستاذ,
          اسم_الاب: formData.اسم_الاب || null,
          تاريخ_الميلاد: formData.تاريخ_الميلاد || null,
          "رقم الهاتف": formData.رقم_الهاتف || null,
          البريد_الالكتروني: formData.البريد_الالكتروني || null,
          التحصيل_الدراسي: formData.التحصيل_الدراسي || null,
          الحالة_الاجتماعية: formData.الحالة_الاجتماعية || null,
          المؤهل_العلمي_الديني: formData.المؤهل_العلمي_الديني,
          اسم_المسجد_السابق: formData.اسم_المسجد_السابق || null,
          مكان_وصول_الحفظ: formData.مكان_وصول_الحفظ || null,
          اسم_المعلم_السابق: formData.اسم_المعلم_السابق || null,
          اسم_الثانوية_الشرعية: formData.اسم_الثانوية_الشرعية || null,
          عدد_سنوات_التحصيل: formData.عدد_سنوات_التحصيل || null,
          الحالة_الصحية_والنفسية: formData.الحالة_الصحية_والنفسية || null,
          الوظيفة_المرغوبة: formData.الوظيفة_المرغوبة || null,
          الصف_المرغوب: formData.الصف_المرغوب || null,
          المهارات: formData.المهارات || null,
          الأحلام: formData.الأحلام || null,
          سنوات_الالتزام: formData.سنوات_الالتزام || null,
          المسجد: formData.المسجد || null,
        })
        .eq("id", teacher.id);

      if (error) throw error;

      toast.success("تم تحديث بيانات الأستاذ بنجاح ✅");
      setIsEditing(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating teacher:", error);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setLoading(false);
    }
  };

  const handleQualificationChange = (value: string, checked: boolean) => {
    let newQualifications = [...(formData.المؤهل_العلمي_الديني || [])];
    if (checked) {
      newQualifications.push(value);
    } else {
      newQualifications = newQualifications.filter(q => q !== value);
    }
    setFormData({ ...formData, المؤهل_العلمي_الديني: newQualifications });
  };

  const InfoField = ({ label, value, icon: Icon }: any) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="font-medium">{label}</span>
      </div>
      <p className="text-sm pr-6">{value || "غير محدد"}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            {isEditing ? "تعديل بيانات الأستاذ" : "بيانات الأستاذ"}
          </DialogTitle>
          <DialogDescription>
            {teacher?.["اسم الاستاذ"]}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              {activeTab === "basic" && <span>المعلومات الأساسية</span>}
            </TabsTrigger>
            <TabsTrigger value="education" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {activeTab === "education" && <span>المؤهلات العلمية</span>}
            </TabsTrigger>
            <TabsTrigger value="additional" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {activeTab === "additional" && <span>معلومات إضافية</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الأستاذ *</Label>
                    <Input
                      value={formData.اسم_الاستاذ}
                      onChange={(e) => setFormData({ ...formData, اسم_الاستاذ: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>اسم الأب</Label>
                    <Input
                      value={formData.اسم_الاب}
                      onChange={(e) => setFormData({ ...formData, اسم_الاب: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>تاريخ الميلاد</Label>
                    <Input
                      type="date"
                      value={formData.تاريخ_الميلاد}
                      onChange={(e) => setFormData({ ...formData, تاريخ_الميلاد: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={formData.رقم_الهاتف}
                      onChange={(e) => setFormData({ ...formData, رقم_الهاتف: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={formData.البريد_الالكتروني}
                      onChange={(e) => setFormData({ ...formData, البريد_الالكتروني: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>التحصيل الدراسي</Label>
                    <Input
                      value={formData.التحصيل_الدراسي}
                      onChange={(e) => setFormData({ ...formData, التحصيل_الدراسي: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>الحالة الاجتماعية</Label>
                    <select
                      value={formData.الحالة_الاجتماعية}
                      onChange={(e) => setFormData({ ...formData, الحالة_الاجتماعية: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">اختر...</option>
                      <option value="متزوج">متزوج</option>
                      <option value="عاقد">عاقد</option>
                      <option value="أعزب">أعزب</option>
                    </select>
                  </div>
                  <div>
                    <Label>المسجد</Label>
                    <Input
                      value={formData.المسجد}
                      onChange={(e) => setFormData({ ...formData, المسجد: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoField label="اسم الأستاذ" value={teacher?.["اسم الاستاذ"]} icon={User} />
                <InfoField label="اسم الأب" value={teacher?.اسم_الاب} icon={User} />
                <InfoField label="تاريخ الميلاد" value={teacher?.تاريخ_الميلاد} />
                <InfoField label="رقم الهاتف" value={teacher?.["رقم الهاتف"]} icon={Phone} />
                <InfoField label="البريد الإلكتروني" value={teacher?.البريد_الالكتروني} icon={Mail} />
                <InfoField label="التحصيل الدراسي" value={teacher?.التحصيل_الدراسي} icon={GraduationCap} />
                <InfoField label="الحالة الاجتماعية" value={teacher?.الحالة_الاجتماعية} icon={Heart} />
                <InfoField label="المسجد" value={teacher?.["المسجد"]} icon={Briefcase} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="education" className="space-y-4 mt-4">
            {isEditing ? (
              <>
                <div className="space-y-3">
                  <Label>المؤهل العلمي الديني</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.المؤهل_العلمي_الديني?.includes("درست في مسجد سابق")}
                        onCheckedChange={(checked) => 
                          handleQualificationChange("درست في مسجد سابق", checked as boolean)
                        }
                      />
                      <Label>درست في مسجد سابق</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.المؤهل_العلمي_الديني?.includes("درست في الثانوية الشرعية")}
                        onCheckedChange={(checked) => 
                          handleQualificationChange("درست في الثانوية الشرعية", checked as boolean)
                        }
                      />
                      <Label>درست في الثانوية الشرعية</Label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم المسجد السابق</Label>
                    <Input
                      value={formData.اسم_المسجد_السابق}
                      onChange={(e) => setFormData({ ...formData, اسم_المسجد_السابق: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>مكان وصول الحفظ</Label>
                    <Input
                      value={formData.مكان_وصول_الحفظ}
                      onChange={(e) => setFormData({ ...formData, مكان_وصول_الحفظ: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>اسم المعلم السابق</Label>
                    <Input
                      value={formData.اسم_المعلم_السابق}
                      onChange={(e) => setFormData({ ...formData, اسم_المعلم_السابق: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>اسم الثانوية الشرعية</Label>
                    <Input
                      value={formData.اسم_الثانوية_الشرعية}
                      onChange={(e) => setFormData({ ...formData, اسم_الثانوية_الشرعية: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>عدد سنوات التحصيل</Label>
                    <Input
                      type="number"
                      value={formData.عدد_سنوات_التحصيل}
                      onChange={(e) => setFormData({ ...formData, عدد_سنوات_التحصيل: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <InfoField 
                    label="المؤهل العلمي الديني" 
                    value={teacher?.المؤهل_العلمي_الديني?.join(" - ") || "غير محدد"} 
                  />
                </div>
                <InfoField label="اسم المسجد السابق" value={teacher?.اسم_المسجد_السابق} />
                <InfoField label="مكان وصول الحفظ" value={teacher?.مكان_وصول_الحفظ} />
                <InfoField label="اسم المعلم السابق" value={teacher?.اسم_المعلم_السابق} />
                <InfoField label="اسم الثانوية الشرعية" value={teacher?.اسم_الثانوية_الشرعية} />
                <InfoField label="عدد سنوات التحصيل" value={teacher?.عدد_سنوات_التحصيل} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="additional" className="space-y-4 mt-4">
            {isEditing ? (
              <>
                <div>
                  <Label>الحالة الصحية والنفسية</Label>
                  <Textarea
                    value={formData.الحالة_الصحية_والنفسية}
                    onChange={(e) => setFormData({ ...formData, الحالة_الصحية_والنفسية: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>الوظيفة المرغوبة</Label>
                    <select
                      value={formData.الوظيفة_المرغوبة}
                      onChange={(e) => setFormData({ ...formData, الوظيفة_المرغوبة: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">اختر...</option>
                      <option value="مدرساً">مدرساً</option>
                      <option value="مشرفاً">مشرفاً</option>
                    </select>
                  </div>
                  <div>
                    <Label>الصف المرغوب</Label>
                    <Input
                      value={formData.الصف_المرغوب}
                      onChange={(e) => setFormData({ ...formData, الصف_المرغوب: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>المهارات</Label>
                  <Textarea
                    value={formData.المهارات}
                    onChange={(e) => setFormData({ ...formData, المهارات: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>الأحلام</Label>
                  <Textarea
                    value={formData.الأحلام}
                    onChange={(e) => setFormData({ ...formData, الأحلام: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>عدد سنوات الالتزام</Label>
                  <Input
                    type="number"
                    value={formData.سنوات_الالتزام}
                    onChange={(e) => setFormData({ ...formData, سنوات_الالتزام: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <InfoField label="الحالة الصحية والنفسية" value={teacher?.الحالة_الصحية_والنفسية} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="الوظيفة المرغوبة" value={teacher?.الوظيفة_المرغوبة} />
                  <InfoField label="الصف المرغوب" value={teacher?.الصف_المرغوب} />
                </div>
                <InfoField label="المهارات" value={teacher?.المهارات} />
                <InfoField label="الأحلام" value={teacher?.الأحلام} />
                <InfoField label="عدد سنوات الالتزام" value={teacher?.سنوات_الالتزام} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 justify-end pt-4 border-t">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={loading}
              >
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إغلاق
              </Button>
              <Button onClick={() => setIsEditing(true)} className="btn-primary">
                تعديل البيانات
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherDetailsDialog;
