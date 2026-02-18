// Supabase Edge Function: add-student
// Inserts a new student and creates an admin notification

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  student_name: string;
  phone?: string | null;
  grade?: string | null;
  father_name?: string | null;
  social_status?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  address?: string | null;
  registration_status?: string | null;
  mosque_name?: string | null;
  notes?: string | null;
  student_tools?: string[];
  photo_url?: string | null;
  received_tools?: string[];
  registration_date?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const payload = (await req.json().catch(() => ({}))) as Partial<Payload>;

    const name = (payload.student_name || "").toString().trim();
    if (!name) {
      return new Response(JSON.stringify({ error: { message: "student_name is required" } }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalize = (v: unknown) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    // Resolve teacher name: prefer teacher_name from payload, else try to load from teachers by teacher_id
    let currentTeacher: string | null = (normalize(payload.teacher_name) as string | null) ?? null;
    const teacherId = normalize(payload.teacher_id) as string | null;
    if (!currentTeacher && teacherId) {
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("اسم الاستاذ")
        .eq("id", teacherId)
        .maybeSingle();
      const teacherName = (teacherRow as Record<string, unknown> | null)?.["اسم الاستاذ"] as string | undefined;
      currentTeacher = teacherName ?? null;
    }

    const insertRow: Record<string, unknown> = {
      student_name: name,
      phone: normalize(payload.phone),
      grade: normalize(payload.grade),
      father_name: normalize(payload.father_name),
      social_status: normalize(payload.social_status),
      teacher_id: teacherId,
      current_teacher: currentTeacher,
      address: normalize(payload.address),
      registration_status: normalize(payload.registration_status) ?? "مسجل",
      mosque_name: normalize(payload.mosque_name),
      notes: normalize(payload.notes),
      student_tools: payload.student_tools || [],
      received_tools: payload.received_tools || [],
      photo_url: normalize(payload.photo_url),
      registration_date: normalize(payload.registration_date) ?? new Date().toISOString().split('T')[0],
    };

    const { data: inserted, error: insErr } = await supabase
      .from("students")
      .insert(insertRow)
      .select("id, student_name, mosque_name")
      .maybeSingle();

    if (insErr) {
      return new Response(
        JSON.stringify({ error: { message: insErr.message, code: (insErr as any).code, details: (insErr as any).details } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Best-effort notification
    if (inserted) {
      await supabase.from("notifications").insert({
        title: "إضافة طالب جديد",
        message: `تم تسجيل الطالب ${inserted.student_name}${inserted.mosque_name ? ` في مسجد ${inserted.mosque_name}` : ""}`,
        target_role: "admin",
      });
    }

    return new Response(JSON.stringify({ ok: true, id: inserted?.id }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    const err = e as any;
    return new Response(
      JSON.stringify({ error: { message: err?.message ?? String(e), code: err?.code, details: err?.details } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
