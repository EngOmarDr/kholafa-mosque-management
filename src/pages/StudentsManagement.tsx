import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { normalizeArabic } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Phone, Trash2, Filter, MessageCircle, Upload, Edit, LayoutGrid, List, Home, Users, UserCheck, UserCog, ChevronDown, ChevronUp, MoreVertical, TrendingUp, CheckCircle, Camera, RefreshCcw, AlertCircle, Download, Calendar, History } from "lucide-react";
import Papa from "papaparse";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { logStudentDeleted } from "@/lib/activityLogger";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { BulkEditStudentsDialog } from "@/components/BulkEditStudentsDialog";
import { BulkDataValidationDialog } from "@/components/BulkDataValidationDialog";
import StudentAccountDialog from "@/components/StudentAccountDialog";
import { StudentReactivateDialog } from "@/components/StudentReactivateDialog";
import StudentRecordDialog from "@/components/StudentRecordDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StudentPhotoViewDialog from "@/components/StudentPhotoViewDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const StudentsManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useRequireAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [mosqueFilter, setMosqueFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [mosques, setMosques] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [registrationFilter, setRegistrationFilter] = useState<string>("الكل");
  const [socialStatusFilter, setSocialStatusFilter] = useState<string>("");
  const [groupByType, setGroupByType] = useState<"none" | "registration" | "social">("none");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [lastPromotionId, setLastPromotionId] = useState<string | null>(null);
  const [canRevert, setCanRevert] = useState(false);
  const [skippedStudents, setSkippedStudents] = useState<any[]>([]);
  const [skippedDialogOpen, setSkippedDialogOpen] = useState(false);
  const [editedGrades, setEditedGrades] = useState<Record<string, string>>({});
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [invalidStudents, setInvalidStudents] = useState<any[]>([]);
  const [validatingData, setValidatingData] = useState(false);
  const [selectedStudentForAccount, setSelectedStudentForAccount] = useState<{ id: string; student_name: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any>(null);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedStudentForReactivate, setSelectedStudentForReactivate] = useState<{ id: string; name: string } | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedStudentForRecord, setSelectedStudentForRecord] = useState<any>(null);
  const [validationFilter, setValidationFilter] = useState<string>("مسجل");
  const [validationScopeOpen, setValidationScopeOpen] = useState(false);
  const [validationTotalCount, setValidationTotalCount] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [globalRegistrationCounts, setGlobalRegistrationCounts] = useState<Record<string, number>>({});
  const [globalSocialCounts, setGlobalSocialCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchStudents();
  }, [currentPage, pageSize, mosqueFilter, teacherFilter, registrationFilter, socialStatusFilter, searchTerm]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [mosqueFilter, teacherFilter, registrationFilter, socialStatusFilter, searchTerm]);

  useEffect(() => {
    fetchMosques();
    fetchTeachers();
    checkLastPromotion();
    fetchGlobalCounts();
  }, []);

  const fetchGlobalCounts = async () => {
    try {
      // جلب إحصائيات حالة التسجيل
      const { data: regData } = await supabase.from("students").select("registration_status");
      const regCounts = regData?.reduce((acc, s) => {
        const status = s.registration_status || "غير محدد";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      setGlobalRegistrationCounts(regCounts);

      // جلب إحصائيات الحالة الاجتماعية
      const { data: socialData } = await supabase.from("students").select("social_status");
      const socialCounts = socialData?.reduce((acc, s) => {
        const status = s.social_status || "غير محدد";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      setGlobalSocialCounts(socialCounts);
    } catch (error) {
      console.error("Error fetching global counts:", error);
    }
  };

  const checkLastPromotion = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_promotions")
        .select("*")
        .eq("is_reverted", false)
        .order("promotion_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking last promotion:", error);
        return;
      }

      if (data) {
        setLastPromotionId(data.id);
        setCanRevert(true);
      }
    } catch (error) {
      console.error("Error checking last promotion:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("students")
        .select(`
          *,
          points_balance (
            total,
            attendance_points,
            recitation_points,
            bonus_points
          )
        `, { count: "exact" });

      // تصفية البحث بالاسم
      if (searchTerm) {
        // نستخدم ilike للبحث غير الحساس لحالة الأحرف
        // ملاحظة: normalizeArabic يتم في المتصفح حالياً، للبحث في الخادم نحتاج لاستخدام ilike
        query = query.ilike("student_name", `%${searchTerm}%`);
      }

      // الفلاتر الأخرى
      if (mosqueFilter) {
        query = query.eq("mosque_name", mosqueFilter);
      }

      if (teacherFilter) {
        if (teacherFilter === "بدون أستاذ") {
          query = query.is("teacher_id", null);
        } else {
          // نحتاج للبحث عن معرف الأستاذ من خريطة الأساتذة أو الانضمام (Join)
          // حالياً سنستخدم البحث بالاسم إذا كان مخزناً في current_teacher
          // أو نبحث في teacherMap المتاح محلياً
          const teacherId = Object.keys(teacherMap).find(id => teacherMap[id] === teacherFilter);
          if (teacherId) {
            query = query.eq("teacher_id", teacherId);
          } else {
            query = query.eq("current_teacher", teacherFilter);
          }
        }
      }

      if (registrationFilter !== "الكل") {
        query = query.eq("registration_status", registrationFilter);
      }

      if (socialStatusFilter) {
        if (socialStatusFilter === "غير محدد") {
          query = query.or("social_status.is.null,social_status.eq.''");
        } else {
          query = query.eq("social_status", socialStatusFilter);
        }
      }

      // الترتيب والتقسيم
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalStudentsCount(count || 0);

      // جلب عدد تغييرات الأساتذة لكل طالب في الصفحة الحالية
      const studentIds = (data || []).map(s => s.id);
      if (studentIds.length > 0) {
        const { data: historyData } = await supabase
          .from("student_teacher_history")
          .select("student_id")
          .in("student_id", studentIds);

        const countMap = historyData?.reduce((acc, h) => {
          acc[h.student_id] = (acc[h.student_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const studentsWithHistory = (data || []).map(s => ({
          ...s,
          teacher_changes_count: countMap[s.id] || 0
        }));

        setStudents(studentsWithHistory);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل الطلاب");
    } finally {
      setLoading(false);
    }
  };

  const fetchMosques = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("mosque_name")
        .not("mosque_name", "is", null);

      if (error) throw error;
      const uniqueMosques = [...new Set(data?.map(s => s.mosque_name).filter(Boolean))];
      setMosques(uniqueMosques as string[]);
    } catch (error) {
      console.error("Error fetching mosques:", error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, \"اسم الاستاذ\"");

      if (error) throw error;
      const names = (data || []).map((t: any) => t["اسم الاستاذ"]).filter(Boolean);
      setTeachers([...new Set(names)] as string[]);

      const map: Record<string, string> = {};
      (data || []).forEach((t: any) => {
        map[t.id] = t["اسم الاستاذ"];
      });
      setTeacherMap(map);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const filteredStudents = students;

  // حساب عدد الطلاب لكل حالة تسجيل (نستخدم البيانات العالمية للفلتر)
  const registrationStatusCounts = {
    "مسجل": globalRegistrationCounts["مسجل"] || 0,
    "غير مسجل": globalRegistrationCounts["غير مسجل"] || 0,
    "انتظار": globalRegistrationCounts["انتظار"] || 0,
    "غير مدرج بعد": globalRegistrationCounts["غير مدرج بعد"] || 0,
    "فترة تجربة": globalRegistrationCounts["فترة تجربة"] || 0,
    "متدرب": globalRegistrationCounts["متدرب"] || 0,
    "حافظ": globalRegistrationCounts["حافظ"] || 0,
    "مجاز": globalRegistrationCounts["مجاز"] || 0,
  };

  // تجميع الطلاب حسب حالة التسجيل (للصفحة الحالية فقط)
  const groupedStudents: Record<string, any[]> = {
    "مسجل": filteredStudents.filter(s => s.registration_status === "مسجل"),
    "غير مدرج بعد": filteredStudents.filter(s => s.registration_status === "غير مدرج بعد"),
    "انتظار": filteredStudents.filter(s => s.registration_status === "انتظار"),
    "فترة تجربة": filteredStudents.filter(s => s.registration_status === "فترة تجربة"),
    "متدرب": filteredStudents.filter(s => s.registration_status === "متدرب"),
    "غير مسجل": filteredStudents.filter(s => s.registration_status === "غير مسجل"),
  };

  // إضافة قسم "بدون أستاذ" فقط إذا كان هناك طلاب بدون teacher_id
  const studentsWithoutTeacher = filteredStudents.filter(s => !s.teacher_id && s.registration_status !== "غير مسجل");
  if (studentsWithoutTeacher.length > 0 && !teacherFilter) {
    groupedStudents["بدون أستاذ"] = studentsWithoutTeacher;
  }

  // حساب عدد الطلاب لكل حالة اجتماعية (نستخدم البيانات العالمية للفلتر)
  const socialStatusCounts = {
    "عائلة نموذجية": globalSocialCounts["عائلة نموذجية"] || 0,
    "فاقد الأب": globalSocialCounts["فاقد الأب"] || 0,
    "عائلة منفصلة": globalSocialCounts["عائلة منفصلة"] || 0,
    "فاقد الأم": globalSocialCounts["فاقد الأم"] || 0,
    "فاقد الأب والأم": globalSocialCounts["فاقد الأب والأم"] || 0,
    "غير محدد": globalSocialCounts["غير محدد"] || globalSocialCounts[""] || 0,
  };

  // تجميع الطلاب حسب الحالة الاجتماعية (للصفحة الحالية فقط)
  const groupedBySocialStatus: Record<string, any[]> = {
    "عائلة نموذجية": filteredStudents.filter(s => s.social_status === "عائلة نموذجية"),
    "فاقد الأب": filteredStudents.filter(s => s.social_status === "فاقد الأب"),
    "عائلة منفصلة": filteredStudents.filter(s => s.social_status === "عائلة منفصلة"),
    "فاقد الأم": filteredStudents.filter(s => s.social_status === "فاقد الأم"),
    "فاقد الأب والأم": filteredStudents.filter(s => s.social_status === "فاقد الأب والأم"),
    "غير محدد": filteredStudents.filter(s => !s.social_status || s.social_status.trim() === ""),
  };

  // دالة للحصول على لون الحالة الاجتماعية
  const getSocialStatusColor = (status: string) => {
    switch (status) {
      case "عائلة نموذجية": return "bg-green-500";
      case "فاقد الأب": return "bg-orange-500";
      case "عائلة منفصلة": return "bg-yellow-500";
      case "فاقد الأم": return "bg-purple-500";
      case "فاقد الأب والأم": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const clearFilters = () => {
    setMosqueFilter("");
    setTeacherFilter("");
    setRegistrationFilter("الكل");
    setSocialStatusFilter("");
    setGroupByType("none");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleCall = (phone: string) => {
    if (!phone) {
      toast.error("رقم الهاتف غير متوفر");
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  const handleDeleteClick = (studentId: string) => {
    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;

    try {
      const studentData = students.find(s => s.id === studentToDelete);

      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete);

      if (error) throw error;

      if (studentData) {
        await logStudentDeleted(studentData);
      }

      toast.success("تم حذف الطالب بنجاح");
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("حدث خطأ أثناء حذف الطالب");
    } finally {
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    }
  };

  const handleBulkEditSuccess = () => {
    fetchStudents();
    setSelectedStudents([]);
  };

  const handlePromoteStudents = async () => {
    setPromoting(true);
    setPromoteDialogOpen(false);

    try {
      const gradeMap: Record<string, string> = {
        // التنسيق الجديد مع الأرقام
        "1 الأول": "2 الثاني",
        "2 الثاني": "3 الثالث",
        "3 الثالث": "4 الرابع",
        "4 الرابع": "5 الخامس",
        "5 الخامس": "6 السادس",
        "6 السادس": "7 السابع",
        "7 السابع": "8 الثامن",
        "8 الثامن": "9 التاسع",
        "9 التاسع": "10 العاشر",
        "10 العاشر": "11 الحادي عشر",
        "11 الحادي عشر": "12 الثاني عشر",
        "12 الثاني عشر": "طالب جامعي",
        // دعم التنسيق القديم بدون أرقام
        "الأول": "2 الثاني",
        "الثاني": "3 الثالث",
        "الثالث": "4 الرابع",
        "الرابع": "5 الخامس",
        "الخامس": "6 السادس",
        "السادس": "7 السابع",
        "السابع": "8 الثامن",
        "الثامن": "9 التاسع",
        "التاسع": "10 العاشر",
        "العاشر": "11 الحادي عشر",
        "الحادي عشر": "12 الثاني عشر",
        "الثاني عشر": "طالب جامعي"
      };

      toast.info("جاري جلب بيانات الطلاب...", {
        duration: Infinity,
        id: "promoting-toast"
      });

      // جلب جميع الطلاب مباشرة من قاعدة البيانات
      const { data: allStudentsData, error: fetchError } = await supabase
        .from("students")
        .select("id, student_name, grade")
        .not("grade", "is", null);

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      const allStudents = allStudentsData || [];
      console.log("Total students fetched:", allStudents.length);
      console.log("All unique grades in database:", [...new Set(allStudents.map(s => s.grade))]);

      // فلترة الطلاب الذين يمكن ترقيتهم (لديهم صف محدد وموجود في خريطة الترقية)
      const studentsToUpdate = allStudents.filter(
        s => s.grade && gradeMap[s.grade.trim()] && s.grade.trim() !== "طالب جامعي"
      );

      // الطلاب المتخطين (لا يمكن ترقيتهم)
      const skippedStudentsList = allStudents.filter(
        s => !s.grade || !gradeMap[s.grade.trim()] || s.grade.trim() === "طالب جامعي"
      );

      console.log("Students to promote:", studentsToUpdate.length);
      console.log("Skipped students:", skippedStudentsList.length);
      console.log("Students details:", studentsToUpdate.map(s => ({ name: s.student_name, currentGrade: s.grade, newGrade: gradeMap[s.grade.trim()] })));

      if (studentsToUpdate.length === 0) {
        toast.dismiss("promoting-toast");
        toast.error("لا يوجد طلاب للترقية");

        if (skippedStudentsList.length > 0) {
          setSkippedStudents(skippedStudentsList);
          setSkippedDialogOpen(true);
        }
        return;
      }

      toast.info(`جاري ترقية ${studentsToUpdate.length} طالب...`, {
        duration: Infinity,
        id: "promoting-toast"
      });

      // حفظ تفاصيل الترقية قبل التنفيذ
      const promotionDetails = studentsToUpdate.map(student => ({
        id: student.id,
        name: student.student_name,
        oldGrade: student.grade.trim(),
        newGrade: gradeMap[student.grade.trim()]
      }));

      // تحديث الطلاب
      let successCount = 0;
      const errors: any[] = [];

      for (const student of studentsToUpdate) {
        const newGrade = gradeMap[student.grade.trim()];
        const { error } = await supabase
          .from("students")
          .update({ grade: newGrade })
          .eq("id", student.id);

        if (error) {
          console.error(`Error updating student ${student.id}:`, error);
          errors.push({ studentId: student.id, error });
        } else {
          successCount++;
        }
      }

      // حفظ سجل الترقية في قاعدة البيانات
      const { data: promotionRecord, error: promotionError } = await supabase
        .from("grade_promotions")
        .insert({
          performed_by: user.id,
          students_promoted: successCount,
          details: promotionDetails
        })
        .select()
        .single();

      if (promotionError) {
        console.error("Error saving promotion record:", promotionError);
      } else if (promotionRecord) {
        setLastPromotionId(promotionRecord.id);
        setCanRevert(true);
      }

      toast.dismiss("promoting-toast");

      if (successCount === studentsToUpdate.length) {
        toast.success(`✅ تمت ترقية ${successCount} طالب بنجاح 🎉`, {
          duration: 5000
        });
      } else {
        toast.warning(`تمت ترقية ${successCount} من ${studentsToUpdate.length} طالب. ${errors.length} عمليات فشلت.`, {
          duration: 5000
        });
      }

      // إظهار الطلاب المتخطين إن وجدوا
      if (skippedStudentsList.length > 0) {
        toast.info(`⚠️ تم تخطي ${skippedStudentsList.length} طالب`, {
          duration: 3000
        });
        setSkippedStudents(skippedStudentsList);
        setSkippedDialogOpen(true);
      }

      await fetchStudents();
    } catch (error) {
      console.error("Error promoting students:", error);
      toast.dismiss("promoting-toast");
      toast.error("حدث خطأ أثناء ترقية الطلاب");
    } finally {
      setPromoting(false);
    }
  };

  const handleRevertPromotion = async () => {
    setRevertDialogOpen(false);
    setPromoting(true);

    try {
      // خريطة عكسية للصفوف - تخفيض كل صف بمقدار واحد
      const reverseGradeMap: Record<string, string> = {
        "2 الثاني": "1 الأول",
        "3 الثالث": "2 الثاني",
        "4 الرابع": "3 الثالث",
        "5 الخامس": "4 الرابع",
        "6 السادس": "5 الخامس",
        "7 السابع": "6 السادس",
        "8 الثامن": "7 السابع",
        "9 التاسع": "8 الثامن",
        "10 العاشر": "9 التاسع",
        "11 الحادي عشر": "10 العاشر",
        "12 الثاني عشر": "11 الحادي عشر",
        "طالب جامعي": "12 الثاني عشر"
      };

      toast.info("جاري جلب بيانات الطلاب...", {
        duration: Infinity,
        id: "reverting-toast"
      });

      // جلب جميع الطلاب من قاعدة البيانات
      const { data: allStudentsData, error: fetchError } = await supabase
        .from("students")
        .select("id, student_name, grade")
        .not("grade", "is", null);

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      const allStudents = allStudentsData || [];
      console.log("Total students for revert:", allStudents.length);

      // فلترة الطلاب الذين يمكن تخفيضهم (ليس صف 1 الأول)
      const studentsToRevert = allStudents.filter(
        s => s.grade && reverseGradeMap[s.grade.trim()] && s.grade.trim() !== "1 الأول"
      );

      // الطلاب المتخطين (لا يمكن تخفيضهم)
      const skippedStudentsList = allStudents.filter(
        s => !s.grade || !reverseGradeMap[s.grade.trim()] || s.grade.trim() === "1 الأول"
      );

      console.log("Students to revert:", studentsToRevert.length);
      console.log("Skipped students:", skippedStudentsList.length);
      console.log("Revert details:", studentsToRevert.map(s => ({
        name: s.student_name,
        currentGrade: s.grade,
        newGrade: reverseGradeMap[s.grade.trim()]
      })));

      if (studentsToRevert.length === 0) {
        toast.dismiss("reverting-toast");
        toast.error("لا يوجد طلاب للتخفيض");

        if (skippedStudentsList.length > 0) {
          setSkippedStudents(skippedStudentsList);
          setSkippedDialogOpen(true);
        }
        return;
      }

      toast.info(`جاري تخفيض صفوف ${studentsToRevert.length} طالب... ⏳`, {
        duration: Infinity,
        id: "reverting-toast"
      });

      // حفظ تفاصيل التراجع قبل التنفيذ
      const revertDetails = studentsToRevert.map(student => ({
        id: student.id,
        name: student.student_name,
        oldGrade: student.grade.trim(),
        newGrade: reverseGradeMap[student.grade.trim()]
      }));

      // تحديث الطلاب
      let successCount = 0;
      const errors: any[] = [];

      for (const student of studentsToRevert) {
        const newGrade = reverseGradeMap[student.grade.trim()];
        const { error } = await supabase
          .from("students")
          .update({ grade: newGrade })
          .eq("id", student.id);

        if (error) {
          console.error(`Error updating student ${student.id}:`, error);
          errors.push({ studentId: student.id, error });
        } else {
          successCount++;
        }
      }

      // حفظ سجل التراجع في قاعدة البيانات
      const { error: revertError } = await supabase
        .from("grade_promotions")
        .insert({
          performed_by: user.id,
          students_promoted: -successCount, // رقم سالب للدلالة على التراجع
          details: revertDetails,
          is_reverted: true,
          reverted_at: new Date().toISOString(),
          reverted_by: user.id
        });

      if (revertError) {
        console.error("Error saving revert record:", revertError);
      }

      // إذا كان هناك آخر ترقية، نحدثها أيضاً
      if (lastPromotionId) {
        await supabase
          .from("grade_promotions")
          .update({
            is_reverted: true,
            reverted_at: new Date().toISOString(),
            reverted_by: user.id
          })
          .eq("id", lastPromotionId);
      }

      setLastPromotionId(null);
      setCanRevert(false);

      toast.dismiss("reverting-toast");

      if (successCount === studentsToRevert.length) {
        toast.success(`✅ تم تخفيض صفوف ${successCount} طالب بنجاح`, {
          duration: 5000
        });
      } else {
        toast.warning(`تم تخفيض ${successCount} من ${studentsToRevert.length} طالب. ${errors.length} عمليات فشلت.`, {
          duration: 5000
        });
      }

      // إظهار الطلاب المتخطين إن وجدوا
      if (skippedStudentsList.length > 0) {
        toast.info(`⚠️ تم تخطي ${skippedStudentsList.length} طالب`, {
          duration: 3000
        });
        setSkippedStudents(skippedStudentsList);
        setSkippedDialogOpen(true);
      }

      await fetchStudents();
    } catch (error) {
      console.error("Error reverting promotion:", error);
      toast.dismiss("reverting-toast");
      toast.error("حدث خطأ أثناء التراجع عن الترقية");
    } finally {
      setPromoting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;

    try {
      toast.loading(`جاري حذف ${selectedStudents.length} طالب...`, {
        id: "bulk-delete-toast",
        duration: Infinity
      });

      // حذف البيانات المرتبطة بالطلاب أولاً
      const deletionSteps: Array<{ table: string; message: string }> = [
        { table: "attendance", message: "حذف سجلات الحضور" },
        { table: "recitations", message: "حذف سجلات التسميع" },
        { table: "bonus_points", message: "حذف النقاط الإضافية" },
        { table: "check_records", message: "حذف سجلات الأدوات" },
        { table: "points_balance", message: "حذف أرصدة النقاط" },
        { table: "student_notes", message: "حذف الملاحظات" },
        { table: "tool_loss_history", message: "حذف سجلات فقدان الأدوات" },
        { table: "tool_reissues", message: "حذف سجلات إعادة الإصدار" },
        { table: "guardianships", message: "حذف سجلات الأولياء" },
        { table: "students_profiles", message: "حذف الملفات الشخصية" }
      ];

      // حذف البيانات المرتبطة
      for (const step of deletionSteps) {
        try {
          await supabase
            .from(step.table as any)
            .delete()
            .in("student_id", selectedStudents);
        } catch (err) {
          // تجاهل الأخطاء من الجداول التي لا تحتوي على بيانات
          console.log(`Skipped ${step.table}`);
        }
      }

      // حذف الطلاب على دفعات (50 طالب في كل دفعة)
      const batchSize = 50;
      let deletedCount = 0;

      for (let i = 0; i < selectedStudents.length; i += batchSize) {
        const batch = selectedStudents.slice(i, i + batchSize);

        const { error } = await supabase
          .from("students")
          .delete()
          .in("id", batch);

        if (error) {
          console.error(`Error deleting batch ${i / batchSize + 1}:`, error);
          throw error;
        }

        deletedCount += batch.length;

        // تحديث رسالة التقدم
        toast.loading(`تم حذف ${deletedCount} من ${selectedStudents.length} طالب...`, {
          id: "bulk-delete-toast"
        });
      }

      toast.dismiss("bulk-delete-toast");
      toast.success(`✅ تم حذف ${selectedStudents.length} طالب بنجاح`);
      setSelectedStudents([]);
      fetchStudents();
      setBulkDeleteOpen(false);
    } catch (error) {
      console.error("Error bulk deleting students:", error);
      toast.dismiss("bulk-delete-toast");
      toast.error("حدث خطأ أثناء حذف الطلاب. الرجاء المحاولة مرة أخرى.");
    }
  };

  const handleValidateData = async () => {
    setValidationScopeOpen(false);
    setValidatingData(true);

    toast.info("جاري التحقق من البيانات...", {
      id: "validating-toast",
      duration: Infinity
    });

    try {
      // تطبيق الفلتر على الطلاب قبل التحقق
      const studentsToValidate = validationFilter === "الكل"
        ? students
        : students.filter(s => s.registration_status === validationFilter);

      if (studentsToValidate.length === 0) {
        toast.dismiss("validating-toast");
        toast.warning(`لا يوجد طلاب بحالة "${validationFilter}" للتحقق منهم`);
        setValidatingData(false);
        return;
      }

      console.log(`Starting validation for ${studentsToValidate.length} students (Filter: ${validationFilter})`);
      setValidationTotalCount(studentsToValidate.length);

      // دالة مساعدة لتطبيع النصوص (إزالة المسافات الزائدة فقط)
      const normalizeText = (text: string) => {
        if (!text) return '';
        // إزالة المسافات الزائدة فقط
        return text.trim().replace(/\s+/g, ' ');
      };

      console.log('🔍 بدء التحقق من البيانات...');

      // تحديد القوائم الرسمية الصحيحة

      // 1. قائمة الصفوف الرسمية (كما هي في AddStudentDialog)
      const validGrades = [
        "1 الأول", "2 الثاني", "3 الثالث", "4 الرابع",
        "5 الخامس", "6 السادس", "7 السابع", "8 الثامن",
        "9 التاسع", "10 العاشر", "11 الحادي عشر",
        "12 الثاني عشر", "طالب جامعي"
      ];

      console.log('✅ قائمة الصفوف الصحيحة:', validGrades);

      // 2. قائمة الحالات الاجتماعية الرسمية (كما هي في AddStudentDialog)
      const validSocialStatuses = [
        "عائلة نموذجية", "فاقد الأب", "فاقد الأم",
        "فاقد الأب والأم", "عائلة منفصلة"
      ];

      console.log('✅ قائمة الحالات الاجتماعية الصحيحة:', validSocialStatuses);

      // 3. قائمة حالات التسجيل الرسمية (كما هي في AddStudentDialog)
      const validRegistrationStatuses = [
        "مسجل", "غير مسجل", "انتظار",
        "غير مدرج بعد", "متدرب", "حافظ", "مجاز", "فترة تجربة"
      ];

      console.log('✅ قائمة حالات التسجيل الصحيحة:', validRegistrationStatuses);

      // 4. جلب أسماء الأساتذة من جدول teachers (القائمة الرسمية)
      const { data: validTeachers, error: teachersError } = await supabase
        .from("teachers")
        .select("*");

      if (teachersError) {
        console.error("Error fetching teachers:", teachersError);
        toast.dismiss("validating-toast");
        toast.error("حدث خطأ أثناء جلب بيانات الأساتذة");
        return;
      }

      // نستخرج أسماء الأساتذة من أي حقل يحتوي على "اسم" و "استاذ"
      const validTeacherNames = validTeachers
        ?.map((teacher: any) => {
          // نبحث عن الحقل الصحيح بشكل ديناميكي
          const keys = Object.keys(teacher);
          const nameKey = keys.find(key =>
            key.includes('اسم') && key.includes('استاذ')
          );
          return nameKey ? teacher[nameKey] : null;
        })
        .filter((name: any) => name && typeof name === 'string' && name.trim() !== "")
        .map(normalizeText) || [];

      // 5. جلب أسماء المساجد من جدول mosques (القائمة الرسمية)
      const { data: validMosques, error: mosquesError } = await supabase
        .from("mosques")
        .select("*");

      if (mosquesError) {
        console.error("Error fetching mosques:", mosquesError);
        toast.dismiss("validating-toast");
        toast.error("حدث خطأ أثناء جلب بيانات المساجد");
        return;
      }

      const validMosqueNames = validMosques
        ?.map((mosque: any) => {
          // نبحث عن الحقل الصحيح بشكل ديناميكي
          const keys = Object.keys(mosque);
          const nameKey = keys.find(key =>
            key.includes('اسم') && key.includes('مسجد')
          );
          return nameKey ? mosque[nameKey] : null;
        })
        .filter((name: any) => name && typeof name === 'string' && name.trim() !== "")
        .map(normalizeText) || [];

      const invalidStudentsList: any[] = [];

      // التحقق من كل طالب
      studentsToValidate.forEach(student => {
        const issues: any[] = [];

        // ====== التحقق من البيانات الناقصة ======

        // التحقق من اسم الأب
        if (!student.father_name || student.father_name.trim() === "") {
          issues.push({
            field: "اسم الأب",
            currentValue: "-",
            issue: "اسم الأب غير موجود"
          });
        }

        // التحقق من المسجد (مطلوب)
        if (!student.mosque_name || student.mosque_name.trim() === "") {
          issues.push({
            field: "المسجد",
            currentValue: "-",
            issue: "المسجد غير محدد"
          });
        }

        // التحقق من الصف (مطلوب)
        if (!student.grade || student.grade.trim() === "") {
          issues.push({
            field: "الصف",
            currentValue: "-",
            issue: "الصف غير محدد"
          });
        }

        // التحقق من رقم الهاتف (مطلوب)
        if (!student.phone || student.phone.trim() === "") {
          issues.push({
            field: "رقم الهاتف",
            currentValue: "-",
            issue: "رقم الهاتف غير موجود"
          });
        }

        // التحقق من حالة التسجيل (مطلوب)
        if (!student.registration_status || student.registration_status.trim() === "") {
          issues.push({
            field: "حالة التسجيل",
            currentValue: "-",
            issue: "حالة التسجيل غير محددة"
          });
        }

        // التحقق من الأستاذ (مطلوب)
        if (!student.current_teacher || student.current_teacher.trim() === "") {
          issues.push({
            field: "الأستاذ",
            currentValue: "-",
            issue: "الأستاذ غير محدد"
          });
        }

        // ====== التحقق من صحة البيانات الموجودة ======

        // التحقق من الصف
        if (student.grade && student.grade.trim() !== "") {
          const normalizedGrade = normalizeText(student.grade);
          const isValidGrade = validGrades.some(grade => normalizeText(grade) === normalizedGrade);

          if (!isValidGrade) {
            console.log(`❌ صف خاطئ للطالب ${student.student_name}: "${student.grade}" (بعد التطبيع: "${normalizedGrade}")`);
            issues.push({
              field: "الصف",
              currentValue: student.grade,
              issue: "الصف غير موجود في قائمة الصفوف المستخدمة في قاعدة البيانات",
              suggestions: validGrades
            });
          }
        }

        // التحقق من الحالة الاجتماعية
        if (student.social_status && student.social_status.trim() !== "") {
          const normalizedSocialStatus = normalizeText(student.social_status);
          const isValidSocialStatus = validSocialStatuses.some(status => normalizeText(status) === normalizedSocialStatus);

          if (!isValidSocialStatus) {
            console.log(`❌ حالة اجتماعية خاطئة للطالب ${student.student_name}: "${student.social_status}" (بعد التطبيع: "${normalizedSocialStatus}")`);
            issues.push({
              field: "الحالة الاجتماعية",
              currentValue: student.social_status,
              issue: "الحالة الاجتماعية غير موجودة في القائمة المستخدمة في قاعدة البيانات",
              suggestions: validSocialStatuses
            });
          }
        }

        // التحقق من اسم الأستاذ
        if (student.current_teacher && student.current_teacher.trim() !== "") {
          const normalizedTeacher = normalizeText(student.current_teacher);
          const isValidTeacher = validTeacherNames.some(teacher => normalizeText(teacher) === normalizedTeacher);

          if (!isValidTeacher) {
            console.log(`❌ اسم أستاذ خاطئ للطالب ${student.student_name}: "${student.current_teacher}"`);
            issues.push({
              field: "اسم الأستاذ",
              currentValue: student.current_teacher,
              issue: "اسم الأستاذ غير موجود في قاعدة البيانات",
              suggestions: validTeacherNames
            });
          }
        }

        // التحقق من حالة التسجيل
        if (student.registration_status && student.registration_status.trim() !== "") {
          const normalizedRegistration = normalizeText(student.registration_status);
          const isValidRegistration = validRegistrationStatuses.some(status => normalizeText(status) === normalizedRegistration);

          if (!isValidRegistration) {
            console.log(`❌ حالة تسجيل خاطئة للطالب ${student.student_name}: "${student.registration_status}"`);
            issues.push({
              field: "حالة التسجيل",
              currentValue: student.registration_status,
              issue: "حالة التسجيل غير موجودة في القائمة المستخدمة في قاعدة البيانات",
              suggestions: validRegistrationStatuses
            });
          }
        }

        // التحقق من المسجد
        if (student.mosque_name && student.mosque_name.trim() !== "") {
          const normalizedMosque = normalizeText(student.mosque_name);
          const isValidMosque = validMosqueNames.some(mosque => normalizeText(mosque) === normalizedMosque);

          if (!isValidMosque) {
            console.log(`❌ مسجد خاطئ للطالب ${student.student_name}: "${student.mosque_name}"`);
            issues.push({
              field: "المسجد",
              currentValue: student.mosque_name,
              issue: "المسجد غير موجود في قاعدة البيانات",
              suggestions: validMosqueNames
            });
          }
        }

        // التحقق من رقم الهاتف
        if (student.phone && student.phone.trim() !== "") {
          const phoneDigits = student.phone.replace(/\D/g, ''); // إزالة جميع الحروف والرموز
          if (phoneDigits.length < 10) {
            issues.push({
              field: "رقم الهاتف",
              currentValue: student.phone,
              issue: `رقم الهاتف قصير جداً (${phoneDigits.length} خانات) - يجب أن يكون 10 خانات على الأقل`
            });
          }
        }

        if (issues.length > 0) {
          invalidStudentsList.push({
            id: student.id,
            student_name: student.student_name,
            current_teacher: student.current_teacher,
            grade: student.grade,
            issues: issues
          });
        }
      });

      console.log(`🔍 انتهى التحقق: تم العثور على ${invalidStudentsList.length} طالب لديهم مشاكل من أصل ${studentsToValidate.length} طالب`);

      toast.dismiss("validating-toast");

      setInvalidStudents(invalidStudentsList);
      setValidationDialogOpen(true);

      if (invalidStudentsList.length === 0) {
        toast.success(`✅ تم التحقق من ${studentsToValidate.length} طالب (${validationFilter}) - جميع البيانات صحيحة!`, {
          duration: 5000
        });
      } else {
        toast.warning(`⚠️ تم العثور على ${invalidStudentsList.length} طالب لديهم مشاكل من أصل ${studentsToValidate.length} (${validationFilter})`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error("Error validating data:", error);
      toast.dismiss("validating-toast");
      toast.error("حدث خطأ أثناء التحقق من البيانات");
    } finally {
      setValidatingData(false);
    }
  };

  const handleValidationClick = () => {
    setValidationScopeOpen(true);
  };

  const handleSaveValidationCorrections = async (corrections: Record<string, Record<string, string>>) => {
    try {
      toast.info("جاري حفظ التصحيحات...", {
        duration: Infinity,
        id: "save-corrections-toast"
      });

      // إنشاء خريطة عكسية لأسماء المعلمين إلى معرفاتهم
      const teacherNameToId: Record<string, string> = {};
      if (teacherMap) {
        Object.entries(teacherMap).forEach(([id, name]) => {
          teacherNameToId[name] = id;
        });
      }

      let successCount = 0;
      const errors = [];

      for (const [studentId, updates] of Object.entries(corrections)) {
        const finalUpdates: any = { ...updates };

        // إذا تم تغيير اسم المعلم، نحتاج لتحديث teacher_id أيضاً
        if (finalUpdates.current_teacher) {
          const tId = teacherNameToId[finalUpdates.current_teacher];
          if (tId) {
            finalUpdates.teacher_id = tId;
          }
        }

        const { error } = await supabase
          .from("students")
          .update(finalUpdates)
          .eq("id", studentId);

        if (error) {
          console.error(`Error updating student ${studentId}:`, error);
          errors.push(studentId);
        } else {
          successCount++;
        }
      }

      toast.dismiss("save-corrections-toast");

      if (successCount > 0) {
        toast.success(`✅ تم بنجاح تصحيح بيانات ${successCount} طالب`, {
          duration: 5000
        });
        await fetchStudents();
        setInvalidStudents([]);
      }

      if (errors.length > 0) {
        toast.error(`❌ فشل تحديث ${errors.length} طالب`);
      }
    } catch (error) {
      console.error("Error saving corrections:", error);
      toast.dismiss("save-corrections-toast");
      toast.error("حدث خطأ غير متوقع أثناء حفظ التصحيحات");
    }
  };

  const handleSaveSkippedGrades = async () => {
    try {
      toast.info("جاري حفظ التعديلات...", {
        duration: Infinity,
        id: "saving-grades-toast"
      });

      let successCount = 0;
      const errors: any[] = [];

      for (const [studentId, newGrade] of Object.entries(editedGrades)) {
        if (!newGrade) continue;

        const { error } = await supabase
          .from("students")
          .update({ grade: newGrade })
          .eq("id", studentId);

        if (error) {
          console.error(`Error updating student ${studentId}:`, error);
          errors.push({ studentId, error });
        } else {
          successCount++;
        }
      }

      toast.dismiss("saving-grades-toast");

      if (successCount > 0) {
        toast.success(`✅ تم تحديث صفوف ${successCount} طالب بنجاح`, {
          duration: 5000
        });
      }

      if (errors.length > 0) {
        toast.error(`❌ فشل تحديث ${errors.length} طالب`, {
          duration: 5000
        });
      }

      setSkippedDialogOpen(false);
      setEditedGrades({});
      await fetchStudents();
    } catch (error) {
      console.error("Error saving grades:", error);
      toast.dismiss("saving-grades-toast");
      toast.error("حدث خطأ أثناء حفظ التعديلات");
    }
  };

  // Update state when URL params change
  useEffect(() => {
    const status = searchParams.get("status");
    const mosque = searchParams.get("mosque");

    if (status) setRegistrationFilter(status);
    if (mosque) setMosqueFilter(mosque);
  }, [searchParams]);

  // Fetch counts for filters (Independent of current filters to show correct badge numbers)
  const exportStudentsToCSV = () => {
    // تحديد الطلاب المراد تصديرهم (المحددين أو المفلترين أو الكل)
    const dataToExport = selectedStudents.length > 0
      ? filteredStudents.filter(s => selectedStudents.includes(s.id))
      : filteredStudents;

    if (dataToExport.length === 0) {
      toast.error("لا يوجد طلاب للتصدير");
      return;
    }

    // تحويل البيانات للتنسيق المطلوب
    const csvData = dataToExport.map(student => ({
      "اسم الطالب": student.student_name,
      "رقم الهاتف": student.phone || "",
      "اسم الأب": student.father_name || "",
      "المسجد": student.mosque_name || "",
      "الأستاذ": teacherMap[student.teacher_id] || student.current_teacher || "",
      "الصف": student.grade || "",
      "حالة التسجيل": student.registration_status || "",
      "العنوان": student.address || "",
      "الحالة الاجتماعية": student.social_status || "",
      "ملاحظات": student.notes || "",
      "إجمالي النقاط": student.points_balance?.total || 0,
    }));

    // تحويل إلى CSV باستخدام papaparse
    const csv = Papa.unparse(csvData, {
      header: true,
      delimiter: ";",  // استخدام الفاصلة المنقوطة للتوافق مع Excel
    });

    // إضافة BOM للتوافق مع Excel العربي
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });

    // تنزيل الملف
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `طلاب_${new Date().toLocaleDateString("ar-EG").replace(/\//g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`تم تصدير ${dataToExport.length} طالب بنجاح`);
  };


  return (
    <DashboardLayout
      title="إدارة الطلاب"
      userName={user?.name}
      showBackButton
      backPath="/admin"
    >
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
              <BreadcrumbPage>إدارة الطلاب</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">إدارة الطلاب</h2>
            <p className="text-muted-foreground mt-1">
              عرض وإدارة جميع الطلاب في النظام
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
            {selectedStudents.length > 0 && (
              <>
                <Button
                  variant="default"
                  onClick={() => setBulkEditOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  تعديل جماعي ({selectedStudents.length})
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  حذف جماعي ({selectedStudents.length})
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical className="w-4 h-4 mr-2" />
                  خيارات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportStudentsToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  تصدير CSV
                  {selectedStudents.length > 0 && ` (${selectedStudents.length})`}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleValidationClick} disabled={validatingData || students.length === 0}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  تحقق جماعي من البيانات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/students/import")}>
                  <Upload className="w-4 h-4 mr-2" />
                  استيراد من CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPromoteDialogOpen(true)} disabled={promoting}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  ترقية الطلاب السنوية
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRevertDialogOpen(true)} disabled={promoting} className="text-orange-600">
                  <TrendingUp className="w-4 h-4 mr-2 rotate-180" />
                  التراجع عن الترقية السنوية
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddStudentDialog onSuccess={fetchStudents} />
          </div>
        </div>

        {/* Pagination */}
        {!loading && totalStudentsCount > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/20 p-4 rounded-lg border border-border">
            <div className="text-sm text-muted-foreground">
              عرض من {((currentPage - 1) * pageSize) + 1} إلى {Math.min(currentPage * pageSize, totalStudentsCount)} من أصل {totalStudentsCount} طالب
            </div>

            <div className="flex items-center gap-4">
              <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="عدد العناصر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 طالباً</SelectItem>
                  <SelectItem value="50">50 طالباً</SelectItem>
                  <SelectItem value="100">100 طالب</SelectItem>
                  <SelectItem value="200">200 طالب</SelectItem>
                  <SelectItem value="10000">جميع الطلاب</SelectItem>
                </SelectContent>
              </Select>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {/* أرقام الصفحات - تبسيط العرض */}
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium px-4 py-2 border rounded-md bg-background">
                      الصفحة {currentPage} من {Math.ceil(totalStudentsCount / pageSize)}
                    </span>
                  </div>

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalStudentsCount / pageSize), prev + 1))}
                      className={currentPage >= Math.ceil(totalStudentsCount / pageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="stats-card">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">البحث والفلترة</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="البحث بالاسم أو رقم الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pr-10"
                />
              </div>

              <Select value={mosqueFilter} onValueChange={setMosqueFilter}>
                <SelectTrigger className="md:w-[200px]">
                  <SelectValue placeholder="فلترة حسب المسجد" />
                </SelectTrigger>
                <SelectContent>
                  {mosques.map((mosque) => (
                    <SelectItem key={mosque} value={mosque}>
                      {mosque}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger className="md:w-[200px]">
                  <SelectValue placeholder="فلترة حسب الأستاذ" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="بدون أستاذ" className="text-orange-600 font-medium">
                    بدون أستاذ ({students.filter(s => !s.teacher_id).length})
                  </SelectItem>
                  {teachers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name} ({students.filter(s => (teacherMap[s.teacher_id] || s.current_teacher) === name).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(mosqueFilter || teacherFilter || registrationFilter !== "الكل" || socialStatusFilter || groupByType !== "none") && (
                <Button variant="outline" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              )}
            </div>

            {/* فلترة حسب حالة التسجيل والحالة الاجتماعية */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              <span className="text-sm font-medium text-muted-foreground">حالة التسجيل:</span>
              <Select value={registrationFilter} onValueChange={(value) => {
                setRegistrationFilter(value);
                if (value !== "الكل") setGroupByType("none");
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="اختر حالة التسجيل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الكل">الكل ({students.length})</SelectItem>
                  <SelectItem value="مسجل">مسجل ({registrationStatusCounts["مسجل"]})</SelectItem>
                  <SelectItem value="غير مسجل">غير مسجل ({registrationStatusCounts["غير مسجل"]})</SelectItem>
                  <SelectItem value="انتظار">انتظار ({registrationStatusCounts["انتظار"]})</SelectItem>
                  <SelectItem value="غير مدرج بعد">غير مدرج بعد ({registrationStatusCounts["غير مدرج بعد"]})</SelectItem>
                  <SelectItem value="فترة تجربة">فترة تجربة ({registrationStatusCounts["فترة تجربة"]})</SelectItem>
                  <SelectItem value="متدرب">متدرب ({registrationStatusCounts["متدرب"]})</SelectItem>
                  <SelectItem value="حافظ">حافظ ({registrationStatusCounts["حافظ"]})</SelectItem>
                  <SelectItem value="مجاز">مجاز ({registrationStatusCounts["مجاز"]})</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-sm font-medium text-muted-foreground mr-2">الحالة الاجتماعية:</span>
              <Select value={socialStatusFilter} onValueChange={(value) => {
                setSocialStatusFilter(value);
                if (value) setGroupByType("none");
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="عائلة نموذجية">عائلة نموذجية ({socialStatusCounts["عائلة نموذجية"]})</SelectItem>
                  <SelectItem value="فاقد الأب">فاقد الأب ({socialStatusCounts["فاقد الأب"]})</SelectItem>
                  <SelectItem value="عائلة منفصلة">عائلة منفصلة ({socialStatusCounts["عائلة منفصلة"]})</SelectItem>
                  <SelectItem value="فاقد الأم">فاقد الأم ({socialStatusCounts["فاقد الأم"]})</SelectItem>
                  <SelectItem value="فاقد الأب والأم">فاقد الأب والأم ({socialStatusCounts["فاقد الأب والأم"]})</SelectItem>
                  <SelectItem value="غير محدد">غير محدد ({socialStatusCounts["غير محدد"]})</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={groupByType}
                onValueChange={(value: "none" | "registration" | "social") => {
                  setGroupByType(value);
                  if (value !== "none") {
                    setRegistrationFilter("الكل");
                    setSocialStatusFilter("");
                  }
                }}
              >
                <SelectTrigger className="w-[180px] mr-auto">
                  <SelectValue placeholder="عرض بالأقسام" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تجميع</SelectItem>
                  <SelectItem value="registration">حسب حالة التسجيل</SelectItem>
                  <SelectItem value="social">حسب الحالة الاجتماعية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Students Display */}
        {loading ? (
          <div className="space-y-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="stats-card space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stats-card space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : groupByType !== "none" ? (
          // عرض الطلاب مجمعين
          <div className="space-y-6">
            {/* زر تحديد الكل في وضع Grid */}
            {viewMode === "grid" && (
              <div className="flex items-center gap-3 px-2">
                <Checkbox
                  id="select-all-grouped"
                  checked={
                    Object.values(groupByType === "registration" ? groupedStudents : groupedBySocialStatus).flat().every(s => selectedStudents.includes(s.id)) &&
                    Object.values(groupByType === "registration" ? groupedStudents : groupedBySocialStatus).flat().length > 0
                  }
                  onCheckedChange={(checked) => {
                    const allStudentIds = Object.values(groupByType === "registration" ? groupedStudents : groupedBySocialStatus).flat().map(s => s.id);
                    if (checked) {
                      setSelectedStudents(allStudentIds);
                    } else {
                      setSelectedStudents([]);
                    }
                  }}
                />
                <label
                  htmlFor="select-all-grouped"
                  className="text-sm font-medium cursor-pointer"
                >
                  تحديد الكل ({Object.values(groupByType === "registration" ? groupedStudents : groupedBySocialStatus).flat().length} طالب)
                </label>
              </div>
            )}
            {Object.entries(groupByType === "registration" ? groupedStudents : groupedBySocialStatus).map(([status, studentsInStatus]) => (
              studentsInStatus.length > 0 && (
                <div key={status} className={`space-y-3 ${status === "غير مسجل" ? "bg-muted/30 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30" : ""}`}>
                  <button
                    onClick={() => toggleSection(status)}
                    className="w-full flex items-center gap-3 pb-3 border-b-2 border-primary/20 cursor-pointer group"
                  >
                    {status === "غير مسجل" ? (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${groupByType === "social" ? getSocialStatusColor(status) :
                        status === "مسجل" ? "bg-green-500" :
                          status === "غير مدرج بعد" ? "bg-yellow-500" :
                            status === "متدرب" ? "bg-blue-500" :
                              "bg-orange-500"
                        }`} />
                    )}
                    <h3 className={`text-xl font-bold ${status === "غير مسجل" ? "text-destructive" : "text-primary"}`}>
                      {status === "غير مسجل" ? "📋 الطلاب غير المسجلين" : status}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      ({studentsInStatus.length} {studentsInStatus.length === 1 ? "طالب" : "طلاب"})
                    </span>
                    <div className="mr-auto">
                      {collapsedSections[status] ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {!collapsedSections[status] && (
                    <>
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {studentsInStatus.map((student) => (
                            <div key={student.id} className="stats-card">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h3 className="font-bold text-lg mb-1">{student.student_name}</h3>
                                    <p className="text-sm text-muted-foreground">{student.grade || "غير محدد"}</p>
                                  </div>
                                  <Checkbox
                                    checked={selectedStudents.includes(student.id)}
                                    onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                  />
                                </div>

                                <div className="space-y-2 text-sm">
                                  {student.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-mono">{student.phone}</span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-muted-foreground">الأستاذ:</span>
                                    <span className="font-medium">
                                      {teacherMap[student.teacher_id] || student.current_teacher || "غير محدد"}
                                    </span>
                                    {student.teacher_changes_count > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedStudentForRecord(student);
                                          setRecordDialogOpen(true);
                                        }}
                                      >
                                        <History className="w-3 h-3 ml-1" />
                                        {student.teacher_changes_count} تغيير
                                      </Button>
                                    )}
                                  </div>

                                  {status === "غير مسجل" && student.previous_teacher && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">الأستاذ السابق:</span>
                                      <span className="font-medium text-muted-foreground">
                                        {student.previous_teacher}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">المسجد:</span>
                                    <span>{student.mosque_name || "-"}</span>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="badge-gold">
                                      {student.points_balance?.total || 0} نقطة
                                    </div>
                                    <div className={`badge-${student.registration_status === "مسجل" ? "success" : "warning"} text-xs`}>
                                      {student.registration_status || "غير محدد"}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t">
                                  {status === "غير مدرج بعد" || status === "فترة تجربة" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className={`flex-1 gap-2 ${status === "غير مدرج بعد" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-primary hover:bg-primary/90"} text-white`}
                                        onClick={() => {
                                          setSelectedStudentForEdit(student);
                                          setEditDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="w-4 h-4 ml-2" />
                                        {status === "غير مدرج بعد" ? "استكمال البيانات" : "تعديل البيانات"}
                                      </Button>
                                    </>
                                  ) : status === "غير مسجل" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="flex-1 gap-2"
                                        onClick={() => {
                                          setSelectedStudentForReactivate({ id: student.id, name: student.student_name });
                                          setReactivateDialogOpen(true);
                                        }}
                                      >
                                        <RefreshCcw className="w-4 h-4" />
                                        إعادة التسجيل
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="sm" variant="outline">
                                            <MoreVertical className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-background z-50">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedStudentForEdit(student);
                                              setEditDialogOpen(true);
                                            }}
                                            className="cursor-pointer"
                                          >
                                            <Edit className="w-4 h-4 ml-2" />
                                            تعديل
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteClick(student.id)}
                                            className="text-destructive cursor-pointer"
                                          >
                                            <Trash2 className="w-4 h-4 ml-2" />
                                            حذف نهائياً
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </>
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" className="w-full gap-1">
                                          <MoreVertical className="w-3.5 h-3.5" />
                                          خيارات
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="bg-background z-50">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedStudentForEdit(student);
                                            setEditDialogOpen(true);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Edit className="w-4 h-4 ml-2" />
                                          تعديل
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {student.phone && (
                                          <>
                                            <DropdownMenuItem onClick={() => handleCall(student.phone)} className="cursor-pointer">
                                              <Phone className="w-4 h-4 ml-2" />
                                              اتصال
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="cursor-pointer">
                                              <MessageCircle className="w-4 h-4 ml-2" />
                                              واتساب
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                          </>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => setSelectedStudentForAccount({ id: student.id, student_name: student.student_name })}
                                          className="cursor-pointer"
                                        >
                                          <UserCheck className="w-4 h-4 ml-2" />
                                          حساب الطالب
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedStudentForRecord(student);
                                            setRecordDialogOpen(true);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Calendar className="w-4 h-4 ml-2" />
                                          سجل الطالب
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteClick(student.id)}
                                          className="text-destructive cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4 ml-2" />
                                          حذف
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="stats-card overflow-hidden">
                          <div className="overflow-x-auto">
                            <Table className="animate-none">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right w-12">
                                    <Checkbox
                                      checked={
                                        studentsInStatus.every(s => selectedStudents.includes(s.id)) &&
                                        studentsInStatus.length > 0
                                      }
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedStudents([
                                            ...selectedStudents,
                                            ...studentsInStatus.map(s => s.id).filter(id => !selectedStudents.includes(id))
                                          ]);
                                        } else {
                                          setSelectedStudents(
                                            selectedStudents.filter(id => !studentsInStatus.some(s => s.id === id))
                                          );
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="text-right">اسم الطالب</TableHead>
                                  <TableHead className="text-right">رقم الهاتف</TableHead>
                                  <TableHead className="text-right">الصف</TableHead>
                                  <TableHead className="text-right">اسم الأب</TableHead>
                                  <TableHead className="text-right">الحالة الاجتماعية</TableHead>
                                  <TableHead className="text-right">الأستاذ الحالي</TableHead>
                                  <TableHead className="text-right">الأستاذ السابق</TableHead>
                                  <TableHead className="text-right">العنوان</TableHead>
                                  <TableHead className="text-right">التسجيل</TableHead>
                                  <TableHead className="text-right">المسجد</TableHead>
                                  <TableHead className="text-right w-[120px]">الإجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {studentsInStatus.map((student) => (
                                  <TableRow key={student.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedStudents.includes(student.id)}
                                        onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">{student.student_name}</TableCell>
                                    <TableCell className="font-mono text-sm">{student.phone || "-"}</TableCell>
                                    <TableCell>{student.grade || "-"}</TableCell>
                                    <TableCell>{student.father_name || "-"}</TableCell>
                                    <TableCell>{student.social_status || "-"}</TableCell>
                                    <TableCell className="font-medium text-primary">
                                      <div className="flex items-center gap-1">
                                        <span>{teacherMap[student.teacher_id] || student.current_teacher || "-"}</span>
                                        {student.teacher_changes_count > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedStudentForRecord(student);
                                              setRecordDialogOpen(true);
                                            }}
                                          >
                                            <History className="w-3 h-3 ml-0.5" />
                                            {student.teacher_changes_count}
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>{student.previous_teacher || "-"}</TableCell>
                                    <TableCell>{student.address || "-"}</TableCell>
                                    <TableCell>
                                      <span className={`badge-${student.registration_status === "مسجل" ? "success" : "warning"} text-xs`}>
                                        {student.registration_status || "غير محدد"}
                                      </span>
                                    </TableCell>
                                    <TableCell>{student.mosque_name || "-"}</TableCell>
                                    <TableCell>
                                      {status === "غير مدرج بعد" || status === "فترة تجربة" ? (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            className={`${status === "غير مدرج بعد" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-primary hover:bg-primary/90"} text-white`}
                                            onClick={() => {
                                              setSelectedStudentForEdit(student);
                                              setEditDialogOpen(true);
                                            }}
                                          >
                                            <Edit className="w-3.5 h-3.5 ml-1" />
                                            {status === "غير مدرج بعد" ? "استكمال" : "تعديل"}
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="outline">
                                                <MoreVertical className="w-3.5 h-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-background z-50">
                                              <DropdownMenuItem
                                                onClick={() => handleDeleteClick(student.id)}
                                                className="text-destructive cursor-pointer"
                                              >
                                                <Trash2 className="w-4 h-4 ml-2" />
                                                حذف
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      ) : status === "غير مسجل" ? (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setSelectedStudentForReactivate({ id: student.id, name: student.student_name });
                                              setReactivateDialogOpen(true);
                                            }}
                                          >
                                            <RefreshCcw className="w-3.5 h-3.5 ml-1" />
                                            إعادة التسجيل
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="outline">
                                                <MoreVertical className="w-3.5 h-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-background z-50">
                                              <DropdownMenuItem
                                                onClick={() => {
                                                  setSelectedStudentForEdit(student);
                                                  setEditDialogOpen(true);
                                                }}
                                                className="cursor-pointer"
                                              >
                                                <Edit className="w-4 h-4 ml-2" />
                                                تعديل
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                onClick={() => handleDeleteClick(student.id)}
                                                className="text-destructive cursor-pointer"
                                              >
                                                <Trash2 className="w-4 h-4 ml-2" />
                                                حذف نهائياً
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      ) : (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="outline" className="gap-1">
                                              <MoreVertical className="w-3.5 h-3.5" />
                                              خيارات
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="bg-background z-50">
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setSelectedStudentForEdit(student);
                                                setEditDialogOpen(true);
                                              }}
                                              className="cursor-pointer"
                                            >
                                              <Edit className="w-4 h-4 ml-2" />
                                              تعديل
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {student.phone && (
                                              <>
                                                <DropdownMenuItem onClick={() => handleCall(student.phone)} className="cursor-pointer">
                                                  <Phone className="w-4 h-4 ml-2" />
                                                  اتصال
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="cursor-pointer">
                                                  <MessageCircle className="w-4 h-4 ml-2" />
                                                  واتساب
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                              </>
                                            )}
                                            <DropdownMenuItem
                                              onClick={() => setSelectedStudentForAccount({ id: student.id, student_name: student.student_name })}
                                              className="cursor-pointer"
                                            >
                                              <UserCheck className="w-4 h-4 ml-2" />
                                              حساب الطالب
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setSelectedStudentForRecord(student);
                                                setRecordDialogOpen(true);
                                              }}
                                              className="cursor-pointer"
                                            >
                                              <Calendar className="w-4 h-4 ml-2" />
                                              سجل الطالب
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => handleDeleteClick(student.id)}
                                              className="text-destructive cursor-pointer"
                                            >
                                              <Trash2 className="w-4 h-4 ml-2" />
                                              حذف
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            ))}
          </div>
        ) : viewMode === "grid" ? (
          <div className="space-y-4">
            {/* زر تحديد الكل في وضع Grid */}
            <div className="flex items-center gap-3 px-2">
              <Checkbox
                id="select-all-grid"
                checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all-grid"
                className="text-sm font-medium cursor-pointer"
              >
                تحديد الكل ({filteredStudents.length} طالب)
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((student) => (
                <div key={student.id} className="stats-card">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar
                          className="h-16 w-16 cursor-pointer border-2 border-border hover:border-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPhotoUrl(student.photo_url);
                            setSelectedStudentName(student.student_name);
                            setSelectedStudentId(student.id);
                            setPhotoViewOpen(true);
                          }}
                        >
                          <AvatarImage src={student.photo_url || undefined} alt={student.student_name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                            {student.student_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-1">{student.student_name}</h3>
                          <p className="text-sm text-muted-foreground">{student.grade || "غير محدد"}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                      />
                    </div>

                    <div className="space-y-2 text-sm">
                      {student.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono">{student.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">الأستاذ:</span>
                        <span className="font-medium">
                          {teacherMap[student.teacher_id] || student.current_teacher || "غير محدد"}
                        </span>
                        {student.teacher_changes_count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForRecord(student);
                              setRecordDialogOpen(true);
                            }}
                          >
                            <History className="w-3 h-3 ml-1" />
                            {student.teacher_changes_count} تغيير
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">المسجد:</span>
                        <span>{student.mosque_name || "-"}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="badge-gold">
                          {student.points_balance?.total || 0} نقطة
                        </div>
                        <div className={`badge-${student.registration_status === "مسجل" ? "success" : "warning"} text-xs`}>
                          {student.registration_status || "غير محدد"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full gap-1">
                            <MoreVertical className="w-3.5 h-3.5" />
                            خيارات
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background z-50">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStudentForEdit(student);
                              setEditDialogOpen(true);
                            }}
                            className="cursor-pointer"
                          >
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {student.phone && (
                            <>
                              <DropdownMenuItem onClick={() => handleCall(student.phone)} className="cursor-pointer">
                                <Phone className="w-4 h-4 ml-2" />
                                اتصال
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="cursor-pointer">
                                <MessageCircle className="w-4 h-4 ml-2" />
                                واتساب
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => setSelectedStudentForAccount({ id: student.id, student_name: student.student_name })}
                            className="cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4 ml-2" />
                            حساب الطالب
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStudentForRecord(student);
                              setRecordDialogOpen(true);
                            }}
                            className="cursor-pointer"
                          >
                            <Calendar className="w-4 h-4 ml-2" />
                            سجل الطالب
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(student.id)}
                            className="text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="stats-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="animate-none">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-12">
                      <Checkbox
                        checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-right">اسم الطالب</TableHead>
                    <TableHead className="text-right">رقم الهاتف</TableHead>
                    <TableHead className="text-right">الصف</TableHead>
                    <TableHead className="text-right">اسم الأب</TableHead>
                    <TableHead className="text-right">الحالة الاجتماعية</TableHead>
                    <TableHead className="text-right">اسم الأستاذ</TableHead>
                    <TableHead className="text-right">الأستاذ السابق</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">التسجيل</TableHead>
                    <TableHead className="text-right">المسجد</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-transparent">
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                        />
                      </TableCell>

                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{student.student_name}</span>
                          {student.phone && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleCall(student.phone)}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                onClick={() => handleWhatsApp(student.phone)}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {student.phone || "-"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>{student.grade || "-"}</TableCell>

                      <TableCell>{student.father_name || "-"}</TableCell>

                      <TableCell>
                        <span className="text-sm">{student.social_status || "-"}</span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{teacherMap[student.teacher_id] || student.current_teacher || "غير محدد"}</span>
                          {student.teacher_changes_count > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentForRecord(student);
                                setRecordDialogOpen(true);
                              }}
                            >
                              <History className="w-3 h-3 ml-0.5" />
                              {student.teacher_changes_count}
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {student.previous_teacher || "-"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">{student.address || "-"}</span>
                      </TableCell>

                      <TableCell>
                        <div className={`badge-${student.registration_status === "مسجل" ? "success" : "warning"}`}>
                          {student.registration_status || "غير محدد"}
                        </div>
                      </TableCell>

                      <TableCell>{student.mosque_name || "-"}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                <MoreVertical className="w-3.5 h-3.5" />
                                خيارات
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background z-50">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedStudentForEdit(student);
                                  setEditDialogOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Edit className="w-4 h-4 ml-2" />
                                تعديل
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {student.phone && (
                                <>
                                  <DropdownMenuItem onClick={() => handleCall(student.phone)} className="cursor-pointer">
                                    <Phone className="w-4 h-4 ml-2" />
                                    اتصال
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleWhatsApp(student.phone)} className="cursor-pointer">
                                    <MessageCircle className="w-4 h-4 ml-2" />
                                    واتساب
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => setSelectedStudentForAccount({ id: student.id, student_name: student.student_name })}
                                className="cursor-pointer"
                              >
                                <UserCheck className="w-4 h-4 ml-2" />
                                حساب الطالب
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedStudentForRecord(student);
                                  setRecordDialogOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Calendar className="w-4 h-4 ml-2" />
                                سجل الطالب
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(student.id)}
                                className="text-destructive cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 ml-2" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}


        {filteredStudents.length === 0 && (
          <div className="stats-card text-center py-12">
            <p className="text-muted-foreground text-lg">
              لا توجد نتائج للبحث
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              حاول تغيير معايير البحث أو الفلاتر
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkEditStudentsDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedStudentIds={selectedStudents}
        onSuccess={handleBulkEditSuccess}
        teachers={teachers}
        mosques={mosques}
      />

      <StudentPhotoViewDialog
        open={photoViewOpen}
        onOpenChange={setPhotoViewOpen}
        photoUrl={selectedPhotoUrl}
        studentName={selectedStudentName}
        studentId={selectedStudentId}
        canEdit={true}
        onPhotoUpdate={(newUrl) => {
          // Update the student's photo in the state
          setStudents(prev => prev.map(s =>
            s.id === selectedStudentId ? { ...s, photo_url: newUrl } : s
          ));
          setSelectedPhotoUrl(newUrl);
          fetchStudents();
        }}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {selectedStudents.length} طالب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الترقية السنوية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من ترقية جميع الطلاب إلى الصف التالي؟
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                مثال: الطلاب في الصف الخامس سينتقلون إلى الصف السادس
              </span>
              <br />
              <span className="text-sm text-amber-600 dark:text-amber-400 mt-2 block font-medium">
                ملاحظة: الطلاب في الصف "الثاني عشر" سيتم ترقيتهم إلى "طالب جامعي"، والطلاب الجامعيون لن يتم ترقيتهم.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePromoteStudents}
              disabled={promoting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              تأكيد الترقية
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد التراجع عن الترقية السنوية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تخفيض صفوف جميع الطلاب بمقدار صف واحد؟
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                أمثلة على التخفيض:
              </span>
              <ul className="text-sm text-muted-foreground mt-1 mr-4 list-disc">
                <li>"6 السادس" ← "5 الخامس"</li>
                <li>"طالب جامعي" ← "12 الثاني عشر"</li>
              </ul>
              <br />
              <span className="text-sm text-red-600 dark:text-red-400 mt-2 block font-medium">
                تحذير: سيتم تخفيض جميع الطلاب في النظام (عدا طلاب الصف الأول). هذا الإجراء سيؤثر على جميع الطلاب!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevertPromotion}
              disabled={promoting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              تأكيد التراجع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={skippedDialogOpen} onOpenChange={setSkippedDialogOpen}>
        <AlertDialogContent className="max-w-3xl max-h-[80vh]">
          <AlertDialogHeader>
            <AlertDialogTitle>الطلاب المتخطين ({skippedStudents.length})</AlertDialogTitle>
            <AlertDialogDescription>
              الطلاب التالية أسماؤهم تم تخطيهم أثناء عملية الترقية/التخفيض. يمكنك تعديل صفوفهم يدوياً.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="overflow-y-auto max-h-[50vh] space-y-3 py-4">
            {skippedStudents.map((student) => (
              <div key={student.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                <div className="flex-1">
                  <p className="font-semibold">{student.student_name}</p>
                  <p className="text-sm text-muted-foreground">
                    الصف الحالي: {student.grade || "غير محدد"}
                  </p>
                </div>
                <Select
                  value={editedGrades[student.id] || student.grade || ""}
                  onValueChange={(value) => {
                    setEditedGrades(prev => ({
                      ...prev,
                      [student.id]: value
                    }));
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="اختر الصف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 الأول">1 الأول</SelectItem>
                    <SelectItem value="2 الثاني">2 الثاني</SelectItem>
                    <SelectItem value="3 الثالث">3 الثالث</SelectItem>
                    <SelectItem value="4 الرابع">4 الرابع</SelectItem>
                    <SelectItem value="5 الخامس">5 الخامس</SelectItem>
                    <SelectItem value="6 السادس">6 السادس</SelectItem>
                    <SelectItem value="7 السابع">7 السابع</SelectItem>
                    <SelectItem value="8 الثامن">8 الثامن</SelectItem>
                    <SelectItem value="9 التاسع">9 التاسع</SelectItem>
                    <SelectItem value="10 العاشر">10 العاشر</SelectItem>
                    <SelectItem value="11 الحادي عشر">11 الحادي عشر</SelectItem>
                    <SelectItem value="12 الثاني عشر">12 الثاني عشر</SelectItem>
                    <SelectItem value="طالب جامعي">طالب جامعي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSkippedDialogOpen(false);
              setEditedGrades({});
            }}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveSkippedGrades}
              disabled={Object.keys(editedGrades).length === 0}
            >
              حفظ التعديلات ({Object.keys(editedGrades).length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkDataValidationDialog
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        invalidStudents={invalidStudents}
        totalChecked={validationTotalCount}
        onSave={handleSaveValidationCorrections}
      />

      <StudentAccountDialog
        student={selectedStudentForAccount}
        open={selectedStudentForAccount !== null}
        onOpenChange={(open) => !open && setSelectedStudentForAccount(null)}
      />

      {selectedStudentForEdit && (
        <EditStudentDialog
          student={selectedStudentForEdit}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setSelectedStudentForEdit(null);
            }
          }}
          onSuccess={() => {
            fetchStudents();
            setEditDialogOpen(false);
            setSelectedStudentForEdit(null);
          }}
        />
      )}

      <StudentReactivateDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        studentId={selectedStudentForReactivate?.id || null}
        studentName={selectedStudentForReactivate?.name || ""}
        onSuccess={() => {
          fetchStudents();
          setSelectedStudentForReactivate(null);
        }}
      />

      <StudentRecordDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        student={selectedStudentForRecord}
        onSuccess={fetchStudents}
        isAdmin={true}
      />
      <AlertDialog open={validationScopeOpen} onOpenChange={setValidationScopeOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              تحديد نطاق التحقق
            </AlertDialogTitle>
            <AlertDialogDescription>
              اختر حالة الطلاب الذين تريد التحقق من بياناتهم
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">حالة التسجيل</label>
              <Select value={validationFilter} onValueChange={setValidationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الكل">جميع الطلاب</SelectItem>
                  <SelectItem value="مسجل">مسجل (فقط)</SelectItem>
                  <SelectItem value="غير مدرج بعد">غير مدرج بعد</SelectItem>
                  <SelectItem value="انتظار">انتظار</SelectItem>
                  <SelectItem value="متدرب">متدرب</SelectItem>
                  <SelectItem value="فترة تجربة">فترة تجربة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              سيتم فحص الحقول الناقصة (الاسم، الهاتف، المسجد، الصف، الأستاذ) والتأكد من صحة القيم المدخلة ومطابقتها للقواعد.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleValidateData}>
              بدء التحقق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StudentsManagement;