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
import { Printer, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface Student {
  id: string;
  student_name: string;
  current_teacher: string;
  mosque_name: string;
  grade: string;
  phone: string;
  student_tools: string[];
}

const StudentToolsReport = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<string[]>([]);
  
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
    
    if (role !== "admin" && role !== "teacher") {
      toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      navigate("/login");
      return;
    }

    setUser(parsedUser);
    fetchStudents(parsedUser);
  }, [navigate]);

  const fetchStudents = async (userData: any) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("students")
        .select("*");

      // إذا كان أستاذ، عرض طلابه فقط
      if (userData.role === "teacher") {
        const { data: teacherData } = await supabase
          .from("teachers")
          .select(`id, "اسم الاستاذ"`)
          .eq("user_id", userData.id)
          .maybeSingle();

        if (teacherData && (teacherData as any).id) {
          query = query.eq("teacher_id", (teacherData as any).id);
        }
      }

      const { data, error } = await query.order("student_name");

      if (error) throw error;

      // فلترة الطلاب الذين لديهم أدوات
      const studentsWithTools = (data || []).filter((s: any) => 
        s.student_tools && Array.isArray(s.student_tools) && s.student_tools.length > 0
      );

      setStudents(studentsWithTools);
      setFilteredStudents(studentsWithTools);

      // استخراج قائمة الأساتذة
      const uniqueTeachers = [...new Set(studentsWithTools.map((s: any) => s.current_teacher).filter(Boolean))];
      setTeachers(uniqueTeachers as string[]);

    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("حدث خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
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
      filtered = filtered.filter(s => 
        s.student_tools.some(tool => 
          tool.toLowerCase().includes(filters.tool.toLowerCase())
        )
      );
    }

    setFilteredStudents(filtered);
  }, [filters, students]);

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setFilters({
      student: "",
      teacher: "",
      tool: "",
    });
  };

  const allTools = [...new Set(students.flatMap((s: any) => s.student_tools || []))].sort();

  return (
    <DashboardLayout 
      title="تقرير أدوات الطلاب" 
      userName={user?.name}
      role={user?.role}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">تقرير أدوات الطلاب</h1>
            <p className="text-muted-foreground">عرض وطباعة تقرير شامل لأدوات الطلاب</p>
          </div>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 ml-2" />
            طباعة
          </Button>
        </div>

        {/* البحث والفلترة */}
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student">بحث حسب اسم الطالب</Label>
                <Input
                  id="student"
                  value={filters.student}
                  onChange={(e) => setFilters({ ...filters, student: e.target.value })}
                  placeholder="ابحث عن طالب..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher">بحث حسب الأستاذ</Label>
                <Select value={filters.teacher} onValueChange={(value) => setFilters({ ...filters, teacher: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر أستاذ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher} value={teacher}>
                        {teacher}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tool">بحث حسب الأداة</Label>
                <Select value={filters.tool} onValueChange={(value) => setFilters({ ...filters, tool: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر أداة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الكل</SelectItem>
                    {allTools.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(filters.student || filters.teacher || filters.tool) && (
              <div className="flex justify-end mt-4">
                <Button onClick={clearFilters} variant="ghost" size="sm">
                  <X className="w-4 h-4 ml-2" />
                  مسح الفلاتر
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* الجدول */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا يوجد طلاب بالأدوات المحددة</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم الطالب</TableHead>
                    <TableHead className="text-right">الأستاذ</TableHead>
                    <TableHead className="text-right">المسجد</TableHead>
                    <TableHead className="text-right">الصف</TableHead>
                    <TableHead className="text-right">الأدوات</TableHead>
                    <TableHead className="text-right print:hidden">رقم الهاتف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student: any) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.student_name}</TableCell>
                      <TableCell>{student.current_teacher || "غير محدد"}</TableCell>
                      <TableCell>{student.mosque_name || "غير محدد"}</TableCell>
                      <TableCell>{student.grade || "غير محدد"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(student.student_tools || []).map((tool: string, index: number) => (
                            <span
                              key={index}
                              className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="print:hidden">{student.phone || "غير متوفر"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* إحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{filteredStudents.length}</div>
                <div className="text-sm text-muted-foreground">عدد الطلاب</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{allTools.length}</div>
                <div className="text-sm text-muted-foreground">أنواع الأدوات</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {filteredStudents.reduce((sum: number, s: any) => sum + (s.student_tools?.length || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">إجمالي الأدوات</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .space-y-6 {
            display: block !important;
          }
          .space-y-6 > * {
            visibility: visible;
            page-break-inside: avoid;
          }
          table {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default StudentToolsReport;
