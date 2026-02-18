import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Settings2, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardLayout from "@/components/DashboardLayout";
import { logStudentAdded, logStudentUpdated, logActivity } from "@/lib/activityLogger";
import { BulkDataValidationDialog } from "@/components/BulkDataValidationDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ImportResult {
  row: number;
  studentName: string;
  status: "success" | "error";
  message: string;
}

const FIELD_MAPPING_OPTIONS = [
  { id: "student_name", label: "اسم الطالب", required: true },
  { id: "phone", label: "رقم الهاتف", required: false },
  { id: "grade", label: "الصف", required: false },
  { id: "father_name", label: "اسم الأب", required: false },
  { id: "social_status", label: "الحالة الاجتماعية", required: false },
  { id: "current_teacher", label: "اسم الاستاذ", required: false },
  { id: "previous_teacher", label: "الاستاذ السابق", required: false },
  { id: "address", label: "العنوان", required: false },
  { id: "registration_status", label: "التسجيل", required: false },
  { id: "mosque_name", label: "المسجد", required: false },
];

const StudentsImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [invalidStudents, setInvalidStudents] = useState<any[]>([]);
  const [validatingData, setValidatingData] = useState(false);
  const [teachersImported, setTeachersImported] = useState(false);
  const [teacherStats, setTeacherStats] = useState({ added: 0, existing: 0 });
  const [updateExisting, setUpdateExisting] = useState(true);
  const [updateStrategy, setUpdateStrategy] = useState<"overwrite" | "fill_missing">("overwrite");
  const [skipNewStudents, setSkipNewStudents] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "results">("upload");

  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "خطأ",
        description: "حجم الملف أكبر من 5 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف CSV فقط",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setResults([]);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.meta.fields) {
          setHeaders(result.meta.fields);
          setCsvData(result.data);

          // محاولة الربط التلقائي
          const initialMapping: Record<string, string> = {};
          result.meta.fields.forEach(header => {
            const match = FIELD_MAPPING_OPTIONS.find(opt =>
              opt.label === header || opt.id === header
            );
            if (match) {
              initialMapping[match.id] = header;
            }
          });
          setColumnMapping(initialMapping);
          setStep("mapping");

          toast({
            title: "تم تحميل الملف",
            description: `تم قراءة ${result.data.length} صف`,
          });
        }
      },
      error: (error) => {
        toast({
          title: "خطأ في قراءة الملف",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const findTeacherId = async (teacherName: string): Promise<string | null> => {
    if (!teacherName || teacherName.trim() === "") return null;

    const { data, error } = await supabase
      .from("teachers")
      .select("id")
      .eq("اسم الاستاذ", teacherName.trim())
      .maybeSingle();

    if (error || !data) return null;
    return data.id;
  };

  const normalizePhoneNumber = (phone: string | undefined | null): string | null => {
    if (!phone || typeof phone !== 'string' || phone.trim() === "" || phone === "#ERROR!") return null;

    const cleaned = phone.replace(/\s+/g, '');

    if (cleaned.startsWith('0')) return cleaned;
    if (cleaned.length === 9) return '0' + cleaned;

    return cleaned;
  };

  const handleAutoMap = () => {
    const newMapping: Record<string, string> = {};
    headers.forEach(header => {
      const match = FIELD_MAPPING_OPTIONS.find(opt =>
        opt.label === header || opt.id === header
      );
      if (match) {
        newMapping[match.id] = header;
      }
    });
    setColumnMapping(newMapping);
    toast({ description: "تم الربط التلقائي للأعمدة المتطابقة" });
  };

  const handleClearMap = () => {
    setColumnMapping({});
    toast({ description: "تم إلغاء ربط جميع الحقول" });
  };

  const addMissingTeachers = async () => {
    const loadingToast = sonnerToast.loading("جاري تحليل بيانات الأساتذة من الملف...");

    const teacherColumn = columnMapping["current_teacher"];
    if (!teacherColumn) {
      sonnerToast.dismiss(loadingToast);
      return { added: 0, existing: 0 };
    }

    const teacherNames = new Set<string>();
    csvData.forEach(row => {
      const teacherName = row[teacherColumn]?.trim();
      if (teacherName && teacherName !== "جديد" && teacherName !== "") {
        teacherNames.add(teacherName);
      }
    });

    if (teacherNames.size === 0) {
      sonnerToast.dismiss(loadingToast);
      return { added: 0, existing: 0 };
    }

    const { data: existingTeachers } = await supabase
      .from("teachers")
      .select("اسم الاستاذ")
      .in("اسم الاستاذ", Array.from(teacherNames));

    const existingNames = new Set(existingTeachers?.map(t => t["اسم الاستاذ"]) || []);
    const missingTeachers = Array.from(teacherNames).filter(name => !existingNames.has(name));

    if (missingTeachers.length === 0) {
      sonnerToast.success(`جميع الأساتذة موجودين ✅`, { id: loadingToast });
      return { added: 0, existing: existingNames.size };
    }

    const teachersToAdd = missingTeachers.map(name => ({
      "اسم الاستاذ": name,
      "حالة_الطلب": "مقبول",
    }));

    const { error } = await supabase.from("teachers").insert(teachersToAdd);

    if (error) {
      sonnerToast.error(`خطأ في إضافة الأساتذة: ${error.message}`, { id: loadingToast });
      return { added: 0, existing: existingNames.size };
    }

    sonnerToast.success(`تمت إضافة ${missingTeachers.length} أستاذ جديد ✅`, { id: loadingToast });
    return { added: missingTeachers.length, existing: existingNames.size };
  };

  const handleImport = async () => {
    if (!columnMapping["student_name"]) {
      toast({
        title: "خطأ",
        description: "يجب تحديد عمود اسم الطالب",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    sonnerToast.loading("جاري بدء عملية الاستيراد...", { id: "import-progress" });

    try {
      let currentTeacherStats = teacherStats;
      if (!teachersImported && columnMapping["current_teacher"]) {
        currentTeacherStats = await addMissingTeachers();
        setTeacherStats(currentTeacherStats);
        setTeachersImported(true);
      }

      await importStudents(currentTeacherStats);
      setStep("results");
    } catch (error: any) {
      sonnerToast.dismiss("import-progress");
      sonnerToast.error(error.message || "حدث خطأ غير متوقع");
      setImporting(false);
    }
  };

  const importStudents = async (currentTeacherStats: { added: number; existing: number }) => {
    const importResults: ImportResult[] = [];
    const currentMapping = { ...columnMapping };
    const dataToProcess = [...csvData];

    for (let i = 0; i < dataToProcess.length; i++) {
      const row = dataToProcess[i];
      const rowNumber = i + 2;

      if (!row) continue;

      if (i % 10 === 0) {
        sonnerToast.loading(`جاري استيراد ${i} من ${dataToProcess.length} طالب...`, { id: "import-progress" });
      }

      try {
        const nameColumn = currentMapping["student_name"];
        const studentName = nameColumn ? row[nameColumn]?.trim() : null;

        if (!studentName) {
          importResults.push({ row: rowNumber, studentName: "غير محدد", status: "error", message: "اسم الطالب مفقود أو العمود غير مرتبط" });
          continue;
        }

        const teacherColumn = currentMapping["current_teacher"];
        const teacherNameFromRow = teacherColumn ? row[teacherColumn]?.trim() : null;
        const teacherId = teacherNameFromRow && teacherNameFromRow !== "جديد" ? await findTeacherId(teacherNameFromRow) : null;

        const studentData: any = {
          student_name: studentName,
          phone: currentMapping["phone"] ? normalizePhoneNumber(row[currentMapping["phone"]]) : null,
          grade: currentMapping["grade"] ? row[currentMapping["grade"]]?.trim() : null,
          father_name: currentMapping["father_name"] ? row[currentMapping["father_name"]]?.trim() : null,
          social_status: currentMapping["social_status"] ? row[currentMapping["social_status"]]?.trim() : null,
          current_teacher: teacherNameFromRow,
          teacher_id: teacherId,
          previous_teacher: currentMapping["previous_teacher"] ? row[currentMapping["previous_teacher"]]?.trim() : null,
          address: currentMapping["address"] ? row[currentMapping["address"]]?.trim() : null,
          registration_status: currentMapping["registration_status"] ? row[currentMapping["registration_status"]]?.trim() : "مسجل",
          mosque_name: currentMapping["mosque_name"] ? row[currentMapping["mosque_name"]]?.trim() : null,
        };

        // حذف الحقول الفارغة
        Object.keys(studentData).forEach(key => {
          if (studentData[key] === undefined || studentData[key] === null) delete studentData[key];
        });

        if (updateExisting) {
          const { data: existing, error: findErr } = await supabase
            .from("students")
            .select("*")
            .eq("student_name", studentName)
            .maybeSingle();

          if (!findErr && existing) {
            let dataToUpdate = { ...studentData };

            if (updateStrategy === "fill_missing") {
              // حذف الحقول التي لها قيم مسبقاً في قاعدة البيانات
              Object.keys(dataToUpdate).forEach(key => {
                const dbValue = existing[key];
                // إذا كانت القيمة في قاعدة البيانات موجودة وليست فارغة، لا نحدثها
                if (dbValue !== null && dbValue !== "" && dbValue !== undefined) {
                  delete dataToUpdate[key];
                }
              });

              if (Object.keys(dataToUpdate).length === 0) {
                importResults.push({ row: rowNumber, studentName, status: "success", message: "لا توجد حقول فارغة للتحديث" });
                continue;
              }
            }

            const { error: updErr } = await supabase.from("students").update(dataToUpdate).eq("id", existing.id);
            if (updErr) throw updErr;

            await logActivity({
              activity_type: "update",
              description: `تم تحديث بيانات الطالب ${studentName} عبر الاستيراد (${updateStrategy === "overwrite" ? "استبدال" : "إكمال الناقص"})`,
              entity_type: "student",
              entity_id: existing.id,
              entity_name: studentName,
              new_data: dataToUpdate
            });

            importResults.push({
              row: rowNumber,
              studentName,
              status: "success",
              message: `تم تحديث ${Object.keys(dataToUpdate).length} حقل`
            });
            continue;
          }
        }

        if (skipNewStudents) {
          importResults.push({
            row: rowNumber,
            studentName,
            status: "success",
            message: "تم التجاوز (طالب غير موجود)"
          });
          continue;
        }

        const { error: insErr } = await supabase.from("students").insert(studentData);
        if (insErr) throw insErr;

        await logStudentAdded({ student_name: studentName, ...studentData });

        importResults.push({ row: rowNumber, studentName, status: "success", message: "تمت الإضافة بنجاح" });

      } catch (error: any) {
        console.error(`Error processing row ${rowNumber}:`, error);
        const nameColumn = currentMapping["student_name"];
        const studentName = nameColumn ? row[nameColumn] : "غير محدد";
        importResults.push({
          row: rowNumber,
          studentName: studentName || "غير محدد",
          status: "error",
          message: error.message || "خطأ غير متوقع"
        });
      }
    }

    setResults(importResults);
    setImporting(false);
    sonnerToast.dismiss("import-progress");

    const successCount = importResults.filter(r => r.status === "success").length;
    sonnerToast.success(`اكتملت العملية: نجح ${successCount} من ${csvData.length} طالب`);
  };

  const downloadErrorReport = () => {
    const errors = results.filter((r) => r.status === "error");
    const csv = Papa.unparse(errors.map((e) => ({ "رقم الصف": e.row, "اسم الطالب": e.studentName, "سبب الفشل": e.message })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `import-errors-${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <DashboardLayout title="استيراد طلاب">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">استيراد طلاب من CSV</h1>
            {step === "upload" && <p className="text-muted-foreground mt-2">يرجى رفع ملف CSV للبدء</p>}
            {step === "mapping" && <p className="text-muted-foreground mt-2">قم بربط أعمدة الملف مع حقول النظام</p>}
            {step === "results" && <p className="text-muted-foreground mt-2">نتيجة عملية الاستيراد</p>}
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/students")}>العودة للطلاب</Button>
        </div>

        {step === "upload" && (
          <Card className="p-8 border-dashed border-2 flex flex-col items-center justify-center space-y-4">
            <Upload className="w-12 h-12 text-primary opacity-50" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">ارفع ملف البيانات</h3>
              <p className="text-sm text-muted-foreground">صيغة CSV فقط، بحد أقصى 5 ميجابايت</p>
            </div>
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload">
              <Button asChild><span className="cursor-pointer">اختر ملف</span></Button>
            </label>
          </Card>
        )}

        {step === "mapping" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" /> ربط الأعمدة</CardTitle>
                  <CardDescription>قم بتحديد العمود المقابل لكل حقل في النظام</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleAutoMap}>تحديد الكل (تلقائي)</Button>
                  <Button variant="ghost" size="sm" onClick={handleClearMap} className="text-red-500 hover:text-red-600 hover:bg-red-50">مسح الكل</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  {FIELD_MAPPING_OPTIONS.map((field) => (
                    <div key={field.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                      <div className="w-1/3">
                        <Label className="font-semibold">{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <div className="w-1/2">
                        <Select
                          value={columnMapping[field.id] || "none"}
                          onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [field.id]: val === "none" ? "" : val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر العمود من الملف" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- تخطي هذا الحقل --</SelectItem>
                            {headers.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>إعدادات الاستيراد</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="update-mode" className="flex-1 font-medium">تحديث الطلاب الموجودين</Label>
                    <Switch id="update-mode" checked={updateExisting} onCheckedChange={setUpdateExisting} />
                  </div>

                  {updateExisting && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">استراتيجية التحديث</Label>
                        <RadioGroup
                          value={updateStrategy}
                          onValueChange={(v: "overwrite" | "fill_missing") => {
                            setUpdateStrategy(v);
                            // إذا تم تغيير الاستراتيجية لغير "إكمال الناقص"، نلغي تفعيل خيار تجاوز الطلاب الجدد
                            if (v !== "fill_missing") {
                              setSkipNewStudents(false);
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="overwrite" id="r-overwrite" />
                            <Label htmlFor="r-overwrite" className="text-sm cursor-pointer">
                              استبدال الكل (Overwrite)
                              <p className="text-xs text-muted-foreground mr-6">تحديث كافة البيانات بالقيم الجديدة من الملف</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="fill_missing" id="r-fill" />
                            <Label htmlFor="r-fill" className="text-sm cursor-pointer">
                              إكمال الناقص فقط (Fill Missing)
                              <p className="text-xs text-muted-foreground mr-6">تحديث الحقول الفارغة فقط (مثل إضافة اسم الأب المفقود)</p>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {updateStrategy === "fill_missing" && (
                        <div className="flex items-center justify-between space-x-2 pt-2 border-t animate-fade-in">
                          <div className="flex-1">
                            <Label htmlFor="skip-new" className="font-medium">تجاوز الطلاب الجدد (Update Only)</Label>
                            <p className="text-xs text-muted-foreground">عند التفعيل، لن يتم إضافة أي طالب جديد غير موجود في النظام</p>
                          </div>
                          <Switch id="skip-new" checked={skipNewStudents} onCheckedChange={setSkipNewStudents} />
                        </div>
                      )}
                    </div>
                  )}

                  <Button className="w-full" size="lg" onClick={handleImport} disabled={importing}>
                    {importing ? "جاري الاستيراد..." : "بدء الاستيراد"}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setStep("upload")}>تغيير الملف</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "results" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>تقرير الاستيراد</CardTitle>
                <CardDescription>تمت معالجة {results.length} صف من البيانات</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadErrorReport}>تحميل الأخطاء</Button>
                <Button onClick={() => setStep("upload")}>استيراد جديد</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الطالب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(0, 20).map((res, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{res.studentName}</TableCell>
                      <TableCell>
                        {res.status === "success" ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">نجح</Badge>
                        ) : (
                          <Badge variant="destructive">فشل</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{res.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {results.length > 20 && <p className="text-center text-sm text-muted-foreground mt-4">تم عرض أول 20 نتيجة فقط</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

const Badge = ({ children, className, variant }: { children: React.ReactNode, className?: string, variant?: "destructive" | "default" }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variant === "destructive" ? "bg-red-100 text-red-800" : className}`}>
    {children}
  </span>
);

export default StudentsImport;
