-- Allow users to insert their own role during signup (but not admin role)
CREATE POLICY "Users can set their own role during signup"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('student', 'lecturer')
);

-- Update the admin policy name for clarity
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert any role"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));