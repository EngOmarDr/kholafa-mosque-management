import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addToSyncQueue } from "@/lib/backgroundSync";
import { saveLocalAttendance } from "@/lib/offlineStorage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  selectedDate: string;
  onSuccess: () => void;
  teacherId: string;
  currentStatus?: string;
}

const AttendanceDialog = ({
  open,
  onOpenChange,
  student,
  selectedDate,
  onSuccess,
  teacherId,
  currentStatus,
}: AttendanceDialogProps) => {
  const [status, setStatus] = useState(currentStatus || "حاضر");
  const [loading, setLoading] = useState(false);
  const [receivedTools, setReceivedTools] = useState<any[]>([]);
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [toolReissues, setToolReissues] = useState<Record<string, any>>({});
  const [showLossConfirm, setShowLossConfirm] = useState(false);
  const [pendingLossItemId, setPendingLossItemId] = useState<string | null>(null);
  const [pendingLossItemName, setPendingLossItemName] = useState<string>("");
  const [attendancePoints, setAttendancePoints] = useState<Record<string, number>>({
    present: 1,
    absent: -1,
    excused: 0,
  });

  useEffect(() => {
    fetchAttendancePointsSettings();
  }, []);

  const fetchAttendancePointsSettings = async () => {
    try {
      const { data, error } = await (supabase
        .from("points_settings")
        .select("key, points")
        .eq("category", "attendance") as any);

      if (error) throw error;

      if (data) {
        const settings: Record<string, number> = {};
        data.forEach((s: any) => {
          settings[s.key] = s.points;
        });
        setAttendancePoints(settings);
      }
    } catch (error) {
      console.error("Error fetching attendance points settings:", error);
    }
  };

  const fetchItemsAndSelections = async () => {
    if (!student?.id || !selectedDate) return;

    setLoadingItems(true);
    try {
      let studentReceivedTools: any[] = [];
      if (student.received_tools && student.received_tools.length > 0) {
        const { data: toolsData, error: toolsError } = await supabase
          .from("check_items")
          .select("*")
          .in("id", student.received_tools)
          .eq("active", true);

        if (toolsError) throw toolsError;
        if (toolsData) {
          studentReceivedTools = toolsData;
          setReceivedTools(toolsData);
        }
      }

      const { data: records, error: recordsError } = await supabase
        .from("check_records")
        .select("*")
        .eq("student_id", student.id)
        .eq("date", selectedDate);

      if (recordsError) throw recordsError;

      const statuses: Record<string, string> = {};
      records?.forEach((record: any) => {
        statuses[record.item_id] = record.status || "موجود";
      });
      setItemStatuses(statuses);

      const { data: reissuesData, error: reissuesError } = await (supabase
        .from("tool_reissues")
        .select("*")
        .eq("student_id", student.id) as any);

      if (reissuesError) throw reissuesError;

      const reissues: Record<string, any> = {};
      reissuesData?.forEach((reissue: any) => {
        reissues[reissue.item_id] = {
          count: reissue.reissue_count,
          status: reissue.status,
          reissued: reissue.reissued_by_admin,
          lastDate: reissue.last_reissue_date,
        };
      });
      setToolReissues(reissues);

    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("خطأ في جلب الأدوات");
    } finally {
      setLoadingItems(false);
    }
  };

  const setItemStatus = (itemId: string, itemName: string, newStatus: string) => {
    // Check if tool is already lost
    const reissueData = toolReissues[itemId];
    const isLost = reissueData && reissueData.status === "lost" && !reissueData.reissued;

    if (isLost) {
      toast.error("هذه الأداة مفقودة بالفعل ويجب على الإدارة إعادة إصدارها");
      return;
    }

    if (newStatus === "فقدان") {
      setPendingLossItemId(itemId);
      setPendingLossItemName(itemName);
      setShowLossConfirm(true);
    } else {
      setItemStatuses((prev) => ({ ...prev, [itemId]: newStatus }));
    }
  };

  const confirmLoss = () => {
    if (!pendingLossItemId) return;
    setItemStatuses((prev) => ({ ...prev, [pendingLossItemId]: "فقدان" }));
    setShowLossConfirm(false);
    setPendingLossItemId(null);
    setPendingLossItemName("");
  };

  useEffect(() => {
    if (open && currentStatus) {
      setStatus(currentStatus);
    } else if (open) {
      setStatus("حاضر");
    }
  }, [open, currentStatus]);

  useEffect(() => {
    if (open && student?.id && selectedDate) {
      fetchItemsAndSelections();
    }
  }, [open, student?.id, selectedDate]);

  const handleSubmit = async () => {
    if (!student?.id || !selectedDate || !teacherId) {
      toast.error("معلومات غير كاملة");
      return;
    }

    setLoading(true);

    try {
      // حساب نقاط الحضور من الإعدادات الديناميكية
      let statusPoints = 0;
      switch (status) {
        case "حاضر":
          statusPoints = attendancePoints.present ?? 1;
          break;
        case "غائب":
          statusPoints = attendancePoints.absent ?? -1;
          break;
        case "اعتذر":
          statusPoints = attendancePoints.excused ?? 0;
          break;
      }

      const attendanceData = {
        student_id: student.id,
        date: selectedDate,
        status: status,
        points: statusPoints,
        teacher_id: teacherId,
      };

      // فحص حالة الاتصال
      if (!navigator.onLine) {
        // وضع Offline - حفظ محلياً
        addToSyncQueue({
          type: 'attendance',
          data: attendanceData
        });

        saveLocalAttendance(attendanceData);

        toast.info("تم حفظ الحضور محلياً - سيتم المزامنة عند توفر الإنترنت");
        onSuccess?.();
        onOpenChange(false);
        setLoading(false);
        return;
      }

      const { error: attendanceError } = await supabase.rpc("set_attendance", {
        p_student_id: student.id,
        p_date: selectedDate,
        p_status: status,
        p_points: statusPoints,
      });

      if (attendanceError) throw attendanceError;

      // فحص الغياب المتتالي - fire and forget
      if (status === "غائب") {
        supabase.functions.invoke('check-consecutive-absences', {
          body: { studentId: student.id, date: selectedDate }
        }).catch(err => console.error('Error checking consecutive absences:', err));
      }

      // ✅ إذا لم يكن الطالب حاضراً، حذف سجلات تفقد الأدوات لهذا اليوم
      if (status !== "حاضر") {
        const { error: deleteCheckRecordsError } = await supabase
          .from("check_records")
          .delete()
          .eq("student_id", student.id)
          .eq("date", selectedDate);

        if (deleteCheckRecordsError) {
          console.error("Error deleting check records for non-present status:", deleteCheckRecordsError);
        }
      }

      if (status === "حاضر" && receivedTools.length > 0) {
        await supabase
          .from("check_records")
          .delete()
          .eq("student_id", student.id)
          .eq("date", selectedDate);

        for (const item of receivedTools) {
          const itemStatus = itemStatuses[item.id] || "موجود";
          const reissueData = toolReissues[item.id];
          const isLost = reissueData && reissueData.status === "lost" && !reissueData.reissued;

          let itemPoints = 0;

          // إذا كانت الأداة معطلة (مفقودة وبانتظار الإدارة)، لا يتم احتساب أي نقاط
          if (isLost) {
            itemPoints = 0;
          } else {
            switch (itemStatus) {
              case "موجود":
                itemPoints = item.points_brought || 0;
                break;
              case "غير موجود":
                itemPoints = item.points_not_brought || 0;
                break;
              case "تجاوز":
                itemPoints = item.points_skipped || 0;
                break;
              case "فقدان":
                itemPoints = item.points_lost || 0;
                break;
            }
          }

          const { error: recordError } = await supabase.from("check_records").insert({
            student_id: student.id,
            teacher_id: teacherId,
            item_id: item.id,
            date: selectedDate,
            status: itemStatus,
            points: itemPoints,
          });

          if (recordError) {
            console.error("Error inserting check record:", recordError);
            throw recordError;
          }

          if (itemStatus === "فقدان") {
            const existingReissue = toolReissues[item.id];
            const newCount = existingReissue ? existingReissue.count + 1 : 1;

            const { error: reissueError } = await (supabase
              .from("tool_reissues")
              .upsert({
                student_id: student.id,
                item_id: item.id,
                reissue_count: newCount,
                loss_date: selectedDate,
                last_reissue_date: selectedDate,
                status: "lost",
                reissued_by_admin: false,
              }, {
                onConflict: 'student_id,item_id'
              }) as any);

            if (reissueError) {
              console.error("Error upserting tool reissue:", reissueError);
              throw reissueError;
            }

            const { error: historyError } = await (supabase
              .from("tool_loss_history")
              .insert({
                student_id: student.id,
                item_id: item.id,
                event_type: "loss",
                event_date: selectedDate,
                handled_by: null, // سيتم ملء القيمة لاحقاً
                notes: `فقدان الأداة - المرة رقم ${newCount}`,
              }) as any);

            // تسجيل فقدان الأداة في السجل التاريخي
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const { data: userRole } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user?.id)
                .single();

              if (user && userRole) {
                // If supervisor or admin, use their user_id directly
                if (userRole.role === "supervisor" || userRole.role === "admin") {
                  await (supabase
                    .from("tool_loss_history")
                    .insert({ // Insert new history record
                      student_id: student.id,
                      item_id: item.id,
                      event_type: "loss",
                      event_date: selectedDate,
                      reissue_count: newCount,
                      handled_by: user.id
                    } as any));
                } else {
                  // For normal teachers, try to link via teacher record
                  const { data: teacherData } = await supabase
                    .from("teachers")
                    .select("user_id")
                    .eq("id", teacherId)
                    .single();

                  if (teacherData?.user_id) {
                    await (supabase
                      .from("tool_loss_history")
                      .insert({
                        student_id: student.id,
                        item_id: item.id,
                        event_type: "loss",
                        event_date: selectedDate,
                        reissue_count: newCount,
                        handled_by: teacherData.user_id
                      } as any));
                  }
                }
              }
            } catch (error) {
              console.error("Error creating tool loss history:", error);
            }

            const { error: notificationError } = await supabase
              .from("notifications")
              .insert({
                title: "فقدان أداة طالب",
                message: `الطالب ${student.student_name} فقد أداة: ${item.name} (المرة ${newCount})`,
                type: "alert",
                target_role: "admin",
                read: false,
              });

            if (notificationError) {
              console.error("Error creating notification:", notificationError);
            }

            // إرسال Push Notification للإدارة
            supabase.functions.invoke('send-push-notification', {
              body: {
                title: '🔧 فقدان أداة',
                body: `الطالب ${student.student_name} فقد أداة: ${item.name} (المرة ${newCount})`,
                tag: `tool-loss-${student.id}-${item.id}`,
                targetRoles: ['admin'],
                data: {
                  type: 'tool_loss',
                  studentId: student.id,
                  studentName: student.student_name,
                  itemName: item.name,
                  lossCount: newCount
                }
              }
            }).catch(err => console.error('Error sending push notification:', err));

            // Update local state immediately
            setToolReissues((prev) => ({
              ...prev,
              [item.id]: {
                count: newCount,
                status: "lost",
                reissued: false,
                lastDate: selectedDate,
              },
            }));

            toast.warning(`تم تسجيل فقدان ${item.name} وإرسال إشعار للإدارة`);
          }
        }
      }



      // ---------------------------------------------------------
      // ✅ التحقق التلقائي من فترة التجربة (Automated Status Update)
      // ---------------------------------------------------------
      if (status === "حاضر" && student.registration_status === "فترة تجربة") {
        try {
          // 1. حساب عدد أيام الحضور (شامل اليوم الحالي)
          // نستخدم count لتجنب جلب البيانات الكبيرة
          const { count: attendanceCount, error: countError } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id)
            .eq("status", "حاضر");

          if (!countError && (attendanceCount || 0) >= 6) {
            // 2. تحديث حالة الطالب إلى "مسجل"
            const { error: updateError } = await supabase
              .from("students")
              .update({
                registration_status: "مسجل",
                notes: (student.notes || "") + "\n* تم التثبيت تلقائياً بعد إتمام فترة التجربة (6 أيام حضور) *"
              })
              .eq("id", student.id);

            if (!updateError) {
              toast.success(`🎉 تم تثبيت الطالب ${student.student_name} رسمياً! (أكمل 6 أيام حضور)`);

              // 3. إرسال إشعارات

              // أ. إشعار للإدارة
              await supabase.from("notifications").insert({
                title: "تثبيت طالب جديد",
                message: `تم تحويل الطالب ${student.student_name} من فترة التجربة إلى مسجل بعد انضباطه في الحضور.`,
                type: "success",
                target_role: "admin",
                read: false,
              });

              // ب. إشعار للأستاذ
              const { data: teacherUser } = await supabase
                .from("teachers")
                .select("user_id")
                .eq("id", teacherId)
                .single();

              if (teacherUser?.user_id) {
                await supabase.from("notifications").insert({
                  title: "تثبيت طالب في حلقتك",
                  message: `مبارك! تم تثبيت الطالب ${student.student_name} في حلقتك رسمياً بعد انتهاء فترة التجربة.`,
                  type: "success",
                  target_user_id: teacherUser.user_id,
                  target_role: "teacher",
                  read: false,
                });
              }
            }
          }
        } catch (err) {
          console.error("Error in automated status update:", err);
          // لا نوقف العملية الأساسية بسبب خطأ في التحديث التلقائي
        }
      }
      // ---------------------------------------------------------

      toast.success("تم تسجيل الحضور وتفقد الأدوات بنجاح");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("حدث خطأ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسجيل حضور: {student?.student_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={status} onValueChange={setStatus}>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="حاضر" id="present" />
                <Label htmlFor="present" className="cursor-pointer">
                  حاضر ({attendancePoints.present >= 0 ? '+' : ''}{attendancePoints.present})
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="غائب" id="absent" />
                <Label htmlFor="absent" className="cursor-pointer">
                  غائب ({attendancePoints.absent >= 0 ? '+' : ''}{attendancePoints.absent})
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="اعتذر" id="excused" />
                <Label htmlFor="excused" className="cursor-pointer">
                  اعتذر ({attendancePoints.excused >= 0 ? '+' : ''}{attendancePoints.excused})
                </Label>
              </div>
            </RadioGroup>

            {status === "حاضر" && receivedTools.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">تفقد الأدوات</Label>
                  </div>

                  {loadingItems ? (
                    <div className="text-sm text-muted-foreground">جاري التحميل...</div>
                  ) : (
                    <div className="space-y-3">
                      {receivedTools.map((item) => {
                        const reissueData = toolReissues[item.id];
                        const isLost = reissueData && reissueData.status === "lost" && !reissueData.reissued;
                        const isReissued = reissueData && reissueData.reissued;

                        return (
                          <div
                            key={item.id}
                            className={`border rounded-lg p-3 space-y-2 ${isLost
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 opacity-75'
                              : isReissued
                                ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800'
                                : 'bg-card'
                              }`}
                          >
                            <div className="font-medium text-sm flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                {item.name}
                                {isLost && (
                                  <Badge variant="destructive" className="text-xs">
                                    مفقودة - بانتظار الإدارة
                                  </Badge>
                                )}
                                {isReissued && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                                    تم الإعادة ({reissueData.count})
                                  </Badge>
                                )}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {itemStatuses[item.id] || "موجود"}
                              </Badge>
                            </div>
                            {isLost && (
                              <p className="text-xs text-muted-foreground">
                                تاريخ الفقدان: {new Date(reissueData.lastDate).toLocaleDateString("ar-SA")}
                              </p>
                            )}
                            {isReissued && (
                              <p className="text-xs text-muted-foreground">
                                تم إعادة الإصدار في: {new Date(reissueData.lastDate).toLocaleDateString("ar-SA")}
                              </p>
                            )}
                            <RadioGroup
                              value={itemStatuses[item.id] || "موجود"}
                              onValueChange={(value) => setItemStatus(item.id, item.name, value)}
                              className="grid grid-cols-2 gap-2"
                              disabled={isLost}
                            >
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="موجود" id={`${item.id}-present`} disabled={isLost} />
                                <Label
                                  htmlFor={`${item.id}-present`}
                                  className={`text-sm ${isLost ? 'opacity-50' : 'cursor-pointer text-green-600 dark:text-green-400'}`}
                                >
                                  أحضره (+{item.points_brought || 0})
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="غير موجود" id={`${item.id}-absent`} disabled={isLost} />
                                <Label
                                  htmlFor={`${item.id}-absent`}
                                  className={`text-sm ${isLost ? 'opacity-50' : 'cursor-pointer text-orange-600 dark:text-orange-400'}`}
                                >
                                  لم يحضره ({item.points_not_brought || 0})
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="تجاوز" id={`${item.id}-skip`} disabled={isLost} />
                                <Label
                                  htmlFor={`${item.id}-skip`}
                                  className={`text-sm ${isLost ? 'opacity-50' : 'cursor-pointer text-muted-foreground'}`}
                                >
                                  تجاوز ({item.points_skipped || 0})
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="فقدان" id={`${item.id}-lost`} disabled={isLost} />
                                <Label
                                  htmlFor={`${item.id}-lost`}
                                  className={`text-sm ${isLost ? 'opacity-50' : 'cursor-pointer text-red-600 dark:text-red-400'}`}
                                >
                                  فقدان ({item.points_lost || 0})
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showLossConfirm} onOpenChange={setShowLossConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              تأكيد فقدان الأداة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>أنت على وشك تسجيل فقدان الأداة: <strong>{pendingLossItemName}</strong></p>
              <p className="text-destructive font-medium">سيتم:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>تعطيل هذه الأداة من سجل الطالب</li>
                <li>إرسال إشعار للإدارة بالفقدان</li>
                <li>خصم النقاط المحددة للفقدان</li>
              </ul>
              <p className="text-muted-foreground text-sm mt-3">
                عند إعطاء الطالب الأداة مرة أخرى من الإدارة، سيتم وضع علامة صفراء بجانبها.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowLossConfirm(false);
              setPendingLossItemId(null);
              setPendingLossItemName("");
            }}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoss} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              تأكيد الفقدان
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AttendanceDialog;
