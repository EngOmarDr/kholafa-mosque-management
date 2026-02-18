import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Copy, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface StudentAccountDialogProps {
  student: {
    id: string;
    student_name: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StudentAccountDialog = ({ student, open, onOpenChange }: StudentAccountDialogProps) => {
  const [copied, setCopied] = useState(false);

  if (!student) return null;

  const inquiryUrl = `${window.location.origin}/student-inquiry?id=${student.id}`;

  const handleCopyId = () => {
    navigator.clipboard.writeText(student.id);
    setCopied(true);
    toast.success("تم نسخ المعرف ✓");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(
      `مرحباً، يمكنك الاستعلام عن طالبك من خلال الرابط التالي:\n${inquiryUrl}\n\nمعرف الطالب: ${student.id}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="w-5 h-5" />
            حساب الطالب
          </DialogTitle>
          <DialogDescription>
            معلومات الحساب لمشاركتها مع ولي الأمر
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Student Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              اسم الطالب
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium">{student.student_name}</p>
            </div>
          </div>

          {/* Student ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              معرف الطالب (UUID)
            </label>
            <div className="p-3 bg-muted rounded-lg border">
              <p className="font-mono text-sm break-all text-foreground">
                {student.id}
              </p>
            </div>
          </div>

          {/* Inquiry URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              رابط الاستعلام
            </label>
            <div className="p-3 bg-muted rounded-lg border">
              <p className="text-sm break-all text-primary">
                {inquiryUrl}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleCopyId}
              className="flex-1 gap-2"
              variant="default"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  نسخ المعرف
                </>
              )}
            </Button>

            <Button
              onClick={handleSendWhatsApp}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="w-4 h-4" />
              إرسال لواتساب
            </Button>
          </div>

          {/* Info Alert */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 يمكن لولي الأمر استخدام هذا المعرف أو الرابط للاستعلام عن معلومات
              الطالب والسجلات الخاصة به بدون الحاجة لتسجيل الدخول
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentAccountDialog;
