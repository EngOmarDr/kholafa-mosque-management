import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // التحقق مما إذا كان التطبيق مثبتاً بالفعل
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // الاستماع لحدث beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // الاستماع لحدث التثبيت
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      toast.success('تم تثبيت التطبيق بنجاح! 🎉');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // إذا لم يكن التثبيت متاحاً، اعرض رسالة توضيحية
      toast.info('لتثبيت التطبيق على جهازك:\n\n' +
        '📱 على الجوال:\n' +
        '• في Chrome/Safari: اضغط على قائمة المتصفح ثم "إضافة إلى الشاشة الرئيسية"\n\n' +
        '💻 على الكمبيوتر:\n' +
        '• في Chrome: اضغط على أيقونة التثبيت في شريط العنوان', 
        { duration: 6000 }
      );
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('جاري تثبيت التطبيق...');
      } else {
        toast.info('يمكنك تثبيت التطبيق في أي وقت من الإعدادات');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('خطأ في التثبيت:', error);
      toast.error('حدث خطأ أثناء محاولة التثبيت');
    }
  };

  // إذا كان التطبيق مثبتاً بالفعل
  if (isInstalled) {
    return (
      <Button
        variant="outline"
        className="flex items-center gap-2"
        disabled
      >
        <Smartphone className="w-4 h-4" />
        التطبيق مثبت ✓
      </Button>
    );
  }

  return (
    <Button
      onClick={handleInstallClick}
      variant={isInstallable ? "default" : "outline"}
      className="flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      {isInstallable ? 'تثبيت التطبيق' : 'معلومات التثبيت'}
    </Button>
  );
};

export default PWAInstallButton;
