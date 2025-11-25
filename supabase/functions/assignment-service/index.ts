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
    console.log('Assignment service action:', action);

    switch (action) {
      case 'create':
        return await createAssignment(supabaseClient, data);
      case 'update':
        return await updateAssignment(supabaseClient, data);
      case 'delete':
        return await deleteAssignment(supabaseClient, data);
      case 'list':
        return await listAssignments(supabaseClient, data);
      case 'get':
        return await getAssignment(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in assignment-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createAssignment(supabase: any, data: any) {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert({
      title: data.title,
      description: data.description,
      course_id: data.course_id,
      due_date: data.due_date,
      max_grade: data.max_grade || 100,
      created_by: data.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating assignment:', error);
    throw error;
  }

  console.log('Assignment created:', assignment.id);

  // Get enrolled students to notify
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('course_id', data.course_id)
    .eq('status', 'active');

  // Send notifications to all enrolled students
  if (enrollments && enrollments.length > 0) {
    for (const enrollment of enrollments) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: enrollment.student_id,
          type: 'assignment',
          title: 'New Assignment',
          message: `New assignment "${assignment.title}" has been posted.`,
        },
      });
    }
  }

  return new Response(
    JSON.stringify({ success: true, assignment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateAssignment(supabase: any, data: any) {
  const { id, ...updates } = data;
  const { data: assignment, error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating assignment:', error);
    throw error;
  }

  console.log('Assignment updated:', assignment.id);

  return new Response(
    JSON.stringify({ success: true, assignment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteAssignment(supabase: any, data: any) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', data.id);

  if (error) {
    console.error('Error deleting assignment:', error);
    throw error;
  }

  console.log('Assignment deleted:', data.id);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listAssignments(supabase: any, data: any) {
  let query = supabase.from('assignments').select('*');

  if (data?.course_id) {
    query = query.eq('course_id', data.course_id);
  }

  const { data: assignments, error } = await query.order('due_date', { ascending: true });

  if (error) {
    console.error('Error listing assignments:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, assignments }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getAssignment(supabase: any, data: any) {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', data.id)
    .single();

  if (error) {
    console.error('Error getting assignment:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, assignment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}