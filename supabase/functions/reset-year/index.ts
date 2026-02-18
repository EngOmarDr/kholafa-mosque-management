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

    console.log('Starting year reset process...');

    // 1. حذف السجلات اليتيمة أولاً (سجلات بـ student_id غير موجود في students)
    console.log('Deleting orphaned records...');
    const orphanedTables = ['attendance', 'recitations', 'bonus_points', 'check_records', 'points_balance'];
    let orphanedCounts: any = {};

    for (const table of orphanedTables) {
      try {
        const { data: deletedCount, error: orphanError } = await supabase
          .rpc('delete_orphaned_records', { p_table_name: table });

        if (orphanError) {
          console.error(`Error deleting orphaned records from ${table}:`, orphanError);
          orphanedCounts[table] = 0;
        } else {
          orphanedCounts[table] = deletedCount || 0;
          console.log(`✓ Deleted ${deletedCount || 0} orphaned records from ${table}`);
        }
      } catch (err) {
        console.error(`Exception deleting orphaned records from ${table}:`, err);
        orphanedCounts[table] = 0;
      }
    }

    // 2. إنشاء نسخة احتياطية تلقائية في الخلفية (لا تمنع إعادة التعيين إذا فشلت)
    let backupFileName = 'backup_failed';

    const createBackup = async () => {
      try {
        const backupTables = [
          'students', 'teachers', 'attendance', 'recitations', 'bonus_points',
          'points_balance', 'check_records', 'student_notes', 'teaching_sessions',
          'activity_logs', 'competitions', 'competition_results', 'activities',
          'tool_loss_history', 'tool_reissues', 'grade_promotions', 'student_teacher_history',
          'surveys', 'survey_questions', 'survey_submissions', 'survey_responses', 'survey_activity_logs',
        ];

        const backupData: any = {
          _metadata: {
            created_at: new Date().toISOString(),
            type: 'auto_backup_before_reset',
            tables: backupTables
          }
        };

        // جمع البيانات بالتوازي لتسريع العملية
        const dataPromises = backupTables.map(async (table) => {
          const { data } = await supabase.from(table).select('*');
          return { table, data: data || [] };
        });

        const results = await Promise.all(dataPromises);
        results.forEach(({ table, data }) => {
          backupData[table] = data;
        });

        const backupBlob = JSON.stringify(backupData, null, 2);
        backupFileName = `auto_backup_before_reset_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('backups')
          .upload(backupFileName, backupBlob, {
            contentType: 'application/json',
            upsert: true
          });

        if (!uploadError && uploadData) {
          await supabase.from('backups').insert({
            file_name: backupFileName,
            file_size: backupBlob.length,
            file_type: 'json',
            file_url: uploadData.path,
            created_by: user.id,
          });
          console.log('✓ Automatic backup created successfully');
        } else {
          console.error('Failed to upload backup:', uploadError);
        }
      } catch (error) {
        console.error('Error creating automatic backup:', error);
      }
    };

    // بدء النسخة الاحتياطية في الخلفية
    createBackup().catch(console.error);

    // 3. حذف points_balance تماماً (لتجنب مشاكل الـ triggers)
    console.log('Deleting all points_balance records...');
    const { error: deletePointsError } = await supabase
      .from('points_balance')
      .delete()
      .neq('student_id', '00000000-0000-0000-0000-000000000000'); // حذف كل السجلات

    if (deletePointsError) {
      console.error('Error deleting points_balance:', deletePointsError);
    } else {
      console.log('✓ All points_balance records deleted');
    }

    // 4. حذف البيانات السنوية بالترتيب الصحيح
    const tablesToDelete = [
      // حذف بيانات الاستبيانات أولاً
      'survey_activity_logs',
      'survey_responses',
      'survey_submissions',
      'survey_questions',
      'surveys',
      // باقي البيانات السنوية
      'competition_results',
      'competitions',
      'activities',
      'tool_reissues',
      'tool_loss_history',
      'grade_promotions',
      'monthly_reports',
      'notifications',
      'activity_logs',
      'teaching_sessions',
      'student_notes',
      'check_records',
      'bonus_points',
      'recitations',
      'attendance',
      'student_teacher_history',
    ];

    let deletedCounts: any = {
      orphaned_records: orphanedCounts,
      points_balance: 'deleted_all'
    };

    for (const table of tablesToDelete) {
      try {
        const { count: beforeCount, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error(`Error counting ${table}:`, countError);
          deletedCounts[table] = 0;
          continue;
        }

        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          console.error(`Error deleting ${table}:`, deleteError);
          deletedCounts[table] = 0;
        } else {
          deletedCounts[table] = beforeCount || 0;
          console.log(`✓ Deleted ${deletedCounts[table]} records from ${table}`);
        }
      } catch (err) {
        console.error(`Exception deleting ${table}:`, err);
        deletedCounts[table] = 0;
      }
    }

    // 5. إعادة إنشاء points_balance للطلاب الموجودين فقط
    const { data: existingStudents } = await supabase
      .from('students')
      .select('id');

    if (existingStudents && existingStudents.length > 0) {
      console.log(`Recreating points_balance for ${existingStudents.length} students...`);

      const pointsRecords = existingStudents.map(s => ({
        student_id: s.id,
        total: 0,
        attendance_points: 0,
        recitation_points: 0,
        bonus_points: 0,
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('points_balance')
        .insert(pointsRecords);

      if (insertError) {
        console.error('Error recreating points_balance:', insertError);
      } else {
        console.log(`✓ Recreated points_balance for ${existingStudents.length} students`);
        deletedCounts['points_balance_recreated'] = existingStudents.length;
      }
    }
    console.log('Year reset completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم إعادة تعيين السنة بنجاح',
        backup_status: 'جاري إنشاء نسخة احتياطية في الخلفية',
        deleted_counts: deletedCounts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in reset-year:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
