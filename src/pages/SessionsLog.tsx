import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, Users, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SessionRecord {
  id: string;
  session_date: string;
  students_attended: number;
  student_names: string[];
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean;
}

interface SessionStats {
  total_sessions: number;
  avg_sessions_per_week: number;
  active_sessions: number;
  cancelled_sessions: number;
  total_attendance: number;
  avg_attendance_per_session: number;
}

interface DatePreset {
  label: string;
  getValue: () => { from: Date; to: Date };
}

const SessionsLog = () => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    total_sessions: 0,
    avg_sessions_per_week: 0,
    active_sessions: 0,
    cancelled_sessions: 0,
    total_attendance: 0,
    avg_attendance_per_session: 0,
  });
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    format(subMonths(new Date(), 1), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const datePresets: DatePreset[] = [
    {
      label: "آخر أسبوع",
      getValue: () => ({
        from: subDays(new Date(), 7),
        to: new Date(),
      }),
    },
    {
      label: "آخر أسبوعين",
      getValue: () => ({
        from: subDays(new Date(), 14),
        to: new Date(),
      }),
    },
    {
      label: "آخر شهر",
      getValue: () => ({
        from: subMonths(new Date(), 1),
        to: new Date(),
      }),
    },
    {
      label: "آخر 3 أشهر",
      getValue: () => ({
        from: subMonths(new Date(), 3),
        to: new Date(),
      }),
    },
    {
      label: "آخر 6 أشهر",
      getValue: () => ({
        from: subMonths(new Date(), 6),
        to: new Date(),
      }),
    },
  ];

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacherId) {
      fetchSessions();
    }
  }, [selectedTeacherId, startDate, endDate]);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select(`id, "اسم الاستاذ"`)
        .order("اسم الاستاذ");

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("حدث خطأ في تحميل قائمة الأساتذة");
    }
  };

  const fetchSessions = async () => {
    if (!selectedTeacherId) {
      setSessions([]);
      setStats({
        total_sessions: 0,
        avg_sessions_per_week: 0,
        active_sessions: 0,
        cancelled_sessions: 0,
        total_attendance: 0,
        avg_attendance_per_session: 0,
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch teaching sessions from teaching_sessions table
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("teaching_sessions")
        .select("id, session_date, started_at, ended_at, is_active")
        .eq("teacher_id", selectedTeacherId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        setStats({
          total_sessions: 0,
          avg_sessions_per_week: 0,
          active_sessions: 0,
          cancelled_sessions: 0,
          total_attendance: 0,
          avg_attendance_per_session: 0,
        });
        return;
      }

      // Get all students for this teacher
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, student_name")
        .eq("teacher_id", selectedTeacherId);

      const studentIds = studentsData?.map(s => s.id) || [];
      const studentMap = new Map(studentsData?.map(s => [s.id, s.student_name]) || []);

      // Fetch attendance records for all session dates
      const sessionDates = sessionsData.map(s => s.session_date);
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("date, student_id")
        .in("student_id", studentIds)
        .in("date", sessionDates);

      // Group attendance by date
      const attendanceByDate = new Map<string, string[]>();
      attendanceData?.forEach(record => {
        if (!attendanceByDate.has(record.date)) {
          attendanceByDate.set(record.date, []);
        }
        const studentName = studentMap.get(record.student_id);
        if (studentName) {
          attendanceByDate.get(record.date)!.push(studentName);
        }
      });

      // Convert to sessions array
      const sessionsArray: SessionRecord[] = sessionsData.map(session => {
        const studentNames = attendanceByDate.get(session.session_date) || [];
        return {
          id: session.id,
          session_date: session.session_date,
          students_attended: studentNames.length,
          student_names: studentNames,
          started_at: session.started_at,
          ended_at: session.ended_at,
          is_active: session.is_active,
        };
      });

      setSessions(sessionsArray);

      // Filter sessions: only active sessions are valid (counted)
      const validSessions = sessionsArray.filter(s => s.is_active);
      const cancelledSessions = sessionsArray.filter(s => !s.is_active);
      
      // Calculate statistics from valid sessions only
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const numWeeks = Math.max(diffDays / 7, 1);
      
      const totalAttendance = validSessions.reduce((sum, s) => sum + s.students_attended, 0);
      const avgAttendance = validSessions.length > 0 ? Math.round((totalAttendance / validSessions.length) * 10) / 10 : 0;
      
      setStats({
        total_sessions: validSessions.length,
        avg_sessions_per_week: numWeeks > 0 ? Math.round((validSessions.length / numWeeks) * 10) / 10 : 0,
        active_sessions: validSessions.length,
        cancelled_sessions: cancelledSessions.length,
        total_attendance: totalAttendance,
        avg_attendance_per_session: avgAttendance,
      });
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("فشل في جلب بيانات الجلسات");
    } finally {
      setLoading(false);
    }
  };

  const formatDateWithDay = (dateString: string) => {
    try {
      return format(new Date(dateString), "EEEE، dd MMMM yyyy", { locale: ar });
    } catch {
      return dateString;
    }
  };

  const handlePresetClick = (preset: DatePreset) => {
    const { from, to } = preset.getValue();
    setStartDate(format(from, "yyyy-MM-dd"));
    setEndDate(format(to, "yyyy-MM-dd"));
  };

  const handleSessionClick = (session: SessionRecord) => {
    setSelectedSession(session);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            سجل الجلسات التعليمية
          </h2>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">اختر الأستاذ</label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedTeacherName || "ابحث عن أستاذ..."}
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="ابحث عن أستاذ..." />
                      <CommandList>
                        <CommandEmpty>لم يتم العثور على أساتذة</CommandEmpty>
                        <CommandGroup>
                          {teachers.map((teacher) => (
                            <CommandItem
                              key={teacher.id}
                              value={teacher["اسم الاستاذ"]}
                              onSelect={() => {
                                setSelectedTeacherId(teacher.id);
                                setSelectedTeacherName(teacher["اسم الاستاذ"]);
                                setOpen(false);
                              }}
                            >
                              {teacher["اسم الاستاذ"]}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">من تاريخ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>
            </div>

            {/* Date Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium">فترات جاهزة</label>
              <div className="flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : selectedTeacherId && sessions.length > 0 ? (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">إجمالي الجلسات</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.total_sessions}
                      </p>
                    </div>
                    <Calendar className="h-10 w-10 text-blue-500" />
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">جلسات ملغاة</p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {stats.cancelled_sessions}
                      </p>
                    </div>
                    <XCircle className="h-10 w-10 text-red-500" />
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">جلسات نشطة</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {stats.active_sessions}
                      </p>
                    </div>
                    <Badge className="h-10 w-10 bg-orange-500 text-white">نشط</Badge>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">متوسط الحضور/جلسة</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.avg_attendance_per_session}
                      </p>
                    </div>
                    <Users className="h-10 w-10 text-purple-500" />
                  </div>
                </Card>
              </div>

              {/* Sessions Table */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  تفاصيل الجلسات
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">وقت البدء</TableHead>
                        <TableHead className="text-right">وقت الانتهاء</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">عدد الحضور</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow 
                          key={session.id} 
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSessionClick(session)}
                        >
                          <TableCell className="font-medium">
                            {formatDateWithDay(session.session_date)}
                          </TableCell>
                          <TableCell>
                            {session.started_at ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {format(new Date(session.started_at), "hh:mm a", { locale: ar })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {session.ended_at ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {format(new Date(session.ended_at), "hh:mm a", { locale: ar })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={session.is_active ? "default" : "destructive"}
                              className={session.is_active ? "bg-green-500 hover:bg-green-600" : "bg-red-500"}
                            >
                              {session.is_active ? "نشط" : "ملغاة"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="secondary" className="font-semibold">
                                {session.students_attended} طالب
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : selectedTeacherId ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد جلسات في الفترة المحددة
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              الرجاء اختيار أستاذ لعرض الجلسات
            </div>
          )}

          {/* Students Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  قائمة الطلاب - {selectedSession && formatDateWithDay(selectedSession.session_date)}
                </DialogTitle>
              </DialogHeader>
              {selectedSession && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/50 rounded-lg">
                    <Users className="h-5 w-5" />
                    <span className="font-semibold">
                      إجمالي الحضور: {selectedSession.students_attended} طالب
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {selectedSession.student_names.map((name, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                          {index + 1}
                        </div>
                        <span className="font-medium">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </div>
  );
};

export default SessionsLog;
