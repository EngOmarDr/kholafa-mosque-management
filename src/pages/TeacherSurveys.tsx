import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ClipboardList, CheckCircle2, Clock, AlertCircle, ArrowRight,
    Loader2, Calendar, Send, Star, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Survey {
    id: string;
    title: string;
    description: string | null;
    is_anonymous: boolean;
    is_required: boolean;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    questions_count?: number;
    is_completed?: boolean;
    include_optional_in_scoring?: boolean;
    allow_edits?: boolean;
    edit_limit_hours?: number;
    submission_time?: string;
    submission_id?: string;
}

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: { id: string; text: string }[] | null;
    is_required: boolean;
    order_index: number;
    parent_question_id: string | null;
    show_if_answer: { value?: string; values?: string[] } | null;
    points_config?: {
        options?: { [key: string]: number };
        max_points: number;
    } | null;
}

const TeacherSurveys = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [responses, setResponses] = useState<{ [key: string]: any }>({});
    const [submitting, setSubmitting] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem("jeelUser");
        if (!userData) {
            navigate("/login");
            return;
        }
        const parsedUser = JSON.parse(userData);
        if (!["teacher", "supervisor"].includes(parsedUser.role)) {
            toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
            navigate("/login");
            return;
        }
        setUser(parsedUser);
        fetchTeacherId(parsedUser.id);
    }, [navigate]);

    const fetchTeacherId = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('teachers')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            setTeacherId(data?.id || null);
            if (data?.id) {
                fetchSurveys(data.id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching teacher:', error);
            setLoading(false);
        }
    };

    const fetchSurveys = async (tId: string) => {
        setLoading(true);
        try {
            // جلب الاستبيانات النشطة
            const { data: surveysData, error: surveysError } = await supabase
                .from('surveys')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (surveysError) throw surveysError;

            // جلب التقديمات السابقة للأستاذ
            const { data: submissionsData } = await supabase
                .from('survey_submissions')
                .select('id, survey_id, submitted_at')
                .eq('teacher_id', tId)
                .eq('status', 'completed');

            const submissionMap = new Map((submissionsData || []).map(s => [s.survey_id, s]));

            // جلب عدد الأسئلة لكل استبيان
            const surveysWithCounts = await Promise.all(
                (surveysData || []).map(async (survey) => {
                    const { count } = await supabase
                        .from('survey_questions')
                        .select('id', { count: 'exact', head: true })
                        .eq('survey_id', survey.id)
                        .is('parent_question_id', null);

                    const submission = submissionMap.get(survey.id);

                    return {
                        ...survey,
                        questions_count: count || 0,
                        is_completed: !!submission,
                        submission_time: submission?.submitted_at,
                        submission_id: submission?.id
                    };
                })
            );

            setSurveys(surveysWithCounts);
        } catch (error) {
            console.error('Error fetching surveys:', error);
            toast.error('حدث خطأ في تحميل الاستبيانات');
        } finally {
            setLoading(false);
        }
    };

    const canEditSubmission = (survey: Survey): boolean => {
        if (!survey.allow_edits || !survey.submission_time) return false;

        const submissionDate = new Date(survey.submission_time);
        const limitHours = survey.edit_limit_hours || 24;
        const now = new Date();

        const diffInMs = now.getTime() - submissionDate.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);

        return diffInHours < limitHours;
    };

    const openSurvey = async (survey: Survey, keepExistingResponses = false) => {
        if (survey.is_completed && !keepExistingResponses) {
            if (canEditSubmission(survey)) {
                // السماح بالدخول للتعديل
            } else {
                toast.info('لقد أجبت على هذا الاستبيان مسبقاً وانتهت مدة التعديل المتاحة');
                return;
            }
        }

        setSelectedSurvey(survey);
        setLoadingQuestions(true);
        if (!keepExistingResponses) {
            setResponses({});
        }

        try {
            const { data, error } = await supabase
                .from('survey_questions')
                .select('*')
                .eq('survey_id', survey.id)
                .order('order_index');

            if (error) throw error;
            setQuestions((data || []).map(q => ({
                ...q,
                options: (q.options as { id: string; text: string }[]) || null,
                show_if_answer: q.show_if_answer as { value?: string; values?: string[] } | null,
                points_config: (q as any).points_config
            })));
        } catch (error) {
            console.error('Error fetching questions:', error);
            toast.error('حدث خطأ في تحميل الأسئلة');
            setSelectedSurvey(null);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const viewSurvey = async (survey: Survey) => {
        if (!survey.submission_id) return;

        setIsReadOnly(true);
        setIsEditing(false);

        setLoadingQuestions(true);
        try {
            const { data, error } = await supabase
                .from('survey_responses')
                .select('question_id, response_value')
                .eq('submission_id', survey.submission_id);

            if (error) throw error;

            const existingResponses: { [key: string]: any } = {};
            (data || []).forEach(r => {
                existingResponses[r.question_id] = r.response_value;
            });

            setResponses(existingResponses);
            await openSurvey(survey, true);
        } catch (error) {
            console.error('Error fetching existing responses:', error);
            toast.error('حدث خطأ في تحميل إجاباتك');
            setIsReadOnly(false);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const editSurvey = async (survey: Survey) => {
        if (!survey.submission_id) return;

        setIsEditing(true);
        setIsReadOnly(false);
        setEditingSubmissionId(survey.submission_id);

        // جلب الإجابات السابقة
        setLoadingQuestions(true);
        try {
            const { data, error } = await supabase
                .from('survey_responses')
                .select('question_id, response_value')
                .eq('submission_id', survey.submission_id);

            if (error) throw error;

            const existingResponses: { [key: string]: any } = {};
            (data || []).forEach(r => {
                existingResponses[r.question_id] = r.response_value;
            });

            setResponses(existingResponses);
            await openSurvey(survey, true);
        } catch (error) {
            console.error('Error fetching existing responses:', error);
            toast.error('حدث خطأ في تحميل إجاباتك السابقة');
            setIsEditing(false);
            setEditingSubmissionId(null);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const updateResponse = (questionId: string, value: any) => {
        if (isReadOnly) return;
        setResponses(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const shouldShowQuestion = (question: Question): boolean => {
        if (!question.parent_question_id) return true;

        const parentResponse = responses[question.parent_question_id];
        if (!parentResponse) return false;

        const showIfAnswer = question.show_if_answer;
        if (!showIfAnswer) return true;

        const responseValue = typeof parentResponse === 'object' ? parentResponse.value : parentResponse;

        if (showIfAnswer.value) {
            return responseValue === showIfAnswer.value;
        }
        if (showIfAnswer.values) {
            return showIfAnswer.values.includes(responseValue);
        }
        return true;
    };

    const validateResponses = (): boolean => {
        const visibleQuestions = questions.filter(shouldShowQuestion);
        const requiredQuestions = visibleQuestions.filter(q => q.is_required);

        for (const q of requiredQuestions) {
            const response = responses[q.id];
            if (!response || (typeof response === 'object' && !response.value && (!response.values || response.values.length === 0))) {
                toast.error(`يرجى الإجابة على السؤال: ${q.question_text.substring(0, 50)}...`);
                return false;
            }
        }
        return true;
    };

    const submitSurvey = async () => {
        if (!validateResponses()) return;
        if (!selectedSurvey || !teacherId) return;

        setSubmitting(true);
        try {
            // حساب الدرجات
            let scoreRaw = 0;
            let scoreMax = 0;

            const visibleQuestions = questions.filter(shouldShowQuestion);
            const scoringType = (selectedSurvey as any).scoring_type || 'manual_points';
            const includeOptionalInScoring = (selectedSurvey as any).include_optional_in_scoring || false;

            if (scoringType === 'manual_points') {
                visibleQuestions.forEach(q => {
                    const pointsConfig = q.points_config;
                    if (!pointsConfig) return;

                    // إضافة للحد الأقصى الممكن 
                    // إذا كان الخيار معطلاً، نضيف النقاط فقط للأسئلة الإلزامية
                    // أما إذا كان مفعلاً، نضيف النقاط لجميع الأسئلة المرئية
                    if (q.is_required || includeOptionalInScoring) {
                        scoreMax += pointsConfig.max_points || 0;
                    }

                    const response = responses[q.id];
                    if (!response) return;

                    const val = response.value || response;

                    if (q.question_type === 'yes_no' || q.question_type === 'single_choice') {
                        const earned = pointsConfig.options?.[val] || 0;
                        scoreRaw += earned;
                    } else if (q.question_type === 'multiple_choice') {
                        const values = response.values || [];
                        let earned = 0;
                        values.forEach((v: string) => {
                            earned += pointsConfig.options?.[v] || 0;
                        });
                        scoreRaw += earned;
                    }
                });
            } else {
                // نسبة الأسئلة المكتملة
                // إذا كان الخيار معطلاً، نعتمد على الأسئلة الإلزامية فقط
                // إذا كان مفعلاً، نعتمد على كل الأسئلة المرئية
                const questionsToCount = includeOptionalInScoring
                    ? visibleQuestions
                    : visibleQuestions.filter(q => q.is_required);

                scoreMax = questionsToCount.length;

                questionsToCount.forEach(q => {
                    const response = responses[q.id];
                    const isAnswered = response && (
                        (typeof response === 'object' && (response.value !== undefined && response.value !== '' || (response.values && response.values.length > 0))) ||
                        (typeof response !== 'object' && response !== undefined && response !== '')
                    );
                    if (isAnswered) {
                        scoreRaw += 1;
                    }
                });

                // إذا لم تكن هناك أسئلة للمحاسبة عليها، نعتبر الدرجة كاملة إذا أجاب على أي سؤال مرئي
                if (scoreMax === 0 && visibleQuestions.length > 0) {
                    scoreMax = 1;
                    const hasAnyAnswer = visibleQuestions.some(q => {
                        const r = responses[q.id];
                        return r && ((typeof r === 'object' && (r.value || (r.values && r.values.length > 0))) || (typeof r !== 'object' && r));
                    });
                    scoreRaw = hasAnyAnswer ? 1 : 0;
                }
            }

            const scorePercentage = scoreMax > 0 ? (scoreRaw / scoreMax) * 100 : 0;

            if (isEditing) {
                // تحديث التقديم الحالي
                const { error: updateError } = await supabase
                    .from('survey_submissions')
                    .update({
                        score_raw: scoreRaw,
                        score_max: scoreMax,
                        score_percentage: Math.round(scorePercentage * 100) / 100
                    } as any)
                    .eq('id', editingSubmissionId);

                if (updateError) throw updateError;

                // 2. تحديث الإجابات - حذف القديم وإضافة الجديد
                const { error: deleteError } = await supabase
                    .from('survey_responses')
                    .delete()
                    .eq('submission_id', editingSubmissionId);

                if (deleteError) throw deleteError;

                const updatedResponsesPayload = Object.entries(responses).map(([questionId, value]) => ({
                    submission_id: editingSubmissionId,
                    question_id: questionId,
                    response_value: typeof value === 'object' ? value : { value }
                }));

                const { error: insertError } = await supabase
                    .from('survey_responses')
                    .insert(updatedResponsesPayload);

                if (insertError) throw insertError;

                toast.success('تم تحديث إجاباتك بنجاح!');
            } else {
                // إنشاء تقديم جديد (كود أصلي مع زيادة التعديل)
                const { data: submission, error: submissionError } = await supabase
                    .from('survey_submissions')
                    .insert({
                        survey_id: selectedSurvey.id,
                        teacher_id: teacherId,
                        status: 'completed',
                        ip_address: null,
                        user_agent: navigator.userAgent,
                        score_raw: scoreRaw,
                        score_max: scoreMax,
                        score_percentage: Math.round(scorePercentage * 100) / 100
                    } as any)
                    .select('id')
                    .single();

                if (submissionError) throw submissionError;

                const responsesPayload = Object.entries(responses).map(([questionId, value]) => ({
                    submission_id: submission.id,
                    question_id: questionId,
                    response_value: typeof value === 'object' ? value : { value }
                }));

                const { error: responsesError } = await supabase
                    .from('survey_responses')
                    .insert(responsesPayload);

                if (responsesError) throw responsesError;

                toast.success('تم إرسال إجاباتك بنجاح! شكراً لمشاركتك.');
            }

            // إعادة ضبط الحالة
            setIsEditing(false);
            setEditingSubmissionId(null);
            setSelectedSurvey(null);
            setQuestions([]);
            setResponses({});

            // تحديث القائمة
            if (teacherId) fetchSurveys(teacherId);

            // إطلاق حدث لتحديث عداد الاستبيانات في القالب الرئيسي
            window.dispatchEvent(new CustomEvent('surveySubmitted'));
        } catch (error: any) {
            console.error('Error submitting survey:', error);
            toast.error(`حدث خطأ في إرسال الإجابات: ${error.message || 'خطأ غير معروف'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestion = (question: Question) => {
        if (!shouldShowQuestion(question)) return null;

        const response = responses[question.id];

        switch (question.question_type) {
            case 'yes_no':
                return (
                    <RadioGroup
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onValueChange={(value) => updateResponse(question.id, { value })}
                        className="flex gap-4"
                    >
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                            <Label htmlFor={`${question.id}-yes`}>نعم</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="no" id={`${question.id}-no`} />
                            <Label htmlFor={`${question.id}-no`}>لا</Label>
                        </div>
                    </RadioGroup>
                );

            case 'single_choice':
                return (
                    <RadioGroup
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onValueChange={(value) => updateResponse(question.id, { value })}
                        className="space-y-2"
                    >
                        {question.options?.map(opt => (
                            <div key={opt.id} className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value={opt.id} id={`${question.id}-${opt.id}`} />
                                <Label htmlFor={`${question.id}-${opt.id}`}>{opt.text}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                );

            case 'multiple_choice':
                const selectedValues = response?.values || [];
                return (
                    <div className="space-y-2">
                        {question.options?.map(opt => (
                            <div key={opt.id} className="flex items-center space-x-2 space-x-reverse">
                                <Checkbox
                                    disabled={isReadOnly}
                                    id={`${question.id}-${opt.id}`}
                                    checked={selectedValues.includes(opt.id)}
                                    onCheckedChange={(checked) => {
                                        const newValues = checked
                                            ? [...selectedValues, opt.id]
                                            : selectedValues.filter((v: string) => v !== opt.id);
                                        updateResponse(question.id, { values: newValues });
                                    }}
                                />
                                <Label htmlFor={`${question.id}-${opt.id}`}>{opt.text}</Label>
                            </div>
                        ))}
                    </div>
                );

            case 'text':
                return (
                    <Input
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onChange={(e) => updateResponse(question.id, { value: e.target.value })}
                        placeholder="اكتب إجابتك..."
                    />
                );

            case 'paragraph':
                return (
                    <Textarea
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onChange={(e) => updateResponse(question.id, { value: e.target.value })}
                        placeholder="اكتب إجابتك..."
                        rows={4}
                    />
                );

            case 'rating':
                const ratingValue = parseInt(response?.value || response || '0');
                return (
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => updateResponse(question.id, { value: n.toString() })}
                                className={`p-1 transition-transform ${isReadOnly ? 'cursor-default' : 'hover:scale-110'}`}
                            >
                                <Star
                                    className={`w-8 h-8 ${n <= ratingValue ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                />
                            </button>
                        ))}
                    </div>
                );

            case 'scale':
                const scaleValue = parseInt(response?.value || response || '0');
                return (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>1</span>
                            <span>10</span>
                        </div>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => updateResponse(question.id, { value: n.toString() })}
                                    className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${n <= scaleValue
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                        } ${isReadOnly ? 'cursor-default' : 'hover:bg-muted/80'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'date':
                return (
                    <Input
                        type="date"
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onChange={(e) => updateResponse(question.id, { value: e.target.value })}
                    />
                );

            case 'number':
                return (
                    <Input
                        type="number"
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        value={response?.value || response || ''}
                        onChange={(e) => updateResponse(question.id, { value: e.target.value })}
                        placeholder="أدخل رقماً..."
                    />
                );

            default:
                return null;
        }
    };

    const pendingSurveys = surveys.filter(s => !s.is_completed);
    const completedSurveys = surveys.filter(s => s.is_completed);

    if (loading) {
        return (
            <DashboardLayout title="الاستبيانات">
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    // عرض نموذج الاستبيان
    if (selectedSurvey) {
        return (
            <DashboardLayout title={selectedSurvey.title} userName={user?.name}>
                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={() => {
                            setSelectedSurvey(null);
                            setIsEditing(false);
                            setIsReadOnly(false);
                            setEditingSubmissionId(null);
                            setResponses({});
                        }}>
                            <ArrowRight className="w-4 h-4 ml-2" />
                            رجوع
                        </Button>
                        {selectedSurvey.is_anonymous && (
                            <Badge variant="secondary">استبيان مجهول</Badge>
                        )}
                    </div>

                    {selectedSurvey.description && (
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-muted-foreground">{selectedSurvey.description}</p>
                            </CardContent>
                        </Card>
                    )}

                    {loadingQuestions ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {questions.filter(shouldShowQuestion).map((question, idx) => (
                                <Card key={question.id} className={question.parent_question_id ? 'mr-6 border-r-4 border-r-primary/30' : ''}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start gap-2">
                                            <Badge variant="outline" className="mt-1">{idx + 1}</Badge>
                                            <div className="flex-1">
                                                <CardTitle className="text-base">
                                                    {question.question_text}
                                                    {question.is_required && <span className="text-destructive mr-1">*</span>}
                                                </CardTitle>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {renderQuestion(question)}
                                    </CardContent>
                                </Card>
                            ))}

                            {!isReadOnly && (
                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={submitSurvey}
                                        disabled={submitting}
                                        size="lg"
                                        className="gap-2"
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        {isEditing ? 'تحديث الإجابات' : 'إرسال الإجابات'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="الاستبيانات" userName={user?.name}>
            <div className="space-y-6 animate-fade-in">
                {/* الإحصائيات */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{pendingSurveys.length}</p>
                                    <p className="text-xs text-muted-foreground">بانتظار الإجابة</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{completedSurveys.length}</p>
                                    <p className="text-xs text-muted-foreground">تم الإجابة</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2 md:col-span-1">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{surveys.length}</p>
                                    <p className="text-xs text-muted-foreground">إجمالي الاستبيانات</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* التبويبات */}
                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="pending" className="gap-2">
                            <Clock className="w-4 h-4" />
                            بانتظار الإجابة ({pendingSurveys.length})
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            تم الإجابة ({completedSurveys.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        {pendingSurveys.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50 text-emerald-500" />
                                    <p>لا توجد استبيانات بانتظار الإجابة</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {pendingSurveys.map(survey => (
                                    <Card key={survey.id} className="hover:shadow-md transition-shadow cursor-pointer">
                                        <CardContent className="pt-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold">{survey.title}</h3>
                                                        {survey.is_required && (
                                                            <Badge variant="destructive" className="text-xs">إلزامي</Badge>
                                                        )}
                                                    </div>
                                                    {survey.description && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                            {survey.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(survey.created_at), 'PPP', { locale: ar })}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <ClipboardList className="w-3 h-3" />
                                                            {survey.questions_count} سؤال
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button onClick={() => openSurvey(survey)} className="gap-2 h-9 text-xs">
                                                    بدء الاستبيان
                                                    <ArrowRight className="w-4 h-4" />
                                                </Button></div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="completed">
                        {completedSurveys.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>لم تقم بالإجابة على أي استبيان بعد</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {completedSurveys.map(survey => (
                                    <Card key={survey.id} className="opacity-75">
                                        <CardContent className="pt-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold">{survey.title}</h3>
                                                        <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                                                            <CheckCircle2 className="w-3 h-3 ml-1" />
                                                            تم الإجابة
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(survey.created_at), 'PPP', { locale: ar })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                    <Button variant="outline" disabled className="gap-2 text-emerald-600 bg-emerald-100 h-8 text-xs">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        تم الإرسال
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="gap-2 h-8 text-xs hover:bg-muted"
                                                        onClick={() => viewSurvey(survey)}
                                                    >
                                                        عرض الإجابات
                                                    </Button>
                                                    {canEditSubmission(survey) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="gap-2 h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                                                            onClick={() => editSurvey(survey)}
                                                        >
                                                            <Clock className="w-4 h-4" />
                                                            تعديل الإجابة
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default TeacherSurveys;
