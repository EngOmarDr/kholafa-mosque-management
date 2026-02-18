import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, CheckCircle } from "lucide-react";

const TeacherApplicationForm = () => {
  const [formData, setFormData] = useState({
    اسم_الاستاذ: "",
    اسم_الاب: "",
    تاريخ_الميلاد: "",
    رقم_الهاتف: "",
    البريد_الالكتروني: "",
    التحصيل_الدراسي: "",
    الحالة_الاجتماعية: "",
    المؤهل_العلمي_الديني: [] as string[],
    اسم_المسجد_السابق: "",
    مكان_وصول_الحفظ: "",
    اسم_المعلم_السابق: "",
    اسم_الثانوية_الشرعية: "",
    عدد_سنوات_التحصيل: "",
    الحالة_الصحية_والنفسية: "",
    الوظيفة_المرغوبة: "",
    الصف_المرغوب: "",
    المهارات: "",
    الأحلام: "",
    سنوات_الالتزام: ""
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMosqueFields, setShowMosqueFields] = useState(false);
  const [showShariaSchoolFields, setShowShariaSchoolFields] = useState(false);
  const [showClassField, setShowClassField] = useState(false);

  const handleQualificationChange = (value: string, checked: boolean) => {
    let newQualifications = [...formData.المؤهل_العلمي_الديني];
    if (checked) {
      newQualifications.push(value);
      if (value === "درست في مسجد سابق") {
        setShowMosqueFields(true);
      }
      if (value === "درست في الثانوية الشرعية") {
        setShowShariaSchoolFields(true);
      }
    } else {
      newQualifications = newQualifications.filter(q => q !== value);
      if (value === "درست في مسجد سابق" && !newQualifications.includes(value)) {
        setShowMosqueFields(false);
      }
      if (value === "درست في الثانوية الشرعية" && !newQualifications.includes(value)) {
        setShowShariaSchoolFields(false);
      }
    }
    setFormData({ ...formData, المؤهل_العلمي_الديني: newQualifications });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.اسم_الاستاذ.trim()) {
      toast.error("اسم الأستاذ مطلوب");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("teacher_applications")
        .insert({
          اسم_الاستاذ: formData.اسم_الاستاذ,
          اسم_الاب: formData.اسم_الاب || null,
          تاريخ_الميلاد: formData.تاريخ_الميلاد || null,
          رقم_الهاتف: formData.رقم_الهاتف || null,
          البريد_الالكتروني: formData.البريد_الالكتروني || null,
          التحصيل_الدراسي: formData.التحصيل_الدراسي || null,
          الحالة_الاجتماعية: formData.الحالة_الاجتماعية || null,
          المؤهل_العلمي_الديني: formData.المؤهل_العلمي_الديني.length > 0 ? formData.المؤهل_العلمي_الديني : null,
          اسم_المسجد_السابق: formData.اسم_المسجد_السابق || null,
          مكان_وصول_الحفظ: formData.مكان_وصول_الحفظ || null,
          اسم_المعلم_السابق: formData.اسم_المعلم_السابق || null,
          اسم_الثانوية_الشرعية: formData.اسم_الثانوية_الشرعية || null,
          عدد_سنوات_التحصيل: formData.عدد_سنوات_التحصيل ? parseInt(formData.عدد_سنوات_التحصيل) : null,
          الحالة_الصحية_والنفسية: formData.الحالة_الصحية_والنفسية || null,
          الوظيفة_المرغوبة: formData.الوظيفة_المرغوبة || null,
          الصف_المرغوب: formData.الصف_المرغوب || null,
          المهارات: formData.المهارات || null,
          الأحلام: formData.الأحلام || null,
          سنوات_الالتزام: formData.سنوات_الالتزام ? parseInt(formData.سنوات_الالتزام) : null,
          حالة_الطلب: "قيد المراجعة"
        });

      if (error) throw error;

      toast.success("تم إرسال طلبك بنجاح! سيتم مراجعته قريباً ✅");
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <div className="max-w-md w-full bg-background rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-primary mb-4">
            شكراً لك!
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            تم استلام طلبك بنجاح. سيقوم فريق الإدارة بمراجعة بياناتك والتواصل معك قريباً.
          </p>
          <Button
            onClick={() => {
              setSubmitted(false);
              setFormData({
                اسم_الاستاذ: "",
                اسم_الاب: "",
                تاريخ_الميلاد: "",
                رقم_الهاتف: "",
                البريد_الالكتروني: "",
                التحصيل_الدراسي: "",
                الحالة_الاجتماعية: "",
                المؤهل_العلمي_الديني: [],
                اسم_المسجد_السابق: "",
                مكان_وصول_الحفظ: "",
                اسم_المعلم_السابق: "",
                اسم_الثانوية_الشرعية: "",
                عدد_سنوات_التحصيل: "",
                الحالة_الصحية_والنفسية: "",
                الوظيفة_المرغوبة: "",
                الصف_المرغوب: "",
                المهارات: "",
                الأحلام: "",
                سنوات_الالتزام: ""
              });
            }}
            className="btn-primary"
          >
            إرسال طلب آخر
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-background rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">
              نموذج التقديم للتدريس
            </h1>
            <p className="text-muted-foreground">
              دورة الخلفاء الراشدين
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* المعلومات الأساسية */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">
                المعلومات الأساسية
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="required">اسم الأستاذ *</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={formData.اسم_الاستاذ}
                      onChange={(e) => setFormData({ ...formData, اسم_الاستاذ: e.target.value })}
                      className="pr-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="fatherName">اسم الأب</Label>
                  <Input
                    id="fatherName"
                    value={formData.اسم_الاب}
                    onChange={(e) => setFormData({ ...formData, اسم_الاب: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="birthDate">تاريخ الميلاد</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.تاريخ_الميلاد}
                    onChange={(e) => setFormData({ ...formData, تاريخ_الميلاد: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">رقم الهاتف (يفضل واتساب)</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.رقم_الهاتف}
                      onChange={(e) => setFormData({ ...formData, رقم_الهاتف: e.target.value })}
                      className="pr-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.البريد_الالكتروني}
                      onChange={(e) => setFormData({ ...formData, البريد_الالكتروني: e.target.value })}
                      className="pr-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="education">التحصيل الدراسي</Label>
                  <Input
                    id="education"
                    value={formData.التحصيل_الدراسي}
                    onChange={(e) => setFormData({ ...formData, التحصيل_الدراسي: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="maritalStatus">الحالة الاجتماعية</Label>
                  <select
                    id="maritalStatus"
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
              </div>
            </div>

            {/* المؤهل العلمي الديني */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">
                المؤهل العلمي الديني
              </h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mosque"
                    checked={formData.المؤهل_العلمي_الديني.includes("درست في مسجد سابق")}
                    onCheckedChange={(checked) =>
                      handleQualificationChange("درست في مسجد سابق", checked as boolean)
                    }
                  />
                  <Label htmlFor="mosque" className="cursor-pointer">درست في مسجد سابق</Label>
                </div>

                {showMosqueFields && (
                  <div className="mr-6 space-y-3 p-4 bg-accent rounded-lg">
                    <div>
                      <Label htmlFor="previousMosque">اسم المسجد</Label>
                      <Input
                        id="previousMosque"
                        value={formData.اسم_المسجد_السابق}
                        onChange={(e) => setFormData({ ...formData, اسم_المسجد_السابق: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="memorization">مكان وصول الحفظ</Label>
                      <Input
                        id="memorization"
                        value={formData.مكان_وصول_الحفظ}
                        onChange={(e) => setFormData({ ...formData, مكان_وصول_الحفظ: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="previousTeacher">اسم المعلم الذي قرأت عليه</Label>
                      <Input
                        id="previousTeacher"
                        value={formData.اسم_المعلم_السابق}
                        onChange={(e) => setFormData({ ...formData, اسم_المعلم_السابق: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="shariaSchool"
                    checked={formData.المؤهل_العلمي_الديني.includes("درست في الثانوية الشرعية")}
                    onCheckedChange={(checked) =>
                      handleQualificationChange("درست في الثانوية الشرعية", checked as boolean)
                    }
                  />
                  <Label htmlFor="shariaSchool" className="cursor-pointer">درست في الثانوية الشرعية</Label>
                </div>

                {showShariaSchoolFields && (
                  <div className="mr-6 space-y-3 p-4 bg-accent rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="shariaSchoolName">اسم الثانوية الشرعية</Label>
                        <Input
                          id="shariaSchoolName"
                          value={formData.اسم_الثانوية_الشرعية}
                          onChange={(e) => setFormData({ ...formData, اسم_الثانوية_الشرعية: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="yearsOfStudy">عدد سنوات التحصيل العلمي</Label>
                        <Input
                          id="yearsOfStudy"
                          type="number"
                          value={formData.عدد_سنوات_التحصيل}
                          onChange={(e) => setFormData({ ...formData, عدد_سنوات_التحصيل: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* معلومات إضافية */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">
                معلومات إضافية
              </h3>

              <div>
                <Label htmlFor="health">الحالة الصحية والنفسية</Label>
                <Textarea
                  id="health"
                  value={formData.الحالة_الصحية_والنفسية}
                  onChange={(e) => setFormData({ ...formData, الحالة_الصحية_والنفسية: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position">أرغب بالعمل بصفتي</Label>
                  <select
                    id="position"
                    value={formData.الوظيفة_المرغوبة}
                    onChange={(e) => {
                      setFormData({ ...formData, الوظيفة_المرغوبة: e.target.value });
                      setShowClassField(e.target.value === "مدرساً");
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">اختر...</option>
                    <option value="مدرساً">مدرساً</option>
                    <option value="مشرفاً">مشرفاً</option>
                  </select>
                </div>

                {showClassField && (
                  <div>
                    <Label htmlFor="classLevel">مدرساً لصف</Label>
                    <Input
                      id="classLevel"
                      value={formData.الصف_المرغوب}
                      onChange={(e) => setFormData({ ...formData, الصف_المرغوب: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="skills">المهارات التي تجيدها</Label>
                <Textarea
                  id="skills"
                  value={formData.المهارات}
                  onChange={(e) => setFormData({ ...formData, المهارات: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="dreams">أطمح إلى (حلمي)</Label>
                <Textarea
                  id="dreams"
                  value={formData.الأحلام}
                  onChange={(e) => setFormData({ ...formData, الأحلام: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="commitmentYears">عدد السنوات التي سألتزم بها في المسجد تقريباً</Label>
                <Input
                  id="commitmentYears"
                  type="number"
                  value={formData.سنوات_الالتزام}
                  onChange={(e) => setFormData({ ...formData, سنوات_الالتزام: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full btn-primary text-lg py-6">
              {loading ? "جاري الإرسال..." : "إرسال الطلب"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TeacherApplicationForm;
