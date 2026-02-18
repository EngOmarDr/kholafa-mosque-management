import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ClipboardList, Search, Calendar, User, Database, Home } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface ActivityLog {
  id: string;
  activity_type: string;
  entity_type: string;
  entity_name: string;
  entity_id: string;
  description: string;
  old_data: any;
  new_data: any;
  changes: any;
  created_by: string;
  created_at: string;
  activity_date: string;
  creator_name?: string;
  creator_role?: string;
}

const ActivityLogsViewer = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [users, setUsers] = useState<{id: string, name: string, role: string}[]>([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/admin");
      return;
    }

    setUser(parsedUser);
    fetchLogs();
  }, [navigate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // جلب السجلات
      const { data: logsData, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (logsError) throw logsError;
      
      // جلب معلومات المستخدمين - تصفية القيم NULL بشكل صحيح
      const userIds = [...new Set(logsData?.map(log => log.created_by).filter(id => id !== null && id !== undefined))];
      
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, role")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else {
          profilesData = data || [];
        }
      }
      
      // جلب جميع student_ids و teacher_ids من البيانات
      const studentIds = new Set<string>();
      const teacherIds = new Set<string>();
      
      logsData?.forEach((log: any) => {
        if (log.new_data?.student_id) studentIds.add(log.new_data.student_id);
        if (log.old_data?.student_id) studentIds.add(log.old_data.student_id);
        if (log.new_data?.teacher_id) teacherIds.add(log.new_data.teacher_id);
        if (log.old_data?.teacher_id) teacherIds.add(log.old_data.teacher_id);
      });

      // جلب أسماء الطلاب
      let studentsMap = new Map<string, string>();
      if (studentIds.size > 0) {
        const { data: studentsData } = await supabase
          .from("students")
          .select("id, student_name")
          .in("id", Array.from(studentIds));
        
        studentsMap = new Map(studentsData?.map(s => [s.id, s.student_name]) || []);
      }

      // جلب أسماء الأساتذة من جدول teachers أولاً
      let teachersMap = new Map<string, string>();
      if (teacherIds.size > 0) {
        const { data: teachersData } = await supabase
          .from("teachers")
          .select('id, "اسم الاستاذ"')
          .in("id", Array.from(teacherIds));
        
        teachersMap = new Map(teachersData?.map((t: any) => [t.id, t["اسم الاستاذ"]]) || []);
        
        // للمعرفات التي لم نجدها في teachers، نبحث عنها في profiles
        const notFoundTeacherIds = Array.from(teacherIds).filter(id => !teachersMap.has(id));
        if (notFoundTeacherIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", notFoundTeacherIds);
          
          profilesData?.forEach((p: any) => {
            teachersMap.set(p.id, p.name);
          });
        }
      }
      
      // إنشاء map للمستخدمين
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      // تنسيق البيانات لتشمل اسم المستخدم والأسماء المستخرجة
      const formattedLogs = logsData?.map((log: any) => {
        // التعامل مع created_by الذي قد يكون NULL
        let creatorName = "النظام";
        let creatorRole = "system";
        
        if (log.created_by) {
          const profile = profilesMap.get(log.created_by);
          if (profile) {
            creatorName = profile.name;
            creatorRole = profile.role;
          } else {
            // في حالة عدم وجود profile للمستخدم
            creatorName = "مستخدم محذوف";
            creatorRole = "deleted";
          }
        }
        
        // إضافة أسماء الطلاب والأساتذة إذا لم تكن موجودة
        const newData = log.new_data ? { ...log.new_data } : null;
        const oldData = log.old_data ? { ...log.old_data } : null;
        
        // إضافة اسم الطالب إذا كان موجود student_id ولكن لا يوجد اسم
        if (newData?.student_id && !newData?.['اسم_الطالب']) {
          const studentName = studentsMap.get(newData.student_id);
          if (studentName) newData['اسم_الطالب'] = studentName;
        }
        if (oldData?.student_id && !oldData?.['اسم_الطالب']) {
          const studentName = studentsMap.get(oldData.student_id);
          if (studentName) oldData['اسم_الطالب'] = studentName;
        }
        
        // إضافة اسم الأستاذ إذا كان موجود teacher_id ولكن لا يوجد اسم
        if (newData?.teacher_id && !newData?.['اسم_الأستاذ']) {
          const teacherName = teachersMap.get(newData.teacher_id);
          if (teacherName) newData['اسم_الأستاذ'] = teacherName;
        }
        if (oldData?.teacher_id && !oldData?.['اسم_الأستاذ']) {
          const teacherName = teachersMap.get(oldData.teacher_id);
          if (teacherName) oldData['اسم_الأستاذ'] = teacherName;
        }
        
        return {
          ...log,
          new_data: newData,
          old_data: oldData,
          creator_name: creatorName,
          creator_role: creatorRole
        };
      }) || [];
      
      // حفظ قائمة المستخدمين للفلترة
      const uniqueUsers = Array.from(profilesMap.values());
      setUsers(uniqueUsers);
      
      setLogs(formattedLogs);
      setFilteredLogs(formattedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("حدث خطأ في جلب السجلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== "all") {
      // فلترة بناءً على نوع العملية من changes.operation
      filtered = filtered.filter((log) => log.changes?.operation === filterType);
    }

    if (filterEntity !== "all") {
      filtered = filtered.filter((log) => log.entity_type === filterEntity);
    }

    if (filterUser !== "all") {
      filtered = filtered.filter((log) => log.created_by === filterUser);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, filterType, filterEntity, filterUser, logs]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const getActivityBadge = (type: string, changes: any) => {
    // استخدام نوع العملية من changes.operation إذا كان موجوداً
    const operationType = changes?.operation || type;
    
    const variants: Record<string, { label: string; className: string }> = {
      create: { label: "إضافة", className: "bg-green-500" },
      update: { label: "تحديث", className: "bg-blue-500" },
      delete: { label: "حذف", className: "bg-red-500" },
    };
    const variant = variants[operationType] || { label: operationType, className: "bg-gray-500" };
    return (
      <Badge className={`${variant.className} text-white`}>
        {variant.label}
      </Badge>
    );
  };

  const getEntityBadge = (entity: string) => {
    const labels: Record<string, string> = {
      student: "طالب",
      students: "طلاب",
      teacher: "أستاذ",
      teachers: "أساتذة",
      attendance: "حضور",
      recitations: "تسميع",
      bonus_points: "نقاط إضافية",
      check_records: "تفقد الأدوات",
    };
    return (
      <Badge variant="outline">
        {labels[entity] || entity}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const labels: Record<string, { label: string; className: string }> = {
      admin: { label: "مدير", className: "bg-purple-500 text-white" },
      supervisor: { label: "مشرف", className: "bg-blue-500 text-white" },
      teacher: { label: "معلم", className: "bg-green-500 text-white" },
      system: { label: "النظام", className: "bg-slate-500 text-white" },
      deleted: { label: "محذوف", className: "bg-gray-400 text-white" },
    };
    const variant = labels[role] || { label: role, className: "bg-gray-500 text-white" };
    return (
      <Badge className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="سجل التغييرات" userName={user?.name}>
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              سجل التغييرات والأنشطة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجلات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع النشاط" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="create">إضافة</SelectItem>
                  <SelectItem value="update">تحديث</SelectItem>
                  <SelectItem value="delete">حذف</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="الجدول" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الجداول</SelectItem>
                  <SelectItem value="students">الطلاب</SelectItem>
                  <SelectItem value="teachers">الأساتذة</SelectItem>
                  <SelectItem value="attendance">الحضور</SelectItem>
                  <SelectItem value="recitations">التسميع</SelectItem>
                  <SelectItem value="bonus_points">النقاط الإضافية</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger>
                  <SelectValue placeholder="المستخدم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستخدمين</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role === 'admin' ? 'مدير' : user.role === 'teacher' ? 'معلم' : user.role === 'supervisor' ? 'مشرف' : user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>إجمالي السجلات: {filteredLogs.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {currentLogs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد سجلات</p>
                  </div>
                ) : (
                  currentLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActivityBadge(log.activity_type, log.changes)}
                          {getEntityBadge(log.entity_type)}
                          {log.creator_role && getRoleBadge(log.creator_role)}
                          {log.entity_name && (
                            <span className="text-sm font-medium">{log.entity_name}</span>
                          )}
                        </div>
                        <p className="text-sm text-foreground font-medium">{log.description}</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {log.activity_date ? format(new Date(log.activity_date), "dd/MM/yyyy", { locale: ar }) : format(new Date(log.created_at), "dd/MM/yyyy", { locale: ar })}
                              {" - "}
                              {format(new Date(log.created_at), "HH:mm", { locale: ar })}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>تم بواسطة: {log.creator_name}</span>
                            </div>
                          </div>
                          {/* عرض أسماء الطلاب والأساتذة */}
                          {(log.new_data?.['اسم_الطالب'] || log.old_data?.['اسم_الطالب'] || log.new_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأستاذ']) && (
                            <div className="flex items-center gap-4 text-xs">
                              {(log.new_data?.['اسم_الطالب'] || log.old_data?.['اسم_الطالب']) && (
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-primary">الطالب:</span>
                                  <span className="text-foreground">{log.new_data?.['اسم_الطالب'] || log.old_data?.['اسم_الطالب']}</span>
                                </div>
                              )}
                              {(log.new_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأستاذ']) && (
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-primary">الأستاذ:</span>
                                  <span className="text-foreground">{log.new_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأستاذ']}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                         {/* عرض التفاصيل الكاملة حسب نوع العملية */}
                        {((log.changes?.operation === 'create' && log.new_data) || (log.changes?.operation === 'delete' && log.old_data) || (log.changes?.operation === 'update' && (log.old_data || log.new_data))) && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-primary hover:underline">
                              عرض تفاصيل التغييرات
                            </summary>
                            <div className="mt-2 p-3 bg-muted rounded space-y-3">
                              {/* عرض نوع العملية */}
                              <div className="mb-3 pb-2 border-b border-border">
                                <span className="font-semibold text-primary">نوع العملية: </span>
                                <Badge variant={
                                  log.changes?.operation === 'create' ? 'default' : 
                                  log.changes?.operation === 'update' ? 'secondary' : 
                                  'destructive'
                                }>
                                  {log.changes?.operation === 'create' ? 'إضافة' : 
                                   log.changes?.operation === 'update' ? 'تعديل' : 
                                   'حذف'}
                                </Badge>
                              </div>
                              
                              {/* عرض البيانات المضافة (للإضافة) */}
                              {log.changes?.operation === 'create' && log.new_data && (
                                <div className="space-y-3">
                                  {/* عرض معلومات الطالب والأستاذ بشكل بارز */}
                                  {(log.new_data?.['اسم_الطالب'] || log.new_data?.['اسم_الأستاذ'] || log.new_data?.['اسم_الأداة']) && (
                                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border-2 border-green-200 dark:border-green-800 space-y-2">
                                      <div className="font-semibold text-green-700 dark:text-green-400 mb-2">معلومات السجل:</div>
                                      {log.new_data?.['اسم_الطالب'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الطالب:</span>
                                          <span className="text-muted-foreground font-semibold">{log.new_data['اسم_الطالب']}</span>
                                        </div>
                                      )}
                                      {log.new_data?.['اسم_الأستاذ'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الأستاذ:</span>
                                          <span className="text-muted-foreground font-semibold">{log.new_data['اسم_الأستاذ']}</span>
                                        </div>
                                      )}
                                      {log.new_data?.['اسم_الأداة'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الأداة:</span>
                                          <span className="text-muted-foreground font-semibold">{log.new_data['اسم_الأداة']}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="font-semibold text-green-600 mb-2">البيانات المضافة:</div>
                                  <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded space-y-2">
                                    {Object.entries(log.new_data)
                                      .filter(([key]) => !['id', 'created_at', 'updated_at', 'teacher_id', 'student_id', 'item_id', 'user_id'].includes(key))
                                      .map(([key, value]) => {
                                        const fieldNameMap: Record<string, string> = {
                                          'student_name': 'اسم الطالب',
                                          'اسم الاستاذ': 'اسم الأستاذ',
                                          'اسم_الطالب': 'اسم الطالب',
                                          'اسم_الأستاذ': 'اسم الأستاذ',
                                          'اسم_الأداة': 'اسم الأداة',
                                          'current_teacher': 'الأستاذ الحالي',
                                          'registration_status': 'حالة التسجيل',
                                          'grade': 'الصف',
                                          'phone': 'رقم الهاتف',
                                          'status': 'الحالة',
                                          'points': 'النقاط',
                                          'points_awarded': 'النقاط الممنوحة',
                                          'date': 'التاريخ',
                                          'rating': 'التقييم',
                                          'last_saved': 'آخر حفظ',
                                          'reason': 'السبب',
                                          'mosque_name': 'اسم المسجد',
                                          'father_name': 'اسم الأب',
                                          'address': 'العنوان',
                                          'social_status': 'الحالة الاجتماعية',
                                          'notes': 'ملاحظات',
                                        };
                                        const arabicKey = fieldNameMap[key] || key;
                                        const displayValue = value !== null && value !== undefined ? String(value) : 'غير محدد';
                                        
                                        return (
                                          <div key={key} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                                            <span className="font-medium text-foreground">{arabicKey}:</span>
                                            <span className="text-muted-foreground">{displayValue}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                              
                              {/* عرض البيانات المحذوفة (للحذف) */}
                              {log.changes?.operation === 'delete' && log.old_data && (
                                <div className="space-y-3">
                                  {/* عرض معلومات الطالب والأستاذ بشكل بارز */}
                                  {(log.old_data?.['اسم_الطالب'] || log.old_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأداة']) && (
                                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border-2 border-red-200 dark:border-red-800 space-y-2">
                                      <div className="font-semibold text-red-700 dark:text-red-400 mb-2">معلومات السجل المحذوف:</div>
                                      {log.old_data?.['اسم_الطالب'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الطالب:</span>
                                          <span className="text-muted-foreground font-semibold">{log.old_data['اسم_الطالب']}</span>
                                        </div>
                                      )}
                                      {log.old_data?.['اسم_الأستاذ'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الأستاذ:</span>
                                          <span className="text-muted-foreground font-semibold">{log.old_data['اسم_الأستاذ']}</span>
                                        </div>
                                      )}
                                      {log.old_data?.['اسم_الأداة'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="font-medium text-foreground">اسم الأداة:</span>
                                          <span className="text-muted-foreground font-semibold">{log.old_data['اسم_الأداة']}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="font-semibold text-red-600 mb-2">البيانات المحذوفة:</div>
                                  <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded space-y-2">
                                    {Object.entries(log.old_data)
                                      .filter(([key]) => !['id', 'created_at', 'updated_at', 'teacher_id', 'student_id', 'item_id', 'user_id'].includes(key))
                                      .map(([key, value]) => {
                                        const fieldNameMap: Record<string, string> = {
                                          'student_name': 'اسم الطالب',
                                          'اسم الاستاذ': 'اسم الأستاذ',
                                          'اسم_الطالب': 'اسم الطالب',
                                          'اسم_الأستاذ': 'اسم الأستاذ',
                                          'اسم_الأداة': 'اسم الأداة',
                                          'current_teacher': 'الأستاذ الحالي',
                                          'registration_status': 'حالة التسجيل',
                                          'grade': 'الصف',
                                          'phone': 'رقم الهاتف',
                                          'status': 'الحالة',
                                          'points': 'النقاط',
                                          'points_awarded': 'النقاط الممنوحة',
                                          'date': 'التاريخ',
                                          'rating': 'التقييم',
                                          'last_saved': 'آخر حفظ',
                                          'reason': 'السبب',
                                          'mosque_name': 'اسم المسجد',
                                          'father_name': 'اسم الأب',
                                          'address': 'العنوان',
                                          'social_status': 'الحالة الاجتماعية',
                                          'notes': 'ملاحظات',
                                        };
                                        const arabicKey = fieldNameMap[key] || key;
                                        const displayValue = value !== null && value !== undefined ? String(value) : 'غير محدد';
                                        
                                        return (
                                          <div key={key} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                                            <span className="font-medium text-foreground">{arabicKey}:</span>
                                            <span className="text-muted-foreground">{displayValue}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                              
                              {/* عرض التغييرات التفصيلية (للتعديل) */}
                              {log.changes?.operation === 'update' && (
                                <div className="space-y-3">
                                  {/* عرض معلومات الطالب والأستاذ */}
                                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded space-y-2">
                                    <div className="font-semibold text-blue-700 dark:text-blue-400 mb-2">معلومات السجل:</div>
                                    {(log.new_data?.['اسم_الطالب'] || log.old_data?.['اسم_الطالب']) && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium text-foreground">اسم الطالب:</span>
                                        <span className="text-muted-foreground">{log.new_data?.['اسم_الطالب'] || log.old_data?.['اسم_الطالب']}</span>
                                      </div>
                                    )}
                                    {(log.new_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأستاذ']) && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium text-foreground">اسم الأستاذ:</span>
                                        <span className="text-muted-foreground">{log.new_data?.['اسم_الأستاذ'] || log.old_data?.['اسم_الأستاذ']}</span>
                                      </div>
                                    )}
                                    {(log.new_data?.['اسم_الأداة'] || log.old_data?.['اسم_الأداة']) && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium text-foreground">اسم الأداة:</span>
                                        <span className="text-muted-foreground">{log.new_data?.['اسم_الأداة'] || log.old_data?.['اسم_الأداة']}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* عرض الحقول المعدلة */}
                                  {log.changes && Object.keys(log.changes).filter(k => k !== 'operation').length > 0 && (
                                    <>
                                      <div className="font-semibold text-blue-600 mb-2">الحقول المعدلة:</div>
                                      {Object.entries(log.changes)
                                    .filter(([key]) => key !== 'operation')
                                    .map(([key, value]: [string, any]) => {
                                      const fieldNameMap: Record<string, string> = {
                                        'current_teacher': 'الأستاذ الحالي',
                                        'registration_status': 'حالة التسجيل',
                                        'grade': 'الصف',
                                        'phone': 'رقم الهاتف',
                                        'student_name': 'اسم الطالب',
                                        'teacher_id': 'معرف الأستاذ',
                                        'status': 'الحالة',
                                        'points': 'النقاط',
                                        'points_awarded': 'النقاط الممنوحة',
                                        'date': 'التاريخ',
                                        'rating': 'التقييم',
                                        'last_saved': 'آخر حفظ',
                                        'reason': 'السبب',
                                        'mosque_name': 'اسم المسجد',
                                        'father_name': 'اسم الأب',
                                        'address': 'العنوان',
                                        'social_status': 'الحالة الاجتماعية',
                                        'notes': 'ملاحظات',
                                      };
                                      
                                      const arabicKey = fieldNameMap[key] || key;
                                      const oldValue = value?.old !== undefined && value?.old !== null ? String(value.old) : 'غير محدد';
                                      const newValue = value?.new !== undefined && value?.new !== null ? String(value.new) : 'غير محدد';
                                      
                                      return (
                                        <div key={key} className="border-b border-border/50 pb-2 last:border-0">
                                          <div className="font-semibold mb-1 text-foreground">{arabicKey}</div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col">
                                              <span className="text-red-600 font-medium mb-1 text-xs">القديم:</span>
                                              <span className="text-muted-foreground bg-red-50 dark:bg-red-950/20 p-2 rounded text-xs">
                                                {oldValue}
                                              </span>
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-green-600 font-medium mb-1 text-xs">الجديد:</span>
                                              <span className="text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded text-xs">
                                                {newValue}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    </>
                                  )}
                                </div>
                              )}
                              
                              {/* رسالة عدم وجود تفاصيل */}
                              {log.changes?.operation === 'update' && (!log.changes || Object.keys(log.changes).filter(k => k !== 'operation').length === 0) && (
                                <div className="text-muted-foreground text-center py-2">
                                  لا توجد تفاصيل إضافية للتغييرات
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                      <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNumber)}
                            isActive={currentPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ActivityLogsViewer;
