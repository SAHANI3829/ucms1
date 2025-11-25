import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { action, data } = await req.json();
    console.log('Enrollment service action:', action);

    switch (action) {
      case 'enroll':
        return await enrollStudent(supabaseClient, data);
      case 'unenroll':
        return await unenrollStudent(supabaseClient, data);
      case 'list':
        return await listEnrollments(supabaseClient, data);
      case 'update-status':
        return await updateEnrollmentStatus(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in enrollment-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function enrollStudent(supabase: any, data: any) {
  // Check if already enrolled
  const { data: existing } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', data.student_id)
    .eq('course_id', data.course_id)
    .single();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'Student already enrolled in this course' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .insert({
      student_id: data.student_id,
      course_id: data.course_id,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error enrolling student:', error);
    throw error;
  }

  console.log('Student enrolled:', enrollment.id);

  // Get course details
  const { data: course } = await supabase
    .from('courses')
    .select('title')
    .eq('id', data.course_id)
    .single();

  // Send notification
  await supabase.functions.invoke('send-notification', {
    body: {
      user_id: data.student_id,
      type: 'enrollment',
      title: 'Enrollment Successful',
      message: `You have been enrolled in "${course?.title || 'the course'}".`,
    },
  });

  return new Response(
    JSON.stringify({ success: true, enrollment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function unenrollStudent(supabase: any, data: any) {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('student_id', data.student_id)
    .eq('course_id', data.course_id);

  if (error) {
    console.error('Error unenrolling student:', error);
    throw error;
  }

  console.log('Student unenrolled:', data.student_id);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listEnrollments(supabase: any, data: any) {
  let query = supabase
    .from('enrollments')
    .select('*, courses(*)');

  if (data?.student_id) {
    query = query.eq('student_id', data.student_id);
  }

  if (data?.course_id) {
    query = query.eq('course_id', data.course_id);
  }

  if (data?.status) {
    query = query.eq('status', data.status);
  }

  const { data: enrollments, error } = await query.order('enrolled_at', { ascending: false });

  if (error) {
    console.error('Error listing enrollments:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, enrollments }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateEnrollmentStatus(supabase: any, data: any) {
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .update({ status: data.status })
    .eq('id', data.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating enrollment status:', error);
    throw error;
  }

  console.log('Enrollment status updated:', enrollment.id);

  return new Response(
    JSON.stringify({ success: true, enrollment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
