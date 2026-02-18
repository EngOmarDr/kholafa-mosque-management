import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      toast.success("تم تثبيت التطبيق بنجاح!");
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.error("التثبيت غير متاح حالياً");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success("جاري التثبيت...");
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const getInstallInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      return {
        platform: "iOS (iPhone/iPad)",
        steps: [
          "اضغط على زر المشاركة (⬆️) في متصفح Safari",
          "اختر 'إضافة إلى الشاشة الرئيسية'",
          "اضغط 'إضافة' للتأكيد",
        ]
      };
    }

    if (isAndroid) {
      return {
        platform: "Android",
        steps: [
          "اضغط على القائمة (⋮) في المتصفح",
          "اختر 'تثبيت التطبيق' أو 'إضافة إلى الشاشة الرئيسية'",
          "اضغط 'تثبيت' للتأكيد",
        ]
      };
    }

    return {
      platform: "الكمبيوتر",
      steps: [
        "ابحث عن أيقونة التثبيت (⊕) في شريط العنوان",
        "اضغط على 'تثبيت' في النافذة المنبثقة",
      ]
    };
  };

  const instructions = getInstallInstructions();

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-accent/20">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle>التطبيق مثبت بالفعل!</CardTitle>
            <CardDescription>
              التطبيق مثبت على جهازك ويعمل حالياً
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = "/"} className="w-full">
              الانتقال إلى الصفحة الرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-accent/20">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">ثبّت تطبيق جيل صالح</CardTitle>
          <CardDescription className="text-base mt-2">
            احصل على تجربة أفضل مع التطبيق المثبت على جهازك
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: "⚡", title: "أداء أسرع", desc: "تحميل فوري وأداء محسّن" },
              { icon: "📱", title: "يعمل بدون إنترنت", desc: "استخدام التطبيق حتى بدون اتصال" },
              { icon: "🔔", title: "إشعارات فورية", desc: "احصل على تنبيهات هامة" },
              { icon: "🏠", title: "الوصول السريع", desc: "أيقونة على الشاشة الرئيسية" },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-2xl">{feature.icon}</span>
                <div>
                  <h4 className="font-semibold text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Install Button */}
          {isInstallable ? (
            <Button 
              onClick={handleInstall}
              size="lg"
              className="w-full text-lg h-14"
            >
              <Download className="ml-2 w-5 h-5" />
              ثبّت التطبيق الآن
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  التثبيت التلقائي غير متاح. اتبع التعليمات أدناه للتثبيت اليدوي
                </p>
              </div>

              {/* Manual Installation Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">طريقة التثبيت - {instructions.platform}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {instructions.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Back to Home */}
          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/"}
            className="w-full"
          >
            العودة إلى الصفحة الرئيسية
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallPWA;
