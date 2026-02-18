import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Save, BookOpen, Users } from "lucide-react";

interface PointsSetting {
  id: string;
  category: string;
  key: string;
  label: string;
  points: number;
}

const AdminPointsSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendanceSettings, setAttendanceSettings] = useState<PointsSetting[]>([]);
  const [recitationSettings, setRecitationSettings] = useState<PointsSetting[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("points_settings")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;

      const attendance = data?.filter(s => s.category === "attendance") || [];
      const recitation = data?.filter(s => s.category === "recitation") || [];

      setAttendanceSettings(attendance);
      setRecitationSettings(recitation);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast.error("خطأ في جلب الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const updateAttendanceSetting = (id: string, points: number) => {
    setAttendanceSettings(prev => 
      prev.map(s => s.id === id ? { ...s, points } : s)
    );
  };

  const updateRecitationSetting = (id: string, points: number) => {
    setRecitationSettings(prev => 
      prev.map(s => s.id === id ? { ...s, points } : s)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allSettings = [...attendanceSettings, ...recitationSettings];
      
      for (const setting of allSettings) {
        const { error } = await supabase
          .from("points_settings")
          .update({ points: setting.points })
          .eq("id", setting.id);
        
        if (error) throw error;
      }

      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("خطأ في حفظ الإعدادات: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getColorForKey = (key: string) => {
    switch (key) {
      case "present":
      case "excellent":
        return "text-green-600 dark:text-green-400";
      case "absent":
      case "repeat":
        return "text-red-600 dark:text-red-400";
      case "excused":
      case "good":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout title="إعدادات النقاط">
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">إعدادات النقاط</h1>
              <p className="text-sm text-muted-foreground">
                تعديل قيم نقاط الحضور والتسميع
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 ml-2" />
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  نقاط الحضور
                </CardTitle>
                <CardDescription>
                  تحديد النقاط لكل حالة حضور
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceSettings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell className={`font-medium ${getColorForKey(setting.key)}`}>
                          {setting.label}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.25"
                            value={setting.points}
                            onChange={(e) => updateAttendanceSetting(setting.id, parseFloat(e.target.value || "0"))}
                            className="w-24"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recitation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  نقاط التسميع
                </CardTitle>
                <CardDescription>
                  تحديد النقاط لكل تقييم تسميع
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التقييم</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recitationSettings.map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell className={`font-medium ${getColorForKey(setting.key)}`}>
                          {setting.label}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.25"
                            value={setting.points}
                            onChange={(e) => updateRecitationSetting(setting.id, parseFloat(e.target.value || "0"))}
                            className="w-24"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• يمكنك إدخال أرقام عشرية مثل 0.25، 0.50، 1.75</p>
              <p>• القيم السالبة تعني خصم نقاط (مثل -1 للغياب)</p>
              <p>• التغييرات ستنعكس فوراً على حساب النقاط للطلاب الجدد</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPointsSettings;
