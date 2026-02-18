// Supabase Edge Function: teacher-applications
// Handles listing teacher applications and approving them into teachers table

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create client with anon key first to validate the user token
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Validate user token
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create admin client for database operations
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Admin ${user.id} accessing teacher-applications`);

    const { action, applicationId } = await req.json().catch(() => ({ }));

    if (action === "list") {
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("*")
        .neq("حالة_الطلب", "مقبول")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data || []), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "approve") {
      if (!applicationId) {
        return new Response(JSON.stringify({ error: "applicationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // 1) Fetch application
      const { data: app, error: appErr } = await supabase
        .from("teacher_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

      if (appErr) throw appErr;
      if (!app) {
        return new Response(JSON.stringify({ error: "Application not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // 2) Insert into teachers (map underscore names to spaces when needed)
      const insertPayload: Record<string, unknown> = {
        "اسم الاستاذ": app["اسم_الاستاذ"],
        "رقم الهاتف": app["رقم_الهاتف"] ?? null,
        المسجد: null,
        اسم_الاب: app["اسم_الاب"] ?? null,
        تاريخ_الميلاد: app["تاريخ_الميلاد"] ?? null,
        التحصيل_الدراسي: app["التحصيل_الدراسي"] ?? null,
        الحالة_الاجتماعية: app["الحالة_الاجتماعية"] ?? null,
        المؤهل_العلمي_الديني: app["المؤهل_العلمي_الديني"] ?? null,
        اسم_المسجد_السابق: app["اسم_المسجد_السابق"] ?? null,
        مكان_وصول_الحفظ: app["مكان_وصول_الحفظ"] ?? null,
        اسم_المعلم_السابق: app["اسم_المعلم_السابق"] ?? null,
        اسم_الثانوية_الشرعية: app["اسم_الثانوية_الشرعية"] ?? null,
        عدد_سنوات_التحصيل: app["عدد_سنوات_التحصيل"] ?? null,
        الحالة_الصحية_والنفسية: app["الحالة_الصحية_والنفسية"] ?? null,
        الوظيفة_المرغوبة: app["الوظيفة_المرغوبة"] ?? null,
        الصف_المرغوب: app["الصف_المرغوب"] ?? null,
        المهارات: app["المهارات"] ?? null,
        الأحلام: app["الأحلام"] ?? null,
        سنوات_الالتزام: app["سنوات_الالتزام"] ?? null,
        البريد_الالكتروني: app["البريد_الالكتروني"] ?? null,
        حالة_الطلب: "مقبول",
      };

      const { error: insErr } = await supabase.from("teachers").insert(insertPayload);
      if (insErr) throw insErr;

      // 3) Mark application as approved
      const { error: updErr } = await supabase
        .from("teacher_applications")
        .update({ حالة_الطلب: "مقبول", reviewed_at: new Date().toISOString() })
        .eq("id", applicationId);
      if (updErr) throw updErr;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});