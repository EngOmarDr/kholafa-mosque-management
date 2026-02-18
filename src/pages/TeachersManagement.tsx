import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Mail, Phone, Edit, Trash2, Users, MessageCircle, Link as LinkIcon, UserPlus, LayoutGrid, List, ChevronDown, ChevronUp, Eye, Filter, Settings, EyeOff, MoreVertical, FileText, Home, Trash, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { logTeacherDeleted } from "@/lib/activityLogger";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddTeacherDialog from "@/components/AddTeacherDialog";
import TeacherManagementDialog from "@/components/TeacherManagementDialog";
import TeacherDetailsDialog from "@/components/TeacherDetailsDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import BulkTransferStudentsDialog from "@/components/BulkTransferStudentsDialog";
import StudentRecordDialog from "@/components/StudentRecordDialog";

const TeachersManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [teacherStudents, setTeacherStudents] = useState<Record<string, any[]>>({});
  const [mosqueFilter, setMosqueFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [mosques, setMosques] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [studentFilter, setStudentFilter] = useState<"all" | "with-students" | "without-students">("with-students");
  const [sortBy, setSortBy] = useState<"name" | "grade" | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [teacherRoles, setTeacherRoles] = useState<Record<string, string>>({});
  const [teacherEmails, setTeacherEmails] = useState<Record<string, string>>({});
  const [showBulkTransferDialog, setShowBulkTransferDialog] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedStudentForRecord, setSelectedStudentForRecord] = useState<any>(null);
  const [editStudentDialogOpen, setEditStudentDialogOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    const role = parsedUser.role;

    if (role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/admin");
      return;
    }

    setUser(parsedUser);
    fetchTeachers();
    fetchFilters();
  }, [navigate]);

  const fetchFilters = async () => {
    try {
      // المساجد المحددة فقط
      const validMosques = ["الخلفاء الراشدين"];

      // جلب الطلاب لمعرفة أي مساجد لديها طلاب
      const { data: studentsData } = await supabase
        .from("students")
        .select("mosque_name, grade");

      // فلترة المساجد التي لديها طلاب فقط من القائمة المحددة
      const mosquesWithStudents = validMosques.filter(mosque =>
        studentsData?.some(s => s.mosque_name === mosque)
      );

      // ترتيب المساجد حسب عدد الطلاب
      const mosqueCounts = mosquesWithStudents.map(mosque => ({
        name: mosque,
        count: studentsData?.filter(s => s.mosque_name === mosque).length || 0
      })).sort((a, b) => b.count - a.count);

      setMosques(mosqueCounts.map(m => m.name));

      // جلب الصفوف وترتيبها
      const uniqueGrades = [...new Set(studentsData?.map(s => s.grade).filter(Boolean))] as string[];
      setGrades(uniqueGrades.sort());
    } catch (error) {
      console.error("Error fetching filters:", error);
    }
  };

  const fetchTeachers = async () => {
    try {
      // جلب جميع الأساتذة
      const { data: teachersData, error: teachersError } = await supabase
        .from("teachers")
        .select(`*`)
        .order("created_at", { ascending: false });

      if (teachersError) throw teachersError;

      // جلب جميع الطلاب مرة واحدة
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*");

      if (studentsError) throw studentsError;

      // جلب أدوار وإيميلات الأساتذة من user_roles و profiles
      const teacherUserIds = teachersData?.map(t => t.user_id).filter(Boolean) || [];
      const rolesMap: Record<string, string> = {};
      const emailsMap: Record<string, string> = {};

      if (teacherUserIds.length > 0) {
        // جلب الأدوار
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", teacherUserIds);

        if (rolesError) {
          console.error("Error fetching user_roles:", rolesError);
        }

        // جلب الإيميلات من profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", teacherUserIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        }

        profilesData?.forEach(p => {
          if (p.email) emailsMap[p.id] = p.email;
        });

        // تطبيق منطق الأولوية: أدمن > مشرف > أستاذ
        const rolePriority: Record<string, number> = {
          'admin': 1,
          'supervisor': 2,
          'teacher': 3,
          'user': 4,
          'guest': 5
        };

        rolesData?.forEach(row => {
          const currentBestRole = rolesMap[row.user_id];
          if (!currentBestRole || rolePriority[row.role] < rolePriority[currentBestRole]) {
            rolesMap[row.user_id] = row.role;
          }
        });
      }

      setTeacherRoles(rolesMap);
      setTeacherEmails(emailsMap);

      // تجميع الطلاب حسب المعرف الصحيح للأستاذ (teacher_id يشير إلى teachers.id)
      const studentsGrouped: Record<string, any[]> = {};

      teachersData?.forEach(teacher => {
        const teacherStudentsList = (studentsData || []).filter(
          (student) => student.teacher_id === teacher.id || student.current_teacher === teacher["اسم الاستاذ"]
        );
        studentsGrouped[teacher.id] = teacherStudentsList;
      });

      setTeacherStudents(studentsGrouped);
      setTeachers(teachersData || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const getMostCommonGrade = (students: any[]) => {
    if (!students || students.length === 0) return "لا يوجد";

    const gradeCounts: Record<string, number> = {};
    students.forEach(student => {
      const grade = student.grade || "غير محدد";
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });

    const mostCommon = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0];
    return mostCommon ? mostCommon[0] : "غير محدد";
  };

  const handleDelete = async () => {
    if (!selectedTeacher) return;

    try {
      const { error } = await supabase
        .from("teachers")
        .delete()
        .eq("id", selectedTeacher.id);

      if (error) throw error;

      // تسجيل النشاط
      await logTeacherDeleted(selectedTeacher);

      toast.success("تم حذف الأستاذ بنجاح ✅");
      fetchTeachers();
      setShowDeleteDialog(false);
      setSelectedTeacher(null);
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const toggleTeacherExpand = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch =
      teacher["اسم الاستاذ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher["رقم الهاتف"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.البريد_الالكتروني?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMosque = mosqueFilter === "all" || teacher["المسجد"] === mosqueFilter;

    const students = teacherStudents[teacher.id] || [];
    const mostCommonGrade = getMostCommonGrade(students);
    const matchesGrade = gradeFilter === "all" || mostCommonGrade === gradeFilter;

    const hasStudents = students.length > 0;
    const matchesStudentFilter =
      studentFilter === "all" ? true :
        studentFilter === "with-students" ? hasStudents :
          !hasStudents; // without-students

    return matchesSearch && matchesMosque && matchesGrade && matchesStudentFilter;
  }).sort((a, b) => {
    let compareValue = 0;

    if (sortBy === "name") {
      compareValue = (a["اسم الاستاذ"] || "").localeCompare(b["اسم الاستاذ"] || "", "ar");
    } else if (sortBy === "grade") {
      const gradeA = getMostCommonGrade(teacherStudents[a.id] || []);
      const gradeB = getMostCommonGrade(teacherStudents[b.id] || []);
      compareValue = gradeA.localeCompare(gradeB, "ar");
    } else if (sortBy === "status") {
      const statusA = a.حالة_الطلب || "";
      const statusB = b.حالة_الطلب || "";
      compareValue = statusA.localeCompare(statusB, "ar");
    }

    return sortOrder === "asc" ? compareValue : -compareValue;
  });

  const copyFormLink = () => {
    const formUrl = `${window.location.origin}/teacher-application`;
    navigator.clipboard.writeText(formUrl);
    toast.success("تم نسخ رابط الفورم ✅");
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  const handleCall = (phone: string) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  const handleSelectAll = () => {
    if (selectedTeachers.size === filteredTeachers.length) {
      setSelectedTeachers(new Set());
    } else {
      setSelectedTeachers(new Set(filteredTeachers.map(t => t.id)));
    }
  };

  const handleSelectTeacher = (teacherId: string) => {
    const newSelected = new Set(selectedTeachers);
    if (newSelected.has(teacherId)) {
      newSelected.delete(teacherId);
    } else {
      newSelected.add(teacherId);
    }
    setSelectedTeachers(newSelected);
  };

  const handleBulkDelete = async () => {
    const teacherIds = Array.from(selectedTeachers);
    const loadingToast = toast.loading(`جاري حذف ${teacherIds.length} أستاذ...`);

    try {
      const { error } = await supabase
        .from("teachers")
        .delete()
        .in("id", teacherIds);

      if (error) throw error;

      // تسجيل النشاط لكل أستاذ تم حذفه
      const deletedTeachers = teachers.filter(t => teacherIds.includes(t.id));
      for (const teacher of deletedTeachers) {
        await logTeacherDeleted(teacher);
      }

      toast.success(`تم حذف ${teacherIds.length} أستاذ بنجاح ✅`, { id: loadingToast });
      fetchTeachers();
      setSelectedTeachers(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      console.error("Error bulk deleting teachers:", error);
      toast.error("حدث خطأ أثناء الحذف الجماعي", { id: loadingToast });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="إدارة الأساتذة" userName={user?.name}>
        <div className="space-y-6 animate-fade-in">
          <Skeleton className="h-8 w-64" />
          <div className="stats-card space-y-4">
            <Skeleton className="h-12" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="stats-card">
                <Skeleton className="h-48" />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="إدارة الأساتذة" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">
                <Home className="w-4 h-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>إدارة الأساتذة</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">إدارة الأساتذة</h2>
            <p className="text-muted-foreground mt-1">
              عرض وإدارة جميع الأساتذة في النظام
              {selectedTeachers.size > 0 && (
                <span className="text-primary font-semibold mr-2">
                  • تم تحديد {selectedTeachers.size} أستاذ
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedTeachers.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash className="w-4 h-4 ml-2" />
                حذف المحدد ({selectedTeachers.size})
              </Button>
            )}

            <div className="flex gap-1 border border-border rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 ml-2" />
                  {studentFilter === "all" ? "جميع الأساتذة" :
                    studentFilter === "with-students" ? "مع طلاب" :
                      "بدون طلاب"}
                  <ChevronDown className="w-4 h-4 mr-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setStudentFilter("all")}>
                  <Users className="w-4 h-4 ml-2" />
                  جميع الأساتذة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStudentFilter("with-students")}>
                  <Users className="w-4 h-4 ml-2" />
                  الأساتذة مع طلاب
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStudentFilter("without-students")}>
                  <Users className="w-4 h-4 ml-2" />
                  الأساتذة بدون طلاب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical className="w-5 h-5 ml-2" />
                  خيارات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/admin/teachers/accounts')}>
                  <Users className="w-4 h-4 ml-2" />
                  عرض الحسابات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/teacher-applications')}>
                  <Users className="w-4 h-4 ml-2" />
                  طلبات التسجيل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyFormLink}>
                  <LinkIcon className="w-4 h-4 ml-2" />
                  نسخ رابط الفورم
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/teachers/bulk-add')}>
                  <UserPlus className="w-4 h-4 ml-2" />
                  إضافة بالجملة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أستاذ جديد
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="stats-card space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pr-10"
            />
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">الفلترة:</span>
            </div>

            <Select value={mosqueFilter} onValueChange={setMosqueFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="حسب المسجد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المساجد</SelectItem>
                {mosques.map((mosque) => (
                  <SelectItem key={mosque} value={mosque}>
                    {mosque}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="حسب الصف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الصفوف</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">الفرز:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">حسب الاسم</SelectItem>
                  <SelectItem value="grade">حسب الصف</SelectItem>
                  <SelectItem value="status">حسب الحالة</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? "تصاعدي ↑" : "تنازلي ↓"}
              </Button>
            </div>

            {(mosqueFilter !== "all" || gradeFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMosqueFilter("all");
                  setGradeFilter("all");
                }}
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </div>

        {/* Teachers Display */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeachers.map((teacher) => {
              const students = teacherStudents[teacher.id] || [];
              const mostCommonGrade = getMostCommonGrade(students);
              const isExpanded = expandedTeachers.has(teacher.id);
              const isSelected = selectedTeachers.has(teacher.id);

              return (
                <div key={teacher.id} className={`stats-card hover:border-primary transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleTeacherExpand(teacher.id)}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSelectTeacher(teacher.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <CollapsibleTrigger className="w-full text-right hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-xl">{teacher["اسم الاستاذ"]}</h3>
                              <span className="text-xs badge-secondary">{mostCommonGrade}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>

                          {(teacher.البريد_الالكتروني || (teacher.user_id && teacherEmails[teacher.user_id])) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Mail className="w-4 h-4" />
                              <span className="font-mono text-xs">
                                {teacher.user_id && teacherEmails[teacher.user_id]
                                  ? teacherEmails[teacher.user_id]
                                  : teacher.البريد_الالكتروني}
                              </span>
                            </div>
                          )}

                          {teacher["رقم الهاتف"] && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-4 h-4" />
                              <span className="font-mono text-xs">{teacher["رقم الهاتف"]}</span>
                            </div>
                          )}

                          {teacher.user_id && teacherRoles[teacher.user_id] && (
                            <div className="mt-2">
                              <span className="badge-info text-xs">
                                {(() => {
                                  const role = teacherRoles[teacher.user_id];
                                  if (role === 'admin') return 'ادمن';
                                  if (role === 'supervisor') return 'مشرف';
                                  if (role === 'teacher') return 'أستاذ';
                                  return role;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <CollapsibleContent className="mb-4 animate-accordion-down">
                      <div className="p-3 bg-accent/50 rounded-lg space-y-2">
                        <h4 className="font-semibold text-sm mb-2">طلاب الأستاذ ({students.length}):</h4>
                        {students.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {students.map((student, idx) => (
                              <div key={`${student.id}-${idx}`} className="text-xs p-3 bg-background rounded-lg border border-border hover:border-primary transition-all">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-sm flex-1">{student.student_name}</span>
                                  <span className="badge-secondary text-xs whitespace-nowrap">{student.grade || "غير محدد"}</span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 px-2">
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedStudentForEdit(student);
                                        setEditStudentDialogOpen(true);
                                      }}>
                                        <Edit className="w-4 h-4 ml-2" />
                                        تعديل
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedStudentForRecord(student);
                                        setRecordDialogOpen(true);
                                      }}>
                                        <FileText className="w-4 h-4 ml-2" />
                                        سجل الطالب
                                      </DropdownMenuItem>
                                      {student.phone && (
                                        <>
                                          <DropdownMenuItem onClick={() => handleCall(student.phone)}>
                                            <Phone className="w-4 h-4 ml-2" />
                                            اتصال
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="text-green-600">
                                            <MessageCircle className="w-4 h-4 ml-2" />
                                            واتساب
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">لا يوجد طلاب</p>
                        )}
                      </div>
                    </CollapsibleContent>

                    <div className="flex items-center gap-2 mb-4 p-3 bg-accent rounded-lg">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">عدد الطلاب</p>
                        <p className="text-lg font-bold text-primary">{students.length}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {teacher["رقم الهاتف"] && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCall(teacher["رقم الهاتف"])}
                            className="flex-1"
                          >
                            <Phone className="w-4 h-4 ml-2" />
                            اتصال
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsApp(teacher["رقم الهاتف"])}
                            className="flex-1 text-green-600 hover:text-green-700"
                          >
                            <MessageCircle className="w-4 h-4 ml-2" />
                            واتساب
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            <MoreVertical className="w-4 h-4 ml-2" />
                            خيارات
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 ml-2" />
                            عرض التفاصيل
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCall(teacher["رقم الهاتف"])}>
                            <Phone className="w-4 h-4 ml-2" />
                            اتصال
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleWhatsApp(teacher["رقم الهاتف"])}>
                            <MessageCircle className="w-4 h-4 ml-2" />
                            واتساب
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowManagementDialog(true);
                            }}
                          >
                            <Settings className="w-4 h-4 ml-2" />
                            إدارة الحساب
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowBulkTransferDialog(true);
                            }}
                          >
                            <ArrowRightLeft className="w-4 h-4 ml-2" />
                            نقل الطلاب الجماعي
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowDeleteDialog(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stats-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center p-3 w-12">
                      <Checkbox
                        checked={selectedTeachers.size === filteredTeachers.length && filteredTeachers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="text-right p-3 font-semibold">الاسم</th>
                    <th className="text-right p-3 font-semibold">الصف الأكثر</th>
                    <th className="text-right p-3 font-semibold">عدد الطلاب</th>
                    <th className="text-right p-3 font-semibold">الهاتف</th>
                    <th className="text-right p-3 font-semibold">البريد</th>
                    <th className="text-right p-3 font-semibold">الوظيفة</th>
                    <th className="text-center p-3 font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => {
                    const students = teacherStudents[teacher.id] || [];
                    const mostCommonGrade = getMostCommonGrade(students);
                    const isExpanded = expandedTeachers.has(teacher.id);
                    const isSelected = selectedTeachers.has(teacher.id);

                    return (
                      <>
                        <tr key={teacher.id} className={`border-b border-border hover:bg-accent/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectTeacher(teacher.id)}
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => toggleTeacherExpand(teacher.id)}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              <span className="font-semibold">{teacher["اسم الاستاذ"]}</span>
                            </button>
                          </td>
                          <td className="p-3">
                            <span className="badge-secondary text-xs">{mostCommonGrade}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-primary">{students.length}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm font-mono">{teacher["رقم الهاتف"] || "-"}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm font-mono" dir="ltr">
                              {teacher.user_id && teacherEmails[teacher.user_id]
                                ? teacherEmails[teacher.user_id]
                                : (teacher.البريد_الالكتروني || "-")}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="badge-info text-xs">
                              {(() => {
                                if (!teacher.user_id || !teacherRoles[teacher.user_id]) return '-';
                                const role = teacherRoles[teacher.user_id];
                                if (role === 'admin') return 'ادمن';
                                if (role === 'supervisor') return 'مشرف';
                                if (role === 'teacher') return 'أستاذ';
                                return role;
                              })()}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <MoreVertical className="w-4 h-4 ml-2" />
                                    خيارات
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTeacher(teacher);
                                      setShowDetailsDialog(true);
                                    }}
                                  >
                                    <Eye className="w-4 h-4 ml-2" />
                                    عرض التفاصيل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCall(teacher["رقم الهاتف"])}>
                                    <Phone className="w-4 h-4 ml-2" />
                                    اتصال
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleWhatsApp(teacher["رقم الهاتف"])}>
                                    <MessageCircle className="w-4 h-4 ml-2" />
                                    واتساب
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTeacher(teacher);
                                      setShowManagementDialog(true);
                                    }}
                                  >
                                    <Settings className="w-4 h-4 ml-2" />
                                    إدارة الحساب
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTeacher(teacher);
                                      setShowBulkTransferDialog(true);
                                    }}
                                  >
                                    <ArrowRightLeft className="w-4 h-4 ml-2" />
                                    نقل الطلاب الجماعي
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTeacher(teacher);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 ml-2" />
                                    حذف
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && students.length > 0 && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="bg-accent/30 p-4 animate-accordion-down">
                                <h4 className="font-semibold text-sm mb-3">طلاب الأستاذ:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {students.map((student) => (
                                    <div key={student.id} className="p-3 bg-background rounded-lg border border-border hover:border-primary transition-all">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold flex-1 truncate">{student.student_name}</span>
                                        <span className="badge-secondary text-xs whitespace-nowrap">{student.grade || "غير محدد"}</span>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-7 px-2">
                                              <MoreVertical className="w-3.5 h-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem onClick={() => {
                                              setSelectedStudentForEdit(student);
                                              setEditStudentDialogOpen(true);
                                            }}>
                                              <Edit className="w-4 h-4 ml-2" />
                                              تعديل
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              setSelectedStudentForRecord(student);
                                              setRecordDialogOpen(true);
                                            }}>
                                              <FileText className="w-4 h-4 ml-2" />
                                              سجل الطالب
                                            </DropdownMenuItem>
                                            {student.phone && (
                                              <>
                                                <DropdownMenuItem onClick={() => handleCall(student.phone)}>
                                                  <Phone className="w-4 h-4 ml-2" />
                                                  اتصال
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="text-green-600">
                                                  <MessageCircle className="w-4 h-4 ml-2" />
                                                  واتساب
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredTeachers.length === 0 && (
          <div className="stats-card text-center py-12 text-muted-foreground">
            <p className="text-lg">لا توجد نتائج</p>
          </div>
        )}
      </div>

      <AddTeacherDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchTeachers}
      />

      {selectedTeacher && (
        <>
          <TeacherManagementDialog
            open={showManagementDialog}
            onOpenChange={setShowManagementDialog}
            teacher={selectedTeacher}
            onSuccess={fetchTeachers}
            onDelete={() => {
              setShowManagementDialog(false);
              setShowDeleteDialog(true);
            }}
          />

          <TeacherDetailsDialog
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
            teacher={selectedTeacher}
            onSuccess={fetchTeachers}
          />
        </>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الأستاذ "{selectedTeacher?.["اسم الاستاذ"]}"؟
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {selectedTeachers.size} أستاذ؟
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteDialog(false)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
              حذف الجميع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog for bulk transfer students */}
      <BulkTransferStudentsDialog
        open={showBulkTransferDialog}
        onOpenChange={setShowBulkTransferDialog}
        teacher={selectedTeacher}
        onSuccess={fetchTeachers}
      />

      {/* Student Record Dialog */}
      <StudentRecordDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        student={selectedStudentForRecord}
        onSuccess={fetchTeachers}
        isAdmin={true}
      />

      {/* Edit Student Dialog */}
      {selectedStudentForEdit && (
        <EditStudentDialog
          student={selectedStudentForEdit}
          onSuccess={fetchTeachers}
          open={editStudentDialogOpen}
          onOpenChange={setEditStudentDialogOpen}
        />
      )}
    </DashboardLayout>
  );
};

export default TeachersManagement;
