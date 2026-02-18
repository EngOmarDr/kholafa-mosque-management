import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X, Download, ZoomIn, ZoomOut, Edit, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import StudentPhotoUpload from "./StudentPhotoUpload";

interface StudentPhotoViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
  studentName: string;
  studentId?: string;
  canEdit?: boolean;
  onPhotoUpdate?: (newUrl: string | null) => void;
}

const StudentPhotoViewDialog = ({
  open,
  onOpenChange,
  photoUrl,
  studentName,
  studentId,
  canEdit = false,
  onPhotoUpdate
}: StudentPhotoViewDialogProps) => {
  const [zoom, setZoom] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl);
  const minZoom = 0.5;
  const maxZoom = 3;
  const zoomStep = 0.2;

  useEffect(() => {
    if (open) {
      setZoom(1);
      // إذا لم تكن هناك صورة، افتح وضع التعديل مباشرة
      if (!photoUrl && canEdit) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    }
    // تحديث الـ preview عند تغيير الـ photoUrl
    setPreviewUrl(photoUrl);
  }, [open, photoUrl, canEdit]);

  const handlePhotoChange = (newUrl: string | null) => {
    if (onPhotoUpdate) {
      onPhotoUpdate(newUrl);
    }
    setPreviewUrl(newUrl);
    setIsEditing(false);
    onOpenChange(false);
    toast.success(newUrl ? "تم تحديث الصورة بنجاح" : "تم حذف الصورة بنجاح");
  };

  // إذا لم تكن هناك صورة ولا يمكن التعديل، لا نعرض شيء
  if (!photoUrl && !canEdit) return null;

  // إذا لم تكن هناك صورة ويمكن التعديل، اعرض واجهة رفع الصورة مباشرة
  if (!photoUrl && canEdit && studentId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-full">
          <DialogTitle className="text-lg font-semibold">إضافة صورة لـ {studentName}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">قم برفع صورة للطالب</DialogDescription>
          <div className="space-y-4 pt-2">
            <StudentPhotoUpload
              currentPhotoUrl={null}
              onPhotoChange={handlePhotoChange}
              studentId={studentId}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${studentName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("تم تحميل الصورة بنجاح");
    } catch (error) {
      toast.error("فشل تحميل الصورة");
      console.error("Error downloading image:", error);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + zoomStep, maxZoom));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - zoomStep, minZoom));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  if (isEditing && studentId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-full">
          <DialogTitle className="sr-only">تعديل صورة {studentName}</DialogTitle>
          <DialogDescription className="sr-only">قم برفع صورة جديدة أو حذف الصورة الحالية</DialogDescription>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">تعديل صورة {studentName}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <StudentPhotoUpload
              currentPhotoUrl={photoUrl}
              onPhotoChange={handlePhotoChange}
              studentId={studentId}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <DialogTitle className="sr-only">عرض صورة {studentName}</DialogTitle>
        <DialogDescription className="sr-only">صورة الطالب {studentName} بالحجم الكامل</DialogDescription>
        <div className="relative bg-background">
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 hover:bg-background"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {canEdit && studentId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-background/80 hover:bg-background"
                  onClick={() => setIsEditing(true)}
                  title="تعديل الصورة"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 hover:bg-background"
                onClick={handleZoomOut}
                disabled={zoom <= minZoom}
                title="تصغير"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="bg-background/80 hover:bg-background px-3"
                onClick={handleResetZoom}
                title="إعادة تعيين"
              >
                <span className="text-xs font-medium">{Math.round(zoom * 100)}%</span>
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 hover:bg-background"
                onClick={handleZoomIn}
                disabled={zoom >= maxZoom}
                title="تكبير"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 hover:bg-background"
                onClick={handleDownload}
                title="تحميل الصورة"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4 text-center">{studentName}</h3>
            <div 
              className="flex items-center justify-center overflow-auto max-h-[70vh]"
              onWheel={handleWheel}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={studentName}
                  className="rounded-lg transition-transform duration-200 cursor-zoom-in"
                  style={{ 
                    transform: `scale(${zoom})`,
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <User className="h-24 w-24 mb-4 opacity-50" />
                  <p>لا توجد صورة</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentPhotoViewDialog;
