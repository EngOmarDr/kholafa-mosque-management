import { Button } from "@/components/ui/button";
import { CheckCircle, BookOpen, Plus, FileText, ZoomIn, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { useState } from "react";
import StudentPhotoViewDialog from "./StudentPhotoViewDialog";

interface StudentsListViewProps {
  students: any[];
  viewMode: "grid" | "list" | "mobile";
  studentAttendance: Record<string, string>;
  studentRecitations: Record<string, boolean>;
  studentDailyPoints: Record<string, number>;
  studentBonusPoints?: Record<string, { points: number; type: "add" | "deduct" }>;
  isSessionActive: boolean;
  loadingStudentIds?: string[]; // الطلاب الذين يتم تحديث بياناتهم حالياً
  getStudentCardColor: (id: string) => string;
  onStudentClick: (student: any) => void;
  onShowRecord: (student: any) => void;
  onAttendance: (student: any) => void;
  onRecitation: (student: any) => void;
  onBonusPoints: (student: any) => void;
  onPhotoUpdated?: (studentId?: string, newUrl?: string | null) => void;
  isSupervisor?: boolean;
}

const StudentsListView = ({
  students,
  viewMode,
  studentAttendance,
  studentRecitations,
  studentDailyPoints,
  studentBonusPoints = {},
  isSessionActive,
  loadingStudentIds = [],
  getStudentCardColor,
  onStudentClick,
  onShowRecord,
  onAttendance,
  onRecitation,
  onBonusPoints,
  onPhotoUpdated,
  isSupervisor = false
}: StudentsListViewProps) => {
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string | null; name: string; id: string } | null>(null);

  const isStudentLoading = (studentId: string) => loadingStudentIds.includes(studentId);

  const handlePhotoClick = (e: React.MouseEvent, photoUrl: string | null, studentName: string, studentId: string) => {
    e.stopPropagation();
    setSelectedPhoto({ url: photoUrl, name: studentName, id: studentId });
    setPhotoDialogOpen(true);
  };

  return (
    <>
      <div className={`${viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}`}>
        {students.map((student) => (
          <div
            key={student.id}
            className={`
            relative
            ${viewMode === "mobile" ? "bg-card p-3 rounded-xl border-2 shadow-sm space-y-3" : ""}
            ${viewMode === "list" ? "flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors" : ""}
            ${viewMode === "grid" ? "bg-card p-3 rounded-xl border-2 shadow-sm space-y-3" : ""}
            ${getStudentCardColor(student.id)}
            ${isStudentLoading(student.id) ? "opacity-70" : ""}
          `}
          >
            {/* مؤشر التحميل */}
            {isStudentLoading(student.id) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl z-10">
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-medium text-primary">جاري التحديث...</span>
                </div>
              </div>
            )}
            {viewMode === "mobile" ? (
              <>
                {/* عرض احترافي للجوال */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    className="h-16 w-16 cursor-pointer border-2 border-border hover:border-primary transition-colors flex-shrink-0"
                    onClick={(e) => handlePhotoClick(e, student.photo_url, student.student_name, student.id)}
                  >
                    <AvatarImage src={student.photo_url || undefined} alt={student.student_name} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="cursor-pointer flex-1" onClick={() => onStudentClick(student)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base">{student.student_name}</h4>
                        {isSupervisor && student.teacher_id && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground mr-1">
                            {student.teachers?.["اسم الاستاذ"] || "حلقة غير معروفة"}
                          </span>
                        )}
                        {(student.registration_status === 'انتظار' || student.registration_status === 'غير مدرج بعد') && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            يرجى مراجعة الإدارة
                          </span>
                        )}
                        {student.registration_status === 'فترة تجربة' && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            فترة تجربة
                          </span>
                        )}
                      </div>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {student.grade || "غير محدد"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {studentDailyPoints[student.id] !== undefined && studentDailyPoints[student.id] !== 0 && (
                        <span className={`font-semibold ${studentDailyPoints[student.id] > 0 ? "text-green-600" : "text-red-600"}`}>
                          {studentDailyPoints[student.id] > 0 ? '+' : ''}{studentDailyPoints[student.id]} اليوم
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => onShowRecord(student)}>
                    <FileText className="w-3 h-3 ml-1" />
                    سجل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-9 text-xs ${studentAttendance[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onAttendance(student)}
                    disabled={!isSessionActive}
                    title={!isSessionActive ? "يجب تفعيل الدوام أولاً" : ""}
                  >
                    <CheckCircle className="w-3 h-3 ml-1" />
                    {studentAttendance[student.id] ? "تعديل الحضور" : "حضور"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-9 text-xs ${studentRecitations[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onRecitation(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <BookOpen className="w-3 h-3 ml-1" />
                    تسميع
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-9 text-xs ${studentBonusPoints[student.id]
                      ? studentBonusPoints[student.id].type === "add"
                        ? 'bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-700'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
                      }`}
                    onClick={() => onBonusPoints(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <Plus className="w-3 h-3 ml-1" />
                    إضافي
                  </Button>
                </div>
              </>
            ) : viewMode === "grid" ? (
              <>
                {/* عرض البطاقات مع الصورة */}
                <div className="flex flex-col items-center mb-4">
                  <Avatar
                    className="h-28 w-28 border-2 border-border cursor-pointer transition-all hover:ring-2 hover:ring-primary mb-3"
                    onClick={(e) => handlePhotoClick(e, student.photo_url, student.student_name, student.id)}
                  >
                    <AvatarImage src={student.photo_url || undefined} alt={student.student_name} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-14 w-14 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center w-full cursor-pointer" onClick={() => onStudentClick(student)}>
                    <div className="flex flex-col items-center gap-1 mb-2">
                      <h4 className="font-bold text-lg">{student.student_name}</h4>
                      {isSupervisor && student.teacher_id && (
                        <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                          {student.teachers?.["اسم الاستاذ"] || "حلقة غير معروفة"}
                        </span>
                      )}
                      {(student.registration_status === 'انتظار' || student.registration_status === 'غير مدرج بعد') && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-2 py-1 rounded-full">
                          يرجى مراجعة الإدارة
                        </span>
                      )}
                      {student.registration_status === 'فترة تجربة' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-1 rounded-full">
                          فترة تجربة
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
                      <span className="text-muted-foreground bg-muted px-2 py-1 rounded-md">{student.grade || "غير محدد"}</span>
                      {studentDailyPoints[student.id] !== undefined && studentDailyPoints[student.id] !== 0 && (
                        <span className={`font-semibold px-2 py-1 rounded-md ${studentDailyPoints[student.id] > 0 ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}>
                          {studentDailyPoints[student.id] > 0 ? '+' : ''}{studentDailyPoints[student.id]} اليوم
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="default" variant="outline" className="h-11 text-sm font-semibold" onClick={() => onShowRecord(student)}>
                    <FileText className="w-4 h-4 ml-1" />
                    سجل
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className={`h-11 text-sm font-semibold ${studentAttendance[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onAttendance(student)}
                    disabled={!isSessionActive}
                    title={!isSessionActive ? "يجب تفعيل الدوام أولاً" : ""}
                  >
                    <CheckCircle className="w-4 h-4 ml-1" />
                    {studentAttendance[student.id] ? "تعديل" : "حضور"}
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className={`h-11 text-sm font-semibold ${studentRecitations[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onRecitation(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <BookOpen className="w-4 h-4 ml-1" />
                    تسميع
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className={`h-11 text-sm font-semibold ${studentBonusPoints[student.id]
                      ? studentBonusPoints[student.id].type === "add"
                        ? 'bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-700'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
                      }`}
                    onClick={() => onBonusPoints(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافي
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* عرض القائمة */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    className="h-12 w-12 cursor-pointer border-2 border-border hover:border-primary transition-colors flex-shrink-0"
                    onClick={(e) => handlePhotoClick(e, student.photo_url, student.student_name, student.id)}
                  >
                    <AvatarImage src={student.photo_url || undefined} alt={student.student_name} />
                    <AvatarFallback className="bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 cursor-pointer" onClick={() => onStudentClick(student)}>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{student.student_name}</h4>
                      {isSupervisor && student.teacher_id && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground mr-1">
                          {student.teachers?.["اسم الاستاذ"] || "حلقة غير معروفة"}
                        </span>
                      )}
                      {(student.registration_status === 'انتظار' || student.registration_status === 'غير مدرج بعد') && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          يرجى مراجعة الإدارة
                        </span>
                      )}
                      {student.registration_status === 'فترة تجربة' && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          فترة تجربة
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{student.grade || "غير محدد"}</span>
                      <span className="text-muted-foreground">•</span>
                      {studentDailyPoints[student.id] !== undefined && studentDailyPoints[student.id] !== 0 && (
                        <>
                          <span className={studentDailyPoints[student.id] > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                            {studentDailyPoints[student.id] > 0 ? '+' : ''}{studentDailyPoints[student.id]} اليوم
                          </span>
                          <span className="text-muted-foreground">•</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onShowRecord(student)}>
                    <FileText className="w-3 h-3 ml-1" />
                    سجل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 px-2 text-xs ${studentAttendance[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onAttendance(student)}
                    disabled={!isSessionActive}
                    title={!isSessionActive ? "يجب تفعيل الدوام أولاً" : ""}
                  >
                    <CheckCircle className="w-3 h-3 ml-1" />
                    {studentAttendance[student.id] ? "تعديل الحضور" : "حضور"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 px-2 text-xs ${studentRecitations[student.id] ? 'bg-green-700 text-white hover:bg-green-800 hover:text-white border-green-700' : ''}`}
                    onClick={() => onRecitation(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <BookOpen className="w-3 h-3 ml-1" />
                    تسميع
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 px-2 text-xs ${studentBonusPoints[student.id]
                      ? studentBonusPoints[student.id].type === "add"
                        ? 'bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-700'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
                      }`}
                    onClick={() => onBonusPoints(student)}
                    disabled={!isSessionActive || !studentAttendance[student.id] || studentAttendance[student.id] !== 'حاضر'}
                    title={
                      !isSessionActive
                        ? "يجب تفعيل الدوام أولاً"
                        : !studentAttendance[student.id]
                          ? "يجب تسجيل الحضور أولاً"
                          : studentAttendance[student.id] !== 'حاضر'
                            ? "الطالب غير حاضر"
                            : ""
                    }
                  >
                    <Plus className="w-3 h-3 ml-1" />
                    إضافي
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <StudentPhotoViewDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        photoUrl={selectedPhoto?.url || null}
        studentName={selectedPhoto?.name || ""}
        studentId={selectedPhoto?.id}
        canEdit={true}
        onPhotoUpdate={(newUrl) => {
          if (onPhotoUpdated && selectedPhoto?.id) {
            onPhotoUpdated(selectedPhoto.id, newUrl);
          }
        }}
      />
    </>
  );
};

export default StudentsListView;
