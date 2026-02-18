import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addToSyncQueue } from "@/lib/backgroundSync";
import { saveLocalBonusPoints } from "@/lib/offlineStorage";
// removed unused import from date-fns
interface BonusPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  teacherId: string;
  selectedDate?: string;
  onSuccess?: () => void;
}
const BonusPointsDialog = ({
  open,
  onOpenChange,
  student,
  teacherId,
  selectedDate,
  onSuccess,
}: BonusPointsDialogProps) => {
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"add" | "deduct">("add");
  const [loading, setLoading] = useState(false);
  const [bonusPoint, setBounsPoint] = useState<any | undefined>();

  async function getData() {
    try {
      const { data, error: fetchError } = await supabase
        .from("bonus_points")
        .select("*")
        .eq("student_id", student.id)
        .eq("date", selectedDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      setBounsPoint(data);

      if (data) {
        const absPoints = Math.abs(data.points || 0);
        setPoints(String(absPoints));
        setType((data.points || 0) >= 0 ? "add" : "deduct");
        setReason(data.reason || "");
      } else {
        setPoints("");
        setType("add");
        setReason("");
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Prefill when editing an existing bonusPoint
  useEffect(() => {
    if (open) {
      getData();
    } else {
      // reset when closed
      setBounsPoint(undefined);
      setPoints("");
      setReason("");
      setType("add");
    }
  }, [student?.id, open, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!points || !reason.trim()) {
      toast.error("يرجى إدخال جميع الحقول المطلوبة");
      return;
    }

    const pointsValue = parseInt(points);
    if (isNaN(pointsValue) || pointsValue <= 0) {
      toast.error("يرجى إدخال عدد نقاط صحيح");
      return;
    }

    setLoading(true);
    
    try {
      const finalPoints = type === "add" ? pointsValue : -pointsValue;
      
      const bonusData = {
        student_id: student.id,
        teacher_id: teacherId,
        points: finalPoints,
        reason: reason.trim(),
        date: selectedDate || new Date().toISOString().split("T")[0],
      };
      
      // فحص حالة الاتصال
      if (!navigator.onLine && !bonusPoint?.id) {
        // وضع Offline - حفظ محلياً (فقط للإضافة الجديدة، ليس للتعديل)
        addToSyncQueue({
          type: 'bonus_points',
          data: bonusData
        });
        
        saveLocalBonusPoints(bonusData);
        
        toast.info(`تم حفظ ${pointsValue} نقطة محلياً - سيتم المزامنة عند توفر الإنترنت`);
        
        setPoints("");
        setReason("");
        setType("add");
        onOpenChange(false);
        if (onSuccess) onSuccess();
        setLoading(false);
        return;
      }
      
      let error = null;

      if (bonusPoint && bonusPoint.id) {
        // Update existing record
        console.log(bonusPoint.id);

        const { error: updateError } = await supabase
          .from("bonus_points")
          .update({
            points: finalPoints,
            reason: reason.trim(),
            date: selectedDate || new Date().toISOString().split("T")[0],
          })
          .eq("id", bonusPoint.id);

        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("bonus_points")
          .insert({
            student_id: student.id,
            teacher_id: teacherId,
            points: finalPoints,
            reason: reason.trim(),
            date: selectedDate || new Date().toISOString().split("T")[0],
          });

        error = insertError;
      }

      if (error) throw error;

      toast.success(
        `تم ${
          bonusPoint ? "تحديث" : type === "add" ? "إضافة" : "خصم"
        } ${pointsValue} نقطة بنجاح`
      );
      setPoints("");
      setReason("");
      setType("add");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error adding bonus points:", error);
      toast.error("حدث خطأ في تسجيل النقاط");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-describedby="bonus-points-desc"
    >
      <DialogContent
        className="sm:max-w-md"
        aria-describedby="bonus-points-desc"
      >
        <DialogHeader>
          <DialogTitle>نقاط إضافية: {student?.student_name}</DialogTitle>
          {/* <DialogDescription id="bonus-points-desc">
            استخدم هذه النافذة لإضافة أو تعديل نقاط الطالب. الرجاء إدخال عدد
            النقاط والسبب.
          </DialogDescription> */}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label>نوع العملية</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "add" | "deduct")}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add" className="cursor-pointer">
                  إضافة نقاط
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="deduct" id="deduct" />
                <Label htmlFor="deduct" className="cursor-pointer">
                  خصم نقاط
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>عدد النقاط</Label>
            <Input
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="أدخل عدد النقاط"
              required
            />
          </div>

          <div>
            <Label>السبب</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اذكر سبب إضافة أو خصم النقاط..."
              rows={3}
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading
                ? "جاري الحفظ..."
                : bonusPoint && bonusPoint.id
                ? "تعديل"
                : "حفظ"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BonusPointsDialog;
