import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Award, TrendingUp, TrendingDown, Trophy, UserX, FileText, BarChart3, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BonusPointsDialog from "./BonusPointsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StudentAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Student {
  id: string;
  student_name: string;
  grade?: string;
  mosque_name?: string;
}

interface RecordData {
  attendance: any[];
  recitations: any[];
  bonusPoints: any[];
  attendanceCount: number;
  recitationsCount: number;
  totalPoints: number;
}

interface StatisticsData {
  totalPoints: number;
  totalAbsences: number;
  topStudents: Array<{ id: string; student_name: string; total_points: number }>;
  mostAbsent: Array<{ id: string; student_name: string; absent_count: number }>;
}

interface Teacher {
  id: string;
  "اسم الاستاذ": string;
}

interface TeacherStats {
  id: string;
  student_name: string;
  total_points: number;
  absent_count: number;
}

const StudentAnalyticsDialog = ({ open, onOpenChange }: StudentAnalyticsDialogProps) => {
  // Tab 1: سجل طالب محدد
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recordData, setRecordData] = useState<RecordData>({
    attendance: [],
    recitations: [],
    bonusPoints: [],
    attendanceCount: 0,
    recitationsCount: 0,
    totalPoints: 0,
  });
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Tab 2: إحصائيات عامة
  const [statsStartDate, setStatsStartDate] = useState("");
  const [statsEndDate, setStatsEndDate] = useState("");
  const [statistics, setStatistics] = useState<StatisticsData>({
    totalPoints: 0,
    totalAbsences: 0,
    topStudents: [],
    mostAbsent: [],
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Tab 3: إحصائيات الأساتذة
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [teacherStartDate, setTeacherStartDate] = useState("");
  const [teacherEndDate, setTeacherEndDate] = useState("");
  const [teacherStats, setTeacherStats] = useState<{
    topStudents: TeacherStats[];
    mostAbsent: TeacherStats[];
  }>({ topStudents: [], mostAbsent: [] });
  const [loadingTeacherStats, setLoadingTeacherStats] = useState(false);

  // دوال الفترات الزمنية السريعة
  const setDateRange = (type: 'week' | 'month' | '3months' | 'all', target: 'stats' | 'teacher') => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate = '';

    switch (type) {
      case 'week':
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        startDate = lastWeek.toISOString().split('T')[0];
        break;
      case 'month':
        const lastMonth = new Date(today);
        lastMonth.setDate(today.getDate() - 30);
        startDate = lastMonth.toISOString().split('T')[0];
        break;
      case '3months':
        const last3Months = new Date(today);
        last3Months.setDate(today.getDate() - 90);
        startDate = last3Months.toISOString().split('T')[0];
        break;
      case 'all':
        startDate = '2020-01-01';
        break;
    }

    if (target === 'stats') {
      setStatsStartDate(startDate);
      setStatsEndDate(endDate);
    } else {
      setTeacherStartDate(startDate);
      setTeacherEndDate(endDate);
    }
  };

  // جلب معرف المستخدم الحالي
  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUserId(user.id || "");
    }
  }, []);

  // جلب قائمة الطلاب والأساتذة
  useEffect(() => {
    if (open) {
      fetchStudents();
      fetchTeachers();
    }
  }, [open]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, grade, mosque_name")
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في جلب قائمة الطلاب");
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select(`id, "اسم الاستاذ"`)
        .order('"اسم الاستاذ"');

      if (error) throw error;
      setTeachers((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في جلب قائمة الأساتذة");
    }
  };

  // تصفية الطلاب بناءً على البحث
  const filteredStudents = students.filter(student =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.mosque_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // جلب سجل الطالب
  useEffect(() => {
    if (selectedStudent && startDate && endDate) {
      fetchStudentRecord();
    }
  }, [selectedStudent, startDate, endDate]);

  const fetchStudentRecord = async () => {
    if (!selectedStudent) return;

    setLoadingRecord(true);
    try {
      // جلب الحضور
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudent.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (attendanceError) throw attendanceError;

      // جلب التسميع
      const { data: recitationsData, error: recitationsError } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", selectedStudent.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (recitationsError) throw recitationsError;

      // جلب النقاط الإضافية
      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("*")
        .eq("student_id", selectedStudent.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (bonusError) throw bonusError;

      // حساب الإحصائيات
      const attendanceCount = attendanceData?.filter(a => a.status === "حاضر").length || 0;
      const recitationsCount = recitationsData?.length || 0;
      
      const attendancePoints = attendanceData?.reduce((sum, a) => sum + (a.points || 0), 0) || 0;
      const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
      const bonusPointsTotal = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      
      const totalPoints = attendancePoints + recitationPoints + bonusPointsTotal;

      setRecordData({
        attendance: attendanceData || [],
        recitations: recitationsData || [],
        bonusPoints: bonusData || [],
        attendanceCount,
        recitationsCount,
        totalPoints,
      });
    } catch (error) {
      console.error("Error fetching student record:", error);
      toast.error("حدث خطأ في جلب سجل الطالب");
    } finally {
      setLoadingRecord(false);
    }
  };

  // جلب الإحصائيات العامة
  const fetchStatistics = async () => {
    if (!statsStartDate || !statsEndDate) {
      toast.error("الرجاء تحديد تاريخ البداية والنهاية");
      return;
    }

    setLoadingStats(true);
    try {
      // جلب جميع الطلاب
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, student_name");

      if (studentsError) throw studentsError;

      // جلب الحضور للفترة المحددة
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("student_id, status, points, date")
        .gte("date", statsStartDate)
        .lte("date", statsEndDate);

      if (attendanceError) throw attendanceError;

      // جلب التسميع للفترة المحددة
      const { data: recitationsData, error: recitationsError } = await supabase
        .from("recitations")
        .select("student_id, points_awarded, date")
        .gte("date", statsStartDate)
        .lte("date", statsEndDate);

      if (recitationsError) throw recitationsError;

      // جلب النقاط الإضافية للفترة المحددة
      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("student_id, points, date")
        .gte("date", statsStartDate)
        .lte("date", statsEndDate);

      if (bonusError) throw bonusError;

      // حساب النقاط والغيابات لكل طالب
      const studentStats = (studentsData || []).map(student => {
        const attendanceInRange = attendanceData?.filter(a => a.student_id === student.id) || [];
        const recitationsInRange = recitationsData?.filter(r => r.student_id === student.id) || [];
        const bonusInRange = bonusData?.filter(b => b.student_id === student.id) || [];

        const attendancePoints = attendanceInRange.reduce((sum, a) => sum + (a.points || 0), 0);
        const recitationPoints = recitationsInRange.reduce((sum, r) => sum + (r.points_awarded || 0), 0);
        const bonusPointsTotal = bonusInRange.reduce((sum, b) => sum + (b.points || 0), 0);

        const total_points = attendancePoints + recitationPoints + bonusPointsTotal;
        const absent_count = attendanceInRange.filter(a => a.status === "غائب").length;

        return {
          id: student.id,
          student_name: student.student_name,
          total_points,
          absent_count,
        };
      });

      // ترتيب وأخذ أفضل 10 طلاب
      const topStudents = [...studentStats]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 10);

      // ترتيب وأخذ أكثر 10 طلاب غياباً
      const mostAbsent = [...studentStats]
        .filter(s => s.absent_count > 0)
        .sort((a, b) => b.absent_count - a.absent_count)
        .slice(0, 10);

      const totalPoints = studentStats.reduce((sum, s) => sum + s.total_points, 0);
      const totalAbsences = studentStats.reduce((sum, s) => sum + s.absent_count, 0);

      setStatistics({
        totalPoints,
        totalAbsences,
        topStudents,
        mostAbsent,
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast.error("حدث خطأ في جلب الإحصائيات");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRefreshRecord = () => {
    if (selectedStudent) {
      fetchStudentRecord();
    }
  };

  // جلب إحصائيات الأستاذ
  const fetchTeacherStatistics = async () => {
    if (!selectedTeacher) {
      toast.error("الرجاء اختيار أستاذ");
      return;
    }
    if (!teacherStartDate || !teacherEndDate) {
      toast.error("الرجاء تحديد تاريخ البداية والنهاية");
      return;
    }

    setLoadingTeacherStats(true);
    try {
      // جلب طلاب الأستاذ
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, student_name")
        .eq("teacher_id", selectedTeacher);

      if (studentsError) throw studentsError;

      if (!studentsData || studentsData.length === 0) {
        toast.info("لا يوجد طلاب لهذا الأستاذ");
        setTeacherStats({ topStudents: [], mostAbsent: [] });
        setLoadingTeacherStats(false);
        return;
      }

      const studentIds = studentsData.map(s => s.id);

      // جلب الحضور للفترة المحددة
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("student_id, status, points")
        .in("student_id", studentIds)
        .gte("date", teacherStartDate)
        .lte("date", teacherEndDate);

      if (attendanceError) throw attendanceError;

      // جلب التسميع للفترة المحددة
      const { data: recitationsData, error: recitationsError } = await supabase
        .from("recitations")
        .select("student_id, points_awarded")
        .in("student_id", studentIds)
        .gte("date", teacherStartDate)
        .lte("date", teacherEndDate);

      if (recitationsError) throw recitationsError;

      // جلب النقاط الإضافية للفترة المحددة
      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("student_id, points")
        .in("student_id", studentIds)
        .gte("date", teacherStartDate)
        .lte("date", teacherEndDate);

      if (bonusError) throw bonusError;

      // جلب تفقد الأدوات للفترة المحددة
      const { data: checkData, error: checkError } = await supabase
        .from("check_records")
        .select("student_id, status, points")
        .in("student_id", studentIds)
        .gte("date", teacherStartDate)
        .lte("date", teacherEndDate);

      if (checkError) throw checkError;

      // حساب النقاط والغيابات لكل طالب
      const studentStatsMap = studentsData.map(student => {
        const attendanceInRange = attendanceData?.filter(a => a.student_id === student.id) || [];
        const recitationsInRange = recitationsData?.filter(r => r.student_id === student.id) || [];
        const bonusInRange = bonusData?.filter(b => b.student_id === student.id) || [];
        const checkInRange = checkData?.filter(c => c.student_id === student.id) || [];

        const attendancePoints = attendanceInRange.reduce((sum, a) => sum + (a.points || 0), 0);
        const recitationPoints = recitationsInRange.reduce((sum, r) => sum + (r.points_awarded || 0), 0);
        const bonusPointsTotal = bonusInRange.reduce((sum, b) => sum + (b.points || 0), 0);
        const checkPoints = checkInRange.reduce((sum, c) => {
          const delta = c.status === 'موجود' ? (c.points || 0) : c.status === 'غير موجود' ? -(c.points || 0) : 0;
          return sum + delta;
        }, 0);

        const total_points = attendancePoints + recitationPoints + bonusPointsTotal + checkPoints;
        const absent_count = attendanceInRange.filter(a => a.status === "غائب").length;

        return {
          id: student.id,
          student_name: student.student_name,
          total_points,
          absent_count,
        };
      });

      // ترتيب أفضل 3 طلاب
      const topStudents = [...studentStatsMap]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 3);

      // ترتيب أكثر 3 طلاب غياباً
      const mostAbsent = [...studentStatsMap]
        .filter(s => s.absent_count > 0)
        .sort((a, b) => b.absent_count - a.absent_count)
        .slice(0, 3);

      setTeacherStats({ topStudents, mostAbsent });
    } catch (error) {
      console.error("Error fetching teacher statistics:", error);
      toast.error("حدث خطأ في جلب إحصائيات الأستاذ");
    } finally {
      setLoadingTeacherStats(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <BarChart3 className="w-6 h-6 text-primary" />
              إحصائيات ومتابعة الطلاب
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="record" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="record" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                سجل طالب محدد
              </TabsTrigger>
              <TabsTrigger value="statistics" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                إحصائيات عامة
              </TabsTrigger>
              <TabsTrigger value="teacher-stats" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                إحصائيات الأساتذة
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: سجل طالب محدد */}
            <TabsContent value="record" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="w-5 h-5" />
                    البحث عن طالب
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="student-search">اسم الطالب أو الصف</Label>
                    <Input
                      id="student-search"
                      type="text"
                      placeholder="ابحث عن طالب..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {searchTerm && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">لا توجد نتائج</p>
                      ) : (
                        <div className="divide-y">
                          {filteredStudents.slice(0, 10).map(student => (
                            <div
                              key={student.id}
                              onClick={() => {
                                setSelectedStudent(student);
                                setSearchTerm("");
                              }}
                              className="p-3 hover:bg-muted cursor-pointer transition-colors"
                            >
                              <p className="font-semibold">{student.student_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {student.grade && `الصف: ${student.grade}`}
                                {student.mosque_name && ` • ${student.mosque_name}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedStudent && (
                    <Card className="bg-primary/5 border-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-lg">{selectedStudent.student_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.grade && `الصف: ${selectedStudent.grade}`}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStudent(null)}
                          >
                            تغيير
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date">تاريخ البداية</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">تاريخ النهاية</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedStudent && startDate && endDate && (
                <>
                  {loadingRecord ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* ملخص السجل */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">عدد مرات الحضور</p>
                                <p className="text-2xl font-bold text-green-600">{recordData.attendanceCount}</p>
                              </div>
                              <Award className="w-8 h-8 text-green-600" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">عدد التسميعات</p>
                                <p className="text-2xl font-bold text-blue-600">{recordData.recitationsCount}</p>
                              </div>
                              <FileText className="w-8 h-8 text-blue-600" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">مجموع النقاط</p>
                                <p className="text-2xl font-bold text-primary">{recordData.totalPoints}</p>
                              </div>
                              <Trophy className="w-8 h-8 text-primary" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* النقاط الإضافية */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">النقاط الإضافية</CardTitle>
                            <Button
                              size="sm"
                              onClick={() => setShowBonusDialog(true)}
                            >
                              إضافة نقاط
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {recordData.bonusPoints.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">لا توجد نقاط إضافية</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>التاريخ</TableHead>
                                  <TableHead>النقاط</TableHead>
                                  <TableHead>السبب</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recordData.bonusPoints.map((bonus) => (
                                  <TableRow key={bonus.id}>
                                    <TableCell>{new Date(bonus.date).toLocaleDateString('ar-SA')}</TableCell>
                                    <TableCell>
                                      <Badge variant={bonus.points > 0 ? "default" : "destructive"}>
                                        {bonus.points > 0 ? '+' : ''}{bonus.points}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{bonus.reason}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>

                      {/* سجل التسميع */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">سجل التسميع</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {recordData.recitations.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">لا يوجد تسميع</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>التاريخ</TableHead>
                                  <TableHead>آخر حفظ</TableHead>
                                  <TableHead>التقييم</TableHead>
                                  <TableHead>النقاط</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recordData.recitations.map((recitation) => (
                                  <TableRow key={recitation.id}>
                                    <TableCell>{new Date(recitation.date).toLocaleDateString('ar-SA')}</TableCell>
                                    <TableCell>{recitation.last_saved}</TableCell>
                                    <TableCell>
                                      <Badge>{recitation.rating}</Badge>
                                    </TableCell>
                                    <TableCell>{recitation.points_awarded}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>

                      {/* سجل الحضور */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">سجل الحضور والغياب</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {recordData.attendance.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">لا يوجد سجل حضور</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>التاريخ</TableHead>
                                  <TableHead>الحالة</TableHead>
                                  <TableHead>النقاط</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recordData.attendance.map((att) => (
                                  <TableRow key={att.id}>
                                    <TableCell>{new Date(att.date).toLocaleDateString('ar-SA')}</TableCell>
                                    <TableCell>
                                      <Badge variant={att.status === "حاضر" ? "default" : "destructive"}>
                                        {att.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{att.points || 0}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab 2: إحصائيات عامة */}
            <TabsContent value="statistics" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5" />
                    اختر الفترة الزمنية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="stats-start-date">تاريخ البداية</Label>
                      <Input
                        id="stats-start-date"
                        type="date"
                        value={statsStartDate}
                        onChange={(e) => setStatsStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="stats-end-date">تاريخ النهاية</Label>
                      <Input
                        id="stats-end-date"
                        type="date"
                        value={statsEndDate}
                        onChange={(e) => setStatsEndDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  {/* أزرار الفترات الزمنية */}
                  <div className="space-y-2">
                    <Label>فترات زمنية سريعة</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('week', 'stats')}
                        className="w-full"
                      >
                        آخر أسبوع
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('month', 'stats')}
                        className="w-full"
                      >
                        آخر شهر
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('3months', 'stats')}
                        className="w-full"
                      >
                        آخر 3 أشهر
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('all', 'stats')}
                        className="w-full"
                      >
                        جميع البيانات
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={fetchStatistics}
                    disabled={loadingStats || !statsStartDate || !statsEndDate}
                    className="w-full"
                  >
                    {loadingStats ? "جاري التحميل..." : "عرض الإحصائيات"}
                  </Button>
                </CardContent>
              </Card>

              {loadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                </div>
              ) : statistics.topStudents.length > 0 || statistics.mostAbsent.length > 0 ? (
                <>
                  {/* ملخص الإحصائيات */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي النقاط</p>
                            <p className="text-3xl font-bold text-primary">{statistics.totalPoints}</p>
                          </div>
                          <TrendingUp className="w-10 h-10 text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي الغيابات</p>
                            <p className="text-3xl font-bold text-destructive">{statistics.totalAbsences}</p>
                          </div>
                          <TrendingDown className="w-10 h-10 text-destructive" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* أفضل 10 طلاب */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          أفضل 10 طلاب
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {statistics.topStudents.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
                        ) : (
                          <div className="space-y-2">
                            {statistics.topStudents.map((student, index) => (
                              <div
                                key={student.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                    index === 0 ? "bg-yellow-500 text-white" :
                                    index === 1 ? "bg-gray-400 text-white" :
                                    index === 2 ? "bg-amber-600 text-white" :
                                    "bg-muted text-foreground"
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <span className="font-medium">{student.student_name}</span>
                                </div>
                                <Badge className="bg-primary">
                                  {student.total_points} نقطة
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* أكثر 10 طلاب غياباً */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <UserX className="w-5 h-5 text-destructive" />
                          أكثر 10 طلاب غياباً
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {statistics.mostAbsent.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">لا توجد غيابات</p>
                        ) : (
                          <div className="space-y-2">
                            {statistics.mostAbsent.map((student, index) => (
                              <div
                                key={student.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold">
                                    {index + 1}
                                  </div>
                                  <span className="font-medium">{student.student_name}</span>
                                </div>
                                <Badge variant="destructive">
                                  {student.absent_count} غياب
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </TabsContent>

            {/* Tab 3: إحصائيات الأساتذة */}
            <TabsContent value="teacher-stats" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="w-5 h-5" />
                    اختر الأستاذ والفترة الزمنية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="teacher-select">اختر الأستاذ</Label>
                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                      <SelectTrigger id="teacher-select" className="mt-1">
                        <SelectValue placeholder="اختر أستاذ..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher["اسم الاستاذ"]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="teacher-start-date">تاريخ البداية</Label>
                      <Input
                        id="teacher-start-date"
                        type="date"
                        value={teacherStartDate}
                        onChange={(e) => setTeacherStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="teacher-end-date">تاريخ النهاية</Label>
                      <Input
                        id="teacher-end-date"
                        type="date"
                        value={teacherEndDate}
                        onChange={(e) => setTeacherEndDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* أزرار الفترات الزمنية */}
                  <div className="space-y-2">
                    <Label>فترات زمنية سريعة</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('week', 'teacher')}
                        className="w-full"
                      >
                        آخر أسبوع
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('month', 'teacher')}
                        className="w-full"
                      >
                        آخر شهر
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('3months', 'teacher')}
                        className="w-full"
                      >
                        آخر 3 أشهر
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange('all', 'teacher')}
                        className="w-full"
                      >
                        جميع البيانات
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={fetchTeacherStatistics}
                    disabled={!selectedTeacher || !teacherStartDate || !teacherEndDate || loadingTeacherStats}
                    className="w-full"
                  >
                    {loadingTeacherStats ? "جاري التحميل..." : "عرض الإحصائيات"}
                  </Button>
                </CardContent>
              </Card>

              {loadingTeacherStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                </div>
              ) : (teacherStats.topStudents.length > 0 || teacherStats.mostAbsent.length > 0) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* أفضل 3 طلاب */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        أفضل 3 طلاب
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {teacherStats.topStudents.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
                      ) : (
                        <div className="space-y-3">
                          {teacherStats.topStudents.map((student, index) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                  index === 0 ? 'bg-amber-500' :
                                  index === 1 ? 'bg-gray-400' :
                                  'bg-amber-700'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-semibold">{student.student_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {student.total_points} نقطة
                                  </p>
                                </div>
                              </div>
                              <Trophy className={`w-6 h-6 ${
                                index === 0 ? 'text-amber-500' :
                                index === 1 ? 'text-gray-400' :
                                'text-amber-700'
                              }`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* أكثر 3 طلاب غياباً */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <UserX className="w-5 h-5 text-red-500" />
                        أكثر 3 طلاب غياباً
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {teacherStats.mostAbsent.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">لا توجد غيابات</p>
                      ) : (
                        <div className="space-y-3">
                          {teacherStats.mostAbsent.map((student, index) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center font-bold text-red-600 dark:text-red-400">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-semibold">{student.student_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {student.absent_count} غياب
                                  </p>
                                </div>
                              </div>
                              <Badge variant="destructive">
                                {student.absent_count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog للنقاط الإضافية */}
      {selectedStudent && currentUserId && (
        <BonusPointsDialog
          open={showBonusDialog}
          onOpenChange={setShowBonusDialog}
          student={{
            id: selectedStudent.id,
            student_name: selectedStudent.student_name,
          }}
          teacherId={currentUserId}
          selectedDate={endDate || new Date().toISOString().split("T")[0]}
          onSuccess={handleRefreshRecord}
        />
      )}
    </>
  );
};

export default StudentAnalyticsDialog;
