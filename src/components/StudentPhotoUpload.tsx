import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, User, Loader2, ImagePlus, Camera, FlipHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ImageCropDialog from "./ImageCropDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudentPhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (url: string | null) => void;
  studentId?: string;
  disabled?: boolean;
}

const StudentPhotoUpload = ({
  currentPhotoUrl,
  onPhotoChange,
  studentId,
  disabled = false
}: StudentPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State للاقتصاص
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // State للكاميرا
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // دالة ضغط الصورة
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // تصغير الأبعاد إذا كانت كبيرة جداً
          const maxDimension = 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // محاولة الضغط مع جودة متناقصة حتى نصل للحجم المطلوب
          const tryCompress = (quality: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("فشل ضغط الصورة"));
                  return;
                }

                // إذا كان الحجم أقل من 300KB أو وصلنا لأقل جودة ممكنة
                if (blob.size <= 300 * 1024 || quality <= 0.1) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  // تقليل الجودة والمحاولة مرة أخرى
                  tryCompress(quality - 0.1);
                }
              },
              'image/jpeg',
              quality
            );
          };

          tryCompress(0.9); // البدء بجودة 90%
        };
        img.onerror = () => reject(new Error("فشل تحميل الصورة"));
      };
      reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    });
  };

  // فتح الكاميرا
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      // إيقاف أي stream موجود
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      setCameraStream(stream);
      setFacingMode(mode);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error: any) {
      console.error("Camera error:", error);
      if (error.name === "NotAllowedError") {
        toast.error("لم يتم السماح بالوصول للكاميرا");
      } else if (error.name === "NotFoundError") {
        toast.error("لم يتم العثور على كاميرا");
      } else {
        toast.error("حدث خطأ في فتح الكاميرا");
      }
      setCameraOpen(false);
    }
  }, [cameraStream, facingMode]);

  // إيقاف الكاميرا
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
  }, [cameraStream]);

  // تبديل الكاميرا الأمامية/الخلفية
  const switchCamera = useCallback(() => {
    const newMode = facingMode === "user" ? "environment" : "user";
    startCamera(newMode);
  }, [facingMode, startCamera]);

  // التقاط صورة من الكاميرا
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // ضبط أبعاد الـ canvas لتكون مربعة
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // حساب الموضع للاقتصاص من المنتصف
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // رسم الصورة مقتصة من المنتصف
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    // تحويل إلى data URL
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    // إيقاف الكاميرا
    stopCamera();

    // فتح نافذة الاقتصاص مع الصورة الملتقطة
    setImageToCrop(dataUrl);
    setCropDialogOpen(true);
  }, [stopCamera]);

  // فتح نافذة الكاميرا
  const openCamera = useCallback(() => {
    setCameraOpen(true);
    setTimeout(() => startCamera(), 100);
  }, [startCamera]);

  // فتح نافذة الاقتصاص بدلاً من الرفع المباشر
  const openCropDialog = (file: File) => {
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }

    // التحقق من حجم الملف الأولي (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً");
      return;
    }

    // تحويل الملف إلى data URL لعرضه في نافذة الاقتصاص
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // معالجة الصورة المقتصة ورفعها
  const handleCroppedImage = async (croppedBlob: Blob) => {
    try {
      setUploading(true);

      // تحويل Blob إلى File
      const croppedFile = new File([croppedBlob], "cropped-image.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      // ضغط الصورة
      const compressedFile = await compressImage(croppedFile);
      console.log(`الحجم بعد الاقتصاص: ${(croppedFile.size / 1024).toFixed(2)}KB، بعد الضغط: ${(compressedFile.size / 1024).toFixed(2)}KB`);

      // إنشاء preview محلي
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      // رفع الصورة إلى Supabase Storage
      const fileName = `${studentId || Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${fileName}`;

      // حذف الصورة القديمة إذا وجدت
      if (currentPhotoUrl && studentId) {
        const oldPath = currentPhotoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('student-photos')
            .remove([oldPath]);
        }
      }

      const { data, error } = await supabase.storage
        .from('student-photos')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // الحصول على الرابط العام
      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(data.path);

      // تحديث قاعدة البيانات إذا كان هناك studentId
      if (studentId) {
        const { error: updateError } = await supabase
          .from('students')
          .update({ photo_url: publicUrl })
          .eq('id', studentId);

        if (updateError) {
          console.warn("تحذير: لم نتمكن من تحديث الصورة في قاعدة البيانات:", updateError);
        }
      }

      onPhotoChange(publicUrl);
      toast.success("تم رفع الصورة بنجاح");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error(error.message || "حدث خطأ في رفع الصورة");
      setPreviewUrl(currentPhotoUrl || null);
    } finally {
      setUploading(false);
      setImageToCrop(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      openCropDialog(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      openCropDialog(file);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setUploading(true);

      // حذف الصورة من Storage إذا كانت موجودة
      if (currentPhotoUrl) {
        try {
          // استخراج اسم الملف من الرابط بشكل صحيح
          const urlParts = currentPhotoUrl.split('/student-photos/');
          const fileName = urlParts.length > 1 ? urlParts[1].split('?')[0] : currentPhotoUrl.split('/').pop()?.split('?')[0];

          if (fileName) {
            const { error: storageError } = await supabase.storage
              .from('student-photos')
              .remove([fileName]);

            if (storageError) {
              console.warn("تحذير: لم نتمكن من حذف الملف من Storage:", storageError);
            }
          }
        } catch (storageErr) {
          console.warn("تحذير: خطأ في حذف الملف من Storage:", storageErr);
        }
      }

      // تحديث قاعدة البيانات لإزالة رابط الصورة
      if (studentId) {
        const { error: dbError } = await supabase
          .from('students')
          .update({ photo_url: null })
          .eq('id', studentId);

        if (dbError) throw dbError;
      }

      setPreviewUrl(null);
      onPhotoChange(null);
      toast.success("تم حذف الصورة بنجاح");
    } catch (error: any) {
      console.error("Error removing photo:", error);
      toast.error("حدث خطأ في حذف الصورة: " + (error.message || "خطأ غير متوقع"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>صورة الطالب</Label>

      {/* منطقة السحب والإفلات */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all",
          isDragging && !disabled && !uploading
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50",
          (disabled || uploading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-border flex-shrink-0">
            <AvatarImage src={previewUrl || undefined} alt="صورة الطالب" />
            <AvatarFallback className="bg-muted">
              <User className="h-12 w-12 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={disabled || uploading}
              className="hidden"
              id="photo-upload"
            />

            {isDragging && !disabled && !uploading ? (
              <div className="flex items-center justify-center gap-2 text-primary py-2">
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm font-medium">أفلت الصورة هنا</span>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {previewUrl ? 'تغيير الصورة' : 'رفع صورة'}
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openCamera}
                  disabled={disabled || uploading}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  التقاط صورة
                </Button>

                {previewUrl && !uploading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemovePhoto}
                    disabled={disabled}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    حذف الصورة
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {!previewUrl && !uploading && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            اسحب وأفلت الصورة هنا أو انقر على زر الرفع
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        سيتم اقتصاص الصورة بشكل مربع وضغطها تلقائياً • الصيغ المدعومة: JPG, PNG, WEBP, GIF
      </p>

      {/* نافذة الاقتصاص */}
      {imageToCrop && (
        <ImageCropDialog
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            setImageToCrop(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCroppedImage}
        />
      )}

      {/* نافذة الكاميرا */}
      <Dialog open={cameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">التقاط صورة</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {/* معاينة الكاميرا */}
            <div className="relative w-64 h-64 bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />
              {!cameraStream && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Canvas مخفي لالتقاط الصورة */}
            <canvas ref={canvasRef} className="hidden" />

            {/* أزرار التحكم */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={switchCamera}
                disabled={!cameraStream}
                title="تبديل الكاميرا"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                size="lg"
                onClick={capturePhoto}
                disabled={!cameraStream}
                className="gap-2 px-8"
              >
                <Camera className="h-5 w-5" />
                التقاط
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={stopCamera}
              >
                إلغاء
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              سيتم اقتصاص الصورة بشكل مربع من المنتصف
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentPhotoUpload;
