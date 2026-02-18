import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // التحقق من صلاحيات المدير
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // التحقق من أن المستخدم مدير
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: backupData, mode } = await req.json();

    console.log('Importing backup with mode:', mode);

    // التحقق من وجود metadata
    if (!backupData._metadata) {
      return new Response(JSON.stringify({ error: 'Invalid backup file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ترتيب الجداول بحسب الاعتماديات (من الأساسي إلى المعتمد)
    const insertionOrder = [
      'mosques', 'check_items', 'profiles', 'user_roles',
      'teachers', 'teacher_applications', 'students', 'classes', 'students_profiles', 'guardianships', 'points_settings', 'points_balance',
      'surveys', 'survey_questions', 'survey_submissions', 'survey_responses', 'survey_activity_logs',
      'attendance', 'recitations', 'bonus_points', 'check_records', 'tool_reissues', 'tool_loss_history',
      'student_notes', 'student_teacher_history', 'activities', 'competitions', 'competition_results',
      'teaching_sessions', 'monthly_reports', 'activity_logs', 'notifications', 'grade_promotions',
      'backups'
    ];

    const tables = backupData._metadata?.tables || Object.keys(backupData).filter((k) => k !== '_metadata');

    // فلترة الجداول الموجودة في النسخة الاحتياطية فقط
    const orderedTables = insertionOrder.filter((t: string) => tables.includes(t));
    const extraTables = tables.filter((t: string) => !insertionOrder.includes(t));
    const allOrderedTables = [...orderedTables, ...extraTables];

    // إذا كان الوضع استبدال، حذف البيانات باستخدام RPC لتجنب الـ timeout
    if (mode === 'replace') {
      console.log('Clearing all existing data via RPC...');
      const { error: clearError } = await supabase.rpc('clear_all_data');
      if (clearError) {
        console.error('Error clearing data via RPC:', clearError);
        // Fallback or throw
        throw new Error(`Failed to clear existing data: ${clearError.message}`);
      }
      console.log('✓ Database cleared successfully');
    }

    // إدراج البيانات بالترتيب الصحيح
    for (const table of allOrderedTables) {
      const tableData = backupData[table];

      if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
        console.log(`Skipping empty table: ${table}`);
        continue;
      }

      console.log(`Importing ${tableData.length} records into ${table}`);

      // تصفية البيانات للجداول التي تحتوي على foreign keys
      let validData = tableData;

      if (table === 'students' && backupData['teachers']) {
        const teacherIds = new Set(backupData['teachers'].map((t: any) => t.id));
        const beforeCount = validData.length;
        validData = validData.filter((s: any) => !s.teacher_id || teacherIds.has(s.teacher_id));
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} students with invalid teacher_id`);
        }
      }

      if (table === 'points_balance' && backupData['students']) {
        const studentIds = new Set(backupData['students'].map((s: any) => s.id));
        const beforeCount = validData.length;
        validData = validData.filter((p: any) => studentIds.has(p.student_id));
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} points_balance records with invalid student_id`);
        }
      }

      if (table === 'attendance' && backupData['students']) {
        const studentIds = new Set(backupData['students'].map((s: any) => s.id));
        const beforeCount = validData.length;
        validData = validData.filter((a: any) => studentIds.has(a.student_id));
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} attendance records with invalid student_id`);
        }
      }

      if (table === 'recitations' && (backupData['students'] || backupData['teachers'])) {
        const studentIds = backupData['students'] ? new Set(backupData['students'].map((s: any) => s.id)) : null;
        const teacherIds = backupData['teachers'] ? new Set(backupData['teachers'].map((t: any) => t.id)) : null;
        const beforeCount = validData.length;
        validData = validData.filter((r: any) =>
          (!studentIds || studentIds.has(r.student_id)) && (!teacherIds || teacherIds.has(r.teacher_id))
        );
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} recitations with invalid IDs`);
        }
      }

      if (table === 'bonus_points' && (backupData['students'] || backupData['teachers'])) {
        const studentIds = backupData['students'] ? new Set(backupData['students'].map((s: any) => s.id)) : null;
        const teacherIds = backupData['teachers'] ? new Set(backupData['teachers'].map((t: any) => t.id)) : null;
        const beforeCount = validData.length;
        validData = validData.filter((b: any) =>
          (!studentIds || studentIds.has(b.student_id)) && (!teacherIds || teacherIds.has(b.teacher_id))
        );
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} bonus_points with invalid IDs`);
        }
      }

      if (table === 'check_records' && (backupData['students'] || backupData['check_items'])) {
        const studentIds = backupData['students'] ? new Set(backupData['students'].map((s: any) => s.id)) : null;
        const itemIds = backupData['check_items'] ? new Set(backupData['check_items'].map((i: any) => i.id)) : null;
        const beforeCount = validData.length;
        validData = validData.filter((c: any) =>
          (!studentIds || studentIds.has(c.student_id)) && (!itemIds || itemIds.has(c.item_id))
        );
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} check_records with invalid IDs`);
        }
      }

      // التحقق من صحة بيانات الاستبيانات
      if (table === 'survey_questions' && backupData['surveys']) {
        const surveyIds = new Set(backupData['surveys'].map((s: any) => s.id));
        const beforeCount = validData.length;
        validData = validData.filter((q: any) => surveyIds.has(q.survey_id));
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} survey_questions with invalid survey_id`);
        }
      }

      if (table === 'survey_submissions' && backupData['surveys'] && backupData['teachers']) {
        const surveyIds = new Set(backupData['surveys'].map((s: any) => s.id));
        const teacherIds = new Set(backupData['teachers'].map((t: any) => t.id));
        const beforeCount = validData.length;
        validData = validData.filter((sub: any) =>
          surveyIds.has(sub.survey_id) && (!sub.teacher_id || teacherIds.has(sub.teacher_id))
        );
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} survey_submissions with invalid IDs`);
        }
      }

      if (table === 'survey_responses' && backupData['survey_submissions'] && backupData['survey_questions']) {
        const submissionIds = new Set(backupData['survey_submissions'].map((s: any) => s.id));
        const questionIds = new Set(backupData['survey_questions'].map((q: any) => q.id));
        const beforeCount = validData.length;
        validData = validData.filter((r: any) =>
          submissionIds.has(r.submission_id) && questionIds.has(r.question_id)
        );
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} survey_responses with invalid IDs`);
        }
      }

      if (table === 'survey_activity_logs' && backupData['surveys']) {
        const surveyIds = new Set(backupData['surveys'].map((s: any) => s.id));
        const beforeCount = validData.length;
        validData = validData.filter((log: any) => surveyIds.has(log.survey_id));
        if (beforeCount !== validData.length) {
          console.log(`Filtered ${beforeCount - validData.length} survey_activity_logs with invalid survey_id`);
        }
      }

      if (validData.length === 0) {
        console.log(`No valid data to import for ${table}`);
        continue;
      }

      const batchSize = 500;
      for (let i = 0; i < validData.length; i += batchSize) {
        const batch = validData.slice(i, i + batchSize);

        // استخدام upsert للتعامل مع السجلات المكررة
        // للجداول التي لها unique constraints متعددة، نستخدم onConflict مناسب
        let upsertOptions: any = {
          ignoreDuplicates: mode === 'merge'
        };

        if (table === 'attendance') {
          upsertOptions.onConflict = 'student_id,date';
        } else if (table === 'points_balance') {
          upsertOptions.onConflict = 'student_id';
        } else if (table === 'user_roles') {
          upsertOptions.onConflict = 'user_id,role';
        } else if (table === 'points_settings') {
          upsertOptions.onConflict = 'category,key';
        } else if (table === 'guardianships') {
          upsertOptions.onConflict = 'parent_id,student_id';
        } else if (table === 'teaching_sessions') {
          upsertOptions.onConflict = 'teacher_id,session_date';
        } else if (table === 'tool_reissues') {
          upsertOptions.onConflict = 'student_id,item_id';
        } else {
          // default: use id as conflict key
          upsertOptions.onConflict = 'id';
        }

        const { error: insertError } = await supabase
          .from(table)
          .upsert(batch, upsertOptions);

        if (insertError) {
          console.error(`Error upserting batch into ${table}:`, insertError);

          if (mode === 'replace') {
            throw insertError;
          }
        }
      }

      console.log(`✓ Completed importing ${table}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Backup imported successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-backup:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
