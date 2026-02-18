import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Trash2, Calendar as CalendarIcon, Database, FileJson, FileSpreadsheet, AlertTriangle, HardDrive, Loader2, Clock, Play, RefreshCw, Check, Save } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

interface BackupRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  date_range_from: string;
  date_range_to: string;
  tables_included: string[];
  created_at: string;
  created_by: string;
}

// الجداول المتاحة للنسخ الاحتياطي مع تحديد إذا كان لها حقل تاريخ
const AVAILABLE_TABLES = [
  // الجداول الأساسية (حرجة - بدون تاريخ)
  { id: "students", label: "الطلاب", required: true, hasDate: false, critical: true, category: "أساسي" },
  { id: "teachers", label: "الأساتذة", required: true, hasDate: false, critical: true, category: "أساسي" },
  { id: "profiles", label: "حسابات المستخدمين", required: false, hasDate: false, critical: true, category: "أساسي" },
  { id: "user_roles", label: "أدوار المستخدمين", required: false, hasDate: false, critical: true, category: "أساسي" },

  // السجلات اليومية (لها حقل تاريخ)
  { id: "attendance", label: "سجلات الحضور", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "recitations", label: "سجلات التسميع", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "bonus_points", label: "النقاط الإضافية", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "check_records", label: "سجلات تفقد الأدوات", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "teaching_sessions", label: "جلسات التدريس", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "activity_logs", label: "سجلات النشاط", required: false, hasDate: true, critical: false, category: "سجلات" },
  { id: "student_teacher_history", label: "سجل تغييرات الأساتذة", required: false, hasDate: true, critical: false, category: "سجلات" },

  // الإعدادات والبيانات الثابتة (بدون تاريخ)
  { id: "points_balance", label: "أرصدة النقاط", required: false, hasDate: false, critical: false, category: "إعدادات" },
  { id: "points_settings", label: "إعدادات النقاط", required: false, hasDate: false, critical: false, category: "إعدادات" },
  { id: "check_items", label: "أنواع الأدوات", required: false, hasDate: false, critical: false, category: "إعدادات" },
  { id: "classes", label: "الصفوف", required: false, hasDate: false, critical: false, category: "إعدادات" },
  { id: "mosques", label: "المساجد", required: false, hasDate: false, critical: false, category: "إعدادات" },

  // بيانات إضافية (بدون تاريخ)
  { id: "student_notes", label: "ملاحظات الطلاب", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "students_profiles", label: "ملفات الطلاب", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "monthly_reports", label: "التقارير الشهرية", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "competitions", label: "المسابقات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "competition_results", label: "نتائج المسابقات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "guardianships", label: "أولياء الأمور", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "tool_loss_history", label: "تاريخ فقدان الأدوات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "tool_reissues", label: "إعادة إصدار الأدوات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "notifications", label: "الإشعارات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "grade_promotions", label: "ترقيات الصفوف", required: false, hasDate: false, critical: false, category: "إضافي" },

  // نظام الاستبيانات
  { id: "surveys", label: "الاستبيانات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "survey_questions", label: "أسئلة الاستبيانات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "survey_submissions", label: "تقديمات الاستبيانات", required: false, hasDate: true, critical: false, category: "إضافي" },
  { id: "survey_responses", label: "إجابات الاستبيانات", required: false, hasDate: false, critical: false, category: "إضافي" },
  { id: "survey_activity_logs", label: "سجلات نشاط الاستبيانات", required: false, hasDate: true, critical: false, category: "إضافي" },
];

const BackupManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Export state
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedTables, setSelectedTables] = useState<string[]>(["students", "teachers"]);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [downloadedBackupData, setDownloadedBackupData] = useState<any>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importPreview, setImportPreview] = useState<any>(null);

  // Reset state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // Backups list
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  // Auto backup state
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<BackupRecord | null>(null);

  // Auto backup settings and import dialog
  const [autoBackupSettings, setAutoBackupSettings] = useState({
    retentionCount: 30,
    fullBackupOnly: true,
  });
  const [intervalDays, setIntervalDays] = useState(7);
  const [savingCronSettings, setSavingCronSettings] = useState(false);
  const [showImportFromAutoDialog, setShowImportFromAutoDialog] = useState(false);
  const [selectedAutoBackupForImport, setSelectedAutoBackupForImport] = useState<BackupRecord | null>(null);
  const [importConfirmText, setImportConfirmText] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }

    setUser(parsedUser);
    fetchBackups();
  }, [navigate]);

  const fetchBackups = async () => {
    try {
      const { data, error } = await supabase
        .from("backups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBackups(data || []);
    } catch (error) {
      console.error("Error fetching backups:", error);
      toast.error("حدث خطأ في جلب النسخ الاحتياطية");
    }
  };

  const handleTableToggle = (tableId: string, required: boolean) => {
    if (required) return;

    setSelectedTables(prev =>
      prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const handleSelectAllTables = () => {
    if (selectedTables.length === AVAILABLE_TABLES.length) {
      // إلغاء التحديد - الإبقاء فقط على الجداول المطلوبة
      setSelectedTables(AVAILABLE_TABLES.filter(t => t.required).map(t => t.id));
    } else {
      // تحديد الكل
      setSelectedTables(AVAILABLE_TABLES.map(t => t.id));
    }
  };

  const handleSetDateRange = (range: 'month' | 'sixMonths' | 'year' | 'all') => {
    const today = new Date();
    const newDateTo = today;
    let newDateFrom: Date;

    switch (range) {
      case 'month':
        newDateFrom = new Date(today);
        newDateFrom.setMonth(today.getMonth() - 1);
        break;
      case 'sixMonths':
        newDateFrom = new Date(today);
        newDateFrom.setMonth(today.getMonth() - 6);
        break;
      case 'year':
        newDateFrom = new Date(today);
        newDateFrom.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        newDateFrom = new Date('2020-01-01'); // تاريخ بداية النظام
        break;
    }

    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
  };

  const handleCreateBackup = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("يرجى اختيار نطاق التاريخ");
      return;
    }

    setLoading(true);
    try {
      // تحديد الجداول التي لها حقل تاريخ والتي ليس لها
      const tablesWithDate = selectedTables.filter(t => {
        const table = AVAILABLE_TABLES.find(at => at.id === t);
        return table?.hasDate === true;
      });
      const tablesWithoutDate = selectedTables.filter(t => {
        const table = AVAILABLE_TABLES.find(at => at.id === t);
        return table?.hasDate === false;
      });

      const { data, error } = await supabase.functions.invoke("create-backup", {
        body: {
          dateFrom: format(dateFrom, "yyyy-MM-dd"),
          dateTo: format(dateTo, "yyyy-MM-dd"),
          tables: selectedTables,
          tablesWithDate,
          tablesWithoutDate,
          format: exportFormat,
        },
      });

      if (error) throw error;

      // تحميل الملف على الجهاز
      let blob: Blob;
      let fileName: string;

      if (exportFormat === "json") {
        blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: "application/json",
        });
        fileName = `backup_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.json`;
      } else {
        // Create ZIP file with CSV files
        const zip = new JSZip();
        const csvData = data.data as Record<string, string>;

        // Add each CSV file to the ZIP
        for (const [tableName, csvContent] of Object.entries(csvData)) {
          if (csvContent && typeof csvContent === 'string' && csvContent.trim()) {
            zip.file(`${tableName}.csv`, csvContent);
          }
        }

        // Generate ZIP blob
        blob = await zip.generateAsync({ type: 'blob' });
        fileName = `backup_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.zip`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("تم تحميل النسخة الاحتياطية بنجاح!");

      // حفظ البيانات لعرض dialog
      setDownloadedBackupData({
        blob,
        fileName: fileName,
        dateFrom: format(dateFrom, "yyyy-MM-dd"),
        dateTo: format(dateTo, "yyyy-MM-dd"),
        tables: selectedTables,
        format: exportFormat,
      });

      setShowSaveDialog(true);
    } catch (error) {
      console.error("Error creating backup:", error);
      toast.error("حدث خطأ في إنشاء النسخة الاحتياطية");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!downloadedBackupData) return;

    setLoading(true);
    try {
      // رفع الملف إلى Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("backups")
        .upload(downloadedBackupData.fileName, downloadedBackupData.blob);

      if (uploadError) throw uploadError;

      // حفظ السجل في جدول backups
      const { error: insertError } = await supabase.from("backups").insert({
        file_name: downloadedBackupData.fileName,
        file_size: downloadedBackupData.blob.size,
        file_type: downloadedBackupData.format,
        file_url: uploadData.path,
        date_range_from: downloadedBackupData.dateFrom,
        date_range_to: downloadedBackupData.dateTo,
        tables_included: downloadedBackupData.tables,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      toast.success("تم حفظ النسخة في قاعدة البيانات بنجاح!");
      setShowSaveDialog(false);
      setDownloadedBackupData(null);
      fetchBackups();
    } catch (error) {
      console.error("Error saving backup to database:", error);
      toast.error("حدث خطأ في حفظ النسخة");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (backup: BackupRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from("backups")
        .download(backup.file_url);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.file_name;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("تم تحميل النسخة الاحتياطية");
    } catch (error) {
      console.error("Error downloading backup:", error);
      toast.error("حدث خطأ في تحميل النسخة");
    }
  };

  const handleDeleteBackup = async (backup: BackupRecord) => {
    if (!confirm("هل أنت متأكد من حذف هذه النسخة الاحتياطية؟")) return;

    try {
      // حذف الملف من Storage
      const { error: storageError } = await supabase.storage
        .from("backups")
        .remove([backup.file_url]);

      if (storageError) throw storageError;

      // حذف السجل من الجدول
      const { error: deleteError } = await supabase
        .from("backups")
        .delete()
        .eq("id", backup.id);

      if (deleteError) throw deleteError;

      toast.success("تم حذف النسخة الاحتياطية");
      fetchBackups();
    } catch (error) {
      console.error("Error deleting backup:", error);
      toast.error("حدث خطأ في حذف النسخة");
    }
  };

  const handleImportBackup = async () => {
    if (!importFile) {
      toast.error("يرجى اختيار ملف للاستيراد");
      return;
    }

    setLoading(true);
    try {
      const fileContent = await importFile.text();
      const backupData = JSON.parse(fileContent);

      const { error } = await supabase.functions.invoke("import-backup", {
        body: {
          data: backupData,
          mode: importMode,
        },
      });

      if (error) throw error;

      toast.success("تم استيراد النسخة الاحتياطية بنجاح!");
      setImportFile(null);
      setImportPreview(null);
    } catch (error) {
      console.error("Error importing backup:", error);
      toast.error("حدث خطأ في استيراد النسخة");
    } finally {
      setLoading(false);
    }
  };

  const handleResetYear = async () => {
    if (resetConfirmText !== "تأكيد الحذف") {
      toast.error("يرجى كتابة 'تأكيد الحذف' للمتابعة");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("reset-year");

      if (error) throw error;

      toast.success("تم إعادة تعيين السنة بنجاح!");
      setShowResetDialog(false);
      setResetConfirmText("");
    } catch (error) {
      console.error("Error resetting year:", error);
      toast.error("حدث خطأ في إعادة تعيين السنة");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // تشغيل النسخ الاحتياطي التلقائي يدوياً
  const handleTriggerAutoBackup = async (type: 'daily' | 'weekly' | 'monthly' | 'full') => {
    setAutoBackupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", {
        body: {
          type,
          triggeredBy: 'manual',
          retentionCount: autoBackupSettings.retentionCount,
          fullBackupOnly: autoBackupSettings.fullBackupOnly,
        },
      });

      if (error) throw error;

      toast.success(`تم إنشاء النسخة الاحتياطية ${type === 'daily' ? 'اليومية' : type === 'weekly' ? 'الأسبوعية' : type === 'monthly' ? 'الشهرية' : 'الكاملة'} بنجاح!`);
      fetchBackups();
    } catch (error) {
      console.error("Error triggering auto backup:", error);
      toast.error("حدث خطأ في إنشاء النسخة الاحتياطية التلقائية");
    } finally {
      setAutoBackupLoading(false);
    }
  };

  // استيراد من نسخة تلقائية
  const handleImportFromAutoBackup = async () => {
    if (!selectedAutoBackupForImport) return;

    if (importMode === 'replace' && importConfirmText !== 'استيراد') {
      toast.error("يرجى كتابة 'استيراد' للتأكيد");
      return;
    }

    setLoading(true);
    try {
      // تحميل محتوى النسخة من Storage
      const { data, error: downloadError } = await supabase.storage
        .from("backups")
        .download(selectedAutoBackupForImport.file_url);

      if (downloadError) throw downloadError;

      const fileContent = await data.text();
      const backupData = JSON.parse(fileContent);

      // استدعاء دالة الاستيراد
      const { error } = await supabase.functions.invoke("import-backup", {
        body: {
          data: backupData,
          mode: importMode,
        },
      });

      if (error) throw error;

      toast.success("تم استيراد النسخة الاحتياطية بنجاح!");
      setShowImportFromAutoDialog(false);
      setSelectedAutoBackupForImport(null);
      setImportConfirmText("");
      setImportMode("merge");
    } catch (error) {
      console.error("Error importing backup:", error);
      toast.error("حدث خطأ في استيراد النسخة");
    } finally {
      setLoading(false);
    }
  };

  // الحصول على آخر نسخة تلقائية
  useEffect(() => {
    const autoBackup = backups.find(b => b.file_name.startsWith('auto-backup_'));
    if (autoBackup) {
      setLastAutoBackup(autoBackup);
    }
  }, [backups]);

  return (
    <DashboardLayout title="💾 إدارة النسخ الاحتياطي" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="export" dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="export">📦 تصدير</TabsTrigger>
            <TabsTrigger value="auto">⏰ تلقائي</TabsTrigger>
            <TabsTrigger value="import">📥 استيراد</TabsTrigger>
            <TabsTrigger value="reset">🗑️ سنة جديدة</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>إنشاء نسخة احتياطية جديدة</CardTitle>
                <CardDescription>اختر نطاق التاريخ والجداول والصيغة للتصدير</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>من تاريخ</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-right", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "PPP", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>إلى تاريخ</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-right", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "PPP", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Quick Date Range Buttons */}
                <div className="space-y-2">
                  <Label>فترات سريعة</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDateRange('month')}
                      className="text-sm"
                    >
                      آخر شهر
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDateRange('sixMonths')}
                      className="text-sm"
                    >
                      آخر 6 أشهر
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDateRange('year')}
                      className="text-sm"
                    >
                      آخر سنة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDateRange('all')}
                      className="text-sm"
                    >
                      جميع البيانات
                    </Button>
                  </div>
                </div>

                {/* Tables Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>الجداول المراد تصديرها ({selectedTables.length} من {AVAILABLE_TABLES.length})</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTables(AVAILABLE_TABLES.filter(t => t.critical).map(t => t.id));
                          toast.info("تم تحديد الجداول الحرجة فقط");
                        }}
                        className="text-xs h-8"
                      >
                        الحرجة فقط
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSelectAllTables}
                        className="text-xs h-8 bg-green-600 hover:bg-green-700"
                      >
                        {selectedTables.length === AVAILABLE_TABLES.length ? "إلغاء تحديد الكل" : "نسخة كاملة"}
                      </Button>
                    </div>
                  </div>

                  {/* تحذير إذا لم يتم اختيار الجداول الحرجة */}
                  {AVAILABLE_TABLES.filter(t => t.critical && !selectedTables.includes(t.id)).length > 0 && (
                    <Alert className="border-yellow-500 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-700">
                        تحذير: لم يتم اختيار بعض الجداول الحرجة ({AVAILABLE_TABLES.filter(t => t.critical && !selectedTables.includes(t.id)).map(t => t.label).join("، ")})
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* تصنيف الجداول */}
                  {["أساسي", "سجلات", "إعدادات", "إضافي"].map(category => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                        {category === "أساسي" && "🔴 الجداول الأساسية (حرجة)"}
                        {category === "سجلات" && "📊 السجلات اليومية (تُفلتر بالتاريخ)"}
                        {category === "إعدادات" && "⚙️ الإعدادات والبيانات الثابتة"}
                        {category === "إضافي" && "📁 بيانات إضافية"}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {AVAILABLE_TABLES.filter(t => t.category === category).map(table => (
                          <div key={table.id} className={cn(
                            "flex items-center space-x-2 space-x-reverse p-2 rounded border",
                            selectedTables.includes(table.id) ? "bg-primary/5 border-primary/30" : "bg-muted/30",
                            table.critical && "border-red-300"
                          )}>
                            <Checkbox
                              id={table.id}
                              checked={selectedTables.includes(table.id)}
                              onCheckedChange={() => handleTableToggle(table.id, table.required)}
                              disabled={table.required}
                            />
                            <Label htmlFor={table.id} className="cursor-pointer text-sm flex-1">
                              {table.label}
                              {table.required && <span className="text-red-500 mr-1">*</span>}
                              {table.hasDate && <span className="text-xs text-muted-foreground mr-1">(📅)</span>}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <strong>ملاحظة:</strong> الجداول المعلمة بـ (📅) ستُفلتر حسب نطاق التاريخ المحدد، أما البقية فتُنسخ بالكامل.
                  </div>
                </div>

                {/* Export Format */}
                <div className="space-y-2">
                  <Label>صيغة التصدير</Label>
                  <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as "json" | "csv")}>
                    <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3">
                      <RadioGroupItem value="json" id="json" />
                      <Label htmlFor="json" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <FileJson className="w-5 h-5 text-blue-500" />
                          <div>
                            <div className="font-medium">JSON</div>
                            <div className="text-xs text-muted-foreground">ملف واحد شامل (للاستيراد لاحقاً)</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3">
                      <RadioGroupItem value="csv" id="csv" />
                      <Label htmlFor="csv" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-green-500" />
                          <div>
                            <div className="font-medium">CSV</div>
                            <div className="text-xs text-muted-foreground">ملف ZIP لكل جدول (لفتحه في Excel)</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handleCreateBackup} disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <Download className="ml-2 h-4 w-4" />
                      إنشاء وتحميل النسخة الاحتياطية
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Saved Backups */}
            <Card>
              <CardHeader>
                <CardTitle>النسخ الاحتياطية المحفوظة في النظام</CardTitle>
                <CardDescription>يمكنك تحميل النسخ المحفوظة لاحقاً</CardDescription>
              </CardHeader>
              <CardContent>
                {backups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد نسخ احتياطية محفوظة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backups.map(backup => (
                      <div key={backup.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-primary" />
                            <span className="font-medium">{backup.file_name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadBackup(backup)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedAutoBackupForImport(backup);
                                setShowImportFromAutoDialog(true);
                              }}
                              title="استيراد النسخة"
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteBackup(backup)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground flex gap-4">
                          <span>📅 {format(new Date(backup.created_at), "PPP", { locale: ar })}</span>
                          <span>📦 {formatFileSize(backup.file_size)}</span>
                          <span>{backup.file_type === "json" ? "JSON" : "CSV"}</span>
                        </div>
                        {backup.date_range_from && backup.date_range_to && (
                          <div className="text-xs text-muted-foreground">
                            📊 من: {format(new Date(backup.date_range_from), "PPP", { locale: ar })} إلى:{" "}
                            {format(new Date(backup.date_range_to), "PPP", { locale: ar })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto Backup Tab */}
          <TabsContent value="auto" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  النسخ الاحتياطي التلقائي
                </CardTitle>
                <CardDescription>
                  إنشاء نسخ احتياطية تلقائية وجدولة النسخ الدوري
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* إعدادات النسخ التلقائي */}
                <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    ⚙️ إعدادات النسخ التلقائي
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Label className="whitespace-nowrap">عدد النسخ المحفوظة:</Label>
                      <Input
                        type="number"
                        min="5"
                        max="100"
                        value={autoBackupSettings.retentionCount}
                        onChange={(e) => setAutoBackupSettings(prev => ({
                          ...prev,
                          retentionCount: Math.max(5, Math.min(100, parseInt(e.target.value) || 30))
                        }))}
                        className="w-24"
                      />
                      <span className="text-muted-foreground text-sm">نسخة</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="fullBackupOnly"
                        checked={autoBackupSettings.fullBackupOnly}
                        onCheckedChange={(checked) => setAutoBackupSettings(prev => ({
                          ...prev,
                          fullBackupOnly: !!checked
                        }))}
                      />
                      <Label htmlFor="fullBackupOnly" className="cursor-pointer text-sm">
                        نسخ كاملة شاملة لجميع البيانات (موصى به)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* آخر نسخة تلقائية */}
                {lastAutoBackup && (
                  <Alert className="border-green-500 bg-green-50">
                    <HardDrive className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      <strong>آخر نسخة تلقائية:</strong> {lastAutoBackup.file_name}
                      <br />
                      <span className="text-sm">
                        📅 {format(new Date(lastAutoBackup.created_at), "PPP p", { locale: ar })} •
                        📦 {formatFileSize(lastAutoBackup.file_size)}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* أزرار إنشاء نسخة يدوية */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium">إنشاء نسخة احتياطية الآن</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleTriggerAutoBackup('daily')}
                      disabled={autoBackupLoading}
                      className="h-auto py-4 flex flex-col gap-2"
                    >
                      {autoBackupLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 text-blue-500" />
                      )}
                      <span>يومية</span>
                      <span className="text-xs text-muted-foreground">آخر 24 ساعة</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerAutoBackup('weekly')}
                      disabled={autoBackupLoading}
                      className="h-auto py-4 flex flex-col gap-2"
                    >
                      {autoBackupLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <RefreshCw className="w-6 h-6 text-green-500" />
                      )}
                      <span>أسبوعية</span>
                      <span className="text-xs text-muted-foreground">آخر 7 أيام</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleTriggerAutoBackup('monthly')}
                      disabled={autoBackupLoading}
                      className="h-auto py-4 flex flex-col gap-2"
                    >
                      {autoBackupLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <CalendarIcon className="w-6 h-6 text-purple-500" />
                      )}
                      <span>شهرية</span>
                      <span className="text-xs text-muted-foreground">آخر 30 يوم</span>
                    </Button>

                    <Button
                      variant="default"
                      onClick={() => handleTriggerAutoBackup('full')}
                      disabled={autoBackupLoading}
                      className="h-auto py-4 flex flex-col gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {autoBackupLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Database className="w-6 h-6" />
                      )}
                      <span>كاملة</span>
                      <span className="text-xs text-white/80">جميع البيانات</span>
                    </Button>
                  </div>
                </div>

                {/* الجدولة التلقائية */}
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Clock className="w-4 h-4" />
                    الجدولة التلقائية
                  </h4>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-sm">نسخة احتياطية كل</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">يوم</span>

                    <Button
                      size="sm"
                      onClick={async () => {
                        setSavingCronSettings(true);
                        try {
                          const { error } = await supabase.rpc('update_backup_cron_schedule', {
                            p_interval_days: intervalDays
                          });

                          if (error) throw error;

                          toast.success(`تم تحديث الجدولة: نسخة كل ${intervalDays} يوم`);
                        } catch (error: any) {
                          console.error('Error updating cron schedule:', error);
                          toast.error('حدث خطأ في تحديث الجدولة: ' + (error.message || 'خطأ غير معروف'));
                        } finally {
                          setSavingCronSettings(false);
                        }
                      }}
                      disabled={savingCronSettings}
                      className="gap-1"
                    >
                      {savingCronSettings ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      حفظ
                    </Button>
                  </div>

                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    النسخ الاحتياطي التلقائي مُفعّل (الساعة 3 صباحاً بتوقيت UTC)
                  </p>
                </div>

                {/* النسخ التلقائية المحفوظة */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium">النسخ التلقائية المحفوظة</Label>
                  {backups.filter(b => b.file_name.startsWith('auto-backup_')).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>لا توجد نسخ تلقائية محفوظة</p>
                      <p className="text-xs">اضغط على أحد الأزرار أعلاه لإنشاء نسخة</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {backups
                        .filter(b => b.file_name.startsWith('auto-backup_'))
                        .map(backup => (
                          <div key={backup.id} className="border rounded-lg p-3 flex items-center justify-between bg-background">
                            <div className="flex items-center gap-3">
                              <HardDrive className="w-5 h-5 text-green-500" />
                              <div>
                                <div className="font-medium text-sm">{backup.file_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  📅 {format(new Date(backup.created_at), "PPP p", { locale: ar })} •
                                  📦 {formatFileSize(backup.file_size)}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleDownloadBackup(backup)}>
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedAutoBackupForImport(backup);
                                  setShowImportFromAutoDialog(true);
                                }}
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteBackup(backup)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    * يتم الاحتفاظ بآخر {autoBackupSettings.retentionCount} نسخة تلقائية فقط، ويتم حذف الأقدم تلقائياً.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>استيراد نسخة احتياطية</CardTitle>
                <CardDescription>اختر ملف JSON لاستيراده (JSON فقط لضمان سلامة البيانات)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    تأكد من النسخة الاحتياطية قبل الاستيراد. هذه العملية قد تؤثر على البيانات الحالية.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>ملف JSON</Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportFile(file);
                        // يمكن إضافة معاينة للملف هنا
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>وضع الاستيراد</Label>
                  <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as "merge" | "replace")}>
                    <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3">
                      <RadioGroupItem value="merge" id="merge" />
                      <Label htmlFor="merge" className="flex-1 cursor-pointer">
                        <div>
                          <div className="font-medium">دمج مع البيانات الحالية</div>
                          <div className="text-xs text-muted-foreground">إضافة البيانات الجديدة فقط</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3">
                      <RadioGroupItem value="replace" id="replace" />
                      <Label htmlFor="replace" className="flex-1 cursor-pointer">
                        <div>
                          <div className="font-medium">استبدال البيانات الحالية</div>
                          <div className="text-xs text-muted-foreground text-destructive">
                            ⚠️ سيتم حذف البيانات الحالية أولاً
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handleImportBackup} disabled={loading || !importFile} className="w-full" size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <Upload className="ml-2 h-4 w-4" />
                      استيراد النسخة الاحتياطية
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reset Year Tab */}
          <TabsContent value="reset" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>إعادة تعيين السنة - بدء سنة جديدة</CardTitle>
                <CardDescription>حذف السجلات السنوية والاحتفاظ بالبيانات الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>تحذير:</strong> هذه العملية ستحذف جميع السجلات السنوية (الحضور، التسميع، النقاط، إلخ) بشكل دائم!
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ ما سيبقى (لن يُحذف):</h4>
                  <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                    <li>بيانات الطلاب الأساسية</li>
                    <li>بيانات الأساتذة</li>
                    <li>حسابات المستخدمين والصلاحيات</li>
                    <li>المساجد والصفوف</li>
                    <li>إعدادات أدوات التفقد</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">❌ ما سيُحذف:</h4>
                  <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                    <li>سجلات الحضور والتسميع</li>
                    <li>النقاط (سيُعاد تعيينها لصفر)</li>
                    <li>سجلات تفقد الأدوات</li>
                    <li>ملاحظات الطلاب</li>
                    <li>جلسات التدريس</li>
                    <li>سجلات النشاط والإشعارات</li>
                    <li>المسابقات ونتائجها</li>
                  </ul>
                </div>

                <Alert>
                  <AlertDescription>
                    💾 سيتم إنشاء نسخة احتياطية تلقائية بصيغة JSON قبل الحذف
                  </AlertDescription>
                </Alert>

                <Button onClick={() => setShowResetDialog(true)} variant="destructive" className="w-full" size="lg">
                  <Trash2 className="ml-2 h-4 w-4" />
                  إعادة تعيين السنة - بدء سنة جديدة
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Save to Database Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ تم تحميل النسخة الاحتياطية بنجاح!</DialogTitle>
            <DialogDescription>هل تريد حفظ نسخة في النظام أيضاً؟</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">📌 الفوائد:</h4>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>إمكانية تحميل النسخة من أي جهاز لاحقاً</li>
                <li>الاحتفاظ بسجل النسخ الاحتياطية</li>
                <li>استيراد النسخة بسهولة من داخل النظام</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              لا، شكراً
            </Button>
            <Button onClick={handleSaveToDatabase} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "نعم، احفظ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ تأكيد إعادة تعيين السنة</DialogTitle>
            <DialogDescription>هذه العملية لا يمكن التراجع عنها!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                سيتم حذف جميع السجلات السنوية بشكل دائم. سيتم إنشاء نسخة احتياطية تلقائية قبل الحذف.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>للمتابعة، اكتب "تأكيد الحذف"</Label>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="تأكيد الحذف"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleResetYear} disabled={loading || resetConfirmText !== "تأكيد الحذف"}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "تأكيد الحذف"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Auto Backup Dialog */}
      <Dialog open={showImportFromAutoDialog} onOpenChange={(open) => {
        setShowImportFromAutoDialog(open);
        if (!open) {
          setImportConfirmText("");
          setImportMode("merge");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد استيراد النسخة الاحتياطية
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* معلومات النسخة */}
            {selectedAutoBackupForImport && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <p className="font-medium text-sm">{selectedAutoBackupForImport.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  📅 {format(new Date(selectedAutoBackupForImport.created_at), "PPP p", { locale: ar })}
                </p>
                <p className="text-sm text-muted-foreground">
                  📦 {formatFileSize(selectedAutoBackupForImport.file_size)}
                </p>
              </div>
            )}

            {/* تحذيرات */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>⚠️ تحذير هام:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>قد يتم <strong>استبدال البيانات الحالية</strong> ببيانات النسخة</li>
                  <li>هذه العملية <strong>لا يمكن التراجع عنها</strong></li>
                  <li>تأكد من أخذ نسخة احتياطية للبيانات الحالية أولاً</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* وضع الاستيراد */}
            <div className="space-y-2">
              <Label>وضع الاستيراد</Label>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as "merge" | "replace")}>
                <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3">
                  <RadioGroupItem value="merge" id="auto-merge" />
                  <Label htmlFor="auto-merge" className="flex-1 cursor-pointer">
                    <div className="font-medium">دمج (آمن)</div>
                    <div className="text-xs text-muted-foreground">إضافة البيانات الجديدة فقط دون حذف الموجودة</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                  <RadioGroupItem value="replace" id="auto-replace" />
                  <Label htmlFor="auto-replace" className="flex-1 cursor-pointer">
                    <div className="font-medium text-destructive">استبدال كامل (خطر)</div>
                    <div className="text-xs text-destructive/80">⚠️ حذف البيانات الحالية واستبدالها ببيانات النسخة</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* حقل التأكيد للاستبدال */}
            {importMode === 'replace' && (
              <div className="space-y-2">
                <Label className="text-destructive">للمتابعة، اكتب "استيراد" للتأكيد:</Label>
                <Input
                  value={importConfirmText}
                  onChange={(e) => setImportConfirmText(e.target.value)}
                  placeholder="استيراد"
                  className="border-destructive/50"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowImportFromAutoDialog(false);
              setImportConfirmText("");
              setImportMode("merge");
            }}>
              إلغاء
            </Button>
            <Button
              variant={importMode === 'replace' ? 'destructive' : 'default'}
              onClick={handleImportFromAutoBackup}
              disabled={loading || (importMode === 'replace' && importConfirmText !== 'استيراد')}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                "تأكيد الاستيراد"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BackupManagement;
