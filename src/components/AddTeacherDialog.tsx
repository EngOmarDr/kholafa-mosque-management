import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, Briefcase, Eye } from "lucide-react";
import { logTeacherAdded } from "@/lib/activityLogger";
import { generateAccountCredentials } from "@/lib/accountGenerator";

interface AddTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AddTeacherDialog = ({ open, onOpenChange, onSuccess }: AddTeacherDialogProps) => {
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
  const [showMosqueFields, setShowMosqueFields] = useState(false);
  const [showClassField, setShowClassField] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "supervisor" | "teacher">("teacher");

  // تحديث بيانات الحساب تلقائياً عند تغيير الاسم
  useEffect(() => {
    if (createAccount && formData.اسم_الاستاذ) {
      const credentials = generateAccountCredentials(formData.اسم_الاستاذ);
      setAccountUsername(credentials.username);
      setAccountPassword(credentials.password);
    }
  }, [formData.اسم_الاستاذ, createAccount]);

  const handleQualificationChange = (value: string, checked: boolean) => {
    let newQualifications = [...formData.المؤهل_العلمي_الديني];
    if (checked) {
      newQualifications.push(value);
      if (value === "درست في مسجد سابق") {
        setShowMosqueFields(true);
      }
    } else {
      newQualifications = newQualifications.filter(q => q !== value);
      if (value === "درست في مسجد سابق" && !newQualifications.includes(value)) {
        setShowMosqueFields(false);
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
      // استخدام RPC function لإضافة الأستاذ
      const { data: teacherId, error: teacherError } = await supabase
        .rpc('add_teacher', {
          p_teacher_data: {
            اسم_الاستاذ: formData.اسم_الاستاذ,
            رقم_الهاتف: formData.رقم_الهاتف || null,
            المسجد: null,
            اسم_الاب: formData.اسم_الاب || null,
            تاريخ_الميلاد: formData.تاريخ_الميلاد || null,
            التحصيل_الدراسي: formData.التحصيل_الدراسي || null,
            الحالة_الاجتماعية: formData.الحالة_الاجتماعية || null,
            المؤهل_العلمي_الديني: formData.المؤهل_العلمي_الديني.length > 0 ? formData.المؤهل_العلمي_الديني : [],
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
            البريد_الالكتروني: formData.البريد_الالكتروني || null
          }
        });

      if (teacherError) throw teacherError;

      // إنشاء حساب إذا تم تفعيل الخيار
      if (createAccount && accountUsername && accountPassword) {
        try {
          // استدعاء Edge Function لإنشاء المستخدم
          const { data: createUserData, error: createUserError } = await supabase.functions.invoke(
            'create-admin',
            {
              body: {
                email: formData.البريد_الالكتروني || `${accountUsername}@jeelsalahi.com`,
                password: accountPassword,
                name: formData.اسم_الاستاذ,
                phone: formData.رقم_الهاتف || null,
                role: selectedRole
              }
            }
          );

          if (createUserError) {
            console.error("Error creating account:", createUserError);
            toast.error("تم إضافة الأستاذ لكن فشل إنشاء الحساب");
          } else if (createUserData?.user_id) {
            // ربط المعلم بالمستخدم الجديد
            const { error: linkError } = await supabase
              .from('teachers')
              .update({ user_id: createUserData.user_id })
              .eq('id', teacherId);

            if (linkError) {
              console.error("Error linking teacher to user:", linkError);
              toast.error("تم إنشاء الحساب لكن فشل الربط بالأستاذ");
            } else {
              toast.success(`تم إضافة الأستاذ وإنشاء الحساب بنجاح (${selectedRole === 'admin' ? 'مدير' : selectedRole === 'supervisor' ? 'مشرف' : 'أستاذ'}) ✅`);
            }
          }
        } catch (error) {
          console.error("Error in account creation:", error);
          toast.error("تم إضافة الأستاذ لكن فشل إنشاء الحساب");
        }
      } else {
        toast.success("تم إضافة الأستاذ بنجاح ✅");
      }

      // تسجيل النشاط
      await logTeacherAdded({
        id: teacherId,
        "اسم الاستاذ": formData.اسم_الاستاذ,
        "رقم الهاتف": formData.رقم_الهاتف,
        المسجد: null,
      });

      // إضافة إشعار
      await supabase.from("notifications").insert({
        title: "إضافة أستاذ جديد",
        message: `تم تسجيل الأستاذ ${formData.اسم_الاستاذ}${createAccount ? ' وإنشاء حسابه' : ''}`,
        target_role: "admin"
      });

      onSuccess();
      onOpenChange(false);
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
    } catch (error) {
      console.error("Error adding teacher:", error);
      toast.error("حدث خطأ أثناء إضافة الأستاذ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            تسجيل أستاذ جديد
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection - First Field */}
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20 rounded-lg p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-lg font-bold text-foreground">دور الأستاذ في النظام</Label>
                <p className="text-sm text-muted-foreground">حدد صلاحيات المستخدم</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setSelectedRole("teacher")}
                className={`
                  relative overflow-hidden rounded-lg p-4 border-2 transition-all duration-300 transform hover:scale-105
                  ${selectedRole === "teacher"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border bg-background hover:border-primary/50"
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <User className={`h-8 w-8 transition-colors ${selectedRole === "teacher" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`font-semibold ${selectedRole === "teacher" ? "text-primary" : "text-foreground"}`}>
                    أستاذ
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    إدارة الطلاب والحضور
                  </span>
                </div>
                {selectedRole === "teacher" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole("supervisor")}
                className={`
                  relative overflow-hidden rounded-lg p-4 border-2 transition-all duration-300 transform hover:scale-105
                  ${selectedRole === "supervisor"
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20"
                    : "border-border bg-background hover:border-amber-500/50"
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <Eye className={`h-8 w-8 transition-colors ${selectedRole === "supervisor" ? "text-amber-500" : "text-muted-foreground"}`} />
                  <span className={`font-semibold ${selectedRole === "supervisor" ? "text-amber-500" : "text-foreground"}`}>
                    مشرف
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    إدخال البيانات لكل الحلقات
                  </span>
                </div>
                {selectedRole === "supervisor" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className={`
                  relative overflow-hidden rounded-lg p-4 border-2 transition-all duration-300 transform hover:scale-105
                  ${selectedRole === "admin"
                    ? "border-destructive bg-destructive/10 shadow-lg shadow-destructive/20"
                    : "border-border bg-background hover:border-destructive/50"
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2">
                  <Briefcase className={`h-8 w-8 transition-colors ${selectedRole === "admin" ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className={`font-semibold ${selectedRole === "admin" ? "text-destructive" : "text-foreground"}`}>
                    مدير
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    صلاحيات كاملة للنظام
                  </span>
                </div>
                {selectedRole === "admin" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 to-transparent animate-pulse" />
                )}
              </button>
            </div>
          </div>
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
            </div>

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
                  <option value="مديراً">مديراً</option>
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

          {/* إنشاء حساب تلقائياً */}
          <div className="space-y-4 p-4 bg-accent rounded-lg border-2 border-primary">
            <div className="flex items-center gap-2">
              <Checkbox
                id="createAccount"
                checked={createAccount}
                onCheckedChange={(checked) => {
                  setCreateAccount(checked as boolean);
                  if (checked) {
                    // توليد اسم مستخدم تلقائي
                    const username = formData.اسم_الاستاذ.replace(/\s+/g, '').toLowerCase();
                    setAccountUsername(username);
                    setAccountPassword("Teacher@2024");
                  }
                }}
              />
              <Label htmlFor="createAccount" className="cursor-pointer font-semibold text-primary">
                إنشاء حساب مستخدم تلقائياً
              </Label>
            </div>

            {createAccount && (
              <div className="space-y-3 mr-6">
                <div>
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={accountUsername}
                    onChange={(e) => setAccountUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                  />
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="text"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="كلمة المرور"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  💡 سيتم إنشاء حساب بصلاحيات {
                    selectedRole === "admin" ? "مدير نظام" :
                      selectedRole === "supervisor" ? "مشرف" :
                        "أستاذ"
                  } يمكنه تسجيل الدخول مباشرة
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary">
              {loading ? "جاري الحفظ..." : "حفظ الأستاذ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTeacherDialog;
