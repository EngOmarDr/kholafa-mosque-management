import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, CheckCircle, XCircle, Clock, Plus, Minus } from "lucide-react";
import BonusPointsDialog from "./BonusPointsDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminStudentRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecordData {
  attendance: any[];
  recitations: any[];
  bonusPoints: any[];
  totalPoints: number;
  attendanceCount: number;
  absentCount: number;
  excusedCount: number;
}

const AdminStudentRecordDialog = ({ open, onOpenChange }: AdminStudentRecordDialogProps) => {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudentsList, setFilteredStudentsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState<RecordData | null>(null);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchStudents();
      // جلب معرف المستخدم الحالي
      const userData = localStorage.getItem("jeelUser");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setCurrentUserId(parsedUser.id);
      }
    }
  }, [open]);

  useEffect(() => {
    const filtered = students.filter(student => {
      const matchesSearch = !searchTerm || student.student_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    setFilteredStudentsList(filtered);
  }, [students, searchTerm]);

  useEffect(() => {
    if (selectedStudentId) {
      const student = students.find(s => s.id === selectedStudentId);
      setSelectedStudent(student);
      fetchStudentRecord();
    }
  }, [selectedStudentId, startDate, endDate]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, current_teacher")
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
      setFilteredStudentsList(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل قائمة الطلاب");
    }
  };


  const fetchStudentRecord = async () => {
    if (!selectedStudentId) return;
    
    setLoading(true);
    try {
      // جلب بيانات الحضور
      const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (attError) throw attError;

      // جلب بيانات التسميع
      const { data: recitationsData, error: recError } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (recError) throw recError;

      // جلب النقاط الإضافية
      const { data: bonusData, error: bonusError } = await supabase
        .from("bonus_points")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (bonusError) throw bonusError;

      // حساب الإحصائيات
      const attendanceCount = attendanceData?.filter(a => a.status === 'حاضر').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'غائب').length || 0;
      const excusedCount = attendanceData?.filter(a => a.status === 'اعتذر').length || 0;
      
      const attendancePoints = attendanceData?.reduce((sum, a) => {
        if (a.status === 'حاضر') return sum + 1;
        if (a.status === 'غائب') return sum - 1;
        return sum;
      }, 0) || 0;

      const recitationPoints = recitationsData?.reduce((sum, r) => sum + (r.points_awarded || 0), 0) || 0;
      const bonusPointsSum = bonusData?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      const totalPoints = attendancePoints + recitationPoints + bonusPointsSum;

      setRecordData({
        attendance: attendanceData || [],
        recitations: recitationsData || [],
        bonusPoints: bonusData || [],
        totalPoints,
        attendanceCount,
        absentCount,
        excusedCount
      });
    } catch (error) {
      console.error("Error fetching student record:", error);
      toast.error("حدث خطأ في تحميل سجل الطالب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">سجل الطالب</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* بحث بالاسم فقط */}
          <div>
            <Label className="text-xs text-muted-foreground">ابحث عن طالب</Label>
            <Input
              placeholder="اكتب اسم الطالب للبحث الفوري..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedStudentId("");
              }}
              className="flex-1"
            />
          </div>

          {/* عرض نتائج البحث */}
          {searchTerm && (
            <div className="border rounded-lg">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium">
                النتائج: {filteredStudentsList.length} طالب
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filteredStudentsList.length > 0 ? (
                  <div className="divide-y">
                    {filteredStudentsList.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`w-full text-right px-3 py-2.5 hover:bg-accent transition-colors ${
                          selectedStudentId === student.id ? 'bg-primary/10 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{student.student_name}</span>
                          {student.current_teacher && (
                            <span className="text-xs text-muted-foreground">
                              ({student.current_teacher})
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">لا توجد نتائج</p>
                    <button
                      onClick={() => setSearchTerm("")}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      مسح البحث
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedStudentId && (
            <>
              {/* تحديد الفترة الزمنية */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : recordData ? (
                <>
                  {/* إحصائيات */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                      <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-600" />
                      <p className="text-xs text-muted-foreground">حضور</p>
                      <p className="text-lg font-bold text-green-600">{recordData.attendanceCount}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                      <XCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                      <p className="text-xs text-muted-foreground">غياب</p>
                      <p className="text-lg font-bold text-red-600">{recordData.absentCount}</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                      <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                      <p className="text-xs text-muted-foreground">اعتذار</p>
                      <p className="text-lg font-bold text-yellow-600">{recordData.excusedCount}</p>
                    </div>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">إجمالي النقاط</p>
                    <p className="text-2xl font-bold text-primary">{recordData.totalPoints}</p>
                  </div>

                  {/* زر إضافة/خصم نقاط */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBonusDialog(true)}
                    className="w-full gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <Minus className="w-4 h-4" />
                    إضافة أو خصم نقاط
                  </Button>

                  {/* النقاط الإضافية */}
                  {recordData.bonusPoints.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        النقاط الإضافية ({recordData.bonusPoints.length})
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {recordData.bonusPoints.map((bonus) => (
                          <div key={bonus.id} className="border rounded-lg p-2 text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">{bonus.reason}</span>
                              <span className={`font-semibold ${bonus.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {bonus.points > 0 ? '+' : ''}{bonus.points} نقطة
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(bonus.date).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* سجل التسميع */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      سجل التسميع ({recordData.recitations.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {recordData.recitations.length > 0 ? (
                        recordData.recitations.map((rec) => (
                          <div key={rec.id} className="border rounded-lg p-2 text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium">{rec.last_saved}</span>
                              <span className="text-primary font-semibold">+{rec.points_awarded} نقطة</span>
                            </div>
                            <div className="flex gap-2 text-muted-foreground">
                              <span>{new Date(rec.date).toLocaleDateString('ar-EG')}</span>
                              <span>•</span>
                              <span className={
                                rec.rating === 'ممتاز' ? 'text-green-600' :
                                rec.rating === 'جيد' ? 'text-blue-600' :
                                'text-orange-600'
                              }>
                                {rec.rating}
                              </span>
                            </div>
                            {rec.notes && (
                              <p className="mt-1 text-muted-foreground italic">
                                ملاحظات: {rec.notes}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">لا يوجد سجل تسميع في هذه الفترة</p>
                      )}
                    </div>
                  </div>

                  {/* قسم الملاحظات */}
                  {recordData.recitations.filter(r => r.notes).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        الملاحظات ({recordData.recitations.filter(r => r.notes).length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {recordData.recitations
                          .filter(r => r.notes)
                          .map((rec) => (
                            <div key={rec.id} className="border rounded-lg p-3 text-xs bg-muted/30">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-muted-foreground font-medium">
                                  {new Date(rec.date).toLocaleDateString('ar-EG')}
                                </span>
                                <span className={
                                  rec.rating === 'ممتاز' ? 'text-green-600' :
                                  rec.rating === 'جيد' ? 'text-blue-600' :
                                  'text-orange-600'
                                }>
                                  {rec.rating}
                                </span>
                              </div>
                              <div className="mb-2 font-medium text-primary">
                                الصفحات: {rec.last_saved}
                              </div>
                              <p className="text-foreground">
                                {rec.notes}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* سجل الحضور */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      سجل الحضور ({recordData.attendance.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {recordData.attendance.length > 0 ? (
                        recordData.attendance.map((att) => (
                          <div key={att.id} className="flex justify-between items-center border rounded-lg p-2 text-xs">
                            <span>{new Date(att.date).toLocaleDateString('ar-EG')}</span>
                            <span className={
                              att.status === 'حاضر' ? 'text-green-600 font-semibold' :
                              att.status === 'غائب' ? 'text-red-600 font-semibold' :
                              'text-yellow-600 font-semibold'
                            }>
                              {att.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">لا يوجد سجل حضور في هذه الفترة</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          إغلاق
        </Button>
      </DialogContent>
      
      {/* Dialog لإضافة/خصم نقاط */}
      {selectedStudent && (
        <BonusPointsDialog
          open={showBonusDialog}
          onOpenChange={setShowBonusDialog}
          student={selectedStudent}
          teacherId={currentUserId}
          onSuccess={() => {
            fetchStudentRecord();
            toast.success("تم تحديث النقاط بنجاح");
          }}
        />
      )}
    </Dialog>
  );
};

export default AdminStudentRecordDialog;
