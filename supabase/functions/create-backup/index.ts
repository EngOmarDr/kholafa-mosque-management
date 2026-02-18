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

    const { dateFrom, dateTo, tables, tablesWithDate, tablesWithoutDate, format } = await req.json();

    console.log('Creating backup:', { dateFrom, dateTo, tables, tablesWithDate, tablesWithoutDate, format });

    // جمع البيانات من الجداول المحددة
    const backupData: any = {};

    // تعريف أسماء أعمدة التاريخ لكل جدول
    const tableDateFields: Record<string, string> = {
      attendance: 'date',
      recitations: 'date',
      bonus_points: 'date',
      check_records: 'date',
      teaching_sessions: 'session_date',
      activity_logs: 'activity_date',
      student_teacher_history: 'change_date',
      tool_loss_history: 'event_date',
      survey_submissions: 'submitted_at',
      survey_activity_logs: 'created_at',
    };

    for (const table of tables) {
      try {
        let query = supabase.from(table).select('*');

        // فلترة بالتاريخ فقط للجداول التي لديها حقل تاريخ
        const isTableWithDate = tablesWithDate?.includes(table);
        const dateField = tableDateFields[table];

        if (isTableWithDate && dateField) {
          query = query.gte(dateField, dateFrom).lte(dateField, dateTo);
        }
        // الجداول بدون تاريخ تُنسخ بالكامل

        const { data, error } = await query;

        if (error) {
          console.error(`Error fetching ${table}:`, error);
          // متابعة مع الجداول الأخرى بدلاً من الفشل الكامل
          backupData[table] = [];
          backupData[`_error_${table}`] = error.message;
          continue;
        }

        backupData[table] = data || [];
        console.log(`Backed up ${table}: ${data?.length || 0} records`);
      } catch (tableError) {
        console.error(`Exception fetching ${table}:`, tableError);
        backupData[table] = [];
        backupData[`_error_${table}`] = String(tableError);
      }
    }

    // إضافة metadata
    backupData._metadata = {
      created_at: new Date().toISOString(),
      created_by: user.id,
      date_range: { from: dateFrom, to: dateTo },
      tables: tables,
      version: '1.0',
    };

    if (format === 'json') {
      return new Response(
        JSON.stringify({ success: true, data: backupData }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else if (format === 'csv') {
      // تحويل إلى CSV
      const csvData: any = {};

      for (const [tableName, tableData] of Object.entries(backupData)) {
        if (tableName === '_metadata') continue;

        const data = tableData as any[];
        if (!data.length) {
          csvData[tableName] = '';
          continue;
        }

        // إنشاء CSV
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row: any) =>
          Object.values(row)
            .map((v) => {
              if (v === null || v === undefined) return '';
              const str = String(v);
              // تنظيف القيم التي تحتوي على فواصل أو علامات اقتباس
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(',')
        );

        csvData[tableName] = [headers, ...rows].join('\n');
      }

      // في الواقع، يجب إنشاء ZIP هنا، لكن لتبسيط الأمور سنرجع JSON مع CSV
      // في بيئة production، يمكن استخدام مكتبة ZIP مثل jszip
      return new Response(
        JSON.stringify({ success: true, data: csvData }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-backup:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
