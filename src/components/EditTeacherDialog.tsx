import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, UserPlus, CheckCircle } from "lucide-react";
import { logTeacherUpdated } from "@/lib/activityLogger";
import CreateTeacherAccountDialog from "./CreateTeacherAccountDialog";

interface EditTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: any;
  onSuccess: () => void;
}

const EditTeacherDialog = ({ open, onOpenChange, teacher, onSuccess }: EditTeacherDialogProps) => {
  const [formData, setFormData] = useState({
    اسم_الاستاذ: "",
    رقم_الهاتف: "",
    البريد_الالكتروني: "",
    الوظيفة_المرغوبة: "",
    الصف_المرغوب: "",
  });
  const [loading, setLoading] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);

  useEffect(() => {
    if (teacher) {
      setFormData({
        اسم_الاستاذ: teacher["اسم الاستاذ"] || "",
        رقم_الهاتف: teacher["رقم الهاتف"] || "",
        البريد_الالكتروني: teacher.البريد_الالكتروني || "",
        الوظيفة_المرغوبة: teacher.الوظيفة_المرغوبة || "",
        الصف_المرغوب: teacher.الصف_المرغوب || "",
      });
      checkTeacherAccount();
    }
  }, [teacher]);

  const checkTeacherAccount = async () => {
    if (!teacher) return;
    
    setCheckingAccount(true);
    try {
      // Check if teacher has user_id linked to profiles
      if (teacher.user_id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", teacher.user_id)
          .maybeSingle();

        if (!error && data) {
          setHasAccount(true);
        } else {
          setHasAccount(false);
        }
      } else {
        setHasAccount(false);
      }
    } catch (error) {
      console.error("Error checking account:", error);
    } finally {
      setCheckingAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // حفظ البيانات القديمة قبل التحديث
    const oldData = { ...teacher };

    try {
      const { error } = await supabase
        .from("teachers")
        .update({
          "اسم الاستاذ": formData.اسم_الاستاذ,
          "رقم الهاتف": formData.رقم_الهاتف || null,
          البريد_الالكتروني: formData.البريد_الالكتروني || null,
          الوظيفة_المرغوبة: formData.الوظيفة_المرغوبة || null,
          الصف_المرغوب: formData.الصف_المرغوب || null,
        })
        .eq("id", teacher.id);

      if (error) throw error;

      // تسجيل النشاط
      await logTeacherUpdated(
        teacher.id,
        formData.اسم_الاستاذ,
        oldData,
        {
          "اسم الاستاذ": formData.اسم_الاستاذ,
          "رقم الهاتف": formData.رقم_الهاتف,
          المسجد: teacher.المسجد,
        }
      );

      toast.success("تم تحديث بيانات الأستاذ بنجاح ✅");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating teacher:", error);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">
              تعديل بيانات الأستاذ
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">اسم الأستاذ *</Label>
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
              <Label htmlFor="phone">رقم الهاتف</Label>
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
              <Label htmlFor="position">الوظيفة المرغوبة</Label>
              <select
                id="position"
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
              <Label htmlFor="class">الصف المرغوب</Label>
              <Input
                id="class"
                value={formData.الصف_المرغوب}
                onChange={(e) => setFormData({ ...formData, الصف_المرغوب: e.target.value })}
              />
            </div>

            {/* حالة الحساب */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <div>
                    <h4 className="font-semibold">حساب المستخدم</h4>
                    <p className="text-sm text-muted-foreground">
                      {checkingAccount ? "جاري التحقق..." : 
                       hasAccount ? "يمتلك حساب نشط" : "لا يوجد حساب"}
                    </p>
                  </div>
                </div>
                {!checkingAccount && (
                  hasAccount ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">مفعّل</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateAccount(true)}
                    >
                      <UserPlus className="w-4 h-4 ml-2" />
                      إنشاء حساب
                    </Button>
                  )
                )}
              </div>
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
                {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {teacher && (
        <CreateTeacherAccountDialog
          open={showCreateAccount}
          onOpenChange={setShowCreateAccount}
          teacher={teacher}
          onSuccess={() => {
            checkTeacherAccount();
            toast.success("تم إنشاء الحساب بنجاح");
          }}
        />
      )}
    </>
  );
};

export default EditTeacherDialog;
