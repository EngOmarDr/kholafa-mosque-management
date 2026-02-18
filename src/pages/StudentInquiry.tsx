import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format, subDays, subMonths, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  User, 
  BookOpen, 
  UserCheck, 
  Home, 
  Trophy, 
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface StudentData {
  student: {
    id: string;
    student_name: string;
    grade: string | null;
    current_teacher: string | null;
    mosque_name: string | null;
    photo_url: string | null;
  };
  points_balance: {
    total: number;
    attendance_points: number;
    recitation_points: number;
    bonus_points: number;
  };
  attendance: Array<{
    id: string;
    date: string;
    status: string;
    recitation_quality: string | null;
    points: number;
  }>;
  recitations: Array<{
    id: string;
    date: string;
    rating: string;
    last_saved: string;
    notes: string | null;
    points_awarded: number;
  }>;
  check_records: Array<{
    id: string;
    date: string;
    status: string;
    points: number;
    check_items: { name: string } | null;
  }>;
  bonus_points: Array<{
    id: string;
    date: string;
    reason: string;
    points: number;
  }>;
}

const StudentInquiry = () => {
  const location = useLocation();
  const [studentId, setStudentId] = useState<string>("");
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get("id");
    if (id) {
      setStudentId(id);
      fetchStudentData(id);
    } else {
      setError("معرف الطالب غير موجود في الرابط");
      setLoading(false);
    }
  }, [location.search]);

  const fetchStudentData = async (id: string, start?: Date, end?: Date) => {
    try {
      setLoading(true);
      setError(null);

      let url = `https://wibxqnhddfsgepvlijer.supabase.co/functions/v1/student-inquiry?id=${id}`;
      
      if (start) {
        url += `&start_date=${format(start, "yyyy-MM-dd")}`;
      }
      if (end) {
        url += `&end_date=${format(end, "yyyy-MM-dd")}`;
      }

      const response = await fetch(url, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYnhxbmhkZGZzZ2VwdmxpamVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjU5ODksImV4cCI6MjA3NTgwMTk4OX0.hd7jewsRlTloHxnMcRn1crjycvF6T6prgRAXs704tQc',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "فشل في جلب البيانات");
      }

      const data = await response.json();
      setStudentData(data);
    } catch (err) {
      console.error("Error fetching student data:", err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء جلب البيانات");
      toast.error("فشل في تحميل بيانات الطالب");
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilter = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
    if (studentId) {
      fetchStudentData(studentId, start, end);
    }
  };

  const handleQuickFilter = (type: "week" | "month" | "3months" | "all") => {
    const today = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (type) {
      case "week":
        start = subDays(today, 7);
        end = today;
        break;
      case "month":
        start = subMonths(today, 1);
        end = today;
        break;
      case "3months":
        start = subMonths(today, 3);
        end = today;
        break;
      case "all":
        start = undefined;
        end = undefined;
        break;
    }

    handleDateFilter(start, end);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "حاضر":
        return <Badge className="bg-success text-success-foreground">حاضر</Badge>;
      case "غائب":
        return <Badge variant="destructive">غائب</Badge>;
      case "اعتذر":
        return <Badge variant="secondary">اعتذر</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getToolStatusBadge = (status: string) => {
    switch (status) {
      case "موجود":
        return <Badge className="bg-success text-success-foreground">موجود</Badge>;
      case "مفقود":
        return <Badge variant="destructive">مفقود</Badge>;
      case "تم_تخطيه":
        return <Badge variant="secondary">تم التخطي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateAttendanceStats = () => {
    if (!studentData) return { present: 0, absent: 0, excused: 0, total: 0, percentage: 0 };
    
    const present = studentData.attendance.filter(a => a.status === "حاضر").length;
    const absent = studentData.attendance.filter(a => a.status === "غائب").length;
    const excused = studentData.attendance.filter(a => a.status === "اعتذر").length;
    const total = studentData.attendance.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, excused, total, percentage };
  };

  // Prepare chart data for points over time
  const pointsChartData = useMemo(() => {
    if (!studentData) return [];
    
    const dataMap = new Map<string, { date: string; attendance: number; recitation: number; bonus: number; total: number }>();
    
    // Add attendance points
    studentData.attendance.forEach(record => {
      const date = format(parseISO(record.date), "dd/MM");
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, attendance: 0, recitation: 0, bonus: 0, total: 0 });
      }
      const entry = dataMap.get(date)!;
      entry.attendance += record.points;
    });
    
    // Add recitation points
    studentData.recitations.forEach(record => {
      const date = format(parseISO(record.date), "dd/MM");
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, attendance: 0, recitation: 0, bonus: 0, total: 0 });
      }
      const entry = dataMap.get(date)!;
      entry.recitation += record.points_awarded;
    });
    
    // Add bonus points
    studentData.bonus_points.forEach(record => {
      const date = format(parseISO(record.date), "dd/MM");
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, attendance: 0, recitation: 0, bonus: 0, total: 0 });
      }
      const entry = dataMap.get(date)!;
      entry.bonus += record.points;
    });
    
    // Calculate totals and sort by date
    const result = Array.from(dataMap.values())
      .map(entry => ({
        ...entry,
        total: entry.attendance + entry.recitation + entry.bonus
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        return monthA !== monthB ? monthA - monthB : dayA - dayB;
      });
    
    return result;
  }, [studentData]);

  // Prepare chart data for attendance over time
  const attendanceChartData = useMemo(() => {
    if (!studentData) return [];
    
    const dataMap = new Map<string, { date: string; present: number; absent: number; excused: number }>();
    
    studentData.attendance.forEach(record => {
      const date = format(parseISO(record.date), "dd/MM");
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, present: 0, absent: 0, excused: 0 });
      }
      const entry = dataMap.get(date)!;
      
      if (record.status === "حاضر") entry.present += 1;
      else if (record.status === "غائب") entry.absent += 1;
      else if (record.status === "اعتذر") entry.excused += 1;
    });
    
    const result = Array.from(dataMap.values())
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        return monthA !== monthB ? monthA - monthB : dayA - dayB;
      });
    
    return result;
  }, [studentData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full border-primary/20">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-foreground">جاري تحميل البيانات</h2>
                <p className="text-muted-foreground">يرجى الانتظار، نقوم بجلب معلومات الطالب...</p>
              </div>
              <div className="w-full space-y-2">
                <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse w-3/4"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              خطأ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error || "حدث خطأ غير متوقع"}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const attendanceStats = calculateAttendanceStats();

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Student Header with Photo and Name */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <Avatar className="h-40 w-40 border-4 border-primary/20 shadow-xl">
                <AvatarImage 
                  src={studentData.student.photo_url || undefined} 
                  alt={studentData.student.student_name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                  <User className="h-20 w-20" />
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-4 w-full max-w-md">
                <h1 className="text-4xl font-bold text-foreground">
                  {studentData.student.student_name}
                </h1>
                
                <div className="space-y-3">
                  {studentData.student.grade && (
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground">الصف:</span>
                      <span className="font-semibold">{studentData.student.grade}</span>
                    </div>
                  )}
                  {studentData.student.current_teacher && (
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <UserCheck className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground">المعلم:</span>
                      <span className="font-semibold">{studentData.student.current_teacher}</span>
                    </div>
                  )}
                  {studentData.student.mosque_name && (
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground">المسجد:</span>
                      <span className="font-semibold">{studentData.student.mosque_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              فلترة حسب التاريخ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {startDate ? format(startDate, "PPP", { locale: ar }) : "من تاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => handleDateFilter(date, endDate)}
                    locale={ar}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {endDate ? format(endDate, "PPP", { locale: ar }) : "إلى تاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => handleDateFilter(startDate, date)}
                    locale={ar}
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  onClick={() => handleQuickFilter("all")}
                >
                  إزالة الفلترة
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickFilter("week")}
              >
                آخر أسبوع
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickFilter("month")}
              >
                آخر شهر
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickFilter("3months")}
              >
                آخر 3 أشهر
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickFilter("all")}
              >
                كل الوقت
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Student Info Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                معلومات الطالب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">الاسم</p>
                <p className="font-medium">{studentData.student.student_name}</p>
              </div>
              {studentData.student.grade && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    الصف
                  </p>
                  <p className="font-medium">{studentData.student.grade}</p>
                </div>
              )}
              {studentData.student.current_teacher && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    الأستاذ
                  </p>
                  <p className="font-medium">{studentData.student.current_teacher}</p>
                </div>
              )}
              {studentData.student.mosque_name && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Home className="w-4 h-4" />
                    المسجد
                  </p>
                  <p className="font-medium">{studentData.student.mosque_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Points Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                إجمالي النقاط
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{studentData.points_balance.total}</p>
                <p className="text-sm text-muted-foreground">نقطة</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نقاط الحضور:</span>
                  <span className="font-medium">{studentData.points_balance.attendance_points}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نقاط التسميع:</span>
                  <span className="font-medium">{studentData.points_balance.recitation_points}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نقاط إضافية:</span>
                  <span className="font-medium">{studentData.points_balance.bonus_points}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                إحصائيات الحضور
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-success">{attendanceStats.percentage}%</p>
                <p className="text-sm text-muted-foreground">نسبة الحضور</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    حاضر
                  </span>
                  <span className="font-medium">{attendanceStats.present}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                    غائب
                  </span>
                  <span className="font-medium">{attendanceStats.absent}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-secondary" />
                    اعتذر
                  </span>
                  <span className="font-medium">{attendanceStats.excused}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Points Over Time Chart */}
          {pointsChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  تطور النقاط عبر الوقت
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={pointsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        direction: 'rtl'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ direction: 'rtl' }}
                      formatter={(value) => {
                        const labels: Record<string, string> = {
                          attendance: 'نقاط الحضور',
                          recitation: 'نقاط التسميع',
                          bonus: 'نقاط إضافية',
                          total: 'الإجمالي'
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="hsl(199 89% 48%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(199 89% 48%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="recitation" 
                      stroke="hsl(142 76% 36%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(142 76% 36%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bonus" 
                      stroke="hsl(45 75% 55%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(45 75% 55%)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Attendance Over Time Chart */}
          {attendanceChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  الحضور عبر الوقت
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        direction: 'rtl'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ direction: 'rtl' }}
                      formatter={(value) => {
                        const labels: Record<string, string> = {
                          present: 'حاضر',
                          absent: 'غائب',
                          excused: 'اعتذر'
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Bar dataKey="present" fill="hsl(142 76% 36%)" />
                    <Bar dataKey="absent" fill="hsl(0 84% 60%)" />
                    <Bar dataKey="excused" fill="hsl(38 92% 50%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recitations Table */}
        {studentData.recitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                سجل التسميع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">التقييم</TableHead>
                      <TableHead className="text-right">الصفحة المحفوظة</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                      <TableHead className="text-right">الملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentData.recitations.map((recitation) => (
                      <TableRow key={recitation.id}>
                        <TableCell>
                          {format(new Date(recitation.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{recitation.rating}</Badge>
                        </TableCell>
                        <TableCell>{recitation.last_saved}</TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary">
                            {recitation.points_awarded}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {recitation.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check Records (Tools) Table */}
        {studentData.check_records.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                سجل تفقد الأدوات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الأداة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentData.check_records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(new Date(record.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {record.check_items?.name || "غير محدد"}
                        </TableCell>
                        <TableCell>{getToolStatusBadge(record.status)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={record.points >= 0 ? "default" : "destructive"}
                          >
                            {record.points}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bonus Points Table */}
        {studentData.bonus_points.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                النقاط الإضافية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">السبب</TableHead>
                      <TableHead className="text-right">النقاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentData.bonus_points.map((bonus) => (
                      <TableRow key={bonus.id}>
                        <TableCell>
                          {format(new Date(bonus.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>{bonus.reason}</TableCell>
                        <TableCell>
                          <Badge className="bg-success text-success-foreground">
                            +{bonus.points}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {studentData.recitations.length === 0 && 
          studentData.check_records.length === 0 && 
          studentData.bonus_points.length === 0 && (
           <Card>
             <CardContent className="py-12 text-center">
               <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
               <p className="text-muted-foreground">
                 لا توجد سجلات في الفترة المحددة
               </p>
             </CardContent>
           </Card>
         )}
       </div>
     </div>
   );
 };

 export default StudentInquiry;
