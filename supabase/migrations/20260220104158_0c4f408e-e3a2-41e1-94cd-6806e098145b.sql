-- Allow principal admin to insert admin roles
CREATE POLICY "Principal admin can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email = 'inconnuboytech@gmail.com'
  )
);

-- Allow principal admin to delete roles
CREATE POLICY "Principal admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email = 'inconnuboytech@gmail.com'
  )
);

-- Allow admins to view all roles (for admin panel)
CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);