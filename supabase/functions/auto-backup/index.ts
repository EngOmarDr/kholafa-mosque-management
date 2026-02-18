import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// قائمة الجداول للنسخ الاحتياطي التلقائي
const BACKUP_TABLES = [
  // الجداول الأساسية (بدون تاريخ - تُنسخ بالكامل)
  { id: 'students', hasDate: false },
  { id: 'teachers', hasDate: false },
  { id: 'profiles', hasDate: false },
  { id: 'user_roles', hasDate: false },
  { id: 'points_balance', hasDate: false },
  { id: 'points_settings', hasDate: false },
  { id: 'check_items', hasDate: false },
  { id: 'classes', hasDate: false },
  { id: 'mosques', hasDate: false },
  { id: 'students_profiles', hasDate: false },
  { id: 'guardianships', hasDate: false },

  // السجلات اليومية (لها حقل تاريخ)
  { id: 'attendance', hasDate: true, dateField: 'date' },
  { id: 'recitations', hasDate: true, dateField: 'date' },
  { id: 'bonus_points', hasDate: true, dateField: 'date' },
  { id: 'check_records', hasDate: true, dateField: 'date' },
  { id: 'teaching_sessions', hasDate: true, dateField: 'session_date' },
  { id: 'activity_logs', hasDate: true, dateField: 'activity_date' },
  { id: 'student_teacher_history', hasDate: true, dateField: 'change_date' },
  { id: 'tool_loss_history', hasDate: true, dateField: 'event_date' },

  // بيانات إضافية (بدون تاريخ)
  { id: 'student_notes', hasDate: false },
  { id: 'monthly_reports', hasDate: false },
  { id: 'competitions', hasDate: false },
  { id: 'competition_results', hasDate: false },
  { id: 'tool_reissues', hasDate: false },
  { id: 'notifications', hasDate: false },
  { id: 'grade_promotions', hasDate: false },

  // نظام الاستبيانات
  { id: 'surveys', hasDate: false },
  { id: 'survey_questions', hasDate: false },
  { id: 'survey_submissions', hasDate: true, dateField: 'submitted_at' },
  { id: 'survey_responses', hasDate: false },
  { id: 'survey_activity_logs', hasDate: true, dateField: 'created_at' },
  { id: 'activities', hasDate: true, dateField: 'date' },
  { id: 'teacher_applications', hasDate: false },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // الحصول على معلومات الطلب
    const body = await req.json().catch(() => ({}));
    const backupType = body.type || 'daily'; // daily, weekly, monthly, full
    const triggeredBy = body.triggeredBy || 'cron'; // cron, manual
    const retentionCount = body.retentionCount || 30; // عدد النسخ المحفوظة
    const fullBackupOnly = body.fullBackupOnly !== false; // نسخ كاملة بدون فلترة

    console.log(`Starting ${backupType} auto-backup, triggered by: ${triggeredBy}, retention: ${retentionCount}, fullBackup: ${fullBackupOnly}`);

    // حساب نطاق التاريخ بناءً على نوع النسخة
    const today = new Date();
    let dateFrom: Date;

    switch (backupType) {
      case 'weekly':
        dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        dateFrom = new Date(today);
        dateFrom.setMonth(today.getMonth() - 1);
        break;
      case 'full':
        dateFrom = new Date('2020-01-01');
        break;
      default: // daily
        dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - 1);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const dateFromStr = formatDate(dateFrom);
    const dateToStr = formatDate(today);

    console.log(`Backup date range: ${dateFromStr} to ${dateToStr}`);

    // جمع البيانات
    const backupData: Record<string, any> = {};
    let totalRecords = 0;
    const errors: string[] = [];

    for (const table of BACKUP_TABLES) {
      try {
        let query = supabase.from(table.id).select('*');

        // فلترة بالتاريخ للجداول التي لديها حقل تاريخ 
        // فقط إذا كان fullBackupOnly = false ونوع النسخة ليس full
        if (table.hasDate && table.dateField && !fullBackupOnly && backupType !== 'full') {
          query = query.gte(table.dateField, dateFromStr).lte(table.dateField, dateToStr);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`Error fetching ${table.id}:`, error.message);
          errors.push(`${table.id}: ${error.message}`);
          backupData[table.id] = [];
          continue;
        }

        backupData[table.id] = data || [];
        totalRecords += data?.length || 0;
        console.log(`Backed up ${table.id}: ${data?.length || 0} records`);
      } catch (tableError) {
        console.error(`Exception fetching ${table.id}:`, tableError);
        errors.push(`${table.id}: ${String(tableError)}`);
        backupData[table.id] = [];
      }
    }

    // إضافة metadata
    backupData._metadata = {
      created_at: new Date().toISOString(),
      backup_type: backupType,
      triggered_by: triggeredBy,
      date_range: { from: dateFromStr, to: dateToStr },
      tables_count: BACKUP_TABLES.length,
      total_records: totalRecords,
      errors: errors.length > 0 ? errors : undefined,
      full_backup: fullBackupOnly || backupType === 'full',
      retention_count: retentionCount,
      version: '2.1',
    };

    // إنشاء اسم الملف
    const timestamp = today.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `auto-backup_${backupType}_${timestamp}.json`;

    // تحويل البيانات إلى JSON
    const jsonContent = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });

    // رفع الملف إلى Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, blob, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading backup:', uploadError);
      throw uploadError;
    }

    console.log('Backup uploaded successfully:', uploadData.path);

    // حفظ السجل في جدول backups
    const { error: insertError } = await supabase.from('backups').insert({
      file_name: fileName,
      file_size: jsonContent.length,
      file_type: 'json',
      file_url: uploadData.path,
      date_range_from: dateFromStr,
      date_range_to: dateToStr,
      tables_included: BACKUP_TABLES.map(t => t.id),
      created_by: null, // تلقائي
    });

    if (insertError) {
      console.error('Error saving backup record:', insertError);
      // لا نرمي خطأ هنا لأن الملف تم رفعه بنجاح
    }

    // حذف النسخ القديمة بناءً على retentionCount
    const { data: oldBackups } = await supabase
      .from('backups')
      .select('id, file_url, created_at')
      .like('file_name', 'auto-backup_%')
      .order('created_at', { ascending: false });

    if (oldBackups && oldBackups.length > retentionCount) {
      const toDelete = oldBackups.slice(retentionCount);
      console.log(`Cleaning up ${toDelete.length} old auto-backups (keeping ${retentionCount})`);

      for (const backup of toDelete) {
        await supabase.storage.from('backups').remove([backup.file_url]);
        await supabase.from('backups').delete().eq('id', backup.id);
      }
    }

    // إنشاء إشعار للمدير
    await supabase.from('notifications').insert({
      title: '✅ نسخة احتياطية تلقائية',
      message: `تم إنشاء نسخة احتياطية ${backupType === 'daily' ? 'يومية' : backupType === 'weekly' ? 'أسبوعية' : 'شهرية'} بنجاح. (${totalRecords} سجل)`,
      type: 'info',
      target_role: 'admin',
      read: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم إنشاء النسخة الاحتياطية التلقائية بنجاح',
        backup: {
          fileName,
          fileSize: jsonContent.length,
          totalRecords,
          dateRange: { from: dateFromStr, to: dateToStr },
          tablesCount: BACKUP_TABLES.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auto-backup:', error);

    // محاولة إنشاء إشعار بالفشل
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('notifications').insert({
        title: '❌ فشل النسخ الاحتياطي التلقائي',
        message: `حدث خطأ أثناء إنشاء النسخة الاحتياطية: ${(error as Error).message}`,
        type: 'alert',
        target_role: 'admin',
        read: false,
      });
    } catch (e) {
      console.error('Failed to create error notification:', e);
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
