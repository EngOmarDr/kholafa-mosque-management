import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

interface Student {
  id: string;
  student_name: string;
  current_teacher: string;
}

interface StudentStats {
  id: string;
  name: string;
  totalPoints: number;
  attendancePoints: number;
  recitationPoints: number;
  bonusPoints: number;
  attendanceRate: number;
  recitationCount: number;
  absenceCount: number;
}

export default function StudentsCompare() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [student1Id, setStudent1Id] = useState<string>("");
  const [student2Id, setStudent2Id] = useState<string>("");
  const [student1Stats, setStudent1Stats] = useState<StudentStats | null>(null);
  const [student2Stats, setStudent2Stats] = useState<StudentStats | null>(null);
  const [radarData, setRadarData] = useState<any[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (student1Id && student2Id) {
      compareStudents();
    }
  }, [student1Id, student2Id]);

  const fetchStudents = async () => {
    const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", (await supabase.auth.getUser()).data.user?.id).single();

    let query = supabase.from("students").select("id, student_name, current_teacher").order("student_name");

    if (profile?.role === "teacher") {
      const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", profile.id).single();
      if (teacher) {
        query = query.eq("teacher_id", teacher.id);
      }
    }

    const { data } = await query;
    if (data) setStudents(data);
  };

  const fetchStudentStats = async (studentId: string): Promise<StudentStats | null> => {
    try {
      const { data: student } = await supabase
        .from("students")
        .select("student_name")
        .eq("id", studentId)
        .single();

      const { data: points } = await supabase
        .from("points_balance")
        .select("*")
        .eq("student_id", studentId)
        .single();

      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", studentId);

      const { data: recitations } = await supabase
        .from("recitations")
        .select("points_awarded")
        .eq("student_id", studentId);

      const totalAttendance = attendance?.length || 0;
      const presentCount = attendance?.filter(a => a.status === "حاضر").length || 0;
      const absentCount = attendance?.filter(a => a.status === "غائب").length || 0;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

      return {
        id: studentId,
        name: student?.student_name || "",
        totalPoints: points?.total || 0,
        attendancePoints: points?.attendance_points || 0,
        recitationPoints: points?.recitation_points || 0,
        bonusPoints: points?.bonus_points || 0,
        attendanceRate,
        recitationCount: recitations?.length || 0,
        absenceCount: absentCount
      };
    } catch (error) {
      console.error("Error fetching student stats:", error);
      return null;
    }
  };

  const compareStudents = async () => {
    if (!student1Id || !student2Id) return;

    if (student1Id === student2Id) {
      toast.error("يرجى اختيار طالبين مختلفين");
      return;
    }

    setLoading(true);
    try {
      const [stats1, stats2] = await Promise.all([
        fetchStudentStats(student1Id),
        fetchStudentStats(student2Id)
      ]);

      setStudent1Stats(stats1);
      setStudent2Stats(stats2);

      if (stats1 && stats2) {
        const maxPoints = Math.max(stats1.totalPoints, stats2.totalPoints);
        const maxAttendance = Math.max(stats1.attendanceRate, stats2.attendanceRate);
        const maxRecitations = Math.max(stats1.recitationCount, stats2.recitationCount);

        setRadarData([
          {
            metric: "النقاط الكلية",
            [stats1.name]: maxPoints > 0 ? (stats1.totalPoints / maxPoints) * 100 : 0,
            [stats2.name]: maxPoints > 0 ? (stats2.totalPoints / maxPoints) * 100 : 0,
          },
          {
            metric: "نسبة الحضور",
            [stats1.name]: stats1.attendanceRate,
            [stats2.name]: stats2.attendanceRate,
          },
          {
            metric: "عدد التسميع",
            [stats1.name]: maxRecitations > 0 ? (stats1.recitationCount / maxRecitations) * 100 : 0,
            [stats2.name]: maxRecitations > 0 ? (stats2.recitationCount / maxRecitations) * 100 : 0,
          },
          {
            metric: "نقاط الحضور",
            [stats1.name]: stats1.attendancePoints,
            [stats2.name]: stats2.attendancePoints,
          },
          {
            metric: "نقاط التسميع",
            [stats1.name]: stats1.recitationPoints,
            [stats2.name]: stats2.recitationPoints,
          },
        ]);
      }
    } catch (error) {
      console.error("Error comparing students:", error);
      toast.error("حدث خطأ في المقارنة");
    } finally {
      setLoading(false);
    }
  };

  const getDifference = (val1: number, val2: number) => {
    const diff = val1 - val2;
    if (diff > 0) {
      return <Badge variant="default" className="bg-green-500"><TrendingUp className="w-3 h-3 ml-1" />{diff}</Badge>;
    } else if (diff < 0) {
      return <Badge variant="destructive"><TrendingDown className="w-3 h-3 ml-1" />{Math.abs(diff)}</Badge>;
    } else {
      return <Badge variant="secondary"><Minus className="w-3 h-3 ml-1" />متساوي</Badge>;
    }
  };

  return (
    <DashboardLayout title="مقارنة الطلاب">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="ml-2 h-4 w-4" />
            رجوع
          </Button>
          <div>
            <h1 className="text-3xl font-bold">مقارنة الطلاب</h1>
            <p className="text-muted-foreground mt-1">قارن أداء طالبين جنباً إلى جنب</p>
          </div>
        </div>

        {/* Student Selection */}
        <Card>
          <CardHeader>
            <CardTitle>اختر الطلاب للمقارنة</CardTitle>
            <CardDescription>حدد طالبين لعرض مقارنة تفصيلية بين أدائهما</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">الطالب الأول</label>
                <Select value={student1Id} onValueChange={setStudent1Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطالب الأول" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.student_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">الطالب الثاني</label>
                <Select value={student2Id} onValueChange={setStudent2Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطالب الثاني" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.student_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {student1Stats && student2Stats && (
          <>
            {/* Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>مقارنة بصرية</CardTitle>
                <CardDescription>رسم بياني يوضح الفروقات في الأداء</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" stroke="hsl(var(--foreground))" />
                    <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" />
                    <Radar
                      name={student1Stats.name}
                      dataKey={student1Stats.name}
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.6}
                    />
                    <Radar
                      name={student2Stats.name}
                      dataKey={student2Stats.name}
                      stroke="hsl(var(--secondary))"
                      fill="hsl(var(--secondary))"
                      fillOpacity={0.6}
                    />
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detailed Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>مقارنة تفصيلية</CardTitle>
                <CardDescription>جدول يوضح جميع المقاييس والفروقات</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المقياس</TableHead>
                      <TableHead className="text-center">{student1Stats.name}</TableHead>
                      <TableHead className="text-center">الفرق</TableHead>
                      <TableHead className="text-center">{student2Stats.name}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">إجمالي النقاط</TableCell>
                      <TableCell className="text-center font-bold text-primary">{student1Stats.totalPoints}</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.totalPoints, student2Stats.totalPoints)}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{student2Stats.totalPoints}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">نقاط الحضور</TableCell>
                      <TableCell className="text-center">{student1Stats.attendancePoints}</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.attendancePoints, student2Stats.attendancePoints)}</TableCell>
                      <TableCell className="text-center">{student2Stats.attendancePoints}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">نقاط التسميع</TableCell>
                      <TableCell className="text-center">{student1Stats.recitationPoints}</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.recitationPoints, student2Stats.recitationPoints)}</TableCell>
                      <TableCell className="text-center">{student2Stats.recitationPoints}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">النقاط الإضافية</TableCell>
                      <TableCell className="text-center">{student1Stats.bonusPoints}</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.bonusPoints, student2Stats.bonusPoints)}</TableCell>
                      <TableCell className="text-center">{student2Stats.bonusPoints}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">نسبة الحضور</TableCell>
                      <TableCell className="text-center">{student1Stats.attendanceRate}%</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.attendanceRate, student2Stats.attendanceRate)}</TableCell>
                      <TableCell className="text-center">{student2Stats.attendanceRate}%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">عدد التسميعات</TableCell>
                      <TableCell className="text-center">{student1Stats.recitationCount}</TableCell>
                      <TableCell className="text-center">{getDifference(student1Stats.recitationCount, student2Stats.recitationCount)}</TableCell>
                      <TableCell className="text-center">{student2Stats.recitationCount}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">عدد الغيابات</TableCell>
                      <TableCell className="text-center">{student1Stats.absenceCount}</TableCell>
                      <TableCell className="text-center">{getDifference(student2Stats.absenceCount, student1Stats.absenceCount)}</TableCell>
                      <TableCell className="text-center">{student2Stats.absenceCount}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {!student1Stats && !student2Stats && (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                اختر طالبين لعرض المقارنة التفصيلية
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
