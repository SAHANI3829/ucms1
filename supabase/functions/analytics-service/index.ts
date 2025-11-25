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
    console.log('Analytics service action:', action);

    switch (action) {
      case 'course-analytics':
        return await getCourseAnalytics(supabaseClient, data);
      case 'student-performance':
        return await getStudentPerformance(supabaseClient, data);
      case 'system-metrics':
        return await getSystemMetrics(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in analytics-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getCourseAnalytics(supabase: any, data: any) {
  const courseId = data.course_id;

  // Get total enrollments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('*')
    .eq('course_id', courseId);

  if (enrollError) throw enrollError;

  // Get assignments
  const { data: assignments, error: assignError } = await supabase
    .from('assignments')
    .select('*')
    .eq('course_id', courseId);

  if (assignError) throw assignError;

  // Get submissions
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*, assignments!inner(course_id)')
    .eq('assignments.course_id', courseId);

  if (subError) throw subError;

  // Calculate average grade
  const gradedSubmissions = submissions?.filter((s: any) => s.grade !== null) || [];
  const averageGrade = gradedSubmissions.length > 0
    ? gradedSubmissions.reduce((sum: number, s: any) => sum + s.grade, 0) / gradedSubmissions.length
    : 0;

  const analytics = {
    total_students: enrollments?.length || 0,
    total_assignments: assignments?.length || 0,
    total_submissions: submissions?.length || 0,
    graded_submissions: gradedSubmissions.length,
    average_grade: Math.round(averageGrade * 100) / 100,
    completion_rate: assignments && assignments.length > 0
      ? Math.round((gradedSubmissions.length / (enrollments?.length || 1) / assignments.length) * 100)
      : 0,
  };

  return new Response(
    JSON.stringify({ success: true, analytics }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getStudentPerformance(supabase: any, data: any) {
  const studentId = data.student_id;

  // Get all submissions
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*, assignments(title, max_grade, course_id)')
    .eq('student_id', studentId);

  if (subError) throw subError;

  // Get enrollments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', studentId);

  if (enrollError) throw enrollError;

  const gradedSubmissions = submissions?.filter((s: any) => s.grade !== null) || [];
  const averageGrade = gradedSubmissions.length > 0
    ? gradedSubmissions.reduce((sum: number, s: any) => sum + (s.grade / s.assignments.max_grade * 100), 0) / gradedSubmissions.length
    : 0;

  const performance = {
    total_courses: enrollments?.length || 0,
    total_submissions: submissions?.length || 0,
    graded_submissions: gradedSubmissions.length,
    average_grade_percentage: Math.round(averageGrade * 100) / 100,
    submissions_by_course: submissions?.reduce((acc: any, s: any) => {
      const courseId = s.assignments.course_id;
      if (!acc[courseId]) {
        acc[courseId] = [];
      }
      acc[courseId].push(s);
      return acc;
    }, {}),
  };

  return new Response(
    JSON.stringify({ success: true, performance }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getSystemMetrics(supabase: any, data: any) {
  // Get total counts
  const { data: courses } = await supabase.from('courses').select('*');
  const { data: students } = await supabase.from('user_roles').select('*').eq('role', 'student');
  const { data: lecturers } = await supabase.from('user_roles').select('*').eq('role', 'lecturer');
  const { data: assignments } = await supabase.from('assignments').select('*');
  const { data: submissions } = await supabase.from('submissions').select('*');
  const { data: enrollments } = await supabase.from('enrollments').select('*');

  const metrics = {
    total_courses: courses?.length || 0,
    total_students: students?.length || 0,
    total_lecturers: lecturers?.length || 0,
    total_assignments: assignments?.length || 0,
    total_submissions: submissions?.length || 0,
    total_enrollments: enrollments?.length || 0,
  };

  return new Response(
    JSON.stringify({ success: true, metrics }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
