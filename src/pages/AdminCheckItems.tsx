import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Home, Plus, Save, Printer, Search, X, Trash2, Package, Edit, AlertTriangle, CheckCircle, Clock, ChevronDown, Settings, Users, PackagePlus, FileSpreadsheet, FileText, BarChart3, Download, Eraser } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ToolLossTimeline from "@/components/ToolLossTimeline";

interface CheckItem {
  id: string;
  name: string;
  points: number;
  points_brought: number;
  points_not_brought: number;
  points_skipped: number;
  points_lost: number;
  active: boolean;
}

interface Student {
  id: string;
  student_name: string;
  current_teacher: string;
  mosque_name: string;
  grade: string;
  phone: string;
  student_tools: string[];
}

interface LostTool {
  id: string;
  student_id: string;
  student_name: string;
  item_id: string;
  item_name: string;
  loss_date: string;
  reissue_count: number;
  teacher_name: string;
  status: string;
  reissued_by_admin: boolean;
  reissue_notes?: string;
}

const AdminCheckItems = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newPointsBrought, setNewPointsBrought] = useState<number>(0);
  const [newPointsNotBrought, setNewPointsNotBrought] = useState<number>(0);
  const [newPointsSkipped, setNewPointsSkipped] = useState<number>(0);
  const [newPointsLost, setNewPointsLost] = useState<number>(0);

  // Student tools report states
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [teachers, setTeachers] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    student: "",
    teacher: "",
    tools: [] as string[],
    showWithoutTools: false,
  });

  // Edit student tools dialog
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [studentsWithoutTools, setStudentsWithoutTools] = useState(0);

  // Lost Tools States
  const [lostTools, setLostTools] = useState<LostTool[]>([]);
  const [filteredLostTools, setFilteredLostTools] = useState<LostTool[]>([]);
  const [loadingLostTools, setLoadingLostTools] = useState(false);
  const [reissuingId, setReissuingId] = useState<string | null>(null);

  const [lostToolsFilters, setLostToolsFilters] = useState({
    student: "",
    teacher: "",
    items: [] as string[],
    status: "all",
  });

  const [lostToolsTeachers, setLostToolsTeachers] = useState<string[]>([]);

  const [reissueDialog, setReissueDialog] = useState<{
    open: boolean;
    tool: LostTool | null;
    notes: string;
  }>({
    open: false,
    tool: null,
    notes: "",
  });

  const [timelineDialog, setTimelineDialog] = useState<{
    open: boolean;
    studentId: string;
    itemId: string;
  }>({
    open: false,
    studentId: "",
    itemId: "",
  });

  // Edit lost tool dialog
  const [editLostToolDialog, setEditLostToolDialog] = useState<{
    open: boolean;
    tool: LostTool | null;
    status: string;
    notes: string;
  }>({
    open: false,
    tool: null,
    status: "",
    notes: "",
  });

  const [deletingLostToolId, setDeletingLostToolId] = useState<string | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState("manage");

  // Students list dialog for statistics
  const [studentsListDialog, setStudentsListDialog] = useState<{
    open: boolean;
    title: string;
    students: any[];
  }>({
    open: false,
    title: "",
    students: [],
  });

  // Points settings states
  const [attendanceSettings, setAttendanceSettings] = useState<any[]>([]);
  const [recitationSettings, setRecitationSettings] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Bulk distribution states
  const [bulkDistributionMode, setBulkDistributionMode] = useState<'all' | 'teacher' | 'manual'>('all');
  const [selectedTeacherForBulk, setSelectedTeacherForBulk] = useState<string>('');
  const [selectedStudentsForBulk, setSelectedStudentsForBulk] = useState<string[]>([]);
  const [selectedToolsForBulk, setSelectedToolsForBulk] = useState<string[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<'add' | 'replace'>('add');
  const [isBulkDistributing, setIsBulkDistributing] = useState(false);
  const [isCleaningTools, setIsCleaningTools] = useState(false);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const parsed = JSON.parse(userData);
    if (parsed.role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }
    setUser(parsed);
    fetchItems();
    fetchStudents();
    fetchLostToolsData();
    fetchLostToolsFiltersData();
    fetchPointsSettings();
  }, [navigate]);

  const fetchPointsSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("points_settings")
        .select("*")
        .order("category");

      if (error) throw error;

      const attendance = (data || []).filter(s => s.category === "attendance");
      const recitation = (data || []).filter(s => s.category === "recitation");

      setAttendanceSettings(attendance);
      setRecitationSettings(recitation);
    } catch (e) {
      console.error(e);
    }
  };

  const savePointsSettings = async () => {
    setSavingSettings(true);
    try {
      const allSettings = [...attendanceSettings, ...recitationSettings];

      for (const setting of allSettings) {
        const { error } = await supabase
          .from("points_settings")
          .update({ points: setting.points })
          .eq("id", setting.id);

        if (error) throw error;
      }

      toast.success("تم حفظ إعدادات النقاط بنجاح");
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("check_items")
        .select("id, name, points, points_brought, points_not_brought, points_skipped, points_lost, active")
        .order("active", { ascending: false })
        .order("name");
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
      toast.error("فشل تحميل العناصر");
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newName.trim()) return toast.error("اكتب الاسم");
    try {
      const { error } = await supabase.from("check_items").insert({
        name: newName.trim(),
        points: newPointsBrought,
        points_brought: newPointsBrought,
        points_not_brought: newPointsNotBrought,
        points_skipped: newPointsSkipped,
        points_lost: newPointsLost
      });
      if (error) throw error;
      toast.success("تمت الإضافة");
      setNewName("");
      setNewPointsBrought(0);
      setNewPointsNotBrought(0);
      setNewPointsSkipped(0);
      setNewPointsLost(0);
      setNewPointsSkipped(0);
      setNewPointsLost(-2);
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error("فشل الإضافة");
    }
  };

  const updateItem = async (id: string, changes: Partial<CheckItem>) => {
    try {
      // تحديث الحالة المحلية أولاً للاستجابة الفورية
      setItems(items.map(item =>
        item.id === id ? { ...item, ...changes } : item
      ));

      // ثم حفظ التغييرات في قاعدة البيانات
      const { error } = await supabase.from("check_items").update(changes).eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast.error("فشل التحديث");
      // إعادة جلب البيانات في حالة الخطأ فقط
      fetchItems();
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from("check_items").delete().eq("id", id);
      if (error) throw error;
      toast.success("تم حذف العنصر بنجاح");
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error("فشل حذف العنصر");
    }
  };

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);

      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("student_name");

      if (error) throw error;

      // جلب جميع الطلاب لدعم خيار "الطلاب بدون أدوات"
      setStudents(data || []);
      setFilteredStudents(data || []);

      const uniqueTeachers = [...new Set((data || []).map((s: any) => s.current_teacher).filter(Boolean))];
      setTeachers(uniqueTeachers as string[]);

      // حساب عدد الطلاب المسجلين بدون أدوات
      const registeredStudents = (data || []).filter((s: any) =>
        s.registration_status === "مسجل" || s.registration_status === "غير مدرج بعد" || s.registration_status === "انتظار" || s.registration_status === "فترة تجربة"
      );
      const withoutTools = registeredStudents.filter((s: any) =>
        !s.received_tools || !Array.isArray(s.received_tools) || s.received_tools.length === 0
      );
      setStudentsWithoutTools(withoutTools.length);

    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    let filtered = students;

    if (filters.student) {
      filtered = filtered.filter(s =>
        s.student_name.toLowerCase().includes(filters.student.toLowerCase())
      );
    }

    if (filters.teacher) {
      filtered = filtered.filter(s => s.current_teacher === filters.teacher);
    }

    // فلتر الأدوات المتعددة أو الطلاب بدون أدوات
    if (filters.showWithoutTools) {
      // عرض الطلاب بدون أي أداة
      filtered = filtered.filter(s =>
        !s.received_tools || !Array.isArray(s.received_tools) || s.received_tools.length === 0
      );
    } else if (filters.tools.length > 0) {
      // الطلاب الذين لديهم واحدة على الأقل من الأدوات المحددة
      filtered = filtered.filter(s =>
        s.received_tools &&
        Array.isArray(s.received_tools) &&
        filters.tools.some(toolId => s.received_tools.includes(toolId))
      );
    } else {
      // افتراضياً: عرض الطلاب الذين لديهم أدوات فقط
      filtered = filtered.filter(s =>
        s.received_tools && Array.isArray(s.received_tools) && s.received_tools.length > 0
      );
    }

    setFilteredStudents(filtered);
  }, [filters, students]);

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setFilters({
      student: "",
      teacher: "",
      tools: [],
      showWithoutTools: false,
    });
  };

  const toggleToolFilter = (toolId: string) => {
    setFilters(prev => ({
      ...prev,
      showWithoutTools: false,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(id => id !== toolId)
        : [...prev.tools, toolId]
    }));
  };

  const toggleWithoutTools = () => {
    setFilters(prev => ({
      ...prev,
      tools: [],
      showWithoutTools: !prev.showWithoutTools
    }));
  };

  // Lost Tools Functions
  const fetchLostToolsFiltersData = async () => {
    try {
      const { data: teachersData } = await supabase
        .from("teachers")
        .select("اسم الاستاذ");

      if (teachersData) {
        const uniqueTeachers = [...new Set(teachersData.map(t => t["اسم الاستاذ"]))];
        setLostToolsTeachers(uniqueTeachers as string[]);
      }
    } catch (error) {
      console.error("Error fetching lost tools filters data:", error);
    }
  };

  const fetchLostToolsData = async () => {
    setLoadingLostTools(true);
    try {
      const { data: toolReissues, error } = await supabase
        .from("tool_reissues")
        .select(`
          id,
          student_id,
          item_id,
          loss_date,
          reissue_count,
          status,
          reissued_by_admin,
          reissue_notes
        `)
        .order("loss_date", { ascending: false });

      if (error) throw error;

      if (!toolReissues || toolReissues.length === 0) {
        setLostTools([]);
        setFilteredLostTools([]);
        return;
      }

      const studentIds = [...new Set(toolReissues.map(t => t.student_id))];
      const { data: students } = await supabase
        .from("students")
        .select("id, student_name, current_teacher")
        .in("id", studentIds);

      const itemIds = [...new Set(toolReissues.map(t => t.item_id))];
      const { data: checkItems } = await supabase
        .from("check_items")
        .select("id, name")
        .in("id", itemIds);

      const studentMap = new Map(students?.map(s => [s.id, s]) || []);
      const itemMap = new Map(checkItems?.map(i => [i.id, i]) || []);

      const enrichedData: LostTool[] = toolReissues.map(tool => {
        const student = studentMap.get(tool.student_id);
        const item = itemMap.get(tool.item_id);

        return {
          ...tool,
          student_name: student?.student_name || "غير معروف",
          teacher_name: student?.current_teacher || "غير معروف",
          item_name: item?.name || "غير معروف",
        };
      });

      setLostTools(enrichedData);
      setFilteredLostTools(enrichedData);
    } catch (error) {
      console.error("Error fetching lost tools:", error);
      toast.error("حدث خطأ في تحميل بيانات الأدوات المفقودة");
    } finally {
      setLoadingLostTools(false);
    }
  };

  useEffect(() => {
    let filtered = lostTools;

    if (lostToolsFilters.student) {
      filtered = filtered.filter(t =>
        t.student_name.toLowerCase().includes(lostToolsFilters.student.toLowerCase())
      );
    }

    if (lostToolsFilters.teacher) {
      filtered = filtered.filter(t => t.teacher_name === lostToolsFilters.teacher);
    }

    if (lostToolsFilters.items.length > 0) {
      filtered = filtered.filter(t => lostToolsFilters.items.includes(t.item_id));
    }

    if (lostToolsFilters.status !== "all") {
      filtered = filtered.filter(t => t.status === lostToolsFilters.status);
    }

    setFilteredLostTools(filtered);
  }, [lostToolsFilters, lostTools]);

  const handleReissue = async () => {
    if (!reissueDialog.tool || !user?.id) return;

    const toolId = reissueDialog.tool.id;
    setReissuingId(toolId);

    try {
      const { error: updateError } = await supabase
        .from("tool_reissues")
        .update({
          status: "reissued",
          reissued_by_admin: true,
          reissue_admin_id: user.id,
          reissue_notes: reissueDialog.notes,
          last_reissue_date: new Date().toISOString().split('T')[0],
        })
        .eq("id", toolId);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from("tool_loss_history")
        .insert({
          student_id: reissueDialog.tool.student_id,
          item_id: reissueDialog.tool.item_id,
          event_type: "reissue",
          handled_by: user.id,
          notes: reissueDialog.notes,
        });

      if (historyError) throw historyError;

      const { data: teacherData } = await supabase
        .from("teachers")
        .select("user_id")
        .eq("اسم الاستاذ", reissueDialog.tool.teacher_name)
        .single();

      if (teacherData?.user_id) {
        await supabase
          .from("notifications")
          .insert({
            title: "تم إعادة إصدار أداة",
            message: `تم إعادة إصدار ${reissueDialog.tool.item_name} للطالب ${reissueDialog.tool.student_name}. يمكنك الآن تفقدها بشكل طبيعي.`,
            type: "info",
            target_role: "teacher",
            read: false,
          });
      }

      toast.success("تم إعادة إصدار الأداة بنجاح");
      setReissueDialog({ open: false, tool: null, notes: "" });
      fetchLostToolsData();
    } catch (error: any) {
      console.error("Error reissuing tool:", error);
      toast.error("حدث خطأ: " + error.message);
    } finally {
      setReissuingId(null);
    }
  };

  const clearLostToolsFilters = () => {
    setLostToolsFilters({
      student: "",
      teacher: "",
      items: [],
      status: "all",
    });
  };

  const toggleLostToolsItemFilter = (itemId: string) => {
    setLostToolsFilters(prev => ({
      ...prev,
      items: prev.items.includes(itemId)
        ? prev.items.filter(id => id !== itemId)
        : [...prev.items, itemId]
    }));
  };

  const handleDeleteLostTool = async (tool: LostTool) => {
    setDeletingLostToolId(tool.id);
    try {
      // حذف السجل من tool_reissues
      const { error: deleteError } = await supabase
        .from("tool_reissues")
        .delete()
        .eq("id", tool.id);

      if (deleteError) throw deleteError;

      // حذف السجلات المرتبطة من tool_loss_history
      await supabase
        .from("tool_loss_history")
        .delete()
        .eq("student_id", tool.student_id)
        .eq("item_id", tool.item_id);

      toast.success("تم حذف السجل بنجاح");
      fetchLostToolsData();
    } catch (error: any) {
      console.error("Error deleting lost tool:", error);
      toast.error("حدث خطأ أثناء الحذف: " + error.message);
    } finally {
      setDeletingLostToolId(null);
    }
  };

  const handleEditLostTool = async () => {
    if (!editLostToolDialog.tool) return;

    try {
      const { error } = await supabase
        .from("tool_reissues")
        .update({
          status: editLostToolDialog.status,
          reissue_notes: editLostToolDialog.notes,
        })
        .eq("id", editLostToolDialog.tool.id);

      if (error) throw error;

      toast.success("تم تحديث السجل بنجاح");
      setEditLostToolDialog({ open: false, tool: null, status: "", notes: "" });
      fetchLostToolsData();
    } catch (error: any) {
      console.error("Error updating lost tool:", error);
      toast.error("حدث خطأ: " + error.message);
    }
  };

  const lostToolsStats = {
    total: lostTools.length,
    lost: lostTools.filter(t => t.status === "lost").length,
    reissued: lostTools.filter(t => t.status === "reissued").length,
  };

  const allTools = items.filter(item => item.active);

  const handleEditTools = (student: any) => {
    setEditingStudent(student);
    setSelectedTools(student.received_tools || []);
  };

  const handleSaveTools = async () => {
    if (!editingStudent) return;

    try {
      const { error } = await supabase
        .from("students")
        .update({ received_tools: selectedTools })
        .eq("id", editingStudent.id);

      if (error) throw error;

      toast.success("تم تحديث الأدوات بنجاح");
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error("Error updating tools:", error);
      toast.error("فشل تحديث الأدوات");
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Bulk distribution computed values
  const studentsForBulkDistribution = useMemo(() => {
    let result = students.filter(s =>
      s.registration_status === "مسجل" ||
      s.registration_status === "انتظار" ||
      s.registration_status === "فترة تجربة" ||
      s.registration_status === "غير مدرج بعد"
    );

    if (bulkDistributionMode === 'teacher' && selectedTeacherForBulk) {
      result = result.filter(s => s.current_teacher === selectedTeacherForBulk);
    }

    return result;
  }, [students, bulkDistributionMode, selectedTeacherForBulk]);

  // Auto-select students when mode changes
  useEffect(() => {
    if (bulkDistributionMode === 'all') {
      setSelectedStudentsForBulk(studentsForBulkDistribution.map(s => s.id));
    } else if (bulkDistributionMode === 'teacher') {
      if (selectedTeacherForBulk) {
        setSelectedStudentsForBulk(studentsForBulkDistribution.map(s => s.id));
      } else {
        setSelectedStudentsForBulk([]);
      }
    } else {
      // manual mode - don't auto-select
      setSelectedStudentsForBulk([]);
    }
  }, [bulkDistributionMode, selectedTeacherForBulk, studentsForBulkDistribution]);

  const handleSelectAllBulkStudents = (checked: boolean) => {
    if (checked) {
      setSelectedStudentsForBulk(studentsForBulkDistribution.map(s => s.id));
    } else {
      setSelectedStudentsForBulk([]);
    }
  };

  const toggleBulkStudent = (studentId: string) => {
    setSelectedStudentsForBulk(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleBulkTool = (toolId: string) => {
    setSelectedToolsForBulk(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const distributionStats = useMemo(() => {
    const selectedStudentsList = students.filter(s =>
      selectedStudentsForBulk.includes(s.id)
    );

    if (selectedToolsForBulk.length === 0) {
      return { total: selectedStudentsForBulk.length, alreadyHave: 0, willReceive: selectedStudentsForBulk.length };
    }

    // الطلاب الذين لديهم جميع الأدوات المختارة مسبقاً
    const alreadyHaveAll = selectedStudentsList.filter(s =>
      selectedToolsForBulk.every(toolId =>
        s.received_tools?.includes(toolId)
      )
    );

    return {
      total: selectedStudentsForBulk.length,
      alreadyHave: distributionMethod === 'add' ? alreadyHaveAll.length : 0,
      willReceive: distributionMethod === 'add'
        ? selectedStudentsForBulk.length - alreadyHaveAll.length
        : selectedStudentsForBulk.length
    };
  }, [selectedStudentsForBulk, selectedToolsForBulk, students, distributionMethod]);

  const handleBulkDistribution = async () => {
    if (selectedStudentsForBulk.length === 0) {
      toast.error("يرجى اختيار طلاب");
      return;
    }
    if (selectedToolsForBulk.length === 0) {
      toast.error("يرجى اختيار أدوات");
      return;
    }

    setIsBulkDistributing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const studentId of selectedStudentsForBulk) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        let newTools: string[];

        if (distributionMethod === 'replace') {
          newTools = [...selectedToolsForBulk];
        } else {
          // إضافة للأدوات الموجودة (بدون تكرار)
          const existingTools = student.received_tools || [];
          newTools = [...new Set([...existingTools, ...selectedToolsForBulk])];
        }

        const { error } = await supabase
          .from("students")
          .update({ received_tools: newTools })
          .eq("id", studentId);

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`تم توزيع الأدوات على ${successCount} طالب بنجاح`);
        fetchStudents();
        // إعادة تعيين الحالة
        setSelectedToolsForBulk([]);
      }

      if (errorCount > 0) {
        toast.error(`فشل توزيع الأدوات على ${errorCount} طالب`);
      }
    } catch (error) {
      console.error("Error in bulk distribution:", error);
      toast.error("حدث خطأ أثناء التوزيع");
    } finally {
      setIsBulkDistributing(false);
    }
  };

  const resetBulkDistribution = () => {
    setBulkDistributionMode('all');
    setSelectedTeacherForBulk('');
    setSelectedStudentsForBulk([]);
    setSelectedToolsForBulk([]);
    setDistributionMethod('add');
  };

  const handleCleanupObsoleteTools = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تنظيف الأدوات المحذوفة؟ سيقوم هذا الإجراء بإزالة أي إشارات لأدوات لم تعد موجودة في النظام من جميع سجلات الطلاب.")) {
      return;
    }

    try {
      setIsCleaningTools(true);

      // 1. جلب الأدوات النشطة
      const activeToolIds = new Set(items.map(item => item.id));

      // 2. جلب جميع الطلاب الذين لديهم أدوات
      const { data: studentsWithTools, error: fetchError } = await supabase
        .from("students")
        .select("id, student_name, received_tools")
        .not("received_tools", "is", null);

      if (fetchError) throw fetchError;
      if (!studentsWithTools || studentsWithTools.length === 0) {
        toast.info("لا يوجد طلاب لديهم أدوات لتنظيفها");
        return;
      }

      let updatedCount = 0;
      const updates = [];

      for (const student of studentsWithTools) {
        const currentTools = student.received_tools || [];
        const cleanedTools = currentTools.filter((id: string) => activeToolIds.has(id));

        if (cleanedTools.length !== currentTools.length) {
          updatedCount++;
          updates.push(
            supabase
              .from("students")
              .update({ received_tools: cleanedTools })
              .eq("id", student.id)
          );
        }
      }

      if (updates.length > 0) {
        // تنفيذ التحديثات في دفعات لتجنب المشاكل
        await Promise.all(updates);
        toast.success(`تم تنظيف سجلات ${updatedCount} طالب بنجاح`);
        fetchStudents();
      } else {
        toast.info("جميع سجلات الطلاب نظيفة بالفعل");
      }

    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("حدث خطأ أثناء تنظيف الأدوات");
    } finally {
      setIsCleaningTools(false);
    }
  };

  const handleBulkRemoval = async () => {
    if (selectedStudentsForBulk.length === 0 || selectedToolsForBulk.length === 0) {
      toast.error("يرجى اختيار الطلاب والأدوات المراد حذفها");
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف ${selectedToolsForBulk.length} أداة مختارة من ${selectedStudentsForBulk.length} طالب؟`)) {
      return;
    }

    try {
      setIsBulkRemoving(true);

      // جلب بيانات الطلاب المحددين
      const { data: studentsToUpdate, error: fetchError } = await supabase
        .from("students")
        .select("id, received_tools")
        .in("id", selectedStudentsForBulk);

      if (fetchError) throw fetchError;

      const toolsToRemove = new Set(selectedToolsForBulk);
      const updates = studentsToUpdate.map(student => {
        const currentTools = student.received_tools || [];
        const updatedTools = currentTools.filter((id: string) => !toolsToRemove.has(id));

        return supabase
          .from("students")
          .update({ received_tools: updatedTools })
          .eq("id", student.id);
      });

      await Promise.all(updates);
      toast.success(`تم حذف الأدوات من ${selectedStudentsForBulk.length} طالب بنجاح`);
      resetBulkDistribution();
      fetchStudents();

    } catch (error) {
      console.error("Bulk removal error:", error);
      toast.error("حدث خطأ أثناء الحذف الجماعي للأدوات");
    } finally {
      setIsBulkRemoving(false);
    }
  };

  return (
    <DashboardLayout title="إدارة الأدوات والتقارير" userName={user?.name}>
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">
                <Home className="w-4 h-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>إدارة الأدوات والتقارير</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Tabs defaultValue="manage" className="w-full" onValueChange={(val) => setActiveTab(val)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="manage" className="flex items-center gap-1.5 px-2">
              <Edit className="w-4 h-4 shrink-0" />
              {activeTab === "manage" && <span className="truncate">إدارة الأدوات</span>}
            </TabsTrigger>
            <TabsTrigger value="report" className="flex items-center gap-1.5 px-2">
              <Printer className="w-4 h-4 shrink-0" />
              {activeTab === "report" && <span className="truncate">تقرير الطلاب</span>}
            </TabsTrigger>
            <TabsTrigger
              value="bulk-distribution"
              className="flex items-center gap-1.5 px-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white text-blue-600"
            >
              <PackagePlus className="w-4 h-4 shrink-0" />
              {activeTab === "bulk-distribution" && <span className="truncate">توزيع بالجملة</span>}
            </TabsTrigger>
            <TabsTrigger
              value="lost-tools"
              className="flex items-center gap-1.5 px-2 data-[state=active]:bg-red-500 data-[state=active]:text-white text-red-600"
            >
              <Package className="w-4 h-4 shrink-0" />
              {activeTab === "lost-tools" && <span className="truncate">المفقودة</span>}
            </TabsTrigger>
            <TabsTrigger
              value="points-settings"
              className="flex items-center gap-1.5 px-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white text-purple-600"
            >
              <Settings className="w-4 h-4 shrink-0" />
              {activeTab === "points-settings" && <span className="truncate">إعدادات النقاط</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-6">
            <div className="stats-card">
              <h3 className="text-lg font-semibold mb-4">إضافة عنصر جديد</h3>
              <div className="space-y-4">
                <div>
                  <Label>الاسم</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: تفقد القبعة" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-green-600">أحضره</Label>
                    <Input
                      type="number"
                      value={newPointsBrought}
                      onChange={(e) => setNewPointsBrought(parseInt(e.target.value || '0'))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-orange-600">لم يحضره</Label>
                    <Input
                      type="number"
                      value={newPointsNotBrought}
                      onChange={(e) => setNewPointsNotBrought(parseInt(e.target.value || '0'))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-blue-600">تجاوز</Label>
                    <Input
                      type="number"
                      value={newPointsSkipped}
                      onChange={(e) => setNewPointsSkipped(parseInt(e.target.value || '0'))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-red-600">فقدان</Label>
                    <Input
                      type="number"
                      value={newPointsLost}
                      onChange={(e) => setNewPointsLost(parseInt(e.target.value || '0'))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={addItem} className="w-full md:w-auto">
                    <Plus className="w-4 h-4 ml-1" /> إضافة
                  </Button>
                </div>
              </div>
            </div>

            <div className="stats-card">
              <h3 className="text-lg font-semibold mb-4">العناصر</h3>
              <div className="space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">جارِ التحميل...</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد عناصر.</p>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <Label className="text-sm font-medium">اسم الأداة</Label>
                          <Input
                            value={it.name}
                            onChange={(e) => updateItem(it.id, { name: e.target.value })}
                            className="mt-1"
                            disabled={!it.active}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">فعال</Label>
                            <Checkbox
                              checked={it.active}
                              onCheckedChange={(v) => updateItem(it.id, { active: !!v })}
                            />
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف العنصر "{it.name}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteItem(it.id)} className="bg-destructive hover:bg-destructive/90">
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs text-green-600">أحضره</Label>
                          <Input
                            type="number"
                            step="0.25"
                            value={it.points_brought}
                            onChange={(e) => updateItem(it.id, { points_brought: parseFloat(e.target.value || '0') })}
                            className="mt-1"
                            disabled={!it.active}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-orange-600">لم يحضره</Label>
                          <Input
                            type="number"
                            step="0.25"
                            value={it.points_not_brought}
                            onChange={(e) => updateItem(it.id, { points_not_brought: parseFloat(e.target.value || '0') })}
                            className="mt-1"
                            disabled={!it.active}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-blue-600">تجاوز</Label>
                          <Input
                            type="number"
                            step="0.25"
                            value={it.points_skipped}
                            onChange={(e) => updateItem(it.id, { points_skipped: parseFloat(e.target.value || '0') })}
                            className="mt-1"
                            disabled={!it.active}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-red-600">فقدان</Label>
                          <Input
                            type="number"
                            step="0.25"
                            value={it.points_lost}
                            onChange={(e) => updateItem(it.id, { points_lost: parseFloat(e.target.value || '0') })}
                            className="mt-1"
                            disabled={!it.active}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="report" className="space-y-6">
            <div className="flex items-center justify-between print:hidden">
              <div>
                <h2 className="text-2xl font-bold">تقرير أدوات الطلاب</h2>
                <p className="text-muted-foreground">عرض وطباعة تقرير شامل لأدوات الطلاب</p>
              </div>
              <Button onClick={handlePrint} variant="outline">
                <Printer className="w-4 h-4 ml-2" />
                طباعة
              </Button>
            </div>

            {/* البحث والفلترة */}
            <Card className="print:hidden">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">بحث حسب اسم الطالب</Label>
                    <Input
                      id="student"
                      value={filters.student}
                      onChange={(e) => setFilters({ ...filters, student: e.target.value })}
                      placeholder="ابحث عن طالب..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teacher">بحث حسب الأستاذ</Label>
                    <Select value={filters.teacher} onValueChange={(value) => setFilters({ ...filters, teacher: value === "all" ? "" : value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر أستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher} value={teacher}>
                            {teacher}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tool">بحث حسب الأداة</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          {filters.showWithoutTools
                            ? "الطلاب بدون أدوات"
                            : filters.tools.length > 0
                              ? `${filters.tools.length} أداة محددة`
                              : "اختر أداة أو أكثر"
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 max-h-80 overflow-y-auto" align="start">
                        <div className="space-y-2">
                          {/* خيار الطلاب بدون أدوات */}
                          <div
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer border-b pb-3 mb-2"
                            onClick={toggleWithoutTools}
                          >
                            <Checkbox
                              checked={filters.showWithoutTools}
                              onCheckedChange={toggleWithoutTools}
                            />
                            <Label className="cursor-pointer flex-1">الطلاب بدون أدوات</Label>
                            <Badge variant="secondary" className="text-xs">
                              {studentsWithoutTools}
                            </Badge>
                          </div>

                          {/* قائمة الأدوات */}
                          <div className="text-xs text-muted-foreground mb-2">الأدوات المتاحة:</div>
                          {allTools.map(tool => {
                            // حساب عدد الطلاب الذين يملكون هذه الأداة
                            const toolStudentCount = students.filter(s =>
                              s.received_tools &&
                              Array.isArray(s.received_tools) &&
                              s.received_tools.includes(tool.id)
                            ).length;

                            return (
                              <div
                                key={tool.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                onClick={() => toggleToolFilter(tool.id)}
                              >
                                <Checkbox
                                  checked={filters.tools.includes(tool.id)}
                                  onCheckedChange={() => toggleToolFilter(tool.id)}
                                />
                                <Label className="cursor-pointer flex-1">{tool.name}</Label>
                                <Badge variant="outline" className="text-xs">
                                  {toolStudentCount}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {(filters.student || filters.teacher || filters.tools.length > 0 || filters.showWithoutTools) && (
                  <div className="flex justify-end mt-4">
                    <Button onClick={clearFilters} variant="ghost" size="sm">
                      <X className="w-4 h-4 ml-2" />
                      مسح الفلاتر
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الجدول */}
            {loadingStudents ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا يوجد طلاب بالأدوات المحددة</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الطالب</TableHead>
                        <TableHead className="text-right">الأستاذ</TableHead>
                        <TableHead className="text-right">المسجد</TableHead>
                        <TableHead className="text-right">الصف</TableHead>
                        <TableHead className="text-right">الأدوات</TableHead>
                        <TableHead className="text-right print:hidden">رقم الهاتف</TableHead>
                        <TableHead className="text-right print:hidden">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.student_name}</TableCell>
                          <TableCell>{student.current_teacher || "غير محدد"}</TableCell>
                          <TableCell>{student.mosque_name || "غير محدد"}</TableCell>
                          <TableCell>{student.grade || "غير محدد"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(student.received_tools || []).map((toolId: string) => {
                                const tool = items.find(item => item.id === toolId);
                                return tool ? (
                                  <Badge key={toolId} variant="secondary">
                                    {tool.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="print:hidden">{student.phone || "غير متوفر"}</TableCell>
                          <TableCell className="print:hidden">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTools(student)}
                            >
                              <Edit className="w-4 h-4 ml-1" />
                              تعديل
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* إحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{filteredStudents.length}</div>
                    <div className="text-sm text-muted-foreground">عدد الطلاب</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{allTools.length}</div>
                    <div className="text-sm text-muted-foreground">أنواع الأدوات</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {filteredStudents.reduce((sum: number, s: any) => sum + (s.received_tools?.length || 0), 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">إجمالي الأدوات المستلمة</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{studentsWithoutTools}</div>
                    <div className="text-sm text-muted-foreground">طلاب مسجلين بدون أدوات</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bulk Distribution Tab */}
          <TabsContent value="bulk-distribution" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <PackagePlus className="w-6 h-6 text-blue-600" />
                  توزيع الأدوات بالجملة
                </h2>
                <p className="text-muted-foreground">توزيع أدوات على مجموعة كبيرة من الطلاب دفعة واحدة</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={resetBulkDistribution}>
                  <X className="w-4 h-4 ml-2" />
                  إعادة تعيين
                </Button>
              </div>
            </div>
            {/* الخطوة 1: اختيار الطلاب */}

            {/* الخطوة 1: اختيار الطلاب */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                  الخطوة 1: اختيار الطلاب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* وضع الاختيار */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-all"
                      name="distribution-mode"
                      checked={bulkDistributionMode === 'all'}
                      onChange={() => setBulkDistributionMode('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Label htmlFor="mode-all" className="cursor-pointer">جميع الطلاب المسجلين</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-teacher"
                      name="distribution-mode"
                      checked={bulkDistributionMode === 'teacher'}
                      onChange={() => setBulkDistributionMode('teacher')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Label htmlFor="mode-teacher" className="cursor-pointer">حلقة أستاذ معين</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-manual"
                      name="distribution-mode"
                      checked={bulkDistributionMode === 'manual'}
                      onChange={() => setBulkDistributionMode('manual')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Label htmlFor="mode-manual" className="cursor-pointer">تحديد يدوي</Label>
                  </div>
                </div>

                {/* اختيار الأستاذ */}
                {bulkDistributionMode === 'teacher' && (
                  <div className="max-w-sm">
                    <Label className="mb-2 block">اختر الأستاذ</Label>
                    <Select
                      value={selectedTeacherForBulk || "all"}
                      onValueChange={(value) => setSelectedTeacherForBulk(value === "all" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر أستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">-- اختر أستاذ --</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher} value={teacher}>
                            {teacher}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* تحديد الكل */}
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-students"
                      checked={selectedStudentsForBulk.length === studentsForBulkDistribution.length && studentsForBulkDistribution.length > 0}
                      onCheckedChange={handleSelectAllBulkStudents}
                    />
                    <Label htmlFor="select-all-students" className="cursor-pointer font-medium">
                      تحديد الكل
                    </Label>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {selectedStudentsForBulk.length} طالب محدد من {studentsForBulkDistribution.length}
                  </Badge>
                </div>

                {/* قائمة الطلاب للتحديد */}
                {(bulkDistributionMode === 'manual' || (bulkDistributionMode === 'teacher' && selectedTeacherForBulk)) && (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {studentsForBulkDistribution.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {bulkDistributionMode === 'teacher' ? 'لا يوجد طلاب في هذه الحلقة' : 'لا يوجد طلاب مسجلين'}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {studentsForBulkDistribution.map((student) => {
                          const getToolName = (toolId: string) => {
                            const tool = items.find(item => item.id === toolId);
                            return tool?.name || 'غير معروف';
                          };
                          return (
                            <div
                              key={student.id}
                              className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleBulkStudent(student.id)}
                            >
                              <Checkbox
                                checked={selectedStudentsForBulk.includes(student.id)}
                                onCheckedChange={() => toggleBulkStudent(student.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium truncate">{student.student_name}</div>
                                  {student.received_tools?.length > 0 && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {student.received_tools.length} أداة
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {student.current_teacher || "بدون أستاذ"} • {student.grade || "غير محدد"}
                                </div>

                                {/* عرض الأدوات التي يمتلكها الطالب */}
                                {student.received_tools?.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {student.received_tools.map((toolId: string) => (
                                      <Badge
                                        key={toolId}
                                        variant="secondary"
                                        className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      >
                                        ✓ {getToolName(toolId)}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-orange-500 mt-1">
                                    ⚠️ لم يستلم أي أداة بعد
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الخطوة 2: اختيار الأدوات */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-green-600" />
                  الخطوة 2: اختيار الأدوات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {allTools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${selectedToolsForBulk.includes(tool.id)
                        ? 'bg-green-50 border-green-500 dark:bg-green-950/30'
                        : 'hover:bg-muted'
                        }`}
                      onClick={() => toggleBulkTool(tool.id)}
                    >
                      <Checkbox
                        checked={selectedToolsForBulk.includes(tool.id)}
                        onCheckedChange={() => toggleBulkTool(tool.id)}
                      />
                      <Label className="cursor-pointer flex-1">{tool.name}</Label>
                    </div>
                  ))}
                </div>
                {selectedToolsForBulk.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    <Badge className="bg-green-600">{selectedToolsForBulk.length} أداة محددة</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({selectedToolsForBulk.map(id => allTools.find(t => t.id === id)?.name).filter(Boolean).join("، ")})
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الخطوة 3: طريقة التوزيع */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-purple-600" />
                  الخطوة 3: طريقة التوزيع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => setDistributionMethod('add')}>
                    <input
                      type="radio"
                      id="method-add"
                      name="distribution-method"
                      checked={distributionMethod === 'add'}
                      onChange={() => setDistributionMethod('add')}
                      className="w-4 h-4 text-blue-600 mt-0.5"
                    />
                    <div>
                      <Label htmlFor="method-add" className="cursor-pointer font-medium">
                        إضافة للأدوات الموجودة
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        يحافظ على الأدوات السابقة ويضيف الأدوات الجديدة فقط (لا يكرر الأدوات الموجودة)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => setDistributionMethod('replace')}>
                    <input
                      type="radio"
                      id="method-replace"
                      name="distribution-method"
                      checked={distributionMethod === 'replace'}
                      onChange={() => setDistributionMethod('replace')}
                      className="w-4 h-4 text-blue-600 mt-0.5"
                    />
                    <div>
                      <Label htmlFor="method-replace" className="cursor-pointer font-medium text-orange-600">
                        استبدال الأدوات
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        يحذف جميع الأدوات السابقة ويضع الأدوات المحددة فقط
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ملخص العملية */}
            {(selectedStudentsForBulk.length > 0 || selectedToolsForBulk.length > 0) && (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader>
                  <CardTitle className="text-lg">ملخص العملية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>{distributionStats.total} طالب محدد</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-600" />
                      <span>{selectedToolsForBulk.length} أداة سيتم توزيعها</span>
                    </div>
                    {distributionMethod === 'add' && distributionStats.alreadyHave > 0 && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{distributionStats.alreadyHave} طالب لديهم جميع الأدوات مسبقاً (سيتم تجاوزهم)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span>{distributionStats.willReceive} طالب سيتم تحديث أدواتهم</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* أزرار التنفيذ */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetBulkDistribution}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkRemoval}
                disabled={isBulkRemoving || isBulkDistributing || selectedStudentsForBulk.length === 0 || selectedToolsForBulk.length === 0}
              >
                {isBulkRemoving ? (
                  <>جاري الحذف...</>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف الأدوات المحددة
                  </>
                )}
              </Button>
              <Button
                onClick={handleBulkDistribution}
                disabled={isBulkDistributing || isBulkRemoving || selectedStudentsForBulk.length === 0 || selectedToolsForBulk.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isBulkDistributing ? (
                  <>جاري التوزيع...</>
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4 ml-2" />
                    توزيع الأدوات ({distributionStats.willReceive} طالب)
                  </>
                )}
              </Button>
            </div>

            {/* إحصائيات توزيع الأدوات */}
            {(() => {
              const allRegisteredStudents = students.filter((s: any) =>
                s.registration_status === "مسجل" ||
                s.registration_status === "انتظار" ||
                s.registration_status === "فترة تجربة"
              );

              const totalStudents = allRegisteredStudents.length;
              const studentsWithToolsList = allRegisteredStudents.filter((s: any) =>
                s.received_tools && s.received_tools.length > 0
              );
              const studentsWithToolsCount = studentsWithToolsList.length;
              const studentsWithoutToolsList = allRegisteredStudents.filter((s: any) =>
                !s.received_tools || s.received_tools.length === 0
              );
              const studentsWithoutToolsCount = studentsWithoutToolsList.length;
              const coveragePercentage = totalStudents > 0
                ? Math.round((studentsWithToolsCount / totalStudents) * 100)
                : 0;

              // حساب توزيع كل أداة
              const toolCountsMap: Record<string, number> = {};
              items.forEach(item => {
                toolCountsMap[item.id] = allRegisteredStudents.filter((s: any) =>
                  s.received_tools?.includes(item.id)
                ).length;
              });

              // دالة للحصول على اسم الأداة
              const getToolNameById = (toolId: string) => {
                const tool = items.find(item => item.id === toolId);
                return tool?.name || 'غير معروف';
              };

              // دالة تصدير Excel
              const exportToExcel = () => {
                const getToolNames = (toolIds: string[]) => {
                  if (!toolIds || toolIds.length === 0) return "لم يستلم أي أداة";
                  return toolIds
                    .map(id => items.find(item => item.id === id)?.name || "غير معروف")
                    .join("، ");
                };

                const csvData: Record<string, string | number>[] = allRegisteredStudents.map((student: any, index: number) => ({
                  "#": index + 1,
                  "اسم الطالب": student.student_name,
                  "الأستاذ": student.current_teacher || "بدون أستاذ",
                  "الصف": student.grade || "غير محدد",
                  "عدد الأدوات": student.received_tools?.length || 0,
                  "الأدوات المستلمة": getToolNames(student.received_tools || [])
                }));

                // إضافة صف الإحصائيات
                csvData.push({});
                csvData.push({ "#": "---", "اسم الطالب": "الإحصائيات", "الأستاذ": "", "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                csvData.push({ "#": "", "اسم الطالب": "إجمالي الطلاب", "الأستاذ": totalStudents.toString(), "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                csvData.push({ "#": "", "اسم الطالب": "استلموا أدوات", "الأستاذ": studentsWithToolsCount.toString(), "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                csvData.push({ "#": "", "اسم الطالب": "بدون أدوات", "الأستاذ": studentsWithoutToolsCount.toString(), "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                csvData.push({ "#": "", "اسم الطالب": "نسبة التغطية", "الأستاذ": coveragePercentage + "%", "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });

                // إضافة توزيع الأدوات
                csvData.push({});
                csvData.push({ "#": "---", "اسم الطالب": "توزيع الأدوات", "الأستاذ": "", "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                items.filter(item => item.active).forEach(tool => {
                  const count = toolCountsMap[tool.id] || 0;
                  const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                  csvData.push({ "#": "", "اسم الطالب": tool.name, "الأستاذ": `${count} طالب (${pct}%)`, "الصف": "", "عدد الأدوات": "", "الأدوات المستلمة": "" });
                });

                const csv = Papa.unparse(csvData, { header: true });
                const bom = '\uFEFF';
                const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `تقرير_توزيع_الأدوات_${new Date().toLocaleDateString('ar-SA')}.csv`;
                link.click();
                URL.revokeObjectURL(url);

                toast.success("تم تصدير التقرير إلى Excel بنجاح");
              };

              // دالة تصدير PDF
              const exportToPDF = async () => {
                const { jsPDF } = await import('jspdf');

                const doc = new jsPDF({
                  orientation: 'portrait',
                  unit: 'mm',
                  format: 'a4',
                });

                doc.setFont("helvetica");
                doc.setFontSize(18);
                doc.setTextColor(0, 0, 0);

                // العنوان
                doc.text("Tool Distribution Report", 105, 20, { align: "center" });
                doc.setFontSize(10);
                doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, 105, 28, { align: "center" });

                // الإحصائيات
                doc.setFontSize(12);
                doc.text("General Statistics:", 20, 45);
                doc.setFontSize(10);
                doc.text(`Total Students: ${totalStudents}`, 25, 55);
                doc.text(`Students with Tools: ${studentsWithToolsCount} (${coveragePercentage}%)`, 25, 62);
                doc.text(`Students without Tools: ${studentsWithoutToolsCount}`, 25, 69);

                // توزيع الأدوات
                doc.setFontSize(12);
                doc.text("Tool Distribution:", 20, 85);
                doc.setFontSize(10);
                let yPos = 95;
                items.filter(item => item.active).forEach(tool => {
                  const count = toolCountsMap[tool.id] || 0;
                  const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                  doc.text(`${tool.name}: ${count} students (${pct}%)`, 25, yPos);
                  yPos += 7;
                });

                // جدول الطلاب
                yPos += 10;
                doc.setFontSize(12);
                doc.text("Student List:", 20, yPos);
                yPos += 10;

                doc.setFontSize(8);
                doc.text("#", 20, yPos);
                doc.text("Student Name", 30, yPos);
                doc.text("Teacher", 80, yPos);
                doc.text("Grade", 120, yPos);
                doc.text("Tools Count", 145, yPos);
                yPos += 5;

                // خط فاصل
                doc.line(20, yPos, 190, yPos);
                yPos += 5;

                allRegisteredStudents.slice(0, 40).forEach((student: any, idx: number) => {
                  if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                  }
                  doc.text((idx + 1).toString(), 20, yPos);
                  doc.text((student.student_name || "").substring(0, 25), 30, yPos);
                  doc.text((student.current_teacher || "-").substring(0, 20), 80, yPos);
                  doc.text((student.grade || "-").substring(0, 15), 120, yPos);
                  doc.text((student.received_tools?.length || 0).toString(), 150, yPos);
                  yPos += 6;
                });

                if (allRegisteredStudents.length > 40) {
                  doc.text(`... and ${allRegisteredStudents.length - 40} more students`, 20, yPos + 5);
                }

                doc.save(`Tool_Distribution_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                toast.success("تم تصدير التقرير إلى PDF بنجاح");
              };

              return (
                <Card className="mt-6 border-t-4 border-t-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        إحصائيات توزيع الأدوات
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={handleCleanupObsoleteTools}
                        disabled={isCleaningTools}
                      >
                        {isCleaningTools ? (
                          <span className="animate-spin ml-2">⏳</span>
                        ) : (
                          <Eraser className="w-4 h-4 ml-2" />
                        )}
                        تنظيف الأدوات المحذوفة (غير معروف)
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* بطاقات الإحصائيات */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-blue-600">
                            {totalStudents}
                          </div>
                          <div className="text-sm text-muted-foreground">إجمالي الطلاب</div>
                        </CardContent>
                      </Card>

                      <Card
                        className="cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
                        onClick={() => setStudentsListDialog({
                          open: true,
                          title: "الطلاب الذين استلموا أدوات",
                          students: studentsWithToolsList
                        })}
                      >
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-green-600">
                            {studentsWithToolsCount}
                          </div>
                          <div className="text-sm text-muted-foreground">استلموا أدوات</div>
                          <div className="text-xs text-primary mt-1">اضغط للتفاصيل</div>
                        </CardContent>
                      </Card>

                      <Card
                        className="cursor-pointer hover:border-orange-400 hover:shadow-md transition-all"
                        onClick={() => setStudentsListDialog({
                          open: true,
                          title: "الطلاب الذين لم يستلموا أي أداة",
                          students: studentsWithoutToolsList
                        })}
                      >
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-orange-600">
                            {studentsWithoutToolsCount}
                          </div>
                          <div className="text-sm text-muted-foreground">بدون أدوات</div>
                          <div className="text-xs text-primary mt-1">اضغط للتفاصيل</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-purple-600">
                            {coveragePercentage}%
                          </div>
                          <div className="text-sm text-muted-foreground">نسبة التغطية</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* توزيع الأدوات حسب النوع */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">توزيع الأدوات حسب النوع</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={exportToExcel}>
                            <FileSpreadsheet className="w-4 h-4 ml-2" />
                            Excel
                          </Button>
                          <Button variant="outline" size="sm" onClick={exportToPDF}>
                            <FileText className="w-4 h-4 ml-2" />
                            PDF
                          </Button>
                        </div>
                      </div>

                      {items.filter(item => item.active).map(tool => {
                        const count = toolCountsMap[tool.id] || 0;
                        const percentage = totalStudents > 0
                          ? Math.round((count / totalStudents) * 100)
                          : 0;

                        return (
                          <div
                            key={tool.id}
                            className="space-y-1 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
                            onClick={() => setStudentsListDialog({
                              open: true,
                              title: `الطلاب الذين استلموا: ${tool.name}`,
                              students: allRegisteredStudents.filter((s: any) => s.received_tools?.includes(tool.id))
                            })}
                          >
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{tool.name}</span>
                              <span className="text-muted-foreground">{count} طالب ({percentage}%)</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                      {items.filter(item => item.active).length === 0 && (
                        <div className="text-center text-muted-foreground py-4">
                          لا توجد أدوات مفعلة
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* Lost Tools Tab */}
          <TabsContent value="lost-tools" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{lostToolsStats.total}</div>
                      <div className="text-sm text-muted-foreground">إجمالي الأدوات المفقودة</div>
                    </div>
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-destructive">{lostToolsStats.lost}</div>
                      <div className="text-sm text-muted-foreground">بانتظار الإعادة</div>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{lostToolsStats.reissued}</div>
                      <div className="text-sm text-muted-foreground">تم إعادة إصدارها</div>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>اسم الطالب</Label>
                    <Input
                      value={lostToolsFilters.student}
                      onChange={(e) => setLostToolsFilters({ ...lostToolsFilters, student: e.target.value })}
                      placeholder="ابحث عن طالب..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>الأستاذ</Label>
                    <Select
                      value={lostToolsFilters.teacher || "all"}
                      onValueChange={(value) => setLostToolsFilters({ ...lostToolsFilters, teacher: value === "all" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر أستاذ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {lostToolsTeachers.map((teacher) => (
                          <SelectItem key={teacher} value={teacher}>
                            {teacher}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الأداة</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {lostToolsFilters.items.length > 0
                            ? `${lostToolsFilters.items.length} أداة محددة`
                            : "اختر أداة أو أكثر"
                          }
                          <ChevronDown className="w-4 h-4 mr-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 max-h-72 overflow-y-auto" align="start">
                        <div className="space-y-1">
                          {items.map(item => {
                            const itemLostCount = lostTools.filter(t => t.item_id === item.id).length;
                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                onClick={() => toggleLostToolsItemFilter(item.id)}
                              >
                                <Checkbox
                                  checked={lostToolsFilters.items.includes(item.id)}
                                  onCheckedChange={() => toggleLostToolsItemFilter(item.id)}
                                />
                                <Label className="cursor-pointer flex-1">{item.name}</Label>
                                <Badge variant="outline" className="text-xs">
                                  {itemLostCount}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>الحالة</Label>
                    <Select
                      value={lostToolsFilters.status}
                      onValueChange={(value) => setLostToolsFilters({ ...lostToolsFilters, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="lost">مفقودة</SelectItem>
                        <SelectItem value="reissued">تم إعادة الإصدار</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(lostToolsFilters.student || lostToolsFilters.teacher || lostToolsFilters.items.length > 0 || lostToolsFilters.status !== "all") && (
                  <Button variant="outline" onClick={clearLostToolsFilters} className="mt-4">
                    مسح الفلاتر
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Lost Tools Table */}
            <Card>
              <CardContent className="pt-6">
                {loadingLostTools ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : filteredLostTools.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد أدوات مفقودة
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الطالب</TableHead>
                          <TableHead>الأداة</TableHead>
                          <TableHead>الأستاذ</TableHead>
                          <TableHead>تاريخ الفقدان</TableHead>
                          <TableHead>عدد مرات الفقدان</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLostTools.map((tool) => (
                          <TableRow key={tool.id}>
                            <TableCell className="font-medium">{tool.student_name}</TableCell>
                            <TableCell>{tool.item_name}</TableCell>
                            <TableCell>{tool.teacher_name}</TableCell>
                            <TableCell>{new Date(tool.loss_date).toLocaleDateString("ar-SA")}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{tool.reissue_count}</Badge>
                            </TableCell>
                            <TableCell>
                              {tool.status === "lost" ? (
                                <Badge variant="destructive">
                                  <AlertTriangle className="w-3 h-3 ml-1" />
                                  مفقودة
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle className="w-3 h-3 ml-1" />
                                  تم الإعادة
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 flex-wrap">
                                {tool.status === "lost" && (
                                  <Button
                                    size="sm"
                                    onClick={() => setReissueDialog({ open: true, tool, notes: "" })}
                                    disabled={reissuingId === tool.id}
                                  >
                                    {reissuingId === tool.id ? "جاري الإعادة..." : "إعادة إصدار"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setTimelineDialog({
                                    open: true,
                                    studentId: tool.student_id,
                                    itemId: tool.item_id,
                                  })}
                                >
                                  <Clock className="w-4 h-4 ml-1" />
                                  السجل
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditLostToolDialog({
                                    open: true,
                                    tool,
                                    status: tool.status,
                                    notes: tool.reissue_notes || "",
                                  })}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      disabled={deletingLostToolId === tool.id}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir="rtl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>حذف سجل الأداة المفقودة</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        هل أنت متأكد من حذف سجل فقدان {tool.item_name} للطالب {tool.student_name}؟
                                        هذا الإجراء لا يمكن التراجع عنه.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteLostTool(tool)}
                                        className="bg-destructive hover:bg-destructive/90"
                                      >
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Points Settings Tab */}
          <TabsContent value="points-settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  إعدادات نقاط الحضور والتسميع
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  تعديل قيم النقاط المحتسبة لكل حالة حضور أو تقييم تسميع
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* نقاط الحضور */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    نقاط الحضور
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {attendanceSettings.map((setting) => (
                      <div key={setting.id} className="space-y-2">
                        <Label className={`font-medium ${setting.key === 'present' ? 'text-green-600' :
                          setting.key === 'absent' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                          {setting.label}
                        </Label>
                        <Input
                          type="number"
                          step="0.25"
                          value={setting.points}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            setAttendanceSettings(prev =>
                              prev.map(s => s.id === setting.id ? { ...s, points: newValue } : s)
                            );
                          }}
                          className="text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* نقاط التسميع */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Edit className="w-5 h-5 text-blue-600" />
                    نقاط التسميع
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recitationSettings.map((setting) => (
                      <div key={setting.id} className="space-y-2">
                        <Label className={`font-medium ${setting.key === 'excellent' ? 'text-green-600' :
                          setting.key === 'good' ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                          {setting.label}
                        </Label>
                        <Input
                          type="number"
                          step="0.25"
                          value={setting.points}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            setRecitationSettings(prev =>
                              prev.map(s => s.id === setting.id ? { ...s, points: newValue } : s)
                            );
                          }}
                          className="text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={savePointsSettings}
                  disabled={savingSettings}
                  className="w-full md:w-auto bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="w-4 h-4 ml-2" />
                  {savingSettings ? "جاري الحفظ..." : "حفظ إعدادات النقاط"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reissue Dialog */}
      <Dialog open={reissueDialog.open} onOpenChange={(open) => !open && setReissueDialog({ open: false, tool: null, notes: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة إصدار الأداة</DialogTitle>
            <DialogDescription>
              سيتم إعادة إصدار {reissueDialog.tool?.item_name} للطالب {reissueDialog.tool?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                value={reissueDialog.notes}
                onChange={(e) => setReissueDialog({ ...reissueDialog, notes: e.target.value })}
                placeholder="أضف أي ملاحظات حول إعادة الإصدار..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReissueDialog({ open: false, tool: null, notes: "" })}>
              إلغاء
            </Button>
            <Button onClick={handleReissue} disabled={reissuingId !== null}>
              {reissuingId !== null ? "جاري الإعادة..." : "تأكيد الإعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={timelineDialog.open} onOpenChange={(open) => !open && setTimelineDialog({ open: false, studentId: "", itemId: "" })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سجل الأداة</DialogTitle>
          </DialogHeader>
          <ToolLossTimeline studentId={timelineDialog.studentId} itemId={timelineDialog.itemId} />
        </DialogContent>
      </Dialog>

      {/* Edit Student Tools Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل أدوات الطالب</DialogTitle>
            <DialogDescription>
              الطالب: {editingStudent?.student_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => toggleTool(tool.id)}
                >
                  <Checkbox
                    checked={selectedTools.includes(tool.id)}
                    onCheckedChange={() => toggleTool(tool.id)}
                  />
                  <Label className="flex-1 cursor-pointer">{tool.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStudent(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveTools}>
              <Save className="w-4 h-4 ml-2" />
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lost Tool Dialog */}
      <Dialog
        open={editLostToolDialog.open}
        onOpenChange={(open) => !open && setEditLostToolDialog({ open: false, tool: null, status: "", notes: "" })}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل سجل الأداة المفقودة</DialogTitle>
            <DialogDescription>
              تعديل سجل {editLostToolDialog.tool?.item_name} للطالب {editLostToolDialog.tool?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select
                value={editLostToolDialog.status}
                onValueChange={(value) => setEditLostToolDialog({ ...editLostToolDialog, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lost">مفقودة</SelectItem>
                  <SelectItem value="reissued">تم الإعادة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={editLostToolDialog.notes}
                onChange={(e) => setEditLostToolDialog({ ...editLostToolDialog, notes: e.target.value })}
                placeholder="أضف ملاحظات..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLostToolDialog({ open: false, tool: null, status: "", notes: "" })}>
              إلغاء
            </Button>
            <Button onClick={handleEditLostTool}>
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Students List Dialog */}
      <Dialog
        open={studentsListDialog.open}
        onOpenChange={(open) => setStudentsListDialog({ ...studentsListDialog, open })}
      >
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{studentsListDialog.title}</DialogTitle>
            <DialogDescription>
              إجمالي: {studentsListDialog.students.length} طالب
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-10">#</TableHead>
                  <TableHead className="text-right">اسم الطالب</TableHead>
                  <TableHead className="text-right">الأستاذ</TableHead>
                  <TableHead className="text-right">الصف</TableHead>
                  <TableHead className="text-right">الأدوات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsListDialog.students.map((student: any, idx: number) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{student.student_name}</TableCell>
                    <TableCell>{student.current_teacher || "-"}</TableCell>
                    <TableCell>{student.grade || "-"}</TableCell>
                    <TableCell>
                      {student.received_tools?.length > 0
                        ? student.received_tools.map((toolId: string) => {
                          const tool = items.find(item => item.id === toolId);
                          return tool?.name || 'غير معروف';
                        }).join("، ")
                        : <span className="text-muted-foreground">لا يوجد</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
                {studentsListDialog.students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      لا يوجد طلاب
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default AdminCheckItems;
