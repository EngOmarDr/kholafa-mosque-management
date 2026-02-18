import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const BulkAddTeachers = () => {
  const [teacherNames, setTeacherNames] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);

  const handleBulkAdd = async () => {
    const names = teacherNames
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) {
      toast.error("يرجى إدخال أسماء الأساتذة");
      return;
    }

    setLoading(true);
    setResults([]);
    setErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-teachers', {
        body: { teacherNames: names }
      });

      if (error) throw error;

      setResults(data.results || []);
      setErrors(data.errors || []);

      toast.success(
        <div>
          <p className="font-bold">تمت العملية! ✅</p>
          <p className="text-sm">نجح: {data.created} | فشل: {data.failed}</p>
        </div>,
        { duration: 5000 }
      );

      // مسح النص بعد النجاح
      if (data.created > 0) {
        setTeacherNames("");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("حدث خطأ أثناء إضافة الأساتذة");
    } finally {
      setLoading(false);
    }
  };

  const defaultTeachers = `حسن صراميجو
يمان مصمص
احمد هلال
أنس العقاد
جعفر الحافظ
غياث الرفاعي 
محمد المحمد
ابو احمد قدقود
بشر السحلي
عبد الله كريز
بلال العقاد
ايمن ابوقبع 2
حسن السحلي
أيمن أبوقبع
فاضل خولاني
عبادة السوادي
عبيدة مصمص
مصعب رسلان تاج
محمد منصور
زيد عبد الرحمن
عمر درباع
قصي عبيد
محمد السحلي
فادي الباشا
قصي سلعس
عمار الدبا 
مؤمن عكيل
اليمان السحلي
حسام زينية
احمد ابوقبع
عمر محمود
بشار برغلة
محمد خير طلب
حذيفة محمود
احمد محمود
تامر ياسمينة
حمزة محمود
حمزة طلب
محمود شواهين
جديد
تلقين
علي الأحمر 
عمرو السوادي
مالك قرقور
محمود عبد الرحمن
عبد الله عفا
احمد الموسى
عمرو سلعس
سعد ابو قبع
تامر ياسمينة
احمد السحلي
أيهم خنجر
اسامة الزرع
تركي خليفة
احمد بشير
عبد الله الباشا`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            إضافة أساتذة بالجملة وإنشاء حساباتهم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              أسماء الأساتذة (اسم في كل سطر)
            </label>
            <Textarea
              value={teacherNames}
              onChange={(e) => setTeacherNames(e.target.value)}
              placeholder="أدخل اسم أستاذ في كل سطر..."
              className="min-h-[300px] font-mono"
              dir="rtl"
            />
            <p className="text-xs text-muted-foreground mt-1">
              سيتم إضافة كل أستاذ وإنشاء حساب له تلقائياً
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleBulkAdd}
              disabled={loading || !teacherNames.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 ml-2" />
                  إضافة الأساتذة وإنشاء الحسابات
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setTeacherNames(defaultTeachers)}
              disabled={loading}
            >
              ملء القائمة الافتراضية
            </Button>
          </div>

          {/* النتائج */}
          {(results.length > 0 || errors.length > 0) && (
            <div className="space-y-4 mt-6">
              {results.length > 0 && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CardHeader>
                    <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2 text-lg">
                      <CheckCircle2 className="w-5 h-5" />
                      تم بنجاح ({results.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {results.map((result, idx) => (
                          <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded border">
                            <p className="font-bold">{result.name}</p>
                            <p className="text-sm text-muted-foreground">البريد: {result.email}</p>
                            <p className="text-sm text-muted-foreground">كلمة المرور: {result.password}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {errors.length > 0 && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <CardHeader>
                    <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2 text-lg">
                      <XCircle className="w-5 h-5" />
                      فشل ({errors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {errors.map((error, idx) => (
                          <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded border">
                            <p className="font-bold">{error.name}</p>
                            <p className="text-sm text-red-600">{error.error}</p>
                            {error.details && (
                              <p className="text-xs text-muted-foreground">{error.details}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkAddTeachers;