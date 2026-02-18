import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Loader2 } from "lucide-react";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface UnlistedStudentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const UnlistedStudentsDialog = ({ open, onOpenChange }: UnlistedStudentsDialogProps) => {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    useEffect(() => {
        if (open) {
            fetchUnlistedStudents();
        }
    }, [open]);

    const fetchUnlistedStudents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("students")
                .select("*")
                .eq("registration_status", "غير مدرج بعد")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error("Error fetching unlisted students:", error);
            toast.error("حدث خطأ أثناء جلب الطلاب");
        } finally {
            setLoading(false);
        }
    };

    const handleEditSuccess = () => {
        fetchUnlistedStudents(); // Refresh the list after editing
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-primary">
                            الطلاب غير المدرجين بعد ({students.length})
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                            لا يوجد طلاب غير مدرجين حالياً
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Desktop View: Table */}
                            <div className="hidden md:block border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="text-right font-bold">الاسم</TableHead>
                                            <TableHead className="text-right font-bold">الأستاذ</TableHead>
                                            <TableHead className="text-right font-bold">الصف</TableHead>
                                            <TableHead className="text-right font-bold">تاريخ الإضافة</TableHead>
                                            <TableHead className="text-center font-bold">الإجراء</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students.map((student) => (
                                            <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold">{student.student_name}</TableCell>
                                                <TableCell>{student.current_teacher || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-normal">
                                                        {student.grade || "-"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                                    {new Date(student.created_at).toLocaleDateString("ar-EG", {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit'
                                                    })}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                        title="تعديل المعلومات"
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setEditDialogOpen(true);
                                                        }}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile View: Cards */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {students.map((student) => (
                                    <div key={student.id} className="p-4 border rounded-xl bg-card shadow-sm space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg">{student.student_name}</h3>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span className="font-medium text-primary">الأستاذ:</span>
                                                    <span>{student.current_teacher || "-"}</span>
                                                </div>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-9 w-9 border-yellow-200 bg-yellow-50 text-yellow-600"
                                                onClick={() => {
                                                    setSelectedStudent(student);
                                                    setEditDialogOpen(true);
                                                }}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">الصف:</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {student.grade || "-"}
                                                </Badge>
                                            </div>
                                            <div className="text-muted-foreground text-xs italic">
                                                {new Date(student.created_at).toLocaleDateString("ar-EG")}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
