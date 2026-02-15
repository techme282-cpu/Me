
-- Allow admins/owners to add members to their groups
CREATE POLICY "Admins add members"
ON public.group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);
