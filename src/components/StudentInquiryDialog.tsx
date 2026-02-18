import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StudentInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StudentInquiryDialog = ({ open, onOpenChange }: StudentInquiryDialogProps) => {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");

  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = studentId.trim();

    if (!trimmedId) {
      setError("الرجاء إدخال معرف الطالب");
      return;
    }

    if (!isValidUUID(trimmedId)) {
      setError("معرف الطالب غير صالح. يجب أن يكون بصيغة UUID");
      return;
    }

    // Navigate to student inquiry page
    navigate(`/student-inquiry?id=${trimmedId}`);
    onOpenChange(false);
    setStudentId("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setStudentId("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="w-5 h-5" />
            الاستعلام عن طالب
          </DialogTitle>
          <DialogDescription>
            أدخل المعرف الخاص بطالبك للاستعلام عن معلوماته وسجلاته
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Info Alert */}
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="w-4 h-4 text-primary" />
            <AlertDescription className="text-sm">
              💡 يمكنك الحصول على معرف طالبك من إدارة المسجد أو معلم الطالب
            </AlertDescription>
          </Alert>

          {/* Input Field */}
          <div className="space-y-2">
            <Label htmlFor="student-id" className="text-base font-medium">
              معرف الطالب (UUID)
            </Label>
            <Input
              id="student-id"
              type="text"
              placeholder="مثال: 550e8400-e29b-41d4-a716-446655440000"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setError("");
              }}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              المعرف عبارة عن سلسلة من الأحرف والأرقام بصيغة UUID
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={!studentId.trim()}
            >
              <Search className="w-4 h-4" />
              استعلام
            </Button>
          </div>

          {/* Additional Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">ماذا يمكنك رؤيته؟</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>معلومات الطالب الأساسية</li>
              <li>إجمالي النقاط والتفاصيل</li>
              <li>سجل الحضور والغياب</li>
              <li>سجل التسميع والحفظ</li>
              <li>سجل تفقد الأدوات</li>
              <li>النقاط الإضافية</li>
            </ul>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StudentInquiryDialog;
