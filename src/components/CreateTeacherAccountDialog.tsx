import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Lock, Mail, Phone, Sparkles } from "lucide-react";
import { generateAccountCredentials } from "@/lib/accountGenerator";

interface CreateTeacherAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: {
    id: string;
    "اسم الاستاذ": string;
    "رقم الهاتف"?: string;
    البريد_الالكتروني?: string;
  };
  onSuccess?: () => void;
}

const CreateTeacherAccountDialog = ({ 
  open, 
  onOpenChange, 
  teacher,
  onSuccess 
}: CreateTeacherAccountDialogProps) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: teacher.البريد_الالكتروني || "",
    phone: teacher["رقم الهاتف"] || ""
  });
  const [loading, setLoading] = useState(false);

  // توليد بيانات تلقائياً عند فتح النافذة
  useEffect(() => {
    if (open && teacher) {
      const credentials = generateAccountCredentials(teacher["اسم الاستاذ"]);
      setFormData({
        username: credentials.username,
        password: credentials.password,
        email: teacher.البريد_الالكتروني || "",
        phone: teacher["رقم الهاتف"] || ""
      });
    }
  }, [open, teacher]);

  const handleAutoGenerate = () => {
    const credentials = generateAccountCredentials(teacher["اسم الاستاذ"]);
    setFormData({
      ...formData,
      username: credentials.username,
      password: credentials.password,
    });
    toast.success("تم توليد اسم المستخدم وكلمة المرور تلقائياً");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error("اسم المستخدم وكلمة المرور مطلوبان");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('create_teacher_account', {
        p_teacher_id: teacher.id,
        p_username: formData.username,
        p_password: formData.password,
        p_email: formData.email || null,
        p_phone: formData.phone || null
      });

      if (error) throw error;

      toast.success("تم إنشاء الحساب بنجاح ✅");
      
      // إضافة إشعار
      await supabase.from("notifications").insert({
        title: "إنشاء حساب جديد",
        message: `تم إنشاء حساب للأستاذ ${teacher["اسم الاستاذ"]}`,
        target_role: "admin"
      });

      if (onSuccess) onSuccess();
      onOpenChange(false);
      setFormData({
        username: "",
        password: "",
        email: "",
        phone: ""
      });
    } catch (error: any) {
      console.error("Error creating account:", error);
      if (error.message?.includes('duplicate')) {
        toast.error("اسم المستخدم أو البريد الإلكتروني موجود مسبقاً");
      } else {
        toast.error("حدث خطأ أثناء إنشاء الحساب");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            إنشاء حساب للأستاذ
          </DialogTitle>
          <DialogDescription>
            إنشاء حساب دخول للأستاذ: {teacher["اسم الاستاذ"]}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* زر التوليد التلقائي */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoGenerate}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              توليد تلقائي
            </Button>
          </div>

          <div>
            <Label htmlFor="username" className="required">اسم المستخدم *</Label>
            <div className="relative">
              <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="pr-10"
                placeholder="username"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="required">كلمة المرور *</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pr-10"
                placeholder="abc123"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              📌 3 أحرف من الاسم + 3 أرقام عشوائية
            </p>
          </div>

          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pr-10"
                placeholder="teacher@jeelsalahi.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">رقم الهاتف</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pr-10"
                placeholder="+963..."
              />
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg text-sm border-2 border-primary/20">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5" />
              <p className="font-semibold text-primary">بيانات الدخول المولّدة:</p>
            </div>
            <div className="space-y-1 mr-6">
              <p className="font-mono text-sm">اسم المستخدم: <span className="font-bold">{formData.username}</span></p>
              <p className="font-mono text-sm">كلمة المرور: <span className="font-bold">{formData.password}</span></p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              💡 انسخ هذه البيانات قبل الإنشاء لإعطائها للأستاذ
            </p>
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
              {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeacherAccountDialog;
