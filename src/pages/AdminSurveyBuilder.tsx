import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus, Trash2, GripVertical, Save, Send, ArrowRight, ArrowLeft,
    Loader2, CheckCircle, Circle, ToggleLeft, AlignLeft, Star,
    Hash, Calendar, ListChecks, ChevronDown, ChevronUp, Settings2, Eye,
    Rocket
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface QuestionOption {
    id: string;
    text: string;
}

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: QuestionOption[];
    is_required: boolean;
    order_index: number;
    parent_question_id: string | null;
    show_if_answer: { value?: string; values?: string[] } | null;
    points_config?: {
        options?: { [key: string]: number };
        max_points: number;
    } | null;
    isNew?: boolean;
    isDeleted?: boolean;
}

interface Survey {
    id?: string;
    title: string;
    description: string;
    is_anonymous: boolean;
    is_required: boolean;
    start_date: string;
    end_date: string;
    scoring_type?: 'manual_points' | 'required_questions';
    include_optional_in_scoring?: boolean;
    allow_edits?: boolean;
    edit_limit_hours?: number;
}

const questionTypes = [
    { value: 'yes_no', label: 'نعم / لا', icon: ToggleLeft },
    { value: 'single_choice', label: 'اختيار واحد', icon: Circle },
    { value: 'multiple_choice', label: 'اختيار متعدد', icon: CheckCircle },
    { value: 'text', label: 'نص قصير', icon: AlignLeft },
    { value: 'paragraph', label: 'نص طويل', icon: AlignLeft },
    { value: 'rating', label: 'تقييم (نجوم)', icon: Star },
    { value: 'scale', label: 'مقياس (1-10)', icon: Hash },
    { value: 'date', label: 'تاريخ', icon: Calendar },
    { value: 'number', label: 'رقم', icon: Hash },
];

// مكون السؤال القابل للسحب
const SortableQuestion = ({
    question,
    index,
    onUpdate,
    onDelete,
    onAddOption,
    onUpdateOption,
    onDeleteOption,
    questions,
    expanded,
    onToggleExpand,
    scoringType,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast
}: {
    question: Question;
    index: number;
    onUpdate: (id: string, updates: Partial<Question>) => void;
    onDelete: (id: string) => void;
    onAddOption: (questionId: string) => void;
    onUpdateOption: (questionId: string, optionId: string, text: string) => void;
    onDeleteOption: (questionId: string, optionId: string) => void;
    questions: Question[];
    expanded: boolean;
    onToggleExpand: () => void;
    scoringType: 'manual_points' | 'required_questions';
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: question.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const questionType = questionTypes.find(t => t.value === question.question_type);
    const IconComponent = questionType?.icon || AlignLeft;

    // الأسئلة التي يمكن ربطها (الأسئلة السابقة من نوع yes_no أو single_choice)
    const parentableQuestions = questions.filter(q =>
        q.id !== question.id &&
        q.order_index < question.order_index &&
        ['yes_no', 'single_choice'].includes(q.question_type)
    );

    const parentQuestion = questions.find(q => q.id === question.parent_question_id);

    return (
        <div ref={setNodeRef} style={style} className="relative">
            <Card className={`transition-all ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''} ${question.parent_question_id ? 'me-8 border-e-4 border-e-primary/30' : ''}`}>
                <CardHeader className="py-3 px-4">
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Controls and Badges */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-md border border-muted">
                                    <button
                                        {...attributes}
                                        {...listeners}
                                        className="cursor-grab hover:bg-muted p-1 rounded"
                                        title="سحب للترتيب"
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <div className="flex flex-col gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 p-0 hover:bg-primary/10 hover:text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMoveUp();
                                            }}
                                            disabled={isFirst}
                                            title="تحريك لأعلى"
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 p-0 hover:bg-primary/10 hover:text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMoveDown();
                                            }}
                                            disabled={isLast}
                                            title="تحريك لأسفل"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px] md:text-xs shrink-0 px-2 py-0 h-5 bg-primary/5 text-primary border-primary/10">
                                        <IconComponent className="w-3 h-3 me-1.5" />
                                        {questionType?.label}
                                    </Badge>
                                    {question.is_required && (
                                        <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-600 px-1.5 h-5 shrink-0">إلزامي</Badge>
                                    )}
                                    {question.parent_question_id && (
                                        <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-600 px-1.5 h-5 shrink-0">شرطي</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-muted"
                                    onClick={onToggleExpand}
                                    title={expanded ? "طي" : "توسيع"}
                                >
                                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onDelete(question.id)}
                                    title="حذف السؤال"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Row 2: Question Text */}
                        <div className="pe-1">
                            <span className="text-sm md:text-base font-semibold text-foreground/90 leading-relaxed block break-words">
                                {question.question_text || 'سؤال بدون عنوان'}
                            </span>
                        </div>
                    </div>
                </CardHeader>

                {expanded && (
                    <CardContent className="pt-0 pb-4 space-y-4">
                        <div className="space-y-2">
                            <Label>نص السؤال *</Label>
                            <Textarea
                                value={question.question_text}
                                onChange={(e) => onUpdate(question.id, { question_text: e.target.value })}
                                placeholder="أدخل نص السؤال..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>نوع السؤال</Label>
                                <Select
                                    value={question.question_type}
                                    onValueChange={(value) => onUpdate(question.id, {
                                        question_type: value,
                                        options: ['single_choice', 'multiple_choice'].includes(value) && question.options.length === 0
                                            ? [{ id: crypto.randomUUID(), text: 'خيار 1' }]
                                            : question.options
                                    })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {questionTypes.map(type => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <type.icon className="w-4 h-4" />
                                                    {type.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <Label htmlFor={`required-${question.id}`}>سؤال إلزامي</Label>
                                <Switch
                                    id={`required-${question.id}`}
                                    checked={question.is_required}
                                    onCheckedChange={(checked) => onUpdate(question.id, { is_required: checked })}
                                />
                            </div>
                        </div>

                        {/* خيارات الاختيار */}
                        {['single_choice', 'multiple_choice'].includes(question.question_type) && (
                            <div className="space-y-3">
                                <Label>{scoringType === 'manual_points' ? 'الخيارات والدرجات' : 'الخيارات'}</Label>
                                <div className="space-y-2">
                                    {question.options.map((option, idx) => (
                                        <div key={option.id} className="flex items-center gap-2">
                                            <div className="w-6 h-6 flex items-center justify-center text-muted-foreground text-sm">
                                                {question.question_type === 'single_choice' ? (
                                                    <Circle className="w-4 h-4" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                            </div>
                                            <Input
                                                value={option.text}
                                                onChange={(e) => onUpdateOption(question.id, option.id, e.target.value)}
                                                placeholder={`خيار ${idx + 1}`}
                                                className="flex-1"
                                            />
                                            {scoringType === 'manual_points' && (
                                                <div className="flex items-center gap-1 bg-primary/5 px-2 rounded-md border border-primary/10">
                                                    <span className="text-[10px] text-primary font-medium">نقاط:</span>
                                                    <Input
                                                        type="number"
                                                        value={question.points_config?.options?.[option.id] || 0}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            const newConfig = {
                                                                ...question.points_config,
                                                                options: {
                                                                    ...(question.points_config?.options || {}),
                                                                    [option.id]: val
                                                                },
                                                                max_points: Math.max(...Object.values({
                                                                    ...(question.points_config?.options || {}),
                                                                    [option.id]: val
                                                                }))
                                                            };
                                                            onUpdate(question.id, { points_config: newConfig });
                                                        }}
                                                        className="w-16 h-8 text-center text-xs"
                                                    />
                                                </div>
                                            )}
                                            {question.options.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => onDeleteOption(question.id, option.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAddOption(question.id)}
                                        className="gap-1 border-dashed"
                                    >
                                        <Plus className="w-4 h-4" />
                                        إضافة خيار
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* خيارات نعم/لا مع درجات */}
                        {question.question_type === 'yes_no' && scoringType === 'manual_points' && (
                            <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                <Label className="text-sm">درجات الإجابة (نقاط)</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-[10px] text-muted-foreground">عند اختيار "نعم"</Label>
                                        <Input
                                            type="number"
                                            value={question.points_config?.options?.['yes'] || 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const newConfig = {
                                                    ...question.points_config,
                                                    options: { ...(question.points_config?.options || {}), yes: val },
                                                    max_points: Math.max(val, question.points_config?.options?.['no'] || 0)
                                                };
                                                onUpdate(question.id, { points_config: newConfig });
                                            }}
                                            placeholder="نعم"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-[10px] text-muted-foreground">عند اختيار "لا"</Label>
                                        <Input
                                            type="number"
                                            value={question.points_config?.options?.['no'] || 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const newConfig = {
                                                    ...question.points_config,
                                                    options: { ...(question.points_config?.options || {}), no: val },
                                                    max_points: Math.max(val, question.points_config?.options?.['yes'] || 0)
                                                };
                                                onUpdate(question.id, { points_config: newConfig });
                                            }}
                                            placeholder="لا"
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* المنطق الشرطي */}
                        {parentableQuestions.length > 0 && (
                            <div className="p-3 bg-primary/5 rounded-lg space-y-3 border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="w-4 h-4 text-primary" />
                                    <Label className="text-primary font-medium">المنطق الشرطي</Label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-sm">يظهر السؤال عند الإجابة على:</Label>
                                        <Select
                                            value={question.parent_question_id || "none"}
                                            onValueChange={(value) => onUpdate(question.id, {
                                                parent_question_id: value === "none" ? null : value,
                                                show_if_answer: value === "none" ? null : question.show_if_answer
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر سؤالاً..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">بدون شرط (يظهر دائماً)</SelectItem>
                                                {parentableQuestions.map(q => (
                                                    <SelectItem key={q.id} value={q.id}>
                                                        {q.question_text.substring(0, 40)}...
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {question.parent_question_id && parentQuestion && (
                                        <div className="space-y-2">
                                            <Label className="text-sm">عند اختيار:</Label>
                                            <Select
                                                value={question.show_if_answer?.value || ""}
                                                onValueChange={(value) => onUpdate(question.id, {
                                                    show_if_answer: { value }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="اختر الإجابة..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {parentQuestion.question_type === 'yes_no' ? (
                                                        <>
                                                            <SelectItem value="yes">نعم</SelectItem>
                                                            <SelectItem value="no">لا</SelectItem>
                                                        </>
                                                    ) : (
                                                        parentQuestion.options.map(opt => (
                                                            <SelectItem key={opt.id} value={opt.id}>
                                                                {opt.text}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
};

const AdminSurveyBuilder = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [survey, setSurvey] = useState<Survey>({
        title: '',
        description: '',
        is_anonymous: false,
        is_required: false,
        start_date: '',
        end_date: '',
        include_optional_in_scoring: false,
        allow_edits: false,
        edit_limit_hours: 24
    });

    const [questions, setQuestions] = useState<Question[]>([]);
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'details' | 'questions'>('details');
    const [showEditConfirm, setShowEditConfirm] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

        if (isEditing) {
            fetchSurvey();
        } else {
            setLoading(false);
        }
    }, [navigate, id]);

    const fetchSurvey = async () => {
        try {
            const { data: surveyData, error: surveyError } = await supabase
                .from('surveys')
                .select('*')
                .eq('id', id)
                .single();

            if (surveyError) throw surveyError;

            const data = surveyData as any;
            setSurvey({
                id: data.id,
                title: data.title,
                description: data.description || '',
                is_anonymous: data.is_anonymous,
                is_required: data.is_required,
                start_date: data.start_date ? data.start_date.split('T')[0] : '',
                end_date: data.end_date ? data.end_date.split('T')[0] : '',
                scoring_type: data.scoring_type || 'manual_points',
                allow_edits: data.allow_edits || false,
                edit_limit_hours: data.edit_limit_hours || 24
            });

            const { data: questionsData, error: questionsError } = await supabase
                .from('survey_questions')
                .select('*')
                .eq('survey_id', id)
                .order('order_index');

            if (questionsError) throw questionsError;

            setQuestions((questionsData || []).map(q => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                options: (q.options as unknown as QuestionOption[]) || [],
                is_required: q.is_required,
                order_index: q.order_index,
                parent_question_id: q.parent_question_id,
                show_if_answer: q.show_if_answer as { value?: string; values?: string[] } | null,
                points_config: (q as any).points_config as any
            })));
        } catch (error) {
            console.error('Error fetching survey:', error);
            toast.error('حدث خطأ في تحميل الاستبيان');
            navigate('/admin/surveys');
        } finally {
            setLoading(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: crypto.randomUUID(),
            question_text: '',
            question_type: 'text',
            options: [],
            is_required: true,
            order_index: questions.length,
            parent_question_id: null,
            show_if_answer: null,
            isNew: true
        };
        setQuestions(prev => [...prev, newQuestion]);
        setExpandedQuestions(prev => new Set([...prev, newQuestion.id]));
    };

    const updateQuestion = (id: string, updates: Partial<Question>) => {
        setQuestions(prev => prev.map(q =>
            q.id === id ? { ...q, ...updates } : q
        ));
    };

    const deleteQuestion = (id: string) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
        // إزالة الارتباطات الشرطية
        setQuestions(prev => prev.map(q =>
            q.parent_question_id === id
                ? { ...q, parent_question_id: null, show_if_answer: null }
                : q
        ));
    };

    const addOption = (questionId: string) => {
        setQuestions(prev => prev.map(q => {
            if (q.id !== questionId) return q;
            return {
                ...q,
                options: [...q.options, { id: crypto.randomUUID(), text: `خيار ${q.options.length + 1}` }]
            };
        }));
    };

    const updateOption = (questionId: string, optionId: string, text: string) => {
        setQuestions(prev => prev.map(q => {
            if (q.id !== questionId) return q;
            return {
                ...q,
                options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
            };
        }));
    };

    const deleteOption = (questionId: string, optionId: string) => {
        setQuestions(prev => prev.map(q => {
            if (q.id !== questionId) return q;
            return {
                ...q,
                options: q.options.filter(o => o.id !== optionId)
            };
        }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setQuestions(prev => {
            const oldIndex = prev.findIndex(q => q.id === active.id);
            const newIndex = prev.findIndex(q => q.id === over.id);
            const reordered = arrayMove(prev, oldIndex, newIndex);
            return reordered.map((q, idx) => ({ ...q, order_index: idx }));
        });
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        setQuestions(prev => {
            const newQuestions = [...prev];
            const temp = newQuestions[index];
            newQuestions[index] = newQuestions[index - 1];
            newQuestions[index - 1] = temp;
            return newQuestions.map((q, idx) => ({ ...q, order_index: idx }));
        });
    };

    const handleMoveDown = (index: number) => {
        if (index === questions.length - 1) return;
        setQuestions(prev => {
            const newQuestions = [...prev];
            const temp = newQuestions[index];
            newQuestions[index] = newQuestions[index + 1];
            newQuestions[index + 1] = temp;
            return newQuestions.map((q, idx) => ({ ...q, order_index: idx }));
        });
    };

    const toggleExpand = (id: string) => {
        setExpandedQuestions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const saveSurvey = async (publish: boolean = false) => {
        if (!survey.title.trim()) {
            toast.error('يرجى إدخال عنوان الاستبيان');
            return;
        }

        if (questions.length === 0) {
            toast.error('يرجى إضافة سؤال واحد على الأقل');
            return;
        }

        const emptyQuestions = questions.filter(q => !q.question_text.trim());
        if (emptyQuestions.length > 0) {
            toast.error('يرجى ملء نص جميع الأسئلة');
            return;
        }

        publish ? setPublishing(true) : setSaving(true);

        try {
            let surveyId = id;

            // حفظ الاستبيان
            const surveyPayload = {
                title: survey.title,
                description: survey.description || null,
                is_anonymous: survey.is_anonymous,
                is_required: survey.is_required,
                start_date: survey.start_date || null,
                end_date: survey.end_date || null,
                status: publish ? 'active' : 'draft',
                created_by: user?.id,
                scoring_type: survey.scoring_type || 'manual_points',
                include_optional_in_scoring: survey.include_optional_in_scoring || false,
                allow_edits: survey.allow_edits || false,
                edit_limit_hours: survey.edit_limit_hours || 24,
                updated_at: new Date().toISOString()
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('surveys')
                    .update(surveyPayload)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('surveys')
                    .insert(surveyPayload)
                    .select('id')
                    .single();
                if (error) throw error;
                surveyId = data.id;
            }

            // حذف الأسئلة القديمة (للتبسيط) - يمكن تحسينها لاحقاً
            if (isEditing) {
                await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
            }

            // حفظ الأسئلة الجديدة
            const questionsPayload = questions.map((q, idx) => ({
                survey_id: surveyId,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options.length > 0 ? q.options : null,
                is_required: q.is_required,
                order_index: idx,
                parent_question_id: q.parent_question_id,
                show_if_answer: q.show_if_answer,
                points_config: q.points_config
            }));

            // نحتاج لحفظ الأسئلة بدون parent_question_id أولاً
            // ثم تحديث الأسئلة التي لها parent_question_id
            const questionsWithoutParent = questionsPayload.map(q => ({
                ...q,
                parent_question_id: null // سنحدثها لاحقاً
            }));

            const { data: savedQuestions, error: questionsError } = await supabase
                .from('survey_questions')
                .insert(questionsWithoutParent as any)
                .select('id, order_index');

            if (questionsError) throw questionsError;

            // تحديث الارتباطات الشرطية
            const questionIdMap = new Map<string, string>();
            questions.forEach((q, idx) => {
                const savedQ = savedQuestions?.find(sq => sq.order_index === idx);
                if (savedQ) {
                    questionIdMap.set(q.id, savedQ.id);
                }
            });

            // تحديث parent_question_id للأسئلة التي لها ارتباط شرطي
            for (const q of questions) {
                if (q.parent_question_id) {
                    const newQuestionId = questionIdMap.get(q.id);
                    const newParentId = questionIdMap.get(q.parent_question_id);
                    if (newQuestionId && newParentId) {
                        await supabase
                            .from('survey_questions')
                            .update({
                                parent_question_id: newParentId,
                                show_if_answer: q.show_if_answer
                            })
                            .eq('id', newQuestionId);
                    }
                }
            }

            // إضافة سجل النشاط
            await supabase.from('survey_activity_logs').insert({
                survey_id: surveyId,
                action: isEditing ? 'edited' : 'created',
                performed_by: user?.id,
                details: { questions_count: questions.length }
            });

            // إرسال إشعار عند النشر
            if (publish) {
                await supabase.from('notifications').insert({
                    title: 'استبيان جديد متاح',
                    message: `يرجى المشاركة في الاستبيان: ${survey.title}`,
                    type: 'info',
                    target_role: 'teacher',
                    read: false
                });

                await supabase.from('survey_activity_logs').insert({
                    survey_id: surveyId,
                    action: 'published',
                    performed_by: user?.id
                });
            }

            toast.success(publish ? 'تم نشر الاستبيان وإرسال إشعار للأساتذة' : 'تم حفظ الاستبيان');
            navigate('/admin/surveys');
        } catch (error) {
            console.error('Error saving survey:', error);
            toast.error('حدث خطأ في حفظ الاستبيان');
        } finally {
            setSaving(false);
            setPublishing(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout title={isEditing ? "تعديل الاستبيان" : "إنشاء استبيان جديد"}>
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title={isEditing ? "تعديل الاستبيان" : "إنشاء استبيان جديد"} userName={user?.name}>
            <div className="space-y-4 md:space-y-6 animate-fade-in">
                {/* شريط التنقل */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/surveys')}
                            className="h-9 px-3"
                        >
                            <ArrowRight className="w-4 h-4 me-2" />
                            رجوع
                        </Button>
                        <div className="flex bg-muted rounded-lg p-1 flex-1 md:flex-none">
                            <Button
                                variant={activeTab === 'details' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTab('details')}
                                className="flex-1 md:flex-none h-7"
                            >
                                التفاصيل
                            </Button>
                            <Button
                                variant={activeTab === 'questions' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTab('questions')}
                                className="flex-1 md:flex-none h-7"
                            >
                                الأسئلة ({questions.length})
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => saveSurvey(false)}
                            disabled={saving || publishing}
                            className="flex-1 md:flex-none h-9"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Save className="w-4 h-4 me-2" />}
                            حفظ كمسودة
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    disabled={saving || publishing}
                                    className="bg-primary hover:bg-primary/90 flex-1 md:flex-none h-9 text-white gap-2 shadow-emerald-sm"
                                >
                                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                                    نشر الاستبيان
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[400px]">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد من نشر الاستبيان؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        سيتم نشر الاستبيان وسيتمكن المعلمون من البدء في تعبئته. يمكنك تعديله لاحقاً ولكن قد يؤثر ذلك على البيانات المجموعة.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse gap-2">
                                    <AlertDialogAction
                                        onClick={() => saveSurvey(true)}
                                        className="flex-1 bg-primary hover:bg-primary/90"
                                    >
                                        تأكيد النشر
                                    </AlertDialogAction>
                                    <AlertDialogCancel className="flex-1 mt-0">
                                        إلغاء
                                    </AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {/* تبويب التفاصيل */}
                {activeTab === 'details' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>تفاصيل الاستبيان</CardTitle>
                                <CardDescription>أدخل المعلومات الأساسية للاستبيان</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>عنوان الاستبيان *</Label>
                                    <Input
                                        value={survey.title}
                                        onChange={(e) => setSurvey(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="أدخل عنوان الاستبيان..."
                                        className="text-lg"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>وصف الاستبيان</Label>
                                    <Textarea
                                        value={survey.description}
                                        onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="أدخل وصفاً مختصراً للاستبيان..."
                                        rows={3}
                                    />
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <Label>استبيان مجهول</Label>
                                            <p className="text-sm text-muted-foreground">إخفاء هوية المجيب</p>
                                        </div>
                                        <Switch
                                            checked={survey.is_anonymous}
                                            onCheckedChange={(checked) => setSurvey(prev => ({ ...prev, is_anonymous: checked }))}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <Label>استبيان إلزامي</Label>
                                            <p className="text-sm text-muted-foreground">يجب على الجميع الإجابة</p>
                                        </div>
                                        <Switch
                                            checked={survey.is_required}
                                            onCheckedChange={(checked) => setSurvey(prev => ({ ...prev, is_required: checked }))}
                                        />
                                    </div>

                                    <div className={`flex items-center justify-between p-4 rounded-lg transition-all ${survey.allow_edits ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <Label>السماح بتعديل الإجابة</Label>
                                                    <p className="text-sm text-muted-foreground">تمكين الأساتذة من تعديل إجاباتهم بعد الإرسال</p>
                                                </div>
                                                <Switch
                                                    checked={survey.allow_edits}
                                                    onCheckedChange={(checked) => setSurvey(prev => ({ ...prev, allow_edits: checked }))}
                                                />
                                            </div>
                                            {survey.allow_edits && (
                                                <div className="flex items-center gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
                                                    <Label className="text-xs whitespace-nowrap">مدة التعديل المتاحة (بالساعات):</Label>
                                                    <Input
                                                        type="number"
                                                        value={survey.edit_limit_hours}
                                                        onChange={(e) => setSurvey(prev => ({ ...prev, edit_limit_hours: parseInt(e.target.value) || 0 }))}
                                                        className="w-24 h-8 text-center"
                                                        min={1}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <Label className="text-base font-semibold">نظام احتساب الدرجات</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setSurvey(prev => ({ ...prev, scoring_type: 'manual_points' }))}
                                            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-right ${survey.scoring_type === 'manual_points' || !survey.scoring_type
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-muted hover:border-muted-foreground/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`p-2 rounded-lg ${survey.scoring_type === 'manual_points' || !survey.scoring_type ? 'bg-primary text-white' : 'bg-muted'}`}>
                                                    <Star className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold">نقاط مخصصة</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">تحديد نقاط لكل إجابة بشكل يدوي</p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSurvey(prev => ({ ...prev, scoring_type: 'required_questions' }))}
                                            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-right ${survey.scoring_type === 'required_questions'
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-muted hover:border-muted-foreground/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`p-2 rounded-lg ${survey.scoring_type === 'required_questions' ? 'bg-primary text-white' : 'bg-muted'}`}>
                                                    <ListChecks className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold">نسبة الأسئلة المكتملة</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">نسبة الأسئلة التي تم الإجابة عليها</p>
                                        </button>
                                    </div>

                                    {survey.scoring_type === 'required_questions' && (
                                        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg mt-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <Label>احتساب الأسئلة غير الإلزامية في النسبة</Label>
                                                <p className="text-sm text-muted-foreground">عند التفعيل، سيتم احتساب نقاط الأسئلة الاختيارية ضمن المجموع الكلي</p>
                                            </div>
                                            <Switch
                                                checked={survey.include_optional_in_scoring}
                                                onCheckedChange={(checked) => setSurvey(prev => ({ ...prev, include_optional_in_scoring: checked }))}
                                            />
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>تاريخ البداية (اختياري)</Label>
                                        <Input
                                            type="date"
                                            value={survey.start_date}
                                            onChange={(e) => setSurvey(prev => ({ ...prev, start_date: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>تاريخ الانتهاء (اختياري)</Label>
                                        <Input
                                            type="date"
                                            value={survey.end_date}
                                            onChange={(e) => setSurvey(prev => ({ ...prev, end_date: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={() => setShowEditConfirm(true)}>
                                        التالي: الأسئلة
                                        <ArrowLeft className="w-4 h-4 me-2" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* تبويب الأسئلة */}
                {activeTab === 'questions' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>أسئلة الاستبيان</CardTitle>
                                        <CardDescription>أضف وعدّل أسئلة الاستبيان</CardDescription>
                                    </div>
                                    <Button onClick={addQuestion} className="gap-2">
                                        <Plus className="w-4 h-4" />
                                        إضافة سؤال
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>

                        {questions.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>لا توجد أسئلة بعد</p>
                                    <Button variant="link" onClick={addQuestion}>
                                        إضافة سؤال جديد
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={questions.map(q => q.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-3">
                                        {questions.map((question, idx) => (
                                            <SortableQuestion
                                                key={question.id}
                                                question={question}
                                                index={idx}
                                                onUpdate={updateQuestion}
                                                onDelete={deleteQuestion}
                                                onAddOption={addOption}
                                                onUpdateOption={updateOption}
                                                onDeleteOption={deleteOption}
                                                questions={questions}
                                                expanded={expandedQuestions.has(question.id)}
                                                onToggleExpand={() => toggleExpand(question.id)}
                                                scoringType={survey.scoring_type || 'manual_points'}
                                                onMoveUp={() => handleMoveUp(idx)}
                                                onMoveDown={() => handleMoveDown(idx)}
                                                isFirst={idx === 0}
                                                isLast={idx === questions.length - 1}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}

                        {questions.length > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <Button variant="outline" onClick={addQuestion} className="w-full sm:w-auto gap-2 h-10 px-6 border-dashed hover:border-primary hover:bg-primary/5 transition-all">
                                    <Plus className="w-4 h-4" />
                                    إضافة سؤال آخر
                                </Button>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 h-10 px-8 shadow-emerald-sm transition-all">
                                            <Rocket className="w-4 h-4" />
                                            نشر الاستبيان الآن
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-[400px]">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>هل أنت متأكد من نشر الاستبيان؟</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                سيتم نشر الاستبيان وسيتمكن المعلمون من البدء في تعبئته. يمكنك تعديله لاحقاً ولكن قد يؤثر ذلك على البيانات المجموعة.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="flex-row-reverse gap-2">
                                            <AlertDialogAction
                                                onClick={() => saveSurvey(true)}
                                                className="flex-1 bg-primary hover:bg-primary/90"
                                            >
                                                تأكيد النشر
                                            </AlertDialogAction>
                                            <AlertDialogCancel className="flex-1 mt-0">
                                                إلغاء
                                            </AlertDialogCancel>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* نافذة تأكيد إعدادات التعديل */}
            <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
                <AlertDialogContent dir="rtl" className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>إعدادات تعديل الإجابات</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل تريد السماح للأساتذة بتعديل إجاباتهم بعد الإرسال؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="text-base">السماح بتعديل الإجابة</Label>
                                <p className="text-xs text-muted-foreground italic">تمكين هذا الخيار يسمح للأستاذ بتغيير إجابته</p>
                            </div>
                            <Switch
                                checked={survey.allow_edits}
                                onCheckedChange={(checked) => setSurvey(prev => ({ ...prev, allow_edits: checked }))}
                            />
                        </div>

                        {survey.allow_edits && (
                            <div className="space-y-2 px-1">
                                <Label className="text-sm font-medium">المدة المسموح بها للتعديل (بالساعات)</Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={survey.edit_limit_hours}
                                        onChange={(e) => setSurvey(prev => ({ ...prev, edit_limit_hours: parseInt(e.target.value) || 24 }))}
                                        className="w-24 font-bold text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">ساعة من وقت الإرسال</span>
                                </div>
                                <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                                    * بعد انقضاء هذه المدة، سيتمكن الأستاذ من "عرض" إجاباته فقط دون القدرة على تعديلها.
                                </p>
                            </div>
                        )}
                    </div>

                    <AlertDialogFooter className="gap-2">
                        <AlertDialogAction
                            onClick={() => setActiveTab('questions')}
                            className="w-full sm:w-auto"
                        >
                            تأكيد ومتابعة
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default AdminSurveyBuilder;
