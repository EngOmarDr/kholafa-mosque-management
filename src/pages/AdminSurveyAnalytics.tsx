import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    BarChart3, PieChart, TrendingUp, Users, CheckCircle2, Clock,
    ArrowRight, Download, RefreshCw, Loader2, Calendar, User,
    MessageSquare, Star, Hash, ToggleLeft, FileText
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";

interface Survey {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    is_anonymous: boolean;
    scoring_type?: 'manual_points' | 'required_questions';
}

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: { id: string; text: string }[] | null;
    order_index: number;
}

interface Submission {
    id: string;
    survey_id: string;
    teacher_id: string;
    teacher_name: string;
    submitted_at: string;
    score_raw: number;
    score_max: number;
    score_percentage: number;
    responses: {
        question_id: string;
        response_value: any;
    }[];
}

interface AnalyticsData {
    totalResponses: number;
    completionRate: number;
    averageRating: number;
    responsesByMonth: { month: string; count: number }[];
    questionStats: {
        question_id: string;
        question_text: string;
        question_type: string;
        responses: any[];
        stats: any;
    }[];
}

const AdminSurveyAnalytics = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
    const [selectedTeacherMonth, setSelectedTeacherMonth] = useState<string>("all");
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

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
        fetchData();
    }, [navigate, id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // جلب بيانات الاستبيان
            const { data: surveyData, error: surveyError } = await supabase
                .from('surveys')
                .select('*')
                .eq('id', id)
                .single();

            if (surveyError) throw surveyError;
            setSurvey(surveyData as any);

            // جلب الأسئلة
            const { data: questionsData, error: questionsError } = await supabase
                .from('survey_questions')
                .select('*')
                .eq('survey_id', id)
                .order('order_index');

            if (questionsError) throw questionsError;
            const typedQuestions = (questionsData || []).map(q => ({
                ...q,
                options: (q.options as { id: string; text: string }[]) || null
            })) as Question[];
            setQuestions(typedQuestions);

            // جلب التقديمات مع الإجابات
            const { data: submissionsData, error: submissionsError } = (await supabase
                .from('survey_submissions')
                .select(`
                    id,
                    survey_id,
                    teacher_id,
                    submitted_at,
                    score_raw,
                    score_max,
                    score_percentage,
                    survey_responses(
                        question_id,
                        response_value
                    )
                `)
                .eq('survey_id', id)
                .eq('status', 'completed')) as { data: any[]; error: any };

            if (submissionsError) throw submissionsError;

            // جلب أسماء الأساتذة
            const teacherIds = [...new Set((submissionsData || []).map(s => s.teacher_id).filter(Boolean))];
            let teacherNames: { [key: string]: string } = {};

            if (teacherIds.length > 0) {
                const { data: teachersData } = await supabase
                    .from('teachers')
                    .select('id, "اسم الاستاذ"')
                    .in('id', teacherIds);

                teacherNames = (teachersData || []).reduce((acc, t) => {
                    acc[t.id] = t["اسم الاستاذ"];
                    return acc;
                }, {} as { [key: string]: string });

                setTeachers((teachersData || []).map(t => ({
                    id: t.id,
                    name: t["اسم الاستاذ"]
                })));
            }

            // جلب إجمالي عدد الأساتذة لحساب نسبة الإنجاز
            const { count: totalTeachersCount } = await supabase
                .from('teachers')
                .select('id', { count: 'exact', head: true });

            const formattedSubmissions: Submission[] = (submissionsData || []).map(s => ({
                id: s.id,
                survey_id: s.survey_id,
                teacher_id: s.teacher_id,
                submitted_at: s.submitted_at,
                teacher_name: surveyData?.is_anonymous ? 'مشارك مجهول' : (teacherNames[s.teacher_id] || 'غير معروف'),
                score_raw: s.score_raw || 0,
                score_max: s.score_max || 0,
                score_percentage: s.score_percentage || 0,
                responses: s.survey_responses || []
            }));

            setSubmissions(formattedSubmissions.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()));
            calculateAnalytics(formattedSubmissions, typedQuestions, totalTeachersCount || 0);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('حدث خطأ في تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const calculateAnalytics = (subs: Submission[], qs: Question[], totalTeachers: number) => {
        const totalResponses = subs.length;
        const monthlyData: { [key: string]: number } = {};
        subs.forEach(s => {
            const month = format(new Date(s.submitted_at), 'yyyy-MM');
            monthlyData[month] = (monthlyData[month] || 0) + 1;
        });

        const responsesByMonth = Object.entries(monthlyData)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const questionStats = qs.map(q => {
            const responses = subs.flatMap(s =>
                s.responses.filter(r => r.question_id === q.id).map(r => r.response_value)
            );

            let stats: any = { total: responses.length };

            switch (q.question_type) {
                case 'yes_no':
                    const yesCount = responses.filter(r => r?.value === 'yes' || r === 'yes').length;
                    const noCount = responses.filter(r => r?.value === 'no' || r === 'no').length;
                    stats = {
                        ...stats,
                        yes: yesCount,
                        no: noCount,
                        yesPercent: responses.length > 0 ? Math.round((yesCount / responses.length) * 100) : 0,
                        noPercent: responses.length > 0 ? Math.round((noCount / responses.length) * 100) : 0
                    };
                    break;

                case 'single_choice':
                case 'multiple_choice':
                    const optionCounts: { [key: string]: number } = {};
                    responses.forEach(r => {
                        const values = Array.isArray(r?.values || r) ? (r?.values || r) : [r?.value || r];
                        values.forEach((v: string) => {
                            optionCounts[v] = (optionCounts[v] || 0) + 1;
                        });
                    });
                    stats = { ...stats, optionCounts };
                    break;

                case 'rating':
                    const ratingValues = responses.map(r => parseInt(r?.value || r) || 0).filter(v => v > 0);
                    const avgRating = ratingValues.length > 0
                        ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
                        : 0;
                    stats = {
                        ...stats,
                        average: avgRating.toFixed(1),
                        distribution: [1, 2, 3, 4, 5].map(n => ratingValues.filter(r => r === n).length)
                    };
                    break;

                case 'scale':
                    const scaleValues = responses.map(r => parseInt(r?.value || r) || 0).filter(v => v > 0);
                    const avgScale = scaleValues.length > 0
                        ? scaleValues.reduce((a, b) => a + b, 0) / scaleValues.length
                        : 0;
                    stats = { ...stats, average: avgScale.toFixed(1) };
                    break;

                case 'number':
                    const numValues = responses.map(r => parseFloat(r?.value || r) || 0);
                    const sum = numValues.reduce((a, b) => a + b, 0);
                    const avg = numValues.length > 0 ? sum / numValues.length : 0;
                    stats = { ...stats, sum, average: avg.toFixed(1), min: Math.min(...numValues), max: Math.max(...numValues) };
                    break;

                case 'text':
                case 'paragraph':
                    stats = { ...stats, textResponses: responses.map(r => typeof r === 'object' ? r.value : r).filter(Boolean) };
                    break;

                case 'date':
                    const dateResponses = responses.map(r => typeof r === 'object' ? r.value : r).filter(Boolean);
                    stats = { ...stats, dateResponses };
                    break;
            }

            return {
                question_id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                responses,
                stats
            };
        });

        const ratingQuestions = questionStats.filter(q => q.question_type === 'rating');
        const avgRating = ratingQuestions.length > 0
            ? ratingQuestions.reduce((sum, q) => sum + parseFloat(q.stats.average || 0), 0) / ratingQuestions.length
            : 0;

        setAnalytics({
            totalResponses,
            completionRate: totalTeachers > 0 ? (totalResponses / totalTeachers) * 100 : 0,
            averageRating: avgRating,
            responsesByMonth,
            questionStats
        });
    };

    const getFilteredSubmissions = () => {
        let filtered = [...submissions];
        if (selectedTeacher !== "all") {
            filtered = filtered.filter(s => s.teacher_id === selectedTeacher);
        }
        if (selectedMonth !== "all") {
            filtered = filtered.filter(s => format(new Date(s.submitted_at), 'yyyy-MM') === selectedMonth);
        }
        if (selectedTeacherMonth !== "all") {
            filtered = filtered.filter(s => format(new Date(s.submitted_at), 'yyyy-MM') === selectedTeacherMonth);
        }
        return filtered;
    };

    const filteredSubmissions = getFilteredSubmissions();

    const getQuestionIcon = (type: string) => {
        switch (type) {
            case 'yes_no': return <ToggleLeft className="w-4 h-4" />;
            case 'rating': return <Star className="w-4 h-4" />;
            case 'scale':
            case 'number': return <Hash className="w-4 h-4" />;
            default: return <MessageSquare className="w-4 h-4" />;
        }
    };

    const renderQuestionAnalysis = (stat: any, question: Question) => {
        switch (stat.question_type) {
            case 'yes_no':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm w-12">نعم</span>
                            <Progress value={stat.stats.yesPercent} className="flex-1" />
                            <span className="text-sm w-16 text-left">{stat.stats.yes} ({stat.stats.yesPercent}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm w-12">لا</span>
                            <Progress value={stat.stats.noPercent} className="flex-1" />
                            <span className="text-sm w-16 text-left">{stat.stats.no} ({stat.stats.noPercent}%)</span>
                        </div>
                    </div>
                );
            case 'single_choice':
            case 'multiple_choice':
                const options = question.options || [];
                return (
                    <div className="space-y-2">
                        {options.map(opt => {
                            const count = stat.stats.optionCounts?.[opt.id] || 0;
                            const percent = stat.stats.total > 0 ? Math.round((count / stat.stats.total) * 100) : 0;
                            return (
                                <div key={opt.id} className="flex items-center gap-2">
                                    <span className="text-sm flex-1 truncate">{opt.text}</span>
                                    <Progress value={percent} className="w-32" />
                                    <span className="text-sm w-16 text-left">{count} ({percent}%)</span>
                                </div>
                            );
                        })}
                    </div>
                );
            case 'rating':
                return (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <Star key={n} className={`w-5 h-5 ${n <= Math.round(parseFloat(stat.stats.average)) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                                ))}
                            </div>
                            <span className="text-lg font-bold">{stat.stats.average}</span>
                            <span className="text-muted-foreground">من 5</span>
                        </div>
                    </div>
                );
            case 'scale':
                return (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${(parseFloat(stat.stats.average) / 10) * 100}%` }}
                                />
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold">{stat.stats.average}</span>
                                <span className="text-xs text-muted-foreground">من 10</span>
                            </div>
                        </div>
                    </div>
                );
            case 'number':
                return (
                    <ScrollArea className="h-32">
                        <div className="space-y-2">
                            {stat.responses?.slice(0, 10).map((resp: any, idx: number) => {
                                const val = typeof resp === 'object' ? resp.value : resp;
                                return (
                                    <div key={idx} className="p-2 bg-muted/50 rounded text-sm flex items-center justify-between">
                                        <span className="font-medium">{val}</span>
                                        <Hash className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                );
            case 'date':
                return (
                    <ScrollArea className="h-32">
                        <div className="space-y-2">
                            {stat.stats.dateResponses?.slice(0, 10).map((dateStr: string, idx: number) => (
                                <div key={idx} className="p-2 bg-muted/50 rounded text-sm flex items-center justify-between">
                                    <span>{dateStr}</span>
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                );
            case 'text':
            case 'paragraph':
                return (
                    <ScrollArea className="h-32">
                        <div className="space-y-2">
                            {stat.stats.textResponses?.slice(0, 10).map((text: string, idx: number) => (
                                <div key={idx} className="p-2 bg-muted/50 rounded text-sm">"{text}"</div>
                            ))}
                        </div>
                    </ScrollArea>
                );
            default:
                return (
                    <div className="p-3 bg-muted/30 rounded border border-dashed text-center">
                        <p className="text-sm text-muted-foreground">تم استقبال {stat.stats.total} إجابة لهذا السؤال</p>
                    </div>
                );
        }
    };

    const getResponseDisplayValue = (question: Question, responseValue: any) => {
        if (!responseValue) return '-';
        const val = typeof responseValue === 'object' ? (responseValue.value || responseValue.values || responseValue) : responseValue;
        switch (question.question_type) {
            case 'yes_no': return val === 'yes' ? 'نعم' : 'لا';
            case 'single_choice': return question.options?.find(o => o.id === val)?.text || val;
            case 'multiple_choice': return (Array.isArray(val) ? val : [val]).map((v: string) => question.options?.find(o => o.id === v)?.text || v).join('، ');
            case 'rating': return `${val} نجوم`;
            case 'scale': return `${val} / 10`;
            case 'date': return val;
            case 'number': return val.toString();
            default: return val.toString();
        }
    };

    const months = [...new Set(submissions.map(s => format(new Date(s.submitted_at), 'yyyy-MM')))].sort();

    if (loading || !survey) {
        return (
            <DashboardLayout title="تحليل الاستبيان" userName={user?.name}>
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="تحليل الاستبيان" userName={user?.name}>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={() => navigate('/admin/surveys')}>
                            <ArrowRight className="w-4 h-4 ml-2" />
                            رجوع
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold">{survey.title}</h2>
                                {survey.scoring_type === 'required_questions' ? (
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] py-0">نسبة الأسئلة المكتملة</Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] py-0">نقاط مخصصة</Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">{format(new Date(survey.created_at), 'PPP', { locale: ar })}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={fetchData}><RefreshCw className="w-4 h-4 ml-2" />تحديث</Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="pt-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
                        <div><p className="text-2xl font-bold">{analytics?.totalResponses || 0}</p><p className="text-xs text-muted-foreground">إجمالي الردود</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                        <div><p className="text-2xl font-bold">{analytics?.completionRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">نسبة الإنجاز</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10"><Star className="w-5 h-5 text-amber-600" /></div>
                        <div><p className="text-2xl font-bold">{analytics?.averageRating.toFixed(1) || '-'}</p><p className="text-xs text-muted-foreground">متوسط التقييم</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                        <div><p className="text-2xl font-bold">{(submissions.reduce((acc, s) => acc + s.score_percentage, 0) / (submissions.length || 1)).toFixed(1)}%</p><p className="text-xs text-muted-foreground">متوسط الدرجات</p></div>
                    </CardContent></Card>
                </div>

                <Tabs defaultValue="questions" className="w-full">
                    <TabsList className={`grid w-full ${survey.is_anonymous ? 'grid-cols-2' : 'grid-cols-4'}`}>
                        <TabsTrigger value="questions"><BarChart3 className="w-4 h-4 ml-2" />الأسئلة</TabsTrigger>
                        {!survey.is_anonymous && <TabsTrigger value="teachers"><User className="w-4 h-4 ml-2" />الأساتذة</TabsTrigger>}
                        {!survey.is_anonymous && <TabsTrigger value="performance"><TrendingUp className="w-4 h-4 ml-2" />مقارنة الأداء</TabsTrigger>}
                        <TabsTrigger value="months"><Calendar className="w-4 h-4 ml-2" />الشهور</TabsTrigger>
                    </TabsList>

                    <TabsContent value="questions" className="space-y-4">
                        {analytics?.questionStats.map((stat, idx) => (
                            <Card key={stat.question_id}>
                                <CardHeader className="pb-2 flex flex-row items-start gap-3">
                                    <Badge variant="outline">{idx + 1}</Badge>
                                    <div>
                                        <CardTitle className="text-base">{stat.question_text}</CardTitle>
                                        <div className="flex items-center gap-2 mt-1">{getQuestionIcon(stat.question_type)}<span className="text-sm text-muted-foreground">{stat.stats.total} إجابة</span></div>
                                    </div>
                                </CardHeader>
                                <CardContent>{renderQuestionAnalysis(stat, questions.find(q => q.id === stat.question_id)!)}</CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="teachers">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>سجل المشاركات</CardTitle>
                                <div className="flex gap-2">
                                    <Select value={selectedTeacherMonth} onValueChange={setSelectedTeacherMonth}>
                                        <SelectTrigger className="w-32"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">الكل</SelectItem>{months.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                                    </Select>
                                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                        <SelectTrigger className="w-40"><SelectValue placeholder="الأستاذ" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">الكل</SelectItem>{teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-right">الأستاذ</TableHead>
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-right">الدرجة</TableHead>
                                        <TableHead className="text-right">الردود</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>{filteredSubmissions.map(sub => (
                                        <TableRow key={sub.id}>
                                            <TableCell className="text-right font-medium">{sub.teacher_name}</TableCell>
                                            <TableCell className="text-right text-xs">{format(new Date(sub.submitted_at), 'PPp', { locale: ar })}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className={
                                                    sub.score_percentage >= 80 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200" :
                                                        sub.score_percentage >= 50 ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200" :
                                                            "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                                                }>
                                                    {sub.score_percentage}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setViewSubmission(sub)}><FileText className="w-4 h-4" /></Button></TableCell>
                                        </TableRow>
                                    ))}</TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="performance" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>مقارنة الأساتذة (%)</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={Object.entries(submissions.reduce((acc, s) => {
                                            if (!acc[s.teacher_name]) acc[s.teacher_name] = { name: s.teacher_name, sum: 0, count: 0 };
                                            acc[s.teacher_name].sum += s.score_percentage;
                                            acc[s.teacher_name].count += 1;
                                            return acc;
                                        }, {} as any)).map(([_, v]: any) => ({ name: v.name, score: parseFloat((v.sum / v.count).toFixed(1)) }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis domain={[0, 100]} />
                                            <Tooltip formatter={(v) => `${v}%`} />
                                            <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الدرجة المئوية" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>تطور الأداء عبر الزمن</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={submissions.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()).map(s => ({
                                            date: format(new Date(s.submitted_at), 'MM/dd'),
                                            score: s.score_percentage
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" />
                                            <YAxis domain={[0, 100]} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} name="التقييم (%)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="months">
                        <Card><CardContent className="pt-6 space-y-4">
                            {analytics?.responsesByMonth.map(({ month, count }) => {
                                const max = Math.max(...analytics.responsesByMonth.map(m => m.count));
                                return (
                                    <div key={month} className="flex items-center gap-4">
                                        <span className="w-24 text-sm">{month}</span>
                                        <Progress value={(count / (max || 1)) * 100} className="flex-1" />
                                        <span className="w-8 text-left font-bold">{count}</span>
                                    </div>
                                );
                            })}
                        </CardContent></Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={!!viewSubmission} onOpenChange={(open) => !open && setViewSubmission(null)}>
                <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>إجابات الأستاذ: {viewSubmission?.teacher_name}</DialogTitle>
                        <DialogDescription className="flex justify-between items-center">
                            <span>{viewSubmission && format(new Date(viewSubmission.submitted_at), 'PPp', { locale: ar })}</span>
                            <Badge variant="outline" className="text-lg px-3 py-1">الدرجة: {viewSubmission?.score_percentage}%</Badge>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        {questions.map((q, idx) => {
                            const res = viewSubmission?.responses.find(r => r.question_id === q.id);
                            return (
                                <div key={q.id} className="p-3 bg-muted/30 rounded-lg">
                                    <p className="font-semibold text-sm mb-2">{idx + 1}. {q.question_text}</p>
                                    <div className="bg-background p-2 rounded border text-sm">{getResponseDisplayValue(q, res?.response_value)}</div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};

export default AdminSurveyAnalytics;
