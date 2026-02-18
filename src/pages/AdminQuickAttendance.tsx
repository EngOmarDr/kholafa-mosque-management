import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, User, Check, X, Clock, Calendar, GraduationCap, Users, RefreshCcw, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { normalizeArabic } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, CheckSquare, Send, Filter, Layers } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreHorizontal } from "lucide-react";

const AdminQuickAttendance = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [attendancePoints, setAttendancePoints] = useState<Record<string, number>>({
        present: 1,
        absent: -1,
        excused: 0,
    });
    const [pendingPage, setPendingPage] = useState(1);
    const [recordedPage, setRecordedPage] = useState(1);
    const pageSize = 20;
    const searchInputRef = useRef<HTMLInputElement>(null);

    // New states for Daily Summary
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [teacherSearch, setTeacherSearch] = useState("");
    const [teacherFilter, setTeacherFilter] = useState<string>("all");
    const [sentSummaries, setSentSummaries] = useState<Record<string, boolean>>({});
    const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        // Load sent status for today
        const key = `sent_summaries_${selectedDate}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            setSentSummaries(JSON.parse(saved));
        } else {
            setSentSummaries({});
        }
    }, [selectedDate]);

    const markAsSent = (teacherId: string) => {
        const key = `sent_summaries_${selectedDate}`;
        const updated = { ...sentSummaries, [teacherId]: true };
        setSentSummaries(updated);
        localStorage.setItem(key, JSON.stringify(updated));
    };

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

        fetchStudents();
        fetchAttendancePointsSettings();
        fetchTeachers();
    }, [navigate]);

    useEffect(() => {
        if (students.length > 0) {
            fetchDateAttendance();
        }
    }, [selectedDate, students]);

    useEffect(() => {
        const normalizedSearch = normalizeArabic(searchTerm);
        const filtered = students.filter(student => {
            const matchesSearch = normalizeArabic(student.student_name).includes(normalizedSearch);
            const matchesTeacher = teacherFilter === "all" || student.teacher_id === teacherFilter;
            return matchesSearch && matchesTeacher;
        });
        setFilteredStudents(filtered);
        setPendingPage(1);
        setRecordedPage(1);
    }, [searchTerm, students, teacherFilter]);

    const allPending = filteredStudents.filter(student => !attendance[student.id]);
    const allRecorded = filteredStudents.filter(student => attendance[student.id]);

    const effectivePageSize = showAll ? Math.max(students.length, 1) : pageSize;

    const pendingStudents = allPending.slice((pendingPage - 1) * effectivePageSize, pendingPage * effectivePageSize);
    const recordedStudents = allRecorded.slice((recordedPage - 1) * effectivePageSize, recordedPage * effectivePageSize);

    const totalPendingPages = Math.ceil(allPending.length / effectivePageSize);
    const totalRecordedPages = Math.ceil(allRecorded.length / effectivePageSize);

    const fetchAttendancePointsSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("points_settings")
                .select("key, points")
                .eq("category", "attendance");

            if (error) throw error;

            if (data) {
                const settings: Record<string, number> = {};
                data.forEach((s: any) => {
                    settings[s.key] = s.points;
                });
                setAttendancePoints(settings);
            }
        } catch (error) {
            console.error("Error fetching attendance points:", error);
        }
    };

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("students")
                .select("id, student_name, current_teacher, teacher_id, grade, photo_url, registration_status")
                .order("student_name");

            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error("Error fetching students:", error);
            toast.error("خطأ في تحميل بيانات الطلاب");
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from("teachers")
                .select("*")
                .order("اسم الاستاذ");
            if (error) throw error;
            setAllTeachers(data || []);
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    };

    const generateSummaryAndSend = async (teacher: any) => {
        const teacherStudents = students.filter(s => s.teacher_id === teacher.id);
        if (teacherStudents.length === 0) {
            toast.error("لا يوجد طلاب مسجلين لهذا الأستاذ");
            return;
        }

        const present = teacherStudents.filter(s => attendance[s.id] === 'حاضر');
        const absent = teacherStudents.filter(s => attendance[s.id] === 'غائب');
        const excused = teacherStudents.filter(s => attendance[s.id] === 'اعتذر');
        const notRecorded = teacherStudents.filter(s => !attendance[s.id]);

        const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        let summaryText = `*ملخص الحضور اليومي*\n`;
        summaryText += `*الأستاذ:* ${teacher['اسم الاستاذ']}\n`;
        summaryText += `*التاريخ:* ${dateStr}\n`;
        summaryText += `----------------------------\n`;
        summaryText += `✅ *حاضر:* ${present.length}\n`;
        summaryText += `❌ *غائب:* ${absent.length}\n`;
        summaryText += `⏳ *اعتذر:* ${excused.length}\n`;
        if (notRecorded.length > 0) {
            summaryText += `❓ *لم يسجل:* ${notRecorded.length}\n`;
        }
        summaryText += `----------------------------\n`;

        if (present.length > 0) {
            summaryText += `*قائمة الحضور:*\n`;
            present.forEach((s, i) => summaryText += `${i + 1}. ${s.student_name}\n`);
        }

        if (absent.length > 0) {
            summaryText += `\n*قائمة الغياب:*\n`;
            absent.forEach((s, i) => summaryText += `${i + 1}. ${s.student_name}\n`);
        }

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(summaryText);
            toast.success("تم نسخ الملخص للحافظة");
            markAsSent(teacher.id);

            // Open WhatsApp
            const phone = teacher['رقم الهاتف'] ? teacher['رقم الهاتف'].replace(/\D/g, '') : '';
            const waUrl = phone
                ? `https://wa.me/${phone}?text=${encodeURIComponent(summaryText)}`
                : `https://wa.me/?text=${encodeURIComponent(summaryText)}`;

            window.open(waUrl, '_blank');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            toast.error("فشل نسخ النص");
        }
    };

    const fetchDateAttendance = async () => {
        try {
            const { data, error } = await supabase
                .from("attendance")
                .select("student_id, status")
                .eq("date", selectedDate);

            if (error) throw error;

            const map: Record<string, string> = {};
            data?.forEach(att => {
                map[att.student_id] = att.status;
            });
            setAttendance(map);
        } catch (error) {
            console.error("Error fetching attendance:", error);
        }
    };

    const handleSetAttendance = async (studentId: string, status: string) => {
        setUpdatingId(`${studentId}-${status}`);
        try {
            let statusPoints = 0;
            switch (status) {
                case "حاضر":
                    statusPoints = attendancePoints.present ?? 1;
                    break;
                case "غائب":
                    statusPoints = attendancePoints.absent ?? -1;
                    break;
                case "اعتذر":
                    statusPoints = attendancePoints.excused ?? 0;
                    break;
            }

            const { error } = await supabase.rpc("set_attendance", {
                p_student_id: studentId,
                p_date: selectedDate,
                p_status: status,
                p_points: statusPoints,
            });

            if (error) throw error;

            setAttendance(prev => ({ ...prev, [studentId]: status }));
            toast.success("تم التحديث بنجاح", { duration: 1000 });

            if (!isBulkUpdating) {
                // Clear search and focus back to input for rapid entry
                setSearchTerm("");
                searchInputRef.current?.focus();
            }
        } finally {
            if (!isBulkUpdating) setUpdatingId(null);
        }
    };

    const handleBulkAttendance = async (status: string) => {
        if (allPending.length === 0) {
            toast.error("لا يوجد طلاب بانتظار التسجيل");
            return;
        }

        const confirmMsg = status === "حاضر"
            ? `هل أنت متأكد من تسجيل جميع الطلاب (${allPending.length}) كحاضرين؟`
            : `هل أنت متأكد من تسجيل جميع الطلاب (${allPending.length}) كغائبين؟`;

        if (!window.confirm(confirmMsg)) return;

        setIsBulkUpdating(true);
        setUpdatingId("bulk-" + status);
        const toastId = toast.loading(`جاري تحديث سجلات ${allPending.length} طالب...`);

        try {
            // Process in batches or all at once? 
            // set_attendance RPC is fairly light, but let's be careful.
            // Using Promise.all for now.
            await Promise.all(allPending.map(student => handleSetAttendance(student.id, status)));

            toast.success("تم التحديث الكل بنجاح ✅", { id: toastId });
        } catch (error) {
            console.error("Bulk attendance error:", error);
            toast.error("حدث خطأ أثناء التحديث الجماعي", { id: toastId });
        } finally {
            setIsBulkUpdating(false);
            setUpdatingId(null);
        }
    };

    const handleBulkDelete = async () => {
        if (allRecorded.length === 0) {
            toast.error("لا يوجد سجلات حضور لحذفها");
            return;
        }

        if (!window.confirm(`هل أنت متأكد من حذف جميع سجلات الحضور (${allRecorded.length}) لهذه القائمة؟`)) return;

        setIsBulkUpdating(true);
        setUpdatingId("bulk-delete");
        const toastId = toast.loading(`جاري حذف سجلات ${allRecorded.length} طالب...`);

        try {
            await Promise.all(allRecorded.map(student => handleDeleteAttendance(student.id)));
            toast.success("تم حذف الكل بنجاح ✅", { id: toastId });
        } catch (error) {
            console.error("Bulk delete error:", error);
            toast.error("حدث خطأ أثناء الحذف الجماعي", { id: toastId });
        } finally {
            setIsBulkUpdating(false);
            setUpdatingId(null);
        }
    };

    const handleDeleteAttendance = async (studentId: string) => {
        setUpdatingId(`${studentId}-delete`);
        try {
            const { error } = await supabase
                .from("attendance")
                .delete()
                .eq("student_id", studentId)
                .eq("date", selectedDate);

            if (error) throw error;

            setAttendance(prev => {
                const updated = { ...prev };
                delete updated[studentId];
                return updated;
            });
            toast.success("تم إلغاء سجل الحضور");
        } catch (error: any) {
            console.error("Error deleting attendance:", error);
            toast.error("فشل إلغاء الحضور: " + error.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "حاضر":
                return <Badge className="bg-green-500 hover:bg-green-600">حاضر</Badge>;
            case "غائب":
                return <Badge variant="destructive">غائب</Badge>;
            case "اعتذر":
                return <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600">اعتذر</Badge>;
            default:
                return <Badge variant="outline" className="text-muted-foreground">لم يُسجل</Badge>;
        }
    };

    const StudentCard = ({ student, status, onSetStatus, onDelete, updatingId }: any) => (
        <Card className="overflow-hidden border group hover:shadow-md transition-all">
            <div className="p-1.5 sm:p-4 flex items-center justify-between flex-wrap gap-1.5 sm:gap-4">
                <div className="flex items-center gap-1.5 sm:gap-3 min-w-[120px] flex-1">
                    <Avatar className="h-8 w-8 sm:h-12 sm:w-12 border border-primary/10 shrink-0">
                        <AvatarImage src={student.photo_url || undefined} />
                        <AvatarFallback><User className="w-4 h-4 sm:w-6 h-6" /></AvatarFallback>
                    </Avatar>
                    <div className="space-y-0 min-w-0">
                        <h3 className="font-bold text-sm sm:text-lg truncate">{student.student_name}</h3>
                        <div className="flex items-center gap-2 text-[10px] sm:text-sm text-muted-foreground">
                            <span className="truncate max-w-[80px] sm:max-w-none">{student.current_teacher || "بدون أستاذ"}</span>
                            <span className="shrink-0">• {student.grade || "-"}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <div className="flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-lg border">
                        <Button
                            size="sm"
                            variant={status === "حاضر" ? "default" : "outline"}
                            className={`h-7 sm:h-10 px-1.5 sm:px-4 text-[10px] sm:text-sm font-bold ${status === "حاضر" ? "bg-green-600 hover:bg-green-700 hover:text-white" : "hover:border-green-500 hover:text-green-600"}`}
                            onClick={() => onSetStatus(student.id, "حاضر")}
                            disabled={updatingId === `${student.id}-حاضر`}
                        >
                            <Check className="w-3 h-3 sm:w-4 h-4 shrink-0" />
                            حاضر
                        </Button>
                        <Button
                            size="sm"
                            variant={status === "غائب" ? "destructive" : "outline"}
                            className="h-7 sm:h-10 px-1.5 sm:px-4 text-[10px] sm:text-sm font-bold"
                            onClick={() => onSetStatus(student.id, "غائب")}
                            disabled={updatingId === `${student.id}-غائب`}
                        >
                            <X className="w-3 h-3 sm:w-4 h-4 shrink-0" />
                            غائب
                        </Button>
                        <Button
                            size="sm"
                            variant={status === "اعتذر" ? "default" : "outline"}
                            className={`h-7 sm:h-10 px-1.5 sm:px-4 text-[10px] sm:text-sm font-bold ${status === "اعتذر" ? "bg-amber-500 hover:bg-amber-600 hover:text-white" : "hover:border-amber-500 hover:text-amber-600"}`}
                            onClick={() => onSetStatus(student.id, "اعتذر")}
                            disabled={updatingId === `${student.id}-اعتذر`}
                        >
                            <Clock className="w-3 h-3 sm:w-4 h-4 shrink-0" />
                            اعتذر
                        </Button>
                        {status && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onDelete(student.id)}
                                disabled={updatingId === `${student.id}-delete`}
                                title="إلغاء التسجيل"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );

    const PaginationControls = ({ currentPage, totalPages, onPageChange }: any) => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-between bg-muted/40 p-1.5 sm:p-2 rounded-lg mb-2 sm:mb-3 border border-primary/10">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="h-7 sm:h-8 px-2 text-xs sm:text-sm gap-1"
                >
                    <ChevronRight className="w-3 h-3 sm:w-4 h-4" />
                    السابق
                </Button>
                <span className="text-xs sm:text-sm font-medium">
                    صفحة {currentPage} من {totalPages}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 sm:h-8 px-2 text-xs sm:text-sm gap-1"
                >
                    التالي
                    <ChevronLeft className="w-3 h-3 sm:w-4 h-4" />
                </Button>
            </div>
        );
    };

    return (
        <DashboardLayout title="التفقد السريع للأدمن" userName="">
            <div className="max-w-4xl mx-auto space-y-6">
                <Card className="shadow-lg border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 p-2 sm:p-4 sticky top-0 z-30 border-b shadow-sm">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base sm:text-2xl font-bold flex items-center gap-1.5 min-w-0">
                                    <Users className="w-4 h-4 sm:w-6 h-6 text-primary shrink-0" />
                                    <span className="truncate">تفقد سريع</span>
                                </CardTitle>
                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                    <Button
                                        variant={showAll ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setShowAll(!showAll)}
                                        className={`gap-1 h-7 sm:h-9 px-1.5 text-[10px] sm:text-sm ${showAll ? "bg-primary text-white" : "border-primary/40 text-primary hover:bg-primary/10"}`}
                                    >
                                        <Layers className="w-3 h-3 sm:w-4 h-4" />
                                        <span className="hidden min-[400px]:inline">{showAll ? "عرض كصفحات" : "عرض الكل"}</span>
                                        <span className="min-[400px]:hidden">{showAll ? "صفحات" : "الكل"}</span>
                                    </Button>
                                    <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-1 h-7 sm:h-9 border-primary/40 text-primary hover:bg-primary/10 px-1.5 text-[10px] sm:text-sm">
                                                <Send className="w-3 h-3 sm:w-4 h-4" />
                                                <span className="hidden min-[400px]:inline">الملخص</span>
                                                <span className="min-[400px]:hidden text-[9px]">ملخص</span>
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <MessageSquare className="w-5 h-5" />
                                                    اختر الأستاذ لإرسال الملخص
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-4">
                                                <div className="relative">
                                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                    <Input
                                                        placeholder="ابحث عن اسم الأستاذ..."
                                                        value={teacherSearch}
                                                        onChange={(e) => setTeacherSearch(e.target.value)}
                                                        className="pr-9"
                                                    />
                                                </div>
                                                <ScrollArea className="h-[300px] border rounded-md p-2">
                                                    <div className="space-y-2">
                                                        {allTeachers
                                                            .filter(t => normalizeArabic(t['اسم الاستاذ']).includes(normalizeArabic(teacherSearch)))
                                                            .map(teacher => {
                                                                const isSent = sentSummaries[teacher.id];
                                                                return (
                                                                    <Button
                                                                        key={teacher.id}
                                                                        variant="ghost"
                                                                        className="w-full justify-between hover:bg-primary/5 h-12"
                                                                        onClick={() => generateSummaryAndSend(teacher)}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <User className="w-4 h-4 text-muted-foreground" />
                                                                            <span className="font-medium text-right">{teacher['اسم الاستاذ']}</span>
                                                                        </div>
                                                                        {isSent && (
                                                                            <CheckSquare className="w-4 h-4 text-green-500" />
                                                                        )}
                                                                    </Button>
                                                                );
                                                            })}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-4 overflow-x-auto no-scrollbar pb-0.5">
                                <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border shadow-xs grow shrink-0 min-w-[110px]">
                                    <Filter className="w-3 h-3 sm:w-4 h-4 text-muted-foreground mr-1" />
                                    <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                                        <SelectTrigger className="border-none focus:ring-0 w-full h-6 sm:h-8 text-[10px] sm:text-sm p-0">
                                            <SelectValue placeholder="الأستاذ" />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="all">كل المعلمين</SelectItem>
                                            {allTeachers.map(t => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t['اسم الاستاذ']}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border shadow-xs px-1 grow shrink-0">
                                    <Calendar className="w-3 h-3 sm:w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="border-none focus-visible:ring-0 w-22 sm:w-32 h-6 sm:h-8 text-[10px] sm:text-sm p-0"
                                    />
                                </div>
                            </div>

                            <div className="relative mt-1">
                                <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-primary w-3.5 h-3.5 sm:w-5 h-5" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="ابحث عن اسم الطالب..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-8 h-8 sm:h-12 text-xs sm:text-lg border-primary/20 focus:border-primary focus:ring-primary/10 shadow-inner rounded-md"
                                />
                                {searchTerm && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute left-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                                        onClick={() => setSearchTerm("")}
                                    >
                                        <X className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        <div className="flex items-center justify-center -mt-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full max-w-sm h-10 sm:h-12 gap-2 border-primary/30 hover:bg-primary/5 shadow-sm text-primary font-bold text-sm sm:text-lg rounded-xl"
                                        disabled={isBulkUpdating}
                                    >
                                        <CheckSquare className="w-4 h-4 sm:w-5 h-5" />
                                        إجراءات جماعية
                                        <ChevronDown className="w-3 h-3 sm:w-4 h-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="w-72 p-2 rounded-xl">
                                    <DropdownMenuItem
                                        className="h-12 flex items-center gap-3 cursor-pointer text-green-600 focus:text-green-700 focus:bg-green-50 rounded-lg group"
                                        onClick={() => handleBulkAttendance("حاضر")}
                                        disabled={allPending.length === 0}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold">تسجيل حاضر للكل</span>
                                            <span className="text-[10px] opacity-70">({allPending.length}) طلاب غير مسجلين</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="h-12 flex items-center gap-3 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg group mt-1"
                                        onClick={() => handleBulkAttendance("غائب")}
                                        disabled={allPending.length === 0}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                            <X className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold">تسجيل غائب للكل</span>
                                            <span className="text-[10px] opacity-70">({allPending.length}) طلاب غير مسجلين</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <div className="h-px bg-muted my-2" />
                                    <DropdownMenuItem
                                        className="h-12 flex items-center gap-3 cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50 rounded-lg group"
                                        onClick={handleBulkDelete}
                                        disabled={allRecorded.length === 0}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold">حذف الحضور للكل</span>
                                            <span className="text-[10px] opacity-70">({allRecorded.length}) طلاب مسجلين</span>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="space-y-4">
                            <Tabs defaultValue="pending" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="pending" className="relative">
                                        غير مسجل
                                        {pendingStudents.length > 0 && (
                                            <Badge variant="secondary" className="mr-2 bg-primary/20 text-primary hover:bg-primary/30">
                                                {pendingStudents.length}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="recorded" className="relative">
                                        تم التسجيل
                                        {recordedStudents.length > 0 && (
                                            <Badge variant="secondary" className="mr-2 bg-green-100 text-green-700 hover:bg-green-200">
                                                {recordedStudents.length}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="pending" className="space-y-4">
                                    <PaginationControls
                                        currentPage={pendingPage}
                                        totalPages={totalPendingPages}
                                        onPageChange={setPendingPage}
                                    />
                                    {pendingStudents.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                                            {searchTerm ? "لا يوجد طلاب بهذا الاسم في هذه القائمة" : "تم الانتهاء من تفقد جميع الطلاب!"}
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {pendingStudents.map((student) => (
                                                <StudentCard
                                                    key={student.id}
                                                    student={student}
                                                    status={attendance[student.id]}
                                                    onSetStatus={handleSetAttendance}
                                                    onDelete={handleDeleteAttendance}
                                                    updatingId={updatingId}
                                                    getStatusBadge={getStatusBadge}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="recorded" className="space-y-4">
                                    <PaginationControls
                                        currentPage={recordedPage}
                                        totalPages={totalRecordedPages}
                                        onPageChange={setRecordedPage}
                                    />
                                    {recordedStudents.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                                            {searchTerm ? "لا يوجد طلاب بهذا الاسم في هذه القائمة" : "لم يتم تسجيل حضور أي طالب بعد"}
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {recordedStudents.map((student) => (
                                                <StudentCard
                                                    key={student.id}
                                                    student={student}
                                                    status={attendance[student.id]}
                                                    onSetStatus={handleSetAttendance}
                                                    onDelete={handleDeleteAttendance}
                                                    updatingId={updatingId}
                                                    getStatusBadge={getStatusBadge}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-muted flex flex-col items-center text-center space-y-3">
                    <div className="p-3 bg-secondary/10 rounded-full">
                        <Users className="w-6 h-6 text-secondary" />
                    </div>
                    <p className="text-muted-foreground max-w-md">
                        هذه الواجهة مخصصة للإدارة للقيام بالتفقد السريع لأي طالب دون الحاجة للدخول إلى حلقات الأساتذة. بمجرد تسجيل الحضور، يتم تحديث نقاط الطالب تلقائياً.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminQuickAttendance;
