import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Student inquiry request received');
    
    // Get query parameters
    const url = new URL(req.url);
    const studentId = url.searchParams.get('id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.log('Parameters:', { studentId, startDate, endDate });

    // Validate student ID
    if (!studentId) {
      return new Response(
        JSON.stringify({ error: 'معرف الطالب مطلوب' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!isValidUUID(studentId)) {
      return new Response(
        JSON.stringify({ error: 'معرف الطالب غير صالح' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch student basic info
    console.log('Fetching student info...');
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_name, grade, current_teacher, mosque_name, photo_url')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student not found:', studentError);
      return new Response(
        JSON.stringify({ error: 'الطالب غير موجود' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Student found:', student.student_name);

    // Fetch points balance
    console.log('Fetching points balance...');
    const { data: pointsBalance, error: pointsError } = await supabase
      .from('points_balance')
      .select('total, attendance_points, recitation_points, bonus_points')
      .eq('student_id', studentId)
      .maybeSingle();

    if (pointsError) {
      console.error('Error fetching points:', pointsError);
    }

    // Build attendance query with date filter
    let attendanceQuery = supabase
      .from('attendance')
      .select('id, date, status, recitation_quality, points')
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('date', startDate);
    }
    if (endDate) {
      attendanceQuery = attendanceQuery.lte('date', endDate);
    }

    console.log('Fetching attendance...');
    const { data: attendance, error: attendanceError } = await attendanceQuery;

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
    }

    // Build recitations query with date filter
    let recitationsQuery = supabase
      .from('recitations')
      .select('id, date, rating, last_saved, notes, points_awarded')
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (startDate) {
      recitationsQuery = recitationsQuery.gte('date', startDate);
    }
    if (endDate) {
      recitationsQuery = recitationsQuery.lte('date', endDate);
    }

    console.log('Fetching recitations...');
    const { data: recitations, error: recitationsError } = await recitationsQuery;

    if (recitationsError) {
      console.error('Error fetching recitations:', recitationsError);
    }

    // Build check_records query with date filter and join with check_items
    let checkRecordsQuery = supabase
      .from('check_records')
      .select(`
        id,
        date,
        status,
        points,
        item_id,
        check_items (
          name
        )
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (startDate) {
      checkRecordsQuery = checkRecordsQuery.gte('date', startDate);
    }
    if (endDate) {
      checkRecordsQuery = checkRecordsQuery.lte('date', endDate);
    }

    console.log('Fetching check records...');
    const { data: checkRecords, error: checkRecordsError } = await checkRecordsQuery;

    if (checkRecordsError) {
      console.error('Error fetching check records:', checkRecordsError);
    }

    // Build bonus_points query with date filter
    let bonusPointsQuery = supabase
      .from('bonus_points')
      .select('id, date, reason, points')
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (startDate) {
      bonusPointsQuery = bonusPointsQuery.gte('date', startDate);
    }
    if (endDate) {
      bonusPointsQuery = bonusPointsQuery.lte('date', endDate);
    }

    console.log('Fetching bonus points...');
    const { data: bonusPoints, error: bonusPointsError } = await bonusPointsQuery;

    if (bonusPointsError) {
      console.error('Error fetching bonus points:', bonusPointsError);
    }

    // Prepare response data
    const responseData = {
      student: {
        id: student.id,
        student_name: student.student_name,
        grade: student.grade,
        current_teacher: student.current_teacher,
        mosque_name: student.mosque_name,
        photo_url: student.photo_url,
      },
      points_balance: pointsBalance || {
        total: 0,
        attendance_points: 0,
        recitation_points: 0,
        bonus_points: 0,
      },
      attendance: attendance || [],
      recitations: recitations || [],
      check_records: checkRecords || [],
      bonus_points: bonusPoints || [],
      date_filter: {
        start_date: startDate,
        end_date: endDate,
      },
    };

    console.log('Successfully fetched all data');

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'حدث خطأ أثناء جلب البيانات',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
