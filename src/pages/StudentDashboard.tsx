import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/StatsCard";
import { Award, TrendingUp, CheckCircle, BookOpen, Star, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useRequireAuth } from "@/hooks/useRequireAuth";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();
  const [points, setPoints] = useState<any>(null);
  const [recentRecitations, setRecentRecitations] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchStudentData(user.id);
    }

    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchStudentData = async (studentId: string) => {
    try {
      // Get student details
      const { data: studentData } = await supabase
        .from("students")
        .select("*, students_profiles(*)")
        .eq("id", studentId)
        .single();

      // Get points balance
      const { data: pointsData } = await supabase
        .from("points_balance")
        .select("*")
        .eq("student_id", studentId)
        .single();

      setPoints(pointsData);

      // Get recent recitations
      const { data: recitationsData } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .limit(5);

      setRecentRecitations(recitationsData || []);
    } catch (error) {
      console.error("Error fetching student data:", error);
      toast.error("حدث خطأ في تحميل البيانات");
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

  const totalPoints = points?.total || 0;
  const attendancePoints = points?.attendance_points || 0;
  const recitationPoints = points?.recitation_points || 0;

  return (
    <DashboardLayout title="لوحة الطالب" userName={user?.name}>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Banner with Points */}
        <div className="gold-card text-secondary-foreground p-8 islamic-pattern relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">مرحباً، {user?.name}</h2>
            <p className="text-lg opacity-90 mb-6">
              استمر في التقدم والتميز في حفظ القرآن الكريم
            </p>

            {/* Big Points Display */}
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 flex items-center gap-4">
                <Trophy className="w-12 h-12" />
                <div>
                  <p className="text-sm opacity-90">مجموع النقاط</p>
                  <p className="text-5xl font-bold">{totalPoints}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative stars */}
          <div className="absolute top-4 left-4 opacity-20">
            <Star className="w-16 h-16" />
          </div>
          <div className="absolute bottom-4 right-4 opacity-20">
            <Star className="w-12 h-12" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="نقاط الحضور"
            value={attendancePoints}
            icon={CheckCircle}
            variant="primary"
          />
          <StatsCard
            title="نقاط التسميع"
            value={recitationPoints}
            icon={BookOpen}
          />
          <StatsCard
            title="الترتيب"
            value="3"
            icon={TrendingUp}
            variant="gold"
          />
        </div>

        {/* Achievements Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Recitations */}
          <div className="stats-card">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              آخر التسميعات
            </h3>
            <div className="space-y-3">
              {recentRecitations.length > 0 ? (
                recentRecitations.map((recitation) => (
                  <div
                    key={recitation.id}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-semibold">{recitation.last_saved}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(recitation.date).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    <div className={`badge-${recitation.rating === "ممتاز" ? "success" :
                      recitation.rating === "جيد" ? "warning" : "default"
                      }`}>
                      {recitation.rating}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-6">
                  لا توجد تسميعات بعد
                </p>
              )}
            </div>
          </div>

          {/* Achievements */}
          <div className="stats-card">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-secondary" />
              الإنجازات
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Trophy, label: "100 نقطة", unlocked: totalPoints >= 100 },
                { icon: Star, label: "حفظ 5 أجزاء", unlocked: false },
                { icon: CheckCircle, label: "حضور متواصل", unlocked: attendancePoints >= 20 },
              ].map((achievement, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border-2 ${achievement.unlocked
                    ? "border-secondary bg-secondary/10"
                    : "border-border bg-muted/50 opacity-50"
                    } text-center transition-all duration-300`}
                >
                  <achievement.icon
                    className={`w-8 h-8 mx-auto mb-2 ${achievement.unlocked ? "text-secondary" : "text-muted-foreground"
                      }`}
                  />
                  <p className="text-xs font-semibold">{achievement.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="stats-card">
          <h3 className="text-xl font-bold mb-4">تقدم الحفظ</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">التقدم العام</span>
                <span className="text-sm text-muted-foreground">15 من 30 جزء</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className="bg-gradient-primary h-3 rounded-full" style={{ width: "50%" }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
