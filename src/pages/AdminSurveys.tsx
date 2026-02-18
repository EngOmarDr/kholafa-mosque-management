import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ClipboardList, Plus, Search, Filter, BarChart3,
    Edit, Trash2, Eye, Play, Pause, Archive,
    Loader2, RefreshCw, Calendar, Users, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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

interface Survey {
    id: string;
    title: string;
    description: string | null;
    status: 'draft' | 'active' | 'closed' | 'archived';
    is_anonymous: boolean;
    is_required: boolean;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    questions_count?: number;
    responses_count?: number;
}

const AdminSurveys = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [surveyToDelete, setSurveyToDelete] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem("jeelUser");
        if (!userData) {
            navigate("/login");
            return;
        }
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== "admin") {
            toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
            navigate("/login");
            return;
        }
        setUser(parsedUser);
        fetchSurveys();
    }, [navigate]);

    const fetchSurveys = async () => {
        setLoading(true);
        try {
            const { data: surveysData, error: surveysError } = await supabase
                .from('surveys')
                .select('*')
                .order('created_at', { ascending: false });

            if (surveysError) throw surveysError;

            // جلب عدد الأسئلة والردود لكل استبيان
            const surveysWithCounts = await Promise.all(
                (surveysData || []).map(async (survey) => {
                    const [questionsRes, responsesRes] = await Promise.all([
                        supabase
                            .from('survey_questions')
                            .select('id', { count: 'exact', head: true })
                            .eq('survey_id', survey.id),
                        supabase
                            .from('survey_submissions')
                            .select('id', { count: 'exact', head: true })
                            .eq('survey_id', survey.id)
                            .eq('status', 'completed')
                    ]);

                    return {
                        ...survey,
                        questions_count: questionsRes.count || 0,
                        responses_count: responsesRes.count || 0
                    } as Survey;
                })
            );

            setSurveys(surveysWithCounts as Survey[]);
        } catch (error) {
            console.error('Error fetching surveys:', error);
            toast.error('حدث خطأ في تحميل الاستبيانات');
        } finally {
            setLoading(false);
        }
    };

    const updateSurveyStatus = async (surveyId: string, newStatus: string) => {
        setActionLoading(surveyId);
        try {
            const { error } = await supabase
                .from('surveys')
                .update({ status: newStatus })
                .eq('id', surveyId);

            if (error) throw error;

            // إضافة سجل النشاط
            await supabase.from('survey_activity_logs').insert({
                survey_id: surveyId,
                action: newStatus === 'active' ? 'published' : newStatus,
                performed_by: user?.id,
                details: { new_status: newStatus }
            });

            // إرسال إشعار للأساتذة عند تفعيل الاستبيان
            if (newStatus === 'active') {
                const survey = surveys.find(s => s.id === surveyId);
                if (survey) {
                    await supabase.from('notifications').insert({
                        title: 'استبيان جديد متاح',
                        message: `يرجى المشاركة في الاستبيان: ${survey.title}`,
                        type: 'info',
                        target_role: 'teacher',
                        read: false
                    });
                }
            }

            toast.success(getStatusChangeMessage(newStatus));
            fetchSurveys();
        } catch (error) {
            console.error('Error updating survey status:', error);
            toast.error('حدث خطأ في تحديث حالة الاستبيان');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusChangeMessage = (status: string) => {
        switch (status) {
            case 'active': return 'تم تفعيل الاستبيان وإرسال إشعار للأساتذة';
            case 'closed': return 'تم إغلاق الاستبيان';
            case 'archived': return 'تم أرشفة الاستبيان';
            default: return 'تم تحديث حالة الاستبيان';
        }
    };

    const deleteSurvey = async () => {
        if (!surveyToDelete) return;

        setActionLoading(surveyToDelete);
        try {
            const { error } = await supabase
                .from('surveys')
                .delete()
                .eq('id', surveyToDelete);

            if (error) throw error;

            toast.success('تم حذف الاستبيان بنجاح');
            setSurveys(prev => prev.filter(s => s.id !== surveyToDelete));
        } catch (error) {
            console.error('Error deleting survey:', error);
            toast.error('حدث خطأ في حذف الاستبيان');
        } finally {
            setActionLoading(null);
            setDeleteDialogOpen(false);
            setSurveyToDelete(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <Badge variant="secondary" className="bg-gray-100 text-gray-700">مسودة</Badge>;
            case 'active':
                return <Badge className="bg-emerald-100 text-emerald-700">نشط</Badge>;
            case 'closed':
                return <Badge variant="outline" className="border-amber-300 text-amber-700">مغلق</Badge>;
            case 'archived':
                return <Badge variant="outline" className="border-gray-300 text-gray-500">مؤرشف</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const filteredSurveys = surveys.filter(survey => {
        const matchesSearch = survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (survey.description?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === "all" || survey.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: surveys.length,
        active: surveys.filter(s => s.status === 'active').length,
        draft: surveys.filter(s => s.status === 'draft').length,
        closed: surveys.filter(s => s.status === 'closed').length,
        totalResponses: surveys.reduce((acc, s) => acc + (s.responses_count || 0), 0)
    };

    return (
        <DashboardLayout title="إدارة الاستبيانات" userName={user?.name}>
            <div className="space-y-6 animate-fade-in">
                {/* الإحصائيات */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/20">
                                    <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي الاستبيانات</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/20">
                                    <Play className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.active}</p>
                                    <p className="text-xs text-muted-foreground">نشط</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-gray-500/10 to-gray-500/5">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-500/20">
                                    <Edit className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.draft}</p>
                                    <p className="text-xs text-muted-foreground">مسودة</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/20">
                                    <Pause className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.closed}</p>
                                    <p className="text-xs text-muted-foreground">مغلق</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/20">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.totalResponses}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي الردود</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* شريط الأدوات */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex flex-1 gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث في الاستبيانات..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-32">
                                <Filter className="w-4 h-4 ml-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="draft">مسودة</SelectItem>
                                <SelectItem value="active">نشط</SelectItem>
                                <SelectItem value="closed">مغلق</SelectItem>
                                <SelectItem value="archived">مؤرشف</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchSurveys}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => navigate('/admin/surveys/new')} className="gap-2">
                            <Plus className="w-4 h-4" />
                            إنشاء استبيان جديد
                        </Button>
                    </div>
                </div>

                {/* قائمة الاستبيانات */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-primary" />
                            الاستبيانات ({filteredSurveys.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : filteredSurveys.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>لا توجد استبيانات</p>
                                <Button
                                    variant="link"
                                    onClick={() => navigate('/admin/surveys/new')}
                                    className="mt-2"
                                >
                                    إنشاء استبيان جديد
                                </Button>
                            </div>
                        ) : (
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-3">
                                    {filteredSurveys.map((survey) => (
                                        <div
                                            key={survey.id}
                                            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h3 className="font-semibold text-base truncate">{survey.title}</h3>
                                                        {getStatusBadge(survey.status)}
                                                        {survey.is_required && (
                                                            <Badge variant="outline" className="text-xs border-red-300 text-red-600">إلزامي</Badge>
                                                        )}
                                                        {survey.is_anonymous && (
                                                            <Badge variant="outline" className="text-xs">مجهول</Badge>
                                                        )}
                                                    </div>
                                                    {survey.description && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                            {survey.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(survey.created_at), 'PPP', { locale: ar })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <ClipboardList className="w-3 h-3" />
                                                            {survey.questions_count} سؤال
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {survey.responses_count} رد
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {/* أزرار الإجراءات حسب الحالة */}
                                                    {survey.status === 'draft' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                            onClick={() => updateSurveyStatus(survey.id, 'active')}
                                                            disabled={actionLoading === survey.id}
                                                            title="تفعيل الاستبيان"
                                                        >
                                                            {actionLoading === survey.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Play className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    )}

                                                    {survey.status === 'active' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                            onClick={() => updateSurveyStatus(survey.id, 'closed')}
                                                            disabled={actionLoading === survey.id}
                                                            title="إغلاق الاستبيان"
                                                        >
                                                            {actionLoading === survey.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Pause className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    )}

                                                    {survey.status === 'closed' && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                onClick={() => updateSurveyStatus(survey.id, 'active')}
                                                                disabled={actionLoading === survey.id}
                                                                title="إعادة نشر الاستبيان"
                                                            >
                                                                {actionLoading === survey.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Play className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                                                onClick={() => updateSurveyStatus(survey.id, 'archived')}
                                                                disabled={actionLoading === survey.id}
                                                                title="أرشفة الاستبيان"
                                                            >
                                                                {actionLoading === survey.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Archive className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                                                        title="عرض التحليلات"
                                                    >
                                                        <BarChart3 className="w-4 h-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => navigate(`/admin/surveys/${survey.id}`)}
                                                        title="تعديل الاستبيان"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            setSurveyToDelete(survey.id);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                        title="حذف الاستبيان"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* نافذة تأكيد الحذف */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من حذف هذا الاستبيان؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف الاستبيان مع جميع الأسئلة والإجابات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={deleteSurvey}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default AdminSurveys;
