import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { studentId, date } = await req.json();

    // Get the last 3 attendance records for this student on teaching days
    const { data: recentAttendance, error: attendanceError } = await supabaseClient
      .from('attendance')
      .select('status, date')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(3);

    if (attendanceError) throw attendanceError;

    if (!recentAttendance || recentAttendance.length < 3) {
      return new Response(
        JSON.stringify({ message: 'Not enough attendance records' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if all 3 are absences
    const allAbsent = recentAttendance.every(a => a.status === 'غائب');

    if (allAbsent) {
      // Get student and teacher info
      const { data: student, error: studentError } = await supabaseClient
        .from('students')
        .select('student_name, phone, current_teacher, teacher_id')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // Send notification to admin
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          title: '⚠️ غياب متكرر',
          body: `الطالب ${student.student_name} غائب 3 مرات متتالية\nهاتف ولي الأمر: ${student.phone}`,
          tag: `absence-${studentId}`,
          targetRoles: ['admin'],
          data: {
            type: 'consecutive_absence',
            studentId,
            studentName: student.student_name,
            phone: student.phone,
          },
        }),
      });

      // Send notification to teacher
      if (student.teacher_id) {
        const { data: teacher } = await supabaseClient
          .from('teachers')
          .select('user_id')
          .eq('id', student.teacher_id)
          .single();

        if (teacher?.user_id) {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              title: '⚠️ تنبيه غياب',
              body: `الطالب ${student.student_name} غائب 3 مرات متتالية`,
              tag: `absence-teacher-${studentId}`,
              targetUserIds: [teacher.user_id],
              data: {
                type: 'consecutive_absence',
                studentId,
                studentName: student.student_name,
              },
            }),
          });
        }
      }

      return new Response(
        JSON.stringify({ message: 'Notifications sent for consecutive absences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'No consecutive absences detected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error checking absences:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});