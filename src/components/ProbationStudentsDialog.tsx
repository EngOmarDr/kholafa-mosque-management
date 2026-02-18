import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Loader2, CheckCircle2, Clock } from "lucide-react";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProbationStudentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ProbationStudentsDialog = ({ open, onOpenChange }: ProbationStudentsDialogProps) => {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    useEffect(() => {
        if (open) {
            fetchProbationStudents();
        }
    }, [open]);

    const fetchProbationStudents = async () => {
        setLoading(true);
        try {
            // 1. Fetch students in probation
            const { data: studentsData, error: studentsError } = await supabase
                .from("students")
                .select("*")
                .eq("registration_status", "فترة تجربة")
                .order("student_name", { ascending: true });

            if (studentsError) throw studentsError;

            if (!studentsData || studentsData.length === 0) {
                setStudents([]);
                return;
            }

            // 2. Fetch attendance counts for these students
            const studentIds = studentsData.map(s => s.id);
            const { data: attendanceData, error: attendanceError } = await supabase
                .from("attendance")
                .select("student_id")
                .eq("status", "حاضر")
                .in("student_id", studentIds);

            if (attendanceError) throw attendanceError;

            // 3. Count attendance per student
            const counts: Record<string, number> = {};
            attendanceData?.forEach((record: any) => {
                counts[record.student_id] = (counts[record.student_id] || 0) + 1;
            });

            // 4. Combine data
            const enrichedStudents = studentsData.map(student => {
                const presentCount = counts[student.id] || 0;
                return {
                    ...student,
                    presentCount,
                    daysRemaining: Math.max(0, 6 - presentCount),
                    progress: (presentCount / 6) * 100
                };
            });

            setStudents(enrichedStudents);
        } catch (error) {
            console.error("Error fetching probation students:", error);
            toast.error("حدث خطأ أثناء جلب الطلاب");
        } finally {
            setLoading(false);
        }
    };

    const handleEditSuccess = () => {
        fetchProbationStudents(); // Refresh after edit
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Clock className="w-6 h-6 text-primary" />
                            طلاب فترة التجربة ({students.length})
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            لا يوجد طلاب في فترة التجربة حالياً
                        </div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-right font-bold">اسم الطالب</TableHead>
                                        <TableHead className="text-right font-bold">المسجد</TableHead>
                                        <TableHead className="text-right font-bold">المعلم</TableHead>
                                        <TableHead className="text-right font-bold">أيام الحضور</TableHead>
                                        <TableHead className="text-right font-bold">الأيام المتبقية</TableHead>
                                        <TableHead className="text-right font-bold">التقدم</TableHead>
                                        <TableHead className="text-center font-bold">الإجراء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-semibold">{student.student_name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-xs">
                                                    {student.mosque_name || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {student.current_teacher || "-"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 font-medium text-emerald-600">
                                                    {student.presentCount} {student.presentCount === 1 ? 'يوم' : 'أيام'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 font-medium text-amber-600">
                                                    {student.daysRemaining} {student.daysRemaining === 1 ? 'يوم' : 'أيام'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[120px]">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                                                        <span>{Math.round(student.progress)}%</span>
                                                        {student.presentCount >= 6 ? (
                                                            <span className="text-emerald-500 font-bold">جاهز!</span>
                                                        ) : (
                                                            <span>{student.presentCount}/6</span>
                                                        )}
                                                    </div>
                                                    <Progress
                                                        value={student.progress}
                                                        className={`h-2 ${student.presentCount >= 6 ? 'bg-emerald-100' : ''}`}
                                                        indicatorClassName={`${student.presentCount >= 6 ? 'bg-emerald-500' : 'bg-primary'}`}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1 border border-border hover:bg-muted"
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        setEditDialogOpen(true);
                                                    }}
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                    تعديل
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {selectedStudent && (
                <EditStudentDialog
                    student={selectedStudent}
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSuccess={handleEditSuccess}
                />
            )}
        </>
    );
};
