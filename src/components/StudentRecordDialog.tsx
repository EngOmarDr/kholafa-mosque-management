import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, CheckCircle, XCircle, Clock, Edit, Trash2, Plus, Users, ArrowLeft, AlertCircle } from "lucide-react";
import BonusPointsDialog from "./BonusPointsDialog";
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

interface StudentRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  onSuccess?: () => void;
  isAdmin?: boolean;
}

const formatDateWithDay = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(date);
  const dateFormatted = date.toLocaleDateString('ar-EG');
  return `${dayName} ${dateFormatted}`;
};

interface RecordData {
  attendance: any[];
  recitations: any[];
  bonusPoints: any[];
  checkRecords: any[];
  checkPoints: number;
  totalPoints: number;
  attendanceCount: number;
  absentCount: number;
  excusedCount: number;
}

interface TeacherHistoryRecord {
  id: string;
  old_teacher: string;
  new_teacher: string;
  change_date: string;
  updated_by: string | null;
}

const StudentRecordDialog = ({ open, onOpenChange, student, onSuccess, isAdmin = false }: StudentRecordDialogProps) => {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState<RecordData | null>(null);
  const [editingRecitation, setEditingRecitation] = useState<any>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editLastSaved, setEditLastSaved] = useState("");
  const [editRating, setEditRating] = useState("");
  const [deleteRecitationId, setDeleteRecitationId] = useState<string | null>(null);
  const [editingBonusPoint, setEditingBonusPoint] = useState<any>(null);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [bonusDialogDate, setBonusDialogDate] = useState<string>("");
  const [editingAttendance, setEditingAttendance] = useState<any>(null);
  const [editAttendanceStatus, setEditAttendanceStatus] = useState("");
  const [deleteAttendanceId, setDeleteAttendanceId] = useState<string | null>(null);
  const [editingCheckRecord, setEditingCheckRecord] = useState<any>(null);
  const [editCheckStatus, setEditCheckStatus] = useState("");
  const [deleteCheckRecordId, setDeleteCheckRecordId] = useState<string | null>(null);
  const [deleteBonusPointId, setDeleteBonusPointId] = useState<string | null>(null);
  const [checkItemDetails, setCheckItemDetails] = useState<any>(null);
  const [teacherHistory, setTeacherHistory] = useState<TeacherHistoryRecord[]>([]);
  const [deleteTeacherHistoryId, setDeleteTeacherHistoryId] = useState<string | null>(null);
  const [deleteAllRecords, setDeleteAllRecords] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (open && student) {
      fetchStudentRecord();
      fetchTeacherHistory();
    }
  }, [open, student, startDate, endDate]);

  const fetchTeacherHistory = async () => {
    if (!student) return;

    try {
      const { data, error } = await supabase
        .from("student_teacher_history")
        .select("*")
        .eq("student_id", student.id)
        .order("change_date", { ascending: false });

      if (error) throw error;
      setTeacherHistory(data || []);
    } catch (error) {
      console.error("Error fetching teacher history:", error);
    }
  };

  const handleDeleteTeacherHistory = async () => {
    if (!deleteTeacherHistoryId) return;

    try {
      const { error } = await supabase
        .from("student_teacher_history")
        .delete()
        .eq("id", deleteTeacherHistoryId);

      if (error) throw error;

      toast.success("تم حذف سجل تغيير الأستاذ بنجاح");
      setDeleteTeacherHistoryId(null);
      fetchTeacherHistory();
    } catch (error) {
      console.error("Error deleting teacher history:", error);
      toast.error("حدث خطأ في حذف سجل تغيير الأستاذ");
    }
  };

  const fetchStudentRecord = async () => {
    if (!student) return;

    setLoading(true);
    try {
      // جلب بيانات الحضور
      const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (attError) throw attError;

      // جلب بيانات التسميع
      const { data: recitationsData, error: recError } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", student.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (recError) throw recError;

      // جلب النقاط الإضافية
      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("*")
        .eq("student_id", student.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (bonusError) throw bonusError;

      // جلب تفقد الأدوات
      const { data: checkData, error: checkError } = await supabase
        .from("check_records")
        .select("*")
        .eq("student_id", student.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (checkError) throw checkError;

      // جلب أسماء العناصر المستخدمة لعرض اسم العنصر
      let itemsMap: Record<string, { name: string; points: number }> = {};
      const itemIds = Array.from(new Set((checkData || []).map((r: any) => r.item_id)));
      if (itemIds.length > 0) {
        const { data: items, error: itemsErr } = await supabase
          .from("check_items")
          .select("id, name, points")
          .in("id", itemIds as any);
        if (itemsErr) throw itemsErr;
        items?.forEach((it: any) => {
          itemsMap[it.id] = { name: it.name, points: it.points };
        });
      }

      // حساب الإحصائيات
      const attendanceCount = attendanceData?.filter(a => a.status === 'حاضر').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'غائب').length || 0;
      const excusedCount = attendanceData?.filter(a => a.status === 'اعتذر').length || 0;

      const attendancePoints = attendanceData?.reduce((sum, a) => {
        if (a.status === 'حاضر') return sum + 1;
        if (a.status === 'غائب') return sum - 1;
        return sum;
      }, 0) || 0;

      const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
      const bonusPointsSum = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

      // احتساب نقاط تفقد الأدوات حسب الحالة
      const enrichedCheck = (checkData || []).map((r: any) => {
        const item = itemsMap[r.item_id];
        const base = r.points ?? item?.points ?? 0;
        const delta = r.status === 'موجود' ? base : r.status === 'غير موجود' ? -base : 0;
        return {
          ...r,
          item_name: item?.name || 'عنصر',
          delta_points: delta,
        };
      });
      const checkPoints = enrichedCheck.reduce((sum: number, r: any) => sum + r.delta_points, 0);

      const totalPoints = attendancePoints + recitationPoints + bonusPointsSum + checkPoints;

      setRecordData({
        attendance: attendanceData || [],
        recitations: recitationsData || [],
        bonusPoints: bonusData || [],
        checkRecords: enrichedCheck,
        checkPoints,
        totalPoints,
        attendanceCount,
        absentCount,
        excusedCount
      });
    } catch (error) {
      console.error("Error fetching student record:", error);
      toast.error("حدث خطأ في تحميل سجل الطالب");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecitation = async () => {
    if (!editingRecitation) return;

    try {
      // حساب النقاط بناءً على التقييم
      const newPoints = editRating === "ممتاز" ? 2 : editRating === "جيد" ? 1 : 0;

      const { error } = await supabase
        .from("recitations")
        .update({
          notes: editNotes,
          last_saved: editLastSaved,
          rating: editRating,
          points_awarded: newPoints
        })
        .eq("id", editingRecitation.id);

      if (error) throw error;

      toast.success("تم تحديث التسميع بنجاح");
      setEditingRecitation(null);
      setEditNotes("");
      setEditLastSaved("");
      setEditRating("");
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error updating recitation:", error);
      toast.error("حدث خطأ في تحديث التسميع");
    }
  };

  const handleDeleteRecitation = async () => {
    if (!deleteRecitationId) return;

    try {
      const { error } = await supabase
        .from("recitations")
        .delete()
        .eq("id", deleteRecitationId);

      if (error) throw error;

      toast.success("تم حذف السجل بنجاح");
      setDeleteRecitationId(null);
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting recitation:", error);
      toast.error("حدث خطأ في حذف السجل");
    }
  };

  const handleEditBonusPoint = (bonusPoint: any) => {
    setBonusDialogDate(bonusPoint.date);
    setShowBonusDialog(true);
  };

  const handleDeleteBonusPoint = async () => {
    if (!deleteBonusPointId) return;

    try {
      const { error } = await supabase
        .from("bonus_points")
        .delete()
        .eq("id", deleteBonusPointId);

      if (error) throw error;

      toast.success("تم حذف النقاط الإضافية بنجاح");
      setDeleteBonusPointId(null);
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting bonus point:", error);
      toast.error("حدث خطأ في حذف النقاط الإضافية");
    }
  };

  const handleUpdateAttendance = async () => {
    if (!editingAttendance) return;

    try {
      const points = editAttendanceStatus === 'حاضر' ? 1 : editAttendanceStatus === 'غائب' ? -1 : 0;

      const { error } = await supabase
        .from("attendance")
        .update({
          status: editAttendanceStatus,
          points: points
        })
        .eq("id", editingAttendance.id);

      if (error) throw error;

      toast.success("تم تحديث سجل الحضور بنجاح");
      setEditingAttendance(null);
      setEditAttendanceStatus("");
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("حدث خطأ في تحديث سجل الحضور");
    }
  };

  const handleDeleteAttendance = async () => {
    if (!deleteAttendanceId) return;

    try {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", deleteAttendanceId);

      if (error) throw error;

      toast.success("تم حذف سجل الحضور بنجاح");
      setDeleteAttendanceId(null);
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting attendance:", error);
      toast.error("حدث خطأ في حذف سجل الحضور");
    }
  };

  const handleUpdateCheckRecord = async () => {
    if (!editingCheckRecord || !checkItemDetails) return;

    try {
      // حساب النقاط بناءً على الحالة والإعدادات
      let newPoints = 0;
      if (editCheckStatus === 'موجود') {
        newPoints = checkItemDetails.points_brought || 0;
      } else if (editCheckStatus === 'غير موجود') {
        newPoints = checkItemDetails.points_not_brought || 0;
      } else if (editCheckStatus === 'فقدان') {
        newPoints = checkItemDetails.points_lost || 0;
      } else if (editCheckStatus === 'تجاوز') {
        newPoints = checkItemDetails.points_skipped || 0;
      }

      const { error } = await supabase
        .from("check_records")
        .update({
          status: editCheckStatus,
          points: newPoints
        })
        .eq("id", editingCheckRecord.id);

      if (error) throw error;

      toast.success("تم تحديث سجل تفقد الأدوات بنجاح");
      setEditingCheckRecord(null);
      setEditCheckStatus("");
      setCheckItemDetails(null);
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error updating check record:", error);
      toast.error("حدث خطأ في تحديث سجل تفقد الأدوات");
    }
  };

  const handleDeleteCheckRecord = async () => {
    if (!deleteCheckRecordId) return;

    try {
      const { error } = await supabase
        .from("check_records")
        .delete()
        .eq("id", deleteCheckRecordId);

      if (error) throw error;

      toast.success("تم حذف سجل تفقد الأدوات بنجاح");
      setDeleteCheckRecordId(null);
      fetchStudentRecord();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting check record:", error);
      toast.error("حدث خطأ في حذف سجل تفقد الأدوات");
    }
  };

  const handleDeleteAllRecords = async () => {
    if (!student) return;

    setDeletingAll(true);
    try {
      // حذف سجلات التسميع
      if (recordData?.recitations.length) {
        const { error } = await supabase
          .from("recitations")
          .delete()
          .in("id", recordData.recitations.map(r => r.id));
        if (error) throw error;
      }

      // حذف سجلات الحضور
      if (recordData?.attendance.length) {
        const { error } = await supabase
          .from("attendance")
          .delete()
          .in("id", recordData.attendance.map(a => a.id));
        if (error) throw error;
      }

      // حذف النقاط الإضافية
      if (recordData?.bonusPoints.length) {
        const { error } = await supabase
          .from("bonus_points")
          .delete()
          .in("id", recordData.bonusPoints.map(b => b.id));
        if (error) throw error;
      }

      // حذف سجلات تفقد الأدوات
      if (recordData?.checkRecords.length) {
        const { error } = await supabase
          .from("check_records")
          .delete()
          .in("id", recordData.checkRecords.map((c: any) => c.id));
        if (error) throw error;
      }

      // حذف سجل تغييرات الأساتذة
      if (teacherHistory.length) {
        const { error } = await supabase
          .from("student_teacher_history")
          .delete()
          .in("id", teacherHistory.map(t => t.id));
        if (error) throw error;
      }

      const totalDeleted = (recordData?.recitations.length || 0) +
        (recordData?.attendance.length || 0) +
        (recordData?.bonusPoints.length || 0) +
        (recordData?.checkRecords.length || 0) +
        teacherHistory.length;

      toast.success(`تم حذف ${totalDeleted} سجل بنجاح`);
      setDeleteAllRecords(false);
      fetchStudentRecord();
      fetchTeacherHistory();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting all records:", error);
      toast.error("حدث خطأ في حذف السجلات");
    } finally {
      setDeletingAll(false);
    }
  };

  const getTotalRecordsCount = () => {
    return (recordData?.recitations.length || 0) +
      (recordData?.attendance.length || 0) +
      (recordData?.bonusPoints.length || 0) +
      (recordData?.checkRecords.length || 0) +
      teacherHistory.length;
  };

  const setDateRange = (type: 'week' | 'month' | '3months' | 'all') => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start: string;

    switch (type) {
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        start = monthAgo.toISOString().split('T')[0];
        break;
      case '3months':
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        start = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case 'all':
        start = '2020-01-01';
        break;
      default:
        start = end;
    }

    setStartDate(start);
    setEndDate(end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">سجل الطالب: {student?.student_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* تحديد الفترة الزمنية */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* أزرار اختيار الفترة الزمنية السريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateRange('week')}
              className="text-xs"
            >
              آخر أسبوع
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateRange('month')}
              className="text-xs"
            >
              آخر شهر
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateRange('3months')}
              className="text-xs"
            >
              آخر 3 أشهر
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateRange('all')}
              className="text-xs"
            >
              جميع البيانات
            </Button>
          </div>

          {/* زر حذف جميع السجلات - يظهر فقط للإدارة */}
          {isAdmin && !loading && recordData && getTotalRecordsCount() > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={() => setDeleteAllRecords(true)}
            >
              <Trash2 className="w-4 h-4" />
              حذف جميع السجلات ({getTotalRecordsCount()})
            </Button>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : recordData ? (
            <>
              {/* إحصائيات */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <p className="text-xs text-muted-foreground">حضور</p>
                  <p className="text-lg font-bold text-green-600">{recordData.attendanceCount}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <XCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                  <p className="text-xs text-muted-foreground">غياب</p>
                  <p className="text-lg font-bold text-red-600">{recordData.absentCount}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                  <p className="text-xs text-muted-foreground">اعتذار</p>
                  <p className="text-lg font-bold text-yellow-600">{recordData.excusedCount}</p>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">إجمالي النقاط</p>
                <p className="text-2xl font-bold text-primary">{recordData.totalPoints}</p>
              </div>

              {/* سجل تغييرات الأساتذة */}
              {teacherHistory.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    سجل تغييرات الأساتذة ({teacherHistory.length})
                  </h4>
                  <div className="relative space-y-3 pr-6">
                    {/* خط Timeline */}
                    <div className="absolute right-2 top-2 bottom-2 w-0.5 bg-primary/30" />

                    {teacherHistory.map((record) => (
                      <div key={record.id} className="relative">
                        {/* نقطة Timeline */}
                        <div className="absolute -right-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                        <div className="border rounded-lg p-3 bg-background">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <span className="text-muted-foreground line-through">{record.old_teacher}</span>
                              <ArrowLeft className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="font-semibold text-primary">{record.new_teacher}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => setDeleteTeacherHistoryId(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateWithDay(record.change_date)}
                            {" - "}
                            {new Date(record.change_date).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* زر إضافة/خصم نقاط */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBonusDialogDate(new Date().toISOString().split('T')[0]);
                  setShowBonusDialog(true);
                }}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة أو خصم نقاط
              </Button>

              {/* النقاط الإضافية */}
              {recordData.bonusPoints.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    النقاط الإضافية ({recordData.bonusPoints.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {recordData.bonusPoints.map((bonus) => (
                      <div key={bonus.id} className="border rounded-lg p-2 text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">{bonus.reason}</span>
                          <div className="flex items-center gap-1">
                            <span className={`font-semibold ${bonus.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {bonus.points > 0 ? '+' : ''}{bonus.points} نقطة
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleEditBonusPoint(bonus)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => setDeleteBonusPointId(bonus.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-muted-foreground">
                          {formatDateWithDay(bonus.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* تفقد الأدوات */}
              {recordData.checkRecords && recordData.checkRecords.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    تفقد الأدوات ({recordData.checkRecords.length})
                    <span className="text-xs text-muted-foreground">
                      المحصلة:
                      <span className={recordData.checkPoints >= 0 ? 'text-green-600 ms-1' : 'text-red-600 ms-1'}>
                        {recordData.checkPoints > 0 ? `+${recordData.checkPoints}` : recordData.checkPoints} نقطة
                      </span>
                    </span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recordData.checkRecords.map((cr: any) => (
                      <div key={cr.id} className="border rounded-lg p-2 text-xs flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-medium">{cr.item_name}</span>
                          <span className="text-muted-foreground">{formatDateWithDay(cr.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cr.status === 'موجود' ? 'text-green-600 font-semibold' : cr.status === 'غير موجود' ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                            {cr.status}
                          </span>
                          <span className={cr.delta_points >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {cr.delta_points >= 0 ? `+${cr.delta_points}` : cr.delta_points}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={async () => {
                              // جلب تفاصيل العنصر
                              const { data: itemData } = await supabase
                                .from("check_items")
                                .select("*")
                                .eq("id", cr.item_id)
                                .single();

                              setCheckItemDetails(itemData);
                              setEditingCheckRecord(cr);
                              setEditCheckStatus(cr.status);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => setDeleteCheckRecordId(cr.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* سجل التسميع */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  سجل التسميع ({recordData.recitations.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recordData.recitations.length > 0 ? (
                    recordData.recitations.map((rec) => (
                      <div key={rec.id} className="border rounded-lg p-2 text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">{rec.last_saved}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-primary font-semibold">+{rec.points_awarded} نقطة</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingRecitation(rec);
                                setEditNotes(rec.notes || "");
                                setEditLastSaved(rec.last_saved || "");
                                setEditRating(rec.rating || "");
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => setDeleteRecitationId(rec.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 text-muted-foreground">
                          <span>{formatDateWithDay(rec.date)}</span>
                          <span>•</span>
                          <span className={
                            rec.rating === 'ممتاز' ? 'text-green-600' :
                              rec.rating === 'جيد' ? 'text-blue-600' :
                                'text-orange-600'
                          }>
                            {rec.rating}
                          </span>
                        </div>
                        {rec.notes && (
                          <p className="mt-1 text-muted-foreground italic">
                            ملاحظات: {rec.notes}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">لا يوجد سجل تسميع في هذه الفترة</p>
                  )}
                </div>
              </div>

              {/* قسم الملاحظات */}
              {recordData.recitations.filter(r => r.notes).length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    الملاحظات ({recordData.recitations.filter(r => r.notes).length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recordData.recitations
                      .filter(r => r.notes)
                      .map((rec) => (
                        <div key={rec.id} className="border rounded-lg p-3 text-xs bg-muted/30">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-muted-foreground font-medium">
                              {formatDateWithDay(rec.date)}
                            </span>
                            <span className={
                              rec.rating === 'ممتاز' ? 'text-green-600' :
                                rec.rating === 'جيد' ? 'text-blue-600' :
                                  'text-orange-600'
                            }>
                              {rec.rating}
                            </span>
                          </div>
                          <div className="mb-2 font-medium text-primary">
                            الصفحات: {rec.last_saved}
                          </div>
                          <p className="text-foreground">
                            {rec.notes}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* سجل الحضور */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  سجل الحضور ({recordData.attendance.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recordData.attendance.length > 0 ? (
                    recordData.attendance.map((att) => (
                      <div key={att.id} className="flex justify-between items-center border rounded-lg p-2 text-xs">
                        <span>{formatDateWithDay(att.date)}</span>
                        <div className="flex items-center gap-2">
                          <span className={
                            att.status === 'حاضر' ? 'text-green-600 font-semibold' :
                              att.status === 'غائب' ? 'text-red-600 font-semibold' :
                                'text-yellow-600 font-semibold'
                          }>
                            {att.status}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditingAttendance(att);
                              setEditAttendanceStatus(att.status);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => setDeleteAttendanceId(att.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">لا يوجد سجل حضور في هذه الفترة</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          إغلاق
        </Button>
      </DialogContent>

      {/* Bonus Points Edit Dialog */}
      {student && showBonusDialog && (
        <BonusPointsDialog
          open={showBonusDialog}
          onOpenChange={(open) => {
            setShowBonusDialog(open);
            if (!open) {
              setBonusDialogDate("");
            }
          }}
          student={student}
          teacherId={student.teacher_id || ""}
          selectedDate={bonusDialogDate}
          onSuccess={() => {
            setShowBonusDialog(false);
            setBonusDialogDate("");
            fetchStudentRecord();
          }}
        />
      )}

      {/* Edit Recitation Dialog */}
      <Dialog open={!!editingRecitation} onOpenChange={() => setEditingRecitation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">تعديل بيانات التسميع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">آخر محفوظ</Label>
              <Input
                value={editLastSaved}
                onChange={(e) => setEditLastSaved(e.target.value)}
                placeholder="مثال: سورة البقرة آية 50"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">التقييم</Label>
              <select
                value={editRating}
                onChange={(e) => setEditRating(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ممتاز">ممتاز (+2 نقطة)</option>
                <option value="جيد">جيد (+1 نقطة)</option>
                <option value="إعادة">إعادة (0 نقطة)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">الملاحظات</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أدخل الملاحظات..."
                className="text-sm"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpdateRecitation} className="flex-1 text-sm">
              حفظ التعديلات
            </Button>
            <Button variant="outline" onClick={() => setEditingRecitation(null)} className="flex-1 text-sm">
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editingAttendance} onOpenChange={() => setEditingAttendance(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">تعديل حالة الحضور</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">حالة الحضور</Label>
              <select
                value={editAttendanceStatus}
                onChange={(e) => setEditAttendanceStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="حاضر">حاضر (+1 نقطة)</option>
                <option value="غائب">غائب (-1 نقطة)</option>
                <option value="اعتذر">اعتذر (0 نقطة)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpdateAttendance} className="flex-1 text-sm">
              حفظ التعديلات
            </Button>
            <Button variant="outline" onClick={() => setEditingAttendance(null)} className="flex-1 text-sm">
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Check Record Dialog */}
      <Dialog open={!!editingCheckRecord} onOpenChange={() => {
        setEditingCheckRecord(null);
        setCheckItemDetails(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">تعديل حالة الأداة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs font-semibold">الأداة: {editingCheckRecord?.item_name}</Label>
            </div>
            <div>
              <Label className="text-xs">الحالة</Label>
              {checkItemDetails ? (
                <select
                  value={editCheckStatus}
                  onChange={(e) => setEditCheckStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="موجود">
                    أحضر ({checkItemDetails.points_brought > 0 ? '+' : ''}{checkItemDetails.points_brought})
                  </option>
                  <option value="غير موجود">
                    لم يحضر ({checkItemDetails.points_not_brought})
                  </option>
                  <option value="فقدان">
                    فقدان ({checkItemDetails.points_lost})
                  </option>
                  <option value="تجاوز">
                    تجاوز ({checkItemDetails.points_skipped})
                  </option>
                </select>
              ) : (
                <div className="text-xs text-muted-foreground">جاري التحميل...</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpdateCheckRecord} className="flex-1 text-sm" disabled={!checkItemDetails}>
              حفظ التعديلات
            </Button>
            <Button variant="outline" onClick={() => {
              setEditingCheckRecord(null);
              setCheckItemDetails(null);
            }} className="flex-1 text-sm">
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={!!deleteRecitationId} onOpenChange={() => setDeleteRecitationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد حذف سجل التسميع</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من حذف سجل التسميع؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecitation} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBonusPointId} onOpenChange={() => setDeleteBonusPointId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد حذف النقاط الإضافية</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من حذف النقاط الإضافية؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBonusPoint} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAttendanceId} onOpenChange={() => setDeleteAttendanceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد حذف سجل الحضور</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من حذف سجل الحضور؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAttendance} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCheckRecordId} onOpenChange={() => setDeleteCheckRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد حذف سجل تفقد الأدوات</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من حذف سجل تفقد الأدوات؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCheckRecord} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteTeacherHistoryId} onOpenChange={() => setDeleteTeacherHistoryId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">تأكيد حذف سجل تغيير الأستاذ</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من حذف هذا السجل؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeacherHistory} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* حوار تأكيد حذف جميع السجلات */}
      <AlertDialog open={deleteAllRecords} onOpenChange={setDeleteAllRecords}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              تأكيد حذف جميع السجلات
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>سيتم حذف السجلات التالية للطالب <strong className="text-foreground">{student?.student_name}</strong>:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {recordData?.recitations && recordData.recitations.length > 0 && (
                  <li>سجلات التسميع: <strong className="text-foreground">{recordData.recitations.length}</strong></li>
                )}
                {recordData?.attendance && recordData.attendance.length > 0 && (
                  <li>سجلات الحضور: <strong className="text-foreground">{recordData.attendance.length}</strong></li>
                )}
                {recordData?.bonusPoints && recordData.bonusPoints.length > 0 && (
                  <li>النقاط الإضافية: <strong className="text-foreground">{recordData.bonusPoints.length}</strong></li>
                )}
                {recordData?.checkRecords && recordData.checkRecords.length > 0 && (
                  <li>سجلات تفقد الأدوات: <strong className="text-foreground">{recordData.checkRecords.length}</strong></li>
                )}
                {teacherHistory.length > 0 && (
                  <li>سجل تغييرات الأساتذة: <strong className="text-foreground">{teacherHistory.length}</strong></li>
                )}
              </ul>
              <p className="text-destructive font-bold mt-3">
                ⚠️ هذا الإجراء لا يمكن التراجع عنه!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllRecords}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? "جاري الحذف..." : "حذف جميع السجلات"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default StudentRecordDialog;
