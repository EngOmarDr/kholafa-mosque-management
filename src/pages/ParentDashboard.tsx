import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/StatsCard";
import { Users, TrendingUp, CheckCircle, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useRequireAuth } from "@/hooks/useRequireAuth";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "parent") {
        toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
        navigate("/login");
        return;
      }
      fetchChildren(user.id);
    }

    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchChildren = async (parentId: string) => {
    try {
      const { data, error } = await supabase
        .from("guardianships")
        .select(`
          *,
          students:student_id(
            *,
            points_balance(total),
            students_profiles(last_memorization),
            attendance(status, date)
          )
        `)
        .eq("parent_id", parentId);

      if (error) throw error;

      setChildren(data?.map(g => g.students) || []);
    } catch (error) {
      console.error("Error fetching children:", error);
      toast.error("حدث خطأ في تحميل بيانات الأبناء");
    } finally {
      setDataLoading(false);
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="لوحة ولي الأمر" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Banner */}
        <div className="gradient-card text-primary-foreground p-8 islamic-pattern">
          <h2 className="text-3xl font-bold mb-2">مرحباً، {user?.name}</h2>
          <p className="text-lg opacity-90">
            متابعة تقدم أبنائك في حلقات القرآن الكريم
          </p>
        </div>

        {/* Children List */}
        <div className="stats-card">
          <h3 className="text-2xl font-bold mb-6">الأبناء</h3>

          {children.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {children.map((child: any) => (
                <div key={child.id} className="stats-card border-2 border-border">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-xl">{child.student_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        الصف: {child.grade || "غير محدد"}
                      </p>
                    </div>
                    <div className="badge-gold">
                      {child.points_balance?.[0]?.total || 0} نقطة
                    </div>
                  </div>

                  {child.students_profiles?.[0]?.last_memorization && (
                    <div className="mb-4 p-3 bg-accent rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">آخر حفظ:</p>
                      <p className="font-semibold text-primary">
                        {child.students_profiles[0].last_memorization}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-success/10 rounded-lg">
                      <p className="text-2xl font-bold text-success">
                        {child.attendance?.filter((a: any) => a.status === "حاضر").length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">أيام الحضور</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <p className="text-2xl font-bold text-primary">
                        {child.points_balance?.[0]?.total || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">النقاط</p>
                    </div>
                    <div className="text-center p-3 bg-secondary/10 rounded-lg">
                      <p className="text-2xl font-bold text-secondary-dark">3</p>
                      <p className="text-xs text-muted-foreground">الترتيب</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">لا يوجد أبناء مسجلين</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ParentDashboard;
