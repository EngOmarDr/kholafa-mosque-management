import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

interface StudentReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
  onSuccess: () => void;
}

export function StudentReactivateDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  onSuccess,
}: StudentReactivateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("مسجل");

  useEffect(() => {
    if (open) {
      fetchTeachers();
    }
  }, [open]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, \"اسم الاستاذ\"")
        .order("اسم الاستاذ", { ascending: true });

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل قائمة الأساتذة");
    }
  };

  const handleReactivate = async () => {
    if (!studentId) return;

    if (!selectedTeacherId) {
      toast.error("يرجى اختيار أستاذ للطالب");
      return;
    }

    setLoading(true);

    try {
      const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
      
      const { error } = await supabase
        .from("students")
        .update({
          teacher_id: selectedTeacherId,
          current_teacher: selectedTeacher?.["اسم الاستاذ"] || null,
          registration_status: selectedStatus,
        })
        .eq("id", studentId);

      if (error) throw error;

      toast.success("تم إعادة تسجيل الطالب بنجاح");
      onSuccess();
      onOpenChange(false);
      setSelectedTeacherId("");
      setSelectedStatus("مسجل");
    } catch (error) {
      console.error("Error reactivating student:", error);
      toast.error("حدث خطأ أثناء إعادة تسجيل الطالب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            إعادة تسجيل الطالب
          </DialogTitle>
          <DialogDescription>
            إعادة تفعيل وتسجيل الطالب: <span className="font-bold text-foreground">{studentName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="teacher">الأستاذ الجديد <span className="text-destructive">*</span></Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger id="teacher">
                <SelectValue placeholder="اختر أستاذاً" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher["اسم الاستاذ"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">حالة التسجيل <span className="text-destructive">*</span></Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="مسجل">مسجل</SelectItem>
                <SelectItem value="غير مدرج بعد">غير مدرج بعد</SelectItem>
                <SelectItem value="انتظار">انتظار</SelectItem>
                <SelectItem value="متدرب">متدرب</SelectItem>
                <SelectItem value="فترة تجربة">فترة تجربة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleReactivate}
            disabled={loading || !selectedTeacherId}
          >
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إعادة التسجيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
