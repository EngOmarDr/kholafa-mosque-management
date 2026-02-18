import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Mosque {
  id: string;
  "اسم المسجد": string;
  created_at: string;
}

const MosquesManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMosque, setEditingMosque] = useState<Mosque | null>(null);
  const [formData, setFormData] = useState({
    "اسم المسجد": "",
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
      navigate("/admin");
      return;
    }

    setUser(parsedUser);
    fetchMosques();
  }, [navigate]);

  const fetchMosques = async () => {
    try {
      const { data, error } = await supabase
        .from("mosques")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMosques(data || []);
    } catch (error) {
      console.error("Error fetching mosques:", error);
      toast.error("حدث خطأ في تحميل المساجد");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (mosque?: Mosque) => {
    if (mosque) {
      setEditingMosque(mosque);
      setFormData({
        "اسم المسجد": mosque["اسم المسجد"],
      });
    } else {
      setEditingMosque(null);
      setFormData({ "اسم المسجد": "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData["اسم المسجد"].trim()) {
      toast.error("يرجى إدخال اسم المسجد");
      return;
    }

    try {
      if (editingMosque) {
        // تحديث
        const { error } = await supabase
          .from("mosques")
          .update({
            "اسم المسجد": formData["اسم المسجد"],
          })
          .eq("id", editingMosque.id);

        if (error) throw error;
        toast.success("تم تحديث المسجد بنجاح");
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from("mosques")
          .insert({
            "اسم المسجد": formData["اسم المسجد"],
          });

        if (error) throw error;
        toast.success("تمت إضافة المسجد بنجاح");
      }

      setDialogOpen(false);
      fetchMosques();
    } catch (error: any) {
      console.error("Error saving mosque:", error);
      if (error.code === "23505") {
        toast.error("اسم المسجد موجود مسبقاً");
      } else {
        toast.error("حدث خطأ أثناء الحفظ");
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المسجد "${name}"؟`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("mosques")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("تم حذف المسجد بنجاح");
      fetchMosques();
    } catch (error) {
      console.error("Error deleting mosque:", error);
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout 
      title="إدارة المساجد" 
      userName={user?.name}
      showBackButton
      backPath="/admin"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">إدارة المساجد</h2>
            <p className="text-muted-foreground mt-1">
              عرض وإدارة قائمة المساجد في النظام
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" onClick={() => handleOpenDialog()}>
                <Plus className="w-5 h-5 ml-2" />
                إضافة مسجد جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMosque ? "تعديل المسجد" : "إضافة مسجد جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mosque_name">اسم المسجد *</Label>
                  <Input
                    id="mosque_name"
                    value={formData["اسم المسجد"]}
                    onChange={(e) =>
                      setFormData({ ...formData, "اسم المسجد": e.target.value })
                    }
                    placeholder="أدخل اسم المسجد"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 btn-primary">
                    {editingMosque ? "تحديث" : "إضافة"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mosques Table */}
        <div className="stats-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم المسجد</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mosques.map((mosque) => (
                  <TableRow key={mosque.id}>
                    <TableCell className="font-semibold">
                      {mosque["اسم المسجد"]}
                    </TableCell>
                    <TableCell>
                      {new Date(mosque.created_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenDialog(mosque)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(mosque.id, mosque["اسم المسجد"])}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {mosques.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">لا توجد مساجد مسجلة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MosquesManagement;
