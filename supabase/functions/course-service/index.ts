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
    console.log('Course service action:', action);

    switch (action) {
      case 'create':
        return await createCourse(supabaseClient, data);
      case 'update':
        return await updateCourse(supabaseClient, data);
      case 'delete':
        return await deleteCourse(supabaseClient, data);
      case 'list':
        return await listCourses(supabaseClient, data);
      case 'get':
        return await getCourse(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in course-service:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createCourse(supabase: any, data: any) {
  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      title: data.title,
      description: data.description,
      lecturer_id: data.lecturer_id,
      created_by: data.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating course:', error);
    throw error;
  }

  console.log('Course created:', course.id);

  // Send notification
  await supabase.functions.invoke('send-notification', {
    body: {
      user_id: data.created_by,
      type: 'course',
      title: 'Course Created',
      message: `Course "${course.title}" has been created successfully.`,
    },
  });

  return new Response(
    JSON.stringify({ success: true, course }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateCourse(supabase: any, data: any) {
  const { id, ...updates } = data;
  const { data: course, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating course:', error);
    throw error;
  }

  console.log('Course updated:', course.id);

  return new Response(
    JSON.stringify({ success: true, course }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteCourse(supabase: any, data: any) {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', data.id);

  if (error) {
    console.error('Error deleting course:', error);
    throw error;
  }

  console.log('Course deleted:', data.id);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listCourses(supabase: any, data: any) {
  let query = supabase.from('courses').select('*');

  if (data?.lecturer_id) {
    query = query.eq('lecturer_id', data.lecturer_id);
  }

  const { data: courses, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing courses:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, courses }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getCourse(supabase: any, data: any) {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', data.id)
    .single();

  if (error) {
    console.error('Error getting course:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true, course }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}