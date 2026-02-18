import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle } from "lucide-react";

interface RoleChangeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  onConfirm: () => void;
  loading?: boolean;
}

export const RoleChangeConfirmationDialog = ({
  open,
  onOpenChange,
  teacherName,
  onConfirm,
  loading = false
}: RoleChangeConfirmationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">تأكيد تحويل الصلاحيات</DialogTitle>
          </div>
          <DialogDescription className="text-base text-right space-y-3 mt-4">
            <p>
              سيتم تحويل الأستاذ <span className="font-bold text-foreground">{teacherName}</span> إلى دور{" "}
              <span className="font-bold text-primary">أدمن</span> مع صلاحيات كاملة.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-right space-y-2">
                <p className="font-semibold">صلاحيات الأدمن تشمل:</p>
                <ul className="space-y-1 mr-4">
                  <li>• إدارة جميع الطلاب والمعلمين</li>
                  <li>• الوصول إلى جميع البيانات والتقارير</li>
                  <li>• تعديل إعدادات النظام</li>
                  <li>• إضافة وحذف المستخدمين</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1"
              disabled={loading}
            >
              {loading ? "جاري التحويل..." : "تأكيد التحويل"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
