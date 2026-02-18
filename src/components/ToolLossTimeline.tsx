import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  event_type: "loss" | "reissue";
  event_date: string;
  event_time: string;
  handled_by: string;
  handler_name: string;
  notes?: string;
}

interface ToolLossTimelineProps {
  studentId: string;
  itemId: string;
}

const ToolLossTimeline = ({ studentId, itemId }: ToolLossTimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [itemName, setItemName] = useState("");

  useEffect(() => {
    if (studentId && itemId) {
      fetchTimeline();
    }
  }, [studentId, itemId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from("tool_loss_history")
        .select("*")
        .eq("student_id", studentId)
        .eq("item_id", itemId)
        .order("event_time", { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch student name
      const { data: studentData } = await supabase
        .from("students")
        .select("student_name")
        .eq("id", studentId)
        .single();

      // Fetch item name
      const { data: itemData } = await supabase
        .from("check_items")
        .select("name")
        .eq("id", itemId)
        .single();

      if (studentData) setStudentName(studentData.student_name);
      if (itemData) setItemName(itemData.name);

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        return;
      }

      // Get handler names
      const handlerIds = [...new Set(eventsData.map(e => e.handled_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", handlerIds);

      const { data: teachers } = await supabase
        .from("teachers")
        .select(`user_id, "اسم الاستاذ"`)
        .in("user_id", handlerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      const teacherMap = new Map(teachers?.map((t: any) => [t.user_id, t["اسم الاستاذ"]]) || []);

      const enrichedEvents: TimelineEvent[] = eventsData.map((event: any) => ({
        ...event,
        handler_name: teacherMap.get(event.handled_by) || profileMap.get(event.handled_by) || "غير معروف",
      }));

      setEvents(enrichedEvents);
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        لا توجد أحداث مسجلة لهذه الأداة
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted rounded-lg p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">الطالب</p>
          <p className="font-medium">{studentName}</p>
        </div>
        <Separator className="my-2" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">الأداة</p>
          <p className="font-medium">{itemName}</p>
        </div>
        <Separator className="my-2" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">إجمالي الأحداث</p>
          <p className="font-medium">{events.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          السجل الزمني
        </h3>
        
        <div className="relative space-y-6">
          {/* Timeline line */}
          <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-border" />

          {events.map((event, index) => (
            <div key={event.id} className="relative pr-12">
              {/* Timeline dot */}
              <div className={`absolute right-[11px] top-1 w-6 h-6 rounded-full border-4 border-background ${
                event.event_type === "loss" 
                  ? "bg-destructive" 
                  : "bg-green-600"
              }`}>
                {event.event_type === "loss" ? (
                  <AlertTriangle className="w-3 h-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: 14, height: 14 }} />
                ) : (
                  <CheckCircle className="w-3 h-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: 14, height: 14 }} />
                )}
              </div>

              <div className={`rounded-lg p-4 ${
                event.event_type === "loss"
                  ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                  : "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={event.event_type === "loss" ? "destructive" : "outline"} className={
                        event.event_type === "reissue" ? "bg-green-100 text-green-700 border-green-200" : ""
                      }>
                        {event.event_type === "loss" ? "فقدان" : "إعادة إصدار"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {index === 0 && "الأحدث"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">التاريخ:</span>
                        <span>
                          {format(new Date(event.event_date), "EEEE", { locale: ar })} {new Date(event.event_date).toLocaleDateString("en-GB")}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(event.event_time).toLocaleTimeString("ar-SA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {event.event_type === "loss" ? "سجله:" : "أعاده:"}
                        </span>
                        <span>{event.handler_name}</span>
                      </div>

                      {event.notes && (
                        <div className="mt-2 pt-2 border-t border-current/10">
                          <p className="text-sm">
                            <span className="font-medium">ملاحظات: </span>
                            {event.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ToolLossTimeline;
