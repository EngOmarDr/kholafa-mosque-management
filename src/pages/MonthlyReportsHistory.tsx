import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

interface MonthlyReport {
  id: string;
  month: string;
  user_id: string;
  user_role: string;
  report_type: string;
  report_url: string | null;
  data: any;
  created_at: string;
}

export default function MonthlyReportsHistory() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setUserRole(profile?.role || "");

      let query = supabase
        .from("monthly_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (profile?.role !== "admin") {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("حدث خطأ في جلب التقارير");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (reportUrl: string, month: string) => {
    try {
      toast.info("جاري تحميل التقرير...");
      
      const { data, error } = await supabase.storage
        .from("monthly-reports")
        .download(reportUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("تم تحميل التقرير بنجاح");
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("حدث خطأ في تحميل التقرير");
    }
  };

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy", { locale: ar });
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      admin: "default",
      teacher: "secondary",
    };
    const labels: Record<string, string> = {
      admin: "أدمن",
      teacher: "أستاذ",
    };
    return <Badge variant={variants[role] || "outline"}>{labels[role] || role}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
          <h1 className="text-3xl font-bold">التقارير الشهرية</h1>
          <p className="text-muted-foreground mt-1">عرض وتحميل التقارير الشهرية السابقة</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              سجل التقارير
            </CardTitle>
            <CardDescription>جميع التقارير الشهرية المُنشأة تلقائياً</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد تقارير شهرية حتى الآن</p>
                <p className="text-sm text-muted-foreground mt-2">
                  سيتم إنشاء التقارير تلقائياً في أول كل شهر
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Calendar className="h-4 w-4 inline ml-2" />
                      الشهر
                    </TableHead>
                    {userRole === "admin" && (
                      <TableHead>
                        <User className="h-4 w-4 inline ml-2" />
                        الصلاحية
                      </TableHead>
                    )}
                    <TableHead>النوع</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{getMonthName(report.month)}</TableCell>
                      {userRole === "admin" && (
                        <TableCell>{getRoleBadge(report.user_role)}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline">{report.report_type === "monthly" ? "شهري" : "مخصص"}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(report.created_at), "PPP", { locale: ar })}</TableCell>
                      <TableCell>
                        {report.report_url ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadReport(report.report_url!, report.month)}
                          >
                            <Download className="h-4 w-4 ml-2" />
                            تحميل
                          </Button>
                        ) : (
                          <Badge variant="secondary">قيد الإنشاء</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
