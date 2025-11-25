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
    console.log('Submission service action:', action);

    switch (action) {
      case 'create':
        return await createSubmission(supabaseClient, data);
      case 'update':
        return await updateSubmission(supabaseClient, data);
      case 'list':
        return await listSubmissions(supabaseClient, data);
      case 'get':
        return await getSubmission(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in submission-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createSubmission(supabase: any, data: any) {
  // Check if already submitted
  const { data: existing } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', data.student_id)
    .eq('assignment_id', data.assignment_id)
    .single();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'Assignment already submitted' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: data.assignment_id,
      student_id: data.student_id,
      content: data.content,
      file_url: data.file_url,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating submission:', error);
    throw error;
  }

  console.log('Submission created:', submission.id);

  // Get assignment and course details
  const { data: assignment } = await supabase
    .from('assignments')
    .select('title, course_id, courses(created_by)')
    .eq('id', data.assignment_id)
    .single();

  // Notify lecturer
  if (assignment?.courses?.created_by) {
    await supabase.functions.invoke('send-notification', {
      body: {
        user_id: assignment.courses.created_by,
        type: 'submission',
        title: 'New Submission',
        message: `A student has submitted assignment "${assignment.title}".`,
      },
    });
  }

  return new Response(
    JSON.stringify({ success: true, submission }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateSubmission(supabase: any, data: any) {
  const { id, ...updates } = data;
  const { data: submission, error } = await supabase
    .from('submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating submission:', error);
    throw error;
  }

  console.log('Submission updated:', submission.id);

  return new Response(
    JSON.stringify({ success: true, submission }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listSubmissions(supabase: any, data: any) {
  let query = supabase.from('submissions').select('*');

  if (data?.assignment_id) {
    query = query.eq('assignment_id', data.assignment_id);
  }

  if (data?.student_id) {
    query = query.eq('student_id', data.student_id);
  }

  const { data: submissions, error } = await query.order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error listing submissions:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, submissions }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getSubmission(supabase: any, data: any) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', data.id)
    .single();

  if (error) {
    console.error('Error getting submission:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, submission }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}