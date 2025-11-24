# Migration Guide: Lovable Cloud to Your Own Supabase Backend

## Overview
This guide will help you migrate from Lovable Cloud (managed Supabase) to your own Supabase project with a microservices-oriented architecture.

## Architecture Overview

### Current Architecture (Lovable Cloud)
- Single React SPA frontend
- Integrated Supabase backend (managed by Lovable)
- Centralized database
- Edge functions for serverless operations

### Target Architecture (Your Own Supabase)
- React SPA frontend
- Your own Supabase project
- Microservices pattern using Edge Functions
- Domain-driven service boundaries

## Migration Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project:
   - Choose project name
   - Set strong database password
   - Select region closest to users
3. Wait ~2 minutes for initialization

### Step 2: Configure Authentication

1. In Supabase Dashboard → Authentication → Settings:
   - Enable Email provider
   - **IMPORTANT**: Disable "Confirm email" for testing (enable in production)
   - Set Site URL to your app URL
   - Add redirect URLs

### Step 3: Run Database Migrations

Copy all SQL from the README above and run in Supabase SQL Editor in order:
1. Migration 1: Create Enum and Base Tables
2. Migration 2: Create Functions and Triggers
3. Migration 3: Enable RLS and Create Policies

### Step 4: Set Up Edge Functions (Microservices)

#### Install Supabase CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-id
```

#### Create Edge Functions
```bash
# Create functions directory
supabase functions new send-notification

# Copy the send-notification code from above into:
# supabase/functions/send-notification/index.ts

# Deploy
supabase functions deploy send-notification
```

#### Future Microservices to Create:
- **course-service**: Manage course operations
- **assignment-service**: Handle assignment lifecycle
- **grading-service**: Process grading and feedback
- **notification-service**: Handle all notifications (already created)
- **enrollment-service**: Manage student enrollments
- **analytics-service**: Generate reports and analytics

### Step 5: Update Frontend Configuration

1. Copy `.env.example` to `.env.local`
2. Update with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

3. The Supabase client is already configured in `src/integrations/supabase/client.ts`

### Step 6: Create Admin User

Run this in Supabase SQL Editor after creating your first user:
```sql
-- Replace 'your-user-email@example.com' with your actual email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'your-user-email@example.com';
```

## Microservices Architecture Pattern

### Service Boundaries

Each Edge Function should represent a bounded context:

```
├── course-service/          # Course management
│   ├── Create course
│   ├── Update course
│   ├── Delete course
│   └── List courses
│
├── assignment-service/      # Assignment operations
│   ├── Create assignment
│   ├── Update assignment
│   ├── Delete assignment
│   └── List assignments
│
├── enrollment-service/      # Student enrollment
│   ├── Enroll student
│   ├── Unenroll student
│   └── List enrollments
│
├── submission-service/      # Assignment submissions
│   ├── Submit assignment
│   ├── Update submission
│   └── List submissions
│
├── grading-service/         # Grading logic
│   ├── Grade submission
│   ├── Update grade
│   └── Calculate statistics
│
├── notification-service/    # Notifications (created)
│   ├── Send notification
│   ├── Mark as read
│   └── List notifications
│
└── analytics-service/       # Analytics & reporting
    ├── Course analytics
    ├── Student performance
    └── System metrics
```

### Service Communication

Edge Functions communicate via:
1. **Direct database access** (shared database pattern)
2. **Function-to-function calls** using `supabase.functions.invoke()`
3. **Event-driven** (future: using Supabase Realtime)

### Example: Course Service Edge Function

```typescript
// supabase/functions/course-service/index.ts
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

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  try {
    const { action, data } = await req.json();

    switch (action) {
      case 'create':
        return await createCourse(supabaseClient, data);
      case 'update':
        return await updateCourse(supabaseClient, data);
      case 'delete':
        return await deleteCourse(supabaseClient, data);
      case 'list':
        return await listCourses(supabaseClient, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createCourse(supabase: any, data: any) {
  const { data: course, error } = await supabase
    .from('courses')
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  // Notify via notification service
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

  if (error) throw error;

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

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listCourses(supabase: any, data: any) {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, courses }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Testing Your Migration

1. **Test Authentication**:
   - Sign up new user
   - Select role (student/lecturer)
   - Verify profile created
   - Check role assigned

2. **Test Authorization**:
   - Admin: Can create courses
   - Lecturer: Can manage their courses
   - Student: Can view and enroll

3. **Test Edge Functions**:
   ```typescript
   const { data, error } = await supabase.functions.invoke('send-notification', {
     body: {
       user_id: 'user-uuid',
       type: 'test',
       title: 'Test',
       message: 'Testing notification service'
     }
   });
   ```

## Deployment Checklist

- [ ] Database migrations completed
- [ ] RLS policies verified
- [ ] Edge functions deployed
- [ ] Environment variables updated
- [ ] Admin user created
- [ ] Authentication tested
- [ ] Authorization tested
- [ ] Email confirmation enabled (production)
- [ ] CORS configured properly
- [ ] Error logging set up

## Advantages of This Architecture

1. **Service Independence**: Each edge function is independently deployable
2. **Clear Boundaries**: Domain-driven design with clear service responsibilities
3. **Scalability**: Services scale independently based on load
4. **Maintainability**: Smaller, focused codebases per service
5. **Security**: RLS policies enforce data access at database level
6. **Flexibility**: Easy to add new services without affecting existing ones

## Next Steps

1. Complete the migration following steps above
2. Create additional edge functions for remaining services
3. Implement error handling and logging
4. Set up monitoring and analytics
5. Add integration tests for each service
6. Document API contracts for each service

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Verify RLS policies are correct
3. Ensure environment variables are set
4. Check edge function logs
5. Review authentication flow

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
