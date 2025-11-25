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
    console.log('Grading service action:', action);

    switch (action) {
      case 'grade':
        return await gradeSubmission(supabaseClient, data);
      case 'update-grade':
        return await updateGrade(supabaseClient, data);
      case 'get-statistics':
        return await getStatistics(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in grading-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function gradeSubmission(supabase: any, data: any) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .update({
      grade: data.grade,
      feedback: data.feedback,
      graded_by: data.graded_by,
      graded_at: new Date().toISOString(),
    })
    .eq('id', data.submission_id)
    .select('*, assignments(title)')
    .single();

  if (error) {
    console.error('Error grading submission:', error);
    throw error;
  }

  console.log('Submission graded:', submission.id);

  // Send notification to student
  await supabase.functions.invoke('send-notification', {
    body: {
      user_id: submission.student_id,
      type: 'grade',
      title: 'Assignment Graded',
      message: `Your submission for "${submission.assignments.title}" has been graded. Grade: ${submission.grade}`,
    },
  });

  return new Response(
    JSON.stringify({ success: true, submission }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateGrade(supabase: any, data: any) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .update({
      grade: data.grade,
      feedback: data.feedback,
      graded_at: new Date().toISOString(),
    })
    .eq('id', data.submission_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating grade:', error);
    throw error;
  }

  console.log('Grade updated:', submission.id);

  return new Response(
    JSON.stringify({ success: true, submission }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getStatistics(supabase: any, data: any) {
  let query = supabase
    .from('submissions')
    .select('grade');

  if (data?.assignment_id) {
    query = query.eq('assignment_id', data.assignment_id);
  }

  if (data?.course_id) {
    query = query
      .select('grade, assignments!inner(course_id)')
      .eq('assignments.course_id', data.course_id);
  }

  query = query.not('grade', 'is', null);

  const { data: submissions, error } = await query;

  if (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }

  if (!submissions || submissions.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        statistics: {
          count: 0,
          average: 0,
          min: 0,
          max: 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const grades = submissions.map((s: any) => s.grade);
  const average = grades.reduce((a: number, b: number) => a + b, 0) / grades.length;
  const min = Math.min(...grades);
  const max = Math.max(...grades);

  return new Response(
    JSON.stringify({
      success: true,
      statistics: {
        count: grades.length,
        average: Math.round(average * 100) / 100,
        min,
        max,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}