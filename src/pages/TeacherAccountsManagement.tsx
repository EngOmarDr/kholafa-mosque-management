import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Settings, UserPlus, Home, Eye, EyeOff, Key, Mail, User, MessageCircle, Copy, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { generateAccountCredentials } from "@/lib/accountGenerator";

interface TeacherWithAccount {
  id: string;
  "اسم الاستاذ": string;
  "رقم الهاتف": string | null;
  البريد_الالكتروني: string | null;
  user_id: string | null;
  profile: {
    id: string;
    email: string | null;
    name: string;
    active: boolean;
  } | null;
}

const TeacherAccountsManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<TeacherWithAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithAccount | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({ email: "", password: "", confirmPassword: "" });
  const [createFormData, setCreateFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState({ email: "", password: "", phone: "" });

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "admin") {
      toast.error("غير مصرح لك بالوصول لهذه الصفحة");
      navigate("/");
      return;
    }

    setUser(parsedUser);
    fetchTeachers();
  }, [navigate]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data: teachersData, error } = await supabase
        .from("teachers")
        .select("*")
        .order("اسم الاستاذ", { ascending: true });

      if (error) throw error;

      // Fetch profiles separately for teachers with user_id
      const teachersWithProfiles = await Promise.all(
        (teachersData || []).map(async (teacher: any) => {
          if (teacher.user_id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, email, name, active")
              .eq("id", teacher.user_id)
              .single();

            return {
              id: teacher.id,
              "اسم الاستاذ": teacher["اسم الاستاذ"],
              "رقم الهاتف": teacher["رقم الهاتف"],
              البريد_الالكتروني: teacher.البريد_الالكتروني,
              user_id: teacher.user_id,
              profile: profileData
            } as TeacherWithAccount;
          }
          return {
            id: teacher.id,
            "اسم الاستاذ": teacher["اسم الاستاذ"],
            "رقم الهاتف": teacher["رقم الهاتف"],
            البريد_الالكتروني: teacher.البريد_الالكتروني,
            user_id: teacher.user_id,
            profile: null
          } as TeacherWithAccount;
        })
      );

      setTeachers(teachersWithProfiles);
    } catch (error: any) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في جلب بيانات الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!selectedTeacher) return;

    setIsSubmitting(true);
    try {
      const credentials = generateAccountCredentials(selectedTeacher["اسم الاستاذ"]);
      const email = createFormData.email || `${credentials.username}.${selectedTeacher.id.substring(0, 8)}@jeelsalahi.com`;
      const password = createFormData.password || credentials.password;

      if (!password || password.length < 6) {
        toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        setIsSubmitting(false);
        return;
      }

      console.log("Creating account:", { email, name: selectedTeacher["اسم الاستاذ"] });

      // Call edge function to create account
      const { data, error } = await supabase.functions.invoke("bulk-create-teachers", {
        body: {
          teachers: [{
            teacher_id: selectedTeacher.id,
            email: email,
            password: password,
            name: selectedTeacher["اسم الاستاذ"],
            phone: selectedTeacher["رقم الهاتف"]
          }]
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      const response = data as { created: number; failed: number; errors: any[] };

      if (response.failed > 0 && response.errors.length > 0) {
        const errorMsg = response.errors[0].details || response.errors[0].error;
        toast.error(`فشل إنشاء الحساب: ${errorMsg}`);
        setIsSubmitting(false);
        return;
      }

      toast.success("تم إنشاء الحساب بنجاح");
      setAccountCreated(true);
      setCreatedCredentials({
        email: email,
        password: password,
        phone: selectedTeacher["رقم الهاتف"] || ""
      });

      // إعادة تحميل البيانات
      await fetchTeachers();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast.error(error.message || "حدث خطأ في إنشاء الحساب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedTeacher?.user_id) return;

    if (editFormData.password && editFormData.password !== editFormData.confirmPassword) {
      toast.error("كلمة المرور غير متطابقة");
      return;
    }

    setIsSubmitting(true);
    try {
      // Update password if provided
      if (editFormData.password) {
        if (editFormData.password.length < 8) {
          toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
          return;
        }

        const { error: passwordError } = await supabase.functions.invoke("update-user-password", {
          body: {
            user_id: selectedTeacher.user_id,
            new_password: editFormData.password
          }
        });

        if (passwordError) throw passwordError;
      }

      toast.success("تم تحديث الحساب بنجاح");
      setShowEditDialog(false);
      setEditFormData({ email: "", password: "", confirmPassword: "" });
      fetchTeachers();
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast.error(error.message || "حدث خطأ في تحديث الحساب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoGenerateCredentials = () => {
    if (!selectedTeacher) return;
    const credentials = generateAccountCredentials(selectedTeacher["اسم الاستاذ"]);
    setCreateFormData({
      email: `${credentials.username}@jeelsalahi.com`,
      password: credentials.password
    });
    toast.success("تم توليد بيانات الحساب تلقائياً");
  };

  const handleSendWhatsApp = () => {
    if (!createdCredentials.phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }

    const phone = createdCredentials.phone.replace(/[^0-9]/g, '');
    const message = `السلام عليكم ورحمة الله وبركاته

تم إنشاء حساب خاص بك في نظام جيل صلاحي

📧 البريد الإلكتروني: ${createdCredentials.email}
🔑 كلمة المرور: ${createdCredentials.password}

يمكنك الآن تسجيل الدخول إلى النظام باستخدام هذه البيانات.

بارك الله فيك`;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyCredentials = () => {
    const credentials = `البريد الإلكتروني: ${createdCredentials.email}\nكلمة المرور: ${createdCredentials.password}`;
    navigator.clipboard.writeText(credentials);
    toast.success("تم نسخ بيانات الحساب");
  };

  const handleBulkAutoCreate = async () => {
    // الحصول على الأساتذة الذين ليس لديهم حسابات
    const teachersWithoutAccounts = teachers.filter(t => !t.user_id);

    if (teachersWithoutAccounts.length === 0) {
      toast.error("جميع الأساتذة لديهم حسابات بالفعل");
      return;
    }

    const toastId = toast.loading(`جاري إنشاء ${teachersWithoutAccounts.length} حساب...`);

    try {
      // إنشاء بيانات الحسابات مع كلمات مرور تلقائية وإيميلات فريدة
      const teachersData = teachersWithoutAccounts.map(teacher => {
        const credentials = generateAccountCredentials(teacher["اسم الاستاذ"]);
        // استخدام ID الأستاذ لجعل البريد فريداً
        const uniqueEmail = teacher.البريد_الالكتروني || `${credentials.username}.${teacher.id.substring(0, 8)}@jeelsalahi.com`;

        return {
          teacher_id: teacher.id,
          email: uniqueEmail,
          password: credentials.password,
          name: teacher["اسم الاستاذ"],
          phone: teacher["رقم الهاتف"]
        };
      });

      console.log("Creating accounts:", teachersData.map(t => ({ name: t.name, email: t.email })));

      // استدعاء edge function
      const { data, error } = await supabase.functions.invoke("bulk-create-teachers", {
        body: {
          teachers: teachersData
        }
      });

      if (error) throw error;

      const response = data as { created: number; failed: number; errors: any[] };

      if (response.failed > 0) {
        toast.warning(`تم إنشاء ${response.created} حساب | فشل: ${response.failed}`, {
          id: toastId,
          duration: 5000
        });
        console.log("Failed accounts:", response.errors);
      } else {
        toast.success(`تم إنشاء ${response.created} حساب بنجاح ✅`, { id: toastId });
      }

      // إعادة تحميل البيانات
      await fetchTeachers();
    } catch (error: any) {
      console.error("Error bulk creating accounts:", error);
      toast.error(error.message || "حدث خطأ أثناء إنشاء الحسابات", { id: toastId });
    }
  };

  const handleSendExistingAccountWhatsApp = (teacher: TeacherWithAccount) => {
    const message = `السلام عليكم ورحمة الله وبركاته

تذكير ببيانات حساب الأستاذ ${teacher["اسم الاستاذ"]} في نظام جيل صلاحي

📧 البريد الإلكتروني: ${teacher.profile?.email || 'غير محدد'}

للدخول إلى النظام يمكن استخدام هذا البريد الإلكتروني.
إذا نسيت كلمة المرور، يمكن التواصل مع الإدارة لإعادة تعيينها.

بارك الله فيك`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setCreateFormData({ email: "", password: "" });
    setAccountCreated(false);
    setCreatedCredentials({ email: "", password: "", phone: "" });
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher["اسم الاستاذ"].toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout
        title="جيل صلاحي"
        userName={user?.name}
        role={user?.role}
      >
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="جيل صلاحي"
      userName={user?.name}
      role={user?.role}
    >
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={user?.role === 'admin' ? '/admin' : '/teacher'}>
                  <Home className="h-4 w-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/teachers">إدارة الأساتذة</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>عرض الحسابات</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة حسابات الأساتذة</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              عرض وتعديل حسابات الأساتذة في النظام
            </p>
          </div>
          <Button
            onClick={handleBulkAutoCreate}
            size="lg"
            className="gap-2 w-full sm:w-auto"
            disabled={teachers.filter(t => !t.user_id).length === 0}
          >
            <Sparkles className="h-5 w-5" />
            إنشاء تلقائي للكل ({teachers.filter(t => !t.user_id).length})
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredTeachers.map((teacher) => (
            <Card key={teacher.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{teacher["اسم الاستاذ"]}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {teacher["رقم الهاتف"]}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {teacher.user_id && teacher.profile ? (
                      <Badge variant="default" className="gap-1">
                        <Eye className="h-3 w-3" />
                        لديه حساب
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <EyeOff className="h-3 w-3" />
                        لا يوجد حساب
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teacher.user_id && teacher.profile ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground min-w-[120px]">
                          <Mail className="h-4 w-4" />
                          <span>البريد الإلكتروني:</span>
                        </div>
                        <span className="font-medium break-all text-primary">
                          {teacher.البريد_الالكتروني || teacher.profile.email || "غير محدد"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground min-w-[120px]">
                          <Key className="h-4 w-4" />
                          <span>كلمة المرور:</span>
                        </div>
                        <span className="font-medium text-muted-foreground italic">محفوظة بشكل آمن (مشفرة)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <span className="text-muted-foreground min-w-[120px]">حالة الحساب:</span>
                        <Badge variant={teacher.profile.active ? "default" : "destructive"} className="w-fit">
                          {teacher.profile.active ? "نشط" : "معطل"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setEditFormData({
                              email: teacher.profile?.email || "",
                              password: "",
                              confirmPassword: ""
                            });
                            setShowEditDialog(true);
                          }}
                          size="sm"
                          variant="outline"
                          className="gap-2 flex-1 sm:flex-none"
                        >
                          <Settings className="h-4 w-4" />
                          تعديل الحساب
                        </Button>
                        <Button
                          onClick={() => handleSendExistingAccountWhatsApp(teacher)}
                          size="sm"
                          variant="outline"
                          className="gap-2 text-green-600 hover:text-green-700 border-green-600 hover:border-green-700 flex-1 sm:flex-none"
                        >
                          <MessageCircle className="h-4 w-4" />
                          إرسال البيانات
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {teacher.البريد_الالكتروني ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground min-w-[120px]">
                            <Mail className="h-4 w-4" />
                            <span>البريد الإلكتروني:</span>
                          </div>
                          <span className="font-medium break-all">{teacher.البريد_الالكتروني}</span>
                        </div>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        لا يوجد حساب مرتبط بهذا الأستاذ
                      </p>
                      <Button
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setCreateFormData({
                            email: teacher.البريد_الالكتروني || "",
                            password: ""
                          });
                          setAccountCreated(false);
                          setShowCreateDialog(true);
                        }}
                        size="sm"
                        className="gap-2 w-fit"
                      >
                        <UserPlus className="h-4 w-4" />
                        إنشاء حساب
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredTeachers.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">لا توجد نتائج للبحث</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Account Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseCreateDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء حساب جديد</DialogTitle>
            <DialogDescription>
              إنشاء حساب جديد للأستاذ {selectedTeacher?.["اسم الاستاذ"]}
            </DialogDescription>
          </DialogHeader>

          {!accountCreated ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-email">البريد الإلكتروني</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    placeholder="example@jeelsalahi.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="create-password"
                      type={showPassword ? "text" : "password"}
                      value={createFormData.password}
                      onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                      placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute left-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleAutoGenerateCredentials}
                  className="w-full gap-2"
                >
                  <Key className="h-4 w-4" />
                  توليد بيانات تلقائياً
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreateDialog}>
                  إلغاء
                </Button>
                <Button onClick={handleCreateAccount} disabled={isSubmitting}>
                  {isSubmitting ? "جاري الإنشاء..." : "إنشاء الحساب"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    تم إنشاء الحساب بنجاح
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-muted-foreground">البريد الإلكتروني:</span>
                      <span className="font-medium">{createdCredentials.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-muted-foreground">كلمة المرور:</span>
                      <span className="font-medium">{createdCredentials.password}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  يمكنك الآن إرسال بيانات الحساب للأستاذ عبر واتساب
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseCreateDialog}>
                  إغلاق
                </Button>
                <Button
                  onClick={handleCopyCredentials}
                  variant="outline"
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  نسخ البيانات
                </Button>
                {createdCredentials.phone && (
                  <Button
                    onClick={handleSendWhatsApp}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    إرسال عبر واتساب
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل حساب الأستاذ</DialogTitle>
            <DialogDescription>
              تعديل بيانات حساب الأستاذ {selectedTeacher?.["اسم الاستاذ"]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">البريد الإلكتروني</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="example@jeelsalahi.com"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">كلمة المرور الجديدة (اختياري)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showPassword ? "text" : "password"}
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute left-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {editFormData.password && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={editFormData.confirmPassword}
                  onChange={(e) => setEditFormData({ ...editFormData, confirmPassword: e.target.value })}
                  placeholder="أعد إدخال كلمة المرور"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleUpdateAccount} disabled={isSubmitting}>
              {isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherAccountsManagement;
