import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, MessageCircle, Package, Award, User, Copy, CheckCircle2, Edit, X, Save, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import StudentPhotoUpload from "@/components/StudentPhotoUpload";

interface StudentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  onStudentUpdated?: (updatedFields?: any) => void;
}

const StudentDetailsDialog = ({ open, onOpenChange, student, onStudentUpdated }: StudentDetailsDialogProps) => {
  const [receivedTools, setReceivedTools] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolsPoints, setToolsPoints] = useState(0);
  const [studentNotes, setStudentNotes] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && student) {
      if (student.received_tools && student.received_tools.length > 0) {
        fetchReceivedTools();
      }
      fetchToolsPoints();
      fetchStudentNotes();
      setEditedNotes(student.notes || "");
      setIsEditingNotes(false);
      setIsEditingPhoto(false);
      setCurrentPhotoUrl(student.photo_url || null);
    }
  }, [open, student]);

  const fetchReceivedTools = async () => {
    if (!student?.received_tools) return;

    setLoadingTools(true);
    try {
      const { data, error } = await supabase
        .from('check_items')
        .select('*')
        .in('id', student.received_tools);

      if (!error && data) {
        setReceivedTools(data);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
    } finally {
      setLoadingTools(false);
    }
  };

  const fetchToolsPoints = async () => {
    if (!student?.id) return;

    try {
      const { data, error } = await supabase
        .from('check_records')
        .select('points')
        .eq('student_id', student.id);

      if (!error && data) {
        const total = data.reduce((sum, record) => sum + (record.points || 0), 0);
        setToolsPoints(total);
      }
    } catch (error) {
      console.error('Error fetching tools points:', error);
    }
  };

  const fetchStudentNotes = async () => {
    if (!student?.id) return;

    try {
      const { data, error } = await supabase
        .from('student_notes')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudentNotes(data);
      }
    } catch (error) {
      console.error('Error fetching student notes:', error);
    }
  };

  const handleWhatsApp = () => {
    if (student?.phone) {
      const cleanPhone = student.phone.replace(/\D/g, '');
      const message = encodeURIComponent(`السلام عليكم ${student.student_name}`);
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    }
  };

  const handleCall = () => {
    if (student?.phone) {
      window.open(`tel:${student.phone}`);
    }
  };

  const inquiryUrl = student?.id
    ? `${window.location.origin}/student-inquiry?id=${student.id}`
    : '';

  const handleCopyId = () => {
    if (student?.id) {
      navigator.clipboard.writeText(student.id);
      setCopiedId(true);
      toast.success("تم نسخ معرف الطالب ✓");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSendInquiryWhatsApp = () => {
    if (student?.id) {
      const message = encodeURIComponent(
        `مرحباً، يمكنك الاستعلام عن طالبك ${student.student_name} من خلال الرابط التالي:\n${inquiryUrl}\n\nمعرف الطالب: ${student.id}`
      );
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
  };

  const handleSaveNotes = async () => {
    if (!student?.id) return;

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ notes: editedNotes })
        .eq('id', student.id);

      if (error) throw error;

      toast.success("تم حفظ الملاحظات بنجاح ✓");
      setIsEditingNotes(false);

      // Update student object to reflect changes
      if (student) {
        student.notes = editedNotes;
        if (onStudentUpdated) onStudentUpdated({ notes: editedNotes });
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error("فشل حفظ الملاحظات");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedNotes(student?.notes || "");
    setIsEditingNotes(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {isEditingPhoto ? (
              <div className="space-y-2">
                <StudentPhotoUpload
                  currentPhotoUrl={currentPhotoUrl}
                  studentId={student?.id}
                  onPhotoChange={(newUrl) => {
                    setCurrentPhotoUrl(newUrl);
                    setIsEditingPhoto(false);
                    if (onStudentUpdated) onStudentUpdated({ photo_url: newUrl });
                  }}
                />
                <Button
                  onClick={() => setIsEditingPhoto(false)}
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 gap-1"
                >
                  <X className="w-3 h-3" />
                  <span className="text-xs">إلغاء</span>
                </Button>
              </div>
            ) : (
              <div
                className="relative cursor-pointer group"
                onClick={() => setIsEditingPhoto(true)}
              >
                <Avatar className="h-16 w-16 border-2 border-border group-hover:border-primary transition-colors">
                  <AvatarImage src={currentPhotoUrl || undefined} alt={student?.student_name} />
                  <AvatarFallback className="bg-muted">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
            <DialogTitle className="text-lg">{student?.student_name}</DialogTitle>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 py-4">
            {/* Student ID & Inquiry Link Section */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border">
              {/* Student ID */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">معرف الطالب</div>
                <div className="font-mono text-xs text-foreground break-all">
                  {student?.id}
                </div>
              </div>

              {/* Inquiry URL */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">رابط الاستعلام</div>
                <div className="text-xs text-primary break-all">
                  {inquiryUrl}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleCopyId}
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 gap-1.5"
                >
                  {copiedId ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-xs">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-xs">نسخ المعرف</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSendInquiryWhatsApp}
                  size="sm"
                  className="flex-1 h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span className="text-xs">إرسال لواتساب</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="font-medium text-muted-foreground">اسم الطالب:</div>
              <div className="font-semibold">{student?.student_name}</div>

              <div className="font-medium text-muted-foreground">اسم الأب:</div>
              <div>{student?.father_name || "غير محدد"}</div>

              <div className="font-medium text-muted-foreground">الصف:</div>
              <div>{student?.grade || "غير محدد"}</div>

              <div className="font-medium text-muted-foreground">اسم الأستاذ:</div>
              <div>{student?.current_teacher || "غير محدد"}</div>

              <div className="font-medium text-muted-foreground">الحالة الاجتماعية:</div>
              <div>{student?.social_status || "غير محدد"}</div>

              <div className="font-medium text-muted-foreground">العنوان:</div>
              <div>{student?.address || "غير متوفر"}</div>

              <div className="font-medium text-muted-foreground">رقم الهاتف:</div>
              <div className="flex items-center gap-2">
                <span>{student?.phone || "غير متوفر"}</span>
                {student?.phone && (
                  <div className="flex gap-1">
                    <Button
                      onClick={handleCall}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                    >
                      <Phone className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={handleWhatsApp}
                      size="sm"
                      className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <MessageCircle className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Points Summary */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t">
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <div className="text-lg font-bold text-primary">
                  {student?.points_balance?.[0]?.total || 0}
                </div>
                <div className="text-xs text-muted-foreground">إجمالي النقاط</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <div className="text-lg font-bold text-blue-600">
                  {student?.points_balance?.[0]?.recitation_points || 0}
                </div>
                <div className="text-xs text-muted-foreground">نقاط التسميع</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <div className="text-lg font-bold text-purple-600">
                  {toolsPoints}
                </div>
                <div className="text-xs text-muted-foreground">نقاط الأدوات</div>
              </div>
            </div>

            {receivedTools.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-primary" />
                  <div className="font-semibold">الأدوات المستلمة من الإدارة</div>
                </div>
                {loadingTools ? (
                  <div className="text-sm text-muted-foreground">جاري التحميل...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {receivedTools.map((tool) => (
                      <div key={tool.id} className="p-3 rounded-md border bg-card">
                        <div className="font-medium mb-1">{tool.name}</div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="text-green-600">أحضره: +{tool.points_brought || 0}</span>
                          <span className="text-orange-600">لم يحضره: {tool.points_not_brought || 0}</span>
                          <span className="text-blue-600">تجاوز: {tool.points_skipped || 0}</span>
                          <span className="text-red-600">فقدان: {tool.points_lost || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm">ملاحظة خاصة:</div>
                {!isEditingNotes ? (
                  <Button
                    onClick={() => setIsEditingNotes(true)}
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5"
                  >
                    <Edit className="w-3 h-3" />
                    <span className="text-xs">تعديل</span>
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5"
                      disabled={savingNotes}
                    >
                      <X className="w-3 h-3" />
                      <span className="text-xs">إلغاء</span>
                    </Button>
                    <Button
                      onClick={handleSaveNotes}
                      size="sm"
                      variant="default"
                      className="h-7 gap-1.5"
                      disabled={savingNotes}
                    >
                      <Save className="w-3 h-3" />
                      <span className="text-xs">{savingNotes ? "جاري الحفظ..." : "حفظ"}</span>
                    </Button>
                  </div>
                )}
              </div>
              {isEditingNotes ? (
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="min-h-[100px] text-sm"
                />
              ) : (
                <div className="text-sm text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-md">
                  {student?.notes || "لا توجد ملاحظات"}
                </div>
              )}
            </div>

            {studentNotes.length > 0 && (
              <div className="pt-3 border-t">
                <div className="font-semibold text-sm mb-2">ملاحظات الأساتذة ({studentNotes.length}):</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {studentNotes.map((note) => (
                    <div key={note.id} className="text-sm p-3 rounded-md bg-card border">
                      <p className="text-foreground mb-1">{note.note}</p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsDialog;
