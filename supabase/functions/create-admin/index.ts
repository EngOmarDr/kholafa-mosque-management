import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // التحقق من Authorization header
    const authHeader = req.headers.get('Authorization')
    
    // السماح بإنشاء أول أدمن بدون تحقق (للإعداد الأولي)
    let skipAuthCheck = false
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
      
      if (!userError && callerUser) {
        // التحقق من صلاحيات الأدمن
        const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
          _user_id: callerUser.id,
          _role: 'admin'
        })

        if (roleError || !isAdmin) {
          console.log('User is not admin:', callerUser.id)
          return new Response(
            JSON.stringify({ error: 'ليس لديك صلاحية لإنشاء حسابات' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Admin verified:', callerUser.id)
      }
    } else {
      // التحقق من وجود أي أدمن في النظام
      const { count, error: countError } = await supabaseAdmin
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
      
      if (countError) {
        console.error('Error checking admin count:', countError)
      }
      
      if (count && count > 0) {
        console.log('System has admins, auth required')
        return new Response(
          JSON.stringify({ error: 'غير مصرح - يجب تسجيل الدخول كأدمن' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // لا يوجد أدمن، السماح بإنشاء أول أدمن
      skipAuthCheck = true
      console.log('No admins exist, allowing first admin creation')
    }

    const { email, password, name, phone, role } = await req.json()

    // التحقق من الحقول المطلوبة
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'الحقول المطلوبة: email, password, name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من صحة الدور
    const validRoles = ['admin', 'supervisor', 'teacher', 'student', 'parent', 'user']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'دور غير صالح. يجب أن يكون: ' + validRoles.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating user:', email, 'with role:', role)

    // إنشاء المستخدم في Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إنشاء سجل الدور في user_roles
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role
      })

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError)
    } else {
      console.log('Role inserted successfully for user:', authData.user.id)
    }

    // إنشاء سجل في profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        name: name,
        email: email,
        phone: phone,
        role: role,
        active: true
      })

    if (profileError) {
      console.error('Profile error:', profileError)
    }

    console.log('User created successfully:', authData.user.id)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authData.user.id,
        message: 'تم إنشاء الحساب بنجاح'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
