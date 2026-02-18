import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, Phone, Home, Users, Award, XCircle, CheckCircle, GraduationCap, MessageCircle, Package, StickyNote, FileText, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import StudentRecordDialog from "./StudentRecordDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StudentPhotoViewDialog from "./StudentPhotoViewDialog";
import { normalizeArabic } from "@/lib/utils";

const QuickStudentSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [studentStats, setStudentStats] = useState<any>(null);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [excludeBonus, setExcludeBonus] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const normalizedSearch = normalizeArabic(searchTerm);
      const filtered = students.filter(student =>
        normalizeArabic(student.student_name).includes(normalizedSearch)
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents([]);
      setSelectedStudent(null);
    }
  }, [searchTerm, students]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    }
  };

  const fetchStudentStats = async (studentId: string, filter: string = activeFilter, skipBonus: boolean = excludeBonus) => {
    setLoading(true);
    try {
      let startDate: string | null = null;
      const now = new Date();

      if (filter === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (filter === "month") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (filter === "3months") {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      // جلب نقاط الحضور
      let attendanceQuery = supabase
        .from("attendance")
        .select("status")
        .eq("student_id", studentId);

      if (startDate) {
        attendanceQuery = attendanceQuery.gte("date", startDate);
      }

      const { data: attendanceData } = await attendanceQuery;

      const attendancePoints = attendanceData?.reduce((sum, a) => {
        if (a.status === 'حاضر') return sum + 1;
        if (a.status === 'غائب') return sum - 1;
        return sum;
      }, 0) || 0;

      const attendanceCount = attendanceData?.filter(a => a.status === 'حاضر').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'غائب').length || 0;

      // جلب نقاط التسميع
      let recitationsQuery = supabase
        .from("recitations")
        .select("points_awarded")
        .eq("student_id", studentId);

      if (startDate) {
        recitationsQuery = recitationsQuery.gte("date", startDate);
      }

      const { data: recitationsData } = await recitationsQuery;

      const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;

      // جلب النقاط الإضافية
      let bonusPoints = 0;
      if (!skipBonus) {
        let bonusQuery = supabase
          .from("bonus_points")
          .select("points")
          .eq("student_id", studentId);

        if (startDate) {
          bonusQuery = bonusQuery.gte("date", startDate);
        }

        const { data: bonusData } = await bonusQuery;
        bonusPoints = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      }

      // جلب نقاط تفقد الأدوات
      let checkRecordsQuery = supabase
        .from("check_records")
        .select("points")
        .eq("student_id", studentId);

      if (startDate) {
        checkRecordsQuery = checkRecordsQuery.gte("date", startDate);
      }

      const { data: checkRecordsData } = await checkRecordsQuery;

      const toolsPoints = checkRecordsData?.reduce((sum, c) => sum + (c.points || 0), 0) || 0;

      const totalPoints = attendancePoints + recitationPoints + bonusPoints + toolsPoints;

      setStudentStats({
        totalPoints,
        attendanceCount,
        absentCount,
        recitationPoints,
        bonusPoints,
        toolsPoints
      });
    } catch (error) {
      console.error("Error fetching student stats:", error);
      toast.error("حدث خطأ في تحميل إحصائيات الطالب");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
    setSearchTerm(student.student_name);
    setFilteredStudents([]);
    setActiveFilter("all");
    setExcludeBonus(false);
    fetchStudentStats(student.id, "all", false);
  };

  const handlePhotoUpdate = async (newUrl: string | null) => {
    if (!selectedStudent) return;

    // Update local state for immediate feedback
    const updatedStudent = { ...selectedStudent, photo_url: newUrl };
    setSelectedStudent(updatedStudent);

    // Update main students list
    setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updatedStudent : s));
  };

  return (
    <Card className="w-full shadow-md border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 animate-pulse-subtle">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary w-5 h-5" />
            <Input
              placeholder="ابحث عن طالب بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 bg-primary/5 border-primary/30 focus:border-primary focus:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all duration-300"
            />
          </div>

          {/* نتائج البحث */}
          {filteredStudents.length > 0 && !selectedStudent && (
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b">
                النتائج: {filteredStudents.length} طالب
              </div>
              <div className="divide-y">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className="w-full text-right px-3 py-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={student.photo_url || undefined} alt={student.student_name} />
                          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.student_name}</span>
                        {student.registration_status === "غير مسجل" && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                            غير مسجل
                          </span>
                        )}
                      </div>
                      {student.current_teacher && (
                        <span className="text-xs text-muted-foreground border-r pr-2">
                          {student.current_teacher}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* عرض معلومات الطالب المحدد */}
          {selectedStudent && (
            <div className="space-y-4 animate-fade-in">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* معلومات أساسية */}
                  <div className="bg-gradient-primary p-6 rounded-lg text-primary-foreground shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
                    <div className="flex flex-col gap-6 relative z-10">
                      {/* القسم العلوي: معلومات الطالب */}
                      <div className="flex items-center gap-4">
                        <Avatar
                          className="w-24 h-24 border-4 border-white/20 shadow-xl cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setPhotoDialogOpen(true)}
                        >
                          <AvatarImage src={selectedStudent.photo_url || undefined} alt={selectedStudent.student_name} />
                          <AvatarFallback className="bg-background/20">
                            <User className="w-12 h-12 text-white" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <h3 className="text-3xl font-bold tracking-tight">{selectedStudent.student_name}</h3>
                          {selectedStudent.father_name && (
                            <p className="text-lg opacity-90 font-medium flex items-center gap-2">
                              <span className="text-sm opacity-70">والده:</span>
                              {selectedStudent.father_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* القسم السفلي: الأزرار */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button
                          onClick={() => setShowRecordDialog(true)}
                          variant="secondary"
                          className="w-full gap-2 bg-white/20 hover:bg-white/30 text-white border-none h-12 text-lg font-semibold transition-all duration-300 shadow-sm"
                        >
                          <FileText className="w-5 h-5" />
                          سجل الطالب
                        </Button>
                        <Button
                          onClick={() => setShowEditDialog(true)}
                          variant="secondary"
                          className="w-full gap-2 bg-white/20 hover:bg-white/30 text-white border-none h-12 text-lg font-semibold transition-all duration-300 shadow-sm"
                        >
                          <Edit className="w-5 h-5" />
                          تعديل البيانات
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* فلاتر الإحصائيات */}
                  <div className="flex flex-wrap gap-2 justify-center py-2">
                    <Button
                      variant={activeFilter === "week" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setActiveFilter("week");
                        fetchStudentStats(selectedStudent.id, "week", excludeBonus);
                      }}
                      className="h-8 text-xs font-semibold rounded-full"
                    >
                      اخر اسبوع
                    </Button>
                    <Button
                      variant={activeFilter === "month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setActiveFilter("month");
                        fetchStudentStats(selectedStudent.id, "month", excludeBonus);
                      }}
                      className="h-8 text-xs font-semibold rounded-full"
                    >
                      اخر شهر
                    </Button>
                    <Button
                      variant={activeFilter === "3months" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setActiveFilter("3months");
                        fetchStudentStats(selectedStudent.id, "3months", excludeBonus);
                      }}
                      className="h-8 text-xs font-semibold rounded-full"
                    >
                      اخر 3 شهور
                    </Button>
                    <Button
                      variant={activeFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setActiveFilter("all");
                        fetchStudentStats(selectedStudent.id, "all", excludeBonus);
                      }}
                      className="h-8 text-xs font-semibold rounded-full"
                    >
                      جميع البيانات
                    </Button>
                    <Button
                      variant={excludeBonus ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newExclude = !excludeBonus;
                        setExcludeBonus(newExclude);
                        fetchStudentStats(selectedStudent.id, activeFilter, newExclude);
                      }}
                      className="h-8 text-xs font-semibold rounded-full"
                    >
                      بدون النقاط الاضافية
                    </Button>
                  </div>

                  {/* الإحصائيات */}
                  {studentStats && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                        <Award className="w-6 h-6 mx-auto mb-2 text-primary" />
                        <p className="text-xs text-muted-foreground mb-1">إجمالي النقاط</p>
                        <p className="text-2xl font-bold text-primary">{studentStats.totalPoints}</p>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
                        <p className="text-xs text-muted-foreground mb-1">أيام الحضور</p>
                        <p className="text-2xl font-bold text-green-600">{studentStats.attendanceCount}</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                        <XCircle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                        <p className="text-xs text-muted-foreground mb-1">أيام الغياب</p>
                        <p className="text-2xl font-bold text-red-600">{studentStats.absentCount}</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                        <GraduationCap className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                        <p className="text-xs text-muted-foreground mb-1">نقاط التسميع</p>
                        <p className="text-2xl font-bold text-blue-600">{studentStats.recitationPoints}</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
                        <Package className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                        <p className="text-xs text-muted-foreground mb-1">نقاط الأدوات</p>
                        <p className="text-2xl font-bold text-purple-600">{studentStats.toolsPoints}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                        <Award className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                        <p className="text-xs text-muted-foreground mb-1">النقاط الإضافية</p>
                        <p className="text-2xl font-bold text-amber-600">{studentStats.bonusPoints}</p>
                      </div>
                    </div>
                  )}

                  {/* معلومات تفصيلية */}
                  <div className="border rounded-lg divide-y">
                    {selectedStudent.current_teacher && (
                      <div className="flex items-center gap-3 p-3">
                        <GraduationCap className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">الأستاذ</p>
                          <p className="font-medium">{selectedStudent.current_teacher}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.phone && (
                      <div className="flex items-center gap-3 p-3">
                        <Phone className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">رقم الهاتف</p>
                          <div className="flex items-center gap-2">
                            <p className="font-medium" dir="ltr">{selectedStudent.phone}</p>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => window.open(`tel:${selectedStudent.phone}`)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                              >
                                <Phone className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => {
                                  const cleanPhone = selectedStudent.phone.replace(/\D/g, '');
                                  const message = encodeURIComponent(`السلام عليكم ${selectedStudent.student_name}`);
                                  window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
                                }}
                                size="sm"
                                variant="default"
                                className="h-7 px-2 bg-green-600 hover:bg-green-700"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedStudent.grade && (
                      <div className="flex items-center gap-3 p-3">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">الصف</p>
                          <p className="font-medium">{selectedStudent.grade}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.social_status && (
                      <div className="flex items-center gap-3 p-3">
                        <Home className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">الحالة الاجتماعية</p>
                          <p className="font-medium">{selectedStudent.social_status}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.address && (
                      <div className="flex items-center gap-3 p-3">
                        <Home className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">العنوان</p>
                          <p className="font-medium">{selectedStudent.address}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.mosque_name && (
                      <div className="flex items-center gap-3 p-3">
                        <Home className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">المسجد</p>
                          <p className="font-medium">{selectedStudent.mosque_name}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.registration_status && (
                      <div className="flex items-center gap-3 p-3">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">حالة التسجيل</p>
                          <p className={`font-medium ${selectedStudent.registration_status === "غير مسجل" ? "text-red-600 font-bold" : ""}`}>
                            {selectedStudent.registration_status}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ملاحظات الطالب */}
                  {selectedStudent.notes && (
                    <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="w-5 h-5 text-amber-600" />
                        <p className="font-semibold text-sm">ملاحظات عن الطالب</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedStudent.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <StudentRecordDialog
        open={showRecordDialog}
        onOpenChange={setShowRecordDialog}
        student={selectedStudent}
        isAdmin={true}
      />

      <StudentPhotoViewDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        photoUrl={selectedStudent?.photo_url || null}
        studentName={selectedStudent?.student_name || ""}
        studentId={selectedStudent?.id}
        canEdit={true}
        onPhotoUpdate={handlePhotoUpdate}
      />

      {selectedStudent && (
        <EditStudentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          student={selectedStudent}
          onSuccess={() => {
            fetchStudents();
            // Update selected student with new data if name changed
            const updated = students.find(s => s.id === selectedStudent.id);
            if (updated) setSelectedStudent(updated);
          }}
        />
      )}
    </Card>
  );
};

export default QuickStudentSearch;
