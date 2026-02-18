import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// دالة لتحويل الأحرف العربية إلى إنجليزية
const arabicToEnglishMap: { [key: string]: string } = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'dh',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'h', 'ء': 'a',
  ' ': '',
};

const arabicToEnglish = (arabicName: string): string => {
  if (!arabicName) return '';
  let englishName = '';
  for (const char of arabicName.toLowerCase()) {
    englishName += arabicToEnglishMap[char] || char;
  }
  return englishName.replace(/[^a-z]/g, '');
};

const generatePassword = (name: string): string => {
  const englishName = arabicToEnglish(name);
  const namePrefix = englishName.substring(0, 4).toLowerCase().padEnd(4, 'x');
  const randomNumbers = Math.floor(1000 + Math.random() * 9000).toString();
  return namePrefix + randomNumbers;
};

const generateUsername = (fullName: string): string => {
  const englishName = arabicToEnglish(fullName);
  return englishName.toLowerCase() || 'teacher';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح. يجب تسجيل الدخول.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user has admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'رمز المصادقة غير صالح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roles) {
      return new Response(
        JSON.stringify({ error: 'صلاحيات غير كافية. يتطلب دور المسؤول.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { teachers } = await req.json();
    
    // Input validation
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'يجب إرسال قائمة الأساتذة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit array size to prevent abuse
    if (teachers.length > 100) {
      return new Response(
        JSON.stringify({ error: 'الحد الأقصى 100 أستاذ في المرة الواحدة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting bulk creation for ${teachers.length} teachers`);

    const results = [];
    const errors = [];

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // جلب جميع الإيميلات الموجودة مرة واحدة
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingEmails = new Set(existingUsers.users.map(u => u.email?.toLowerCase()));
    console.log(`Found ${existingEmails.size} existing email addresses in system`);

    for (const teacher of teachers) {
      try {
        const teacherName = teacher.name;
        const teacherId = teacher.teacher_id;
        const teacherEmail = teacher.email;
        const teacherPassword = teacher.password;
        const teacherPhone = teacher.phone;

        console.log(`Processing teacher: ${teacherName} (ID: ${teacherId})`);

        // التحقق من أن الأستاذ ليس لديه حساب بالفعل
        const { data: existingTeacher } = await supabaseAdmin
          .from('teachers')
          .select('user_id')
          .eq('id', teacherId)
          .single();

        if (existingTeacher?.user_id) {
          console.log(`Teacher ${teacherName} already has an account, skipping...`);
          errors.push({ 
            name: teacherName, 
            error: 'لديه حساب بالفعل', 
            details: 'الأستاذ لديه حساب مسجل مسبقاً'
          });
          continue;
        }

        // التحقق من وجود البريد الإلكتروني في auth.users
        const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === teacherEmail.toLowerCase());
        
        if (existingUser) {
          console.log(`User with email ${teacherEmail} already exists in auth.users`);
          
          // التحقق إذا كان الأستاذ لديه حساب مرتبط بالفعل
          if (existingTeacher?.user_id) {
            console.log(`Teacher ${teacherName} already has a linked account`);
            errors.push({ 
              name: teacherName, 
              error: 'لديه حساب بالفعل', 
              details: 'الأستاذ لديه حساب مرتبط مسبقاً'
            });
            continue;
          }
          
          // ربط المستخدم الموجود بالأستاذ
          console.log(`Linking existing user ${existingUser.id} to teacher ${teacherName}`);
          
          // التحقق من وجود profile أولاً
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', existingUser.id)
            .single();

          if (existingProfile) {
            // تحديث profile موجود
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .update({
                name: teacherName,
                email: teacherEmail,
                phone: teacherPhone,
                role: 'teacher',
                active: true
              })
              .eq('id', existingUser.id);

            if (profileError) {
              console.error(`Error updating profile:`, profileError);
            }
          } else {
            // إنشاء profile جديد
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: existingUser.id,
                name: teacherName,
                email: teacherEmail,
                phone: teacherPhone,
                role: 'teacher',
                active: true
              });

            if (profileError) {
              console.error(`Error creating profile:`, profileError);
            }
          }

          // إضافة أو تحديث دور المستخدم
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .upsert({
              user_id: existingUser.id,
              role: 'teacher'
            }, {
              onConflict: 'user_id,role'
            });

          if (roleError) {
            console.error(`Error upserting role:`, roleError);
          }

          // ربط الحساب بالأستاذ
          const { error: linkError } = await supabaseAdmin
            .from('teachers')
            .update({ 
              user_id: existingUser.id,
              'البريد_الالكتروني': teacherEmail
            })
            .eq('id', teacherId);

          if (linkError) {
            console.error(`Error linking user to teacher:`, linkError);
            errors.push({ 
              name: teacherName, 
              error: 'فشل ربط الحساب', 
              details: linkError.message 
            });
          } else {
            console.log(`Successfully linked existing user to teacher ${teacherName}`);
            results.push({
              name: teacherName,
              email: teacherEmail,
              success: true,
              message: 'تم ربط الحساب الموجود بنجاح'
            });
          }
          continue;
        }

        // 1. إنشاء المستخدم في auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: teacherEmail,
          password: teacherPassword,
          email_confirm: true,
          user_metadata: {
            name: teacherName,
            role: 'teacher'
          }
        });

        if (authError) {
          console.error(`Error creating auth user for ${teacherName}:`, authError);
          errors.push({ 
            name: teacherName, 
            error: 'فشل إنشاء حساب المصادقة', 
            details: authError.message 
          });
          continue;
        }

        const userId = authData.user.id;
        console.log(`Auth user created for ${teacherName} with ID: ${userId}`);

        // إضافة البريد للقائمة المستخدمة
        existingEmails.add(teacherEmail.toLowerCase());

        // الانتظار قليلاً للسماح للـ trigger بإنشاء profile
        await new Promise(resolve => setTimeout(resolve, 100));

        // تحديث profile (الذي تم إنشاؤه بواسطة trigger)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            name: teacherName,
            email: teacherEmail,
            phone: teacherPhone,
            role: 'teacher',
            active: true
          })
          .eq('id', userId);

        if (profileError) {
          console.error(`Error updating profile for ${teacherName}:`, profileError);
          // حذف المستخدم إذا فشل تحديث الملف الشخصي
          await supabaseAdmin.auth.admin.deleteUser(userId);
          errors.push({ 
            name: teacherName, 
            error: 'فشل تحديث الملف الشخصي', 
            details: profileError.message 
          });
          continue;
        }

        // 3. إضافة أو تحديث دور المستخدم
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'teacher'
          }, {
            onConflict: 'user_id,role'
          });

        if (roleError) {
          console.error(`Error upserting role for ${teacherName}:`, roleError);
        }

        // 4. ربط الحساب بالأستاذ
        const { error: teacherUpdateError } = await supabaseAdmin
          .from('teachers')
          .update({ 
            user_id: userId,
            'البريد_الالكتروني': teacherEmail
          })
          .eq('id', teacherId);

        if (teacherUpdateError) {
          console.error(`Error updating teacher ${teacherName}:`, teacherUpdateError);
          errors.push({ 
            name: teacherName, 
            error: 'تم إنشاء الحساب لكن فشل ربطه بالأستاذ', 
            details: teacherUpdateError.message 
          });
          continue;
        }

        console.log(`Account successfully created and linked for ${teacherName}`);

        results.push({
          name: teacherName,
          email: teacherEmail,
          success: true,
          message: 'تم إنشاء الحساب بنجاح'
        });

      } catch (err) {
        console.error(`Exception for teacher ${teacher.name}:`, err);
        errors.push({ 
          name: teacher.name, 
          error: 'حدث خطأ غير متوقع', 
          details: err instanceof Error ? err.message : String(err)
        });
      }
    }

    console.log(`Bulk creation completed. Success: ${results.length}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        created: results.length,
        failed: errors.length,
        results,
        errors
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Bulk creation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'حدث خطأ أثناء العملية',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});