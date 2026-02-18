import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Mail, Sparkles, CheckCircle, Trash2, Shield } from "lucide-react";
import { logTeacherUpdated } from "@/lib/activityLogger";
import { generateAccountCredentials } from "@/lib/accountGenerator";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentReassignmentDialog } from "./StudentReassignmentDialog";
import { RoleChangeConfirmationDialog } from "./RoleChangeConfirmationDialog";
import { useQueryClient } from "@tanstack/react-query";

interface TeacherManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: any;
  onSuccess: () => void;
  onDelete?: () => void;
}

const TeacherManagementDialog = ({
  open,
  onOpenChange,
  teacher,
  onSuccess,
  onDelete
}: TeacherManagementDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    اسم_الاستاذ: "",
    رقم_الهاتف: "",
    البريد_الالكتروني: "",
    الوظيفة_المرغوبة: "",
    الصف_المرغوب: "",
  });
  const [loading, setLoading] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [lastCredentials, setLastCredentials] = useState<{ username: string; password: string; email: string } | null>(null);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [showStudentsDialog, setShowStudentsDialog] = useState(false);
  const [showRoleConfirmDialog, setShowRoleConfirmDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);

  useEffect(() => {
    if (teacher && open) {
      setFormData({
        اسم_الاستاذ: teacher["اسم الاستاذ"] || "",
        رقم_الهاتف: teacher["رقم الهاتف"] || "",
        البريد_الالكتروني: teacher.البريد_الالكتروني || "",
        الوظيفة_المرغوبة: teacher.الوظيفة_المرغوبة || "",
        الصف_المرغوب: teacher.الصف_المرغوب || "",
      });
      setShowPasswordEdit(false);
      setNewPassword("");
      setLastCredentials(null);
      setUserRole("");
      checkTeacherAccount();
    }
  }, [teacher, open]);

  const checkTeacherAccount = async () => {
    if (!teacher) return;
    setCheckingAccount(true);

    try {
      // Check if teacher has user_id linked to profiles
      if (teacher.user_id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, email, role")
          .eq("id", teacher.user_id)
          .maybeSingle();

        if (!error && data) {
          setHasAccount(true);
          setAccountInfo(data as any);
          await fetchUserRole(data.id);
          setCheckingAccount(false);
          return;
        }
      }

      // لا يوجد حساب
      setHasAccount(false);
      setAccountInfo(null);
    } catch (error) {
      console.error('Error checking account:', error);
      setHasAccount(false);
      setAccountInfo(null);
    } finally {
      setCheckingAccount(false);
    }
  };

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const checkTeacherStudents = async () => {
    if (!teacher?.id) return [];

    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, student_name, grade')
        .eq('teacher_id', teacher.id);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching teacher students:', error);
      return [];
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!accountInfo?.id) {
      toast.error("لا يوجد حساب لهذا الأستاذ");
      return;
    }

    // إذا كان التحويل من teacher إلى admin، تحقق من الطلاب
    if (userRole === 'teacher' && newRole === 'admin') {
      // إعادة تحميل البيانات للتأكد من أحدث حالة
      await queryClient.refetchQueries({ queryKey: ['students'] });

      const students = await checkTeacherStudents();

      if (students.length > 0) {
        // لديه طلاب - اعرض التحذير
        setTeacherStudents(students);
        setShowStudentsDialog(true);
        setPendingRole(newRole);
        return;
      } else {
        // ليس لديه طلاب - اعرض التأكيد
        setPendingRole(newRole);
        setShowRoleConfirmDialog(true);
        return;
      }
    }

    // التغييرات الأخرى تتم مباشرة
    await executeRoleChange(newRole);
  };

  const executeRoleChange = async (newRole: string) => {
    if (!accountInfo?.id) return;

    setUpdatingRole(true);
    try {
      const { error } = await supabase.rpc('update_user_role', {
        p_user_id: accountInfo.id,
        p_new_role: newRole as any
      });

      if (error) throw error;

      setUserRole(newRole);
      toast.success(`تم تحديث الدور إلى ${newRole === 'admin' ? 'أدمن' :
          newRole === 'supervisor' ? 'مشرف' :
            'أستاذ'
        } بنجاح ✅`);

      setShowRoleConfirmDialog(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("حدث خطأ أثناء تحديث الدور");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleAutoCreateAccount = async () => {
    if (!teacher || hasAccount) return;

    setCreatingAccount(true);
    try {
      const credentials = generateAccountCredentials(teacher["اسم الاستاذ"]);
      const email = `${credentials.username}@jeel.com`;
      const role = teacher.الوظيفة_المرغوبة === "مشرفاً" ? "supervisor" :
        teacher.الوظيفة_المرغوبة === "مديراً" ? "admin" : "teacher";

      // Call create-admin edge function
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email,
          password: credentials.password,
          name: teacher["اسم الاستاذ"],
          phone: teacher["رقم الهاتف"] || null,
          role
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error.message);
      }

      // Update teacher with user_id
      await supabase
        .from("teachers")
        .update({
          user_id: data.user_id,
          البريد_الالكتروني: email
        })
        .eq("id", teacher.id);

      setLastCredentials({ username: teacher["اسم الاستاذ"], password: credentials.password, email });
      setHasAccount(true);
      setAccountInfo({ id: data.user_id, name: teacher["اسم الاستاذ"], email, role });

      toast.success(
        <div className="space-y-2">
          <p className="font-bold">تم إنشاء الحساب بنجاح! ✅</p>
          <div className="text-sm space-y-1 font-mono bg-muted p-2 rounded">
            <p>البريد: <span className="font-bold">{email}</span></p>
            <p>كلمة المرور: <span className="font-bold">{credentials.password}</span></p>
          </div>
          <p className="text-xs text-muted-foreground">احفظ هذه البيانات!</p>
        </div>,
        { duration: 12000 }
      );

      onSuccess();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast.error("حدث خطأ أثناء إنشاء الحساب");
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!accountInfo?.id || !newPassword || newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    setUpdatingPassword(true);
    try {
      // Call the update-user-password edge function
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: {
          user_id: accountInfo.id,
          new_password: newPassword
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error.message);
      }

      toast.success("تم تحديث كلمة المرور بنجاح ✅");
      setNewPassword("");
      setShowPasswordEdit(false);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error("حدث خطأ أثناء تحديث كلمة المرور");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary flex items-center justify-between">
            <span>إدارة الأستاذ</span>
            {!checkingAccount && (
              hasAccount ? (
                <Badge variant="default" className="bg-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  لديه حساب
                </Badge>
              ) : (
                <Badge variant="secondary">لا يوجد حساب</Badge>
              )
            )}
          </DialogTitle>
        </DialogHeader>

        {/* زر إنشاء حساب تلقائي في الأعلى */}
        {!checkingAccount && !hasAccount && (
          <div className="mb-4">
            <Button
              type="button"
              onClick={handleAutoCreateAccount}
              disabled={creatingAccount}
              className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Sparkles className="w-5 h-5 ml-2" />
              {creatingAccount ? "جاري إنشاء الحساب..." : "إنشاء حساب تلقائياً"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              سيتم توليد اسم المستخدم وكلمة المرور تلقائياً
            </p>
          </div>
        )}

        {/* بيانات الحساب */}
        <div className="bg-muted/50 rounded-lg p-4 border mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">بيانات الحساب</h4>
            {hasAccount && accountInfo?.id && !showPasswordEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowPasswordEdit(true)}
              >
                تعديل كلمة المرور
              </Button>
            )}
          </div>

          {(hasAccount || accountInfo) ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1">اسم الدخول</span>
                  <span className="font-bold">{formData.اسم_الاستاذ}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1">البريد الإلكتروني</span>
                  <span className="font-bold">{accountInfo?.email || lastCredentials?.email || formData.البريد_الالكتروني || "غير متوفر"}</span>
                </div>
                {lastCredentials?.password && (
                  <div className="flex flex-col md:col-span-2 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                    <span className="text-green-600 text-xs mb-1">كلمة المرور (جديدة)</span>
                    <span className="font-bold text-green-700 dark:text-green-400">{lastCredentials.password}</span>
                  </div>
                )}
              </div>

              {/* دور المستخدم */}
              {hasAccount && accountInfo?.id && (
                <div className="border-t pt-3 mt-3">
                  <Label htmlFor="userRole" className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4" />
                    دور المستخدم في النظام
                  </Label>
                  <Select
                    value={userRole}
                    onValueChange={handleRoleChange}
                    disabled={updatingRole}
                  >
                    <SelectTrigger id="userRole">
                      <SelectValue placeholder="اختر الدور..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">أدمن (Admin)</SelectItem>
                      <SelectItem value="supervisor">مشرف (Supervisor)</SelectItem>
                      <SelectItem value="teacher">أستاذ (Teacher)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    يحدد الدور الصلاحيات المتاحة للمستخدم في النظام
                  </p>
                </div>
              )}

              {showPasswordEdit && accountInfo?.id && (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                  <Input
                    id="newPassword"
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (3 أحرف على الأقل)"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUpdatePassword}
                      disabled={updatingPassword || !newPassword || newPassword.length < 3}
                    >
                      {updatingPassword ? "جاري التحديث..." : "حفظ كلمة المرور"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordEdit(false);
                        setNewPassword("");
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا يوجد حساب بعد.</p>
          )}
        </div>

        <Separator />

        {/* معلومات الأستاذ الأساسية */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="md:col-span-2">
              <Label htmlFor="class">الصف المرغوب</Label>
              <Input
                id="class"
                value={formData.الصف_المرغوب}
                onChange={(e) => setFormData({ ...formData, الصف_المرغوب: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          {/* الأزرار */}
          <div className="flex gap-3 justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDelete?.();
              }}
            >
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>

            <div className="flex gap-3">
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
          </div>
        </form>
      </DialogContent>

      {/* نافذة تحذير الطلاب */}
      <StudentReassignmentDialog
        open={showStudentsDialog}
        onOpenChange={setShowStudentsDialog}
        students={teacherStudents}
        teacherName={teacher?.["اسم الاستاذ"] || ""}
        currentTeacherId={teacher?.id || ""}
        onReassignmentComplete={async () => {
          // إعادة تحميل البيانات بالكامل
          await queryClient.invalidateQueries({ queryKey: ['teachers'] });
          await queryClient.invalidateQueries({ queryKey: ['students'] });
          await queryClient.refetchQueries({ queryKey: ['students'] });

          setShowStudentsDialog(false);

          // إعادة فحص الطلاب بعد التحديث
          const remainingStudents = await checkTeacherStudents();
          if (remainingStudents.length === 0 && pendingRole) {
            // إذا لم يعد هناك طلاب، اعرض تأكيد تحديث الدور
            setShowRoleConfirmDialog(true);
          } else if (remainingStudents.length > 0) {
            toast.warning(`لا يزال هناك ${remainingStudents.length} طالب لم يتم نقلهم`);
          }

          onSuccess();
        }}
      />

      {/* نافذة تأكيد تغيير الدور */}
      <RoleChangeConfirmationDialog
        open={showRoleConfirmDialog}
        onOpenChange={setShowRoleConfirmDialog}
        teacherName={teacher?.["اسم الاستاذ"] || ""}
        onConfirm={() => executeRoleChange(pendingRole)}
        loading={updatingRole}
      />
    </Dialog>
  );
};

export default TeacherManagementDialog;