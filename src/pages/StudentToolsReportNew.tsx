import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Printer, Search, X, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CheckItem {
  id: string;
  name: string;
}

interface Student {
  id: string;
  student_name: string;
  current_teacher: string;
  mosque_name: string;
  grade: string;
  phone: string;
  received_tools: string[];
}

interface ToolPoints {
  studentId: string;
  toolId: string;
  totalPoints: number;
}

const StudentToolsReportNew = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [toolPoints, setToolPoints] = useState<ToolPoints[]>([]);
  
  const [filters, setFilters] = useState({
    student: "",
    teacher: "",
    tool: "",
  });

  useEffect(() => {
    const userData = localStorage.getItem("jeelUser");
    if (!userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    const role = parsedUser.role;
    
    if (role !== "admin") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }

    setUser(parsedUser);
    fetchData(parsedUser);
  }, [navigate]);

  const fetchData = async (userData: any) => {
    try {
      setLoading(true);
      
      // جلب الأدوات
      const { data: itemsData, error: itemsError } = await supabase
        .from("check_items")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (itemsError) throw itemsError;
      setCheckItems(itemsData || []);

      // جلب الطلاب
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .order("student_name");

      if (studentsError) throw studentsError;

      // فلترة الطلاب الذين لديهم أدوات مستلمة
      const studentsWithTools = (studentsData || []).filter((s: any) => 
        s.received_tools && Array.isArray(s.received_tools) && s.received_tools.length > 0
      );

      setStudents(studentsWithTools);
      setFilteredStudents(studentsWithTools);

      // استخراج قائمة الأساتذة
      const uniqueTeachers = [...new Set(studentsWithTools.map((s: any) => s.current_teacher).filter(Boolean))];
      setTeachers(uniqueTeachers as string[]);

      // جلب نقاط الأدوات
      await fetchToolPoints(studentsWithTools.map((s: any) => s.id));

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const fetchToolPoints = async (studentIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from("check_records")
        .select("student_id, item_id, points")
        .in("student_id", studentIds);

      if (error) throw error;

      // حساب مجموع النقاط لكل طالب ولكل أداة
      const pointsMap: Record<string, number> = {};
      (data || []).forEach((record: any) => {
        const key = `${record.student_id}_${record.item_id}`;
        pointsMap[key] = (pointsMap[key] || 0) + (record.points || 0);
      });

      const points: ToolPoints[] = Object.entries(pointsMap).map(([key, totalPoints]) => {
        const [studentId, toolId] = key.split("_");
        return { studentId, toolId, totalPoints };
      });

      setToolPoints(points);
    } catch (error) {
      console.error("Error fetching tool points:", error);
    }
  };

  useEffect(() => {
    let filtered = students;

    if (filters.student) {
      filtered = filtered.filter(s => 
        s.student_name.toLowerCase().includes(filters.student.toLowerCase())
      );
    }

    if (filters.teacher) {
      filtered = filtered.filter(s => s.current_teacher === filters.teacher);
    }

    if (filters.tool) {
      const selectedTool = checkItems.find(item => item.name === filters.tool);
      if (selectedTool) {
        filtered = filtered.filter(s => 
          s.received_tools.includes(selectedTool.id)
        );
      }
    }

    setFilteredStudents(filtered);
  }, [filters, students, checkItems]);

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setFilters({ student: "", teacher: "", tool: "" });
  };

  const getToolPoints = (studentId: string, toolId: string): number => {
    const record = toolPoints.find(tp => tp.studentId === studentId && tp.toolId === toolId);
    return record?.totalPoints || 0;
  };

  const getTotalToolsPoints = (studentId: string): number => {
    return toolPoints
      .filter(tp => tp.studentId === studentId)
      .reduce((sum, tp) => sum + tp.totalPoints, 0);
  };

  const allTools = checkItems;

  return (
    <DashboardLayout title="تقرير أدوات الطلاب">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">تقرير أدوات الطلاب الشامل</h1>
          </div>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 ml-2" />
            طباعة التقرير
          </Button>
        </div>

        {/* Filters */}
        <Card className="no-print">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* بحث باسم الطالب */}
              <div className="space-y-2">
                <Label htmlFor="student-search">بحث باسم الطالب</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="student-search"
                    placeholder="اكتب اسم الطالب"
                    value={filters.student}
                    onChange={(e) => setFilters({ ...filters, student: e.target.value })}
                    className="pr-10"
                  />
                </div>
              </div>

              {/* تصفية حسب الأستاذ */}
              <div className="space-y-2">
                <Label htmlFor="teacher-filter">تصفية حسب الأستاذ</Label>
                <Select
                  value={filters.teacher}
                  onValueChange={(value) => setFilters({ ...filters, teacher: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الأساتذة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">جميع الأساتذة</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher} value={teacher}>
                        {teacher}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* تصفية حسب الأداة */}
              <div className="space-y-2">
                <Label htmlFor="tool-filter">تصفية حسب الأداة</Label>
                <Select
                  value={filters.tool}
                  onValueChange={(value) => setFilters({ ...filters, tool: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الأدوات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">جميع الأدوات</SelectItem>
                    {allTools.map((tool) => (
                      <SelectItem key={tool.id} value={tool.name}>
                        {tool.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* زر إعادة تعيين */}
              <div className="space-y-2 flex items-end">
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="w-full"
                >
                  <X className="w-4 h-4 ml-2" />
                  إعادة تعيين
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">لا توجد بيانات لعرضها</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right font-bold">اسم الطالب</TableHead>
                    <TableHead className="text-right font-bold">اسم الأستاذ</TableHead>
                    <TableHead className="text-right font-bold">المسجد</TableHead>
                    <TableHead className="text-right font-bold">الصف</TableHead>
                    <TableHead className="text-right font-bold">الأدوات المستلمة</TableHead>
                    <TableHead className="text-right font-bold">نقاط الأدوات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.student_name}</TableCell>
                      <TableCell>{student.current_teacher || "-"}</TableCell>
                      <TableCell>{student.mosque_name || "-"}</TableCell>
                      <TableCell>{student.grade || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {student.received_tools.map((toolId) => {
                            const tool = checkItems.find(item => item.id === toolId);
                            if (!tool) return null;
                            const points = getToolPoints(student.id, toolId);
                            return (
                              <Badge key={toolId} variant="secondary" className="gap-1">
                                {tool.name}
                                {points !== 0 && (
                                  <span className={points > 0 ? "text-green-600" : "text-red-600"}>
                                    ({points > 0 ? '+' : ''}{points})
                                  </span>
                                )}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getTotalToolsPoints(student.id) >= 0 ? "default" : "destructive"}
                          className="text-base font-bold"
                        >
                          {getTotalToolsPoints(student.id)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">عدد الطلاب</p>
                    <p className="text-2xl font-bold text-primary">{filteredStudents.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">أنواع الأدوات</p>
                    <p className="text-2xl font-bold text-primary">{allTools.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">مجموع الأدوات المستلمة</p>
                    <p className="text-2xl font-bold text-primary">
                      {filteredStudents.reduce((sum, s) => sum + s.received_tools.length, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .rounded-md {
            border: 1px solid #ddd;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default StudentToolsReportNew;
